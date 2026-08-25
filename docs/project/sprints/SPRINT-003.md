# Sprint 003 — Curtain & Theme

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-25**

## Goal

Add Kajo's first reusable theme/ambient architecture and the curtain interaction that moves between the three discovery modes without implementing real discovery ranking or content-provider logic.

Sprint 003 should make the existing Room respond coherently to `DiscoveryMode` while preserving the user's base visual identity and the separation between prediction semantics and visual atmosphere.

## Scope

- Introduce reusable mobile theme tokens instead of keeping Room identity in scattered hard-coded component colours.
- Establish a clear theme/ambient boundary under `apps/mobile/src/theme/` or another justified canonical path.
- Preserve a base profile-theme layer and apply `AmbientPhase` as a separate visual layer.
- Add the curtain as a signature Room control.
- Support three explicit curtain snap states corresponding to:
  - `FOR_YOU`
  - `SURPRISE`
  - `RISK`
- Use the existing canonical mapping:
  - `FOR_YOU` -> `DAWN`
  - `SURPRISE` -> `EVENING`
  - `RISK` -> `NIGHT`
- Make ambient changes visible through restrained 2D light/opacity/gradient/shadow/motion changes rather than decorative UI chrome.
- Provide accessible non-gesture alternatives for changing the curtain state.
- Respect reduced-motion preferences where animation is introduced.
- Keep state/mapping/snap logic outside purely visual components where meaningful.
- Add tests for meaningful state/mapping/snap behavior.
- Keep existing lint, typecheck, tests and iOS/Android bundle smoke checks green.
- Update CODEMAP and current-state documentation when implementation paths become real.

## Relevant MVP requirements

Primary Sprint 003 targets:

- `MVP-ROOM-005` — user theme is represented by reusable theme tokens rather than hard-coded component colours.
- `MVP-DISC-003` — curtain controls DiscoveryMode with three snap states.
- `MVP-DISC-004` — DiscoveryMode maps visually to dawn, evening and night without replacing the base user theme.

Supporting groundwork:

- `MVP-DISC-002` — Discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.

Do not mark `MVP-DISC-002` complete merely because the Room can switch the domain state; the real discovery experience is Sprint 004 scope.

## Non-goals

- Real book/movie discovery grids.
- Real ranking or recommendation changes based on DiscoveryMode.
- `MVP-PRED-003`; algorithmic exploration semantics remain later prediction scope.
- Real external content providers.
- Supabase/backend integration.
- SharedProfile Room/theme identity (`MVP-ROOM-006`).
- Production onboarding/authentication.
- Complex Room editing or 3D rendering.
- Final production art assets.

## UX constraints

- Theme identity remains the base visual layer.
- `DiscoveryMode` and `AmbientPhase` remain separate concepts.
- Visual darkness must not imply a user's risk preference.
- The curtain should become learnable as a three-state control without permanent navigation clutter.
- Motion communicates state and must not compete with content.
- Gesture interaction requires an accessible alternative.
- Reduced-motion settings must be respected.
- The Room remains the home/navigation metaphor.

See `/docs/product/UX_PRINCIPLES.md` and ADR-0004 before implementation.

## Definition of Done

- Room presentation consumes reusable theme tokens for its base identity rather than scattered local colour literals.
- Theme architecture clearly separates base theme from ambient phase.
- Curtain is present in the Room and can select all three canonical DiscoveryModes.
- Curtain has three explicit/snap states and the selected mode maps through the canonical AmbientPhase mapping.
- DAWN, EVENING and NIGHT produce visibly distinct but restrained 2D atmosphere changes without replacing the base theme.
- Users can change mode without relying only on a drag gesture.
- Introduced motion respects reduced-motion preferences.
- Meaningful curtain/state logic has automated tests.
- No real ranking/discovery/backend behavior is silently introduced.
- `npm run check` passes, including iOS and Android bundle smoke checks.
- CODEMAP/STATUS/MVP accurately describe the implemented state at sprint close.

## Initial implementation sequence

1. Inspect the merged Room implementation and current domain mapping.
2. Create the first Sprint 003 implementation Issue and branch.
3. Define reusable theme/base/ambient tokens and migrate Room presentation to use them.
4. Add curtain state/control with three canonical modes.
5. Add visual AmbientPhase application and accessible alternatives.
6. Add tests and reduced-motion handling.
7. Validate through CI.
8. Update repository project memory and complete the sprint close protocol only when the Definition of Done is met.

## Important starting files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0004-discovery-mode-and-ambient-phase.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/domain/discovery.ts`
- `/apps/mobile/src/features/room/RoomScreen.tsx`

## Handoff

Start Sprint 003 with one scoped Issue for reusable Room theme tokens and the three-state curtain/ambient control. Do not code directly on `main`.

Do not implement real discovery grids or ranking semantics during this sprint. Sprint 003 owns the visual/control layer; Sprint 004 owns the discovery UI.
