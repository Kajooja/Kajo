# Sprint 015 — Shared prediction inputs and trustworthy evaluation

Status: **IN PROGRESS — seven source packets accepted; four SQL forwards installed; remaining acceptance open**
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
The next bounded source packet is the owned V4 acknowledged-receipt to fresh-forecast binding; [STATUS](../STATUS.md) owns its exact scope and the completed shared acquisition rollout receipt.

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

- Eighth source packet is in progress on `feat/v4-receipt-forecast-binding`:
  owned V4 command-entry visibility and actual acknowledged receipt are consumed
  before forecast writes and bound into FINAL/native adapter admission. Historical
  rows, cached replies, score math and selection policies remain preserved.
  The local populated forward, malformed/stale receipt controls, correction and
  dependent-source withdrawal pass; the actual V4 numeric/parity fixture retains
  seven captures, 1095 comparisons, zero difference and 21 unchanged sources.
  Full local database (381), engine (332), research (72), acceptance (11),
  mobile (904), dependency (50) and catalogue (451) tests, lint/typecheck and
  four explicit-demo Hermes exports pass. Root check's Deno registry connection
  refusal remains for CI. Separate-connection PostgreSQL late-commit/duplicate
  tests join the early CLI gate; native evidence and all five final-source gates
  are still pending. [PR #379](https://github.com/Kajooja/Kajo/pull/379) is active.
  CI #773 passed four gates and native forward/current controls, but a test-stage
  label mismatch stopped before concurrency. The logging label is corrected;
  all five gates must pass on that corrected final source.
  The new forward is not hosted. [STATUS](../STATUS.md) owns the active source and
  acceptance receipt; no broader commit/history, policy or quality gate closes.

- Seventh source packet: accepted through [PR #376](https://github.com/Kajooja/Kajo/pull/376),
  merge `1c9ff2aa6f37325c8d7214fe9a1e692f048da647`. Actual V4 catalogue and request base scoring consume one
  private versioned acquisition owner, with explicit scope, clocks, source rules,
  native request or exact V4 receipt/recognition bounds. Retained scoring, policies,
  traces and records remain unchanged. Local and native PostgreSQL preserve 54
  populated-forward cases, explicit evaluation, V4 catalogue, score bytes,
  canonical rows, function/default metadata and exact V4/Discovery retries.
  Three real consumers use the owner; repeated identical acquisition requests
  preserve complete pools, with closed grants and 37 invalid controls.
  The actual Taste proof retains 1095 comparisons,
  zero score difference, numeric-answer sensitivity and 21
  unchanged sources; seven unlike policies remain non-comparable. All five
  final-source [CI #767](https://github.com/Kajooja/Kajo/actions/runs/40377289217)
  gates pass on `527a18a1ee6205d907ef602c45a53b4c6a71a3dc`, completed attempt 2,
  tree `08cebd1d9b649351b6deb8f8a5497cf24bc76ae3`. All 371 database tests and other suites/exports pass;
  CI supplies 32 Edge passes despite the local registry connection limitation.
  STATUS records exact native artifact provenance and the corrected transport
  assertion/cancelled-then-successful validation attempt. The fourth SQL forward
  was installed on 2026-10-26 as provider history
  `20261026193802_shared_native_candidate_acquisition`, with identical stored SQL
  bytes. READ ONLY pre/post checks preserve all 6465 fixed rows across 67 tables,
  their schema/access metadata, 267 existing function identities/metadata, 264
  unrelated function bodies, 24 default-privilege records and 91 prior migration
  records. The three patched bodies and new owner-only INVOKER match the accepted
  SQL exactly. Invalid acquisition input rejects; all 49 old unmarked runs retain
  their replay result. Security/performance findings are unchanged. No new marked
  run or synthetic observation was created. This completes installation and
  preservation, not fresh hosted serving, performance, quality or Sprint 015.
  STATUS owns the next owned V4 receipt-to-forecast source packet; broader policy
  alignment, certified historical availability and the other sprint gates stay open.

- Sixth source packet: accepted through [PR #374](https://github.com/Kajooja/Kajo/pull/374),
  merge `96fcaf07e54fe3249c8b5bb570d4b9fefbfedf39`. Actual committed V4 commands,
  current Discovery, independent same-input evaluation and frozen replay share
  the existing native adapter verifier. Local and native PostgreSQL report seven
  captures, 1095 candidate comparisons and zero score difference at `1e-12`;
  0/5/10 sensitivity, exact retries, 21 unchanged sources and retained/fresh
  other-Profile controls pass with precision-preserving canonical cleanup.
  All five final-source [CI #762](https://github.com/Kajooja/Kajo/actions/runs/40359790273)
  gates passed on `ee80fb9bd00aa9d147786bea7d52c83950a7583f`, attempt 1,
  tree `b4f52bb2bd4f63f6986d0a1b01ec6ca1950315f5`. The 370 database tests,
  other suites and exports pass; CI also supplies all 32 Edge tests despite the
  local registry refusal. STATUS owns exact source/native report receipts.
  Recognition versus catalogue acquisition, domain, clocks and selection remain
  explicitly non-comparable. The next packet supplies the versioned common
  candidate-acquisition owner while preserving retained policies and the scorer.
  This test/documentation packet performs no hosted rollout or quality acceptance.
- Fifth source packet: accepted through [PR #371](https://github.com/Kajooja/Kajo/pull/371),
  merge `118099a72a4ab2ec6d4b96e74aa9b9562ab78801`. One versioned FINAL input is prepared after
  Scenario enrichment and consumed by existing identity/shadow/Working owners
  and native adapter admission. Complete pool/source-genome binding, scalar-first
  challenger reminder reselection, historical replay and separately marked
  protocol-2 reuse are preserved. All 369 database, 329 engine and 72 research
  tests, other local suites, lint/types and four demo exports pass. Root check
  retains the unchanged local Deno registry refusal. The 54-case populated matrix
  preserves complete old traces and exact score bytes; native CLI verifies seven
  marked sources/four rejection controls and zero baseline difference across
  69 candidates with 37 Scenario contributions. The 48-page matrix preserves all
  36 continuation shadows. Corrected shared page/Working smoke checks distinguish per-page
  bindings and pre-FINAL prefixes; the local Working test covers both generations. All five
  final-source gates passed in [CI #755](https://github.com/Kajooja/Kajo/actions/runs/40338320909)
  on `9cc8db296fa7bdd0c5bf7a1366713984f3146333`, with tree
  `a82570d756f873c6f3ebccfdd9e83bac5944c1b5`. [STATUS](../STATUS.md) owns
  the native report receipt and next actual-Taste conformance packet. This advances
  EB-01/EB-03 integration without replacing arithmetic or admitting a model.
  The guarded forward was installed on 2026-10-26 as provider history
  `20261026151042_frozen_final_scoring_input`, with identical stored SQL bytes.
  All 6465 fixed rows across 67 public/private tables, 90 prior migration records,
  264 existing function identities/metadata and 24 default-privilege records were
  preserved. The four changed bodies and three new owner-only helpers matched
  the accepted SQL; all 260 unrelated function bodies remained unchanged.
  READ ONLY validation preserved all 49 historical unmarked runs. No fresh marked
  run was observed and none was manufactured. [STATUS](../STATUS.md) owns the
  full scoped receipt. Actual fresh serving, full four-consumer same-pool parity,
  certified historical input, #232F, performance, quality and sprint close remain open.
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
