# Sprint 013 — Prediction Nervous System & ScenarioMemory

Status: **ACTIVE — DESIGN ACCEPTANCE AND HOSTED VERIFICATION REQUIRED**
Milestone: **MVP 0.1**
Started: **2026-09-03**
Primary issue: **#156**

## Goal

Define the complete Kajo prediction nervous system and deliver its first truthful MVP slice: versioned PredictionRun/candidate tracing, Working/Short/Long memory Context, same-Profile ScenarioMemory V1 and meaningful dwell evidence. Preserve an explicit extension path for the SleepLayer/EvolutionEngine without allowing uncontrolled production mutation.

Sprint 012 Profile Messaging is merged and automatically verified but its configured-device acceptance remains deferred. The product owner explicitly prioritized the Prediction Core design; Sprint 013 may proceed without misreporting Sprint 012 as device-accepted.

## Durable design outcome

The canonical design in `docs/domain/PREDICTION_MODEL.md` now specifies:

- WorkingState, ShortTermState, LongTermState, ScenarioMemory and PopulationMemory,
- complete request/candidate/exposure/action/delayed-Outcome traceability,
- bounded Context and privacy/retention rules,
- candidate generation, ranking, DiscoveryMode policy and Shared common-fit boundary,
- cold-start imports and representation roadmap,
- exact V1 Scenario similarity, outcome precedence and reward,
- SleepLayer prospective shadows and strict as-of replay,
- global/cohort/Profile Champion resolution,
- PredictorGenome, EvaluationWindow, PolicyAssignment and promotion state machine,
- offline, shadow, canary/A/B, rollback and multi-objective guardrails,
- sequential Transformer, semantic-ID and LLM challengers only after evidence maturity.

ADR-0005 makes the versioned nervous-system/SleepLayer contract durable.

## Scope

### 13A — Evidence spine + ScenarioMemory V1

- Internal `PredictionRun` stores actor, target Profile, session correlation, bounded Context, MemoryStateSnapshot and immutable model/policy versions.
- Internal `PredictionCandidate` stores the full candidate pool, source/final ranks, base/final scores, confidence, Scenario components and delivery selection.
- Prediction trace tables live in the private schema, have RLS defense in depth and no direct mobile table grants.
- Public `rank_items_v1` remains a security-invoker API wrapper over a private, identity/member-checking implementation.
- Direct mobile execution of `rank_items_v0` is revoked; V0 remains the V1 base scorer.
- V1 retrieves only same-Profile traced episodes and degrades to the base scorer with no evidence.
- V1 considers at most 30 episodes with a 0.25 similarity floor and 180-day recency decay.
- Mobile carries the Event sessionId plus allowlisted time/surface Context.
- Item detail emits meaningful 1-second-minimum, 30-minute-capped dwell evidence.
- Dwell is not V1 reward.

### 13B — Hosted correctness and acceptance

- Apply the migration in a transaction-first smoke or branch environment.
- Verify unauthenticated, outsider, Personal member and Shared member behavior.
- Confirm authenticated clients cannot read/write internal trace tables directly.
- Confirm V0 direct execution is denied and V1 execution is allowed.
- Confirm one V1 request atomically creates one run plus the exact candidate pool.
- Confirm Events correlate to the same prediction/session/Profile and fallback traces stay distinguishable.
- Seed controlled outcomes and verify Scenario score/rank changes, undo exclusion, exact-Item floor and Personal/Shared isolation.
- Run `EXPLAIN (ANALYZE, BUFFERS)` on representative state/retrieval queries before external scale.
- Run configured Android acceptance and inspect persisted traces.

### 13C — SleepLayer implementation (post evidence gate)

- Add immutable PredictorGenome registry and constrained weight schemas.
- Add prospective ShadowPrediction queue/worker using the frozen production run input.
- Add EvaluationWindow outcome maturity and comparable-episode/coverage rules.
- Add global/cohort/Profile GenomeEvaluation with hierarchical shrinkage.
- Add versioned PolicyAssignment and PromotionDecision audit.
- Keep automatic promotion disabled until external-beta data and online experiment gates exist.

### 13D — Later learned models

- Add licensed content and collaborative Item embeddings.
- Move Scenario retrieval to pgvector/ANN only after benchmarks justify it.
- Add sequence baseline (SASRec/HSTU class).
- Add semantic-ID/generative and LLM-backed ranker Challengers.
- Compare every new family through the same frozen evidence and promotion gates.

## V1 Scenario contract

Similarity:

| Component | Share |
|---|---:|
| MemoryStateSnapshot overlap | 40% |
| candidate generic tag overlap | 35% |
| DiscoveryMode match | 15% |
| temporal Context | 10% |

Outcome priority:

```text
rating > consumption reversal > not interested > consumed
  > list addition > endorsement/like > saved/unsaved
```

DiscoveryMode Scenario multiplier:

```text
FOR_YOU 2.2
SURPRISE 1.6
RISK 1.0
```

All numeric choices are versioned V1 hypotheses. Hosted evaluation may tune them only through a new PredictorGenome/model-policy version; historical traces are not rewritten.

## SleepLayer acceptance principles

- A ShadowPrediction is frozen before its Outcome is known, or rebuilt with a strict historical as-of boundary.
- A shadow-only, unexposed Item is neither a hit nor a miss.
- Every accuracy percentage names metric, denominator, coverage, sample/Profile counts, outcome window and uncertainty.
- Global success may promote a global Champion; repeated Profile-specific success may assign a reversible Profile Champion.
- SharedProfile has its own assignment/evidence.
- Sparse Profile evidence is shrunk toward cohort/global evidence.
- No winner is promoted on engagement alone or without latency/privacy/diversity/Shared guardrails.
- First promotions require product-owner approval; automatic promotion is outside MVP 0.1.

## Acceptance

- Canonical docs contain no conflicting memory/evolution terminology.
- A fresh agent can explain the full data flow and each memory layer from repository truth.
- Migration passes hosted transaction/authorization/integrity tests.
- No-evidence V1 behavior matches the base scorer apart from documented deterministic tie behavior.
- Scenario evidence changes only its owning Profile's ranking.
- delayed rating supersedes weaker earlier Outcome; undone evidence is excluded.
- full candidate set, selected delivery set and meaningful impressions remain distinguishable.
- mobile automated gate and configured-device flow pass.
- deployed implementation has a measured latency/storage baseline and explicit rollback to V0.

## Non-goals

- automatic production genome promotion,
- population/cross-Profile Scenario retrieval,
- sensitive demographic cohorts,
- live LLM inference in the MVP ranker,
- pgvector before learned embeddings/scale evidence,
- raw touch coordinates, precise location, sensor surveillance or message-text learning,
- final Shared common-fit coefficients without real group Outcome evidence.

## Current verification

- Documentation and local implementation are complete for review on `feat/156-prediction-core-nervous-system`.
- `npm run check` passes: lint, TypeScript, all 145 tests and both platform export smokes.
- `git diff --check` passes.
- Draft PR #166 is published; implementation commit `755971a` passed GitHub Actions CI #249.
- Supabase/PostgreSQL security and indexing patterns were reviewed against current documentation.
- Hosted migration execution, advisors, database query-plan evidence and configured-device validation remain pending and must not be inferred from `npm run check`.

## Important files

- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`
- `/supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`
- `/apps/mobile/src/features/discovery/predictionOperations.ts`
- `/apps/mobile/src/features/discovery/usePredictionRanking.ts`
- `/apps/mobile/src/features/events/EventTrackingContext.tsx`
- `/apps/mobile/src/features/events/eventTracking.ts`
- `/apps/mobile/src/features/discovery/ItemDetailScreen.tsx`

## Handoff

Continue from draft PR #166 / `feat/156-prediction-core-nervous-system`. Perform the explicitly gated hosted migration and configured-device trace acceptance before marking it ready and merging. The next implementation slice after accepted 13A is SleepLayer persistence/worker design, not an immediate LLM or uncontrolled genetic optimizer.
