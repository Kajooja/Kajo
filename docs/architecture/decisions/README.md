# Architecture Decision Records

ADRs preserve **why** durable decisions were made.

Create an ADR when a decision materially affects architecture, domain boundaries, persistence, integration strategy or long-lived implementation constraints. Do not create ADRs for routine component details.

## Accepted decisions

- `0001-mobile-monorepo-stack.md` — mobile monorepo stack.
- `0002-profile-is-prediction-target.md` — Prediction targets Profile.
- `0003-generic-item-cross-domain-model.md` — one generic Item/cross-domain core.
- `0004-discovery-mode-and-ambient-phase.md` — recommendation policy and visual phase are separate.
- `0005-versioned-prediction-nervous-system.md` — versioned Prediction/memory/evolution spine.
- `0007-taste-first-acquisition-identity-social-boundaries.md` — first-release Taste-first acquisition; Identity/Taste/Social/Acquisition remain separate; Friend invite creates Friendship after consent, not automatic SharedProfile; design contracts for million-user scale without premature infrastructure.

## Proposed / active decision work

- `0006-clean-install-database-baseline.md` — proposed clean-install database baseline/replay strategy; follow `STATUS.md` for current acceptance state before implementation.

## Format

```text
# ADR-NNNN: Title
Status: Accepted | Superseded | Proposed
Date: YYYY-MM-DD

## Context
## Decision
## Consequences
## Alternatives considered
```

If a decision changes, prefer a new ADR that supersedes the old one rather than silently rewriting accepted history.
