# Kajo Current Status

Last updated: **2026-09-20**
Current milestone: **MVP 0.1 — first public Kajo**
Current sprint: **Sprint 014 — algorithm reliability / real catalog / portable engine**
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file owns one exact resumable next task. [ROADMAP](ROADMAP.md) owns order,
[MVP](../product/MVP.md) owns release blockers and [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste/Friend/Shared flow. Read current main first, then the active branch;
an older branch-local handoff cannot replace newer accepted product decisions.

## Current packet — #182 structured description attribution

Source [PR #254](https://github.com/Kajooja/Kajo/pull/254) is accepted on main
`dce94df96e965f26810c979cf8af550d551c8597` after all five required CI #501 gates.
The exact catalog-only description migration is now installed and verified.
**Do not deploy it again**, recreate its implementation branch, redeploy
catalog-import v12 or replay the six installed native forwards. Source/hosted
version mapping and exact checks remain in the owner's controlled checkpoint;
the accepted source filename/bytes are unchanged.

Accepted [PR #255](https://github.com/Kajooja/Kajo/pull/255) records the
[rollout and actual text review](sprints/SPRINT-014.md#book-rollout-and-description-review--2026-09-17--182).
The owner explicitly authorized this public documentation and issue update on
2026-09-17, resolving the earlier publication approval block.
[Issue #182](https://github.com/Kajooja/Kajo/issues/182) records the exact
publication PR/head/CI/merge outcome. [PR #256](https://github.com/Kajooja/Kajo/pull/256)
is accepted on main `1d8ed155bc39a0d543df27ca4d68006910f7f755` after all five
required CI #505 gates. It adds an offline review-amendment command and records the
[cached rights audit](sprints/SPRINT-014.md#cached-book-rights-audit-and-review-amendment--2026-09-19--182).
Branch `feat/182-description-attribution` starts from that accepted main and
implements the review → guarded writer → Item/catalog/Shared/List → detail
attribution contract with synthetic fixtures. Issue #182 owns its exact PR/head/
required CI/merge outcome; [Sprint 014](sprints/SPRINT-014.md#structured-description-attribution--2026-09-20--182)
records delivered source and validation limits. Private source records remain
in the unchanged controlled checkpoint; rollout preparation is separate.

**Recovery checkpoint, 2026-09-20:** the runtime implementation is preserved in
local commit `89371e094c8259c9bce73719c35e73b583dbfd0b`. Fresh GitHub/ref checks
found **no remote attribution branch or PR**, contrary to the interrupted chat's
publication claim. Accepted main remains `1d8ed155bc39a0d543df27ca4d68006910f7f755`.
Automatic approval review rejected the branch push because it classified the
current continuation request as insufficient authorization to publish this
source packet to public `Kajooja/Kajo`. No alternate publication route was tried.
The owner explicitly approved publication to public `Kajooja/Kajo`, PR creation
and merge after passing CI on 2026-09-20, and requested immediate continuation
afterward. The publication block is resolved and [PR #257](https://github.com/Kajooja/Kajo/pull/257)
is open. Initial CI #507 passed four gates but found a non-JSON setup row in the
native attribution upgrade fixture. Setup now performs its write silently, and
the local database regression asserts that only the final snapshot is emitted.
The regression failed before the fix and passes afterward; migration/runtime
bytes are unchanged. Verify all five required gates on the final PR head before
merge, then continue the bounded rollout below. Issue #182 owns exact acceptance.

### Verified result — 2026-09-17

Exact function/ACL/history readback and an anonymous HTTP permission-denial probe
passed. All unrelated function/trigger/default metadata and the entire catalog
comparison stayed unchanged: BOOK **415 visible / 427 stored / 385 images / zero
descriptions**; MOVIE **425 / 437 / 425 images and descriptions**. All ten fixed
pilot identities and row versions match; zero discoverable mocks.

The frozen preview used **all twenty allowed provider attempts**: ten Editions,
then ten reviewed exact Work fallbacks. All twenty records matched identity;
there were no retries, redirects, substitutions or database batches. Nine
Editions have no description; one Finnish description contains a source URL.
Eight Work descriptions pass the unchanged text rules, all in English; two
contain disallowed markup/link characters. Edition language remains distinct
from description/original language.

Actual review approved **zero display writes**: eight permission/attribution
holds and two text-policy exclusions. The accepted CLI saved a reviewed packet
with zero entries and ten skips. **The six-description usefulness target was
not met.** No empty apply batches were sent. Do not label text eligibility as
rights clearance or claim a completed description import.

### Cached audit result — 2026-09-19

All twenty saved records and the original zero-entry review were retained.
The source-specific audit distinguishes publisher overlap, partial historical
Wikipedia matches and unconfirmed origins; no exact usable permission chain
was established. Eight rights holds and two text-policy exclusions remain.
The audit found missing Item/catalog/detail support for visible source/license/
modification information. The September 20 source packet closes that structural
gap; it does not establish an exact permission chain for any real paragraph.

The tested `amend-review` command recorded the new skip reasons in the same run:
one retained prior review, twenty unchanged attempts, zero approved entries and
zero database batches. It rejects stale parent hashes, invalid records/history,
failed runs and any prior write attempt. No new provider records or hosted
queries/writes occurred; the catalog figures above remain the September 17
verified baseline, not a fresh September 19 inventory.

### Delivered source and exact next bounded packet

`@kajo/catalog-contracts` supplies hash-bound, bounded public credit. V2 review/
persistence bind private permission evidence to the same text/record/credit;
legacy checkpoints remain reproducible. Canonical Item enrichment and the detail
boundary hide managed text if required credit is missing, unsafe or mismatched.
Source/license links and changes stay visible when the description is collapsed.
Explicit legacy compatibility preserves existing unannotated catalog content.
The complete local `npm run check` passed **430 tests**, lint/typechecks and both
iOS/Android bundle smokes. Native visual/link behavior remains untested here.

After source publication and CI/merge acceptance, continue the **new catalog-only
attribution forward rollout and native display acceptance**, following the
[contract](../architecture/ARCHITECTURE.md#description-attribution--contract-182).
Source file `20260920000607_description_attribution.sql`, SHA-256
`57af455775f7f43d7cfe81fc8af887128358c3c3e056f785b4cbb3545bfab043`, is **not
installed**. Read-only recovery preflight at **2026-09-20 19:32 UTC** matched all
four hosted catalog function definitions, owners, ACLs and settings to accepted
source and confirmed the new validator is absent. Catalog counts remain BOOK
415 visible / 427 stored / 385 images / zero descriptions and MOVIE
425 visible / 437 stored / 425 images and descriptions; no managed descriptions
or discoverable mocks exist. An isolated PGlite rehearsal passed the exact new
forward and a guarded restoration of the two prior writers; catalog/function
snapshots matched afterward and repeat rollback was rejected. This is preparation,
not native/hosted rollout acceptance. Refresh the target/history/functions/ACLs
and preserve all catalog rows before the separate admin rollout; do not replay the installed v1
forward or six native forwards. Validate collapsed/expanded credit, links and
fallbacks on a supported native runtime before accepting display behavior.
The recovery ran read-only hosted checks and repeated the complete local check
successfully (430 tests and both exports). No hosted write, provider request,
pilot amendment, APK dispatch or device test occurred; the prior pilot checkpoint
and its saved state remain byte-identical.

Exact source/revision, applicable license, intended use and changes still require
evidence before any real text is approved. The two Wikipedia leads remain
candidates, not cleared records. Do not repeat the completed general licensing
search, reset the pilot or enlarge its provider budget. Preserve independent
#229 reader/delivery/native gates; this packet changes no Prediction/Event trace.

Recover `Kajo-book-description-pilot-v1.zip` and its original claim/state/reviews;
local staging is `dist/catalog-enrichment/book-pilot-v1`. It now also contains
`rights-audit.json`, the applied `rights-amendment.json` and the original state.
Never reset the spent budget or repeat the provider preview. A restored operation
lock requires the explicit reconciliation recorded in the Sprint checkpoint.
The run is already `reviewed`; future amendments require a new proposal bound
to the current review hash. The saved applied proposal is historical evidence
and deliberately fails if replayed. Never hand-edit the status back to `prepared`.
Refresh SQL versions and prepare guarded rollback preimages before any approved
write. Actual apply uses the configured admin runtime; this workspace has no
privileged runtime credential. Do not restart key setup or bypass the boundary.

### Completed MOVIE pass and preserved gates

MOVIE remains complete for its bounded pass. English **259** and Finnish **60**
remain its main offering, **75.1%** together. Keep original language `fi` separate
from Finnish production `FI`, and preserve personalization. Its 18 attempts and
30 charged page slots are exhausted; do not perform another import under it.

#182 / MVP-CAT-001..003 / Phase14.3 remain open for rights/attribution, broader
BOOK descriptions, curated exact mapping, repeatable refresh, normalized feature
quality and native usefulness. Preserve independent #229/device/fresh-account
gates, six immutable native forwards and rejected D2 challenger admission.
No device test, APK dispatch, model admission or unrelated UI work occurred.

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
