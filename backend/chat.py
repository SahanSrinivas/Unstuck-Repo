"""WebSocket chat for live tutoring sessions + REST history endpoint."""
import os
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from bson import ObjectId
import jwt

from auth import get_current_user, _secret, JWT_ALGORITHM
from database import db

logger = logging.getLogger("unstuck.chat")

router = APIRouter(tags=["chat"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Connection manager ----------
class ConnectionManager:
    """In-memory pub/sub by session_id. Single-process; fine for single-pod deploys."""

    def __init__(self) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms.setdefault(session_id, set()).add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        if session_id in self._rooms:
            self._rooms[session_id].discard(ws)
            if not self._rooms[session_id]:
                self._rooms.pop(session_id, None)

    async def broadcast(self, session_id: str, payload: dict) -> None:
        text = json.dumps(payload)
        for ws in list(self._rooms.get(session_id, set())):
            try:
                await ws.send_text(text)
            except Exception as e:
                logger.warning("broadcast send failed: %s", e)

    def presence(self, session_id: str) -> dict:
        """Snapshot of who is online in a room, deduped by user_id+role."""
        seen: Dict[str, dict] = {}
        for s in self._rooms.get(session_id, set()):
            uid = getattr(s, "_user_id", None) or "anon"
            role = getattr(s, "_role", "student")
            name = getattr(s, "_user_name", "") or ""
            key = f"{uid}:{role}"
            seen[key] = {"user_id": uid, "role": role, "name": name}
        return {"online": list(seen.values())}


manager = ConnectionManager()


# ---------- WebSocket auth ----------
async def _user_from_ws(ws: WebSocket) -> dict | None:
    """Resolve user from access_token cookie. Returns None if invalid."""
    token = ws.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if user:
            user["_id"] = str(user["_id"])
            return user
    except Exception as e:
        logger.debug("ws auth failed: %s", e)
    return None


# ---------- REST: chat history ----------
@router.get("/sessions/{session_id}/messages")
async def list_messages(session_id: str, user: dict = Depends(get_current_user)) -> List[dict]:
    sess = await db.sessions.find_one({"id": session_id, "user_id": user["_id"]}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    cursor = db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("ts", 1)
    docs = await cursor.to_list(500)
    return docs


@router.get("/sessions/{session_id}/presence")
async def get_presence(session_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Snapshot of who's currently connected to the session room."""
    sess = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    is_owner = sess.get("user_id") == user["_id"]
    is_tutor = user.get("role") == "tutor" and sess.get("tutor_id") == user.get("tutor_id")
    is_admin = user.get("role") == "admin"
    if not (is_owner or is_tutor or is_admin):
        raise HTTPException(status_code=403, detail="Not your session")
    return manager.presence(session_id)


# ---------- WebSocket: live chat ----------
@router.websocket("/ws/sessions/{session_id}")
async def session_chat(ws: WebSocket, session_id: str) -> None:
    user = await _user_from_ws(ws)
    if not user:
        await ws.accept()
        await ws.close(code=4401)
        return

    # Owner check: student owns the session OR tutor is assigned to it OR user is admin
    sess = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not sess:
        await ws.accept()
        await ws.close(code=4404)
        return

    role = "student"
    if user.get("role") == "admin":
        role = "admin"
    elif user.get("role") == "tutor" and sess.get("tutor_id") == user.get("tutor_id"):
        role = "tutor"
    elif sess.get("user_id") == user["_id"]:
        role = "student"
    else:
        await ws.accept()
        await ws.close(code=4403)
        return

    ws._role = role  # type: ignore[attr-defined]
    ws._user_id = user["_id"]  # type: ignore[attr-defined]
    ws._user_name = user.get("name", "")  # type: ignore[attr-defined]
    await manager.connect(session_id, ws)

    # Send history on connect
    history = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("ts", 1).to_list(500)
    try:
        await ws.send_text(json.dumps({"type": "history", "messages": history}))
        await ws.send_text(json.dumps({"type": "presence", **manager.presence(session_id)}))
    except Exception as e:
        logger.warning("history send failed: %s", e)

    # Broadcast that someone joined (excluding the joiner gets the same snapshot above)
    await manager.broadcast(session_id, {"type": "presence", **manager.presence(session_id)})

    # Demo: tutor auto-reply on first user message (since we don't have real tutors connecting)
    if not history:
        # Only seed canned intro if no real tutor is on the call yet
        room = manager._rooms.get(session_id, set())
        has_human_tutor = any(getattr(s, "_role", None) == "tutor" for s in room)
        if not has_human_tutor:
            intro = {
                "id": f"m-{uuid.uuid4().hex[:10]}",
                "session_id": session_id,
                "user_id": "tutor",
                "role": "tutor",
                "author": sess.get("tutor_name", "Tutor"),
                "body": f"Hi — I'm {sess.get('tutor_name', 'your tutor')}. I read your doubt. What have you tried so far?",
                "ts": _now(),
            }
            await db.chat_messages.insert_one(dict(intro))
            await manager.broadcast(session_id, {"type": "message", "message": intro})

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            body = (data.get("body") or "").strip()
            if not body:
                continue
            msg = {
                "id": f"m-{uuid.uuid4().hex[:10]}",
                "session_id": session_id,
                "user_id": user["_id"],
                "role": "tutor" if role == "tutor" else "you",
                "author": user.get("name", "User"),
                "body": body[:2000],
                "ts": _now(),
            }
            await db.chat_messages.insert_one(dict(msg))
            await manager.broadcast(session_id, {"type": "message", "message": msg})

            # Demo auto-reply only when sender is student AND no real tutor is present
            if role == "student":
                room = manager._rooms.get(session_id, set())
                has_human_tutor = any(getattr(s, "_role", None) == "tutor" for s in room)
                if not has_human_tutor:
                    reply_body = _demo_tutor_reply(body)
                    if reply_body:
                        reply = {
                            "id": f"m-{uuid.uuid4().hex[:10]}",
                            "session_id": session_id,
                            "user_id": "tutor",
                            "role": "tutor",
                            "author": sess.get("tutor_name", "Tutor"),
                            "body": reply_body,
                            "ts": _now(),
                        }
                        await db.chat_messages.insert_one(dict(reply))
                        await manager.broadcast(session_id, {"type": "message", "message": reply})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("ws loop error: %s", e)
    finally:
        manager.disconnect(session_id, ws)
        # Notify remaining peers that presence changed
        try:
            await manager.broadcast(session_id, {"type": "presence", **manager.presence(session_id)})
        except Exception as e:
            logger.debug("post-disconnect broadcast failed: %s", e)


def _demo_tutor_reply(user_text: str) -> str:
    """Lightweight canned replies so the chat feels alive in demo mode."""
    t = user_text.lower()
    if any(k in t for k in ["recall", "retriev", "rag", "chunk"]):
        return "Got it — try lowering chunk overlap to 64 and re-running recall@5. What's your reranker?"
    if any(k in t for k in ["agent", "tool", "loop"]):
        return "Sounds like the planner is over-thinking. Can you share the tool spec? Look for arg-name mismatches first."
    if any(k in t for k in ["fine-tun", "lora", "train"]):
        return "Quick check: what's your LR and batch size? LoRA rank of 16 with alpha 32 is usually a safe default for 7-13B."
    if any(k in t for k in ["deploy", "vllm", "tgi", "infer", "gpu", "latency"]):
        return "vLLM continuous batching usually wins here. What model and what's your p95 right now?"
    return "Walk me through what you've already tried — I want to avoid repeating the obvious checks."
