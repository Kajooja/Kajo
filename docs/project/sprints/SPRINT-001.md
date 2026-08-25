# Sprint 001 — Foundation

Status: **ACTIVE — VALIDATED, MERGE PENDING**
Milestone: **MVP 0.1**
Started: **2026-08-25**

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

- `MVP-FOUND-001`
- `MVP-FOUND-002`
- `MVP-FOUND-003`

## Non-goals

- Building final Room visuals.
- Connecting real book/movie providers.
- Implementing real recommendation ranking.
- Supabase schema beyond what is required for the skeleton.

## Definition of Done

- New developer/agent can follow repository instructions and run the mobile skeleton.
- CI validates the baseline project.
- Core contracts use canonical glossary terms.
- STATUS/CODEMAP/MVP accurately describe the repository.
- Sprint close checklist has been completed.

## Delivered so far

### Project memory

- Repository project-memory and handoff architecture established.
- Kajo 0 Product Constitution captured.
- MVP requirement IDs established.
- Canonical glossary, domain/event/prediction models and initial ADRs established.
- Sprint, milestone, Issue, PR and AI conversation handoff processes established.

### Engineering foundation — PR #3

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

PR #3 latest Foundation validation passed:

- `npm ci`
- lint
- TypeScript typecheck
- Vitest unit tests
- Expo iOS bundle export
- Expo Android bundle export

## Decisions

See ADR-0001 through ADR-0004. No new durable architecture decision was required during the engineering implementation.

## Deferred

- Room feature implementation belongs to Sprint 002.
- Curtain/theme interaction belongs to Sprint 003.
- Real external content providers and recommendation ranking remain deferred to later sprints.

## Known issues

No blocking Foundation issue is known. Dependency install currently emits non-blocking upstream deprecation warnings; they do not prevent validation and should be reviewed when dependency versions are next upgraded.

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

## Handoff

PR #3 is validated and ready for merge. After merge, execute the mandatory Sprint 001 close protocol: mark Foundation MVP IDs complete, set this sprint to COMPLETE, update STATUS, and open Sprint 002 — Room before starting Room implementation.
