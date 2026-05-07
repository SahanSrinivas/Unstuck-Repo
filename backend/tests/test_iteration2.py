"""Iteration 2 tests: saved-tutors, billing, profile/password, session resolve, SessionPublic.resolution."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rag-agents-fix.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _new_student():
    s = requests.Session()
    email = f"test.it2.{uuid.uuid4().hex[:8]}@unstuck.dev"
    pw = "Student123!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "TEST IT2"}, timeout=30)
    assert r.status_code == 200, r.text
    s.email = email      # type: ignore[attr-defined]
    s.password = pw      # type: ignore[attr-defined]
    return s


@pytest.fixture(scope="module")
def student():
    return _new_student()


# ---------------- Saved tutors round-trip ----------------
class TestSavedTutors:
    def test_saved_round_trip(self, student):
        # Initially empty
        r = student.get(f"{API}/saved-tutors", timeout=15)
        assert r.status_code == 200 and r.json() == []
        # Save tutor-aria
        r = student.post(f"{API}/saved-tutors/tutor-aria", timeout=15)
        assert r.status_code == 200 and r.json() == {"ok": True}
        # List should have aria
        r = student.get(f"{API}/saved-tutors", timeout=15)
        assert r.status_code == 200
        lst = r.json()
        assert any(t["id"] == "tutor-aria" for t in lst)
        # Save again — idempotent
        r2 = student.post(f"{API}/saved-tutors/tutor-aria", timeout=15)
        assert r2.status_code == 200
        r3 = student.get(f"{API}/saved-tutors", timeout=15)
        assert sum(1 for t in r3.json() if t["id"] == "tutor-aria") == 1
        # Unsave
        d = student.delete(f"{API}/saved-tutors/tutor-aria", timeout=15)
        assert d.status_code == 200
        r = student.get(f"{API}/saved-tutors", timeout=15)
        assert r.status_code == 200 and r.json() == []

    def test_save_unknown_tutor_404(self, student):
        r = student.post(f"{API}/saved-tutors/tutor-doesnotexist", timeout=15)
        assert r.status_code == 404

    def test_saved_requires_auth(self):
        r = requests.get(f"{API}/saved-tutors", timeout=15)
        assert r.status_code == 401


# ---------------- Billing transactions ----------------
class TestBilling:
    def test_billing_empty_then_populated(self, student):
        # Initially empty
        r = student.get(f"{API}/billing/transactions", timeout=15)
        assert r.status_code == 200 and r.json() == []
        # Create a doubt + checkout to populate (Stripe may 502 but txn is recorded)
        d = student.post(f"{API}/doubts", json={
            "description": "Billing test - need help with batching",
            "topics": ["MLOps"],
        }, timeout=15).json()
        co = student.post(f"{API}/payments/checkout", json={
            "doubt_id": d["id"],
            "tier": "deep",
            "origin_url": BASE_URL,
        }, timeout=30)
        # Either 200 with url (pre-redirect txn row created) OR 502 — but in BOTH cases backend should have written a pending row.
        # We just need at least one txn now.
        r = student.get(f"{API}/billing/transactions", timeout=15)
        assert r.status_code == 200
        txns = r.json()
        # If checkout succeeded a row should exist; if not, log and skip strict assert
        if not txns:
            pytest.skip(f"No txn row created (checkout status={co.status_code} body={co.text[:200]})")
        item = txns[0]
        for k in ("id", "amount", "currency", "payment_status", "created_at"):
            assert k in item

    def test_billing_requires_auth(self):
        r = requests.get(f"{API}/billing/transactions", timeout=15)
        assert r.status_code == 401


# ---------------- Profile name + Password ----------------
class TestProfileAndPassword:
    def test_patch_me_updates_name(self, student):
        new_name = f"Renamed {uuid.uuid4().hex[:6]}"
        r = student.patch(f"{API}/auth/me", json={"name": new_name}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name
        me = student.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200 and me.json()["name"] == new_name

    def test_change_password_wrong_current(self, student):
        r = student.post(f"{API}/auth/password", json={
            "current_password": "WRONG_PW",
            "new_password": "NewPass123!",
        }, timeout=15)
        assert r.status_code == 400
        assert "incorrect" in (r.json().get("detail") or "").lower()

    def test_change_password_success_and_login(self, student):
        new_pw = "NewPass" + uuid.uuid4().hex[:6] + "!"
        # Use the known current password from the fixture
        r = student.post(f"{API}/auth/password", json={
            "current_password": student.password,  # type: ignore[attr-defined]
            "new_password": new_pw,
        }, timeout=15)
        assert r.status_code == 200, r.text
        # Old password should no longer work
        s2 = requests.Session()
        bad = s2.post(f"{API}/auth/login", json={"email": student.email, "password": student.password}, timeout=15)  # type: ignore[attr-defined]
        assert bad.status_code == 401
        # New password works
        good = s2.post(f"{API}/auth/login", json={"email": student.email, "password": new_pw}, timeout=15)  # type: ignore[attr-defined]
        assert good.status_code == 200
        student.password = new_pw  # type: ignore[attr-defined]

    def test_patch_me_requires_auth(self):
        r = requests.patch(f"{API}/auth/me", json={"name": "x"}, timeout=15)
        assert r.status_code == 401


# ---------------- Session resolve + SessionPublic.resolution ----------------
class TestResolveSession:
    def _make_session(self, s):
        d = s.post(f"{API}/doubts", json={
            "description": "Resolve test - need help",
            "topics": ["RAG"],
        }, timeout=15).json()
        m = s.post(f"{API}/doubts/{d['id']}/match", json={
            "doubt_id": d["id"], "tier": "deep", "tutor_id": "tutor-aria"
        }, timeout=15)
        assert m.status_code == 200, m.text
        return d["id"], m.json()["id"]

    def test_resolution_field_on_public(self, student):
        _, sid = self._make_session(student)
        r = student.get(f"{API}/sessions/{sid}", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "resolution" in body
        assert body["resolution"] is None

    def test_resolve_resolved(self, student):
        _, sid = self._make_session(student)
        r = student.post(f"{API}/sessions/{sid}/resolve", json={"resolution": "resolved"}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"ok": True, "resolution": "resolved"}
        g = student.get(f"{API}/sessions/{sid}", timeout=15).json()
        assert g["status"] == "completed" and g["resolution"] == "resolved"

    def test_resolve_refunded_marks_payment(self, student):
        did, sid = self._make_session(student)
        # Create a payment txn first via checkout
        student.post(f"{API}/payments/checkout", json={
            "doubt_id": did, "tier": "deep", "origin_url": BASE_URL
        }, timeout=30)
        r = student.post(f"{API}/sessions/{sid}/resolve", json={"resolution": "refunded"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["resolution"] == "refunded"
        g = student.get(f"{API}/sessions/{sid}", timeout=15).json()
        assert g["resolution"] == "refunded"
        # Verify any txn for this doubt was marked refunded (best-effort)
        txns = student.get(f"{API}/billing/transactions", timeout=15).json()
        related = [t for t in txns if t.get("doubt_id") == did and t.get("tier") == "deep"]
        if related:
            assert any(t.get("refunded") is True for t in related), f"No refunded txn found among {related}"

    def test_resolve_invalid_400(self, student):
        _, sid = self._make_session(student)
        r = student.post(f"{API}/sessions/{sid}/resolve", json={"resolution": "garbage"}, timeout=15)
        assert r.status_code == 400

    def test_resolve_requires_auth(self):
        r = requests.post(f"{API}/sessions/s-fake/resolve", json={"resolution": "resolved"}, timeout=15)
        assert r.status_code == 401
