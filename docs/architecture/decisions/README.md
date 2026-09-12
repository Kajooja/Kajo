# Architecture Decision Records

ADRs preserve **why** durable decisions were made. Create one for material architecture, domain, persistence, integration or long-lived implementation decisions, not routine component details.

## Established decisions

- [0001](0001-mobile-monorepo-stack.md) — mobile monorepo stack.
- [0002](0002-profile-is-prediction-target.md) — Prediction targets Profile, not acting User.
- [0003](0003-generic-item-cross-domain-model.md) — one generic Item/cross-domain model.
- [0004](0004-discovery-mode-and-ambient-phase.md) — policy and visual phase are separate.
- [0005](0005-versioned-prediction-nervous-system.md) — versioned Prediction/memory/evolution spine.
- [0006](0006-clean-install-database-baseline.md) — clean-install/replay strategy with detailed implementation and acceptance history; consult [STATUS](../../project/STATUS.md) for current accepted and remaining gates rather than treating an old proposal checkpoint as current.
- [0007](0007-taste-first-acquisition-identity-social-boundaries.md) — first-release Taste-first acquisition; distinct Identity/Taste/Social/Acquisition; explicit Friendship and Shared consent; million-user contracts without speculative infrastructure.

## Current design refinement

- [0008](0008-portable-predictive-memory-engine-and-external-priors.md) — owner-approved independent Predictive Memory Engine, Kajo adapter, isolated public taste-data research and artifact admission, published through #233 / PR #234. Design acceptance is separate from implementation, training or serving admission. Advances early research, not private Kajo-wide PopulationMemory or automatic evolution.

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

Prefer a new superseding/refining ADR to silently rewriting accepted history. Keep exact implementation/CI/deployment/device evidence in STATUS and the relevant sprint/PR.
