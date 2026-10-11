"""The flagging engine: recompute every issue for a case from the extracted record.

Runs after each document is processed (and when a document is removed). Issues are
matched to existing ones by a stable fingerprint, so a reviewer's status, notes and
decisions survive re-computation. When a condition disappears from the record (the
missing order is uploaded, a quarantined snippet's document is removed), the issue is
closed automatically with a logged system resolution; if it reappears, it reopens.

Flags produced:
  conflict    the same real-world event is dated differently in different records
  missing     a specific document is referred to but is not in the bundle
  quarantine  a date the parser refused to trust (low OCR confidence, vague, relative, illegible ...)
  undated     a procedural step is mentioned but never dated anywhere in the record
  sequence    a step whose usual follow-up is not on record (per case-type rules)
It also marks stated deadlines as completed when the completing step is on record.
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..ai.tasks import same_event
from ..config import settings
from ..models import Case, DocReference, Document, Event, Issue, Resolution
from ..parsing import lexicon as lx
from ..parsing.dates import fmt_num
from ..parsing.references import matches_document
from ..services.audit import log, next_code
from .sequence import RULES, SeqContext

logger = logging.getLogger(__name__)

#: steps that happen once per case (per party): two different dates for one of these is a conflict
CONFLICT_KEYS = {
    "notice_received", "notice_issued", "suit_filed", "summons_served", "ws_filed", "counterclaim_filed",
    "replication_filed", "fir_registered", "arrest", "chargesheet_filed", "cognizance_taken", "charges_framed",
    "judgment_pronounced", "agreement_executed", "issues_framed", "commissioner_appointed", "complaint_filed",
    "bail_applied",
}
PARTY_SENSITIVE = {"summons_served", "ws_filed", "replication_filed", "arrest", "affidavit_filed", "notice_received", "bail_applied"}
NUM_RE = re.compile(r"\b(?:I\.?\s?A\.?|FIR|Application)\s*No\.?\s*(\d+\s*/\s*\d{4})", re.I)

PREFIX = {"conflict": "C", "missing": "G", "undated": "G", "sequence": "G", "quarantine": "Q"}

_ai_cache: dict[tuple[str, str], bool | None] = {}


@dataclass
class Desired:
    type: str
    fingerprint: str
    title: str
    why: str
    payload: dict = field(default_factory=dict)


def _disc(ev: Event) -> str:
    nums = ",".join(sorted({re.sub(r"\s", "", n) for n in NUM_RE.findall(ev.quote)}))
    party = (ev.party or "") if ev.event_key in PARTY_SENSITIVE else ""
    return f"{ev.event_key}|{party.lower()}|{nums}"


def _ai_same(a: Event, b: Event) -> bool | None:
    k = (a.quote, b.quote) if a.quote < b.quote else (b.quote, a.quote)
    if k not in _ai_cache:
        _ai_cache[k] = same_event(a.quote, b.quote) if settings.ai_available else None
    return _ai_cache[k]


def cluster_events(events: list[Event]) -> dict[str, list[Event]]:
    """Assign cluster keys. Same cluster = the same real-world step (dates may differ)."""
    clusters: dict[str, list[Event]] = defaultdict(list)
    unkeyed: list[tuple[str, Event]] = []
    for ev in sorted(events, key=lambda e: (e.date, e.code)):
        if ev.kind == "hearing":
            ck = f"h:{ev.date.isoformat()}"
        elif ev.kind == "deadline":
            topic = (ev.event_key or "due:other")[4:]
            if topic != "other":
                ck = f"d:{topic}|{(ev.party or '').lower()}|{ev.date.isoformat()}"
            else:
                ck = next((k for k, e in unkeyed if k.startswith("d:") and e.date == ev.date and lx.jaccard(e.signature, ev.signature) >= 0.5), None)
                if not ck:
                    ck = f"d:sig:{ev.code}"
                    unkeyed.append((ck, ev))
        elif ev.event_key:
            ck = f"k:{_disc(ev)}"
            if ev.event_key not in CONFLICT_KEYS:
                ck += f"|{ev.date.isoformat()}"
        else:
            ck = None
            for k, other in unkeyed:
                if not k.startswith("u:"):
                    continue
                j = lx.jaccard(other.signature, ev.signature)
                if other.date == ev.date and j >= 0.5:
                    ck = k
                    break
                if other.date != ev.date and other.document_id != ev.document_id and (j >= 0.8 or (j >= 0.55 and _ai_same(other, ev))):
                    ck = k
                    break
            if not ck:
                ck = f"u:{ev.code}"
                unkeyed.append((ck, ev))
        ev.cluster_key = ck[:160]
        clusters[ev.cluster_key].append(ev)
    return clusters


def _note_for(q: dict, conflict_keys: dict[str, str], doc: Document) -> str:
    kind, detail, cand = q.get("kind"), (q.get("detail") or "").strip(), q.get("candidate")
    conf = q.get("confidence")
    if kind == "relative":
        base = detail
        note = f"Base date: “{base}”." if base else "No base date is stated: it could run from the order date or from receipt of a copy."
        if re.search(r"receipt of (this|the) (legal )?notice", base, re.I) and "notice_received" in conflict_keys:
            note += f" The receipt date itself is in conflict ({conflict_keys['notice_received']})."
        if re.search(r"service of (the )?summons", base, re.I) and "summons_served" in conflict_keys:
            note += f" The service date itself is in conflict ({conflict_keys['summons_served']})."
        return note + " CaseCompass will not calculate this deadline."
    if kind == "vague":
        return "No calendar date can be read from this wording."
    if kind == "illegible":
        return f"Part of the date could not be read{f' (OCR confidence {conf:.0f}%)' if conf is not None else ''}. Check the original."
    if kind == "approx":
        return f"The record hedges this date. Suggested date {cand} needs confirmation against the original." if cand else "The record hedges this date."
    if kind == "ocr_fixed":
        return f"OCR read look-alike characters; the repaired date {cand} needs confirmation."
    if kind == "month":
        return "Only the month and year are stated; no day can be placed on the timeline."
    if kind == "invalid":
        return f"{detail or 'This is not a valid date'}. Check the original document."
    # low OCR confidence on an otherwise complete date
    return f"Read as {cand} with low OCR confidence ({conf:.0f}%). Confirm it against the original." if cand and conf is not None else "Low OCR confidence."


def recompute(db: Session, case: Case) -> dict:
    docs = [d for d in db.query(Document).filter(Document.case_id == case.id, Document.status == "done").all()]
    by_id = {d.id: d for d in docs}
    events = db.query(Event).filter(Event.case_id == case.id).all()
    events = [e for e in events if e.document_id in by_id]
    refs = db.query(DocReference).filter(DocReference.case_id == case.id).all()
    refs = [r for r in refs if r.document_id in by_id]
    desired: list[Desired] = []

    # ---------------------------------------------------------------- conflicts and corroboration
    clusters = cluster_events(events)
    conflict_summary: dict[str, str] = {}
    for ck, evs in clusters.items():
        dates = sorted({e.date for e in evs})
        if len(dates) < 2 or not ck.startswith(("k:", "u:")):
            continue
        records = []
        for d in dates:
            same = sorted([e for e in evs if e.date == d], key=lambda e: e.code)
            first = same[0]
            records.append({"date": d.isoformat(), "doc": by_id[first.document_id].code, "page": first.page, "quote": first.quote,
                            "event": first.code, "also": [{"doc": by_id[e.document_id].code, "page": e.page, "quote": e.quote, "event": e.code} for e in same[1:]]})
        title = evs[0].title
        key = evs[0].event_key
        if key:
            conflict_summary[key] = " vs ".join(f"{fmt_num(d)[:5]}" for d in dates)
        why = "Records give different dates for the same event: " + "; ".join(
            f"{fmt_num(d)} ({r['doc']})" for d, r in zip(dates, records)) + ". Both are kept; CaseCompass does not choose."
        desired.append(Desired("conflict", f"conflict:{ck}", title, why, {"records": records, "cluster": ck}))

    # ---------------------------------------------------------------- deadline completion
    by_key: dict[str, list[Event]] = defaultdict(list)
    for e in events:
        if e.event_key and e.kind == "event":
            by_key[e.event_key].append(e)
    for e in events:
        e.fulfilled_by = None
        if e.kind != "deadline":
            continue
        _, completes = lx.deadline_topic(e.quote)
        if not completes:
            continue
        done = [x for x in by_key.get(completes, []) if not (x.party and e.party) or x.party == e.party]
        if done:
            e.fulfilled_by = sorted(done, key=lambda x: x.date)[0].code

    # ---------------------------------------------------------------- missing referenced documents
    missing: dict[str, list[DocReference]] = defaultdict(list)
    for r in refs:
        own = by_id[r.document_id]
        if matches_document(r.norm, r.ref_date, own):
            r.matched_document_id = own.id  # the document names itself
            continue
        match = next((d for d in docs if d.id != own.id and matches_document(r.norm, r.ref_date, d)), None)
        r.matched_document_id = match.id if match else None
        if not match:
            missing[r.norm].append(r)
    for norm, rs in missing.items():
        rs = sorted(rs, key=lambda r: (by_id[r.document_id].code, r.page))
        a = rs[0]
        where = sorted({by_id[r.document_id].code for r in rs})
        why = (f"Referred to in {by_id[a.document_id].title}, page {a.page}, but not in the uploaded bundle." if len(where) == 1
               else f"Referred to in {len(where)} documents ({', '.join(where)}), but not in the uploaded bundle.")
        desired.append(Desired("missing", f"missing:{norm}", a.label, why, {
            "label": a.label, "ref_date": a.ref_date.isoformat() if a.ref_date else None, "doc": by_id[a.document_id].code, "page": a.page,
            "quote": a.quote, "refs": [{"doc": by_id[r.document_id].code, "page": r.page, "quote": r.quote} for r in rs]}))

    # ---------------------------------------------------------------- quarantined dates
    for d in docs:
        for q in (d.extraction or {}).get("quarantine", []):
            note = _note_for(q, conflict_summary, d)
            desired.append(Desired("quarantine", f"quarantine:{d.code}:{q['qid']}", q.get("title") or "Unclear date", q["reason"], {
                "doc": d.code, "page": q["page"], "quote": q["quote"], "reason": q["reason"], "kind": q.get("kind"),
                "confidence": q.get("confidence"), "method": q.get("method"), "candidate": q.get("candidate"),
                "date_text": q.get("date_text"), "detail": q.get("detail"), "note": note, "event_key": q.get("event_key")}))

    # ---------------------------------------------------------------- undated events
    dated_keys = {e.event_key for e in events if e.event_key}
    seen_undated: set[str] = set()
    for d in sorted(docs, key=lambda x: x.code):
        for u in (d.extraction or {}).get("undated", []):
            if u["key"] in dated_keys or u["key"] in seen_undated:
                continue
            seen_undated.add(u["key"])
            desired.append(Desired("undated", f"undated:{u['key']}", u["title"],
                                   "The record mentions this step but gives no date for it anywhere in the bundle.",
                                   {"doc": d.code, "page": u["page"], "quote": u["quote"], "key": u["key"]}))

    # ---------------------------------------------------------------- sequence gaps
    texts = {d.code: "\n".join(p.text for p in d.pages) for d in docs}
    docs_by_template: dict[str, list] = defaultdict(list)
    for d in sorted(docs, key=lambda x: x.code):
        if d.template_name:
            docs_by_template[d.template_name].append(d)
    ctx = SeqContext(case.case_type, set(docs_by_template), dated_keys, texts, docs_by_template, by_key)
    for rule in RULES:
        if case.case_type not in rule.case_types or not rule.applies(ctx):
            continue
        doc_id, page, quote = rule.anchor(ctx)
        if doc_id is None:
            continue
        desired.append(Desired("sequence", f"sequence:{rule.id}", rule.title, rule.why(ctx),
                               {"doc": by_id[doc_id].code, "page": page, "quote": quote, "rule": rule.id}))

    return _sync(db, case, desired, docs)


def _sync(db: Session, case: Case, desired: list[Desired], docs: list[Document]) -> dict:
    existing = {i.fingerprint: i for i in db.query(Issue).filter(Issue.case_id == case.id).all()}
    want = {d.fingerprint: d for d in desired}
    created, closed, reopened = [], [], []
    now = datetime.now(timezone.utc)

    for fp, d in want.items():
        issue = existing.get(fp)
        if issue is None:
            issue = Issue(case_id=case.id, code=next_code(db, case, PREFIX[d.type]), type=d.type, fingerprint=fp, title=d.title[:300],
                          why=d.why, payload=d.payload, status="open", active=True)
            db.add(issue)
            db.flush()
            created.append(issue)
            log(db, case.id, "Quarantined" if d.type == "quarantine" else "Flagged", f"{d.title}: {d.why}"[:500], kind="flag", issue_code=issue.code,
                doc_code=d.payload.get("doc"))
            continue
        issue.title, issue.why, issue.payload = d.title[:300], d.why, d.payload
        if not issue.active:
            issue.active = True
            auto = db.query(Resolution).filter(Resolution.issue_id == issue.id, Resolution.active.is_(True), Resolution.type == "auto").all()
            for r in auto:
                r.active, r.withdrawn_at = False, now
            if auto:
                issue.status = "open"
            reopened.append(issue)
            log(db, case.id, "Reopened", f"{issue.title}: the condition is back in the record", kind="flag", issue_code=issue.code)

    for fp, issue in existing.items():
        if fp in want or not issue.active:
            continue
        issue.active = False
        if issue.status != "resolved":
            reason = "The condition is no longer in the record."
            if issue.type == "missing":
                p = issue.payload or {}
                match = next((dd for dd in docs if matches_document(fp.split(":", 1)[1], _iso(p.get("ref_date")), dd)), None)
                reason = f"The document is now in the bundle as {match.code} ({match.title})." if match else "The referring document was removed."
            elif issue.type == "quarantine":
                reason = "The source document was removed or re-processed."
            db.add(Resolution(issue_id=issue.id, type="auto", data={}, reason=reason, actor_name="CaseCompass", active=True))
            issue.status = "resolved"
            closed.append(issue)
            log(db, case.id, "Auto-resolved", f"{issue.title}: {reason}", kind="correction", issue_code=issue.code)
    db.flush()
    return {"created": [i.code for i in created], "closed": [i.code for i in closed], "reopened": [i.code for i in reopened]}


def _iso(s):
    from datetime import date

    return date.fromisoformat(s) if s else None
