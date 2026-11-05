# Kajo Current Status

Last updated: **2026-11-05**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **016 — expected ratings and each user's rating style**, scalable individual-rating training #422 after accepted response-spread comparison #421 / #423. Baseline #398, durable capture #400, declared evaluation #402, content challenger #405 and operator connection #409 / #411 remain accepted. Sprint **015** retains its open runtime/quality acceptance; optional skip-prefilter diagnosis #394 remains deferred.
Sprint **014** retains its open inherited acceptance gates.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current handoff — scalable individual-rating training #422

[PR #423](https://github.com/Kajooja/Kajo/pull/423) is accepted as main
`332641523bea1e8335b9a1fdc358b409fd774f8a`, source
`27d22211ed9b5c1395bd5ccc43556df62c40086b`, tested merge
`3befbedab8cdbbbcb34d3ee64b06ee9a16d412f1`, common tree
`d5ba08893d58eff50e026f03896f6021e578dbc4`. All six required
[CI #843](https://github.com/Kajooja/Kajo/actions/runs/42031114660) gates passed:
2,524 tests and four configured exports. Exact run/artifact evidence remains in
PR #423; source acceptance did not admit a research model into serving.

The [response-spread result](../../research/reports/rating-response-spread-v1.md)
retains the location-only control in both domains. BOOK worsened; MOVIE's gain
was below the fixed 0.02 margin. Preserve these outcomes and original D2 rejection.
All three BOOK cohorts and the 32M cohort are exposed development evidence.

**One active packet:** [#422](https://github.com/Kajooja/Kajo/issues/422), branch
`research/scalable-rating-training-422`, [PR #424](https://github.com/Kajooja/Kajo/pull/424). The
[protocol](../../research/manifests/rating-learning-curves-v1.json) fixes nested
background populations (1,000 / 5,000 / 20,000 / all eligible subjects), independent
400-person development and 400-person confirmation groups per domain, unchanged
location equations and 0/5/10/20 visible-rating budgets. Publish code and protocol
before new real-data selection/fitting. The protocol/source were published at `900291d7fe10cced63e080e81ce8ff8459e25e96`
before selection. A publisher CRLF-header correction was published at
`3418d006ee1421cbd12a39765fade02fe555275b` before the first MOVIE selection;
its original zero-record failure remains retained. No experiment rule changed.

The [measured result](../../research/reports/rating-learning-curves-v1.md) retains
the larger research model in both domains: 5,007,233 BOOK / 28,445,684 MOVIE
training ratings. Separate 400-person confirmation groups improve macro RMSE
1.898911 → 1.825152 and 1.656061 → 1.625156, with passing fixed paired/MAE/cold
criteria. Independent raw-source/NumPy reconstruction verifies all eight models,
source-local membership, 663,496 forecast values and both confirmation intervals.
BOOK's complete replay is identical conformance on already exposed evidence.
Twelve new regression tests pass; final source CI/acceptance belongs to the PR.
Do not merge until all six required gates pass on its final source/tested tree.
The continuation found PR/CI #845 still pointing to the earlier code-only
`3418d006ee1421cbd12a39765fade02fe555275b` while the branch already retained
the result commit `2727ad91c0106bda4d960f5e28b1c9942e62d99b`. Refresh the PR
source and verify a final-source run; the older run alone cannot accept the
result documentation or this handoff.

The disk-backed runner verifies pinned raw source bytes, resolves duplicate and
conflicting pairs across the entire source, retains exact membership/exclusion
witnesses, and checkpoints consumed records and integer sufficient statistics.
All evaluation subjects are absent from shared training; personal evidence and
targets stay fixed as background training grows. BOOK remains undated. MOVIE uses
global 2021/2022 rating-entry cutoffs; cross-release person overlap remains unknown.
Neither source becomes native accounts, Profiles, Events or invented exposure.

[Source-use register](../../research/manifests/broad-training-source-use-v1.json)
keeps current permissions at noncommercial isolated research. Production,
commercial use and fitted-artifact distribution are not approved. The later
`MVP-ALG-013` permission-or-compatible-source dependency remains explicit; no
outreach or serving deployment is included. Checkpoint and resume verification,
learning curves, costs, protected confirmation and source CI are this packet's
gates. A failed size comparison or exhausted budget retains its honest outcome.

**After #422 source acceptance:** create the next bounded catalogue/admission
audit Issue, then measure exact source-object → canonical Item linkage and missing/
ambiguous coverage with read-only metadata. Inventory the existing native numeric/
content adapters, permitted uses and fallback before proposing a native-scoped
comparison. A constant subject offset does not learn individual Item ordering.
The largest MOVIE fit still has 27.445% source-cold confirmation targets; BOOK has
0%. Catalogue mapping is NOT_QUERIED. More old data cannot solve a temporal new-Item
gap. Rights, mapping and native quality remain real prerequisites, with explicit
native-only disposition when unsupported. Do not start another model family or
call these exposed cohorts untouched FINAL. No owner input is required for this
read-only/source audit. GitHub Issue creation returned server errors in this
session; no successor Issue was confirmed, so create it once from this scope.

Keep the owned private observation route and operational source pins intact.
Do not replace an unread/pending target, reset accounts, replay migrations or
manufacture native quality evidence. Optional #391 remains NOT_ADMITTED.
Sprint 016 and Engine V1 quality/serving admission remain open.

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

Reuse `capturePersonalContentRatingForecast` for one held BEGIN → prepare →
TypeScript → finalize → COMMIT transaction. Only afterward submit the owner's
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
