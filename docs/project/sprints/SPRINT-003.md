# Sprint 003 — Curtain & Theme

Status: **COMPLETE**
Milestone: **MVP 0.1**
Started: **2026-08-25**
Completed: **2026-08-25**

## Goal

Add Kajo's first reusable theme/ambient architecture and the curtain interaction that moves between the three discovery modes without implementing real discovery ranking or content-provider logic.

Sprint 003 made the Room respond coherently to `DiscoveryMode` while preserving the base visual identity and the separation between prediction semantics and visual atmosphere.

## Relevant MVP requirements — result

Completed:

- `MVP-ROOM-005` — Room uses reusable theme tokens rather than scattered hard-coded component colours.
- `MVP-DISC-003` — curtain controls DiscoveryMode with three snap states.
- `MVP-DISC-004` — DiscoveryMode maps visually to dawn, evening and night without replacing the base theme.

Groundwork delivered but requirement remains incomplete:

- `MVP-DISC-002` — canonical `FOR_YOU`, `SURPRISE` and `RISK` state/control exists, but the real discovery experience does not yet exist. Complete this in Sprint 004.

## Definition of Done — result

- [x] Room presentation consumes reusable base-theme tokens.
- [x] Theme architecture separates base theme from AmbientPhase overlay tokens.
- [x] Curtain is present and can select `FOR_YOU`, `SURPRISE` and `RISK`.
- [x] Curtain has three snap states using the canonical DiscoveryMode -> AmbientPhase mapping.
- [x] DAWN, EVENING and NIGHT produce distinct restrained atmosphere changes while the base theme persists.
- [x] Users can change mode through accessible buttons without relying only on drag.
- [x] Programmatic snapping respects the platform reduced-motion preference.
- [x] Curtain snap/state logic and theme separation have automated tests.
- [x] No real ranking/discovery/backend behavior was introduced.
- [x] PR and post-merge `main` CI pass lint, typecheck, tests and iOS/Android bundle smoke checks.
- [x] CODEMAP and STATUS describe the real implementation paths/state.

## Delivered — Issue #12 / PR #13

- Added `apps/mobile/src/theme/roomTheme.ts` with reusable base Room tokens and separate AmbientPhase tokens.
- Migrated Room styling away from scattered local colour literals.
- Added `CurtainControl` with horizontal drag interaction and three canonical snap states.
- Added accessible mode buttons as a non-gesture control path.
- Added reduced-motion-aware snap animation using `AccessibilityInfo`.
- Reused the domain-owned `DiscoveryMode` -> `AmbientPhase` mapping rather than duplicating semantic mapping in presentation code.
- Added visual ambient wash/window/curtain changes for DAWN, EVENING and NIGHT.
- Added pure tests for snap-position behavior and theme/base separation.
- Kept real discovery, backend and prediction semantics outside the sprint.

## Validation evidence

The first PR #13 CI run caught a React hooks/ref lint defect in `CurtainControl`. The implementation was corrected before merge.

The corrected PR #13 CI passed:

- locked npm install,
- lint,
- TypeScript typecheck,
- unit tests,
- Expo iOS bundle smoke test,
- Expo Android bundle smoke test.

PR #13 was squash-merged to `main` as commit `36fad3d51353996112e504db1658e405f702be57`.

The post-merge `main` CI run also completed successfully.

## Decisions

No new ADR was required. Sprint 003 implemented the existing ADR-0004 separation:

- `DiscoveryMode` remains domain/discovery state.
- `AmbientPhase` remains visual state.
- the mapping stays explicit and domain-owned.
- the base Room theme persists beneath ambient changes.

## Deferred

- Real book/movie discovery and `MVP-ROOM-003/004` -> Sprint 004.
- `MVP-DISC-001/002/005/006` -> Sprint 004.
- Real prediction/ranking semantics and `MVP-PRED-003` -> Prediction V0 sprint.
- SharedProfile Room/theme identity -> Shared Kajo sprint.
- Final production artwork -> later iteration/hardening.

## Known limitations

- The current curtain/theme art is an initial functional visual system rather than final production design.
- DiscoveryMode currently affects Room control/atmosphere only; it does not yet affect a real discovery grid.
- Theme tokens currently represent the initial personal Room base identity; persisted/user-configurable profile theme data belongs to later backend/profile work.

## Important files

- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/features/room/curtainState.ts`
- `/apps/mobile/src/features/room/curtainState.test.ts`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/apps/mobile/src/theme/roomTheme.test.ts`
- `/apps/mobile/src/domain/discovery.ts`
- `/docs/architecture/decisions/0004-discovery-mode-and-ambient-phase.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/product/MVP.md`
- `/docs/project/STATUS.md`

## Final handoff

Sprint 003 is complete and historical. Continue with **Sprint 004 — Discovery UI** in `SPRINT-004.md`.

Do not rewrite Sprint 003 to include discovery-grid or prediction work. Sprint 004 owns the first real mock-data discovery experience; later prediction work owns real ranking semantics.
