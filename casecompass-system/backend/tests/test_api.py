"""End-to-end through the API: generated test documents (including scans for OCR) are uploaded and processed."""
import pytest

from tests.fixtures.upload import upload_files


def test_register_validation(client):
    bad = client.post("/api/auth/register", json={"name": "A B", "phone": "123", "email": "x@y.in", "password": "secret123"})
    assert bad.status_code == 422 and "phone" in bad.json()["detail"].lower()
    weak = client.post("/api/auth/register", json={"name": "A B", "phone": "+91 98765 43210", "email": "x@y.in", "password": "password"})
    assert weak.status_code == 422


def test_login_and_me(client, auth):
    r = client.post("/api/auth/login", json={"email": "t@example.in", "password": "wrong-pass1"})
    assert r.status_code == 401
    assert client.get("/api/auth/me", headers=auth).json()["name"] == "Test Reviewer"
    assert client.get("/api/cases").status_code == 401


@pytest.fixture(scope="module")
def civil_case(client, auth, bundle):
    c = client.post("/api/cases", headers=auth, json={"title": "Mehta Traders v. Orion Logistics Pvt. Ltd.", "number": "CS (COMM) 118/2026", "case_type": "civil"}).json()
    upload_files(client, auth, c["id"], bundle("civil"))
    return c["id"]


def test_pipeline_flags_civil_bundle(client, auth, civil_case):
    b = client.get(f"/api/cases/{civil_case}/bundle", headers=auth).json()
    assert len(b["docs"]) == 12
    assert {d["format"] for d in b["docs"].values()} >= {"PDF", "Scanned PDF", "Scanned image"}
    conflicts = {i["title"]: [d["date"] for d in i["dates"]] for i in b["items"] if i["kind"] == "conflict"}
    assert conflicts == {"Legal notice received by Defendant": ["2026-01-16", "2026-01-19"], "Summons served on Defendant": ["2026-03-06", "2026-03-11"]}
    open_gaps = {g["title"] for g in b["gaps"] if b["status"][g["id"]] != "resolved"}
    assert {"Order dated 22.05.2026", "IA No. 302/2026", "Referral to mediation and its outcome", "No reply to the counter-claim on record"} <= open_gaps
    reasons = sorted(q["reason"] for q in b["quarantine"])
    assert reasons == ["Illegible date stamp", "Relative deadline, no date stated", "Relative deadline, no date stated", "Vague date wording"]
    ws_deadline = next(i for i in b["items"] if i["kind"] == "deadline" and "written statement" in i["title"].lower())
    assert ws_deadline["fulfilled"]["date"] == "2026-04-08"
    # every item carries an exact source
    assert all(i.get("quote") or i.get("dates") for i in b["items"])


def test_resolution_rules_and_history(client, auth, civil_case):
    b = client.get(f"/api/cases/{civil_case}/bundle", headers=auth).json()
    conflict = next(i for i in b["items"] if i["kind"] == "conflict")
    url = f"/api/cases/{civil_case}/issues/{conflict['id']}"
    assert client.post(url + "/resolve", headers=auth, json={"type": "corrected", "date": "2026-01-16", "reason": "ok"}).status_code == 422  # reason too short / no basis
    assert client.post(url + "/resolve", headers=auth, json={"type": "corrected", "date": "2026-01-16", "basis": "A", "reason": "Postal acknowledgement"}).status_code == 200
    b = client.get(f"/api/cases/{civil_case}/bundle", headers=auth).json()
    assert b["status"][conflict["id"]] == "resolved" and b["resolutions"][conflict["id"]]["basis"] == "A"
    assert any(h["action"] == "Correction recorded" and h["who"] == "Test Reviewer" for h in b["history"])
    assert client.post(url + "/reopen", headers=auth).status_code == 200
    b = client.get(f"/api/cases/{civil_case}/bundle", headers=auth).json()
    assert b["status"][conflict["id"]] == "open" and conflict["id"] not in b["resolutions"]


def test_quarantine_confirm_and_event_correction(client, auth, civil_case):
    b = client.get(f"/api/cases/{civil_case}/bundle", headers=auth).json()
    q = next(x for x in b["quarantine"] if x["reason"] == "Illegible date stamp")
    r = client.post(f"/api/cases/{civil_case}/issues/{q['id']}/resolve", headers=auth,
                    json={"type": "confirmed", "date": "2026-10-28", "kind": "deadline", "reason": "Checked the original document"})
    assert r.status_code == 200
    ev = next(i for i in b["items"] if i["kind"] == "event")
    r = client.post(f"/api/cases/{civil_case}/events/{ev['id']}/correction", headers=auth, json={"date": "2026-01-13", "reason": "Typo in the notice header"})
    assert r.status_code == 200
    b = client.get(f"/api/cases/{civil_case}/bundle", headers=auth).json()
    fixed = next(i for i in b["items"] if i["id"] == ev["id"])
    assert fixed["date"] == ev["date"]  # the extracted date is never overwritten
    assert b["resolutions"][ev["id"]] == {**b["resolutions"][ev["id"]], "type": "corrected", "date": "2026-01-13", "original": ev["date"]}
    rep = client.get(f"/api/cases/{civil_case}/report", headers=auth).json()
    assert any(r["date"] == "13.01.2026" and "corrected" in r["note"] for r in rep["verified"])
    assert client.post(f"/api/cases/{civil_case}/notes", headers=auth, json={"target_type": "event", "target_code": ev["id"], "text": "Checked with counsel"}).status_code == 201


def test_reminders_only_for_verified_deadlines(client, auth, civil_case):
    b = client.get(f"/api/cases/{civil_case}/bundle", headers=auth).json()
    upcoming = next(i for i in b["items"] if i["kind"] == "deadline" and i["date"] >= b["today"])
    assert client.put(f"/api/cases/{civil_case}/reminders/{upcoming['id']}", headers=auth, json={"on": True, "days": [7, 1]}).status_code == 200
    q = b["quarantine"][0]["id"]
    assert client.put(f"/api/cases/{civil_case}/reminders/{q}", headers=auth, json={"on": True}).status_code == 422


def test_exports(client, auth, civil_case):
    rep = client.get(f"/api/cases/{civil_case}/report?gaps=false", headers=auth).json()
    assert rep["verified"] and all(u["type"] != "Missing document" for u in rep["unresolved"])
    pdf = client.get(f"/api/cases/{civil_case}/report.pdf", headers=auth)
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    docx = client.get(f"/api/cases/{civil_case}/report.docx", headers=auth)
    assert docx.status_code == 200 and docx.content[:2] == b"PK"
    ics = client.get(f"/api/cases/{civil_case}/calendar.ics", headers=auth)
    assert "BEGIN:VCALENDAR" in ics.text and "VALARM" in ics.text


def test_missing_document_auto_resolves_when_uploaded(client, auth, bundle):
    c = client.post("/api/cases", headers=auth, json={"title": "Auto resolve check", "case_type": "civil"}).json()
    from tests.fixtures.bundles import CIVIL

    files = {p.name: p for p in bundle("civil")}
    upload_files(client, auth, c["id"], [files[CIVIL[1][0]]])
    b = client.get(f"/api/cases/{c['id']}/bundle", headers=auth).json()
    gap = next(g for g in b["gaps"] if g["title"] == "Exhibit P-1")
    assert b["status"][gap["id"]] == "open"
    upload_files(client, auth, c["id"], [files[CIVIL[2][0]]])
    b = client.get(f"/api/cases/{c['id']}/bundle", headers=auth).json()
    assert b["status"][gap["id"]] == "resolved" and b["resolutions"][gap["id"]]["type"] == "auto"
    assert "now in the bundle" in b["resolutions"][gap["id"]]["reason"]


def test_other_users_cannot_see_case(client, auth, civil_case):
    r = client.post("/api/auth/register", json={"name": "Other Person", "phone": "+91 91234 56789", "email": "o@example.in", "password": "secret123"})
    other = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get(f"/api/cases/{civil_case}/bundle", headers=other).status_code == 404
