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
- `database.py` — shared MongoDB handle (eliminates circular imports)
- `server.py` — main app, mounts routers, seeds admin + 8 tutors on startup
- `auth.py` — register, login, logout, me, refresh; **PATCH /me** profile update; **POST /password** change password; bcrypt + JWT cookies
- `models.py` — Pydantic models
- `doubts.py` — doubts CRUD, AI triage (Claude Sonnet 4.5), tutor matching, sessions, AI insight, **POST /sessions/{id}/resolve** (auto-refund flow), **/saved-tutors** GET/POST/DELETE, **GET /billing/transactions**
- `payments.py` — Stripe checkout + status polling + webhook
- **`chat.py` — WebSocket live chat at `/api/ws/sessions/{id}` with broadcast manager + `chat_messages` persistence + GET history endpoint + keyword-aware tutor canned replies**
- `seeds.py` — 8 tutors + 4 tier definitions

### Frontend (`/app/frontend/src/`)
- Tailwind config with Unstuck color tokens, Outfit/Inter/JetBrains Mono fonts
- `pages/Home.jsx` — full marketing (8 sections per spec)
- `pages/Login.jsx`, `Register.jsx`
- `pages/Dashboard.jsx` — greeting, AI insight card, sessions table
- `pages/dashboard/{ActiveSessions,History,SavedTutors,Billing,Settings}.jsx`
- `pages/NewDoubt.jsx` — 3-step flow with stepper, **Monaco code editor** (Step 1), AI triage UI, tier selector + tutor cards, Stripe redirect
- **`pages/Session.jsx` — live WebSocket chat with auto-scroll + "Live" indicator, per-session video iframe (Jitsi/configurable), Monaco shared code editor, timer, Resolution modal on End**
- `pages/TutorApply.jsx`
- `context/AuthContext.jsx` (memoized), `components/ProtectedRoute.jsx`
- `components/marketing/*`, `components/dashboard/DashboardLayout.jsx`

### Verified by testing_agent_v3
- **iteration_1**: 19/20 backend pass; full marketing + auth + new-doubt + session work
- **iteration_2**: 14/14 new dashboard endpoints pass; Monaco + sidebar routes + refund flow verified
- **iteration_3**: 15/15 new WebSocket/chat tests pass; 33/34 regression; live chat broadcast, persistence, canned replies, Jitsi iframe per-session URL all verified end-to-end

## Known Limitations (Feb 2026)
1. **EMERGENT_LLM_KEY budget exhausted** at the time of build → AI triage falls back to a clean "AI unavailable, get a human" state. Top up → real Claude Sonnet 4.5 returns immediately.
2. **Stripe payment status polling (502)** — Emergent's Stripe test-mode proxy occasionally returns 404 immediately after checkout creation. Real Stripe key would resolve.
3. **Video provider is Jitsi**, not Daily.co — public Daily room URLs are not available without a Daily account/domain. Per-session rooms work via `https://meet.jit.si/unstuck-{session_id}`. Configurable via `REACT_APP_VIDEO_BASE_URL` so a Daily-hosted URL can be swapped in once a domain is provisioned.
4. **WebSocket chat is single-pod**; horizontal scaling needs a Redis pub/sub adapter.

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
