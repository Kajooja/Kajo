# Sprint 013 — Prediction Nervous System & ScenarioMemory

Status: **ACTIVE — 13A INTEGRATED, 13B HOSTED DB VERIFIED; DEVICE ACCEPTANCE PENDING**
Milestone: **MVP 0.1**
Started: **2026-09-03**
Primary issue: **#156**

## Goal

Define the complete Kajo prediction nervous system and deliver its first truthful MVP slice: versioned PredictionRun/candidate tracing, Working/Short/Long memory Context, same-Profile ScenarioMemory V1 and meaningful dwell evidence. Preserve an explicit extension path for the SleepLayer/EvolutionEngine without allowing uncontrolled production mutation.

Sprint 012 Profile Messaging is merged and automatically verified but its configured-device acceptance remains deferred. The product owner explicitly prioritized the Prediction Core design; Sprint 013 may proceed without misreporting Sprint 012 as device-accepted.

## Durable design outcome

The canonical design in `docs/domain/PREDICTION_MODEL.md` specifies:

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

Hosted database verification is complete. Configured Android acceptance remains open.

Completed:

- base Prediction V1 migration applied to hosted Supabase,
- forward fix applied after hosted smoke exposed a PL/pgSQL `prediction_id` name collision,
- authenticated Personal member execution verified,
- authenticated Shared member execution verified,
- unauthenticated and outsider access denied,
- direct internal trace-table client access denied,
- direct authenticated V0 execution denied while V1 is allowed,
- one request -> one run + exact candidate pool/result counts verified,
- controlled Scenario reward precedence verified,
- undo exclusion verified,
- cross-Profile isolation verified,
- representative `EXPLAIN (ANALYZE, BUFFERS)` checks completed,
- post-DDL security/performance advisors reviewed.

Still required:

- configured Android Personal + Shared discovery/action acceptance,
- inspect real hosted `PredictionRun`/`PredictionCandidate`/Event/session correlation produced by that device flow,
- confirm fallback/mock correlations remain analytically distinguishable from hosted Prediction runs on the real app path.

### 13C — SleepLayer implementation (after device evidence gate)

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

All numeric choices are versioned V1 hypotheses. Future tuning requires a new PredictorGenome/model-policy version; historical traces are not rewritten.

## SleepLayer acceptance principles

- A ShadowPrediction is frozen before its Outcome is known, or rebuilt with a strict historical as-of boundary.
- A shadow-only, unexposed Item is neither a hit nor a miss.
- Every accuracy percentage names metric, denominator, coverage, sample/Profile counts, outcome window and uncertainty.
- Global success may promote a global Champion; repeated Profile-specific success may assign a reversible Profile Champion.
- SharedProfile has its own assignment/evidence.
- Sparse Profile evidence is shrunk toward cohort/global evidence.
- No winner is promoted on engagement alone or without latency/privacy/diversity/Shared guardrails.
- First promotions require product-owner approval; automatic promotion is outside MVP 0.1.

## Hosted verification — 2026-09-04

### Applied migrations

Hosted project `Kajo` now contains:

- `20260904120025 prediction_nervous_system_v1` — repository source `20260902223000_prediction_nervous_system_v1.sql`,
- `20260904120420 fix_prediction_v1_candidate_returning` — repository forward fix `20260904120420_fix_prediction_v1_candidate_returning.sql`.

The first authenticated smoke found:

```text
ERROR 42702: column reference "prediction_id" is ambiguous
```

The conflict was inside the `candidate_write` CTE where `RETURNING prediction_id` collided with the PL/pgSQL table-return OUT parameter. The deployed base migration was not rewritten. The forward migration qualifies the returned column as `private.prediction_candidates.prediction_id`, preserving linear migration history and one canonical V1 implementation.

### Authorization / trace smoke

Rollback-tested results:

- authenticated direct V0 denied: **true**,
- outsider V1 denied: **true**,
- anonymous V1 denied: **true**,
- authenticated/anonymous direct trace-table SELECT/INSERT: **denied**,
- Personal V1: **5 returned / 1 run / 15 candidates / 5 selected**,
- Shared V1: **4 returned / 1 matching Shared run / 12 candidates**.

Synthetic runs were rolled back.

### Scenario correctness

A controlled exact-Item episode received a weaker save and then a later rating `10`.

Next V1 evaluation produced:

```text
scenario raw reward = 1.0000
support = 1
```

This proves the later rating superseded the weaker save. After an `ITEM_INTERACTION_UNDONE` referencing that rating, the following V1 evaluation produced:

```text
scenario raw reward = 0.5000
support = 1
```

This is expected: the rating was excluded and the still-valid weaker save became the strongest remaining Outcome. A second PersonalProfile had maximum Scenario support `0`, proving the controlled evidence did not cross the Profile boundary. All controlled Events/runs/candidates were rolled back.

### Query-plan baseline

Representative hosted checks:

- rebuild one current Profile memory snapshot: approximately **9.9 ms** at current development data volume,
- indexed run/candidate retrieval: approximately **0.24 ms**,
- planner used `prediction_runs_profile_requested_at_idx` and the Prediction candidate `(prediction_id, final_rank)` index.

These values are smoke baselines only; they are not production scale SLOs.

### Advisors

No new exposed-API security blocker was introduced by Prediction V1. Supabase reports private trace tables as “RLS enabled with no policy”; this is intentional because clients have no direct grants and access is through the checked server-owned function boundary. The pre-existing leaked-password protection warning and unrelated index advisories stay in separate security/release scope (#160/Sprint 014).

## Acceptance

- [x] Canonical docs contain no conflicting memory/evolution terminology.
- [x] A fresh agent can explain the full data flow and each memory layer from repository truth.
- [x] Migration passes hosted authorization/integrity smoke tests after the ordered forward fix.
- [x] Scenario evidence changes only its owning Profile's ranking/evidence.
- [x] delayed rating supersedes weaker earlier Outcome; undone evidence is excluded.
- [x] full candidate set and selected delivery set remain distinguishable in trace persistence.
- [x] hosted query-plan baseline and advisor review recorded.
- [ ] configured Android Personal/Shared V1 flow passes and creates inspectable real traces/Events.
- [ ] final device evidence confirms hosted-vs-fallback trace distinction.
- [ ] measured real-device request latency is recorded.

## Non-goals

- automatic production genome promotion,
- population/cross-Profile Scenario retrieval,
- sensitive demographic cohorts,
- live LLM inference in the MVP ranker,
- pgvector before learned embeddings/scale evidence,
- raw touch coordinates, precise location, sensor surveillance or message-text learning,
- final Shared common-fit coefficients without real group Outcome evidence.

## Important files

- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`
- `/supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`
- `/supabase/migrations/20260904120420_fix_prediction_v1_candidate_returning.sql`
- `/apps/mobile/src/features/discovery/predictionOperations.ts`
- `/apps/mobile/src/features/discovery/usePredictionRanking.ts`
- `/apps/mobile/src/features/events/EventTrackingContext.tsx`
- `/apps/mobile/src/features/events/eventTracking.ts`
- `/apps/mobile/src/features/discovery/ItemDetailScreen.tsx`

## Handoff

Continue from `main` with the remaining **Sprint 013B configured-device acceptance** after this hosted-verification PR lands. Do not reapply or duplicate Prediction V1. Once real Android trace/Event evidence passes, proceed directly to **Sprint 013C SleepLayer persistence/worker implementation**, not to an LLM ranker or uncontrolled genetic optimizer.
