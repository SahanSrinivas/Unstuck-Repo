"""Seed data for tutors."""
from datetime import datetime, timezone

TUTORS = [
    {
        "id": "tutor-aria",
        "name": "Aria Chen",
        "avatar": "AC",
        "specialties": ["RAG", "Evals", "Vector DBs"],
        "rating": 4.9,
        "response_time_min": 3,
        "rate_hint": "$48/hr",
        "bio": "Built retrieval at a YC AI infra startup. Helps debug recall, chunking, and reranking.",
        "available": True,
    },
    {
        "id": "tutor-marcus",
        "name": "Marcus Patel",
        "avatar": "MP",
        "specialties": ["Agents", "Tool use", "LangGraph"],
        "rating": 4.8,
        "response_time_min": 5,
        "rate_hint": "$52/hr",
        "bio": "Shipped autonomous agents for two SaaS companies. Knows the failure modes by heart.",
        "available": True,
    },
    {
        "id": "tutor-yuki",
        "name": "Yuki Tanaka",
        "avatar": "YT",
        "specialties": ["Fine-tuning", "LoRA", "Distillation"],
        "rating": 4.9,
        "response_time_min": 4,
        "rate_hint": "$55/hr",
        "bio": "Trained 30+ models on Llama/Mistral. Will tell you when fine-tuning is the wrong answer.",
        "available": True,
    },
    {
        "id": "tutor-rohan",
        "name": "Rohan Singh",
        "avatar": "RS",
        "specialties": ["MLOps", "Inference", "GPU scaling"],
        "rating": 4.7,
        "response_time_min": 6,
        "rate_hint": "$50/hr",
        "bio": "Runs inference for a Fortune 500. vLLM, TGI, batching, autoscaling — all of it.",
        "available": True,
    },
    {
        "id": "tutor-priya",
        "name": "Priya Iyer",
        "avatar": "PI",
        "specialties": ["RAG", "Prompting", "Evals"],
        "rating": 4.8,
        "response_time_min": 4,
        "rate_hint": "$45/hr",
        "bio": "Applied scientist. Loves writing eval suites that actually catch regressions.",
        "available": True,
    },
    {
        "id": "tutor-david",
        "name": "David Okafor",
        "avatar": "DO",
        "specialties": ["Agents", "Multi-agent", "Orchestration"],
        "rating": 4.9,
        "response_time_min": 5,
        "rate_hint": "$58/hr",
        "bio": "Builds multi-agent systems for financial workflows. Strong on observability.",
        "available": True,
    },
    {
        "id": "tutor-elena",
        "name": "Elena Volkov",
        "avatar": "EV",
        "specialties": ["Fine-tuning", "RLHF", "DPO"],
        "rating": 4.8,
        "response_time_min": 7,
        "rate_hint": "$60/hr",
        "bio": "PhD researcher turned applied. RLHF, DPO, reward modeling — comfortable across the stack.",
        "available": True,
    },
    {
        "id": "tutor-james",
        "name": "James Brewer",
        "avatar": "JB",
        "specialties": ["MLOps", "Observability", "Cost"],
        "rating": 4.7,
        "response_time_min": 5,
        "rate_hint": "$47/hr",
        "bio": "Cuts cloud bills in half. Knows where LLM costs hide.",
        "available": True,
    },
]

TIERS = {
    "quick":   {"label": "Quick Doubt",      "duration_min": 15, "price": 15.00},
    "deep":    {"label": "Deep Dive",        "duration_min": 30, "price": 30.00},
    "working": {"label": "Working Session",  "duration_min": 45, "price": 45.00},
    "project": {"label": "Project Help",     "duration_min": 60, "price": 60.00},
}


async def seed_tutors(db):
    now = datetime.now(timezone.utc).isoformat()
    for t in TUTORS:
        await db.tutors.update_one(
            {"id": t["id"]},
            {"$set": {**t, "created_at": now}},
            upsert=True,
        )


async def seed_test_tutor_user(db):
    """Seed a test tutor user (role=tutor, linked to tutor-aria) for end-to-end tutor-portal testing.
    Idempotent: only inserts if missing; never downgrades existing user."""
    import os
    import bcrypt
    email = os.environ.get("TUTOR_TEST_EMAIL", "tutor.test@unstuck.dev").lower()
    password = os.environ.get("TUTOR_TEST_PASSWORD", "Tutor123!")
    tutor_id = "tutor-aria"
    existing = await db.users.find_one({"email": email})
    now_iso = datetime.now(timezone.utc).isoformat()
    if existing is None:
        await db.users.insert_one({
            "email": email,
            "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
            "name": "Aria Chen",
            "role": "tutor",
            "tutor_id": tutor_id,
            "created_at": now_iso,
        })
    else:
        await db.users.update_one(
            {"email": email},
            {"$set": {"role": "tutor", "tutor_id": tutor_id}},
        )
