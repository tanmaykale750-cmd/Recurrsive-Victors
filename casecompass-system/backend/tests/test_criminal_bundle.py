"""Criminal test bundle (a scanned FIR and a phone photo of the bail order among them) end to end."""
from tests.fixtures.upload import upload_files


def test_pipeline_flags_criminal_bundle(client, auth, bundle):
    c = client.post("/api/cases", headers=auth, json={"title": "State v. R. Kulkarni", "number": "FIR 112/2026", "case_type": "criminal"}).json()
    upload_files(client, auth, c["id"], bundle("criminal"))
    b = client.get(f"/api/cases/{c['id']}/bundle", headers=auth).json()

    formats = {d["format"] for d in b["docs"].values()}
    assert {"PDF", "Scanned PDF", "Scanned image"} <= formats
    conflicts = {i["title"]: [d["date"] for d in i["dates"]] for i in b["items"] if i["kind"] == "conflict"}
    assert conflicts == {"Accused arrested": ["2026-03-04", "2026-03-05"]}
    gaps = {g["title"]: b["status"][g["id"]] for g in b["gaps"]}
    assert gaps["Forensic report"] == "open" and gaps["No order taking cognizance on record"] == "open"
    assert gaps["No order on the bail application on record"] == "resolved"  # read from the photographed order
    assert any(t.startswith("Seizure memo") and s == "open" for t, s in gaps.items())
    assert [q["reason"] for q in b["quarantine"]] == ["Vague date wording"]
    events = {e["title"]: e["date"] for e in b["items"] if e["kind"] in ("event", "deadline", "hearing")}
    assert events.get("Bail granted") == "2026-03-16" and events.get("FIR registered") == "2026-03-02"
