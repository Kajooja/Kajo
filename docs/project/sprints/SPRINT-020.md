# Sprint 020 — Operating replay, consolidation and controlled evolution

Status: **PLANNED**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: [Sprint 019](SPRINT-019.md) target/calibration/policy contracts and
usable evaluation windows from Sprint 015 onward.

## Outcome

Turn the existing SleepLayer and champion/challenger foundations into an
operating, reproducible learning process over real observations. User state
updates immediately; shared model retraining and admission remain controlled.

## Scope and deliverables

1. Run bounded scheduled/retry-safe jobs that reconcile eligible mature outcomes,
   compare frozen forecasts and write versioned aggregate reports. Monitor job
   lag, missingness, drift, cost and failed/insufficient runs.
2. Compare representative replay with a bounded error-aware replay challenger.
   Correct logging defects/label maturity before prioritizing surprising cases;
   retain a representative share and recorded sampling treatment.
3. Build one evidence-preserving consolidation path where it reduces real cost or
   helps retrieval. Prototype ancestors/support, contradictions, time range,
   permissions and versions survive compression. Keep an uncompressed control.
4. Retain minimal useful temporal/derivation relations with canonical sources;
   relational storage is sufficient. No CAUSES edge follows merely from temporal
   sequence, similarity or a generated explanation.
5. Define one bounded challenger family over existing validated components:
   weights, regularization, decay, retrieval thresholds or calibration. Freeze
   model/feature/target/index versions, seeds, search budget and train/selection/
   final-test windows. Consumed final tests become development evidence.
6. Exercise shadow comparisons, manual scope-limited admission, baseline fallback
   and rollback. All evaluators use the same target/source semantics; a challenger
   does not choose its own success labels or change hard constraints.
7. Record the separate future simulation channel and its prerequisites. Real
   replay, consolidation and versioned model search are V1 deliverables; imagined
   next-state rollouts require independently validated transitions and real-only
   controls before a later experiment. Synthetic fixtures remain fixtures.

## Required tests and acceptance

- Restart, duplicate scheduling, overlapping workers and late/corrected labels
  preserve deterministic job/report identity and frozen predictions.
- Leakage probes verify no final-test labels enter sampling priorities,
  representation fitting, prototypes, dream seeds or challenger generation.
- Consolidation/rebuild/deletion tests preserve source support and invalidate
  descendants without resurrecting withdrawn evidence during replay/restore.
- Fixed champion, representative replay and uncompressed memory provide controls.
  Lock useful-improvement/noninferiority margins and cost budgets before running
  the challenger search; report every selected/rejected/insufficient result.
- On the declared real evaluation window, measure user-macro mean-prediction
  performance, coverage and resource use. A simulated gain cannot admit a model.
- Execute rollback and artifact/index compatibility failure drills through the
  actual server/runtime boundary, retaining original historical forecasts.
- Verify real monitoring and at least one complete job cycle on permitted native
  input. Empty input is a useful operational test, not an outcome-quality pass.

## Stop conditions and non-goals

Keep the champion when no challenger meets the criterion. A clean rejection is
valid experiment completion; it does not close every future evolution capability.
Correctness, privacy, unsupported influence, excessive cost or rollback failure
blocks admission. Automatic global promotion, neural architecture search,
long dream chains and self-rewriting production code remain research/operational
extensions after V1 evidence justifies them.

## Coverage and next handoff

EB-03/09/11; explicit EB-10 research boundary; sections 26, 28–31, 34–40,
47–49, 51. Requirements `MVP-ALG-008/009`, source/artifact lifecycle.
Next: [Sprint 021](SPRINT-021.md), integrated Engine V1 acceptance.

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
