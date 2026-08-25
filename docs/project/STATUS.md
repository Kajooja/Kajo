# Kajo Current Status

Last updated: **2026-08-25**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 001 — Foundation** (`sprints/SPRINT-001.md`)
Last completed sprint: **None**

This is the authoritative current-state document.

## Current state

Kajo 0 product definition and the repository project-memory structure are established.

The repository documentation defines:

- product constitution,
- MVP requirements,
- UX principles,
- canonical terminology,
- core domain model,
- event model,
- prediction/memory thesis,
- technical target architecture,
- ADR process,
- sprint/milestone/handoff workflow.

No application code exists yet.

## MVP progress

See `../product/MVP.md`.

Current implementation completion: **0 application requirements completed**. Documentation/bootstrap is completed foundation work inside Sprint 001.

## In progress

- Sprint 001 engineering foundation.

## Next

1. Create Expo + TypeScript mobile skeleton in `apps/mobile`.
2. Establish workspace/package manager and baseline lint/typecheck/tests.
3. Add initial CI.
4. Define the first typed domain contracts for Profile, Item, Event, Context, DiscoveryMode and AmbientPhase.
5. Update CODEMAP and close Sprint 001 only after the Foundation Definition of Done is met.

## Known issues / open decisions

- Final book metadata provider is not yet locked.
- Exact authentication/onboarding UX is not yet designed.
- Exact visual art direction of the Room will be iterated during Room sprint; principles are locked, assets are not.
- Prediction V0 feature implementation is intentionally deferred until the UI/data foundation exists.

## Important files

- `/AGENTS.md`
- `/docs/README.md`
- `/docs/product/PRODUCT.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-001.md`

## Handoff

A new conversation/agent must follow the read order in `/AGENTS.md`.

The next concrete engineering action is **Sprint 001 mobile foundation**: create the Expo/TypeScript app skeleton without implementing Room visuals yet.
