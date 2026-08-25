# Kajo AI / Conversation Handoff Protocol

## Goal

A completely new ChatGPT conversation or coding agent must be able to continue Kajo using only repository state plus the new task.

## Standard new-conversation prompt

The user should be able to say:

> Continue Kajo from the repository.

The agent then follows the mandatory read order in `/AGENTS.md`.

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
