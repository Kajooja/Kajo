# Portable Prediction Engine — E1

`@kajo/prediction-engine` is a dependency-free computation boundary and a bounded
reference estimator. It is not used by Kajo serving. Existing SQL, authorization,
atomic delivery/receipts and native event persistence keep their current owners.
See [the architecture](../../docs/architecture/PREDICTIVE_MEMORY_ENGINE.md) and
[ADR-0008](../../docs/architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md).

From the repository root:

```sh
npm ci
npm run engine:demo
npm run test:engine
npm run check
```

The demo builds the package and imports its real ESM export. It runs one media
fixture and one invented machine-energy fixture without UI, credentials, a
database, network, wall-clock reads or randomness. Both examples explicitly carry
synthetic provenance and contribute zero observed evaluation labels. Their first
estimates are 7 (rating) and 50 (energy); after a known continuation, recalled
estimates are 9 and 45. This demonstrates execution and portability, not learned
quality, causal effects, calibrated confidence or real non-media competence.

## Executable boundaries

| Export / function | Contract |
| --- | --- |
| Root `represent` | Authorized subject/source/time prefix; latest available revisions; durable and recent numeric summaries; explicit unresolved state hypothesis |
| Root `recall` | Bounded exact ordered-prefix/action-feature distance, eligibility before top-K, known continuation, compatible representation/target/horizon and explicit no-match |
| Root `predict` | Numeric mean of recalled labels, otherwise the prefix mean or unavailable; immutable original state/model/constraints/estimates |
| Root `choose` | Objective-directed choice among originally eligible actions still permitted now; abstain without support |
| Root `compare` | Error against the original forecast for the matching subject/object/target and actual action where required, within the declared horizon and observation cutoff |
| Root `learn` | A new local derived Scenario from eligible evidence, or null; no source mutation, model training or write side effect |
| `./adapters/kajo` | Structural Profile/User/Item/rating snapshots; Shared is its own Subject; acting User remains separate; no app imports |
| `./fixtures` | Deterministic media and synthetic maintenance cycles using the same computation functions |

The separate Kajo adapter accepts already-authorized snapshots. Its membership
check is an additional shape/scope guard, not a replacement for current server
authorization. Features are allowlisted/versioned inputs, not provider requests.
The fixture maintenance adapter supplies machine/configuration/energy semantics.
Target-specific rewards and hard constraints stay in the adapters; the reference
policy uses the target's maximize/minimize direction.

## Time, evidence and uncertainty

Instants are nonnegative integer milliseconds on a declared clock. All fixture
times are synthetic. Observation occurrence and availability must both precede
the decision to enter its state. Features and model/representation artifacts must
already be available, with training no later than artifact availability. Frozen
prefixes are rechecked before prediction/retrieval. A neighbor's continuation
must be available before the new decision and its distance never reads that
continuation, later state or prediction error.

An outcome horizon is `(startAt, endAt]`; `startAt` is the original decision time.
A directly observed target can be compared once available within that horizon;
absence never becomes a negative label just because the deadline passes. Unknown,
unexposed, censored and immature observations remain unscored. Numeric zero remains
an observed value. Object-observation targets permit rating-only research;
action-outcome targets additionally require the actual action identity. Neither
mode supplies the outcome of an unchosen intervention.

Access scope (subject or explicitly admitted cohort) is independent of origin
(observed or synthetic) and source (native, external release or generator).
Sources must be explicitly admitted, and synthetic evidence is excluded by
default. External observations preserve source/release/manifest, original scale,
raw value, null action/exposure information and any simulated availability
assumption. They do not become Kajo Events or fully observed Scenarios.

Estimates carry separate native/external/synthetic support counts. They are
uncalibrated numeric estimates with unavailable uncertainty, never probabilities.
The core uses no unobserved labels as zero, duplicates as extra support or hidden
default score for a cold subject. State hypotheses, action alternatives, outcome
branches and model challengers have distinct tagged types.

## Bounds and storage responsibilities

This version accepts at most 10,000 input observations, 100 proposed actions,
10,000 scanned memories and 100 retrieved neighbors per call. The caller declares
a smaller retrieval budget where appropriate; exceeding it fails rather than
silently truncating an unrestricted memory pool. Recent state uses three ordered
entries; distance averages normalized rating-prefix differences and compatible
numeric object-feature differences. Feature normalization belongs to the versioned
adapter. This is a transparent fixture reference, not a parity extraction or a
second implementation of the SQL recommender.

`learn` returns a deterministic versioned Scenario, so a storage port can upsert
the same result idempotently. Retrieval deduplicates repeated source records and
uses their latest supplied available revision. The caller must supply a complete
authorized revision view and invalidate/rebuild affected derived episodes after
retraction, correction or permission withdrawal; the in-memory core does not own
a persistent store or infer missing tombstones. Raw source revisions and original
frozen forecasts remain immutable when projections are rebuilt.

## Next packet

After E1 source/CI acceptance, [D1 #236](https://github.com/Kajooja/Kajo/issues/236)
adds the isolated MovieLens manifest, source parser/adapter, deterministic small
real cohort, quarantine and reproducible hashes. D1 must resolve source rights,
resource limits and actual availability assumptions before downloading. D2 then
freezes train-only temporal/cold-start baselines and the bounded static-state vs
ordered-prefix experiment. No dataset, trained representation, production model
admission or SQL replacement is delivered by E1.
