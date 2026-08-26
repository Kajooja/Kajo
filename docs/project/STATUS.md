# Kajo Current Status

Last updated: **2026-08-26**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 005 — Swipe & History** (`sprints/SPRINT-005.md`)
Last completed sprint: **Sprint 004 — Discovery UI** (`sprints/SPRINT-004.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation, Sprint 002 Room, Sprint 003 Curtain & Theme and Sprint 004 Discovery UI are complete.

Sprint 005 application implementation is substantially merged and stable, but Sprint 005 remains **ACTIVE** because the 2026-08-26 real-device review identified required interaction refinements before acceptance/close.

Current `main` acceptance baseline:

- commit `1a785a215e29cfd8ecc03e7aa3d05795d88d54d2`,
- CI run #66 fully green,
- standalone Android release APK built successfully,
- embedded JS bundle verified,
- APK artifact uploaded,
- real Android device: app launches, does not crash and Room -> discovery -> swipe navigation works.

Merged Sprint 005 capabilities already present:

- continuous/thinner curtain interaction and full-scene atmosphere,
- grid-first BOOK/MOVIE discovery,
- grid -> selected Item -> horizontal optional swipe,
- one generic local Item interaction state for BOOK and MOVIE,
- positive/negative interest state,
- save/unsave state,
- generic consumed state shown as read/watched,
- consumed suppression from ordinary discovery,
- `Luetut` / `Katsotut` history collection,
- active swipe sequence snapshot so consuming an Item does not remove the current FlatList page underneath the user,
- deterministic interaction/suppression/swipe tests,
- no duplicate book/movie state model, swipe route or history route.

## Real-device result — Sprint 005 not yet accepted

Issue #34 records the device review. Stability is good, but the interaction model needs two final scoped refinements.

### Issue #39 — global curtain / DiscoveryMode / risk control

Required behavior:

- visually place/align the curtain control at the top of the Room window so it reads as part of the window/curtain,
- keep continuous horizontal drag,
- make left/centre/right areas tappable so the handle smoothly moves/snaps to that target,
- only three settled logical values exist: `FOR_YOU`, `SURPRISE`, `RISK`,
- colour/light can interpolate smoothly during movement,
- one shared DiscoveryMode state follows the user through Room -> discovery -> swipe,
- remove duplicate downstream `Sinulle / Yllätys / Riski` selector groups,
- treat this same control as the future prediction exploration/risk selection, while keeping `AmbientPhase` visually separate from algorithmic `DiscoveryMode`.

### Issue #40 — visible actions, auto-advance, undo and maintainable labels

Required behavior:

- pressing interest/save/consumed must have clear visible state feedback,
- marking BOOK read or MOVIE watched makes the current card leave with a restrained swipe/exit animation and advances to the next Item,
- consumed Items remain browsable later in `Luetut` / `Katsotut`,
- provide a clear undo/back-arrow action for recent choices,
- MVP target: sequential undo for at least the latest 10 committed interaction actions,
- undo restores prior state without corrupting the current swipe index,
- user-facing labels such as `Pidän`, `Ei minulle`, `Tallenna`, `Luettu`, `Katsottu` must be centrally maintained at feature level rather than repeated across screens,
- UI wording must remain independent from stable canonical state/event semantics.

## MVP progress

See `../product/MVP.md`.

Completed through Sprint 004:

- `MVP-FOUND-001..003`
- `MVP-ROOM-001..005` except `MVP-ROOM-006`
- `MVP-DISC-001..006`

Sprint 005 currently in progress / not accepted yet:

- `MVP-DISC-007`
- `MVP-SWIPE-001..006`
- `MVP-MEM-001..002`

Planned identity requirements:

- `MVP-AUTH-001` — lightweight/common register/sign-in.
- `MVP-AUTH-002` — user-visible nickname/username.

## Prediction and learning direction — already decided, later implementation

The global curtain selection is not only a colour choice. `DiscoveryMode` is a future Prediction input:

- `FOR_YOU` = lower exploration / higher expected fit,
- `SURPRISE` = more novelty while retaining meaningful fit,
- `RISK` = higher uncertainty/variance and bolder exploration.

Meaningful user actions such as interest, save/unsave, consumed/read/watched and later ratings become learning evidence through stable Events. Once the event/prediction layers exist, relevant behavioural changes and DiscoveryMode changes should refresh affected recommendations from the latest state.

Sequencing remains:

- Sprint 006: backend/auth/persistence foundation,
- Sprint 007: durable generic Event capture and prediction traceability,
- Sprint 008: real Prediction V0 and refreshed ranking from behaviour + recent state + Item similarity + DiscoveryMode.

Do not implement ranking logic in the mobile client.

## Next — exact handoff order

1. Continue **Sprint 005**, not Sprint 006.
2. Implement Issue **#39** first: global window-aligned curtain/DiscoveryMode control, tap-to-snap, shared state and removal of duplicate per-screen mode buttons.
3. Run `npm run check`, merge only with green CI and validate the standalone Android build.
4. Implement Issue **#40**: visible action feedback, consumed auto-advance animation, recent undo stack and centralized feature-level action labels.
5. Add deterministic tests for tap/snap mapping, action transitions and undo history where practical.
6. Run full CI + standalone Android build again.
7. Repeat Issue **#34** real-device acceptance on the new final Sprint 005 APK.
8. Only after successful phone acceptance: mark the remaining Sprint 005 MVP requirements complete and perform the mandatory Sprint 005 close protocol.
9. Only then open/start Sprint 006 Backend Foundation.

## Known issues / open decisions

- Current interaction state is intentionally in-memory only; persistence belongs to Sprint 006.
- Current mode-dependent Item ordering is mock discovery logic, not Prediction V0.
- Action UI needs the explicit feedback/advance/undo refinement in Issue #40.
- Exact authentication provider/method mix remains open; MVP requirement is provider-agnostic.
- Exact nickname/username uniqueness rules remain open.
- Final book metadata provider is not locked.
- Current Room/theme/mock covers remain structural rather than final production artwork.
- SharedProfile Room/theme/discovery identity remains later scope.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-005.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeContext.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryScreen.tsx`
- `/apps/mobile/src/features/discovery/ItemDetailScreen.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteraction.ts`
- `/apps/mobile/src/features/discovery/itemInteraction.test.ts`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

The correct next engineering task is **Issue #39**, followed by **Issue #40**. Sprint 005 must remain active until both are implemented, automatically validated, built as standalone Android APK and accepted on the real phone through Issue #34. Do not start Sprint 006 yet.
