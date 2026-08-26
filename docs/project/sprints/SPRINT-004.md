# Sprint 004 — Discovery UI

Status: **COMPLETE**
Milestone: **MVP 0.1**
Started: **2026-08-25**
Completed: **2026-08-26**

## Goal

Build the first real book/movie discovery experience on top of the Room, curtain and theme foundation using local mock Items and deterministic mock ranking.

Sprint 004 turned the existing bookshelf/projector navigation boundaries into usable discovery flows without introducing real providers, backend persistence or prediction-service semantics.

## Delivered

- Shared Room/discovery `DiscoveryMode` ownership.
- Generic BOOK/MOVIE mock Items.
- Deterministic mock ranking for all three modes.
- Reusable two-column discovery grid/card presentation.
- Real book and movie discovery routes replacing placeholders.
- One generic Item detail route/view.
- Theme/AmbientPhase behavior carried into discovery.
- Automated ranking/filtering/lookup tests.
- Obsolete `RoomDestinationPlaceholder.tsx` removed when replaced.
- Standalone Android release APK CI path added and validated.
- Expo SDK 57-compatible Reanimated/Worklets dependency versions pinned after native Android compilation exposed dependency drift.

## Completed MVP requirements

- `MVP-ROOM-003` — bookshelf opens book discovery.
- `MVP-ROOM-004` — screen/projector opens movie discovery.
- `MVP-DISC-001` — books and movies have a visual grid discovery experience.
- `MVP-DISC-002` — discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.
- `MVP-DISC-005` — grid ranking changes when DiscoveryMode changes.
- `MVP-DISC-006` — user can open Item details.

Already established and preserved:

- `MVP-DISC-003` — curtain controls DiscoveryMode.
- `MVP-DISC-004` — ambient mapping remains separate from the base theme.

## Validation evidence

Automated validation:

- PR #19 and post-merge `main` passed dependency install, lint, TypeScript typecheck, tests and iOS/Android Expo bundle smoke.
- Native Android validation later exposed an Expo/Reanimated/Worklets dependency incompatibility that bundle smoke could not detect.
- PR #27 pinned the Expo SDK 57-compatible dependency pair and regenerated the committed lockfile.
- `main` CI run #48 passed the complete automated gate plus standalone Android `assembleRelease`, embedded `assets/index.android.bundle` verification and APK artifact upload.

Real-device validation:

- Issue #20 records successful testing of the standalone Android release APK on a real phone.
- User reported that the application launches, the MVP works without crashes and transitions/navigation feel natural.
- No blocking runtime defect remained for Sprint 004 close.

## Accepted follow-up feedback

The following observations are deliberate follow-up work rather than Sprint 004 blockers:

- Authentication is still absent. MVP 0.1 must later provide lightweight/common register/sign-in plus a user-visible nickname/username; this is planned for Sprint 006.
- Curtain control should transition continuously/seamlessly, with a visually thinner handle/control than the curtain itself. DiscoveryMode should affect the full scene/content behind it, not only the local curtain presentation. This is now a product-wide UX rule and a small carry-over polish item for the next work.
- Grid remains the primary discovery surface, but opening an Item should evolve naturally into an optional swipe-oriented browsing sequence. This is planned in Sprint 005.

## Explicitly deferred

- Real recommendation/prediction scoring.
- `MVP-PRED-003`; mode-dependent algorithm semantics remain Prediction V0 scope.
- Real TMDB/Open Library or other external provider integration.
- Supabase/backend persistence.
- Event capture/analytics engine.
- Like/dislike, saved/consumed state and swipe behavior.
- SharedProfile discovery.
- Production search.
- Final production artwork.

## Important implementation paths

- `/apps/mobile/app/discovery/`
- `/apps/mobile/src/domain/discovery.ts`
- `/apps/mobile/src/features/discovery/`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/.github/workflows/ci.yml`
- `/apps/mobile/package.json`
- `/package-lock.json`

## Handoff

Sprint 004 is historical and must not be reopened for later feature work. Continue from **Sprint 005 — Swipe & History**. Preserve grid-first discovery, generic `Item` contracts and the separation between mock/mobile discovery logic and the future Prediction V0 service.
