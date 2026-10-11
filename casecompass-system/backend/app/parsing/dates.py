"""Deterministic date detection. The AI never reads or invents dates; this module does.

Every date-like expression in a sentence becomes a DateMention with a `kind`:

  exact      a full, valid calendar date                       -> may go on the timeline
  approx     an exact date hedged ("on or about 12.03.2026")   -> quarantined, date offered as a suggestion
  ocr_fixed  digits repaired from OCR look-alikes (O->0, l->1) -> quarantined, repaired date offered
  month      month and year only ("March 2026")                -> quarantined
  relative   a period, not a date ("within two weeks")         -> quarantined; never calculated
  vague      seasons, "early March", "the preceding year"      -> quarantined
  illegible  unreadable digits ("1?/0?/2026")                  -> quarantined
  invalid    impossible dates (31.02.2026) or implausible years -> quarantined

Dates are day-first, as in Indian practice.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3, "april": 4, "apr": 4, "may": 5,
    "june": 6, "jun": 6, "july": 7, "jul": 7, "august": 8, "aug": 8, "september": 9, "sept": 9, "sep": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
}
MONTH_RE = r"(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)"
WORDNUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20, "thirty": 30, "forty-five": 45, "sixty": 60, "ninety": 90,
    "a": 1, "an": 1,
}
WORDNUM_RE = r"(\d{1,3}|" + "|".join(sorted((k for k in WORDNUM if k not in ("a", "an")), key=len, reverse=True)) + r"|a|an)"

MIN_YEAR, MAX_YEAR = 1950, date.today().year + 15


@dataclass
class DateMention:
    start: int
    end: int
    text: str
    kind: str
    date: date | None = None
    candidate: date | None = None  # suggested date for one-click confirmation
    detail: str = ""  # e.g. the base phrase of a relative deadline
    ocr_confidence: float | None = None

    @property
    def trusted(self) -> bool:
        return self.kind == "exact" and self.date is not None

    def iso(self) -> str | None:
        return self.date.isoformat() if self.date else None


# --------------------------------------------------------------------------- patterns

#: words that announce a date is about to follow ("Received on", "Dated:"). On scanned pages, an
#: unreadable stretch right after one of these is an illegible date, not a missing one.
DATE_CUE = re.compile(
    r"\b(?:(?:received|served|filed|signed|issued|delivered|presented|passed|executed|listed)\s*on\b|dated|date\s*:|dt\.)\s*:?\s*",
    re.I,
)

_NUM = re.compile(r"(?<![\w/.\-])(\d{1,2})\s?([./\-])\s?(\d{1,2})\s?\2\s?(\d{4}|\d{2})(?![\w/])")
_ISO = re.compile(r"(?<![\w])(\d{4})-(\d{2})-(\d{2})(?![\w])")
_DMY = re.compile(r"(?<![\w])(\d{1,2})(?:st|nd|rd|th)?(?:\s+day)?(?:\s+of)?\s+" + MONTH_RE + r"\.?,?\s+(\d{4})(?!\d)", re.I)
_MDY = re.compile(r"(?<![\w])" + MONTH_RE + r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)", re.I)
_MY = re.compile(r"(?<![\w])(?:(?:early|mid|late|end\s+of|beginning\s+of|middle\s+of)[\s-]+)?" + MONTH_RE + r"\.?,?\s+(\d{4})(?!\d)", re.I)
_OCRISH = re.compile(r"(?<![\w])([0-9OoIl|SB]{1,2})\s?([./\-])\s?([0-9OoIl|SB]{1,2})\s?\2\s?([0-9OoIl|SB]{4})(?![\w])")
_ILLEGIBLE = re.compile(r"(?<![\w])([\d?]{1,2})\s?[./\-]\s?([\d?]{1,2})\s?[./\-]\s?([\d?]{2,4})(?:\s*\[[^\]]{0,40}\])?")
_RELATIVE = re.compile(
    r"\b(?:within|in|after|before|not\s+later\s+than)\s+(?:a\s+period\s+of\s+)?" + WORDNUM_RE +
    r"(?:\s*\(\d+\))?\s+(days?|weeks?|months?|years?|fortnight)\b(?:\s+(?:of|from|after)\s+([^.;,]{3,70}))?",
    re.I,
)
_FORTNIGHT = re.compile(r"\bwithin\s+a\s+fortnight\b(?:\s+(?:of|from)\s+([^.;,]{3,70}))?", re.I)
_HEDGE = re.compile(r"\b(on\s+or\s+about|on\s+or\s+around|in\s+or\s+around|around|approximately|about|sometime\s+(?:on|in|around)|some\s+time\s+in)\s+$", re.I)
_VAGUE = re.compile(
    r"\b(?:on\s+or\s+about|sometime\s+in|some\s+time\s+in|in\s+or\s+around)?\s*"
    r"(?:(?:early|mid|late|the\s+end\s+of|end\s+of|the\s+beginning\s+of|beginning\s+of)[\s-]+)?"
    r"(autumn|winter|summer|spring|monsoon)(?:\s+of\s+(?:the\s+)?(?:preceding|previous|last|current|same)\s+year|\s+\d{4})?"
    r"|\b(?:during|in|of)\s+the\s+(?:preceding|previous|last|following)\s+(?:year|month|week)\b"
    r"|\b(?:first|second|third|last)\s+week\s+of\s+" + MONTH_RE + r"\b(?:\s+\d{4})?",
    re.I,
)

_OCR_MAP = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "|": "1", "S": "5", "B": "8"})


def _valid(y: int, m: int, d: int) -> date | None:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def _year(y: str) -> int:
    v = int(y)
    return v + 2000 if len(y) == 2 else v


def _mention_for(y: int, m: int, d: int, s: int, e: int, text: str) -> DateMention:
    dt = _valid(y, m, d)
    if dt is None:
        return DateMention(s, e, text, "invalid", detail="Not a real calendar date")
    if not (MIN_YEAR <= dt.year <= MAX_YEAR):
        return DateMention(s, e, text, "invalid", candidate=dt, detail=f"Implausible year {dt.year}")
    return DateMention(s, e, text, "exact", date=dt)


def find_dates(sentence: str) -> list[DateMention]:
    """All date-like expressions in a sentence, non-overlapping, in order."""
    found: list[DateMention] = []

    for m in _NUM.finditer(sentence):
        d, _, mo, y = m.groups()
        found.append(_mention_for(_year(y), int(mo), int(d), m.start(), m.end(), m.group(0)))
    for m in _ISO.finditer(sentence):
        y, mo, d = m.groups()
        found.append(_mention_for(int(y), int(mo), int(d), m.start(), m.end(), m.group(0)))
    for m in _DMY.finditer(sentence):
        d, mon, y = m.groups()
        found.append(_mention_for(int(y), MONTHS[mon.lower()], int(d), m.start(), m.end(), m.group(0)))
    for m in _MDY.finditer(sentence):
        mon, d, y = m.groups()
        found.append(_mention_for(int(y), MONTHS[mon.lower()], int(d), m.start(), m.end(), m.group(0)))
    for m in _OCRISH.finditer(sentence):
        raw = m.group(0)
        if not re.search(r"[OoIl|SB]", raw):
            continue
        d, _, mo, y = (g.translate(_OCR_MAP) for g in m.groups())
        mention = _mention_for(int(y), int(mo), int(d), m.start(), m.end(), raw)
        if mention.kind == "exact":
            mention = DateMention(m.start(), m.end(), raw, "ocr_fixed", candidate=mention.date, detail="Digits repaired from OCR look-alike characters")
        found.append(mention)
    for m in _ILLEGIBLE.finditer(sentence):
        if "?" in m.group(0):
            found.append(DateMention(m.start(), m.end(), m.group(0), "illegible", detail="Some digits could not be read"))
    for m in _MY.finditer(sentence):
        found.append(DateMention(m.start(), m.end(), m.group(0), "month", detail="Only the month and year are stated"))
    for m in _RELATIVE.finditer(sentence):
        base = (m.group(3) or "").strip()
        found.append(DateMention(m.start(), m.end(), m.group(0), "relative", detail=base))
    for m in _FORTNIGHT.finditer(sentence):
        found.append(DateMention(m.start(), m.end(), m.group(0), "relative", detail=(m.group(1) or "").strip()))
    for m in _VAGUE.finditer(sentence):
        if m.group(0).strip():
            found.append(DateMention(m.start(), m.end(), m.group(0).strip(), "vague", detail="Vague date wording"))

    # resolve overlaps: exact beats everything; otherwise the longer span wins
    rank = {"exact": 0, "ocr_fixed": 1, "invalid": 2, "illegible": 3, "relative": 4, "vague": 5, "month": 6}
    found.sort(key=lambda x: (x.start, rank.get(x.kind, 9), -(x.end - x.start)))
    out: list[DateMention] = []
    for f in found:
        clash = next((o for o in out if f.start < o.end and f.end > o.start), None)
        if clash is None:
            out.append(f)
            continue
        better = (rank[f.kind], -(f.end - f.start)) < (rank[clash.kind], -(clash.end - clash.start))
        # a relative/vague phrase that *contains* an exact date (e.g. "within 15 days from 12.01.2026")
        # keeps both: the exact date as a base, the phrase as the relative deadline
        if clash.kind in ("relative", "vague") and f.kind == "exact":
            out.append(f)
            continue
        if f.kind in ("relative", "vague") and clash.kind == "exact":
            out.append(f)
            continue
        if better:
            out[out.index(clash)] = f
    out.sort(key=lambda x: x.start)

    # hedged exact dates ("on or about 12.03.2026") are approximate
    for i, mnt in enumerate(out):
        if mnt.kind == "exact" and _HEDGE.search(sentence[max(0, mnt.start - 30): mnt.start]):
            out[i] = DateMention(mnt.start, mnt.end, mnt.text, "approx", candidate=mnt.date, detail="Approximate wording")
    return out


REASON = {
    "approx": "Approximate date wording",
    "ocr_fixed": "Digits repaired from unclear OCR",
    "month": "Only month and year stated",
    "relative": "Relative deadline, no date stated",
    "vague": "Vague date wording",
    "illegible": "Illegible date stamp",
    "invalid": "Impossible or implausible date",
    "low_ocr": "Low OCR confidence",
}


def quarantine_reason(m: DateMention, min_conf: float) -> str | None:
    """Why a mention must not go on the timeline, or None if it can."""
    if m.kind == "exact":
        if m.ocr_confidence is not None and m.ocr_confidence < min_conf:
            return REASON["low_ocr"]
        return None
    return REASON.get(m.kind, "Unclear date")


def fmt_num(d: date) -> str:
    return d.strftime("%d.%m.%Y")
