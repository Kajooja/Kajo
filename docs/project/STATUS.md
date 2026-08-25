# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 002 — Room** (`sprints/SPRINT-002.md`)
Last completed sprint: **Sprint 001 — Foundation** (`sprints/SPRINT-001.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation is complete and `main` is green.

Sprint 002 implementation is active through Issue #7 / PR #9 on branch `feat/7-room-shell`.

The Room branch currently contains:

- first minimalist 2D Room home surface under `apps/mobile/src/features/room/`,
- window, fireplace, bookshelf and movie screen/projector representations,
- accessible bookshelf and movie-screen navigation affordances,
- mock book/movie destination routes that establish navigation boundaries without implementing discovery,
- updated CODEMAP pointing to the real Room implementation.

The theme engine, curtain interaction, real discovery UI, backend and prediction logic remain intentionally absent.

## MVP progress

See `../product/MVP.md`.

Completed Foundation requirements:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`

Sprint 002 targets:

- `MVP-ROOM-001`
- `MVP-ROOM-002`

`MVP-ROOM-003` and `MVP-ROOM-004` are only groundwork in PR #9 because the current destinations are explicit placeholders rather than real discovery experiences.

Do not mark Room requirements complete until PR #9 is validated, accepted and merged and the actual requirement acceptance criteria are verified.

## In progress

- Sprint 002 — Room.
- Issue #7 — first Room shell.
- PR #9 — first Room shell; CI validation pending/current.

## Next

1. Confirm PR #9 CI passes locked install, lint, typecheck, tests and iOS/Android bundle smoke checks.
2. Review the Room shell against Sprint 002 UX constraints and accessibility semantics.
3. Merge PR #9 only when validated.
4. Continue Sprint 002 only with work required by its Definition of Done; do not pull Sprint 003 curtain/theme scope forward.
5. Close Sprint 002 only after its full Definition of Done is met and repository handoff documentation is current.

## Known issues / open decisions

- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- Exact visual art direction of the Room will continue to iterate during Sprint 002; current Room styling is structural, not final production art.
- Theme engine and curtain interaction belong to Sprint 003.
- Real book/movie discovery belongs to a later discovery sprint; PR #9 placeholders must not be interpreted as completed discovery.
- Prediction V0 implementation remains deferred.

## Important files

- `/AGENTS.md`
- `/README.md`
- `/package.json`
- `/package-lock.json`
- `/apps/mobile/app/index.tsx`
- `/apps/mobile/app/discovery/`
- `/apps/mobile/src/features/room/`
- `/apps/mobile/src/domain/`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-002.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Continue **Sprint 002 — Room** from Issue #7 / PR #9. Validate the current Room shell before merging. Do not mark `MVP-ROOM-003/004` complete from the mock destination routes and do not implement Sprint 003 curtain/theme behaviour in this change.
