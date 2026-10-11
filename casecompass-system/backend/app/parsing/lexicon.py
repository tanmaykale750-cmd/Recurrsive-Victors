"""Procedural vocabulary for Indian civil, criminal and tribunal matters.

Each entry maps a recognisable procedural step to a canonical key. Keys let the
flagging engine recognise that two sentences in different documents describe the
same real-world event (e.g. "received the legal notice on 16.01.2026" in the
replication and "received the alleged legal notice only on 19.01.2026" in the
written statement), which is how date conflicts are found.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Step:
    key: str
    pattern: re.Pattern
    title: str
    #: in a court order, a sentence with no date of its own takes the order's date
    operative: bool = False
    #: flag as "undated event" when mentioned without any date anywhere in the record
    undated_check: bool = False


def _p(s: str) -> re.Pattern:
    return re.compile(s, re.I)


STEPS: list[Step] = [
    # ---- civil -------------------------------------------------------------
    Step("payment_demanded", _p(r"\bcalled upon to (pay|clear)\b|\bdemand(ed|ing)? (the )?payment\b"), "Payment demanded in the legal notice"),
    Step("notice_received", _p(r"\breceiv\w*\b.{0,50}\bnotice\b|\bnotice\b.{0,40}\breceiv\w*"), "Legal notice received"),
    Step("notice_issued", _p(r"\blegal notice\b.{0,60}\b(issued|sent|dispatched)\b|\b(issued|sent)\b.{0,40}\blegal notice"), "Legal notice issued", undated_check=True),
    Step("suit_filed", _p(r"\b(suit|plaint)\b.{0,80}\b(instituted|filed|presented)\b"), "Suit filed"),
    Step("summons_served", _p(r"\bsummons?\b.{0,80}\bserved\b|\bserv\w*\b.{0,40}\bsummons"), "Summons served"),
    Step("counterclaim_filed", _p(r"\bcounter[- ]claim\b.{0,80}\b(filed|raises?|raised)\b"), "Counter-claim filed"),
    Step("replication_filed", _p(r"\b(replication|rejoinder)\b.{0,80}\bfiled\b"), "Replication filed"),
    Step("ws_filed", _p(r"\bwritten statement\b.{0,80}\bfiled\b|\bfiled\b.{0,30}\bwritten statement\b"), "Written statement filed"),
    Step("reply_filed", _p(r"\breply\b.{0,40}\b(was |has been |is )?filed\b"), "Reply filed", undated_check=True),
    Step("injunction_granted", _p(r"\binjunction\b.{0,40}\bgranted\b|\bgranted\b.{0,30}\binjunction"), "Injunction granted", operative=True),
    Step("stay_granted", _p(r"\bstay\b.{0,30}\b(granted|ordered)\b"), "Stay granted", operative=True),
    Step("affidavit_filed", _p(r"\baffidavits?\b.{0,80}\b(filed|sworn)\b"), "Affidavit filed"),
    Step("issues_framed", _p(r"\bissues\b.{0,15}\b(are |were |have been )?framed\b|\bframing of issues\b"), "Issues framed", operative=True),
    Step("commissioner_appointed", _p(r"\bcommissioner\b.{0,40}\bappointed\b|\bappoint\w*\b.{0,30}\bcommissioner"), "Local Commissioner appointed", operative=True),
    Step("agreement_executed", _p(r"\bagreement\b.{0,80}\b(made|executed|entered into|signed)\b"), "Agreement executed"),
    Step("goods_dispatched", _p(r"\b(consignment|goods)\b.{0,40}\b(dispatched|delivered|shipped)\b"), "Goods dispatched"),
    Step("mediation", _p(r"\bmediation\b.{0,40}\b(failed|referred|report|unsuccessful|concluded)\b|\breferred to mediation\b|\bmediation having failed\b"), "Referral to mediation and its outcome", undated_check=True),
    Step("judgment_pronounced", _p(r"\bjudg(e)?ment\b.{0,40}\b(pronounced|delivered)\b"), "Judgment pronounced", operative=True),
    Step("decree_drawn", _p(r"\bdecree\b.{0,30}\b(drawn|passed)\b"), "Decree drawn up", operative=True),
    Step("appeal_filed", _p(r"\bappeal\b.{0,60}\bfiled\b"), "Appeal filed"),
    # ---- criminal ----------------------------------------------------------
    Step("fir_registered", _p(r"\bF\.?\s?I\.?\s?R\.?\b.{0,60}\b(registered|lodged|recorded)\b|\b(registered|lodged)\b.{0,30}\bF\.?\s?I\.?\s?R"), "FIR registered"),
    Step("complaint_filed", _p(r"\bcomplaint\b.{0,40}\b(filed|lodged)\b"), "Complaint filed"),
    Step("arrest", _p(r"\b(was |were |been )?arrested\b"), "Accused arrested", undated_check=True),
    Step("bail_applied", _p(r"\bbail application\b.{0,60}\bfiled\b|\bapplication for (regular |anticipatory )?bail\b.{0,60}\bfiled\b"), "Bail application filed"),
    Step("bail_granted", _p(r"\bbail\b.{0,40}\b(granted|allowed)\b|\benlarged on bail\b|\breleased on bail\b"), "Bail granted", operative=True),
    Step("bail_rejected", _p(r"\bbail\b.{0,40}\b(rejected|dismissed|declined)\b"), "Bail rejected", operative=True),
    Step("chargesheet_filed", _p(r"\bcharge[- ]?sheet\b.{0,60}\b(filed|submitted)\b|\bfinal report\b.{0,40}\b(filed|submitted)\b"), "Chargesheet filed"),
    Step("seizure", _p(r"\b(was |were )?seized\b"), "Seizure recorded", undated_check=True),
    Step("cognizance_taken", _p(r"\bcognizance\b.{0,30}\btaken\b|\btak\w+ cognizance\b"), "Cognizance taken", operative=True),
    Step("charges_framed", _p(r"\bcharges?\b.{0,20}\b(are |is |were |has been |have been )?framed\b"), "Charges framed", operative=True),
    Step("plea_recorded", _p(r"\bplea\b.{0,40}\brecorded\b|\bpleaded (not )?guilty\b"), "Plea recorded", operative=True),
    Step("sentence_passed", _p(r"\bsentenced\b|\border on sentence\b"), "Sentence passed", operative=True),
    Step("ia_filed", _p(r"\b(application|I\.?\s?A\.?)\b.{0,120}\bfiled\b"), "Application filed"),
    Step("remand", _p(r"\bremanded\b"), "Remanded to custody"),
]

#: deadlines: what a stated deadline is for, and which event (if on record) completes it
DEADLINE_TOPICS: list[tuple[str, re.Pattern, str | None]] = [
    ("ws", _p(r"\bwritten statement\b"), "ws_filed"),
    ("replication", _p(r"\b(replication|rejoinder)\b"), "replication_filed"),
    ("evidence_affidavit", _p(r"\baffidavits? of evidence\b|\bevidence by way of affidavit\b"), None),
    ("fee", _p(r"\bfee\b|\bcosts?\b|\bdeposit"), None),
    ("commissioner_report", _p(r"\bcommissioner\b.{0,40}\breport\b|\bsubmit the report\b"), None),
    ("cross_examination", _p(r"\bcross[- ]examination\b"), None),
    ("reply", _p(r"\breply\b"), "reply_filed"),
    ("chargesheet", _p(r"\bcharge[- ]?sheet\b|\bfinal report\b"), "chargesheet_filed"),
    ("payment", _p(r"\bpay\b|\bpayment\b|\bdues\b"), None),
    ("appearance", _p(r"\bappear\b"), None),
]

HEARING_RE = _p(
    r"\b(list(ed)?|posted|put up|re-?list(ed)?|adjourned|fixed|next date(?: of hearing)?|to come up|hearing)\b"
)
OBLIGATION_RE = _p(r"\b(shall|is directed|are directed|directed to|must|to be|be (filed|deposited|submitted|concluded|paid|produced)|is required)\b")
DEADLINE_LEAD_RE = _p(r"(on or before|by|before|not later than|latest by|no later than|till|until)\s*$")
HEARING_LEAD_RE = _p(r"(\bon|\bfor|\bto)\s*$")
REFERENCE_LEAD_RE = _p(
    r"\b(order|order sheet|orders|notice|legal notice|letter|judg(e)?ment|application|report|agreement|affidavit|decree|award|communication|reply|email|e-mail|memo)s?\s*(dated|dt\.?|of)\s*$"
)
PARTY_RE = _p(
    r"\b(plaintiffs?|defendants?|petitioners?|respondents?|applicants?|accused|complainant|prosecution|"
    r"local commissioner|investigating officer|state)\b"
)

STOPWORDS = set(
    "a an the of to on in for by with and or as at is are was were be been being that this these those it its from "
    "into upon under said such any all which who whom whose than then there their them his her he she they we our "
    "you your shall may has have had not no only also before after till until dated date day days".split()
)


def match_step(text: str) -> Step | None:
    for st in STEPS:
        if st.pattern.search(text):
            return st
    return None


def match_steps(text: str) -> list[Step]:
    return [st for st in STEPS if st.pattern.search(text)]


def deadline_topic(text: str) -> tuple[str, str | None]:
    for key, pat, completes in DEADLINE_TOPICS:
        if pat.search(text):
            return key, completes
    return "other", None


def find_party(text: str) -> str | None:
    m = PARTY_RE.search(text)
    if not m:
        return None
    p = m.group(1).lower()
    p = {"plaintiffs": "plaintiff", "defendants": "defendant", "petitioners": "petitioner", "respondents": "respondent", "applicants": "applicant"}.get(p, p)
    return " ".join(w.capitalize() for w in p.split())


def signature(text: str) -> str:
    """Bag of content words used for fuzzy same-event matching."""
    words = re.findall(r"[a-z][a-z\-']+", text.lower())
    keep = []
    for w in words:
        if w in STOPWORDS or len(w) < 3:
            continue
        for suf in ("ing", "ed", "es", "s"):
            if w.endswith(suf) and len(w) - len(suf) >= 4:
                w = w[: -len(suf)]
                break
        keep.append(w)
    return " ".join(sorted(set(keep)))


def jaccard(a: str, b: str) -> float:
    sa, sb = set(a.split()), set(b.split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)
