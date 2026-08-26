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

## UX carry-over from Sprint 004 acceptance

Before or alongside swipe implementation, apply the accepted curtain polish without redesigning the control:

- movement between the three curtain states should feel continuous/seamless,
- the handle/control should be visually thinner than and subordinate to the curtain,
- the selected DiscoveryMode atmosphere should affect the full underlying Room/discovery experience rather than appearing local to the curtain only.

These are refinements of existing UX principles, not a new discovery mode or new domain concept.

## Relevant MVP requirements

Primary Sprint 005 targets:

- `MVP-SWIPE-001` — user can enter an optional swipe mode for books and movies.
- `MVP-SWIPE-002` — user can express positive/negative interest.
- `MVP-SWIPE-003` — user can mark a movie as watched and a book as read.
- `MVP-SWIPE-004` — already-consumed Items are strongly suppressed from ordinary repeated discovery.
- `MVP-MEM-001` — user can save/unsave an Item.
- `MVP-MEM-002` — user can view consumed books/movies.

Preserve completed discovery requirements from Sprint 004.

## Non-goals

- Backend/Supabase persistence; planned for Sprint 006.
- Register/login implementation; planned for Sprint 006.
- User nickname/username implementation; planned for Sprint 006.
- Production recommendation scoring or `MVP-PRED-*` semantics.
- Event engine/analytics persistence; planned for Sprint 007.
- Rating consumed Items; remains later Memory scope.
- SharedProfile state.
- Final production artwork.

## Architecture constraints

- Continue using generic `Item`; do not split swipe state into separate book/movie core models.
- Keep consumed semantics generic while allowing domain-specific UI labels (`watched` / `read`).
- Keep mobile interaction state behind one clear feature boundary so later backend persistence can replace storage without rewriting presentation components.
- Do not call local filtering/suppression Prediction V0.
- Do not create empty backend/data folders before they are needed.

## UX constraints

- Grid remains the default browse surface.
- Grid -> Item -> swipe should feel like one continuous content flow.
- Swipe is optional; users must not be forced into it to browse.
- Actions must have accessible non-gesture alternatives.
- Avoid casino/dating-app visual language, excessive counters or gamification.
- Saved/read/watched state should be understandable without heavy chrome.
- Respect reduced-motion settings.

## Definition of Done

- Existing grid discovery remains functional.
- A user can enter and leave an optional swipe sequence for both BOOK and MOVIE Items.
- Positive and negative interest actions work through explicit state logic.
- BOOK can be marked read and MOVIE watched through the generic consumed-state boundary.
- Save/unsave works.
- Consumed books/movies can be viewed.
- Already-consumed Items are strongly suppressed from normal repeated mock discovery.
- Curtain acceptance polish is applied without breaking three-state DiscoveryMode behavior.
- Deterministic behavior has automated tests where practical.
- No obsolete placeholder/duplicate implementation remains.
- `npm run check` passes.
- The user-facing path is exercised on a real phone/emulator/simulator before sprint close when available.
- `STATUS.md`, `MVP.md` and `CODEMAP.md` reflect repository truth at close.

## Initial implementation sequence

1. Inspect the merged Sprint 004 discovery/detail/state implementation.
2. Create one scoped engineering Issue for the curtain acceptance polish and implement it without changing DiscoveryMode semantics.
3. Create the first scoped Swipe & History implementation Issue.
4. Define the minimal generic mobile interaction-state boundary.
5. Implement grid/detail -> optional swipe sequence.
6. Add interest, saved and consumed actions.
7. Add consumed-history presentation and mock suppression.
8. Add tests and run full CI/device acceptance.
9. Complete the sprint close protocol only after runtime acceptance.

## Important starting files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/room/CurtainControl.tsx`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/discovery/`
- `/apps/mobile/app/discovery/`

## Handoff

Start Sprint 005 with the small curtain acceptance polish, then move into the generic swipe/history state boundary. Do not introduce backend persistence or authentication in this sprint; those are explicit Sprint 006 targets.
