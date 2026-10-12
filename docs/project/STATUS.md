# Kajo Current Status

Last updated: **2026-10-12**
Milestone: **MVP 0.1 — first public Kajo**
Sprint: **014 — algorithm reliability / real catalog / portable engine**, acceptance open.
Last accepted sprint: **013**.

This file owns the one current handoff. [ROADMAP](ROADMAP.md) owns execution order;
[MVP](../product/MVP.md) owns release requirements; [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste → auth → Friend → Shared flow. An open source PR, passing CI,
hosted deployment and device/quality acceptance are separate states.

## Current packet — finish Personal source fusion #326

Active branch: **`feat/personal-source-fusion`**, [PR #326](https://github.com/Kajooja/Kajo/pull/326),
based on [#325](https://github.com/Kajooja/Kajo/pull/325) at
`f017c089d8414a87fbb7168761019b471ee3dde6`.
Accepted main is still `34d21704cafe21091a2369396c9bc61dce99c1e9`.
The PR head and CI receipt identify the published source; a temporary CLI bootstrap
commit alone does not contain the completed implementation.

The completed source resolves one current owned Personal rating per Item before
weighting: later canonical receipt revisions replace earlier ratings and that
Item's bootstrap contribution, including zero and neutral five. Exact Undo and
history erasure remain distinct. Equal/backdated client clocks follow the server
receipt chain; legacy raw Events retain explicit ambiguity/unavailable fallback.
Invalid, cyclic, competing or over-depth chains cannot select a guessed rating.
The depth boundary is 512 and overflow does not truncate to an older answer.

Memory, ordinary/catalogue scoring and current bootstrap setup status share the
same finite owned source prefix. Saved/List removal uses valid receipt order when
available, including backdated commands; unavailable future controls do not erase
current support. Setup's six-strong-Item threshold is preserved and is not the
number of known Taste ratings. Bootstrap decay is versioned and now tends toward
zero on its existing 1460-day timescale; native LongTerm retains 180 days.

New Personal base version is `prediction-v0.6-personal-source-fusion`;
`memory-state-v1` and `prediction-features-v2` retain structural compatibility.
Old frozen PredictionRun/page/shadow/Working records and Shared direct scoring
retain their earlier versions. No account/history reset, hosted migration,
model admission or observed-quality claim is included.

Implementation: [Personal source contract](../domain/PREDICTION_MODEL.md#49-personal-source-fusion-and-forgetting),
[CODEMAP](../architecture/CODEMAP.md), migration
`supabase/migrations/20261012060821_personal_source_fusion.sql` and
`scripts/database/personal-source-fusion*`. The filename was created with the
verified CI-pinned Supabase CLI 2.117.0; its temporary bootstrap workflow is removed.
Native CI includes both populated-upgrade preservation and the current-source
runtime matrix. Historical native-decay/support matrices execute on their actual
pre-fusion generation; new-generation tests own the changed source semantics.

### Validation and publication

Focused source/status/lineage tests cover real public commands, legacy ambiguity,
zero/five, selective clear, future controls, scope/ACL, receipt depth and genuine
Shared preservation. Populated upgrade checks frozen receipts, rows and function
identity/owner/grants/configuration; corruption controls reject extra mutations.

Local `npm run check` passes lint/typecheck, dependency **43**, mobile **493**
and catalogue **444**, then fails because this environment cannot download the
locked Edge npm dependencies (`@supabase/auth-js`, connection refused).
A complete local root pass is **not** claimed. Engine **245**, research
**19 Python + 43 Node**, and acceptance **6 + 5** pass separately.
The final serial database result and exact published CI receipt are recorded in
[PR #326](https://github.com/Kajooja/Kajo/pull/326) and the current
[Sprint 014 entry](sprints/SPRINT-014.md#personal-source-fusionforgetting--2026-10-12).
Required CI must pass for the completed implementation, not just its bootstrap commit.

**Next action:** verify all five required CI conclusions on the completed #326
source and fix any actual failure. Reconcile the saved #303 engine capability map
onto the current dependency-corrected stack, preserving its 51-section scope and
current roadmap order. Then implement the own-Personal server TasteSession with
frozen policy/catalog, durable authorized presentations/responses and canonical
bootstrap provenance. Anonymous identity, retention/deletion, abuse controls and
measurement precede real anonymous Taste; challenge predictions freeze before answers.

## Source stack and integration gates

| Work | Current disposition |
|---|---|
| #229, #301, #304, #305 | Native delivery, reconnect/end refresh, audit recovery and catalogue append source. #229 stays draft until configured-device/fresh-account acceptance. |
| #307–#313 | Shared round evidence, replay/captures, erasure and prepared prediction inputs. Genuine #232F prediction consumption and Phase 16.3 remain open. |
| #314–#322 | Native decay, bounded Personal WorkingState, frozen controls/features, prospective enrollment and private report/cohort foundation. Serving stays OFF; no actual cohort or quality admission. |
| #323 / earlier #306 | Reviewed Shared overlay eligibility integrated into the current stack. Guarded hosted rollout and actual Shared device observations remain open. |
| #324 | Portable Taste selector and calibration correction. Native six-known/static calibration does not yet consume the adaptive selector. |
| #325 | Distinct native-Item base confidence support; all five [CI #637 gates](https://github.com/Kajooja/Kajo/actions/runs/38178201644) pass. The /8 support heuristic remains uncalibrated. |
| #326 | Current Personal source fusion/forgetting packet above. |
| #303 / #302 | Full-engine capability map saved but original PR failed inherited dependency audit. Reconcile documentation without reverting current source or claiming capabilities delivered. |

Do not merge the dependent stack past #229's remaining acceptance gates or delete
its ancestor branches as though they were stale. Actual Working collection needs
an authorized existing-owner roster/native/operator scope and an independently
retained pre-window declaration. Fixtures are not observed evidence.

## Current test APK and device work

The latest verified build is [CI #636](https://github.com/Kajooja/Kajo/actions/runs/38177074386),
source #324 `9710f9cedf51bff12cbda0130d8fa4580b6d5c7a`, tree
`f4174fd093db06d4a2de1bc74e801d870d00b6fb`. All five required gates and standalone
APK job passed; actual checkout `8db45988a9b4d018f46461f087df3543d9a1771d` has that tree.

[APK artifact](https://github.com/Kajooja/Kajo/actions/runs/38177074386/artifacts/11717690069):
49,239,529-byte ZIP, archive SHA-256
`0613eca0640a9881618521b2b7c4045588e3037d304167c24f4cc3d2dac58991`,
expires **2026-10-18 22:21:38 UTC**. This is the ZIP digest, not the inner APK hash.
Later server-only source changes do not change which binary was built.

[DEVICE_TEST](DEVICE_TEST.md) owns the test checklist: unknown/zero/prefix/Profile
switching, reconnect and continuation, Lists/history, Shared and fresh-account
observations. Record installed SHA/run, device and backend checkpoint. A successful
build does not prove installation, hosted migration or real-device behavior.

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

The [October 12 branch audit](retros/branch-audit-2026-10-12.json) covers **35 remote
branches**: accepted main, eight consumed operation identities and open source/
documentation dependencies. No branch was deleted: none is a safely disposable
merged development ref on current main. No tracked logs, APK/archive outputs,
`.keep` placeholders, implementation TODO/FIXME or merge-conflict markers were found.

STATUS is now a current handoff rather than a 2,500-line collection of conflicting
next-step instructions. Full historical checkpoints remain in [Sprint 014](sprints/SPRINT-014.md),
PR receipts and [Git history before this cleanup](https://github.com/Kajooja/Kajo/blob/5b830f2cf97b97ad70df4e01d472979782a759a9/docs/project/STATUS.md).
The September 30 [57-ref cleanup receipt](retros/branch-cleanup-2026-09-30.json)
remains dated evidence, not another deletion request.

Sprint 014, genuine algorithm usefulness, public Taste/identity/Friend/Shared,
production privacy/security/operations, beta/stores and the Share Link Gate remain
open. Follow ROADMAP; do not restart accepted foundations or reset existing users.
