from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Case, User
from ..schemas import CaseIn, CasePatch
from ..security import current_user
from ..services.audit import log
from ..services.bundle import _short, build_bundle, case_summary
from .deps import case_dep

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("")
def list_cases(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [case_summary(db, c) for c in db.query(Case).filter(Case.owner_id == user.id).order_by(Case.created_at).all()]


@router.post("", status_code=201)
def create_case(body: CaseIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = Case(owner_id=user.id, title=" ".join(body.title.split()), short_title=_short(body.title), number=body.number.strip(),
             court=body.court.strip(), case_type=body.case_type)
    db.add(c)
    db.flush()
    log(db, c.id, "Case created", f"{c.title} ({body.case_type})", kind="system", user=user)
    db.commit()
    return case_summary(db, c)


@router.get("/{case_id}/bundle")
def bundle(case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    return build_bundle(db, case, user)


@router.patch("/{case_id}")
def update_case(body: CasePatch, case: Case = Depends(case_dep), user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    if "title" in data:
        case.title, case.short_title = " ".join(data["title"].split()), _short(data["title"])
    if "number" in data:
        case.number = data["number"].strip()
    if "court" in data:
        case.court = data["court"].strip()
    if "status" in data and data["status"] != case.status:
        case.status = data["status"]
        case.closed_at = date.today() if case.status == "closed" else None
        log(db, case.id, "Case closed" if case.status == "closed" else "Case reopened", case.title, user=user)
    db.commit()
    return case_summary(db, case)


@router.delete("/{case_id}", status_code=204)
def delete_case(case: Case = Depends(case_dep), db: Session = Depends(get_db)):
    db.delete(case)
    db.commit()
