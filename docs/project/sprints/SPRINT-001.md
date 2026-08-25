# Sprint 001 — Foundation

Status: **COMPLETE**
Milestone: **MVP 0.1**
Started: **2026-08-25**
Completed: **2026-08-25**

## Goal

Create a repository and mobile-development foundation strong enough that future ChatGPT conversations and coding agents can continue Kajo without hidden conversation context.

## Scope

### Project memory

- Establish AGENTS mandatory workflow.
- Capture Kajo 0 product definition.
- Define MVP IDs.
- Lock canonical terminology.
- Define initial domain/event/prediction architecture.
- Establish ADR, sprint, milestone and handoff processes.

### Engineering foundation

- Create monorepo/workspace foundation.
- Create React Native + Expo + TypeScript app under `apps/mobile`.
- Add baseline lint/typecheck/test commands.
- Add CI.
- Introduce initial typed contracts for Profile, Item, Event, Context, DiscoveryMode and AmbientPhase.

## Relevant MVP requirements

Completed:

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`

## Non-goals

- Building final Room visuals.
- Connecting real book/movie providers.
- Implementing real recommendation ranking.
- Supabase schema beyond what is required for the skeleton.

## Definition of Done — result

- [x] New developer/agent can follow repository instructions and run the mobile skeleton.
- [x] CI validates the baseline project.
- [x] Core contracts use canonical glossary terms.
- [x] STATUS/CODEMAP/MVP accurately describe the repository at sprint close.
- [x] Sprint close checklist completed through Issue #4.

## Delivered

### Project memory

- Repository project-memory and handoff architecture established.
- Kajo 0 Product Constitution captured.
- MVP requirement IDs established.
- Canonical glossary, domain/event/prediction models and ADR-0001 through ADR-0004 established.
- Sprint, milestone, Issue, PR and AI conversation handoff processes established.

### Engineering foundation — Issue #2 / PR #3

- npm workspace/monorepo root created.
- Committed npm lockfile created from the validated dependency graph.
- React Native + Expo SDK 57 + TypeScript app skeleton created under `apps/mobile`.
- Expo Router root shell created.
- Root/mobile lint, typecheck and test commands created.
- iOS and Android Expo bundle smoke checks added.
- GitHub Actions CI created with locked dependency installation through `npm ci`.
- Initial typed canonical contracts created for Profile, Item, Event, Context, Prediction, DiscoveryMode and AmbientPhase.
- Canonical `DiscoveryMode` -> `AmbientPhase` mapping implemented and tested.
- README development quick-start and CODEMAP updated.

## Validation evidence

PR #3 and the post-merge `main` CI both passed:

- `npm ci`
- lint
- TypeScript typecheck
- Vitest unit tests
- Expo iOS bundle export
- Expo Android bundle export

PR #3 was squash-merged to `main` as commit `ba3c551b636d7fc803ded8588f087d56e76bea69`.

## Decisions

See ADR-0001 through ADR-0004. No additional durable architecture decision was required during the engineering implementation.

## Deferred

- Room feature implementation -> Sprint 002.
- Curtain/theme interaction -> Sprint 003.
- Real external content providers and recommendation ranking -> later sprints.
- Shared Room/theme identity -> Shared Kajo sprint.

## Known issues

No blocking Foundation issue remains. Dependency installation emits non-blocking upstream deprecation warnings; review them during normal dependency upgrades rather than expanding this completed sprint.

## Important files

- `/AGENTS.md`
- `/README.md`
- `/package.json`
- `/package-lock.json`
- `/apps/mobile/package.json`
- `/apps/mobile/app/`
- `/apps/mobile/src/domain/`
- `/.github/workflows/ci.yml`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`

## Final handoff

Sprint 001 is complete and historical. Continue with **Sprint 002 — Room** in `SPRINT-002.md`.

Do not extend Sprint 001 with Room, curtain/theme, provider or recommendation work. A fresh conversation must read `AGENTS.md`, `STATUS.md`, `MVP.md`, the active Sprint 002 file, glossary, relevant UX/architecture documents and actual implementation before coding.
