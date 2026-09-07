# Kajo — Mandatory Agent Instructions

This file is mandatory for every AI agent, coding agent and contributor working in this repository.

## 1. Repository is permanent memory

The Git repository is Kajo's permanent project memory. Chat conversations are temporary working contexts and must never be the only place where an important product, architecture, terminology or project-state decision exists.

If conversation context conflicts with repository documentation, resolve the conflict explicitly before coding. Do not silently create a parallel truth.

## 2. Mandatory continuation/read order

First synchronize repository metadata (`git fetch --all --prune` where a local checkout exists). Do not assume a stale `main` checkout contains the active handoff.

Resolve continuation source:

- if owner names a branch/PR, use that exact head,
- if owner says only **"jatka reposta" / "continue from repository"**, inspect `main`, `STATUS.md` and any single active PR/Issue handoff named there,
- continue one explicit active handoff; never combine unrelated active branches,
- never treat an unmerged branch as accepted `main` truth.

Before implementation read, in order:

1. `/AGENTS.md`
2. `/docs/README.md`
3. `/docs/project/STATUS.md`
4. `/docs/product/MVP.md`
5. current sprint/Issue handoff named in STATUS
6. `/docs/project/ROADMAP.md`
7. `/docs/domain/GLOSSARY.md`
8. task-relevant canonical docs
9. `/docs/architecture/CODEMAP.md`
10. relevant ADRs
11. actual existing implementation

If work touches onboarding, public links, anonymous identity, auth conversion, Friends or Shared creation, also read:

- `/docs/product/LAUNCH_LOOP.md`
- `/docs/architecture/decisions/0007-taste-first-acquisition-identity-social-boundaries.md`

Do not start implementation until current phase, dependencies and acceptance gates are understood.

## 3. Current release march is mandatory

`ROADMAP.md` owns order. The first public Kajo follows this dependency direction:

```text
trustworthy algorithm/evidence/catalog
→ adaptive Taste Test + honest holdout challenge
→ anonymous web/app entry + Google/Apple conversion
→ recommendation preview/funnel
→ Friend invite + Friends safety lifecycle
→ explicit Friends → SharedProfile
→ core UX/telemetry/privacy/operations
→ closed beta of actual link-to-app flow
→ production/store acceptance
→ Share Link Gate
```

Do not jump to distant FUTURE_PLAN ideas while release blockers remain.

Do not claim broad public-link readiness before `MVP-REL-004` / the ROADMAP **Share Link Gate** is explicitly accepted. The phrase **“Nyt on aika jakaa käyttäjille linkki”** is reserved for that accepted state.

## 4. Canonical domain rules

Core abstractions include:

- `User`
- `AuthIdentity`
- `AnonymousIdentity`
- `Profile`
- `PersonalProfile`
- `SharedProfile`
- `FriendInvite`
- `Friendship`
- `TasteSession`
- `Item`
- `Event`
- `Context`
- `HumanState`
- `Memory`
- `Scenario`
- `Prediction`

Rules:

- Prediction targets `Profile`, never User directly.
- Personal and Shared Profiles are distinct learned contexts.
- SharedProfile is not a simple average of members.
- Friendship is not SharedProfile membership and grants no private PersonalProfile access.
- Personal Friend invite does not automatically create SharedProfile.
- Anonymous Taste conversion must preserve the same logical PersonalProfile/taste state rather than duplicating it.
- `Item` is domain-agnostic; do not create BookProfile/MovieProfile/BookPrediction/etc.
- Cross-domain learning is core.
- Meaningful recommendation behavior must be represented through canonical evidence/Event contracts.
- Growth telemetry is not taste evidence by default.
- Demographic data may only be a weak optional prior and is not required for Taste cold start.
- Memory is evidence, not immutable identity.

Use terms exactly as defined in `GLOSSARY.md`.

## 5. Algorithm rules

Algorithm quality is the critical first-release dependency.

- Do not defer known correctness/evidence/cold-start defects with “later” merely because UI works.
- Prefer inspectable baseline + deterministic tests before opaque complexity.
- New learned components must be compared against a fixed baseline/ablation and may be rejected if they do not improve defined outcomes.
- Serving and shadow semantics must remain versioned/comparable.
- Complete Prediction trace/delivery provenance precedes learning from outcomes.
- Taste challenge predictions are frozen before held-out answers enter learning.
- Never fabricate an accuracy/confidence percentage.
- Synthetic/counterfactual SleepLayer outcomes never become historical Events.
- Automatic/global Challenger promotion remains gated by explicit evidence and rollback rules.

## 6. UI/UX rules

- Kajo is a 2D mobile product, not a 3D room/game.
- Room is authenticated home/navigation metaphor.
- Public Taste link is the external front door; do not force registration before value.
- Registration continues a Taste session; it must not reset cold start.
- Navigation remains restrained.
- `DiscoveryMode` and `AmbientPhase` are separate:
  - FOR_YOU → DAWN
  - SURPRISE → EVENING
  - RISK → NIGHT
- Curtain is the signature global DiscoveryMode control.
- Grid is default discovery; swipe is optional.
- Graphics may evolve without changing domain/Event/Prediction semantics.
- Accessibility/reduced motion/error recovery are release requirements.

## 7. Coding rules

- Use English for code, paths, identifiers and canonical technical terminology.
- Prefer feature-oriented organization.
- Keep business/domain logic out of presentation components.
- Mobile/web presentation must use defined service/data boundaries rather than scattered database calls.
- Recommendation logic stays server-owned.
- Database schema changes are migrations.
- Deployed migration history is immutable unless an accepted explicit migration-history procedure says otherwise.
- Keep one Issue/PR narrowly scoped; do not refactor unrelated code.
- Avoid speculative abstractions/services/folders.
- Add deterministic regression tests for behavior changes/bugs where practical.
- User-facing copy is not domain/event/state identity.

Minimum automated gate for code changes:

```bash
npm run check
```

Passing compilation/bundle smoke is not proof of real-device acceptance.

## 8. Runtime/device validation

For user-facing mobile/web changes:

- run the relevant runtime when environment supports it,
- exercise changed flow on real device/emulator/browser where available,
- record exactly what was and was not tested,
- never mark a user-facing requirement complete only because files compile.

Taste/auth/link work additionally requires representative browser/app round-trip testing before release acceptance.

## 9. Repository hygiene

Keep repository minimal and intentional.

- no empty feature folders, `.keep` placeholders or speculative modules,
- prefer extending canonical files over duplicate guides,
- remove obsolete/dead implementation when safely replaced,
- Git history is the archive; do not keep duplicate old/new code “just in case”,
- verify references before deleting,
- do not duplicate documentation truth across files.

Canonical ownership:

- `STATUS.md` — exact current state/next task,
- `ROADMAP.md` — execution order,
- `MVP.md` — first-release requirements,
- `LAUNCH_LOOP.md` — Taste/link/Friend launch semantics,
- `FUTURE_PLAN.md` — later ambitions/research,
- domain/architecture docs — durable technical semantics.

## 10. Git workflow

- Never develop directly on `main`.
- One Issue normally maps to one branch + one PR.
- `main` remains runnable/internally consistent.
- Do not merge code with failing required CI.
- Documentation-only planning changes still use branch/PR when they materially redefine project truth.

## 11. Documentation obligations

Update only documents whose truth changed, but update all canonical owners that did change.

- `GLOSSARY.md` for canonical terminology.
- `DOMAIN_MODEL.md` for relationships/invariants.
- `DATA_EVENTS.md` for event/evidence semantics.
- `PREDICTION_MODEL.md` when prediction inputs/outputs/learning semantics change.
- `UX_PRINCIPLES.md` for product-wide UX rules.
- `ARCHITECTURE.md` / ADR for durable technical boundaries.
- `CODEMAP.md` when important implementation paths are created/moved.
- `MVP.md` when release scope/status changes.
- `ROADMAP.md` when sequence changes.
- `LAUNCH_LOOP.md` when acquisition/Taste/Friend launch semantics change.
- `FUTURE_PLAN.md` when distant vision/order changes.

Do not mark planned documentation as delivered runtime behavior.

## 12. Sprint close protocol

A sprint is not complete until a fresh agent can continue without chat-only context.

At close:

1. accepted changes merged; required CI/checks pass,
2. runtime/device evidence recorded or limitation stated,
3. obsolete artifacts removed,
4. sprint file updated with delivered/deferred/known issues/files,
5. completed MVP IDs updated,
6. `STATUS.md` updated with exact next action,
7. terminology/domain/ADR/CODEMAP updated where truth changed,
8. next phase/action explicit.

Do not rewrite historical completed sprint truth casually.

## 13. Milestone / Share Link close protocol

Before the first-public milestone or Share Link Gate closes:

1. verify every required MVP ID with evidence,
2. validate actual link → Taste → challenge → auth → app → Friend → Shared flow,
3. validate recommendation quality/evidence and delayed outcomes,
4. validate privacy/retention/abuse/restore/rollback/monitoring,
5. validate store/public install/update path,
6. record owner acceptance,
7. update STATUS/ROADMAP/MVP and maintenance/recovery ownership.

Only then may broad acquisition begin.

## 14. Conversation handoff

A chat ending is not a sprint close.

If work moves to a new conversation:

- update `STATUS.md` only as needed so current branch/task/next dependency is explicit,
- keep incomplete requirements incomplete,
- preserve branch/PR/Issue reference,
- do not rely on chat history for a critical decision.

A fresh conversation must be able to start with:

> **“jatketaan reposta”**

and continue the correct next work package from repository truth alone.
