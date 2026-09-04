# Prediction Core / SleepLayer design gate

Status: **RESOLVED 2026-09-03 — implementation follows ADR-0005**
Tracking issue: **#156**

This file preserves the historical gate that prevented premature hard-coding during Sprint 011. Issue #156 resolves the gate through:

- `/docs/domain/PREDICTION_MODEL.md`,
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`,
- `/docs/project/sprints/SPRINT-013.md`.

Kajo's current `Prediction V0` remains an inspectable, replaceable baseline inside Prediction V1. `SleepLayer` is the canonical name for the controlled background champion–challenger mechanism; `EvolutionEngine` is the evaluator/promotion subsystem. The former `EvoBot` name is historical shorthand, not a separate domain object.

The gate originally covered:

- `LongTermState` representation and update rules,
- `ShortTermState` / near-memory representation,
- Scenario creation schema and lifecycle,
- Scenario similarity/retrieval,
- population ScenarioMemory,
- PredictorGenome structure,
- mutation/crossover/selection rules,
- champion/challenger lifecycle,
- objective/outcome versioning,
- Personal/Shared/population signal composition.

Sprint 011 may continue with prediction-core-independent collaboration mechanics:

- accepted-member authorization,
- Shared consumed/rated eligibility as a discovery rule,
- actor-specific Endorsement current state,
- Endorsement Events,
- unanimous consensus -> Shared Saved state,
- actor-specific pending collaboration delivery layered outside the core taste model.

The design gate is resolved, but implementation maturity gates remain. In particular, `MVP-PRED-005` common-fit coefficients still require real Shared outcome evidence, and PopulationMemory, automatic promotion and unrestricted cross-Profile retrieval remain outside MVP 0.1.

The permanent architecture requirement is replaceability: candidate generation, state/memory retrieval, core outcome prediction, DiscoveryMode policy and collaboration/eligibility delivery remain separable and versioned so the V0 base scorer can later be replaced without rewriting mobile interaction state or core domain contracts.
