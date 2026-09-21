# Kajo Current Status

Last updated: **2026-09-21**
Current milestone: **MVP 0.1 — first public Kajo**
Current sprint: **Sprint 014 — algorithm reliability / real catalog / portable engine**
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file owns one exact resumable next task. [ROADMAP](ROADMAP.md) owns order,
[MVP](../product/MVP.md) owns release blockers and [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste/Friend/Shared flow. Read current main first, then the active branch;
an older branch-local handoff cannot replace newer accepted product decisions.

## Current packet — #182 native description-credit acceptance

**Publication approval, 2026-09-21:** the owner explicitly approved publishing
this complete source/documentation packet to public `Kajooja/Kajo` and merging
after all five required CI gates pass. This resolves the earlier automatic
approval review block; no alternate publication route was used. Implementation
commit `4907fbb9f12eb5730028b46b4a6473adfa9e55fa`, checked source tree
`a888354f9a3345a214a28f72dc54bea35b4cf577`, passed all 442 local tests and four
native exports. Subsequent checkpoint edits are documentation only.
[Issue #182](https://github.com/Kajooja/Kajo/issues/182) records the final PR,
exact published source, CI and merge identities. The source checkpoint is based
on accepted main `00077fd725df3adfff7e020cc51ba2f7fd95b911` / PR #258.
The next acceptance task remains actual native-device observations below;
source/CI acceptance alone does not complete it. Do not repeat implementation,
installed migrations, provider calls or APK dispatch.

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
Editions and ten exact reviewed Work fallbacks. Eight English Work descriptions
pass the unchanged text policy but remain permission/attribution holds; two are
excluded for text policy. **Zero descriptions are approved and zero database
batches have run.** The six-description usefulness target remains unmet.
The September 20 continuation made no provider request or pilot amendment.
The archived and staged pilot states remain byte-identical, with one prior
review retained. Edition language is distinct from description/original language.

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
A local Metro readiness/manifest/development-bundle probe passed. There is still
no device/emulator result, and no APK was dispatched or polled. See the
[implementation and run commands](sprints/SPRINT-014.md#isolated-native-description-test-companion--2026-09-21--182).
Issue #182 owns exact source PR/head/CI/merge acceptance for
`feat/182-native-description-acceptance`.

### Exact next bounded packet — native display and link acceptance

Exercise the accepted attribution source on a supported device/emulator with a
configured build whose commit is recorded. A build from main does not by itself
include or accept the independent #229 branch. The current workspace has no
native runtime; component tests, exports and server CI are not device evidence.
Do not dispatch or poll an APK to replace this acceptance step.

From a clean accepted checkout on a development machine, run `npm ci`, then
`npm run acceptance:descriptions -- --lan`, and open the companion in a compatible
Expo Go runtime on the same network. The opt-in **Description native acceptance
APK** workflow is available for an explicitly requested standalone Android build;
it is not part of automatic APK dispatch. Its distinct app ID preserves the
installed Kajo application. Detailed commands and evidence limits are in the
Sprint checkpoint above.

Use the companion's isolated synthetic fixtures for rendering/link/accessibility
checks. Personal/Shared/List entry and full-card placement still require a
separate configured application test with isolated catalog/account state; the
companion does not impersonate those contexts. Keep fixtures out of the hosted
catalog and genuine Profile/Event history. Record build/source identity, OS,
device, observations and screenshots for the
[native acceptance matrix](sprints/SPRINT-014.md#native-description-credit-acceptance-matrix).
Required observations cover Personal, Shared and List detail entry; collapsed
and expanded credit; source/license link success and recoverable failure;
screen-reader labels; and absent, unsafe or mismatched-credit fallback. No
native case has yet passed in this continuation. If that runtime is unavailable,
retain this named gate instead of substituting an unrelated UI or provider pass.

After native acceptance, establish exact source/contribution/revision, license,
intended use and changes for any real text before a new review amendment.
The two Wikipedia leads remain candidates, not cleared records. Do not repeat
the completed general licensing search, reset the run or enlarge its budget.

Recover `Kajo-book-description-pilot-v1.zip` and its original claim/state/reviews;
local staging is `dist/catalog-enrichment/book-pilot-v1`. It includes
`rights-audit.json`, the applied `rights-amendment.json` and original state.
A restored operation lock requires the explicit reconciliation recorded in the
Sprint checkpoint. The run is already `reviewed`; a future amendment must bind
the current review hash. The saved applied proposal is historical and must not
be replayed. Never hand-edit status back to `prepared`. Before any approved
description write, refresh row versions and prepare guarded rollback preimages.
Apply uses the configured admin runtime; this workspace has no privileged
importer credential. Do not restart key setup or bypass that boundary.

### Completed MOVIE pass and preserved gates

MOVIE remains complete for its bounded pass. English **259** and Finnish **60**
remain its main offering, **75.1%** together. Keep original language `fi` separate
from Finnish production `FI`, and preserve personalization. Its 18 attempts and
30 charged page slots are exhausted; do not perform another import under it.

#182 / MVP-CAT-001..003 / Phase 14.3 remain open for rights, broader BOOK
descriptions, curated exact mapping, repeatable refresh, normalized feature
quality and native usefulness. Preserve #229/device/fresh-account gates, the
six immutable native forwards and rejected D2 challenger admission. No new APK
dispatch, device test, model admission or unrelated UI work occurred.

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
The remaining reconnect defect is [#240](https://github.com/Kajooja/Kajo/issues/240)
/ MVP-UX-003: recover the same failed request on usable reconnection and remove
stale retry UI after successful recovery. Do not merely hide a failed backend
response because the device says online. The owner explicitly defers this to the
next application UI packet; do not silently substitute it for the named source packet.

The six approved server forwards remain installed through
`20260912134224_atomic_prediction_pages`. Do not deploy them again or repeat the
approval. The 15-second client deadline, exact retry/cancel semantics and all
439 local tests remain recorded in [the native recovery checkpoint](https://github.com/Kajooja/Kajo/blob/feat/228-delivered-origin/docs/project/sprints/SPRINT-014.md#bounded-client-recovery--2026-09-12).
No fresh-account test/reset, new DDL, automatic promotion or full DATA/ALG closure
is implied. Keep #229 draft while its named acceptance gaps remain; E1 is an
independent source packet, not a way to mark those gaps complete.

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

Accepted runtime source at audit start: `6dd1fec` / PR #227 — atomic/durable Item,
List and Shared action foundations. #227 is merged; do not repeat its deployment.
The #233/#234 delivery publishes independent-engine direction and reconciled
product/handoff documentation, plus bounded repository hygiene. It does not
accept #229 runtime, implement a portable engine or train a model.

#229 contains later source work: delivered-slate identity, durable exposure,
multi-List/collection UX, history projection, late outcomes, frozen replay,
eligibility-first admission, identified first pages, private source windows and
protocol-2 atomic continuation and the captured-scope mobile reader.
The branch has source/test/rollout evidence that must remain intact. Its detailed
device and implementation records stay on that branch/PR until accepted; compact
canonical successor contracts in main are explicitly labeled.

The owner-approved #229 hosted rollout completed on 2026-09-12 through
`20260912134224_atomic_prediction_pages`, as recorded in that branch's
[rollout checkpoint](https://github.com/Kajooja/Kajo/blob/feat/228-delivered-origin/docs/project/sprints/SPRINT-014.md#approved-hosted-prediction-rollout--2026-09-12).
All six installed forwards are immutable; do not redeploy, reset, repair historical
migrations or mistake this older accepted-main SQL tree for a new rollout packet.
The separately deferred `20260909131913_close_postgres_function_defaults.sql`
remains its own gate. This independent E1 packet ran no hosted query or mutation.

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
and rejection/fallback decision are complete; continue the named #182 catalog unit. #229 retains native
acceptance and application UI work remains in its separately ordered packet. No large native user
population, production schema or separate network service is needed for D1.

Use ignored `research-data/` and `research-artifacts/` or equivalent controlled
storage. External ratings are source-typed observations, not fake native Events
or fully observed behavioral Scenarios. Public catalog enrichment and a real
user's authorized history import remain separate pipelines. Data download,
normalization, model training, evaluation and artifact admission are distinct
recorded operations. A losing challenger is a valid report; it cannot waive
native usefulness gates or deploy itself.

E1 delivered executable contracts; D1 delivered real research intake; D2 now
fits and evaluates bounded offline models. Fitted artifacts remain research-only
and are rejected for admission in this configuration. No native model integration,
world model, multistep dreamer or automatic promotion is delivered.

## Preserved owner requirements and release order

- #232 is mandatory first-release Shared rating/rewatch behavior: Phase14 supplies
  participant/round evidence and policy; Phase15 supplies Personal Taste/setup;
  Phase16.3 completes joint responses/history and controlled rewatch before beta.
- Multi-destination List selection, final Add without a second Done action,
  always-available unknown Taste response, approximately ten movies then ten books,
  link reveal/copy and device details remain in their canonical product docs.
- #230 private statistics/weekly tracking and #231 multi-select/history trash are
  now required pre-MVP Phase 17.0 work. #239 card controls and #240 reconnect
  recovery join them; FUT-UX-003 joint-list choice remains a separate candidate.
- Then follow ROADMAP: algorithm/catalog/engine foundation → Taste/holdout →
  anonymous web/app + Google/Apple continuity → preview → Friend/safety → explicit
  Shared creation and joint rounds → core UX/telemetry/privacy → complete beta →
  production/stores → owner-accepted Share Link Gate.

The owner reports exercised device flows working, but no exact installed APK
identity/timings were provided for the latest feedback. Empty/fresh-account
acceptance remains untested. Preserve current test history; a future small-group
reset is not an instruction to reset now. Do not dispatch or poll APKs as a
substitute for the next source unit.

## Hygiene and remaining findings

The [2026-09-12 audit](retros/2026-09-12.md) records scope, checks and limits.
Proven-unused catalog hook/wrapper removed; accepted-main migration protection
extends from 47 to 50 exact hashes without changing SQL or the baseline cutoff.
Raw/fitted research paths are ignored before the first dataset operation.
The compatible js-yaml 4.3.2 lockfile patch removes the high advisory. Fresh audit
has no high/critical findings and fifteen moderate package entries across three
advisories; #238 prioritizes the runtime routing decoder before public links and
coordinates build/test-tool updates. Do not apply an incompatible bare override.

Open source findings are assigned to their existing work owners:
#228 configured protocol-2 device/recovery acceptance; #182 catalog breadth/diversity
and metadata expansion after the accepted provider canary; #160 / MVP-OPS-005 production configuration,
password endpoint input/abuse policy and release dependency checks. See the audit
for dependency findings and exact verification; no hosted security conclusion is inferred.

Merged `feat/226-atomic-collection-actions` is byte-equivalent to accepted #227
and safe to retire. Remote branch deletion is unavailable through this session's
supported GitHub capability; do not repeat the completed 145-branch historical
cleanup or remove the active #229 branch. After #234 merge, its documentation
branch can likewise be retired through a supported operation.

Sprint014, full DATA/ALG/ENG acceptance, device gates and public release remain open.
