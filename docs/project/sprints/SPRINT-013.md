# Sprint 013 — Prediction Nervous System & ScenarioMemory

Status: **ACCEPTED — 13A / 13B / 13C COMPLETE; 13D FUTURE**  
Milestone: **MVP 0.1**  
Started: **2026-09-03**  
Accepted: **2026-09-04**  
Primary issue: **#156**

## Goal

Define Kajo's complete prediction nervous-system architecture and deliver the first truthful, runnable MVP slice: traceable Prediction V1, Working/Short/Long memory, same-Profile ScenarioMemory and a controlled SleepLayer that can compare immutable Challengers and perform only evidence-gated, reversible manual Profile canaries.

Sprint 013 deliberately stops before uncontrolled genetic optimization, automatic production promotion, population learning and learned/LLM serving models.

## Durable architecture

Canonical design remains in `docs/domain/PREDICTION_MODEL.md` and ADR-0005:

- `WorkingState`, `ShortTermState`, `LongTermState`, `ScenarioMemory`, future privacy-gated `PopulationMemory`,
- complete PredictionRun/candidate/exposure/action/delayed-Outcome traceability,
- bounded Context and point-in-time `MemoryStateSnapshot`,
- generic Profile/Item/Event/Prediction boundaries across domains,
- same-Profile Scenario retrieval and explicit outcome precedence/reward versions,
- immutable `PredictorGenome`, prospective `ShadowPrediction`, `EvaluationWindow`, `GenomeEvaluation`, `PolicyAssignment` and `PromotionDecision`,
- global/cohort/Profile Champion resolution as a long-term architecture,
- first MVP serving change limited to manual reversible **Profile** canary,
- automatic promotion disabled through MVP 0.1,
- sequence/semantic-ID/LLM Challengers only after evidence maturity.

## 13A — Evidence spine + ScenarioMemory V1 — accepted

Implemented:

- private immutable `PredictionRun` and complete `PredictionCandidate` trace,
- actor/Profile/session Context and state snapshots,
- public `rank_items_v1` as the authorized server-owned mobile boundary,
- V0.3 retained as the proven transparent baseline under V1,
- same-Profile ScenarioMemory with bounded retrieval, recency decay and inspectable score components,
- Personal/Shared memory isolation,
- meaningful Item impression/detail dwell evidence,
- delayed Outcome precedence and undo exclusion.

V1 Scenario contract:

| Component | V1 share |
|---|---:|
| MemoryStateSnapshot overlap | 40% |
| candidate generic tag overlap | 35% |
| DiscoveryMode match | 15% |
| temporal Context | 10% |

Outcome precedence:

```text
rating > consumption reversal > not interested > consumed
  > list addition > endorsement/like > saved/unsaved
```

Baseline Scenario multiplier:

```text
FOR_YOU 2.2
SURPRISE 1.6
RISK 1.0
```

These remain versioned hypotheses rather than permanent constants.

## 13B — Hosted correctness + configured Android acceptance — accepted

Hosted verification proved:

- authorized Personal and Shared V1 execution,
- anonymous/outsider denial,
- direct client denial for private trace tables and V0,
- exact run/candidate/result persistence,
- controlled rating precedence and undo behavior,
- Scenario evidence does not cross Profile boundaries,
- intended indexes/query paths operate at current development scale.

The first hosted V1 smoke exposed a PL/pgSQL `RETURNING prediction_id` name collision. The deployed migration was not rewritten; an ordered forward migration qualified the returned table column.

Configured Android acceptance on 2026-09-04 proved real PersonalProfile and SharedProfile actions reached `predictionSource=hosted`, linked to matching PredictionRun/Candidate/Profile/actor/session data and remained distinguishable from immediate fallback actions.

## 13C — Controlled SleepLayer / EvolutionEngine — accepted

### Persistence and shadow execution

Implemented:

- immutable constrained `PredictorGenome` registry using `scalar-genome-v1`,
- current Prediction V1 baseline recorded as global `Champion`,
- three transparent `SHADOW` Challengers:
  - `short-term-tilt-v1`,
  - `scenario-tilt-v1`,
  - `novelty-tilt-v1`,
- every new production PredictionRun tagged with resolved genome + PolicyAssignment,
- prospective queue/worker that evaluates only the frozen production candidate pool and exact production `requested_at` / Context / state trace,
- immutable complete `ShadowPredictionRun` + `ShadowPredictionCandidate` persistence,
- immutable `EvaluationWindow` + `GenomeEvaluation`,
- comparison only on actually exposed Items with observed mature Outcomes,
- explicit coverage and GLOBAL/PROFILE aggregation,
- Profile advantage shrunk toward broader evidence using the documented reliability pattern,
- append-only immutable PolicyAssignment/PromotionDecision audit,
- service-only bounded worker/evaluator operations.

A shadow-only Item that was never exposed remains unlabelled; it is never invented as a hit or miss.

### One canonical serving path

The serving gate intentionally avoids a duplicate predictor:

```text
private V0.3 baseline candidate generator
  -> genome-aware scalar reranker over that same bounded pool
  -> existing canonical Prediction V1 ScenarioMemory stage
  -> trace + delivery
```

The historical public `rank_items_v0` symbol is now only a non-serving baseline compatibility wrapper. Authenticated mobile clients cannot execute V0 or the private scalar function; they continue through `public.rank_items_v1` only.

The baseline genome special-cases the proven V0.3 score, so the accepted baseline remains exact. Challenger scalar scoring uses the same persisted V0.3 explanation components as the shadow worker; Scenario weight is resolved from the assigned genome inside the existing V1 stage.

### Manual Profile canary + rollback

MVP 0.1 exposes only service-role manual Profile canary/rollback operations.

A canary requires:

- matching immutable mature Profile GenomeEvaluation,
- `MATURE_COMPARABLE_EXPOSED_OUTCOME`,
- at least 30 mature Outcomes,
- coverage >= 0.50,
- shrunk advantage >= 0.05,
- EvaluationWindow duration >= 14 days,
- matured outcome cutoff,
- Challenger state eligible for canary,
- explicit approver identity + reason,
- existing rollback assignment.

The resulting assignment changes only that Profile. Global and unrelated Profile assignments remain unchanged. Rollback appends a `ROLLED_BACK` decision and a new assignment restoring the recorded rollback target.

There is no global Challenger promotion function and no automatic promotion path in MVP 0.1.

## Hosted migrations

Hosted project `Kajo` contains the ordered Prediction/SleepLayer chain:

- `20260904120025 prediction_nervous_system_v1` <- repository `20260902223000_prediction_nervous_system_v1.sql`,
- `20260904120420 fix_prediction_v1_candidate_returning` <- repository `20260904120420_fix_prediction_v1_candidate_returning.sql`,
- `20260904134409 sleep_layer_v1_foundation` <- repository `20260904170000_sleep_layer_v1_foundation.sql`,
- `20260904134901 sleep_layer_v1_fk_indexes` <- repository `20260904172000_sleep_layer_v1_fk_indexes.sql`,
- `20260904140919 sleep_layer_v1_serving_and_profile_canary` <- repository `20260904180000_sleep_layer_v1_serving_and_profile_canary.sql`.

Deployed migrations remain immutable. The FK advisor correction was deliberately a forward migration.

## Acceptance evidence

### Shadow/evaluation smoke

Rollback-controlled tests proved:

```text
baseline genome                 prediction-v1-baseline
policy assignment attached      true
queued challengers               3
worker processed                 3
worker failed                    0
source candidate pool            12
complete frozen shadows          3 / 3
immutable genome guard           true
```

A controlled ShortTerm Challenger moved one negative Item rank `1 -> 2` and one positive Item `2 -> 1`. With two exposed mature synthetic Outcomes, the evaluator produced 100% coverage and the expected arithmetic advantage. This test proves data flow/math only; it is not production-quality evidence that the genome is better.

### Exact baseline equivalence

After the serving migration, the legacy private V0.3 baseline and the public baseline compatibility wrapper were executed in the same transaction across FOR_YOU/SURPRISE/RISK.

```text
rows compared          36
rank mismatches         0
max score delta         0
max confidence delta    0
```

This is the defined baseline equivalence gate.

### Canary / rollback smoke

A rollback-controlled mature synthetic Profile evaluation was inserted solely to exercise the gate.

Results:

- canary assignment resolved to `short-term-tilt-v1`,
- real `rank_items_v1` output/Prediction trace reported that Challenger genome,
- unrelated Profile remained on baseline,
- global assignment remained baseline,
- canary run queued only the other two global SHADOW Challengers,
- manual rollback restored `prediction-v1-baseline`,
- following V1 output/trace reported baseline,
- baseline run again queued all three global SHADOW Challengers,
- authenticated execute on canary/rollback functions: denied,
- service-role execute: allowed.

A deliberately insufficient evaluation with **29** mature Outcomes was rejected with SQLSTATE `55000`, proving the minimum-evidence gate is enforced.

All synthetic windows/evaluations/assignments/decisions/runs used for these acceptance smokes were rolled back.

## Security / advisor outcome

Privileged internal functions remain in `private`, use `SECURITY DEFINER` only where required, pin `search_path=''`, schema-qualify relations and have explicit execution grants. This matches current Supabase guidance for privileged database functions.

The post-DDL security advisor adds no new exposed-API blocker. `private.* RLS enabled/no policy` INFO is intentional because the Data API roles have no direct table grants. The existing leaked-password protection warning remains release/security scope (#160/#127).

The SleepLayer FK warnings found after the first migration were corrected by `20260904172000_sleep_layer_v1_fk_indexes.sql`. New `unused index` INFO is expected before sustained worker traffic; unrelated Shared/List performance advisories remain separate scope.

## Acceptance

- [x] canonical docs contain no conflicting memory/evolution terminology.
- [x] full V1 Prediction run/candidate/exposure/outcome trace is hosted.
- [x] ScenarioMemory is bounded, inspectable and Profile-isolated.
- [x] configured Android Personal/Shared V1 trace acceptance passes.
- [x] immutable PredictorGenome + prospective ShadowPrediction persistence is hosted.
- [x] worker produces complete leakage-safe shadows from frozen production traces.
- [x] mature exposed-outcome evaluation records coverage and GLOBAL/PROFILE evaluation.
- [x] SleepLayer private access boundary and immutability guards pass hosted smoke.
- [x] baseline genome has exact equivalence to accepted V0.3 behavior.
- [x] assigned Challenger can be served through the canonical V1 boundary without a second recommender.
- [x] explicit evidence-gated manual Profile canary and rollback are hosted and rollback-tested.
- [x] Profile canary does not change global/unrelated Profile assignment.
- [x] weak evidence is rejected.
- [x] automatic/global Challenger promotion remains unavailable in MVP 0.1.

## 13D — future learned/evolution work, not Sprint 013 acceptance scope

After sufficient real data and release maturity:

- licensed content/collaborative embeddings,
- pgvector/ANN only when benchmarks justify it,
- sequential SASRec/HSTU-class Challenger,
- semantic-ID/generative Challenger,
- LLM-backed ranker Challenger,
- sustained shadow/canary/A/B infrastructure,
- privacy-safe cohort/population learning,
- eventually controlled automatic promotion only behind explicit new gates.

## Product observations split out from Sprint 013

- #174 — bounded resurfacing of already-reacted Items; saved-only reminders may return under versioned cooldown/frequency rules.
- #175 — bottom Profile control shows up to five recent/used SharedProfiles + `Näytä lisää` to the existing group page.

These are separate product scopes and must not be folded back into SleepLayer architecture.

## Important files

- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`
- `/supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`
- `/supabase/migrations/20260904120420_fix_prediction_v1_candidate_returning.sql`
- `/supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql`
- `/supabase/migrations/20260904172000_sleep_layer_v1_fk_indexes.sql`
- `/supabase/migrations/20260904180000_sleep_layer_v1_serving_and_profile_canary.sql`
- `/apps/mobile/src/features/discovery/predictionOperations.ts`
- `/apps/mobile/src/features/discovery/usePredictionRanking.ts`
- `/apps/mobile/src/features/events/`

## Handoff

Sprint 013 is accepted after this branch lands on `main`. Continue with **#174**, then **#175**, then deferred device-acceptance/release-hardening work. Do not reapply Prediction/SleepLayer migrations, create a second recommender, enable automatic promotion, or mix #160 security work into the product follow-ups.
