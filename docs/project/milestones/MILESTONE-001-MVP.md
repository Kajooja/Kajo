# Milestone 001 — Kajo MVP 0.1

Status: **ACTIVE**
Started: **2026-08-25**

## Outcome

Deliver the first small but genuine Kajo product: two people can each have a personal Kajo, form a Shared Kajo, discover books/movies through the Room and grid/swipe experiences, build history, and receive generic personalized recommendations whose data model can later evolve into ScenarioMemory and evolutionary prediction.

## Acceptance source

`docs/product/MVP.md` is the executable requirement list for this milestone.

## Planned sprint sequence

See `docs/project/ROADMAP.md`.

## Delivered

Sprints 001–007 are complete. The validated product baseline includes the mobile foundation, Room, global DiscoveryMode curtain, BOOK/MOVIE grid and optional swipe flow, generic Item interaction state, consumed history, bounded exact-card undo, configured Supabase authentication, one PersonalProfile per User, persisted BOOK/MOVIE current interactions and an append-only generic Event stream with session, actor/Profile and prediction correlation. Authentication and interaction/Event flows have configured Android evidence. Sprint 008 Prediction V0 is active; requirement-level truth remains in `docs/product/MVP.md` and current execution state in `docs/project/STATUS.md`.

## Known milestone risks

- Over-expanding item domains before the book/movie core works.
- Building the evolution engine before enough outcome data exists.
- Letting the Room become a game/3D project instead of a minimal interface.
- Domain-specific code drift that breaks cross-domain learning.
- Losing project decisions in AI conversations instead of repository memory.

## Close requirements

At milestone close, all in-scope MVP IDs must be reviewed explicitly, known limitations recorded, documentation reconciled with code, and a next-milestone handoff written.
