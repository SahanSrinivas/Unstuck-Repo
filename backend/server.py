"""Unstuck FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging

# Sentry init MUST happen before app creation so all middleware/routes are instrumented.
SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=os.environ.get("APP_ENV", "development"),
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_RATE", "0.1")),
            send_default_pii=False,
            integrations=[
                StarletteIntegration(failed_request_status_codes={*range(500, 599)}),
                FastApiIntegration(failed_request_status_codes={*range(500, 599)}),
            ],
        )
    except Exception as e:
        logging.warning("Sentry init failed: %s", e)

from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from database import db, close as close_db
from rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

app = FastAPI(title="Unstuck API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
from admin import router as admin_router  # noqa: E402
from tutor_portal import router as tutor_router  # noqa: E402
from seeds import seed_tutors  # noqa: E402

api_router.include_router(auth_router)
api_router.include_router(doubts_router)
api_router.include_router(payments_router)
api_router.include_router(chat_router)
api_router.include_router(admin_router)
api_router.include_router(tutor_router)

app.include_router(api_router)

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
    await db.sessions.create_index("tutor_id")
    await db.tutors.create_index("id", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.tutor_applications.create_index("status")
    await seed_admin(db)
    await seed_tutors(db)
    n = await db.tutors.count_documents({})
    logger.info("Unstuck startup complete: admin seeded, %d tutors, sentry=%s", n, bool(SENTRY_DSN))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    close_db()


@app.exception_handler(Exception)
async def _global_500_handler(request: Request, exc: Exception):
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
