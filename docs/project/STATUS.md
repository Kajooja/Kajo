# Kajo Current Status

Last updated: **2026-10-12**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **014 — algorithm reliability / real catalog / portable engine**, acceptance open.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current packet — owned adaptive mobile Taste consumer / #330

Accepted main is `9237b3814b2b408a43ec8abb664c3a6c0a57baca`, tree
`80862d9b9a1e1cea5d062be3d1fddb237ff45658`, through [#329](https://github.com/Kajooja/Kajo/pull/329).
All 27 source PRs are merged. All five final-head CI #647 gates and main CI #648
pass; main #648 also built the standalone APK. The owner's October 12 instruction
superseded the previous device-based source merge hold. Actual device, deployment
and quality observations still retain their own scope.

The next source packet is [#330](https://github.com/Kajooja/Kajo/issues/330), branch
**`feat/mobile-personal-taste`**, based directly on that main. Its PR/issue receipt
owns exact publication and final CI state; an open source branch is not accepted main.
The owned mobile consumer now uses both `taste_session_v1` and
`taste_challenge_v1` through a typed service boundary and a separate persistence/
retry controller. Presentation does not select questions or score predictions.

Delivered source behavior:

- New cold-start creation waits for **Aloita makutesti**, allowing history import
  first. Retained local sessions resume automatically. Completed setup is
  preserved; a server START lookup can also recover a cross-device session whose
  bootstrap has already reached six strong responses.
- The server's retained question/transition/stop state controls progression.
  Ten MOVIE opportunities lead to an explicit book acknowledgement; the longer
  12–24 opportunity / eight-known policy does not stop at the native six-strong gate.
- Each command is persisted before dispatch in backend/actor/Profile-scoped SQLite.
  One pending command retains its exact ID/body across lost acknowledgements and
  process restart. Confirmed conflicts require an explicit current-state reload;
  the old answer is never silently rebased onto a different question.
- Layout cleanup/generation guards cancel stale scope work and old callbacks.
  Corrupt storage is not overwritten or dispatched. Full answer/forecast state
  stays server-owned; local storage retains IDs, dismissal and one pending command.
- Independent unknown discards an unsubmitted rating; genuine zero and neutral five
  remain explicit ratings. Book transition and challenge start are explicit actions.
- Forecasts/partial metrics remain hidden until all first challenge answers lock.
  The result describes same-domain ordering, actual sample size, ties and missing
  support, without a fabricated rating estimate, percentage or statistical certainty.
- Confirmed removal uses the relevant RPC and renders its terminal result.
  Only a positively missing first session RPC enables the retained legacy static
  calibration. Once a new session exists, an outage never changes evidence writers.

Validation: 34 focused mobile regressions pass, including retained legacy scope
cases. The shipped mobile adapter also passes a full-current-schema SQL contract
probe through START, zero/five/unknown, the actual book transition, canonical frozen
challenge completion and both removal boundaries. Local lint/typecheck, dependency,
mobile and catalogue checks pass. Local root `npm run check` encounters refused
Deno npm-registry access at Edge validation; full-root success is not claimed.
Final full CI and native exports belong to the current PR receipt. No hosted
migration, account reset, actual device round trip or quality admission is claimed.

**Next action:** finish this source's required CI, fixing any failure, then perform
its guarded native acceptance with the matching backend checkpoint and APK.
Reconcile actual hosted migration history before proposing any forward application;
never replay old deployed files or reset accounts. Exercise resume/lost reply/
restart, movie-to-book transition, unknown after a draft, genuine zero, conflict,
Profile/client changes, hidden challenge forecasts/results and source withdrawal.
Record installed SHA/run, device and backend identity in DEVICE_TEST/#330.
Canonical unseen preview follows this consumer. Anonymous identity/lifecycle/
abuse/measurement still precede real anonymous entry; later answer projection,
observed usefulness, genuine #232F, Shared rollout and all incomplete MVP gates remain open.

## Source stack and integration gates

| Work | Current disposition |
|---|---|
| #229, #301, #304, #305 | Native delivery, reconnect/end refresh, audit recovery and catalogue append source included in the owner-authorized #329 integration. Configured-device/fresh-account observations remain tracked in DEVICE_TEST and #238. |
| #307–#313 | Shared round evidence, replay/captures, erasure and prepared prediction inputs. Genuine #232F prediction consumption and Phase 16.3 remain open. |
| #314–#322 | Native decay, bounded Personal WorkingState, frozen controls/features, prospective enrollment and private report/cohort foundation. Serving stays OFF; no actual cohort or quality admission. |
| #323 / earlier #306 | Reviewed Shared overlay eligibility integrated into the current stack; duplicate source PR #306 is closed after all six implementation/test/migration files matched exactly. Its branch and guarded hosted/device gates remain preserved. |
| #324 / #328 / #329 / #330 | Portable selector and legacy calibration correction, durable session/SQL parity and canonical frozen holdout evaluation are integrated. #330 supplies the owned adaptive mobile consumer with a guarded legacy fallback; hosted/device and anonymous acceptance remain separate. |
| #325 | Distinct native-Item base confidence support; all five [CI #637 gates](https://github.com/Kajooja/Kajo/actions/runs/38178201644) pass. The /8 support heuristic remains uncalibrated. |
| #326 / #327 | Personal source fusion/forgetting and complete engine ledger/handoff; all five required gates pass for both. Full-engine tracker #302 remains open. |
| #303 / #302 | Full-engine capability map integrated in this documentation successor on the current dependency-corrected stack. Original #303 is closed as superseded; its integrated #327 replacement passes all five CI #641 gates. Full-capability tracker #302 remains open. |

The owner has authorized source integration after successful CI. Keep branch
cleanup separate from consumed operation identities and any active worktree.
Actual Working collection needs
an authorized existing-owner roster/native/operator scope and an independently
retained pre-window declaration. Fixtures are not observed evidence.

## Current test APK and device work

The latest verified binary at this checkpoint is accepted main [CI #648](https://github.com/Kajooja/Kajo/actions/runs/38262881349),
source `9237b3814b2b408a43ec8abb664c3a6c0a57baca`, tree
`80862d9b9a1e1cea5d062be3d1fddb237ff45658`. All five required gates and APK job passed.

[APK artifact](https://github.com/Kajooja/Kajo/actions/runs/38262881349/artifacts/11755916831):
49,239,510-byte ZIP, archive SHA-256
`321329404a0ff9b99d0dc9c3bf37506c416379b033f26b1305f430d2c44285dc`,
expires **2026-10-19 15:12:12 UTC**. This digest identifies the archive, not the extracted APK.
It predates the #330 mobile consumer; do not attribute that new flow to this binary.
The earlier #324 artifact remains historical source/build evidence.

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
