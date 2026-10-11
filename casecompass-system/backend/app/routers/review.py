"""Reviewer decisions: issue status, resolutions, reopening, notes, event corrections and reminders.

Every decision needs a reason, is logged with the reviewer's name and time, and never overwrites
the extracted record: resolutions and corrections are separate rows that can be withdrawn."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Case, Document, Event, EventCorrection, Issue, Note, Reminder, Resolution, User
from ..parsing.dates import fmt_num
from ..schemas import CorrectionIn, NoteIn, ReminderIn, ResolveIn, StatusIn
from ..security import current_user
from ..services.audit import log
from ..services.bundle import build_bundle
from ..services.timeline import verified_deadlines
from .deps import case_dep

router = APIRouter(prefix="/api/cases/{case_id}", tags=["review"])

ALLOWED = {
    "conflict": {"corrected"},
    "quarantine": {"confirmed", "dismissed"},
    "missing": {"requested", "linked", "not_required"},
    "undated": {"dated", "acknowledged"},
    "sequence": {"acknowledged"},
}
STATUS_LABEL = {"open": "Open", "in_review": "In review", "resolved": "Resolved"}


def _issue(case: Case, code: str, db: Session) -> Issue:
    i = db.query(Issue).filter(Issue.case_id == case.id, Issue.code == code).first()
    if not i:
        raise HTTPException(404, "Issue not found.")
    return i


@router.post("/issues/{code}/status")
def set_status(code: str, body: StatusIn, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    i = _issue(case, code, db)
    if i.status == "resolved":
        raise HTTPException(409, "This issue is resolved. Reopen it to change its status.")
    i.status = body.status
    log(db, case.id, "Status changed", f"{i.title}: marked {STATUS_LABEL[body.status].lower()}", kind="status", user=user, issue_code=i.code)
    db.commit()
    return {"ok": True}


@router.post("/issues/{code}/resolve")
def resolve(code: str, body: ResolveIn, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    i = _issue(case, code, db)
    if body.type not in ALLOWED[i.type]:
        raise HTTPException(422, f"A {i.type} issue cannot be resolved as '{body.type}'.")
    reason = body.reason.strip()
    data: dict = {}
    status = "resolved"
    if body.type == "corrected":
        records = (i.payload or {}).get("records", [])
        letters = "ABCDEFGH"[: len(records)]
        if not body.date or not body.basis or (body.basis not in letters and body.basis != "other"):
            raise HTTPException(422, "Choose the corrected date and which record (or another source) it is based on.")
        data = {"date": body.date.isoformat(), "basis": body.basis}
        action = "Correction recorded"
        basis = "another source" if body.basis == "other" else f"Record {body.basis}"
        detail = f"{i.title}: date set to {fmt_num(body.date)} based on {basis}. Reason: {reason}. Original records kept."
    elif body.type == "confirmed":
        if not body.date or not body.kind:
            raise HTTPException(422, "Enter the verified date and how it should appear on the timeline.")
        data = {"date": body.date.isoformat(), "kind": body.kind}
        action, detail = "Date confirmed", f"{i.title}: {fmt_num(body.date)} entered as {body.kind}. Basis: {reason}"
    elif body.type == "dated":
        if not body.date:
            raise HTTPException(422, "Enter the date stated by the source.")
        data = {"date": body.date.isoformat()}
        action, detail = "Date recorded", f"{i.title}: {fmt_num(body.date)}. Source: {reason}"
    elif body.type == "linked":
        if not body.doc:
            raise HTTPException(422, "Choose the file that contains this document.")
        known = {d.code for d in db.query(Document).filter(Document.case_id == case.id).all()} | {
            d.filename for d in db.query(Document).filter(Document.case_id == case.id).all()}
        if body.doc not in known:
            raise HTTPException(422, "That file is not in this case's bundle.")
        data = {"doc": body.doc}
        action, detail = "Document linked", f"{i.title}: linked to {body.doc}. {reason}"
    elif body.type == "requested":
        status = "in_review"
        action, detail = "Requested", f"{i.title}: {reason}"
    elif body.type == "not_required":
        action, detail = "Marked not needed", f"{i.title}: {reason}"
    elif body.type == "dismissed":
        action, detail = "Dismissed", f"{i.title}: {reason}"
    else:
        action, detail = "Acknowledged", f"{i.title}: {reason}"

    now = datetime.now(timezone.utc)
    for old in db.query(Resolution).filter(Resolution.issue_id == i.id, Resolution.active.is_(True)).all():
        old.active, old.withdrawn_at = False, now
    db.add(Resolution(issue_id=i.id, type=body.type, data=data, reason=reason, user_id=user.id, actor_name=user.name, active=True))
    i.status = status
    log(db, case.id, action, detail, kind="correction", user=user, issue_code=i.code)
    db.commit()
    return {"ok": True}


@router.post("/issues/{code}/reopen")
def reopen(code: str, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    i = _issue(case, code, db)
    now = datetime.now(timezone.utc)
    for r in db.query(Resolution).filter(Resolution.issue_id == i.id, Resolution.active.is_(True)).all():
        r.active, r.withdrawn_at = False, now
    i.status = "open"
    log(db, case.id, "Reopened", f"{i.title}: earlier decision withdrawn, original records restored", kind="correction", user=user, issue_code=i.code)
    db.commit()
    return {"ok": True}


@router.post("/notes", status_code=201)
def add_note(body: NoteIn, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.target_type == "issue":
        target = _issue(case, body.target_code, db).title
    else:
        ev = db.query(Event).filter(Event.case_id == case.id, Event.code == body.target_code).first()
        if not ev:
            raise HTTPException(404, "Timeline entry not found.")
        target = ev.title
    text = body.text.strip()
    db.add(Note(case_id=case.id, target_type=body.target_type, target_code=body.target_code, text=text, user_id=user.id, actor_name=user.name))
    log(db, case.id, "Note added", f"{target}: “{text[:80]}{'…' if len(text) > 80 else ''}”", kind="note", user=user,
        issue_code=body.target_code)
    db.commit()
    return {"ok": True}


@router.post("/events/{code}/correction")
def correct_event(code: str, body: CorrectionIn, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    ev = db.query(Event).filter(Event.case_id == case.id, Event.code == code).first()
    if not ev:
        raise HTTPException(404, "Timeline entry not found.")
    if body.date == ev.date:
        raise HTTPException(422, "The corrected date is the same as the extracted date.")
    for old in db.query(EventCorrection).filter(EventCorrection.case_id == case.id, EventCorrection.event_code == code, EventCorrection.active.is_(True)).all():
        old.active = False
    db.add(EventCorrection(case_id=case.id, event_code=code, original_date=ev.date, corrected_date=body.date, reason=body.reason.strip(),
                           user_id=user.id, actor_name=user.name))
    log(db, case.id, "Correction recorded", f"{ev.title}: date changed from {fmt_num(ev.date)} to {fmt_num(body.date)}. Reason: {body.reason.strip()}. Extracted date kept on record.",
        kind="correction", user=user, issue_code=code)
    db.commit()
    return {"ok": True}


@router.delete("/events/{code}/correction")
def withdraw_correction(code: str, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(EventCorrection).filter(EventCorrection.case_id == case.id, EventCorrection.event_code == code, EventCorrection.active.is_(True)).all()
    if not rows:
        raise HTTPException(404, "No active correction for this entry.")
    for r in rows:
        r.active = False
    ev = db.query(Event).filter(Event.case_id == case.id, Event.code == code).first()
    log(db, case.id, "Reopened", f"{ev.title if ev else code}: correction withdrawn, extracted date {fmt_num(rows[0].original_date)} restored", kind="correction", user=user, issue_code=code)
    db.commit()
    return {"ok": True}


@router.put("/reminders/{code}")
def set_reminder(code: str, body: ReminderIn, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.on:
        allowed = {n["nodeId"] for n in verified_deadlines(build_bundle(db, case, user))}
        if code not in allowed:
            raise HTTPException(422, "Reminders can only be set for verified, upcoming deadlines.")
    r = db.query(Reminder).filter(Reminder.case_id == case.id, Reminder.user_id == user.id, Reminder.event_code == code).first()
    if not r:
        r = Reminder(case_id=case.id, user_id=user.id, event_code=code)
        db.add(r)
    r.on, r.days = body.on, body.days
    db.commit()
    return {"ok": True, "on": r.on, "days": r.days}
