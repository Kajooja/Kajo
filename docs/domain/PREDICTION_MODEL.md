# Kajo Prediction Nervous System

Status: canonical **Kajo-domain** serving, memory, learning and evolution contract. Implemented behavior and required targets are distinguished below; exact acceptance is in [STATUS](../project/STATUS.md).

The independent reusable 51-part target architecture is [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md). [ADR-0008](../architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md) refines the boundary on 2026-09-12: Kajo is the first DomainAdapter, not the definition of the core. External research data/artifacts are governed by [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md). Existing SQL semantics below are retained rather than silently replaced by the target design.

## 1. Thesis

Kajo predicts the next experience that is likely to fit a `Profile` **in the current situation**. It does not build isolated “book taste” and “movie taste” systems.

A language model predicts a useful next token from an ordered context. Kajo's long-term direction is analogous:

```text
ordered behavior history
+ current HumanState
+ current Context
+ available Items
+ DiscoveryMode
-------------------------
next useful experience
```

The analogy concerns sequence modeling, shared representations, memory retrieval and outcome learning. Kajo is not a chat model, and a general-purpose LLM is not automatically a reliable recommender.

## 2. Non-negotiable invariants

- Prediction targets `Profile`, never User directly.
- The acting `User` remains separately traceable.
- `PersonalProfile` and `SharedProfile` memories are distinct.
- `SharedProfile` is learned joint state, not an average of member lists.
- `Item` and the prediction boundary remain cross-domain and provider-neutral.
- Event evidence is append-only; current state and memory summaries are rebuildable projections.
- A Prediction intended for learning records the complete candidate/slate trace and model/policy versions.
- Exposure, engagement, preference, consumption and delayed satisfaction are different evidence classes.
- Dwell is not equivalent to satisfaction.
- Memory is evidence with age and confidence, not permanent identity.
- Evolution never mutates the production champion without evaluation, rollout gates and rollback.
- Restricted provider metadata is not used for ML/AI training without the necessary licence.
- External observed research records and synthetic hypotheses never masquerade as native Kajo Events or complete observed Scenarios.
- Original predictions are frozen historical records; rebuilding derived intelligence cannot rewrite what was predicted before an outcome.

## 3. The complete loop

```mermaid
flowchart TD
  A["Observe Events"] --> B["Update memory projections"]
  B --> C["Build Prediction context"]
  C --> D["Retrieve candidates + Scenarios"]
  D --> E["Score and choose slate"]
  E --> F["Persist PredictionRun"]
  F --> G["Deliver and observe exposure"]
  G --> H["Attribute actions and outcomes"]
  H --> I["Evaluate champion/challengers"]
  I --> J["Promote, keep or roll back"]
  J --> B
```

The online loop updates state and serves rankings. The offline loop evaluates and evolves predictors. They share versioned evidence but remain operationally separate. The complete generic architecture additionally separates outcome/world modeling, policy choice, synthetic dreaming and artifact admission; their presence in the design does not imply all are implemented.

## 4. Memory hierarchy

### 4.1 WorkingState — active working memory

Purpose: represent what is happening inside the current session without pretending it is lasting taste.

Evidence:

- active `sessionId`, Profile and actor,
- current ItemType/surface,
- recent impressions, opens and explicit actions in sequence order,
- current DiscoveryMode and mode changes,
- current search/query constraints when implemented through MVP-DISC-009,
- session depth and time since the last action.

Lifetime: session-scoped; a new session starts after an intentional app/session boundary or prolonged inactivity. It can be reconstructed from Events and should not require model retraining.

Example: three quick comedy skips followed by two long thriller detail views may change this session's candidate mix without rewriting the Profile's enduring identity.

### 4.2 ShortTermState — lähimuisti

Purpose: capture intent, mood-like drift and temporary interests across sessions.

MVP V1 basis:

- recent window: 14 days,
- primary exponential time scale: 7 days,
- explicit actions dominate passive observations,
- positive and negative tag evidence are retained separately,
- cross-domain evidence is allowed when features share meaning.

The required MVP-ALG-004 multi-scale representation should preserve approximately session, week and month summaries rather than one arbitrary cutoff. The time scales are feature versions, not hard-coded truths.

Update behavior:

- explicit feedback affects it immediately,
- weak passive evidence needs repetition,
- contradictory newer evidence can reverse it quickly,
- inactivity decays it toward neutral.

### 4.3 LongTermState — kaukomuisti

Purpose: represent slowly changing, durable tendencies: novelty appetite, pacing, complexity, emotional intensity, darkness/lightness, familiarity, experimental preference and other learned latent dimensions.

MVP V1 basis:

- exponential long-term time scale centered on 180 days,
- top positive and negative tag evidence,
- confidence derived from independent/repeated evidence,
- explicit ratings and consumption outcomes carry more weight than opens.

LongTermState is not an immutable label. It must support:

- gradual drift,
- confidence reduction after inactivity,
- contradiction and reversal,
- provenance back to supporting Events,
- separate Personal and Shared state.

Cold-start onboarding and imported histories initialize priors. Their influence must fall as native Kajo behavior accumulates.

### 4.4 ScenarioMemory — episodic memory

A `Scenario` answers:

> When a Profile in a state like this faced options like these under this context and policy, what happened next and how good was the eventual outcome?

Conceptual shape:

```text
STATE
  Profile type + WorkingState + ShortTermState + LongTermState

CONTEXT
  time bucket + weekday/weekend + domain + surface + DiscoveryMode

DECISION
  candidate pool + returned order + scores + confidence + policy/model versions

OBSERVATION
  meaningful impressions + opens + dwell + actions

OUTCOME
  not interested / save / list / endorsement / consumption / rating / later reversal
```

#### Scenario retrieval

MVP V1 retrieves at most 30 same-Profile historical episodes. Similarity combines:

| Component | V1 share | Meaning |
|---|---:|---|
| HumanState overlap | 40% | overlap of positive/negative short- and long-term tag summaries |
| candidate/Item overlap | 35% | generic Item tag Jaccard similarity; exact same Item has a high floor |
| DiscoveryMode | 15% | exact mode is closest; FOR_YOU↔RISK is furthest |
| temporal Context | 10% | local-hour proximity and weekend/weekday match |

Cross-domain retrieval is allowed with a modest penalty. A book episode can therefore help a movie only through shared features, not merely because both are popular.

Retrieval applies a 180-day recency decay and a minimum similarity threshold. Scenario influence is confidence-shrunk when support is sparse. This allows useful one-shot evidence without letting one accidental action dominate indefinitely.

#### Outcome precedence

One episode may produce several Events. V1 selects the strongest available outcome for `(predictionId, itemId)`:

1. rating,
2. consumption reversal,
3. not interested,
4. consumed,
5. list addition,
6. endorsement/like,
7. saved/unsaved.

A later rating therefore replaces a weaker early save as the episode's main outcome. Undo Events exclude the reversed evidence. Dwell and open remain supporting observations, not terminal reward.

This is a V1 derived reward projection, not a claim that the underlying events are mutually exclusive. Future OutcomeModel heads must define their own horizons/conditioning and observability. Saving and later consuming may both occur.

#### Scenario score

For candidate (i):

\[
S_i = c(n) \cdot
\frac{\sum_{e \in topK} r_e\,sim(e,i)\,decay(e)}
     {\sum_{e \in topK} sim(e,i)\,decay(e)}
\]

where (r_e \in [-1,1]), (K=30), and (c(n)) shrinks low-support evidence. DiscoveryMode controls how strongly this signal affects the base score: highest in `FOR_YOU`, lower in `SURPRISE`, lowest in `RISK`.

### 4.5 PopulationMemory — semantic/collaborative memory

Purpose: learn patterns that no single Profile has enough evidence to learn alone.

**Native Kajo PopulationMemory** is post-MVP and blocked until consent, data volume, deletion lineage and minimum-cohort privacy gates exist. The external research prior in 4.6 is a separate input, not a waiver of this gate.

Future components:

- collaborative Item embeddings from co-occurrence and outcomes,
- Profile/Scenario clusters rather than exposed identities,
- cross-domain semantic Item space,
- Kajo-derived popularity/trend priors corrected for exposure bias,
- cold-start transfer,
- cohort and global scenario retrieval.

PopulationMemory never permits the mobile client to inspect other Profiles. Retrieval returns aggregated features/signals only. Sensitive/special-category inference is prohibited. Provider-owned aggregate popularity/trend metadata used by `ColdStartPrior` is not PopulationMemory because it is not derived from other Kajo Profiles.

### 4.6 ExternalTastePrior — independent research-derived input

ADR-0008 advances isolated public-data research into Phase 14.3A. An `ExternalTastePrior` is a separately versioned/licensed preference or object-representation artifact, not a Kajo user history, raw population lookup or complete observed Scenario.

[DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md) defines MovieLens-first normalization and evaluation, optional Tag Genome features and Beliefs analysis, namespace/time/label limits, rights lineage and artifact admission. External people never become native User/Profile/Event records. User-authorized own-history import in section 11 remains a different product path.

Before serving: demonstrate useful supported behavior, canonical Item mapping, compatible feature/encoder/model versions, bounded source/domain influence, no double-counted bootstrap, correct Shared boundaries and absence/withdrawal fallback. Model size or offline rating accuracy does not close native release gates. Native PopulationMemory and later latent/world/dream generations retain their independent acceptance.

### 4.7 Full CurrentState and uncertainty — target refinement

The generic target composes existing memory with explicit `BeliefState`, `WorldState` and, for Shared subjects, `GroupState`. These are responsibility/contract refinements, not newly implemented tables. World trends/availability are not durable personal taste; missing context is not invented mood.

BeliefState reports estimate, support, uncertainty method and calibration status. Unsupported estimates remain unavailable. Existing V1 rank/confidence components must not be relabeled as calibrated probabilities. Section 20 maps these target concepts onto Kajo without changing the accepted scorer in this documentation delivery.

## 5. Prediction trace: the system's causal spine

Here “causal spine” means traceable decision/observation provenance, **not** proof of causal intervention effects. Full alternatives and exposure improve evaluation, but do not reveal reactions to unseen actions or remove selection bias by themselves.

### PredictionRun

One hosted request records internally:

```text
predictionId
actorUserId
profileId
sessionId?
requestedAt
requestedItemType?
DiscoveryMode
bounded Context
MemoryStateSnapshot
modelVersion
baseModelVersion
policyVersion
experimentKey?
candidateCount
resultCount
```

### PredictionCandidate

Every considered candidate records:

```text
predictionId + itemId
sourceRank + sourceScore
finalRank + finalScore
confidence
scenarioScore + support + maxSimilarity
selectedForDelivery
selectionProbability?     # required when a stochastic policy is introduced
inspectable explanation
```

`selectedForDelivery` is not proof of exposure. `ITEM_IMPRESSION` is emitted only when the UI's visibility threshold is met. This distinction prevents unseen lower-screen cards from being treated as rejections.

For `resurfacing-v1`, the internal explanation also records the candidate's resurfacing classification, eligibility, reason, save age and reminder-history counters. A suppressed Item may remain in the internal candidate trace for evaluation/debugging while `selectedForDelivery=false`; Lists and history remain independent read surfaces and are not filtered by discovery eligibility.

For `shared-common-fit-v1.1`, a Shared candidate explanation also records only safe aggregate fields: accepted-member count/coverage, aggregate mean/minimum fit, consensus component, disagreement range/penalty, neutral prior, direct Shared-evidence count and final common-fit contribution. Raw Personal histories, member User IDs and PersonalProfile IDs are never written into the Shared candidate explanation.

### Why full slates matter

Without alternatives, “B was selected” is only a positive pair. With the trace, Kajo can study B relative to A/C/D, which model placed it second, which cards were actually visible and whether the later rating supported the choice. An unexposed alternative is not an observed rejection.

## 6. Context contract

V1 stores an allowlisted Context only:

- server request time,
- locale and timezone,
- local hour,
- day of week,
- discovery surface,
- session correlation.

It does **not** collect raw touch coordinates, contact lists, microphone/camera content, advertising IDs, precise location or background sensor data.

Future Context fields require all of:

1. a product use case,
2. predictive/evaluation hypothesis,
3. legal basis and permission where required,
4. canonical schema and retention rule,
5. ablation evidence that the signal provides value.

User-entered situational intent such as “together”, available time or desired mood is preferable to covert inference when the user experience can ask naturally.

## 7. Evidence and reward model

### Evidence classes

| Class | Examples | Use |
|---|---|---|
| Exposure | impression, rank, surface | denominator and bias correction |
| Attention | open, meaningful dwell | weak intent/context evidence |
| Preference | rating, not interested, list, save, endorsement | direct taste/decision evidence |
| Consumption | watched/read/attended, reversal | actual experience |
| Delayed outcome | rating after consumption, repeat choice, later removal | satisfaction/correction |
| System | model/policy/version/experiment | reproducibility and evaluation |

### MVP V1 scalar outcome

The first scenario reward is deliberately bounded and inspectable:

| Outcome | Reward |
|---|---:|
| rating 0…10 | linearly −1…+1 around neutral 5 |
| not interested | −1.00 |
| consumption reversed | −0.60 |
| consumed without rating | +0.40 |
| added to custom List | +0.65 |
| Shared Endorsement | +0.60 |
| Personal like | +0.60 |
| saved | +0.50 |
| unsaved | −0.35 |

These are V1 hypotheses, not permanent product truth. Each future reward formula gets a version and is evaluated against delayed ratings/consumption, not tuned only to increase taps.

### Multi-objective target

The EvolutionEngine must eventually optimize a vector, not one engagement number:

- expected post-consumption satisfaction,
- successful choice/consumption rate,
- long-term return and trust,
- novelty/serendipity when requested,
- catalog/provider diversity and calibration,
- SharedProfile minimum-member fit and disagreement,
- low fatigue/repetition,
- latency, failure rate and cost,
- privacy/fairness guardrails.

An Item that keeps a user staring because it is confusing must not beat an Item they quickly choose and later rate highly.

## 8. Candidate generation, ranking and policy

The long-term online pipeline has separate responsibilities:

1. **Eligibility:** remove unavailable, blocked, already consumed/suppressed and unauthorized Items.
2. **Candidate generation:** union content similarity, collaborative retrieval, ScenarioMemory neighbors, popularity/cold-start and exploration candidates.
3. **Feature assembly:** Working/Short/Long state, Context, Item, Scenario, Shared common-fit and uncertainty.
4. **Base ranking:** estimate outcomes per candidate.
5. **Policy/slate building:** apply DiscoveryMode, diversity, novelty, fatigue and exploration constraints.
6. **Trace write:** persist candidate pool, versions and final selection.
7. **Delivery overlay:** apply pending Endorsement/member-history collaboration semantics without creating another taste model.

MVP V1 combines steps 2–5 inside PostgreSQL because the catalog and event volume are small. A later service may replace a component/transport without changing the conceptual contract. ADR-0008 does not mandate Python/FastAPI or a network service: start with executable generic contracts and parity-tested extraction.

### 8.1 Reacted-Item resurfacing policy — `resurfacing-v1`

Normal discovery must not repeatedly spend slate capacity on Items for which the same Profile has already given a strong/terminal reaction. This is a serving policy, not deletion of evidence or List/history state.

MVP `resurfacing-v1` rules are:

- consumed/read/watched, rated and `not interested` Items are terminally suppressed from normal discovery,
- a saved-only Item is normally suppressed while it is still recent,
- a saved-only Item may become one reminder candidate after it has remained saved, unconsumed and unrated for at least **30 days**,
- a reminder is suppressed for **30 days** after an actually logged reminder impression,
- a saved Item may receive at most **2 reminder impressions in a rolling 90-day window**,
- at most **1 saved reminder** may be eligible in one Prediction candidate pool,
- ordinary eligible candidates rank ahead of the reminder; the reminder ranks ahead of suppressed candidates,
- suppressed candidates may stay in the complete internal trace but can never be `selectedForDelivery=true`,
- all decisions are Profile-scoped; PersonalProfile and SharedProfile state/reminder history do not cross,
- explicit Lists/Saved/history views remain unaffected by discovery suppression.

The thresholds are versioned hypotheses, not permanent truth. A future policy version may tune age/cooldown/frequency through measured outcomes, but a PredictorGenome cannot bypass hard authorization or terminal-consumption/suppression invariants. Personal `PredictionRun.policyVersion` records `scenario-memory-v1+resurfacing-v1`; Shared v1.1 appends `+shared-common-fit-v1.1`. `PredictionCandidate.explanation.resurfacingPolicy` makes the resurfacing decision reconstructable.

## 9. DiscoveryMode policy

### FOR_YOU

- maximize expected fit,
- prefer confidence,
- use ScenarioMemory most strongly,
- low but non-zero exploration.

### SURPRISE

- preserve meaningful expected fit,
- increase novelty and indirect cross-domain relations,
- accept moderate uncertainty,
- scenario evidence guides but does not narrow the slate.

### RISK

- deliberately accept high uncertainty/variance,
- surface possible exceptional fits and clear misses,
- use ScenarioMemory as a weak guardrail rather than an exploitation rule,
- retain safety/availability/consumed constraints.

`AmbientPhase` remains presentation only. Policy objectives above are not evidence that V1 has calibrated uncertainty or stochastic propensities; later changes require measured targets and versioned controls.

## 10. SharedProfile model

A SharedProfile remains one Prediction target. Kajo must not rank separately for each member and merely interleave lists.

### MVP common-fit — `shared-common-fit-v1.1`

The hosted MVP composition is:

```text
existing Shared joint/base score
+ existing Shared ScenarioMemory
+ sparse neutral ColdStartPrior
+ aggregate accepted-member Personal fit
+ minimum-member / consensus term
- disagreement penalty
= final Shared Prediction V1 score
```

Member Personal evidence stays Personal. Accepted members are resolved through canonical membership; their Personal memory summaries are read inside the private serving boundary. Imported/calibration evidence may influence Personal LongTermState, native recent behaviour may influence Personal ShortTermState, but no Personal Event/bootstrap row or Personal Scenario is copied into Shared history.

For each member, the candidate fit is built from LongTerm and native ShortTerm tag overlap and then reliability-shrunk toward the neutral `ColdStartPrior` when evidence is sparse. At Shared level:

- mean/minimum fit above the neutral prior may lift the candidate,
- common agreement above the prior creates a consensus component,
- member-fit range creates a bounded disagreement penalty,
- the neutral prior contribution is strongest for a sparse SharedProfile and decays as direct Shared evidence accumulates,
- existing Shared Working/Short/Long state and same-Profile ScenarioMemory remain first-class independent inputs.

The v1.1 common-fit contribution is deliberately bounded relative to the existing V1 score scale. It is a versioned MVP hypothesis and must be calibrated against delayed Shared outcomes rather than treated as a permanent formula.

Inspectable aggregate outputs:

- accepted member count and evidence coverage,
- aggregate mean and minimum member fit,
- consensus delta/component,
- disagreement range/penalty,
- neutral prior source/version/component,
- direct Shared evidence count,
- final common-fit contribution.

Privacy/authorization invariants:

- only accepted members can request the Shared Prediction through the existing Profile authorization boundary,
- private common-fit helpers are not executable by authenticated/anon clients,
- Shared candidate explanations never contain another member's User ID, PersonalProfile ID, raw tags or raw Event/bootstrap history,
- PersonalProfile Prediction is explicit no-op for common-fit and preserves the old Personal policy/version,
- there is no second Shared recommender and no PopulationMemory shortcut.

Current Shared policy version is `scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1`. Personal remains `scenario-memory-v1+resurfacing-v1`.

### Current collaboration delivery

```text
SharedProfile ranking
+ pending Endorsements from other members
- Items already endorsed by current actor
+ lower attributed member-history tier
= actor-visible queue
```

Pending collaboration priority is not actor-specific taste modeling. Personal Events are not copied into Shared Event history.

### Shared consensus

One Endorsement does not set Shared Saved state. Unanimity among currently accepted members produces durable SharedConsensus, system Saved state and the chosen custom List membership. Later membership changes do not revoke reached historical consensus.

That paragraph describes the accepted-main single-destination baseline. The
#229 successor records/reviews an exact destination set and atomically commits
all approved memberships; DATA_EVENTS owns its evidence contract. Source merge,
recorded hosted rollout and device acceptance are separately tracked in STATUS.

### Required Shared rating-round and rewatch successor — #232

`MVP-SOCIAL-007..009` is required first-release behavior. Personal Taste/setup
precedes the joint flow. A SharedRatingRound freezes intended accepted
participants, retains each person's 0–10 response and disagreement, and completes
joint history only after all required responses. Pending, unknown and
not-yet-watched responses are not completed joint rewards; round completion alone
is not success. Legacy one-actor joint history cannot gain invented confirmation.

Personal consumption is not Shared consumption. Strong authorized member/joint
fit may admit member-seen Items under a new tested policy; a later explicit joint
rewatch creates a new round with earlier history intact. Define cooldown,
frequency/candidate bounds and reasons before activation rather than borrowing
saved-reminder constants or deleting terminal history. Preserve not-interest,
access and availability constraints. No private Personal Prediction is copied.

Phase 14 establishes participant/round evidence, pending/completed/corrected
outcomes and shared serving/shadow eligibility. Phase 16.3 delivers the complete
UI/server flow. Test pairs/N members, zero/disagreement, cancellation/edits,
concurrent completion, membership changes, legacy history and separate rewatch
rounds with Personal/Shared isolation. DOMAIN_MODEL and DATA_EVENTS own entities
and command semantics; ROADMAP owns dependency order.

## 11. Cold start and external history

A sparse Profile must not start from random Items or from fabricated demographic certainty. MVP bootstrap has two explicit PersonalProfile paths:

1. user-authorized external history import when the user has it,
2. otherwise a bounded real-catalog profiling pass.

If imported/native strong evidence is already sufficient, the profiling gate is skipped. If the user opens import but returns without enough evidence, the profiling gate returns.

### `ColdStartPrior` — `cold-start-prior-v1`

The profiling candidate slate is ordered by a versioned non-personal Item prior:

1. provider/catalog trend or popularity when available,
2. provider/catalog recognition when available,
3. an explicit recognition-only fallback for the temporary curated beta catalog,
4. only a weak freshness component.

The curated beta fallback must never be labelled as live trend data. Provider aggregate popularity/trend is catalog metadata and may be used in MVP. A trend derived from aggregate Kajo Profile behaviour is different: that is future privacy-gated `PopulationMemory` and requires minimum-cohort, consent/deletion-lineage and exposure-bias controls before it may influence cold start.

### Bounded no-import profiling

MVP `cold-start-v1` rules:

- PersonalProfile only,
- minimum completion target: **6 ratings of known Items**,
- show **12 high-prior real Items first** across BOOK/MOVIE,
- unknown Items may be skipped without creating negative evidence,
- if fewer than 6 known Items are found, extend the same deterministic slate up to **24 Items**,
- completion is allowed immediately once 6 ratings exist; the user is never required to rate all 12/24,
- if the bounded maximum/catalog availability still cannot yield six known Items, fail open instead of trapping the user,
- `KAJO_MOCK` is never eligible,
- image availability is presentation enrichment, not calibration eligibility,
- no demographic fields are required.

Calibration responses persist as source-tagged `KAJO_CALIBRATION` bootstrap evidence. They initialize `LongTermState` only; they are not native Kajo Events and do not enter WorkingState, ShortTermState or ScenarioMemory. Native Kajo behaviour then progressively supersedes the bootstrap signal.

Preferred import paths:

- Letterboxd export ZIP/CSV,
- IMDb ratings/list CSV,
- Goodreads/StoryGraph-style user exports,
- documented generic Kajo CSV fallback.

Imports are user-initiated; Kajo does not scrape accounts or depend on unofficial login automation. Imported ratings map to canonical rating/consumed evidence with source/import provenance and mapping confidence. Uncertain Item matches require review or exclusion. Imported Personal evidence is never copied into SharedProfile history.

### Bootstrap serving implementation — #207 / PR #210

The forward correction versions the extended base as `prediction-v0.4-bootstrap`; V1 persists that base version and retains its existing policy/scenario/common-fit behavior. Candidate explanations add `bootstrapServingVersion=bootstrap-serving-v1` and `bootstrapLongTerm`; the latter is already included in `longTerm`, not an extra amount to add again. Memory snapshots retain the bootstrap serving version as well.

Memory and serving reuse the same strongest-active-per-Item bootstrap selection, canonical evidence weights and bootstrap age decay. Bootstrap contributes only to LongTerm, never native ShortTerm or native confidence. Authorized Shared common-fit still reads Personal memory summaries; Shared base does not consume copied Personal bootstrap rows. Removing/replacing a source recomputes current influence; the mobile success boundary invalidates mounted ranking requests.

This scoped correction preserves the existing bootstrap decay floor and native baseline controls. It does not complete source-aware forgetting/support (ALG-004), full serving/shadow equivalence (ALG-002), immutable historical source replay, provider feature normalization or statistical recommendation-quality acceptance. PR #210 merged the correction and recorded bounded hosted public V1 smoke evidence; PR #219 added public V1 runtime checks on independent isolated Supabase installations. The later #223 checkpoint accepts the adopted fresh-install technical gate; unchanged historical chronological replay and the configured-device/first-session quality gates remain separate. See [STATUS.md](../project/STATUS.md) rather than treating the old “#207 pending” heading as current work.

## 12. Representation roadmap: what Kajo borrows from modern systems

### Consumer products and market patterns

Kajo does not copy one competitor wholesale. It combines proven patterns while keeping its own Context + alternatives + Outcome dataset as the differentiator:

| Product/pattern | Borrow | Do not copy as the core |
|---|---|---|
| Qloo / TasteDive | cross-domain taste space and transfer between cultural domains | an opaque third-party taste graph as Kajo's only memory or moat |
| Criticker | an understandable predicted personal score and evaluation against later ratings | only same-taste-user correlation without current Context or exposure trace |
| StoryGraph | explicit mood, pace and preference controls that improve cold start and situational intent | a fixed book-only taxonomy as the universal Item model |
| JustWatch | availability/provider filtering as an eligibility step before ranking | treating availability or popularity as evidence of taste |
| Letterboxd / IMDb | user-initiated history/rating imports that collapse cold start | scraping, credential handling or dependence on an unavailable consumer OAuth path |
| Spotify / Netflix | multi-timescale sequence representations, contextual ranking and controlled experimentation | engagement-only optimization or an unmeasured large model in the serving path |

Kajo's market-level distinction is therefore not “AI recommends media”. It is the reconstructable tuple:

```text
Profile × current Context × alternatives × exposure × behavior × delayed Outcome × time
```

That tuple supports situational prediction, SharedProfile fit and auditable evolution in a way that a static rating graph alone does not.

### Multi-timescale user representation

Spotify's production research separates enduring and fast-changing preferences and aggregates behavior over several time scales. Kajo adopts the same architectural principle through Working, ShortTerm and LongTerm state, while retaining Profile and Shared semantics.

### Ordered sequence modeling

Google's Transformer music-ranking work and Meta's HSTU/generative recommender research treat actions as an ordered sequence rather than an unordered ratings bag. Kajo first records correct sequences and traces; a sequential model is useful only after this dataset exists.

### Semantic IDs and a common Item space

Generative retrieval represents Items as learned discrete semantic codes. This is attractive for cross-domain search/recommendation and cold-start generalization, but Kajo should introduce semantic IDs only after licensed Item embeddings and evaluation data exist. Atomic canonical `itemId` remains the database identity.

### LLM-backed ranking

Netflix's 2026 GenRec work shows the potential of verbalized histories/context plus an LLM-backed ranker, and LinkedIn's 360Brew explores one decoder model across many ranking tasks. Kajo may later compare this approach against compact sequential rankers. It must remain a challenger until latency, cost, privacy and online outcomes win.

### Hierarchical LLM memory

MemGPT and later episodic-memory research separate bounded working context from long-term storage and retrieval. Kajo adopts the hierarchy, consolidation and selective retrieval pattern. It does not copy free-form self-authored memories into truth; Kajo's memory is grounded in structured Events and outcomes.

### Contextual bandits

Spotify's contextual-bandit work demonstrates context-dependent content mix and separates personalization from experimentation. Kajo follows that separation. A bandit may later choose policy/slate parameters, but A/B infrastructure evaluates the complete personalization system.

These earlier research directions are preserved, not newly admitted components. The bounded external-preference experiment can begin before native sequential/world-model data is sufficient; its claims remain limited to its actual task and evidence.

## 13. SleepLayer and EvolutionEngine

### 13.1 Exact meaning of the SleepLayer

The `SleepLayer` is Kajo's background imagination and consolidation loop. It asks:

> The Champion served this prediction. With exactly the information available at that moment, what would other weightings or model families have predicted, and which one repeatedly aligns better with the eventual real Outcome?

It does not wait for a person's literal sleep. It runs asynchronously after prediction requests and in scheduled consolidation/evaluation jobs. It never changes the currently visible slate during shadow evaluation.

Example:

```text
Production Champion G0:
  long-term 0.45, short-term 0.25, scenario 0.15, novelty 0.15
  measured eligible success: 70%

Shadow Challenger G1:
  long-term 0.30, short-term 0.40, scenario 0.20, novelty 0.10
  frozen shadow choices evaluated against the same later Outcomes: 74%

Decision:
  not “74 > 70, deploy immediately”
  but “does G1 win with enough evidence, coverage and guardrail quality
  globally, for a cohort, or for this Profile?”
```

The percentages above are illustrative, not measured Kajo results.

### 13.2 Two valid shadow mechanisms

#### Prospective ShadowPrediction — preferred evidence

At production Prediction time:

1. freeze the same `MemoryStateSnapshot`, Context, eligibility rules and candidate pool used by the Champion,
2. persist the Champion result,
3. queue several Challengers,
4. calculate and persist each `ShadowPrediction` without delivering it,
5. wait until the outcome window matures,
6. score Champion and Challengers against the same observable Outcomes.

Prospective shadowing prevents later observations from entering the frozen input, provided model/preprocessing/artifact versions also obey the evaluation cutoff.

#### Historical as-of replay — useful but stricter

A scheduled job can replay old PredictionRuns only when it reconstructs every feature with an `asOf <= prediction.requestedAt` boundary. Current-state tables cannot be read during replay because they may contain future information. Unknown historical availability, missing candidate pools or unversioned feature logic make an episode ineligible rather than guessed.

Occurrence time alone is insufficient when a record became available later. Preserve recorded/available timestamps, artifact training cutoffs and correction history. Distinguish actual deployed-model replay from a retrospectively simulated challenger experiment.

### 13.3 The counterfactual limit

A ShadowPrediction does not reveal how the user would have reacted to an Item they never saw. Therefore Kajo must never count an unexposed shadow top-1 Item as a confirmed hit or miss.

Early valid comparisons are:

- pairwise/order quality among candidates that were meaningfully exposed,
- predicted probability/calibration for exposed candidates where supported labels exist,
- agreement with the selected/consumed/rated Item when it existed in both comparable slates,
- coverage: how much of the evaluation set could be judged without invention.

Later bias-corrected comparison requires controlled exploration, truthful logging probabilities appropriate to the actual action/slate and support/overlap assumptions. IPS, SNIPS or doubly robust estimators are not automatically valid merely because a field named propensity exists. Online A/B evidence remains the promotion authority.

### 13.4 PredictorGenome

A genome is immutable configuration plus referenced artifacts:

```text
genomeId
parentGenomeIds[]
createdAt + codeCommit
featureVersion + memoryVersion
outcomeVersion + rewardVersion
candidateGenerators + quotas
modelFamily + modelArtifactVersion
long/short/session decay parameters
scenario K/threshold/component weights/decay
base signal weights
DiscoveryMode policy parameters
novelty/diversity/fatigue weights
Shared common-fit/disagreement parameters
random seed
validity constraints
```

Weights are normalized and constrained. A genome cannot disable authorization, eligibility, privacy, trace writing or hard suppression rules. Neural model weights are referenced as immutable artifacts rather than copied into relational rows. External training, encoder/index compatibility, permission and split lineage extend this manifest when such artifacts exist; they are not inferred from a model name.

### 13.5 How Challengers are created

The SleepLayer maintains diversity without brute-forcing an unlimited parameter space:

1. **local mutation:** small changes around the current Champion,
2. **directed mutation:** change the component associated with a measured weakness, such as stale ShortTerm response,
3. **crossover:** combine compatible, previously strong parent configurations,
4. **random exploration:** a small bounded share prevents permanent local optimum,
5. **new family:** explicit challengers such as gradient ranker, sequential Transformer or LLM-backed ranker,
6. **pruning:** remove dominated, duplicate, unstable or too-expensive genomes.

Initial MVP/post-MVP serving-oriented SleepLayer should mutate only transparent scalar weights/decays over a fixed candidate pool. Learned serving models enter after the evidence/evaluation framework is trustworthy. Isolated external-preference research under ADR-0008 may begin in Phase 14.3A; it is not an automatic serving-model switch.

### 13.6 Global, cohort and Profile-specific evolution

One genome does not have to be best for everyone. `PolicyAssignment` resolution is hierarchical:

```text
valid Profile Champion
  else valid cohort Champion
    else global Champion
```

- **Global Champion:** strongest general fallback and cold-start policy.
- **Cohort Champion:** optional behavior-derived group policy when the cohort is large, stable and privacy-safe. It must not be a sensitive demographic class.
- **Profile Champion:** genome repeatedly better for this exact PersonalProfile or SharedProfile.

A Profile assignment changes only that Profile's policy. A SharedProfile earns its own evidence and never inherits a member's Personal Champion automatically.

Sparse personal evidence is regularized toward broader evidence. Conceptually:

\[
reliability_{profile} = \frac{n_{effective}}{n_{effective} + k}
\]

The personal advantage must be larger when (n_{effective}) is small. If evidence decays, behavior drifts or the Profile Champion becomes invalid, assignment falls back safely to cohort/global.

### 13.7 EvaluationWindow and maturity

Every comparison fixes:

- input cutoff,
- genome/code/feature versions,
- eligible PredictionRuns,
- fast outcome window,
- mature/delayed outcome window,
- minimum exposure and coverage,
- metric definitions,
- tested scopes,
- statistical decision rule.

Suggested windows to validate with real data:

- fast intent: 24 hours after Prediction,
- mature movie outcome: 14 days,
- mature book outcome: 30–60 days,
- long-term trust/return: rolling 30–90 days.

The same episode can be provisional first and mature later. Promotion never mixes incomplete Challenger windows with mature Champion windows. Censored/unobservable outcomes remain separate from observed negatives.

### 13.8 What “70% accuracy” means

Kajo must always name the metric and eligible denominator. Acceptable examples:

- `positiveOutcome@K` among meaningfully exposed predictions,
- `consumedOrRatedPositive@K` within a mature window,
- pairwise winner accuracy on comparable exposed candidates,
- rating probability calibration,
- expected multi-objective utility.

Raw click-through or “the chosen Item was somewhere in the list” is not sufficient. Every reported percentage includes sample count, Profile count, coverage, confidence/credible interval and window.

### 13.9 Initial promotion policy

Automatic promotion remains **disabled in MVP 0.1**. The SleepLayer can collect/replay evidence and recommend a decision; the product owner explicitly approves the first promotions.

Initial research thresholds, to be calibrated rather than treated as universal truth:

| Scope | Minimum evidence | Required advantage | Decision confidence | Online gate |
|---|---:|---:|---:|---|
| Global | 2,000 mature eligible Outcomes across 200 Profiles | ≥2% primary utility | ≥95% probability Challenger is better | shadow + canary + A/B |
| Cohort | 500 Outcomes across 100 Profiles | ≥3% | ≥95% | shadow + scoped A/B |
| Profile | 30 mature Outcomes over ≥14 days | ≥5% | ≥90% with global shrinkage | reversible personal canary |

These are starting research safety hypotheses, not measured power guarantees or automatically sufficient evidence. For rare but high-value outcomes, an explicit statistical design, effect size and uncertainty matter more than blindly waiting for one fixed count.

### 13.10 Promotion state machine

```text
DRAFT
  -> OFFLINE_VALIDATED
  -> SHADOW
  -> CANDIDATE
  -> CANARY
  -> EXPERIMENT
  -> CHAMPION
  -> RETIRED

Any active state -> REJECTED
CANARY / EXPERIMENT / CHAMPION -> ROLLED_BACK
```

Promotion records the approving mechanism/person, evidence window, metrics, guardrails, effective scope/time and rollback assignment. Assignment changes are append-only/versioned; the current assignment is a projection. External-artifact rights admission and model-quality promotion are both required when applicable; neither substitutes for the other.

### 13.11 Multi-objective comparison

Challengers are compared on a Pareto frontier before a scalar tie-breaker. A candidate that gains clicks but harms delayed ratings, diversity or Shared fairness is dominated or rejected.

Primary objectives:

- delayed satisfaction and successful consumption,
- calibrated fit/uncertainty,
- mode-appropriate novelty,
- long-term return/trust.

Hard guardrails:

- authorization/privacy correctness,
- no Personal/Shared evidence leakage,
- catalog/provider concentration,
- repetition/fatigue,
- Shared minimum-member outcome,
- latency, errors and cost,
- trace/evaluation completeness.

### 13.12 Memory consolidation during sleep

The owner's dream/subconscious/DNA metaphor and complete later generations are retained in [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md) and [FUTURE_PLAN.md](../product/FUTURE_PLAN.md#14-fut-alg-002--evidence-gated-evolutionengine-expansion--planned--conditional). A winning dream changes a validated PredictorGenome/PolicyAssignment; imagined Outcomes never become real Events or historical Scenarios. Consolidation updates derived memory only with traceable real evidence. Compact genome/artifact references may reduce storage, but they do not replace the retained exposure/candidate evidence needed for valid evaluation. On-device scoring remains a research proposal requiring a later ADR, not an extension silently enabled by this metaphor.

The SleepLayer also consolidates memory without rewriting evidence:

- decays or expires Working/ShortTerm projections,
- promotes repeatedly confirmed patterns toward LongTermState,
- lowers confidence for contradicted/stale patterns,
- clusters redundant Scenarios and keeps representative/provenance links,
- refreshes embeddings/ANN indexes after versioned training,
- detects drift and schedules re-evaluation,
- rebuilds projections after feature/reward changes.

Original Events, PredictionRuns, ShadowPredictions and Outcomes remain distinct historical evidence under their retention/deletion lifecycle. Consolidated memories are versioned derivatives. Error-driven synthetic experiments retain representative real controls and may not validate themselves.

### 13.13 SleepLayer data model

```text
PredictorGenome
ShadowPredictionRun
ShadowPredictionCandidate
EvaluationWindow
GenomeEvaluation
PolicyAssignment
PromotionDecision
ModelArtifact
```

The MVP foundation implements the listed relational artifacts except `ModelArtifact`. Required keys include source `predictionId`, `genomeId`, exact as-of timestamp, scope, code/feature/reward versions, eligibility reason, metric numerator/denominator, coverage and uncertainty. ModelArtifact is a planned contract until implementation/acceptance is recorded.

### 13.14 Evolution cycle

1. Freeze an EvaluationWindow and mature Outcomes.
2. Generate bounded Challengers from valid parent genomes.
3. Run deterministic/schema/privacy/latency tests.
4. Create prospective shadows and/or leakage-safe as-of replays.
5. Compute per-episode comparable evidence and coverage.
6. Aggregate global, eligible cohort and Profile evaluations.
7. Prune dominated/unstable/expensive genomes.
8. Move credible winners to shadow/candidate review.
9. Canary and A/B test the complete serving policy.
10. Promote explicitly or retain the Champion.
11. Monitor drift; roll back immediately on guardrail breach.

### 13.15 Avoiding feedback-loop collapse

- preserve appropriately controlled exploration traffic,
- log actual exposure and selection probability when stochastic,
- evaluate on time splits and holdout cohorts,
- address popularity/position bias with supported methods,
- cap per-Item/provider repetition,
- distinguish unavailable from rejected,
- reject hindsight-contaminated replay episodes,
- do not train on model-generated explanations as user truth,
- limit simultaneous genome comparisons/multiple-testing risk,
- keep a final test outside repeated evolutionary selection,
- monitor representation, outcome and assignment drift.

## 14. Evaluation framework

### Offline

- Recall@K and NDCG@K for known future positive outcomes,
- rating/error calibration and Brier/log loss where probabilities exist,
- coverage, intra-list diversity, novelty and catalog concentration,
- time-to-useful-choice proxy with exposure correctness,
- Shared minimum-member fit and disagreement calibration,
- cold-start, sparse-user and cross-domain slices,
- latency/cost/storage estimates,
- ablations for each memory layer.

Random train/test splits are forbidden for sequential behavior. Use chronological splits and prevent future state/outcome leakage throughout preprocessing, embeddings, prototypes and indexes. External evaluation additionally freezes global time boundaries and held-out subject prefixes; a per-user last-N split alone does not prevent cross-user future leakage. Declare candidate/relevance rules and distinguish unlabeled from known-negative examples.

### Online

- choice/consumption conversion from meaningful impressions,
- delayed rating and consumption success,
- not-interested, undo and removal rates,
- return/trust measures over longer windows,
- mode-specific discovery outcomes,
- Shared consensus rate plus both/member-level satisfaction,
- p50/p95/p99 latency and failure/fallback rate.

### ScenarioMemory-specific

- retrieval precision judged by future outcomes,
- support/similarity calibration,
- improvement over base scorer by evidence-count bucket,
- harmful nearest-neighbor rate,
- exact replay test from stored traces,
- no-evidence equivalence to base behavior,
- query-prefix leakage, authorization-before-retrieval and artifact-version compatibility tests.

### Resurfacing-specific

- reminder impressions and downstream positive/negative Outcomes by saved age,
- reminder cooldown/frequency-cap suppression counts,
- repeated-reacted Item rate in normal discovery,
- share of slates containing a saved reminder,
- later consumption/rating after a reminder versus comparable saved Items without a reminder, with causal claims only under an appropriate design,
- Profile-isolation and trace-completeness checks.

### Shared common-fit-specific

- aggregate minimum-member and mean-member outcome calibration,
- disagreement penalty versus later Shared consensus/rating outcomes,
- sparse-member shrinkage calibration,
- neutral-prior contribution by direct Shared evidence-count bucket,
- PersonalProfile no-op equivalence,
- member-history privacy/authorization regression tests,
- latency by accepted-member count.

## 15. Data quality and observability

Required monitoring:

- unexpected missing candidate trace, distinguished from a valid identified empty run,
- hosted impression with unknown prediction/candidate,
- action/outcome with mismatched Profile/actor/Item,
- impossible timestamps or negative dwell,
- duplicate Events after retry,
- outcome latency/maturity and unobservable coverage,
- fraction of fallback predictions,
- scenario support and influence distribution,
- resurfacing classification/reason distribution,
- Shared common-fit coverage/contribution/disagreement distribution,
- model/policy/artifact version traffic,
- feature/state drift,
- trace storage growth,
- external artifact absence/rights/coverage/compatibility failures when integrated.

Every material score/policy component remains available in internal explanation JSON during MVP development. User-facing explanations later use a safe, concise subset and never expose other members' private evidence.

## 16. Privacy, control and retention

Kajo uses privacy by design:

- pseudonymous internal UUIDs; no auth email in learning features,
- explicit allowlist for Context,
- no raw message text in Prediction by default,
- no special-category inference,
- per-Profile authorization and separation,
- user access/export/delete paths planned before external release,
- derived memories and prediction traces participate in account/Profile deletion,
- retention is purpose-specific, documented and reviewable,
- population datasets need deletion lineage and minimum cohort thresholds,
- external data/model/index dependencies retain rights and withdrawal/retraining lineage.

Data location, retention decisions, deletion propagation and recovery gates are canonical in [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#17-retentiondeletion). The earlier 13-month trace proposal is not an implemented retention guarantee. No raw evidence may be retained indefinitely by omission. Decay, storage deletion and removal of learned source influence are different operations.

## 17. MVP V1 implementation

At the inspected accepted-main baseline, `public.rank_items_v1` is the nervous-system serving boundary:

```text
private prediction-v0.4-bootstrap baseline candidate generator
  -> assigned-genome scalar policy reranker
  -> resurfacing-v1 eligibility/classification
  -> same-Profile ScenarioMemory scoring
  -> SharedProfile-only shared-common-fit-v1.1 aggregate scoring
  -> resurfacing-aware final slate ordering/delivery predicate
  -> immutable PredictionRun + complete PredictionCandidate trace
```

The baseline genome preserves its scalar policy controls; the current base includes the forward bootstrap correction from #207/PR #210. Earlier V0.3 descriptions are historical checkpoints. This version update does not establish serving/shadow equivalence. Challenger scalar weights and Scenario weight resolve from the versioned `PolicyAssignment`/`PredictorGenome`. Authenticated clients cannot execute V0, the private scalar scorer, SleepLayer worker/evaluator, common-fit private helpers or canary/rollback operations; mobile traffic enters through `public.rank_items_v1` only. Active #229 source/read-boundary evolution is separately tracked in STATUS and must not be silently described as merged/deployed.

The mobile request carries its Event `sessionId` and bounded time/surface Context. Item detail records meaningful, capped `ITEM_DWELL` evidence. Dwell is not included in V1 reward. Personal policy version is `scenario-memory-v1+resurfacing-v1`; Shared v1.1 appends `+shared-common-fit-v1.1`.

Known V1 limits:

- tag features are sparse/manual,
- Scenario retrieval is SQL scan-based and same-Profile only,
- Shared common-fit uses tag-summary fit rather than learned member/candidate embeddings,
- no learned embeddings or pgvector yet,
- no population retrieval,
- no stochastic propensity because V1 policy is deterministic,
- common-fit v1.1 coefficients are conservative hypotheses and require configured-device plus real Shared outcome calibration,
- Context includes time/surface but not explicit mood/available-time input,
- saved-reminder thresholds are first versioned heuristics and require real outcome calibration,
- the new portable contracts/external-data plan is not an implemented engine package or trained prior.

## 18. Required MVP algorithm completion contract

Status: **required target; partial implementation**. Historical V1 delivery does not prove newer acceptance gates. `MVP-ALG-001..009`, `MVP-DATA-003..004` and bounded `MVP-ENG-001..003` govern their respective scope. Technical bootstrap acceptance and all remaining gates are recorded in STATUS; sequencing is maintained only in [ROADMAP](../project/ROADMAP.md#phase-14--make-the-algorithm-trustworthy-and-the-engine-portable).

### One feature and policy definition

Serving, memory snapshots and SleepLayer must agree on source-tagged evidence and as-of time. Refactor through forward migrations, preserving the accepted public V1 serving boundary. Imported/calibration LongTerm evidence must contribute directly to unseen Personal ranking, even when no native Events or Scenarios exist. Removing a source rebuilds its derived contribution.

Reuse canonical feature calculation and pure scoring/policy helpers rather than independently reproducing formulas in baseline, snapshots, Shared fit and shadow. Eligibility and Shared collaboration delivery remain explicit policy, distinct from taste score, but both must be faithfully replayable. Freeze feature/schema/policy versions and candidate features at prediction time; current mutable catalog tags cannot silently replace historical features.

A baseline shadow must match Personal and Shared production eligibility, final order and selected Items exactly; declare score tolerance for rounding. Tests cover common-fit, reminder tiers, suppression, ties and empty/refilled pools. A score-only match is insufficient.

### Active #229 frozen replay, admission and page contracts

The following code exists on `feat/228-delivered-origin`; it remains separate from accepted-main runtime and hosted rollout. The server-page baseline `0a184a7` passed all five required CI #464 jobs. The subsequent captured-scope client source is described below; STATUS owns current head verification and the exact rollout preflight. Source acceptance does not establish hosted/device acceptance.

#### Frozen replay parity — prepared, not hosted

`20260910202244_frozen_prediction_replay.sql` shares pure private `prediction_candidate_score_v2` between serving and shadow. Candidate `scoringFeatures.version = prediction-features-v2` retains unrounded direct, LongTerm (including bootstrap), ShortTerm, novelty, exploration and both penalty inputs. V0 scopes `extra_float_digits=3` to its function so caller settings cannot erase binary precision; the caller setting is restored afterward. Rounded display fields and the accepted raw baseline formula remain compatible.

Scalar and Scenario weights use the same immutable genome recorded on the run. Final scoring adds the frozen raw Scenario score with that weight and the frozen aggregate Shared common-fit contribution; Personal common-fit remains zero. `resurfacingInput` is retained before the reminder cap. Serving and replay share `finalize_resurfacing_policy_v1` and `prediction_delivery_tier_v1`: ordinary eligible Items, then the one eligible reminder, then suppressed Items; scores descend within tiers and Item ID breaks exact ties. Each genome chooses its reminder by scalar score before Scenario/common-fit, so a challenger may select a different reminder. Suppressed traced Items are never selected.

New shadow metadata records `shadow-replay-v2`, `prediction-features-v2` and `comparisonScope = FROZEN_SOURCE_POOL`; serving appends `+frozen-replay-v2` after the preceding `+outcome-attribution-v1`. Registry genome versions remain unchanged; worker code/input schema versions identify actual replay separately. Old traces/evaluations are not rewritten. Pre-v2 queued sources fail diagnostically; new evaluations accept compatible shadows and retain version/scope even when no outcomes are comparable.

Existing full-schema controls require exact double-precision score equality and exact rank/selection/policy across 18 Personal/Shared × mode × page-size cases. The independent accepted-formula check uses `1e-12` arithmetic tolerance. Reminder re-selection, precision boundaries, ties and later catalog/taste/member changes are covered. These are comparisons conditional on a frozen source pool, not evidence about independently generated live challenger pools or predictive usefulness.

#### Candidate admission — prepared, not hosted

`20260910210520_eligibility_first_candidate_pool.sql` fixes admission starvation: 70 consumed high-fit Items previously occupied top-50 despite 24 ordinary alternatives. V0 evaluates `resurfacing_policy_decision_v1` at one recorded time before retention; ordinary → aged reminder → suppressed ordering precedes the same baseline-score/Item-ID order. Scalar scoring reuses that frozen input, with each genome applying its reminder cap within the retained pool.

The serving suffix is `+eligibility-first-v1`. Candidate `candidatePool` metadata records version, `eligibilityAt`, considered/ordinary/reminder/suppressed counts, retained limit/count, `baselineScoreRank` and `admissionRank`. V0 retains at most 50; expensive Scenario/common-fit work and persisted traces retain at most `min(50, 3 × requested limit)`. Admission counts are not impressions or additional evidence.

Complete versioned zero-result sources are valid frozen comparisons. All-suppressed and explicit empty controls can have zero hypothetical selections; automatic challenger queueing still omits empty pools. Pre-admission frozen-v2 sources stay comparable; pre-v2 inputs fail diagnostically. Tests cover 36 Profile/domain/mode/limit combinations, mixed domains, empty/exhausted sources, reminder caps, exact baseline replay and populated preservation.

The raw-feature/admission scan still covers the full catalog; only downstream expensive work is bounded. This corrects eligibility starvation without claiming indexed retrieval scale, independent source diversity or complete ALG-002/003 acceptance. The active legacy client still treats an empty RPC array as failure until the identified reader is activated.

#### Versioned result/continuation contract — first-page source prepared 2026-09-11

`20260911070959_identified_prediction_page.sql` adds `public.rank_items_page_v1(request jsonb)` over the same private ranking core as the unchanged public row RPC. It accepts numeric `version: 1`, UUID request/Profile/session IDs, DiscoveryMode, BOOK/MOVIE ItemType, integer limit 1–50 and object context. The envelope is at most 16 KiB; unknown keys and nested context session identity are rejected. In protocol 1 the optional cursor must be null; protocol 2 is defined below. Capturing session identity does not create or prove an Event session.

The server generates the PredictionRun ID before ranking. Exact request/response JSON is retained in private RLS-protected receipts; request-ID reuse is serialized with an advisory lock. Current actor/Profile membership is checked and locked even on receipt replay. Changed payload or actor rejects reuse; original trace and receipt commit atomically. Later mutable state cannot rewrite a retry. Receipts cascade with actor/Profile/run; no time-based receipt-retention policy is implemented yet.

Every response, including an empty one, retains version, request/run/Profile/session/mode/type identity and ordered rank rows. `source` records admission version, retained candidate/result counts and empty-catalog decision. Availability distinguishes `ITEMS`, `WINDOW_EXHAUSTED` and `CATALOG_EMPTY`; the last requires no discoverable Items in the requested domain. Suppression or exhaustion of bounded retained candidates cannot establish catalog emptiness. Protocol 1 `nextCursor: null` and `continuationSupported: false` mean paging is unavailable to that protocol, even if the first page returned Items; they do not prove all eligible Items were delivered.

`predictionPageOperations.ts` retains explicit protocol-1 envelope validation and now defaults new requests to protocol 2. Both protocols validate scope, run identity, source counts, availability and contiguous unique ranks. The shared row mapper remains; the unused row-RPC client and its unscoped presentation cache were removed when the live client source adopted protocol 2. Hosted and device acceptance remain separate.

`20260911074543_prediction_continuation_windows.sql` adds owner-only `frozen-window-v1` open/read helpers. They preserve the first receipt's exact immutable run, ordered candidates, scope and initially selected IDs without reranking, making Events, changing receipts or creating another run. Repeat open returns the same window; reads require the current actor/membership, valid source lifetime and unchanged original run/candidate rows. Later catalog/taste state cannot replace that source.

Window limits are 50 candidates/seen IDs, 2 MiB snapshot, 15 minutes from original ranking and 16 retained windows per actor/Profile. Scope locking serializes creation. New opens reclaim expired derived rows only; source age prevents expired-run reopening as a fresh window. Actor/Profile/run/receipt deletion cascades. Dormant scopes may retain at most 16 expired rows until another open or parent deletion; no background cleanup worker is implemented. Helpers have no API-role execution grants.

#### Atomic next pages — protocol 2 source, not hosted

`20260912105528_atomic_prediction_pages.sql` adds numeric `version: 2` to the same
`public.rank_items_page_v1` endpoint. Protocol 1 keeps its exact first-page body,
false continuation capability and immutable old receipts; the legacy row RPC is
unchanged. The current client source opts into protocol 2; protocol-1 envelope compatibility
remains explicitly tested. Hosted rollout must precede using this client build.

Protocol 2 retains the 16 KiB envelope, UUID request/Profile/session identities,
mode/domain, limit 1–50 and object context. A null/omitted cursor starts a new
window; later requests supply an opaque random UUID cursor. Only request ID and
cursor change within that window: actor/Profile/session/mode/domain/limit/context
must match. Server-owned cursor rows bind the original window, predecessor run
and page index. Request and actor/Profile scope locks serialize exact retries,
competing consumers and the 16-window cap. Another request cannot reuse a consumed
cursor, even when its payload would otherwise agree.

Each later page copies the original model/genome, feature/Scenario/common-fit
scores and state. It rechecks current catalog availability/type and the canonical
native/bootstrap/List resurfacing policy, excludes already delivered IDs and
permits at most one reminder across the whole observed window. These hard
constraints are frozen into candidate `resurfacingInput` before the shared
reminder/tier helper runs. Newly added catalog Items are outside the frozen pool;
explicit refresh creates a new window and can legitimately repeat eligible Items.

A single transaction commits the new PredictionRun, all frozen candidates with
page-local ranks/selection, exact receipt, cursor consumption and once-only seen
advancement. The original run/candidates never change. Each response Item has
that page's own prediction ID. `prediction_page_contexts` retains original and
parent run IDs, logical window ID, index, feature/eligibility times, seen prefix
and reminder history. It survives derived-window/cursor expiry; actor/Profile/run
lifecycle still owns evidence and receipt deletion. No time-based evidence
retention policy is introduced by this forward.

Protocol 2 returns `continuationSupported: true`; a next cursor indicates remaining
unseen *source candidates*, which can still be suppressed. A terminal zero-result
page is a real immutable run with `WINDOW_EXHAUSTED`. Only an initial zero-candidate
request with a proven empty current domain may return `CATALOG_EMPTY`. Window
exhaustion is not whole-catalog exhaustion. Exact authorized receipt retries work
after cache expiry/reclamation, while an unused expired cursor fails. Empty first
pages need no persisted window. The existing 50-candidate/seen, 2 MiB and 15-minute
bounds remain; no background cleanup or unbounded candidate search is added.

The existing frozen scorer also replays these page inputs. Page shadows use
`shadow-page-replay-v1` and comparison scope
`FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX`. This comparison conditions on the
*actual production prefix*, not hypothetical earlier challenger pages or unseen
user responses. Missing page context fails closed; future catalog/taste changes
cannot alter frozen replay. New evaluations accept the matching page replay
version and record its prefix limitation; existing evaluations remain unchanged.

Full-schema checks cover 12 Personal/Shared × domain × mode windows, 48 page runs,
exact baseline score/rank/selection replay, zero-rating attribution/evaluation,
current eligibility, scope/actor isolation, rollback, expiry and legacy retries.
The native CI runner additionally observes real lock contention for same-request
retry, competing cursor consumers and simultaneous sixteenth/seventeenth windows,
and rehearses both new forwards over populated pre-window receipts. Read STATUS
and current PR CI for acceptance; test definitions alone are not native results.

#### Captured-scope mobile pages — source, rollout pending

`usePredictionRanking.ts` now reads protocol 2 through `predictionPageOperations.ts`
and the tested `predictionPageReader.ts` controller. First requests capture an
immutable allowlisted context when a focused fetch starts; the builder caps its
serialized request at 8,000 UTF-8 bytes to remain inside the server's 16 KiB
jsonb envelope after whitespace/cursor overhead. A next request changes only its
request ID and opaque cursor. Transport retry reuses the exact request object;
explicit refresh starts a new window and does not relabel its predecessor.

The visible cache/readiness/controller identity includes environment, actor,
Profile, Event session, domain, DiscoveryMode, limit and evidence revision.
A → B → A creates a new reader on return. Scope cleanup invalidates old fetches
and catalog enrichment during commit; focus cleanup prevents hidden detail
feedback from repeatedly opening unused windows. First scope entry is immediate;
subsequent evidence updates retain the 600 ms delay. Catalog enrichment preserves
Item ID/order/domain and cannot replace a BOOK with later MOVIE metadata.

Append requires the expected cursor, next index, original source ID, feature time
and candidate count, unique page/run/request identities and unseen Items. The
accepted prefix remains immutable and bounded by the original pool; a failed
append retains it only in its original scope/revision. A terminal empty page
retains its own PredictionRun. Initial loading/error, proven empty catalog,
loading the next page and bounded-window exhaustion have distinct UI states.
Retry and explicit new search are separate actions, including after cursor expiry.

Each Item's page run reaches grid/Shared-overlay origins and the clicked delivered
slate. Detail/swipe/actions retain that captured sequence and per-Item map while
new pages or rankings arrive. A new native list instance is keyed by the current
request/view; callbacks retain that view token and session, so earlier visible
Items cannot become impressions for a different request or scope. Fetching or
prefetching a page creates no impression. Eight immutable navigation slates remain
the bounded handoff; there is no global unscoped lookup of hosted Items.

The configured source requires the complete six-forward server contract and
fails closed if it is absent. Protocol 1 and the server's legacy row RPC remain
compatible for existing clients; this client does not downgrade after errors.
Current CI, exact hosted rollout and configured-device acceptance are separate
facts owned by STATUS and DEVICE_TEST. No new SQL forward is part of this client
change.

#### Late Outcome attribution — prepared, not hosted

`20260910192630_late_outcome_attribution.sql` supplies the same private effective-Outcome reader to ScenarioMemory and mature evaluation. Exact immutable receipt membership and a real pre-action impression can make an earlier unattributed Outcome usable for its originally requested run; missing/mismatched proof contributes nothing. Raw Events/receipts, old evaluations and prediction-time inputs remain unchanged. Duplicate impressions do not multiply support; existing priority/Undo and zero-rating semantics remain authoritative.

Serving appends `+outcome-attribution-v1`; evaluation records `outcomeAttributionVersion` and server-captured `evidenceCutoff`. Outcome occurrence must fit the mature window, while the recorded receipt/impression must be visible by the evidence-read cutoff. A new evaluation may include newly available proof without changing an older evaluation. This bounded reader test establishes neither authenticated arrival timestamps nor large-history performance. DATA_EVENTS owns exact proof membership and event-cutoff semantics.

#### Active List membership — recorded hosted successor

The active #229 `active-list-v1` successor uses current authorized memberships and their latest active added time for ordinary suppression/reminder age. Removing the final membership restores eligibility only when no independent Saved/bootstrap/terminal state suppresses the Item. Existing 30-day reminder minimum age/cooldown, frequency cap and ordinary-before-reminder order remain intact. Its recorded hosted forward is `20260910110344_list_membership_resurfacing.sql`; device acceptance remains separate. List removal need not offer Undo. The optional List-only “Mitä tänään” mode does not replace ordinary Discovery eligibility.

### Candidate generation and delivery

Use bounded candidate sources for durable fit, recent/session fit, prior, novelty and Shared agreement, then deduplicate and apply hard eligibility with bounded refill. Trace source membership and considered alternatives. Do not restrict every policy to a fixed baseline top-50 before eligibility or Shared scoring.

Bound request/slate size, memory and queries; support continuation through a frozen/versioned slate or explicit new PredictionRun. Never mutate an old run to explain a new order. Client detail/swipe must retrieve the exact Profile/prediction slate. Overlay/search/List/history origins and actual displayed ranks must not masquerade as ordinary selected candidates. Outcomes with no valid attributable exposure remain separate observations.

### Active #229 successor source and remaining acceptance

These contracts are present in the unmerged `feat/228-delivered-origin` source,
including the protocol-2 page forward. They are not claims that accepted main or
hosted serving already uses the six pending forwards. STATUS owns exact refs/CI/rollout dates.

| Source contract | Meaning / remaining boundary |
|---|---|
| Late-outcome attribution | Only the immutable command receipt plus actual pre-action exposure can prove the originally requested run; effective outcome reads share an evidence cutoff. Existing Events/evaluations stay frozen. |
| Frozen replay v2 | Same raw scoring features, genome, Scenario/common-fit inputs and resurfacing/delivery policy for serving/shadow. Equality is conditional on the frozen source pool, not an independently retrieved challenger universe. |
| Eligibility-first admission | Canonical eligibility precedes raw top-50 retention. This fixes suppression starvation; full-catalog scanning and lack of independent candidate sources remain scale/quality work. |
| Identified first page | Immutable request/response receipt, exact actor/Profile/session/mode/domain identity and genuine empty-run identity. Retry payload mismatch fails; old row RPC remains for old clients. |
| Private frozen window | At most 50 candidates/seen IDs, 2 MiB, 15 minutes and 16 windows per actor/Profile. Raw cached candidates include suppressed/already delivered entries and are not another page. |

The protocol-2 source now commits independent pages, hard eligibility and seen
advancement atomically, with page-aware frozen replay and dedicated native
concurrency/upgrade checks. Protocol 1 still reports false capability. The client
source now uses protocol 2 with captured scope and per-Item page origins. Exact
hosted rollout and configured-device acceptance remain open; STATUS owns their evidence.

An empty identified result, exhausted bounded window and transport/authorization
failure are distinct. Window exhaustion cannot claim global catalog exhaustion.
Client readiness and visible cached ranking must match environment, actor,
Profile, session, mode, domain and request/revision. Refetching after a session
change does not make an older cached run current. Test rapid A → B → A return,
delayed/error replies and scope changes before switching the prepared page reader.

Active-list membership participates in #229's bounded resurfacing successor;
removing one membership cannot restore ordinary eligibility while another
membership or terminal reaction still suppresses the Item. The same versioned
policy must govern serving and replay. Recorded branch rollout is not inferred
from the existence of this specification.

### Adaptive memory without unstable taste

- WorkingState: ordered active-session actions and allowlisted current intent; reset/expire explicitly across session/Profile changes.
- ShortTerm: recent independent evidence across useful time buckets; adapt rapidly but distinguish unknown/attention from negative preference.
- LongTerm: weighted support by feature/source and repeat experience; adapt slowly to sustained contradiction. Imported history is an initial prior, not a permanent minimum weight.
- Record effective support and uncertainty. Repeated taps or one Event joining many tags are not independent observations. Undo/removal/revised ratings invalidate or compensate prior evidence consistently.
- Use one decay definition. The existing 365-day age clamp and bootstrap 20% floor require deliberate replacement or explicit evaluated justification; snapshots and serving cannot disagree.
- Common normalized features allow BOOK/MOVIE transfer, while domain metadata and transfer reliability prevent false equivalence. Preserve evidence strengths, not only top-tag names. Missing features yield a neutral bounded fallback.
- Begin with a transparent bounded context-dependent weighting rule over these states; compare it with a static baseline. Learned gating may later replace it behind the same versioned contract.
- FOR_YOU optimizes supported fit; SURPRISE adds relevant novelty; RISK allocates bounded exploration to relevant uncertain candidates. Deterministic hash jitter alone is not evidence of epistemic uncertainty. Log propensities if stochastic selection is introduced.
- The implemented logged-in `cold-start-v1` calibration uses six known ratings within a 12-to-24 slate. The planned anonymous adaptive Taste Test has its own versioned stopping/support rules and held-out challenge in [LAUNCH_LOOP.md](../product/LAUNCH_LOOP.md); do not transfer the six-rating gate or claim adaptive selection is already delivered. Measure recognizability, information gain, skips and completion, not just stored ratings.

SharedProfile retains its own joint history and same-Profile Scenarios. Authorized member fit is a bounded aggregate input; leaving/deletion removes access and invalidates derived dependencies. Shared learned state is never merely the average of members or a copy of Personal Events.

### Evaluation and consolidation

Run bounded prospective shadow/evaluation jobs with idempotent claims, leases, retries, dead-letter diagnosis and recorded model versions. Monitor completed throughput and oldest pending job, not only whether a schedule exists. Derive/rebuild memory projections incrementally only when parity with full recomputation is demonstrated.

Outcome reconciliation handles delayed ratings, unsave/removal and undo without a stale early positive becoming permanent. Fixes receive new reward/feature versions; historical comparisons must declare eligibility and maturity windows. Use chronological holdouts and ablations (bootstrap/session/Scenario/Shared/transfer on/off), with sample sizes and uncertainty. Measure useful consumption/rating, coverage, repetition, calibration, Shared disagreement and cost/latency; taps alone do not define success.

Shadow compares alternatives only where observed exposure supports evaluation; it cannot establish how users would have reacted to unseen Items. No global/automatic promotion in MVP. Manual canary needs mature supported evidence, explicit authorization and a rehearsed rollback. Insufficient data keeps the baseline active while evaluation operates.

ADR-0008 advances E1 portable contracts and D1/D2 isolated preference research, not production population retrieval or a neural-model requirement. Learned serving embeddings/pgvector, sequential/LLM models, native population learning and autonomous evolution retain later gates. None is a prerequisite for fixing current evidence/scoring defects. Optional D3/D4/D5 studies do not become hidden first-release blockers.

## 19. Research basis

Primary references preserved from the earlier design; newly verified dataset specifications and source limits are maintained in DATA_ENRICHMENT rather than inferred from these general research directions:

- Spotify Research, *Generalized user representations for large-scale recommendations* (2025): multi-signal representations over approximately week/month/six-month scales, near-real-time refresh and synchronized embedding versions. <https://research.atspotify.com/2025/9/generalized-user-representations-for-large-scale-recommendations>
- Spotify Research, *Calibrated Recommendations with Contextual Bandits* (2025): context-dependent content mix, exploration and multi-objective extension. <https://research.atspotify.com/2025/9/calibrated-recommendations-with-contextual-bandits-on-spotify-homepage>
- Spotify Engineering, *Why We Use Separate Tech Stacks for Personalization and Experimentation* (2026): personalization systems are evaluated as experiment treatments rather than using bandits as the experiment platform. <https://engineering.atspotify.com/2026/1/why-we-use-separate-tech-stacks-for-personalization-and-experimentation>
- Spotify Research, *Semantic IDs for Generative Search and Recommendation* (2025): task-aware learned discrete Item representations and joint search/recommendation tradeoffs. <https://research.atspotify.com/2025/9/semantic-ids-for-generative-search-and-recommendation>
- Google Research, *Transformers in music recommendation* (2024): ranking from ordered user-action sequences and current context. <https://research.google/blog/transformers-in-music-recommendation/>
- Meta, *Generative Recommenders / HSTU* (ICML 2024): sequential generative recommendation and scaling behavior. <https://github.com/meta-recsys/generative-recommenders>
- Netflix, *GenRec: An LLM-Backed Recommendation Ranker at Netflix* (2026): verbalized history/context, reward alignment and constrained serving. <https://arxiv.org/abs/2608.10257>
- LinkedIn, *360Brew* (2025): a shared decoder-only foundation model across many ranking tasks. <https://arxiv.org/abs/2501.16450>
- MemGPT (2023): hierarchical virtual context and explicit movement between fast/slow memory tiers. <https://arxiv.org/abs/2310.08560>
- *Episodic Memory is the Missing Piece for Long-Term LLM Agents* (2025): instance-specific episodic retrieval for adaptive behavior. <https://arxiv.org/abs/2502.06975>
- Qloo/Taste AI: commercial cross-domain taste graph as market/architecture validation. <https://www.qloo.com/>
- Criticker FAQ: correlation-based Taste Compatibility Index and predicted scores. <https://www.criticker.com/faq/>
- StoryGraph recommendation changelog: preference- and mood-aware book recommendations. <https://roadmap.thestorygraph.com/changelog/revamped-recommendations>
- JustWatch help: watchlist, streaming availability and recommendation discovery. <https://support.justwatch.com/article/what-is-just-watch>
- Letterboxd API/export documentation: discretionary API access and user-owned data export. <https://letterboxd.com/api-beta/> and <https://letterboxd.com/user/exportdata/>
- IMDb help: user ratings export and licensed/developer data boundaries. <https://help.imdb.com/article/imdb/track-movies-tv/faq-for-imdb-votes/G67Y87TFYYP6TWAV>
- EU Digital Services Act Article 27: plain-language recommender parameters and user influence. <https://eur-lex.europa.eu/eli/reg/2022/2065/oj>
- EDPB, data protection by design/default: minimization and continuous privacy controls from system design onward. <https://www.edpb.europa.eu/topics/ai-and-technology/privacy-by-design-and-by-default_en>

References inform direction; Kajo's decisions remain governed by its own evidence, licensing, privacy and product constraints.

## 20. Kajo adapter and external-data boundary — ADR-0008

The generic engine contracts and all 51 conceptual parts are defined once in [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md). This document supplies Kajo semantics:

| Generic role | Kajo mapping / owner |
|---|---|
| Subject | `Profile`; SharedProfile is its own learned subject |
| Acting identity | authorized `User`, separately retained as `actorUserId` |
| Object | canonical `Item`, not provider-specific records |
| Action | authorized recommendation/slate; policy and hard constraints remain explicit |
| Observation | source-typed evidence from the native event/command/exposure boundary |
| Outcome / reward | versioned Kajo meanings, maturity/observability and existing V1 reward projection |
| State | supported Working/Short/Long/Scenario inputs and later explicit Belief/World/Group composition |
| DomainAdapter | mapping/feature normalization, target definitions and trusted constraints outside core computation |

E1 creates executable contracts and media/non-media fixtures without moving credentials, provider schemas, React Native or Kajo BOOK/MOVIE enums into the core. Current SQL remains the serving baseline. A component is extracted/replaced only with parity, absence/failure fallback, scope and rollback tests; no second independently drifting full ranker is introduced.

D1/D2 operate in isolated research storage. Keep source-local people and ratings distinct from Kajo accounts/Events, preserve original scales/timestamp semantics and never fabricate missing exposures, alternatives, mood, consumption time or group state. D3 Tag Genome, D4 Beliefs and D5 KuaiRand remain optional after D2; they are independent follow-up studies. Detailed manifests/schema rules/metrics live in DATA_ENRICHMENT, not a duplicate specification here.

A future admitted ExternalTastePrior uses canonical Item mapping and compatible immutable artifacts. It is separately source-weighted/ablated, shrinks with relevant native support and transfers across domains only with evidence. Data/rights withdrawal propagates through jointly trained or distilled dependencies; raw-file removal alone is not proof of influence removal.

Memory retrieval enforces authorization and time/source eligibility before nearest-neighbor selection and again at use. Encode only the decision-time prefix for a query; do not retrieve by its own hidden future Outcome/After/Error. Index/encoder versions must match. The output may be an uncalibrated score; probability heads enter only with explicit target/horizon/conditioning, real labels and calibration.

The core distinguishes present-state hypotheses, stochastic future paths,
alternative actions and model Challengers. Compare only targets actually
observed under a valid horizon/action; a never-chosen action is not a negative
label. Memory scope and observed/synthetic origin are separate dimensions.
Snapshot versus ordered-trajectory retrieval is a declared D2 experiment, with
no-match fallback and independent support. Interest, choice, consumption and
later satisfaction may become separate heads; current V1 reward constants are
not silently relabeled as those probabilities. Replay, simulation, consolidation
and evolution require separate ablations before increased complexity is admitted.

Documentation acceptance does not deploy any of these new components. [STATUS](../project/STATUS.md) retains #229's unmerged source and undeployed forwards, and [ROADMAP](../project/ROADMAP.md) starts engine-specific implementation with E1 → D1 → D2 while keeping native reliability gates intact.
