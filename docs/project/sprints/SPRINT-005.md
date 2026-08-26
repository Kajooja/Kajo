# Sprint 005 — Swipe & History

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-26**

## Goal

Extend the validated grid-first book/movie discovery flow with an optional swipe-oriented browsing experience and the first meaningful user state: interest, consumed and saved.

The sprint should make interaction feel continuous from grid -> Item -> swipe rather than introducing a disconnected second application mode.

## Scope

- Preserve the existing Room -> bookshelf/projector -> grid mental model.
- Keep grid as the primary discovery surface.
- Allow opening an Item/grid context to transition naturally into an optional swipe-oriented sequence.
- Support generic BOOK and MOVIE Items through the same swipe/state model.
- Add positive/negative interest actions.
- Add watched state for MOVIE and read state for BOOK using one generic consumed-state boundary.
- Add save/unsave behavior.
- Add a simple consumed-history view for books and movies.
- Strongly suppress already-consumed Items from ordinary repeated discovery using explicit mobile/mock behavior until real prediction semantics exist.
- Keep all mock/state behavior clearly separate from Prediction V0.
- Add deterministic tests for state transitions, filtering/suppression and swipe sequence behavior where practical.
- Keep `npm run check` green and validate the changed flow on a real phone/emulator when available.

## Relevant MVP requirements

Primary Sprint 005 targets now include the real-device acceptance refinements:

- `MVP-DISC-007` — one global drag + tap-to-snap DiscoveryMode/risk curtain control shared across the app.
- `MVP-SWIPE-001` — user can enter an optional swipe mode for books and movies.
- `MVP-SWIPE-002` — user can express positive/negative interest.
- `MVP-SWIPE-003` — user can mark a movie as watched and a book as read.
- `MVP-SWIPE-004` — already-consumed Items are strongly suppressed from ordinary repeated discovery.
- `MVP-SWIPE-005` — every explicit interest, save or consumed choice visibly auto-advances with restrained motion and no index jump.
- `MVP-SWIPE-006` — recent interaction choices can be undone; MVP target is at least the latest 10 committed actions with exact state and card restoration.
- `MVP-MEM-001` — user can save/unsave an Item.
- `MVP-MEM-002` — user can view consumed books/movies.

Preserve completed discovery requirements from Sprint 004.

## Non-goals

- Backend/Supabase persistence; planned for Sprint 006.
- Register/login implementation; planned for Sprint 006.
- User nickname/username implementation; planned for Sprint 006.
- Production recommendation scoring or `MVP-PRED-*` implementation.
- Event engine/analytics persistence; planned for Sprint 007.
- Rating consumed Items; remains later Memory scope.
- SharedProfile state.
- Final production artwork.

## Architecture constraints

- Continue using generic `Item`; do not split swipe state into separate book/movie core models.
- Keep consumed semantics generic while allowing domain-specific UI labels (`watched` / `read`).
- Keep mobile interaction state behind one clear feature boundary so later backend persistence can replace storage without rewriting presentation components.
- User-facing labels are presentation. Stable state/event semantics must not depend on visible wording.
- Reused action labels should be centrally maintained at feature level; do not introduce a broad localization framework prematurely.
- `DiscoveryMode` is shared app state and future prediction-policy input; `AmbientPhase` remains a separate visual representation.
- Do not call local filtering/suppression Prediction V0.
- Do not create empty backend/data folders before they are needed.

## UX constraints

- Grid remains the default browse surface.
- Grid -> Item -> swipe should feel like one continuous content flow.
- Swipe is optional; users must not be forced into it to browse.
- Curtain is the single global three-state DiscoveryMode/risk selector, not one selector per screen.
- Curtain drag may be continuous, but settled state is only `FOR_YOU`, `SURPRISE` or `RISK`.
- Tapping a curtain target region should smoothly animate/snap to the selected state.
- Actions must have accessible non-gesture alternatives.
- Every explicit interest, save or consumed choice should visibly commit and advance with restrained motion.
- Recent choices must be reversible through a clear undo/back-arrow affordance that restores the exact previous card.
- Avoid casino/dating-app visual language, excessive counters or gamification.
- Saved/read/watched state should be understandable without heavy chrome.
- Respect reduced-motion settings.

## Definition of Done

- Existing grid discovery remains functional.
- A user can enter and leave an optional swipe sequence for both BOOK and MOVIE Items.
- Positive and negative interest actions work through explicit state logic and have visible feedback.
- BOOK can be marked read and MOVIE watched through the generic consumed-state boundary.
- Every explicit interest, save or consumed commit advances to the next card with restrained feedback and no active-list/index jump.
- Save/unsave works.
- Consumed books/movies can be viewed after auto-advance.
- Already-consumed Items are strongly suppressed from normal repeated mock discovery.
- Curtain is window-aligned, draggable, tap-to-snap and shared globally across Room/discovery/swipe without duplicate downstream selector groups.
- Recent committed interaction actions can be undone predictably, restoring the exact previous Item/card, with at least 10-action sequential undo as the MVP target.
- Reused action labels are maintained from one feature-level source without coupling copy to canonical state/event semantics.
- Deterministic behavior has automated tests where practical.
- No obsolete placeholder/duplicate implementation remains.
- `npm run check` passes.
- Standalone Android release APK builds and embeds its JS bundle.
- The final user-facing path is exercised on a real phone before sprint close.
- `STATUS.md`, `MVP.md` and `CODEMAP.md` reflect repository truth at close.

## Delivered implementation checkpoint

### Curtain polish — Issue #30 / PR #31

Delivered:

- thinner curtain handle,
- continuous drag/snap behavior,
- drag continuation from the live animated position,
- full-scene DiscoveryMode atmosphere in Room/discovery/detail,
- accessible mode controls and reduced-motion behavior preserved.

This implementation is superseded in UX acceptance by Issue #39 only where the device review asks for window alignment, tap-to-snap and one global selector instead of downstream selector duplication.

### Swipe & History — Issue #32 / PR #33

Delivered:

- grid remains primary discovery,
- selected grid Item begins the horizontal swipe sequence,
- one generic in-memory BOOK/MOVIE interaction state,
- interest, save/unsave and consumed state,
- consumed suppression,
- `Luetut` / `Katsotut` collection,
- deterministic state/suppression/sequence tests,
- no separate book/movie state models or unnecessary routes/folders.

### Swipe stability — Issue #37 / PR #38

Merged to `main` as commit `1a785a215e29cfd8ecc03e7aa3d05795d88d54d2`.

Delivered:

- active swipe sequence is snapshotted when the session opens,
- live read/watched changes no longer remove a FlatList page underneath the user,
- interaction status remains live,
- consumed suppression applies normally after returning to discovery,
- regression test added.

CI run #66 for this commit is fully green, including lint, typecheck, tests, iOS/Android bundle smoke, standalone Android release build, embedded JS bundle verification and artifact upload.

### Global curtain / DiscoveryMode — Issue #39 / PR #47

Merged to `main` as commit `bea219aa0c6837bb646ece7d4ccf37bb1e05afc2`.

Delivered:

- curtain control aligned to the top of the Room window,
- continuous drag plus deterministic left/centre/right tap-to-snap,
- exactly three settled DiscoveryMode states through one shared app state,
- duplicate discovery/detail mode selectors removed,
- deterministic tap-region tests.

Main CI run #70 is fully green, including the standalone Android release build, embedded JS bundle verification and artifact upload.

### Action commit / auto-advance / undo / labels — Issue #40 / PR #48

Merged to `main` as commit `be183d7abe9ceb02b2c420b4f132f5ef326c5f51`.

Delivered:

- visible feedback and selected state for interest, saved and consumed actions,
- restrained consumed-card exit and automatic next-Item advance separate from ordinary horizontal swipe,
- deterministic bounded undo for the latest 10 committed interaction changes without active-index movement,
- consumed history preserved through the existing `Luetut` / `Katsotut` collection,
- one feature-level source for reused interaction labels,
- deterministic undo-order, history-bound and no-op tests.

Main CI run #72 is fully green, including `npm run check`, the standalone Android release build, embedded JS bundle verification and artifact upload.

### Unified action advance and exact-card undo — Issue #51 / PR #52

The final CI #73 APK phone test showed that read/watched advanced correctly, while interest/save choices did not advance and undo restored state without returning the previous card.

Merged to `main` as commit `3b6d7c703f7574461441f2489bcaa1c0a8048740`.

Delivered:

- one shared commit -> restrained exit -> next-card flow for `Pidän`, `Ei minulle`, `Tallenna` and read/watched,
- the existing 10-action generic interaction history as the single source for undo state and target Item,
- exact previous-card return on undo, including safe routing when the target is outside the active sequence,
- safe final-card commit without an invalid index advance,
- deterministic BOOK/MOVIE LIFO target, every-action advance, exact-card return and final-card tests.

PR CI #76 passed the canonical validation gate. Main CI #77 passed the same validation plus the standalone Android release build, embedded JavaScript bundle verification and artifact upload.

CI #77 artifact: `kajo-android-standalone-3b6d7c703f7574461441f2489bcaa1c0a8048740`; digest `sha256:eecdcf15a6735b9a302a5d851607aaf8944c5b1f485e5474904b1b76822d52a5`. Real-phone acceptance remains required.

## Real-device review — 2026-08-26

Issue #34 records the test result.

### What worked

- standalone app launches on the real Android phone,
- no crash observed,
- Room -> discovery -> swipe navigation works,
- read/watched removes the current card and exposes the next one,
- overall MVP structure remains usable.

### Why Sprint 005 remains open after the CI #73 phone test

Interest/save choices needed the same advance behavior, and undo needed to return the exact previous card in addition to restoring state. Issue #51 / PR #52 delivered the single scoped correction. Final production Room artwork remains outside this sprint; only the corrected APK's phone acceptance remains.

## Later learning/prediction decision captured during device review

This is **not** extra Sprint 005 implementation scope, but it is now an explicit product/architecture direction:

```text
meaningful user action
  -> Event/evidence (Sprint 007)
  -> ShortTermState / LongTermState changes
  -> Prediction inputs change
  -> affected ranking refreshes (Sprint 008)
```

`DiscoveryMode` is also a live Prediction input:

- `FOR_YOU`: lower exploration / higher expected fit,
- `SURPRISE`: more novelty with meaningful expected fit,
- `RISK`: higher uncertainty/variance and bolder exploration.

The mobile client must not own the production ranking algorithm.

## Exact continuation order

1. Install the standalone APK from main CI run #77.
2. Repeat Issue #34 real-device acceptance for every action and sequential exact-card undo.
3. If accepted, mark `MVP-DISC-007`, `MVP-SWIPE-001..006` and `MVP-MEM-001..002` complete as evidence supports.
4. Perform mandatory Sprint 005 close protocol.
5. Start Sprint 006 only after the close is merged.

## Important files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeContext.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryScreen.tsx`
- `/apps/mobile/src/features/discovery/ItemDetailScreen.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteraction.ts`
- `/apps/mobile/src/features/discovery/itemInteractionLabels.ts`
- `/apps/mobile/src/features/discovery/itemInteraction.test.ts`

## Handoff

A fresh ChatGPT conversation can start with **"jatketaan reposta"**.

Read `AGENTS.md` -> `STATUS.md` -> this sprint file. Issue #51 / PR #52 is merged and main CI #77 is fully green. The only next step is to validate its standalone APK through Issue #34. Do **not** start Sprint 006 or close Sprint 005 before that succeeds.
