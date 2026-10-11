"""Background document pipeline.

Steps (mirrored in the UI): Uploading -> Reading text (OCR) -> Finding dates and events ->
Linking source sentences -> Checking references to other documents -> Ready for review.

A single worker processes documents one at a time, so flag recomputation never races.
"""
from __future__ import annotations

import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from ..ai import tasks as ai_tasks
from ..ai.groq import AIUnavailable
from ..config import settings
from ..db import SessionLocal
from ..flagging.engine import recompute
from ..models import Case, DocReference, Document, Event, Page
from ..parsing.analyze import analyze
from ..parsing.classify import DOC_TYPES, TEMPLATES_ALL, Classification, classify, document_date, identifiers, make_title
from ..parsing.sentences import normalize_ws
from ..parsing.text_extract import ExtractionError, extract_pages
from .audit import log, next_code

logger = logging.getLogger(__name__)
STEPS = ["Uploading", "Reading text (OCR)", "Finding dates and events", "Linking source sentences", "Checking references to other documents", "Ready for review"]
KIND_PREFIX = {"event": "E", "hearing": "H", "deadline": "L"}

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="casecompass-pipeline")


def submit(doc_id: int) -> None:
    _executor.submit(_safe_process, doc_id)


def _safe_process(doc_id: int) -> None:
    db = SessionLocal()
    try:
        process_document(db, doc_id)
    except Exception as e:  # noqa: BLE001 - keep the worker alive and record the failure
        logger.error("Processing failed for document %s: %s", doc_id, traceback.format_exc())
        db.rollback()
        doc = db.get(Document, doc_id)
        if doc:
            doc.status, doc.error = "failed", str(e)[:500]
            log(db, doc.case_id, "Processing failed", f"{doc.filename}: {doc.error}", kind="extract", doc_code=doc.code)
            db.commit()
    finally:
        db.close()


def _step(db: Session, doc: Document, n: int) -> None:
    doc.step, doc.status = n, "processing"
    db.commit()


def process_document(db: Session, doc_id: int) -> Document:
    doc = db.get(Document, doc_id)
    case = db.get(Case, doc.case_id)

    # 1. read text (text layer or OCR)
    _step(db, doc, 1)
    try:
        pages, fmt = extract_pages(Path(doc.stored_path))
    except ExtractionError as e:
        doc.status, doc.error = "failed", str(e)
        log(db, case.id, "Processing failed", f"{doc.filename}: {e}", kind="extract", doc_code=doc.code)
        db.commit()
        return doc
    db.query(Page).filter(Page.document_id == doc.id).delete()
    for p in pages:
        db.add(Page(document_id=doc.id, page_no=p.page_no, text=p.text, method=p.method, confidence=p.confidence, word_conf=p.words))
    ocr = [p.confidence for p in pages if p.method in ("ocr", "mixed") and p.confidence is not None]
    doc.pages_count, doc.format_label = len(pages), fmt
    all_ocr = all(p.method == "ocr" for p in pages)
    doc.method = "ocr" if all_ocr else "mixed" if any(p.method != "text" for p in pages) else "text"
    doc.ocr_confidence = round(sum(ocr) / len(ocr), 1) if ocr else None
    if not any(p.text.strip() for p in pages):
        doc.status, doc.error = "failed", "No readable text was found. Try a clearer scan (300 dpi, flat page, good light)."
        log(db, case.id, "Processing failed", f"{doc.filename}: no readable text", kind="extract", doc_code=doc.code)
        db.commit()
        return doc

    # classify (rules first, AI only when unsure), identifiers, document date, title
    first = pages[0].text
    c = classify(first, doc.filename, case.case_type)
    ai_used = False
    if c.confidence < 0.45 and settings.ai_available:
        try:
            out = ai_tasks.classify_document(first, doc.filename, DOC_TYPES, TEMPLATES_ALL)
            c = Classification(out["doc_type"], out.get("template"), float(out.get("confidence") or 0.5))
            ai_used = True
        except AIUnavailable:
            pass
    c.identifiers = identifiers(first)
    c.doc_date = document_date(first, c.doc_type)
    c.title = make_title(c, first, doc.filename)
    doc.doc_type, doc.template_name, doc.type_confidence = c.doc_type, c.template, c.confidence
    doc.identifiers, doc.doc_date, doc.title = c.identifiers, c.doc_date, c.title

    # 2. dates, events, references, quarantine
    _step(db, doc, 2)
    a = analyze(pages, doc_code=doc.code, doc_type=c.doc_type, doc_date=c.doc_date, doc_title=c.title)
    ai_used = ai_used or a.ai_used

    # 3. link every item to its source sentence and store it
    _step(db, doc, 3)
    db.query(Event).filter(Event.document_id == doc.id).delete()
    page_text = {p.page_no: normalize_ws(p.text) for p in pages}
    stored_events = []
    for ev in a.events:
        if normalize_ws(ev.quote) not in page_text.get(ev.page, ""):
            a.rejected.append({"text": ev.title, "reason": "No exact source sentence; not added."})
            continue
        e = Event(case_id=case.id, document_id=doc.id, code=next_code(db, case, KIND_PREFIX[ev.kind]), page=ev.page, quote=ev.quote,
                  date=ev.date, date_text=ev.date_text, date_source=ev.date_source, kind=ev.kind, title=ev.title[:300], party=ev.party,
                  event_key=ev.event_key, signature=ev.signature, confidence=ev.confidence, method=ev.method)
        db.add(e)
        stored_events.append(e)

    # 4. references to other documents
    _step(db, doc, 4)
    db.query(DocReference).filter(DocReference.document_id == doc.id).delete()
    for r in a.references:
        db.add(DocReference(case_id=case.id, document_id=doc.id, page=r["page"], quote=r["quote"], label=r["label"], norm=r["norm"],
                            ref_kind=r["kind"], ref_date=date.fromisoformat(r["ref_date"]) if r["ref_date"] else None, ref_number=r["number"]))
    doc.extraction = {
        "dates": a.dates, "quarantine": a.quarantine, "undated": a.undated, "rejected": a.rejected,
        "events": [{"code": e.code, "title": e.title, "kind": e.kind, "date": e.date.isoformat(), "page": e.page, "quote": e.quote, "method": e.method} for e in stored_events],
        "ai_error": a.ai_error,
    }
    doc.ai_used = ai_used
    doc.status, doc.step, doc.error = "done", 5, None
    doc.processed_at = datetime.now(timezone.utc)
    db.flush()

    method = "AI-assisted" if ai_used else "rule-based"
    log(db, case.id, "Extracted",
        f"{doc.title}: {len(stored_events)} dated entries, {len(a.references)} references, {len(a.quarantine)} dates held back"
        f"{f', {len(a.rejected)} rejected' if a.rejected else ''} ({method}{', OCR' if doc.method != 'text' else ''})",
        kind="extract", doc_code=doc.code)
    if a.ai_error and settings.ai_available:
        log(db, case.id, "AI unavailable", f"{doc.title}: rule-based extraction used ({a.ai_error[:120]})", kind="extract", doc_code=doc.code)

    # 5. recompute flags across the whole case
    recompute(db, case)
    db.commit()
    return doc
