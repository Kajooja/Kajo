# Kajo Current Status

Last updated: **2026-08-31**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 009 — Shared Kajo** (`sprints/SPRINT-009.md`)
Last completed sprint: **Sprint 008 — Prediction V0** (`sprints/SPRINT-008.md`)

This is the authoritative current-state document.

## Current state

Sprints 001–008 are complete. Kajo is a phone-runnable Expo/React Native app with:

- a minimalist 2D Room as the home/navigation surface,
- a persistent Kajo logo that always returns to the Room,
- one global three-state DiscoveryMode curtain,
- BOOK/MOVIE grid discovery, Item detail and optional swipe-style browsing,
- hosted generic Prediction V0 targeting Profile,
- 0–10 consumed rating, not-interested and save semantics with exact recent undo,
- temporary impression cooldown and a 12 BOOK + 12 MOVIE MVP candidate catalog,
- Supabase/PostgreSQL/Auth behind typed mobile boundaries,
- unique email + unique nickname identity and email-or-nickname login,
- append-only Event/session persistence with actor/Profile/prediction correlation.

Sprint 009 additionally has:

- persistent `SHARED` Profiles through existing `profiles` + `profile_members`,
- membership-protected create/add/list RPCs with 2+ readiness and hosted isolation verification,
- one generic active Profile scope shared by PersonalProfile and ready SharedProfiles,
- Event, interaction persistence/hydration and Prediction V0 scoped by active `profileId` while retaining the signed-in User as `actorUserId`,
- typed SharedProfile operations,
- Room entry plus `/profiles/shared` setup/selection,
- active Room identity and stable SharedProfile-specific visual base identity that remains separate from DiscoveryMode ambient/risk.

PR #120 produced a successful standalone Android APK. PR #122 completed SharedProfile
visual identity after its full CI gate passed.

## Acceptance history

Sprint 006 configured Android acceptance passed registration, confirmation, login,
password recovery, BOOK/MOVIE interactions, exact undo, restart hydration and
sign-out/sign-in persistence.

Sprint 007 configured Event acceptance passed. Item-linked Events retained
`predictionId` correlation and undo Events referenced valid originals for the same
Item, actor, Profile and session.

Sprint 008 configured Android acceptance passed on 2026-08-31 after Prediction
`v0.3` deployment. The accepted flow includes the broader catalog, global
DiscoveryMode, feedback drawer, rating/not-interested evidence, queue rotation and
impression cooldown.

Sprint 009 #111 backend acceptance passed rollback-only hosted membership/readiness/
isolation checks. PR #116 completed active Profile scope, PR #119 typed SharedProfile
mutations, PR #120 visible Shared Kajo setup/selection and PR #122 stable Shared Room
identity. All merged PRs passed their required CI gates.

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
- `MVP-ROOM-006` — SharedProfile-specific Room/theme identity,
- `MVP-SOCIAL-001` — joint saved Items,
- `MVP-SOCIAL-002` — browse/swipe in SharedProfile context,
- `MVP-SOCIAL-003` — suggest an Item inside a SharedProfile.

Core persistence, active-scope, setup and Room-identity foundations are implemented.
Sprint 009 remains open for traceable Item suggestion and configured runtime acceptance
of shared interactions/Prediction/Event actor-vs-profile behavior.

Saved/Consumed persistent list navigation remains Sprint 010. ScenarioMemory remains Sprint 011.

## Active Sprint 009 — Shared Kajo

Completed:

1. SharedProfile/member persistence and authorization — **#111 complete**.
2. Typed SharedProfile listing + generic active Profile scope — **#115 complete**.
3. Typed SharedProfile create/member mutation boundary — **#118 complete**.
4. Room entry and visible SharedProfile setup/selection — **#117 complete**.
5. Stable SharedProfile-specific Room/theme identity — **#121 complete**.

Active:

6. Traceable Item suggestion — **#123 active**.

#123 uses the existing canonical `ITEM_SUGGESTED` Event. A restrained shell-level
control is eligible only on a valid Item detail while a SharedProfile is active. It
records through `EventTrackingContext`, so the acting User and active SharedProfile
remain distinct and existing retry-safe Event persistence is reused. Suggestion is
orthogonal to save/rating/not-interested/consumed current state and does not introduce
chat, feed, recipient read-state or a new suggestion table.

Remaining Sprint 009 order:

7. verify SharedProfile save/rating/Prediction/Event behavior in configured runtime,
8. configured Android + hosted authorization/Event acceptance, then close Sprint 009.

Do not start ScenarioMemory, feed/follower mechanics, general messaging or a separate SharedProfile predictor.

## Exact next actions

1. Finish #123 CI and merge only if lint/typecheck/tests/iOS+Android bundle smoke pass.
2. Use the resulting main APK for PersonalProfile ↔ ready SharedProfile acceptance with two Kajo accounts.
3. Confirm save/rating state is isolated by `profileId`, Prediction V0 ranks the SharedProfile and Event rows retain the real actor User.
4. Confirm `ITEM_SUGGESTED` persists in SharedProfile context without mutating Item current state.
5. Run hosted authorization/Event checks and close Sprint 009 only after configured Android acceptance.

## Known issues / open decisions

- Startup-logo sizing remains optional polish under Issue #78 and does not block MVP work.
- Google and Apple authentication remain separately tracked in Issue #73.
- Final book/movie metadata providers are not locked.
- Current Room/theme/mock covers remain structural rather than final artwork.
- Current Item feature volume is small, so Prediction V0 retains explicit cold-start prior/fallback behavior.
- Prediction V0 currently uses an authenticated Postgres RPC; a dedicated service remains a later scale/tooling decision.
- Supabase advisors expose pre-existing security-hardening warnings unrelated to Sprint 009; handle them separately.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-009.md`
- `/apps/mobile/app/profiles/shared.tsx`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/discovery/sharedSuggestion.ts`
- `/apps/mobile/src/features/discovery/sharedSuggestion.test.ts`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/apps/mobile/src/features/events/`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 009 #111, #115, #118, #117 and #121 are complete; #123 is active. Preserve one
generic Profile-targeted architecture and actor-vs-profile Event separation. After #123,
perform configured SharedProfile runtime acceptance before closing Sprint 009. Do not
begin ScenarioMemory early.
