"""Detect references to other documents, and match them to documents in the bundle.

Only specific, identifiable references are extracted (an order of a given date, a
numbered application, an exhibit mark, a named report). Generic words such as
"the written statement" are not, because they usually describe documents that
are already in the bundle or are yet to be filed, and would flood the review
queue with false "missing document" flags.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from .classify import EXHIBIT_RE, IA_RE, norm_exhibit
from .dates import _DMY, _NUM, MONTHS, _valid, _year, fmt_num

DATED_DOC_RE = re.compile(
    r"\b(order sheet|order|judg(?:e)?ment|legal notice|notice|letter|decree|award|seizure memo|arrest memo|memo)\s+(?:dated|dt\.?|of)\s+"
    r"(\d{1,2}\s?[./\-]\s?\d{1,2}\s?[./\-]\s?\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9},?\s+\d{4})",
    re.I,
)
REPORT_RE = re.compile(
    r"\b(mediation|local commissioner'?s?|commissioner'?s?|forensic|F\.?S\.?L\.?|medical|post[- ]mortem|inquiry|enquiry|valuation|audit|process server'?s?)\s+report\b",
    re.I,
)
NUMBERED_RE = re.compile(
    r"\b(Crl\.?\s?M\.?A\.?|Bail Application|W\.?P\.?(?:\s?\(C\))?|Execution Petition|Review Petition)\s*No\.?\s*(\d+)\s*(?:/|of)\s*(\d{4})",
    re.I,
)
FIR_REF_RE = re.compile(r"\bF\.?\s?I\.?\s?R\.?\s*No\.?\s*(\d+)\s*(?:/|of)\s*(\d{4})", re.I)


@dataclass
class Ref:
    start: int
    end: int
    label: str
    norm: str
    kind: str
    ref_date: date | None = None
    number: str | None = None


def _parse_date(s: str) -> date | None:
    m = _NUM.search(s)
    if m:
        d, _, mo, y = m.groups()
        return _valid(_year(y), int(mo), int(d))
    m = _DMY.search(s)
    if m:
        d, mon, y = m.groups()
        return _valid(int(y), MONTHS[mon.lower()], int(d))
    return None


def find_references(sentence: str) -> list[Ref]:
    out: list[Ref] = []
    for m in DATED_DOC_RE.finditer(sentence):
        word = m.group(1).lower()
        dt = _parse_date(m.group(2))
        if not dt:
            continue
        kind = "order" if word.startswith(("order", "judg", "decree", "award")) else "notice" if "notice" in word else "memo" if "memo" in word else "letter"
        nice = {"order sheet": "Order sheet", "legal notice": "Legal notice"}.get(word, word.capitalize())
        label = f"{nice} dated {fmt_num(dt)}"
        norm_word = "order" if kind == "order" else kind
        out.append(Ref(m.start(), m.end(), label, f"{norm_word}:{dt.isoformat()}", kind, ref_date=dt))
    for m in IA_RE.finditer(sentence):
        n = f"{m.group(1)}/{m.group(2)}"
        out.append(Ref(m.start(), m.end(), f"IA No. {n}", f"ia:{n}", "application", number=f"IA {n}"))
    for m in NUMBERED_RE.finditer(sentence):
        n = f"{m.group(2)}/{m.group(3)}"
        kind_word = re.sub(r"\s+", " ", m.group(1)).strip()
        out.append(Ref(m.start(), m.end(), f"{kind_word} No. {n}", f"num:{kind_word.lower()}:{n}", "application", number=f"{kind_word} {n}"))
    for m in FIR_REF_RE.finditer(sentence):
        n = f"{m.group(1)}/{m.group(2)}"
        out.append(Ref(m.start(), m.end(), f"FIR No. {n}", f"fir:{n}", "police", number=n))
    for m in EXHIBIT_RE.finditer(sentence):
        label = norm_exhibit(m.group(1), m.group(2))
        out.append(Ref(m.start(), m.end(), label, f"exhibit:{label.lower()}", "exhibit"))
    for m in REPORT_RE.finditer(sentence):
        w = m.group(1).lower().replace("'s", "").replace("’s", "").strip("'")
        w = {"local commissioner": "commissioner", "f.s.l.": "forensic", "fsl": "forensic", "enquiry": "inquiry", "process server": "process server"}.get(w, w)
        label = f"{w.capitalize()} report"
        out.append(Ref(m.start(), m.end(), label, f"report:{w}", "report"))
    # drop overlaps (keep the first / longest)
    out.sort(key=lambda r: (r.start, -(r.end - r.start)))
    kept: list[Ref] = []
    for r in out:
        if not any(r.start < k.end and r.end > k.start for k in kept):
            kept.append(r)
    return kept


REPORT_TEMPLATES = {
    "report:commissioner": {"Commissioner Reports"},
    "report:forensic": {"Forensic/Cyber Expert Reports"},
    "report:audit": {"Audit / Valuation Reports"},
    "report:valuation": {"Audit / Valuation Reports"},
}


def matches_document(ref_norm: str, ref_date: date | None, doc) -> bool:
    """Does a bundle document satisfy this reference? `doc` is a models.Document."""
    ids = doc.identifiers or {}
    kind, _, rest = ref_norm.partition(":")
    if kind == "order":
        return doc.doc_type in ("Court order", "Judgment") and doc.doc_date == ref_date
    if kind == "notice":
        return doc.doc_type == "Notice" and doc.doc_date == ref_date
    if kind == "memo":
        return doc.template_name == "Seizure Memos" and (doc.doc_date == ref_date or ref_date is None)
    if kind == "letter":
        return doc.doc_date == ref_date and doc.doc_type in ("Notice", "Exhibit")
    if kind == "ia":
        return f"IA {rest}" in ids.get("ia", []) and doc.doc_type == "Application"
    if kind == "exhibit":
        return any(e.lower() == rest for e in ids.get("exhibits", []))
    if kind == "fir":
        return rest.replace(" ", "") in [f.replace(" ", "") for f in ids.get("fir", [])]
    if kind == "num":
        return any(rest.split(":")[-1] in n for n in ids.get("case_numbers", []))
    if kind == "report":
        if ref_norm in REPORT_TEMPLATES:
            return doc.template_name in REPORT_TEMPLATES[ref_norm]
        word = rest.split()[0]
        return doc.doc_type == "Report" and word in (doc.title or "").lower()
    return False
