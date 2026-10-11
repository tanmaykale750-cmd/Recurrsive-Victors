"""Request and response schemas."""
from __future__ import annotations

import re
import datetime as dt
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

PHONE_RE = re.compile(r"^\+?[0-9][0-9\s\-()]{8,18}$")


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not re.search(r"[A-Za-zऀ-ॿ]", v):
            raise ValueError("Enter your name.")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        v = v.strip()
        digits = re.sub(r"\D", "", v)
        if not PHONE_RE.match(v) or not 10 <= len(digits) <= 15:
            raise ValueError("Enter a valid phone number with 10 to 15 digits, e.g. +91 98200 11223.")
        return v

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Use at least 8 characters with letters and numbers.")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SettingsIn(BaseModel):
    red: int | None = Field(default=None, ge=1, le=60)
    amber: int | None = Field(default=None, ge=2, le=180)
    showTerms: bool | None = None


class CaseIn(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    number: str = Field(default="", max_length=120)
    court: str = Field(default="", max_length=200)
    case_type: Literal["civil", "criminal", "tribunal"] = "civil"


class CasePatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=300)
    number: str | None = None
    court: str | None = None
    status: Literal["active", "closed"] | None = None


class StatusIn(BaseModel):
    status: Literal["open", "in_review"]


class ResolveIn(BaseModel):
    type: Literal["corrected", "confirmed", "dismissed", "requested", "linked", "not_required", "dated", "acknowledged"]
    reason: str = Field(min_length=3, max_length=2000)
    date: dt.date | None = None
    basis: str | None = Field(default=None, max_length=10)
    kind: Literal["event", "deadline", "hearing"] | None = None
    doc: str | None = Field(default=None, max_length=200)


class NoteIn(BaseModel):
    target_type: Literal["issue", "event"]
    target_code: str = Field(min_length=2, max_length=12)
    text: str = Field(min_length=1, max_length=4000)


class CorrectionIn(BaseModel):
    date: dt.date
    reason: str = Field(min_length=3, max_length=2000)


class ReminderIn(BaseModel):
    on: bool
    days: list[int] = Field(default_factory=lambda: [7, 1])

    @field_validator("days")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        v = sorted({d for d in v if 0 <= d <= 60}, reverse=True)
        return v or [1]
