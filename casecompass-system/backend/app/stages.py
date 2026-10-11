"""Case-type document templates: which documents each stage of a matter is expected to produce."""

STAGES: dict[str, dict] = {
    "civil": {
        "label": "Civil suit",
        "list": [
            {"n": "Pre-suit and initiation", "m": "Month 0", "docs": ["Legal Notice", "Plaint (Complaint)", "Initial Supporting Exhibits"]},
            {"n": "Defence entry", "m": "Months 1–3", "docs": ["Summons Service Report", "Written Statement", "Counter-Claims", "Replication/Rejoinder"]},
            {"n": "Interlocutory motions and discovery", "m": "Months 4–8", "docs": ["Interim Applications", "Affidavits", "Interrogatories", "Production of Additional Documents list"]},
            {"n": "Trial and evidence", "m": "Months 9–18", "docs": ["Affidavits of Evidence", "Deposition Transcripts", "Cross-Examination Transcripts", "Commissioner Reports"]},
            {"n": "Final disposal and appeal", "m": "Months 19–24+", "docs": ["Final Written Arguments", "Judgment", "Decree", "Appeal Petition"]},
        ],
    },
    "criminal": {
        "label": "Criminal case",
        "list": [
            {"n": "Registration and investigation", "m": "Day 0 – Month 3", "docs": ["FIR or Private Complaint", "Arrest/Bail Applications", "Bail Orders"]},
            {"n": "Chargesheet and cognizance", "m": "Months 3–6", "docs": ["Final Police Chargesheet", "Seizure Memos", "Forensic/Cyber Expert Reports", "Witness Statements"]},
            {"n": "Pre-trial and framing of charges", "m": "Months 6–9", "docs": ["Discharge Petitions", "Court Order Framing Charges", "Plea Statements"]},
            {"n": "Trial proceedings", "m": "Months 10–30", "docs": ["Daily Order Sheets", "Prosecution Witness Transcripts", "Accused Statement under Oath", "Defense Witness Transcripts"]},
            {"n": "Verdict", "m": "Months 30+", "docs": ["Final Judgment (Conviction/Acquittal)", "Order on Sentence", "Appeal Memorandum"]},
        ],
    },
    "tribunal": {
        "label": "Tribunal / consumer",
        "list": [
            {"n": "Filing", "m": "Month 0", "docs": ["Consumer / Company Petition", "Statutory Notice", "Initial Evidence"]},
            {"n": "Response", "m": "Months 1–2", "docs": ["Tribunal Notice", "Reply / Counter-Affidavit", "Maintainability Objections", "Petitioner's Rejoinder"]},
            {"n": "Interim relief", "m": "Months 3–4", "docs": ["Interim Stay / Injunction Applications", "Ad-interim Orders", "Compliance Affidavits"]},
            {"n": "Evidence and audit", "m": "Months 5–8", "docs": ["Audit / Valuation Reports", "Expert Testimonies", "Written Submissions", "Hearing Order Sheets"]},
            {"n": "Final disposal", "m": "Months 9–12+", "docs": ["Final Award / Order", "Execution / Compliance Petitions", "Appellate Challenge Filings"]},
        ],
    },
}

CASE_TYPES = tuple(STAGES)


def stage_of(case_type: str, present_templates: set[str]) -> int:
    """Index (0-based) of the furthest stage with at least one document present; -1 if none."""
    st = STAGES.get(case_type, STAGES["civil"])["list"]
    idx = -1
    for i, s in enumerate(st):
        if any(d in present_templates for d in s["docs"]):
            idx = i
    return idx


def stages_payload(case_type: str, present_templates: set[str]) -> dict:
    """The structure the frontend checklist expects, for all case types."""
    out = {}
    for k, v in STAGES.items():
        present = sorted(present_templates) if k == case_type else []
        out[k] = {"label": v["label"], "now": stage_of(k, present_templates) if k == case_type else -1, "present": present, "list": v["list"]}
    return out
