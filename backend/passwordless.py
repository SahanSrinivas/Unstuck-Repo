"""Passwordless auth — Google OAuth, Email OTP, WebAuthn Passkeys.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
The frontend always builds the redirect_uri from window.location.origin + '/auth/google'
and passes it in BOTH the start and callback calls so Google's redirect_uri match check passes.
"""
import os
import json
import secrets
import logging
import bcrypt
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from urllib.parse import urlencode

import httpx
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field

from database import db
from auth import (
    create_access_token, create_refresh_token, _set_cookies,
    get_current_user, _user_to_public,
)
from rate_limit import limiter

logger = logging.getLogger("unstuck.passwordless")
router = APIRouter(prefix="/auth", tags=["auth-passwordless"])

# ---------- helpers ----------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


async def _issue_session(user_doc: dict, response: Response) -> dict:
    """Set httpOnly cookies for an existing user doc and return public profile."""
    user_id = str(user_doc["_id"])
    v = user_doc.get("token_version", 0)
    access = create_access_token(user_id, user_doc["email"], v)
    refresh = create_refresh_token(user_id, v)
    _set_cookies(response, access, refresh)
    return _user_to_public(user_doc).model_dump()


async def _find_or_create_user(email: str, name: str, *, google_id: Optional[str] = None,
                                avatar_url: Optional[str] = None,
                                email_verified: bool = True) -> dict:
    email = email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        update = {}
        if google_id and not existing.get("google_id"):
            update["google_id"] = google_id
        if avatar_url and existing.get("avatar_url") != avatar_url:
            update["avatar_url"] = avatar_url
        if email_verified and not existing.get("email_verified"):
            update["email_verified"] = True
        if update:
            await db.users.update_one({"_id": existing["_id"]}, {"$set": update})
            existing.update(update)
        return existing
    doc = {
        "email": email,
        "name": (name or email.split("@")[0]).strip()[:80],
        "role": "student",
        "google_id": google_id,
        "avatar_url": avatar_url,
        "email_verified": email_verified,
        "token_version": 0,
        "created_at": _now_iso(),
        "auth_methods": ["google"] if google_id else ["otp"],
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


# =========================================================================
# 1. GOOGLE OAUTH (Authorization Code flow with frontend-provided redirect_uri)
# =========================================================================
class GoogleCallback(BaseModel):
    code: str
    redirect_uri: str  # MUST be window.location.origin + "/auth/google" — set by the SPA


@router.get("/google/start")
async def google_start(redirect_uri: str):
    """Return the URL the SPA should redirect to."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not client_id or "dummy" in client_id.lower():
        raise HTTPException(status_code=503, detail="Google sign-in not configured")
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"url": url, "state": state}


@router.post("/google/callback")
async def google_callback(body: GoogleCallback, response: Response):
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    if not client_id or "dummy" in client_id.lower() or not client_secret or "dummy" in client_secret.lower():
        raise HTTPException(status_code=503, detail="Google sign-in not configured")

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            tok_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": body.code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": body.redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Google token exchange failed: {e}")
        if tok_res.status_code != 200:
            logger.warning("google token exchange failed: %s", tok_res.text)
            raise HTTPException(status_code=400, detail="Invalid Google authorization code")
        tokens = tok_res.json()

        try:
            ui_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Google userinfo failed: {e}")
        if ui_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Could not read Google profile")
        info = ui_res.json()

    if not info.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google email is not verified")

    user = await _find_or_create_user(
        email=info["email"],
        name=info.get("name") or info.get("given_name") or info["email"].split("@")[0],
        google_id=info.get("sub"),
        avatar_url=info.get("picture"),
        email_verified=True,
    )
    return await _issue_session(user, response)


# =========================================================================
# 2. EMAIL OTP (6-digit, 10-minute TTL, hashed at rest)
# =========================================================================
OTP_TTL_SECONDS = 600  # 10 min
OTP_RATE_LIMIT = "5/minute"


class OtpSendRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = ""


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    name: Optional[str] = ""


def _gen_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def _verify_code(code: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(code.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


@router.post("/otp/send")
@limiter.limit(OTP_RATE_LIMIT)
async def otp_send(body: OtpSendRequest, request: Request):
    email = body.email.lower().strip()
    code = _gen_code()
    expires = _now() + timedelta(seconds=OTP_TTL_SECONDS)
    await db.otp_codes.insert_one({
        "email": email,
        "code_hash": _hash_code(code),
        "expires_at": expires,
        "used": False,
        "attempts": 0,
        "created_at": _now_iso(),
    })

    # Send email (no-ops on dummy Resend key)
    try:
        from email_service import _wrap, _send  # internal helpers
        html = _wrap(
            "Your sign-in code",
            f"Use this code to sign in to Unstuck:<br><br>"
            f"<div style='font-family:JetBrains Mono,monospace;font-size:32px;font-weight:700;color:#5A1BA9;letter-spacing:6px;background:#EFE7FB;padding:18px 24px;border-radius:8px;text-align:center;display:inline-block'>{code}</div>"
            f"<br><br>It expires in 10 minutes. If you didn't request this, ignore this email.",
        )
        await _send(email, "Your Unstuck sign-in code", html)
    except Exception as e:
        logger.warning("otp email send failed: %s", e)

    # Dev-friendly: when Resend is dummy, log the code so it's accessible in logs
    if "dummy" in os.environ.get("RESEND_API_KEY", "").lower() or not os.environ.get("RESEND_API_KEY"):
        logger.info("[otp-dev] %s -> %s (expires %ds)", email, code, OTP_TTL_SECONDS)
        return {"ok": True, "dev_code": code}  # ONLY when not configured for real
    return {"ok": True}


@router.post("/otp/verify")
@limiter.limit("10/minute")
async def otp_verify(body: OtpVerifyRequest, request: Request, response: Response):
    email = body.email.lower().strip()
    record = await db.otp_codes.find_one(
        {"email": email, "used": False, "expires_at": {"$gt": _now()}},
        sort=[("created_at", -1)],
    )
    if not record:
        raise HTTPException(status_code=400, detail="No active code — request a new one")
    if record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts — request a new code")
    if not _verify_code(body.code, record["code_hash"]):
        await db.otp_codes.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid code")

    await db.otp_codes.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": _now_iso()}})
    user = await _find_or_create_user(email=email, name=body.name or email.split("@")[0], email_verified=True)
    return await _issue_session(user, response)


# =========================================================================
# 3. WEBAUTHN PASSKEYS
# =========================================================================
def _rp_id() -> str:
    return os.environ.get("WEBAUTHN_RP_ID", "localhost")


def _rp_name() -> str:
    return os.environ.get("WEBAUTHN_RP_NAME", "Unstuck")


def _origin_for(request: Request) -> str:
    # Trust origin from request — needed for cross-domain dev/preview
    return request.headers.get("origin") or os.environ.get("FRONTEND_URL", "")


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


class PasskeyRegisterBegin(BaseModel):
    pass  # current_user supplies email


class PasskeyVerify(BaseModel):
    credential: dict  # raw response from navigator.credentials.create/get


class PasskeyLoginBegin(BaseModel):
    email: EmailStr


@router.post("/passkey/register/begin")
async def passkey_register_begin(_body: PasskeyRegisterBegin, user: dict = Depends(get_current_user)):
    from webauthn import generate_registration_options, options_to_json
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria, ResidentKeyRequirement, UserVerificationRequirement,
        PublicKeyCredentialDescriptor,
    )

    existing_creds: List[PublicKeyCredentialDescriptor] = []
    for c in user.get("passkey_credentials", []) or []:
        try:
            existing_creds.append(PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(c["id"] + "==")))
        except Exception:
            pass

    options = generate_registration_options(
        rp_id=_rp_id(),
        rp_name=_rp_name(),
        user_id=user["_id"].encode("utf-8") if isinstance(user["_id"], str) else str(user["_id"]).encode("utf-8"),
        user_name=user["email"],
        user_display_name=user.get("name", user["email"]),
        exclude_credentials=existing_creds,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    challenge_b64 = _b64url(options.challenge)
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"passkey_register_challenge": challenge_b64, "passkey_challenge_at": _now_iso()}},
    )
    return json.loads(options_to_json(options))


@router.post("/passkey/register/complete")
async def passkey_register_complete(body: PasskeyVerify, request: Request, user: dict = Depends(get_current_user)):
    from webauthn import verify_registration_response

    full = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full or not full.get("passkey_register_challenge"):
        raise HTTPException(status_code=400, detail="No passkey registration in progress")
    challenge_b64 = full["passkey_register_challenge"]
    try:
        verification = verify_registration_response(
            credential=body.credential,
            expected_challenge=base64.urlsafe_b64decode(challenge_b64 + "=="),
            expected_origin=_origin_for(request),
            expected_rp_id=_rp_id(),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Passkey verification failed: {str(e)[:200]}")

    cred = {
        "id": _b64url(verification.credential_id),
        "public_key": _b64url(verification.credential_public_key),
        "sign_count": verification.sign_count,
        "transports": body.credential.get("response", {}).get("transports") or [],
        "registered_at": _now_iso(),
    }
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {
            "$push": {"passkey_credentials": cred},
            "$unset": {"passkey_register_challenge": "", "passkey_challenge_at": ""},
            "$addToSet": {"auth_methods": "passkey"},
        },
    )
    return {"ok": True, "credential_id": cred["id"]}


@router.post("/passkey/login/begin")
async def passkey_login_begin(body: PasskeyLoginBegin):
    from webauthn import generate_authentication_options, options_to_json
    from webauthn.helpers.structs import PublicKeyCredentialDescriptor, UserVerificationRequirement

    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    creds = (user or {}).get("passkey_credentials", [])
    if not creds:
        # Avoid email enumeration: still return options, but with no allow list — auth will then fail at verify
        allow: List[PublicKeyCredentialDescriptor] = []
    else:
        allow = [
            PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(c["id"] + "=="))
            for c in creds
        ]

    options = generate_authentication_options(
        rp_id=_rp_id(),
        allow_credentials=allow,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    challenge_b64 = _b64url(options.challenge)
    await db.passkey_login_challenges.insert_one({
        "email": email,
        "challenge": challenge_b64,
        "created_at": _now_iso(),
        "expires_at": _now() + timedelta(minutes=5),
    })
    return json.loads(options_to_json(options))


@router.post("/passkey/login/complete")
async def passkey_login_complete(body: PasskeyVerify, request: Request, response: Response):
    from webauthn import verify_authentication_response

    cred_id = body.credential.get("id") or body.credential.get("rawId")
    if not cred_id:
        raise HTTPException(status_code=400, detail="Missing credential id")

    user = await db.users.find_one({"passkey_credentials.id": cred_id})
    if not user:
        raise HTTPException(status_code=400, detail="Unknown passkey")

    matching = next((c for c in user.get("passkey_credentials", []) if c["id"] == cred_id), None)
    if not matching:
        raise HTTPException(status_code=400, detail="Passkey not registered")

    chal = await db.passkey_login_challenges.find_one(
        {"email": user["email"], "expires_at": {"$gt": _now()}},
        sort=[("created_at", -1)],
    )
    if not chal:
        raise HTTPException(status_code=400, detail="No active passkey challenge")

    try:
        verification = verify_authentication_response(
            credential=body.credential,
            expected_challenge=base64.urlsafe_b64decode(chal["challenge"] + "=="),
            expected_rp_id=_rp_id(),
            expected_origin=_origin_for(request),
            credential_public_key=base64.urlsafe_b64decode(matching["public_key"] + "=="),
            credential_current_sign_count=matching.get("sign_count", 0),
            require_user_verification=False,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Passkey assertion failed: {str(e)[:200]}")

    await db.users.update_one(
        {"_id": user["_id"], "passkey_credentials.id": cred_id},
        {"$set": {"passkey_credentials.$.sign_count": verification.new_sign_count}},
    )
    await db.passkey_login_challenges.delete_one({"_id": chal["_id"]})
    return await _issue_session(user, response)


@router.get("/methods")
async def my_auth_methods(user: dict = Depends(get_current_user)):
    """Used by Settings page to show 'You have a passkey on this device'."""
    full = await db.users.find_one({"_id": ObjectId(user["_id"])}, {"_id": 0, "auth_methods": 1, "passkey_credentials": 1, "google_id": 1})
    return {
        "google": bool((full or {}).get("google_id")),
        "passkeys": [
            {"id": c["id"], "registered_at": c.get("registered_at")}
            for c in (full or {}).get("passkey_credentials", [])
        ],
    }


@router.delete("/passkey/{cred_id}")
async def delete_passkey(cred_id: str, user: dict = Depends(get_current_user)):
    res = await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$pull": {"passkey_credentials": {"id": cred_id}}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Passkey not found")
    return {"ok": True}
