# Sprint 001 — Foundation

Status: **ACTIVE**
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

### Engineering foundation — next work in this sprint

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

- Repository project-memory and handoff architecture established.
- Kajo 0 Product Constitution captured.
- MVP requirement IDs established.
- Canonical glossary, domain/event/prediction models and initial ADRs established.
- Sprint, milestone, Issue, PR and AI conversation handoff processes established.

## Decisions

See ADR-0001 through ADR-0004.

## Deferred

Engineering portion of Sprint 001 is still pending.

## Known issues

None in code; no application code exists yet.

## Important files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/ARCHITECTURE.md`

## Handoff

Continue this same sprint by creating the Expo/TypeScript mobile skeleton, baseline workspace/checks/CI and initial typed domain contracts. Do not start Room feature work until the Foundation Definition of Done is met.
