# Kajo Current Status

Last updated: **2026-08-26**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 005 — Swipe & History** (`sprints/SPRINT-005.md`)
Last completed sprint: **Sprint 004 — Discovery UI** (`sprints/SPRINT-004.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation, Sprint 002 Room, Sprint 003 Curtain & Theme and Sprint 004 Discovery UI are complete.

Sprint 005 application implementation, including the refinements from the 2026-08-26 real-device review, is merged and CI-validated. Sprint 005 remains **ACTIVE** only until the final implementation APK passes the repeated real-device acceptance in Issue #34.

Current `main` acceptance baseline:

- commit `be183d7abe9ceb02b2c420b4f132f5ef326c5f51`,
- CI run #72 fully green,
- standalone Android release APK built successfully,
- embedded JS bundle verified,
- APK artifact uploaded,
- previous Issue #34 phone review: the earlier APK launched without a crash and Room -> discovery -> swipe navigation worked; the final CI #72 APK still requires the repeat test.

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
- one window-aligned global curtain control with continuous drag and left/centre/right tap-to-snap,
- shared three-state DiscoveryMode without duplicate downstream selectors,
- visible action commit feedback and selected state,
- restrained consumed-card exit and automatic advance to the next Item,
- deterministic undo for the latest 10 committed interest/saved/consumed actions without changing the active swipe index,
- one centralized feature-level source for reused interaction labels,
- deterministic curtain, interaction, undo, suppression and swipe tests,
- no duplicate book/movie state model, swipe route or history route.

## Final implementation checkpoint — phone re-test pending

Issue #34 records the original device review and remains the acceptance thread for the final APK. Its two scoped follow-up Issues are implemented.

Delivered evidence:

- Issue #39 / PR #47 merged as commit `bea219aa0c6837bb646ece7d4ccf37bb1e05afc2`; main CI run #70 passed validation, standalone Android build, embedded JS verification and artifact upload.
- Issue #40 / PR #48 merged as commit `be183d7abe9ceb02b2c420b4f132f5ef326c5f51`; main CI run #72 passed the same full gate.

### Remaining acceptance gate

Install the CI #72 APK on the real Android phone and repeat Issue #34. Sprint 005 and its remaining MVP requirements stay open until that flow is accepted.

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
2. Install the standalone APK from main CI run #72 and repeat Issue **#34** real-device acceptance.
3. Verify the global curtain, Room -> discovery -> swipe path, visible actions, read/watched auto-advance, history and sequential undo on the phone.
4. Only after successful phone acceptance: mark the remaining Sprint 005 MVP requirements complete and perform the mandatory Sprint 005 close protocol.
5. Only then open/start Sprint 006 Backend Foundation.

## Known issues / open decisions

- Current interaction state is intentionally in-memory only; persistence belongs to Sprint 006.
- Current mode-dependent Item ordering is mock discovery logic, not Prediction V0.
- Final Sprint 005 device acceptance is pending in Issue #34.
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
- `/apps/mobile/src/features/discovery/itemInteractionLabels.ts`
- `/apps/mobile/src/features/discovery/itemInteraction.test.ts`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Issues #39 and #40 are merged, automatically validated and built as a standalone Android APK. The single next step is the repeated real-phone acceptance in **Issue #34** using the CI #72 artifact. Keep Sprint 005 active and do not start Sprint 006 until that acceptance and the mandatory sprint close are merged.
