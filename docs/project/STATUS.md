# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 001 — Foundation** (`sprints/SPRINT-001.md`)
Last completed sprint: **None**

This is the authoritative current-state document.

## Current state

Kajo 0 product definition, repository project memory and the Sprint 001 engineering foundation are established on PR #3.

The current branch contains:

- npm monorepo/workspace root with committed npm lockfile,
- React Native + Expo SDK 57 + TypeScript mobile skeleton under `apps/mobile`,
- Expo Router root navigation shell,
- root/mobile commands for lint, typecheck, tests and platform bundle smoke checks,
- GitHub Actions CI using `npm ci`,
- initial typed canonical domain contracts,
- canonical `DiscoveryMode` -> `AmbientPhase` mapping and test.

PR #3 has been validated successfully with:

- dependency installation from the committed lockfile,
- lint,
- TypeScript typecheck,
- unit tests,
- Expo bundle export for both iOS and Android.

No Room feature implementation exists yet.

## MVP progress

See `../product/MVP.md`.

Foundation implementation is validated but its MVP requirements remain unmarked until PR #3 is merged and the Sprint 001 close protocol is completed.

## In progress

- Issue #2 — Sprint 001 mobile engineering foundation.
- Pull request #3 — validated and awaiting merge.

## Next

1. Merge accepted PR #3.
2. Complete the Sprint 001 close protocol.
3. Mark `MVP-FOUND-001`, `MVP-FOUND-002` and `MVP-FOUND-003` complete.
4. Open Sprint 002 — Room and its first implementation Issue.
5. Do not start Curtain/Theme or real discovery ranking work during Sprint 002.

## Known issues / open decisions

- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- Exact visual art direction of the Room will be iterated during Room sprint; principles are locked, assets are not.
- Prediction V0 feature implementation is intentionally deferred until the UI/data foundation exists.

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
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-001.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

PR #3 is the validated Sprint 001 engineering foundation. The next action is to merge it and immediately perform the mandatory Sprint 001 close documentation before Room feature work begins.
