from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..db import get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn, SettingsIn
from ..security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "settings": u.settings or {}}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "An account with this email already exists. Sign in instead.")
    u = User(name=body.name, phone=body.phone, email=email, password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    return {"token": create_token(u.id), "user": user_out(u)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == body.email.lower()).first()
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Email or password is incorrect.")
    return {"token": create_token(u.id), "user": user_out(u)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.put("/me/settings")
def update_settings(body: SettingsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = dict(user.settings or {})
    s.update({k: v for k, v in body.model_dump().items() if v is not None})
    if s.get("amber", 30) <= s.get("red", 7):
        s["amber"] = s.get("red", 7) + 1
    user.settings = s
    flag_modified(user, "settings")
    db.commit()
    return user_out(user)
