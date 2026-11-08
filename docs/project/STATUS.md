# Kajo Current Status

Last updated: **2026-11-08**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **016 — expected ratings and each user's rating style**, owned Taste numeric source #432 / #433 accepted and installed; #434 query/rollback diagnostics accepted; BOOK source support verified; permitted MOVIE features precede fresh private DEVELOPMENT preparation. Taste recovery #428 accepted; preservation diagnostics #430 / #431 accepted; native-only preflight #427 reconciled; catalogue/admission audit #425 / #426 accepted after scalable individual-rating training #422 / #424. Baseline #398, durable capture #400, declared evaluation #402, content challenger #405 and operator connection #409 / #411 remain accepted. Sprint **015** retains its open runtime/quality acceptance; optional skip-prefilter diagnosis #394 remains deferred.
Sprint **014** retains its open inherited acceptance gates.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current handoff — native Wikidata content capture

**Current source packet:** [#438](https://github.com/Kajooja/Kajo/issues/438) /
[PR #439](https://github.com/Kajooja/Kajo/pull/439),
branch `feat/wikidata-native-capture`. Finish the linked PR's final-source checks
and integration if still open. This implements private prepare/finalize **v4**,
preparation/input **v3**, feature snapshot/permission manifest **v2**. MOVIE uses
explicit Wikidata assertions; BOOK retains the Open Library subject mapping.
The numerical mean/ridge core and old v1/v2/v3 capture meanings remain unchanged.

The append-only `20261108000938_wikidata_native_content_capture.sql` validates
bounded original EntityData bytes before projecting claims. SQL and the existing
JavaScript extractor independently derive the vectors. Original-byte and claims-
projection hashes are distinct. Native capture verifies all three exact aliases,
committed availability, permission through the answer horizon and catalogue
relation fences. New complete Item dependency references also retire unavailable
captures when sources/aliases change. Payload-only corrections, inserted ambiguous
aliases and explicit review withdrawal cannot leave dependent frozen copies alive.

Local tests exercise the new MOVIE/BOOK path, source/version tampering, first
answers, source retirement and retained evaluation inventory. A populated-forward
rehearsal verifies all three old capture generations, exact retries, private
ACL/RLS, unchanged predecessor rows/functions except the reviewed lifecycle
extensions, and rollback. Required CI also runs these against native PostgreSQL
with distinct-backend catalogue writer witnesses. Fixture success is source
verification, not actual source ingestion, rights clearance or prediction quality.

Local `npm run check` passes lint/typecheck and the dependency/mobile/catalogue
tests, then fails during Deno dependency retrieval with a refused registry
connection. It is not a full-check pass. Independent focused database/engine
checks are recorded in the linked PR; complete final-source CI remains required. First
[CI #872](https://github.com/Kajooja/Kajo/actions/runs/42430155601) rejected the
new test's Node-specific crypto type import. It is replaced by standard Web
Crypto without adding a dependency. Review also added explicit commit-status
checks for released SAVEPOINT source/alias writes in both domains; four real
subtransaction regressions and old-generation rollback pass locally. Final-source
CI must cover the corrected head; the earlier failed run remains history.

[CI #873](https://github.com/Kajooja/Kajo/actions/runs/42430638386) passed validation,
platform, clean installations and the populated forward gate, then the native CLI
probe exposed SQL NULL omission in the new projection test's psql transport.
The SQL extractor correctly returned unavailable; the assertion received no JSON
row. The verifier now explicitly emits JSON null and its local transport test
reproduces psql's distinction. This correction changes no extraction/eligibility
rule. Final-source checks must include that correction.

Continuation review reproduced SQL/JavaScript URL normalization disagreement on
Unicode authorities, embedded tabs and multiple trailing dots. The uninstalled
forward now rejects native sources needing unsupported URL normalization, while
retaining the standalone extractor contract and numeric labels. The trailing-dot
marker check removes exactly one dot. All 66 extraction cases, actual capture
with an unavailable URL source, MOVIE/BOOK lifecycle and three-generation populated
upgrade/rollback pass locally. The local full check was stopped at stalled Deno
registry retrieval; it is incomplete. CI #874 covers the preceding source and
cannot accept this correction. Review the linked PR's latest head and all six
required gates before integration.

Further review reproduced conflicting vectors from fractional JSON numbers that
JavaScript rounds to integral Q-id/reference values. Native capture now rejects
those original sources before freezing features. Ordinary finite fractions and
exact integral decimals remain supported. Compound reference IDs that can throw
during JavaScript string coercion are also declined before freezing. The 77 source
cases and actual fallback capture cover URL, precision and coercion boundaries
without changing the accepted offline contract.

CI #874's first native attempt stopped at an unchanged owned-Taste lock conflict
(`55P03`) before Wikidata probes; the competing lock was not identified. CI #875's
first validation attempt hit PGlite WebAssembly memory failure in the older
acquisition-preservation fixture (before this forward exists). Its isolated local
reproduction and unchanged validation rerun passed all 2,640 tests and four exports.
Both attempts remain evidence; neither accepts the subsequent numeric correction.
Final-source CI must cover the linked PR's latest head and all six required gates.

[CI #875](https://github.com/Kajooja/Kajo/actions/runs/42433194973) attempt 2 passes validation
(including all 529 database tests), platform, clean installs and the populated
forward gate. Its native Wikidata capture test receives the correct `22023`
rejection but incorrectly expects server exception prose, which the isolated
psql transport deliberately redacts. All three new capture rejection assertions
now require exact SQLSTATE (`22023` or `55000`), matching both driver and redacted
transport diagnostics. The complete capture/lifecycle verifier also runs locally
through the redacted error shape as a regression. No SQL or eligibility rule
changes in this correction. The new source still needs all six required CI gates;
the failed attempt is retained and cannot be counted as native acceptance.

[CI #878](https://github.com/Kajooja/Kajo/actions/runs/42435812023) passes validation
(2,641 tests and four exports), platform, clean installations and populated
forward upgrade. Its CLI job reaches reset 39 and final verification, then the
30-minute job limit cancels active SQL work without an assertion failure. The
bounded job budget is now 45 minutes; every probe and per-statement deadline is
unchanged. Cleanup/report upload did not complete on that attempt, so it is not
native acceptance. All six gates must pass on the final source including this
workflow correction.

**Single next action after #438 source acceptance:** prepare and rehearse the
exact new forward on retained hosted state, then install and preservation-verify
it through the existing guarded operational route. The new forward is not installed
by this source packet. Review bounded original-source ingestion and inspect actual
permitted MOVIE fitting support before a fresh private MOVIE-then-BOOK DEVELOPMENT
declaration. Keep the observation worker inactive until that scope is supported.
Preserve current answers and all previously accepted forwards; no reinstall/reset,
old declaration refill, quality admission or serving activation.

**Accepted offline predecessor:** [PR #437](https://github.com/Kajooja/Kajo/pull/437)
merged as `aa95f7650f9321d1fc35b74932e7d9cf49df905a`. Source
`fbb88de44181ea8f4c02b2c333d0436b08ad254b`, tested merge
`6d82279a58b1aede16d480291bf165149f0fc335` and accepted main share tree
`e1333df41bfdb2729435bf7de50d523594d93e69`. All six required
[CI #870](https://github.com/Kajooja/Kajo/actions/runs/42424765702) gates passed:
2,636 tests, four configured exports, lint/typecheck and no unmitigated audit
findings. All five artifacts were independently verified. The performance gate
retains its failed reference comparison and grants no optimization/quality
admission. Optional APK was skipped. Earlier CI #869 remained unusually long in
Test with no confirmed cause; do not recast that attempt as a successful check.
The local full check stalled retrieving Deno dependencies and was not a full pass.

**Accepted runtime source:** [PR #434](https://github.com/Kajooja/Kajo/pull/434) merged on
November 7 as `350ce05001f2554971649a9be5872a560a4a4039`. Source
`61eaa74bf3d92b8c5bf44e281e392a8f5ce3c5e8`, tested merge
`9d91ae848a87c89bb24fcc70a2d17eea320c6d85` and accepted main share tree
`6f76c2d0f25a9c93944b853f12c0c7bf758bc9fb`. All six required
[CI #862](https://github.com/Kajooja/Kajo/actions/runs/42403022392) gates passed:
2,576 tests, four configured iOS/Android exports, lint/typecheck and dependency
audit with no unmitigated findings. All five runtime artifacts were independently
verified. Optional standalone APK was skipped. The performance gate confirms
complete diagnostics, with the retained failed reference comparison and no
optimization admission; it is not a latency or quality acceptance.

**Owned-Taste source history:** [PR #433](https://github.com/Kajooja/Kajo/pull/433) merged on
November 6 as `9f55634bc2457fd8d552b24ca216a31f6ae10d6d`. Source
`c52b2347b949bfa7f4e24e9285643ce1367315a3`, tested merge
`dfc9233eb26f483928c57acaaa5b092b186bfdd0` and accepted merge share tree
`8ba95fe2461bd80f09459e4d6455a5779a8d860c`. All six required
[CI #859](https://github.com/Kajooja/Kajo/actions/runs/42219124581) gates passed:
2,573 tests, four configured iOS/Android exports, lint/typecheck and dependency
audit with no unmitigated findings. Optional standalone APK was skipped. The PR
retains independently verified artifacts, source/tree identities, native
concurrent-writer witnesses and populated predecessor preservation/rollback.
[Issue #432](https://github.com/Kajooja/Kajo/issues/432) is closed; do not repeat
its source implementation or treat the earlier failed CI runs as outstanding work.

Private prepare/finalize **v3**, preparation/
input **v2**, admit genuine owned sequential Taste ratings alongside canonically
resolved native ratings. The unchanged numerical core computes the full-prefix
mean and permitted content ridge. Retain bootstrap/response identity and report
availability; do not create native Events or invent experience dates.

The source includes closed lineage checks, new source dependency references,
correction/withdrawal retirement, same-transaction capture and explicit source
version binding in the existing evaluation inventory. Old v1/v2 captures and
exact retries remain intact. Native CI verifies actual owned-Taste capture,
ten distinct-backend source-fence witnesses, private ACL/RLS boundaries and
populated-forward rollback. These are source/runtime fixtures, not observed
prediction usefulness or serving admission.

**Hosted installation completed — November 7:** the approved exact
`20261106090733_owned_taste_numeric_sources.sql` forward is installed. Independent
postflight verifies the expected source/security metadata and retained-row/history
preservation; the new private reference tables remain empty. Current answers are
preserved. The earlier absence observation is superseded by this installation.
Its execution receipt and operational details stay private. The historical
two-forward numeric wrapper remains frozen; do not reinstall accepted forwards.

**Accepted diagnostic correction:** [PR #434](https://github.com/Kajooja/Kajo/pull/434) records
the accepted source/deployment and corrects a disposable fixture's error masking.
[CI #861](https://github.com/Kajooja/Kajo/actions/runs/42400959745) passed 522 of 523
database tests; the populated acquisition proof and cleanup both reported
`cannot drop active portal`. The remaining three dependent required gates were
skipped. The fixture awaited rollback before reporting its original query error,
so rollback failure could replace that error. The correction logs the query error
and stage before rollback, retains both errors when recovery fails and never
retries the query. It changes no SQL, production behavior or preservation check.

The three new diagnostic regressions and complete acquisition test file pass
all 13 tests on Node 22.23.4 and Node 24. The double-failure regression fails on
the prior executor. A local full `npm run check` passes lint/typecheck and 1,427
dependency/mobile/catalogue tests, then fails fetching Deno dependencies because
the registry connection is refused; that full check remains incomplete.
The underlying intermittent portal failure is **NOT_REPRODUCED locally / cause
unresolved**. Do not claim it is fixed or erase CI #861's failed result.
The final source acceptance above supplies the complete required checks; preserve
the earlier failed run and incomplete local run as history.

**BOOK source linkage completed — November 7:** the independently reviewed and
rehearsed exact-Work source/alias repair was explicitly authorized and applied.
Post-commit readback verifies the exact additions, unchanged existing catalogue
rows and answers, and fresh provenance timestamps. A separate read-only inspection
now confirms permitted BOOK content support and an available content fit. This is
engineering readiness, not a prospective prediction or evidence of usefulness.
The repair is complete; do not replay it or reset current answers.

**Accepted continuation entry:** [PR #435](https://github.com/Kajooja/Kajo/pull/435)
merged as `c43eb22873d5ddce9785d81164a38a4936715cd7` after all six
[CI #866](https://github.com/Kajooja/Kajo/actions/runs/42415191173) gates passed:
2,576 tests and four configured exports. Source, tested and accepted tree is
`5aa127ea623eb5b398127b444e42a4d296dc7472`. Its approved public research
summary is already published; do not request
the same publication approval again. Earlier CI #865 failed isolated Supabase
startup before the platform probe while validation remained unusually long in
Test. Image-download/port-binding signals do not establish a cause. Preserve that
attempt; a newer documentation source requires its own complete checks and does
not demonstrate a runtime fix for the earlier failure or delay.

**Wikidata coverage review completed — November 7:** the bounded label-blind
inspection corroborates exact external identities, film type, year, directors
and titles, retaining statement/revision/hash/retrieval evidence. The preselected
direct mapping has usable candidate assertions and unsupported gaps. This is
private engineering evidence, not an admitted provider, fitted MOVIE model or
prediction-quality result. Do not repeat that completed lookup as the default
next task. [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md#wikidata-provider-integration--next-source-packet)
owns the reviewed extraction boundaries and remaining implementation checks.

**Remaining provider acceptance:** #436 / #437 supplies the accepted offline
contract; #438 supplies its versioned native successor above. Complete source
acceptance, guarded installation and reviewed ingestion before actual fitting
support inspection and a new DEVELOPMENT declaration. Current hosted MOVIE
support remains insufficient. Keep operational identities, counts, source bytes
and execution records private.

The November 7 [provider-use review](../architecture/DATA_ENRICHMENT.md#tmdb-content-use-restriction--reviewed-2026-11-07)
keeps TMDB features unlisted: its full standard API terms restrict ML/AI use and
explicitly cover training or validation. No applicable separate agreement was
reviewed. Mean fallback is not clearance for other provider-content use in the
wider pipeline; keep that scope review separate from numerical support.

After source support is established, retain a new pre-window declaration with
explicit owned-Taste source version, reviewed feature-use horizon and genuine
first-answer opportunities. Source linkage and an available fit are engineering
readiness, not an observed numerical comparison or quality admission.

The retired #427 window stays retired. No account reset, observed capture,
declaration refill, historical forecast backfill or serving activation is claimed.
Use the existing private route below; Sprint 016 and Engine V1 quality gates remain
open. Operational identities, configuration, execution records and experiment
files stay outside this public repository.

### Retained source-validation history

#430 / #431 closed after all six CI #854 gates with the diagnostics gap corrected.
The original CI #852 synthetic preservation failure remains
**NOT_REPRODUCED / cause unresolved**, not claimed fixed. A recurrence must retain
and inspect the individual proof/cleanup causes.

During PR #433, CI #857 passed five gates; the native CLI gate
failed in the new populated-forward verifier with `invalid JSON acknowledgement`.
Its ACL/RLS queries returned PostgreSQL `t`/`f` instead of JSON booleans. The
correction serializes those three query forms as JSON and verifies result types
locally, including rejection of unauthorized function/table grants and disabled
RLS. The regression fails on the prior source at the function-ACL query. This
changes the disposable verifier only, not migration SQL or prediction math.
Earlier CI #856's rejected-forecast assertion required SQLSTATE rather than
redacted server prose; that separate correction is retained. Final-source CI #859
subsequently passed all six gates; the earlier passing subsets were not acceptance.

CI #858 then completed 2,573 tests and four configured iOS/Android exports, but
its CLI proof exposed a second verifier defect: the rollback restored the caller's
float serialization setting before the final row snapshot. Only the prediction
candidate digest differed. The new regression reproduces that failure on the
prior source with reduced caller precision. The corrected readback uses its own
read-only transaction at the original snapshot precision, then restores the
caller settings; all row/function and ACL checks remain exact. The regression
exercises caller precisions -3, 0 and 3. This is another disposable-verifier
correction, not a migration or prediction change; CI #858 remains a failed run.

The corrected verifier and transport suite passed all ten focused tests when run
sequentially. An initial parallel local run failed the transport's short deadline
fixture; its sequential rerun passed without a transport change. The local full
`npm run check` passed lint/typecheck and 1,427 dependency/mobile/catalogue tests,
then was stopped after repeated Deno dependency-download stalls; that local run
is not a completed full-check pass. CI #859 supplies the final complete check.
The earlier local PGlite/Wasm atomic-page failure also remains an unresolved
local-runtime observation; the native/CI passes do not establish its cause.

**Taste recovery retained:** #429's append-only correction is already installed;
its PR owns the verified hosted receipt. On November 6 the owner completed the
interrupted session and reported that the remaining cards were books. This
confirms resumed completion and BOOK continuation, not a fresh-session full order
or predictive quality. [DEVICE_TEST](DEVICE_TEST.md) owns that scoped observation.
Do not reinstall the correction or reset current answers.

**Repository hygiene retained:** 46 obsolete development heads were removed;
42 were exact ancestors, and four had identical accepted merge trees. Eight
pinned catalogue operation/recovery branches remain. The
[audit](retros/branch-audit-2026-11-06.json) preserves every recovery identity.

Catalogue/admission #425 / #426 and broad individual-rating research #422 / #424
remain accepted research. Do not repeat broad training, activate rejected
challengers or infer production-use permission. `MVP-ALG-013`, Sprint 016 and
Engine V1 quality/serving acceptance remain open.

## Retained owned numeric DEVELOPMENT route — private continuation

[PR #414](https://github.com/Kajooja/Kajo/pull/414) is accepted as main
`50c5904e40cd36313ff88da9e1e24ee7f006e8ca`, source
`9003153ef3e275b0520c1a97c10c0a65705888bb`, tested merge
`2fa819c38d4a3d095058ffb8eb6d76d79ba0f3ed`, common tree
`ee839d515a60dde5e84fe123cb5cd4f55df8a092`. All six required
[CI #835](https://github.com/Kajooja/Kajo/actions/runs/41908295062) gates pass:
**2,477 tests and four configured iOS/Android exports**, lint/typecheck and audit
with no unmitigated findings. The optional standalone APK was skipped. #413 is
closed. Source, tested and accepted trees match; the implementation PR retains
the final acceptance receipt. Do not restart the diagnostics implementation.

The fixed allowlist now distinguishes runtime, context, client, private-file and
connection failures without exposing credentials, paths, SQL, environment values
or arbitrary process/server text. Transport hints remain hints; unknown errors
remain UNKNOWN. Existing private/main/owner/source, identity/TLS, timeout and
cleanup guards are unchanged. Synthetic child-process tests establish disclosure
and classification behavior, not a hosted connection result.

The same CI retains all 43 native subchecks and the unchanged 56-entry SQL
manifest/history. The optional performance diagnostic preserves the pair-3
off-catalogue Taste exact-retry failure; optional #391 stays NOT_ADMITTED and
#394 remains deferred. Earlier connection/session acceptance remains in
[the predecessor checkpoint](https://github.com/Kajooja/Kajo/blob/50c5904e40cd36313ff88da9e1e24ee7f006e8ca/docs/project/STATUS.md).

The preceding #398/#400/#402/#405/#408 source supplies the numeric baseline,
durable capture, declared evaluation, frozen-content challenger and guarded
forward builder/rehearsal. Do not repeat those accepted implementations or infer
operational execution from source acceptance. All eleven integer ratings **0–10**
remain supported. Operational records stay private; source/CI evidence does not
establish observed prediction usefulness or close Sprint 016/Engine V1.

**Retained private dependency:** prepare the first bounded, authorized owned-Profile
DEVELOPMENT observation using these existing seams. [Issue #415](https://github.com/Kajooja/Kajo/issues/415)
reconciles this documentation handoff; it adds no runtime or observation collector.
Verify the privately retained connection result against an accepted source
revision before writes. Preserve already installed migration receipts and never
reapply a forward merely because a new conversation starts.

Before genuine DEVELOPMENT, establish the exact owner/PersonalProfile and domain,
provider feature-use review, retained pre-window declaration and fresh first-answer
route. Keep actor identity separate from the target Profile. The ordinary mobile
rating writer is not the private numeric first-answer route: its accepted use can
retire a pending evaluation target. Do not tell an owner to rate through that
route while claiming to measure the private frozen forecast.

For the new owned-Taste source generation, reuse `captureOwnedTasteNumericForecast`
in `scripts/database/owned-taste-numeric-capture.mjs` for one held BEGIN → prepare
v3 → TypeScript → finalize v3 → COMMIT transaction. Prior-generation retries
retain their original worker/contracts. Only afterward submit the owner's
actual integer rating through `private.commit_personal_rating_answer_v1`.
Use `inspectPersonalRatingOwnerCensus` for every declared owner and the existing
declaration/report CLI. A missing feature-use permission uses the documented
mean fallback; it does not establish content-model usefulness. No new public RPC,
mobile route, model or generic collector is implied by this preparation.

Keep all declared attempts, unavailable/busy captures, missing answers and
zero-opportunity Profiles; do not backfill old answers, refill after erasure or
invent thresholds. First-report rating error with unknown experience time is
separate from new-experience recommendation benefit. DEVELOPMENT observations
select numerical quality, coverage and precision requirements before SELECTION
and untouched FINAL windows. Quality admission and serving activation remain
NONE. Broader adaptive state, transfer, Shared, UX and release work retain ROADMAP
order; existing accounts and evidence are preserved.

[PREDICTION_MODEL](../domain/PREDICTION_MODEL.md#explicit-session-pooler-and-private-runner--sprint-016--411)
owns the connection/diagnostics contract and numeric observation semantics;
[CODEMAP](../architecture/CODEMAP.md#declared-personal-numeric-evaluation--sprint-016--402)
owns the existing implementation paths. Keep operational targets, identities,
configuration, private execution results and experiment files out of this public
repository. Continue from their authorized private records rather than inventing
missing evidence or treating this public handoff as an execution receipt.

### Completed diagnostic evidence

[CI #811](https://github.com/Kajooja/Kajo/actions/runs/40714431007), tested merge
`4a65ec799e46ee58e35bcd11b1e50f4c8e78773d`, tree
`e57cd3f347bab9a2619a99e689bc4c765cd46c67`, passes all six source gates,
**2263 tests and four configured iOS/Android exports**. Diagnostic artifact
`12830758100`, JSON SHA-256
`0b385e0110c677b10c45a755f6aa1266127abadb27ef43b6d5b6bc5da5cfa0a6`,
was independently verified from raw observations, quantiles and native microsecond
clock witnesses. All 2880 measurements, 288 warmups, 72 original diagnostics,
18 controls, 18 traces and six stack cleanups are present. Its `admission` is
`NONE`; the retry failure is retained as a descriptive original-rule failure.
The [Sprint receipt](sprints/SPRINT-015.md#native-skip-call-diagnostic-result--ci-811)
records plan limitations, physical-state observations and timing ranges.

Native preservation artifact `12829402944`, JSON SHA-256
`585f898738c4baff3df16d11506016bf3ed9310e148ff55df8f94c1f5f5dc6fe`,
independently passes all 54 source identities, 126 acquisition comparisons,
actual nested Taste calls 39/39, 276 unchanged functions/all metadata, invalid
clocks, exact retries and all 91 canonical tables. It retains 54 Discovery
cases/810 exact candidates with zero score difference, seven exact-input Taste
evaluations/21 sources, seven Shared lock proofs and 16 reconciliations.
Canonical and owned-stack cleanup pass. No hosted operation occurred.

### Completed history comparison evidence

Final [CI #809](https://github.com/Kajooja/Kajo/actions/runs/40689889430) passed all
six gates on head `49248cd3e261abbc3a3d4b62d101b28e2fb4d84a`, tested merge
`0880d679455a0ec3e809c44e0151da594f7d3042`, tree
`42de48588d7a53fbe84848bc9da1937124efc179` (also accepted main's tree).
Its performance artifact `12818469985`, JSON SHA-256
`a0309cb8f95ed80935ae510b4b2b2c0dd1a8f4abfa374b0e2806fa9a58bf8777`,
individually passes all original rules on AMD EPYC 7763. Executable code,
fixtures and thresholds are unchanged from #808; only documentation differs.
Separate workers are not paired timing experiments. Native preservation artifact
`12818950684`, JSON SHA-256
`ddad940974c808ee92adbc203a4dd70e37fe093bd86b7c880b30d913502d9661`,
passes the same full preservation suite. All 2259 tests and four configured
iOS/Android exports pass. Both earlier losing receipts below remain authoritative.

Measured executable head `6de8082877d1c3b8b83856455303cc177c499cc1`, tested merge
`c403ccc9d84ac2f176c43c30b63aba84f774755f`, tree
`c94bfef15e6afe7b5f5ff82fc2c8e7ef564aba9f`: all six required gates passed in
[CI #808](https://github.com/Kajooja/Kajo/actions/runs/40683795720), including
2259 tests and four configured iOS/Android exports. PR #393 owns final source-head
acceptance after this documentation receipt; a documentation update is not a new
measurement or a change to the predeclared rules. CI also passed the atomic-pages
test that failed locally in PGlite; the earlier local run was not a passing gate.

Performance artifact `12815439771`, JSON SHA-256
`6c31128085e99ae274aeae05430a5b5d1a4cd3eb31b347d74713edd9172d9042`,
was independently checked against raw quantiles, every paired criterion, fixture
inventories/decisions, exact installation/source identities and all six cleanups.
Its worker reports AMD EPYC 9V45, four logical CPUs, Node 22.23.4 and PostgreSQL
17.6. All 91 canonical tables are restored. PR #393 retains every paired p50/p95;
p95 remains exploratory. The call-count difference is an observation, not a proven
semantic defect or a causal performance explanation.

The earlier complete [CI #807](https://github.com/Kajooja/Kajo/actions/runs/40682803256)
comparison also remains NOT_ADMITTED: artifact `12815597733`, JSON SHA-256
`c556a7f4b2409bd0f9a18ccbef8ef70f87d2a98f42d8b4071b73c19c9edd70c9`.
Personal catalogue-history calls were 501/501/502 versus 503/503/503. Four latency
comparisons also failed: pair 2 empty-history fresh Taste; pair 1 off-catalogue
Taste exact retry; pair 2 catalogue-history fresh Personal and Shared Discovery.
The later passing latency observations do not erase these results or establish
cross-worker equivalence.

Native artifact `12815997380`, JSON SHA-256
`fabc0ae341d1bc155d1e5cf6988337af5e386888a8a7ee8d444e4db17dd48690`,
independently verifies all 54 installation sources, 126 populated acquisition
cases, actual NEXT calls 39/39, 276 unchanged functions/all metadata, two invalid
clocks and two exact retries. It retains 54 Discovery cases/810 exact candidate
comparisons with zero score differences, seven Taste/evaluation captures, 21
sources, seven Shared lock proofs, 16 reconciliations and canonical/stack cleanup.

**Project authority — 2026-10-28:** follow Kajo's repository and this Kajo project's
conversations. Unrelated files or projects do not introduce development or
approval rules; AGENTS records the owner's clarification.

### Retained fourteenth-packet skip-prefilter acceptance

[PR #391](https://github.com/Kajooja/Kajo/pull/391) was accepted as main
`2f6f3811e3489adca55d945481674a30a5064583` after the owner's approval. All six
required gates passed in [CI #805](https://github.com/Kajooja/Kajo/actions/runs/40662095772),
head `51e817bf4dd665871c2f350c87fdff3b426f9b8e`, tested merge
`c091e5ea55b8c0fb591643167ee2c38c8c30d36a`; the accepted/tested tree is
`7583355e048e6c4700aa739a6486ab9a207446f4`. CI validates 2256 tests and four
configured iOS/Android exports. The PR retains all paired p50/p95 cohorts.

The guarded forward `20261028081350_native_skip_acquisition_prefilter.sql` changes
only the private acquisition body. Discovery delivery with no possible skip
source uses the unchanged pre-skip component; possible histories and explicit
canonical evaluation use the full original decision. No scoring, grant, lock,
public API or retained data change. The real nested Taste NEXT call graph is
preserved (39/39 in the populated proof); invalid clocks retain their rejection.

Performance artifact `12805377004`, JSON SHA-256
`cd0804f35aeb60595ad64d75a92dde51d2b066e9bda8505a1a51e704b2b78342`,
contains all 1440 measurements, 144 warmups and 36 diagnostics on one AMD EPYC
7763 worker. All three pairs passed the predeclared rules. At 1000 Items, fresh
Personal/Shared Discovery p50 fell by 67.001–72.556 ms (28.45–31.55%); skip calls
fell from 501 to 1. Taste calls remained equal. All 91 canonical tables and six
owned stacks were restored. This acceptance covers the empty-skip synthetic
catalogue, not accumulated histories or production/phone latency.

Native artifact `12805353982`, JSON SHA-256
`0b08ecdf59b3425bd564356de7714a0c733ed314c36e36df1e449712194bc835`,
verifies all 54 installation sources, 126 populated acquisition comparisons,
the actual V4 catalogue and nested NEXT calls, 276 unchanged function bodies/all
metadata, two invalid-clock controls and two exact public retries. Existing
proofs retain 54 Discovery cases/810 exact candidate comparisons, seven committed
Taste/evaluation captures, 21 sources, seven Shared lock proofs and 16
reconciliations. The original broad candidate in CI #804 remains NOT_ADMITTED
because it altered Taste's nested evaluation calls; the final scope correction
kept every threshold unchanged. Its rejected receipt is retained in PR #391.

## Inherited gates and immutable receipts

This is the current handoff, not a new implementation or deployment request for
accepted work. The full predecessor receipts remain in [the immutable accepted
checkpoint](https://github.com/Kajooja/Kajo/blob/2f6f3811e3489adca55d945481674a30a5064583/docs/project/STATUS.md). Earlier “next action” instructions are historical; use the
current handoff above and the execution order in ROADMAP.

| Retained boundary | Evidence and current obligation |
| --- | --- |
| Accepted Sprint 015 foundations through #389 | [Source and native receipts](https://github.com/Kajooja/Kajo/blob/2f6f3811e3489adca55d945481674a30a5064583/docs/project/STATUS.md#retained-thirteenth-packet-repeatability-acceptance) retain exact commits, installation manifests, tests and artifact hashes. Do not restart accepted implementations. |
| Seven installed Sprint 015 SQL forwards | [Last hosted outcome receipt](https://github.com/Kajooja/Kajo/blob/2f6f3811e3489adca55d945481674a30a5064583/docs/project/STATUS.md#hosted-shared-forecastoutcome-reconciliation--2026-10-27) and preceding installed-forward receipts remain authoritative. Preserve accounts, commands, frozen forecasts, labels and source lineage. Reconcile actual hosted history before any new guarded operation; never replay installed SQL. |
| Existing catalogue and source operations | [Accepted foundations and preserved operations](https://github.com/Kajooja/Kajo/blob/2f6f3811e3489adca55d945481674a30a5064583/docs/project/STATUS.md#accepted-foundations-and-preserved-operations) retain consumed attempts, review/rights history and catalogue operation refs. No repeat provider acquisition, data repair or reset is part of this packet. |
| Engine and release acceptance | [Sprint 015](sprints/SPRINT-015.md), [ENGINE_BUILDOUT](ENGINE_BUILDOUT.md), [MVP](../product/MVP.md) and [ROADMAP](ROADMAP.md) own open temporal, quality, privacy, operations, beta/store and Share Link gates. Sprint 014 remains open; source/CI success does not close them. |
| Repository hygiene | [October 25 branch audit](retros/branch-cleanup-2026-10-25.md) records completed retirement of 56 reviewed obsolete branches. Preserve the eight consumed catalogue-operation refs; older branch-count or deletion instructions are historical. |

## Current test APK and device work

[DEVICE_TEST](DEVICE_TEST.md) owns the remaining observations and dated build
receipts, including the #357 / APK #721 geometry/recovery observations and real
cover rendering. Those phone observations and inherited #229 native/device gates
remain open; they do not block independent engine source work. This measurement
packet neither requires a replacement APK nor establishes phone performance.

[Historical build receipts](https://github.com/Kajooja/Kajo/blob/2f6f3811e3489adca55d945481674a30a5064583/docs/project/STATUS.md#current-test-apk-and-device-work) remain
available with their original checksums and expiry dates. Preserve reported owner
observations, but do not treat an old artifact or source pass as a current installed
checksum or completed device matrix. The anchor for this section is retained for
existing DEVICE_TEST links.
