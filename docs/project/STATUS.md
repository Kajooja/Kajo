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
- hosted generic Prediction V0 targeting Profile rather than media-specific user models,
- longer-term/recent behavioural evidence, Item tags/features and DiscoveryMode exploration policy,
- 0–10 consumed rating, not-interested and save semantics with exact recent undo,
- temporary impression cooldown and stronger explicit-reaction queue rotation,
- 12 normalized BOOK and 12 MOVIE MVP candidates,
- Supabase/PostgreSQL/Auth through typed mobile data boundaries,
- unique email + unique nickname registration and email-or-nickname login,
- one PersonalProfile per signed-in User,
- append-only Event/session persistence with actor, Profile, Item, prediction and undo correlation.

Sprint 009 backend foundation now also supports persistent `SHARED` Profiles through
the existing generic `profiles` + `profile_members` model. Authenticated members can
create a provisional SharedProfile, add another existing Kajo User by case-insensitive
nickname and list only SharedProfiles they belong to. A SharedProfile becomes product-ready
at 2+ members. The API returns nickname/user id only and does not expose auth email.

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
rotation and temporary impression cooldown.

Sprint 009 Issue #111 backend acceptance passed with rollback-only hosted tests:
provisional creation, case-insensitive second-member add, 2+ readiness, duplicate
idempotency, creator/member listing, outsider isolation, non-member add denial and
email-free member payload all passed. Test rows were rolled back. PR #114 fixed the
one PL/pgSQL conflict-target ambiguity found by the hosted test. Security/performance
advisors show no new SharedProfile-specific warning.

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
Sprint 011.

## Active Sprint 009 — Shared Kajo

Completed first slice:

1. SharedProfile/member persistence and authorization — **complete (#111)**.

Current slice:

2. Typed SharedProfile mobile operations and generic active Profile context — **active (#115)**.

Issue #115 introduces one `ActiveProfileProvider` after PersonalProfile identity.
PersonalProfile remains the default. Only `isReady=true` SharedProfiles are selectable.
Event tracking, Item interaction hydration/persistence and Prediction V0 are being
refactored to consume this same active Profile while retaining the signed-in User as
`actorUserId`. SharedProfile-list loading/retry is independent from the personal flow.
Visible Profile-switching UI is intentionally deferred to the next bounded slice.

Remaining Sprint 009 order:

3. expose active Profile switching and SharedProfile setup in restrained UI,
4. verify shared discovery/saved/current-interaction behavior through existing boundaries,
5. add shared Room/theme identity and member suggestion behavior,
6. configured Android acceptance and hosted authorization/Event verification.

Do not start ScenarioMemory, feed/follower mechanics, general messaging or separate
SharedProfile-specific predictor implementations.

## Exact next actions

1. Finish #115 and merge only after lint/typecheck/tests/iOS+Android bundle smoke pass.
2. Add the minimal visible Personal/Shared Profile selector and SharedProfile setup flow.
3. Verify switching re-hydrates interactions and Prediction by `profileId` while Events retain the real actor User.
4. Then implement shared Room identity and traceable `ITEM_SUGGESTED` behavior.

## Known issues / open decisions

- Startup-logo sizing remains optional visual polish under Issue #78 and does not block MVP work.
- Google and Apple authentication remain separately tracked in Issue #73.
- Final book/movie metadata providers are not locked.
- Current Room/theme/mock covers remain structural rather than final production artwork.
- Current Item feature volume is small, so Prediction V0 retains explicit cold-start prior/fallback behavior.
- Prediction V0 currently uses an authenticated Postgres RPC; a dedicated service remains a later scale/tooling decision.
- Supabase advisors expose pre-existing security-hardening warnings unrelated to Sprint 009 changes; handle them separately.

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
- `/docs/project/sprints/SPRINT-009.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 008 is accepted and complete. Sprint 009 #111 is host-verified and complete;
#115 is active. Preserve one generic active Profile scope, Profile-targeted Prediction
and actor-vs-profile Event separation. Do not create a separate shared recommendation
model or begin ScenarioMemory early.
