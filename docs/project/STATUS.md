# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 004 — Discovery UI** (`sprints/SPRINT-004.md`)
Last completed sprint: **Sprint 003 — Curtain & Theme** (`sprints/SPRINT-003.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation, Sprint 002 Room and Sprint 003 Curtain & Theme are complete.

Sprint 004 implementation work from Issue #18 / PR #19 is merged to `main` as commit `1de51bda035d8ad3d7666a95473697c6ff47e772`.

The merged application now contains:

- one shared mobile `DiscoveryMode` state boundary used by Room and discovery,
- local generic BOOK/MOVIE `Item` mock data,
- deterministic mode-dependent mock ranking explicitly separated from Prediction V0,
- reusable two-column discovery grid/card presentation,
- real book and movie discovery routes replacing the old placeholders,
- one generic Item detail route/view,
- continued use of the Sprint 003 base theme + AmbientPhase mapping in discovery,
- automated tests for mock filtering/ranking/lookup,
- no obsolete `RoomDestinationPlaceholder.tsx`; it was removed when its final references were replaced.

PR #19 passed the canonical automated gate. The post-merge `main` CI also passed:

- dependency install,
- lint,
- TypeScript typecheck,
- automated tests,
- iOS Expo bundle smoke,
- Android Expo bundle smoke.

**Real phone/emulator/simulator runtime verification has not been performed.** The connected AI execution environment cannot launch Expo on a device runtime. Issue #20 is the explicit outstanding Sprint 004 runtime acceptance task.

## MVP progress

See `../product/MVP.md`.

Completed requirements already verified from earlier sprints:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`
- `MVP-ROOM-001`
- `MVP-ROOM-002`
- `MVP-ROOM-005`
- `MVP-DISC-003`
- `MVP-DISC-004`

Sprint 004 implementation exists on `main`, but the following requirements remain unmarked until the real runtime acceptance flow is exercised and Sprint 004 is closed:

- `MVP-ROOM-003`
- `MVP-ROOM-004`
- `MVP-DISC-001`
- `MVP-DISC-002`
- `MVP-DISC-005`
- `MVP-DISC-006`

Passing bundle smoke checks is not equivalent to a real device interaction test.

## In progress

- Sprint 004 — Discovery UI acceptance/close.
- Issue #20 — verify the merged discovery flow on a real phone, Android emulator or iOS simulator.

## Next

1. Run merged `main` on a real phone/emulator/simulator.
2. Verify the full Room -> bookshelf/projector -> discovery -> Item detail -> back flow described in Issue #20.
3. Verify all three DiscoveryModes persist and visibly change deterministic grid ordering.
4. If a runtime defect appears, create a scoped bug Issue/PR and add a regression test where practical.
5. Keep `npm run check` green after any fix.
6. Only after runtime acceptance, update `MVP.md`, close Sprint 004 and open the next sprint.

## Known issues / open decisions

- Current Room/curtain/theme art and Sprint 004 mock covers are functional/structural, not final production artwork.
- Sprint 004 uses local fictional mock Items; real provider integration remains later scope.
- Mode-dependent ordering is explicitly mock discovery logic, not Prediction V0 or `MVP-PRED-003` semantics.
- Real phone/emulator runtime verification for Sprint 004 is outstanding as Issue #20.
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

Continue **Sprint 004 — Discovery UI** from open Issue #20. The implementation is merged and both PR/main automated CI are green. The only Sprint 004 acceptance gap currently recorded is real phone/emulator/simulator runtime verification. Do not mark the Sprint 004 MVP requirements complete or open Sprint 005 until that runtime acceptance has been recorded.
