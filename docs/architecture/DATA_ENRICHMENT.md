# External taste data and enrichment

Status: **planned research pipeline and admission contract**, 2026-09-12 / Issue #233. No dataset has been imported, model trained or hosted schema changed by this documentation delivery.

Architecture: [Predictive Memory Engine](PREDICTIVE_MEMORY_ENGINE.md). Kajo semantics: [PREDICTION_MODEL](../domain/PREDICTION_MODEL.md). Order and acceptance: [ROADMAP](../project/ROADMAP.md), [MVP](../product/MVP.md).

## 1. What changes

Use public, appropriately licensed preference data to develop and evaluate the independent engine before Kajo has substantial native history. Start with an isolated MovieLens experiment. Add richer object features and an expectation/outcome study only after the baseline pipeline is reproducible.

This introduces **ExternalTastePrior**, not a shortcut around privacy-gated Kajo PopulationMemory. Keep four boundaries separate:

```text
external observed ratings → research records → trained preference prior
provider catalog metadata → canonical Items / licensed presentation features
native Kajo Events       → Profile state / observed Scenarios / evaluation
simulated trajectories   → isolated synthetic experiments
```

Do not create live Kajo Users/Profiles for external dataset people. Do not inject their rows into native Events, imports owned by a real Kajo user, Shared history or reward denominators. A user's own authorized history import remains the existing separate product flow.

## 2. Source registry — verified documentation

The following facts were checked against the publishers' README files on 2026-09-12. The pipeline must verify actual downloaded bytes independently. Specifications below this section are Kajo design decisions, not publisher guarantees.

### MovieLens 32M — first research baseline

The release contains 32,000,204 ratings from 200,948 users, 87,585 movies and 2,000,072 tag applications. Rating records span 1995-01-09 to 2023-10-12. Selected users have at least twenty ratings. Files are `ratings.csv`, `movies.csv`, `links.csv` and `tags.csv`; ratings use half-star steps from 0.5 to 5. File order is user then movie, not chronological. Timestamps identify rating/tag activity, not viewing time. `links.csv` provides IMDb/TMDb mappings. No demographics are supplied. Research use has conditions; commercial/revenue-bearing use requires permission. [ML32]

### Tag Genome 2021 — optional object-feature enrichment

The README distinguishes `scores/glmer.csv` and `scores/tagdl.csv`, each with 10,551,656 movie/tag scores for 9,734 movies and 1,084 scored tags. Raw tag metadata contains 1,094 tags. GLMER values lie in [0,1]; TagDL may range from -0.07 to 1.13. These are relevance estimates, not user-like probabilities. The bundle includes raw inputs and computed artifacts and declares CC BY-NC 3.0. [TG21]

### MovieLens Beliefs 2024, release 2 — optional expectation study

Use the 2025-02-08 updated release. It includes elicitation, recommendation and rating records. In `belief_data.csv`, `isSeen=-1` means no response, `0` means not watched and `1` means watched. Expected rating and self-reported certainty apply to unseen items; elicited actual rating and approximate watch date apply to seen items. User IDs are consistent within this release. Recommendation rows are not Kajo viewport-impression records. Research/commercial conditions must be reviewed separately. [BELIEFS]

Do not assume every expected rating has a later actual rating. The release's self-reported `userCertainty` is not the engine's calibrated BeliefState.

## 3. What the sources can and cannot establish

MovieLens supports specified preference-prediction, collaborative representation, item-neighbor and cold-start experiments. Tag relevance can enrich object features. Beliefs can support selected pre-choice expectation analyses where timing and observed follow-up permit.

They do **not** establish Kajo-specific context, exposure, propensity, joint-group satisfaction, whole-world dynamics or book/movie transfer. Rating-only rows cannot be transformed into complete Scenarios by inventing a slate, mood, watch time or action chosen by Kajo.

Maintain an observability mask. Unknown exposure, unavailable context, missing outcome and observed negative response are different states. Dataset selection and platform differences limit generalization; label all external results as external offline evidence, not production uplift.

## 4. Rights, provenance and admission

The repository's default policy is to publish **code, schemas, manifests without private identities, aggregate evaluation reports and attribution**, not raw datasets, user histories, copied review text, fitted vectors or model weights. This is a conservative project policy, not a claim that every publisher forbids all redistribution.

Create a DatasetManifest per exact release:

```text
datasetId + releaseId + sourceUrl + retrievedAt
publisher README/license snapshot hashes + attribution
archive SHA-256 + per-file hashes + expected/observed counts
source timestamp semantics + coverage interval
adapter/schema versions + normalization rules
purpose: RESEARCH_ONLY unless separately admitted
rights review: research / derivative / redistribution / serving
approved scope, reviewer, evidence, expiry or unresolved questions
```

Unknown or incompatible permission fails closed for the affected use. Non-commercial development is the current intent, not automatic permission for every eventual public beta. Rights must be checked for provider metadata and computed artifacts as well as the dataset container.

ModelArtifact manifests inherit every training/preprocessing/prototype/distillation dependency. An admission check evaluates the complete dependency graph for the intended environment. Turning off an external-prior coefficient does not remove externally learned influence from a jointly trained model; a native-only rebuild may be required. Keep a reproducible native-only fallback and a withdrawal/retraining procedure.

The requested documentation change does not approve any license interpretation, production publication, commercial use or artifact deployment.

## 5. Isolated research storage and execution

Do not load tens of millions of external ratings into the production transactional database. Use a developer-controlled offline workspace or separately governed research storage with bounded batch jobs and no production write credentials. Choose the actual local analytical format during implementation; portable normalized contracts matter more than a particular dataframe/database package.

The first implementation creates real code and tests only when the corresponding work packet starts. No empty engine/services/data directories are needed now. Raw and derived research locations must be excluded from Git and ordinary CI artifacts before the first download.

Use streaming/chunked parsing, bounded memory, atomic stage checkpoints and resumable/idempotent jobs. Keep malformed rows and mapping conflicts in a counted quarantine, not silently discarded. Dataset files are data, never executable instructions. Archive extraction must prevent path traversal and enforce size/file allowlists.

## 6. Normalized research contracts

### ExternalSubject

`(datasetId, releaseId, sourceUserId)` is a namespaced research identity. Preserve source-local join ability without linking it to a Kajo account or assuming stable user identity across different releases/datasets. Do not attempt re-identification.

### ExternalObject and ObjectMapping

Store source object ID, namespaced external aliases, mapping status, mapping version and confidence/reason. Use explicit stable-ID mapping; title/year matching is a reviewable fallback, never an automatic identity merge.

Keep IMDb IDs as normalized strings preserving significant leading zeros and the `tt` convention; parse missing TMDb mappings as missing. Conflicting aliases fail closed. A research object may remain unmapped to the current small Kajo catalog without becoming invalid research data. Report both dataset coverage and live-catalog intersection separately.

MovieLens release IDs and Tag Genome object IDs must be mapped through documented identity/aliases and checked for conflicts. Tag-dictionary rows and computed-score rows are different namespaces/shapes; do not assume every raw tag has a score.

### ExternalObservation

Proposed fields:

```text
observationId = stable source-row identity / content hash
subjectRef + objectRef + dataset/release provenance
observationKind = EXPLICIT_RATING / TAG / ELICITED_BELIEF / SOURCE_RECOMMENDATION
rawValue + rawScale + normalizedValue? + normalizationVersion
sourceOccurredAt? + ingestedAt + timestampSemantics
sourceRecordRef + correction/deduplication status
observability: exposure / context / consumptionTime / followUp
```

Preserve the original rating scale. A convenient Kajo-scale transform is `rating10 = 2 * rating5`, which produces 1–10 here, **not observed zeros**. That numeric transform does not prove equivalence between platforms' rating behavior; calibrate and compare source-specific baselines. Do not create a native Kajo consumed Event merely because an external explicit rating exists.

For retrospective research, source timestamp can define simulated ordering only under a declared assumption. Current import time is not historical model availability. Equal-time observations use deterministic ties or a same-time group that cannot leak within-group future labels.

### ObjectFeatureArtifact and ExternalTastePrior

Features/priors reference exact training source, split, encoder, dimension, transform, artifact hash, coverage, support and rights eligibility. Keep object metadata, object embeddings and subject preference parameters distinct.

Prior fusion must be versioned and ablated. A transparent starting rule shrinks its contribution with supported native evidence and domain mismatch; do not silently add a second copy of bootstrap signal. Sparse/unmapped objects fall back neutrally. Prior admission never changes hard eligibility or Shared authorization.

## 7. Source-specific adapters

### MovieLens adapter

Validate UTF-8 CSV quoting, exact required headers, finite in-range ratings, half-step precision, integer IDs/timestamps, unique movie identities and referential integrity. Sort explicitly for chronological experiments. Detect duplicate `(subject, object)` records and define correction/rejection semantics before training; do not assume input sorting proves uniqueness.

For a fast smoke experiment choose a deterministic hash-selected subject cohort and retain its histories, then split by time. Do not use the first N rows as a representative sample. Small fixtures prove parser/correctness behavior only; a sampled real cohort estimates only its declared evaluation population. Scale to the full release after resource and quality reporting works.

### Tag Genome adapter

Start with one explicitly selected score variant. Retain raw score and variant, validate finite values and uniqueness, and report missing coverage. Do not reject valid TagDL values solely for being outside [0,1], or present them as probabilities. Any clipping/scaling is a separately versioned transformation compared with an appropriate control.

Computed features contain information from their own construction data. For strict historical evaluation, prove availability/training cutoff before the decision or exclude them from that claim. A static enriched benchmark may be reported separately as such; it is not leakage-free historical replay by default. Fit any additional transforms only on the training partition. Do not ingest the bundle's raw reviews merely because they are present.

### Beliefs adapter

Keep no-response, unseen expected rating and seen elicited rating as different typed records. Validate conditional nullability; do not turn `isSeen=-1` into dislike or zero stars. Approximate self-reported watch dates remain approximate.

A prospective expectation/error pair requires the same release-scoped person and movie, a belief timestamp preceding the eligible later rating and a declared follow-up window. Do not pair with an earlier rating, assume all beliefs mature or silently drop unobserved follow-up from coverage reporting. Repeated elicitations need an explicit first/last/predefined selection rule.

Publisher-system predicted ratings may be evaluated as a separately named comparator, not silently fed into an independent engine predictor. Elicitation/recommendation sampling fields do not automatically provide the propensities needed for arbitrary policy evaluation. User identity overlap with ML32 is unproven unless explicitly documented; do not join users across releases by integer equality.

## 8. Reproducible evaluation before model complexity

Every EvaluationManifest freezes source hashes, hypothesis, task/label, eligibility, split boundaries, code/dependency versions, random seeds, resource budget, metrics and admission rule before final testing.

### Baselines and challengers

Start with a train-only global/item mean with support shrinkage, a supported item-neighbor model, and a compact explicit-rating factorization challenger. An implicit-feedback model requires an explicitly justified transformation; absent ratings are not dislikes. Compare current transparent content/state concepts through the research adapter rather than pretending the existing hosted SQL is already trained on MovieLens.

Evaluate both the learned component and the complete candidate/ranking pipeline where the dataset supports the latter. A good reranker cannot recover candidates never retrieved. No baseline may read a test rating through an embedding, normalization statistic, tag aggregate, prototype or nearest-neighbor index.

### Splits and cold start

Use global chronological train/validation/test cutoffs with all learned artifacts trained only on permitted history. A per-user last-N split alone can leak future information through other users' training records. Separately evaluate held-out subjects with controlled visible prefixes, for example 0/5/10/20 ratings, while freezing global artifacts before their scored targets.

Specify whether a result is frozen-batch or prequential. In a prequential test, score first, then allow that newly observed answer to update later state; never report that as a fixed holdout test. Keep a final untouched test window outside evolutionary model selection. Preserve an item-cold-start slice where feasible and report excluded/unmapped entities.

### Metrics and interpretation

Use rating MAE/RMSE for observed explicit ratings. Use probability losses/calibration only when a probability target and supported labels exist. Ranking NDCG/Recall needs a published relevance rule and candidate universe; sampled unlabeled negatives are not known dislikes and must be labeled as an assumption/protocol.

Report support, users, objects, coverage, popularity/long-tail slices, cold-start prefix, error distribution, resource cost and uncertainty grouped by subject where appropriate. Include prior off/on, metadata off/on and future memory/dream ablations. Do not optimize clicks or estimated confidence without delayed outcome evidence.

Acceptance means reproducibility, valid comparisons and an honest report. A challenger may lose; rejecting it is a valid result. Serving admission separately requires useful supported gains and guardrails. This external movie test cannot close Kajo's native exposure, Shared, cross-domain, device or first-session product-value gates.

## 9. Admission into Kajo, only after research

A candidate artifact progresses through `RESEARCH → VALIDATED → SHADOW_ELIGIBLE → CANARY_ELIGIBLE → ADMITTED`, or is rejected/withdrawn. The registry stores the approved use, rights, quality/coverage evidence, privacy lineage, compatibility, rollback and explicit decision.

Keep native serving active while research runs. Before any runtime integration: map licensed object features through canonical Item IDs; verify feature/encoder/index versions; measure latency and failure behavior; test Personal/Shared isolation; preserve captured slate/prediction origin; show neutral fallback when the artifact is absent, invalid, disallowed or out of domain.

A learned external prior is not required to win to complete the research packet. If it fails or rights are unresolved, record the outcome, retain the transparent baseline and continue the release path without pretending the dependency disappeared from an already trained artifact.

## 10. Work packets and test matrix

[ROADMAP](../project/ROADMAP.md) owns sequencing. The initial packets are:

| Packet | Deliverable | Acceptance |
|---|---|---|
| E1 | Generic subject/actor, state/action/object/observation/outcome contracts; Kajo mapping; deterministic media and non-media fixtures | No provider/UI/auth dependency in core; missingness, version/time scope and observed/synthetic separation tests; no runtime scorer swap |
| D1 | Dataset manifest + MovieLens adapter + isolated small deterministic cohort | No production credentials/writes; repeatable hashes/counts; parsing, bounds, IDs, duplicates, missing mappings, time order, quarantine and idempotent retry tests |
| D2 | Reproducible baselines, cold-start splits and fixed evaluation report | Same-seed reproducibility; leakage tests for embeddings/features/prototypes; frozen final test; explicit unsupported claims and uncertainty |
| D3 | Optional named Tag Genome variant and coverage/rights ablation | Variant ranges, mapping conflicts, missing features and temporal availability tested; enriched vs no-enrichment comparison |
| D4 | Optional Beliefs release-2 expectation study | Conditional nullability, no-response, temporal pair validation, repeated belief policy and follow-up coverage tests |
| E2 | One admitted component behind existing Kajo prediction boundary | Accepted SQL compatibility/fallback; immutable trace and current authorization; separately reviewed rollout and real-device evidence |

Dataset download, the full training run and hosted artifact admission are separate recorded operations. No completed checkbox or source CI pass can substitute for them.

## Sources and attribution

[ML32]: https://files.grouplens.org/datasets/movielens/ml-32m-README.html
[TG21]: https://files.grouplens.org/datasets/tag-genome-2021/genome_2021_readme.txt
[BELIEFS]: https://files.grouplens.org/datasets/movielens/ml_belief_2024_data_release_2_README.txt

Publication attribution must follow the exact selected release: Harper and Konstan (2015) for MovieLens; Kotkov, Maslov and Neovius (2021) and Vig, Sen and Riedl (2012) for Tag Genome; the Aridor et al. (2024) Beliefs reference specified by its publisher. Store the publisher's complete citation in the dataset manifest rather than relying on this abbreviated design note.
