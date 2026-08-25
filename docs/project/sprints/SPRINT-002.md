# Sprint 002 — Room

Status: **COMPLETE**
Milestone: **MVP 0.1**
Started: **2026-08-25**
Completed: **2026-08-25**

## Goal

Create the first recognizable minimalist 2D Kajo Room as the mobile application's home and primary navigation surface, using mock content and the existing Foundation architecture.

The Room establishes Kajo's core spatial metaphor without pulling forward the curtain/theme engine, real discovery UI, backend integrations or recommendation logic from later sprints.

## Relevant MVP requirements — result

Completed:

- `MVP-ROOM-001` — personal minimalist 2D Room.
- `MVP-ROOM-002` — Room is the primary home/navigation surface.

Groundwork delivered but requirements remain incomplete:

- `MVP-ROOM-003` — bookshelf opens book discovery.
- `MVP-ROOM-004` — screen/projector opens movie discovery.

The bookshelf and movie screen now have explicit navigation boundaries, but their destinations are intentionally mock placeholders. Real discovery experiences are deferred to Sprint 004, so `MVP-ROOM-003` and `MVP-ROOM-004` are not marked complete.

## Definition of Done — result

- [x] The app opens to a recognizable personal 2D Room instead of the Foundation placeholder.
- [x] Window, fireplace, bookshelf and movie screen/projector are represented coherently.
- [x] Bookshelf and movie-screen affordances are accessible and have explicit navigation boundaries.
- [x] Room implementation lives under `apps/mobile/src/features/room/` and contains no prediction/backend logic.
- [x] The implementation works within the existing Expo iOS/Android application skeleton.
- [x] CI passes locked install, lint, typecheck, unit tests and iOS/Android bundle smoke checks.
- [x] CODEMAP and STATUS describe the real implementation paths/state.
- [x] No Sprint 003+ implementation scope was pulled into the Room change.

## Delivered — Issue #7 / PR #9

- Replaced the Foundation placeholder with `RoomScreen` as the application home surface.
- Added the first mobile-first layered 2D Room composition.
- Added window, fireplace, bookshelf and movie screen/projector representations.
- Added accessible bookshelf and movie-screen `Pressable` navigation affordances.
- Added explicit mock book/movie destination routes under `apps/mobile/app/discovery/`.
- Kept the mock destinations visibly separate from real discovery implementation.
- Kept Room presentation separate from canonical domain contracts and prediction/backend logic.
- Updated CODEMAP and current-state documentation.

## Validation evidence

PR #9 CI passed:

- `npm ci --no-audit --no-fund`
- lint
- TypeScript typecheck
- Vitest unit tests
- Expo iOS bundle export
- Expo Android bundle export

PR #9 was squash-merged to `main` as commit `6f0e8dc4a031755a174b083b8fc8ba0e90bb2960`.

The post-merge `main` CI run also completed successfully.

## Decisions

No new durable architecture decision was required. Sprint 002 followed the existing UX and architecture rules:

- Room is the home/navigation metaphor.
- Room remains 2D.
- Presentation does not contain prediction/backend logic.
- Curtain/theme semantics remain separate and deferred to Sprint 003.

## Deferred

- Real book discovery and `MVP-ROOM-003` -> Sprint 004 — Discovery UI.
- Real movie discovery and `MVP-ROOM-004` -> Sprint 004 — Discovery UI.
- Reusable profile theme tokens and `MVP-ROOM-005` -> Sprint 003 — Curtain & Theme.
- Curtain control and ambient phases -> Sprint 003.
- SharedProfile Room/theme identity and `MVP-ROOM-006` -> Shared Kajo sprint.
- Final production artwork -> later iteration/hardening.

## Known limitations

- Current Room art is intentionally structural and minimalist, not final production artwork.
- Book/movie destination screens are explicit placeholders and must not be treated as real discovery experiences.
- Current local Room colours are temporary presentation values; reusable theme architecture is Sprint 003 scope.

## Important files

- `/apps/mobile/app/index.tsx`
- `/apps/mobile/app/discovery/books.tsx`
- `/apps/mobile/app/discovery/movies.tsx`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/RoomDestinationPlaceholder.tsx`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/product/MVP.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/STATUS.md`

## Final handoff

Sprint 002 is complete and historical. Continue with **Sprint 003 — Curtain & Theme** in `SPRINT-003.md`.

Do not extend Sprint 002 with theme, curtain, discovery-grid, backend or ranking work. A fresh conversation should use the repository read order and start from Sprint 003's explicit scope.
