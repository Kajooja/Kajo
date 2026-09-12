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
2. Otherwise read current accepted-main STATUS and its explicitly named primary continuation PR/Issue. Inspect that active branch before selecting work.
3. Follow the one primary packet chosen there. A separately available research packet does not make the default ambiguous; secondary branches remain separate unless the user or current handoff selects them. Bring accepted canonical decisions into the active branch through the normal Git workflow before extending it; do not let older branch-local planning overwrite newer accepted scope.
4. Ask only if refreshed repository evidence leaves genuinely conflicting primary handoffs unresolved. Never combine unrelated code branches merely because both are open.

This makes “jatketaan reposta” sufficient without pretending an unmerged draft is already part of `main`.

## Mid-sprint handoff

A conversation ending does **not** close the sprint.

Before handoff, if meaningful context would otherwise be lost:

1. Update `STATUS.md` with:
   - what is complete,
   - what is currently in progress,
   - one primary next packet and its branch/PR/head,
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
4. For native algorithm changes, read `PREDICTION_MODEL.md` and require the relevant deterministic database evidence alongside `npm run check`. For independent engine/public-data packets, also read PREDICTIVE_MEMORY_ENGINE, DATA_ENRICHMENT and ADR-0008; require contract/data/evaluation verification appropriate to that packet. No hosted database is needed merely to run isolated research. For services/data lifecycle changes, read ARCHITECTURE.
5. Complete the available work autonomously. If a credential, device result, paid account or owner decision is unavailable, record the exact dependency and continue an independent already-authorized task. Never request secrets in chat.
6. Before ending, record branch/PR/head, migration/deploy state, verification, remaining gate and exact next action in STATUS. Do not mark requirements complete merely because the PR exists.

A full-MVP task ends at the explicitly accepted Share Link Gate, including the actual Taste/auth/Friend/Shared flow, installed store build and operational acceptance. A scoped work package ends when its own authorized deliverable and handoff are complete; then pause rather than expanding into the next phase. Graphical changes may proceed through theme/assets without altering Event or algorithm semantics. The goal is verified completeness with maintainable boundaries, not a promise of no future maintenance.
