# Kajo Current Status

Last updated: **2026-10-15**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **014 — algorithm reliability / real catalog / portable engine**, acceptance open.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current packet — durable sequential Taste v2 / #336

Accepted main is `baf190fed5350e0323844518f483960dd5b2f73c` through
[#340](https://github.com/Kajooja/Kajo/pull/340). Its source
`587ce886bb9fa5e7e987e5e208a56536f7b7a788`, tree
`9b8606fe0ff4058f311fbbd9dc915c2452bf0656`, passed all five
[CI #663](https://github.com/Kajooja/Kajo/actions/runs/38714352914) gates.
The canonical explicit-candidate scoring/capture prerequisite is complete.
The numeric sequential reference [#337](https://github.com/Kajooja/Kajo/pull/337)
and committed Discovery refresh [#339](https://github.com/Kajooja/Kajo/pull/339)
are also accepted; do not recreate these packets. Source acceptance is distinct
from hosted rollout, device observations and measured recommendation quality.

Current branch `feat/durable-sequential-taste` continues
[#336](https://github.com/Kajooja/Kajo/issues/336) with
`20261015101752_durable_sequential_taste.sql` and owned `taste_session_v2`.
START/NEXT/ANSWER are separate committed transactions. The server freezes the
canonical panel before a first answer, retains that original measurement, projects
its evidence, and captures the next forecast from the updated receipt prefix.
A transaction begun before the answer cannot become eligible by waiting on a lock.
The actual numeric question selector is parity-tested against #337's reference.
Same-domain ordinal pairs use scores from one earlier unseen pool, not scores
from different learning prefixes. No evaluation panel becomes delivered exposure.

Numeric 0/5/10 and distinct NOT_INTERESTED update canonical bootstrap priors;
UNKNOWN affects recognition/question selection only. The new negative kind is
restricted to this owned source, uses the existing bootstrap/native trust ratio,
and creates no invented numeric rating, consumed Event or native confidence.
Only three explicitly guarded helper bodies change; all old weights, function
identities/ACLs and populated rows are preserved. Exact retries/CAS, immutable
first measurements, corrections, dependency-closure withdrawal, external source
erasure and terminal removal are covered. Existing v1 sessions/completed setup
remain preserved; v1 cannot start a competing writer after v2 owns the Profile.

The owner explicitly prioritizes a continuously changing forecast at this stage.
Readiness is honestly INSUFFICIENT while the full native per-domain readiness
adapter is not admitted. The 48-opportunity/160-command budgets are safety bounds,
not sufficient-answer quotas. PAUSE/CONTINUE preserves the Profile/evidence and
allows partial Taste to continue Discovery. The current mobile client still uses
v1; v2 navigation/queue consumption is the next source integration. Detail dwell
already exists as weak attention; full visible-item/stop/foreground timing and
Scenario consumption remain separate implementation gates. See the canonical
[continuous-learning contract](../domain/PREDICTION_MODEL.md#continuous-learning-across-taste-and-discovery)
and [evidence boundary](../domain/DATA_EVENTS.md#sequential-own-personal-v2-source).

All 256 database tests (including 17 focused sequential tests), 522 mobile tests,
284 engine tests, lint/typecheck, catalog/research/acceptance suites and four
iOS/Android exports pass locally. The local root check reaches refused Deno
npm-registry access; this limit must not be reported as a complete root pass.
Independent PostgreSQL connections in the native CLI gate exercise same-ID
START/NEXT/ANSWER, stale revisions, an earlier NEXT transaction and import removal.
The PR owns final source/tree, all five CI gates and merge receipts.

**Next action:** finish checks and publish this prepared branch; accept only after
all five final-source CI gates pass. Then integrate the mobile v2 consumer:
acknowledged answer → separate NEXT, durable retry/restart, old-v1 preservation,
and partial Taste → Discovery on the same Profile without claiming confidence.
Record matching-device slow-write/offline retry and resumed-question observations
separately. #336 remains open for that integration and full readiness/quality
acceptance. No hosted migration, account reset or model/Working/population
activation is part of this source packet.

## Sequential adaptive Taste reference / #336

Historical baseline before #337 is `419f3850378d04b4e2417852d6b9eb5c06b5d127` through
[#335](https://github.com/Kajooja/Kajo/pull/335). Its final source
`7a64762db300314e22fe23e5af1713e0b62131b2` passed all five
[CI #657 gates](https://github.com/Kajooja/Kajo/actions/runs/38379100290).
The immutable-guard compatibility repair is complete; do not repeat it.
The current mobile consumer remains v1 as in the #653 APK below;
this packet adds an isolated optional engine export without a mobile integration. Private operator
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

The #337 reference and #339 Discovery refresh are accepted. After the current
canonical evaluation-scoring packet, continue the persistent owned SQL commands
and mobile consumer described in the current handoff above. Do not infer a rating
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

Accepted main [CI #653](https://github.com/Kajooja/Kajo/actions/runs/38287730599)
passed all five required gates and the standalone APK job. The binary's exact source
is `f5d9ce7b6f504075f2fb2edad5f15231f1cea465`, tree
`43a02e520c2caa465723211163484f50091e16a8`; it includes the owned mobile consumer.
The #334 preparation and current compatibility repair change no compiled mobile
or dependency inputs.

[APK artifact](https://github.com/Kajooja/Kajo/actions/runs/38287730599/artifacts/11767100629):
49,258,173-byte ZIP, archive SHA-256
`271f6860f58d817a76227d55c9f3a38e8983a4501bf3c6b282a07b3bb0050869`,
expires **2026-10-19 18:34:20 UTC**. This identifies the archive, not the extracted APK.
The older #648/#324 binaries are historical. A missing initial session RPC permits
the deliberate legacy-calibration fallback; that fallback is not adaptive-flow
acceptance. Before the new device cases, the operator must verify the required
backend RPC versions for the installed binary.

[DEVICE_TEST](DEVICE_TEST.md) owns native acceptance. Record installed SHA/run,
device and backend checkpoint. A successful source/build check is not an
installation, hosted migration or real-device observation.

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
