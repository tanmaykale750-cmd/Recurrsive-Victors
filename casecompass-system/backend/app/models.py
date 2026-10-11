"""ORM models.

Design principle: extracted records (documents, pages, events, references) are
immutable evidence. Human decisions (resolutions, corrections, notes, status)
are stored separately and never overwrite what was extracted, so the original
record and the full history of who decided what can always be shown.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, JSONType


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    settings: Mapped[dict] = mapped_column(JSONType, default=lambda: {"red": 7, "amber": 30, "showTerms": True})
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    short_title: Mapped[str] = mapped_column(String(120), default="")
    number: Mapped[str] = mapped_column(String(120), default="")
    court: Mapped[str] = mapped_column(String(200), default="")
    case_type: Mapped[str] = mapped_column(String(20), default="civil")  # civil | criminal | tribunal
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | closed
    closed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: per-case counters for human-friendly codes (D01, E01, C01 ...)
    counters: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    documents: Mapped[list[Document]] = relationship(back_populates="case", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("case_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(10))
    filename: Mapped[str] = mapped_column(String(300))
    stored_path: Mapped[str] = mapped_column(String(500))
    mime: Mapped[str] = mapped_column(String(100), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    format_label: Mapped[str] = mapped_column(String(40), default="")  # PDF | Scanned PDF | Scanned image | Word
    doc_type: Mapped[str] = mapped_column(String(40), default="Unclassified")
    template_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    type_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    title: Mapped[str] = mapped_column(String(300), default="")
    doc_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    identifiers: Mapped[dict] = mapped_column(JSONType, default=dict)
    pages_count: Mapped[int] = mapped_column(Integer, default=0)
    method: Mapped[str] = mapped_column(String(10), default="")  # text | ocr | mixed
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | processing | done | failed
    step: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_used: Mapped[bool] = mapped_column(Boolean, default=False)
    #: summary shown in the extraction drawer (dates, events, references, rejected)
    extraction: Mapped[dict] = mapped_column(JSONType, default=dict)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    case: Mapped[Case] = relationship(back_populates="documents")
    pages: Mapped[list[Page]] = relationship(back_populates="document", cascade="all, delete-orphan", order_by="Page.page_no")


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    page_no: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    method: Mapped[str] = mapped_column(String(10), default="text")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    #: OCR word spans: [[start, end, confidence], ...] over `text`
    word_conf: Mapped[list] = mapped_column(JSONType, default=list)

    document: Mapped[Document] = relationship(back_populates="pages")


class Event(Base):
    """One dated statement extracted from one sentence of one document."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(12))
    page: Mapped[int] = mapped_column(Integer)
    quote: Mapped[str] = mapped_column(Text)
    date: Mapped[date] = mapped_column(Date)
    date_text: Mapped[str] = mapped_column(String(80), default="")
    date_source: Mapped[str] = mapped_column(String(20), default="sentence")  # sentence | order_date
    kind: Mapped[str] = mapped_column(String(12), default="event")  # event | hearing | deadline
    title: Mapped[str] = mapped_column(String(300))
    party: Mapped[str | None] = mapped_column(String(80), nullable=True)
    event_key: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    #: set by the flagging engine: events describing the same real-world step share a cluster
    cluster_key: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    signature: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=100.0)
    method: Mapped[str] = mapped_column(String(10), default="rule")  # rule | ai
    fulfilled_by: Mapped[str | None] = mapped_column(String(12), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DocReference(Base):
    """A mention of another document (an order, an application, an exhibit ...)."""

    __tablename__ = "doc_references"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    page: Mapped[int] = mapped_column(Integer)
    quote: Mapped[str] = mapped_column(Text)
    label: Mapped[str] = mapped_column(String(200))
    norm: Mapped[str] = mapped_column(String(200), index=True)
    ref_kind: Mapped[str] = mapped_column(String(30))  # order | notice | application | exhibit | report | other
    ref_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    ref_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    matched_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    method: Mapped[str] = mapped_column(String(10), default="rule")


class Issue(Base):
    """Anything that needs a human: conflicts, missing documents, quarantined dates, gaps."""

    __tablename__ = "issues"
    __table_args__ = (UniqueConstraint("case_id", "fingerprint"), UniqueConstraint("case_id", "code"))

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(12))
    type: Mapped[str] = mapped_column(String(20))  # conflict | missing | quarantine | undated | sequence
    fingerprint: Mapped[str] = mapped_column(String(300))
    title: Mapped[str] = mapped_column(String(300))
    why: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | in_review | resolved
    #: False once the condition disappears from the record (e.g. the missing document is uploaded)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Resolution(Base):
    """A reviewer decision on an issue. Reopening withdraws it; nothing is deleted."""

    __tablename__ = "resolutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(30))
    data: Mapped[dict] = mapped_column(JSONType, default=dict)
    reason: Mapped[str] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EventCorrection(Base):
    """A reviewer correction to an extracted event's date. The original stays on the Event."""

    __tablename__ = "event_corrections"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    event_code: Mapped[str] = mapped_column(String(12), index=True)
    original_date: Mapped[date] = mapped_column(Date)
    corrected_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    target_type: Mapped[str] = mapped_column(String(10))  # issue | event
    target_code: Mapped[str] = mapped_column(String(12), index=True)
    text: Mapped[str] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Activity(Base):
    """Append-only audit log for a case."""

    __tablename__ = "activity"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(120), default="CaseCompass")
    action: Mapped[str] = mapped_column(String(60))
    detail: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(20), default="system")  # upload | extract | flag | status | note | correction | system
    issue_code: Mapped[str | None] = mapped_column(String(12), nullable=True)
    doc_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Reminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (UniqueConstraint("case_id", "user_id", "event_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    event_code: Mapped[str] = mapped_column(String(12))
    on: Mapped[bool] = mapped_column(Boolean, default=True)
    days: Mapped[list] = mapped_column(JSONType, default=lambda: [7, 1])
