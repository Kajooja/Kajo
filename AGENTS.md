# Kajo — Mandatory Agent Instructions

This file is mandatory for every AI agent, coding agent and contributor working in this repository.

## 1. Source of truth

The Git repository is Kajo's permanent project memory. Chat conversations are temporary working contexts and must never be the only place where an important product, architecture, terminology or project-state decision exists.

If conversation context conflicts with repository documentation, stop and resolve the conflict before coding. Do not silently overwrite established project rules.

## 2. Mandatory read order before any work

Before editing code, data models, documentation or configuration, read in this order:

1. `/AGENTS.md` — this file.
2. `/docs/README.md` — documentation map.
3. `/docs/project/STATUS.md` — authoritative current state and handoff.
4. `/docs/product/MVP.md` — current MVP boundary and requirement IDs.
5. The current sprint file named in `STATUS.md`.
6. `/docs/domain/GLOSSARY.md` — canonical terminology.
7. Documentation relevant to the task, for example `DOMAIN_MODEL.md`, `DATA_EVENTS.md`, `PREDICTION_MODEL.md`, `UX_PRINCIPLES.md` or `ARCHITECTURE.md`.
8. `/docs/architecture/CODEMAP.md` — where relevant implementation lives.
9. Relevant ADRs in `/docs/architecture/decisions/`.
10. Inspect the actual existing implementation before proposing or making changes.

Do not start implementation until the current sprint, task scope and affected domain terms are understood.

## 3. Canonical domain rules

Kajo's core abstractions are:

- `User`
- `Profile`
- `Item`
- `Event`
- `Context`
- `HumanState`
- `Memory`
- `Scenario`
- `Prediction`

Rules:

- Predictions target a `Profile`, not directly a `User`.
- A `Profile` may be `PersonalProfile` or `SharedProfile`.
- A `SharedProfile` is a first-class learned profile, not merely an average of its members.
- `Item` is domain-agnostic. Do not introduce separate core models such as `BookProfile`, `MovieProfile`, `BookPrediction` or `MoviePrediction` unless an ADR explicitly changes this rule.
- Cross-domain learning is a core product requirement.
- Meaningful user behaviour must be represented through the event model.
- Demographic data may be used only as a weak cold-start prior. Behaviour must supersede demographic priors as real user data accumulates.
- Memory is evidence, not immutable truth. Learned state must be able to change.

Use terms exactly as defined in `GLOSSARY.md`. Do not invent synonyms in code for existing domain concepts.

## 4. UI rules

- Kajo is a **2D mobile application**, not a 3D room or game.
- The Room is the home and primary navigation metaphor.
- Keep navigation minimal.
- The user's identity theme remains the base visual layer.
- `DiscoveryMode` and `AmbientPhase` are separate concepts:
  - `FOR_YOU` -> `DAWN`
  - `SURPRISE` -> `EVENING`
  - `RISK` -> `NIGHT`
- The curtain is the signature control that moves between discovery modes.
- Visual atmosphere may produce preference signals, but visual preference must not be confused with discovery-risk preference.
- Prefer subtle light, opacity, gradient, shadow and motion changes over decorative UI chrome.

## 5. Coding rules

- Use English for code, file names, identifiers and canonical technical terminology.
- Prefer feature-oriented code organization.
- Keep business/domain logic out of presentation components.
- Mobile UI must not scatter direct database access through components; use a defined data/service boundary.
- Recommendation/prediction logic must not live in the mobile client.
- Database schema changes must be committed as migrations.
- Keep changes scoped to the assigned Issue/sprint goal.
- Do not refactor unrelated code in the same change.
- Do not create abstractions before they are needed.
- Add or update tests when behaviour changes and testing is meaningful.
- Run required lint, typecheck and tests before considering a coding task complete.

## 6. Git workflow

After repository bootstrap:

- Never develop directly on `main`.
- One Issue should normally map to one branch and one pull request.
- Branch names should be descriptive, for example `feat/23-curtain-control`.
- Pull requests should describe scope, MVP requirement IDs, tests and documentation impact.
- `main` should remain runnable and internally consistent.

## 7. Documentation obligations during normal work

Do not update every document on every PR. Update only the documents whose truth changed.

You MUST update:

- `GLOSSARY.md` if a new canonical domain term is introduced or meaning changes.
- `DOMAIN_MODEL.md` if domain relationships or invariants change.
- `DATA_EVENTS.md` if event semantics or payload requirements change.
- `PREDICTION_MODEL.md` if prediction inputs, outputs or learning semantics change.
- `UX_PRINCIPLES.md` if a product-wide UX rule changes.
- `CODEMAP.md` if an important implementation area is created, moved or renamed.
- an ADR if a durable architectural decision is made or reversed.
- `MVP.md` only when MVP scope/status changes.
- `ROADMAP.md` only when planned sequencing materially changes.

## 8. Mandatory sprint close protocol

A sprint is not complete until the repository can hand the project to a fresh conversation or agent without hidden context.

At sprint close, perform all of the following:

1. Ensure accepted sprint changes are merged and checks pass.
2. Update the sprint file: delivered work, decisions, deferred work, known issues and important files.
3. Mark completed MVP requirement IDs in `MVP.md`.
4. Update `STATUS.md` with the exact current state, next work and handoff instructions.
5. Update `GLOSSARY.md` if terminology changed.
6. Add/update ADRs for durable architecture decisions.
7. Update `CODEMAP.md` if important paths changed.
8. Update `ROADMAP.md` only if sequencing changed.
9. Make sure the next sprint or next action is explicit.

See `/docs/project/WORKFLOW.md`.

## 9. Mandatory milestone close protocol

At milestone close:

1. Verify milestone acceptance criteria.
2. Update the milestone document with delivered capabilities and evidence.
3. Update `STATUS.md`, `ROADMAP.md` and `MVP.md`/future product scope as applicable.
4. Record any architecture decisions that changed during the milestone.
5. Confirm documentation and `CODEMAP.md` match the repository.
6. Record known limitations and migration/debt items.
7. Create an explicit handoff to the next milestone.

## 10. Conversation handoff protocol

A chat ending is NOT a reason to close a sprint.

If work must move to a new conversation while a sprint is active:

1. Update `STATUS.md` only as needed to state what is complete, in progress and next.
2. Add a concise mid-sprint handoff to the active sprint document if meaningful context would otherwise be lost.
3. Do not mark incomplete requirements as done.
4. Do not rewrite historical sprint documents.

A new conversation should be able to start with: **"Continue Kajo from the repository."**

See `/docs/project/HANDOFF_PROTOCOL.md`.
