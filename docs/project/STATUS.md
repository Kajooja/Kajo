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

**When the owner says “jatketaan reposta”, continue configured-client recovery
and device acceptance in [PR #229](https://github.com/Kajooja/Kajo/pull/229), branch
`feat/228-delivered-origin`.** Refresh refs and check the current head's five
required CI jobs first. The owner approved the exact six-forward packet and all
six were installed and verified on Kajo `mwrnvfosrzwygrunrltm` on 2026-09-12.
Do not repeat this deployment or ask for the same approval again. Actual versions,
unchanged SQL hashes and preservation evidence are in
[the completed rollout](sprints/SPRINT-014.md#approved-hosted-prediction-rollout--2026-09-12).
The accepted #233/#234 engine direction is reconciled.
Do not merge the unfinished packet or silently switch to E1.

Resume baseline `7d47e44bb55ee7c5e5544fa92b0bcdc6f44a2401` passed all five required
jobs in [CI #467](https://github.com/Kajooja/Kajo/actions/runs/34697784410).
The client recovery follow-up reproduces and fixes a never-settling page load:
each active first/next attempt now has a 15-second deadline across RPC and catalog
enrichment, and scope/focus changes abort it. Transport retry keeps the exact
request; proven unusable cursors require explicit fresh search, while the window
cap asks the user to wait and retry. Late replies cannot change accepted pages.
Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **439 tests** (356 mobile,
14 catalog, 69 database), lint/TypeScript and both Hermes exports. Published-head
CI remains a separate gate; see the current PR and
[the recovery checkpoint](sprints/SPRINT-014.md#bounded-client-recovery--2026-09-12).
A read-only history query reconfirmed all six installed versions through
`20260912134224_atomic_prediction_pages`; no hosted write ran in this follow-up.

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
bodies. The two forwards accept only those exact reviewed
SHA-256 identities and use the corresponding canonical body before their guarded
feature patches. Unknown variants still fail and roll back. The other four SQL
files were unchanged; all six SQL bodies are now deployed and immutable.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **421 tests** (338 mobile,
14 catalog, 69 database), lint/TypeScript and both platform exports. The new
compact-source populated-upgrade/page-runtime probe also joins required native
CLI CI. Approved deployment source `78217135897cbfe10c85a0b6610989272bdc87c8`
passed all five jobs in [CI #466](https://github.com/Kajooja/Kajo/actions/runs/34695947055),
including the native compact-source populated-upgrade/page-runtime probe.

The target now supplies the complete six-forward protocol-2 server contract.
The configured client still requires its exact build and device checks; it cannot
silently fall back to mocks or an unidentified row response. Source/CI and verified
hosted DDL do not close device, empty-account or full DATA/ALG acceptance. Detailed
source/test evidence
is in [the client checkpoint](sprints/SPRINT-014.md#captured-scope-mobile-pages--2026-09-12).

Next bounded unit:

1. Confirm current branch/head, required CI and the completed server checkpoint
   `20260912134224_atomic_prediction_pages`. No further hosted migration is queued
   in this packet. The global privilege-default forward remains a separate gate.
2. Record the exact configured client build and exercise
   first-page/append/empty/error/expired-cursor recovery, including the new
   15-second stalled-request and cancel/retry cases, fast Profile/account/
   session changes, mixed-page grid/detail/actions, restart/reconnect and durable
   exposure ordering. Follow the appended DEVICE_TEST checklist. No APK dispatch
   or polling substitutes for device evidence; retain the owner's fresh-account
   testing constraint without resetting current data.
3. Record the actual device/runtime results and any concrete recovery defect in
   DEVICE_TEST and Sprint014. This workspace has no native emulator/adb or React
   Native web renderer, so it has no new device acceptance. Do not repeat source
   tests or poll builds as a substitute for missing runtime evidence.
4. Record acceptance and the next ROADMAP task. E1 → D1 → D2 remains the independent
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

Approved hosted rollout on 2026-09-12 completed on Kajo `mwrnvfosrzwygrunrltm`,
PostgreSQL 17.6. Tracking now has **56** version/name rows, **150** public/private
functions and **37** application tables. All prior 50 history rows, 138 function
identities/owners/ACLs and 25 application/Auth-user triggers are preserved. The
new immutable-page-context trigger brings the trigger count to 26. Seven event
triggers and 24 creator-default entries are unchanged. All old table fingerprints
match after accounting for the one reviewed shadow-count constraint; the four
new private tables have RLS and deny direct reads to API roles. Anonymous and
missing-actor page calls reject with `42501` in a read-only rolled-back probe.
No application/Auth rows or row-derived counts/hashes were exported. Populated
data preservation is independently tested in isolation, not inferred from a live
row comparison. No reset, historical repair or global-default migration ran.
The installed files are now aligned with the actual provider versions:

1. `20260912133402_late_outcome_attribution.sql`
2. `20260912133832_frozen_prediction_replay.sql`
3. `20260912133941_eligibility_first_candidate_pool.sql`
4. `20260912134056_identified_prediction_page.sql`
5. `20260912134141_prediction_continuation_windows.sql`
6. `20260912134224_atomic_prediction_pages.sql`

These SQL bytes are immutable. Use a new reviewed forward for any later change;
never run whole historical `db push` or reset to reconcile main and hosted.
The separately deferred privilege-default forward
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
