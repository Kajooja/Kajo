# Predictive Memory Engine — implementation and acceptance ledger

Original review: **2026-10-05**. Integration review: **2026-10-12**. Tracking: [Issue #302](https://github.com/Kajooja/Kajo/issues/302).

Status: **complete target architecture already recorded; staged implementation remains open**.

## Ownership and purpose

[PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md) is the single canonical 51-part technical specification. This ledger maps every part to bounded implementation and acceptance work; it does not replace or duplicate that specification. [ADR-0008](../architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md) owns the reusable-engine decision. [PREDICTION_MODEL](../domain/PREDICTION_MODEL.md) owns the Kajo adapter's prediction semantics, and [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md) owns external research and artifact admission.

[ROADMAP](ROADMAP.md#engine-v1-first--owner-decision-2026-10-25) alone owns execution order and release placement. [STATUS](STATUS.md) owns one current task and actual source, deployment and device acceptance. [MVP](../product/MVP.md) alone owns first-release blockers. The EB identifiers below are capability/acceptance identifiers, not new MVP requirements or twelve concurrently active sprints.

The owner's intended system is preserved in full:

```text
Observe → Represent → Recall → Imagine → Predict → Choose/Act
        → Observe outcome → Compare → Learn → Consolidate → Evolve

Kajo application → Kajo DomainAdapter → reusable computation core
Other application → another DomainAdapter → the same core contracts
```

The deliverable is not permanently limited to a recommender with adjusted weights. It includes evolving multi-space representations, contextual similarity, scenario/trajectory recall, supported future branches, separate synthetic memory and controlled evolution. However, neither these metaphors nor acceptance of a design establishes predictive quality. A failed experiment must produce a recorded rejection and successor/defer decision; it must not silently erase the target capability or masquerade as successful implementation.

## Engine V1 scope and sprint ownership — 2026-10-25

The owner's current decision makes **maximizing the individual user's expected
post-experience rating** the primary Kajo objective, with a supported model of
that user's rating habits. A user's 8 can express stronger satisfaction than
another user's 10; cross-user raw marks do not define a universal utility scale.
The canonical target/conditioning and response-style contract is in
[PREDICTION_MODEL](../domain/PREDICTION_MODEL.md). Literal-ten maximization,
universal 9+ success and convex high-tail bonuses are superseded. Interest,
experience/label availability and rating outcomes remain distinct.

Current actions are list saving (interest), numeric rating (the Item has been
experienced), and a contextual SKIP with unknown reason. SKIP is neither a
numeric negative nor observed non-recognition. Do not add a separate En tunne
control, require another consumed action or reinterpret retained legacy records.

The new sprint IDs are independent of the older product Phase 15–20 identifiers.
ROADMAP owns this order: finish the active stack and preserve its acceptance
limits; safely clean obsolete branches; complete bounded Engine V1; then UX and
acquisition/social paths; then UI completion; then release. Sprint 014 retains
its dated evidence, while its unresolved capability work has named successors.

| Sprint | Coherent deliverable | EB ownership |
|---|---|---|
| [015](sprints/SPRINT-015.md) | Shared native input/serving and frozen evaluation foundation | EB-01/03, EB-12 integration |
| [016](sprints/SPRINT-016.md) | Numerical expected ratings and shrunk, identifiable user rating style | EB-02/03/07/08 |
| [017](sprints/SPRINT-017.md) | Multiscale state, content, dated world facts, bounded transfer and Shared state | EB-02, bounded EB-05/07/09 |
| [018](sprints/SPRINT-018.md) | Conditional local recall and supported cohort/external-prior experiments | EB-04, bounded EB-05/06/09 |
| [019](sprints/SPRINT-019.md) | Calibrated uncertainty/readiness and one guided selection policy | EB-03/07/08 |
| [020](sprints/SPRINT-020.md) | Operating replay/consolidation and manual challenger lifecycle | EB-03/09/11; EB-10 boundary |
| [021](sprints/SPRINT-021.md) | Native end-to-end usefulness, lifecycle and operational acceptance | EB-12 V1 integration; all admitted slices |

These are substantial outcome sprints, each implemented through bounded reviewed
issues/PRs rather than one enormous commit. `MVP-ALG-012` owns aggregate V1
acceptance; existing requirements retain their IDs and individual evidence.
An engine sprint includes only the minimal client controls needed to exercise
its behavior. Public web Taste, acquisition/conversion, sharing and broad visual
work remain in their later product stages.

**Required V1:** a functioning own-scale expected-rating predictor; immediate
committed-evidence/state updates; common Taste/Discovery serving; versioned
state/features and lifecycle; useful local-memory capability or measured
no-recall fallback; supported per-domain readiness; real evaluation/replay;
controlled model comparison and rollback; and the integrated native quality gate.
One complete evaluated simpler configuration can be accepted when an optional
complex method loses. A generic rank score with no numerical target, missing
outcome evidence or fabricated readiness cannot be renamed Engine V1.

**Bounded by available evidence:** native population recall, external priors,
learned geometry, Working/transfer/trend influence and prototype compression need
feasibility and quality decisions. Implement their useful contracts/fallbacks,
run the declared feasible comparison, and record ACCEPTED, REJECTED or
INSUFFICIENT. Insufficient data/rights means the affected channel stays OFF with
a re-entry criterion; it does not authorize an invented cohort or endless
infrastructure work. A capability is not complete merely because one method was
rejected.

**Research after V1:** neural multistep world models, synthetic dream training,
self-evolving geometry, custom ANN/graph infrastructure without measured need,
automatic global promotion and usefulness in a second real non-media product.
Their architecture/EB gates remain open. Existing deterministic non-media
fixtures still verify the portable contract in V1.

## Engine V1 quantitative protocol

Every model/state/retrieval/policy experiment in Sprints 015–021 uses one
versioned protocol. Numerical thresholds are selected from development data and
operational needs **before** final outcomes are inspected; this planning document
does not invent a universal accuracy percentage, sample count or latency SLA.
A real experiment cannot start final evaluation with missing threshold values.

1. **Declare the question and source.** Pin target/conditioning/horizon, permitted
   data and available-at-time prefix, model/artifact versions, forecast coverage,
   eligible first-label rules, exclusions, and analysis unit (Profile/session/
   Item as appropriate). Familiar-item Taste and newly recommended experienced
   Items are separate populations. Report no rating, no exposure, immature label,
   correction and withdrawn source rather than filling them with zero.
2. **Lock the controls and splits.** Retain the serving champion and relevant
   user-mean, item/domain-prior, no-state/no-recall/no-transfer controls. Separate
   training, selection/calibration and untouched final windows chronologically;
   fit feature transforms and rating-style parameters within training prefixes.
   Predeclare source/user/item dependence, cluster treatment and search budget.
3. **Align loss with the mean objective.** Mean-prediction estimation uses squared
   error or another declared mean-consistent procedure; MAE alone targets a
   conditional median. Report user-macro MSE/RMSE, MAE as a diagnostic, conditional
   mean bias and coverage by domain/history/rating-style slice. Proper losses and
   calibration/interval coverage apply only to distributions actually supplied.
   Ranking/order measures are secondary and never renamed grade accuracy.
4. **Keep recommendation value distinct.** Report each subject's observed mean
   rating and paired/balanced within-subject changes for new experiences; summarize
   subjects without letting prolific or generous raters dominate. Raw own-scale
   error remains visible. Any scale-standardized secondary comparison uses an
   anchored, prefix-fitted transform and missingness/shrinkage, never ad hoc
   sample min/max stretching. A shared latent satisfaction scale is not identified
   merely by normalizing marks. Offline error/shadow evaluation cannot by itself
   identify causal policy uplift; intervention claims require an eligible design.
5. **Choose numerical acceptance before measurement.** A manifest contains the
   primary loss/value metric, minimum useful improvement `delta`, optional-method
   noninferiority margin, interval level/method, minimum forecast/outcome coverage,
   per-slice guardrails, precision or justified sample-size rule, evaluation window
   and p50/p95/resource budgets. Set these from baseline/development variability,
   required decision precision and deployment costs; record rationale. For a loss
   comparison, a possible locked rule is `upper_bound(L_new - L_control) < -delta`
   at required coverage. Equivalent value rules reverse the direction. The chosen
   rule and its dependence assumptions must be explicit, not selected post hoc.
6. **Handle sequential checking.** Predeclare fixed checkpoints or a defensible
   sequential procedure for readiness and ongoing experiments. Record what its
   bound describes under adaptive questions/drift. Repeated ordinary confidence
   intervals are not automatically valid stopping guarantees. Minimum distinct
   Items alone, numerous shared pairs or a large number of derived tags do not
   establish independent support.
7. **Decide and stop honestly.** Accept a model only inside its supported scope
   after quality, coverage, lifecycle and resource gates pass. Stop/revert on
   predeclared regressions. An optional component may be retained only when it
   meets its locked quality/cost criterion; an apparent average win cannot hide
   a failed required domain/style slice. Reject losers, record insufficient
   precision, and collect further evidence only under the declared continuation
   rule. Once test results guide a redesign, obtain a new final window.
8. **Separate completion layers.** Source tests prove mechanics; external data
   proves only its declared research task; hosted/phone checks prove exercised
   behavior; mature native outcomes support usefulness. Record each separately.
   Sprint 021 cannot close the mandatory numerical-quality gate through a fixture,
   an interest proxy, an unvalidated percentage or successful deployment alone.

The protocol includes failed results, no-match/abstention coverage, cost and exact
next dependencies. Permissions, hard constraints and truthful evidence are fixed
boundaries rather than model-search parameters. Historical raw observations and
frozen predictions are never rewritten to make a challenger appear better.

## Guided Taste integration requirement — 2026-10-25

[ADR-0011](../architecture/decisions/0011-taste-as-guided-discovery.md) makes the
shared native serving path, conditional recall and measured readiness concrete
#336 acceptance consumers of EB-01/02/03/04/06/07/08. Reuse existing native and
research foundations. BOOK → MOVIE is Kajo guidance, not a domain-specific engine
model. The meter needs genuine outcome/calibration evidence; shared cards or an
always-insufficient native response do not deliver this capability. ROADMAP owns
the updated near-term dependency order, while later engine capabilities retain
their existing scope. No learned model is admitted by this refinement.

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

## October 12 integration checkpoint

The original assessment above remains dated. The current challenge continuation builds on
[owned server TasteSession #328](https://github.com/Kajooja/Kajo/pull/328), source
`b7dd4f799358ca167ec1d5a178d290608aacd9ed`. The later October 12 owner decision
authorizes the complete source stack integration through #329 after required CI.
STATUS owns the actual merge receipt and next mobile packet. Configured-device/
fresh-account evidence and hosted rollout remain separate acceptance work.

| Capability | New source foundation since the original review | Remaining acceptance |
|---|---|---|
| EB-01 / EB-02 | #307–#313 Shared response/capture/erasure/prepared-input lineage; #314 decay parity; #315–#319 WorkingState, native OFF controls, reset and candidate features | Genuine Shared prepared-input consumer, native-core extraction, admitted state benefit and lifecycle/rollout/device gates |
| EB-02 / EB-09 | #325 distinct native-Item support and #326 Personal rating/bootstrap fusion, exact Undo/clear, effective Saved/List setup support and versioned forgetting | Uncalibrated support is not independent statistical N; cross-domain transfer, quality and hosted acceptance remain open |
| EB-03 | #320 prospective native enrollment/outcome captures; #321 private report; #322 future cohort declaration/inventory checks | Actual authorized cohort, independently retained pre-window declaration, observed coverage/usefulness and admission |
| EB-03 / EB-08 | #324 portable Taste selector; #328 durable session/SQL parity; current canonical frozen holdout and descriptive same-domain ordinal evaluation | App/anonymous prerequisites, explicit later answer projection, user-facing metric and measured first-session value |

The complete-capability checkboxes below remain open. The source handoff and exact
CI/build/hosted state belong only to STATUS and the referenced PR receipts. This
integration replaces #303's obsolete dependency base, preserves every section
mapping and keeps ROADMAP as the sole scheduling owner.

## October 25 actual-source architecture checkpoint

This source audit compares accepted main
`340d0da660fe02d6d9d47d468bee75e134546fa3` with inspected active source
`a01dc084ebf4a6adc9ef6de3dd3cade5a8b5ee07`. The active UI, guided-Taste design
and cover-repair packets are not relabeled as accepted main. This is not a new
hosted-runtime, model-admission or device receipt; STATUS owns those distinctions.

Kajo has a **partially implemented Generation 1 Transparent Engine**, not only a
design and not the complete five-generation architecture. Existing SQL and
portable foundations should be connected and evaluated, not rebuilt wholesale.

| Capability | Executable source foundation | Remaining boundary |
|---|---|---|
| Shared scoring — EB-01/08 | [Canonical candidate scoring](../../supabase/migrations/20261015090018_personal_evaluation_scoring.sql) extracts common native base, scalar and identity/trace functions for ordinary Discovery, catalogue chains and explicit evaluation candidates. | Taste question selection still has a separate utility. Common scoring is not a calibrated rating or probability. Guided Discovery requires the shared serving contract and outcome evidence. |
| Short/Long memory — EB-02/09 | [Native memory/scoring](../../supabase/migrations/20260902223000_prediction_nervous_system_v1.sql), [decay parity](../../supabase/migrations/20261009103214_personal_native_decay_parity.sql) and [Personal source fusion](../../supabase/migrations/20261012060821_personal_source_fusion.sql) provide real weighted recent/durable tag evidence, bootstrap contribution and correction semantics. | A complete adaptive state, effective support, temporary-versus-durable interpretation and reliable cross-domain transfer still need explicit evaluation. Existing decay is an implemented hypothesis, not demonstrated optimal memory. |
| WorkingState — EB-02 | [Native capture and comparison](../../supabase/migrations/20261010064104_personal_working_bridge.sql), reset and [candidate-feature successor](../../supabase/migrations/20261010160025_personal_working_candidate_features.sql) freeze ordered Personal session evidence and candidate projections. | Live control remains **OFF** (`nativeActivated=false`); STATIC/ORDERED are comparison controls. Capture does not establish a serving contribution or benefit. Activation requires lifecycle, quality and rollback evidence. |
| Context / WorldState — EB-02 | Native `sanitize_prediction_context_v1` and `scenario_similarity_v1` use bounded time/surface/session context; catalogue sources provide object metadata and popularity inputs. | No complete versioned WorldState consumer exists. Trends require source, validity, availability time and staleness behavior; a provider popularity value alone does not establish a current trend or a personal taste change. |
| Scenario recall — EB-04/06 | Native `scenario_similarity_v1` and ranking retrieve **same-Profile** historical situations and outcomes; the [portable engine](../../packages/prediction-engine/src/engine.ts) also exercises bounded exact recall. | No admitted native cross-subject conditional cohort supplies “disliked A, liked B.” Ordered-prefix usefulness, no-match fallback and authorized independent support remain acceptance work; external rating data is not complete GlobalScenarioMemory. |
| Belief/readiness — EB-02/03/07/08 | [Durable sequential Taste](../../supabase/migrations/20261015101752_durable_sequential_taste.sql) retains pre-answer evaluations and descriptive same-prefix ordinal comparisons. | `sequential_taste_snapshot_v2` still returns `INSUFFICIENT`, unavailable uncertainty, `accuracyPercent=null` and `qualityAdmitted=false`. A portable `REFERENCE_READY` result is not calibrated probability or evidence to finish native Taste. |
| Sleep/evolution — EB-03/11 | [SleepLayer foundation](../../supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql) includes immutable genomes, shadow jobs, a worker and evaluation; [serving/canary controls](../../supabase/migrations/20260904180000_sleep_layer_v1_serving_and_profile_canary.sql) provide manual Profile canary and rollback. | Structures do not prove an operating evaluation loop or a winning challenger. Automatic promotion, autonomous evolution, learned geometry and dream rollouts are not admitted by this checkpoint. |
| Portable core / later generations — EB-01/05/07/10/12 | `engine.ts` implements the E1 reference cycle; its recalled/prefix mean explicitly reports uncalibrated estimates and unavailable uncertainty. D1/D2 preserve isolated external research and the rejected challenger. | It is not the native SQL scorer. Generations 2–5, including learned representations, validated next-state distributions, dreaming and self-evolving geometry, retain their own gates. The synthetic second-domain fixture is not real portability-quality evidence. |

This dated checkpoint did not close any complete-capability checkbox. The current
51-part table below additionally records the later owner-approved V1 disposition.
[ADR-0011](../architecture/decisions/0011-taste-as-guided-discovery.md) supplies a
concrete consumer for the existing foundations; [ROADMAP](ROADMAP.md) alone owns
the order of shared serving, outcome evaluation, conditional recall and readiness
work. Later generations are not prerequisites for a useful first transparent
engine, and this checkpoint authorizes no account reset or model promotion.

## Complete 51-part traceability

Section numbers refer to the unchanged canonical architecture. Every section has at least one acceptance owner below; references describe the complete target, not delivered status.

| Section | Architectural responsibility | Acceptance packets | Engine V1 disposition / sprint |
|---|---|---|---|
| 1 | General prediction goal | EB-01, EB-12 | V1 objective and integration — 015/016/021 |
| 2 | Complete observation-to-evolution cycle | EB-01, EB-03, EB-12 | V1 real loop — 015/020/021; simulated loop later |
| 3 | CurrentState and subject/acting-identity distinction | EB-01, EB-02 | V1 snapshot — 015/017 |
| 4 | Ordered WorkingState | EB-02 | V1 lifecycle/comparison — 017; influence only if admitted |
| 5 | ShortTermState | EB-02 | V1 recent memory — 017 |
| 6 | LongTermState | EB-02 | V1 durable memory and rating style — 016/017 |
| 7 | BeliefState, uncertainty and present-state hypotheses | EB-02, EB-07 | V1 uncertainty/readiness — 016/019; hidden-state ensembles later |
| 8 | Independent GroupState | EB-02 | V1 bounded Shared state/evidence — 015/017/021 |
| 9 | Versioned WorldState | EB-02 | V1 dated facts — 017; richer trends only with eligible data |
| 10 | Allowlisted Context | EB-01, EB-02 | V1 allowlisted context — 015/017 |
| 11 | Scenario as a partially observed transition | EB-01, EB-04, EB-07 | V1 partial scenario records — 015/018 |
| 12 | Ordered Trajectory and available prefix | EB-04 | V1 exact prefix recall/comparison — 018; neural paths later |
| 13 | Observed Reality Path | EB-01, EB-03 | V1 observed history — 015/020 |
| 14 | Branches, horizons and distinct hypothesis/action/model identities | EB-07 | V1 typed horizons/output contract — 019; simulated branches later |
| 15 | Outcome distributions and conditioning | EB-07 | V1 own-scale mean and supported uncertainty — 016/019; unsupported heads later |
| 16 | Local/global/synthetic memory and separate external priors | EB-04, EB-06, EB-10 | V1 local plus gated peer/prior decisions — 018; synthetic channel research |
| 17 | Replaceable associative search layer | EB-04, EB-05 | V1 exact retrieval — 018; ANN only after measured need |
| 18 | Multiple latent spaces and representation compatibility | EB-05 | V1 representation compatibility — 017/018; learned multi-space research |
| 19 | Cross-domain Human Space | EB-05, EB-12 | V1 bounded shared/category representation — 017; universal human space research |
| 20 | Dynamic State Space | EB-02, EB-05 | V1 dynamic state — 017 |
| 21 | Outcome Space without future-label leakage | EB-05, EB-07 | V1 target/label separation — 016/018; learned outcome geometry research |
| 22 | Context/task-dependent geometry | EB-05 | V1 transparent contextual weights — 017/018; learned metric optional |
| 23 | Decision-prefix ScenarioEncoder | EB-04, EB-05 | V1 versioned prefix encoder — 015/018; neural encoder optional later |
| 24 | Similarity / MetricEngine | EB-04, EB-05 | V1 metric/support/fallback — 018 |
| 25 | Retrieval, reranking and no useful match | EB-04, EB-05 | V1 retrieval/reranking/no-match — 018 |
| 26 | Typed Scenario Graph | EB-09 | V1 minimal derivation/temporal links — 020; full graph/causality research |
| 27 | One-step and later multistep WorldModel | EB-07, EB-10 | V1 one-step outcome prediction — 016/019; learned transitions later |
| 28 | DreamEngine and separate generated paths | EB-10 | Research deferred; synthetic separation retained in 020/021 |
| 29 | Error-driven replay/dreaming | EB-03, EB-10 | V1 real error-aware replay — 020; dreams later |
| 30 | Error against the frozen original forecast | EB-03, EB-07 | V1 frozen-error evaluation — 015/016/019/020 |
| 31 | Error-attribution hypotheses | EB-03, EB-10 | V1 trace-based diagnostic hypotheses — 020; causal attribution research |
| 32 | Policy separated from prediction | EB-08 | V1 mean-rating policy — 016/019 |
| 33 | Bounded active learning | EB-08 | V1 bounded shared exploration/guidance — 019; advanced policies later |
| 34 | Evidence-preserving consolidation | EB-09 | V1 bounded consolidation comparison — 020; reject if no useful benefit |
| 35 | Decay, retention, correction and deletion | EB-02, EB-09 | V1 decay/correction/deletion — 017/020/021 |
| 36 | Controlled EvolutionEngine | EB-03, EB-11 | V1 manual bounded challenger process — 020; autonomous promotion later |
| 37 | Immutable PredictorGenome and artifact lineage | EB-01, EB-11 | V1 immutable manifests/genomes — 015/020 |
| 38 | Evolution of weights, representations and structure | EB-11 | V1 parameter search — 020; structural evolution research |
| 39 | Champion/Challenger scope, admission and fallback | EB-03, EB-11 | V1 scoped admission/fallback/rollback — 020/021 |
| 40 | Canonical evidence versus derived intelligence | EB-01, EB-09 | V1 canonical/derived separation — 015/020/021 |
| 41 | Portability beyond Kajo | EB-01, EB-12 | V1 integrated core plus non-media contract test — 015/021; real second-task quality later |
| 42 | DomainAdapter contracts | EB-01, EB-12 | V1 adapter mapping/parity — 015/021 |
| 43 | Replaceable internal modules and injected ports | EB-01, EB-12 | V1 useful replaceable modules/ports — 015/021; no empty scaffolding |
| 44 | Transparent Engine generation | EB-01, EB-02, EB-03, EB-04 | V1 required useful transparent configuration — 015–021 |
| 45 | Latent Memory Engine generation | EB-05, EB-06 | Bounded representation/cohort decisions — 017/018; full generation remains open |
| 46 | Explicit World Model generation | EB-07 | V1 outcome slice — 016/019; next-state model research |
| 47 | Dreaming Engine generation | EB-10 | Research deferred until validated transitions and independent outcomes |
| 48 | Self-evolving geometry generation | EB-11 | Research deferred until component quality/compute justify structural search |
| 49 | Invariants across all modules | EB-01 through EB-12 | V1 all applicable invariants — 015–021; later scopes remain gated |
| 50 | Integrated end-to-end architecture | EB-12 | V1 real runtime loop — 021; synthetic/full-generation integration later |
| 51 | Supported future estimates and tested improvement | EB-03, EB-12 | V1 supported estimates and tested usefulness — 016/020/021 |

## Acceptance packets

All complete-capability checkboxes remain open. Existing foundations are reused, not relabeled as absent. The V1 disposition above selects bounded sprint deliverables without falsely closing the broader EB capability. For each selected packet, create or reuse one narrow implementation issue under #302, with an explicit slice and its prerequisite evidence. ROADMAP determines when it becomes active.

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

**Selected bounded slice — 2026-10-14 / [#336](https://github.com/Kajooja/Kajo/issues/336):**
a portable numeric-answer-sensitive sequential Taste reference with recognition-only
control, pre-answer forecast commitments, same-prefix ordinal evaluation and
provisional per-domain readiness. Architecture sections 30, 32, 33 and 40–42;
EB-03 supplies its evaluation lineage. This does not close EB-03/EB-08 or activate
a native model. STATUS owns source/native progression; ROADMAP 15.0 owns release
placement. Persistent scoring/projection/erasure and mobile consumption follow
reference conformance.

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
