"""The AI may refine titles and kinds, but can never introduce a date that is not in the source."""
from datetime import date

from app.ai import tasks
from app.parsing import analyze as az
from app.parsing.text_extract import PageText


class FakeClient:
    enabled = True


def test_ai_output_is_validated_against_source(monkeypatch):
    page = PageText(1, "The Plaintiff shall file affidavits of evidence on or before 16.10.2026. In continuation of order dated 22.05.2026, notice is issued.", "text")

    def fake_refine(title, dtype, sentences):
        sid = sentences[0]["id"]
        return {"events": [
            {"sentence_id": sid, "date": "2026-10-16", "kind": "deadline", "title": "Plaintiff's evidence affidavits due", "party": "Plaintiff", "is_reference": False},
            {"sentence_id": sid, "date": "2026-10-30", "kind": "deadline", "title": "Invented follow-up", "party": None, "is_reference": False},  # hallucinated
            {"sentence_id": 999, "date": "2026-10-16", "kind": "event", "title": "Bad sentence id", "party": None, "is_reference": False},
        ]}

    monkeypatch.setattr(az, "ai_client", FakeClient())
    monkeypatch.setattr(tasks, "refine_events", fake_refine)
    out = az.analyze([page], doc_code="D99", doc_type="Court order", doc_date=None, doc_title="Order", use_ai=True)
    assert out.ai_used
    assert [(e.date, e.title, e.method) for e in out.events] == [(date(2026, 10, 16), "Plaintiff's evidence affidavits due", "ai")]
    reasons = " ".join(r["reason"] for r in out.rejected)
    assert "not in the source sentence" in reasons and "does not exist" in reasons
    # the reference date was never offered to the AI as an event date
    assert all(e.date != date(2026, 5, 22) for e in out.events)


def test_ai_unavailable_falls_back_to_rules(monkeypatch):
    page = PageText(1, "Cross-examination of PW-1 shall be concluded by 18.12.2026.", "text")

    def boom(*a, **k):
        raise tasks.AIUnavailable("timeout")

    monkeypatch.setattr(az, "ai_client", FakeClient())
    monkeypatch.setattr(tasks, "refine_events", boom)
    out = az.analyze([page], doc_code="D98", doc_type="Court order", doc_date=None, doc_title="Order", use_ai=True)
    assert not out.ai_used and out.ai_error == "timeout"
    assert out.events[0].kind == "deadline" and out.events[0].method == "rule"
