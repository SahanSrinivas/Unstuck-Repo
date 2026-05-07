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
- **AI triage / summary:** Claude Sonnet 4.5 via Emergent Universal LLM key (`emergentintegrations.llm.chat`)
- **Payments:** Stripe test mode via `emergentintegrations.payments.stripe.checkout`
- **Auth:** JWT email/password (admin only) + Google OAuth + Email OTP + WebAuthn passkeys; httpOnly cookies, SameSite=None, Secure

## What's Implemented (Feb 2026 — through iteration_5)

### Backend (`/app/backend/`)
- `database.py` — shared MongoDB handle
- `server.py` — main app, Sentry init, slowapi limiter, mounts all routers, seeds admin/8 tutors/test-tutor user, TTL indexes for OTP/passkey challenges
- `auth.py` — legacy email/password (admin escape hatch), JWT version-rotation on password change, bcrypt
- `passwordless.py` — Google OAuth, Email OTP (6-digit, 10-min TTL, hashed), WebAuthn passkeys
- `models.py` — Pydantic models (SessionPublic now exposes `summarized_at`, `ai_summary`)
- `doubts.py` — doubts CRUD, AI triage (Sonnet 4.5), tutor matching, sessions, AI insight, resolve/refund. **Iter 5: AI session summary** generated in background on resolve via `_summarize_and_email`; strong-ref task pool prevents GC.
- `payments.py` — Stripe checkout + webhook auto-creates session
- `chat.py` — WebSocket live chat. **Iter 5: presence broadcast** on connect/disconnect + REST `GET /api/sessions/{id}/presence`. Joiner gets snapshot inline; broadcast skips self.
- `admin.py` — admin endpoints (applications, refunds, stats)
- `tutor_portal.py` — tutor queue + sessions + profile. **Iter 5: PATCH /api/tutor/availability** + **GET /api/tutor/payouts** (per-session breakdown, totals.paid/pending/refunded/lifetime, 30% platform fee).
- `email_service.py` — Resend wrapper with dummy-key no-op
- `rate_limit.py` — shared slowapi limiter
- `seeds.py` — 8 tutors + 4 tier definitions + **iter 5: `seed_test_tutor_user`** (tutor.test@unstuck.dev linked to tutor-aria)

### Frontend (`/app/frontend/src/`)
- Tailwind config with Unstuck color tokens, Outfit/Inter/JetBrains Mono fonts
- Marketing: `/`, 8 sections per spec
- `pages/Login.jsx` — passwordless: 3 tabs (Google · Email code · Passkey)
- `pages/GoogleCallback.jsx` — handles `/auth/google?code=&state=`, exchanges with backend, stores session
- Student dashboard: 6 routes
- Tutor portal: 4 routes (Queue · My Sessions · **Payouts** · Profile & Earnings)
- Admin console: `/admin`
- New Doubt 3-step flow with Monaco editor
- Active session: WebSocket chat with **auto-reconnect (exp backoff)** + **presence chips** + Jitsi video iframe + Monaco shared editor + Resolve/Refund modal
- Tutor profile: **availability toggle (Go online / Go offline)** + link to payouts
- Settings → Passkey card with `@simplewebauthn/browser`

### Verified by testing_agent_v3
- **iteration_1**: 19/20 backend pass; full marketing + auth + new-doubt + session work
- **iteration_2**: 14/14 new dashboard endpoints pass; Monaco + sidebar routes + refund flow verified
- **iteration_3**: 15/15 new WebSocket/chat tests pass; live chat broadcast, persistence, canned replies, Jitsi iframe per-session URL all verified
- **iteration_4**: 20/20 new tests pass — admin console, tutor portal, JWT rotation, rate limiting, Stripe webhook auto-create, Resend email no-op fallback, Sentry init. Full regression: 67/69 (2 known carry-overs).
- **iteration_5**: 22/22 new tests pass — WS presence (snapshot + broadcast), AI session summary background task, tutor availability, tutor payouts, JWT rotation regression. Full regression: 83/85 + 6 skipped (carry-over: Stripe /payments/status 502).

### Verified by deployment_agent
- **status: PASS** — no deployment blockers.

## Known Limitations (Feb 2026)
1. **EMERGENT_LLM_KEY budget exhausted** — top up via Profile → Universal Key → Add Balance to unlock real Claude Sonnet 4.5 triage AND AI session summaries.
2. **Stripe payment status polling 502** — Emergent's Stripe test-mode wrapper occasionally errors right after checkout creation. Real Stripe key resolves it.
3. **Video provider is Jitsi**, not Daily.co — public Daily room URLs require a paid domain. Per-session Jitsi rooms work for free; swap `REACT_APP_VIDEO_BASE_URL` for Daily later.
4. **WebSocket chat is single-pod** — set `REDIS_URL` and add a Redis pub/sub adapter for horizontal scale.
5. **Rate limiter is in-memory** — multi-pod prod needs `REDIS_URL` to make slowapi share buckets.
6. **Email + Sentry are dummy/empty** — replace `RESEND_API_KEY` and `SENTRY_DSN` for real send/observability.
7. **WebSocket auth is one-shot** — JWT-rotation only kicks in on the next handshake; existing live WS keeps streaming until it disconnects.

## Backlog (P0 → P2)
- **P0:** Top up EMERGENT_LLM_KEY (user action) → real Claude Sonnet 4.5 triage + summaries
- **P1:** Real Daily.co room provisioning when a Daily domain is acquired
- **P1:** Tutor mobile app / push notifications + payout cashout (Stripe Connect)
- **P1:** Embedded Stripe Payment Element (instead of hosted Checkout)
- **P1:** TypeScript migration
- **P2:** Tutor search/filter on /dashboard/saved
- **P2:** Redis pub/sub for WebSocket horizontal scaling
- **P2:** "Office hours" email when a saved tutor goes online
- **P2:** Personal AI debugging notebook (vector-searchable past doubts)

## Files of Interest
- `/app/memory/test_credentials.md` — admin + test student + test tutor creds
- `/app/design_guidelines.json` — locked design tokens
- `/app/test_reports/iteration_5.json` — most recent test run
