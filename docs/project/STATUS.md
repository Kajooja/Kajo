# Kajo Current Status

Last updated: **2026-08-31**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 008 — Prediction V0** (`sprints/SPRINT-008.md`)
Last completed sprint: **Sprint 007 — Event Engine** (`sprints/SPRINT-007.md`)

This is the authoritative current-state document.

## Current state

Sprints 001–007 are complete. Kajo is a phone-runnable Expo/React Native app with:

- a personal 2D Room and one global three-state DiscoveryMode curtain,
- BOOK/MOVIE grid discovery, Item details and optional swipe-style browsing,
- generic interest, saved and consumed state with exact recent undo and consumed history,
- Supabase/PostgreSQL/Auth configured through typed mobile data boundaries,
- unique email + unique display-cased nickname registration,
- native email confirmation, email-or-nickname password login and password recovery,
- one PersonalProfile per signed-in User,
- membership-protected BOOK/MOVIE current-interaction persistence and hydration,
- append-only Event/session persistence with actor, Profile, Item, prediction and undo correlation.

Sprint 006 auth, PersonalProfile and current-interaction flows passed on a configured standalone Android build. Registration, confirmation, login, password recovery, BOOK/MOVIE interactions, exact undo, restart hydration and sign-out/sign-in persistence all passed.

Sprint 007 Event integration also passed on the configured Android app. The phone run covered BOOK and MOVIE discovery, a DiscoveryMode change, Item opens/actions and exact undo. Its hosted result contained 34 Events for one actor, one Profile and one session. All 32 Item-linked Events retained `predictionId`; none lacked correlation. All four undo Events referenced a valid original Event for the same Item, actor, Profile and session. No account identifier or secret is stored in project documentation.

The final Sprint 007 state passed `npm run check` with lint, TypeScript, 87 tests and iOS/Android bundle smoke checks. Event migrations, RLS, grants, constraints, foreign-key indexes and hosted advisors were verified.

## MVP progress

Completed through Sprint 007:

- `MVP-FOUND-001..003`
- `MVP-AUTH-001..002`
- `MVP-ROOM-001..005`
- `MVP-DISC-001..006`; `MVP-DISC-007` reopened for the persistent shared-mode control
- `MVP-SWIPE-001`, `MVP-SWIPE-006`; `MVP-SWIPE-002..005` reopened for the rating-drawer/queue model
- `MVP-MEM-001..002`
- `MVP-PROFILE-001`, `MVP-PROFILE-003`
- `MVP-DATA-001..002`

Sprint 008 targets:

- `MVP-PRED-001` — generic personalized Item ranking for a Profile,
- `MVP-PRED-002` — combine longer-term behavior, recent context and Item similarity,
- `MVP-PRED-003` — make DiscoveryMode change ranking semantics.

The 0–10 rating input is now active Sprint 008 scope; Saved/Consumed list navigation remains Sprint 010. SharedProfiles/social behavior and scenario-memory foundations remain later MVP work. See `../product/MVP.md` for the complete executable boundary.

## Active Sprint 008 — Prediction V0

Sprint 008 replaces mock ordering with the first real generic, server-owned personalized scorer. Issue #46 remains the product-loop parent. Issue #95 establishes the first bounded implementation as the authenticated `public.rank_items_v0` Postgres RPC:

- an authenticated request boundary for Profile, Context, DiscoveryMode and candidate scope,
- a traceable `predictionId` for every returned ranking,
- one deterministic BOOK/MOVIE-generic scorer over current Item and Event evidence,
- longer-horizon positive/negative behavior, recency/short-term context, Item similarity, consumed suppression and mode semantics,
- deterministic fallback behavior for sparse/cold-start evidence,
- authorization, explainability and hosted verification without writing test data to a real Profile.

PR #97 is merged and the migration is deployed. Hosted functional, mode,
suppression, authorization, grant and advisor checks passed without retaining
test data. Issue #95 is complete and Issue #98 is merged. Configured-phone
feedback drove #100 (persistent mode bar), while #101
(rating/not-interested/save drawer) and #103 (cooldown/catalog). #102 records
later Saved/Consumed list navigation. The mobile client consumes ranking
results; it does not own ranking logic.

## Exact next actions

1. Complete #101's 0–10 slider drawer and Prediction V0 scorer inputs on top of the deployed canonical state foundation.
2. Implement #103's impression cooldown and broader normalized test catalog.
3. Produce a configured Android build and verify mode persistence, queue rotation plus hosted `predictionId`/feedback Events.
4. Close Sprint 008 and its reopened/Prediction MVP requirements only after configured acceptance passes.

## Known issues / open decisions

- Startup-logo sizing is optional visual polish under Issue #78 and does not block MVP work.
- Google and Apple authentication remain separately tracked in Issue #73.
- Final book/movie metadata providers are not locked.
- Hosted Prediction V0 consumption is merged, but configured Event evidence with `predictionSource = hosted` remains pending in the next acceptance build.
- Current Room/theme/mock covers remain structural rather than final production artwork.
- The current Item feature set and Event volume are small, so Prediction V0 needs an explicit cold-start prior.
- Prediction V0.1 uses an authenticated Postgres RPC; a dedicated Python service remains a later scale/tooling decision.
- SharedProfile Room/theme/discovery identity remains later scope.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-007.md`
- `/docs/project/sprints/SPRINT-008.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/config.toml`
- `/supabase/migrations/`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 007 is accepted and complete. Sprint 008's scorer (#95), mobile
consumption (#98), persistent mode bar (#100) and #101 state foundation are
merged. Complete #101's slider/scorer slices, then #103. #102 belongs to Sprint
010. Do not move scoring into the mobile client or begin
ScenarioMemory/SharedProfile work early.
