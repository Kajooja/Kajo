# Kajo Current Status

Last updated: **2026-09-14**
Current milestone: **MVP 0.1 — first public Kajo**
Current sprint: **Sprint 014 — algorithm reliability / real catalog / portable engine**
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file owns one exact resumable next task. [ROADMAP](ROADMAP.md) owns order,
[MVP](../product/MVP.md) owns release blockers and [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste/Friend/Shared flow. Read current main first, then the active branch;
an older branch-local handoff cannot replace newer accepted product decisions.

## Current packet — #182 BOOK description refresh implementation

The diagnostic packet is accepted through [PR #252](https://github.com/Kajooja/Kajo/pull/252),
main `f8ed71db6186ee9f810d985462119cf7085e1f08`. Catalog-import is ACTIVE **v12**;
exact five-file readback and unchanged 425-movie coverage are recorded in
[Issue #182](https://github.com/Kajooja/Kajo/issues/182). Do not recreate its branch,
repeat its CI/deploy, or reproduce the older science-fiction failure.

Planning [PR #253](https://github.com/Kajooja/Kajo/pull/253) is accepted at
`1ea3a8c64beff8571bde4dc39cf73c30fc68b944`. It defines
[the guarded description contract](../architecture/ARCHITECTURE.md#book-description-enrichment--guarded-contract-182)
and [fixed ten-Item pilot](sprints/SPRINT-014.md#book-description-plan--2026-09-13--182).
Branch `feat/182-book-description-refresh` implements strict normalization,
provider-only Edition preview and reviewed Work fallback, explicit text/rights
review, two guarded atomic batches and mandatory SQL readback between them.
The forward `20260914060616_book_description_refresh.sql` adds narrow Item/batch
overloads and blocks destructive legacy refresh of managed descriptions. It does
not change deployed history or run a backfill. [The implementation checkpoint](sprints/SPRINT-014.md#book-description-implementation--2026-09-14--182)
records commands, test boundaries and recovery. Issue #182 owns the exact
subsequent PR/CI/merge outcome; consult it before resuming an older branch.

**Next bounded work after source acceptance:** review and roll out only this
catalog forward, compare its function signatures/ACLs and the fixed SQL baseline,
then collect the frozen no-write Edition preview. Review actual text language,
fitness and permission; fetch only explicitly selected Work fallbacks within the
same twenty-attempt cap. Prepare guarded rollback preimages before any display
write. Apply reviewed positions 1–5, verify their SQL readback, then separately
apply/verify positions 6–10. The actual preview, hosted migration and pilot remain
unperformed in this source packet. Do not reimplement the accepted source or
send a description patch through the legacy one-argument batch.

### Verified BOOK checkpoint — 2026-09-14

The updated read-only `scripts/catalog/book-description-coverage.sql` at
**2026-09-14T06:34:32.501146+00:00** confirms the 2026-09-13 baseline:
**415 discoverable / 427 stored BOOK Items**, 385 covers and zero descriptions.
All 385 provider Items have exactly one matching Work alias/mirror and a selected
Edition. Their saved Search payloads contain no descriptions; the adapter
explicitly sets null. The 30 curated books have only Kajo aliases and require a
separate exact identity review. Selected Edition languages include eng 336 and
fin 39; these are not description/original languages, and all 385 provider
original-language values remain unknown.

The frozen pilot contains five fin and five eng selected Editions, at most twenty
sequential provider GET attempts and two reviewed atomic batches of five. All ten
canonical identities pass the SQL check. No candidate provider calls or writes
were made during planning or implementation. The query retains fixed identities for before/after
comparison and fingerprints unchanged book fields, movies, aliases and sources.
Rights/fitness/language review precedes display writes. Subsequent broad
enrichment uses pinned Work/Edition dumps rather than hundreds of API requests.

### Completed MOVIE pass and preserved gates

MOVIE remains **425 discoverable / 437 stored**, all with complete TMDB core
metadata, images and descriptions; all eight expansion targets and all 30
original curated identities passed. English **259** and Finnish **60** are the
main offering, **75.1%** together; other languages complement them. Keep original
language `fi` separate from Finnish production `FI`, and preserve personalization.

The finished pass used 18 request attempts / 28 verified page fetches plus two
reserved failed-science-fiction slots, consuming its 30-page cap. The Korean
repeat, deferred Spanish and unresolved science-fiction cause remain in #182.
Do not perform more MOVIE imports under that plan or repeat configured-key setup.

#182 / MVP-CAT-001..003 / Phase14.3 remain open for BOOK metadata, repeatable
refresh, rights/attribution, normalized feature quality and native usefulness.
Preserve #229's native/device/fresh-account gates, the six installed immutable
forwards, and accepted E1/D1/D2 with rejected challenger admission. This source
packet creates a catalog migration but performs no hosted deployment, provider
run, description write, APK dispatch or unrelated UI work.

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
