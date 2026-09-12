# Kajo Predictive Memory Engine

Status: **canonical target design; not a claim of implemented runtime**. Decision: [ADR-0008](decisions/0008-portable-predictive-memory-engine-and-external-priors.md). Delivery state and execution order belong to [STATUS](../project/STATUS.md) and [ROADMAP](../project/ROADMAP.md).

This is the English technical adaptation of the owner's supplied **Kajo Predictive Memory Engine — arkkitehtuuri.md**, reviewed on 2026-09-12 in Issue #233. Its 51-section organization and complete Observe → Represent → Recall → Imagine → Predict → Act → Compare → Learn → Consolidate → Evolve concept are retained. Source SHA-256: `ecc6112a7023baf8b5e8ff1d2acc04326ba6c5b8a0890765e323525d9da66f3c`.

The engine is its own reusable system. Kajo is its first domain adapter, not the definition of the engine. [PREDICTION_MODEL](../domain/PREDICTION_MODEL.md) owns Kajo-specific serving/evidence behavior; [DATA_ENRICHMENT](DATA_ENRICHMENT.md) owns external research data and artifact admission. Existing SQL serving is not replaced merely by accepting this design.

## Review amendments to the supplied proposal

These are explicit review additions, not claims that the supplied proposal or existing implementation already contains them:

| Amendment | Reason and affected sections |
|---|---|
| Separate prediction subject from acting identity | In Kajo the subject is a Profile, including a SharedProfile; the acting User is a different role. Sections 3, 8, 41–42. |
| Define time horizons, observability and branch event sets | Saving and later watching can both happen. Multi-head probabilities are not a categorical distribution. Sections 11–15, 30. |
| Enforce point-in-time information and prefix-only retrieval | A query cannot use its own future Outcome/After/Error, later-trained artifacts or private neighbors. Sections 17, 21, 23–25, 40. |
| Separate predictive association from causal effects | Observational ratings do not identify the effect of showing an alternative. Sections 26–27, 36. |
| Preserve frozen predictions as historical evidence | Rebuildable model output does not mean a historical prediction may be overwritten. Sections 13, 30, 40. |
| Add ExternalTastePrior rather than fabricate complete scenarios | Public rating data supplies limited preference evidence, not Kajo exposures, context, joint history or counterfactual outcomes. Sections 16, 19, 44–45. |
| Gate artifacts, uncertainty and synthetic influence explicitly | Confidence must be supported; license restrictions and deletion dependencies follow derived artifacts; dreams cannot validate themselves. Sections 7, 28–29, 34–39. |
| Extract by tested contracts, not a big-bang rewrite | Preserve accepted SQL, identity, privacy, slate and migration behavior while proving portability. Sections 41–44. |

## 1. Goal

The Predictive Memory Engine forms an updating model of a subject and its environment, recalls analogous experiences, estimates possible futures and lets a policy select an action against an explicit objective.

Its general predictive question is:

`P(S_next, O_within_horizon | S_now, A, available_history, model_version)`

The supplied `P(S_{t+1}, O_t | S_t, A_t)` is retained conceptually. `S_now` is a useful representation of information available now, not a claim that all relevant hidden state is observed or that a strict Markov property has been established.

Kajo actions may recommend an experience; another adapter may propose a task, configuration or maintenance action. The core must not require movies, books, human accounts or any specific provider schema.

## 2. General cycle

```text
OBSERVE → REPRESENT STATE → RECALL SIMILAR EXPERIENCE
        → IMAGINE POSSIBLE FUTURES → PREDICT OUTCOMES
        → CHOOSE ACTION → ACT / RECOMMEND
        → OBSERVE REAL OUTCOME → COMPARE WITH FROZEN PREDICTION
        → LEARN → CONSOLIDATE MEMORY → EVOLVE MODEL → repeat
```

Observation and policy delivery are real-world boundaries. Representation, recall and prediction are derived computation. Imagination and evolution are bounded offline work until separately admitted. A transparent scorer implements a useful first generation without pretending to be a learned transition simulator.

## 3. State — current system state

`CurrentState` composes, rather than numerically adds:

```text
subject identity/scope
ActorState / HumanState
WorkingState + ShortTermState + LongTermState
BeliefState
GroupState when relevant
WorldState
Context
asOf + evidence watermark + representation versions
```

The source uses ActorState for the entity being predicted. To avoid collision with Kajo's acting User, the engine contract calls that entity a **Subject**. In the Kajo adapter, `subjectId` maps to `profileId`; `actingIdentityRef` maps separately to the authorized actor. No database identity migration is implied.

### 3.1 ActorState / HumanState

This is the relatively durable subject representation assembled from supported memory: novelty appetite, familiarity, complexity, pace, emotional intensity and later learned dimensions. It is not an independently updated second copy of LongTermState. HumanState is Kajo's human-facing interpretation; other adapters need not infer human traits.

State fields record support, missingness, source and version. A missing component is explicit, not a zero that silently means dislike. Sensitive traits and unsupported psychological labels are not inferred by default.

## 4. WorkingState — working memory

WorkingState describes the ordered active session: recent observations, explicit actions, requested task, current policy mode, query constraints and session depth. It is fast-changing and expires at explicit session/scope boundaries.

It can alter immediate intent without converting one unusual session into permanent taste. Actor/Profile switches cannot reuse another scope's working state. Replay uses the captured sequence prefix, not the current session cache.

## 5. ShortTermState — recent memory

ShortTermState represents temporary interests over days or weeks and can reverse faster than durable memory. A transparent starting family is `weight(age) = exp(-lambda * age)`; time scale and event strength are versioned hypotheses.

Explicit evidence dominates passive attention. Unknown, unavailable and unexposed are not negative preference. Session/week/month summaries may coexist, but multiple projections of the same observation are not independent support.

## 6. LongTermState — durable memory

LongTermState changes slowly through repeated independent evidence. Each feature retains `value`, `support`, `uncertainty`, `lastUpdated`, `sourceWeights` and provenance references.

One atypical session must not erase durable taste. Conversely, old imports cannot keep an unjustified permanent influence floor when native evidence repeatedly contradicts them. Correction/removal must invalidate the affected derivative and support count. Reliability is not established by assigning a plausible-looking confidence number.

## 7. BeliefState — uncertainty about the model

BeliefState distinguishes **estimated poor fit** from **insufficient knowledge**. It records the estimate's target, horizon, uncertainty method, evidence support and calibration status.

```text
estimate: value or unavailable
support: effective independent observations
uncertainty: method + parameters/interval, or unavailable
calibration: version + eligible evaluation scope, or uncalibrated
```

Epistemic uncertainty concerns limited model knowledge; aleatoric uncertainty concerns variability remaining under the model. They are separate conceptual outputs, not necessarily separately identifiable in generation 1. An uncalibrated rank score is not a probability and deterministic jitter is not uncertainty.

BeliefState informs bounded exploration, Taste question selection, RISK policy and dream prioritization. Out-of-distribution or sparse states may trigger a safer baseline or abstention, not fabricated certainty.

## 8. GroupState

A group is a first-class Subject with its own observations and learned state. In Kajo it is a SharedProfile, not an average of PersonalProfiles.

Authorized member fit, disagreement and minimum-fit summaries can be bounded inputs. Raw Personal history stays private. Membership/consent changes invalidate dependent aggregates and caches; they do not rewrite reached historical consensus.

The source's longer-term group-interaction ideas, including decision dominance, remain research possibilities rather than permission to infer or display interpersonal traits. They require a product need, consent/privacy review and evidence. Friendship alone grants no such access.

## 9. WorldState — environment state

WorldState contains external conditions: object lifecycle/availability, new objects, trends, seasons and other explicitly admitted signals. Environment change is not automatically a change in a person's LongTermState.

Every signal has a source, validity interval, availability timestamp, version and staleness behavior. A new popularity snapshot cannot be substituted into a historical prediction. Expired or missing availability is handled by the adapter's documented constraints, not silently treated as observed dislike.

## 10. Context

Context is the local prediction situation: time, task/surface, session, requested domain, explicit intent, available time and group/alone context where actually supplied and permitted.

The adapter owns an allowlist, semantics and retention. Collect only justified information. The generic core does not collect sensors, contacts, message text or precise location. Absence of context stays missing; a rating timestamp does not reveal viewing circumstances.

## 11. Scenario — the main episodic memory unit

A Scenario describes a decision and a partially observed transition:

```text
BEFORE: frozen state available at decision time
CONTEXT: frozen environment and local situation
OPTIONS: available/considered actions, retrieval scope and eligibility
ACTION: selected action/slate and policy
PREDICTION: frozen estimates/branches and their horizons
OBSERVATION: what was actually observed after delivery
OUTCOME: horizon-specific results and maturity/observability
AFTER: observed state components and separately derived state estimate
ERROR: evaluation against the original prediction
METADATA: versions, timestamps, support, provenance, corrections
```

`(S_t, A_t) → (O, S_next)` does not imply complete observation of every variable. Label availability and maturity explicitly. A saved item may later be consumed, rated or removed; do not flatten these into mutually exclusive raw facts.

Scenario records reference immutable evidence. Outcome reconciliation may create a new derivative version as delayed evidence arrives, without changing what the engine knew or predicted at the original decision.

## 12. Trajectory — a path through scenarios

A Trajectory is an ordered series of decisions, observations and states. Two subjects can reach similar current representations through different histories; prefix-sensitive retrieval can distinguish those paths.

Order uses documented event/availability semantics and deterministic tie handling. Unknown time gaps remain unknown. A batch of retrospectively entered ratings is not automatically a watched-in-order trajectory. Trajectory encoders may only consume the prefix available at the evaluated decision.

## 13. Reality Path

A Reality Path contains observed events and observed portions of transitions. Its observations have `source = OBSERVED`, with source-system provenance and corrections.

Observed is not synonymous with infallible: duplicates, delayed ingestion and erroneous input still require validation. Real observation never becomes a model-authored fact. External observed ratings are distinct from native Kajo observations; synthetic paths stay synthetic even if later observations resemble them.

## 14. Branch — a possible future

A Branch is a predicted path or a clearly defined future event. It declares the action, target, horizon, condition set, probability method and observability assumptions.

The supplied save/watch/ignore/dislike example needs disambiguation because saving and later watching can co-occur. Two valid contracts are:

1. **Mutually exclusive, exhaustive path categories** for one declared horizon, with probabilities summing to one. Include a residual/other category where needed.
2. **Non-exclusive outcome heads**, such as saving within one day and consuming within fourteen days. These probabilities do not sum to one; a user can realize several heads.

A missing observation is not a predicted category called dislike. The system can report no observed action within an observable window, but must distinguish that from an unknown or censored outcome.

## 15. Outcome Model

OutcomeModel estimates target-specific quantities: action/consumption probability, rating distribution conditional on an appropriate outcome, delayed satisfaction and possibly next-state components.

Each output carries `targetDefinition`, `horizon`, `conditioning`, `estimateKind`, `support`, `calibrationVersion` and `observability`. Joint or multi-stage predictions must be coherent; conditional and marginal probabilities are not interchangeable.

Generation 1 may return a scalar ranking score with probabilities unavailable. It must not relabel that score as a distribution. Additional heads enter only with real labels and evaluation. Satisfaction, intention, exposure and retention remain different targets; the adapter supplies their meaning.

## 16. ScenarioMemory

The source's three memory classes are retained:

- **LocalScenarioMemory:** the subject's authorized historical episodes.
- **GlobalScenarioMemory:** privacy-gated cross-subject experience or sufficiently protected prototypes.
- **SyntheticScenarioMemory:** explicitly simulated episodes with generator and parent lineage.

A fourth, related but distinct input is **ExternalTastePrior**: licensed research-derived preference parameters or object representations. A rating-only dataset cannot populate complete GlobalScenarioMemory because the missing decision context, alternatives and exposure are not known.

Kajo's native PopulationMemory remains gated by consent, minimum cohort, deletion lineage and evidence. Public dataset identities must not become Kajo Users/Profiles. Synthetic memory is excluded from the default observed-evidence retriever; any later synthetic channel is independently typed, capped, ablated and disabled by default.

## 17. Associative Memory / Scenario Search Engine

Canonical storage owns evidence; the search layer owns replaceable retrieval acceleration:

```text
authorized, time-eligible canonical episodes
→ versioned decision-prefix encoder
→ exact or approximate index
→ bounded candidate memories
→ structured eligibility recheck
→ reranking
→ supported analogies with provenance
```

Authorization, tenant/Profile/cohort scope, source class and as-of eligibility are search constraints, not merely a filter after unrestricted nearest-neighbor retrieval. Recheck them at materialization/delivery. Avoid private-neighbor side channels and top-K starvation from post-filtering.

Start with bounded exact/SQL retrieval and measure quality and cost. pgvector/HNSW is an optional measured implementation, not an architecture prerequisite. Indexes are rebuildable and separately versioned; canonical identifiers do not change with index technology.

## 18. Latent Geometry

The design supports multiple spaces: subject, current state, scenario, context, world, outcome and trajectory. They need not share coordinates or dimension count.

Each artifact records encoder family, feature schema, dimension, normalization and training lineage. Distances across incompatible versions/spaces are undefined and must be rejected, not silently averaged. Index/model rollout uses compatible bundles with a rollback target.

## 19. Human Space

Human Space aims to represent durable patterns across experiences rather than only product-category affinity. Kajo may eventually connect book, movie, music, event and group signals through licensed shared features and observed transfer benefit.

Movie-only public data teaches movie-related structure. It does not establish universal human traits, book preference transfer or group compatibility. The no-transfer baseline remains mandatory. ExternalTastePrior strength is support- and domain-dependent; unrelated domains fall back neutrally.

## 20. State Space

State Space represents present circumstances. Similar durable subjects can occupy different states on different days, and the same subject may change state without changing enduring taste.

State assembly must not count the same evidence repeatedly through HumanState and LongTermState. Missing current intent cannot be filled with invented mood. Versioned feature provenance makes those distinctions inspectable.

## 21. Outcome Space

Outcome Space groups experiences by consequences and may reveal useful analogies beyond superficial similarity.

Mature historical outcomes may supervise an encoder inside the training split. The query representation must not contain its unknown future rating, resulting state or prediction error. Exclude held-out subject/item answers from prototype construction and fitting. Outcome-space training is not permission for future-label leakage at retrieval time.

## 22. Context-dependent geometry

The similarity relation may be `d(A, B | Context, Task)` rather than a universal fixed distance. Two subjects can be close for one task and distant for another.

Initially use inspectable, bounded context-dependent weighting over compatible component distances. Learned metrics are challengers. Feature coverage, missingness and cross-domain transfer reliability affect similarity; unsupported components cannot dominate because they happen to have a larger numeric scale.

## 23. Scenario Encoder

ScenarioEncoder first maps a **decision-time prefix** into deterministic features:

`[subject/state summaries, recent ordered evidence, permitted context, action/object features, world features, missingness/support]`

A later learned `E_theta(prefix)` replaces this without changing evidence semantics. Separate query/prefix and retrospective training-label views. The latter may include mature outcomes for training, but never feeds the live query directly.

Training cutoff, preprocessing fit, feature version and model lineage are part of encoder identity. Frozen-source replay uses the actual deployed compatible artifact; historical simulation of a newer challenger must be labeled separately and obey its training/evaluation split.

## 24. Similarity / Metric Engine

A transparent first metric combines normalized subject, state, context, environment and action distances with declared non-negative weights and missing-component handling.

MetricEngine returns similarity plus support/coverage, not a claim of causal similarity. Repeated events, multiple tags from one event and many near-duplicate episodes do not independently multiply evidence. Evolution may change weights, K and later the metric family, subject to fixed evaluation controls.

## 25. Retrieval Engine — associative recall

Retrieval returns typed local, permitted global and separately controlled synthetic analogies. Candidate retrieval, authorization and reranking are independently inspectable.

The source's illustrative 1,000 → 100 → 10–30 funnel is a sizing example, not a required full-table scan or latency guarantee. Configure maximum retrieval count, memory, query time and per-source contribution. Preserve a deterministic fallback when no compatible memories exist.

Record retrieved IDs/prototypes, similarity components, source/encoder/index versions, time scope, support and exclusion reasons. Prototype support is not an individual identity and cannot leak private member history through an explanation.

## 26. Scenario Graph

Optional relations include `SIMILAR_TO`, `FOLLOWED_BY`, `CORRELATES_WITH`, `CONTRADICTS`, `GENERALIZES`, `SPECIALIZES`, `DERIVED_FROM`, `DREAMED_FROM` and `VALIDATED_BY`.

The source also proposes `CAUSES`. Reserve that relation for an explicitly reviewed causal identification/intervention claim with evidence and scope. Observational association, temporal order or a simulated rollout alone cannot create it. Prefer association labels when causality is unknown.

A relational edge table is sufficient initially. A graph database requires a measured query/operational benefit. Edges inherit source access, time validity and deletion dependencies.

## 27. World Model

WorldModel estimates consequences and, in later generations, next-state distributions conditional on the represented state and action.

A first implementation can combine the existing transparent scorer, retrieved real outcomes, state features and admitted priors. That is not yet a learned multistep environment simulator. Predictive `P(O | S, A)` from observed actions is not automatically interventional `P(O | S, do(A))`.

Off-policy behavior under a changed slate requires explicit assumptions and appropriate evidence. Report unsupported actions and out-of-distribution states. Do not infer reward for unseen alternatives merely because a model can generate it.

## 28. Dream Engine

DreamEngine generates alternative branches/trajectories using a WorldModel without executing them in reality.

Every SyntheticScenario has `source = SYNTHETIC`, generator/world-model versions, parent scenario/artifact references, seed, generation budget, uncertainty and creation time. Keep it in a separately governed store/channel, never in native Events or observed-outcome denominators.

Synthetic examples may support debugging, robustness experiments and later model-based training under an explicit experiment. They cannot certify the generator's quality. A matching later observation creates a separate observed record linked to the hypothesis; it does not convert the dream into historical fact.

## 29. Error-driven dreaming

Large actual prediction errors can prioritize bounded replay and alternative hypotheses. Where a calibrated probability model exists, surprise may be `-log P(observed)` with a documented numerical floor; scalar models instead use their declared residual/loss.

First check data quality, attribution, maturity and calibration. High error can be noise or a logging defect rather than an important new human pattern. Keep a representative/uniform sampling share alongside surprising cases so the engine does not overfit only outliers. Record sampling weights and compare on untouched real evaluation data.

## 30. Prediction Error

Compare an observed eligible outcome with the prediction frozen **before** it became available. Regression may use `y - y_hat`; probabilities require appropriate proper losses and calibration analysis. Rating, choice and long-term satisfaction use different labels/denominators.

Outcome corrections append new evidence/reconciliation versions; they do not improve the original prediction retrospectively. Unknown, unexposed, unobservable or immature outcomes are not automatic errors. Report excluded/censored coverage and horizon-specific sample counts.

## 31. Error attribution

ErrorAnalyzer considers incorrect state representation, stale memory, retrieval mismatch, missing world change, candidate representation, poor calibration and irreducible variability.

Initially these are **diagnostic hypotheses** supported by traces and controlled ablations, not proven explanations. Record diagnostic method, evidence and uncertainty. An error-driven challenger must beat controls on independent data rather than merely explaining the example that generated it.

## 32. Policy Engine

WorldModel predicts; PolicyEngine chooses. The domain adapter defines reward meaning and hard constraints; the policy combines supported estimates, utility, novelty and information gain within those constraints.

Kajo policies remain:

- `FOR_YOU`: supported expected fit with low bounded exploration.
- `SURPRISE`: useful expected fit plus relevant novelty/diversity.
- `RISK`: bolder but bounded relevant uncertainty/information-seeking, not unsafe or arbitrary actions.

Unknown information gain is not replaced by random noise and reported as a measurement. Authorization, terminal suppression, availability and consent are never genome-mutable. A slate action records the considered pool, final order and selection policy; it is not equivalent to independently choosing every item.

## 33. Active Learning

An action can trade a bounded amount of immediate expected utility for learning. The source's lower-reward/higher-information example is an architectural objective, not proof that a particular choice helps.

Distinguish asking about a recognized past experience from recommending a new experience. Taste question selection must account for recognition, response cost and uncertainty reduction. Unknown answers are valid skips. Holdout challenge answers remain excluded until the frozen prediction has been scored.

Measure learning efficiency and downstream useful recommendations, not just question completion. Real recommendation exploration requires explicit policy limits and, when stochastic, truthful propensities appropriate to the actual action/slate design.

## 34. Memory Consolidation

MemoryConsolidator compresses repeated real episodes into supported patterns or ScenarioPrototypes. It retains source references, effective support, temporal range, encoder version and contradiction information.

Prototype construction uses only eligible training/retained data. A hundred derivatives from one event are not a hundred observations. Deletion/correction invalidates affected prototypes, embeddings and indexes. Consolidation may update a derived memory model but never rewrite raw events or frozen predictions.

## 35. Forgetting / decay

Forgetting reduces evidential influence; retention/deletion governs whether data may remain stored. They are separate mechanisms.

Working, recent, durable, episodic and environment memories use versioned time scales appropriate to their evidence. Inactivity reduces support/confidence; contradictory evidence can reverse stale influence. Evolution may tune these parameters on held-out outcomes, but cannot bypass retention or deletion policies.

Incremental projection updates must match full recomputation on deterministic fixtures, including late arrivals, undo and source removal. Tombstones/deletion lineage prevent replay or backup restoration from resurrecting removed evidence.

## 36. EvolutionEngine

EvolutionEngine proposes and evaluates immutable challengers:

```text
Champion → bounded challenger generation → offline validation
         → prospective shadow / eligible replay → explicit canary / A-B
         → compare mature observed outcomes → promote, reject or roll back
```

Training, validation and final test windows are distinct. Repeated selection against the same holdout is overfitting; lock the final test and record experiment/search budget. User/subject dependence and multiple comparisons matter to uncertainty reporting.

Offline ratings validate specified prediction tasks, not causal policy uplift. Unexposed alternatives cannot be credited with imagined success. Propensity-based estimators require known logging probabilities and support/overlap; deterministic historical ranking does not provide that automatically. Automatic/global promotion remains disabled in Kajo MVP.

## 37. PredictorGenome

A genome is immutable configuration plus immutable artifact references, not random source-code mutation:

```text
encoder + feature + evidence + memory versions
metric + retrieval strategy + index compatibility
memory weights, horizons and support rules
world/outcome/uncertainty model versions
policy and exploration configuration
reward/target definitions
reranker and dream strategy
training/split manifests + code commit + seed
constraints, license eligibility and rollback bundle
```

The same artifact cannot silently change meaning under an unchanged ID. License and data lineage follow encoders, distilled models, prototypes and derived indexes as well as raw files.

## 38. Evolution targets

First evolve transparent weights, decay parameters, thresholds, retrieval K and feature subsets. Add complexity only after comparison with fixed baselines and ablations.

Later eligible targets include encoders, latent dimensions, metric learning, rerankers, retrieval architecture, world/outcome/uncertainty/policy models and dream generation. Architecture search is bounded by reproducibility, latency/cost, privacy and rollback constraints. No generation is accepted merely because its name appears in this document.

## 39. Champion and Challenger

Champion is the admitted serving model for an explicit scope; Challengers do not serve ordinary traffic. Kajo keeps deterministic resolution from supported Profile assignment to eligible cohort assignment to global fallback.

A group is already a SharedProfile subject, not a second conflicting assignment scope. The source's domain-specific champion possibility is retained as later task-scoped configuration under the same generic contract, never a separate MoviePrediction/BookPrediction system. Any expanded precedence order requires a versioned decision and tests.

Sparse, stale or invalid assignments fall back safely. Promotion requires actual eligible evidence, guardrail checks, scope, approver, artifact bundle and rollback reference. A dataset-size threshold alone is not a quality guarantee.

## 40. Data truth and derived intelligence

Canonical records include source observations, committed actions, verified exposures, observed outcomes/corrections, **frozen PredictionRuns and their original estimates**, and versioned assignments/decisions.

Derived intelligence includes memory projections, current state estimates, embeddings, indexes, prototypes, dream artifacts and newly computed predictions. Rebuilding those derivatives does not overwrite what was predicted earlier.

Use two distinct times where supported: `occurredAt` for the event and `recordedAt/availableAt` for when it could enter the system. Production replay requires availability at or before the decision plus compatible artifact lineage. External offline simulation must declare its timestamp assumptions rather than claiming historical production availability.

Every learned artifact records source revisions, transformations, cutoffs and permissions. Deleting raw data or turning a mixing coefficient to zero does not prove that learned influence has disappeared from a jointly trained or distilled model; replacement/retraining lineage may be necessary.

## 41. Portability

The generic vocabulary is `Subject`, `State`, `Action`, `Object`, `Context`, `Observation`, `Outcome`, `Scenario` and `Trajectory`, plus separate acting identity/scope when relevant. The source's `Actor` role is preserved semantically through the explicit subject/actor distinction.

Kajo mapping:

```text
PersonalProfile / SharedProfile → Subject
User performing the request    → acting identity
Item                           → Object
recommendation/slate           → Action
verified exposure/behavior     → Observation
source-defined result          → Outcome
```

The core cannot import React Native, Kajo BOOK/MOVIE enums, provider clients, Supabase auth/session objects or application tables. Other domains replace the adapter, objective and data, not the Observe/Recall/Predict/Learn architecture. Model usefulness still has to be established in each new domain; interface portability is not zero-shot competence.

## 42. Domain Adapter

The adapter contract includes the source's encodeActor/encodeObject/buildContext/enumerateActions/interpretOutcome/calculateReward/defineHardConstraints responsibilities, with subject and actor roles made explicit.

Proposed logical interfaces, not yet source code:

```text
DomainAdapter:
  encodeSubject(authorizedSnapshot)
  encodeObject(canonicalObject)
  buildContext(allowlistedInput)
  enumerateActions(authorizedScope, budget)
  interpretObservation(sourceRecord)
  interpretOutcome(observations, targetDefinition, horizon)
  calculateReward(outcome, objectiveVersion)
  defineHardConstraints(scopeSnapshot)

Engine:
  buildState(observations, priorArtifacts, asOf, versions)
  retrieve(state, authorizedMemoryPort, retrievalBudget)
  predict(state, eligibleActions, recalledMemory, genome)
  choose(predictions, hardConstraints, policy)
  evaluate(frozenPrediction, eligibleObservedOutcomes)
```

Time, randomness, storage and model loading are injected/versioned. Pure scoring/replay components do not acquire credentials or mutate production state. Kajo's trusted server boundary remains responsible for authorization, current membership/eligibility, atomic trace/receipt commit and exposure provenance.

## 43. Internal modularity

Logical modules remain those proposed by the owner:

| Module | Responsibilities |
|---|---|
| state | StateBuilder, WorkingMemory, ShortMemory, LongMemory, BeliefState, WorldState |
| scenario | ScenarioBuilder, ScenarioEncoder, TrajectoryBuilder |
| memory | LocalScenarioMemory, GlobalScenarioMemory, SyntheticScenarioMemory, MemoryConsolidator |
| retrieval | exact/ANN index port, ScenarioRetriever, Reranker, MetricEngine |
| prediction | WorldModel, OutcomeModel, UncertaintyModel |
| policy | PolicyEngine, ExplorationPolicy, immutable hard constraints |
| sleep | DreamEngine, ReplayEngine, ErrorAnalyzer |
| evolution | PredictorGenome, ChallengerGenerator, Evaluator, ChampionRegistry |
| evaluation | calibration, metrics, supported counterfactual evaluation |
| domain | DomainAdapter and versioned contracts |

These are responsibility boundaries, not a mandate for eleven services or empty directories. Remain in one repository and simple deployments initially. Create a reusable package only with executable contracts/tests or a real implementation; preserve server ownership.

## 44. Generation 1 — Transparent Engine

Generation 1 uses inspectable state, explicit evidence, deterministic features/retrieval, transparent scoring, frozen traces, outcome reconciliation and bounded evaluation. Existing PostgreSQL/SQL/TypeScript foundations are useful, not discarded.

Extract by a parity-tested boundary: capture fixtures from accepted SQL, define generic contracts, exercise a second small synthetic non-media adapter, then replace one component at a time behind the existing Kajo serving contract. Do not implement an independently drifting TypeScript copy of the whole SQL scorer and call it parity.

An isolated external-data research path begins here. MovieLens-derived preference baselines can test rating prediction and cold-start adaptation; they are not imported as native Events or complete scenarios. [DATA_ENRICHMENT](DATA_ENRICHMENT.md) defines the reproducible experiment and source limits. [ROADMAP](../project/ROADMAP.md) defines the first bounded work packets.

## 45. Generation 2 — Latent Memory Engine

Learned object/subject/scenario representations, an uncertainty model and optionally ANN/reranking enter after reproducible quality and cost comparisons. Public movie data may support a compact preference-representation experiment before substantial native volume exists.

That changes the timing of **offline research**, not the privacy gate for Kajo-wide GlobalScenarioMemory or permission to serve an externally trained model. Admission requires compatible representations, artifact rights, catalog mapping, cold-start slices, negative-transfer checks, deletion/withdrawal lineage and a working baseline fallback.

## 46. Generation 3 — World Model

This generation explicitly models `State + Action → Outcome Distribution + Next State Distribution`. It needs suitable observations, horizons, uncertainty and validation of transitions, not only hidden-rating accuracy.

Start with one-step tasks and compare against transparent controls. Missing next-state observations remain missing. Causal policy claims require additional design/evidence beyond fitting observational transitions.

## 47. Generation 4 — Dreaming Engine

The WorldModel permits bounded multistep rollouts and synthetic trajectories. Prediction error can compound across simulated steps, so horizon, branch width, storage, compute and uncertainty thresholds are explicit experiment budgets.

Evaluate dream-assisted learning against no-dream controls on untouched real outcomes. Stop or shorten rollouts outside supported states. Synthetic success is not promotion evidence. The first Kajo release does not require a large multistep simulator.

## 48. Generation 5 — Self-evolving geometry

The long-term engine may evolve representations, dimensions, similarities, memory retrieval, world modeling, uncertainty and action policy. This preserves the source's ambition beyond tuning ranking weights.

It remains a controlled search over versioned components, not an agent rewriting its own safety boundaries. Demonstrated gains, bounded search cost, reproducibility and reversible deployment govern admission. Human metaphors describe organization, not consciousness or a proven model of the brain.

## 49. Invariants

1. Observed, externally observed, derived and synthetic evidence remain distinguishable.
2. Every frozen prediction records target, horizon where applicable, information scope and model versions.
3. Every memory/artifact has provenance, access scope, time semantics and lifecycle.
4. No own future label, later available feature or incompatible artifact enters a historical decision unnoticed.
5. WorldState change is not automatically personal identity change.
6. Missingness and unsupported uncertainty are explicit; scores are not invented probabilities.
7. Evolution cannot bypass evaluation, approval, hard constraints or rollback.
8. Domain/provider/auth/presentation logic stays outside the reusable computation core.
9. Observations and original prediction records are not rewritten by derived intelligence.
10. Components remain replaceable through tested versioned contracts.
11. Subject/actor and Personal/Shared boundaries survive every adapter, cache and artifact.
12. Data permissions and deletion/withdrawal lineage apply to learned derivatives, not only raw files.

## 50. Complete architecture

```text
REAL WORLD / DOMAIN
        ↓ authorized observations + explicit provenance
DOMAIN ADAPTER
        ↓
STATE BUILDER ── Subject / Working / Short / Long / Belief
        │        Group + World + Context
        ↓
CURRENT STATE + INFORMATION CUTOFF
        ↓
MEMORY RETRIEVAL ── Local observed episodes
        │           permitted Global observed prototypes
        │           separately gated Synthetic hypotheses
        │           optional licensed ExternalTastePrior
        ↓
RERANKED ANALOGIES
        ↓
WORLD / OUTCOME MODEL → possible branches + uncertainty
        ↓
POLICY + HARD CONSTRAINTS
        ↓
ATOMIC FROZEN PREDICTION / ACTION RECORD
        ↓
DELIVERY → VERIFIED EXPOSURE → ACTUAL OUTCOMES
        ↓
ERROR AGAINST ORIGINAL PREDICTION
        ├── derived memory update / consolidation
        └── bounded SLEEP: replay, errors, dreams
                         ↓
                 EVOLUTION EVALUATION
                         ↓ explicit admission / rollback
                    MODEL REGISTRY
```

External datasets enter through their own research adapter and artifact gate, not through the native event ingestion arrow. Detailed Kajo UI/slate/membership behavior stays in the Kajo adapter contract.

## 51. Core thesis

The engine does not attempt to store a perfect world. It builds a useful, revisable internal model of current state, similar experiences, possible outcomes, uncertainty and failure.

```text
History + State + Environment + Action
→ supported future estimates / probability distributions when calibrated

Frozen Prediction + Observed Reality
→ eligible Prediction Error
→ better tested Internal Model
```

Kajo is the first environment in which this reusable engine is taught. The architecture's ambitions are preserved in full; implementation claims are limited to the evidence recorded in STATUS, MVP and accepted code.
