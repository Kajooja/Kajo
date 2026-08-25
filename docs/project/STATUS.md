# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 003 — Curtain & Theme** (`sprints/SPRINT-003.md`)
Last completed sprint: **Sprint 002 — Room** (`sprints/SPRINT-002.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation and Sprint 002 Room are complete.

Sprint 003 implementation is active through Issue #12 on branch `feat/12-curtain-theme`.

The active Sprint 003 branch currently adds:

- reusable Room base-theme tokens under `apps/mobile/src/theme/`,
- separate AmbientPhase overlay tokens for DAWN, EVENING and NIGHT,
- Room migration away from scattered local colour literals,
- a horizontally draggable three-state curtain control,
- canonical `DiscoveryMode` -> `AmbientPhase` use through the existing domain mapping,
- accessible non-gesture buttons for all three curtain states,
- reduced-motion-aware programmatic snapping,
- pure tests for curtain snap logic and base-theme/ambient separation.

The existing book/movie destination routes remain placeholders. There is still no real discovery grid, ranking, backend or provider integration.

## MVP progress

See `../product/MVP.md`.

Completed requirements on `main`:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`
- `MVP-ROOM-001`
- `MVP-ROOM-002`

Sprint 003 targets currently under implementation:

- `MVP-ROOM-005`
- `MVP-DISC-003`
- `MVP-DISC-004`

`MVP-DISC-002` receives groundwork only. Do not mark Sprint 003 targets complete until Issue #12 is validated, merged and the sprint Definition of Done is verified.

Still incomplete:

- `MVP-ROOM-003` — real book discovery destination not implemented.
- `MVP-ROOM-004` — real movie discovery destination not implemented.

## In progress

- Sprint 003 — Curtain & Theme.
- Issue #12 — theme tokens and three-state curtain.

## Next

1. Open/validate the Issue #12 pull request.
2. Confirm lint, typecheck, unit tests and iOS/Android bundle smoke checks pass.
3. Correct any CI or accessibility/state defects before merge.
4. Merge only after the curtain/theme implementation satisfies its acceptance criteria.
5. Complete Sprint 003 close protocol only after its full Definition of Done is met.

## Known issues / open decisions

- Sprint 003 visual styling remains an initial implementation rather than final production artwork.
- Current book/movie routes are placeholders; `MVP-ROOM-003/004` remain incomplete until real discovery is implemented.
- DiscoveryMode currently affects Room visual/control state only; real discovery/ranking semantics remain later scope.
- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- SharedProfile Room/theme identity remains later scope.
- Prediction V0 remains deferred.

## Important files

- `/AGENTS.md`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/features/room/curtainState.ts`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/domain/discovery.ts`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0004-discovery-mode-and-ambient-phase.md`
- `/docs/project/sprints/SPRINT-003.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Continue **Sprint 003 — Curtain & Theme** from Issue #12 / branch `feat/12-curtain-theme`. Validate the current theme-token and three-state curtain implementation before merging. Do not implement real discovery ranking or mark discovery requirements complete from visual mode switching alone.
