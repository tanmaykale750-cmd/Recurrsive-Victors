from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Case, Reminder, User
from ..reports.builder import build_report
from ..reports.export import to_docx, to_pdf
from ..security import current_user, current_user_or_query_token
from ..services.bundle import build_bundle
from ..services.timeline import build_nodes, verified_deadlines
from .deps import owned_case

router = APIRouter(prefix="/api", tags=["exports"])


def _opts(citations: bool, conflicts: bool, quarantine: bool, gaps: bool, missingAppendix: bool, correctionLog: bool) -> dict:
    return {"citations": citations, "conflicts": conflicts, "quarantine": quarantine, "gaps": gaps, "missingAppendix": missingAppendix, "correctionLog": correctionLog}


def _fname(case: Case, ext: str) -> str:
    base = "".join(ch if ch.isalnum() else "-" for ch in (case.number or case.title))[:60].strip("-") or "case"
    return f"CaseCompass_Chronology_{base}.{ext}"


@router.get("/cases/{case_id}/report")
def report_json(case_id: int, citations: bool = True, conflicts: bool = True, quarantine: bool = True, gaps: bool = True,
                missingAppendix: bool = True, correctionLog: bool = True, user: User = Depends(current_user), db: Session = Depends(get_db)):
    case = owned_case(case_id, user, db)
    return build_report(build_bundle(db, case, user), _opts(citations, conflicts, quarantine, gaps, missingAppendix, correctionLog))


@router.get("/cases/{case_id}/report.{fmt}")
def report_file(case_id: int, fmt: str, citations: bool = True, conflicts: bool = True, quarantine: bool = True, gaps: bool = True,
                missingAppendix: bool = True, correctionLog: bool = True, user: User = Depends(current_user_or_query_token), db: Session = Depends(get_db)):
    case = owned_case(case_id, user, db)
    r = build_report(build_bundle(db, case, user), _opts(citations, conflicts, quarantine, gaps, missingAppendix, correctionLog))
    if fmt == "pdf":
        return Response(to_pdf(r), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{_fname(case, "pdf")}"'})
    if fmt == "docx":
        return Response(to_docx(r), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        headers={"Content-Disposition": f'attachment; filename="{_fname(case, "docx")}"'})
    return Response("Unknown format", status_code=404)


def _ics_text(s: str) -> str:
    return s.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


@router.get("/cases/{case_id}/calendar.ics")
def calendar_ics(case_id: int, user: User = Depends(current_user_or_query_token), db: Session = Depends(get_db)):
    """Verified deadlines and hearings; reminders become calendar alarms (VALARM)."""
    case = owned_case(case_id, user, db)
    b = build_bundle(db, case, user)
    today = date.today()
    nodes = [n for n in build_nodes(b) if n["kind"] in ("deadline", "hearing") and n["cls"] not in ("conflict", "missing") and date.fromisoformat(n["date"]) >= today]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CaseCompass//EN", "CALSCALE:GREGORIAN", f"X-WR-CALNAME:{_ics_text(case.title)}"]
    for n in nodes:
        d = date.fromisoformat(n["date"]).strftime("%Y%m%d")
        doc = b["docs"].get(n["doc"], {}).get("name", n["doc"])
        lines += ["BEGIN:VEVENT", f"UID:{case.id}-{n['nodeId']}@casecompass", f"DTSTAMP:{stamp}", f"DTSTART;VALUE=DATE:{d}",
                  f"SUMMARY:{_ics_text(('Deadline: ' if n['kind'] == 'deadline' else 'Hearing: ') + n['title'])}",
                  f"DESCRIPTION:{_ics_text(f'Source: {doc}, p. {n.get('page')}. Stated in the record; not legal advice.')}"]
        rem = b["reminders"].get(n["nodeId"])
        if rem and rem.get("on"):
            for days in rem.get("days", []):
                lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{_ics_text(n['title'])}", f"TRIGGER:-P{int(days)}D", "END:VALARM"]
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return Response("\r\n".join(lines) + "\r\n", media_type="text/calendar",
                    headers={"Content-Disposition": f'attachment; filename="{_fname(case, "ics").replace("Chronology", "Deadlines")}"'})


@router.get("/notifications")
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Reminders that are due now, across all of the user's active cases."""
    out = []
    today = date.today()
    for case in db.query(Case).filter(Case.owner_id == user.id, Case.status == "active").all():
        rems = {r.event_code: r for r in db.query(Reminder).filter(Reminder.case_id == case.id, Reminder.user_id == user.id, Reminder.on.is_(True)).all()}
        if not rems:
            continue
        for n in verified_deadlines(build_bundle(db, case, user)):
            r = rems.get(n["nodeId"])
            if not r:
                continue
            left = (date.fromisoformat(n["date"]) - today).days
            if left == 0 or any(left <= d for d in r.days):
                out.append({"caseId": case.id, "case": case.short_title or case.title, "code": n["nodeId"], "title": n["title"], "date": n["date"], "daysLeft": left})
    return sorted(out, key=lambda x: x["daysLeft"])
