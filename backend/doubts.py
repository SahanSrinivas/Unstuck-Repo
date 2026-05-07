"""Doubts, AI triage (Claude Sonnet 4.5), tutor matching, sessions."""
import os
import json
import uuid
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from models import (
    DoubtCreate, DoubtPublic, TriageResult, MatchRequest,
    TutorPublic, TutorApplyRequest, SessionPublic,
)
from auth import get_current_user
from seeds import TIERS

router = APIRouter(tags=["doubts"])


def _db():
    from server import db
    return db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Tutors ----------
@router.get("/tutors", response_model=List[TutorPublic])
async def list_tutors():
    cursor = _db().tutors.find({}, {"_id": 0})
    docs = await cursor.to_list(50)
    return [TutorPublic(**d) for d in docs]


@router.post("/tutors/apply")
async def apply_tutor(body: TutorApplyRequest):
    doc = body.model_dump()
    doc["id"] = f"app-{uuid.uuid4().hex[:8]}"
    doc["created_at"] = _now()
    doc["status"] = "pending"
    await _db().tutor_applications.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


# ---------- Doubts ----------
@router.post("/doubts", response_model=DoubtPublic)
async def create_doubt(body: DoubtCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": f"d-{uuid.uuid4().hex[:10]}",
        "user_id": user["_id"],
        "description": body.description,
        "code": body.code or "",
        "error_log": body.error_log or "",
        "topics": body.topics,
        "triage": None,
        "status": "draft",
        "created_at": _now(),
    }
    await _db().doubts.insert_one(doc)
    doc.pop("_id", None)
    return DoubtPublic(**doc)


@router.get("/doubts", response_model=List[DoubtPublic])
async def list_doubts(user: dict = Depends(get_current_user)):
    cursor = _db().doubts.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(100)
    return [DoubtPublic(**d) for d in docs]


@router.get("/doubts/{doubt_id}", response_model=DoubtPublic)
async def get_doubt(doubt_id: str, user: dict = Depends(get_current_user)):
    doc = await _db().doubts.find_one({"id": doubt_id, "user_id": user["_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Doubt not found")
    return DoubtPublic(**doc)


# ---------- AI Triage (Claude Sonnet 4.5) ----------
TRIAGE_SYSTEM = """You are an expert AI engineer helping debug RAG, agents, fine-tuning, and MLOps issues.
Reply ONLY in valid JSON with this exact schema:
{
  "answer": "<a concise, technically dense answer (max 250 words). Use markdown. Cite specific libraries/parameters when relevant.>",
  "confidence": <a float 0.0-1.0 — how confident you are this fully resolves their problem>,
  "suggested_tier": "<one of: quick, deep, working, project — pick based on complexity>"
}
Tier rules:
- quick (15min): single-question clarifications
- deep (30min): debug a specific failure
- working (45min): pair-programming through an implementation
- project (60min): broader architectural review
Talk to senior engineers — be concrete, never patronize. No emojis."""


async def _run_triage(description: str, code: str, error_log: str, topics: list) -> dict:
    """Call Claude Sonnet 4.5 via Emergent integrations. Returns dict matching schema."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        return {
            "answer": "AI triage is temporarily unavailable. A human tutor will pick this up.",
            "confidence": 0.0,
            "suggested_tier": "deep",
            "error": True,
        }

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"triage-{uuid.uuid4().hex[:8]}",
        system_message=TRIAGE_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    parts = [f"Topics: {', '.join(topics) if topics else 'unspecified'}",
             f"Description:\n{description}"]
    if code:
        parts.append(f"Code:\n```\n{code[:4000]}\n```")
    if error_log:
        parts.append(f"Error log:\n```\n{error_log[:2000]}\n```")
    user_msg = UserMessage(text="\n\n".join(parts))

    try:
        raw = await chat.send_message(user_msg)
    except Exception:
        return {
            "answer": "The AI couldn't take a first attempt right now. Match with a human tutor and they'll pick it up.",
            "confidence": 0.0,
            "suggested_tier": "deep",
            "error": True,
        }

    text = (raw or "").strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    try:
        data = json.loads(text)
        return {
            "answer": str(data.get("answer", "")).strip() or "No answer generated.",
            "confidence": float(data.get("confidence", 0.5)),
            "suggested_tier": data.get("suggested_tier", "deep") if data.get("suggested_tier") in TIERS else "deep",
            "error": False,
        }
    except Exception:
        # Fallback: return raw text with medium confidence
        return {
            "answer": text[:1500] if text else "The AI returned an empty response. Match with a human tutor.",
            "confidence": 0.55 if text else 0.0,
            "suggested_tier": "deep",
            "error": not bool(text),
        }


@router.post("/doubts/{doubt_id}/triage", response_model=TriageResult)
async def triage_doubt(doubt_id: str, user: dict = Depends(get_current_user)):
    doc = await _db().doubts.find_one({"id": doubt_id, "user_id": user["_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Doubt not found")
    if doc.get("triage"):
        t = doc["triage"]
        return TriageResult(doubt_id=doubt_id, **t)
    result = await _run_triage(doc["description"], doc.get("code", ""), doc.get("error_log", ""), doc.get("topics", []))
    await _db().doubts.update_one(
        {"id": doubt_id, "user_id": user["_id"]},
        {"$set": {"triage": result, "status": "triaged"}},
    )
    return TriageResult(doubt_id=doubt_id, **result)


# ---------- Match & Session creation ----------
@router.post("/doubts/{doubt_id}/match", response_model=SessionPublic)
async def match_tutor(doubt_id: str, body: MatchRequest, user: dict = Depends(get_current_user)):
    if body.tier not in TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    doubt = await _db().doubts.find_one({"id": doubt_id, "user_id": user["_id"]}, {"_id": 0})
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    tutor = None
    if body.tutor_id:
        tutor = await _db().tutors.find_one({"id": body.tutor_id}, {"_id": 0})
    if not tutor:
        # auto-match: pick a random available tutor whose specialty intersects topics
        topics_set = set([t.lower() for t in doubt.get("topics", [])])
        candidates = await _db().tutors.find({"available": True}, {"_id": 0}).to_list(50)
        scored = []
        for t in candidates:
            score = len(topics_set & set([s.lower() for s in t.get("specialties", [])])) + random.random() * 0.3
            scored.append((score, t))
        scored.sort(reverse=True, key=lambda x: x[0])
        tutor = scored[0][1] if scored else None
    if not tutor:
        raise HTTPException(status_code=503, detail="No tutors available")

    tier = TIERS[body.tier]
    sess = {
        "id": f"s-{uuid.uuid4().hex[:10]}",
        "user_id": user["_id"],
        "doubt_id": doubt_id,
        "tutor_id": tutor["id"],
        "tutor_name": tutor["name"],
        "topic": (doubt.get("topics") or ["General"])[0],
        "tier": body.tier,
        "duration_min": tier["duration_min"],
        "price": tier["price"],
        "status": "scheduled",
        "created_at": _now(),
        "summary": "",
    }
    await _db().sessions.insert_one(sess)
    await _db().doubts.update_one({"id": doubt_id}, {"$set": {"status": "matched"}})
    sess.pop("_id", None)
    return SessionPublic(**sess)


# ---------- Sessions ----------
@router.get("/sessions", response_model=List[SessionPublic])
async def list_sessions(user: dict = Depends(get_current_user)):
    cursor = _db().sessions.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(100)
    return [SessionPublic(**d) for d in docs]


@router.get("/sessions/{session_id}", response_model=SessionPublic)
async def get_session(session_id: str, user: dict = Depends(get_current_user)):
    doc = await _db().sessions.find_one({"id": session_id, "user_id": user["_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionPublic(**doc)


@router.post("/sessions/{session_id}/end")
async def end_session(session_id: str, user: dict = Depends(get_current_user)):
    res = await _db().sessions.update_one(
        {"id": session_id, "user_id": user["_id"]},
        {"$set": {"status": "completed", "summary": "Session completed by student."}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


# ---------- AI Insight (dashboard card) ----------
@router.get("/insights")
async def get_insight(user: dict = Depends(get_current_user)):
    cursor = _db().doubts.find({"user_id": user["_id"]}, {"_id": 0, "topics": 1, "description": 1}).sort("created_at", -1)
    docs = await cursor.to_list(5)
    if not docs:
        return {
            "title": "Submit your first doubt",
            "body": "Start with a concrete question. The AI tries first — free.",
            "tag": "Getting started",
        }
    flat_topics = [t for d in docs for t in (d.get("topics") or [])]
    if flat_topics:
        most = max(set(flat_topics), key=flat_topics.count)
        return {
            "title": f"You've been working on {most}",
            "body": f"Based on your last {len(docs)} doubts, revisiting evaluation patterns for {most.lower()} could compound your progress. A 30-min Deep Dive is usually enough.",
            "tag": "Pattern detected",
        }
    return {
        "title": "Keep momentum",
        "body": "Small unblocking sessions stack up. Submit your next doubt while it's fresh.",
        "tag": "Tip",
    }
