# Kajo Development Workflow

This workflow is designed for discontinuous AI-assisted development where one ChatGPT conversation may end and another must continue safely.

## Hierarchy

```text
Product
  -> Milestone
     -> Sprint
        -> GitHub Issue
           -> Branch
              -> Pull Request
```

## Milestones

A milestone represents a coherent product outcome, for example `MVP 0.1`.

Milestones have acceptance criteria and may contain several scope-based sprints.

## Sprints

Kajo uses **scope-based sprints**, not automatically two-week timeboxes. A sprint should produce one coherent technical/product outcome and remain small enough for reliable AI-assisted review.

Every active sprint has one file in `project/sprints/`.

## Issues

Implementation tasks belong in GitHub Issues, not as hundreds of TODO lines in roadmap documents.

A good Issue contains:

- Goal.
- Relevant MVP requirement IDs.
- Scope.
- Non-goals.
- Acceptance criteria.
- Relevant files/docs when known.

## Branches and PRs

After bootstrap, do not work directly on main.

Normal pattern:

```text
Issue #23
  -> feat/23-curtain-control
  -> implementation + tests
  -> PR
  -> CI/review
  -> main
```

Prefer one Issue/concern per PR.

## Canonical validation commands

The repository has one canonical automated completion gate:

```bash
npm run check
```

It currently runs:

1. lint,
2. TypeScript typecheck,
3. automated tests,
4. iOS Expo bundle smoke test,
5. Android Expo bundle smoke test.

Individual commands may be used while iterating:

```bash
npm run lint
npm run typecheck
npm run test
npm run smoke
```

For user-facing mobile work, automated validation is necessary but not sufficient when a runnable environment is available. Use one of the following as appropriate:

```bash
npm start
npm run android
npm run ios
```

Then exercise the changed user flow on a real phone, emulator or simulator when possible. If the environment cannot launch the app, record the missing runtime/device verification explicitly in the PR or handoff instead of treating bundle success as device proof.

The product goal is an end-to-end **phone-runnable MVP**. Tests should increasingly validate complete user flows as the MVP becomes integrated.

## Definition of Done for an Issue

- Acceptance criteria are met.
- Behavior changes have relevant automated tests where deterministic testing is practical.
- Bug fixes include a regression test when practical.
- `npm run check` passes for code changes.
- User-facing mobile behavior has runtime/device smoke verification when the environment supports it; otherwise that limitation is explicitly recorded.
- No unrelated refactoring is included.
- Obsolete placeholders, dead code, stale routes and superseded helpers replaced by this change are removed.
- Documentation whose truth changed is updated.
- PR explains what changed and references MVP IDs when applicable.

## Repository hygiene

Kajo should stay small enough that a new agent can understand the real implementation quickly.

Rules:

- Do not create empty directories, `.keep` files or speculative feature structures for future work.
- Do not create a new guide/document when the rule belongs in an existing canonical document.
- Do not keep duplicate old/new implementations after migration.
- Replace and delete placeholders in the same feature PR once the real implementation exists.
- Remove unused files and dead code only after verifying they are no longer referenced.
- Prefer Git history over retaining obsolete files "just in case".
- Keep mock data and temporary code narrowly scoped and remove it when its replacement lands.
- During review and sprint close, explicitly scan changed areas for stale artifacts.

A file is not removed merely because it looks temporary. Current references and purpose must be checked first.

## Mandatory sprint close

A sprint is complete only when both product/code work **and project memory** are complete.

At close:

1. Merge accepted sprint PRs and confirm `npm run check`/CI passes.
2. For user-facing work, record real runtime/device verification evidence when available, or the explicit reason it was unavailable.
3. Review changed implementation areas for obsolete placeholders, unused files, dead code and superseded routes/helpers; remove proven-unused artifacts.
4. Update the active sprint document:
   - Delivered.
   - Validation evidence.
   - Important decisions.
   - Deferred/not done.
   - Known issues.
   - Important files/paths.
   - Final handoff.
5. Update `product/MVP.md` statuses for completed requirements.
6. Update `project/STATUS.md`:
   - current state,
   - current/next sprint,
   - exact next actions,
   - known issues,
   - important files,
   - handoff.
7. Update `domain/GLOSSARY.md` if terminology changed.
8. Update domain/prediction/event docs if semantics changed.
9. Add an ADR for durable architectural decisions made during the sprint.
10. Update `architecture/CODEMAP.md` if important implementation locations changed.
11. Update `ROADMAP.md` only if future sequencing materially changed.
12. Create/open the next sprint file when the next scope is known.

Completed sprint files become historical records. Fix factual errors if needed, but do not rewrite history to match later architecture.

## Mandatory milestone close

At milestone close:

1. Verify all milestone acceptance criteria and MVP IDs in scope.
2. Run the full automated gate and representative phone/emulator end-to-end flows when possible.
3. Update milestone document with delivered capabilities and evidence.
4. Record explicitly what is not delivered or not device-verified.
5. Update STATUS and ROADMAP for the next milestone.
6. Confirm PRODUCT/MVP/domain docs describe the actual system.
7. Confirm CODEMAP matches the real repository.
8. Record architecture changes through ADRs.
9. Remove superseded implementation artifacts and record only intentional remaining technical debt.
10. Record known technical debt, migrations and risks.
11. Provide a clean handoff to the next milestone.

## Documentation rule

Documentation is not a diary. Record durable truth, decisions, state and handoff—not every thought or implementation step.
