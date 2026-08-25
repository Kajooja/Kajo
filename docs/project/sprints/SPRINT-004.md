# Sprint 004 — Discovery UI

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-25**

## Goal

Build the first real book/movie discovery experience on top of the Room, curtain and theme foundation using local mock Items and deterministic mock ranking.

Sprint 004 should turn the existing bookshelf/projector navigation boundaries into usable discovery flows without introducing real providers, backend persistence or prediction-service semantics.

## Scope

- Create a feature-oriented discovery implementation under `apps/mobile/src/features/discovery/`.
- Replace the current book/movie placeholder destinations with real discovery screens.
- Use generic Kajo `Item` contracts and local/mock BOOK and MOVIE data rather than provider-specific schemas.
- Show books and movies in a calm visual grid experience.
- Add reusable Item cards suitable for both BOOK and MOVIE Items.
- Allow a user to open Item details from discovery.
- Preserve the selected `DiscoveryMode` when navigating from Room into discovery.
- Support `FOR_YOU`, `SURPRISE` and `RISK` in the discovery UI.
- Make grid ordering change deterministically by DiscoveryMode using explicit mock-ranking logic.
- Keep the mock-ranking boundary clearly separate from later Prediction V0 implementation.
- Preserve theme/ambient behavior established in Sprint 003.
- Keep bookshelf and projector as the Room entry points for book/movie discovery.
- Add tests for meaningful ranking/filter/navigation-state logic.
- Keep lint, typecheck, tests and iOS/Android bundle smoke checks green.
- Update CODEMAP/STATUS/MVP only for truth that actually changes.

## Relevant MVP requirements

Primary Sprint 004 targets:

- `MVP-ROOM-003` — bookshelf opens book discovery.
- `MVP-ROOM-004` — screen/projector opens movie discovery.
- `MVP-DISC-001` — books and movies have a visual grid discovery experience.
- `MVP-DISC-002` — discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.
- `MVP-DISC-005` — grid ranking changes when DiscoveryMode changes.
- `MVP-DISC-006` — user can open Item details.

Already established and must remain intact:

- `MVP-DISC-003` — curtain controls DiscoveryMode.
- `MVP-DISC-004` — ambient mapping remains separate from the base theme.

## Non-goals

- Real recommendation/prediction scoring.
- `MVP-PRED-003`; mode-dependent algorithm semantics remain Prediction V0 scope.
- Real TMDB/Open Library or other external provider integration.
- Supabase/backend persistence.
- Event capture/analytics engine.
- Swipe mode, like/dislike, saved/consumed state.
- SharedProfile discovery.
- Production search.
- Final production artwork.

## Architecture constraints

- Discovery consumes generic `Item`; do not create separate core BookPrediction/MoviePrediction models.
- Mock ranking must be explicitly named/located as mock discovery logic, not presented as the future prediction engine.
- Keep route/presentation components thin; reusable discovery state/ranking belongs in feature logic.
- DiscoveryMode state should have one clear mobile ownership boundary so Room and discovery do not silently diverge.
- Do not move prediction logic into the mobile client under the name of mock ranking.

## UX constraints

- Grid-first browsing; swipe remains optional/later.
- Content should dominate over navigation chrome.
- Preserve Room -> object -> discovery mental model.
- Mode changes should be understandable through ordering/atmosphere without excessive labels or gamification.
- Item details should return cleanly to the originating discovery context.
- Maintain accessible labels, touch targets and readable text.

See `/docs/product/UX_PRINCIPLES.md` before implementation.

## Definition of Done

- Bookshelf opens a real local/mock book discovery grid rather than a placeholder.
- Movie screen/projector opens a real local/mock movie discovery grid rather than a placeholder.
- Book and movie grids use generic Kajo Item data/contracts.
- Discovery mode selected in Room is available in discovery.
- Discovery UI supports all three canonical DiscoveryModes.
- Deterministic mock grid ordering changes for at least FOR_YOU/SURPRISE/RISK and is covered by tests.
- A user can open a generic Item detail view and return to discovery.
- Real provider/backend/prediction semantics remain outside the implementation.
- `npm run check` passes including iOS/Android bundle smoke checks.
- User-facing acceptance is exercised on a real phone/emulator/simulator when such a runtime is available; unavailable runtime validation must be recorded explicitly and never inferred from bundle smoke success.
- CODEMAP/STATUS/MVP accurately describe the repository at sprint close.

## Initial implementation sequence

1. Inspect Room routes, current DiscoveryMode ownership and generic Item contract.
2. Create one scoped Sprint 004 implementation Issue and branch.
3. Establish shared mobile DiscoveryMode ownership across Room/discovery.
4. Add mock generic Items and deterministic mock ranking.
5. Build reusable discovery grid and Item card.
6. Replace book/movie placeholder routes with discovery screens.
7. Add generic Item detail route/view.
8. Add tests and validate CI.
9. Complete sprint close protocol only when all Definition of Done items are met.

## Important starting files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/app/_layout.tsx`
- `/apps/mobile/app/discovery/books.tsx`
- `/apps/mobile/app/discovery/movies.tsx`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/CurtainControl.tsx`

## Mid-sprint checkpoint — 2026-08-25

Issue #18 / PR #19 delivered the first real local/mock discovery implementation and was squash-merged to `main` as commit `1de51bda035d8ad3d7666a95473697c6ff47e772`.

Delivered implementation:

- shared Room/discovery `DiscoveryMode` ownership,
- generic BOOK/MOVIE mock Items,
- deterministic mock ranking for all three modes,
- generic two-column discovery grid,
- real book and movie routes,
- generic Item detail route/view,
- removal of the obsolete `RoomDestinationPlaceholder.tsx`,
- automated ranking/filtering/lookup tests.

Validation evidence:

- PR #19 canonical automated gate passed: lint, typecheck, tests, iOS bundle smoke and Android bundle smoke.
- Post-merge `main` CI for `1de51bda035d8ad3d7666a95473697c6ff47e772` also passed the full gate.
- Repository hygiene review found no remaining discovery placeholder component or duplicate BOOK/MOVIE screen implementation.

Outstanding acceptance:

- A real phone/emulator/simulator runtime was not available in the connected AI execution environment.
- Therefore the user-facing flow has **not yet been device/runtime verified**.
- Issue #20 tracks the exact Room -> discovery -> detail -> back runtime acceptance flow.
- Do not mark the Sprint 004 MVP requirements complete and do not close this sprint until that result is recorded.

## Handoff

Continue Sprint 004 from open Issue #20. Application code is merged and automated validation is green. The next action is real runtime verification on a phone/emulator/simulator, followed by scoped fixes if needed and then the mandatory Sprint 004 close protocol.
