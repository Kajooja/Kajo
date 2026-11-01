# Sprint 016 — Expected ratings and each user's rating style

Status: **IN PROGRESS — baseline #398 and prospective numeric capture #400 accepted; declared numeric evaluation #402 in progress; quality and serving admission remain open**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: [Sprint 015](SPRINT-015.md) frozen inputs/evaluation; canonical
[PREDICTION_MODEL](../../domain/PREDICTION_MODEL.md) owns the objective.

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
computation. Active [#402](https://github.com/Kajooja/Kajo/issues/402)
adds declared numeric evaluation coverage and the Profile-macro report, before
mean-loss comparison under development-selected requirements and
an untouched final window. Existing Sprints 014/015 acceptance remains open;
neither source packet makes the whole Sprint 016 or Engine V1 complete.

## Active source packet — #402

The bounded source implementation on `feat/personal-rating-evaluation` adds a
versioned declaration, complete declared-opportunity inventory adapter and pure
Profile-macro report. Pin roster, retrospective first-report target, BOOK/MOVIE
scope, deterministic delivered-target selection, source/model/control versions,
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
owner census. Forty focused core, adapter, private-file and actual database-path
tests pass; required full CI and source acceptance remain pending. No quality,
mobile-route, hosted-installation or serving acceptance follows; STATUS and the
implementation PR own the exact source/check receipt.

The owner approved publication and merge after all six required CI gates on
2026-11-01. STATUS records local verification and environment limits; the PR
must retain the exact source/CI receipt. After source acceptance, select
one bounded item-differentiating content-preference challenger with frozen
permitted feature inputs and the Personal-mean control. Observed development
cohort collection and quality admission remain explicit separate dependencies.

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
- Declared evaluation source: #402 is under implementation; required checks and
  source acceptance remain pending. STATUS owns the one active handoff.
- Quality / runtime admission: open.
- Evidence, exact source versions, installed artifacts and known issues: record
  in this sprint and STATUS as each bounded packet finishes.
