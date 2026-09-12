# Kajo Current Status

Last updated: **2026-09-12**
Current milestone: **MVP 0.1 — first public Kajo**
Current sprint: **Sprint 014 — algorithm reliability / real catalog / portable engine**
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file owns one exact resumable next task. [ROADMAP](ROADMAP.md) owns order,
[MVP](../product/MVP.md) owns release blockers and [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste/Friend/Shared flow. Read current main first, then the active branch;
an older branch-local handoff cannot replace newer accepted product decisions.

## Current source packet — D2 #237, measured development comparison

**D2 [#237](https://github.com/Kajooja/Kajo/issues/237) is implemented on
`feat/237-movielens-baselines`, based on accepted main `7602b3418354687855f6b3384085684f4b37a373`.**
D1 #236 / PR #242 was merged after all five required CI #475 jobs passed at
`816bf2e6c1437e29f664faef9669729507968209`. E1 #235 / PR #241 is also accepted.
The current D2 source still requires its own five-job CI and merge acceptance.

The owner-authorized GroupLens Latest Small September 2018 / Kaggle v2 source
supplies 500 subjects and 84,849 complete-history ratings. D2 froze source/code/
runtime identity and exact temporal/held-out-subject partitions before fitting:
46,410 train, 9,945 validation, 9,945 regular final ratings, plus 100 fully reserved
subjects. The final held-out-subject slice has 2,149 ratings from thirteen subjects.
Equal-time groups remain intact; metadata with unknown historical availability
is excluded. This is bounded noncommercial development data, not a shared benchmark.

Eight real model/state variants were trained and evaluated through the independent
package's research export. Two independent executions matched fitted parameters,
all predictions, metrics, grouped intervals and decisions. **Challenger admission
is rejected for this configuration**: validation chose recent state, but its RMSE
improvement of 0.001959 missed the predeclared 0.01 gate. Native admission is deferred.
The separately named prequential test improved RMSE from 0.876094 for durable state
to 0.811834 for recent state; these continuously updated-prefix results cannot be
reported as fixed-holdout or native usefulness. Cold-start gains are inconsistent.

[Readable report](../../research/reports/movielens-small-d2.md),
[aggregate evidence](../../research/reports/movielens-small-d2.json) and
[commands](../../research/README.md#d2--reproducible-development-evaluation) own exact
model definitions, source/code/split hashes, support, uncertainty, costs and scope.
The full executions took 6.69/6.72 s; raw histories, subject partitions, predictions
and 8 MB fitted artifacts stay ignored. Absent/invalid/withdrawn real-data probes
returned unavailable with zero native support, without retaining external influence.
Native-only fixture fallback and disallowed/out-of-domain checks also pass.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **357 tests**, lint/typecheck and
both Hermes exports, with the existing mobile Hook warning. No native UI, hosted
SQL, catalog import, APK dispatch or serving model changed. See
[the D2 checkpoint](sprints/SPRINT-014-D2.md). Source acceptance remains distinct
from actual training/evaluation and any future serving admission.

**Next bounded source task after D2's current-head CI/merge: #182 catalog Edge
entrypoint/configuration verification, from the then-current accepted main.**
Phase14.3 permits this independent source work while #229 retains native acceptance:
verify the catalog import gateway JWT/server-key boundary, pin reproducible Edge
imports and test anonymous/ordinary-user rejection plus authorized requests.
Close that source-audit gap before provider catalog expansion. Hosted configuration,
provider credentials and actual imports remain separately recorded operations.
Keep #229's source/rollout ledger and remaining device/fresh-account gates intact.
Do not replace this continuation with unchanged 32M retries, optional D3/D4/D5
studies or automatic deployment of the rejected model. #240 and the other owner UI
ideas remain in their ordered pre-MVP application packet.

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

E1 and D1 are accepted through #241/#242. D2 now has its reproducible measured
development report and rejection/fallback decision; finish its current-head source
acceptance, then continue the named #182 source-audit unit. #229 retains native
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
#228 configured protocol-2 device/recovery acceptance; #182 Edge catalog configuration
and dependency/entrypoint verification; #160 / MVP-OPS-005 production configuration,
password endpoint input/abuse policy and release dependency checks. See the audit
for dependency findings and exact verification; no hosted security conclusion is inferred.

Merged `feat/226-atomic-collection-actions` is byte-equivalent to accepted #227
and safe to retire. Remote branch deletion is unavailable through this session's
supported GitHub capability; do not repeat the completed 145-branch historical
cleanup or remove the active #229 branch. After #234 merge, its documentation
branch can likewise be retired through a supported operation.

Sprint014, full DATA/ALG/ENG acceptance, device gates and public release remain open.
