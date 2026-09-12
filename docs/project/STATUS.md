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

**When the owner says “jatketaan reposta”, continue the captured-scope protocol-2
mobile reader in [PR #229](https://github.com/Kajooja/Kajo/pull/229), branch
`feat/228-delivered-origin`, after checking the current head's five required CI
jobs.** Refresh refs first. The accepted #233/#234 engine direction is reconciled;
do not replace it with an older whole branch document or silently switch to E1.

Resume baseline `e0eacb52ddee3a45cefad20568db4c7f97c1e700` passed all five jobs in
[CI #462](https://github.com/Kajooja/Kajo/actions/runs/34688660328). The subsequent
`20260912105528_atomic_prediction_pages.sql` source adds opt-in protocol 2 to
`rank_items_page_v1`: atomic independent pages, exact cursor/request receipts,
current eligibility, once-only seen state and frozen observed-prefix replay.
Protocol 1 and historical first-page receipts remain unchanged. The mobile
validator is still protocol 1 and the live reader still uses the legacy row RPC.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **378 tests** (296 mobile,
14 catalog, 68 database), lint/TypeScript and both platform exports. The focused
page regression also verifies rating-zero attribution and mature page evaluation.
The CLI CI runner adds populated pre-window receipt upgrades and real observed-lock
races for exact retry, competing cursor use and the concurrent 16-window cap.
Inspect those jobs on the published head; test definitions/local PGlite alone are
not native concurrency acceptance. Current source and detailed evidence are in
[the sprint checkpoint](sprints/SPRINT-014.md#atomic-next-page-source--2026-09-12).

Next bounded unit:

1. Read the protocol-2 contract in PREDICTION_MODEL and actual RPC source. Update
   `predictionPageOperations.ts` with immutable first/next requests and validation
   of version 2, opaque cursor, page/source identity, availability and unique ranks.
   Preserve protocol-1/legacy compatibility where still required.
2. Bind visible cache, readiness and append to environment, actor, Profile,
   session, domain, mode and request/revision. A failed or stale response cannot
   expose another session's cached run. Test rapid A → B → A, changed sessions,
   delayed/error replies and retry without changing a request/cursor payload.
3. Carry each Item's actual page PredictionRun through grid/detail/swipe/exposure
   and durable actions. Detail keeps its captured slate; appending a new page
   cannot relabel old Items with the newest page's run.
4. Distinguish initial loading/error, true empty domain and exhausted bounded
   window. A next cursor represents remaining source candidates, not a promise
   that every candidate is currently eligible; a terminal empty page is valid.
5. Verify source/CI first, then separately review the exact six-forward rollout
   and complete configured-device/restart/reconnect/account-switch acceptance.

Protocol 1 retains `continuationSupported: false`. Verified protocol 2 reports
true and serves bounded cursors; client activation must use that complete
contract. The raw private cache is never a deliverable page. Sprint014, full
DATA/ALG acceptance, hosted deployment and device gates remain open.

## Accepted source, active branch and recorded hosted state

Accepted runtime source at audit start: `6dd1fec` / PR #227 — atomic/durable Item,
List and Shared action foundations. #227 is merged; do not repeat its deployment.
The #233/#234 delivery publishes independent-engine direction and reconciled
product/handoff documentation, plus bounded repository hygiene. It does not
accept #229 runtime, implement a portable engine or train a model.

#229 contains later source work: delivered-slate identity, durable exposure,
multi-List/collection UX, history projection, late outcomes, frozen replay,
eligibility-first admission, identified first pages, private source windows and
protocol-2 atomic continuation.
The branch has source/test/rollout evidence that must remain intact. Its detailed
device and implementation records stay on that branch/PR until accepted; compact
canonical successor contracts in main are explicitly labeled.

Recorded hosted checkpoint from #229: `20260910190243_shared_list_destinations`.
This audit did not query or change hosted state. Six later source forwards remain
recorded as **undeployed**, in this exact dependency order:

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
#228 captured-session protocol-2 reader and current native acceptance; #182 Edge catalog configuration
and dependency/entrypoint verification; #160 / MVP-OPS-005 production configuration,
password endpoint input/abuse policy and release dependency checks. See the audit
for dependency findings and exact verification; no hosted security conclusion is inferred.

Merged `feat/226-atomic-collection-actions` is byte-equivalent to accepted #227
and safe to retire. Remote branch deletion is unavailable through this session's
supported GitHub capability; do not repeat the completed 145-branch historical
cleanup or remove the active #229 branch. After #234 merge, its documentation
branch can likewise be retired through a supported operation.

Sprint014, full DATA/ALG/ENG acceptance, device gates and public release remain open.
