"""Helper for tests: upload files through the real endpoint, as the browser does."""

def upload_files(client, auth, case_id, paths):
    mime = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".png": "image/png", ".docx": "application/octet-stream"}
    files = [("files", (p.name, p.read_bytes(), mime.get(p.suffix.lower(), "application/octet-stream"))) for p in paths]
    r = client.post(f"/api/cases/{case_id}/documents", headers=auth, files=files)
    assert r.status_code == 202, r.text
    return r.json()
