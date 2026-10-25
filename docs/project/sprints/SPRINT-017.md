# Sprint 017 — Adaptive state, content and cross-domain transfer

Status: **PLANNED**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: [Sprint 016](SPRINT-016.md) numerical baseline and
[Sprint 015](SPRINT-015.md) frozen feature/state contracts.

## Outcome

Use a single evolving Profile with multiple timescales and interests, bounded
BOOK/MOVIE transfer, dated environment inputs and distinct Shared state. Every
additional channel earns its serving influence through measured useful prediction.

## Scope and deliverables

1. Audit content features for identity, rights, missingness, discrimination and
   versioning. Preserve exact Work/Edition identity and dated source metadata.
   Establish interpretable shared themes/pace/tone/complexity where supported;
   provider popularity or rich prose alone is not a learned taste feature.
2. Compose Working/Short/Long/Belief state from one canonical evidence prefix.
   Preserve existing short/long source semantics, correction and forgetting.
   Compare Working OFF/STATIC/ORDERED; activate only a supported configuration.
3. Keep multiple interests where useful instead of forcing one mean preference
   vector. Start with transparent feature groups/prototypes and matched-complexity
   controls; learned high-dimensional geometry is an optional later experiment.
4. Distinguish transient intent, durable preference, rating-style drift and unknown
   context. Explicit user intent is provenance-bearing context; SKIP sequence or
   dwell does not establish mood. WorldState first contains source-dated facts,
   availability and stale/unknown handling, with a trend channel only if genuine
   time-series observations exist.
5. Add shared content dimensions plus category-specific residuals and a bounded
   transfer gate. One PersonalProfile spans BOOK/MOVIE; book success does not
   certify movie reliability. Train thresholds/gates without future labels.
6. Complete the bounded Shared state/evidence path from #232: own joint history,
   authorized member fit and disagreement, membership snapshot and equal treatment
   of member rating styles. Raw personal histories stay private. A group decision
   or one member's mark does not become all members' personal satisfaction.
7. Deliver a state-feature registry and reproducible incremental/full-rebuild
   checks; each field records availability, missingness, source/version, support,
   expiry and dependent deletion/withdrawal behavior.

## Required tests and acceptance

- One atypical session cannot erase repeated durable evidence; repeated new
  evidence can change a stale preference. Session expiry, inactivity and rating-
  style changes remain distinguishable from explicit source deletion.
- Undo, re-rating, late arrivals, missing domains and source withdrawal produce the
  same state as a fresh reconstruction. One event projected into several memories
  does not multiply outcome support.
- World-only changes leave durable personal evidence unchanged; unknown context
  stays missing. Profile/group switching and membership changes invalidate scope.
- Opposite cross-domain and category-specific preferences remain representable;
  compare no-transfer, shared-only and bounded shared-plus-residual configurations.
- Shared fixtures include incompatible member scales, minority poor fit, missing
  member evidence and changed membership; group policy is declared and cannot
  infer private labels or promote a simple raw-score average as group truth.
- Under the locked protocol, report per-domain/user-state errors and coverage for
  single-scale versus multiscale, Working OFF versus admitted alternatives,
  world-off, single-interest and no-transfer controls. Include the worst supported
  domain/style slices and state-update p95 against Sprint 015's declared budget.

## Stop conditions and non-goals

Disable a channel that fails quality, negative-transfer, lifecycle or resource
limits; preserve its measured outcome and working fallback. A basic versioned
state/feature/lifecycle implementation is mandatory, but unsupported Working,
trend or transfer influence cannot be enabled just to tick a box. Large embeddings,
LLM inference on every swipe, new micro-signal collection and interpersonal
personality inference are not prerequisites. Existing group UX is sufficient to
exercise the engine; broad group-flow redesign stays in the later UX stage.

## Coverage and next handoff

EB-02, bounded EB-05/07/09; sections 3–10, 18–24, 34–35, 49.
Requirements `MVP-ALG-004/005/006`, `MVP-PRED-005`, applicable
`MVP-SOCIAL-007` evidence and privacy boundaries.
Next: [Sprint 018](SPRINT-018.md), useful conditional scenario recall.

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
