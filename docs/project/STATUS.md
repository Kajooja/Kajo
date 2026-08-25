# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 004 — Discovery UI** (`sprints/SPRINT-004.md`)
Last completed sprint: **Sprint 003 — Curtain & Theme** (`sprints/SPRINT-003.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation, Sprint 002 Room and Sprint 003 Curtain & Theme are complete.

Sprint 004 implementation is active through Issue #18 on branch `feat/18-discovery-ui`.

The active branch currently adds:

- one shared mobile `DiscoveryMode` state boundary used by Room and discovery,
- local generic BOOK/MOVIE `Item` mock data,
- deterministic mode-dependent mock ranking explicitly separated from Prediction V0,
- reusable two-column discovery grid/card presentation,
- real book and movie discovery routes replacing the old placeholders,
- one generic Item detail route/view,
- continued use of the Sprint 003 base theme + AmbientPhase mapping in discovery,
- automated tests for mock filtering/ranking/lookup,
- removal of the obsolete `RoomDestinationPlaceholder.tsx` after its final references were replaced.

Issue #16 / PR #17 also tightened repository rules: code changes require `npm run check`, user-facing runtime/device validation must be reported honestly, and obsolete files must be removed once superseded.

Sprint 004 implementation has not yet been validated by its PR CI. This execution environment cannot launch a real phone/emulator Expo runtime, so device/runtime verification is currently **not performed** and must not be claimed as complete.

## MVP progress

See `../product/MVP.md`.

Completed requirements on `main`:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`
- `MVP-ROOM-001`
- `MVP-ROOM-002`
- `MVP-ROOM-005`
- `MVP-DISC-003`
- `MVP-DISC-004`

Sprint 004 targets currently under implementation:

- `MVP-ROOM-003`
- `MVP-ROOM-004`
- `MVP-DISC-001`
- `MVP-DISC-002`
- `MVP-DISC-005`
- `MVP-DISC-006`

Do not mark Sprint 004 requirements complete until Issue #18 is validated, merged and the actual acceptance flows are verified. In particular, passing bundle smoke checks is not equivalent to a real device interaction test.

## In progress

- Sprint 004 — Discovery UI.
- Issue #18 — mock discovery grids and Item details.
- Branch `feat/18-discovery-ui` — implementation pending PR/CI validation.

## Next

1. Open the Issue #18 pull request.
2. Run the full CI gate equivalent to `npm run check`: lint, typecheck, tests and iOS/Android bundle smoke checks.
3. Correct any CI/type/navigation defects before merge.
4. Review the changed area for stale placeholders/dead files; `RoomDestinationPlaceholder.tsx` has already been removed.
5. Merge only after automated validation is green.
6. Perform a real phone/emulator runtime smoke test when an appropriate runtime environment is available and record the result.
7. Complete Sprint 004 close protocol only after the full Definition of Done and requirement acceptance criteria are met.

## Known issues / open decisions

- Current Room/curtain/theme art and Sprint 004 mock covers are functional/structural, not final production artwork.
- Sprint 004 uses local fictional mock Items; real provider integration remains later scope.
- Mode-dependent ordering is explicitly mock discovery logic, not Prediction V0 or `MVP-PRED-003` semantics.
- Current execution environment cannot perform a real phone/emulator runtime test; only automated CI/bundle validation is available here.
- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- SharedProfile Room/theme/discovery identity remains later scope.
- Prediction V0 remains deferred.

## Important files

- `/AGENTS.md`
- `/apps/mobile/app/_layout.tsx`
- `/apps/mobile/app/discovery/`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/domain/discovery.ts`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/features/discovery/`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-004.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Continue **Sprint 004 — Discovery UI** from Issue #18 / branch `feat/18-discovery-ui`. The branch contains the first real local/mock discovery flow but still requires PR CI validation and later real-device/emulator smoke verification. Do not introduce external providers, backend/event capture or real Prediction V0 semantics into this sprint.
