# Sprint 015 — Shared prediction inputs and trustworthy evaluation

Status: **IN PROGRESS — four source packets accepted; two SQL forwards installed; shared scoring inputs and remaining acceptance open**
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
After Sprint 015 acceptance: [Sprint 016](SPRINT-016.md), user-specific expected ratings.
The current bounded packet binds frozen FINAL scoring inputs in existing native identity/shadow paths; see [STATUS](../STATUS.md).

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

- Fourth source packet: accepted through [PR #369](https://github.com/Kajooja/Kajo/pull/369),
  merge `53f84bbd2f487ec9460ee482425821d3830795b0`. Existing Personal
  Working report/cohort v2 consumes the native prediction adapter with an
  immutable supplied genome and complete retained OFF final-ranking conformance.
  Exact OFF checks remain mandatory alongside the fixed `1e-12` generic score
  tolerance. Versioned declaration rules pin contracts/clocks/precision; v1
  receipts, latest-terminal resolution, first-capture selection, coverage,
  withdrawal and privacy boundaries remain unchanged. This is an EB-01/EB-03
  and EB-12 integration slice (architecture sections 1–3, 10–13, 30, 37,
  40–44 and 49–51). It adds no scorer, migration, serving activation or
  predictive-quality claim. Independent review, 30 focused report/cohort tests
  and the six-test actual SQL/PGlite producer-to-report path pass. The complete
  six-candidate/four-selected fixture has zero OFF difference, preserves the
  later 9→0 correction and rejects rounded clocks and withdrawal. All 362
  database, 326 engine and 72 research tests pass; other local suites,
  lint/types and four demo exports pass. Root check retains the unchanged Deno
  registry refusal. All five source gates passed in [CI #748](https://github.com/Kajooja/Kajo/actions/runs/40317604029),
  attempt 2, on `bfe9ffd7fcbcad8ab94d788b95ac5724e7b89d38`; merge preserves
  tree `bfa0674601dbafdb41b5b2589de46503d6171495`. Attempt 1 hit an unchanged atomic-page
  PGlite WASM trap; dependency identity and a targeted same-source pass supported
  the unchanged-source retry. The root cause remains unproven. No hosted rollout
  or new PostgreSQL v2-report execution is claimed. [STATUS](../STATUS.md) owns
  the receipt and next frozen FINAL scoring-input packet; full four-consumer
  parity, #232F, performance, predictive quality and Sprint 015 remain open.
- Design: planned by the owner's 2026-10-25 engine-first decision.
- Third source packet: accepted through [PR #367](https://github.com/Kajooja/Kajo/pull/367),
  merge `3159c1959cbbe4edb0f2923eb1ee177b6a227642`. A strict Kajo adapter
  maps actual frozen candidate requests, input clocks and complete native ranking
  traces into a separate generic conformance boundary. The shared SQL-fixture
  verifier compares the source against the existing native baseline shadow
  replay in both PGlite and native PostgreSQL, retaining policy-specific scope,
  exact identity/eligibility/order/selection and explicit score tolerances.
  Native scores remain uncalibrated ranking scores, generated fixtures remain
  synthetic, and copied continuation pages are not relabeled fresh forecasts.
  This is an EB-01/EB-03 and EB-12 integration slice (architecture sections
  1–3, 10–13, 30, 37, 40–44 and 49–51), with no new scorer, SQL migration,
  serving activation or quality claim. Independent review, 15 focused package
  tests, all 361 database and 326 engine tests pass. The six-case real-SQL
  fixture compares 69 candidates,
  including 37 nonzero Scenario contributions, with zero score difference under
  `1e-12`; four delivery cases use the shadow worker and two explicit evaluation
  cases use the frozen score helper. Full table rollback equality passes.
  Other local suites and four demo exports pass; the aggregate check retains
  the unchanged Deno registry refusal. The initial CI #743 native gate exposed
  rounded caller serialization; the rollback-only fixture now declares full
  float precision and tests microsecond capture rejection at rounded precision.
  Admission is limited to precision-preserving captures and lossless exports;
  existing lossy snapshots are not repaired or granted clock tolerance.
  All five final-source gates passed in [CI #744](https://github.com/Kajooja/Kajo/actions/runs/40309955743)
  on `f3f7e86d7de8c30b7b5a8ac3efa62fd0ca60f18c`; merge preserves tree
  `3af1d8b7d23ae79f21edac0ea1408d5648fbcc76`. The downloaded native report verifies the
  same six cases/69 candidates/37 Scenario contributions with zero score
  difference at `1e-12`, exact retained bindings and successful cleanup.
  [STATUS](../STATUS.md) owns the detailed receipt and current bounded
  frozen scoring-input handoff. Full same-pool
  parity, certified prefixes, exposure/label reconciliation and #232F remain open.
- Second source packet: accepted through [PR #365](https://github.com/Kajooja/Kajo/pull/365),
  merge `8d1a786389318dcf41804f5009a9271156d81e1d`.
  `20261026073031_native_candidate_request_contract.sql`
  moves the existing base/scalar/identity scorer behind one strict versioned
  candidate request, retaining old signatures as adapters. It separates existing
  acquisition policies from delivery/evaluation intent and rejects unsupported
  combinations, malformed/duplicate identities and invalid evaluation prefixes
  or ownership before forecast writes. Fresh runs freeze the private request;
  existing policies, valid scores, rows and exact replies remain intact.
  Independent review and all 360 database tests pass, including the populated
  54-case parity matrix, seven-function source/security guards and unchanged
  catalogue continuation/boundary smoke. Four request owners enter the new
  identity core directly to preserve their scoring call depth. Lint/types, other local
  test suites and four demo exports pass; the local aggregate check still stops
  at the unchanged Deno registry connection refusal. All five final-source gates
  passed in [CI #739](https://github.com/Kajooja/Kajo/actions/runs/40292194348),
  attempt 2, on `c38ec5cd49adfd9c243983d0bca892e1c7f33af3`; the merge preserves
  reviewed tree `b5a501420d8eb2f0e36009c426385c8e1b500e3f`. The native CLI report
  verifies the new request smoke, exact migration bytes/history, retained
  post-lock skip/reset behavior and cleanup. This forward was installed on
  2026-10-26 with identical stored SQL bytes. All 2439 fixed existing prediction,
  candidate and page records, 89 prior history entries and existing function
  metadata/default privileges were preserved. The pure READ ONLY validator probe
  passed; fresh hosted consumption remains unobserved. [STATUS](../STATUS.md)
  owns the detailed scoped receipt and current Sprint 015 handoff.
  Full same-pool parity, certified committed-prefix/historical reconstruction,
  full native temporal-evaluation integration and #232F remain open.
- First source packet: accepted through [PR #363](https://github.com/Kajooja/Kajo/pull/363),
  merge `feae2b17251d8d233e1925c66664d114b50fa341`.
  `20261025211014_shared_prediction_cutoff.sql` aligns existing
  memory/Scenario arithmetic to the native evidence transaction cutoff and retains a private
  `native-prediction-clocks-v1` envelope in fresh PredictionRuns. The actual
  ordinary/catalogue Discovery and explicit Taste evaluation paths consume it;
  frozen shadow continues to use its original source. This does not replace the
  current scorer or change candidate selection. Hard eligibility, request/delivery
  time and reset-aware Working capture retain their existing clocks.
- Limits: a logical clock is not one MVCC snapshot or a certified committed
  prefix. Current-row source/feature/state reads, the legacy versus explicit
  candidate policies, full native-input integration, temporal evaluation and
  #232F consumer still require their own bounded successors. Full four-consumer
  pool parity and
  Sprint 015 acceptance remain open.
- Source / CI: independent semantic review and local 351 database/904 mobile/311
  engine tests pass, with dependency/catalogue/research/acceptance checks,
  lint/types and four demo exports. Seven focused regressions prove the actual
  prior numeric mismatch, frozen-record preservation and latest skip/reset
  handling. The real lifecycle holder/waiter regression passed on native
  PostgreSQL. Local root stops at the existing Deno registry refusal; all five
  required final-source CI gates passed in
  [CI #735](https://github.com/Kajooja/Kajo/actions/runs/40235892151) on
  `d07ce07c03953dfeb14163bef96728036c02faa2`. The merge preserves the exact
  reviewed tree `ab1225364addbc9561c783b7e503d8d37649c28b`.
- Hosted installation: the owner-authorized
  `20261025211014_shared_prediction_cutoff.sql` forward was installed on
  2026-10-26. Read-only postchecks verified the expected function, unchanged
  identity/metadata/security boundary, migration receipt and prior history.
  All 958 fixed existing records checked were unchanged: 20 PredictionRuns,
  936 candidates and two page receipts; no shadow/comparison rows were present
  in the sample. New answers and forecasts were excluded from the comparison.
  Fresh hosted consumption remains unobserved. Do not repeat earlier deployments
  or reset accepted answers.
- Quality / runtime admission: open.
- Evidence, exact source versions, installed artifacts and known issues: record
  in this sprint and STATUS as each bounded packet finishes.
