# Kajo Current Status

Last updated: **2026-08-29**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 007 — Event Engine** (`sprints/SPRINT-007.md`)
Last completed sprint: **Sprint 006 — Backend Foundation** (`sprints/SPRINT-006.md`)

This is the authoritative current-state document.

## Current state

Sprints 001–006 are complete. Kajo is a phone-runnable Expo/React Native app with:

- a personal 2D Room and one global three-state DiscoveryMode curtain,
- BOOK/MOVIE grid discovery, Item details and optional swipe-style browsing,
- generic interest, saved and consumed state with exact recent undo and consumed history,
- Supabase/PostgreSQL/Auth configured through one mobile data boundary,
- unique email + unique display-cased nickname registration,
- native email confirmation, email-or-nickname password login and password recovery,
- one PersonalProfile per signed-in User,
- membership-protected BOOK/MOVIE current-interaction persistence and hydration.

Sprint 006 was accepted on a configured standalone Android build from merged main commit `3f7d79018d8bbdeacaec01e472e57b8d62d83d0c`. The complete registration/confirmation/login and password-recovery/new-password/login flows passed on a real phone. PersonalProfile entry, BOOK + MOVIE interactions, exact undo, restart hydration and sign-out/sign-in persistence also passed. A read-only database check confirmed persisted BOOK and MOVIE rows after the device flow.

The final Sprint 006 implementation state passed `npm run check` with lint, TypeScript typecheck, 71 tests and iOS/Android bundle smoke checks. Hosted verification, password-update and subsequent login operations succeeded. No account identifiers or secrets are stored in project documentation.

## MVP progress

Completed through Sprint 006:

- `MVP-FOUND-001..003`
- `MVP-AUTH-001..002`
- `MVP-ROOM-001..005`
- `MVP-DISC-001..007`
- `MVP-SWIPE-001..006`
- `MVP-MEM-001..002`
- `MVP-PROFILE-001`

Sprint 007 targets:

- `MVP-DATA-001` — meaningful discovery behaviour through one generic Event interface,
- `MVP-DATA-002` — recommendation impressions traceable to `predictionId`,
- `MVP-PROFILE-003` — Events retain `actorUserId` separately from `profileId`.

Still later in MVP: rating/memory extension, SharedProfiles/social behavior, Prediction V0 and scenario-memory foundations. See `../product/MVP.md` for the complete executable boundary.

## Active Sprint 007 — Event Engine

Sprint 007 turns meaningful behavior into append-only learning evidence without replacing the current interaction snapshot used to render/hydrate the UI.

Issue #85 / PRs #87 and #88 delivered and deployed the first scoped implementation step:

- reproducible generic Event and session persistence,
- separate actor User and Profile context with database-enforced session consistency,
- domain-agnostic Event names independent of visible labels,
- authenticated membership-scoped append/read access with no client update/delete path,
- stable retry IDs and indexed Profile/actor/Item/session/prediction paths, including both composite foreign keys,
- one typed/testable Supabase persistence boundary,
- unchanged accepted auth, PersonalProfile and current-interaction behavior.

Both committed migrations are applied to the configured Supabase project. Schema, RLS, grants and constraints were inspected after deployment. A rollback-only RLS smoke proved that the permitted Profile member can append/read a session and Event, an unrelated identity sees neither row, and no test rows remain. The performance advisor reports no unindexed Event foreign keys; new-table unused-index INFO entries are expected until Event emission starts.

Issue #89 is the active user-facing integration: emit the existing impression/open/interest/save/consume/DiscoveryMode behavior with session and prediction correlation, define explicit undo compensation, and include the two deferred auth-return/startup-logo polish fixes in the same acceptance build. Prediction V0 remains Sprint 008; Sprint 007 must not move ranking logic into the mobile client.

## Exact next actions

1. Follow Issue #89 and `sprints/SPRINT-007.md`.
2. Define the explicit append-only undo compensation semantics in `DATA_EVENTS.md` before emitting reversal behavior.
3. Add stable mobile session/recommendation correlation and meaningful deduplicated Event emission through the existing boundary.
4. In the same user-facing change, fix auth return-to-login task behavior and enlarge the visible startup lettering to nearly full phone width.
5. Run `npm run check`, merge only with green PR CI, deploy any committed callback change and produce one configured Android acceptance build.
6. Phone-test the integrated Event rows, existing interaction persistence/undo, both auth email flows/return action and startup logo before closing Sprint 007.

## Known issues / open decisions

- Auth success is correct, but `Palaa Kajoon` can return to the email app's previous task instead of foregrounding Kajo login. Issue #89 owns the fix.
- Startup lettering must be enlarged to nearly the full screen width while retaining Android-compatible PNG output. Issue #89 owns the fix and phone check.
- Google and Apple authentication remain separately tracked in Issue #73 and are not a Sprint 007 prerequisite.
- Current mode-dependent Item ordering is mock discovery logic, not Prediction V0.
- Final book/movie metadata providers are not locked.
- Current Room/theme/mock covers remain structural rather than final production artwork.
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
- `/docs/project/sprints/SPRINT-006.md`
- `/docs/project/sprints/SPRINT-007.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/events/eventPersistence.ts`
- `/apps/mobile/src/features/auth/`
- `/apps/mobile/src/features/profiles/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/config.toml`
- `/supabase/functions/auth-callback/index.ts`
- `/supabase/functions/password-auth/index.ts`
- `/supabase/migrations/`
- `/supabase/migrations/20260829211800_event_persistence_foundation.sql`
- `/supabase/migrations/20260829213200_event_foreign_key_indexes.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 006 is accepted and complete. Sprint 007 is the only active sprint. Issue #85's generic Event/session persistence foundation is merged, deployed and RLS/advisor verified. Continue with Issue #89's mobile Event integration plus the two explicitly bundled phone-polish fixes. Preserve the accepted auth/current-interaction flows, and do not begin Prediction V0 or SharedProfile work early.
