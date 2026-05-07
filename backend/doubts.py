"""Doubts, AI triage (Claude Sonnet 4.5), tutor matching, sessions."""
import os
import json
import uuid
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from models import (
    DoubtCreate, DoubtPublic, TriageResult, MatchRequest,
    TutorPublic, TutorApplyRequest, SessionPublic,
    ResolveSessionRequest, BillingItem,
)
from auth import get_current_user
from seeds import TIERS
from email_service import (
    send_doubt_matched, send_session_summary,
    send_refund_confirmation, send_tutor_application_received,
)

router = APIRouter(tags=["doubts"])

_rng = secrets.SystemRandom()


def _db():
    from database import db
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
    try:
        await send_tutor_application_received(body.email, body.name)
    except Exception:
        pass
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
            score = len(topics_set & set([s.lower() for s in t.get("specialties", [])])) + _rng.random() * 0.3
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
    # Notify student by email
    try:
        await send_doubt_matched(user["email"], user.get("name", "there"), tutor["name"], sess["topic"], sess["id"])
    except Exception:
        pass
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


@router.post("/sessions/{session_id}/resolve")
async def resolve_session(session_id: str, body: ResolveSessionRequest, user: dict = Depends(get_current_user)):
    if body.resolution not in ("resolved", "refunded"):
        raise HTTPException(status_code=400, detail="resolution must be 'resolved' or 'refunded'")
    sess = await _db().sessions.find_one({"id": session_id, "user_id": user["_id"]}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    update = {
        "status": "completed",
        "resolution": body.resolution,
        "summary": body.note or ("Marked resolved by student." if body.resolution == "resolved" else "Auto-refund requested."),
    }
    await _db().sessions.update_one({"id": session_id, "user_id": user["_id"]}, {"$set": update})
    if body.resolution == "refunded":
        # Mark only the most recent matching paid/pending payment txn as refunded (idempotent).
        match = await _db().payment_transactions.find_one(
            {
                "user_id": user["_id"],
                "doubt_id": sess["doubt_id"],
                "tier": sess["tier"],
                "refunded": {"$ne": True},
            },
            {"_id": 0, "session_id": 1},
            sort=[("created_at", -1)],
        )
        if match and match.get("session_id"):
            await _db().payment_transactions.update_one(
                {"session_id": match["session_id"]},
                {"$set": {"refunded": True, "refunded_at": _now()}},
            )
        try:
            await send_refund_confirmation(user["email"], user.get("name", "there"), float(sess.get("price", 0) or 0), sess.get("topic", "AI engineering"))
        except Exception:
            pass
    else:
        # Resolved: kick off AI summary + email asynchronously so the API stays snappy.
        import asyncio
        asyncio.create_task(_summarize_and_email(session_id, user, sess, body.note or ""))
    return {"ok": True, "resolution": body.resolution}


# ---------- AI session summary (Sonnet 4.5) ----------
SUMMARY_SYSTEM = """You are an expert AI engineer summarizing a 1:1 tutoring session.
Output ONLY plain text (no JSON, no markdown headings, no preamble) — 3 to 5 short sentences:
1) The original problem in one line.
2) The root cause or key insight.
3) The concrete fix or next steps the student should take.
Be technically dense, no fluff, no emojis. ~80-130 words max."""


async def _generate_session_summary(doubt: dict, messages: list) -> str:
    """Call Claude Sonnet 4.5 via Emergent integrations to summarize a session.
    Returns plain text. Empty string on failure."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        return ""
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return ""
    chat = LlmChat(
        api_key=api_key,
        session_id=f"summary-{uuid.uuid4().hex[:8]}",
        system_message=SUMMARY_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    transcript_lines = []
    for m in messages[-40:]:  # last 40 messages is plenty
        author = m.get("author") or m.get("role") or "user"
        body = (m.get("body") or "").strip()
        if body:
            transcript_lines.append(f"{author}: {body[:600]}")
    parts = [
        f"Topics: {', '.join(doubt.get('topics') or []) or 'unspecified'}",
        f"Original doubt:\n{(doubt.get('description') or '')[:1500]}",
    ]
    if transcript_lines:
        parts.append("Transcript:\n" + "\n".join(transcript_lines))
    else:
        parts.append("Transcript: (no chat messages logged)")

    try:
        raw = await chat.send_message(UserMessage(text="\n\n".join(parts)))
    except Exception:
        return ""
    return (raw or "").strip()[:1200]


async def _summarize_and_email(session_id: str, user: dict, sess: dict, student_note: str) -> None:
    """Background task: generate AI summary, persist on the session, and email the student."""
    try:
        doubt = await _db().doubts.find_one({"id": sess["doubt_id"]}, {"_id": 0}) or {}
        msgs = await _db().chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("ts", 1).to_list(200)
        ai_summary = await _generate_session_summary(doubt, msgs)
        final = ai_summary or (student_note.strip() or "Session resolved by student.")
        await _db().sessions.update_one(
            {"id": session_id},
            {"$set": {"summary": final, "ai_summary": ai_summary or "", "summarized_at": _now()}},
        )
        try:
            await send_session_summary(
                user["email"], user.get("name", "there"),
                sess.get("tutor_name", "your tutor"),
                sess.get("topic", "AI engineering"),
                final, session_id,
            )
        except Exception:
            pass
    except Exception:
        # never let a background task crash the worker
        pass


# ---------- Saved tutors ----------
@router.get("/saved-tutors", response_model=List[TutorPublic])
async def list_saved(user: dict = Depends(get_current_user)):
    docs = await _db().saved_tutors.find({"user_id": user["_id"]}, {"_id": 0}).to_list(100)
    ids = [d["tutor_id"] for d in docs]
    if not ids:
        return []
    tutors = await _db().tutors.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)
    return [TutorPublic(**t) for t in tutors]


@router.post("/saved-tutors/{tutor_id}")
async def save_tutor(tutor_id: str, user: dict = Depends(get_current_user)):
    tutor = await _db().tutors.find_one({"id": tutor_id}, {"_id": 0})
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor not found")
    await _db().saved_tutors.update_one(
        {"user_id": user["_id"], "tutor_id": tutor_id},
        {"$set": {"user_id": user["_id"], "tutor_id": tutor_id, "saved_at": _now()}},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/saved-tutors/{tutor_id}")
async def unsave_tutor(tutor_id: str, user: dict = Depends(get_current_user)):
    await _db().saved_tutors.delete_one({"user_id": user["_id"], "tutor_id": tutor_id})
    return {"ok": True}


# ---------- Billing ----------
@router.get("/billing/transactions", response_model=List[BillingItem])
async def list_transactions(user: dict = Depends(get_current_user)):
    cursor = _db().payment_transactions.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(200)
    out: List[BillingItem] = []
    for d in docs:
        out.append(BillingItem(
            id=d.get("id", d.get("session_id", "")),
            session_id=d.get("session_id"),
            doubt_id=d.get("doubt_id"),
            tier=d.get("tier"),
            amount=float(d.get("amount", 0)),
            currency=d.get("currency", "usd"),
            payment_status=d.get("payment_status", "pending"),
            created_at=d.get("created_at", ""),
            refunded=bool(d.get("refunded", False)),
        ))
    return out


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
