"""Iteration 3 tests: WebSocket live chat + REST history + canned-reply logic."""
import asyncio
import json
import os
import uuid

import pytest
import requests
import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatus

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rag-agents-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


# ---------- helpers ----------
def _new_student():
    s = requests.Session()
    email = f"test.it3.{uuid.uuid4().hex[:8]}@unstuck.dev"
    pw = "Student123!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "TEST IT3"}, timeout=30)
    assert r.status_code == 200, r.text
    s.email = email          # type: ignore[attr-defined]
    s.password = pw          # type: ignore[attr-defined]
    return s


def _make_session(s, tutor_id="tutor-aria", tier="deep"):
    d = s.post(f"{API}/doubts", json={
        "description": "WS test doubt - rag pipeline help",
        "topics": ["RAG"],
    }, timeout=15).json()
    m = s.post(f"{API}/doubts/{d['id']}/match", json={
        "doubt_id": d["id"], "tier": tier, "tutor_id": tutor_id
    }, timeout=15)
    assert m.status_code == 200, m.text
    return d["id"], m.json()["id"]


def _cookie_header(session: requests.Session) -> dict:
    """Build a Cookie header for websockets from a requests.Session."""
    parts = [f"{c.name}={c.value}" for c in session.cookies]
    return {"Cookie": "; ".join(parts)} if parts else {}


@pytest.fixture(scope="module")
def student():
    return _new_student()


# ---------------- WebSocket auth ----------------
class TestWebSocketAuth:
    def test_ws_no_cookie_rejected(self):
        """Without auth cookie, server rejects.
        Note: chat.py calls ws.close(4401) before ws.accept(), so Starlette
        returns HTTP 403 on the upgrade (close codes only apply post-accept).
        Either behavior counts as 'rejected'.
        """
        async def run():
            url = f"{WS_BASE}/api/ws/sessions/does-not-matter"
            try:
                async with websockets.connect(url) as ws:
                    await ws.recv()
                pytest.fail("Expected rejection but connection succeeded")
            except InvalidStatus as e:
                assert e.response.status_code in (401, 403), f"Got {e.response.status_code}"
            except ConnectionClosed as e:
                assert e.code == 4401, f"Expected 4401 got {e.code}"
        asyncio.run(run())

    def test_ws_wrong_session_rejected(self, student):
        """Non-existent / not-owned session should be rejected (4404 or HTTP 403)."""
        async def run():
            fake_sid = f"s-nonexistent-{uuid.uuid4().hex[:8]}"
            url = f"{WS_BASE}/api/ws/sessions/{fake_sid}"
            try:
                async with websockets.connect(url, additional_headers=_cookie_header(student)) as ws:
                    await ws.recv()
                pytest.fail("Expected rejection but connection succeeded")
            except InvalidStatus as e:
                assert e.response.status_code in (403, 404), f"Got {e.response.status_code}"
            except ConnectionClosed as e:
                assert e.code == 4404, f"Expected 4404 got {e.code}"
        asyncio.run(run())


# ---------------- WebSocket connect, history, intro ----------------
class TestWebSocketConnect:
    def test_first_connect_sends_history_then_intro(self, student):
        _, sid = _make_session(student)

        async def run():
            url = f"{WS_BASE}/api/ws/sessions/{sid}"
            async with websockets.connect(url, additional_headers=_cookie_header(student)) as ws:
                # 1st frame: history (empty for fresh session)
                first = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                assert first["type"] == "history"
                assert first["messages"] == []
                # presence snapshot (NEW in iter5)
                pres = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                assert pres["type"] == "presence"
                # next: tutor intro auto-broadcast (skip any extra presence broadcasts)
                second = None
                for _ in range(4):
                    f = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                    if f.get("type") == "message":
                        second = f
                        break
                assert second["type"] == "message"
                m = second["message"]
                assert m["role"] == "tutor"
                assert m["session_id"] == sid
                assert "body" in m and len(m["body"]) > 0
            return sid

        sid_done = asyncio.run(run())

        # REST history should now contain the intro
        r = student.get(f"{API}/sessions/{sid_done}/messages", timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 1
        assert msgs[0]["role"] == "tutor"


# ---------------- WebSocket broadcast + persistence ----------------
class TestWebSocketBroadcast:
    def test_two_connections_broadcast_and_canned_reply(self, student):
        _, sid = _make_session(student)

        async def run():
            url = f"{WS_BASE}/api/ws/sessions/{sid}"
            headers = _cookie_header(student)
            async with websockets.connect(url, additional_headers=headers) as ws_a:
                # ws_a is first → expects history (empty) + tutor intro broadcast
                f1 = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=10))
                assert f1["type"] == "history"
                # consume presence + intro (order may interleave with presence broadcasts)
                f2 = None
                for _ in range(4):
                    fr = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=10))
                    if fr.get("type") == "message":
                        f2 = fr
                        break
                assert f2 is not None and f2["message"]["role"] == "tutor"

                async with websockets.connect(url, additional_headers=headers) as ws_b:
                    # ws_b joins after intro persisted → expect history with 1 intro msg
                    h_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=10))
                    assert h_b["type"] == "history"
                    assert len(h_b["messages"]) >= 1
                    # consume any presence frames after history
                    # (don't assert; just allow the next reads to find message frames)

                    # Send a 'rag' keyword message from A — expect broadcast to B
                    user_text = "Help with rag recall — what about chunking?"
                    await ws_a.send(json.dumps({"body": user_text}))

                    # B should receive user echo + canned tutor reply
                    received_b = []
                    for _ in range(4):
                        try:
                            frame = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=10))
                            if frame["type"] == "message":
                                received_b.append(frame["message"])
                                if len(received_b) >= 2:
                                    break
                        except asyncio.TimeoutError:
                            break

                    roles = [m["role"] for m in received_b]
                    assert "you" in roles, f"B did not receive user echo. Got: {received_b}"
                    bodies = [m["body"] for m in received_b]
                    assert any("chunk overlap" in b for b in bodies), f"No canned reply. Bodies: {bodies}"

            return sid

        sid_done = asyncio.run(run())

        # Persistence check
        r = student.get(f"{API}/sessions/{sid_done}/messages", timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        roles = [m["role"] for m in msgs]
        # intro (tutor) + user + canned reply (tutor) — at least 3
        assert roles.count("tutor") >= 2
        assert roles.count("you") >= 1


# ---------------- Canned-reply keyword logic ----------------
class TestCannedReplies:
    @pytest.mark.parametrize("text,expected", [
        ("recall is bad", "chunk overlap"),
        ("rag pipeline failing", "chunk overlap"),
        ("agent loop is stuck", "planner is over-thinking"),
        ("tool routing broken", "planner is over-thinking"),
        ("lora training help", "LoRA rank of 16"),
        ("fine-tuning a 7b", "LoRA rank of 16"),
        ("vllm latency", "continuous batching"),
        ("gpu memory issue", "continuous batching"),
    ])
    def test_keyword_canned_reply(self, student, text, expected):
        _, sid = _make_session(student)

        async def run():
            url = f"{WS_BASE}/api/ws/sessions/{sid}"
            async with websockets.connect(url, additional_headers=_cookie_header(student)) as ws:
                # drain history + presence + intro (skip non-message frames)
                drained_intro = False
                for _ in range(5):
                    fr = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                    if fr.get("type") == "message":
                        drained_intro = True
                        break
                assert drained_intro
                await ws.send(json.dumps({"body": text}))
                # Expect echo, then canned reply
                bodies = []
                for _ in range(6):
                    try:
                        frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                        if frame.get("type") == "message":
                            bodies.append(frame["message"]["body"])
                            if len(bodies) >= 2:
                                break
                    except asyncio.TimeoutError:
                        break
                return bodies

        bodies = asyncio.run(run())
        assert any(expected in b for b in bodies), f"Expected '{expected}' in replies: {bodies}"

    def test_default_reply_for_unmatched(self, student):
        _, sid = _make_session(student)

        async def run():
            url = f"{WS_BASE}/api/ws/sessions/{sid}"
            async with websockets.connect(url, additional_headers=_cookie_header(student)) as ws:
                # drain history + presence + intro
                for _ in range(5):
                    fr = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                    if fr.get("type") == "message":
                        break
                await ws.send(json.dumps({"body": "totally random topic xyz"}))
                bodies = []
                for _ in range(6):
                    try:
                        frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                        if frame.get("type") == "message":
                            bodies.append(frame["message"]["body"])
                            if len(bodies) >= 2:
                                break
                    except asyncio.TimeoutError:
                        break
                return bodies

        bodies = asyncio.run(run())
        # Default reply contains "Walk me through"
        assert any("Walk me through" in b for b in bodies), f"Default reply missing: {bodies}"


# ---------------- REST history endpoint ----------------
class TestMessagesREST:
    def test_messages_requires_auth(self):
        r = requests.get(f"{API}/sessions/s-fake/messages", timeout=15)
        assert r.status_code == 401

    def test_messages_404_for_other_user(self):
        s1 = _new_student()
        s2 = _new_student()
        _, sid = _make_session(s1)
        r = s2.get(f"{API}/sessions/{sid}/messages", timeout=15)
        assert r.status_code == 404
