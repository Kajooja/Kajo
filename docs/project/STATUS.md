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

- persistent `SHARED` Profiles using the existing `profiles` + `profile_members` model,
- membership-protected create/add/list RPCs with 2+ member readiness,
- host-verified non-member isolation and email-free member payloads,
- one generic `ActiveProfileProvider` where PersonalProfile is the safe default and ready SharedProfiles can become active,
- Event, interaction persistence/hydration and Prediction V0 scoped by active `profileId` while retaining the signed-in User as `actorUserId`,
- typed SharedProfile list/create/member operations with validation,
- a visible Room entry plus `/profiles/shared` setup/selection flow,
- active Room identity (`OMA KAJO` / `YHTEINEN KAJO`).

PR #120 completed the visible Shared Kajo setup flow. Its PR CI passed lint, TypeScript,
all tests and iOS/Android bundle smoke. The resulting main standalone Android APK also
built successfully, its embedded JS bundle was verified and the APK artifact uploaded.

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

Sprint 009 #111 backend acceptance passed rollback-only hosted tests for provisional
creation, case-insensitive second-member add, readiness, duplicate idempotency,
creator/member listing, outsider isolation, non-member add denial and email-free
payload. PR #114 fixed the one PL/pgSQL conflict-target ambiguity found during that
verification. Advisors showed no new SharedProfile-specific warning.

PR #116 completed the generic active Profile scope. PR #119 completed typed SharedProfile
create/member operations. PR #120 completed the first visible Shared Kajo setup/selection
surface and produced a successful standalone Android build.

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
- `MVP-ROOM-006` — SharedProfile-specific shared Room/theme identity,
- `MVP-SOCIAL-001` — joint saved Items,
- `MVP-SOCIAL-002` — browse/swipe in SharedProfile context,
- `MVP-SOCIAL-003` — suggest an Item inside a SharedProfile.

The persistence, active-scope and visible setup foundations now exist. Sprint 009 remains
open until shared runtime behavior, theme identity, suggestion behavior and final Android/
hosted acceptance are complete.

Saved/Consumed persistent list navigation remains Sprint 010. ScenarioMemory remains Sprint 011.

## Active Sprint 009 — Shared Kajo

Completed:

1. SharedProfile/member persistence and authorization — **#111 complete**.
2. Typed SharedProfile listing + generic active Profile scope — **#115 complete**.
3. Typed SharedProfile create/member mutation boundary — **#118 complete**.
4. Room entry and visible SharedProfile setup/selection — **#117 complete**.

Active:

5. Stable SharedProfile-specific Room/theme identity — **#121 active**.

#121 preserves the PersonalProfile palette exactly while assigning SharedProfiles one of
a small restrained base-theme set deterministically from `profileId`. DiscoveryMode remains
an independent ambient overlay (`DAWN`, `EVENING`, `NIGHT`), so visual identity does not
change recommendation risk. The global shell, Room and discovery grid consume the active
Profile identity directly; the shell carries the same subtle identity across Item detail
and Shared setup surfaces without introducing a duplicate theme provider.

Remaining Sprint 009 order:

6. verify shared discovery/save/rating/Prediction/Event behavior in configured runtime,
7. add traceable `ITEM_SUGGESTED` behavior,
8. configured Android + hosted authorization/Event acceptance, then close Sprint 009.

Do not start ScenarioMemory, feed/follower mechanics, general messaging or a separate SharedProfile predictor.

## Exact next actions

1. Finish #121 CI and merge only if lint/typecheck/tests/iOS+Android bundle smoke pass.
2. Build the resulting main APK and test PersonalProfile ↔ ready SharedProfile switching with two real Kajo accounts.
3. Confirm shared interactions hydrate/persist under the SharedProfile, Prediction V0 ranks that Profile, and Events retain the real actor User.
4. Add the smallest traceable `ITEM_SUGGESTED` action without introducing chat/feed semantics.
5. Run configured Android and hosted acceptance before marking Sprint 009 requirements complete.

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
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-009.md`
- `/apps/mobile/app/profiles/shared.tsx`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/profiles/activeProfileState.ts`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/apps/mobile/src/theme/roomTheme.test.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 009 #111, #115, #118 and #117 are complete. #121 is active. Preserve one generic
Profile-targeted data/prediction architecture and actor-vs-profile Event separation.
After #121, verify shared runtime behavior before implementing suggestion semantics.
Do not begin ScenarioMemory early.
