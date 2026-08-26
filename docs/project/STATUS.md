# Kajo Current Status

Last updated: **2026-08-26**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 005 — Swipe & History** (`sprints/SPRINT-005.md`)
Last completed sprint: **Sprint 004 — Discovery UI** (`sprints/SPRINT-004.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation, Sprint 002 Room, Sprint 003 Curtain & Theme and Sprint 004 Discovery UI are complete.

Sprint 005 implementation is substantially merged but remains **open pending real-device acceptance**.

The mobile MVP currently provides:

- Expo SDK 57 / React Native mobile application foundation,
- personal minimalist 2D Room as the home/navigation surface,
- three-state curtain-driven `DiscoveryMode`,
- reusable base theme plus DAWN/EVENING/NIGHT ambient mapping,
- continuous/thinner curtain interaction with full-scene DiscoveryMode atmosphere,
- bookshelf -> book discovery and projector -> movie discovery,
- generic BOOK/MOVIE local mock Items,
- deterministic mode-dependent mock ranking explicitly separate from Prediction V0,
- reusable two-column grid discovery,
- grid -> selected Item -> horizontal optional swipe flow,
- one generic in-memory Item interaction state for BOOK and MOVIE,
- positive/negative interest actions,
- save/unsave,
- generic consumed state presented as read for BOOK and watched for MOVIE,
- consumed Items suppressed from ordinary discovery,
- consumed book/movie history inside the existing discovery screen,
- no separate duplicate book/movie interaction models, swipe route or history route.

Sprint 004 was validated both automatically and on a real Android phone.

Sprint 005 automated implementation evidence:

- curtain acceptance polish merged through PR #31,
- swipe/history implementation merged through PR #33 as commit `2b8b10f4cac92113a0d219962162087c8a0544d3`,
- PR #33 passed lint, TypeScript typecheck, automated tests and iOS/Android Expo bundle smoke,
- `main` CI run #62 validates the merged swipe/history implementation and builds the standalone Android release APK,
- Issue #34 tracks the required real-device acceptance flow.

## MVP progress

See `../product/MVP.md`.

Completed through Sprint 004:

- `MVP-FOUND-001..003`
- `MVP-ROOM-001..005` except `MVP-ROOM-006`
- `MVP-DISC-001..006`

Implemented in Sprint 005 but **not yet marked complete pending device acceptance**:

- `MVP-SWIPE-001..004`
- `MVP-MEM-001..002`

New explicit MVP identity requirements are planned, not implemented:

- `MVP-AUTH-001` — lightweight/common register/sign-in.
- `MVP-AUTH-002` — user-visible nickname/username.

## In progress

Sprint 005 — Swipe & History acceptance and close preparation.

Current acceptance target:

- Issue #34 — verify the complete curtain + grid + swipe + interest + saved + read/watched + consumed-history flow on a real phone.

Do not mark the Sprint 005 MVP targets complete solely from automated validation.

## Next

1. Finish the acceptance-readiness/canonical-handoff cleanup tracked by Issue #35.
2. Use the resulting `main` standalone Android release APK for Issue #34 real-device acceptance.
3. Verify Room -> discovery -> swipe -> actions -> consumed suppression/history -> back navigation on the phone.
4. Fix any runtime/UI defect with a scoped Issue/PR and regression test where practical.
5. Only after successful device acceptance, mark `MVP-SWIPE-001..004` and `MVP-MEM-001..002` complete and perform the mandatory Sprint 005 close protocol.
6. Open Sprint 006 — Backend Foundation only after Sprint 005 is properly closed.

## Accepted follow-up product decisions

- Authentication/register/login is required later in MVP 0.1 and belongs to Sprint 006 Backend Foundation rather than being retrofitted into Sprint 005.
- Signed-in users need a user-visible nickname/username.
- Curtain movement should feel continuous/seamless; its handle/control should be visually thinner than the curtain.
- DiscoveryMode should affect the full underlying Room/discovery atmosphere, not only the curtain component.
- Grid remains the default discovery UI, while opening an Item flows naturally into optional swipe-oriented browsing.

## Known issues / open decisions

- Sprint 005 interaction state is intentionally in-memory only; persistence belongs to Sprint 006.
- Sprint 005 real-device acceptance is still pending in Issue #34.
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
- `/apps/mobile/src/features/discovery/DiscoveryScreen.tsx`
- `/apps/mobile/src/features/discovery/ItemDetailScreen.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteraction.ts`
- `/apps/mobile/src/features/discovery/itemInteraction.test.ts`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-005.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Continue **Sprint 005 — Swipe & History** from Issue #34. The curtain polish and swipe/history application code are merged and automated validation is green. The next blocking action is real-device acceptance using the latest standalone Android APK from `main`; do not start Sprint 006 or mark Sprint 005 MVP requirements complete before that result is recorded.
