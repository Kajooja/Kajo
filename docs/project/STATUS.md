# Kajo Current Status

Last updated: **2026-10-28**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **015 — shared prediction inputs and trustworthy evaluation**, fourteen accepted source packets; current accumulated skip-history comparison; seven SQL forwards installed; native measurements, hosted/device performance and quality remain distinct gates.
Sprint **014** retains its open inherited acceptance gates.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current handoff — accumulated skip-history comparison / Sprint 015

[Issue #392](https://github.com/Kajooja/Kajo/issues/392), branch
`test/native-skip-history-envelope`, starts from accepted main
`2f6f3811e3489adca55d945481674a30a5064583` /
[PR #391](https://github.com/Kajooja/Kajo/pull/391). This fifteenth bounded source
packet measures the unchanged optimization with accumulated history; it adds
no serving change, schema, migration or hosted operation.

The source and protocol are in draft [PR #393](https://github.com/Kajooja/Kajo/pull/393).
The initial executable head is `285e8ac77b4d55b279af889dc869247e835799c1`;
[CI #807](https://github.com/Kajooja/Kajo/actions/runs/40682803256) covers that head.
Required CI and independent artifact review must pass on the final PR head before
acceptance. Focused parser/series tests (9/9) and real-SQL performance contracts
(3/3) pass locally. The full local database run passed 404/405 tests; an unchanged
atomic-pages PGlite test failed with a WASM memory error and its isolated retry
was inconclusive. Local Deno registry networking also prevents a complete
root-check pass; neither limitation counts as a passing gate.

The [predeclared history protocol](sprints/SPRINT-015.md#accumulated-skip-history-comparison)
retains the original empty-history comparison and adds dense current-Item and
10000-Item off-catalogue histories. Six fresh owned stacks run in BC/CB/BC order:
2880 measurements, 288 excluded warmups and 72 separate function observations.
Every history cohort/pair must stay within the existing fresh/retry regression
allowances and preserve the predicted skip-call counts, source lineage and all
canonical rows. A complete losing comparison remains NOT_ADMITTED; its failure
must name a concrete successor before broader activation.

**Next action:** complete the exact-head source/CI validation, then independently
verify both history inventories/decisions, raw quantiles, all paired criteria,
source/installation identities and six cleanups. Expand the accepted synthetic
scope only if every declared rule passes unchanged. This does not admit dense
production traffic, a latency SLO, phone speed or recommendation quality. The
#391 forward is not yet installed in the hosted application; any eventual rollout
still needs its guarded preservation procedure. Hosted and physical-device
observations and separately predeclared quality sampling remain open.

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
