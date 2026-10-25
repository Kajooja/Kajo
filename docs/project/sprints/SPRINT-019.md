# Sprint 019 — Calibrated readiness and one guided policy

Status: **PLANNED**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: [Sprints 016–018](SPRINT-018.md) chosen model/state/recall configuration
and the common serving boundary from Sprint 015.

## Outcome

Separate expected fit, uncertainty and domain readiness; use those outputs in
one Taste/Discovery policy that maximizes user-specific expected rating and
continues learning after onboarding. Readiness can pass only with supported data.

## Scope and deliverables

1. Specify prediction output with target, own-scale expected rating, support,
   interval/distribution when justified, calibration scope/version, missingness
   and out-of-distribution status. Fit is not an answer-count confidence score.
2. Evaluate conditional means and, if supplied, rating distributions/intervals on
   held-out data. Keep epistemic uncertainty distinct from outcome variability
   when identifiable; otherwise state the limitation. Population calibration is
   not proof of reliable individualized coverage.
3. Freeze per-domain readiness target, metric, independent support, varied feature
   coverage, uncertainty bound and stopping rule before owner evaluation. Use a
   defensible sequential method or predeclared checkpoints for repeated checking;
   ordinary intervals cannot be repeatedly inspected as if sample size were fixed.
4. Implement BOOK → MOVIE backend guidance with one Profile and the exact shared
   acquisition/scoring contract. First-card recognition constraints are declared;
   no hidden Taste utility replaces the expected-rating objective. SKIP is not
   observed non-recognition, dislike or an incorrect numeric forecast.
5. Advance/complete only when the supported domain criterion passes. Poor data,
   exhausted catalogue, user fatigue or voluntary exit permit insufficient
   continuation, preserving state. Readiness may weaken after contradiction,
   correction, withdrawal or drift; completed onboarding is not forced again.
6. Version FOR_YOU/SURPRISE/RISK policies with explicit novelty/exploration limits
   and expected-quality guardrails. No P10 objective or convex bonus remains.
   Log truthful action/slate propensities if stochastic; do not invent them for
   deterministic history. Limit experiments to supported, authorized scope.
7. Expose the minimal existing-client feedback needed to observe engine behavior
   and honest readiness, with accessibility and exact command preservation. New
   public web Taste, acquisition, marketing and visual polish remain later stages.

## Required tests and acceptance

- Distinguish high fit/low knowledge, low fit/high knowledge and insufficient
  domain coverage. Ties, repeated identical features or answer counts alone
  cannot certify readiness or preference discrimination. A constant rater's
  supported mean can pass the declared numerical-prediction readiness criterion
  on untouched held-out outcomes at the required coverage and precision, using
  a mean-consistent loss and the declared dependence treatment. Report
  unidentified preference differentiation separately; do not invent score
  variation to make that mean eligible.
- Sequential first labels are assessed against frozen pre-answer predictions;
  overlapping pairs are not independent trials. Corrected/withdrawn source
  evidence invalidates future readiness and copied derived reports correctly.
- Exercise pass, insufficient, voluntary exit, category transition, restart,
  retained legacy policies and Discovery continuation without resetting accounts.
- Shared policy parity holds under equal full inputs; novelty and exploration
  remain declared deviations with measured expected-quality costs.
- Calibrate and freeze acceptable mean error, interval coverage/width if claimed,
  false-ready tolerance, minimum support/feature coverage and checkpoint rule on
  development/validation data. Evaluate at locked thresholds on a new window.
- Report BOOK/MOVIE and rating-style slices, calibration coverage and learning
  efficiency against the predeclared baseline; no arbitrary 90% display or
  first-few-lucky-answers success.

## Stop conditions and non-goals

Unsupported probabilities/intervals remain unavailable and readiness remains
insufficient. Correct mechanics with insufficient labels can be source-complete
but cannot close calibrated-readiness/quality acceptance. Gather later natural
usage evidence with voluntary continuation. No endless mandatory questionnaire,
fixed completion quota, independent Taste model or extra unknown button.

## Coverage and next handoff

EB-03/07/08; sections 7, 14–15, 27, 30, 32–33, 49, 51.
Requirements `MVP-TASTE-002..007`, `MVP-ALG-006/007/010`.
Next: [Sprint 020](SPRINT-020.md), operating learning and controlled evolution.

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

## Delivery record

- Design: planned by the owner's 2026-10-25 engine-first decision.
- Source / CI: not delivered by this plan.
- Quality / runtime admission: open.
- Evidence, exact source versions, installed artifacts and known issues: record
  in this sprint and STATUS as each bounded packet finishes.
