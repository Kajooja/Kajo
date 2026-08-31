# Kajo Current Status

Last updated: **2026-08-31**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 009 — Shared Kajo** (`sprints/SPRINT-009.md`)
Last completed sprint: **Sprint 008 — Prediction V0** (`sprints/SPRINT-008.md`)

This is the authoritative current-state document.

## Current state

Sprints 001–008 are complete. Kajo is a phone-runnable Expo/React Native app with:

- a personal minimalist 2D Room as the home/navigation surface,
- a persistent Kajo brand mark in the authenticated app shell; pressing it returns to the Room,
- one global three-state DiscoveryMode curtain shared across Room/discovery/Item browsing,
- BOOK/MOVIE grid discovery, Item details and optional swipe-style browsing,
- a hosted generic Prediction V0 scorer targeting Profile rather than media-specific user models,
- longer-term/recent behavioural evidence, Item tags/features and DiscoveryMode exploration policy,
- 0–10 consumed rating, not-interested and save semantics with exact recent undo,
- temporary impression cooldown and stronger explicit-reaction queue rotation,
- 12 normalized BOOK and 12 MOVIE MVP candidates for configured ranking/cooldown testing,
- Supabase/PostgreSQL/Auth through typed mobile data boundaries,
- unique email + unique nickname registration and email-or-nickname login,
- one PersonalProfile per signed-in User,
- membership-protected current-interaction persistence and hydration,
- append-only Event/session persistence with actor, Profile, Item, prediction and undo correlation.

## Acceptance history

Sprint 006 configured Android acceptance passed registration, confirmation, login,
password recovery, BOOK/MOVIE interactions, exact undo, restart hydration and
sign-out/sign-in persistence.

Sprint 007 configured Event acceptance passed. Item-linked Events retained
`predictionId` correlation and undo Events referenced valid originals for the same
Item, actor, Profile and session.

Sprint 008 configured Android acceptance passed on 2026-08-31 after Prediction
`v0.3` deployment. The accepted flow includes the broader 12+12 catalog, global
DiscoveryMode, feedback drawer, rating/not-interested evidence, explicit queue
rotation and temporary impression cooldown. Repository CI passed lint, TypeScript,
tests and iOS/Android bundle smoke checks; hosted migrations/scorer and candidate
counts were verified after merge.

## MVP progress

Completed through Sprint 008:

- `MVP-FOUND-001..003`
- `MVP-AUTH-001..002`
- `MVP-ROOM-001..005`
- `MVP-DISC-001..007`
- `MVP-SWIPE-001..006`
- `MVP-MEM-001..003`
- `MVP-PROFILE-001`, `MVP-PROFILE-003`
- `MVP-DATA-001..002`
- `MVP-PRED-001..003`

Sprint 009 targets:

- `MVP-PROFILE-002` — persistent 2-N member SharedProfile,
- `MVP-ROOM-006` — SharedProfile can have its own shared Room/theme identity,
- `MVP-SOCIAL-001` — joint saved Items,
- `MVP-SOCIAL-002` — browse/swipe in SharedProfile context,
- `MVP-SOCIAL-003` — member can suggest an Item inside a SharedProfile.

Saved/Consumed persistent list navigation remains Sprint 010. ScenarioMemory remains
Sprint 011. See `../product/MVP.md` for the complete executable boundary.

## Active Sprint 009 — Shared Kajo

Sprint 009 introduces the first persistent multi-user Profile without creating a
parallel recommendation architecture. SharedProfile must reuse the existing generic
Profile target, Event correlation, Item state and Prediction boundaries.

The implementation order is deliberately narrow:

1. persistent SharedProfile + ProfileMember foundations and authorization,
2. active Profile-context selection/switching in the authenticated app,
3. shared discovery/saved state through the same generic data boundaries,
4. shared Room/theme identity and member suggestion behavior,
5. configured Android acceptance and hosted authorization verification.

Do not start ScenarioMemory, feed/follower mechanics, general messaging or separate
SharedProfile-specific predictor implementations.

## Exact next actions

1. Merge the Sprint 008 close/home-logo hygiene PR after CI passes.
2. Close completed Sprint 008 issues (#98, #100, #101, #103 and parent #46).
3. Start the first Sprint 009 implementation issue for SharedProfile/member persistence and RLS.
4. Keep Profile as the existing prediction/event target so PersonalProfile and SharedProfile use the same downstream contracts.

## Known issues / open decisions

- Startup-logo sizing remains optional visual polish under Issue #78 and does not block MVP work.
- Google and Apple authentication remain separately tracked in Issue #73.
- Final book/movie metadata providers are not locked.
- Current Room/theme/mock covers remain structural rather than final production artwork.
- Current Item feature volume is small, so Prediction V0 retains an explicit cold-start prior/fallback behavior.
- Prediction V0 currently uses an authenticated Postgres RPC; a dedicated service remains a later scale/tooling decision.
- Supabase advisors expose pre-existing security-hardening warnings unrelated to Prediction V0; handle them in a separately scoped hygiene/security task.

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
- `/docs/project/sprints/SPRINT-008.md`
- `/docs/project/sprints/SPRINT-009.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/apps/mobile/src/features/profiles/`
- `/supabase/config.toml`
- `/supabase/migrations/`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 008 is accepted and complete. Continue with Sprint 009 SharedProfile
foundations. Reuse Profile-targeted prediction/events and generic Item semantics;
do not create a separate shared recommendation model or begin ScenarioMemory early.
