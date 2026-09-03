# ADR-0005: Versioned prediction nervous system

Status: Accepted
Date: 2026-09-03

## Context

Kajo must learn not only that a Profile liked an Item, but whether a particular recommendation worked in a particular situation and against which alternatives. It also needs fast adaptation, stable long-term taste, SharedProfile learning, cross-domain transfer and later population learning.

The MVP already has append-only Events and a `predictionId`, but Prediction V0 does not persist the prediction request, state snapshot, complete candidate slate, model version or policy version. A selected Item therefore cannot always be reconstructed as one action among the alternatives offered by a particular predictor.

Modern recommendation systems increasingly model ordered behavior sequences and multiple time scales. LLM memory systems similarly separate bounded working context from consolidated and retrieved long-term evidence. Directly placing a general-purpose LLM or an uncontrolled self-modifying genetic algorithm in the MVP serving path would add cost, latency and unreviewed behavior without solving the missing evidence contract.

## Decision

Kajo uses a versioned, event-sourced prediction nervous system with five memory layers:

1. `WorkingState` for the active session.
2. `ShortTermState` for recent intent.
3. `LongTermState` for slowly changing Profile tendencies.
4. `ScenarioMemory` for retrieving comparable historical episodes.
5. `PopulationMemory` for privacy-gated collaborative and cross-Profile patterns after sufficient data exists.

Every hosted Prediction must persist one internal `PredictionRun` and its complete `PredictionCandidate` pool before it is treated as learnable evidence. The trace retains actor, Profile, session, bounded Context, state snapshot, model/policy versions, source/final ranks, scores, confidence and the candidates selected for delivery. Meaningful impressions and later Events remain append-only and connect through the same `predictionId`.

The MVP introduces `rank_items_v1` as a stable server-owned boundary. It keeps the inspectable V0 scorer as its base, retrieves only same-Profile historical Scenarios, adds a bounded ScenarioMemory signal and records the full trace. With no historical Scenario evidence, V1 degrades to the V0 order apart from deterministic candidate-pool reranking ties.

Scenario outcomes use explicit preference and consumption evidence. A later higher-priority outcome, especially a rating, supersedes weaker earlier evidence for the same `(predictionId, itemId)` episode. Dwell is useful behavioral evidence but is not direct satisfaction reward.

Evolution is controlled model selection, not unrestricted production self-modification:

```text
candidate genome
  -> time-split offline evaluation
  -> shadow evaluation
  -> guarded canary/A/B test
  -> explicit champion promotion or rollback
```

Model, policy, reward and feature versions are immutable identifiers. Training and experimentation remain separate from online serving. Exploration policies must later record selection probability/propensity before counterfactual bandit evaluation is trusted.

`SleepLayer` is the canonical background evolution mechanism. For each eligible production Prediction, it either freezes prospective ShadowPredictions from multiple PredictorGenomes at the same prediction-time cutoff or performs a strict as-of replay using only evidence that existed at that cutoff. Shadows never affect delivery. After Outcomes mature, evaluations aggregate by global, privacy-safe cohort and exact Profile scope. A winning Profile genome may become that Profile's Champion without changing the global Champion.

Unexposed shadow Items do not have knowable Outcomes and cannot be counted as hits or misses. Early comparison is restricted to comparable exposed evidence and reports coverage. Counterfactual policy comparison requires randomized exploration plus logged selection probability; final promotion requires a reversible canary/A/B gate. Automatic promotion remains disabled during MVP 0.1.

General-purpose LLMs may later enrich licensed Item representations, interpret explicit natural-language intent or serve as an evaluated ranker. They do not become the source of behavioral truth, modify memory directly or replace structured event/outcome evidence.

## Consequences

- Kajo can reconstruct what was known, considered, ordered, shown and later chosen.
- PersonalProfile and SharedProfile ScenarioMemory remain isolated by default; Shared member evidence requires the explicit common-fit boundary.
- The first ScenarioMemory works with transparent sparse features and PostgreSQL. pgvector/learned embeddings can replace retrieval later without changing the mobile request/response contract.
- The internal trace tables are not directly exposed to the mobile role.
- Model changes become measurable and reversible.
- Global, cohort and Profile-specific Champions can coexist through versioned PolicyAssignments and safe fallback.
- Raw engagement cannot silently become the sole fitness target.
- Additional storage is required for prediction runs and candidate pools; retention and compaction must be monitored before scale.

## Alternatives considered

### Only aggregate likes/ratings

Rejected because it loses non-selected alternatives, order, Context, exposure and model-version evidence.

### Put a general-purpose LLM directly in the MVP ranker

Rejected for now because data volume, latency, licensing and evaluation maturity do not justify it. Kajo first needs a trustworthy sequence and feedback dataset.

### Let genomes mutate live production weights

Rejected because reward bugs, feedback loops and regressions would be difficult to contain or explain.

### Score nightly alternatives using today's mutable Profile state

Rejected because future Events would leak into historical predictions and make Challengers appear artificially accurate. Replay must reconstruct prediction-time state or use a prospectively frozen ShadowPrediction.

### Create separate movie, book and Shared recommenders

Rejected by ADR-0002 and ADR-0003. Domain and Profile context are inputs to one generic prediction system.
