# Kajo Current Status

Last updated: **2026-10-12**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **014 — algorithm reliability / real catalog / portable engine**, acceptance open.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current packet — guarded owned mobile Taste acceptance / #238

The owned mobile source is accepted through [#331](https://github.com/Kajooja/Kajo/pull/331),
merge `b3d8a080882160305f2dda5d4e9b1f98fcd0cd3c`, tree `25ea91d280d407921cbc8a4678cdef58fa9970a4`.
Its final source `bebd53613a0bc10917feb36b87e9a221dcf2295b` passed all five
[CI #650 gates](https://github.com/Kajooja/Kajo/actions/runs/38284940245).
[#330](https://github.com/Kajooja/Kajo/issues/330) closes the source packet;
actual matching-backend/APK/device acceptance stays open in #238 and DEVICE_TEST.
This documentation successor changes no executable, dependency, migration or build inputs.
Its PR receipt owns the exact documentation head/CI and later main build status.

The earlier #329 main integration accepted all 27 original source PRs. All five
CI #647/#648 gates and the #648 standalone APK pass. The owner's October 12
instruction superseded the previous device-based source merge hold. Actual device,
deployment and quality observations retain their own scope.

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

Validation: 35 focused mobile regressions pass, including retained legacy scope
cases. The shipped adapter also passes an actual full-current-schema SQL RPC probe
through START, zero/five/unknown, the actual book transition, canonical frozen
challenge completion and both removals. Final CI #650 passes the complete root
check: 517 mobile tests, 225 database tests, 245 engine tests, the remaining suites
and all four native exports. Platform/defaults, two clean installations, populated
upgrade and native CLI installation/history/concurrency also pass. The local root
run encountered refused Deno npm-registry access; full local-root success is not
claimed. No hosted migration, account reset, device round trip or quality admission
is supplied by these automated results.

**Next action:** verify the actual backend checkpoint and obtain the matching-source
APK for guarded native acceptance. Reconcile actual hosted migration history before
proposing any forward application; never replay deployed files or reset accounts.
Exercise resume/lost reply/restart, movie-to-book transition, unknown after a draft,
genuine zero, conflict, Profile/client changes, hidden challenge forecasts/results
and source withdrawal. Record installed SHA/run, device and backend identity in
DEVICE_TEST/[#238](https://github.com/Kajooja/Kajo/issues/238). Source #330/#331 is
complete; do not restart its implementation or use the older #648 binary as new-flow evidence.
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

The #331 main push started [CI #651](https://github.com/Kajooja/Kajo/actions/runs/38287239357),
including its automatic standalone APK stage after all five jobs. That new build
is still running at this acceptance receipt; no matching new APK is claimed yet.
The documentation PR receipt retains subsequent main CI/build status.

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
