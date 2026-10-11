"""Assemble everything the frontend needs for one case into a single payload.

The shape matches the frontend's data model: `docs`, `items` (events, hearings, deadlines and
conflicts), `gaps`, `quarantine`, plus the reviewer layer (`status`, `resolutions`, `notes`,
`reminders`, `corrections`) and the audit `history`.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from ..config import settings
from ..glossary import GLOSSARY
from ..models import Activity, Case, DocReference, Document, Event, EventCorrection, Issue, Note, Reminder, Resolution, User
from ..stages import STAGES, stage_of, stages_payload

LETTERS = "ABCDEFGH"


def iso(d) -> str | None:
    return d.isoformat() if d else None


def _res_payload(r: Resolution) -> dict:
    return {"type": r.type, **(r.data or {}), "reason": r.reason, "who": r.actor_name, "at": iso(r.created_at)}


def case_summary(db: Session, case: Case) -> dict:
    """Counts for the case switcher and dashboard case list."""
    docs = db.query(Document).filter(Document.case_id == case.id, Document.status == "done").all()
    templates = {d.template_name for d in docs if d.template_name}
    st = STAGES.get(case.case_type, STAGES["civil"])["list"]
    idx = stage_of(case.case_type, templates)
    open_issues = db.query(Issue).filter(Issue.case_id == case.id, Issue.status != "resolved").all()
    today = date.today()
    upcoming = sorted(e.date for e in db.query(Event).filter(Event.case_id == case.id, Event.kind == "deadline", Event.date >= today).all())
    last = max(docs, key=lambda d: (d.doc_date or date.min, d.code), default=None)
    return {
        "id": case.id, "title": case.title, "short": case.short_title or _short(case.title), "no": case.number, "court": case.court,
        "type": STAGES.get(case.case_type, STAGES["civil"])["label"], "caseType": case.case_type, "status": case.status,
        "stage": idx + 1, "stageName": st[idx]["n"] if idx >= 0 else "Not started", "stages": len(st),
        "docs": len(docs), "conflicts": sum(i.type == "conflict" for i in open_issues), "missing": sum(i.type == "missing" for i in open_issues),
        "open": len(open_issues), "deadlines": len(upcoming), "next": iso(upcoming[0]) if upcoming else None,
        "closed": iso(case.closed_at), "last": last.title if last else "", "events": db.query(Event).filter(Event.case_id == case.id).count(),
    }


def _short(title: str) -> str:
    t = title.replace(" Pvt. Ltd.", "").replace(" Private Limited", "")
    if len(t) <= 34:
        return t
    parts = t.split(" v. ")
    if len(parts) == 2:
        return f"{parts[0]} v. {parts[1].split()[0]}"
    return t[:32] + "…"


def build_bundle(db: Session, case: Case, user: User) -> dict:
    docs = db.query(Document).filter(Document.case_id == case.id).order_by(Document.id).all()
    done = [d for d in docs if d.status == "done"]
    by_id = {d.id: d for d in docs}
    issues = db.query(Issue).filter(Issue.case_id == case.id).order_by(Issue.id).all()
    issue_by_fp = {i.fingerprint: i for i in issues}
    events = [e for e in db.query(Event).filter(Event.case_id == case.id).all() if e.document_id in by_id and by_id[e.document_id].status == "done"]
    corrections = {c.event_code: c for c in db.query(EventCorrection).filter(EventCorrection.case_id == case.id, EventCorrection.active.is_(True)).all()}
    issue_ids = [i.id for i in issues]
    resolutions = db.query(Resolution).filter(Resolution.issue_id.in_(issue_ids), Resolution.active.is_(True)).all() if issue_ids else []
    res_by_issue = {r.issue_id: r for r in sorted(resolutions, key=lambda r: r.created_at)}

    # ---------------------------------------------------------------- documents
    refs = defaultdict(list)
    for r in db.query(DocReference).filter(DocReference.case_id == case.id).all():
        if r.matched_document_id == r.document_id:
            continue
        if r.matched_document_id and r.matched_document_id in by_id:
            entry = {"label": r.label, "doc": by_id[r.matched_document_id].code}
        else:
            gi = issue_by_fp.get(f"missing:{r.norm}")
            entry = {"label": r.label, "gap": gi.code if gi else None}
        if entry not in refs[r.document_id]:
            refs[r.document_id].append(entry)
    docs_out = {}
    for d in done:
        docs_out[d.code] = {
            "id": d.id, "name": d.title, "type": d.doc_type, "template": d.template_name, "pages": d.pages_count,
            "uploaded": iso(d.uploaded_at.date()), "format": d.format_label, "refs": refs.get(d.id, []), "filename": d.filename,
            "method": d.method, "ocr": d.ocr_confidence, "ai": d.ai_used, "date": iso(d.doc_date),
        }

    # ---------------------------------------------------------------- timeline items
    clusters = defaultdict(list)
    for e in events:
        clusters[e.cluster_key or f"solo:{e.code}"].append(e)
    items = []
    for ck, evs in clusters.items():
        conflict = issue_by_fp.get(f"conflict:{ck}")
        if conflict and conflict.active:
            items.append({"id": conflict.code, "kind": "conflict", "title": conflict.title,
                          "dates": [{"date": r["date"], "doc": r["doc"], "page": r["page"], "quote": r["quote"], "also": r.get("also", [])}
                                    for r in conflict.payload.get("records", [])]})
            continue
        evs = sorted(evs, key=lambda e: (e.date_source != "sentence", -e.confidence, e.code))
        p = evs[0]
        item = {
            "id": p.code, "kind": p.kind, "date": iso(p.date), "title": p.title, "doc": by_id[p.document_id].code, "page": p.page,
            "quote": p.quote, "party": p.party, "method": p.method, "dateSource": p.date_source, "confidence": p.confidence,
            "sources": [{"doc": by_id[e.document_id].code, "page": e.page, "quote": e.quote} for e in evs[1:]],
        }
        if p.fulfilled_by:
            f = next((e for e in events if e.code == p.fulfilled_by), None)
            if f:
                item["fulfilled"] = {"by": f.code, "date": iso(f.date), "doc": by_id[f.document_id].code, "title": f.title}
        items.append(item)
    items.sort(key=lambda i: (i.get("date") or (i.get("dates") or [{}])[0].get("date") or "", i["id"]))

    # ---------------------------------------------------------------- issues -> gaps / quarantine
    gaps, quarantine, status, res_out = [], [], {}, {}
    for i in issues:
        status[i.code] = i.status
        if i.id in res_by_issue:
            res_out[i.code] = _res_payload(res_by_issue[i.id])
        p = i.payload or {}
        if i.type in ("missing", "undated", "sequence"):
            gaps.append({"id": i.code, "type": i.type, "date": p.get("ref_date"), "title": i.title, "doc": p.get("doc"), "page": p.get("page"),
                         "quote": p.get("quote"), "why": i.why, "refs": p.get("refs", []), "active": i.active})
        elif i.type == "quarantine":
            quarantine.append({"id": i.code, "title": i.title, "reason": p.get("reason"), "confidence": p.get("confidence"), "doc": p.get("doc"),
                               "page": p.get("page"), "quote": p.get("quote"), "note": p.get("note"), "candidate": p.get("candidate"),
                               "method": p.get("method"), "kind": p.get("kind"), "dateText": p.get("date_text"), "active": i.active})
        elif i.type == "conflict" and not i.active and i.code not in res_out:
            pass
    # reviewer corrections to stated entries: the item keeps the extracted date; the decision sits alongside
    item_ids = {it["id"] for it in items}
    for code, c in corrections.items():
        if code in item_ids:
            res_out[code] = {"type": "corrected", "date": iso(c.corrected_date), "basis": "reviewer", "original": iso(c.original_date),
                             "reason": c.reason, "who": c.actor_name, "at": iso(c.created_at)}
    # drop gaps/quarantine whose source document no longer exists
    gaps = [g for g in gaps if g["doc"] in docs_out]
    quarantine = [q for q in quarantine if q["doc"] in docs_out]

    # ---------------------------------------------------------------- reviewer layer
    notes = defaultdict(list)
    for n in db.query(Note).filter(Note.case_id == case.id).order_by(Note.created_at).all():
        notes[n.target_code].append({"text": n.text, "at": iso(n.created_at), "who": n.actor_name})
    reminders = {r.event_code: {"on": r.on, "days": r.days} for r in db.query(Reminder).filter(Reminder.case_id == case.id, Reminder.user_id == user.id).all()}
    history = [{"id": f"h{a.id}", "at": iso(a.created_at), "who": a.actor_name, "action": a.action, "detail": a.detail, "kind": a.kind,
                "issueId": a.issue_code, "ref": a.doc_code}
               for a in db.query(Activity).filter(Activity.case_id == case.id).order_by(Activity.created_at.desc(), Activity.id.desc()).limit(400)]

    templates = {d.template_name for d in done if d.template_name}
    summary = case_summary(db, case)
    all_cases = db.query(Case).filter(Case.owner_id == user.id).order_by(Case.created_at).all()
    processing = [{"id": d.id, "code": d.code, "name": d.filename, "size": d.size, "status": d.status, "step": d.step, "error": d.error}
                  for d in docs if d.status in ("queued", "processing", "failed")]
    return {
        "today": iso(date.today()),
        "user": {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone, "settings": user.settings or {}},
        "case": {**summary, "type": case.case_type, "typeLabel": summary["type"]},
        "cases": [case_summary(db, c) for c in all_cases],
        "docs": docs_out, "items": items, "gaps": gaps, "quarantine": quarantine,
        "glossary": GLOSSARY, "stages": stages_payload(case.case_type, templates),
        "history": history, "status": status, "resolutions": res_out, "notes": dict(notes), "reminders": reminders,
        "processing": processing,
        "ai": {"available": settings.ai_available, "model": settings.groq_model if settings.ai_available else None},
    }
