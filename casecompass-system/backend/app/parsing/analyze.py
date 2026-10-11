"""Turn the pages of one document into candidate records.

Output (all tied to a page and an exact sentence):
  events      dated statements that may go on the timeline
  references  mentions of other documents (checked against the bundle later)
  quarantine  dates the parser refused to trust
  undated     procedural steps mentioned with no date at all
  dates       every date-like expression found, with what happened to it (for the extraction view)
  rejected    candidates dropped, with the reason (nothing appears without a source sentence)
"""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import date

from ..ai import tasks as ai_tasks
from ..ai.groq import AIUnavailable, client as ai_client
from ..config import settings
from . import lexicon as lx
from .dates import DATE_CUE, DateMention, find_dates, fmt_num, quarantine_reason
from .references import find_references
from .sentences import Sentence, normalize_ws, split_sentences
from .text_extract import PageText, span_confidence

log = logging.getLogger(__name__)


@dataclass
class EventCand:
    page: int
    quote: str
    date: date
    date_text: str
    kind: str
    title: str
    party: str | None
    event_key: str | None
    signature: str
    confidence: float
    method: str = "rule"
    date_source: str = "sentence"
    sid: int = -1


@dataclass
class Analysis:
    events: list[EventCand] = field(default_factory=list)
    references: list[dict] = field(default_factory=list)
    quarantine: list[dict] = field(default_factory=list)
    undated: list[dict] = field(default_factory=list)
    dates: list[dict] = field(default_factory=list)
    rejected: list[dict] = field(default_factory=list)
    ai_used: bool = False
    ai_error: str | None = None


# --------------------------------------------------------------------------- titles

_LEADING = re.compile(r"^(?:(?:the\s+)?(?:complainant|plaintiff|defendant|petitioner|respondent|accused|applicant|deponent|informant)\s+(?:states|submits|avers|alleges|contends|says)\s+that\s+|that\s+|it is (?:further )?(?:submitted|stated|averred|prayed) that\s+|however,?\s+|further,?\s+|thereafter,?\s+|accordingly,?\s+)", re.I)
_PARTY_WORD = r"(?:the\s+)?(plaintiffs?|defendants?|petitioners?|respondents?|applicants?|accused|complainant|prosecution|local commissioner|commissioner|investigating officer)"
_ACTIVE = re.compile(_PARTY_WORD + r"\s+(?:shall|is directed to|are directed to|is required to|must|to)\s+(.+?)\s+(?:on or before|by|before|not later than|latest by|till|until|within|on)\s+(?=\S*\d)", re.I)
_PASSIVE = re.compile(r"^(?:the\s+)?([^,]+?)\s+(?:shall\s+)?be\s+(filed|deposited|submitted|paid|produced|concluded|completed|served|issued|\w+ed)(?:\s+by\s+" + _PARTY_WORD + r")?\b", re.I)
_LABEL = re.compile(r"^[A-Za-z][A-Za-z ./&()-]{1,40}:\s*")
_PURPOSE = re.compile(r"\b(?:seeking|for)\s+(?:an?\s+|the\s+)?([a-z][a-z\s\-]{2,40}?)(?=\s+(?:restraining|under|against|of|from|on|is|was)\b|,|\s+filed)", re.I)
_LISTED = re.compile(r"\b(?:list(?:ed)?|posted|put up|adjourned)\s+(?:for|before|to)\s+(.+?)\s+(?:on|to)\s+\S*\d", re.I)

PARTY_TITLE = {"notice_received": "by", "summons_served": "on", "ws_filed": "by", "counterclaim_filed": "by", "replication_filed": "by", "affidavit_filed": "by", "arrest": None}


def _cap(s: str) -> str:
    s = s.strip(" ,;:-")
    return s[:1].upper() + s[1:] if s else s


def _trim(s: str, n: int = 80) -> str:
    s = normalize_ws(s)
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return cut.rstrip(",;:") + "…"


def _strip_dates(s: str, mentions: list[DateMention]) -> str:
    for m in sorted(mentions, key=lambda x: -x.start):
        s = s[: m.start] + s[m.end:]
    s = re.sub(r"\b(on|dated|by|on or before|before|till|until)\s*([,.]|$)", r"\2", s)
    return normalize_ws(s)


def rule_title(sent: str, kind: str, step: lx.Step | None, party: str | None, mentions: list[DateMention]) -> str:
    if kind == "deadline":
        m = _ACTIVE.search(sent)
        if m:
            who = m.group(1).rstrip("s") if m.group(1).lower().endswith("s") and not m.group(1).lower().endswith("ss") else m.group(1)
            return _trim(f"{_cap(who)} to {m.group(2)}")
        m = _PASSIVE.search(sent)
        if m:
            t = f"{_cap(m.group(1))} to be {m.group(2)}"
            if m.group(3):
                t += f" by {m.group(3).capitalize()}"
            return _trim(t)
    if kind == "deadline":
        body = _LEADING.sub("", _strip_dates(sent, mentions))
        return _trim(_cap(body.rstrip(".")))
    if kind == "hearing":
        if re.search(r"next date", sent, re.I):
            return "Next date of hearing"
        m = _LISTED.search(sent)
        if m:
            return _trim(f"Listed for {m.group(1)}" if not m.group(1).lower().startswith("the court") else f"Listed before {m.group(1)}")
        return "Hearing"
    if step and step.key == "ia_filed":
        m = _PURPOSE.search(sent)
        if m:
            return _trim(f"Application for {m.group(1).strip()} filed")
    if step:
        prep = PARTY_TITLE.get(step.key, "")
        if party and prep:
            return f"{step.title} {prep} {party}"
        return step.title
    body = _LEADING.sub("", _strip_dates(sent, mentions))
    return _trim(_cap(body.rstrip(".")))


def detect_kind(sent: str, m: DateMention) -> str:
    before = sent[: m.start]
    if lx.DEADLINE_LEAD_RE.search(before) and lx.OBLIGATION_RE.search(sent):
        return "deadline"
    if lx.HEARING_RE.search(sent) and lx.HEARING_LEAD_RE.search(before):
        return "hearing"
    if lx.OBLIGATION_RE.search(sent) and re.search(r"\b(appear|be present|remain present|produce|report)\b", sent, re.I) and re.search(r"\bon\s*$", before, re.I):
        return "deadline"
    return "event"


def is_label(sent: str, mentions: list[DateMention]) -> bool:
    """'Dated: 03.06.2026', 'Date and time of FIR: 02.03.2026, 18:40' - headers, not events."""
    rest = _strip_dates(sent, mentions)
    rest = re.sub(r"\b\d{1,2}[:.]\d{2}\b", "", rest)
    words = re.findall(r"[A-Za-z]{2,}", rest)
    return bool(_LABEL.match(sent)) and len(words) <= 6 or len(words) <= 1


def unreadable_date_slots(s: Sentence, pg: PageText, mentions: list[DateMention], min_conf: float) -> list[DateMention]:
    """On scanned pages, a date cue ('Received on', 'Dated:') followed by words OCR could not read
    (low confidence, or ink OCR marked [illegible]) is an illegible date, not an absent one.
    Without this, a smudged stamp would silently vanish."""
    out = []
    for m in DATE_CUE.finditer(s.text):
        cue_end = s.start + m.end()
        nxt = [w for w in pg.words if w[0] >= cue_end and w[0] < s.end][:3]
        low = []
        for w in nxt:
            if w[2] < min_conf:
                low.append(w)
            else:
                break
        if not low and nxt:
            # read confidently, but not a date: digits broken by stray separators ("3.62036", "18.022026")
            tok = pg.text[int(nxt[0][0]):int(nxt[0][1])]
            digits = sum(c.isdigit() for c in tok)
            last = nxt[0][1] >= s.end - 1 or (len(nxt) > 1 and pg.text[int(nxt[1][0]):int(nxt[1][1])] == "[illegible]")
            if digits >= 3 and (re.search(r"\d[./-]|[./-]\d", tok) or digits >= 5):
                low = [nxt[0]]
            elif tok.rstrip(".").isdigit() and len(tok.rstrip(".")) <= 2 and last:
                low = [nxt[0]]  # 'issued on 2' and nothing more: the rest of the date is gone
        if not low:
            continue
        a, b = int(low[0][0]) - s.start, int(low[-1][1]) - s.start
        if any(x.start < b and x.end > a for x in mentions + out):
            continue
        out.append(DateMention(a, b, s.text[a:b], "illegible", detail="A date was expected here but OCR could not read it",
                               ocr_confidence=min(w[2] for w in low)))
    return out


def qid(doc_code: str, page: int, text: str) -> str:
    return hashlib.sha1(f"{doc_code}:{page}:{normalize_ws(text)}".encode()).hexdigest()[:12]


# --------------------------------------------------------------------------- main

def analyze(pages: list[PageText], *, doc_code: str, doc_type: str, doc_date: date | None, doc_title: str, use_ai: bool = True) -> Analysis:
    out = Analysis()
    min_conf = settings.ocr_min_confidence
    ai_inputs: list[dict] = []
    sid = 0
    sentence_index: dict[int, tuple[int, Sentence, list[DateMention]]] = {}

    for pg in pages:
        for s in split_sentences(pg.text):
            sid += 1
            mentions = find_dates(s.text)
            for m in mentions:
                m.ocr_confidence = span_confidence(pg.words, s.start + m.start, s.start + m.end) if pg.words else None
            if pg.words:  # OCR'd text (whole page, or the image regions of a mixed page)
                mentions.extend(unreadable_date_slots(s, pg, mentions, min_conf))
                mentions.sort(key=lambda x: x.start)
            sentence_index[sid] = (pg.page_no, s, mentions)

            # references to other documents (never from this document's own heading)
            refs = [] if s.heading else find_references(s.text)
            for r in refs:
                out.references.append({"page": pg.page_no, "quote": s.text, "label": r.label, "norm": r.norm, "kind": r.kind,
                                       "ref_date": r.ref_date.isoformat() if r.ref_date else None, "number": r.number})

            if s.heading or (mentions and is_label(s.text, mentions)):
                # header lines ('Dated: 03.06.2026') are not events, but on a scan a doubtful date in
                # one (a smudged 'Received on' stamp) is still quarantined rather than dropped
                doubtful = [m for m in mentions if pg.words and quarantine_reason(m, min_conf) and m.kind not in ("relative", "vague", "month")]
                for m in mentions:
                    if m not in doubtful:
                        out.dates.append({"text": m.text, "sentence": s.text, "page": pg.page_no, "confidence": m.ocr_confidence, "status": "heading"})
                if not doubtful:
                    continue
                mentions = doubtful

            event_dates: list[DateMention] = []
            for m in mentions:
                in_ref = any(r.start <= m.start and m.end <= r.end for r in refs)
                lead_ref = bool(lx.REFERENCE_LEAD_RE.search(s.text[max(0, m.start - 40): m.start]))
                if (in_ref or lead_ref) and m.kind in ("exact", "approx", "ocr_fixed"):
                    out.dates.append({"text": m.text, "sentence": s.text, "page": pg.page_no, "confidence": m.ocr_confidence, "status": "reference"})
                    continue
                reason = quarantine_reason(m, min_conf)
                if reason:
                    step = next((st for st in lx.match_steps(s.text) if not st.undated_check or st.key == "payment_demanded"), None) or lx.match_step(s.text)
                    out.quarantine.append({
                        "qid": qid(doc_code, pg.page_no, s.text + m.text), "page": pg.page_no, "quote": s.text, "date_text": m.text,
                        "reason": reason, "kind": m.kind, "detail": m.detail,
                        "confidence": m.ocr_confidence if m.ocr_confidence is not None else (pg.confidence if pg.method == "ocr" else None),
                        "method": pg.method,
                        "candidate": (m.candidate or m.date).isoformat() if (m.candidate or m.date) else None,
                        "title": ("Date on the court stamp" if m.kind == "illegible" and "stamp" in s.text.lower() else
                                  step.title if step and (m.kind != "relative" or step.key == "payment_demanded")
                                  else rule_title(s.text, "deadline" if m.kind == "relative" else "event", None, lx.find_party(s.text), mentions)),
                        "event_key": step.key if step else None,
                    })
                    out.dates.append({"text": m.text, "sentence": s.text, "page": pg.page_no, "confidence": m.ocr_confidence, "status": "quarantined", "reason": reason})
                    continue
                if m.trusted:
                    event_dates.append(m)

            steps = lx.match_steps(s.text)
            step = steps[0] if steps else None
            party = lx.find_party(s.text)
            for m in event_dates:
                kind = detect_kind(s.text, m)
                key = None
                if kind == "deadline":
                    topic, _ = lx.deadline_topic(s.text)
                    key = f"due:{topic}"
                elif step and kind == "event":
                    key = step.key
                out.events.append(EventCand(
                    page=pg.page_no, quote=s.text, date=m.date, date_text=m.text, kind=kind,
                    title=rule_title(s.text, kind, step, party, mentions), party=party, event_key=key,
                    signature=lx.signature(_strip_dates(s.text, mentions)),
                    confidence=m.ocr_confidence if m.ocr_confidence is not None else 100.0, sid=sid,
                ))
                out.dates.append({"text": m.text, "sentence": s.text, "page": pg.page_no, "confidence": m.ocr_confidence, "status": "timeline"})
            if event_dates:
                ai_inputs.append({"id": sid, "page": pg.page_no, "text": s.text, "dates": [m.iso() for m in event_dates]})

            # steps recorded without a date of their own
            has_trusted = bool(event_dates)
            has_unclear = any(not m.trusted for m in mentions)
            if steps and not has_trusted:
                operative = next((st for st in steps if st.operative), None)
                used = None
                if operative and doc_type in ("Court order", "Judgment") and doc_date and not has_unclear:
                    used = operative
                    out.events.append(EventCand(
                        page=pg.page_no, quote=s.text, date=doc_date, date_text=fmt_num(doc_date), kind="event",
                        title=rule_title(s.text, "event", operative, party, mentions), party=party, event_key=operative.key,
                        signature=lx.signature(s.text), confidence=100.0, date_source="order_date", sid=sid,
                    ))
                if not mentions:
                    for st in steps:
                        if st.undated_check and st is not used:
                            out.undated.append({"page": pg.page_no, "quote": s.text, "key": st.key, "title": st.title})

    # ------------------------------------------------------------------ AI refinement (grounded)
    if use_ai and ai_inputs and ai_client.enabled:
        try:
            res = ai_tasks.refine_events(doc_title, doc_type, ai_inputs)
            _apply_ai(out, res, ai_inputs, sentence_index)
            out.ai_used = True
        except AIUnavailable as e:
            out.ai_error = str(e)
            log.info("AI refinement skipped for %s: %s", doc_code, e)

    # final guarantee: every event quote must be verbatim in its page text
    page_text = {p.page_no: normalize_ws(p.text) for p in pages}
    kept = []
    for ev in out.events:
        if normalize_ws(ev.quote) in page_text.get(ev.page, ""):
            kept.append(ev)
        else:
            out.rejected.append({"text": ev.title, "reason": "Source sentence could not be matched to the page text, so it was not added."})
    out.events = kept
    return out


def _apply_ai(out: Analysis, res: dict, ai_inputs: list[dict], index: dict) -> None:
    allowed = {i["id"]: set(i["dates"]) for i in ai_inputs}
    by_sid: dict[int, list[dict]] = {}
    for item in res.get("events", []) if isinstance(res, dict) else []:
        try:
            sid = int(item.get("sentence_id"))
        except (TypeError, ValueError):
            out.rejected.append({"text": str(item)[:80], "reason": "AI output without a valid sentence reference was ignored."})
            continue
        d = str(item.get("date", ""))
        if sid not in allowed:
            out.rejected.append({"text": str(item.get("title", ""))[:80], "reason": "AI referred to a sentence that does not exist; ignored."})
            continue
        if d not in allowed[sid]:
            out.rejected.append({"text": f"{item.get('title', '')} ({d})", "reason": "AI suggested a date that is not in the source sentence; dropped."})
            continue
        by_sid.setdefault(sid, []).append(item)

    new_events: list[EventCand] = []
    for ev in out.events:
        items = by_sid.get(ev.sid)
        if not items:
            new_events.append(ev)
            continue
        match = next((i for i in items if i["date"] == ev.date.isoformat()), None)
        if match is None:
            new_events.append(ev)
            continue
        if match.get("is_reference"):
            out.dates.append({"text": ev.date_text, "sentence": ev.quote, "page": ev.page, "confidence": None, "status": "reference"})
            out.rejected.append({"text": f"{fmt_num(ev.date)} in “{_trim(ev.quote, 60)}”", "reason": "The date only identifies another document; nothing happened on it in this sentence."})
            continue
        kind = match.get("kind") if match.get("kind") in ("event", "hearing", "deadline") else ev.kind
        title = _trim(str(match.get("title") or ev.title), 90)
        party = match.get("party") if isinstance(match.get("party"), str) and match.get("party") else ev.party
        key = ev.event_key
        if kind == "deadline" and not (key or "").startswith("due:"):
            key = f"due:{lx.deadline_topic(ev.quote)[0]}"
        elif kind != "deadline" and (key or "").startswith("due:"):
            step = lx.match_step(ev.quote)
            key = step.key if step else None
        new_events.append(EventCand(**{**asdict(ev), "kind": kind, "title": title, "party": party, "event_key": key, "method": "ai"}))
    out.events = new_events
