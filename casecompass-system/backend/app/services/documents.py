"""Storing uploads and creating document records."""
from __future__ import annotations

import mimetypes
import re
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Case, Document, User
from ..parsing.text_extract import ALLOWED_EXT
from .audit import log, next_code


def safe_name(name: str) -> str:
    base = Path(name).name
    return re.sub(r"[^A-Za-z0-9._ ()\-]+", "_", base)[:180] or "document"


def create_document(db: Session, case: Case, filename: str, data: bytes, user: User | None) -> Document:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"{filename}: unsupported type. Upload PDFs, scanned images (JPG, PNG, TIFF, HEIC) or Word files.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"{filename} is larger than {settings.max_upload_mb} MB.")
    if not data:
        raise HTTPException(400, f"{filename} is empty.")
    folder = settings.upload_dir / f"case_{case.id}"
    folder.mkdir(parents=True, exist_ok=True)
    stored = folder / f"{uuid.uuid4().hex}{ext}"
    stored.write_bytes(data)
    doc = Document(case_id=case.id, code=next_code(db, case, "D"), filename=safe_name(filename), stored_path=str(stored),
                   mime=mimetypes.guess_type(filename)[0] or "application/octet-stream", size=len(data), status="queued", step=0,
                   title=safe_name(filename).rsplit(".", 1)[0], uploaded_by=user.id if user else None)
    db.add(doc)
    db.flush()
    log(db, case.id, "Uploaded", f"{doc.filename} ({len(data) // 1024 or 1} KB)", kind="upload", user=user, doc_code=doc.code)
    return doc
