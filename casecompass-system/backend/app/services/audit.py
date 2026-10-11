"""Activity log and per-case codes."""
from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..models import Activity, Case, User


def log(db: Session, case_id: int, action: str, detail: str = "", *, kind: str = "system", user: User | None = None,
        issue_code: str | None = None, doc_code: str | None = None) -> Activity:
    a = Activity(case_id=case_id, user_id=user.id if user else None, actor_name=user.name if user else "CaseCompass",
                 action=action, detail=detail[:2000], kind=kind, issue_code=issue_code, doc_code=doc_code)
    db.add(a)
    return a


def next_code(db: Session, case: Case, prefix: str) -> str:
    """Sequential, human-friendly code per case: D01, E01, C01 ... (row-locked on PostgreSQL)."""
    locked = db.query(Case).filter(Case.id == case.id).with_for_update().one()
    counters = dict(locked.counters or {})
    n = counters.get(prefix, 0) + 1
    counters[prefix] = n
    locked.counters = counters
    flag_modified(locked, "counters")
    db.flush()
    return f"{prefix}{n:02d}"
