from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Case, User
from ..security import current_user


def owned_case(case_id: int, user: User, db: Session) -> Case:
    case = db.get(Case, case_id)
    if not case or case.owner_id != user.id:
        raise HTTPException(404, "Case not found.")
    return case


def case_dep(case_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Case:
    return owned_case(case_id, user, db)
