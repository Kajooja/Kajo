# Kajo Current Status

Last updated: **2026-10-28**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **015 — shared prediction inputs and trustworthy evaluation**, native expected-rating evaluation feasibility #396 in progress; optional skip-prefilter diagnosis #394 deferred; native, hosted/device and quality acceptance remain distinct gates.
Sprint **014** retains its open inherited acceptance gates.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current handoff — native evaluation feasibility #396 / Sprint 015

[PR #395](https://github.com/Kajooja/Kajo/pull/395) is accepted as main
`b7e38a6533eaa0771070b41d1fed1fe592e67927`, tree
`9c80ef29e09e6d68c1b4e5b03ab2a2d79b31f12b`, after all six final
[CI #812](https://github.com/Kajooja/Kajo/actions/runs/40726376980) gates,
2263 tests and four configured iOS/Android exports. Its PR owns the complete
#811/#812 paired timings and independently verified native preservation receipts.

**Owner priority — 2026-10-28:** investigate performance deviations now only when
material to development or MVP; otherwise continue required engine work. The
#394 observations failed declared optimization rules but demonstrate neither a
wrong result/data-preservation failure nor an end-user latency violation. Keep
all failed results and thresholds; do not reinterpret them as accepted. Further
investigation is **deferred**, with the optional #391 forward still uninstalled.
Re-enter #394 before proposing its broader activation, or when baseline/runtime
evidence links the issue to a correctness defect, required capacity or a declared
user-facing performance budget. This does not close MVP-UX-008 or Sprint 015.

Continue on the current **pre-#391 hosted serving baseline**. Fresh source-test
installations include the 54th candidate forward; their CI success does not
activate or admit that forward in the hosted application. No migration is removed
or rewritten, and no account, retained forecast or history is reset.

**One active packet:** [Issue #396](https://github.com/Kajooja/Kajo/issues/396),
branch `feat/native-quality-feasibility`. Extend the existing Working cohort/report
v2 workflow with an executable expected-rating feasibility boundary. Reuse its
roster, inventory, native-source and outcome validation; preserve v1/v2 reports.
Bind the declared target, controls, analysis unit, temporal roles/windows, source
identity and numerical acceptance/resource requirements. Missing requirements,
missing numeric forecasts and insufficient outcomes remain explicit blockers;
fixtures, pair counts and rank scores cannot become native quality or grades.
This packet adds no scorer, serving change or hosted write.

A read-only hosted check on **2026-10-28T18:09:23Z** confirms acquisition body
MD5 `6e0aba591a90c194c5bae49f0361084f` and no installed skip-prefilter forward.
At **18:09:54Z**, aggregate feasibility counts are zero Personal Working
enrollments/captures, zero Shared forecast consumptions/outcome captures, and
47 valid retained Taste panels across two sessions. Counts do not establish
eligible labels, independent support, a prospective sample or numeric forecasts.
No individual identity/label rows were exported; no hosted state changed.

After this bounded evaluation foundation, continue toward Sprint 016's numerical
baseline using the existing research/temporal machinery. Preserve unresolved
Sprint 015 quality/runtime observations as named acceptance obligations; do not
wait for optional #391 tuning or claim the sprint/Engine V1 is already accepted.

**Retained diagnostic conclusion:** both #811 and #812 observed 503 calls in every
original target/control and 500 acquisition + three availability calls in every
trace. Historical 501/502 totals remain unexplained. #811's OFF_CATALOGUE_HISTORY
Taste exact-retry p50 rose 7.710 → 10.553 ms (2.843 ms versus a 0.771 ms allowance);
#812 did not reproduce it. Separate private replays preserve exact acquisition
inputs/rows, not fixed-clock equality across separate public RPCs. No causal
public-latency explanation or rollout admission follows. #807/#808 remain
NOT_ADMITTED; #809 retains its individual declared-history passing result.

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
