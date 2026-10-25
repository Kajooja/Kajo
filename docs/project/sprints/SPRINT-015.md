# Sprint 015 — Shared prediction inputs and trustworthy evaluation

Status: **IN PROGRESS — shared native computation cutoff source packet**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: active Sprint 014 source stack and explicit disposition of remaining
acceptance; [ROADMAP](../ROADMAP.md) owns order. Sprint IDs are distinct from the
older product Phase 15–20 identifiers.

## Outcome

Taste and Discovery consume one versioned prediction input and one eligible
candidate/scoring service, with a frozen, measurable decision-to-outcome chain.
Finish and connect the accepted foundations; do not create another scorer.

## Scope and deliverables

1. Reconcile the active #357–#360 source/CI/deployment receipts, preserving accepted
   accounts, retained policies/panels/commands and already completed operations.
   Record remaining phone/hosted observations as scoped gates. A migration not
   yet installed requires its own preservation-checked rollout.
2. Define the common input: Subject/Profile and acting identity, committed prefix
   revision, domain, mode, eligibility, candidate-feature/source versions, state,
   WorldState facts, `asOf`/availability clocks and policy/model identity. Specify
   current-row versus historical-as-of limits rather than claiming reconstruction.
3. Replace differing candidate acquisition/selection entry points through one
   server-owned contract. Same declared inputs produce the same eligible pool and
   scores for Taste, Discovery, explicit evaluation and shadow. Keep recognition
   constraints only where declared; a SKIP does not reveal why a user skipped.
4. Freeze a prediction before its first answer; commit answer once, update state
   and require the acknowledged prefix in the next fresh forecast. Retain the
   accepted bounded Discovery buffer with its original forecast origin. Images
   may preload; stale predictions cannot masquerade as new-prefix predictions.
5. Reconcile real exposure and delayed labels, numeric 0/5/10, corrections, Undo,
   list saves and neutral SKIP. A numeric rating establishes experience; an
   unrated save remains interest. Keep retrospective Taste and later post-
   recommendation outcomes distinguishable in evaluation.
6. Connect the existing generic contracts to one real native computation through
   an adapter/parity boundary. Reuse E1 media/non-media fixtures; no big-bang SQL
   rewrite or unused parallel TypeScript copy.
7. Deliver the first reproducible evaluation manifest/report runner. Specify
   temporal splits, subjects/sessions, target labels, baselines, coverage,
   exclusions, output versions and resource measurements before new models fit.
   Integrate the existing Shared prepared-input/evidence consumer where required
   for truthful group predictions; do not postpone known evidence defects to UX.

## Required tests and acceptance

- Native same-input parity across all four consumers, with an explicit numerical
  tolerance and exact eligibility/identity equality; zero unexplained mismatches.
- Committed low/high-answer fixtures affect fresh predictions where support
  distinguishes them, preserve old forecasts and leave other Profiles unchanged.
- Concurrent duplicate commands, delayed acknowledgement, clock boundaries,
  restart/offline retry, source withdrawal and Profile/domain switching preserve
  scope, first-label identity and frozen evidence.
- Future, nonfinite, withdrawn and incompatible source/feature versions cannot
  enter a past snapshot; no inferred outcome for an unseen Item.
- Incremental record reconciliation matches a full rebuild on corrections and
  deletion. Retained policies and current source grants remain compatible.
- The evaluation runner deterministically reproduces eligible denominators and
  exclusions. Report native/hosted p50/p95 and resource baselines; lock subsequent
  budgets before testing changes. This sprint makes no accuracy claim.

## Stop conditions and non-goals

Stop the affected activation on parity, provenance or preservation failure.
Missing labels are reported, not manufactured from saves/SKIPs. Anonymous web
entry, link sharing, visual redesign and a calibrated readiness percentage are
later work. The numerical predictor is Sprint 016; this sprint supplies its
trusted input and comparison boundary.

## Coverage and next handoff

EB-01 and EB-03 foundations; EB-12 integration slice. Architecture sections
1–3, 10–13, 30, 37, 40–44, 49–51. Requirements `MVP-DATA-001..004`,
`MVP-PRED-006`, `MVP-ALG-002/003/009/010` and applicable #232 evidence.
Next: [Sprint 016](SPRINT-016.md), user-specific expected ratings.

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
- First source packet: `feat/engine-shared-input-contract`, based on accepted
  main #362. `20261025211014_shared_prediction_cutoff.sql` aligns existing
  memory/Scenario arithmetic to the native evidence transaction cutoff and retains a private
  `native-prediction-clocks-v1` envelope in fresh PredictionRuns. The actual
  ordinary/catalogue Discovery and explicit Taste evaluation paths consume it;
  frozen shadow continues to use its original source. This does not replace the
  current scorer or change candidate selection. Hard eligibility, request/delivery
  time and reset-aware Working capture retain their existing clocks.
- Limits: a logical clock is not one MVCC snapshot or a certified committed
  prefix. Current-row source/feature/state reads, the legacy versus explicit
  candidate policies, native adapter/temporal runner and #232F consumer still
  require their own bounded successors. Full four-consumer pool parity and
  Sprint 015 acceptance remain open.
- Source / CI: independent semantic review and local 351 database/904 mobile/311
  engine tests pass, with dependency/catalogue/research/acceptance checks,
  lint/types and four demo exports. Seven focused regressions prove the actual
  prior numeric mismatch, frozen-record preservation and latest skip/reset
  handling. A real lifecycle holder/waiter regression joins the native CLI gate.
  Local root stops at the existing Deno registry refusal; all five required
  final-source CI gates remain pending and are recorded by the PR.
- Quality / runtime admission: open.
- Evidence, exact source versions, installed artifacts and known issues: record
  in this sprint and STATUS as each bounded packet finishes.
