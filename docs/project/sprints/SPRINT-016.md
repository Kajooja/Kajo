# Sprint 016 — Expected ratings and each user's rating style

Status: **IN PROGRESS — baseline #398, prospective capture #400, declared evaluation #402 and content-preference challenger #405 accepted; guarded forward source #407 accepted; explicit operator connection #409 accepted; session-pooler/private-runner #411 accepted; bounded private-probe diagnostics #413 accepted through #414; isolated BOOK/MOVIE research integration #417 is active; owned DEVELOPMENT continues from private records; quality and serving admission remain open**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: [Sprint 015](SPRINT-015.md) frozen inputs/evaluation; canonical
[PREDICTION_MODEL](../../domain/PREDICTION_MODEL.md) owns the objective.

## Bounded external numeric research — #417

The separately reviewed Book Genome subset now has an undated matrix contract,
pinned ratings-only intake and built static baseline replay. Its 500-reader
exposed cohort validates implementation arithmetic, source/scale separation and
masked-evidence controls. It does not close the native later-label, supported
rating-style, recommendation-benefit or Sprint 016 quality gates. MovieLens is
reused through its existing dated path. See [research commands and limits](../../../research/README.md#book-genome--undated-static-research-417).

## Outcome

Produce a supported post-experience expected rating on the user's own scale and
rank eligible Items by that expectation. Learn how each user uses 0–10 while
keeping uncertainty and sparse support explicit. The target is not ten counts,
`P(R=10)`, a universal 9+ label or a convex high-tail reward.

## Scope and deliverables

1. Freeze the target/conditioning contract: rating of an experienced Item under
   the available Profile/state/context; retrospective and new-experience cohorts
   remain separate. Missing ratings are unobserved, not zero. Report interest,
   experience and rating-label availability separately; saves are not satisfaction
   labels and do not directly train the rating target.
2. Implement a reproducible hierarchical baseline: source-defined domain/item
   prior, user rating tendency, supported content preference and regularization
   toward shared priors. Compare a user-mean baseline, item/domain prior and the
   existing ranker on their supported targets. Do not rescale the old rank score
   and call it a grade prediction.
3. Add a versioned rating-style component. Start with pooled location and, only
   with sufficient varied support, scale/ordered thresholds. Anchor latent
   location/scale or threshold conventions so parameters are identifiable.
   Strong shrinkage handles one rating, constant ratings, narrow ranges and
   outliers. Constant raters can retain a supported mean while spread/threshold
   or taste-differentiation parameters remain unidentified. Report unidentified
   style separately from an estimated extreme taste.
4. Separate rating habits from selected experience quality as far as evidence
   permits: high average ratings can reflect good choices, not generosity. Do
   not infer personality, manufacture common latent satisfaction from raw marks,
   or stretch a user's observed minimum/maximum to 0/10.
5. Retain raw labels and predict back onto the user's own scale. Any centered or
   normalized representation for peer learning is fit on training prefixes only,
   versioned and reversible. A positive affine conversion within one user does
   not change candidate order; nonlinear mappings require an explicit objective
   decision, not a silent optimizer change.
6. Implement per-answer state/parameter updates with bounded strength. Keep an
   evaluated point-mean contract initially; distributional output may be added
   only under the same held-out protocol. Rating-style changes over time/domain
   require evidence and shrinkage rather than a free parameter per session.
7. Publish model/data/artifact lineage, coverage, resource cost and a concrete
   admitted/rejected/insufficient comparison. Provider/catalogue rights and any
   external prior follow DATA_ENRICHMENT; native-only fallback remains runnable.

## Required tests and acceptance

- Equivalent synthetic preferences under generous and strict rating styles
  produce corresponding own-scale forecasts and consistent within-user order.
  Fixtures include a user whose strongest ratings are 8 and another who uses 10,
  plus low-end 4 versus 0, without labelling these endpoints as psychological facts.
- Sparse, constant, corrected, imported, late and withdrawn evidence remains finite,
  bounded, traceable and shrinkage-controlled. A low mark is interpreted relative
  to supported style, not automatically as a universal dislike threshold.
- Test prediction-before-update, no target leakage in scaling and online/full-replay
  parity. More evidence may reveal error; no monotonic success is promised.
- Before final evaluation, lock user-macro MAE/RMSE, calibration-in-the-large or
  conditional mean checks, ordinal secondary diagnostics, coverage and baseline
  deltas under the common protocol. Mean prediction uses a mean-appropriate loss;
  MAE alone estimates a median-optimal target and cannot define the objective.
- Report raw own-scale error and anchored normalized diagnostic slices, including
  cold start, narrow-scale users and both domains. No result can be won solely by
  prolific/generous users or selective forecast abstention.
- Admission requires the predeclared useful improvement/noninferiority decision
  against the relevant baseline, not only synthetic scale tests. Offline rating
  accuracy does not alone establish causal recommendation uplift.

## Stop conditions and non-goals

Do not serve unsupported probabilities or personalized style parameters. If a
complex style model fails, retain a simpler pooled/regularized mean model and
record the rejection. If no useful numerical baseline can be supported, keep the
quality gate open and collect permitted evidence; do not substitute list-add
success or reduce thresholds after observing test results. No large neural model,
personality profiling or raw cross-user grade comparison is required.

## Coverage and next handoff

EB-02/03/07/08; sections 1, 6–7, 15, 19, 21, 30, 32, 44, 49, 51.
Requirements `MVP-ALG-006/007/010/011`, `MVP-TASTE-003/004/005/007`.
Next: [Sprint 017](SPRINT-017.md), evidence-supported adaptive state.

## Evidence and completion rules

Apply the [Engine V1 quantitative protocol](../ENGINE_BUILDOUT.md#engine-v1-quantitative-protocol)
and keep separate design, source/CI, offline quality, hosted admission and observed
runtime statuses. Current actions are list saving (interest), numeric rating
(experienced Item) and contextual SKIP with unknown reason. SKIP supplies no
numeric rating or inferred dislike/recognition; preserve old stored semantics.
Do not add an En tunne control or require a separate consumed action.

Aggregate V1 acceptance is `MVP-ALG-012`. Each implementation issue names its
bounded deliverable under #302 and reuses
#336/#232 where applicable. One active packet is recorded in STATUS. Required
source checks, relevant native tests and changed-surface observations apply;
a passing fixture alone does not establish predictive usefulness. Correctness,
source withdrawal and authorization failures block admission. Rejected optional
methods retain a working baseline and a written decision; an unmet mandatory
quality gate stays open. A missing physical-device observation is recorded and
does not become an invented pass.

## First source packet — #398

[Issue #398](https://github.com/Kajooja/Kajo/issues/398) follows accepted #397.
It implements the Personal/domain mean control and the first shrunk domain-prior
location baseline, with raw canonical resolved native labels and a same-cutoff
candidate pool. This bounded source test does not implement content fit,
identified response spread, model selection, final evaluation or serving.
All Items in this location-only model retain equal forecasts; no jitter creates
pretend differentiation. No permitted prior means Personal-mean fallback;
no labels/prior means unavailable. No external prior is admitted by this packet.

The native bridge joins `NATIVE_RATING.source_event_id` to the original Event
rating and exercises correction, clear, Undo, withdrawal, domain/Profile isolation,
native microsecond cutoffs and pre-action input/oracle capture. The pure core
test calls TypeScript before later answers; the native fixture replays TypeScript
after the SQL batch against its retained inputs and independent numeric oracle.
The fixture answer updates history for another candidate, rather than establishing
a prospective forecast/outcome pair. This packet alone does not establish
before-answer forecast persistence; accepted #400 supplies that later boundary.
Event weights and old
rank scores are never inverted into grades. Snapshot observation is not a
certificate that a past transaction saw the same prefix. Existing feasibility
reports retain their ordinal-only capability contract.

Accepted [#400](https://github.com/Kajooja/Kajo/issues/400) supplies durable
prospective numeric capture and later-label reconciliation using the same
computation. Accepted [#402](https://github.com/Kajooja/Kajo/issues/402)
adds declared numeric evaluation coverage and the Profile-macro report, before
mean-loss comparison under development-selected requirements and
an untouched final window. Existing Sprints 014/015 acceptance remains open;
these source packets do not make the whole Sprint 016 or Engine V1 complete.

## Declared numeric evaluation source — #402 (accepted)

The accepted source adds a versioned declaration, complete declared-opportunity
inventory adapter and pure Profile-macro report. Its declaration pins the roster,
retrospective first-report target, BOOK/MOVIE scope, deterministic delivered-target
selection, source/model/control versions,
capture windows/checkpoints and chronological development/selection/final split.
Retain the full integer **0–10** scale. Experience time remains unknown; this is
not a new-experience cohort or an exposure/uplift claim.

Every declared opportunity and zero-opportunity/zero-scored Profile remains
visible. Distinguish unavailable capture/forecast, pending/expired follow-up,
first answer and grouped source-withdrawal/outside-path retirement. Missing
expected identities leave completeness unresolved, and withdrawal must not select
a favorable survivor cohort. Source-owned allocation capacity is separate from
the declared cohort cap: #400's 128 retained allocations are not a lifetime
budget, and source erasure does not permit refilling the evaluation cohort.

Use frozen horizon/first-answer microseconds for historical checkpoints; later
correction, Undo and clear do not rewrite the measurement. Report per-Profile
MSE, MAE and bias, equal-Profile macro summaries, sqrt(macro MSE) and same-target
paired Profile-level deltas with explicit coverage/null denominators. Native-only
candidate and Personal-mean control currently coincide; zero delta is not useful
improvement. File hashes establish consistency, not trusted preregistration or
native census completeness. Final evaluation requires complete numerical
requirements selected from development evidence before the untouched final
window; descriptive source fixtures retain `qualityAdmission: NONE`.

The source includes the private declaration/report CLI and logically read-only
owner census. [PR #404](https://github.com/Kajooja/Kajo/pull/404) is accepted after
all six [CI #823](https://github.com/Kajooja/Kajo/actions/runs/41348632726) gates,
**2,372 tests and four configured iOS/Android exports**. The new native evaluation
summary matches independent fixture expectations (MSE 49, MAE 7, bias 7, paired
delta 0) and three exact source hashes. It does not retain raw census/report
inputs for independent full-report reconstruction. No observed quality,
mobile-route, hosted-installation or serving acceptance follows; STATUS and the
PR own the complete source/check receipt.

## Frozen-content challenger source — #405 (accepted)

[Issue #405](https://github.com/Kajooja/Kajo/issues/405) is accepted through
[PR #406](https://github.com/Kajooja/Kajo/pull/406). The model fits original integer
**0–10** labels with a bounded, strongly regularized content residual around the
Personal/domain mean, retaining that mean as the fixed control. Its small
versioned structured-feature allowlist freezes training and candidate assertions,
identity, provenance, permission manifest and availability at the prediction cut.
Later mutable metadata cannot replace historical feature inputs.

The private v2 capture and evaluation adapter preserve old capture/model/report
versions and the original first-answer writer. Sparse, constant, narrow-range,
missing-feature and identical-feature cases have explicit support/fallback;
identical supported inputs retain ties. Source tests exercise supported
differentiation, strict/generous own-scale behavior, prediction-before-update,
correction/withdrawal and full-prefix reconstruction. Catalogue relation fences
hold through actual TypeScript computation and native commit; an already-running
writer produces `55P03`, full rollback and an explicit later retry.

All six CI #827 gates pass with 2,416 tests and four configured exports.
Independent native review verifies 39 content/evaluation cases, six blocking and
five NOWAIT witnesses, retained baseline/prospective cases and grades, populated
upgrade and complete cleanup. The retained synthetic inputs support independent
reconstruction of three forecasts / 72 points and the census/report arithmetic.
The deliberately losing content fixture remains losing; source acceptance does
not establish usefulness. Model/configuration/feature lineage and support/resource
limits remain explicit, with `qualityAdmission: NONE` and `servingActivation: NONE`.

## Guarded private numeric forward source — #407 (accepted)

[PR #408](https://github.com/Kajooja/Kajo/pull/408) accepts the exact 55+56
builder and bounded native rehearsal after all six CI #829 gates, 2,456 tests
and four configured exports. Source/tested/accepted tree is
`47a456f7eb048b6b0e757e6837258063748e5e90`. The canonical fresh lineage, exact
source pins, preserved-state checks and optional54 exclusion remain unchanged.
The native receipt and its limits are retained in PR #408. Runtime execution
records are separate private evidence, not a reason to redo accepted source.

## Accepted connection #409 and current session-pooler/private-runner #411

[Issue #409](https://github.com/Kajooja/Kajo/issues/409), accepted through #410, adds a bounded direct
psql binding around the existing isolated-session transport and a read-only
connection probe. Explicit private configuration pins the target and CA/password
file references; certificate/hostname verification and sanitized errors are
required. The probe exercises one transaction across actual JavaScript work and
rolls back without reading application rows. Disposable native CI verifies the
same protocol, while hosted TLS/credentials and genuine observation remain
separate acceptance. No model, schema or public/mobile route changes.
[PREDICTION_MODEL](../../domain/PREDICTION_MODEL.md#private-operator-connection--sprint-016--409)
owns usage and limitations. STATUS names the current source/check receipt.

[Issue #411](https://github.com/Kajooja/Kajo/issues/411) adds an explicitly configured
Supavisor session-mode path for IPv4-only operators, fixed session-setting
verification and a manual private-repository-only probe template. The direct
contract remains supported. The template is outside executable public workflows;
actual private repository/credential setup, hosted pooler/TLS behavior and the
private job result remain separate prerequisites. No model, migration, collection
or public/mobile endpoint is added. The same native CI session tests the shared
initializer without an extra reset. STATUS and the implementation PR own final
source/CI acceptance.

### Bounded private-probe diagnostics — #413

#411 is accepted through [PR #412](https://github.com/Kajooja/Kajo/pull/412), all
six CI #833 gates, 2,474 tests and four configured exports. The exact session
initializer and read-only native probe pass; private execution is separate.
[Issue #413](https://github.com/Kajooja/Kajo/issues/413) adds allowlisted failure
stage/cause metadata and bounded transport hints. Unknown errors remain unknown;
raw process/server output, paths, SQL and secrets never enter the report. Existing
source/owner/runtime/TLS guards, cleanup and no-retry behavior remain unchanged.
Synthetic child-process failures test disclosure boundaries without hosted inputs.
#413 is accepted through [PR #414](https://github.com/Kajooja/Kajo/pull/414),
all six CI #835 gates, 2,477 tests and four configured exports. STATUS records
the exact public source/tested/accepted identities. This acceptance does not
publish or certify private operational execution.

A genuine declared DEVELOPMENT cohort through an authorized capture path remains
the experiment needed to select regularization and numerical quality, coverage
and precision requirements before SELECTION and untouched FINAL windows. Establish
the actual owner/Profile/domain scope, valid provider feature-use review,
independently retained pre-window declaration, held trusted SQL connection and
real first-answer path. Reuse the accepted capture, answer, census and report
APIs. The ordinary mobile rating writer is not this private first-answer route;
complete capture commitment before the owner supplies the later actual 0–10
answer through the dedicated writer. Never reuse an earlier answer or silently
route a pending evaluation through ordinary rating. Keep unavailable/busy
captures, missing answers and empty Profiles visible;
never backfill old labels or refill a declared cohort after erasure.

Insufficient observations require an explicit collection dependency rather than
invented thresholds or a synthetic usefulness claim. New embeddings, external
priors, Working-state activation and broad UI changes are outside this packet;
broader adaptive state, transfer and Shared work retain their later sprint scopes.

## Delivery record

- Design: planned by the owner's 2026-10-25 engine-first decision.
- Source / CI: #398 is accepted through [#401](https://github.com/Kajooja/Kajo/pull/401),
  main `2d09d87bb8a4274deff0fd0aa099fdc82b462037`, tested tree
  `03ba583afbc26bbabd2ed548c4fb0b98a5912036`. All six CI #816 gates pass,
  including 2,294 tests and four exports. Its independently checked native
  artifact reproduces the 15 numeric cases; all integer grades **0–10** are covered.
- Durable capture source / CI: #400 is accepted through
  [#403](https://github.com/Kajooja/Kajo/pull/403), main
  `23e7d8ee2bb3be02be6d93b33fd1d71eb5697244`, with source/tested/accepted tree
  `42f2c01d844a5eb4004c1318ca4c90e27d8a25cd`. All six required
  [CI #821](https://github.com/Kajooja/Kajo/actions/runs/41316036602) gates pass,
  including **2,332 tests and four configured iOS/Android exports**. The native
  artifact independently verifies 24 prospective cases and all eleven grades
  0–10, actual compiled TypeScript before the committed first answer, five
  independent-session lock proofs, populated-upgrade preservation, closed new
  ACLs and canonical cleanup. Correction/Undo/clear, unavailable support, expiry,
  outside-path retirement and physical withdrawal retain their distinct effects.
  All 2,880 performance measurements and original rules independently match with
  no rule failures in this run; `admission` remains `NONE`. The PR records exact
  artifact identities and limits, including no hosted or mobile-route activation.
- Declared evaluation source / CI: #402 is accepted through
  [#404](https://github.com/Kajooja/Kajo/pull/404), main
  `1bc1ea7e6c83b369692bcfc862386ab157475f7e`, source
  `34786d1b5ec19ad6358acfcfc7c3068ebc0a4469`, tested merge
  `34a79573cfe9997efd20984eb9e47a57211d50f8`, source/tested/accepted tree
  `7a4290d8f04beaec0df724bc1286ba141dc7533a`. All six CI #823 gates pass,
  including 2,372 tests and four configured iOS/Android exports. Native review
  retains 15 baseline cases, 24 prospective cases, all eleven grades, five lock
  proofs, upgrade preservation and cleanup. The new evaluation section supports
  source-bound summary verification, not raw census/report recomputation.
  Performance review recomputes 2,880 measurements, 6,336 quantiles and the original
  72 cohort/36 mechanism rules. One original regression fails: OFF_CATALOGUE_HISTORY,
  1,000 Items, `taste-personal-next`, exact retry, pair 3, p50 9.553 → 10.860 ms
  (+13.68%, allowance +10%); resource checks pass. The failed diagnostic is retained,
  `admission` remains `NONE`, #391 stays uninstalled and #394/#399 remain deferred.
- Content-preference source / CI: #405 is accepted through
  [#406](https://github.com/Kajooja/Kajo/pull/406), main
  `1e58f0025ecf230ac4de0914f31be1615dc209a1`, source
  `62f5482679030782aec30a9efbbd9956247ce838`, tested merge
  `329a2ca5b3ebe92bad047e0334a673751baab104`, source/tested/accepted tree
  `c07738bd56229aada73871b4aba31b6714ec0eca`. All six CI #827 gates pass,
  including **2,416 tests and four configured iOS/Android exports**. Native review
  verifies 56 installation files, 15 baseline / 24 prospective / 39 content cases,
  all eleven grades, six content blocking / five NOWAIT witnesses and five legacy
  locks. Populated upgrade preserves 96 old tables and 291 function identities/
  metadata, allowing only three exact old-body patches. Independent arithmetic
  reconstructs three frozen forecasts / 72 points and the complete raw synthetic
  census/report against six source hashes. The candidate fixture MSE remains
  53.77777777777777 versus control 49, paired delta +4.7777777777777715.
  Performance review retains two original rule failures: EMPTY/40/fresh Taste
  pair 3 p50 +6.40% versus +5% allowance; CATALOGUE_HISTORY/1000/Personal Discovery
  pair 1 calls 502→503 versus required equality. All resource checks pass;
  optimization admission remains NONE. PR #406 retains exact artifacts, earlier
  failed runs and the limits; no hosted/collection/serving acceptance follows.
- Guarded numeric forward source: [#407](https://github.com/Kajooja/Kajo/issues/407)
  accepted through #408 / all six CI #829 gates. Exact 55+56, source/native
  validation, operational execution and observed DEVELOPMENT are distinct facts.
- Operator connection: #409 accepted through #410 / all six CI #831 gates,
  2,465 tests and four configured exports; the actual native read-only probe passes.
  Hosted TLS/credentials and genuine observation are not established by that CI.
- Session pooler/private runner: #411 accepted through #412 / all six CI #833 gates,
  2,474 tests and four exports. Source/CI and private execution remain separate.
- Bounded private-probe diagnostics: #413 accepted through #414 / all six CI #835
  gates, 2,477 tests and four configured exports. Native probe/session checks pass,
  all 43 subchecks and the 56-entry manifest remain intact. Private operational
  execution and observed prediction usefulness remain separate evidence.
- Current handoff: owned numeric DEVELOPMENT preparation through the existing
  connection, capture, dedicated first-answer, complete census and report APIs;
  #415 reconciles the source acceptance and preserves the private/public boundary.
- Quality / runtime admission: open.
- Evidence, exact source versions, installed artifacts and known issues: record
  in this sprint and STATUS as each bounded packet finishes.
