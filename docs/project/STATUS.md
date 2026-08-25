# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 004 — Discovery UI** (`sprints/SPRINT-004.md`)
Last completed sprint: **Sprint 003 — Curtain & Theme** (`sprints/SPRINT-003.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation, Sprint 002 Room and Sprint 003 Curtain & Theme are complete.

The app now has:

- a minimalist 2D Room home/navigation surface,
- window, fireplace, bookshelf and movie screen/projector,
- reusable Room base-theme tokens,
- separate DAWN/EVENING/NIGHT AmbientPhase overlays,
- a horizontally draggable three-state curtain,
- accessible non-gesture mode controls,
- reduced-motion-aware snapping,
- canonical `DiscoveryMode` -> `AmbientPhase` mapping.

Issue #12 / PR #13 delivered Sprint 003 and was squash-merged to `main` as commit `36fad3d51353996112e504db1658e405f702be57`. Corrected PR CI and post-merge `main` CI are green.

The book/movie routes are still explicit placeholders. No real discovery grid, Item details, provider integration, backend, event engine or prediction ranking exists yet.

## MVP progress

See `../product/MVP.md`.

Completed requirements:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`
- `MVP-ROOM-001`
- `MVP-ROOM-002`
- `MVP-ROOM-005`
- `MVP-DISC-003`
- `MVP-DISC-004`

Sprint 004 targets:

- `MVP-ROOM-003`
- `MVP-ROOM-004`
- `MVP-DISC-001`
- `MVP-DISC-002`
- `MVP-DISC-005`
- `MVP-DISC-006`

Do not mark these complete until real mock-data discovery flows are implemented, validated and merged.

## In progress

- Sprint 004 — Discovery UI.

## Next

1. Read `sprints/SPRINT-004.md`, generic Item/domain docs and UX principles.
2. Create the first Sprint 004 implementation Issue and branch.
3. Establish one clear mobile DiscoveryMode ownership boundary shared by Room and discovery.
4. Add local generic BOOK/MOVIE Items and deterministic mock ranking by DiscoveryMode.
5. Replace book/movie placeholders with real visual grids.
6. Add generic Item details and return navigation.
7. Keep provider/backend/event/prediction implementation out of Sprint 004 and keep CI green.

## Known issues / open decisions

- Current Room/curtain/theme art is functional and structural, not final production artwork.
- Book/movie discovery routes are placeholders until Sprint 004 implementation lands.
- DiscoveryMode currently affects Room control/atmosphere only; mode-dependent discovery ordering is Sprint 004 mock logic and real prediction semantics remain later.
- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- SharedProfile Room/theme identity remains later scope.
- Prediction V0 remains deferred.

## Important files

- `/AGENTS.md`
- `/apps/mobile/app/_layout.tsx`
- `/apps/mobile/app/discovery/`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/domain/discovery.ts`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-003.md`
- `/docs/project/sprints/SPRINT-004.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Sprint 003 is closed. Continue **Sprint 004 — Discovery UI**. The next concrete action is to create a scoped Issue/branch for shared DiscoveryMode ownership, local generic Items, deterministic mock ranking, real book/movie grids and Item details. Do not introduce real provider/backend/prediction semantics in this sprint.
