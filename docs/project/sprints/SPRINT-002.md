# Sprint 002 — Room

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-25**

## Goal

Create the first recognizable minimalist 2D Kajo Room as the mobile application's home and primary navigation surface, using mock content and the existing Foundation architecture.

The Room should establish Kajo's core spatial metaphor without pulling forward the curtain/theme engine, real discovery UI, backend integrations or recommendation logic from later sprints.

## Scope

- Replace the Foundation placeholder screen with the first Room composition.
- Create the Room feature under `apps/mobile/src/features/room/` using feature-oriented organization.
- Include the core Room affordances defined for this stage:
  - window,
  - fireplace,
  - bookshelf,
  - movie screen/projector.
- Make the Room clearly 2D, mobile-first and visually minimal.
- Make the bookshelf and movie-screen areas intentional interactive/navigation boundaries for later book/movie discovery.
- Use mock/local content only where content is needed to demonstrate the Room.
- Keep presentation logic separate from canonical domain contracts.
- Add tests where Room behaviour contains meaningful logic.
- Keep lint, typecheck, unit tests and iOS/Android bundle smoke checks green.
- Update CODEMAP when the real Room implementation path exists.

## Relevant MVP requirements

Primary Sprint 002 requirements:

- `MVP-ROOM-001` — personal minimalist 2D Room.
- `MVP-ROOM-002` — Room is the primary home/navigation surface.

Room interaction groundwork:

- `MVP-ROOM-003` — bookshelf opens book discovery.
- `MVP-ROOM-004` — screen/projector opens movie discovery.

`MVP-ROOM-003` and `MVP-ROOM-004` are completed only when their real acceptance criteria are met. A placeholder interaction alone must not be used to claim completion if the required discovery destination does not yet exist.

## Non-goals

- `MVP-ROOM-005` theme engine completion; reusable user-theme architecture belongs primarily to Sprint 003.
- `MVP-ROOM-006` SharedProfile Room identity.
- Draggable curtain, three snap states or DAWN/EVENING/NIGHT transitions.
- Real book/movie discovery grids or ranking.
- Real external content providers.
- Supabase/backend integration.
- Prediction/recommendation implementation.
- Complex 3D, game-like Room rendering or Room editor.
- Final production art assets.

## UX constraints

- The Room is the home and primary navigation metaphor.
- Keep navigation minimal.
- The implementation is 2D, not a 3D room/game.
- Prefer atmosphere, spacing and composition over decorative UI chrome.
- Do not accidentally encode discovery-risk semantics into ordinary Room styling.
- Do not implement Sprint 003 curtain/theme behaviour early merely to make the first Room visually richer.

See `/docs/product/UX_PRINCIPLES.md` before implementation.

## Definition of Done

- The app opens to a recognizable personal 2D Room instead of the Foundation placeholder.
- Window, fireplace, bookshelf and movie screen/projector are represented coherently in the Room composition.
- Bookshelf and movie-screen affordances are accessible and have explicit navigation/interaction boundaries for future discovery.
- Room implementation is located under the documented feature path and does not contain prediction/backend logic.
- The implementation works within the existing Expo iOS/Android application skeleton.
- `npm run check` passes, including both platform bundle smoke checks.
- Relevant documentation accurately reflects the implemented paths and requirement status.
- No Sprint 003+ scope has been silently pulled into this sprint.

## Work in progress

### Issue #6 — first 2D Room shell

Branch: `feat/6-room-shell`

Implemented on the branch pending validation/merge:

- first `RoomScreen` composition,
- window, fireplace, bookshelf and projector/screen vocabulary,
- app root wired to the Room,
- accessible/tappable bookshelf and projector controls,
- temporary book/movie routes that prove the navigation boundary without claiming discovery completion.

`MVP-ROOM-001` and `MVP-ROOM-002` are in progress. `MVP-ROOM-003` and `MVP-ROOM-004` remain incomplete until real discovery destinations exist.

## Initial implementation sequence

1. Read UX principles and inspect the current Foundation screen.
2. Create the first Room implementation Issue and branch.
3. Build the Room screen/composition and replace the Foundation placeholder.
4. Add bookshelf/movie interaction boundaries with mock destinations only where justified by scope.
5. Add meaningful tests/accessibility semantics.
6. Validate through CI.
7. Update CODEMAP/STATUS/MVP only for truth that actually changed.

## Important starting files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/app/index.tsx`
- `/apps/mobile/app/_layout.tsx`
- `/apps/mobile/src/domain/`

## Handoff

Issue #6 is the active Room work. Validate and merge it before expanding Sprint 002 further.

The Room shell must remain a clean boundary to Sprint 003 curtain/theme work and Sprint 004 discovery UI.
