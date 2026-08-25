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

## Definition of Done for an Issue

- Acceptance criteria are met.
- Relevant tests/checks pass.
- No unrelated refactoring is included.
- Documentation whose truth changed is updated.
- PR explains what changed and references MVP IDs when applicable.

## Mandatory sprint close

A sprint is complete only when both product/code work **and project memory** are complete.

At close:

1. Merge accepted sprint PRs and confirm checks.
2. Update the active sprint document:
   - Delivered.
   - Important decisions.
   - Deferred/not done.
   - Known issues.
   - Important files/paths.
   - Final handoff.
3. Update `product/MVP.md` statuses for completed requirements.
4. Update `project/STATUS.md`:
   - current state,
   - current/next sprint,
   - exact next actions,
   - known issues,
   - important files,
   - handoff.
5. Update `domain/GLOSSARY.md` if terminology changed.
6. Update domain/prediction/event docs if semantics changed.
7. Add an ADR for durable architectural decisions made during the sprint.
8. Update `architecture/CODEMAP.md` if important implementation locations changed.
9. Update `ROADMAP.md` only if future sequencing materially changed.
10. Create/open the next sprint file when the next scope is known.

Completed sprint files become historical records. Fix factual errors if needed, but do not rewrite history to match later architecture.

## Mandatory milestone close

At milestone close:

1. Verify all milestone acceptance criteria and MVP IDs in scope.
2. Update milestone document with delivered capabilities and evidence.
3. Record explicitly what is not delivered.
4. Update STATUS and ROADMAP for the next milestone.
5. Confirm PRODUCT/MVP/domain docs describe the actual system.
6. Confirm CODEMAP matches the real repository.
7. Record architecture changes through ADRs.
8. Record known technical debt, migrations and risks.
9. Provide a clean handoff to the next milestone.

## Documentation rule

Documentation is not a diary. Record durable truth, decisions, state and handoff—not every thought or implementation step.
