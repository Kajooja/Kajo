# Sprint 015 — Shared prediction inputs and trustworthy evaluation

Status: **IN PROGRESS — ten preceding accepted source packets plus current parity coverage packet; seven SQL forwards installed; final-source, performance and quality acceptance remain separate gates**
Milestone: **Engine V1 — first useful expected-rating engine**
Dependency: active Sprint 014 source stack and explicit disposition of remaining
acceptance; [ROADMAP](../ROADMAP.md) owns order. Sprint IDs are distinct from the
older product Phase 15–20 identifiers.

## Outcome

Taste and Discovery consume one versioned prediction input and one eligible
candidate/scoring service, with a frozen, measurable decision-to-outcome chain.
Finish and connect the accepted foundations; do not create another scorer.

The October 27 [session direction](../../architecture/decisions/0013-friend-network-and-temporary-shared-sessions.md)
makes joint browsing temporary and Friend-based while keeping an internal
SharedProfile memory context. The bounded #232F consumer is accepted source
on the existing full-Profile enrollment basis; its exact hosted forward is installed
and preservation-verified. The tenth packet's prospective outcome reconciliation
is also accepted and installed; fresh hosted outcomes and quality remain separate
acceptance gates. Continue with remaining supported native four-consumer parity.
Require exact-set isolation (including overlapping A–B–C/A–B–Z), real enrollment
generations and source withdrawal. Same-set reuse cannot restore revoked or
erased lineage. Do not invent a session ID or claim existing fixtures prove the
future lifecycle; actual session/roster receipt binding and replacement social
navigation are versioned Phase 16 successors. Engine-first order is unchanged.

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
The private read-only prospective Shared forecast-to-outcome join through
#232C/#232F is accepted and its guarded rollout complete. Continue remaining
supported four-consumer parity through the existing owners. #232E's exposed
same-pool pair diagnostic stays unchanged because
these single-target EVALUATION runs are not comparable rating forecasts or exposed
policy choices. Maturity, selection, experience units and nonadmitted cohorts are
explicit; first-response identities, corrections and withdrawal are preserved.
[STATUS](../STATUS.md) owns the single handoff. Four-consumer parity, runtime/
performance and separately predeclared predictive-quality acceptance remain open.

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

- Eleventh source packet [PR #387](https://github.com/Kajooja/Kajo/pull/387),
  branch `test/native-four-consumer-parity`: extend the
  accepted native adapter/FINAL/shadow verifier to 54 Discovery combinations,
  including 24 authenticated public page/feed cases and exact delivered outputs
  and retries. The existing committed Taste/explicit-evaluation comparisons,
  Shared prepared-input proof, receipt-witness distinctions and unlike-policy
  exclusions stay intact. This is executable coverage, without another scorer,
  SQL forward or hosted write. Its final-source PR checks/native report own
  acceptance; STATUS owns the exact handoff. After this bounded coverage passes, establish the
  native/hosted performance baseline and predeclare eligible quality targets.
- Tenth source packet: accepted through [PR #385](https://github.com/Kajooja/Kajo/pull/385).
  `shared-forecast-outcome-v1` reconciles a consumed frozen
  forecast with one immutable outcome capture for the exact experience/enrollment.
  It adds one closed STABLE INVOKER reader and no copied table or scorer. Tests
  cover missing/partial/mature/immature outcomes, 0/5/10, first UNKNOWN before a
  later numeric answer, corrections, clear/cancel, leave/rejoin, wrong context,
  closed grants and input/outcome withdrawal. The populated forward preserves
  every previous function body/metadata, default and canonical row; the same
  verifier runs in the native CLI gate. All five final-source
  [CI #790](https://github.com/Kajooja/Kajo/actions/runs/40553559104) gates pass on
  `42fd7d4072fd4bdb7d372e0751ac4c56a756459d`; accepted merge
  `93afd7b3b6f3740a10b7408a080bf9ca2555a2b6` has the exact tested tree.
  The independently checked native report proves all 16 cases, preservation of
  276 existing functions, the complete source manifest and canonical cleanup.
  No exposed-policy quality, numeric-rating accuracy or cohort admission is
  inferred. STATUS owns the full source/report and separate hosted receipts.
- Hosted tenth-packet forward: explicitly approved and installed once on October
  27 as provider version `20261027200523`, name
  `shared_forecast_outcome_reconciliation`. Stored bytes match the accepted SQL.
  All 6465 old rows across 68 tables, 2018 old schema objects, 277 old function
  bodies/metadata, 24 default-privilege records and 94 old history records are
  unchanged. Exactly one source-matching owner-only STABLE INVOKER reader is
  added; no table or data row is added. Five invalid-input rejections and absent-
  outcome reads for all 49 retained runs pass. There are no hosted consumption
  bindings or outcome captures, so no fresh linked pair or quality is claimed.
  Advisor findings are unchanged apart from observation timestamps. Remaining
  four-consumer parity, performance and declared quality gates stay open.

- Ninth source packet: accepted through [PR #383](https://github.com/Kajooja/Kajo/pull/383).
  Private #232F consumption computes from the prepared vectors through existing
  common-fit/FINAL owners and atomically retains its input/feature identities.
  Four native forecasts match frozen replay exactly at `1e-12`; feature sensitivity,
  disagreement/fallback, ordinal 0/5/10 and response-scale controls pass. Seven
  observed independent lock orders cover answers, correction, withdrawal, retry
  and enrollment changes with full canonical cleanup. Copied-actor erasure removes
  another actor's dependent Shared forecasts and preserves unrelated Personal
  evidence. Populated rows/defaults, 269 function identities/metadata
  and 2493 old native schema objects are preserved; five allowed
  bodies and seven private helpers are verified. The exact hosted format variant
  is rehearsed and semantic drift rejected. All five final-source
  [CI #786](https://github.com/Kajooja/Kajo/actions/runs/40490626249) gates pass on
  `1e5a6963418fd31e8ab6971a1923679dd55be7da`; accepted merge
  `0ec9bd1085f522e686533120f56b1545d65ad1e4` has the exact tested tree.
  [STATUS](../STATUS.md) owns the final report/source and separate hosted receipts.
- Hosted ninth-packet forward: explicitly approved and installed once on October 27
  as provider version `20261027114910`, name `shared_prepared_input_consumption`.
  Stored bytes match the accepted migration. All 6465 old rows across 67 tables,
  1994 old schema objects, 270 function identities/metadata, 265 unrelated bodies,
  24 default-privilege records and 93 prior migration records are unchanged.
  Five expected bodies, seven closed private helpers and one empty owner-only
  RLS table match source. Missing/unbound markers are rejected; all 49 historical
  unmarked runs retain their prior validation behavior. The only advisor delta
  is the expected RLS-without-policy INFO for the closed new table. No fresh hosted
  consumption, quality, Session lifecycle or public delivery was observed or claimed.
  The next packet reconciles prospective outcomes through existing owners;
  four-consumer, runtime/performance and predictive-quality gates remain open.
- Eighth source packet: accepted through [PR #379](https://github.com/Kajooja/Kajo/pull/379),
  merge `d95429be91c232867f56765ef19b75d99e8b8038`. Actual owned V4 receipt
  scope/revision/transaction and before-lock visibility are consumed by the
  evaluation/identity boundary and retained in FINAL/native adapter admission.
  Native independent connections prove the older-timestamp/uncommitted-answer
  rejection without a forecast, a successful fresh retry and exactly-once
  duplicate NEXT. Full-row/default/function preservation, 13 prewrite and seven
  frozen controls, correction/withdrawal and canonical cleanup pass. Existing
  seven captures, 1095 comparisons, zero score difference, 0/5/10 sensitivity and
  21 unchanged sources remain intact; scoring and selected policies are unchanged.
  All five final-source [CI #775](https://github.com/Kajooja/Kajo/actions/runs/40404748536)
  gates pass on `db0c43834efaf7fb51fbb97143717df876f59c75`, with 381 database,
  332 engine, 904 mobile, 451 catalogue, 50 dependency, 72 research, 11 acceptance
  and 32 Edge tests and four configured exports. Initial native CI stopped at a
  logging-label constraint before concurrency; the next run proved concurrency
  but exposed distinct global snapshot witnesses. Report v2 retains the full
  comparator result for each pair and reports receipt-aligned computation parity
  separately from full-input equality, with no snapshot rebinding. The final
  source passes its declared gates. The guarded forward is installed with the
  receipt below. [STATUS](../STATUS.md) owns the exact source/native/hosted evidence
  and one #232F consumer handoff. Global/history,
  four-consumer policy, runtime/performance and predictive-quality gates stay open.

- On October 26 automatic approval review rejected this forward's hosted
  `apply_migration` call because earlier approval did not clearly cover that
  exact production write. READ ONLY checks confirmed no changes; no bypass was
  attempted. On October 27 the owner explicitly approved the linked migration,
  resolving that block. Fresh preflight preceded the verified installation below.

- Owned V4 receipt forward is installed under the provider-issued history name
  `20261027063814_native_v4_receipt_forecast_binding`;
  its stored SQL exactly matches the accepted source SHA-256
  `a4ec8f5cf5215d65c9b2f65eb64fb66a3621662b9d20516d221db41fdc4fd2e3`. Fresh pre/post checks
  preserve 6465 fixed rows across 67 tables, all 268 existing function identities/
  metadata, 264 unrelated bodies, 24 default-privilege records and all 92
  previous history rows. Exactly four expected bodies change and two closed
  private INVOKER helpers are added. Read-only missing/invalid receipt rejection,
  49 legacy admission results and unchanged advisor findings are verified.
  No fresh marked run or device observation was manufactured. [STATUS](../STATUS.md)
  owns the exact hosted receipt and next genuine #232F source-consumption packet;
  broader parity, runtime/performance, outcome and quality gates stay open.

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
  STATUS owns the current #232F prepared-input consumer packet; broader policy
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
