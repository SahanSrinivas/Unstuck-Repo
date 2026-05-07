"""Stripe checkout integration for Unstuck tier payments."""
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request

from models import CheckoutRequest, CheckoutResponse
from auth import get_current_user
from seeds import TIERS

router = APIRouter(tags=["payments"])


def _db():
    from database import db
    return db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_stripe(http_request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    api_key = os.environ.get("STRIPE_API_KEY", "")
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


@router.post("/payments/checkout", response_model=CheckoutResponse)
async def create_checkout(body: CheckoutRequest, http_request: Request, user: dict = Depends(get_current_user)):
    if body.tier not in TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    tier = TIERS[body.tier]
    amount: float = float(tier["price"])  # server-side price only

    doubt = await _db().doubts.find_one({"id": body.doubt_id, "user_id": user["_id"]}, {"_id": 0})
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")

    from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest
    stripe = _get_stripe(http_request)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/dashboard?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/doubts/new?payment=cancelled&doubt_id={body.doubt_id}"

    metadata = {
        "user_id": user["_id"],
        "doubt_id": body.doubt_id,
        "tier": body.tier,
        "source": "unstuck_web",
    }
    req = CheckoutSessionRequest(
        amount=amount, currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    )
    session = None
    try:
        session = await stripe.create_checkout_session(req)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:200]}")
    if session is None:
        raise HTTPException(status_code=502, detail="Stripe returned no session")

    txn = {
        "id": f"txn-{uuid.uuid4().hex[:10]}",
        "user_id": user["_id"],
        "doubt_id": body.doubt_id,
        "tier": body.tier,
        "amount": amount,
        "currency": "usd",
        "session_id": session.session_id,
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": _now(),
        "credited": False,
    }
    await _db().payment_transactions.insert_one(txn)
    return CheckoutResponse(url=session.url, session_id=session.session_id)


@router.get("/payments/status/{session_id}")
async def checkout_status(session_id: str, http_request: Request, user: dict = Depends(get_current_user)):
    txn = await _db().payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("payment_status") == "paid":
        return {"payment_status": "paid", "status": "complete", "amount": txn["amount"]}

    stripe = _get_stripe(http_request)
    s = None
    try:
        s = await stripe.get_checkout_status(session_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:200]}")
    if s is None:
        raise HTTPException(status_code=502, detail="Stripe returned no status")

    update = {"payment_status": s.payment_status, "status": s.status}
    await _db().payment_transactions.update_one({"session_id": session_id}, {"$set": update})

    if s.payment_status == "paid" and not txn.get("credited"):
        # idempotently mark credited (the matching/session creation happens in /match flow)
        await _db().payment_transactions.update_one(
            {"session_id": session_id, "credited": {"$ne": True}},
            {"$set": {"credited": True}},
        )
    return {"payment_status": s.payment_status, "status": s.status, "amount": s.amount_total / 100}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    stripe = _get_stripe(request)
    try:
        evt = await stripe.handle_webhook(body, sig)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)[:200]}")
    txn = await _db().payment_transactions.find_one({"session_id": evt.session_id}, {"_id": 0})
    await _db().payment_transactions.update_one(
        {"session_id": evt.session_id},
        {"$set": {"payment_status": evt.payment_status, "last_event": evt.event_type}},
    )
    # Auto-create session row if paid event arrives and we don't have one yet
    if evt.payment_status == "paid" and txn and not txn.get("session_created"):
        from seeds import TIERS as _TIERS
        from bson import ObjectId
        tier_key = txn.get("tier")
        if tier_key in _TIERS:
            tier = _TIERS[tier_key]
            doubt = await _db().doubts.find_one({"id": txn.get("doubt_id")}, {"_id": 0})
            if doubt:
                tutors = await _db().tutors.find({"available": True}, {"_id": 0}).to_list(50)
                if tutors:
                    chosen = tutors[0]  # webhook path: simple pick — user UI normally pre-selects
                    sess = {
                        "id": f"s-{uuid.uuid4().hex[:10]}",
                        "user_id": txn.get("user_id"),
                        "doubt_id": txn.get("doubt_id"),
                        "tutor_id": chosen["id"],
                        "tutor_name": chosen["name"],
                        "topic": (doubt.get("topics") or ["General"])[0],
                        "tier": tier_key,
                        "duration_min": tier["duration_min"],
                        "price": tier["price"],
                        "status": "scheduled",
                        "created_at": _now(),
                        "summary": "",
                        "from_webhook": True,
                    }
                    await _db().sessions.insert_one(sess)
                    await _db().payment_transactions.update_one(
                        {"session_id": evt.session_id},
                        {"$set": {"session_created": True, "internal_session_id": sess["id"]}},
                    )
                    # Best-effort email to student
                    try:
                        u = await _db().users.find_one({"_id": ObjectId(txn["user_id"])}, {"_id": 0, "email": 1, "name": 1})
                        if u:
                            from email_service import send_doubt_matched
                            await send_doubt_matched(u["email"], u.get("name", "there"), chosen["name"], sess["topic"], sess["id"])
                    except Exception:
                        pass
    return {"ok": True}
