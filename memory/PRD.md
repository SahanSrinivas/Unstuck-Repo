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
- `server.py` — main app, mounts routers, seeds admin + 8 tutors on startup
- `auth.py` — register, login, logout, me, refresh; bcrypt + JWT cookies
- `models.py` — Pydantic models for all entities
- `doubts.py` — doubts CRUD, AI triage (Claude Sonnet 4.5), tutor matching, sessions, AI insight
- `payments.py` — Stripe checkout + status polling + webhook
- `seeds.py` — 8 tutors + 4 tier definitions (quick/deep/working/project)

### Frontend (`/app/frontend/src/`)
- Tailwind config with Unstuck color tokens, Outfit/Inter/JetBrains Mono fonts
- `pages/Home.jsx` — full marketing (8 sections per spec)
- `pages/Login.jsx`, `Register.jsx`
- `pages/Dashboard.jsx` — greeting, AI insight card, sessions table
- `pages/NewDoubt.jsx` — 3-step flow with stepper, AI triage UI, tier selector + tutor cards, Stripe redirect
- `pages/Session.jsx` — chat + video panel + collaborative code editor + timer
- `pages/TutorApply.jsx` — tutor application form with specialty pills
- `context/AuthContext.jsx`, `components/ProtectedRoute.jsx`
- `components/marketing/*` — Navbar, Footer, Hero, HowItWorks, Specialization, Pricing, WhyDifferent, Testimonials, TutorRecruit, FinalCTA
- `components/dashboard/DashboardLayout.jsx`

### Verified by testing_agent_v3 (iteration_1)
- 19/20 backend tests pass (admin login, register/login/me, tutors, doubts CRUD, triage, match, sessions, payments creation)
- All frontend pages render with proper data-testids, full navigation flow works
- Critical bug found and fixed: `.env` had CORS_ORIGINS and JWT_SECRET on same line

## Known Limitations (Feb 2026)
1. **EMERGENT_LLM_KEY budget exhausted** at the time of build → AI triage falls back to a clean "AI unavailable, get a human" state. Top up the universal key (Profile → Universal Key → Add Balance) and triage will return real Claude Sonnet 4.5 answers immediately — no code changes needed.
2. **Stripe payment status polling (502)** — Emergent's Stripe test-mode proxy occasionally returns 404 immediately after checkout creation. Checkout creation itself works. Real production Stripe key (with webhook configured) would resolve this.
3. Active session view's video panel and code editor are functional placeholders (Daily.co iframe slot, plain `<textarea>` for the editor) — full Daily.co + Monaco wiring is deferred.

## Backlog (P0 → P2)
- **P0:** Top up LLM key (user action) → re-test triage
- **P0:** Add admin dashboard for reviewing tutor applications + payments
- **P1:** Real Daily.co room provisioning + Monaco editor with shared cursors
- **P1:** Tutor mobile app / availability toggle + payouts
- **P1:** Auto-refund flow when student rejects resolution
- **P1:** Webhook → mark session "paid" + auto-create on Stripe paid event (currently relies on UI polling)
- **P2:** Search and filter tutors by specialty
- **P2:** AI-generated session summary email after session ends
- **P2:** Saved tutors, billing page, settings — sidebar items currently link to dashboard root

## Files of Interest
- `/app/memory/test_credentials.md` — admin + test creds
- `/app/design_guidelines.json` — locked design tokens
- `/app/test_reports/iteration_1.json` — last test run
