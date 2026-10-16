# Kajo Current Status

Last updated: **2026-10-15**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **014 — algorithm reliability / real catalog / portable engine**, acceptance open.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current packet — sequential Taste acceptance and required feed successor / #336

Accepted main is `799f1c850b989d1cfeef450946689224d9727359` through
[#343](https://github.com/Kajooja/Kajo/pull/343), exact tested tree
`211686d70bf33fe86c83191622e8b303a2d86ddc`. All five final-source CI #671
gates passed; the owner explicitly approved its merge and the three hosted
operations. The matching compiled mobile source remains
`c776de5fcdb62c72216b25a955a8c4b8685b2580` through
[#342](https://github.com/Kajooja/Kajo/pull/342), tree
`8ece8e164dfb4691737286340606e4ecd66de398`.
[CI #669](https://github.com/Kajooja/Kajo/actions/runs/38742567140) passed all
five gates and built the matching standalone APK; #343 changes no compiled inputs.
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

The owner-approved hosted rollout is complete. Exactly three new operations were
acknowledged in dependency order: the exact bootstrap compatibility prerequisite
`20261015192129_sequential_bootstrap_compatibility.sql`, canonical evaluation
`20261015090018_personal_evaluation_scoring.sql`, then durable v2
`20261015101752_durable_sequential_taste.sql`. The historical compact helper was
bridged without changing its identity/security. The original 16-forward chain,
earlier immutable-guard bridge and all accepted migration bytes remain unchanged.
All three new operations are installed; do not replay them.

The final actual-target read-only preflight passes the exact two-forward installed
prefix, provider/source receipts, all 41 function snapshots and nine lifecycle
triggers. V2 role denial and closed private storage checks pass. All 60 preexisting
Auth/public/private tables retain identical row counts and complete-row digests
after deployment. An existing owner's rolled-back catalogue smoke returned 80
distinct BOOK and 80 distinct MOVIE Items with exact retries; the same preservation
checks passed afterward. At deployment verification the three new v2 tables were
empty. This verifies
deployment and preserved existing serving, not an observed first v2 session,
phone installation or recommendation quality.

The accepted preparation module remains read-only/disposable-only, with no hosted
apply entry point. Its exact prerequisite and installed-forward receipts, target
selection, history, raw function metadata and row fingerprints are retained
privately. A future operator must refresh and reconcile that checkpoint instead
of inferring provider versions from filenames. The earlier BRIDGE_REQUIRED result
is historical and superseded by the final passing installed-prefix preflight.

Current branch `docs/sequential-taste-rollout-receipt` / [#344](https://github.com/Kajooja/Kajo/pull/344)
records this rollout and the owner's mandatory
[near-term feed/first-answer targets](ROADMAP.md#near-term-feed-and-first-answer-personalization--2026-10-15).
It does not implement those new targets. **Next action:** finish this documentation
packet, then correct canonical-forecast consumption in the next-question policy
under #336 before the shared vertical feed/artwork/contextual-skip successor.
The matching #669 APK remains available for
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
does identify a narrower first-answer gap: the next-question selector ranks domain
coverage before utility and does not rank by canonical forecast magnitude, even
though ANSWER projects the rating and captures a new forecast. Taste currently
has title-only cards; Discovery artwork lives in a separate horizontal pager.
The planned neutral **Ohita** also needs a versioned command/evidence contract,
not relabeling existing UNKNOWN/NOT_INTERESTED records. See ROADMAP for mandatory
ordering and DEVICE_TEST for the reported/planned acceptance boundary.

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
| #323 / earlier #306 | Reviewed Shared overlay eligibility integrated into the current stack; duplicate source PR #306 is closed after all six implementation/test/migration files matched exactly. Its branch and guarded hosted/device gates remain preserved. |
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

The [October 12 branch audit](retros/branch-audit-2026-10-12.json) records **35 remote
branches at its earlier source checkpoint**: then-accepted main, eight consumed
operation identities and open source/documentation dependencies. That earlier
audit did not delete branches. After #329 integration, check actual ancestry,
fresh PR state, file references and active worktrees before retiring merged refs;
the eight consumed catalogue operation identities remain retained.
No tracked logs, APK/archive outputs,
`.keep` placeholders, implementation TODO/FIXME or merge-conflict markers were found.

STATUS is now a current handoff rather than a 2,500-line collection of conflicting
next-step instructions. Full historical checkpoints remain in [Sprint 014](sprints/SPRINT-014.md),
PR receipts and [Git history before this cleanup](https://github.com/Kajooja/Kajo/blob/5b830f2cf97b97ad70df4e01d472979782a759a9/docs/project/STATUS.md).
The September 30 [57-ref cleanup receipt](retros/branch-cleanup-2026-09-30.json)
remains dated evidence, not another deletion request.

Sprint 014, genuine algorithm usefulness, public Taste/identity/Friend/Shared,
production privacy/security/operations, beta/stores and the Share Link Gate remain
open. Follow ROADMAP; do not restart accepted foundations or reset existing users.
