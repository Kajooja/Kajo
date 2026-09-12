# Kajo Current Status

Last updated: **2026-09-12**
Current milestone: **MVP 0.1 — first public Kajo**
Current sprint: **Sprint 014 — algorithm reliability / real catalog / portable engine**
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory**

This file owns one exact resumable next task. [ROADMAP](ROADMAP.md) owns order,
[MVP](../product/MVP.md) owns release blockers and [LAUNCH_LOOP](../product/LAUNCH_LOOP.md)
owns the Taste/Friend/Shared flow. Read current main first, then the active branch;
an older branch-local handoff cannot replace newer accepted product decisions.

## Primary next packet — #228 / draft PR #229

**When the owner says “jatketaan reposta”, continue the reviewed six-forward
deployment in [PR #229](https://github.com/Kajooja/Kajo/pull/229), branch
`feat/228-delivered-origin`, after checking the current head's five required CI
jobs and the owner's applicable hosted-deployment approval.** The exact target,
hashes, preservation checks and partial-failure procedure are in
[the rollout checkpoint](sprints/SPRINT-014.md#hosted-prediction-preflight-and-compatibility--2026-09-12).
Preparation is complete; hosted writes have not been performed. Refresh refs first.
The accepted #233/#234 engine direction is reconciled.
Do not merge the unfinished packet or silently switch to E1.

The server-page baseline `0a184a71320621c5bd31c72f70ff18acf786acc8` passed all five
jobs in [CI #464](https://github.com/Kajooja/Kajo/actions/runs/34691537142), including
native concurrent retries/cursor consumption/window capacity and populated
pre-window upgrades. Its earlier float-format probe failure is resolved.

The subsequent client source now uses numeric protocol 2 through
`rank_items_page_v1`. Its focus-aware reader captures environment, actor, Profile,
session, domain, mode, limit and evidence revision; refresh replaces the view,
transport retry retains the original request, and each appended Item retains its
actual page PredictionRun. Stale replies/catalog enrichment and prior native list
callbacks cannot populate a different view. Detail keeps its clicked immutable
slate. The obsolete unscoped Item cache and unused row-RPC client were removed;
protocol-1 envelope compatibility and the shared row mapper remain tested.

The client head `8a1936c69e8f2dd2f0bd5b770177dcfb50aee9de` passed all five jobs in
[CI #465](https://github.com/Kajooja/Kajo/actions/runs/34693634630).
The following hosted preflight reproduced a real deployment blocker: the late
Outcome/replay patches did not accept the installed compact evaluation/worker
bodies. The two still-undeployed files now accept only those exact reviewed
SHA-256 identities and use the corresponding canonical body before their guarded
feature patches. Unknown variants still fail and roll back. The other four SQL
files and all deployed history remain unchanged.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **421 tests** (338 mobile,
14 catalog, 69 database), lint/TypeScript and both platform exports. The new
compact-source populated-upgrade/page-runtime probe also joins required native
CLI CI. The current published head must pass all five jobs before deployment.

This configured client requires all six forwards below. Against the recorded
older hosted checkpoint it reports a request error; it cannot silently fall back
to mocks or an unidentified row response. Do not install this client as a working
hosted version before the exact rollout is verified. Source/CI alone do not close
device, empty-account or full DATA/ALG acceptance. Detailed source/test evidence
is in [the client checkpoint](sprints/SPRINT-014.md#captured-scope-mobile-pages--2026-09-12).

Next bounded unit:

1. Confirm the owner has authorized these six reviewed forwards on existing Kajo
   `mwrnvfosrzwygrunrltm`. The latest continuation authorized preparation; the
   requested hosted deployment approval must name this target and SQL packet.
2. Refresh the read-only target/version/name, five affected function fingerprints,
   table/trigger/default metadata and current-head CI. Use the revised six hashes
   in the rollout checkpoint and the exact isolated populated-forward rehearsal.
   Do not apply a fresh baseline, whole historical `db push`, reset or name-only
   tracking repair to an existing database.
3. Perform only the reviewed forwards under the owner's applicable authorization,
   preserving unrelated data/ACLs and recording actual deployment identities and
   post-deployment checks. The separate global privilege-default forward remains
   outside this packet.
4. After target readiness, record the exact configured client build and exercise
   first-page/append/empty/error/expired-cursor recovery, fast Profile/account/
   session changes, mixed-page grid/detail/actions, restart/reconnect and durable
   exposure ordering. Follow the appended DEVICE_TEST checklist. No APK dispatch
   or polling substitutes for the rollout; retain the owner's fresh-account
   testing constraint without resetting current data.
5. Record acceptance and the next ROADMAP task. E1 → D1 → D2 remains the independent
   engine sequence; if selected while runtime/device work waits, record the switch
   here so there is one explicit current source task.

The reader starts a fresh request's context only when its focused fetch begins.
Background detail feedback therefore does not open repeated unused windows. The
600 ms delay applies to subsequent evidence-driven fetches; first scope entry and
explicit refresh remain immediate. Window expiry/cap are server bounds, not
client permission to discard evidence or claim whole-catalog exhaustion.

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

Read-only hosted preflight on 2026-09-12 confirmed Kajo `mwrnvfosrzwygrunrltm`,
PostgreSQL 17.6, 50 migration version/name rows ending at
`20260910190243_shared_list_destinations`, 138 public/private functions, 33 table
definition fingerprints, 25 application/Auth-user triggers, seven event triggers
and 24 creator-default entries. No application/Auth rows or row-derived hashes
were exported. No hosted schema/data/history mutation was performed.
Six later source forwards remain **undeployed**, in this exact dependency order:

1. `20260910192630_late_outcome_attribution.sql`
2. `20260910202244_frozen_prediction_replay.sql`
3. `20260910210520_eligibility_first_candidate_pool.sql`
4. `20260911070959_identified_prediction_page.sql`
5. `20260911074543_prediction_continuation_windows.sql`
6. `20260912105528_atomic_prediction_pages.sql`

Use exact branch source, hashes and ADR-0006's existing-database forward procedure
before rollout. Never run whole historical `db push` or reset to reconcile main
and hosted. The separately deferred privilege-default forward
`20260909131913_close_postgres_function_defaults.sql` remains a separate gate.

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
| [E1 #235](https://github.com/Kajooja/Kajo/issues/235) | Runnable generic contracts + Kajo/media and synthetic non-media fixtures; workspace/exports/root CI integration | Accepted design; default follows current #229 packet |
| [D1 #236](https://github.com/Kajooja/Kajo/issues/236) | Isolated manifest, MovieLens adapter and actual reproducible small real-data cohort | E1 contract acceptance |
| [D2 #237](https://github.com/Kajooja/Kajo/issues/237) | Train-only temporal/cold-start baselines and bounded static-state vs trajectory experiment/report | D1 normalized data |
| D3 / D4 / D5 | Optional Tag Genome / Beliefs / KuaiRand studies | D2 plus each source's own manifest/rights/task; independent of each other |
| E2 | One admitted component behind existing serving boundary | Relevant native 14.1/14.2 gates + rights/quality/compatibility/fallback/rollback |

E1/D1/D2 can run as a separately selected isolated source/research packet while
native rollout/device gates wait. Record the switch here first; their availability
does not make the default #229 continuation ambiguous. No large native user
population, production schema or separate network service is needed for D1.

Use ignored `research-data/` and `research-artifacts/` or equivalent controlled
storage. External ratings are source-typed observations, not fake native Events
or fully observed behavioral Scenarios. Public catalog enrichment and a real
user's authorized history import remain separate pipelines. Data download,
normalization, model training, evaluation and artifact admission are distinct
recorded operations. A losing challenger is a valid report; it cannot waive
native usefulness gates or deploy itself.

No engine package, dataset ingestion, trained representation, world model,
multistep dreamer or automatic promotion is delivered by this audit.

## Preserved owner requirements and release order

- #232 is mandatory first-release Shared rating/rewatch behavior: Phase14 supplies
  participant/round evidence and policy; Phase15 supplies Personal Taste/setup;
  Phase16.3 completes joint responses/history and controlled rewatch before beta.
- Multi-destination List selection, final Add without a second Done action,
  always-available unknown Taste response, approximately ten movies then ten books,
  link reveal/copy and device details remain in their canonical product docs.
- #230 statistics, #231 multi-select/history trash and joint-list choice are later
  scoped candidates in FUTURE_PLAN, not automatic new MVP blockers.
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
#228 exact protocol-2 rollout and configured-device acceptance; #182 Edge catalog configuration
and dependency/entrypoint verification; #160 / MVP-OPS-005 production configuration,
password endpoint input/abuse policy and release dependency checks. See the audit
for dependency findings and exact verification; no hosted security conclusion is inferred.

Merged `feat/226-atomic-collection-actions` is byte-equivalent to accepted #227
and safe to retire. Remote branch deletion is unavailable through this session's
supported GitHub capability; do not repeat the completed 145-branch historical
cleanup or remove the active #229 branch. After #234 merge, its documentation
branch can likewise be retired through a supported operation.

Sprint014, full DATA/ALG/ENG acceptance, device gates and public release remain open.
