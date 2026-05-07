"""Unstuck FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from database import db, close as close_db

# App
app = FastAPI(title="Unstuck API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root() -> dict:
    return {"service": "unstuck", "ok": True}


@api_router.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


# Feature routers
from auth import router as auth_router, seed_admin  # noqa: E402
from doubts import router as doubts_router  # noqa: E402
from payments import router as payments_router  # noqa: E402
from chat import router as chat_router  # noqa: E402
from seeds import seed_tutors  # noqa: E402

api_router.include_router(auth_router)
api_router.include_router(doubts_router)
api_router.include_router(payments_router)
api_router.include_router(chat_router)

app.include_router(api_router)

# CORS
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("unstuck")


@app.on_event("startup")
async def on_startup() -> None:
    await db.users.create_index("email", unique=True)
    await db.doubts.create_index("user_id")
    await db.sessions.create_index("user_id")
    await db.tutors.create_index("id", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)
    await seed_admin(db)
    await seed_tutors(db)
    n = await db.tutors.count_documents({})
    logger.info("Unstuck startup complete: admin seeded, %d tutors", n)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    close_db()
