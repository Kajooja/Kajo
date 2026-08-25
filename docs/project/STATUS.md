# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 003 — Curtain & Theme** (`sprints/SPRINT-003.md`)
Last completed sprint: **Sprint 002 — Room** (`sprints/SPRINT-002.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation and Sprint 002 Room are complete.

The application now opens to a recognizable minimalist 2D Room under `apps/mobile/src/features/room/` with:

- window,
- fireplace,
- bookshelf,
- movie screen/projector,
- accessible bookshelf and movie-screen navigation affordances,
- explicit mock book/movie destination routes.

Issue #7 / PR #9 delivered the Room shell and was squash-merged to `main` as commit `6f0e8dc4a031755a174b083b8fc8ba0e90bb2960`. Both PR CI and the post-merge `main` CI are green.

The book/movie destination routes remain placeholders. There is no real discovery grid, ranking, backend, provider integration, theme engine or curtain interaction yet.

## MVP progress

See `../product/MVP.md`.

Completed requirements:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`
- `MVP-ROOM-001`
- `MVP-ROOM-002`

Still incomplete despite Room navigation groundwork:

- `MVP-ROOM-003` — real book discovery destination not implemented.
- `MVP-ROOM-004` — real movie discovery destination not implemented.

Sprint 003 now targets reusable theme tokens, curtain state/control and ambient-phase visualization.

## In progress

- Sprint 003 — Curtain & Theme.

## Next

1. Read `sprints/SPRINT-003.md`, `../product/UX_PRINCIPLES.md` and ADR-0004.
2. Create the first Sprint 003 implementation Issue and branch.
3. Introduce reusable base-theme and ambient tokens and migrate Room presentation away from scattered local colour literals.
4. Add the curtain with three canonical DiscoveryMode states and accessible alternatives.
5. Apply `DAWN`, `EVENING` and `NIGHT` as separate ambient layers without replacing the base profile theme.
6. Keep ranking/discovery/backend work out of Sprint 003 and keep CI green.

## Known issues / open decisions

- Current Room art is structural/minimal and not final production artwork.
- Current book/movie routes are placeholders; `MVP-ROOM-003/004` remain incomplete until real discovery is implemented.
- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- SharedProfile Room/theme identity remains later scope.
- Prediction V0 remains deferred.
- Exact visual details of the curtain/ambient transitions will be iterated within the locked UX constraints of Sprint 003.

## Important files

- `/AGENTS.md`
- `/README.md`
- `/apps/mobile/app/index.tsx`
- `/apps/mobile/app/discovery/`
- `/apps/mobile/src/features/room/`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/domain/discovery.ts`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0004-discovery-mode-and-ambient-phase.md`
- `/docs/project/sprints/SPRINT-002.md`
- `/docs/project/sprints/SPRINT-003.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Sprint 002 is closed. Continue **Sprint 003 — Curtain & Theme**. The next concrete action is to create the first Sprint 003 implementation Issue/branch for reusable theme tokens and the three-state curtain/ambient control. Do not implement real discovery ranking or mark `MVP-ROOM-003/004` complete from the existing placeholders.
