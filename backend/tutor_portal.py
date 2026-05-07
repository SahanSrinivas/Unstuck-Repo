"""Tutor portal endpoints — separate dashboard for users with role=tutor."""
import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db

router = APIRouter(prefix="/tutor", tags=["tutor"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_tutor(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("tutor", "admin"):
        raise HTTPException(status_code=403, detail="Tutor access required")
    return user


@router.get("/queue")
async def tutor_queue(tutor: dict = Depends(_require_tutor)) -> List[dict]:
    """Open doubts (status='matched' but session.tutor_id is mine OR unmatched)."""
    tutor_id = tutor.get("tutor_id")
    q = {"status": "scheduled"}
    if tutor_id:
        q["tutor_id"] = tutor_id
    cursor = db.sessions.find(q, {"_id": 0}).sort("created_at", -1)
    sessions = await cursor.to_list(200)
    # enrich with doubt body
    out = []
    for s in sessions:
        d = await db.doubts.find_one({"id": s["doubt_id"]}, {"_id": 0, "description": 1, "topics": 1, "code": 1})
        out.append({**s, "doubt": d})
    return out


@router.get("/sessions")
async def tutor_sessions(tutor: dict = Depends(_require_tutor)) -> List[dict]:
    """All sessions for this tutor (any status)."""
    tutor_id = tutor.get("tutor_id")
    if not tutor_id:
        return []
    cursor = db.sessions.find({"tutor_id": tutor_id}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@router.post("/sessions/{session_id}/accept")
async def accept_session(session_id: str, tutor: dict = Depends(_require_tutor)) -> dict:
    """Tutor explicitly accepts a session (transitions scheduled → active)."""
    tutor_id = tutor.get("tutor_id")
    if not tutor_id:
        raise HTTPException(status_code=400, detail="No tutor profile linked to user")
    sess = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.get("tutor_id") != tutor_id and tutor.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your session")
    await db.sessions.update_one({"id": session_id}, {"$set": {"status": "active", "accepted_at": _now()}})
    return {"ok": True}


@router.get("/profile")
async def tutor_profile(tutor: dict = Depends(_require_tutor)) -> dict:
    tid = tutor.get("tutor_id")
    if not tid:
        raise HTTPException(status_code=404, detail="No tutor profile")
    t = await db.tutors.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tutor not found")
    # earnings (paid, non-refunded sessions where I'm tutor)
    sessions = await db.sessions.find({"tutor_id": tid, "status": "completed", "resolution": {"$ne": "refunded"}}, {"_id": 0, "price": 1}).to_list(500)
    earnings = sum((s.get("price", 0) or 0) for s in sessions) * 0.7  # 70% take-home
    return {**t, "earnings_total": round(earnings, 2), "completed_sessions": len(sessions)}
