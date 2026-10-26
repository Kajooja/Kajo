# Kajo Current Status

Last updated: **2026-10-26**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **015 — shared prediction inputs and trustworthy evaluation**, first bounded source packet accepted; remaining sprint gates open.
Sprint **014** retains its open inherited acceptance gates.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current handoff — shared prediction inputs / Sprint 015, #302, #336

Continue from accepted main
`feae2b17251d8d233e1925c66664d114b50fa341` ([#363](https://github.com/Kajooja/Kajo/pull/363)).
The first bounded Sprint 015 packet aligns memory/Scenario arithmetic in the shared identity
scorer to the native evidence transaction cutoff and records a versioned private
input-clock envelope.
Ordinary Discovery, catalogue-chain Discovery and explicit evaluation (used by
Taste) consume those same implementations. Existing scoring formulas, candidate
acquisition/selection policies and frozen records are preserved.

Hard eligibility, request/delivery time and the reset-aware Working capture keep
their existing post-lock clocks so newly committed skips and resets remain
respected. This is a bounded arithmetic-clock correction, not full historical-as-of
or committed-prefix reconstruction. Current rows can be read in different READ
COMMITTED statements, and the transaction reference may precede a lifecycle-lock
wait. The envelope explicitly reports unknown commit visibility and unavailable
historical reconstruction. Candidate-source rules still differ; no same-pool or
measured-quality acceptance is claimed. Source/CI and hosted installation remain
separate. The reviewed `20261025211014_shared_prediction_cutoff.sql` forward
is now installed in the hosted service.

Local validation passes 351 database tests, 904 mobile tests, 311 engine tests,
50 dependency tests, 451 catalogue tests, research and acceptance suites,
lint/typechecks and all four explicit-demo Hermes exports. Seven focused
database regressions reproduce the old numeric Scenario mismatch and verify the
fix, retained data/function security/replies, frozen shadow/pages, and newest
skip/reset visibility. The real holder/waiter skip-admission probe passed on
native PostgreSQL in the final-source CLI gate. The inherited
React test-only circular serialization failure is corrected by inspecting
rendered text, without application changes. `npm run check` reaches the unchanged
Deno npm-registry connection refusal locally; a full local root pass is not
claimed. All five required final-source CI gates passed in
[CI #735](https://github.com/Kajooja/Kajo/actions/runs/40235892151).

The owner approved publication of the exact reviewed ten-file packet and merge
after all five gates. [PR #363](https://github.com/Kajooja/Kajo/pull/363) is merged
at the accepted main above. Final source
`d07ce07c03953dfeb14163bef96728036c02faa2` and the merge have the same reviewed
tree `ab1225364addbc9561c783b7e503d8d37649c28b`. Existing #302/#336 tracking
continues; no separate tracking Issue was created.

**Hosted rollout — 2026-10-26:** the owner-authorized supported migration operation
succeeded. Read-only postchecks verified the expected installed function,
unchanged function identity/metadata/access boundary, the migration receipt and
preserved preceding migration history. All 958 checked pre-existing records
were unchanged: 20 PredictionRuns, 936 candidates and two page receipts. The
sample contained no shadow/comparison records. The comparison used fixed existing
identities and excluded new answers and forecasts. No account reset or earlier
deployment was repeated. Detailed environment metadata stays outside this receipt.

Fresh hosted consumption remains unobserved: the postcheck found no naturally
generated `native-prediction-clocks-v1` run yet. Installation verification does
not close consumer, device or predictive-quality acceptance.

**Next:** complete the remaining Sprint 015
shared candidate/evidence contract and native adapter/temporal evaluation work.
Do not skip directly to Sprint 016 or restart the existing Working report/cohort,
frozen shadow, generic contracts or retained Taste implementations. #232F's real
Shared prepared-input consumer remains required. Existing phone observations
below remain open and do not block independent engine source work.

**Owner decision — 2026-10-25:** maximize each Profile's expected post-experience
rating on its own learned response scale. Do not maximize the chance of a ten or
replace the objective with interest/engagement. Current actions are List saving
(interest), numeric rating (experienced Item) and Ohita (unknown reason: unfamiliar
or not interested). En tunne is already removed. Preserve legacy stored meanings;
no skip is a numeric zero, inferred dislike or known non-recognition.

[ADR-0012](../architecture/decisions/0012-personal-expected-rating-engine-v1.md)
owns this decision; [ROADMAP](ROADMAP.md#engine-v1-first--owner-decision-2026-10-25)
owns the new march: finish current work → hygiene → Engine V1 → UX/product flows
→ UI → release. [Issue #361](https://github.com/Kajooja/Kajo/issues/361) tracks this
documentation/priority packet. Its PR owns final-source publication/check receipts;
closing it does not close Engine V1 implementation or #302/#336 quality gates.

### Active source stack integrated

The four inherited PRs are merged in dependency order. Each final source passed
all five required CI gates; subsequent stacked retargets were checked against
identical reviewed merge trees. That earlier stack's accepted merge checkpoint was
`4e83ff749f85a64371a6175ac2d695326a7e4bfb`.

| PR | Accepted scope | Final-source CI | Merge commit |
|---|---|---|---|
| [#357](https://github.com/Kajooja/Kajo/pull/357) | Shared Taste/Discovery card geometry and existing timing plan | [#724](https://github.com/Kajooja/Kajo/actions/runs/40134741086), also Android APK | `4a7f80640a06b0c36066d49a824a8a1361d84f37` |
| [#358](https://github.com/Kajooja/Kajo/pull/358) | Guided Discovery/readiness contract | [#725](https://github.com/Kajooja/Kajo/actions/runs/40195573073) | `a8b06b16cf837803ef7b958fa526b56dd349751c` |
| [#359](https://github.com/Kajooja/Kajo/pull/359) | Verified curated BOOK cover operator and preservation tests | [#726](https://github.com/Kajooja/Kajo/actions/runs/40224235061) | `e01f99a1d149a1f411a55bf7efef06fe4a86a181` |
| [#360](https://github.com/Kajooja/Kajo/pull/360) | Private finite Item/source-cutoff predicate shared by V4 acquisition and explicit evaluation | [#727](https://github.com/Kajooja/Kajo/actions/runs/40226814352) | `4e83ff749f85a64371a6175ac2d695326a7e4bfb` |

Independent final review also passed 18 focused database tests, seven cover tests
and 82 mobile tests. Prior broader local receipts remain in predecessor history;
the known local Deno registry refusal is not a completed root-check pass. The
five required final-source CI gates are the full source acceptance evidence.

### Hosted and runtime boundary

The #360 guarded forward is now installed through the supported migration
operation. Read-only postchecks passed for intended cutoff behavior, preservation
of existing data and retention of the existing access boundary. See the
[rollout outcome](retros/2026-10-25-catalog-cutoff-hosted.md). Detailed production
environment and access metadata are not included in this repository receipt.

The earlier 30-cover data repair remains installed: BOOK image URL coverage
415/415 and MOVIE 425/425. Do not repeat it, V4 deployment, or the October 24
reset. Preserve new answers and pending commands. Full state/time parity, native
conditional cohorts and calibrated readiness are not delivered by #360.

The four geometry/recovery phone observations for #357 and real cover rendering
remain explicitly open in [DEVICE_TEST](DEVICE_TEST.md#apk-721-taste-layout-blocker--2026-10-25).
The corrected APK was already supplied; no new APK is needed for this docs packet.
These observations must pass before the affected UI is used as device acceptance
evidence. They do not prevent independent engine work.

### Repository hygiene and next packet

[The branch audit](retros/branch-cleanup-2026-10-25.md) records deletion of **56**
reviewed obsolete remote branches: 54 exact ancestors and two independently
verified superseded heads. Postcheck confirms nine remote branches remain: main
and eight consumed catalog operation branches with unchanged heads. Keep those;
their pinned manifests remain referenced. Branch cleanup does not remove commit, PR or sprint history and does not certify
engine quality.

**Active implementation: [Sprint 015](sprints/SPRINT-015.md).** Bind one versioned
native prediction input/candidate/scoring contract for Taste, Discovery, explicit
evaluation and shadow; require the acknowledged answer prefix in fresh forecasts;
freeze exposure/outcome identity and deliver the temporal evaluation runner.
Use the existing SQL scorer, memories, native command/evidence paths and generic
adapter boundary. Do not build a parallel scorer or start anonymous web/UI work.

Then execute [Sprints 016–021](ROADMAP.md#stage-1--build-and-accept-practical-engine-v1):
personal expected ratings/response style; temporal state/world/transfer; supported
conditional memory; calibrated readiness/common policy; replay/consolidation/
challenger/rollback; actual integrated usefulness acceptance. Each sprint defines
controls, stop conditions and evidence. [ENGINE_BUILDOUT](ENGINE_BUILDOUT.md) maps
all 51 architecture sections and EB-01…12 to required V1 slices or bounded later
research. Numeric budgets are locked from development evidence before final tests.

Sprint 014's unmet capability gates transfer to those named successors; original
acceptance remains open and Sprint 013 is still the last accepted sprint. Passing
source tests or adopting this plan does not establish forecast usefulness.

## Historical predecessor receipts

The entries below preserve what was true at their recorded checkpoint. Their
open/unmerged/next-step wording is superseded by the current handoff above.

## Predecessor packet — verified curated BOOK covers / #336

**Continuation — 2026-10-25 Europe/Helsinki:** implement the shared-input/cover
foundation in ADR-0011/ROADMAP. `fix/336-curated-book-covers` continues from
[PR #358](https://github.com/Kajooja/Kajo/pull/358) source
`10977331ed286418f5134a4c1e3aeddb4d11cc22`; #358's CI #725 passed, but #357 and
#358 remain open/unmerged and are not accepted main. The current PR owns exact
source, publication and check receipts.

**Implemented cover packet:** all 30 missing curated BOOK covers now have
reviewed Work/English Edition/creator mappings and downloaded, decoded, visually
checked images. The operator validates pinned source bytes and prepares a guarded
data-only transaction for the existing Item IDs. A revision-guide cover incorrectly
linked by the provider, audio packaging and an Edition author-identity mismatch
were rejected during review. Other title/year/source metadata, aliases, ratings,
accounts and Taste commands remain outside the write set. Both surfaces already
load canonical catalogue presentation; the source needs no new mobile build.

Seven focused tests pass, including the complete current schema, rollback and
idempotency. The complete 30-Item operation was replayed on a disposable current
schema with all non-presentation fields unchanged. The hosted data-only repair
is now applied: discoverable BOOK image-URL coverage is **415/415**, with all
30 reviewed mappings installed; MOVIE remains **425/425**. All 13 guarded
account/Profile/evidence/Taste/source/alias table digests and the complete
non-target catalogue digest match before/after. Target rows retain all other
JSONB field values. The raw target-core text digest changed through numeric
serialization in the initial snapshot-based metadata assignment; full-field
comparison confirms equal values. The final operator instead extends stored
metadata directly, with a regression preserving numeric formatting. No schema,
account reset, prediction or retained command changed. Phone reload/render
acceptance remains open; the current PR owns exact operation/check receipts.

Broader local checks pass mobile 904, database 339, engine 311, dependency 50,
catalogue 3 contract plus 441 existing script tests, research and acceptance,
lint/types and all four explicit-demo iOS/Android exports. Seven new cover tests
pass separately on final source. The complete root check stops at the unchanged
Deno dependency registry connection refusal; no full local root pass is claimed.

**Next after cover acceptance:** pin and implement shared serving inputs and
supported conditional numeric-prefix/outcome evaluation under ADR-0011, then the
BOOK → MOVIE successor and calibrated readiness meter. V4's existing selector
and always-INSUFFICIENT report are unchanged by this cover correction. Preserve
the current accounts, answers, pending commands and old policies. Do not repeat
the completed October 24 reset or V4 deployment. Broader timing work remains in
ROADMAP after the current correctness/quality work; Sprint 014 stays open.

## Predecessor definition — guided Discovery and measured Taste readiness / #336

**Owner refinement — 2026-10-25 Europe/Helsinki:** Taste must be the guided start
of the same prediction/learning loop as Discovery, not an independent test.
Start BOOK, continue MOVIE after sufficient domain readiness, retain one shared
PersonalProfile, and show a measured readiness indicator with automatic completion.
Low/high numeric answers must affect supported conditional recall and the next
fresh recommendation. Book covers must be present and correct. The explicit
BOOK → MOVIE instruction governs the order; the film-A example describes learning.
[ADR-0011](../architecture/decisions/0011-taste-as-guided-discovery.md) owns the
contract, [ROADMAP](ROADMAP.md#guided-discovery-and-measured-taste-readiness--2026-10-25)
the updated sequence. The initial timing plan remains recorded, but this engine/
readiness work takes priority over further broad latency tuning.

**Source/data audit:** V4 uses canonical evaluation and the same PersonalProfile,
but still acquires a recognition-bounded pool and applies its own 35/45/10/10
utility plus a maximum-two-opportunity domain lead. The native snapshot hardcodes
INSUFFICIENT. A calibration-backed probability/readiness meter and full conditional
cohort retrieval are not established by that source. The read-only hosted catalogue
has 415 discoverable BOOK and 425 MOVIE Items. Thirty curated books have no image
URL; all have only curated source identities and no exact title/author covered
counterpart in this catalogue. The other 385 books have Open Library URLs and
source-specific ratings/popularity fields; URL presence does not prove live image
fetch/decode. Movie image URL coverage is 425/425. No private user histories were
needed for this aggregate audit, and no hosted data was changed.

**Current source packet:** `docs/336-unified-discovery-taste` is a documentation
refinement stacked on #357 source `eda2e7b95772b60558845c86b5ea836302af58e2`.
Its PR owns publication/check receipts. It records the required successor and
actual gaps, not an installed selector, readiness model, cover repair or new APK.
The predecessor [PR #357](https://github.com/Kajooja/Kajo/pull/357) is open and
unmerged; all six [CI #724 jobs](https://github.com/Kajooja/Kajo/actions/runs/40134741086)
passed on its exact source, and its corrected APK was supplied. The latest owner
message adds algorithm/progression/cover requirements; it is not explicit acceptance
of the four geometry/recovery device checks. Preserve that pending evidence.

**Publication authorization — 2026-10-25 Europe/Helsinki:** the owner explicitly
approved publishing this complete 11-file documentation packet (“Saat julkaista”).
This resolves the automatic approval rejection that correctly distinguished it
from the previously approved packet; no alternate publication path was used.
Whitespace, 191 relative links and added-content privacy checks pass. Publish as
a documentation-only PR stacked on #357; its PR owns exact publication/check
receipts. Runtime code, hosted data and the current APK are unchanged. Publication
approval does not close implementation, quality or device acceptance.

**Next implementation packet:** bind verified covers for the 30 curated books and
pin the shared-serving/conditional-evidence input contract, then implement the
versioned guided policy and calibrated readiness under ADR-0011/ROADMAP. Reuse
existing scoring, commands, evidence and research boundaries. Preserve current
accounts, accepted answers, pending commands and historical policies; the installed
V4 forward and October 24 scoped reset remain complete and must not be repeated.
Neither arbitrary percentages nor shared-looking cards complete this requirement.
Sprint 014 and the first-release quality gates remain open.

## Predecessor packet — Taste card layout parity / #336

**Blocking owner feedback — 2026-10-25 Europe/Helsinki:** in the #721 Taste test,
wrong margins and an oversized image prevent reaching the rating controls as in
normal browsing. The owner requires the same appearance as BOOK/MOVIE Discovery
card mode. Correct the shared usable viewport, artwork/margins and rating access,
then supply a matching successor APK before continuing V4/adaptation acceptance.
[DEVICE_TEST](DEVICE_TEST.md#apk-721-taste-layout-blocker--2026-10-25) owns the
reported failure and focused retest. The source correction and local checks are
recorded below; corrected-build/device acceptance remains pending. The six earlier
Discovery observations retain their scope.

**Taste layout source correction — local validation:** `FeedScreenFrame` and
`DiscoveryBackdrop` now give Taste the same safe-area boundaries, compact header/
dock, background, artwork column and rating margins as Discovery. `FeedItemCard`
measures its non-artwork body so short viewports and larger text can reach the
rating controls; `RollingFeedCard` preserves that measurement in retained previews.
Taste's exact pending-command and acknowledged-answer → NEXT behavior is retained.
All 80 mobile test files / 904 tests pass, and mobile typecheck/lint are clean.
All 24 Taste/reference native Yoga geometry fixtures match and keep rating
reachable; their approximate text measurements are not physical-device evidence.
The broad root check and export sequence were interrupted by tool quota, so no
completed local `npm run check` or new export pass is claimed. PR #357 owns the
exact final-source CI and matching APK receipts as they become available; device
acceptance remains open until the focused owner checks pass.

**Accepted source and device observations — 2026-10-24:** #355 and
[#356](https://github.com/Kajooja/Kajo/pull/356) are merged. #356's final head
`9f2f9c728bc0526219063116037a78ce2e03e3dd` passed all five CI #720 gates; accepted
main `340d0da660fe02d6d9d47d468bee75e134546fa3`, tree
`8af20e5aa44cf8ee203131cb629342b4085b3867`, passed all six
[CI #721 jobs](https://github.com/Kajooja/Kajo/actions/runs/40124122391), including
its configured Android APK. #356 owns the exact final source/build receipt.
The owner reports all six supplied cases working: offline/reconnect, last-choice
persistence after background/close/reopen, cold startup, Löydä return,
expanded-description rating stop and repeated immediate Undo. Long-session
return is approximately 4–5 seconds, acceptable with faster return desired.
[DEVICE_TEST](DEVICE_TEST.md#apk-721-owner-observations-and-next-test-boundary--2026-10-24)
owns these scoped observations; the entire device matrix and recommendation
quality are not thereby accepted. Do not repeat these unchanged cases or reopen
the completed #355/#356 source integration.

**Active source:** [PR #357](https://github.com/Kajooja/Kajo/pull/357) on
`feat/336-taste-rollout-performance-plan` is published and remains unmerged. Its
PR owns the exact current head and CI receipts. The Taste layout correction is
the current continuation; the existing packet supplies the guarded matching V4
rollout helper and records the expanded duration work
package. `scripts/database/personal-taste-pool-hosted-upgrade.{mjs,test.mjs}` pins
the unchanged accepted migration, validates the private target checkpoint and
emits read-only pre/postflight plus one guarded provider-transaction payload.
It checks retained rows, function identity/security, schema and exact migration
history, and rejects replay/drift. UTC capture and versioned sorted complete-row
hashes/counts bound checkpoint work; only the observed SELECT-only provider Auth
history uses ACCESS SHARE, while application tables/history retain SHARE locks.
It has no hosted executor or account-reset entry point. Four focused helper tests
pass. In that earlier helper checkpoint, the local root check stopped at the
unchanged Deno registry connection refusal and remaining stages passed separately.
That checkpoint is not a complete root/CI result for the new UI correction above.

**Hosted V4 installed and verified:** the one unchanged accepted
`20261024125357_versioned_taste_candidate_pools.sql` forward was applied through
the guarded provider transaction. History advanced from 86 to 87 receipts, the
new-session default is `CANONICAL_FORECAST_POOL_V4`, and read-only postflight
passed complete captured metadata/security and retained-row preservation checks.
The earlier lock-permission attempt stopped before DDL; fresh readback confirmed
the unchanged predecessor before the narrow provider-table lock correction and
successful apply. Do not replay the installed forward. Private target/checkpoint
and provider receipt details remain outside Git; actual V4 device acceptance is
still separate.

**New source publication approved — 2026-10-24:** after reviewing the completed
eight-file helper/documentation packet, the owner explicitly approved its
publication to GitHub. This resolves the earlier automatic approval rejection;
no workaround or publication retry preceded that approval. The unchanged document
histories match existing public main blobs, and the added-content audit found no
real account IDs, emails, project references or credentials. The approved
packet is published in #357; its PR owns the exact published head and CI receipts.
This approval does not claim new CI success,
source merge or V4 device acceptance, and is separate from the already completed
hosted operation.

**Two-account reset completed — 2026-10-24:** the exact two authorized test-account
roots were removed after a successful rollback-only rehearsal. The committed
reset and independent read-only postflight passed: Auth/app users, Profiles,
identities, sessions and refresh tokens are empty, as are all 60 checked test-state
tables including V4 pools. Catalogue/source, genome, promotion and assignment
hashes are unchanged; there are no remaining erasure permits, migration history
remains at 87 and the V4 new-session default is intact. Private identities and the
exact reset receipt remain outside Git. This clears the requested test prerequisite;
it is not a general reset policy. The initial retest required registering the
same email addresses with owner-chosen passwords and fresh identities. Preserve
any accounts and Taste state created since that reset; the layout correction
must not repeat it. No new V4 device or recommendation-quality acceptance is
implied.

**Performance continuation:** [ROADMAP's work package](ROADMAP.md#end-to-end-performance-measurement--2026-10-24)
and open `MVP-UX-008` now define visible/actionable/saved timings, handoff/queue/
RPC/rendering diagnosis, representative p50/p95 baselines, calibrated budgets and
bounded private diagnostics. Initial measurement precedes further broad speed
optimization; it does not postpone fresh-account V4 testing. The approximate
4–5 seconds is not a measured distribution or diagnosed bottleneck. Full UX/ops
acceptance stays in Phase 17; scoring/usefulness remains a separate quality gate.

**Next action:** verify required CI on the final Taste/Discovery layout source
in PR #357 and provide its matching successor APK for the focused device checks. Continue V4/adaptation observations and the planned
timing baseline after that blocker. Hosted installation and the requested reset
are complete; preserve subsequent account/test state. Record exact source/CI/build
receipts in the active PR. Do not repeat the reset, installed operations or
accepted unchanged device cases. Sprint 014 and release gates remain open.

## Predecessor checkpoint — versioned Taste candidate-pool integration / #336

The following is the earlier pre-merge receipt; the current packet above
supersedes its pending integration, latest-observation and next-action statements.

**Latest owner observation — 2026-10-24 Europe/Helsinki:** after receiving the
GitHub download for APK #716, the owner reports “toimii hyvin” and asks to
continue development. This accepts the observed general browsing behavior of the
supplied successor; it is not a timed benchmark, installed-checksum verification,
per-case gesture report or startup/offline/process-death acceptance. The remaining
matrix stays in [DEVICE_TEST](DEVICE_TEST.md#earlier-apk-716-owner-observation--2026-10-24).
Recommendation quality and internal scoring have not been accepted by this report.

**Accepted feed source:** [PR #355](https://github.com/Kajooja/Kajo/pull/355)
is merged as `94beb27962c735582fa5eabf3db361be37e1255a`, preserving source
`654f9fcf0ded841628c40d088a177d8baea14e86` and its exact tested tree
`047496716bbb79b1fb4ab3f597e98f33e675ac35`. All six jobs passed in
[CI #716, attempt 2](https://github.com/Kajooja/Kajo/actions/runs/40086800244),
including all five required validation/native gates and the configured standalone
Android build. The tested PR merge `65a1dd4cee3c85d523bd3758cbe59d9f8f0b7af5`
has that identical tree. Attempt 1 was cancelled after the unchanged database
test process produced no result for 17m57s; the same source passed on retry,
without bypassing a gate.

[APK artifact 12559127092](https://github.com/Kajooja/Kajo/actions/runs/40086800244/artifacts/12559127092)
contains the sole `app-release.apk`, supplied as `kajo-android-ci-716.apk`:
106,120,143 bytes, SHA-256
`62a4ca8f128580d7adac9a11b1810266ff8b51c0cce99659a236f4bf73a7e5d2`.
The downloaded archive matches GitHub's digest and both archive/APK CRC checks
pass; the embedded JavaScript bundle is present. GitHub artifact expiry is
2026-10-31 11:42:42 UTC (13:42:42 Europe/Helsinki). Physical installation and
cryptographic APK signature verification were not performed by the agent.

**Explicit integration approval — 2026-10-24:** the owner has now authorized
merging #355 and then #356 after verification. This resolves the earlier automatic
approval rejection; that rejection was not bypassed. #355 is merged as recorded
above. Complete #356's authorized integration after all required checks pass on
its final head. This source approval does not deploy the V4 forward, reset an
account or close device/quality acceptance.

**One current source packet:** versioned Taste candidate-pool refresh/refill on
`feat/336-versioned-taste-pools`, published in
[PR #356](https://github.com/Kajooja/Kajo/pull/356). The PR is ready for review and
retargeted to main after #355's merge; it remains unmerged at this checkpoint.
Its PR owns the eventual exact final head, required checks and merge receipt.
This successor is not yet accepted main or a hosted deployment.
CLI-created `20261024125357_versioned_taste_candidate_pools.sql` adds the
new-session-only `CANONICAL_FORECAST_POOL_V4` policy and private immutable per-panel
candidate storage. New questions refresh bounded eligible candidates from the
latest committed Profile prefix; retained V3/legacy sessions keep their policy.
Question lookup, answer projection, contextual skip and lifecycle consumers use
the exact question's stored pool, preserving earlier panels, first measured labels,
retries and source-withdrawal semantics. Discovery's prepared buffer does not
precompute future adaptive Taste questions.

The matching mobile recovery retains an exact pending command on `KJ002` until
explicit reload. RESUME/existing START can stop a stale ACTIVE/PAUSED session
without rewriting its question, pool, receipt or revision; Discovery continuation
and REMOVE remain available. No silent command retargeting or account reset is
used to manufacture a fresh session.

**Local validation checkpoint:** independent review found no blocking issue.
All 901 mobile, 335 database, 311 engine and 50 dependency tests pass, as do
catalogue (3 contract + 441 script), research (19 Python + 43 Node) and acceptance
(6 + 5) tests. The 40 focused SQL checks include 11 new pool tests. Lint,
typecheck and all four explicit demo iOS/Android exports pass. The complete
`npm run check` reaches the unchanged Deno dependency download and stops on npm
registry `Connection refused`; the remaining stages passed separately, so no
successful complete local root run is claimed. The implementation subsequently
passed all five [CI #718 gates](https://github.com/Kajooja/Kajo/actions/runs/40098065673)
at source `90c70343a64fe336391d8ae5c234bccd2d6a808a`, tree
`aee918b92394342b6ad5cc9125203c29daf6502b`; tested merge
`d2717dda6d2608828dea8f620746aec59195ca75` has that identical tree. Genuine
PostgreSQL verification reports `personalTastePoolUpgrade: PASS` and
`personalTastePools: PASS`: populated predecessor rows, V3 policy and exact replies
are preserved; separate committed RPCs admit later candidates, preserve original
pools and verify stale-source recovery and source erasure. The Android APK job
was skipped. These native results supplement the local PGlite checks; they do not
establish hosted installation or device acceptance. The approval/base-integration
handoff reconciliation now needs its own final-head checks before #356 merges.

**Publication and bounded performance follow-up:** #356 was first
published at `707bdc7fbd99ad6904e97b3d34342dabe0e886ed`, tree
`dd920c7f8885c0f4e034f2340daad13940f48346`.
[Preliminary CI #717](https://github.com/Kajooja/Kajo/actions/runs/40096998050)
was superseded and cancelled; #718 above is the completed implementation receipt.
The bounded acquisition correction
materializes potential skipped Item IDs once, delegates every potential source
to the unchanged canonical skip helper, and projects provider details only for
the retained pool. Full candidate JSON matches the frozen pre-optimization
reference across six cutoff/lifecycle cases. The entire 335-test database suite
passes after this correction. On a disposable 10,000-Item PGlite fixture with
400 history rows, paired median acquisition time fell from 857 ms to 404 ms;
complete first NEXT measured 584 ms. These shared-host synthetic WASM timings
are query evidence, not phone or hosted performance measurements.

**Next action:** finish the authorized #356 source integration after all five
required checks pass on its final head. Record the exact final head/tree/CI and
merge receipt in that PR; do not create another documentation-only rebuild merely
to copy those receipts here. A fresh continuation must inspect #356: if already
merged, continue from fresh main rather than reopening source work or requesting
the same merge approval again. The next packet is guarded preparation of the
matching V4 hosted forward, then installation and matching configured APK/device
acceptance. Reconcile the actual installed prefix before any deployment and never
replay installed operations. Preserve existing accounts, old policies and pending
commands. Readiness and measured usefulness remain open. No hosted write, account
reset, prior-forward replay or model/Working activation occurred in this packet.

The subsequent recommendation-scoring review remains in ROADMAP, using fixed
baselines and prospective/holdout comparisons. Numeric Taste reverse UI, recent
supported prior, full readiness and release gates remain open. Sprint 014 is not
closed. The dated feed checkpoints below preserve predecessor evidence; they do
not replace this current source/integration boundary.

## Predecessor packet — #715 device latency corrections / #239

**Latest owner feedback — 2026-10-24 Europe/Helsinki:** APK #715's horizontal
Löydä ↔ Katsotut/Luetut navigation, direct rating and History/Lists work as
requested. After longer browsing, returning to Löydä still takes too long;
expanded-description scrolling can overshoot the rating control; Undo remains
slow. The owner requests all feasible browsing/return improvements and proposes
holding the newest choice until the next choice, so C → B can cancel B locally.
Startup/network recovery was not properly tested and remains open. Recommendation
precision/internal scoring is a separate later review in ROADMAP, not a passed
quality result or a scoring change in this packet.

At this predecessor checkpoint, the single active source was
`feat/239-buffered-feed` / [PR #355](https://github.com/Kajooja/Kajo/pull/355).
The verified predecessor source is `eb447629a36a219f300aa61a520267ce1213916b`:
all five mandatory gates and configured Android APK passed in
[CI #715](https://github.com/Kajooja/Kajo/actions/runs/40029355874).
Its [artifact 12536029267](https://github.com/Kajooja/Kajo/actions/runs/40029355874/artifacts/12536029267)
contains APK SHA-256 `a3645ca6e696963b42c60bbaa735f78eb47b23a223f22a3c7693643e37278e27`.
These are predecessor receipts; they do not validate this successor.

The current bounded design is recorded in canonical UX, evidence, prediction
and architecture owners before runtime edits:

- A gesture beginning above a long card's readable bottom stops at its rating
  controls; only a new deliberate bottom gesture can dismiss it. Compact flicks,
  accepted horizontal navigation and direct rating remain unchanged.
- Persist each selected skip/rating immediately, but hold the newest from server
  dispatch until the next durable choice. A provably never-dispatched local
  cancellation can restore its still-valid same-scope delivery immediately;
  sent/ambiguous commands retain canonical server Undo/fresh delivery. Exit,
  navigation blur, background, a 30-second idle deadline and scope changes release
  holds; restart replays durable commands. Unknown-age initial grid cards keep
  server reversal; prepared feed cards enable the fast local path.
- On return, transfer at most five valid unhandled prepared feed successors with
  exact frozen origins, one-shot and scope/age bounded, while a fresh six-Item
  grid is obtained after pending commands settle. Avoid repeated rank restarts
  from late acknowledgements; never revive the old full grid as fresh evidence.

Implementation and independent review are complete. Root lint/type stages,
all **898 mobile tests in 80 files**, all 50 dependency tests, all 322 database
tests, all 311 engine tests, catalog/research/acceptance tests and all four demo
mobile/description iOS/Android exports pass. Fresh dependency audit has zero
unmitigated findings. All 162 local Markdown links in the changed documents were
checked. The complete local root check stops at unchanged Deno dependency
loading: `registry.npmjs.org/@supabase%2fauth-js` returns `Connection refused`;
remaining root stages were run successfully separately. Full local-root success
is not claimed. Final-source CI and the configured APK subsequently passed as
recorded in the #716 receipt above. The owner's general good-behavior report does
not supply measured phone timing or the complete process-death/reconnect/gesture
matrix. Preserve accounts, pending commands and installed
migrations. This packet requires no scoring, SQL or hosted deployment change.
The full release/startup/quality gates remain open despite scoped owner acceptance.

**Accepted predecessor:** [PR #354](https://github.com/Kajooja/Kajo/pull/354) is
merged into `main` as `99c21341c62eaae8dab3589944a434b06dc14258` following the
owner's explicit instruction. Its final source head is
`95213d9c1455d7127c5908f6bc41387c2bea33d5`; all five mandatory checks and the
standalone APK job passed in [CI #704](https://github.com/Kajooja/Kajo/actions/runs/39834255038).
The tested merge checkout `f3cdc6f2727a5c20bd3104004bf21f68f2f5c8f9` and accepted
main share tree `0820b4b34b6e0b4f3934abc02333a2ff7f413d86`. The APK receipt is
[below](#current-test-apk-and-device-work). Earlier publication/CI blocks in the
sprint are historical and do not reopen #354.

#354 supplies compact bars, direct slider commitment, the List-picker star,
exact forward/reverse history, restrained motion and stable initial Room
hydration. Preserve its navigation dependency #353, accepted as
`611fa83ca70e74fd6f17e2a427ea808ff887f5e2`; the owner reported #700 navigation
checks 1–3 passed. That report does not establish complete feed/startup acceptance
or an installed #704 checksum. The CI Docker Hub correction accepts only the
verified pinned image content; it is not a database upgrade.

**Earlier owner refinement — 2026-10-22:** center artwork and compact text with
matching gutters; center the rating slider with small side margins; move a
title-sized List star beside the title. Prepare five Discovery cards and refill
one in the background, showing the next card during an upward drag. The owner
also reports that rating no longer feels smooth: either tapping a chosen point
or dragging must commit that rating and automatically advance. This supersedes
#354's rule that an acknowledged rating waits for a later forward gesture.

At this predecessor checkpoint the active successor was
[PR #355](https://github.com/Kajooja/Kajo/pull/355), `feat/239-buffered-feed`,
based on accepted #354 main and then unmerged. Its later acceptance is above.
Its accepted feed baseline `a8225b073d167d9c1015f121f33d101a923c2ce6` passed all five
required gates and the standalone APK job in
[CI #714](https://github.com/Kajooja/Kajo/actions/runs/40015633346).
The tested merge checkout `00377dbbd9a5a145016228bd5fe5089a4eb8f2f3` shares source
tree `44da4fc47ede33c9bde20a5b694cf974bf8b138c`. APK artifact `12531530158`
has SHA-256 `9f2eef37cd084083a22833809f713b3e93dae5df6ce7bfadc35bb57d4481d1cb`;
the downloaded archive and embedded bundle were independently verified.
The provider installed `scenario_similarity_evaluation` once as receipt
`20261023202605`, matching the reviewed source and body/metadata guards below.
PR #355 owns the full #714 artifact/expiry and hosted receipt. These facts
supersede the earlier frozen pending checkpoints; #714 does not validate the
new horizontal-navigation/return-latency source.

**Earlier phone feedback — 2026-10-23:** the owner says “Tämä on hyvä” about #707,
accepting the general layout/rating direction, but scrolling is not smooth.
The entire card must follow the thumb from all fields, including collapsed and
expanded text, and a short fast upward flick must advance. This is an explicit
remaining interaction defect, not complete startup/gesture/device acceptance.
Continue the same PR with outer-card gesture capture, full-content reading
extent and deliberate drag/flick thresholds. Preserve horizontal rating intent,
independent accessibility focus, exact command origins and reduced-motion reading.
That correction is included in #709.

**Earlier #709 phone feedback — 2026-10-23:** the owner accepts thumb feel and
margins, and now requests left-aligned card text, a small gap above the bottom
dock, and the active card plus five warmed successors. Browsing should advance
immediately while accepted saves persist in the durable queue, without normal
saving/wait/retry flashes or a brief return to the rated card. This accepts the
reported gesture/margin improvements, not the entire startup/device matrix.

**Earlier #710 phone feedback — 2026-10-23:** undo should feel nearly as fast as
forward scrolling. Keep the active card plus five successors; every consumption
must refill the newly free slot in the background, allowing prediction to follow
slightly behind browsing. The active design now shows a cached prior Item as
an originless `restoringPresentation` after the first exact undo/withdrawal
command is durably admitted. Mutations, impression and dwell stay blocked until
all ordered acknowledgements and fresh same-Item delivery; activation preserves
the visual identity. Undo still clears the prepared window, and existing exact
origins, ordered reversal, rejection and cancellation remain authoritative.

**Earlier #711 phone feedback — 2026-10-23:** the owner accepts the overall feel
(“Nyt toimii täydellisesti”), then reports that continuation after Undo freezes.
They require one backward step only, with forward reel browsing continuing.
This accepts the reported feel, not the remaining continuation/startup/device
matrix. A bounded read-only hosted trace confirms the withdrawn Item was in its
fresh restoration page, a new skip on that restored origin committed, and the
following card recorded an impression. An unavailable restoration target is
therefore not established as the cause of this particular report; the precise
physical-device lock remains unverified.

The superseding narrow policy consumes feed Undo after the first durable
reversal admission and rejects another backward step until a new accepted
forward skip/rating or positive-card advance. Failed first local admission keeps
the opportunity; retrying remaining commands of the same partial reversal is
still recovery. Exact bounded history remains, but background acknowledgements,
refills and rerenders cannot re-enable Undo. Native drags must immediately
interrupt entry or snap-back motion so an animation callback cannot keep the
next card locked; an accepted outgoing card still cannot commit twice.
The same PR #355 owns this correction. Its first continuation source
`27feaef482b2d0e13884a4abb194bd345fead54d`, tree
`e02f783ef12c4df7066781e608b6ccd3e26635df`, passed all five required
[CI #712](https://github.com/Kajooja/Kajo/actions/runs/39988835313) gates with
769 mobile tests/74 files; its intermediate APK is building. That tree covers
the one-step gate and interruptible motion, not the following buffer refinement.

Before final delivery, source review identified a separate deterministic wait:
successful same-Item restoration discards every eligible sibling in its fresh
50-Item response, then waits for a separate five-Item root. The superseding policy
prepares up to five siblings from that successful current-epoch page, in response
order with exact fresh origins and target/handled/duplicate exclusions. No
pre-Undo buffer, missing-target page, stale reply or error is admitted. The next
new refill replaces the restoration reader with a five-Item root. This removes
the extra empty-window roundtrip without weakening reversal or exposure rules.
Final-source CI #713 passed all five gates and the APK job with 770 mobile tests
in 74 files. Its downloaded artifact and embedded bundle were independently
verified; PR #355 owns the final hashes/expiry. #712 does not validate this added
refinement, and the next owner observation below supersedes the pending test handoff.

**Earlier #713 phone feedback — 2026-10-23, 22:39 Europe/Helsinki:** the owner
accepts the rest of the feed but reports long loading after Undo and, after
repeated cycles, “Suositusten päivittäminen epäonnistui. Yritä uudelleen.”
Read-only hosted logs identify an 8,184-ms HTTP 500 from `rank_items_feed_v1`
and SQLSTATE 57014 inside `scenario_similarity_v1` / `text_array_jaccard` in
the canonical candidate scorer. This is a server statement timeout, not evidence
of an active-reader leak or a new gesture lock. Full repeated controller cycles
remain a regression gate; no physical-device fix is claimed before retest.

The same narrow PR now removes redundant history/similarity evaluation while
preserving the scorer's complete history, formulas, thresholds, ordering,
top-30 retrieval, exact floats and existing function/security identities.
The client first probes a fresh five-Item restoration root after ordered Undo
receipts. Only a successful current-epoch missing-target response replaces its
known reader with the original bounded search of three 50-Item pages. Ambiguous
requests retain exact retry identity, and missing-target pages supply no siblings.
This reduces the common restoration workload without shrinking the fallback or
making an old consumed delivery actionable. Canonical UX/model/Event documents
were updated before this runtime change. Local validation passes 777 mobile tests
in 74 files, all 322 database tests, lint/types/dependency/catalogue checks and
explicit demo iOS/Android exports. The complete root check reaches the unchanged
Deno npm-registry access limitation; full local-root success is not claimed.
Full-schema parity includes more than 30 tied outcomes, reversal/priority rules,
exact float bytes, old rows/receipt retries and unchanged function metadata.
Similarity calls fall from 2,880 to 1,760 and from 4,000 to 2,000 in the declared
fixtures; those are synthetic measurements, not hosted or phone timings.
The CLI-created forward is `20261023194530_scenario_similarity_evaluation.sql`,
SHA-256 `a5ab7b28ccd2ca34c2836b66e9ddff8827ddbfae2219292d169981f835297c4a`.
It guards body MD5 `45f4f03f4a4fb99d84a02c83c472ae89`; the patched body must be
`ea9bd681003796ae45261ee0fb6c1a05`, with all metadata preserved. The final #714 CI,
single hosted installation and verified APK completed this earlier packet; the
PR receipt and current accepted baseline above supersede its old pending notes.

The active design explicitly supersedes #709's acknowledgement-gated navigation
and suppression-only buffer exception. Successful local SQLite admission of an
exact skip/rating command advances to a prepared card; a failed local write does
not. Each pending action retains its frozen delivery under its own action ID.
Learning-changing rating/List acknowledgements mark the future reader dirty and
coalesce renewal; the already started bounded refill/exact retry may finish into
free slots. Before the next new request, renew the root from the latest committed
prefix. Neutral skip keeps its reader. Neither clears the active/adjacent card
or prepared window. Each new refill excludes
current, queued, displayed and locally handled pending Item IDs while preserving
server order. At most five prepared successors may predate a later acknowledgement;
they are not presented as freshly reranked. Undo, scope/source invalidation and
rejected-command discard still clear the window; List/undo admission waits for
pending queues to settle. Actual server truth and persistent accessible recovery
remain authoritative, while ordinary in-flight progress stays quiet. Taste keeps
acknowledgement → fresh NEXT and never precomputes five future questions.

Initially warm five successors; every consumption schedules background refill.
With one vacancy, admit one Item. The immutable v3 wire page limit remains five;
there is no one-Item page-size switch or extra staging window. If an in-flight
read is proven expired/unusable after ordinary acknowledgement scheduled renewal,
retire that request and continue the planned fresh root quietly with prepared
cards intact. Non-dirty cursor expiry keeps explicit recovery; hard
scope/source/undo/discard invalidation still rejects late work.

**Published #710 source validation:** 753 mobile tests in 74 files, mobile TypeScript,
focused ESLint and explicit demo iOS/Android exports pass. Coverage includes
five prepared successors, rapid durable admissions, out-of-order receipts,
exposure-gated skip replay, exact rejected-head recovery, successful retry
without navigation, exhaustion resumption and a same-event rating/advance that
retains the outgoing slider's chosen value. The root check's lint/type/mobile/
catalog stages pass; its unchanged Deno dependency fetch still stops at the
registry connection refusal. Final-source CI #710 and its configured APK passed
all five gates plus the build. These published receipts precede the new
post-#710 undo/refill refinement; no full device acceptance is inferred.

**Published #711 source validation:** implementation is complete and independent
review is clean. All 763 mobile tests in 74 files pass, as do the root check's
lint, type, dependency and catalog stages. Explicit demo iOS and Android exports
pass. The complete local root check remains blocked by the unchanged Deno
`deno.lock` dependency request to `registry.npmjs.org/@supabase%2fauth-js`, which
fails with `Connection refused`; it is not recorded as a full local pass.
All five final-source CI #711 gates and its configured APK passed on attempt 1.
The owner's subsequent scoped feedback and remaining continuation defect are
recorded above. These receipts do not validate the new post-#711 correction.

The published #709 baseline kept the active card plus at most four successors,
with exact page origins and no prefetch impressions. Neutral skip may retain
unrelated prepared cards because it changes suppression only; ratings, List
changes, undo and scope changes invalidate unseen work and select from the newly
committed state. A new root-only `rank_items_feed_v1` wrapper releases obsolete
derived reader state without changing immutable PredictionRuns or receipt retry.
The new forward is `20261022195553_discovery_feed_reader.sql`. The completed
source also retains an ambiguous root request until its exact receipt is resolved
before replacement, gates warming on durable action recovery, and invalidates
unseen work after recovered same-Profile actions on another Item. A proven
unusable/expired cursor clears unseen work and waits for explicit retry; reaching
the reader bound renews the owned reader rather than claiming catalogue exhaustion.
`RollingFeedCard.tsx` preserves the outgoing visual controls, title action and
expanded description during entry, with reduced-motion preference retained.

Focused local reader validation passes: the additive populated-schema PGlite
test preserves existing function/OID/ACL definitions and frozen runs, candidates,
pages and receipts. It exercises 20 successive replacements while 15 unrelated
readers keep the active total at 16, exact old root/continuation retries, failed
replacement rollback, scope denial and new ACL/RLS.

**Buffered-feed validation before the October 23 gesture refinement:** lint and mobile/engine/acceptance typechecks pass;
692 mobile tests in 71 files, 318 database tests, 311 engine tests, 19 Python and
43 Node research tests, plus 6 acceptance and 5 mobile-acceptance tests pass.
Explicit demo-mode iOS and Android Expo exports pass. `npm run check` reaches
the unchanged Edge dependency fetch and stops because `registry.npmjs.org`
refuses the Deno `@supabase/auth-js` request. No complete local-root success or
native device/emulator observation was claimed for these local checks. CI #707
and its configured build subsequently passed; new gesture-source validation and
its replacement build remain required.

**Published #709 whole-card gesture validation:** 724 mobile tests in 71 files pass,
including native responder-grant displacement reset, short flicks, paused-release
velocity, long-text reading/edge dismissal, reduced motion, readable backward
movement, slider intent and outgoing expanded-card continuity. A final native
responder review found that child Pressables can consume the start bubble phase;
fresh-session reset now runs in start capture without claiming the touch, so a
text swipe after horizontal slider use does not inherit the previous block.
Mobile types and
focused lint pass; the root lint/type/dependency/mobile/catalog stages pass.
The root check again stops at the unchanged Deno registry connection refusal.
Explicit demo iOS and Android Expo exports pass. No native emulator/device run
was available here. Final-source CI #709 and its APK subsequently passed; the
owner reported thumb/margin acceptance above. The new quiet-navigation source
still requires its own validation/build/device receipt. No new database change
is expected; preserve the installed feed-reader migration.

**Publication authorized:** the owner explicitly replied **“saat julkaista”**
to publishing reviewed local commit `06cd5eacfc4a52346e146d6f9ccb9530387d35fa`
to `Kajooja/Kajo` branch `feat/239-buffered-feed` and opening its PR against
`main`. This supersedes the earlier automatic approval rejection for this packet.
The recorded authorization covered the buffered-feed source now published in #355.
The branch's PR body owns the exact remote commit, CI and configured APK receipts.
Publication approval does not establish source merge, hosted or device acceptance.

**Hosted feed reader installed — 2026-10-23:** the owner authorized installation
with “saat asentaa”. The exact reviewed forward was installed through the
migration API as provider receipt `20261023062034`, named `discovery_feed_reader`.
Its source SHA-256 is
`2a0af1827e2eb09bfc8c95e6c2eb7631c2d035c142e3a57439c102cbc838ca4b`.
Postchecks preserve all 252 prior function bodies/OIDs/ACL/security/configuration
and all 84 earlier migration receipts; two functions and one migration were added.
New body digests, receipt-table RLS/constraints/immutable trigger and authenticated
RPC-only grants match the reviewed source. An unauthenticated probe returns 42501
before writing a receipt; no new security-warning category appears. PR #355 owns
the complete exact digest receipt. The earlier request-state errors and deployment
hold are resolved. Do not replay either this forward or the installed clock fix.

[UX_PRINCIPLES](../product/UX_PRINCIPLES.md#required-pre-mvp-card-controls--239--mvp-ux-006)
owns the controls and continuous-feed contract; [PREDICTION_MODEL](../domain/PREDICTION_MODEL.md#82-next-card-satisfaction-and-prefix-freshness--required-target)
owns the bounded prepared-window freshness tradeoff. [DEVICE_TEST](DEVICE_TEST.md#continuous-feed-feedback--239--2026-10-22)
owns the actual phone matrix, including rating tap/drag auto-advance, adjacent-card
motion, slow refill, fresh selection and repeated reader replacement. No device
smoothness or complete startup success is inferred from source or CI.

**Skip diagnosis and additive source repair:** read-only SQL confirms phone
impression occurrence times 107/116 ms earlier than the server prediction request,
while the exact actor/Profile/Item/session/page/Prediction bindings are valid.
The installed source incorrectly compared those independent clocks and rejected
Ohita. CLI-created `20261022151705_contextual_skip_server_clock.sql` removes only
that cross-clock predicate, preserving exact source binding, committed/MVCC and
server-clock availability checks, function identity and security metadata.

**Hosted clock repair completed — 2026-10-22:** the exact reviewed forward was
applied through the migration API, provider receipt **`20261022152530`** named
`contextual_skip_server_clock` (one exact statement, source MD5
`e6cf3dff20275321532506720b4704d9`). Source SHA-256 is
`1d3734bd62e01425d536d6d503d9934688016eafdab3567664b162949ba2a090`;
the resulting reader body MD5 is `e77719864279323386fcd15dfd68e6e6`.
All eight postchecks passed: metadata/OIDs/ACL/security of all 256 functions and
the other 255 bodies remain unchanged; metadata for 92 tables and all 72 trigger
hashes are unchanged; eight affected tables retain both row counts and complete
row digests. The previous 83 migration receipts are unchanged, with exactly one
new provider receipt. A bounded read-only helper probe finds both originally
failing feed impressions, each bound to its unique exact page; with the original
clock mismatch retained, both sources now validate with `acceptsNewSkip = true`.
No account reset or valid skip command was used; only the reviewed helper definition
changed. These probes are not a full authenticated/device command success.
Private target-bound evidence stays outside Git. Do not replay the installed clock
forward. Actual phone success remains unobserved after this repair.

**Preserved undo and Taste boundaries:** Discovery history retains exact actions
within the mounted scope and ten-native-action undo limit, with only one
backward step between accepted forward choices. The new inert cached
undo presentation may appear after durable admission; it is not a restored
actionable delivery. After all required confirmed undo receipts,
it first probes a five-Item canonical root, with a successful missing-target
response falling back to at most three 50-Item canonical pages; it
never reuses an expired/consumed original delivery. Unavailable targets offer
retry or cancellation, and nonundoable Shared consensus is rejected before
partial reversal. Sequential Taste shares compact presentation, direct rating
and account-scoped help, and advances after acknowledgement. It does not use
Discovery's window of one active card and five successors to precompute adaptive
questions and still lacks
numeric backward-question undo. Retained v1/challenge Save and frozen first-answer
measurement remain unchanged; full interaction/device acceptance remains open.

**One active continuation:** repair the confirmed repeated-Undo ranking timeout
and reduce the common restoration workload in the same PR #355. Validate final
source CI, install the exact reviewed additive performance forward and obtain a
replacement configured APK for the superseding phone matrix. #713's one-step
Undo/interruptible-motion/fresh-sibling source is already published and built.
Source integration remains separate from build, hosted and device evidence and
requires the final-source gates. Preserve accounts, ratings, List memberships
and pending commands. Do not reset accounts or replay installed migrations.
Versioned Taste pool refresh/refill under #336 follows this packet; original
frozen panels, first labels, session policies and retry origins remain protected.

## Accepted contextual skip source and backend checkpoint

The shared vertical Taste/Discovery feed is accepted through
[PR #350](https://github.com/Kajooja/Kajo/pull/350), merge
`637154d5e6eda1eb6ad87c3cdb792b6b8eda0929`, tree
`03543ff23686783655f5ffd8e23c5ab7dd755a01`. All five final-source
[CI #691 gates](https://github.com/Kajooja/Kajo/actions/runs/39585242416) passed,
including full tests, configured exports, two clean installations, populated
upgrade and native CLI/history/concurrency. Vite is pinned to 7.3.7 after the
first run's dependency audit failure; no gate was weakened. No feed source merge
or local recovery remains pending. Do not repeat #348/#349/#350.

The accepted source shares artwork/metadata/credited description, first-use help,
deliberate upward dismissal and accessible Ohita. It binds Taste to the exact
question/revision and Discovery to the actual page/Prediction/impression, preserves
exact commands across restart and refreshes only after acknowledgement. Grid stays
default; retained v1/challenge/legacy responses and collection/unranked overlay
paths preserve their original semantics. Source acceptance is not hosted, APK,
phone or recommendation-quality acceptance.

**Accepted compatibility source:** [PR #351](https://github.com/Kajooja/Kajo/pull/351)
is merged as `71b5b2616241e746ff3f8681e75dc42c2ed4c17a`, exact tree
`b8c16d3fa58b044ae8b7d8364b5b625c4ab033aa`, after all five
[required CI gates](https://github.com/Kajooja/Kajo/actions/runs/39622170200).
There is no pending compatibility source merge. The matching configured
[#695 APK](https://github.com/Kajooja/Kajo/actions/runs/39626258645/artifacts/12360202100)
is built; its exact archive receipt is below.

**Hosted rollout completed — 2026-10-22:** after the owner approved browser
fallback and completed login, the two unchanged #349 forwards were installed
through the SQL Editor. Each operation executed the exact reviewed SQL and added
its new history receipt in the same atomic transaction. The already installed
compatibility prerequisite was not replayed. The earlier failed connector
requests remain dated evidence in [Sprint 014](sprints/SPRINT-014.md); they are no
longer a deployment blocker, and no successful connector retry is claimed.

The immutable operation order remains pinned in
`scripts/database/contextual-skip-hosted-upgrade.json`:

| Installed source | Recorded version | Receipt path |
|---|---|---|
| `20261021144932_contextual_skip_import_compatibility.sql` | `20261021153148` | Earlier provider receipt |
| `20261016161919_native_contextual_skip.sql` | `20261022072353` | SQL Editor atomic receipt |
| `20261016162039_taste_contextual_skip.sql` | `20261022072535` | SQL Editor atomic receipt |

The two new history rows retain the exact source SQL in their statement arrays;
source MD5 values are `9ce2ed5b7d92acb3b026e79bdb04cacb` and
`bdc8d548401f8eabed31b805d980a4c1`, respectively. No prior history row was edited.
Final inventory is **83 migration receipts, 256 functions, 72 triggers and 92
tables** under the same inventory scope as the preflight. All **33 affected/new
function body checks** pass. All 233 prior function OIDs/non-body metadata, all
58 prior triggers and all 81 prior migration rows remain unchanged; only the
reviewed ten existing function bodies changed.

Full-content digests of all **62 existing public/private tables** and row counts
of all **89 prior tables** are unchanged. Auth tables were compared by counts;
no fresh full-content Auth digest verification is claimed. The three new private
tables are empty, have RLS enabled and deny direct access to anon, authenticated
and service_role. The six writer/read entry points grant caller execution only
to authenticated; other new helpers retain their denied boundaries. All nine
read-only role/malformed-command probes pass. Security advisors retain the
existing `auth_leaked_password_protection` warning tracked in #160/#184 and 51
intentional private-table no-policy informational notices. Detailed target-bound
snapshots remain private. No account reset, valid user command or model/Working
activation was used to verify deployment.

The earlier #695 device handoff is superseded by the #698 navigation blocker
and the active replacement-feed correction above. The installed backend checkpoint remains valid;
do not replay any installed migration. Original frozen panels, first labels,
session policies and retry origins remain preserved. #239/#336 and incomplete
release gates stay open.

**Documentation publication authorized — 2026-10-22:** the owner explicitly
approved publishing these project documents to the public `Kajooja/Kajo`
repository. This receipt uses `docs/239-skip-rollout-receipt`; its pull request
records the exact final checks and integration result. Detailed target-bound
snapshots, authentication data and browser files remain outside Git. Publication
does not close the actual device, recommendation-quality or release gates above.

The first receipt CI run (#696) stopped at the dependency security audit on two
newly reported `@vitest/mocker` advisories. The publication packet coordinates
the three Vitest test consumers at patched 4.1.12 and retains the existing audit
gate and application runtime source. Final-head CI must pass before integration.

Earlier accepted selector runtime is `8cd67af54765a2876f37e5db0deb66235ee3f0e9` through
[#345](https://github.com/Kajooja/Kajo/pull/345), exact tested tree
`a9a48b7dd37ce37538bc36e0cae7d0da856a9f90`. All five final-source
[CI #676](https://github.com/Kajooja/Kajo/actions/runs/38878872616) gates passed.
The accepted documentation receipt is [#346](https://github.com/Kajooja/Kajo/pull/346),
merge `7eefa4da97634beadb73b6731ae6530d25e592e5`, reviewed tree
`bdc98cc28c44ebfbc6f18be5388898cd6c142e36`; all five
[CI #678](https://github.com/Kajooja/Kajo/actions/runs/38883462410) gates passed.
Neither selector nor receipt integration remains pending.
The requirement/receipt packet #344 and earlier #343 source/three owner-approved
hosted operations remain accepted. #345's single additive hosted forward is also
installed and verified as recorded below.
The existing #669 mobile build source is
`c776de5fcdb62c72216b25a955a8c4b8685b2580` through
[#342](https://github.com/Kajooja/Kajo/pull/342), tree
`8ece8e164dfb4691737286340606e4ecd66de398`.
[CI #669](https://github.com/Kajooja/Kajo/actions/runs/38742567140) passed all
five gates and built the standalone APK. #669 remains compatible with the
unchanged v2 RPC/mobile queue through #345.
The #337 reference, #339 Discovery refresh, #340 evaluation boundary and #341
owned sequential server are accepted. Do not recreate these source packets.

The accepted mobile consumer uses separate acknowledged START/ANSWER/NEXT RPCs,
fresh RESUME after acknowledgement and one exact durable command per
backend/actor/Profile. V1 pending commands, sessions, frozen challenges and
completed setup survive the local upgrade. Confirmed missing first v2 RPC or an
explicit preservation receipt permits v1; an outage after ownership never changes
writers. **Jatka selaamaan** commits PAUSE before releasing the same Profile to
Discovery and preserves dismissal through restart. Saved-answer progress retains
honest insufficient support; full readiness and measured quality remain open.

The earlier owner-approved #343 hosted rollout is complete. Exactly three
operations were acknowledged in dependency order: the exact bootstrap compatibility prerequisite
`20261015192129_sequential_bootstrap_compatibility.sql`, canonical evaluation
`20261015090018_personal_evaluation_scoring.sql`, then durable v2
`20261015101752_durable_sequential_taste.sql`. The historical compact helper was
bridged without changing its identity/security. The original 16-forward chain,
earlier immutable-guard bridge and all accepted migration bytes remain unchanged.
All three new operations are installed; do not replay them.

That rollout's final actual-target read-only preflight passed the exact installed
two-forward prefix, provider/source receipts, all 41 function snapshots and nine
lifecycle triggers. V2 role denial and closed private storage checks passed.
All 60 then-preexisting Auth/public/private tables retained identical row counts
and complete-row digests after deployment. An existing owner's rolled-back
catalogue smoke returned 80 distinct BOOK and 80 distinct MOVIE Items with exact
retries; the same preservation checks passed afterward. At that deployment
verification the three new v2 tables were empty. This verified deployment and
preserved existing serving, not an observed first v2 session, phone installation
or recommendation quality.

The accepted preparation module remains read-only/disposable-only, with no hosted
apply entry point. Its exact prerequisite and installed-forward receipts, target
selection, history, raw function metadata and row fingerprints are retained
privately. A future operator must refresh and reconcile that checkpoint instead
of inferring provider versions from filenames. The earlier BRIDGE_REQUIRED result
is historical and superseded by the final passing installed-prefix preflight.

The accepted #345 source implements the first bounded selector part of the owner's
mandatory
[near-term feed/first-answer targets](ROADMAP.md#near-term-feed-and-first-answer-personalization--2026-10-15).
The additive `20261016073549_forecast_aware_taste_selection.sql` assigns only new
sessions the immutable `CANONICAL_FORECAST_V3` question policy through the same
v2 RPC/queue. It uses current-panel within-domain ordinal preference, utility-first
selection and a traced two-presentation domain-lead guard. Retained ADAPTIVE and
PRIOR_ONLY sessions keep their old selectors and exact records.

The single exact #345 forward is installed with SHA-256
`ffaa9ba15a9836b879936480d8a4c3abbaf22132db62da041c148a81bad71a0d`.
Actual-target verification preserved all 63 existing Auth/public/private ordinary
tables' row counts and complete-row digests, all 228 existing function identities
and non-body metadata, every body except the two approved exact replacements,
all 57 noninternal app-trigger attachments and all 62 app-table ACL/RLS snapshots.
Exactly one new denied selector exists; the default and validated policy check
match the accepted source. Seven security probes and four read-only helper cases
(canonical first choice, inversion, extreme scores and missing support) pass.
Migration history retains its exact earlier prefix plus one receipt. Known
security advisors are unchanged, including the existing Auth password warning
tracked in #160/#184. Target/provider identities and detailed fingerprints remain
private. Do not replay installed operations. No fixture account, reset, model or
Working activation occurred.

The merged #346 receipt records this accepted outcome.
The accepted shared feed, completed hosted rollout and device continuation are
described at the top of this file. Actual device/eligible-owner acceptance remains
required; source CI and deployment verification do not establish it.
Existing sessions, accounts and old queued commands survive.
The older #669 APK is a historical build for
[the existing device matrix](DEVICE_TEST.md#sequential-taste-v2-acceptance--336--342--2026-10-15).
The current #695 build and both hosted skip forwards are ready for their
remaining device acceptance matrix.
Preserve existing v1 sessions, pending commands and completed setup. A genuine new
v2 test requires an authorized eligible PersonalProfile without a prior v1 session
or completed setup; the current app has no restart-v2 action for those preserved
Profiles. Do not reset an account to force eligibility. Existing owners can test
preservation and committed Discovery choices now. On an eligible v2 Profile,
exercise slow/lost ANSWER/NEXT/PAUSE replies, restart/current-question recovery
and partial Taste → same-Profile Discovery freshness. No verified v2 device
acceptance, account reset, model/Working activation or measured quality is claimed.
Canonical preview follows consumer acceptance; #336 remains open for full
readiness/quality. Complete attention timing and authorized Scenario retrieval
retain their existing architecture gates.

The October 15 owner feedback reports the same Taste films as on another Profile
and requests shared Discovery/Taste artwork and vertical feed navigation. This is
a reported observation, not a verified protocol/version diagnosis or completed
device matrix. Identical cold-start openings can be legitimate. Source inspection
identified a narrower gap in the then-deployed numeric-v2 policy: next-question
selection ranked domain coverage before utility and did not rank by canonical forecast magnitude,
even though ANSWER projected the rating and captured a new forecast. The accepted
#345 source/hosted forward corrects that bounded selection gap for new-policy
sessions; retained policies keep their exact behavior. At that reported checkpoint Taste had title-only cards and Discovery used a
horizontal pager. #349 supplies the separate neutral contract and accepted #350
supplies its shared presentation, now packaged in #695. Both hosted skip forwards
are installed and verified; actual phone installation and acceptance remain open.
See ROADMAP for mandatory ordering and DEVICE_TEST for the reported/planned boundary.

Independent pure/native fixtures verify canonical-score inversion rather than
only a local similarity proxy, genuine separate-commit first 10/0/5 prefixes and
their next selected Items, neutral/tied/missing support, bounded coverage and
exact old-session preservation. They do not establish real-device usefulness or
calibrated probability. The canonical [source contract](../domain/PREDICTION_MODEL.md#canonical-forecast-selector-source--2026-10-16)
and source PR own exact final validation/integration receipts.

## Sequential adaptive Taste reference / #336

Historical baseline before #337 is `419f3850378d04b4e2417852d6b9eb5c06b5d127` through
[#335](https://github.com/Kajooja/Kajo/pull/335). Its final source
`7a64762db300314e22fe23e5af1713e0b62131b2` passed all five
[CI #657 gates](https://github.com/Kajooja/Kajo/actions/runs/38379100290).
The immutable-guard compatibility repair is complete; do not repeat it.
At that reference checkpoint the mobile consumer remained v1, as in the #653 APK below;
that packet added an isolated optional engine export without a mobile integration. Private operator
receipts and account/device data remain outside the published source.

The October 14 product direction replaces fixed completion quotas with a
**sequential adaptive Taste loop**: commit a pre-answer forecast, present one
question, retain/evaluate the first answer, admit its defined taste meaning,
then select and forecast the next question from the updated committed prefix.
Rating magnitude must affect selection where supported. The next estimate may
improve or reveal uncertainty; improvement after every individual answer is not
guaranteed. See [the canonical contract](../domain/PREDICTION_MODEL.md#sequential-adaptive-taste)
and [the product flow](../product/LAUNCH_LOOP.md).

[#336](https://github.com/Kajooja/Kajo/issues/336) first supplied the accepted
`feat/adaptive-taste-reference` source foundation:
`packages/prediction-engine/src/adaptive-taste.ts`, its optional `./adaptive-taste`
export and executable media/non-media conformance/control fixtures. This is a
portable pure reference consuming supplied canonical forecast snapshots. It
creates no native accounts, Events or predictions and changes no existing v1
session, mobile client, migration or deployed scoring policy. Native activation,
calibrated uncertainty/0–10 prediction and quality admission remain unavailable.
The issue/PR receipt owns exact final-source validation and integration status.

The packet covers **EB-03 / EB-08** and architecture sections **30, 32, 33, 40–42**:
forecast/evaluation lineage, numeric-aware question policy, bounded active
learning, canonical evidence and portable/domain-adapter responsibilities. It does
not close either complete capability or any release requirement.

Required reference invariants:

- A supplied question forecast is frozen before its answer. Later labels can
  improve future prefixes but cannot rewrite the original forecast or measured
  first answer. Correction/withdrawal invalidates affected copied evaluations.
- Same-domain ordinal comparisons use one earlier frozen pool in which both
  labels were unseen. Scores from different learned prefixes are never subtracted.
- Numeric ratings, unknown, not-interest and withdrawal have distinct meanings;
  scope, feature/catalogue/version and available-at-time prefix are explicit.
- Readiness inspects declared per-domain support, differentiating features,
  forecast coverage, prospective comparisons/observed agreement and stability. Counts or a stable
  all-tied forecast never imply reliability. Pause, poor recognition, exhaustion,
  missing support and safety budgets retain explicit insufficiency.
- A fixed recognition-only control remains available. Synthetic comparisons
  establish behavior/provenance, not empirical first-session usefulness.

The #337 reference and #339 Discovery refresh are accepted. Their owned SQL
commands and mobile consumer are also accepted through #341/#342;
continue the matching rollout/device handoff above. Do not infer a rating
from an uncalibrated ranking score. Preserve lifecycle/erasure, exact retry/conflict
and old v1 completion before native rollout. Working/cohort activation and model
promotion remain separate gates.

The October 15 owner clarification is now recorded in the canonical
[continuous-learning contract](../domain/PREDICTION_MODEL.md#continuous-learning-across-taste-and-discovery):
Taste may end with insufficient support and Discovery continues the same Profile's
learning. Working/Short/Long, permitted Group/World/Context and local/global
scenario-prefix retrieval remain the staged target; the current reference neither
implements native Discovery ingestion nor activates cross-Profile learning.

The requested adaptive runtime precedes the canonical unseen preview because its
selection, learning and honest evaluation contract must be sound first. Anonymous
identity/lifecycle/abuse/measurement still precede real anonymous entry. Genuine
#232F, Shared rollout and all incomplete MVP/release gates retain ROADMAP slots.

## Preserved v1 source and device acceptance

The owned session/challenge mobile source is accepted through
[#331](https://github.com/Kajooja/Kajo/pull/331), merge
`b3d8a080882160305f2dda5d4e9b1f98fcd0cd3c`, after all five CI #650 gates.
Its matching accepted application/build source is
`f5d9ce7b6f504075f2fb2edad5f15231f1cea465` through #332 and CI #653.
The source compatibility preparation/bridge in #333–#335 changes no compiled
mobile inputs. The reviewed [16-forward manifest](../../scripts/database/personal-taste-hosted-upgrade.json)
and its exact append-only bridge remain immutable. Reconcile private actual
checkpoints before applying genuinely missing files; never replay installed SQL.

Delivered **v1** retains the 12–24-opportunity/eight-known provisional rule,
ten MOVIE opportunities followed by an acknowledged BOOK transition, rating-only
Taste bootstrap and a separate fixed up-to-six-Item evaluation-only challenge.
Its selector uses response kind and feature coverage, not rating magnitude.
The challenge freezes one canonical forecast before all answers and exposes only
same-domain ordinal agreement/ties/support afterward. These are preserved source
facts, not the newly requested sequential runtime or measured reliability.

New cold-start v1 START remains explicit so history can be imported first.
Retained local commands preserve exact IDs/body through restart/lost acknowledgement;
confirmed conflicts require reload rather than rebasing. Unknown after a draft
clears that draft, while genuine zero and five remain ratings. Removal leaves a
terminal server tombstone. A first positively missing session RPC permits the
legacy fallback; once the owned session exists, an outage never changes writers.

Current matching-backend/APK observations remain in
[DEVICE_TEST](DEVICE_TEST.md) / [#238](https://github.com/Kajooja/Kajo/issues/238).
Record only actual resume/restart/lost-reply, transition, zero/unknown, conflict,
scope, hidden-forecast and withdrawal cases. Preserve old sessions/completed setup;
do not reset taste or retrospectively relabel a fixed v1 result as sequential v2.
Runtime, installation, quality and release acceptance remain separate from source CI.

## Source stack and integration gates

| Work | Current disposition |
|---|---|
| #229, #301, #304, #305 | Native delivery, reconnect/end refresh, audit recovery and catalogue append source included in the owner-authorized #329 integration. Configured-device/fresh-account observations remain tracked in DEVICE_TEST and #238. |
| #307–#313 | Shared round evidence, replay/captures, erasure and prepared prediction inputs. Genuine #232F prediction consumption and Phase 16.3 remain open. |
| #314–#322 | Native decay, bounded Personal WorkingState, frozen controls/features, prospective enrollment and private report/cohort foundation. Serving stays OFF; no actual cohort or quality admission. |
| #323 / earlier #306 | Reviewed Shared overlay eligibility integrated into the current stack; duplicate source PR #306 is closed after all six implementation/test/migration files matched exactly. Its immutable forward is part of the installed sixteen-forward manifest. Actual Shared device acceptance remains open; the obsolete source branch is eligible for retirement, with its PR/SHA receipt retained. |
| #324 / #328 / #329 / #330 / #331 | Portable selector and legacy calibration correction, durable session/SQL parity and canonical frozen holdout evaluation are integrated. #330/#331 is accepted owned adaptive mobile source with a guarded legacy fallback; hosted/device and anonymous acceptance remain separate. |
| #325 | Distinct native-Item base confidence support; all five [CI #637 gates](https://github.com/Kajooja/Kajo/actions/runs/38178201644) pass. The /8 support heuristic remains uncalibrated. |
| #326 / #327 | Personal source fusion/forgetting and complete engine ledger/handoff; all five required gates pass for both. Full-engine tracker #302 remains open. |
| #303 / #302 | Full-engine capability map integrated in this documentation successor on the current dependency-corrected stack. Original #303 is closed as superseded; its integrated #327 replacement passes all five CI #641 gates. Full-capability tracker #302 remains open. |

The owner has authorized source integration after successful CI. Keep branch
cleanup separate from consumed operation identities and any active worktree.
Actual Working collection needs
an authorized existing-owner roster/native/operator scope and an independently
retained pre-window declaration. Fixtures are not observed evidence.

## Current test APK and device work

The current supplied build and scoped owner observation are APK #716 in the
current packet above. #718 did not build a V4 successor APK; the authorized main
integration starts its configured build after all five CI gates. Its actual build
receipt and matching backend/device checks remain required. The following older
receipts are historical and do not
reopen completed build work or replace the current remaining DEVICE_TEST matrix.

The latest verified configured build is [CI #714](https://github.com/Kajooja/Kajo/actions/runs/40015633346),
PR #355 source `a8225b073d167d9c1015f121f33d101a923c2ce6`, tested merge checkout
`00377dbbd9a5a145016228bd5fe5089a4eb8f2f3`, shared tree
`44da4fc47ede33c9bde20a5b694cf974bf8b138c`. All six jobs passed on attempt 1,
completing at 2026-10-23 20:45:12 UTC. PR #355 remains unmerged.

[APK artifact #714](https://github.com/Kajooja/Kajo/actions/runs/40015633346/artifacts/12531530158),
`kajo-android-standalone-00377dbbd9a5a145016228bd5fe5089a4eb8f2f3`, expires
**2026-10-30 20:45:06 UTC / 22:45:06 Europe/Helsinki (UTC+02)**. ZIP: 49,301,538
bytes, SHA-256 `09cdac14ea73c4e1afbc501234e4ea75d3a4df9a4307ba8dbfc8b4bf2fbad819`.
Extracted APK: 106,089,543 bytes, SHA-256
`9f2eef37cd084083a22833809f713b3e93dae5df6ce7bfadc35bb57d4481d1cb`.
The verified embedded bundle is 3,468,780 bytes, SHA-256
`00361b73a20117091ef80af4e44d81d01c9ae78e296c28417b0a8946ba363a76`.
Independent verification matched GitHub's ZIP digest, exact APK entry, bundle,
source/test-merge tree and ordered parents. The owner now reports “Toimii” for
the feed/Undo correction. Installed checksum, signer comparison and full device
matrix remain unreported. The current horizontal-history/return source requires
a successor build; its final PR receipt supersedes this pre-build checkpoint.

The previous verified configured build is [CI #713](https://github.com/Kajooja/Kajo/actions/runs/39995144621),
PR #355 head `f763701d7f72d5be64483cb28e7ecf7eec6a1e7d`, tested merge checkout
`4d61df3126d48428ef0e40eca0f44a06d896c317`, shared tree
`feb8a3106580022bd0bedc4c86e71c5af247ca8c`. All five required gates and the
standalone APK job passed on attempt 1; PR #355 remains unmerged.

[APK artifact #713](https://github.com/Kajooja/Kajo/actions/runs/39995144621/artifacts/12521364384),
`kajo-android-standalone-4d61df3126d48428ef0e40eca0f44a06d896c317`, expires
**2026-10-30 18:05:50 UTC / 20:05:50 Europe/Helsinki**. ZIP: 49,301,565 bytes,
SHA-256 `ea08fb4d606276d1a9b8852d1cf90917aa742477b3d31512967e0a404bd32779`.
Extracted `app-release.apk`: 106,089,363 bytes, SHA-256
`fd15ebf8873c00b1ad5a1385b760ef0f4e4acb090e21bf714fef7470376683db`.
Archive/APK integrity and the 3,468,600-byte embedded bundle were verified; bundle
SHA-256 `be5d01959980a7a9f6ec2ee5e87e3bf93dacb40f835500152abe762e1a25b05e`.
The bundle contains the inert undo-presentation, feed-RPC/full-card and accepted-
outgoing-card guard markers; the old animation input gate and nested description
scroll marker are absent. The owner accepts the rest of the feed but reports the
post-Undo latency and repeated ranking failure above. No installed
checksum, signer comparison or complete physical-device acceptance is inferred.
PR #355's final publication receipt owns #713 and will own the correction's exact source,
checks and replacement artifact, superseding this frozen pre-build checkpoint.

The earlier verified configured build is [CI #710](https://github.com/Kajooja/Kajo/actions/runs/39962736369),
PR #355 head `2adc68e5beebb0eb5827e1caf50e349496239926`, tested merge checkout
`6dc508199b2f4897b09e2d6f0e9654d3ae8dce59`, shared tree
`47e34ec5f29263da6e28a9225b6e888154e5ca32`. All five required gates and the
standalone APK job passed on attempt 1; PR #355 remains unmerged.

[APK artifact #710](https://github.com/Kajooja/Kajo/actions/runs/39962736369/artifacts/12508616318),
`kajo-android-standalone-6dc508199b2f4897b09e2d6f0e9654d3ae8dce59`, expires
**2026-10-30 14:23:34 UTC**. ZIP: 49,301,314 bytes, SHA-256
`47ca015506cb82bfb6a0f0e68da9b0a9563c7e2021e5464248624c48eba43a20`.
Extracted `app-release.apk`: 106,088,951 bytes, SHA-256
`5547f683b33064a210895390d2e5fda5fe4625756b963e4b7180cebd83c0eeb5`.
Archive/APK integrity and the 3,468,188-byte embedded bundle were verified; bundle
SHA-256 `5788a1bbc86dd0050e28a5f270cce1fde47fd4105f94bfbb11b47f00da694f98`.
The bundle contains the feed RPC, full-card text and user-opened recovery panel;
the obsolete nested description-scroll marker is absent. Artifact identity and
integrity do not establish signer comparison or physical-device acceptance.
The owner now requests faster undo and uninterrupted slot refill. Those new
changes are not included in #710.

The earlier verified configured build is [CI #709](https://github.com/Kajooja/Kajo/actions/runs/39915662985),
PR #355 head `94f66d8900abb974bccd6bf4ed79029e6d7dd952`, tested merge checkout
`2ab3ed3c620809c6f2cfb65030792332f20729e0`, shared tree
`6aa97f876a24d6783986dde10fc73a986ff2a064`. All five required gates and the
standalone APK job passed on attempt 1; PR #355 remains unmerged.

[APK artifact #709](https://github.com/Kajooja/Kajo/actions/runs/39915662985/artifacts/12485628575),
`kajo-android-standalone-2ab3ed3c620809c6f2cfb65030792332f20729e0`, expires
**2026-10-30 07:43:25 UTC**. ZIP: 49,299,230 bytes, SHA-256
`d1bd4049c07ef5dab08fce615753ad5fb555ba39fc5b333d6dde87cbcc976241`.
Extracted `app-release.apk`: 106,084,919 bytes, SHA-256
`119b1f3613f1094373384e88965be483b0efdf5ec68d491e013536d39950729b`.
Archive/APK integrity and the 3,464,156-byte embedded bundle were verified; bundle
SHA-256 `a3d5668b1a674735cc24305eb907edfa556db0cbf4d1ae9ee567a7b133969090`.
It contains `rank_items_feed_v1` and `feed-description-content`, with no obsolete
`feed-description-scroll`. The owner accepts thumb feel/margins and requests the
quiet durable-navigation continuation above. This is not an installed checksum
or complete startup/device acceptance; the new continuation is not in #709.

The earlier verified configured build is [CI #707](https://github.com/Kajooja/Kajo/actions/runs/39853355488),
PR #355 head `65814a8bc0f8555e7ca0a1d558c461fe57748f63`, tested merge checkout
`3f6c9d89303b077c82a303dd5543db192863649d`, shared tree
`e307094a6f7350e7e36f8c9092ac54d45eacd351`. All five required gates and the
standalone Android job passed; PR #355 remains unmerged.

[APK artifact #707](https://github.com/Kajooja/Kajo/actions/runs/39853355488/artifacts/12459699826),
`kajo-android-standalone-3f6c9d89303b077c82a303dd5543db192863649d`, expires
**2026-10-29 21:41:07 UTC**. ZIP: 49,297,196 bytes, SHA-256
`36924d9b817592e9e53d2e881c604b74dafadecd46973885af8e0c27a13dbde0`.
Extracted `app-release.apk`: 106,079,855 bytes, SHA-256
`b9063ce5e7c06bea58a12da1435e302c8bfbbe7687c0a9b7417a0211f6332e60`.
Downloaded archive digest, ZIP/APK integrity and its 3,459,092-byte embedded
bundle were verified; the bundle contains the new feed RPC. The owner reports
the general layout/rating flow is good but whole-card scrolling remains unsmooth.
This is not an installed checksum or complete startup/gesture acceptance. The
active October 23 gesture correction is not included in #707.

The earlier verified configured build is [CI #704](https://github.com/Kajooja/Kajo/actions/runs/39834255038),
accepted #354 source head `95213d9c1455d7127c5908f6bc41387c2bea33d5` and tested
merge checkout `f3cdc6f2727a5c20bd3104004bf21f68f2f5c8f9`. Its tree is identical
to accepted main `99c21341c62eaae8dab3589944a434b06dc14258`. All five mandatory
checks and the separate Android job passed.

[APK artifact #704](https://github.com/Kajooja/Kajo/actions/runs/39834255038/artifacts/12451929109),
`kajo-android-standalone-f3cdc6f2727a5c20bd3104004bf21f68f2f5c8f9`, expires
**2026-10-29 19:27:41 UTC**. The downloaded ZIP is 49,293,137 bytes with SHA-256
`351d815369a72e3d6949176457bfab641a1b5f17f97e13aab4c38604d091a9f7`.
Its `app-release.apk` is 106,074,627 bytes with SHA-256
`1c6488329a857c39f64ded2a6eba9617b3424acb52d0a337becddea25ae19839`.
Archive/APK integrity and the embedded JavaScript bundle were verified. This is
not an installed phone checksum or device acceptance. It contains #354's compact
feed/startup repair, but not the active buffered-feed/rating successor above.

The earlier verified configured build is [CI #698](https://github.com/Kajooja/Kajo/actions/runs/39746829966),
source `5fb076c5b8dad2c4377dd3f8d33072d2f92fe860` (accepted #352).
Its [APK artifact](https://github.com/Kajooja/Kajo/actions/runs/39746829966/artifacts/12415374749)
is a 49,282,087-byte ZIP with reported archive SHA-256
`c581ec84ea93212129cbdbd66df48899240b4030d77877cc757aeeb9f3739846`,
expiring **2026-10-29 09:46:48 UTC**. This is not an installed APK checksum.
The owner reports the navigation failure above; this build must be replaced for
device acceptance. Passing its build and CI did not detect the navigator remount.

The earlier verified configured build is
[CI #695](https://github.com/Kajooja/Kajo/actions/runs/39626258645), source
`71b5b2616241e746ff3f8681e75dc42c2ed4c17a`, tree
`b8c16d3fa58b044ae8b7d8364b5b625c4ab033aa`. All five required gates and
the standalone APK job succeeded.
[APK artifact](https://github.com/Kajooja/Kajo/actions/runs/39626258645/artifacts/12360202100):
49,282,086-byte ZIP, GitHub-reported archive SHA-256
`b3b24e5f8bb2610a3303479bc023201e64d603c2628de6bc1003462c3d962499`,
expires **2026-10-28 16:15:34 UTC**. This is the archive digest, not an extracted
or installed APK checksum. It includes shared artwork/vertical feed/Ohita source.
The matching native/Taste skip hosted forwards are installed and verified as of
2026-10-22. No phone or recommendation-quality observation is claimed; build and
backend readiness do not close device acceptance. Preserve current accounts and
pending commands when installing.

The earlier [CI #677](https://github.com/Kajooja/Kajo/actions/runs/38881582992), source
`8cd67af54765a2876f37e5db0deb66235ee3f0e9`, tree
`a9a48b7dd37ce37538bc36e0cae7d0da856a9f90`. All five required gates and
the standalone APK job succeeded.
[APK artifact](https://github.com/Kajooja/Kajo/actions/runs/38881582992/artifacts/12039373533):
49,262,378-byte ZIP, GitHub-reported archive SHA-256
`80f3d0d10d24441db448fda731472746cf56f965aaa62c7078e8053daa64102d`,
expires **2026-10-23 10:13:46 UTC**. The archive was not downloaded in this audit;
this is not the extracted APK checksum. It retains the existing v2 consumer and
does not include the shared feed, artwork or neutral Ohita now packaged in #695.

The earlier compatible build remains a dated checkpoint:

Accepted-main [CI #669](https://github.com/Kajooja/Kajo/actions/runs/38742567140)
passed all five required gates and the standalone APK job. The binary's exact source
is `c776de5fcdb62c72216b25a955a8c4b8685b2580`, tree
`8ece8e164dfb4691737286340606e4ecd66de398`; it includes the sequential v2 consumer.

[APK artifact](https://github.com/Kajooja/Kajo/actions/runs/38742567140/artifacts/11979497865):
49,262,382-byte ZIP, archive SHA-256
`27490bffc06e6188ef9843caa19c3690212afced2d272df87430a923027a5108`,
expires **2026-10-22 14:04:16 UTC**. This identifies the archive, not the extracted APK.
The earlier #653 v1 binary remains historical evidence. Installing this new APK
against a confirmed missing initial v2 RPC permits the deliberate v1 fallback;
that fallback cannot establish sequential acceptance. The matching backend is now
installed through the owner-approved #343 rollout above; #343 changes no compiled
inputs. Existing v1/completed Profiles remain preserved. No new phone, emulator,
gesture or installation observation is claimed.

[DEVICE_TEST](DEVICE_TEST.md) owns native acceptance. Install as an update preserving
existing data and record installed SHA/run, device and actual backend checkpoint.
Source/build success is distinct from hosted migration or real-device acceptance.

## Accepted foundations and preserved operations

E1 independent contracts, D1 real isolated research intake and D2 baseline report
are accepted through #241/#242/#243. #265's exploratory prefix result is complete;
D2 rejected challenger admission and no research model is serving. Canonical
architecture and data rights remain in [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md)
and [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md).

The owner-applied September 24 BOOK description pilot is completed and independently
verified: exactly two Item updates, then the verified empty second batch. Preserve
all consumed attempts, cached records and rights/review history. #182 owns broader
catalogue coverage. Eight consumed catalogue operation refs are retained; no repeat
provider acquisition/apply is authorized by this handoff.

Hosted forwards already recorded in Sprint 014 are immutable. The September 12
rollout through `20260912134224_atomic_prediction_pages` and later catalogue
checkpoints must not be repeated from old instructions. Source migrations beyond
the actual hosted checkpoint need their guarded deployment procedure.

## Repository hygiene and historical evidence

The [October 21 continuation audit](retros/branch-audit-2026-10-21-continuation.json)
verifies **56 remote branches** at accepted #351 before publishing this receipt,
with no open PR. Forty-five development heads are reachable from main; two closed
duplicates (#303 → #327 and #306 → #323) retain accepted replacements. Those
**47** refs are retirement candidates after fresh PR/ref checks. Main and eight
consumed catalogue-operation refs remain intentional. The new active receipt
branch must also be retained while its work is open; it is outside that 56-ref
pre-publication snapshot. The [earlier October 21 audit](retros/branch-audit-2026-10-21.json)
remains the dated 55-ref/#350 checkpoint.

Remote deletion remains **not completed**: the connector has no branch-delete
operation and the previously recorded CLI write-authentication limitation is
unresolved. No credential probe was repeated and no remote ref was deleted by
this audit. This limitation must remain explicit in the next handoff.

The current main checkout was clean before this receipt branch, with no stash.
Three surviving historical checkout pointers again referenced removed scratch
Git metadata. All tracked contents and modes (736/738/738 entries) matched
accepted #343/#345/#346 snapshots, with no extra nonignored source files. Their
metadata was reattached as clean detached snapshots without changing source;
the other surviving historical checkout is also clean. No unique unpublished
source was found. These snapshots are not active implementation handoffs.
The [October 16 audit](retros/branch-audit-2026-10-16.json) retains its historical
local-recovery evidence and earlier branch counts.

Issue #333's already installed upgrade is closed; #177/#182/#199/#228/#232/#238/#240
now point at the current #336/#239 handoff instead of completed mobile/rollout
work. Twenty issues remain open for explicit product, device, quality and release
requirements; no device result is fabricated by closing a deployment tracker.
No tracked logs, APK/archive outputs, `.keep` placeholders, implementation
TODO/FIXME or merge-conflict markers were found. This audit changes no executable,
migration, dependency or workflow inputs and performs no hosted operation.

The [October 12 branch audit](retros/branch-audit-2026-10-12.json) remains a dated
35-ref source checkpoint, superseded by the current audit rather than another
active branch list.

STATUS is now a current handoff rather than a 2,500-line collection of conflicting
next-step instructions. Full historical checkpoints remain in [Sprint 014](sprints/SPRINT-014.md),
PR receipts and [Git history before this cleanup](https://github.com/Kajooja/Kajo/blob/5b830f2cf97b97ad70df4e01d472979782a759a9/docs/project/STATUS.md).
The September 30 [57-ref cleanup receipt](retros/branch-cleanup-2026-09-30.json)
remains dated evidence, not another deletion request.

Sprint 014, genuine algorithm usefulness, public Taste/identity/Friend/Shared,
production privacy/security/operations, beta/stores and the Share Link Gate remain
open. Follow ROADMAP; do not restart accepted foundations or reset existing users.
