# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 001 — Foundation** (`sprints/SPRINT-001.md`)
Last completed sprint: **None**

This is the authoritative current-state document.

## Current state

Kajo 0 product definition and the repository project-memory structure are established.

Sprint 001 engineering foundation is now implemented on Issue #2 / branch `feat/2-mobile-foundation` pending dependency lockfile generation, CI validation, review and merge.

The branch currently contains:

- npm monorepo/workspace root,
- React Native + Expo SDK 57 + TypeScript mobile skeleton under `apps/mobile`,
- Expo Router root navigation shell,
- baseline lint/typecheck/test commands,
- GitHub Actions CI definition,
- initial typed canonical domain contracts,
- canonical `DiscoveryMode` -> `AmbientPhase` mapping and test.

No Room feature implementation exists yet.

## MVP progress

See `../product/MVP.md`.

No Foundation requirement is marked complete until Issue #2 is validated and merged.

## In progress

- Issue #2 — Sprint 001 mobile engineering foundation.
- Branch: `feat/2-mobile-foundation`.

## Next

1. Generate and commit the npm dependency lockfile for the workspace.
2. Run/install dependencies and execute `npm run check`.
3. Open/validate the Issue #2 pull request and confirm CI passes.
4. Merge accepted foundation changes.
5. Mark `MVP-FOUND-001`, `MVP-FOUND-002` and `MVP-FOUND-003` complete only when their acceptance criteria are actually met.
6. Complete the Sprint 001 close protocol before starting Room feature work.

## Known issues / open decisions

- The current CI uses `npm ci`, so a committed dependency lockfile is required before CI can pass.
- Local validation could not be completed from the current agent runtime because its container could not resolve GitHub/npm hosts; this is an environment limitation, not evidence that the code passes.
- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- Exact visual art direction of the Room will be iterated during Room sprint; principles are locked, assets are not.
- Prediction V0 feature implementation is intentionally deferred until the UI/data foundation exists.

## Important files

- `/AGENTS.md`
- `/package.json`
- `/apps/mobile/package.json`
- `/apps/mobile/app/`
- `/apps/mobile/src/domain/`
- `/.github/workflows/ci.yml`
- `/docs/product/MVP.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-001.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

Continue Issue #2 on `feat/2-mobile-foundation`. Do not start Room work yet. First make dependency installation reproducible, run the baseline checks, validate CI and merge the foundation PR.
