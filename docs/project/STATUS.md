# Kajo Current Status

Last updated: **2026-08-26**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 005 — Swipe & History** (`sprints/SPRINT-005.md`)
Last completed sprint: **Sprint 004 — Discovery UI** (`sprints/SPRINT-004.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation, Sprint 002 Room, Sprint 003 Curtain & Theme and Sprint 004 Discovery UI are complete.

The mobile MVP currently provides:

- Expo SDK 57 / React Native mobile application foundation,
- personal minimalist 2D Room as the home/navigation surface,
- three-state curtain-driven `DiscoveryMode`,
- reusable base theme plus DAWN/EVENING/NIGHT ambient mapping,
- bookshelf -> book discovery and projector -> movie discovery,
- generic BOOK/MOVIE local mock Items,
- deterministic mode-dependent mock ranking explicitly separate from Prediction V0,
- reusable two-column grid discovery,
- generic Item detail flow,
- no obsolete discovery placeholder implementation.

Sprint 004 implementation was validated both automatically and on a real Android phone.

Automated `main` evidence includes:

- dependency install,
- lint,
- TypeScript typecheck,
- automated tests,
- iOS Expo bundle smoke,
- Android Expo bundle smoke,
- standalone Android release APK build,
- verification that `assets/index.android.bundle` is embedded in the APK,
- APK artifact upload.

Issue #20 records real-device acceptance: the standalone app launches, the MVP works without crashes, and navigation/transitions were reported as natural.

## MVP progress

See `../product/MVP.md`.

Completed through Sprint 004:

- `MVP-FOUND-001..003`
- `MVP-ROOM-001..005` except `MVP-ROOM-006`
- `MVP-DISC-001..006`

New explicit MVP identity requirements are planned, not implemented:

- `MVP-AUTH-001` — lightweight/common register/sign-in.
- `MVP-AUTH-002` — user-visible nickname/username.

## In progress

Sprint 005 — Swipe & History.

Primary targets:

- optional BOOK/MOVIE swipe flow that grows naturally from grid/detail discovery,
- positive/negative interest,
- watched/read consumed state,
- save/unsave,
- consumed history,
- suppression of already-consumed Items in ordinary mock discovery,
- small curtain acceptance polish carried forward from the Sprint 004 phone test.

## Next

1. Create a scoped engineering Issue for the accepted curtain polish: seamless three-state movement, thinner handle/control, full-scene DiscoveryMode effect.
2. Inspect current discovery/detail state ownership before introducing swipe state.
3. Create the first scoped Swipe & History implementation Issue.
4. Keep grid discovery as the primary surface and make swipe optional.
5. Add deterministic tests for new interaction/state behavior.
6. Run `npm run check` and repeat real-device acceptance for user-facing changes before Sprint 005 close.

## Accepted follow-up product decisions

- Authentication/register/login is required later in MVP 0.1 and belongs to Sprint 006 Backend Foundation rather than being retrofitted into Sprint 005.
- Signed-in users need a user-visible nickname/username.
- Curtain movement should feel continuous/seamless; its handle/control should be visually thinner than the curtain.
- DiscoveryMode should affect the full underlying Room/discovery atmosphere, not only the curtain component.
- Grid remains the default discovery UI, while opening an Item should be able to flow naturally into optional swipe-oriented browsing.

## Known issues / open decisions

- Current Room/curtain/theme art and mock covers are functional/structural, not final production artwork.
- Real provider integration remains later scope.
- Current mode-dependent ordering is mock discovery logic, not Prediction V0.
- Final book metadata provider is not yet locked.
- Exact authentication provider/method mix is not yet selected; the MVP requirement is intentionally provider-agnostic.
- Exact nickname/username uniqueness rules are not yet defined.
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
- `/docs/project/sprints/SPRINT-005.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Continue **Sprint 005 — Swipe & History**. Start with the small curtain acceptance polish recorded in the sprint/UX principles, then establish the minimal generic interaction-state boundary for optional swipe, interest, saved and consumed behavior. Do not implement backend/auth yet; Sprint 006 owns that scope.
