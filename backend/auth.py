"""JWT auth for Unstuck."""
import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models import RegisterRequest, LoginRequest, UserPublic, UpdateProfileRequest, ChangePasswordRequest
from rate_limit import limiter

JWT_ALGORITHM = "HS256"
ACCESS_MIN = 60 * 24  # 1 day
REFRESH_DAYS = 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "v": token_version,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {
        "sub": user_id,
        "v": token_version,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def _set_cookies(response: Response, access: str, refresh: str) -> None:
    # SameSite=None + Secure required for cross-origin (preview domain ↔ frontend)
    response.set_cookie(
        "access_token", access,
        httponly=True, secure=True, samesite="none",
        max_age=ACCESS_MIN * 60, path="/",
    )
    response.set_cookie(
        "refresh_token", refresh,
        httponly=True, secure=True, samesite="none",
        max_age=REFRESH_DAYS * 86400, path="/",
    )


def _user_to_public(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        email=doc["email"],
        name=doc.get("name", ""),
        role=doc.get("role", "student"),
        created_at=doc.get("created_at", datetime.now(timezone.utc).isoformat()),
    )


def get_db_dep():
    """Return the shared MongoDB handle."""
    from database import db
    return db


async def get_current_user(request: Request) -> dict:
    db = get_db_dep()
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        try:
            user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token subject")
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Token version check — invalidates after password change
        if payload.get("v", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Token revoked — please sign in again")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic)
async def register(body: RegisterRequest, response: Response):
    db = get_db_dep()
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": "student",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    access = create_access_token(str(res.inserted_id), email, 0)
    refresh = create_refresh_token(str(res.inserted_id), 0)
    _set_cookies(response, access, refresh)
    return _user_to_public(doc)


@router.post("/login", response_model=UserPublic)
@limiter.limit("10/minute")
async def login(body: LoginRequest, request: Request, response: Response):
    db = get_db_dep()
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    v = user.get("token_version", 0)
    access = create_access_token(str(user["_id"]), email, v)
    refresh = create_refresh_token(str(user["_id"]), v)
    _set_cookies(response, access, refresh)
    return _user_to_public(user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(
        id=user["_id"],
        email=user["email"],
        name=user.get("name", ""),
        role=user.get("role", "student"),
        created_at=user.get("created_at", ""),
    )


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        db = get_db_dep()
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(
            "access_token", access,
            httponly=True, secure=True, samesite="none",
            max_age=ACCESS_MIN * 60, path="/",
        )
        return {"ok": True}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.patch("/me", response_model=UserPublic)
async def update_profile(body: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    db = get_db_dep()
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"name": body.name.strip()}},
    )
    user["name"] = body.name.strip()
    return UserPublic(
        id=user["_id"], email=user["email"], name=user["name"],
        role=user.get("role", "student"), created_at=user.get("created_at", ""),
    )


@router.post("/password")
async def change_password(body: ChangePasswordRequest, response: Response, user: dict = Depends(get_current_user)):
    db = get_db_dep()
    full = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full or not verify_password(body.current_password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new_version = int(full.get("token_version", 0)) + 1
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "password_hash": hash_password(body.new_password),
            "token_version": new_version,
        }},
    )
    # Re-issue cookies with new token version so the user stays signed in
    access = create_access_token(user["_id"], full["email"], new_version)
    refresh = create_refresh_token(user["_id"], new_version)
    _set_cookies(response, access, refresh)
    return {"ok": True}


async def seed_admin(db) -> None:
    email = os.environ.get("ADMIN_EMAIL", "admin@unstuck.dev").lower()
    password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    existing = await db.users.find_one({"email": email})
    now_iso = datetime.now(timezone.utc).isoformat()
    if existing is None:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(password),
            "name": "Admin",
            "role": "admin",
            "created_at": now_iso,
        })
    elif not verify_password(password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": email}, {"$set": {"password_hash": hash_password(password)}}
        )
