# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 002 — Room** (`sprints/SPRINT-002.md`)
Last completed sprint: **Sprint 001 — Foundation** (`sprints/SPRINT-001.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation is complete and validated on `main`.

Sprint 002 Room work is now active on Issue #6 / branch `feat/6-room-shell`. The branch replaces the Foundation placeholder with the first minimalist 2D Room composition and introduces explicit book/movie navigation boundaries.

Current Sprint 002 branch content includes:

- Room feature under `apps/mobile/src/features/room/RoomScreen.tsx`,
- window, fireplace, bookshelf and movie screen/projector in the Room composition,
- accessible bookshelf and projector controls,
- Expo Router wiring from the app root,
- temporary book/movie destination routes under `apps/mobile/app/discovery/`.

The destination routes are intentionally placeholders. Real discovery UI/ranking is not implemented, so `MVP-ROOM-003` and `MVP-ROOM-004` remain incomplete.

## MVP progress

See `../product/MVP.md`.

Completed Foundation requirements:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`

In progress:

- `MVP-ROOM-001`
- `MVP-ROOM-002`

## In progress

- Issue #6 — Sprint 002 first 2D Room shell.
- Branch: `feat/6-room-shell`.

## Next

1. Validate Issue #6 with the full CI suite.
2. Review and merge the Room shell if checks pass.
3. Continue Sprint 002 from the merged Room rather than expanding this Issue into theme/discovery work.
4. Keep `MVP-ROOM-003/004` incomplete until real book/movie discovery destinations exist.
5. Do not start Sprint 003 curtain/theme behaviour during Sprint 002.

## Known issues / open decisions

- Exact visual art direction of the Room remains iterative; Issue #6 establishes the structural 2D metaphor, not final production art.
- Temporary book/movie routes are navigation boundaries only, not discovery implementations.
- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- Theme engine and curtain interaction belong to Sprint 003.
- Prediction V0 implementation remains deferred until the UI/data foundation exists.

## Important files

- `/AGENTS.md`
- `/docs/project/sprints/SPRINT-002.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/app/index.tsx`
- `/apps/mobile/app/discovery/books.tsx`
- `/apps/mobile/app/discovery/movies.tsx`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/.github/workflows/ci.yml`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Continue Issue #6 on `feat/6-room-shell` until it is validated and merged. Preserve the boundary: this Issue establishes the Room shell and navigation affordances only; curtain/theme and real discovery remain later work.
