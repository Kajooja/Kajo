# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 002 — Room** (`sprints/SPRINT-002.md`)
Last completed sprint: **Sprint 001 — Foundation** (`sprints/SPRINT-001.md`)

This is the authoritative current-state document.

## Current state

Sprint 001 Foundation is complete. PR #3 is merged to `main`, Issue #2 is closed, and the post-merge `main` CI is green.

The repository now contains:

- npm monorepo/workspace root with committed lockfile,
- React Native + Expo SDK 57 + TypeScript mobile skeleton under `apps/mobile`,
- Expo Router root navigation shell,
- root/mobile lint, typecheck, unit-test and iOS/Android bundle smoke commands,
- GitHub Actions CI using `npm ci`,
- initial typed canonical domain contracts,
- canonical `DiscoveryMode` -> `AmbientPhase` mapping and test,
- permanent project-memory, sprint and handoff documentation.

The application currently displays only the Foundation placeholder screen. No Room feature exists yet.

## MVP progress

See `../product/MVP.md`.

Completed Foundation requirements:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`

Current product work moves to the Room requirements. Do not mark Room requirements complete until their actual acceptance criteria are met.

## In progress

- Sprint 002 — Room.

## Next

1. Read `sprints/SPRINT-002.md`, `../product/UX_PRINCIPLES.md` and the relevant architecture/domain documents.
2. Create the first Sprint 002 implementation Issue and branch.
3. Replace the Foundation placeholder with the first recognizable minimalist 2D Room home surface.
4. Establish clear bookshelf and movie-screen interaction/navigation boundaries using mock content only.
5. Keep CI green and update CODEMAP as Room implementation paths appear.

## Known issues / open decisions

- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- Exact visual art direction of the Room will be iterated during Sprint 002; UX principles are locked, final assets are not.
- Theme engine and curtain interaction belong to Sprint 003 and must not be pulled into Sprint 002 prematurely.
- Prediction V0 implementation remains deferred until the UI/data foundation exists.

## Important files

- `/AGENTS.md`
- `/README.md`
- `/package.json`
- `/package-lock.json`
- `/apps/mobile/package.json`
- `/apps/mobile/app/`
- `/apps/mobile/src/domain/`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-001.md`
- `/docs/project/sprints/SPRINT-002.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Sprint 001 is closed. Continue **Sprint 002 — Room**. The next concrete action is to create the first Room implementation Issue/branch and build the Room shell from the current Expo placeholder without implementing Sprint 003 curtain/theme behaviour or real discovery/ranking.
