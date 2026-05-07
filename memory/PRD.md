# Unstuck — Product Requirements & Build Log

## Original Problem Statement
Build the marketing website and signed-in dashboard for **Unstuck** — a mobile-first marketplace where adult AI engineers and learners get unblocked on RAG, agents, fine-tuning, and MLOps by verified practitioners in 5 minutes, fixed price, no monthly commitment.

**Tagline:** "Real AI engineers, in 5 minutes."

**Design direction:** Match Heroku.com's exact visual feel — friendly but technical, spacious and confident, rounded and approachable, purple-forward (#5A1BA9), Outfit + Inter + JetBrains Mono fonts.

## Personas
- **Stuck builder (primary user):** mid-senior AI engineer at a startup or Fortune 500. Has a concrete RAG/agent/fine-tune/MLOps blocker and wants help in minutes, not days. Hates subscriptions. Will pay $15–60 to unblock.
- **Verified tutor:** senior AI engineer who's shipped production systems. Wants flexible, well-paid side work without sales/bidding overhead.
- **Admin:** Unstuck staff reviewing tutor applications and platform health.

## Architecture
- **Frontend:** React (CRA) + Tailwind (custom Heroku palette tokens) + Lucide icons
- **Backend:** FastAPI + Motor (MongoDB) + bcrypt + PyJWT + emergentintegrations
- **AI triage:** Claude Sonnet 4.5 via Emergent Universal LLM key (`emergentintegrations.llm.chat`)
- **Payments:** Stripe test mode via `emergentintegrations.payments.stripe.checkout`
- **Auth:** JWT email/password, httpOnly cookies (SameSite=None, Secure)

## What's Implemented (Feb 2026)

### Backend (`/app/backend/`)
- `database.py` — shared MongoDB handle
- `server.py` — main app, Sentry init, slowapi limiter, mounts all routers, seeds admin + 8 tutors, TTL indexes for OTP/passkey challenges
- `auth.py` — **legacy** email/password auth (admin escape hatch only); JWT version-rotation; bcrypt hashing
- **`passwordless.py`** — Google OAuth, Email OTP (6-digit, 10-min TTL, hashed at rest), WebAuthn Passkeys (register/login begin+complete, list, delete)
- `models.py` — Pydantic models
- `doubts.py` — doubts CRUD, AI triage (Claude Sonnet 4.5), tutor matching, sessions, AI insight, resolve/refund, saved-tutors, billing
- `payments.py` — Stripe checkout + webhook auto-creates session
- `chat.py` — WebSocket live chat with role-aware broadcast
- `admin.py` — admin endpoints (applications, refunds, stats)
- `tutor_portal.py` — tutor queue + sessions + profile
- `email_service.py` — Resend wrapper with dummy-key no-op
- `rate_limit.py` — shared slowapi limiter
- `seeds.py` — 8 tutors + 4 tier definitions

### Frontend (`/app/frontend/src/`)
- Tailwind config with Unstuck color tokens, Outfit/Inter/JetBrains Mono fonts
- Marketing: `/`, 8 sections per spec
- **`pages/Login.jsx`** — passwordless: 3 tabs (Google · Email code · Passkey)
- **`pages/GoogleCallback.jsx`** — handles `/auth/google?code=&state=`, exchanges with backend, stores session
- `pages/Register.jsx` — redirects to Login email-code tab
- Student dashboard: 6 routes
- Tutor portal: 3 routes
- Admin console: `/admin`
- New Doubt 3-step flow with Monaco editor
- Active session: WebSocket chat + Jitsi video iframe + Monaco shared editor + Resolve/Refund modal
- **Settings → Passkey card** with `@simplewebauthn/browser` (add/remove passkeys, list registered ones, shows linked Google account)

### Verified by testing_agent_v3
- **iteration_1**: 19/20 backend pass; full marketing + auth + new-doubt + session work
- **iteration_2**: 14/14 new dashboard endpoints pass; Monaco + sidebar routes + refund flow verified
- **iteration_3**: 15/15 new WebSocket/chat tests pass; live chat broadcast, persistence, canned replies, Jitsi iframe per-session URL all verified
- **iteration_4**: 20/20 new tests pass — admin console, tutor portal, JWT rotation, rate limiting, Stripe webhook auto-create, Resend email no-op fallback, Sentry init. Full regression: 67/69 (2 known carry-overs).

### Verified by deployment_agent
- **status: PASS** — no deployment blockers. CORS valid, env-driven URLs, supervisor config valid, no hardcoded secrets, no ML/blockchain footguns, no malformed .env, no N+1 queries.

## Known Limitations (Feb 2026)
1. **EMERGENT_LLM_KEY budget exhausted** — top up via Profile → Universal Key → Add Balance to unlock real Claude Sonnet 4.5 triage.
2. **Stripe payment status polling 502** — Emergent's Stripe test-mode wrapper occasionally errors right after checkout creation. Real Stripe key resolves it.
3. **Video provider is Jitsi**, not Daily.co — public Daily room URLs require a paid domain. Per-session Jitsi rooms work for free; swap `REACT_APP_VIDEO_BASE_URL` for Daily later.
4. **WebSocket chat is single-pod** — set `REDIS_URL` and add a Redis pub/sub adapter for horizontal scale.
5. **Rate limiter is in-memory** — multi-pod prod needs `REDIS_URL` to make slowapi share buckets.
6. **Email + Sentry are dummy/empty** — replace `RESEND_API_KEY` and `SENTRY_DSN` for real send/observability.

## Backlog (P0 → P2)
- **P0:** Top up LLM key (user action) → real Claude Sonnet 4.5 triage
- **P0:** Admin dashboard for reviewing tutor applications + payments + refund queue
- **P1:** WebSocket reconnect + presence indicators (currently silent on disconnect)
- **P1:** Real Daily.co room provisioning when a Daily domain is acquired (swap `REACT_APP_VIDEO_BASE_URL`)
- **P1:** Tutor mobile app / availability toggle + payouts
- **P1:** Webhook → mark session "paid" + auto-create on Stripe paid event
- **P1:** TypeScript migration
- **P1:** JWT rotation on password change
- **P2:** Tutor search/filter on /dashboard/saved
- **P2:** AI-generated session summary email after session ends
- **P2:** Embedded Stripe Payment Element instead of hosted Checkout
- **P2:** Redis pub/sub for WebSocket horizontal scaling
- **P2:** "Office hours" email notification when a saved tutor goes online

## Files of Interest
- `/app/memory/test_credentials.md` — admin + test creds
- `/app/design_guidelines.json` — locked design tokens
- `/app/test_reports/iteration_1.json` — last test run
