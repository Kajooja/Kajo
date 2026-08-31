# Kajo Current Status

Last updated: **2026-08-31**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 009 — Shared Kajo, final acceptance (#125)** (`sprints/SPRINT-009.md`)
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

Sprint 009 implementation is now complete and awaiting only configured Android acceptance:

- persistent `SHARED` Profiles through existing `profiles` + `profile_members`,
- membership-protected create/add/list RPCs with 2+ readiness,
- one generic active Profile scope shared by PersonalProfile and ready SharedProfiles,
- Event, interaction persistence/hydration and Prediction V0 scoped by active `profileId` while retaining the signed-in User as `actorUserId`,
- typed SharedProfile operations,
- Room entry plus `/profiles/shared` setup/selection,
- active Room identity and deterministic SharedProfile-specific visual base identity separate from DiscoveryMode,
- contextual `Ehdota yhteiseen` action writing canonical `ITEM_SUGGESTED` without changing Item current state.

PR #124 merged the final feature slice. Its PR CI passed lint, TypeScript, all tests and
iOS/Android bundle smoke. The corresponding `main` validate job is also green; standalone
Android APK build is the remaining automated job for that main commit.

## Acceptance history

Sprint 006 configured Android acceptance passed registration, confirmation, login,
password recovery, BOOK/MOVIE interactions, exact undo, restart hydration and
sign-out/sign-in persistence.

Sprint 007 configured Event acceptance passed with prediction/undo correlation intact.

Sprint 008 configured Android acceptance passed on 2026-08-31 after Prediction `v0.3`
deployment, including broader catalog, global DiscoveryMode, feedback drawer,
rating/not-interested evidence, queue rotation and impression cooldown.

Sprint 009 backend/membership foundation previously passed rollback-only hosted tests.
After all feature slices were merged, a broader hosted pre-acceptance was run with three
temporary auth Users A/B/C using the real provisioning trigger, authenticated role, RLS
and production RPCs. **14/14 checks passed and all rows were rolled back.**

Verified hosted behavior:

- PersonalProfiles provisioned for A/B/C,
- SharedProfile provisional at one member and ready after case-insensitive B addition,
- shared saved/rated state isolated from A's PersonalProfile,
- `ITEM_SUGGESTED` retained A as actor, SharedProfile as profile, correct Item/type/mode/source,
- B listed the SharedProfile and read shared state/Event while actor remained A,
- Prediction V0 returned rankings for B in the SharedProfile,
- outsider C could not list/read shared data or Events,
- C interaction write failed RLS,
- C Prediction call failed with `42501 Profile access denied`.

Supabase advisors show no new Sprint 009-specific warning. Existing legacy SECURITY DEFINER,
leaked-password protection and unused-index notices remain separately scoped technical debt.

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

Sprint 009 implementation exists for:

- `MVP-PROFILE-002` — persistent 2-N member SharedProfile,
- `MVP-ROOM-006` — SharedProfile-specific Room/theme identity,
- `MVP-SOCIAL-001` — joint Profile-scoped saved/current Item state,
- `MVP-SOCIAL-002` — browse/swipe/Prediction in SharedProfile context,
- `MVP-SOCIAL-003` — traceable Item suggestion inside SharedProfile.

These Sprint 009 requirements are not marked finally accepted until #125 real-device flow passes.
Saved/Consumed persistent list navigation remains Sprint 010. ScenarioMemory remains Sprint 011.

## Active gate — #125 configured SharedProfile end-to-end acceptance

Use two real Kajo accounts and the current main APK to validate:

1. A creates a SharedProfile and adds B by nickname; both see the same ready profile without auth email exposure.
2. Personal ↔ Shared switching changes Room identity/theme and returns to the correct context without restart.
3. A saves/rates in SharedProfile; state persists and remains separate from A PersonalProfile.
4. B enters the same SharedProfile and sees the shared current Item state while B PersonalProfile remains separate.
5. Prediction V0 ranks under the SharedProfile for both members.
6. `Ehdota yhteiseen` persists suggestion evidence without changing save/rating/not-interested/consumed state.
7. Kajo logo → Room, DiscoveryMode curtain and existing PersonalProfile behavior remain intact.

After device confirmation, verify the concrete hosted rows from that session, close #125,
mark Sprint 009/MVP requirements accepted and proceed to Sprint 010. Fix only concrete
acceptance failures before then; do not add new social architecture.

## Exact next actions

1. Finish current main standalone APK build and use that artifact for #125.
2. Run the two-account Android checklist above.
3. Inspect resulting shared `item_interactions`, Events and Prediction authorization.
4. If all pass, close Sprint 009 and update MVP/status/roadmap.

## Known issues / open decisions

- Startup-logo sizing remains optional polish under Issue #78 and does not block MVP work.
- Google and Apple authentication remain separately tracked in Issue #73.
- Final book/movie metadata providers are not locked.
- Current Room/theme/mock covers remain structural rather than final artwork.
- Current Item feature volume is small, so Prediction V0 retains explicit cold-start prior/fallback behavior.
- Prediction V0 currently uses an authenticated Postgres RPC; a dedicated service remains a later scale/tooling decision.
- Existing Supabase advisor findings remain separately scoped hygiene/security debt.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
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
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

All Sprint 009 implementation is merged and hosted pre-acceptance is 14/14 green. #125
is the final real-device gate. Do not start ScenarioMemory or new social architecture
before this acceptance is complete.
