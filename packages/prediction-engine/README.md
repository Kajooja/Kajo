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
| `./ranking-conformance` | Compare complete frozen ranking snapshots with exact scope, policy, candidate identity and eligibility, and an explicit scalar tolerance; no scoring or outcome evaluation |
| `./adapters/kajo-native-prediction` | Normalize actual private native run/candidate snapshots through the existing Kajo scope adapter; preserve declared candidate acquisition and input clocks; ranking scores remain uncalibrated |
| `./working-state` | Pure `deriveWorkingState` and default-OFF `scoreWorkingAdjustment`; bounded independent current-session Item support, correction closure and explicit STATIC/ORDERED controls |
| `./adapters/kajo-working-state` | Strict `normalizeKajoWorkingSession` for authorized Personal canonical Event/session snapshots; no database reader, writer, app import or authorization replacement |
| `./working-evaluation` | Pure `summarizeWorkingSupport`, `freezeWorkingEvaluationPlan`, `evaluateWorkingPlan` and `evaluateWorkingBatch`; conditional OFF-exposed pairwise comparison, planned coverage and Item weight concentration; no capture writer or admission |
| `./adapters/kajo-working-evaluation` | Strict `normalizeKajoWorkingEvaluationPlan` for supplied frozen Personal sources and all three actual native comparison rows; honest proxy clocks, v3 frozen-prefix candidate support and explicit older-generation unavailability; no native label writer |
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

The native ranking conformance boundary consumes frozen `candidateRequest` and
`predictionInput` together with the complete candidate trace. It does not map
native ranking scores to the E1 rating estimator's `Estimate`, invent feature
availability, or recompute the SQL scorer in TypeScript. The database fixture
compares four delivery sources with the existing baseline shadow worker on the
same frozen pools; two explicit evaluation cases use the existing frozen score
helper and preserve non-delivery. The same JavaScript verifier runs in the native
PostgreSQL CLI gate.
Admission requires precision-preserving captures and lossless numeric export.
Rounded legacy Working `asOf` values that disagree with their exact cutoff are
rejected; the adapter never repairs them or grants clock tolerance. The fixture
scopes `extra_float_digits=3` to its rollback transaction, matching existing
precision-pinned page writers, and tests rejection under rounded serialization.
Changing current catalogue rows must not change that replay. Delivery selection
and hypothetical shadow selection never establish an impression or an outcome.
Protocol-2 frozen continuation pages require a separate source-clock mapping and
are rejected by this bounded adapter. See the canonical
[native boundary](../../docs/domain/PREDICTION_MODEL.md#native-ranking-adapter-and-conformance--sprint-015).

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

## Adaptive Taste opportunity selection

`./taste-selection` exports pure `selectTasteOpportunity`; the independent root
estimator and native ranking remain unchanged. `./adapters/kajo-taste-selection`
exports `normalizeKajoTasteSelection` and `kajoTasteStages` for a trusted,
already-authorized own PersonalProfile snapshot. Neither module reads/writes a
database, creates anonymous identity or admits production policy.

The server caller supplies a **frozen** catalog/feature cutoff, rating scale,
stable stage/configuration assignment, canonical candidates, append-only ordered
presentation ledger, complete retained answer revisions and acknowledged stage
transitions. It must preserve those inputs and persist actual presentations and
responses. Shape checks and an owned-Profile descriptor do not authenticate that
caller, prove historical feature availability or replace authorization.

Each invocation returns one immutable QUESTION, TRANSITION or STOP. An unanswered
current question is replayed without consuming a new opportunity. Previously
presented Items are never repeated, moved or counted again on extension. Latest
visible revisions replace earlier answers; duplicate identical revisions count
once, conflicting revisions/clock regressions reject input and future revisions
do not contaminate the current prefix. A withdrawn earlier answer loses support
without repeating its Item; withdrawal of the current answer reopens that same
question. Later presentation requires a preceding terminal answer in its retained
history, even if subsequently withdrawn. UNKNOWN contributes no taste support;
NOT_INTERESTED remains distinct and is not counted as a known rating. A rating of
zero is a genuine known answer. Draft ratings are not inputs to this policy.

For the same pool/ledger, PRIOR_ONLY orders by the catalog recognition heuristic.
ADAPTIVE uses the fixed versioned score
`0.65 * recognitionPrior + 0.20 * diversity + 0.15 * informationProxy`, with
lexical Item-ID ties. Diversity is one minus the largest weighted feature Jaccard
overlap with any presented Item. The information proxy is the candidate-feature
weighted mean of `1 / (1 + featureSupport)`; each latest rating/not-interest
answer adds its normalized Item features to support. It measures coverage rather
than information entropy or expected satisfaction. Rating direction does not
change this coverage proxy. Missing priors/features contribute zero; feature
mass normalization avoids awarding information merely for extra tags. These are
inspectable, uncalibrated heuristics, not recognition probabilities, accuracy,
independent outcome sample sizes or demonstrated quality gains.

Default source configuration requires at least 12 presented opportunities, allows
at most 24, and uses **eight** known ratings as a provisional completion-support
threshold. It deliberately does not inherit logged-in cold-start-v1's six-rating
gate. The Kajo stage assignment proposes ten MOVIE opportunities, an acknowledged
transition, then ten BOOK opportunities. Unknowns count as opportunities rather
than required ratings. Each nonfinal stage advances at its quota or genuine
catalog exhaustion. The final stage can extend to the maximum if known ratings
remain insufficient. Sparse/exhausted catalog or the opportunity cap ends with
explicit fail-open support; existing completed setup is reused. Generic callers
may configure up to four disjoint-domain stages whose target total is within
12–24; tests also execute a synthetic non-media system task.

Bounds are 256 supplied candidates, 64 normalized 0..1/missing feature dimensions,
24 unique presentations, eight retained revisions per Item and four stages.
Features/artifacts after the frozen catalog cutoff are unavailable even when the
session clock advances. The Kajo adapter collapses duplicate native binary tags;
undiscoverable or mock-only/missing-provider Items are ineligible. Incompatible
representations, unsafe scope/shape/bounds and premature transitions reject.

Results retain `nativeActivated=false`, `qualityAdmitted=false` and unavailable
uncertainty. The provisional threshold/weights need real recognizability,
completion and first-session usefulness evaluation against PRIOR_ONLY. Server
TasteSession, anonymous identity, retention/deletion/abuse/measurement, frozen
holdout prediction challenge and canonical preview are separate required work.
No ranking score is converted to a 0–10 predicted rating and no challenge score is
manufactured by this selector. Calibration/import answers must retain their
canonical source semantics rather than becoming native/Working evidence.

## Sequential adaptive Taste reference

The optional `@kajo/prediction-engine/adaptive-taste` export provides
`createAdaptiveTaste`, `advanceAdaptiveTaste` and `inspectAdaptiveTaste` for #336.
It is a pure reference with synthetic media/non-media conformance fixtures, not
an activated native scorer or a persistent mobile session API.

A trusted caller supplies authorized, versioned canonical forecast pools with
an exact committed response prefix. OFFER freezes one question; ANSWER retains
its first measurement; only a later snapshot may consume that answer. CORRECT,
WITHDRAW_SOURCE, PAUSE and RESUME preserve command identity, source dependencies
and bounded state. The caller owns authentication, atomic compare-and-swap,
persistence, actual evidence projection and complete erasure of copied data.

Numeric rating magnitude affects the reference question policy. UNKNOWN is not
a rating; explicit not-interest remains separate. Ordinal evaluations use one
earlier same-domain pool in which both labels were unseen. Per-step scores never
share a comparison scale. Corrections invalidate the affected evaluation rather
than retroactively improving its first measurement.

The declared readiness policy requires distinct supported feature patterns,
full declared-domain coverage, prospective ordinal agreement and compatible
ordering stability. Incompatible feature versions and missing overlapping values
do not imply diversity or transferable support. All-tied forecasts may collect
initial labels but cannot establish readiness. Bounds, pause and missing evidence
return explicit insufficiency, never an automatic pass. All thresholds are
provisional; uncertainty is unavailable, native activation and quality admission
are false. Taste-to-Discovery continuation belongs to the native successor and
must preserve the same Profile with its remaining uncertainty.

Defaults cap 48 opportunities, 160 normal commands, 128 retained candidates per
pool and 1 MiB state, with bounded first-answer/lifecycle reserves. The separate
PRIOR_ONLY policy is a fixed recognition control. Reference fixtures demonstrate
behavior and leakage protection, not empirical recommendation improvement.
The [canonical contract](../../docs/domain/PREDICTION_MODEL.md#sequential-adaptive-taste)
owns native sequencing and acceptance.

### Canonical forecast selection opt-in — accepted source

[#345](https://github.com/Kajooja/Kajo/pull/345) adds this accepted explicit
portable opt-in. All five final-source CI #676 gates pass; its companion SQL
forward is installed/verified as recorded in [STATUS](../../docs/project/STATUS.md).
The package remains a pure reference, without native activation or quality
admission. For a caller's already-authorized
initial scope, clock, declared domains and rating scale:

```ts
import {
  adaptiveTasteCanonicalDefaults,
  createAdaptiveTaste,
} from '@kajo/prediction-engine/adaptive-taste';

function createCanonicalTaste(
  input: Omit<Parameters<typeof createAdaptiveTaste>[0], 'policy'>,
) {
  return createAdaptiveTaste({
    ...input,
    policy: { ...adaptiveTasteCanonicalDefaults, control: 'ADAPTIVE' },
  });
}
```

This sets `selectionMode: 'CANONICAL_ORDINAL_V3'` and policy version
`adaptive-taste-canonical-ordinal-v3`. Keep using fresh authorized OFFER pools
for the exact committed answer prefix; the reference does not fetch forecasts.
Existing calls without this opt-in and retained states without `selectionMode`
keep their original policy. Do not mutate retained state into the new mode.

Preference becomes the tied midrank of each supported unseen informative
candidate's **current same-domain canonical forecast**: equal scores are neutral
`0.5`, with the configured tie tolerance. Scores from different domains or earlier
prefixes are never compared, and the old local rating-similarity proxy is not
added again. Default utility is `0.35 * recognition + 0.45 * preference +
0.10 * diversity + 0.10 * coverage`, ordered before progress/count tie breakers.
If selectable domains differ by at least two presentations, choose among the
least-presented domains first; missing support never forces an invented question.
Immutable `selectionTrace` records the current pool, ordinal basis, preference,
candidate count and coverage intervention/count/maximum-lead fields. Optional
`control: 'PRIOR_ONLY'` in this new mode keeps recognition-only utility plus that
declared guard. The default/retained control behavior is unchanged.

The corresponding accepted SQL forward assigns only new sessions
`CANONICAL_FORECAST_V3` through the unchanged v2 wire/queue; it does not turn this
package into the SQL ranker. This ordinal preference is neither a predicted
grade nor a probability of a ten. START-time native pool refresh/refill, shared
Ohita feed/artwork, recent prior, full readiness, actual
device behavior and measured usefulness remain separate work. See the
[source boundary](../../docs/domain/PREDICTION_MODEL.md#canonical-forecast-selector-source--2026-10-16).

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
PredictionRuns. The `native-working-capture-v1` / v2 generations and their
adjustment-only explanations remain supported with frozen bytes. Fresh sources
use reset-aware `native-working-capture-v3` / `personal-working-features-v3`,
`+personal-working-off-v3` and `personal-working-shadow-v3`. Each v3 candidate
freezes a compact dense binary projection of the actual ranking-statement tags
in the capture's original dimension order, bound to its retained working
schema/artifact. A versioned SQL consumer serves
fixed OFF, returning the exact legacy score; owner-only generation-matched
comparisons actually score those frozen components under the original pool and final delivery
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
Input tags are known in their capture snapshot. Candidate projections record
`SOURCE_RANKING_STATEMENT_SNAPSHOT`, `availableAt:null` and UNKNOWN commit
availability because the ranking statement can observe a later READ COMMITTED
snapshot than the input capture. Their `asOf` binds only that input reference;
it is not certified historical availability or demonstrated semantic transfer.
Stored creation remains a proxy, commit availability UNKNOWN, and historical/
learning/ON admission remains false.
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

## Private owner Working report

Run `npm run engine:working -- INPUT_MANIFEST OUTPUT_REPORT` on Linux/macOS.
The command reads already-authorized native snapshots, reconstructs frozen plans
through `./adapters/kajo-working-evaluation`, normalizes immutable captures through
`./adapters/kajo-working-outcomes`, and calls `evaluateWorkingBatch`. It makes no
network/database writes. Reports are private mode-0600 exclusive files outside
Git repositories/worktrees; inputs and reports retain sensitive audit lineage
and require owner-controlled retention and invalidation after source withdrawal.

The strict JSON manifest has these fields:

| Field | Required value |
| --- | --- |
| `contractVersion` | `kajo-personal-working-manifest-v1` or explicit `kajo-personal-working-manifest-v2` |
| `selectionBasis` | `OWNER_DECLARED_NATIVE_ENROLLMENTS` |
| `evidenceBasis` | `ENGINEERING_FIXTURE` or `OWNER_AUTHORIZED_NATIVE_SNAPSHOTS` |
| `scopeId` | One stable opaque alias namespace for the batch |
| `evaluationAsOf` | Finite millisecond cutoff, including representable fractions |
| `entries` | At most 128 native enrollments and 128 total planned pairs |

Each entry contains `expectedScope` with native `actorUserId`, `profileId`,
`sessionId`, `sourcePredictionId` and `enrollmentId`; `planSnapshot` is the complete
`KajoWorkingEvaluationSnapshots` input with the actual stored enrollment.
`outcomeSnapshot` is either null or `{capture, references}`, using the immutable
native capture and `KajoWorkingOutcomeSnapshots.references`. The command derives
its native scope, enrollment and frozen plan rather than accepting a second
caller-supplied portable plan. Input bytes are bounded to 16 MiB and report bytes to 32 MiB.

Version 2 additionally requires `planSnapshot.sourceGenome`: the actual immutable
registry row referenced by `sourceRun.genome_id`. It passes the supplied scope,
source run, complete candidate pool, genome and observed read time through
`normalizeKajoNativePrediction`. Only fresh `DELIVERY` sources are admitted;
explicit Taste `EVALUATION` and copied protocol-2 continuation sources cannot
enter this exposure cohort. Precision-preserving stored clocks and lossless
numeric export are prerequisites. Unsupported older snapshots stay immutable.

The native final ranking is compared with the retained OFF control across the
complete pool, including candidates not selected for delivery. Identity,
eligibility, tier, rank and selection are exact. The additional generic comparison
uses a fixed absolute score tolerance of `1e-12`; the existing exact OFF score
checks remain mandatory, so this does not admit a rounded old comparison.
This binds two retained views; it does not independently rescore their inputs.
Native source scores, source ranks and opaque inputs are validated and retained
only in memory. Reports emit bounded aliased conformance summaries and existing
coverage, never the raw native ranking, genome or frozen state.

Version 1 retains its original input shape, output and semantics. A v1 manifest
cannot add the v2 genome field, and v2 cannot omit it. The versioned report makes
the stronger source admission explicit without silently upgrading old receipts.

Every enrolled pair remains in coverage, including absent/unavailable captures.
Canonical native identities and stable aliases prevent relabelled source,
subject/Item pair, terminal Event or exposure reuse from multiplying units.
Reports include actor/session and Subject/session clusters, unavailable
uncertainty and independence not established. Engineering fixtures contribute
zero observed evidence units. A declaration of owner-authorized snapshots does
not authenticate files, certify current access or establish an untouched cohort.
Predeclare the cohort/report window separately before observed quality or canary
claims; this command admits no model, learning or native activation.

## Private Working cohort protocol

The separate cohort command fixes selection rules before a future enrollment
window and reconciles a supplied complete inventory against those rules:

```bash
npm run engine:working:cohort -- declare REQUEST DECLARATION
npm run engine:working:cohort -- report DECLARATION INVENTORY REPORT
```

Use existing, currently authorized PersonalProfile owners. The repository has no
real cohort roster or private enrollment inventory; its executable fixtures are
engineering evidence. Creating a protocol file does not establish that a real
untouched cohort exists. No account creation, history reset, hosted deployment
or automatic model admission is part of these commands.

The strict private declaration request contains:

| Field | Contract |
| --- | --- |
| `contractVersion` | `kajo-personal-working-cohort-request-v1` or explicit `kajo-personal-working-cohort-request-v2` |
| `scopeId`, `cohortRef` | Opaque scoped aliases without embedded native UUIDs |
| `roster` | 1–128 explicit `{actorUserId, profileId, actorRef, subjectRef}` records; stable, injective aliases in `scopeId` |
| `enrollmentWindow` | Future `{startAt, endAt}` in milliseconds; selection is half-open `[startAt, endAt)` |
| `horizonMs` | 1 second–90 days, an integer multiple of 1,000 ms |
| `settlementMs` | 0–7 days, an integer multiple of 1,000 ms |
| `evaluationAsOf` | Fixed cutoff at least `endAt + horizonMs + settlementMs` |

Declaration records the process clock and a canonical SHA-256 digest. Inventory
and report reference that normalized declaration digest; their arbitrary file
contents are not signed or hashed by it. It is an integrity check on the protocol,
not a trusted timestamp or signature. Start must follow the declaration clock.
The report runs after the fixed evaluation cutoff, without backdating actual
snapshot reads. Existing `snapshotObservedAt <= evaluationAsOf` still applies;
the operator must export authorized snapshots by that cutoff.

The version 1 strict inventory has `contractVersion:
"kajo-personal-working-cohort-inventory-v1"`, `declarationDigest`, `inventory` and
`manifest`. `manifest` is the complete existing Working v1 manifest. Every ledger
row has `{enrollmentId, actorUserId, profileId, declaredAt, pairCount,
firstCaptureStatus}` and must belong to the declared roster/window. Ledger rows
and manifest entries must correspond exactly; omitted/extra enrollments and
excess budgets reject the entire report rather than truncate it. The supplied
inventory's actual completeness remains unestablished by files.

Version 2 uses matching `-v2` request, declaration, inventory, manifest and report
contracts. Its declaration digest additionally pins native candidate-request,
input-clock and adapter contracts, exact clock/precision requirements, DELIVERY
intent and the fixed conformance tolerance. Cross-version combinations reject,
including empty inventories. The v1 declaration bytes and digest remain unchanged.
Both versions use the same roster, window, horizon, settlement, pair-selection,
alias, withdrawal and private-file rules.

All native enrollments in the declared roster/window are selected. Sources must
be requested during that window. Enrollments must use exactly the fixed horizon
and settlement. Each eligible OFF-selected tier below 2 is sorted by frozen final
rank and paired adjacently, with the lower rank on the left; an odd remaining
candidate stays unpaired. Pair choices cannot be replaced by a favorable subset.
Every selected pair and every support state stays in descriptive coverage.
Registered owners with zero selected enrollments remain visible in roster counts.
Existing native identity, alias and input/outcome overlap guards still apply.

Only the first reserved immutable capture, revision 1, is admitted.
This selects the first **capture**, not the first rating. Its unchanged
`personal-latest-terminal-v1` resolution includes later eligible own ratings and
corrections within the declared horizon.
`firstCaptureStatus: "AVAILABLE"` requires that capture; `"NOT_RESERVED"` requires
a null capture and retains all planned pairs in coverage. `"WITHDRAWN"` invalidates
the whole cohort, and revision 2 cannot replace it. Missing/unknown/incomplete
labels do not become failed outcomes. Item support concentration is not an
independent outcome sample size; no significance, uplift or quality claim follows.

The same POSIX private-file limits and mode-0600 exclusive output outside Git
apply. The owner must remove requests, declarations, inventories, snapshots and
reports at withdrawal or seven days after the fixed cutoff, whichever is earlier.
The command rejects an expired report but does not erase retained files or check
current native authorization. A withdrawal invalidates the entire cohort; do not
prune its denominator and reuse the remaining report.

Reports retain explicit unestablished source authenticity, actual preregistration,
inventory completeness and current authorization. Commit availability is UNKNOWN,
independence unestablished and uncertainty unavailable. Engineering fixtures
contribute zero observed evidence units; historical-feature eligibility, learning,
native activation and quality admission remain false. An independently retained
operator/native receipt, exact implementation/backend checkpoint and current
scope/complete inventory are still needed before real observed coverage is claimed.

## Bounded Working evaluation

`./working-evaluation` is a separate descriptive boundary. It neither imports
into the root estimator nor changes `working-state-v1`, existing native SQL or
serving OFF. Its public functions are:

| Function | Contract |
| --- | --- |
| `summarizeWorkingSupport` | Actual candidate-specific STATIC/ORDERED Item coefficients and weight concentration, with zero support for OFF/inactive state; multiple tags collapse onto their contributing Item |
| `freezeWorkingEvaluationPlan` | Immutable scoped source/target/horizon/version plan, one complete common pool of at most 50 Objects and at most 25 disjoint owner-predeclared pairs |
| `evaluateWorkingPlan` | One immutable reconciled outcome capture; all planned pairs retained with a common comparable directional mask across OFF/STATIC/ORDERED |
| `evaluateWorkingBatch` | At most 128 plan inputs and 128 total planned pairs; descriptive coverage and paired agreement/tie/disagreement transitions, with source reuse and Subject/session clusters explicit |

Every control supplies its frozen score/rank for the same pool and its own
creation and availability clocks. The historical source-input cutoff is separate
from later comparison creation and plan selection. Controls may be computed
after that source cutoff, but must exist by the plan boundary; the plan and its
controls must precede eligible OFF exposures and label occurrences. A declared
plan is a supplied artifact, not verified native enrollment. The capture binds
its source, actor, Subject and forecast-session context to the plan; each label
retains the matching Object and Prediction. Later outcome Events may occur in a
different session. The evaluator requires original OFF selection and actual
exposure, same delivery tier, declared target and mature horizon, plus labels
available at the evaluation cutoff. A capture contains at most 50 labels. Valid zero is retained. Missing, unknown, cleared,
immature, unavailable and unexposed labels abstain; no-feedback does not become
rejection. Repeated stable source records cannot count again through a newer
revision. The caller supplies an already-reconciled immutable capture; this
package does not read Events or decide which newly arriving correction wins.
Declared `sourceIds` and `complete=true` are scope/completeness assertions, not
current authorization. The trusted owner must reauthorize access and invalidate
or remove retained captures, plans and reports after source withdrawal. No
native outcome producer or automatic withdrawal/erasure protection is added.

The diagnostic measures ranking agreement, predictor ties and disagreement on
actual exposed pairs. Working adjustments are not rating predictions, so it
reports no RMSE, calibrated confidence, counterfactual outcome or uplift. Target
ties do not invent a winner. Every distinct planned pair remains in the coverage
denominator, including abstentions. Observed native/external and synthetic
counts remain separate; excluded or mixed provenance cannot create observed
quality support. Retained Subject/session clusters have
`independence: 'not-established'`.

The support summary exposes nonnegative per-Item `coefficients`, contributing
Items/time groups and feature coverage. Its `effectiveItems` is the Kish-style
weight concentration `(sum(w) ** 2) / sum(w ** 2)`, or zero with no weight.
This is not a statistical sample size. It cannot certify independence,
uncertainty or sufficient evidence for promotion. Evaluation reports remain
`descriptiveOnly=true`, `historicalFeatureEligible=false`, `learnable=false`,
`nativeActivated=false` and `qualityAdmitted=false`, with unavailable uncertainty.
Proxy creation-time declarations cannot establish
`prospectiveDeclaredEligibility`. The separate Kajo adapter validates supplied
frozen native artifacts through `normalizeKajoWorkingEvaluationPlan` with
`KajoWorkingEvaluationSnapshots`. It accepts generation-matched capture,
features, serving suffix and OFF/STATIC/ORDERED comparison rows for v1, v2 or v3,
including their actual `created_at` and a trusted supplied observation boundary
not after planning. The source binding retains scoped capture/model/mode/domain
lineage, requested/stored creation and the trusted observation boundary, with
commit visibility UNKNOWN and historical eligibility false. Required explicit
scoped handles cover the entire candidate
pool; they are neither authorization certificates nor pseudonymous identities.
The native plan declares `kajo:personal-exposed-rating-order` on the original
0–10 scale. The adapter adds no persistence, prospective enrollment or
immutable strict own-rating capture. Old native v1/v2 explanations retain
`FROZEN_CANDIDATE_FEATURES_UNAVAILABLE`; their adjustment scalars and input-closure
Item features cannot substitute for missing candidate projections.

The native v3 source producer supplies `workingIntent.candidateFeatures` with
`version: 'native-working-candidate-features-v1'`. Each candidate binds its capture
ID and input `asOf`, with `featureSchemaRef` containing `id`, `version`,
`artifactId`, `artifactVersion`, `representationVersion` and `dimensionCount`.
The full schema/artifact stays once in the immutable capture.
`featureEncoding: 'CAPTURE_DIMENSION_ORDER_BINARY_V1'` identifies a dense
numeric 0/1 `features` array whose length exactly equals the captured dimension
count. The adapter validates every binding and decodes entries to an own-key
binary feature dictionary using the original `capture.featureSchema.dimensions`
order; it never sorts, extends or substitutes dimensions. Compact references and
vectors avoid per-candidate full-schema duplication under the unchanged 2-MiB
protocol-2 window limit.

ACTIVE complete captures with valid nonempty schemas supply `AVAILABLE`;
inactive/incomplete/invalid captures retain `UNAVAILABLE` and null features.
An AVAILABLE all-zero vector has actual zero feature coverage. No current
catalog features enter reconstruction or support accounting. V3 plans
also retain `sourceBinding.candidateFeatureSnapshot` with
`availabilityBasis: 'SOURCE_RANKING_STATEMENT_SNAPSHOT'`, `availableAt:null` and
`inputReferenceAt` equal to the source cutoff. Candidate Objects use that cutoff
as the working scorer's arithmetic `availableAt` reference; this is not a claim
of historical feature availability. Plan freezing validates and copies the
explicit metadata, preserving legacy plan shape and scoring semantics.

Active v3 support additionally requires `references.inputObjects`, an exact map
of all captured input Item IDs to scoped `objectRef` handles, and
`references.inputRecords`, an exact map of raw Event IDs plus UNDO targets to
scoped `recordRef` handles. A target outside retained raw rows still requires its
alias. An Item also present in the ranked pool reuses its existing Object handle;
different Items/source records cannot share aliases. The adapter normalizes the
complete frozen Event/session/correction prefix, remaps Object/provenance/UNDO
identifiers before deriving state, and retains no native identifiers in the plan
or report. The trusted caller must keep source-record aliases stable across later
outcome captures so correction or input reuse remains detectable. Aliases neither
authenticate snapshots nor establish current access.

These v3 candidate weights report descriptive concentration, not independent
outcome N, calibrated confidence or observed quality. Prospective enrollment,
a strict label writer and honest availability evidence remain explicit gates.
The existing strongest-effective V1 reward evaluator and its save/rating
semantics are unchanged.

The [canonical evaluation contract](../../docs/domain/PREDICTION_MODEL.md#bounded-offline-workingstate-evaluation)
owns interpretation and remaining quality/admission requirements; STATUS owns
source publication and verification.

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

### Prospective native Working outcomes

`./adapters/kajo-working-outcomes` exports `normalizeKajoWorkingOutcomeCapture`.
A trusted owner supplies already-authorized native enrollment/capture envelopes,
the exact frozen plan and complete scoped Item/pair/control/Event/exposure aliases.
The optional `enrollment` input to `normalizeKajoWorkingEvaluationPlan` binds a
stored server declaration while preserving a later actual `snapshotObservedAt`.
The retained `sourceBinding.prospectiveDeclaration` is a stored proxy, with commit
availability UNKNOWN; shape checks do not authenticate or authorize a receipt.
The trusted private caller preserves the dedicated declaration transaction and
its deferred commit constraint; forcing it immediate and later inserting paired
evidence is outside this protocol.

Kajo's private native producer declares eligible same-tier actual OFF pairs and
all controls in a dedicated committed transaction before own exposure/outcomes.
Mature immutable captures use latest surviving terminal occurrence and exact own
UNDO; valid zero remains observed, ties/clear/not-interest/unknown/missing stay
unscored. This object-observation target retains later own rating origins without
claiming causal forecast attribution or changing strongest-episode reward.
Event/origin-source withdrawal removes whole copied native captures; lifetime
reservations deny reused withdrawn IDs. The pure adapter cannot retract a caller's
already-retained object, so every read/report still needs current authorization
and source withdrawal reconciliation. Complete planned-pair coverage and batch
source/subject-Item reuse checks remain required. Local fixtures establish zero
observed quality units; historical features, learning and activation stay false.

## Neutral contextual skip conformance — #239

Two optional exports supply an executable reference without changing the root
estimator or native serving:

```ts
import { decideContextualSkip } from '@kajo/prediction-engine/contextual-skip';
import {
  applyKajoContextualSkip,
  kajoContextualSkipRecords,
} from '@kajo/prediction-engine/adapters/kajo-contextual-skip';
```

The pure command oracle consumes trusted authorization/source facts and a complete
serialized receipt prefix. It distinguishes private Taste questions from actual
Discovery delivery and validates exact retries, scope, unavailable sources and
same-actor withdrawal. It is not a server writer, storage port, lock or client-side
recommender. Native capability negotiation, persistence/security/lifecycle and
serving integration remain required before activation.

`decideContextualSkip` uses decimal Unix microseconds and a 24-hour server-acceptance
cooldown, scoped to Subject/Object across surfaces and sessions. V1 admits no
trusted semantic Context change, so changing session/mode or supplying an arbitrary
Context token cannot shorten the cooldown. Existing hard eligibility takes
precedence. Confirmed withdrawal removes only its own skip; expiry permits ranking
rather than forcing resurfacing. No rating, recognition or reward is inferred.
The 256-record reference bound rejects incomplete inputs; it is not a native
lifetime quota. IDs in the generic policy use bounded ASCII references; the Kajo
adapter uses canonical lowercase UUIDs.

Canonical contracts: [evidence](../../docs/domain/DATA_EVENTS.md#neutral-skip-conformance-reference--2026-10-16)
and [eligibility](../../docs/domain/PREDICTION_MODEL.md#neutral-skip-eligibility-reference--2026-10-16).
Independent SQL parity runs from `scripts/database/contextual-skip-reference.sql`
in a disposable temporary namespace, outside application migrations. The existing
mobile durable outbox is tested against the oracle; no new production queue or RPC
is introduced. Legacy UNKNOWN/NOT_INTERESTED and 0/5/10 behavior remain unchanged.
