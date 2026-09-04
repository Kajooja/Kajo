# Sprint 013 — Prediction Nervous System & ScenarioMemory

Status: **ACTIVE — 13A INTEGRATED, 13B ACCEPTED; 13C SHADOW/EVALUATION FOUNDATION HOSTED, SERVING PROMOTION PENDING**
Milestone: **MVP 0.1**
Started: **2026-09-03**
Primary issue: **#156**

## Goal

Define the complete Kajo prediction nervous system and deliver its first truthful MVP slice: versioned PredictionRun/candidate tracing, Working/Short/Long memory Context, same-Profile ScenarioMemory V1 and meaningful dwell evidence. Preserve an explicit extension path for the SleepLayer/EvolutionEngine without allowing uncontrolled production mutation.

Sprint 012 Profile Messaging is merged and automatically verified but its configured-device acceptance remains deferred. The product owner explicitly prioritized the Prediction Core design; Sprint 013 proceeds without misreporting deferred work as accepted.

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

### 13A — Evidence spine + ScenarioMemory V1 — integrated

- Internal `PredictionRun` stores actor, target Profile, session correlation, bounded Context, MemoryStateSnapshot and immutable model/policy versions.
- Internal `PredictionCandidate` stores the full candidate pool, source/final ranks, base/final scores, confidence, Scenario components and delivery selection.
- Prediction trace tables live in the private schema, have RLS defense in depth and no direct mobile table grants.
- Public `rank_items_v1` remains a security-invoker API wrapper over a private, identity/member-checking implementation.
- Direct mobile execution of `rank_items_v0` is revoked; V0 remains the V1 base scorer.
- V1 retrieves only same-Profile traced episodes and degrades to the base scorer with no evidence.
- V1 considers at most 30 episodes with a 0.25 similarity floor and 180-day recency decay.
- Mobile carries Event `sessionId` plus allowlisted time/surface Context.
- Item detail emits meaningful 1-second-minimum, 30-minute-capped dwell evidence.
- Dwell is evidence, not V1 reward.

### 13B — Hosted correctness + configured Android acceptance — accepted

Hosted database verification and real-device acceptance are complete.

Completed hosted gates:

- base Prediction V1 migration applied to hosted Supabase,
- ordered forward fix applied after hosted smoke exposed the PL/pgSQL `prediction_id` name collision,
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

Configured Android acceptance on **2026-09-04** then proved:

- real PersonalProfile discovery reached `predictionSource=hosted`,
- a PersonalProfile rating was tied to an existing `prediction-v1.0` PredictionRun,
- real SharedProfile discovery reached `predictionSource=hosted`,
- a SharedProfile rating was tied to an existing `prediction-v1.0` PredictionRun,
- both actions matched their PredictionRun on `profile_id`, `actor_user_id` and `session_id`,
- both acted Items had matching PredictionCandidate rows,
- both Candidate rows were `selected_for_delivery=true`,
- earlier immediate actions in the same device test remained explicitly `predictionSource=fallback`, so fallback and hosted traces are distinguishable rather than silently conflated.

The mobile ranking hook intentionally waits **600 ms** before an interaction-triggered hosted refresh. On the accepted follow-up runs, hosted impression persistence was observed roughly **0.56–1.40 s** after the corresponding server run timestamp at the current development scale. This is recorded as a device/development baseline only, not a production latency SLO.

### 13C — SleepLayer implementation — active

The first executable shadow/evaluation foundation is hosted. It deliberately leaves visible serving on the already-accepted Prediction V1 baseline.

Implemented:

- immutable `PredictorGenome` registry with constrained `scalar-genome-v1` configs,
- current Prediction V1 recorded as the global baseline `Champion`,
- three bounded transparent scalar `SHADOW` Challengers: short-term tilt, Scenario tilt and novelty/exploration tilt,
- future PredictionRuns tagged with their resolved genome + `PolicyAssignment`,
- prospective `ShadowPrediction` queue and worker using only the frozen production candidate pool, Context, state snapshot and stored score components,
- immutable `ShadowPredictionRun` and complete `ShadowPredictionCandidate` pools,
- immutable `EvaluationWindow` and `GenomeEvaluation`,
- exposed-outcome-only comparison with explicit coverage; unexposed shadow-only Items remain unlabelled,
- GLOBAL and PROFILE aggregation with Profile advantage shrunk toward broader evidence using the documented `n/(n+k)` pattern,
- append-only `PromotionDecision` and `PolicyAssignment` audit structures,
- automatic promotion still disabled,
- direct mobile access denied; only bounded worker/evaluator execution is available to service role,
- immutable artifact triggers prevent UPDATE/DELETE of genomes, windows, shadows, evaluations, assignments and decisions.

Still required before 13C acceptance:

- serving must resolve and actually use a reviewed assigned genome rather than merely tagging the run,
- the current baseline genome must reproduce the accepted Prediction V1 behavior within a defined equivalence tolerance,
- add an explicit manual promotion operation with evidence/state/guardrail checks,
- add an explicit reversible rollback operation,
- prove Profile assignment overrides only that Profile while SharedProfile remains its own scope,
- verify automatic promotion remains impossible.

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

Hosted project `Kajo` contains the Prediction V1 migrations plus the first SleepLayer slice:

- `20260904120025 prediction_nervous_system_v1` — repository source `20260902223000_prediction_nervous_system_v1.sql`,
- `20260904120420 fix_prediction_v1_candidate_returning` — repository forward fix `20260904120420_fix_prediction_v1_candidate_returning.sql`,
- `20260904134409 sleep_layer_v1_foundation` — repository source `20260904170000_sleep_layer_v1_foundation.sql`,
- `20260904134901 sleep_layer_v1_fk_indexes` — repository forward performance fix `20260904172000_sleep_layer_v1_fk_indexes.sql`.

The first V1 hosted smoke previously found the `RETURNING prediction_id` PL/pgSQL collision; the deployed base migration was not rewritten and the ordered forward fix remains the canonical correction.

### Authorization / trace smoke

Rollback-tested V1 results remain:

- authenticated direct V0 denied: **true**,
- outsider V1 denied: **true**,
- anonymous V1 denied: **true**,
- authenticated/anonymous direct trace-table SELECT/INSERT: **denied**,
- Personal V1: **5 returned / 1 run / 15 candidates / 5 selected**,
- Shared V1: **4 returned / 1 matching Shared run / 12 candidates**.

### Scenario correctness

A controlled exact-Item episode with a weaker save followed by rating `10` produced Scenario raw reward `1.0000`, support `1`. Undoing that rating excluded it and correctly fell back to the still-valid weaker save reward `0.5000`. A second PersonalProfile had maximum Scenario support `0`, proving evidence did not cross the Profile boundary.

### SleepLayer foundation smoke

A rollback-controlled authenticated V1 request after the SleepLayer migration proved:

```text
baseline genome             prediction-v1-baseline
policy assignment attached  true
queued challengers           3
worker processed             3
worker failed                0
source candidate pool        12
source delivered results     5
complete frozen shadows      3 / 3
immutable genome guard       true
```

Every ShadowPrediction used the exact production `requested_at` as `as_of`, retained the complete source candidate count and did not alter delivery.

A second rollback-controlled synthetic episode made the ShortTerm Challenger intentionally reverse the production order:

```text
negative Item: production rank 1 -> shadow rank 2
positive Item: production rank 2 -> shadow rank 1
```

Both Items were then meaningfully exposed and given mature synthetic Outcomes (`NOT_INTERESTED` for the negative Item, rating `10` for the positive Item). `evaluate_shadow_genome_v1` produced:

```text
GLOBAL outcomes              2
GLOBAL exposed               2
coverage                     1.0
production metric           -0.5
challenger metric            0.5
raw advantage                1.0
PROFILE evaluation           inserted
eligibility                  MATURE_COMPARABLE_EXPOSED_OUTCOME
```

This smoke is intentionally tiny and proves arithmetic/data-flow correctness only; it is not evidence that the Challenger is better in production. All synthetic runs, Events, shadows, windows and evaluations were rolled back. A post-smoke check returned zero persisted jobs/shadows/evaluations/windows.

### Query-plan / advisor state

Existing V1 small-data baselines remain approximately 9.9 ms for one Profile memory snapshot and 0.24 ms for indexed run/candidate retrieval; they are development baselines, not production SLOs.

SleepLayer security advisors report `private.* RLS enabled with no policy` INFO. This is intentional defense in depth because direct table grants are absent. The worker/evaluator are `SECURITY DEFINER`, `search_path=''`, denied to anon/authenticated and executable only by service role.

The first SleepLayer performance advisor pass found foreign keys without covering indexes. These were corrected through the ordered `sleep_layer_v1_fk_indexes` forward migration rather than rewriting the hosted base migration. Remaining new `unused index` INFO is expected immediately after creation and must be reviewed only after real worker traffic exists. The pre-existing leaked-password warning and unrelated Shared/List index advisories stay in #160/release scope.

## Product findings from configured-device acceptance

Two observations remain deliberately separate from the 13C branch:

- **#174 — already-reacted Item resurfacing.** Strong/terminal reactions should normally suppress repeated discovery. Saved-only Items may occasionally resurface as reminders after meaningful age when still unconsumed/unrated, but only behind versioned cooldown/frequency rules with inspectable reasons.
- **#175 — bottom Profile control quick SharedProfile switcher.** Tapping the bottom Profile name/control should show up to five recent/used SharedProfiles plus `Näytä lisää`, routing to the existing canonical group page.

#174 may be integrated through the versioned Prediction policy path. #175 is navigation scope and must remain separate from the SleepLayer implementation.

## Acceptance

- [x] Canonical docs contain no conflicting memory/evolution terminology.
- [x] A fresh agent can explain the full data flow and each memory layer from repository truth.
- [x] Prediction V1 migration passes hosted authorization/integrity smoke tests after the ordered forward fix.
- [x] Scenario evidence changes only its owning Profile's ranking/evidence.
- [x] delayed rating supersedes weaker earlier Outcome; undone evidence is excluded.
- [x] full candidate set and selected delivery set remain distinguishable in trace persistence.
- [x] hosted query-plan baseline and advisor review recorded.
- [x] configured Android Personal/Shared V1 flow passes and creates inspectable real traces/Events.
- [x] final device evidence confirms hosted-vs-fallback trace distinction.
- [x] real-device/development hosted timing baseline is recorded.
- [x] immutable PredictorGenome + prospective ShadowPrediction persistence is hosted.
- [x] bounded worker produces complete leakage-safe shadows from frozen source traces.
- [x] mature exposed-outcome evaluation records coverage and GLOBAL/PROFILE evaluation.
- [x] SleepLayer private access boundary and immutability guards pass hosted smoke.
- [ ] assigned Challenger genome can be served through the canonical V1 boundary without creating a second recommender.
- [ ] explicit product-owner/manual promotion and rollback path is hosted and rollback-tested.
- [ ] final 13C acceptance proves Profile/global assignment resolution and baseline equivalence.

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
- `/supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql`
- `/supabase/migrations/20260904172000_sleep_layer_v1_fk_indexes.sql`
- `/apps/mobile/src/features/discovery/predictionOperations.ts`
- `/apps/mobile/src/features/discovery/usePredictionRanking.ts`
- `/apps/mobile/src/features/events/EventTrackingContext.tsx`
- `/apps/mobile/src/features/events/eventTracking.ts`
- `/apps/mobile/src/features/discovery/ItemDetailScreen.tsx`

## Handoff

Continue from `main` after this 13C foundation PR lands. Do **not** reapply the hosted SleepLayer migrations. The next action is the serving-aware manual promotion/rollback slice: make a reviewed assigned genome actually drive the existing canonical V1 scorer, prove baseline equivalence, and keep automatic promotion impossible. Do not create a second recommender, rewrite deployed migrations, merge #160 security work into this branch, or mix #175 navigation work into SleepLayer.
