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

Issue #85 is the first scoped implementation step:

- add reproducible generic Event and session persistence,
- retain actor User and Profile context separately,
- keep event names domain-agnostic and independent of visible labels,
- protect reads/writes through authenticated profile membership,
- add one typed/testable data boundary,
- preserve the accepted auth, PersonalProfile and current-interaction behavior.

After that foundation is merged, open the next Issue to emit the existing impression/open/interest/save/consume/DiscoveryMode actions with session and prediction correlation. Prediction V0 remains Sprint 008; Sprint 007 must not move ranking logic into the mobile client.

## Exact next actions

1. Follow Issue #85 and `sprints/SPRINT-007.md`.
2. Add the append-only Event/session migration and least-privilege authorization without editing already-applied migrations.
3. Add the smallest typed persistence boundary and deterministic contract/security tests.
4. Run `npm run check`, review repository hygiene and merge the scoped PR only when green.
5. Deploy the committed migration to the configured Supabase project and verify append/read authorization.
6. Then open the mobile event-emission Issue; in that next user-facing mobile change also fix the two accepted Sprint 006 polish items listed below.

## Known issues / open decisions

- Auth success is correct, but `Palaa Kajoon` can return to the email app's previous task instead of foregrounding Kajo login. Fix this in the next user-facing mobile change.
- Startup lettering must be enlarged to nearly the full screen width while retaining Android-compatible PNG output. Fix and phone-check it in the same next user-facing mobile change.
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
- `/apps/mobile/src/features/auth/`
- `/apps/mobile/src/features/profiles/`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/config.toml`
- `/supabase/functions/auth-callback/index.ts`
- `/supabase/functions/password-auth/index.ts`
- `/supabase/migrations/`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 006 is accepted and complete. Sprint 007 is the only active sprint. Begin with Issue #85 and keep it limited to the generic append-only Event/session persistence foundation. Preserve the accepted phone-tested auth and interaction flows, and do not begin Prediction V0 or SharedProfile work early.
