# Kajo Current Status

Last updated: **2026-10-06**
Current milestone: **MVP 0.1 — first public Kajo**
Current sprint: **Sprint 014 — algorithm reliability / real catalog / portable engine**
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file owns one exact resumable next task. [ROADMAP](ROADMAP.md) owns order,
[MVP](../product/MVP.md) owns release blockers and [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste/Friend/Shared flow. Read current main first, then the active branch;
an older branch-local handoff cannot replace newer accepted product decisions.

## Current packet — #229 standalone APK and configured-device acceptance

### Catalog-wide append and compact Discovery — 2026-10-06 / #199

[CI #607](https://github.com/Kajooja/Kajo/actions/runs/37464008658) on
`00f0bad9ed35c8647b72f8dd584df039ae8d0f9e` passed all five required gates
and built the standalone APK. This closes #304's recorded CLI transport/build
failure for that source. The owner subsequently reports phone cases **4–6 pass**:
later-page network recovery, scope/background changes during loading and
interrupted two-List saving/reopen. Exact installed artifact/device/OS were not
supplied; keep those observations without inventing their identities or accepting
fresh-account, Shared or visibility cases.

Cases **1–3 fail**: downward pull/button at the end starts the same bounded
search again and moves to its beginning for BOOK and MOVIE. The owner now
explicitly requires append beyond the retained 50-candidate pool, truthful end
copy, a one-row ItemType/Löydä/history header and removal of unused bottom space.
This supersedes the September 30 fresh-search footer behavior and promotes these
bounded #199/#200 layout requirements into the current native packet. Remaining
Phase 17 UX and all #229 release gates keep their prerequisites.

`fix/199-discovery-catalog-append` continues the exact successful #304 source.
The new forward `20261006143148_catalog_prediction_chain.sql` opts protocol 3
into the existing page RPC while retaining old protocol 1/2 callers and receipts.
Server-owned delivered-prefix exclusion occurs before bounded candidate admission.
Every appended page keeps its own immutable ranked run and exact receipt; the
chain preserves scope, ordering, unique Items and per-card origins. Catalogue
exhaustion and the bounded reader limit are distinct. Existing deployed files
are unchanged; only the new reviewed forward may be deployed.

The mobile reader retains its view and loaded prefix across append/retry.
Downward pulls at the bottom or top and **Näytä lisää** append/retry; an expired
cursor offers an explicit new search. Header controls share one responsive row;
Löydä does not reset the existing list. The global 46-pixel dock and its system
safe area remain; the nested bottom safe area and 24-pixel grid padding are gone.
Physical small-screen/large-text and Android gesture checks remain owner work.

The next bounded repository step extends Phase 14.1/14.2 evidence: more than 120
eligible Items per domain, later-page origin, delayed exposure/zero-rating,
frozen shadow replay and mature evaluation. This is not catalogue acquisition,
a Phase 15 jump or acceptance of recommendation quality.

Validation: root lint/typechecks, **478 mobile**, 39 dependency, 444 catalogue,
44 engine, 32 research and 11 acceptance tests passed. The database sweep passed
83 cases; the new chain case initially found an actor-denial classification,
then its corrected full-schema rerun passed. Independent later-page provenance
and legacy atomic paging also passed. New chain acceptance covers 12 scopes,
145 eligible Items each and 36 distinct sources, including populated upgrade,
source-guard rollback, actual 1000-reader cap and frozen replay. Main and
acceptance-app iOS/Android exports passed, as did explicit demo exports. The
fresh verified dependency audit has zero unmitigated findings. `npm run check`
stopped at refused Deno registry access; native Supabase/lock/CLI tests require
GitHub because local Docker is unavailable. Neither is waived.

Independent forward/client/hosted-probe reviews found no remaining blocker.
The exact new SQL SHA-256 is
`8ef909c3dc1d6f933536216319978e4ae522d5db91509ec89289e977e54418e8`.
Hosted preflight on `mwrnvfosrzwygrunrltm` matches all four guarded ranker bodies
and their owners/ACLs; existing migration tracking remains unrepaired.

The forward is deployed as provider version **20261006143148**, name
`catalog_prediction_chain`, on the exact target above. The repository filename
now matches that provider tracking; authored SQL bytes/hash are unchanged.
Source `5089d0abb65965c669fa540de9a025e34f92f178` is the reviewed rollout input.
The [rollout receipt](catalog-chain-rollout-2026-10-06.json) records all 153 prior
function identities: only the intended private dispatcher body changed, all
prior owners/ACLs and 152 unrelated definitions stayed equal, and five owner-only
helpers were added. Three new tables have RLS and no anon/authenticated/service
role table access. Existing users/Profiles/Items/Events/interactions/runs/
candidates/receipts retained their exact row digests before deployment and after
the rollback-only runtime probe. All **57** currently authorized existing
protocol 1/2 receipts replayed unchanged. No older forward or history repair ran.

The existing owned PersonalProfile's hosted BOOK and MOVIE probes each appended
**80 distinct Items over four pages**, preserving chain/prefix/per-card run
identity and exact retries. Both prove continuation beyond 50; both still report
MORE. Every probe write was rolled back. This is database-role/runtime evidence,
not real HTTP/JWT or Android gesture/visibility acceptance.

[PR #305](https://github.com/Kajooja/Kajo/pull/305) publishes the correction,
stacked on #304; reviewed application/SQL/rollout source is
`b076530c9698ac08c4ff8b2ace3322612da920a2`. The `build-android-apk` label is
verified on the PR before this final handoff commit. Its synchronization requests
the configured standalone APK behind the unchanged five mandatory gates.
The initial unlabelled PR discovery run #608 is separate from that APK request.
Use the latest labelled synchronization run for the new binary; GitHub owns its
actual head/merge/artifact identity. Publishing this handoff does not accept main.

The correction branch requests APK through a same-repository PR with
`build-android-apk`, retaining all five required gates. GitHub owns its latest
head/run/artifact identity. No completed new CI or APK is claimed by this source
checkpoint; #607 is the successful predecessor only. Retrieve the new run link
once and leave completion to the owner without polling.

Current next action: follow the correction's
[Actions runs](https://github.com/Kajooja/Kajo/actions?query=branch%3Afix%2F199-discovery-catalog-append).
After all gates and APK succeed, install as an update and execute the new
[DEVICE_TEST](DEVICE_TEST.md) append/layout round with existing accounts/data.
Keep draft #229 and accepted main unchanged until their remaining gates pass.

### CLI Data API transport recovery — 2026-10-06 / #304

Published source `86b90e1560ae5912cc3e4c357f446cea420a15b5` reached
[CI #606](https://github.com/Kajooja/Kajo/actions/runs/37456707996).
Validation (including the fresh audit, Deno tests and all four exports), platform,
two clean installations and populated forward upgrade passed. Only CLI
installation/history failed: after starting its isolated stack and performing
reset rehearsals, the sole JavaScript fetch path (`catalogRpc`) reported
`fetch failed`. APK was consequently skipped by its required dependency gate.
The old log does not identify the RPC, transport cause or daemon state; this is
not another runner-allocation failure or a failing dependency audit.

The harness now verifies live local Data API/database access with the read-only
`items?select=id&limit=0` query before each catalog RPC. Readiness requires HTTP
200 and exactly `[]`. Only recognized temporary transport errors, owned request
timeouts and gateway 502/503/504 responses receive a bounded retry (20 reads,
1.5 seconds per read and 500 ms between attempts). Other HTTP/JSON/permission
failures remain fatal. Requests use IPv4 loopback and close their connections;
the original POST executes once and is never replayed after a lost reply.
Existing schema-cache, unchanged-cardinality and anonymous-denial assertions
remain required. Reset/RPC sequence labels and sanitized failure codes replace
the uninformative bare error without exposing keys or CLI status.

Local validation: the database suite passed **81 tests**, followed by all **15**
final targeted stack/transport tests, including real loopback socket interruption
and a stalled response-body timeout. Root lint/typechecks, 39 dependency, 416
mobile and 444 catalog tests passed; the root check stopped at Deno lockfile
resolution because the local npm-registry connection was refused. No Docker executable is available locally,
so the actual isolated Supabase rehearsal must run in GitHub. The new run still
requires all five gates before APK; no successful new CLI gate or APK is claimed.

Publish the corrected head of labelled PR #304 to request the replacement APK.
Retrieve its run link once and leave progress to the owner without polling.
The existing six-case phone round remains next after a successful artifact.

### APK retry after GitHub Actions incident — 2026-10-06 / #304

[PR #304](https://github.com/Kajooja/Kajo/pull/304) contains the October security
corrections on `fix/238-native-audit-october`, based on the exact #301 source.
[CI #605](https://github.com/Kajooja/Kajo/actions/runs/37367448021) attempt 1
failed before either initial job acquired a hosted runner; GitHub reported runner
acquisition failure and an internal server error. Attempt 2 passed the isolated
platform and two-clean-installation jobs, but validate again acquired no runner
and executed no steps. Its dependent upgrade, CLI and APK jobs were skipped.
Neither attempt is evidence of a source regression or a completed APK.

[GitHub Status](https://www.githubstatus.com/) reports the October 5 Actions
incident resolved; Actions is operational at the October 6 retry checkpoint.
The owner requested any remaining corrections and another APK build, explicitly
without polling its progress after starting it.

The October 6 fresh audit also found two additional unmitigated advisories:
compression [GHSA-vc2v-76pw-4v95](https://github.com/advisories/GHSA-vc2v-76pw-4v95)
and source-map-js [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
Refreshed only their two lock leaves to published fixes **1.8.2 / 1.2.2**, within
the existing Expo CLI and PostCSS ranges. The compression `destroy` dependency
already exists in the lock. Parent/framework versions and the earlier exact
braces/forge source corrections are retained. The October 5 receipt remains
dated evidence for its former lock.
The [October 6 receipt](dependency-audit-native-2026-10-06.json) records the updated
lock and fresh verified audit, with zero unmitigated findings. Its raw report
still retains the 19 upstream findings covered by exact installed-source
corrections; it is not a zero-advisory upstream release.

Review found and corrected two Windows-only dependency-script defects: native
path containment must use `path.relative` rather than a literal POSIX slash,
and Windows cannot directly execute `npm.cmd`. The audit now launches npm's CLI
through Node when invoked with `npm run`, with a fixed `cmd.exe` command for
direct Windows invocation. Directory escapes remain rejected and the source
verification/audit severity rules are retained. The Linux runner failures above
are separate from these portability defects.

Local validation: clean installation, the fresh verified audit, all **39**
dependency regressions and the mobile/catalog/database/engine/research/acceptance
suites passed. Lint and typechecks passed, as did all four iOS/Android Hermes
exports. The complete root check stopped only at Deno dependency resolution:
this environment refused the npm-registry connection. Deno and the native
platform/installation gates remain mandatory in the new GitHub run.

Publishing the corrected PR head with its existing `build-android-apk` label
requests a fresh APK run behind all five gates. Leave completion for the owner
to follow through the [branch's Actions runs](https://github.com/Kajooja/Kajo/actions?query=branch%3Afix%2F238-native-audit-october).
No completed CI, APK or native Windows execution is claimed by this checkpoint.

### APK audit recovery — 2026-10-05 / #238

The owner-dispatched [CI #603](https://github.com/Kajooja/Kajo/actions/runs/37362675116)
on terminal-refresh source `825ecc1c809008a0c312e0bfef2b901476b86808` failed the
fresh dependency audit before an APK was built. The report has **19 high-severity
package findings from two upstream advisories**: braces GHSA-vfj7-8cjw-p6xm and
node-forge GHSA-86w9-cpqp-85rv. The platform job was cancelled; downstream jobs,
including the APK, were skipped. September 30 CI remains historical evidence.
The owner explicitly requested correcting these findings and starting another
APK build on October 5, leaving build completion for the owner to follow.

`fix/238-native-audit-october` continues the exact #301 source as a narrow #238
correction. Published latest versions remain braces 3.0.3 / node-forge 1.4.0, so
installation applies hash-checked source corrections: bounded parser/walker
nesting and strict nested DigestAlgorithm elements/empty NULL parameters.
Package identities, lockfile, frameworks and deployed forwards are preserved.
The fresh audit retains the full upstream report and accepts these two findings
only after verifying every installed copy and running the real security
regressions. New advisories, unknown source, missing patches or audit transport
errors still fail. This is **not a zero-advisory upstream release**; the exact
receipt is [dependency-audit-native-2026-10-05.json](dependency-audit-native-2026-10-05.json).
Replace the temporary corrections with reviewed fixed upstream releases when
available. See the [dependency correction contract](../architecture/ARCHITECTURE.md#verified-local-dependency-security-corrections--238).

CI supports an explicit `build-android-apk` label on same-repository PRs, retaining
all five mandatory gates before the APK. Its artifact name identifies the actual
PR merge checkout SHA; the PR head and run metadata identify the source branch.
Unlabelled PRs, fork PRs and the existing manual/main paths keep their documented
build boundaries. Neither #301 nor draft #229 is merged by this recovery.

### Phone result and terminal refresh follow-up — 2026-09-30

The owner reports that network disconnection and reconnection work on the phone.
This is a positive basic #240 observation; installed APK identity, device/OS,
page and remaining recovery subcases were not supplied. Keep their individual
acceptance open rather than repeat or discard the successful observation.

After loading BOOK recommendations to the end, the terminal pull-to-refresh
instruction cannot be used there: the gesture works only at the top. #199 now
owns this concrete current-reader defect separately from its later broad grid
work. `fix/199-discovery-end-refresh`, based on #229's published native head,
adds a downward pull beginning on the end notice plus an accessible **Päivitä
haku** button through the existing scoped reader. Repeated triggers coalesce;
old footer callbacks are inert after unmount. Source review/CI and a corrected
installed APK remain separate from the owner's current test result. The exact
follow-up cases are in [DEVICE_TEST](DEVICE_TEST.md). Continue the remaining
native tests with existing accounts and preserve their data. This packet changes
no server forward, catalog data, outbox or other release gate.

The owner-selected repository hygiene is completed. The September 30
[cleanup receipt](retros/branch-cleanup-2026-09-30.json) verifies **57 merged
development refs deleted, 10 necessary refs retained**: main, draft #229 and all
eight consumed #182 operation/recovery refs. The 55 original candidates plus the
two later merged #297/#298 handoff refs were checked against fresh heads,
merged-PR reachability and executable/file-link dependencies before deletion.
Independent readback verified every retained SHA unchanged. Accepted #296 is an
ancestor of both accepted main and the native source, resolving its old hold.
The September 28 inventory remains dated pre-deletion evidence; later review
branches and intentional head updates are separate operations.

[ROADMAP's disposition table](ROADMAP.md#unfinished-work-disposition--2026-09-29)
continues to place all 18 audited issues and draft #229. Later UX, identity,
Shared and beta work retain their own prerequisites. No MVP gate was removed.

PR #294 is accepted at main `3500f9b709e5315cb864f9bcbf9f004c76596bce`,
all five CI #580 gates, 867 tests/four exports: bounded terminal catalog evidence
and independent all-copy recovery-key cleanup. PR #295 is accepted at main
`cd224d277f33b105e63cd83126d111b12b64ba10`, reviewed
`aa7c2fc61ed99ea1e4ffcc39a07aaf6aa963d979`, all five CI #582 gates,
880 tests/four exports: fail-closed production configuration and bounded auth
input before lookup. Hosted auth deployment, distributed abuse/anti-enumeration,
provider settings and the platform upgrade remain distinct #160 gates.

PR #296 is accepted at main `8525ecf32a39757a1f660d41ffa788c7276f7bcc`,
reviewed `7b0062e668bda1fb5e2b247e1225dd42175256eb`, after all five CI #585
gates. It resolves #238's three recorded advisory families with decoder 0.5.0
and a hash-checked query-string 7.1.3 CommonJS adapter, UUID 11.1.1 for xcode's
existing v4 call, and coordinated Vitest 4.1.11. Expo/RN/router and Vite 7.3.6
stay unchanged. Five regressions cover routing, bounded malformed input, parent
integrity, auth callback parameters and xcode identifiers. The
[audit receipt](dependency-audit-2026-09-28.json) records zero known advisories
for the exact lock. Actual native/link round-trip acceptance remains separate.

The preceding native head `c6509c6e17dd02aa77f5c48d56c789be0ff2ef13`
passed all five [CI #593 gates](https://github.com/Kajooja/Kajo/actions/runs/36538244179),
1,049 tests/four exports. The September 30 standalone dispatch
[CI #594](https://github.com/Kajooja/Kajo/actions/runs/36681309205) then failed the
fresh dependency audit and produced no APK. Three newly reviewed brace-expansion
DoS advisories affected the formerly clean 1.1.18/5.0.9 leaves. Its two platform
and clean-install gates passed; the remaining jobs were skipped. The earlier
zero-advisory receipt is point-in-time evidence rather than a permanent guarantee.

The compatible #238 correction in this checkpoint refreshes only those four lock
leaves to **1.1.21/5.0.12**, preserving every minimatch parent API and the accepted
routing-decoder adapter, Expo/RN/router, UUID and Vitest versions. Eight ordinary
matching and bounded hostile-input regressions join the five existing dependency
tests. Clean installation, all 13 dependency tests and the local root check pass;
[the main receipt](dependency-audit-2026-09-30.json) records the exact lock and
fresh zero-advisory result. Its source PR still requires all five CI gates before
merge. The native graph is measured separately in
[its receipt on the exact source](https://github.com/Kajooja/Kajo/blob/2cfa2f3b206cba87712f3d531a78f00e24e59791/docs/project/dependency-audit-native-2026-09-30.json).

Draft [#229](https://github.com/Kajooja/Kajo/pull/229) publishes corrected head
`2cfa2f3b206cba87712f3d531a78f00e24e59791`, tree
`ff0b9367aa2dd5227931a839880c5b0814dcaf4f`, incorporating correction
`9a8b951ffefcbd53671f6046f3560f5a2ee33c5d`.
[CI #595](https://github.com/Kajooja/Kajo/actions/runs/36686521092) owns its PR
checks. Replacement standalone dispatch
[CI #596](https://github.com/Kajooja/Kajo/actions/runs/36686741366) uses that
same exact head; its conclusion and `kajo-android-standalone-2cfa2f3b206cba87712f3d531a78f00e24e59791`
artifact are the authoritative build receipt. Native local root check and the
separate native audit also pass. The source retains immutable delivered origins,
protocol-2 pagination, catalog description/credit and cold-history scope protection;
all ten already deployed native forwards retain their exact bytes. #240's focused
foreground reader preserves the exact request/context/cursor, accepted prefix and
15-second deadline with at most three coalesced automatic attempts. Only successful
backend recovery clears the error; an expired cursor requires explicit new search.
This remains draft implementation, separately from accepted main and real device
observations.

**Next bounded action:** follow the latest corrected PR #304 APK run. For the
October 6 request, start the build and leave completion to the owner without
polling. Only a successful new APK containing the terminal-refresh and security
corrections is suitable for the six-case phone test supplied on October 5.
Record its actual run/artifact/checkout SHA, OnePlus model and Android version.
Preserve the positive September 30 basic reconnect observation; complete the
remaining configured-device/fresh-account gates with existing accounts and data.
Keep #229 draft. Current source, CI and device acceptance remain separate; do not
repeat deployed forwards or consumed catalog requests. After acceptance, continue
Sprint 014 in ROADMAP order.

### Preserved #182 catalog and operation ledger

**The two approved BOOK descriptions are applied and independently verified.**
The owner ran the accepted CLI from PR #264/main
`51919db1ee8d5384cd724047dcf8293a27b51261` on September 24. Batch 1 updated
exactly two Items; batch 2 was the required verified empty checkpoint. The actual
uploaded run is `completed`, with both readbacks, the original claim, twenty
consumed provider attempts and unchanged review history. The
[completion checkpoint](sprints/SPRINT-014.md#book-pilot-completed-and-next-packets--2026-09-24--182)
records the complete archive **version 11**, exact hashes, acknowledgements and
preservation checks. Do not restore the old reviewed state or repeat apply.

The owner's earlier post-pilot request selected **#182 pinned Work/Edition
dump intake** as that packet and independent **[#265](https://github.com/Kajooja/Kajo/issues/265)
unsupported latent fallback correction and bounded MovieLens prefix research**
alongside it. This is the dated operational ledger, not a second current handoff.
The local intake and bounded cloud acquisition workflow are now accepted. Actual [run 35995362978](https://github.com/Kajooja/Kajo/actions/runs/35995362978)
read one complete **4,248-byte** metadata response, then failed before any dump
request. A separate accepted metadata-only diagnostic recovered identical bytes and
proved the cause: the two files total **16,644,821,648 bytes**, above the original
15,000,000,000-byte cap. Both requests are consumed. The separately accepted
reviewed acquisition also ran once and failed at a selected Work identity guard;
its encrypted artifact retained no raw records. [PR #277](https://github.com/Kajooja/Kajo/pull/277)
supplies bounded encrypted failure evidence and is accepted on main
`3e865ac9ecfcda427ab03d50d1592ff72b4d038d` after all five
[CI #544 gates](https://github.com/Kajooja/Kajo/actions/runs/36008368238).
[PR #278](https://github.com/Kajooja/Kajo/pull/278) accepted the separate bounded
Work-prefix diagnosis on main `99ed067ba7aec9f9bbb63d806cafbafc8a0bb4d1`
after all five [CI #547 gates](https://github.com/Kajooja/Kajo/actions/runs/36341667520),
**606 tests / four exports**. Its one-shot September 27 run succeeded and retained
one rejected selected row. Authenticated private replay proves that the current
row has matching Work key/type and a `location` equal to its own canonical path;
the guard rejected the mere presence of that field.

[PR #279](https://github.com/Kajooja/Kajo/pull/279) accepted the exact-self-location
correction on main `8c4d8ecf65187f12bb30ed4207d03848fd87d292`, after all five
[CI #549 gates](https://github.com/Kajooja/Kajo/actions/runs/36343239488),
**611 tests / four exports**. Foreign/null locations and real redirects remain
rejected. New failure evidence is v2; historical v1 recovery retains its original
rule. The captured row now passes identity validation, but its description still
fails `markup-or-url`; no additional text is approved.

The [full-acquisition continuation contract](../architecture/ARCHITECTURE.md#full-acquisition-after-the-self-location-correction--182)
is accepted through [PR #281](https://github.com/Kajooja/Kajo/pull/281), main
`8a9aefbf87870abd932dac53c6d4abae7fd0683d`, after all five
[CI #553 gates](https://github.com/Kajooja/Kajo/actions/runs/36347927166),
**645 tests / four exports**.

The public request branch `catalog-acquisition/ol-20260831-continuation`, head
`f2558795be45be17bd2632071cf25746e4ec82a2`, activated once.
[Run 36349027698](https://github.com/Kajooja/Kajo/actions/runs/36349027698)
completed with failure on September 27. Private recovery and authentication
verification are complete; the owner retains the private evidence separately.
Approvals and database writes remain zero. The
[result checkpoint](sprints/SPRINT-014.md#full-acquisition-continuation-result-and-handoff--2026-09-27--182)
records the public source/request/run acceptance and continuation boundary.

The [offline conflict policy](../architecture/ARCHITECTURE.md#offline-selected-record-conflict-policy--182)
is accepted through [PR #283](https://github.com/Kajooja/Kajo/pull/283), main
`1f3bd049a37f182a773a4101791f9962b87cfb99`, after all five
[CI #557 gates](https://github.com/Kajooja/Kajo/actions/runs/36352866962),
**678 tests / four exports**. Its explicit local policy excludes entire original
Work–Edition pairs, preserves strict identity rejection and grants no text approval.

The [conflict-aware acquisition core](../architecture/ARCHITECTURE.md#conflict-aware-acquisition-core-and-successor-boundary--182)
is accepted through [PR #284](https://github.com/Kajooja/Kajo/pull/284), main
`686ac92fe5900287c0699ba69434b743e3e2515d`, after all five
[CI #559 gates](https://github.com/Kajooja/Kajo/actions/runs/36355123996),
**716 tests / four exports**. It supplies strict request/result contracts,
complete-source streaming with bounded exclusion and pure payload replay.

The [guarded operator path](../architecture/ARCHITECTURE.md#guarded-operator-path)
is accepted through [PR #285](https://github.com/Kajooja/Kajo/pull/285), main
`24631688fbbbf73b2197768d5df686e26ff361dd`, after all five
[CI #561 gates](https://github.com/Kajooja/Kajo/actions/runs/36388094791),
**738 tests / four exports**. The actual predecessor passed its original accepted
inspector. Source/dependency/CI and Git checks passed, and separate private recovery
custody was saved and read back before activation.

The explicit policy permits at most **8 conflicted original pairs / 8 MiB
diagnostics** under the unchanged source and retention limits. Sole-file request
head `11bada2563374616cc8d014d787039c9235ea071` on
`catalog-acquisition/ol-20260831-conflicts` activated once.
[Run 36391833763](https://github.com/Kajooja/Kajo/actions/runs/36391833763)
ended with failure on September 28. Private receipt-bound recovery verified
`dump-line-limit` in the Edition source after the Work source completed with
publisher checksum verification. No terminal row evidence was retained; its
identity, contents and selected/unrelated status remain unknown. The complete
private recovery result is preserved. The
[result checkpoint](sprints/SPRINT-014.md#conflict-acquisition-result-and-line-framing-handoff--2026-09-28--182)
records the acceptance boundary. Receipt provenance is operator-captured;
encryption alone is not source authentication.

The [local Edition line diagnostic](../architecture/ARCHITECTURE.md#local-edition-line-framing-diagnosis--182)
now uses that same byte framer and retains at most an explicitly bounded header
prefix. It reports a scanner-observed size lower bound and selected/unrelated
status only when the complete outer envelope is valid; otherwise selection is
unknown. It neither retains nor validates the oversized JSON record. Nineteen
synthetic regression tests cover chunk/UTF-8/CRLF boundaries, resource exhaustion,
stream errors, schema tampering and the private local CLI. This source packet
does not identify the discarded terminal row or authenticate a publisher source.

The [guarded Edition-prefix operator path](../architecture/ARCHITECTURE.md#guarded-edition-prefix-operator-path)
is accepted through [PR #288](https://github.com/Kajooja/Kajo/pull/288), main
`3d12a7f69534fef305b7ca37767626ae584b688e`, after all five
[CI #567 gates](https://github.com/Kajooja/Kajo/actions/runs/36401690949),
**786 tests / four exports**. Actual local preparation authenticated the consumed
conflict result through its original accepted recovery, all six fixed predecessor
requests and the complete source/dependency/CI closure. A separate private recovery
package was saved and read back before the owner-approved activation.

The distinct request on `catalog-diagnostic/ol-20260831-edition-prefix`, head
`be0ec18cdc968b5643e45c57c5ab9919f885e195`, activated exactly once.
[Run 36435310394](https://github.com/Kajooja/Kajo/actions/runs/36435310394)
completed successfully on September 28. Private receipt-bound recovery verified
`diagnosed` / `dump-line-limit`: a complete canonical outer Edition header
classifies the newly observed oversized row as outside the original roster.
Its inner JSON, complete row and exact size remain unvalidated. This observation
does not identify the earlier discarded terminal row or verify a complete source.
The complete private result is preserved and independently read back; the
[result checkpoint](sprints/SPRINT-014.md#edition-prefix-result-and-framing-handoff--2026-09-28--182)
records the operational boundary. No raw header or private row identity is public.

The reviewed caps were **512 MiB compressed / 3 GiB decoded / 2,000,000 rows /
10 minutes**, with the unchanged **1,049,600-byte line ceiling** and at most
**4 KiB header prefix**. No retry or automatic limit increase followed.

The [bounded Edition framing core](../architecture/ARCHITECTURE.md#bounded-edition-framing-core--182)
now supplies the explicit local `scanEditionFramedStream` entrypoint. Only a
complete canonical outer header within 4 KiB proving a key outside the entire
original roster permits an oversized row to be discarded through its terminating
LF. Selected/unknown rows still fail, including quarantined pairs. The line
ceiling, selected identity guards, full compressed-byte checksums and all resource
limits remain. Twenty synthetic regressions cover chunk boundaries, a streamed
32 MiB row, exact accounting, integrity failures, abort/timeout and old-entrypoint
isolation. Historical scanners and recovery contracts retain their original rules.
The [source checkpoint](sprints/SPRINT-014.md#bounded-edition-framing-core--2026-09-28--182)
records validation; exact source/CI acceptance stays in Issue #182.

The [framed full-collection successor](../architecture/ARCHITECTURE.md#framed-full-collection-successor-core--182)
now integrates that scanner with the complete Work/Edition collector, unchanged
pair exclusion, source integrity checks and cumulative retention/deadline bounds.
Its separate request reconstructs the exact consumed Edition diagnostic and
preserves all seven public predecessor identities, original roster/pins/recipient,
full-source limits and the **8-pair / 8 MiB** conflict policy. Distinct result and
encryption contracts replay retained records, quarantine, source accounting and
new discard counters. A stalled opener is bounded and a late body is destroyed.
Private inspection remains payload consistency only; discarded headers/JSON and
full dump bytes cannot be independently replayed from that payload. The
[source checkpoint](sprints/SPRINT-014.md#framed-full-collection-core--2026-09-28--182)
records tests and scope. No actual request or provider operation is included.

The [guarded framed operator](../architecture/ARCHITECTURE.md#framed-full-collection-operator--182)
now supplies local preparation/recovery and a distinct first-push/first-run
workflow. All seven Git predecessors, accepted source/dependency/CI receipts and
22 private predecessor inputs are bound before collection. Complete original
Edition/conflict/continuation closures are checked before staging the key or
executing their original inspectors. The oldest closure retains its original
17 files. A process-group deadline stops nested children; all three temporary key
copies are removed on success, failure and timeout. The
[operator checkpoint](sprints/SPRINT-014.md#framed-full-collection-operator--2026-09-28--182)
records validation and limitations. No request branch or provider operation is
included in this source packet.

The private framed operation was prepared from accepted [PR #292](https://github.com/Kajooja/Kajo/pull/292),
main `bc5546eb8f8851ebd8594725b5b25141c72e3aa1`, reviewed tree
`c73ef76213c97e8f4c13c857eaa92318ae755268`, after all five
[CI #576 gates](https://github.com/Kajooja/Kajo/actions/runs/36457191366),
852 tests/four exports. Fresh durable readback bound all 22 predecessor inputs;
the accepted preparer authenticated the original Edition/conflict/continuation
chain before writing the request. All 18 retained public fields match the prior
public request. The exact sole-file request commit is
`67b4a7480af41c1e664c6b80bbe7754530ec59b2`; it has accepted main as its only
parent. The prepared request and exact Git/source receipts were saved and read
back before activation.

One distinct [run 36464232252](https://github.com/Kajooja/Kajo/actions/runs/36464232252)
completed its only attempt with failure. Accepted-source private recovery verified
`failed` / `dump-conflict-fatal` while Edition was active. The payload records
complete Work/publisher-checksum verification and prior bounded unrelated Edition
discards; full dump bytes and discarded headers/JSON are absent, so these remain
collector assertions. The terminal rejected row, identity predicate and policy
reason were not retained. No exact terminal cause can be recovered from older
quarantine entries. Candidate output is empty.

Runtime/ZIP/ciphertext/unseal/chronology and original-source recovery receipts all
passed; fresh post-run read-only reconciliation found no changes to the original
targets. The completed private archive was saved and read back byte-for-byte,
including all manifested members. Its result stays `payload-consistency-only` /
`provenanceVerified: false`, with separate checked operator receipts. The
[operation checkpoint](sprints/SPRINT-014.md#framed-full-collection-operation--2026-09-28--182)
records the result and a post-command key-cleanup discrepancy: staged copies were
removed explicitly and a separate read verified absence; the cause is unresolved.
All **eight** requests are consumed; never rerun, reset or reuse any of them.

The separate diagnostic source above preserves the exact selected row and original
predicate/policy reason without relaxing identity, framing, roster or exclusion.
Synthetic nested-process and independent-command checks verify key absence; the
original anomaly's cause remains unproved. All consumed results and original
inspectors stay fixed. A new actual diagnosis requires an accepted encrypted
operator, explicit operational request and independent key-absence gate; this
result grants no new provider run.
Complete collection, fresh reconciliation and individual language/rights review
still precede any writer. Approvals, database writes and model admissions remain
zero; no catalog/MVP/device/release gate closes. Exact acceptance stays in
[Issue #182](https://github.com/Kajooja/Kajo/issues/182).
The independent research packet has a corrected fallback and a completed,
reproduced exploratory study on the same authorized dataset. It admits no model.
Source/CI acceptance is recorded in the respective issues.

The continued September 24 request also selects independent **[#269](https://github.com/Kajooja/Kajo/issues/269)**
provider-backed BOOK/MOVIE concept mapping and actual catalog coverage. This
Phase 14.3 audit can proceed while #182 source acquisition is resolved. It does
not replace the primary dump packet or change serving tags, Memory or scoring.

The owner reports successful full-application use on **2026-09-23** after the
cold List/history entry, Profile switching and error/retry test instructions:
“Kaikki toimii.” This accepts the behavior they exercised. The report also
identifies Discovery's Katsotut navigation defect and queues browse/detail
refinements for a suitable later UI packet; it does not close those issues.
The owner explicitly requests substantial continuation on the existing roadmap.

The accepted source for that requested full-app check is
[PR #261](https://github.com/Kajooja/Kajo/pull/261), main
`6d8e75df4d66ce2aa209f806c09bfb5e379c560c`, after all five
[CI #516 gates](https://github.com/Kajooja/Kajo/actions/runs/35861047609).
Its exact request identity prevents Luetut/Katsotut from retaining another
actor/Profile's rows or errors, including rapid A → B → A. Local validation
passed **466 tests**, lint/typechecks, four iOS/Android exports and companion
isolation guards. Six new regressions fail on old source; all eight pass fixed.
This follows [PR #260](https://github.com/Kajooja/Kajo/pull/260), main
`a5131650ceb837ea7fc5fe640ff0798bffaa4aa8`, accepted after all five
[CI #514 gates](https://github.com/Kajooja/Kajo/actions/runs/35855628858),
which loads exact canonical Item/credit for cold List/history detail entry.

The earlier OnePlus companion report remains accepted separately. Its source is
[PR #259](https://github.com/Kajooja/Kajo/pull/259), main
`8e7625e8f3867fa34ca709aa10ce76e83588fe82`, with all five
[CI #512 gates](https://github.com/Kajooja/Kajo/actions/runs/35635820105),
442 local tests and four exports. Do not repeat either successful exercise only
to fill missing metadata. Exact installed binary/source, model/OS and individual
accessibility, OS-refusal or delayed-response observations were not supplied;
none are inferred. The latest full-app report is not native acceptance of the
independent #229 branch. The two subsequently applied real paragraphs and their
source/license links still need a focused phone observation.

The [owner-feedback checkpoint](sprints/SPRINT-014.md#full-app-feedback-and-deferred-ui-notes--2026-09-23--182)
maps all new notes to #199, #200, #231, #239 and FUT-CAT-001. Product requirements
live in [UX_PRINCIPLES](../product/UX_PRINCIPLES.md#owner-browse-refinements--planned-2026-09-23),
with Phase 17.0 scheduling in ROADMAP. They are recorded, not implemented here.

Structured attribution is accepted through [PR #257](https://github.com/Kajooja/Kajo/pull/257)
on main `a4e5bbf8d587c69a8ea3a90aecbd49c652d89df0`. Final head
`f300c5adcea3cee9dc0828945add936a4bad13d6` passed all five required
[CI #508 gates](https://github.com/Kajooja/Kajo/actions/runs/35536998176).
The complete local check passed **430 tests**, lint/typechecks and both
iOS/Android bundle smokes. Native CLI CI verified populated upgrades, concurrent
writer locks, guarded replay and anonymous PostgREST denial for v1 and v2.
The owner explicitly approved publication and merge on 2026-09-20 and requested
immediate continuation. The interrupted publication and CI #507 fixture failure
are resolved; production migration/runtime bytes did not change in the CI fix.

The exact new catalog-only forward is **installed and verified** as of
**2026-09-20 21:07 UTC**. Source file
`20260920000607_description_attribution.sql` retains SHA-256
`57af455775f7f43d7cfe81fc8af887128358c3c3e056f785b4cbb3545bfab043`.
**Do not deploy it again**, replay the installed v1 description migration or the
six independent native forwards, or alter migration history. The
[rollout checkpoint](sprints/SPRINT-014.md#description-attribution-source-acceptance-and-rollout--2026-09-20--182)
records verification and limits; the exact source/hosted version mapping,
function preimages and full snapshots are retained in the owner's controlled
`Kajo-description-attribution-rollout-v1.zip`. [Issue #182](https://github.com/Kajooja/Kajo/issues/182)
owns exact publication/CI/merge identities.

### Verified hosted result — 2026-09-20

Fresh read-only snapshots before and after installation confirmed all five
catalog/validator function definitions, owners, ACLs and settings match the
approved source. Service-role execution is allowed; anonymous/authenticated
execution is denied. All remain invoker functions with empty search paths.
The read-only validator probe accepted bound synthetic credit and rejected
missing credit, unsafe links, a wrong text hash and an extra private field.

Exactly one migration was added. All prior history entries, unrelated function
definitions, triggers and default privileges are unchanged. Full Item, source
and alias fingerprints match before and after. BOOK remains **415 visible /
427 stored / 385 images / 0 descriptions**; MOVIE remains **425 / 437 / 425
images and descriptions**. Zero managed descriptions or discoverable mocks.
Security advisor findings are unchanged. No catalog paragraph was written.

### Frozen pilot and rights decision

Accepted [PR #254](https://github.com/Kajooja/Kajo/pull/254) and its installed v1
rollout supplied the guarded workflow. [PR #255](https://github.com/Kajooja/Kajo/pull/255)
records the actual preview/review; [PR #256](https://github.com/Kajooja/Kajo/pull/256)
adds offline review amendment and the source-specific cached audit.

The ten fixed candidates spent **all twenty allowed provider attempts**: ten
Editions and ten exact reviewed Work fallbacks. The September 23 pinned-source
review now approves **Pieni elämä (position 1)** and **Romeo ja Julia (position 4)**
for `kajo-internal-pilot` with CC BY-SA 4.0 credit. Both complete paragraphs match
specific Wikipedia revisions in independent HTML and wikitext comparisons.
The source-specific decision is retained with its exact hashes/use/changes;
it is not a blanket permission assertion about Open Library. **Six rights holds,
two text exclusions remain.** Both database batches are now completed and
verified: two descriptions were written, followed by the empty checkpoint. The
six-description usefulness target is still unmet; actual phone observation remains open.

The existing offline `amend-review` CLI preserved all cached records, spent
attempts, the original claim and both prior reviews. It ran with network disabled
and no database credentials; replay was rejected without changing state. Current
review hash: `28e81b46b3ff11cfadf8e0d5708a776c2cdd69beb6cad0a9ddac523970ce2265`.
The [pinned-source checkpoint](sprints/SPRINT-014.md#pinned-book-source-review-and-apply-preparation--2026-09-23--182)
retains revisions, evidence/packet/state hashes, review limits and validation.
Edition language remains distinct from description/original language.

Fresh read-only coverage on **September 24 at 09:39:21 UTC** confirms BOOK
**415 visible / 427 stored / 385 images / 2 descriptions**; MOVIE **425 / 437 /
425 images and descriptions**. Exact text, public credit and private permission
bindings match the reviewed packet. Complete Item/source preimages and aliases
confirm preservation outside the intended managed fields and update timestamps.
No new provider request, migration or model admission accompanied the apply.

`@kajo/catalog-contracts` and the installed v2 writers bind public credit and
private permission evidence to the same text/record. Canonical Item enrichment
and detail revalidation hide managed text with missing, unsafe or mismatched
credit. Source/license links and changes remain visible with collapsed text.
This closes the structural gap; it grants no rights to any real paragraph.

### Isolated native test companion — 2026-09-21

`apps/description-acceptance` now provides a runnable synthetic description
test without a login, production router, database client or Event providers.
It has distinct native ID `app.kajo.descriptionacceptance` and displays its
Git source commit, dirty-worktree flag and OS. Production detail and the test
app reuse `ItemDescription`/`DescriptionCredit`; collapse styling, fail-closed
projection and the real native link opener are shared. The main app retains its
existing entry point and Profile/List/Shared behavior.

The seven cases cover valid long credit, missing credit, an unsafe URL, altered
cached text, text-only fallback, explicit legacy text and no description. Three
ambient themes and an explicitly simulated one-shot link error support manual
checks. Simulation is not an actual OS refusal, and successful `openURL` is not
proof that the destination loaded. The synthetic source/license URLs lead to
distinct `example.com` test destinations, not a real source-rights assertion.

The root check now covers the companion: **442 tests**, lint/typechecks, normal
mobile iOS/Android exports and companion iOS/Android exports. The actual companion
source maps must contain the shared renderer and exactly one React instance,
and reject production auth/data/Event modules or unreviewed first-party imports.
A local Metro readiness/manifest/development-bundle probe passed on September 21.
The September 23 owner report above now supplies successful OnePlus companion
feedback. No new APK is dispatched or polled in this continuation. See the
[implementation and run commands](sprints/SPRINT-014.md#isolated-native-description-test-companion--2026-09-21--182).
Issue #182 owns exact source PR/head/CI/merge acceptance for
`feat/182-native-description-acceptance`.

### Dump intake and consumed acquisition evidence

`feat/182-book-dump-intake` supplies the local intake under #182. The
[source delivery checkpoint](sprints/SPRINT-014.md#offline-book-dump-intake--2026-09-24--182)
records implementation, actual plan, tests and acquisition limits. Read-only
exact-ID snapshot at **2026-09-24 09:56:48 UTC** contains **385 provider BOOKs**,
zero identity mismatches and two already described/managed exclusions: **383**
possible targets. This is a target inventory, not a count of usable descriptions.
The thirty curated BOOK alias gaps remain a separate exact mapping task.

The bounded intake reads explicitly pinned same-date local Work and Edition
dumps, verifies complete-file hashes and resource limits, and extracts only those
exact identities. It does not repeat popularity/ratings selection, infer text
rights/language or call providers/RPCs. Stage review candidates with complete
source/target/version bindings; require a later explicit review and guarded
writer bridge before any catalog update. Actual plan execution succeeded with these 383 targets and 766 expected exact
Work/Edition records. It made zero provider calls, writes or approvals.

PR #271 is merged as `ec17a0738702074dedecff00e60a2e529939c8fc`, exact tree
`138067fc92a48f210a0713554b2f8aa37b20e085`, after all five
[CI #533 gates](https://github.com/Kajooja/Kajo/actions/runs/35993942738),
**528 tests** and four exports. The exact reviewed request was activated once
from that accepted source, with private key custody already retained.

The actual run failed at metadata validation: **one GET / 4,248 bytes / zero
Work or Edition GETs / zero dump bytes / zero selected records**. The encrypted
artifact was downloaded and its digest, ZIP CRC and authenticated unseal verified.
The original receipt retained only a generic code plus metadata size/hash; the
subsequent diagnostic below establishes the precise cause. Fresh
read-only comparison at **2026-09-24 11:56:28 UTC** confirms all **383** requested
identities, source/Item versions and description states unchanged. No text was
approved or written. The original request/run is consumed and must not be rerun.

PR #272 is accepted as `d3681fcdfa9a877b0f314159d87208d0ccd0f7f8`, tree
`c7267e44c0c1b93ffcfa2c4c92f392e5724b6914`, after all five
[CI #536 gates](https://github.com/Kajooja/Kajo/actions/runs/35997619768),
**541 tests / four exports**. Its old-receipt-compatible forward retains precise
private codes and exact bounded metadata while sanitizing public logs.

The distinct [diagnostic run 35998771483](https://github.com/Kajooja/Kajo/actions/runs/35998771483)
succeeded at **2026-09-24 12:23:41–12:23:54 UTC**. Its single metadata GET returned
**4,248 bytes**, exactly the original SHA-256
`b5613fc9b54dbd4592cfd71a71571d0e17028be76c9592eb1c7152ae7df3742b`.
Authenticated recovery and the byte-identical original validator reproduce
`acquisition-compressed-byte-limit`: Works **4,058,336,593** plus Editions
**12,586,485,055** totals **16,644,821,648 bytes**, above the old 15 GB cap.
This is now a proven historical cause. The diagnostic fetched no dumps, per-Item
sources or ratings, approved no text and wrote no database rows. It is consumed.

[PR #275](https://github.com/Kajooja/Kajo/pull/275) is accepted as
`349c8b5e27b9a0eb88e178f19361e2bea0d7a026`, after all five
[CI #539 gates](https://github.com/Kajooja/Kajo/actions/runs/36000730750),
**566 tests / four exports**. Its separate 16,644,821,648-byte contract preserves
the original roster/recipient, exact publisher pins, prior-run provenance, old
immutable limits and full-source integrity checks. The owner authorized merge
and activation after source acceptance and durable request/key custody.

Request `4727b4cb3d82a7bc10d134d1c2b7e9fcdbdf22bb` was consumed by
[run 36003953876](https://github.com/Kajooja/Kajo/actions/runs/36003953876).
The Work stream failed with `provider-identity-mismatch` at a selected row at
dump position **804,172**, after **78,731,116 compressed / 456,982,528 decoded bytes**.
Its 11 preceding matches / 40,567 bytes were transient: authenticated recovery
contains **zero raw records or candidates**. The selected target and failing
predicate are unknown. No Edition request, database write, complete EOF or
full-source checksum verification occurred. Fresh read-only reconciliation at
**2026-09-24 13:14:31 UTC** confirms all **383** selected targets unchanged.

`fix/182-dump-failure-evidence` implements the bounded offline forward. Its
[contract](../architecture/ARCHITECTURE.md#selected-row-failure-evidence--182)
retains one failing selected TSV row, source/row/roster bindings and a fixed private
identity predicate in encrypted failure output; recovery replays that predicate.
Independent review and all 86 targeted tests pass; PR #277 is accepted as recorded
above. It cannot recover the row discarded by
the consumed run or establish its unknown cause. Historical receipts, public-log
silence, separate diagnostic-byte accounting and all identity guards remain.

The selected [Work-prefix diagnostic contract](../architecture/ARCHITECTURE.md#bounded-work-prefix-diagnosis--182)
requests only bytes **0–104,857,599** of the same pinned Work file. It accepts an
exact HTTP 206 range/length with identity encoding; HTTP 200 or mismatched headers
fail without a full-download fallback. Bounds are **100 MiB compressed / 1 GiB
decoded / 1,000,000 rows / 600 seconds / four official redirects**. The first
selected identity failure supplies one encrypted diagnostic row; exhausted range,
decoded or row bounds without that evidence are inconclusive. This verifies no
full-source checksum and supplies no review candidates, approvals or writes.

The distinct request was prepared from the authenticated prior failure and
retained with the original key before activation. [Run 36342443617](https://github.com/Kajooja/Kajo/actions/runs/36342443617)
completed its only attempt on **September 27 at 18:55:52 UTC** with `diagnosed`.
At row **804,172**, Work **OL82565W** / selected Edition **OL59004684M** has outer
and JSON key `/works/OL82565W`, type `/type/work`, and the exact same value in
`location`. The preserved **5,234-byte** row replays `record-location-present`
under the original guard. Recovery verified all fifteen accepted source files,
request/run binding, artifact ZIP CRC/hash and authenticated unseal. No raw row
is committed to Git. The [actual checkpoint](sprints/SPRINT-014.md#bounded-work-prefix-diagnosis--2026-09-27--182)
retains the source, request, counters and evidence hashes.

This establishes the current diagnostic cause. The older acquisition discarded
its row/hash, so the matching position does not prove identical historical input.
The prefix request is consumed and must not be replayed. It made two Work GETs
including one redirect and no Edition, metadata, per-Item or database requests;
full-source verification, candidates, approvals and writes remain zero.

PR #279 accepted the offline exact-self-location correction and versioned
failure replay. PR #281's separately accepted full continuation has now run once
and ended in failure; private recovery and authentication verification are
complete. The offline policy and successor core are accepted; the guarded operator
path is implemented. Follow the single current handoff at the top of this file
and the
[result checkpoint](sprints/SPRINT-014.md#full-acquisition-continuation-result-and-handoff--2026-09-27--182).
All five requests remain consumed. Complete publisher EOF/checksum verification,
fresh reconciliation and source-specific rights review still precede a writer
bridge; this packet supplies no additional approvals or database writes.
Independent #273 remains accepted synthetic sensitivity evidence.

The completed pilot is recovery evidence, not an input to a new preview or apply.
Its six rights holds require their own evidence. Preserve both installed
forwards, all twenty spent BOOK attempts and the finished MOVIE budget. Observe
only the two new real paragraphs and their links on the phone when convenient;
do not repeat the accepted full-app/companion exercise.

### Completed MOVIE pass and preserved gates

MOVIE remains complete for its bounded pass. English **259** and Finnish **60**
remain its main offering, **75.1%** together. Keep original language `fi` separate
from Finnish production `FI`, and preserve personalization. Its 18 attempts and
30 charged page slots are exhausted; do not perform another import under it.

#182 / MVP-CAT-001..003 / Phase 14.3 remain open for rights, broader BOOK
descriptions, curated exact mapping, repeatable refresh, normalized feature
quality and native usefulness. Preserve #229/device/fresh-account gates, the
six immutable native forwards and rejected D2 challenger admission. The owner
companion and full-app reports are recorded above. The owner executed the two recorded importer batches. This continuation
verified their readbacks and completed archive; no APK dispatch, model admission
or separately queued UI change is included.

## Canonical bootstrap feature sensitivity — #273

The independent [offline protocol and report](../../research/reports/catalog-feature-baseline-273.md)
now reproduce two byte-identical executions of the frozen 840-Item snapshot.
They compare current tags (A), already represented six-concept assertions (B)
and all reviewed assertions (C) with **24 synthetic profiles / 144 top-50 queries**.
Canonical SQL is unchanged; only the disposable PGlite clock is fixed. No real
outcomes, personal histories, training, database writes or serving changes enter.

C−B changes all **24 BOOK** top-50 memberships (600 entries/exits counted as
Item-query occurrences), with no change in **24 MOVIE** lists. Crucially, the
existing novelty formula rewards nonempty unmatched tags: MOVIE→BOOK list changes
occur even when bootstrap transfer is exactly zero. B−A changes all 48 lists,
so the six-concept representation is not a neutral replacement for native tags.
Do not call these effects learned taste or accuracy gains. Any later integration
must separate metadata-driven novelty, coordinate Memory/Shared/Scenario and
serving-shadow semantics, and measure real held-out usefulness. #182 stays primary.
[PR #274](https://github.com/Kajooja/Kajo/pull/274) is merged as
`15bff8ddfb4b698b367b265123de3a83488ed70a`, after all five CI gates,
**551 tests / four exports**; #273 is closed. D2 model rejection remains unchanged.

## Provider-backed concept audit — #269

The offline `catalog:features` tool projects six shared concept identifiers from
exact TMDB genre IDs and reviewed Open Library subject labels. It preserves
provider, source field, evidence kind, registry/projection hashes and row times.
Missing or unsupported concepts remain `null`; repeated synonyms do not add
weight. Open Library topics and film genres are different evidence, so a shared
identifier does not establish transfer reliability or a preference score.

The actual read-only snapshot at **2026-09-24 11:18:16 UTC** covers all **840**
visible Items: **415 BOOK / 425 MOVIE**, with zero provider identity mismatches.
At least one of the six supported concepts is present for **244 BOOK / 280 MOVIE**.
**171 BOOKs** contain a mapped concept in the saved provider subjects that is
absent from the current matching Item-tag slugs, comprising **231 concept
assertions**. This observes missing tag representation; it does not by itself
prove why the omission occurred. All thirty curated-only BOOKs remain without
supported provider evidence.

The [hash-bound aggregate report](catalog-feature-coverage-2026-09-24.json)
records coverage and method limits. Complete snapshot and per-Item projections
stay outside Git. Current `public.items.tags`, bootstrap/native Memory, Shared
fit and Scenario similarity are unchanged. This supplies inspectable mapping
and a concrete coverage gap, not a trained or admitted serving model. A later
explicit rollout must bind versioned features to all consumers and compare
serving/shadow behavior before changing existing evidence interpretation.
#182 remains the primary next packet; Phase 14.3 and MVP-ALG-005 stay open.

## Accepted D2 development comparison

The owner-authorized GroupLens Latest Small September 2018 / Kaggle v2 source
supplies 500 subjects and 84,849 complete-history ratings. D2 compared eight
variants with frozen chronological/held-out-subject partitions and independent
reproduction. Validation's 0.001959 RMSE gain missed the predeclared 0.01 admission
gate: challenger admission is rejected and native use deferred. Separate prequential
results do not prove fixed-holdout or native usefulness; cold-start support is limited.
[The readable report](../../research/reports/movielens-small-d2.md),
[aggregate evidence](../../research/reports/movielens-small-d2.json) and
[D2 checkpoint](sprints/SPRINT-014-D2.md) retain exact hashes, partitions, all metrics,
uncertainty, costs, reproduction/review history and the 357-test source acceptance.
Raw histories, fitted models and predictions remain ignored and research-only.

### Completed independent prefix study — #265

`feat/research-prefix-evaluation` fixes the research-only fallback bug: a prefix
containing no trained Items now retains the durable-state baseline instead of
returning an unsupported latent item mean. Empty, mixed and unknown-target cases
are covered. Training and the historical D2 report remain unchanged.

The [actual study and limits](../../research/reports/movielens-small-prefix-study.md)
and [aggregate evidence](../../research/reports/movielens-small-prefix-study.json)
record the preregistered earliest/recent complete-prior-group comparison with
0/5/10/20 budgets. Two independent fits use the original **46,410 training rows /
299 observed training subjects** and score identical **5,707 ratings / 23 held-out
subjects**. Primary recent versus earliest ten-rating durable-state RMSE is
**0.807788 versus 0.850843**, paired difference **−0.043054**, subject-bootstrap
95% interval **[−0.060646, −0.024471]**. The fixed comparison exceeds its descriptive
threshold; no diagnostic model was selected or promoted.

This reuses already examined D2 development data, not a fresh final test. Equal
maximum budgets have different actual prefix counts; the result compares practical
selection policies, not pure recency at equal information. It demonstrates no
BOOK transfer, Shared or native usefulness. Parameters/predictions/metrics match
between both runs; complete source, normalized data, freeze, models and journals
are retained privately in `Kajo-MovieLens-prefix-study-265.zip`. The
[checkpoint](sprints/SPRINT-014.md#exploratory-prefix-study-and-recovery--2026-09-24--265)
records archive integrity and validation limits. Further research needs a named
question and untouched evaluation evidence where a final claim is intended;
do not run an open-ended model search. The primary #182 task above remains next.

## Native packet checkpoint — #228 / draft PR #229

`feat/228-delivered-origin` remains the native source/rollout record. CI #468 and
manual [CI #469](https://github.com/Kajooja/Kajo/actions/runs/34701247895) passed
at `900dc2653e428bb1cbd27e4bdaa7ea0141e47b31`. The manual run produced
`kajo-android-standalone-900dc2653e428bb1cbd27e4bdaa7ea0141e47b31`
(artifact `10300513895`). The owner report follows this requested build;
the installed binary checksum was not independently supplied.

Owner feedback accepts the exercised normal flows, Profile switching, expired
cursor → fresh search and the reported persistence/restart checks. Record this
as device feedback, not proof of every server attribution/native callback race.
The September 12 reconnect defect is [#240](https://github.com/Kajooja/Kajo/issues/240)
/ MVP-UX-003. The reconciled draft now implements bounded recovery of that same
request and clears stale retry UI only after successful backend recovery. The
current source/CI checkpoint is above; repeating the actual device observation
remains required. The older decision to defer implementation is superseded by this
source correction, not by an online indicator that conceals a backend error.

The six approved server forwards remain installed through
`20260912134224_atomic_prediction_pages`. Do not deploy them again or repeat the
approval. The 15-second client deadline, exact retry/cancel semantics and all
439 local tests remain recorded in [the native recovery checkpoint](https://github.com/Kajooja/Kajo/blob/feat/228-delivered-origin/docs/project/sprints/SPRINT-014.md#bounded-client-recovery--2026-09-12).
No fresh-account test/reset, new DDL, automatic promotion or full DATA/ALG closure
is implied. Keep #229 draft while its named acceptance gaps remain. Accepted
E1/D1/D2 research does not close native acceptance.

## Owner UI decisions — required before MVP

ROADMAP Phase 17.0 now requires private category statistics/progress and weekly
tracking (#230 / MVP-UX-004), grid multi-selection and List/history operations
(#231 / MVP-UX-005), plus the new card controls (#239 / MVP-UX-006). The star saves
to the existing default List shown as **Tykätyt**; the header's three-dot menu opens
other destinations. Slider and **Ei kiinnosta / Seuraava** sit at the bottom of the
card above the dock, leaving space for a description. Saving stays on the card;
**Seuraava** explicitly advances. UX_PRINCIPLES owns this planned successor to
current auto-advance, with unchanged evidence and Shared consent semantics.
Community comparisons remain conditional. Implementation is planned, not shipped.

## Accepted source, active branch and recorded hosted state

Historical September 12 audit baseline: `6dd1fec` / PR #227 — atomic/durable Item,
List and Shared action foundations. #227 is merged; do not repeat its deployment.
The #233/#234 delivery publishes independent-engine direction and reconciled
product/handoff documentation, plus bounded repository hygiene. It does not
accept #229 runtime, implement a portable engine or train a model.

#229 contains later source work: delivered-slate identity, durable exposure,
multi-List/collection UX, history projection, late outcomes, frozen replay,
eligibility-first admission, identified first pages, private source windows and
protocol-2 atomic continuation and the captured-scope mobile reader.
The branch has source/test/rollout evidence that must remain intact. The current
reconciliation checkpoint is at the top of this file; its detailed device and
implementation records stay on that branch/PR until accepted. Compact canonical
successor contracts in main are explicitly labeled.

The owner-approved #229 hosted rollout completed on 2026-09-12 through
`20260912134224_atomic_prediction_pages`, as recorded in that branch's
[rollout checkpoint](https://github.com/Kajooja/Kajo/blob/feat/228-delivered-origin/docs/project/sprints/SPRINT-014.md#approved-hosted-prediction-rollout--2026-09-12).
All six installed forwards are immutable; do not redeploy, reset, repair historical
migrations or mistake their presence in this reconciled native SQL tree for a new
rollout packet.
The separately deferred `20260909131913_close_postgres_function_defaults.sql`
remains its own gate. The earlier independent E1 packet ran no hosted query or
mutation; later catalog rollout/read-only checkpoints are recorded separately above.

The private window bounds remain 50 candidates/seen IDs, 2 MiB, fifteen minutes
from source ranking and sixteen windows per actor/Profile. Preserve receipts,
runs and Events when reclaiming expired derived cache.

## Independent engine and when public data enters

Canonical design: [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md),
[DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md) and
[ADR-0008](../architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md).
All 51 supplied conceptual sections are preserved. The core is independent; Kajo
is its first DomainAdapter.

The ordered engine work is:

| Packet | Exact deliverable | Starts after |
|---|---|---|
| [E1 #235](https://github.com/Kajooja/Kajo/issues/235) | Runnable generic contracts + Kajo/media and synthetic non-media fixtures; workspace/exports/root CI integration | Accepted design; explicitly selected after owner device feedback |
| [D1 #236](https://github.com/Kajooja/Kajo/issues/236) | Isolated manifest, MovieLens adapter and actual reproducible small real-data cohort | E1 contract acceptance |
| [D2 #237](https://github.com/Kajooja/Kajo/issues/237) | Train-only temporal/cold-start baselines and bounded static-state vs trajectory experiment/report | D1 normalized data |
| D3 / D4 / D5 | Optional Tag Genome / Beliefs / KuaiRand studies | D2 plus each source's own manifest/rights/task; independent of each other |
| E2 | One admitted component behind existing serving boundary | Relevant native 14.1/14.2 gates + rights/quality/compatibility/fallback/rollback |

E1, D1 and D2 are accepted through #241/#242/#243. The reproducible D2 report
and rejection/fallback decision are complete. The independent #265 follow-up is
also complete. #182 owns remaining catalog work; #229 retains native acceptance,
and later application UI work has its ROADMAP slot. Current STATUS names the
one active handoff. No large native population, production schema or separate
network service was required for D1.

Use ignored `research-data/` and `research-artifacts/` or equivalent controlled
storage. External ratings are source-typed observations, not fake native Events
or fully observed behavioral Scenarios. Public catalog enrichment and a real
user's authorized history import remain separate pipelines. Data download,
normalization, model training, evaluation and artifact admission are distinct
recorded operations. A losing challenger is a valid report; it cannot waive
native usefulness gates or deploy itself.

E1 delivered executable contracts; D1 delivered real research intake; D2 now
fits and evaluates bounded offline models. #265 adds a reproducible exploratory
prefix-policy result and unsupported-latent fallback repair. Fitted artifacts remain
research-only; D2 rejection and native admission deferral are unchanged. No native model integration,
world model, multistep dreamer or automatic promotion is delivered.

## Preserved owner requirements and release order

- #232 is mandatory first-release Shared rating/rewatch behavior: Phase14 supplies
  participant/round evidence and policy; Phase15 supplies Personal Taste/setup;
  Phase16.3 completes joint responses/history and controlled rewatch before beta.
- Multi-destination List selection, final Add without a second Done action,
  always-available unknown Taste response, approximately ten movies then ten books,
  link reveal/copy and device details remain in their canonical product docs.
- #230 private statistics/weekly tracking and #231 multi-select/history trash are
  now required pre-MVP Phase 17.0 work, alongside #239 card controls. #240 is
  implemented in the active native reader packet with device acceptance still
  open; FUT-UX-003 joint-list choice remains a separate candidate.
- Then follow ROADMAP: algorithm/catalog/engine foundation → Taste/holdout →
  anonymous web/app + Google/Apple continuity → preview → Friend/safety → explicit
  Shared creation and joint rounds → core UX/telemetry/privacy → complete beta →
  production/stores → owner-accepted Share Link Gate.

The owner reports exercised device flows working, but no exact installed APK
identity/timings were provided for the latest feedback. Empty/fresh-account
acceptance remains untested. Preserve current test history; a future small-group
reset is not an instruction to reset now. A newly built APK alone cannot replace
the named device observations.

## Hygiene and remaining findings

The [2026-09-12 audit](retros/2026-09-12.md) records scope, checks and limits.
Proven-unused catalog hook/wrapper removed; accepted-main migration protection
extends from 47 to 50 exact hashes without changing SQL or the baseline cutoff.
Raw/fitted research paths are ignored before the first dataset operation.
The September 12 js-yaml 4.3.2 patch removed the then-reported high advisory. Its
remaining fifteen moderate package paths across three advisory families were the
baseline for #238; PR #296 now supplies the accepted compatible fixes and a fresh
zero-advisory receipt. This dated audit does not promise future advisory absence.

Open source findings are assigned to their existing work owners:
#228 configured protocol-2 device/recovery acceptance; #182 catalog breadth/diversity,
rights and useful metadata; #160 hosted acceptance/platform hardening and abuse
policy after the accepted production/input source correction. ROADMAP owns their
dependency placement; no hosted security conclusion follows from source tests.

The September 24 completion audit verified the actual uploaded run and all
**103 completed archive entries**, preserved cached records/attempts/review
history and independently reproduced both saved verification results. The
canonical completed state and full before/after evidence are retained outside
Git. No secret, raw provider record, fitted model or operator state enters this
documentation packet. Historical preparation/hygiene checks remain in Sprint 014.

The [current branch inventory](retros/branch-cleanup-2026-09-28.json) supersedes
older branch-cleanup instructions. It distinguishes merged candidates, a native
integration hold and retained request/default/native refs. Deletion remains a
pending supported operation; do not repeat the historical 145-branch cleanup or
remove the active #229 branch and consumed request identities.

Sprint 014, full DATA/ALG/catalog acceptance, device gates and public release
remain open. The bounded E1/D1/D2 foundation is complete; native model admission
is a separate conditional decision.
