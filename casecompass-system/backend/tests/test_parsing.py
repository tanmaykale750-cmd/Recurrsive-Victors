from datetime import date

from app.parsing.classify import classify, identifiers
from app.parsing.dates import find_dates, quarantine_reason
from app.parsing.references import find_references
from app.parsing.sentences import split_sentences


def kinds(s):
    return [(m.kind, m.date or m.candidate) for m in find_dates(s)]


def test_exact_dates_day_first():
    assert kinds("Notice issued on 12.01.2026.") == [("exact", date(2026, 1, 12))]
    assert kinds("signed on 5th August, 2025 and on March 3, 2026") == [("exact", date(2025, 8, 5)), ("exact", date(2026, 3, 3))]
    assert kinds("dated the 12th day of March 2026") == [("exact", date(2026, 3, 12))]


def test_case_numbers_are_not_dates():
    assert find_dates("Reply to IA No. 302/2026 be filed.") == []
    assert [m.kind for m in find_dates("Reply to IA No. 302/2026 be filed within two weeks.")] == ["relative"]
    assert find_dates("Hearing in CS (COMM) 118/2026") == []


def test_unclear_dates_are_quarantined_never_guessed():
    cases = {
        "within 15 days of receipt of this notice": "relative",
        "dispatched on or about late autumn of the preceding year": "vague",
        "Received on 1?/0?/2026 [stamp partly illegible]": "illegible",
        "Order passed on 31.02.2026.": "invalid",
        "Meeting held in March 2026.": "month",
        "Filed on l2.0l.2026.": "ocr_fixed",
    }
    for text, kind in cases.items():
        ms = find_dates(text)
        assert ms and ms[0].kind == kind, (text, ms)
        assert quarantine_reason(ms[0], 60) is not None
        assert ms[0].date is None  # no timeline date is ever produced for these


def test_hedged_exact_date_offers_suggestion_only():
    m = find_dates("arrested on or about 03.03.2026 at his residence")[0]
    assert m.kind == "approx" and m.date is None and m.candidate == date(2026, 3, 3)


def test_low_ocr_confidence_quarantines_exact_date():
    m = find_dates("served on 06.03.2026")[0]
    m.ocr_confidence = 41
    assert quarantine_reason(m, 60) == "Low OCR confidence"
    m.ocr_confidence = 92
    assert quarantine_reason(m, 60) is None


def test_sentences_respect_legal_abbreviations_and_dates():
    text = "M/s Mehta Traders Pvt. Ltd. filed IA No. 214/2026 on 19.05.2026. The Hon'ble Court listed it. Next sentence."
    out = [s.text for s in split_sentences(text)]
    assert out == ["M/s Mehta Traders Pvt. Ltd. filed IA No. 214/2026 on 19.05.2026.", "The Hon'ble Court listed it.", "Next sentence."]


def test_references():
    refs = find_references("In continuation of order dated 22.05.2026, notice on IA No. 214/2026 and Exhibit P-1; the mediation report is awaited.")
    assert [r.norm for r in refs] == ["order:2026-05-22", "ia:214/2026", "exhibit:exhibit p-1", "report:mediation"]


def test_classification_and_identifiers():
    page = "IN THE COURT OF THE DISTRICT JUDGE\nI.A. No. 214/2026 in CS (COMM) 118/2026\n\nAPPLICATION UNDER ORDER XXXIX FOR INTERIM INJUNCTION\n\nApplication seeking ..."
    c = classify(page, "ia.pdf", "civil")
    assert c.doc_type == "Application" and c.template == "Interim Applications"
    assert identifiers(page)["ia"] == ["IA 214/2026"]
    fir = classify("FIRST INFORMATION REPORT\nFIR No. 112/2026\nPolice Station: Kothrud", "fir.pdf", "criminal")
    assert fir.template == "FIR or Private Complaint"
