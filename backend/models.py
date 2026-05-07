"""Pydantic models for Unstuck."""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str = "student"
    created_at: str


# ---------- Doubt ----------
class DoubtCreate(BaseModel):
    description: str = Field(min_length=5, max_length=4000)
    code: Optional[str] = ""
    error_log: Optional[str] = ""
    topics: List[str] = Field(default_factory=list)


class TriageRequest(BaseModel):
    doubt_id: str


class TriageResult(BaseModel):
    doubt_id: str
    answer: str
    confidence: float
    suggested_tier: str  # quick | deep | working | project


class MatchRequest(BaseModel):
    doubt_id: str
    tier: str  # quick | deep | working | project
    tutor_id: Optional[str] = None


class DoubtPublic(BaseModel):
    id: str
    user_id: str
    description: str
    code: Optional[str] = ""
    error_log: Optional[str] = ""
    topics: List[str] = []
    triage: Optional[Dict[str, Any]] = None
    status: str = "draft"  # draft | triaged | matched | resolved
    created_at: str


# ---------- Tutor ----------
class TutorPublic(BaseModel):
    id: str
    name: str
    avatar: str
    specialties: List[str]
    rating: float
    response_time_min: int
    rate_hint: str
    bio: str
    available: bool = True


class TutorApplyRequest(BaseModel):
    name: str
    email: EmailStr
    specialties: List[str]
    years_experience: int
    linkedin: Optional[str] = ""
    pitch: str


# ---------- Sessions ----------
class SessionPublic(BaseModel):
    id: str
    user_id: str
    doubt_id: str
    tutor_id: str
    tutor_name: str
    topic: str
    tier: str
    duration_min: int
    price: float
    status: str  # scheduled | active | completed | cancelled
    created_at: str
    summary: Optional[str] = ""


# ---------- Payments ----------
class CheckoutRequest(BaseModel):
    doubt_id: str
    tier: str
    origin_url: str


class CheckoutResponse(BaseModel):
    url: str
    session_id: str
