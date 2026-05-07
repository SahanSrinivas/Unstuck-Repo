"""Backend regression tests for Unstuck — covers auth, tutors, doubts, triage, match, sessions, payments, insights."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rag-agents-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@unstuck.dev"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="session")
def student_session():
    """Register a fresh student and return an authenticated requests.Session (cookies retained)."""
    s = requests.Session()
    email = f"test.student.{uuid.uuid4().hex[:8]}@unstuck.dev"
    payload = {"email": email, "password": "Student123!", "name": "TEST Student"}
    r = s.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    s.email = email  # type: ignore[attr-defined]
    s.user = r.json()  # type: ignore[attr-defined]
    return s


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


# ---------------- Health ----------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and d.get("service") == "unstuck"

    def test_healthz(self):
        r = requests.get(f"{API}/healthz", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"ok": True}


# ---------------- Auth ----------------
class TestAuth:
    def test_register_creates_user_and_sets_cookies(self):
        s = requests.Session()
        email = f"test.reg.{uuid.uuid4().hex[:8]}@unstuck.dev"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Student123!", "name": "TEST Reg"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == email and body["role"] == "student" and body["name"] == "TEST Reg"
        assert "access_token" in s.cookies and "refresh_token" in s.cookies
        # Cookies should be httpOnly + secure (cookie object exposes them as attributes via _rest)
        access_cookie = next(c for c in s.cookies if c.name == "access_token")
        assert access_cookie.secure is True
        # /me round trip
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200 and me.json()["email"] == email

    def test_register_duplicate(self, student_session):
        r = requests.post(f"{API}/auth/register", json={
            "email": student_session.email, "password": "Student123!", "name": "Dup"
        }, timeout=15)
        assert r.status_code == 400

    def test_login_admin(self, admin_session):
        me = admin_session.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200
        d = me.json()
        assert d["email"] == ADMIN_EMAIL and d["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong!!!"}, timeout=15)
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_logout_clears_cookies(self):
        s = requests.Session()
        email = f"test.lo.{uuid.uuid4().hex[:8]}@unstuck.dev"
        s.post(f"{API}/auth/register", json={"email": email, "password": "Student123!", "name": "Lo"}, timeout=15)
        assert s.get(f"{API}/auth/me", timeout=15).status_code == 200
        out = s.post(f"{API}/auth/logout", timeout=15)
        assert out.status_code == 200
        # Access token cookie should now be empty/expired
        s.cookies.clear()
        assert s.get(f"{API}/auth/me", timeout=15).status_code == 401


# ---------------- Tutors ----------------
class TestTutors:
    def test_list_tutors(self):
        r = requests.get(f"{API}/tutors", timeout=15)
        assert r.status_code == 200
        tutors = r.json()
        assert isinstance(tutors, list) and len(tutors) == 8
        sample = tutors[0]
        for k in ("id", "name", "specialties", "rating", "response_time_min"):
            assert k in sample, f"missing {k}"

    def test_apply_tutor(self):
        r = requests.post(f"{API}/tutors/apply", json={
            "name": "TEST Applicant",
            "email": f"test.apply.{uuid.uuid4().hex[:6]}@unstuck.dev",
            "specialties": ["RAG", "Evals"],
            "years_experience": 4,
            "pitch": "I have shipped retrieval at scale and love unblocking devs."
        }, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and d["id"].startswith("app-")


# ---------------- Doubts CRUD ----------------
class TestDoubts:
    def test_create_and_list_and_get(self, student_session):
        r = student_session.post(f"{API}/doubts", json={
            "description": "My RAG pipeline returns low recall when chunks have overlap > 50%. Why?",
            "code": "splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=300)",
            "topics": ["RAG", "Evals"],
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "draft" and d["topics"] == ["RAG", "Evals"]
        assert d["id"].startswith("d-")
        student_session.last_doubt_id = d["id"]  # type: ignore[attr-defined]

        lst = student_session.get(f"{API}/doubts", timeout=15)
        assert lst.status_code == 200
        assert any(x["id"] == d["id"] for x in lst.json())

        one = student_session.get(f"{API}/doubts/{d['id']}", timeout=15)
        assert one.status_code == 200 and one.json()["id"] == d["id"]

    def test_doubts_require_auth(self):
        r = requests.post(f"{API}/doubts", json={"description": "should fail", "topics": []}, timeout=15)
        assert r.status_code == 401


# ---------------- AI Triage (real Claude) ----------------
class TestTriage:
    def test_triage_real_llm(self, student_session):
        # Create a fresh doubt for triage
        r = student_session.post(f"{API}/doubts", json={
            "description": "Agent loop with LangGraph keeps repeating the same tool call without converging. How do I detect and break the loop?",
            "code": "graph.add_conditional_edges('agent', should_continue)",
            "topics": ["Agents", "LangGraph"],
        }, timeout=15)
        assert r.status_code == 200
        did = r.json()["id"]

        t0 = time.time()
        tr = student_session.post(f"{API}/doubts/{did}/triage", timeout=90)
        elapsed = time.time() - t0
        assert tr.status_code == 200, tr.text
        d = tr.json()
        print(f"\n[triage] took {elapsed:.1f}s; conf={d.get('confidence')}; tier={d.get('suggested_tier')}; ans_len={len(d.get('answer',''))}")
        assert d["doubt_id"] == did
        assert isinstance(d["answer"], str) and len(d["answer"].strip()) > 30, "answer must be non-trivial"
        assert isinstance(d["confidence"], (int, float)) and 0.0 <= d["confidence"] <= 1.0
        assert d["suggested_tier"] in ("quick", "deep", "working", "project")

        # Idempotent: second call should return cached triage quickly
        tr2 = student_session.post(f"{API}/doubts/{did}/triage", timeout=15)
        assert tr2.status_code == 200
        assert tr2.json()["answer"] == d["answer"]
        student_session.triaged_doubt_id = did  # type: ignore[attr-defined]


# ---------------- Match + Sessions ----------------
class TestMatchAndSessions:
    def test_match_auto_creates_session(self, student_session):
        # Need a doubt
        did = getattr(student_session, "triaged_doubt_id", None) or getattr(student_session, "last_doubt_id", None)
        assert did, "no doubt available from earlier tests"
        r = student_session.post(f"{API}/doubts/{did}/match", json={"doubt_id": did, "tier": "deep"}, timeout=20)
        assert r.status_code == 200, r.text
        sess = r.json()
        assert sess["status"] == "scheduled" and sess["tier"] == "deep" and sess["price"] == 30.0
        assert sess["id"].startswith("s-")
        student_session.session_id = sess["id"]  # type: ignore[attr-defined]

    def test_match_specific_tutor(self, student_session):
        d = student_session.post(f"{API}/doubts", json={
            "description": "Need help choosing reranker.", "topics": ["RAG"],
        }, timeout=15).json()
        r = student_session.post(f"{API}/doubts/{d['id']}/match", json={
            "doubt_id": d["id"], "tier": "quick", "tutor_id": "tutor-aria"
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["tutor_id"] == "tutor-aria"

    def test_match_invalid_tier(self, student_session):
        d = student_session.post(f"{API}/doubts", json={
            "description": "Need any tutor please", "topics": []
        }, timeout=15).json()
        r = student_session.post(f"{API}/doubts/{d['id']}/match", json={
            "doubt_id": d["id"], "tier": "bogus"
        }, timeout=15)
        assert r.status_code == 400

    def test_list_get_end_session(self, student_session):
        sid = student_session.session_id  # type: ignore[attr-defined]
        lst = student_session.get(f"{API}/sessions", timeout=15)
        assert lst.status_code == 200
        assert any(s["id"] == sid for s in lst.json())

        one = student_session.get(f"{API}/sessions/{sid}", timeout=15)
        assert one.status_code == 200

        end = student_session.post(f"{API}/sessions/{sid}/end", timeout=15)
        assert end.status_code == 200 and end.json()["ok"] is True

        again = student_session.get(f"{API}/sessions/{sid}", timeout=15)
        assert again.json()["status"] == "completed"


# ---------------- Insights ----------------
class TestInsights:
    def test_insights_returns(self, student_session):
        r = student_session.get(f"{API}/insights", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("title", "body", "tag"):
            assert k in d and isinstance(d[k], str) and len(d[k]) > 0


# ---------------- Payments ----------------
class TestPayments:
    def test_checkout_creates_session(self, student_session):
        d = student_session.post(f"{API}/doubts", json={
            "description": "Need help with vLLM batching", "topics": ["MLOps"],
        }, timeout=15).json()
        r = student_session.post(f"{API}/payments/checkout", json={
            "doubt_id": d["id"], "tier": "deep",
            "origin_url": "https://rag-agents-fix.preview.emergentagent.com",
        }, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["url"].startswith("https://") and "stripe" in body["url"].lower()
        assert body["session_id"]
        student_session.checkout_session_id = body["session_id"]  # type: ignore[attr-defined]

    def test_checkout_status(self, student_session):
        sid = student_session.checkout_session_id  # type: ignore[attr-defined]
        r = student_session.get(f"{API}/payments/status/{sid}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "payment_status" in d and "status" in d
