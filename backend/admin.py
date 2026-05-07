"""Admin endpoints: tutor application review + refund audit."""
import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from database import db

router = APIRouter(prefix="/admin", tags=["admin"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------- Tutor applications ----------
class ApplicationDecision(BaseModel):
    decision: str  # approve | reject
    note: Optional[str] = ""


@router.get("/applications")
async def list_applications(
    status: Optional[str] = None,
    _: dict = Depends(_require_admin),
) -> List[dict]:
    q: dict = {}
    if status:
        q["status"] = status
    cursor = db.tutor_applications.find(q, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@router.post("/applications/{application_id}/decide")
async def decide_application(
    application_id: str,
    body: ApplicationDecision,
    admin: dict = Depends(_require_admin),
) -> dict:
    if body.decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="decision must be 'approve' or 'reject'")
    app_doc = await db.tutor_applications.find_one({"id": application_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")

    new_status = "approved" if body.decision == "approve" else "rejected"
    await db.tutor_applications.update_one(
        {"id": application_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": admin.get("email", "admin"),
            "reviewed_at": _now(),
            "review_note": body.note or "",
        }},
    )

    # On approve, create a tutor record AND a tutor user (if email matches an existing user, promote them)
    if body.decision == "approve":
        avatar = "".join(p[0] for p in (app_doc.get("name", "") or "AT").split()[:2]).upper() or "AT"
        tutor_id = f"tutor-{application_id.split('-')[-1]}"
        await db.tutors.update_one(
            {"id": tutor_id},
            {"$set": {
                "id": tutor_id,
                "name": app_doc.get("name", "Tutor"),
                "avatar": avatar,
                "specialties": app_doc.get("specialties") or [],
                "rating": 4.7,
                "response_time_min": 5,
                "rate_hint": "$48/hr",
                "bio": app_doc.get("pitch", "")[:200] or "Verified Unstuck tutor.",
                "available": True,
                "email": app_doc.get("email"),
                "created_at": _now(),
            }},
            upsert=True,
        )
        # If user exists with that email, promote to tutor role
        if app_doc.get("email"):
            await db.users.update_one(
                {"email": app_doc["email"].lower()},
                {"$set": {"role": "tutor", "tutor_id": tutor_id}},
            )

    return {"ok": True, "status": new_status}


# ---------- Refund audit queue ----------
@router.get("/refunds")
async def list_refunds(_: dict = Depends(_require_admin)) -> List[dict]:
    cursor = db.sessions.find(
        {"resolution": "refunded"}, {"_id": 0}
    ).sort("created_at", -1)
    docs = await cursor.to_list(200)
    # Enrich with student email
    out = []
    for d in docs:
        u = await db.users.find_one({"_id": __import__("bson").ObjectId(d["user_id"])}, {"_id": 0, "email": 1, "name": 1}) if d.get("user_id") else None
        out.append({**d, "student_email": (u or {}).get("email"), "student_name": (u or {}).get("name")})
    return out


@router.get("/stats")
async def admin_stats(_: dict = Depends(_require_admin)) -> dict:
    pending = await db.tutor_applications.count_documents({"status": "pending"})
    approved = await db.tutor_applications.count_documents({"status": "approved"})
    rejected = await db.tutor_applications.count_documents({"status": "rejected"})
    total_users = await db.users.count_documents({})
    total_sessions = await db.sessions.count_documents({})
    refunded = await db.sessions.count_documents({"resolution": "refunded"})
    return {
        "applications": {"pending": pending, "approved": approved, "rejected": rejected},
        "users": total_users,
        "sessions": total_sessions,
        "refunded_sessions": refunded,
    }
