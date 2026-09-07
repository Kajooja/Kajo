# Kajo AI / Conversation Handoff Protocol

## Goal

A completely new ChatGPT conversation or coding agent must be able to continue Kajo using only repository state plus the new task.

## Standard new-conversation prompt

The user should be able to say:

> Continue Kajo from the repository.

The agent then follows the mandatory read order in `/AGENTS.md`.

### Resolving active work

`main` is the accepted baseline, but an unfinished sprint may live in an open pull request. Therefore a fresh agent must first fetch remote metadata and resolve the active continuation source:

1. Use an explicitly named PR/branch when the user provides one.
2. Otherwise inspect the current tracking branch and open PR/Issue handoff linked to the current `STATUS.md` work.
3. If exactly one branch contains the newer explicit handoff, check it out and then follow its mandatory read order.
4. If two concurrent branches both appear active, ask which one owns the requested work; never merge their scopes by assumption.

This makes “jatketaan reposta” sufficient without pretending an unmerged draft is already part of `main`.

## Mid-sprint handoff

A conversation ending does **not** close the sprint.

Before handoff, if meaningful context would otherwise be lost:

1. Update `STATUS.md` with:
   - what is complete,
   - what is currently in progress,
   - exact next action,
   - blockers/known issues,
   - important files.
2. Add a short `Mid-sprint handoff` section to the active sprint document when needed.
3. Leave incomplete MVP requirements incomplete.
4. Do not create fake closure summaries.

## Sprint-close handoff

Use the full checklist in `WORKFLOW.md`. The final sprint document plus `STATUS.md` must be sufficient for a fresh agent to continue.

## What must never exist only in chat

- product decisions,
- canonical terminology,
- architecture decisions,
- changed MVP scope,
- current implementation state,
- critical file locations,
- known blockers that affect next work,
- non-obvious migration/setup steps.

Move those into the appropriate repository documents.

## What does not need permanent documentation

- discarded brainstorming that did not become a decision,
- routine debugging dialogue,
- temporary hypotheses,
- low-level implementation narration already obvious from code/commit history.

## Resume with “jatka reposta”

`STATUS.md` is the only current-step authority; do not preserve a dated sprint instruction in this protocol. After resolving the active head:

1. Follow AGENTS read order; read `MVP.md`, the active sprint and remaining sequence in `ROADMAP.md`.
2. Inspect linked Issue/PR state, actual implementation and required hosted configuration. Distinguish planned, implemented, deployed, device-tested and accepted.
3. Select the earliest unmet dependency in the roadmap. Continue an existing scoped task or create one Issue/branch/PR for the next bounded change; do not rebuild delivered features from a stale handoff.
4. For algorithm changes, read `PREDICTION_MODEL.md` completion contract and require deterministic DB evidence alongside `npm run check`. For services/data changes, read `ARCHITECTURE.md` inventory/lifecycle gates.
5. Complete the available work autonomously. If a credential, device result, paid account or owner decision is unavailable, record the exact dependency and continue an independent already-authorized task. Never request secrets in chat.
6. Before ending, record branch/PR/head, migration/deploy state, verification, remaining gate and exact next action in STATUS. Do not mark requirements complete merely because the PR exists.

A full-MVP task ends at the installed store-build and operational acceptance gates, not at the next APK. Graphical changes may proceed through theme/assets without altering Event or algorithm semantics. The goal is verified completeness with maintainable boundaries, not a promise of no future maintenance.
