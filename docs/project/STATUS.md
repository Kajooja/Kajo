# Kajo Current Status

Last updated: **2026-10-21**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **014 — algorithm reliability / real catalog / portable engine**, acceptance open.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current packet — guarded contextual skip rollout / #239 and #336

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

**One active continuation:** `fix/239-skip-hosted-compatibility` prepares the exact
missing hosted chain. The October 21 read-only check found sequential Taste and
#345's selector installed, all new skip endpoints/ledger absent, and nine of ten
required old function bodies matching. The retained compact
`private.remove_profile_import_job_v1(uuid)` is the only mismatch. Its known
format/alias difference must be bridged before the immutable Taste-skip forward;
never loosen that forward's guard or replay installed history.

The explicit order is pinned in
`scripts/database/contextual-skip-hosted-upgrade.json`:

1. `20261021144932_contextual_skip_import_compatibility.sql`: exact compact-body
   compatibility only; preserves identity/security/rows and refuses unknown drift.
   Canonical pre-skip and exact final Taste bodies are no-ops for fresh installs.
2. Unchanged `20261016161919_native_contextual_skip.sql` from #349.
3. Unchanged `20261016162039_taste_contextual_skip.sql` from #349.

The disposable populated rehearsal preserves old rows, v1 sessions/frozen
challenges, v2 START receipts, function metadata and history. Actual committed
v2 answers/neutral commands remain covered by the existing native skip tests.
Both prerequisite-first and chronological fresh paths must reach identical final
functions. The required native CLI gate also runs the compact-hosted rehearsal.
These modules have no hosted apply entry point.

**Next action:** inspect this continuation's PR for its exact source, five required
CI gates and integration/rollout receipt. Until a verified hosted receipt exists,
refresh target/history/object checks and install only the three reviewed operations
in the explicit order above after source acceptance. Preserve all existing data.
Then build a matching configured Android APK and record actual phone layout,
gestures, accessibility, restart and usefulness in
[DEVICE_TEST](DEVICE_TEST.md#shared-feed-source-acceptance--239--2026-10-17).
Do not infer installed state from migration filenames or reapply an acknowledged
operation. Versioned pool refill, recent supported prior, full readiness and
measured quality follow in ROADMAP. No reset or model/Working activation is part
of this packet. #239/#336 and incomplete release gates remain open.

Accepted runtime is `8cd67af54765a2876f37e5db0deb66235ee3f0e9` through
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
The accepted shared feed and guarded rollout continuation are described at the top of this file.
Actual device/eligible-owner acceptance and the separately guarded additive
backend installation remain required; source CI alone does not prove either.
Existing sessions, accounts and old queued commands survive.
The compatible #669 APK remains available for
[the existing device matrix](DEVICE_TEST.md#sequential-taste-v2-acceptance--336--342--2026-10-15);
it does not yet contain the requested feed changes.
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
horizontal pager. #349 now supplies the separate neutral contract; accepted #350 supplies its shared presentation. Neither changes the installed APK yet. See ROADMAP for mandatory
ordering and DEVICE_TEST for the reported/planned acceptance boundary.

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

The latest verified configured build is
[CI #677](https://github.com/Kajooja/Kajo/actions/runs/38881582992), source
`8cd67af54765a2876f37e5db0deb66235ee3f0e9`, tree
`a9a48b7dd37ce37538bc36e0cae7d0da856a9f90`. All five required gates and
the standalone APK job succeeded.
[APK artifact](https://github.com/Kajooja/Kajo/actions/runs/38881582992/artifacts/12039373533):
49,262,378-byte ZIP, GitHub-reported archive SHA-256
`80f3d0d10d24441db448fda731472746cf56f965aaa62c7078e8053daa64102d`,
expires **2026-10-23 10:13:46 UTC**. The archive was not downloaded in this audit;
this is not the extracted APK checksum. It retains the existing v2 consumer and
does not include the planned shared feed, artwork or neutral Ohita.

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

The [October 21 audit](retros/branch-audit-2026-10-21.json) refreshes all **55
remote branches** at accepted #350, with no open PR before this continuation.
Forty-four development heads are reachable from main; the two closed duplicates
(#303 → #327 and #306 → #323) retain accepted replacements. Those **46** refs can
be retired after fresh PR/ref checks. Main and the eight consumed catalogue
operation refs remain intentional and must not be reactivated.

Remote deletion remains **not completed**: the connector has no branch-delete
operation and a non-mutating Git push probe confirms that command-line Git still
has no write credentials. No remote ref was deleted or moved by the audit. The
prior [October 16 audit](retros/branch-audit-2026-10-16.json) is historical evidence,
not the active candidate count. This limitation must not be reported as completed
hygiene or silently dropped from the next handoff.

Two old local change sets were already accepted: all nine staged terminal-refresh
files exactly match #301, and an obsolete STATUS draft is superseded by #344/#346.
They are reconciled without losing source. Seven orphaned historical worktrees
were reattached only after their complete tracked contents matched accepted
commits. All twelve pre-existing worktrees are clean, main is synchronized and
no stash or unique unpublished source was found. Six obsolete local branches
were retired. Historical snapshots remain detached, not active feature work.

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
