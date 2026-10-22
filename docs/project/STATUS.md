# Kajo Current Status

Last updated: **2026-10-22**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **014 — algorithm reliability / real catalog / portable engine**, acceptance open.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current packet — buffered Discovery feed and rating flow / #239

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

**Latest owner refinement — 2026-10-22:** center artwork and compact text with
matching gutters; center the rating slider with small side margins; move a
title-sized List star beside the title. Prepare five Discovery cards and refill
one in the background, showing the next card during an upward drag. The owner
also reports that rating no longer feels smooth: either tapping a chosen point
or dragging must commit that rating and automatically advance. This supersedes
#354's rule that an acknowledged rating waits for a later forward gesture.

The active successor is `feat/239-buffered-feed`, based on accepted #354 main.
Its bounded implementation keeps the active card plus at most four successors,
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

**Final local validation:** lint and mobile/engine/acceptance typechecks pass;
692 mobile tests in 71 files, 318 database tests, 311 engine tests, 19 Python and
43 Node research tests, plus 6 acceptance and 5 mobile-acceptance tests pass.
Explicit demo-mode iOS and Android Expo exports pass. `npm run check` reaches
the unchanged Edge dependency fetch and stops because `registry.npmjs.org`
refuses the Deno `@supabase/auth-js` request. No complete local-root success or
native device/emulator observation is claimed. Final-source CI and a configured
replacement APK remain pending.

**Publication authorized:** the owner explicitly replied **“saat julkaista”**
to publishing reviewed local commit `06cd5eacfc4a52346e146d6f9ccb9530387d35fa`
to `Kajooja/Kajo` branch `feat/239-buffered-feed` and opening its PR against
`main`. This supersedes the earlier automatic approval rejection for this packet.
The implementation is unchanged; this follow-up only records authorization.
The branch's PR body owns the exact remote commit, CI and configured APK receipts.
Publication approval does not establish source merge, hosted or device acceptance.

**Hosted deployment blocked:** read-only preflight confirmed the required
dependencies/RLS and installed clock receipt `20261022152530`. Both migration-API
attempts failed with `McpServerError: Invalid or expired requestState`. Read-only
verification after both attempts returns `feed_rpc = null` and `migration = null`.
No hosted write succeeded, and the new feed reader is not installed. Resolve the
connector failure and install only this new reviewed forward before configured
feed acceptance; do not replay the existing clock migration.

[UX_PRINCIPLES](../product/UX_PRINCIPLES.md#required-pre-mvp-card-controls--239--mvp-ux-006)
owns the controls and continuous-feed contract; [PREDICTION_MODEL](../domain/PREDICTION_MODEL.md#82-next-card-satisfaction-and-prefix-freshness--required-target)
owns the narrow suppression-only buffer exception. [DEVICE_TEST](DEVICE_TEST.md#continuous-feed-feedback--239--2026-10-22)
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
within the mounted scope and ten-native-action undo limit. After confirmed undo,
it reacquires the same Item through at most three 50-Item canonical pages; it
never reuses an expired/consumed original delivery. Unavailable targets offer
retry or cancellation, and nonundoable Shared consensus is rejected before
partial reversal. Sequential Taste shares compact presentation, direct rating
and account-scoped help, and advances after acknowledgement. It does not use
Discovery's five-card buffer to precompute adaptive questions and still lacks
numeric backward-question undo. Retained v1/challenge Save and frozen first-answer
measurement remain unchanged; full interaction/device acceptance remains open.

**One active continuation:** publish the completed bounded feed/rating successor,
obtain final-source CI/configured-build and resolve the hosted deployment blocker
with an exact forward receipt before the new phone matrix. Preserve accounts, ratings, List memberships
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

The latest verified configured build is [CI #704](https://github.com/Kajooja/Kajo/actions/runs/39834255038),
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
