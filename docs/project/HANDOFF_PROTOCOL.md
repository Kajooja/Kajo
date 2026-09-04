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

## Current handoff

At the 2026-09-04 checkpoint, Sprint 013A Prediction nervous-system evidence and design are integrated into `main`. Continue from `main` with Sprint 013B hosted migration and configured-device trace verification. The current `STATUS.md` and Sprint 013 file are authoritative; no open feature branch is required to discover the next step.
