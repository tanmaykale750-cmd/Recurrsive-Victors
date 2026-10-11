from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..flagging.engine import recompute
from ..models import Case, DocReference, Document, User
from ..security import current_user, current_user_or_query_token
from ..services import pipeline
from ..services.audit import log
from ..services.documents import create_document
from .deps import case_dep, owned_case

router = APIRouter(prefix="/api", tags=["documents"])


def _status(d: Document) -> dict:
    return {"id": d.id, "code": d.code, "name": d.filename, "title": d.title, "size": d.size, "status": d.status, "step": d.step,
            "error": d.error, "format": d.format_label, "type": d.doc_type}


def _doc(doc_id: int, user: User, db: Session) -> Document:
    d = db.get(Document, doc_id)
    if not d:
        raise HTTPException(404, "Document not found.")
    owned_case(d.case_id, user, db)
    return d


@router.post("/cases/{case_id}/documents", status_code=202)
async def upload(files: list[UploadFile] = File(...), case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not files:
        raise HTTPException(400, "Choose at least one file.")
    if len(files) > 30:
        raise HTTPException(400, "Upload at most 30 files at a time.")
    created = []
    for f in files:
        data = await f.read()
        created.append(create_document(db, case, f.filename or "document", data, user))
    db.commit()
    for d in created:
        pipeline.submit(d.id)
    return [_status(d) for d in created]


@router.get("/cases/{case_id}/documents")
def list_documents(case: Case = Depends(case_dep), db: Session = Depends(get_db)):
    return [_status(d) for d in db.query(Document).filter(Document.case_id == case.id).order_by(Document.id).all()]


@router.get("/documents/{doc_id}/extraction")
def extraction(doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _doc(doc_id, user, db)
    ex = d.extraction or {}
    others = {x.id: x for x in db.query(Document).filter(Document.case_id == d.case_id).all()}
    refs = []
    for r in db.query(DocReference).filter(DocReference.document_id == d.id).all():
        if r.matched_document_id == d.id:
            continue
        m = others.get(r.matched_document_id)
        refs.append({"text": r.label, "sentence": r.quote, "page": r.page, "inBundle": bool(m), "doc": m.code if m else None})
    meta = f"{d.code} · {d.doc_type} · {d.pages_count} page{'s' if d.pages_count != 1 else ''} · {d.format_label}"
    if d.ocr_confidence is not None:
        meta += f" · OCR {d.ocr_confidence:.0f}%"
    meta += " · AI-assisted" if d.ai_used else " · rule-based"
    return {
        "title": d.title, "subtitle": meta, "status": d.status,
        "dates": [{"text": x["text"], "sentence": x["sentence"], "page": x["page"], "confidence": x.get("confidence"), "status": x.get("status"), "reason": x.get("reason")}
                  for x in ex.get("dates", []) if x.get("status") != "heading"],
        "events": [{"text": e["title"], "sentence": e["quote"], "page": e["page"], "kind": e["kind"], "date": e["date"], "code": e["code"], "method": e.get("method")}
                   for e in ex.get("events", [])],
        "references": refs,
        "rejected": ex.get("rejected", []),
    }


@router.get("/documents/{doc_id}/file")
def file(doc_id: int, user: User = Depends(current_user_or_query_token), db: Session = Depends(get_db)):
    d = _doc(doc_id, user, db)
    p = Path(d.stored_path)
    if not p.exists():
        raise HTTPException(410, "The stored file is no longer available.")
    return FileResponse(p, media_type=d.mime, filename=d.filename, content_disposition_type="inline")


@router.post("/documents/{doc_id}/reprocess", status_code=202)
def reprocess(doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _doc(doc_id, user, db)
    d.status, d.step, d.error = "queued", 0, None
    log(db, d.case_id, "Re-processing", d.title or d.filename, kind="extract", user=user, doc_code=d.code)
    db.commit()
    pipeline.submit(d.id)
    return _status(d)


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = _doc(doc_id, user, db)
    case = db.get(Case, d.case_id)
    path, title, code = Path(d.stored_path), d.title or d.filename, d.code
    db.delete(d)
    db.flush()
    log(db, case.id, "Removed", f"{title} was removed from the bundle", kind="upload", user=user, doc_code=code)
    recompute(db, case)
    db.commit()
    path.unlink(missing_ok=True)
