# Predictive Memory Engine — implementation and acceptance ledger

Review date: **2026-10-05**. Tracking: [Issue #302](https://github.com/Kajooja/Kajo/issues/302).

Status: **complete target architecture already recorded; staged implementation remains open**.

## Ownership and purpose

[PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md) is the single canonical 51-part technical specification. This ledger maps every part to bounded implementation and acceptance work; it does not replace or duplicate that specification. [ADR-0008](../architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md) owns the reusable-engine decision. [PREDICTION_MODEL](../domain/PREDICTION_MODEL.md) owns the Kajo adapter's prediction semantics, and [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md) owns external research and artifact admission.

[ROADMAP](ROADMAP.md#engine-build-out-commitment--2026-10-05) alone owns execution order and release placement. [STATUS](STATUS.md) owns one current task and actual source, deployment and device acceptance. [MVP](../product/MVP.md) alone owns first-release blockers. The EB identifiers below are capability/acceptance identifiers, not new MVP requirements or twelve concurrently active sprints.

The owner's intended system is preserved in full:

```text
Observe → Represent → Recall → Imagine → Predict → Choose/Act
        → Observe outcome → Compare → Learn → Consolidate → Evolve

Kajo application → Kajo DomainAdapter → reusable computation core
Other application → another DomainAdapter → the same core contracts
```

The deliverable is not permanently limited to a recommender with adjusted weights. It includes evolving multi-space representations, contextual similarity, scenario/trajectory recall, supported future branches, separate synthetic memory and controlled evolution. However, neither these metaphors nor acceptance of a design establishes predictive quality. A failed experiment must produce a recorded rejection and successor/defer decision; it must not silently erase the target capability or masquerade as successful implementation.

## Verified starting point

This audit inspected accepted main `34d21704cafe21091a2369396c9bc61dce99c1e9`, dated 2026-09-30, and the separately open native follow-ups. It is a dated source assessment, not a new hosted inventory or phone test.

| Layer | Already present | What must not be inferred |
|---|---|---|
| Complete design | All 51 numbered sections, reviewed amendments, ADR-0008 and links from README/documentation map | A designed module is not implemented or admitted to serving |
| Portable reference | [E1 package](../../packages/prediction-engine/README.md): generic contracts, bounded represent/recall/predict/choose/compare/learn and deterministic media/non-media fixtures | The reference estimator is not the native SQL recommender or a real non-media quality demonstration |
| External research | E1/D1/D2 accepted; [D2 report](../../research/reports/movielens-small-d2.md) retains the actual development experiment and rejected challenger | External ratings are not complete native scenarios; a completed experiment does not authorize model serving |
| Native baseline | Versioned SQL prediction, Personal/Shared boundaries, memory/scenario foundations and controlled-evaluation foundations | Full adaptive state, operating evaluation and later generations are not all accepted |
| Active application evidence | Draft #229 retains configured-device/fresh-account gates; open #301 targets that native branch with the terminal-refresh correction | Neither unmerged source nor an older APK proves the corrected gesture works; this audit does not merge either PR |

Do not repeat E1/D1/D2, reset native accounts, repeat deployed migrations or reactivate consumed catalog requests. Continue the current native packet from STATUS and fresh PR state. The implementation ledger does not authorize a provider request, data purchase/download, infrastructure deployment, APK dispatch or model promotion.

## Complete 51-part traceability

Section numbers refer to the unchanged canonical architecture. Every section has at least one acceptance owner below; references describe the complete target, not delivered status.

| Section | Architectural responsibility | Acceptance packets |
|---|---|---|
| 1 | General prediction goal | EB-01, EB-12 |
| 2 | Complete observation-to-evolution cycle | EB-01, EB-03, EB-12 |
| 3 | CurrentState and subject/acting-identity distinction | EB-01, EB-02 |
| 4 | Ordered WorkingState | EB-02 |
| 5 | ShortTermState | EB-02 |
| 6 | LongTermState | EB-02 |
| 7 | BeliefState, uncertainty and present-state hypotheses | EB-02, EB-07 |
| 8 | Independent GroupState | EB-02 |
| 9 | Versioned WorldState | EB-02 |
| 10 | Allowlisted Context | EB-01, EB-02 |
| 11 | Scenario as a partially observed transition | EB-01, EB-04, EB-07 |
| 12 | Ordered Trajectory and available prefix | EB-04 |
| 13 | Observed Reality Path | EB-01, EB-03 |
| 14 | Branches, horizons and distinct hypothesis/action/model identities | EB-07 |
| 15 | Outcome distributions and conditioning | EB-07 |
| 16 | Local/global/synthetic memory and separate external priors | EB-04, EB-06, EB-10 |
| 17 | Replaceable associative search layer | EB-04, EB-05 |
| 18 | Multiple latent spaces and representation compatibility | EB-05 |
| 19 | Cross-domain Human Space | EB-05, EB-12 |
| 20 | Dynamic State Space | EB-02, EB-05 |
| 21 | Outcome Space without future-label leakage | EB-05, EB-07 |
| 22 | Context/task-dependent geometry | EB-05 |
| 23 | Decision-prefix ScenarioEncoder | EB-04, EB-05 |
| 24 | Similarity / MetricEngine | EB-04, EB-05 |
| 25 | Retrieval, reranking and no useful match | EB-04, EB-05 |
| 26 | Typed Scenario Graph | EB-09 |
| 27 | One-step and later multistep WorldModel | EB-07, EB-10 |
| 28 | DreamEngine and separate generated paths | EB-10 |
| 29 | Error-driven replay/dreaming | EB-03, EB-10 |
| 30 | Error against the frozen original forecast | EB-03, EB-07 |
| 31 | Error-attribution hypotheses | EB-03, EB-10 |
| 32 | Policy separated from prediction | EB-08 |
| 33 | Bounded active learning | EB-08 |
| 34 | Evidence-preserving consolidation | EB-09 |
| 35 | Decay, retention, correction and deletion | EB-02, EB-09 |
| 36 | Controlled EvolutionEngine | EB-03, EB-11 |
| 37 | Immutable PredictorGenome and artifact lineage | EB-01, EB-11 |
| 38 | Evolution of weights, representations and structure | EB-11 |
| 39 | Champion/Challenger scope, admission and fallback | EB-03, EB-11 |
| 40 | Canonical evidence versus derived intelligence | EB-01, EB-09 |
| 41 | Portability beyond Kajo | EB-01, EB-12 |
| 42 | DomainAdapter contracts | EB-01, EB-12 |
| 43 | Replaceable internal modules and injected ports | EB-01, EB-12 |
| 44 | Transparent Engine generation | EB-01, EB-02, EB-03, EB-04 |
| 45 | Latent Memory Engine generation | EB-05, EB-06 |
| 46 | Explicit World Model generation | EB-07 |
| 47 | Dreaming Engine generation | EB-10 |
| 48 | Self-evolving geometry generation | EB-11 |
| 49 | Invariants across all modules | EB-01 through EB-12 |
| 50 | Integrated end-to-end architecture | EB-12 |
| 51 | Supported future estimates and tested improvement | EB-03, EB-12 |

## Acceptance packets

All complete-capability checkboxes remain open. Existing foundations are reused, not relabeled as absent. For each selected packet, create or reuse one narrow implementation issue under #302, with an explicit slice and its prerequisite evidence. ROADMAP determines when it becomes active.

### EB-01 — Frozen evidence and portable native integration

- [ ] Complete capability accepted.

**Reuse:** E1, ADR-0005/0008, accepted SQL, PredictionRun/candidate traces and #228/#229. Existing first-release evidence/parity requirements remain the immediate scope.

**Next bounded slice:** inventory one real native prediction cycle against E1 contracts. Record which state, candidate, eligibility, version, exposure and outcome fields have exact mappings and which are unavailable. Capture privacy-safe deterministic parity fixtures from the accepted semantics; synthetic fixtures must stay labeled synthetic. Do not copy live histories into Git.

**Exit evidence:** the mapped cycle preserves Profile-as-Subject versus acting User, Personal/Shared scope, event occurrence/availability, candidate/slate order, frozen versions, late outcomes, idempotency and rollback. Extract one computation behind the current server boundary only after a same-input parity comparison; avoid a second drifting whole-scorer implementation. The eventual reusable integration must be exercised through the native boundary and another adapter, not merely imported into an unused package. Runtime acceptance and the E1 contract acceptance remain distinct.

An optional externally trained prior is not a prerequisite for this core extraction. Conversely, rejecting that prior does not complete or cancel native-core integration. Full extraction is not silently added to MVP when existing requirements can be satisfied safely by the accepted SQL boundary.

### EB-02 — Adaptive state and memory lifecycle

- [ ] Complete capability accepted.

**Prerequisites:** truthful, ordered, scoped evidence and versioned feature definitions from EB-01. Reuse Phase 14.4 and the separately sequenced #232 Shared contracts; do not replace them with a second human-state model.

**Next bounded slice:** version one state snapshot with Working/Short/Long summaries, permitted Group/World/Context inputs, missingness, effective support and explicit BeliefState calibration status.

**Exit evidence:** ordered session effects, recent-versus-durable contradiction, inactivity, import correction/removal, late arrival and undo produce predictable updates. Incremental state matches full eligible recomputation. A trend-only change does not rewrite personal durable memory. Group membership changes invalidate dependent aggregates without leaking members' raw evidence. Repeated projections of one event do not multiply support. Unknown belief is distinguishable from poor expected fit; unavailable inputs remain unavailable rather than guessed psychology.

Compare single-scale, short/long and context-gated alternatives on declared targets. Retain no-transfer controls for cross-domain signals. Confidence and time constants are versioned estimates, not human personality facts.

### EB-03 — Operating evaluation and bounded replay

- [ ] Complete capability accepted.

**Prerequisites:** EB-01 evidence and consistent serving/shadow semantics; align with Phase 14.5 rather than opening a parallel evaluation system.

**Next bounded slice:** run one bounded, retry-safe evaluation job over frozen decisions and eligible matured outcomes, with deterministic identity/checkpoints and an explicit report.

**Exit evidence:** horizon-specific label maturity, corrected outcomes, missing/censored results and exposure coverage are reported. Training/selection/final-test windows are separate. Replay uses only available-at-time inputs and compatible artifacts. Representative replay is the control for error-prioritized replay, with sampling treatment and diagnostic limits recorded. Unchosen actions receive no invented successes or failures. Report support, uncertainty method, latency/resource cost and rejected/insufficient results. Exercise manual canary and rollback without enabling automatic/global promotion.

Diagnostics separate possible state/retrieval/world/calibration failures; they do not claim causal explanations from one surprising outcome. No worker creates its own evaluation truth.

### EB-04 — Useful local scenario and trajectory retrieval

- [ ] Complete capability accepted.

**Prerequisites:** EB-01/02 and a usable EB-03 comparison. Reuse native same-Profile ScenarioMemory and E1's bounded exact-prefix reference before adding infrastructure.

**Next bounded slice:** compare static-state, recent-state and ordered-prefix retrieval on the same eligible targets, including a no-retrieval baseline and an explicit no-useful-match response.

**Exit evidence:** searchable prefixes never contain their own future outcomes/after-state/errors. A neighbor's continuation is usable only when already available at the decision cutoff. Subject/source/authorization/time/representation/action/horizon compatibility constrains retrieval before top-K and again at materialization. Record neighbor/prototype identity, effective support, exclusion reasons, thresholds and fallback. Demonstrate correction/deletion propagation and bounded memory/latency. Nearest-neighbor distance alone is not a quality metric.

Rating-entry order may support a limited research hypothesis; it is not fabricated viewing history. A supported exact index remains a valid implementation until measurements justify approximation.

### EB-05 — Learned multi-space geometry and index lifecycle

- [ ] Complete capability accepted.

**Prerequisites:** EB-04 and sufficient permitted train/validation evidence. Native global memory is not necessary for a local or isolated external representation experiment.

**Next bounded slice:** one versioned, task-conditioned encoder/metric challenger over a fixed set of subject/state/action/world components. Compare it with the transparent metric at matched information and declared compute budgets.

**Exit evidence:** report downstream prediction quality, no-match coverage, negative transfer and domain slices, not just attractive clusters. Outcome labels can supervise training but cannot enter live prefixes. Multiple spaces have explicit meanings, dimensions, normalization, missingness and compatible query/document versions. An encoder update creates a new compatible artifact/index generation: build and verify it, switch atomically and retain rollback; never silently mix geometries.

Context-dependent reranking must be evaluated against an exact constrained reference. A fixed-metric ANN candidate pool does not guarantee the best results under every changing contextual metric; measure candidate recall under those metrics, use bounded multi-space candidate unions or fall back where needed. Benchmark optional HNSW/other implementations against exact retrieval for quality, filtered recall, update/delete freshness, memory, latency and cost. A custom ANN or graph engine requires a measured unmet need, not the metaphor alone.

### EB-06 — Native global scenario memory

- [ ] Complete capability accepted.

**Prerequisites:** validated local semantics, sufficient independent native observations, consent/access design, cohort policy and working correction/deletion lineage. Do not require EB-05 specifically if an exact prototype implementation is sufficient.

**Next bounded slice:** one explicitly admitted cohort/prototype retrieval channel, compared with local-only evidence under the same evaluation contract.

**Exit evidence:** separation of access scope, evidence origin and source system; no cross-Profile raw-history or private-neighbor leakage; exposure/selection limitations; effective independent support; sparse-cohort fallback; correction, withdrawal and cache/index/artifact invalidation. Demonstrate incremental benefit on real outcomes and inspect concentration/coverage, not only average error.

ExternalTastePrior is separate and cannot supply missing native exposures or options. Aggregation is not automatically anonymization. A globally searchable dream remains synthetic and belongs to EB-10's separate channel, never the real-outcome denominator.

### EB-07 — One-step world model, outcome distributions and branches

- [ ] Complete capability accepted.

**Prerequisites:** EB-01/02/03 and actual observable targets with defined horizons. This work does not depend on global scale, an ANN index or a complete Scenario Graph.

**Next bounded slice:** one outcome head and one next-state target where labels exist, with a transparent baseline and a frozen calibration/evaluation protocol.

**Exit evidence:** target, horizon, conditional population, observability/maturity and estimate kind are explicit. Exclusive exhaustive branch categories sum to one within their declared action/hypothesis; overlapping save/consume/rating heads are not summed as one categorical distribution. State hypotheses, stochastic branches, alternative actions and model challengers have separate IDs and update rules. Retain distributional spread/quantiles when supported, not only a point score.

Report proper probability/regression losses, calibration and unsupported-state behavior. Unknown outcomes stay unknown. One realized low-probability branch does not make every alternative prediction wrong or prove one hidden-state hypothesis. Predictive conditional accuracy is not a causal intervention claim. New evidence creates a new state/model version without improving the historical forecast retroactively.

### EB-08 — Policy and active learning

- [ ] Complete capability accepted.

**Reuse/prerequisites:** Phase 14.4 modes and Phase 15.0 recognition-aware Taste; EB-07 is required only for later distributional policies, not to implement the existing bounded modes.

**Next bounded slice:** compare one versioned FOR_YOU/SURPRISE/RISK policy difference or one question-selection rule with a fixed control, retaining user utility and hard constraints.

**Exit evidence:** model predictions remain separate from action choice; constraints are not genome-mutable. Evaluate discovery satisfaction/choice, novelty, fatigue, learning efficiency and coverage where observable. Asking about a recognized past experience is not the same experiment as recommending a new one. Held-out challenge answers never enter their own prediction. Information gain is supported or explicitly unavailable, not random jitter with a scientific name.

For stochastic delivery, log probabilities consistent with the actual action/slate sampling mechanism and verify support before off-policy evaluation. Do not optimize only screen time or treat users as unbounded experimental resources. Any production experiment retains approval, limits and rollback.

### EB-09 — Consolidation and typed scenario relationships

- [ ] Complete capability accepted.

**Prerequisites:** EB-01 lineage, EB-02 lifecycle and EB-04 retrieval. No separate graph database is required.

**Next bounded slice:** one supported ScenarioPrototype family or one useful typed temporal/derivation relation, compared with uncompressed/unlinked memory.

**Exit evidence:** retain real ancestors, effective support, time/encoder versions, contradictions and access constraints; measure memory/cost savings against recall/error/coverage. Correction, revocation and deletion invalidate all dependent summaries, edges and indexes. Influence decay is not physical deletion, and expired source retention bounds what can be reconstructed.

Use relational edge storage initially. SIMILAR_TO, FOLLOWED_BY, DERIVED_FROM and DREAMED_FROM have distinct semantics. CAUSES requires separately justified identification/intervention evidence. The graph does not manufacture causality from adjacency or convert synthetic descendants to observed facts.

### EB-10 — Error-driven dreams and synthetic memory

- [ ] Complete capability accepted.

**Prerequisites:** supported EB-07 transitions, EB-03 independent evaluation and EB-01 lineage; EB-09 is needed when compressing or graph-linking generated paths, not for the first bounded simulation.

**Next bounded slice:** one-step or short-rollout simulation from eligible real training prefixes; compare real-only training with dream-assisted training at declared comparable budgets.

**Exit evidence:** separate synthetic storage/retrieval channel, parent/generator/model/seed lineage, branch width/depth/time/storage budgets, uncertainty/support stopping rules and capped synthetic influence. Error priorities exclude logging defects, immature labels and final-test information; retain representative sampling. Replay, simulation, consolidation and evolutionary selection have independently switchable controls so one combined gain does not credit every component.

Dreams never supply evaluation labels, count as independent real observations or become personal history. Later matching observations are new observed records linked to unchanged hypotheses. Report accumulated horizon error, real outcome quality and failure/abstention rates. A plausible simulated story does not pass. Extend depth only after the shorter experiment earns it; retain a no-dream serving fallback.

### EB-11 — Evolution of geometry and models

- [ ] Complete capability accepted.

**Prerequisites:** EB-03 for basic configuration search; validated EB-05/07 components before evolving their structure; EB-10 only for dream-specific candidates. Not every later component must exist before testing simple challengers.

**Next bounded slice:** one bounded challenger family over weights, time scales, retrieval thresholds or another already validated replaceable component.

**Exit evidence:** immutable genome/artifact/feature/index/target versions, lineage, search/compute budget, seeds and separate selection/final-test windows. Compare against the frozen champion and capacity/budget-appropriate controls. Expanding search cannot reuse a consumed final test as untouched evidence. Later families may change encoders, spaces, metrics, retrieval, outcome heads and world models without modifying permissions, hard constraints or the evaluator's truth.

Profile/cohort/global resolution is explicit and support-aware, with baseline fallback. A candidate must pass quality, uncertainty, privacy, latency/cost and rollback checks before any scoped admission. Auto-promotion is a separate later operational decision, not implicit in self-improvement. Rejected genomes and negative results remain part of the learning record.

### EB-12 — Real portability and full-system acceptance

- [ ] Complete capability accepted.

**Prerequisites:** E1 as the existing contract demonstration, EB-01's native integration evidence and the applicable accepted capabilities above. A second-domain adapter feasibility experiment may begin earlier when explicitly selected; the complete-engine claim cannot.

**Next bounded slice:** choose one real non-media prediction task with permitted data, useful observable target, explicit actions or forecast-only mode, a baseline and a resource budget. Do not choose or download a new source as a side effect of this documentation.

**Exit evidence:** the task executes without Kajo UI/accounts/provider/auth dependencies in the core. Only adapter, schema mapping, target/reward/constraints and separately trained domain artifacts change; record actual shared-core versus adapter changes and any leakage of domain concepts. Interface reuse is not a promise that learned weights or human-state vectors transfer unchanged.

For the full engine, demonstrate the observation → state → retrieval → prediction → chosen action → mature outcome → frozen-error → memory/evaluation loop through runtime ports. Exercise the separately gated synthetic/evolution loop and its disabled fallback. Provide a module/section coverage receipt, source commits, tests, independent real-data results, operational limits and a reproducible rollback/rebuild. Kajo and the second task must each earn their own usefulness claim. E1's invented maintenance fixture remains a contract test, not this final gate.

## Completion evidence required for every selected slice

Each implementation issue/PR must record:

1. The EB identifier and exact 51-section subset, existing components reused and unchanged constraints.
2. Input/output schemas, source permissions, time horizons/cutoffs, missingness and memory/artifact lineage.
3. Deterministic tests plus the appropriate baseline/ablation and declared train/selection/final-test split; no fictitious quality percentages.
4. A resource budget, fallback, correction/deletion behavior and failed/unsupported-case results.
5. Separate statuses for design, source/CI, offline quality decision, runtime admission and device/operational acceptance where applicable.
6. The next bounded task and an update to the canonical owner whose truth changed.

Allowed evidence states include accepted, rejected, insufficient and deferred with a reason. Do not tick an entire capability because a diagram, empty interface, synthetic demo or documentation PR exists. A method can be rejected while its target capability remains open for another measured approach. Removing a target capability requires an explicit owner/design decision propagated through architecture, ROADMAP and this ledger.

## Maintenance and handoff

Keep the section map complete when the architecture changes. Record new evidence links beside the relevant EB packet and update #302's checkboxes only at the stated scope. ROADMAP schedules packets; do not grow a competing current-task queue here. Reuse existing issues for already scheduled MVP work and create a narrow child issue only when a genuinely new implementation slice is selected.

The October 5 documentation packet adds traceability and delivery gates, not new runtime. It preserves all 51 architectural sections, E1/D1/D2 completion, the native #229/#301 source distinctions, existing MVP release gates and consumed catalog operations. The tracking issue remains open after documentation publication.
