"""Document classification, identifiers and titles.

Rules come first (fast, explainable). When the rules are unsure, the Groq model
picks from the same closed list of document types, so it can never invent one.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from .dates import find_dates, fmt_num

# (pattern, doc_type, template by case type {civil, criminal, tribunal} or "*" for all)
RULES: list[tuple[str, str, dict[str, str]]] = [
    (r"\blegal notice\b", "Notice", {"*": "Legal Notice", "tribunal": "Statutory Notice"}),
    (r"\bstatutory notice\b", "Notice", {"*": "Statutory Notice"}),
    (r"\bfirst information report\b|\bF\.?\s?I\.?\s?R\.?\s+No\b", "Police record", {"*": "FIR or Private Complaint"}),
    (r"\bprivate complaint\b|\bcomplaint under section\b", "Pleading", {"*": "FIR or Private Complaint"}),
    (r"\bcharge[- ]?sheet\b|\bfinal report u/s\.? ?173\b|\bfinal report under section 173\b|\breport under section 193\b", "Police record", {"*": "Final Police Chargesheet"}),
    (r"\bseizure memo\b|\brecovery memo\b", "Police record", {"*": "Seizure Memos"}),
    (r"\bforensic\b|\bF\.?S\.?L\.?\b report|\bcyber expert\b", "Report", {"*": "Forensic/Cyber Expert Reports"}),
    (r"\bstatement of witness\b|\bwitness statement\b|\bu/s\.? ?161\b|\bsection 180\b", "Police record", {"*": "Witness Statements"}),
    (r"\b(anticipatory |regular )?bail application\b|\bapplication for (regular |anticipatory )?bail\b", "Application", {"*": "Arrest/Bail Applications"}),
    (r"\border on bail\b|\bbail (is )?(granted|allowed|rejected|dismissed)\b", "Court order", {"*": "Bail Orders"}),
    (r"\bdischarge (petition|application)\b", "Application", {"*": "Discharge Petitions"}),
    (r"\bframing of charges?\b|\bcharges? (is |are )?framed\b", "Court order", {"*": "Court Order Framing Charges"}),
    (r"\bplea of the accused\b|\bpleaded (not )?guilty\b", "Court record", {"*": "Plea Statements"}),
    (r"\bstatement of (the )?accused\b|\bu/s\.? ?313\b|\bsection 351\b", "Transcript", {"*": "Accused Statement under Oath"}),
    (r"\bprosecution witness\b|\bPW-?\s?\d+\b.{0,40}\bexamination", "Transcript", {"*": "Prosecution Witness Transcripts"}),
    (r"\bdefen[cs]e witness\b|\bDW-?\s?\d+\b", "Transcript", {"*": "Defense Witness Transcripts"}),
    (r"\border on sentence\b|\bsentenced to\b", "Court order", {"*": "Order on Sentence"}),
    (r"\bplaint\b|\bsuit for (recovery|declaration|injunction|specific performance|damages|possession)\b", "Pleading", {"*": "Plaint (Complaint)"}),
    (r"\bwritten statement\b", "Pleading", {"*": "Written Statement"}),
    (r"\bcounter[- ]claim\b", "Pleading", {"*": "Counter-Claims"}),
    (r"\breplication\b", "Pleading", {"*": "Replication/Rejoinder"}),
    (r"\brejoinder\b", "Pleading", {"*": "Replication/Rejoinder", "tribunal": "Petitioner's Rejoinder"}),
    (r"\bsummons\b.{0,120}\b(served|service|process server)\b|\bservice report\b", "Court record", {"*": "Summons Service Report"}),
    (r"\binterrogator(y|ies)\b", "Pleading", {"*": "Interrogatories"}),
    (r"\blist of (additional )?documents\b", "Pleading", {"*": "Production of Additional Documents list"}),
    (r"\baffidavit of evidence\b|\bevidence by way of affidavit\b|\baffidavits? in evidence\b", "Affidavit", {"*": "Affidavits of Evidence"}),
    (r"\bcompliance affidavit\b", "Affidavit", {"*": "Compliance Affidavits"}),
    (r"\bcounter[- ]affidavit\b|\breply on behalf of the respondent\b", "Pleading", {"*": "Reply / Counter-Affidavit"}),
    (r"\baffidavit\b", "Affidavit", {"*": "Affidavits"}),
    (r"\bdeposition\b", "Transcript", {"*": "Deposition Transcripts"}),
    (r"\bcross[- ]examination\b", "Transcript", {"*": "Cross-Examination Transcripts"}),
    (r"\bcommissioner'?s report\b|\breport of the (local )?commissioner\b", "Report", {"*": "Commissioner Reports"}),
    (r"\b(audit|valuation) report\b", "Report", {"*": "Audit / Valuation Reports"}),
    (r"\bwritten (arguments|submissions)\b", "Pleading", {"*": "Final Written Arguments", "tribunal": "Written Submissions"}),
    (r"\bmemorandum of appeal\b|\bappeal memorandum\b|\bappeal petition\b", "Pleading", {"*": "Appeal Petition", "criminal": "Appeal Memorandum", "tribunal": "Appellate Challenge Filings"}),
    (r"\bdecree\b", "Judgment", {"*": "Decree"}),
    (r"\bjudg(e)?ment\b", "Judgment", {"*": "Judgment", "criminal": "Final Judgment (Conviction/Acquittal)", "tribunal": "Final Award / Order"}),
    (r"\bconsumer complaint\b|\bcompany petition\b|\bpetition under section\b", "Pleading", {"*": "Consumer / Company Petition"}),
    (r"\bexecution petition\b", "Pleading", {"*": "Execution / Compliance Petitions"}),
    (r"\b(I\.?\s?A\.?|interlocutory application)\s*No\b|\bapplication under order\b|\bstay application\b|\binjunction application\b", "Application", {"*": "Interim Applications", "tribunal": "Interim Stay / Injunction Applications"}),
    (r"\bexhibit\b|\bannexure\b|\bagreement\b|\binvoice\b|\breceipt\b", "Exhibit", {"*": "Initial Supporting Exhibits", "tribunal": "Initial Evidence"}),
    (r"\border sheet\b|\bdaily order\b|\bproceedings\b", "Court order", {"criminal": "Daily Order Sheets", "tribunal": "Hearing Order Sheets"}),
    (r"\border\b", "Court order", {"criminal": "Daily Order Sheets", "tribunal": "Ad-interim Orders"}),
]

DOC_TYPES = sorted({r[1] for r in RULES} | {"Unclassified"})

TEMPLATES_ALL = sorted({t for r in RULES for t in r[2].values()})


@dataclass
class Classification:
    doc_type: str
    template: str | None
    confidence: float
    title: str = ""
    doc_date: date | None = None
    identifiers: dict = field(default_factory=dict)


def heading_lines(text: str, n: int = 8) -> list[str]:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    return lines[:n]


def classify(first_page: str, filename: str, case_type: str) -> Classification:
    head = "\n".join(heading_lines(first_page))
    body = first_page[:1800]
    fname = re.sub(r"[_\-.]+", " ", filename)
    scores: dict[int, float] = {}
    for i, (pat, _, _) in enumerate(RULES):
        rx = re.compile(pat, re.I)
        s = 3.0 * len(rx.findall(head)) + 1.0 * min(3, len(rx.findall(body))) + 2.0 * len(rx.findall(fname))
        if s:
            # earlier rules are more specific; break ties in their favour
            scores[i] = s + (len(RULES) - i) * 0.001
    if not scores:
        return Classification("Unclassified", None, 0.0)
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top_i, top = ranked[0]
    second = ranked[1][1] if len(ranked) > 1 else 0.0
    _, doc_type, tmpl = RULES[top_i]
    template = tmpl.get(case_type, tmpl.get("*"))
    conf = round(top / (top + second + 1.0), 2)
    return Classification(doc_type, template, conf)


# --------------------------------------------------------------------------- identifiers

IA_RE = re.compile(r"\b(?:I\.?\s?A\.?|Interlocutory Application)\s*No\.?\s*(\d+)\s*(?:/|of)\s*(\d{4})", re.I)
CASE_NO_RE = re.compile(r"\b((?:CS|C\.S\.|OS|O\.S\.|CC|C\.C\.|CRL\.?\s?M\.?A\.?|W\.?P\.?|RFA|FAO|MACT|CC/TRB)\s*(?:\(COMM\)|\(OS\))?\s*(?:No\.?)?\s*[\d/]+\s*(?:/|of)\s*\d{4})", re.I)
FIR_RE = re.compile(r"\bF\.?\s?I\.?\s?R\.?\s*No\.?\s*([\d/]+\s*(?:/|of)\s*\d{4})", re.I)
EXHIBIT_RE = re.compile(r"\b(Exhibit|Ex\.|Annexure|Mark)\s*([A-Z]{1,2}\s?[-–]?\s?\d+)\b", re.I)
DATED_RE = re.compile(r"\b(?:dated|date|dt\.?)\s*[:\-]?\s*$", re.I)
NUMBERED_HEAD_RE = re.compile(r"\b(Crl\.?\s?M\.?A\.?|Bail Application|W\.?P\.?(?:\s?\(C\))?|Execution Petition|Review Petition)\s*No\.?\s*(\d+)\s*(?:/|of)\s*(\d{4})", re.I)
ACRONYMS = {"FIR", "BNSS", "BNS", "CPC", "CRPC", "IPC", "IA", "CS", "COMM", "PW", "DW", "FSL", "MIDC", "NI", "OS", "CC", "WP", "LTD", "PVT"}
SMALL = {"of", "and", "the", "in", "on", "for", "to", "under", "by", "at", "or", "a", "an", "with"}


def nice_case(h: str) -> str:
    """Sentence-case an ALL-CAPS heading while keeping legal acronyms."""
    if not h.isupper():
        return h
    words = h.split()
    out = []
    for i, w in enumerate(words):
        core = re.sub(r"[^A-Za-z]", "", w)
        if core.upper() in ACRONYMS:
            out.append(w)
        elif i == 0:
            out.append(w[:1] + w[1:].lower())
        else:
            out.append(w.lower())
    return " ".join(out)


def norm_exhibit(kind: str, mark: str) -> str:
    k = "Exhibit" if kind.lower().startswith("ex") else kind.capitalize()
    m = re.sub(r"\s", "", mark).upper().replace("–", "-")
    if "-" not in m:
        m = re.sub(r"^([A-Z]+)(\d+)$", r"\1-\2", m)
    return f"{k} {m}"


def identifiers(first_page: str) -> dict:
    head = first_page[:900]
    ias = sorted({f"IA {a}/{b}" for a, b in IA_RE.findall(head)})
    cases = sorted({re.sub(r"\s+", " ", c).strip() for c in CASE_NO_RE.findall(head)})
    firs = sorted({re.sub(r"\s+", "", f) for f in FIR_RE.findall(head)})
    exh = sorted({norm_exhibit(k, m) for k, m in EXHIBIT_RE.findall("\n".join(heading_lines(first_page, 4)))})
    nums = sorted({f"{re.sub(r'[ .]+', ' ', k).strip()} {a}/{b}" for k, a, b in NUMBERED_HEAD_RE.findall(head)})
    return {"ia": ias, "case_numbers": cases + nums, "fir": firs, "exhibits": exh}


def document_date(first_page: str, doc_type: str) -> date | None:
    """The document's own date: a date in the heading area, preferring 'Dated:' style labels."""
    lines = heading_lines(first_page, 10)
    for ln in lines:
        if re.match(r"^(dated|date|dt\.?)\b\s*[:\-]?", ln, re.I):
            found = [m for m in find_dates(ln) if m.trusted]
            if found:
                return found[0].date
    head = "\n".join(lines)
    mentions = [m for m in find_dates(head) if m.trusted]
    if mentions and doc_type in ("Court order", "Judgment", "Notice"):
        return mentions[0].date
    # fall back to the first trusted date in the first paragraph for notices/orders
    if doc_type in ("Court order", "Judgment", "Notice"):
        body = [m for m in find_dates(first_page[:1200]) if m.trusted]
        if body:
            return body[0].date
    return None


def _party(first_page: str) -> str | None:
    m = re.search(r"\bon behalf of (?:the )?(plaintiff|defendant|petitioner|respondent|applicant|accused|complainant)s?\b", first_page[:1500], re.I)
    return m.group(1).capitalize() if m else None


def make_title(c: Classification, first_page: str, filename: str) -> str:
    d = fmt_num(c.doc_date) if c.doc_date else None
    head = heading_lines(first_page, 6)
    t = (c.template or "").lower()
    ids = c.identifiers
    if c.doc_type == "Court order":
        sheet = any("ORDER SHEET" in h for h in head if h.isupper())
        base = "Order sheet" if sheet else "Order"
        if "bail" in t:
            base = "Bail order"
        return f"{base} dated {d}" if d else base
    if c.doc_type == "Notice":
        return f"Legal notice dated {d}" if d else "Legal notice"
    if c.doc_type == "Judgment":
        return (c.template or "Judgment") + (f" dated {d}" if d else "")
    if c.doc_type == "Application" and ids.get("ia"):
        purpose = ""
        m = re.search(r"\b(interim\s+injunction|injunction|stay|condonation\s+of\s+delay|amendment|bail|discharge)\b", first_page[:1500], re.I)
        if m:
            purpose = f" ({re.sub(r'\s+', ' ', m.group(1)).lower()})"
        return f"{ids['ia'][0].replace('IA ', 'IA No. ')}{purpose}"
    if t.startswith("plaint"):
        return f"Plaint, {ids['case_numbers'][0]}" if ids.get("case_numbers") else "Plaint"
    if t in ("written statement", "counter-claims", "replication/rejoinder", "reply / counter-affidavit"):
        label = {"written statement": "Written statement", "counter-claims": "Counter-claim", "replication/rejoinder": "Replication", "reply / counter-affidavit": "Reply"}[t]
        p = _party(first_page)
        return f"{label} of {p}" if p else label
    if c.doc_type == "Exhibit" and ids.get("exhibits"):
        rest = next((h for h in head if not re.match(r"^\s*(exhibit|annexure|mark)\b", h, re.I)), "")
        rest = nice_case(rest)
        return f"{ids['exhibits'][0]}: {rest[:60]}".rstrip(": ")
    if c.doc_type == "Police record" and ids.get("fir") and "fir" in t:
        return f"FIR No. {ids['fir'][0]}"
    if c.template == "Final Police Chargesheet":
        return f"Chargesheet, FIR No. {ids['fir'][0]}" if ids.get("fir") else "Chargesheet"
    m = NUMBERED_HEAD_RE.search("\n".join(head))
    if m:
        return f"{re.sub(r'\s+', ' ', m.group(1)).strip()} No. {m.group(2)}/{m.group(3)}"
    if c.template == "Summons Service Report":
        return "Summons service report"
    for h in head:
        if len(h) > 4 and not re.match(r"^(in the|before the|court of|present)\b", h, re.I):
            nice = nice_case(h)
            return nice[:90] + (f" dated {d}" if d and d not in nice else "")
    stem = re.sub(r"[_\-]+", " ", filename.rsplit(".", 1)[0]).strip()
    return stem[:90] or "Untitled document"
