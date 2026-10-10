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
| `./working-state` | Pure `deriveWorkingState` and default-OFF `scoreWorkingAdjustment`; bounded independent current-session Item support, correction closure and explicit STATIC/ORDERED controls |
| `./adapters/kajo-working-state` | Strict `normalizeKajoWorkingSession` for authorized Personal canonical Event/session snapshots; no database reader, writer, app import or authorization replacement |
| `./adapters/movielens` | D1 pure external-rating adapter, original 0.5–5 scale, release namespaces and explicit unknown context; the core root does not import it |
| `./ordinal` | #232E bounded exposed group Pareto pair/batch diagnostic using one frozen production/shadow candidate pool, full enrollment and own exposure; no scalar group reward or learning |
| `./adapters/kajo-ordinal` | Strict immutable #232C artifact mapping, required scoped subject/member/enrollment handles, declared digest bindings and diagnostic-only clock/membership limits |
| `./fixtures` | Deterministic media and synthetic maintenance cycles using the same computation functions |

The separate Kajo adapter accepts already-authorized snapshots. Its membership
check is an additional shape/scope guard, not a replacement for current server
authorization. Features are allowlisted/versioned inputs, not provider requests.
The fixture maintenance adapter supplies machine/configuration/energy semantics.
Target-specific rewards and hard constraints stay in the adapters; the reference
policy uses the target's maximize/minimize direction.

## Time, evidence and uncertainty

The E1 reference functions use nonnegative integer milliseconds on a declared clock. All fixture
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

## Bounded session intent

`./working-state` is a separate source-only hypothesis, not a replacement for
E1's `represent` or native SQL. `deriveWorkingState` captures a declared cutoff,
subject/actor/session, complete-prefix declaration, feature schema/artifact,
configuration, eligible records, latest distinct Items and equal-time groups.
The caller must provide the complete authorized session prefix **and visible
same-owner correction closure**; `prefixComplete=false` yields inactive state.
No database lookup or completeness authentication occurs inside the engine.

Default ceilings are 128 supplied records, 32 Items, 32 normalized feature
dimensions and 256 exact invalidation references. Exceeding a ceiling fails;
the caller cannot silently truncate a prefix. Session duration expires at four
hours, inactivity at 30 minutes, and `resetAt` excludes intent at or before that
instant. Current session activity and taste support are separate. Only Item-linked
activity is normalized in this first component; non-Item search/mode Events do
not extend its clock. Corrections from another session
can remove stale intent without importing that session's preference or extending
the selected session's activity clock. At least two distinct latest Items are
required; repeated actions, revisions and multiple tags add no independent Item
support. Conflicting latest states at equal occurrence time remain ambiguous;
record/Item IDs never establish semantic recency.

For a valid observed target, direction is
`d = 2 * ((value - min) / (max - min)) - 1`, negated for a minimize objective.
Scale width must remain finite; division precedes multiplication to avoid overflow.
An explicit negative action has direction -1 and remains distinct from a rating.
Unknown/malformed ratings remove stale preference without inventing a negative;
attention supplies activity context only. For feature `f`, STATIC uses
`sum(d_i * x_if) / sum(x_if)`. ORDERED multiplies each weight by
`2 ** (-older_time_groups / 2)` under the default two-group half-life. Equal-time
Items share the same recency factor. A candidate's component is the mean of the
selected feature vector weighted by its known positive feature coordinates,
scaled and clamped to ±0.25. Missing/zero features supply no weight; unavailable
features or mismatched artifacts reject rather than becoming current knowledge.

`scoreWorkingAdjustment({ state, object })` defaults to `control: 'OFF'` and
returns exactly zero. Explicit `STATIC` and `ORDERED` controls are diagnostic
ablations, not admitted native policy. Results identify `working-state-v1` /
`working-policy-v1`, `uncalibrated`, unavailable uncertainty, temporary intent,
zero observed evaluation labels, `historicalFeatureEligible=false`,
`learnable=false` and `nativeActivated=false`. Synthetic machine fixtures prove
the same generic core executes outside media; they do not establish quality.

The separate Kajo normalizer accepts actual Personal Event/session row shapes,
explicit scoped handles and supplied versioned feature objects. It retains exact
Event IDs, valid rating zero and selective history/interest clear plus UNDO
semantics. Shared, foreign actor/Profile, external/synthetic and bootstrap inputs
do not become native working support. Occurrence and stored `created_at` remain
separate finite decimal-millisecond cutoffs, preserving representable PostgreSQL
fractions. `STORED_CREATED_TIME` is only a proxy; commit availability is UNKNOWN.
Malformed owned rows reject the supplied snapshot even when future; valid future
evidence is excluded before correction reconciliation.
The normalizer's caller still owns current authorization, full correction closure
and captured feature availability; the package adds no database access.

The separate [native Personal bridge](../../docs/domain/PREDICTION_MODEL.md#native-personal-workingstate-capture-and-comparison)
now captures one authorized MVCC Event/session/same-Item correction snapshot
with binary current Item tags and freezes versioned native capture into Kajo
PredictionRuns. The first `native-working-capture-v1` /
`personal-working-features-v1` generation remains supported; fresh reset-aware
sources use `native-working-capture-v2` / `personal-working-features-v2` and
`+personal-working-off-v2`. A versioned SQL consumer serves fixed OFF, returning
the exact legacy score; owner-only `personal-working-shadow-v1` / `v2` comparisons
actually score those frozen components under the original pool and final delivery
policy. They do not replay alternative admission/reminder policy, create genomes
or jobs, supply observed quality or activate session ranking. Protocol 2 pages
inherit their source; protocol 3 captures each fresh page. Old scalar contracts,
Shared behavior and frozen forecasts remain unchanged.

Native NO_SESSION, empty/no-tag, `BUDGET_EXCEEDED` and `INPUT_UNAVAILABLE`
envelopes are inert. Overflow or unsupported legacy input sets
`prefixComplete=false` and retains no partial evidence. Null/empty/overlength/
control-character tags, malformed UNDO or source timestamp precision collapse
produce an explicit unavailable reason while real V2/V3 OFF pages retain the
baseline. The portable core still rejects unsupported input and requires a valid
nonempty schema, so SQL/portable parity applies to accepted nonempty states.
Current tags are known at capture, not certified historical
features or demonstrated semantic transfer. Stored creation remains a proxy,
commit availability UNKNOWN, and historical/learning/ON admission remains false.
The reset-aware native source now has a separate immutable private canonical
control ledger and API-denied SECURITY INVOKER commit helper. It requires an
existing own Personal session, reauthorizes each exact retry before quota and
samples its server boundary after lifecycle/ID/Profile/session locks; new writes
require READ COMMITTED and at most 128 controls per scope. Capture freezes all
visible controls and latest-boundary source references in the same MVCC snapshot.
At-or-before taste/activity is excluded without renewing expiry, erasing history
or adding reward. Reset leaves the raw prefix/correction budget intact; overflow
retains no partial active evidence. Forecast-only erasure keeps these raw controls,
while genuine User/Profile/session removal cascades them. Old sources/comparisons
and V2 copies remain frozen; fresh V3 sources can observe the control. This does
not add a public reset API/UI or change the portable package's database-free
boundary. Product reset integration, quality against STATIC/OFF,
meaningful first-session behavior and measured
activation/rollback remain open gates; STATUS owns exact validation/deployment.

## Offline Shared ordinal audit

```sh
npm run engine:ordinal -- /private/input-manifest.json /private/output-report.json
```

Use `contractVersion: "kajo-shared-ordinal-manifest-v1"`,
`selectionBasis: "OWNER_DECLARED_NONOVERLAPPING_PAIRS"`, a finite evaluation clock
and at most 256 explicit `pairs`. Each pair supplies `pairId`, immutable
`leftComparison` / `rightComparison`, one `anchor` with `sourcePredictionId` and
`actorUserId`, and the adapter's required scoped `references`. The built
`KajoOrdinalSnapshots` declaration owns exact field names. The owner supplies
already-authorized artifacts and a full bijective alias map; supplied files and
PostgreSQL JSONB payload digests are not authenticated by the engine.

Both outcomes need complete own exposure and identical enrollment/window/genome/
mode/domain, evidence cutoff and elapsed maturity interval. The same anchor pool supplies both Items' ordering and must precede
both original OPEN timestamps. The ordinal module accepts finite decimal
milliseconds to preserve representable server receipt fractions; the existing
numeric reference functions retain their integer-clock rule. Every-member ties,
disagreement and missing/unknown/cleared or immature support remain unscored.
Scores are never converted into ratings; equal predictor scores are neutral ties.

The private report preserves scoped member handles and sensitive source/capture/
round/Item/comparison references. Its exclusive output must stay outside the
repository. No network/database write, raw vector publication or overwrite occurs.
The owner must remove or regenerate these offline files after source withdrawal/
erasure; they are not discovered by the database eraser. Private file guarantees
apply to the supported Linux/macOS owner CLI; the pure engine remains independent.
Failed writes remove only an inode established as owned; persistent identity
failure returns `OUTPUT_CLEANUP`, retaining an empty private reservation before
any report bytes are written.
Selection is owner-declared, independent units/prospective consumption are not
established, and the result is conditional on observed production exposure.
Historical feature eligibility, learning, scalar group reward/advantage and
uncertainty remain unavailable. The executable media/maintenance fixtures are
synthetic with zero observed quality labels; SQL-producer fixtures prove only
interoperability, not serving improvement or causal challenger utility.

## D1/D2 research boundary

E1 and D1 are accepted through #241/#242. The verified GroupLens development
cohort contains 500 subjects and 84,849 ratings, isolated from native accounts.
The separate `./research` export now provides D2's eight bounded numeric-rating
variants, prefix queries and optional-artifact fallback using the same core
Observation, PredictionScope, TargetDefinition and ArtifactVersion contracts.
It is not imported by the root reference functions or native serving.

The actual run and independent replay fit means/neighbors/factors/prefix memories,
then score frozen/prequential and held-out-subject windows. [The report](../../research/reports/movielens-small-d2.md)
rejects challenger admission under the predeclared rule; native use is deferred.
[Exact definitions and commands](../../research/README.md#d2--reproducible-development-evaluation)
include source/partition/code identity, state/memory formulas, bounds and fallback.
Current D2 source acceptance and the next release task are in STATUS.

No raw histories or fitted weights are published. Absent/invalid/withdrawn or
disallowed artifacts return authorized native-only evidence or unavailable;
withdrawal removes every dependent fitted parameter/index from use and requires
a separately authorized rebuild. This tested research boundary is not a serving
integration, a complete behavioral Scenario model or a world model.
