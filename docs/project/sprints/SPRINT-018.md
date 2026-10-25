# Sprint 018 — Conditional scenario and population recall

Status: **PLANNED**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: [Sprints 015–017](SPRINT-017.md), supported numerical target,
versioned state and reproducible comparisons.

## Outcome

Recall relevant real decision prefixes and already-observed continuations to
improve expected ratings, with truthful no-match fallback. Evaluate the earliest
useful peer/prior channel that the available data and permissions can support.

## Scope and deliverables

1. Extend existing same-Profile ScenarioMemory through the common input boundary.
   Encode decision-time prefixes, actual numeric marks, supported rating style,
   recent direction, permitted context and candidate features. Keep outcomes and
   after-state outside the searchable query prefix.
2. Compare static-state, recent-state and ordered-prefix retrieval against no
   retrieval on identical targets. A batch of historic ratings is rating-entry
   order unless actual experience times exist; do not invent a viewing trajectory.
3. Introduce explicit no-useful-match thresholds, bounded retrieval counts,
   source/subject concentration limits and shrinkage toward the Sprint 016 model.
   A low rating of A can inform B only through supported comparable histories;
   shared dislike alone is not proof of shared preference.
4. Perform a bounded native-cohort feasibility audit: consent/access, independent
   subject support, observable outcomes, exposure limitations, identity protection
   and correction/deletion lineage. Implement an exact protected prototype channel
   only if these prerequisites and its predeclared quality test can be satisfied.
5. Separately evaluate a rights-cleared ExternalTastePrior if it addresses a real
   data gap. Reuse E1/D1/D2; their completed/rejected results remain valid. External
   people never become Kajo Profiles, and rating records do not become fabricated
   complete Scenarios. Native cohorts and external priors have separate gates.
6. Retain exact retrieval as the reference. Add ANN/index infrastructure only for
   demonstrated scale/latency need with matched filtered-recall tests. Version
   query/document encoders, artifacts and index bundles together; atomic switch
   and rollback preserve compatibility.
7. Produce a trace showing selected memory/prototype sources, numerical condition,
   information cutoff, support and exclusion/fallback reason without exposing
   another person's history.

## Required tests and acceptance

- Low/high A-rating histories change subsequent estimates where training support
  genuinely distinguishes outcomes; fixed arbitrary A-to-B mappings cannot pass.
- Own future labels, neighbor continuations not yet available, target-derived
  prototypes and incompatible actions/horizons are excluded.
- Authorization and time limits apply before top-K and at materialization;
  sparse or restricted cohorts return fallback without private-neighbor leakage.
- Corrections/withdrawals invalidate all dependent projections, caches, indices
  and derived artifacts. Repeated episodes/prototype copies do not multiply
  independent support; rating-style normalization remains prefix-trained.
- Lock downstream mean-rating error/utility diagnostics, no-match coverage,
  minimum improvement, no-transfer/no-recall controls and latency/memory budgets
  before evaluation. Compare quality at matched forecast coverage, domain and
  independence assumptions; nearest-vector distance is not an outcome metric.
- Report native, external, synthetic fixtures and subgroup evidence separately.
  A synthetic test may verify mechanics but cannot admit population usefulness.

## Stop conditions and non-goals

The local contract, provenance, no-match behavior and measured comparison are
mandatory. When native peer volume, rights or quality are insufficient, record
that exact dependency, keep the channel OFF and name its future intake criterion.
Do not invent cohorts or postpone a useful native-only V1 indefinitely. A rejected
retrieval method retains the no-retrieval baseline; the broader capability stays
open. Custom graph engines, full-catalog ANN and high-dimensional research are
not required without demonstrated benefit.

## Coverage and next handoff

EB-04; bounded EB-05/06/09; sections 11–13, 16–26, 34, 40, 45, 49.
Requirements `MVP-PRED-004/007`, `MVP-ALG-005/010/011` and source lifecycle.
Next: [Sprint 019](SPRINT-019.md), calibrated readiness and shared policy.

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
