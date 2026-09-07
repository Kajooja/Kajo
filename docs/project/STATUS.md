# Kajo Current Status

Last updated: **2026-09-07**
Current milestone: **MVP 0.1 — complete non-commercial store release**  
Current sprint: **Sprint 014 — Real Catalog, Profile Bootstrap & External Beta** (`sprints/SPRINT-014.md`)  
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory** (`sprints/SPRINT-013.md`)

This file is the authoritative current-state handoff. Detailed implementation history belongs in sprint files and merged PRs; `ROADMAP.md` owns sequencing.

## MVP meaning

MVP 0.1 is the first complete BOOK/MOVIE Kajo that can be installed from Google Play and/or the Apple App Store. A mock-data or developer-assisted build does not complete the milestone.

Before MVP 0.1 may close:

- normal BOOK/MOVIE discovery uses useful real provider-backed content,
- a new PersonalProfile becomes useful in the first session through import or bounded real-catalog profiling,
- PersonalProfile and SharedProfile core flows pass end-to-end on real devices,
- roughly 10 external testers can use the product without developer setup,
- production auth/security/privacy/support/signing/store requirements pass,
- the installed store build is accepted by the product owner.

## Current product truth

Already accepted or materially complete:

- illustrated 2D Room, global `DiscoveryMode`, Personal/Shared theme identity and persistent shell,
- BOOK/MOVIE discovery/detail/swipe/rating/not-interested/save/undo foundations,
- PersonalProfile + consent-based SharedProfiles, Endorsement consensus, named Lists and Profile messaging foundations,
- hosted Prediction V1 state/ScenarioMemory/trace foundations; ordered WorkingState, bootstrap serving and end-to-end trace reliability require the completion work below,
- controlled SleepLayer / PredictorGenome persistence and evaluation architecture; sustained worker operation and current serving/shadow parity remain unaccepted, with automatic production promotion disabled for MVP,
- reacted-Item suppression and bounded saved-item resurfacing,
- generic provider-backed Item catalog architecture; normal hosted delivery no longer uses discoverable `KAJO_MOCK` Items,
- PersonalProfile history-import backend/parser/Settings flow,
- bounded no-import `cold-start-v1` calibration using real catalog Items,
- SharedProfile common-fit v1.1 inside the same canonical Prediction V1 path.

Canonical architecture remains generic:

```text
User acts inside Profile
Profile -> Memory/Prediction/Lists/messages
Prediction targets Profile
recommendable content = Item + ItemType
provider data -> normalized canonical Item
```

Do not create media-specific Profile, List or recommender cores.

## Real catalog truth — verified 2026-09-06

Hosted `public.items` currently contains:

| ItemType | Discoverable | With image | With nonblank description |
|---|---:|---:|---:|
| BOOK | **415** | **385** | **0** |
| MOVIE | **30** | **0** | **0** |

BOOK beta inventory is 385 Open Library provider Items plus 30 curated real BOOK seed Items. Historical mock Items remain stored for referential integrity but are non-discoverable.

MOVIE poster rendering is already generic in mobile, but there are currently **zero hosted MOVIE image URLs**. This is a catalog-data gap, not a mobile rendering fallback. The next canonical fix is to configure server-only `TMDB_READ_ACCESS_TOKEN` for the existing hosted TMDB importer and expand MOVIE provider coverage with real posters/descriptions. Do not add scraping or an unofficial image source.

## Latest implementation and validation

- PR #202 is merged at `0cf8a9f1ba962e81c58e128951d8a8b9fa018eed`; standalone Android run **#350** passed and is the current owner device-test baseline. #199 implementation is complete; device acceptance is pending.
- PR #205 / #204 is merged at `41c537eb568e679685fe26f440ae85664a4a0c0c`. `npm run catalog:tmdb-beta` orchestrates 15 pages in five sequential requests of at most three pages. This does not prove a hosted import has run.
- Main run **#352** ([run](https://github.com/Kajooja/Kajo/actions/runs/34049794368)) was freshly checked on 2026-09-07: CI and standalone APK completed successfully. Artifact `kajo-android-standalone-41c537eb568e679685fe26f440ae85664a4a0c0c` is available and unexpired. This is the newest main APK; #350 remains the earlier device-feedback baseline. Neither has new owner acceptance recorded.
- #182 and #199 were found closed despite explicit outstanding acceptance gates and reopened on 2026-09-06. Keep them open until their actual acceptance passes; reference them without closing keywords in partial implementation PRs.
- Hosted SQL recheck found no nonblank `public.items.description` values in either discoverable domain. BOOK description enrichment remains a real data-quality gap.

## Earlier configured-device feedback

PR #198 (`Polish real catalog cards and profile switching`) is merged. Main validation passed and standalone Android APK run **#346** was built successfully.

That APK confirmed the next Sprint 014 product-quality work:

- MOVIE has no posters because hosted MOVIE image coverage is 0/30,
- BOOK covers still feel slow during continuous scrolling,
- the old small image mount window intentionally allowed already-seen covers to fall back to placeholders when they left the window,
- the discovery grid still feels like spaced cards rather than a dense visual browse surface.

Issue **#199** is the active device-feedback follow-up. Its merged implementation preserves these requirements:

- preserve Prediction order and all Event/Profile semantics,
- keep bounded FlatList virtualization,
- use a dense, nearly edge-to-edge two-column image-first grid with minimal gutters and sharp rectangular tiles,
- keep `cover` image fill behavior,
- remember warmed discovery image URLs for the current app session so previously browsed covers do not intentionally revert to placeholders,
- prefetch a bounded window farther ahead than the mounted image/render window,
- never mount or fetch the whole 415-item catalog at once.

Configured-device acceptance is still required after #199 is merged.

## Sprint 014 gates

### 14A — real catalog / presentation — #182 + #199

Implemented/hosted/main foundation:

- one canonical `public.items` table,
- provider provenance and namespaced external-ID deduplication,
- discoverability/lifecycle/presentation metadata,
- service-only normalized catalog upsert/batch boundary,
- hosted TMDB importer,
- Open Library bulk importer plus bounded beta seed/refresh tooling,
- 415 discoverable BOOK Items with 385 provider covers,
- 30 discoverable MOVIE Items with no poster metadata yet,
- mobile catalog enrichment and detail hero image support,
- initial hosted Prediction is requested immediately; interaction-driven reranking keeps its bounded debounce.

Still required before external beta:

1. accept #199 dense-grid/image-cache behavior on configured Android,
2. configure `TMDB_READ_ACCESS_TOKEN`,
3. expand MOVIE provider catalog to useful beta scale with posters/descriptions,
4. verify provider attribution/licensing requirements,
5. enrich BOOK descriptions/edition matching where beta quality still needs it.

### 14B — PersonalProfile import + cold start — #185 / #191

Implemented/hosted/main:

- Letterboxd, IMDb, Goodreads, StoryGraph and generic Kajo CSV normalization,
- owner-only PersonalProfile import staging/matching/review/commit/remove,
- imported/calibration evidence is source-tagged LongTerm bootstrap evidence rather than native Kajo Events,
- deterministic no-import profiling: first 12 candidates, six known-item ratings required, extension to at most 24, then fail-open,
- no demographics and no `KAJO_MOCK` calibration path.

Still required:

- configured-device Settings/file-picker/import acceptance with real CSV data,
- configured-device 6-of-12-to-24 calibration acceptance,
- verify useful first-session Prediction after both import and no-import bootstrap.

### 14C — SharedProfile common-fit — #177

Implemented/hosted/main:

- Prediction target remains SharedProfile,
- Shared joint evidence + same-Profile ScenarioMemory remain first-class,
- accepted-member Personal taste is read through aggregate common-fit summaries only,
- sparse estimates shrink toward `ColdStartPrior`, agreement can lift candidates and disagreement is penalized,
- Personal evidence is never copied into Shared history,
- candidate explanations expose aggregate-only components,
- PersonalProfile Prediction path remains unchanged.

Still required:

- configured Android SharedProfile acceptance with real Items and a persisted V1 trace,
- then complete `MVP-PRED-005` / close #177.

### 14D — external beta — #186

Sprint 014 closes only when roughly 10 external testers can use clean-install Personal/Shared BOOK/MOVIE flows with useful first-session personalization and diagnosable failures without developer setup.

Deferred #102 Lists, #138 messaging and current Room/shell device gates must be refreshed as needed before beta acceptance.

## Active continuation source and next task

Accepted main baseline at this documentation checkpoint: `41c537eb568e679685fe26f440ae85664a4a0c0c`. The newer documentation handoff is **PR #206, branch `docs/182-catalog-device-handoff`**; it remains unmerged until GitHub says otherwise. Fetch and inspect its head/checks before continuing. Do not mistake its plan for implemented main behavior.

The product owner requested on 2026-09-07 that algorithm reliability/adaptation, documentation suggestions and final service/data operations become explicit full-MVP gates. Scope is in `MVP.md`; exact dependency order is in `ROADMAP.md` (14.0–15.3). No newly added requirement is complete.

**First algorithm coding task: [#207](https://github.com/Kajooja/Kajo/issues/207), roadmap 14.0, `MVP-ALG-001` + initial `MVP-ALG-009`.** Reproduce and fix bootstrap-only Personal ranking before more adaptive complexity. Issue #207 is open; create its scoped implementation branch/PR after resolving this documentation handoff. It relates to #185/#191 without reopening correctly completed implementation history merely for tracking.

**Pre-APK continuation (2026-09-07):** branch `fix/pre-apk-import-dependency` builds on the still-pending #206 documentation head. It declares the Settings CSV picker’s existing `expo-file-system` 57.0.5 as a direct mobile dependency, matching the installed Expo 57 compatibility map; the lockfile resolves the same package version. Review this as a dependent PR, resolve #206 first, then retarget to main. No algorithm fix or database migration is included.

**New #207 prerequisite: [#208](https://github.com/Kajooja/Kajo/issues/208).** Public-source inspection found that the catalog migration’s literal single-line candidate-filter replacement does not match the earlier V0 function’s multiline body. Resolve reproducible database replay under the immutable-migration rule before claiming SQL CI acceptance. Do not skip failing history or silently edit deployed migrations. The original #207 bootstrap correction remains unimplemented. APK grid/cache testing may proceed independently.

Required first-task acceptance:

1. Two fresh PersonalProfiles, zero native Events/Scenarios, same unseen candidate pool, opposite imported/calibration preferences: direct score explanations and ordering differ appropriately.
2. Remove/correct bootstrap data and confirm influence is removed/recomputed; ordinary native-evidence and empty-profile controls still work.
3. Shared/Personal authorization and evidence isolation hold; no provider-specific recommender or mobile scoring.
4. Forward migration and deterministic SQL regression/CI foundation; `npm run check` and applicable DB gates pass. Record hosted deployment/device limitations explicitly.

After 14.0, proceed to **14.1 atomic actions/durable outbox/exact delivery trace**, then **14.2 serving-shadow parity and bounded candidate refill**. Do not activate canary promotion over mismatched scoring or corrupted exposure data.

Owner is independently testing APK #350 for #199. Collect device feedback and fix confirmed defects; device or TMDB credential waits must not stall unblocked algorithm work. TMDB execution prerequisites remain below. #182/#199 and Shared/import/List/message device gates stay open until evidence passes. No device acceptance was received in this documentation task.

## Review findings that change acceptance — 2026-09-06/07

Code review against main `41c537eb` and prior read-only hosted audit identified:

| Finding | Evidence / remaining work |
|---|---|
| Bootstrap taste missing from direct Personal base score | `rank_items_v0` reads native Events/interactions while `build_profile_memory_state_v1` includes bootstrap; a fresh Profile lacks historical Scenarios to bridge this. Code-derived defect; a bootstrap-only controlled reproduction is the first task. |
| Serving/shadow mismatch and idle evaluation | Prior hosted checkpoint: 207 queued jobs, zero shadow runs/evaluations. Read-only baseline recomputation found score differences >0.001 in 530/572 Shared candidates. This was analytical SELECT evidence, not completed shadows; recheck current counts before operating workers. |
| Detail/slate and overlay provenance | `ItemDetailScreen` uses `getRankedMockItems` -> latest remembered ItemType slate, while trace ID may come from a different run; Shared overlay can add/reorder Items. Prior audit found 61 hosted-labelled impressions outside retained candidate pools and 21 on non-selected candidates. Historical rows are not proof every current view is wrong. |
| Volatile/non-atomic writes | `eventTracking.ts` pending Map is cleared on dispose; interaction projection and Event persistence are separate. Process-kill/retry/Profile-switch regression work is required. |
| Candidate/state limitations | Baseline top-50 precedes later eligibility/common-fit; no full-catalog continuation. Decay/support logic differs between base score and memory snapshots. See algorithm completion contract. |

These findings reopen `MVP-DATA-001/002` and `MVP-PRED-006` acceptance to `[-]`; previous implementation history stays intact. Existing architectural delivery is not an assertion that every planned memory function is operating correctly.

## Promoted documentation suggestions

#200 contextual Lists, #201 catalog search/filters and #203 authorized Profile-name search are now MVP requirements (DISC-008/009 and NAV-005), scheduled after evidence/catalog foundations. WorkingState, adaptive memory, candidate union, operational SleepLayer and data lifecycle are required via ALG/OPS IDs. Learned/LLM models, PopulationMemory, extra domains and monetization keep their explicit later gates. The reconciliation table in `ROADMAP.md` is authoritative.

## Repository / backend hygiene

Current hygiene rules and state:

- `main` remains the only accepted product truth; one scoped Issue -> branch -> PR is preferred,
- deployed Supabase migrations are immutable; fixes use forward migrations,
- repository and hosted migration history must match,
- PR #162 restored the already-hosted `20260902064431_harden_production_function_boundaries.sql` migration to Git; hosted function hardening and repository history are now aligned,
- current Supabase security advisor no longer reports the previous exposed SECURITY DEFINER function warnings,
- leaked-password protection remains the known WARN and belongs to #160 / Sprint 015 release hardening,
- historical mock Items/migrations are not deleted when Event/List/Prediction referential integrity depends on them,
- Open Library Search tooling is beta admin ingestion only; it is never Kajo's runtime catalog backend,
- Personal evidence remains Personal; Shared common-fit reads authorized summaries rather than copying evidence,
- `STATUS.md` owns current truth, sprint docs own execution/history, `ROADMAP.md` owns sequencing, Issues own scoped unresolved work.

## Hygiene audit — repository review 2026-09-07

| Area | Result / required follow-up |
|---|---|
| Continuation/docs | Removed stale Sprint 013 next-step instructions from HANDOFF_PROTOCOL and milestone; restored one current-step authority in STATUS and one sequence in ROADMAP. Corrected Shared-history UX contradiction. Completed sprint history is preserved. |
| Acceptance claims | Reopened three foundation requirements and added explicit ALG/DATA/OPS gates instead of claiming architecture persistence proves end-to-end behavior. Catalog/cache code-map wording now identifies known gaps. |
| DB verification | Current CI runs mobile/catalog tests and bundle smoke but no SQL regression suite/migration-reset gate exists. Add at 14.0 and extend per fix. Existing hosted migration files remain immutable. |
| Duplicate logic / old fallback | Base scoring, memory projection and shadow diverge; consolidate in 14.0–14.4. `mockDiscovery` still supplies runtime detail lookup, so deleting it blindly would break behavior. Remove only superseded paths with references and regression evidence; production fallback must be explicit and non-mock. |
| Dependencies | Pre-APK branch declares the `expo-file-system` dependency used by `SettingsScreen.tsx` (pending merge); Edge imports use floating `npm:@supabase/supabase-js@2`. Resolve with compatible explicit dependencies/pinning and verification in OPS-005, not an unrelated docs patch. Lockfile exists. |
| Migrations/configuration | SQL string-replacement migrations make subsequent function changes fragile. Prefer complete forward definitions/shared helpers; retain deployed history. Record actual hosted configuration/version parity at deployment, including JWT/function secret names. |
| Assets / old data | Graphics remain isolated in assets/theme; no file is removed without a reference audit. Historical mock database rows with FKs remain non-discoverable. No blanket deletion of assets, migrations, branches or user data is authorized by a hygiene label. |
| Security/operations | This task reviewed source/configuration and prior read-only audit findings; it did not run a new comprehensive vulnerability/license scan, provision infrastructure or verify backups. OPS-001..005 require those results before acceptance. |

No application code, migrations, secrets or hosted data were modified in this documentation change. Documentation link/requirement/diff checks are its local validation; code changes still require `npm run check` plus the new applicable DB gate.

## Important current files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/project/sprints/SPRINT-014.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/discovery/DiscoveryScreen.tsx`
- `/apps/mobile/src/features/discovery/catalogImageUrl.ts`
- `/apps/mobile/src/features/discovery/usePredictionRanking.ts`
- `/apps/mobile/src/features/discovery/predictionRankingCache.ts`
- `/apps/mobile/src/features/settings/ProfileBootstrapGate.tsx`
- `/apps/mobile/src/features/settings/SettingsScreen.tsx`
- `/apps/mobile/src/features/settings/historyImportParser.ts`
- `/apps/mobile/src/features/settings/historyImportOperations.ts`
- `/scripts/catalog/import-tmdb-beta.mjs`
- `/scripts/catalog/import-tmdb-beta.test.mjs`
- `/scripts/catalog/open-library-search-beta.mjs`
- `/scripts/catalog/import-open-library-search-beta.mjs`
- `/scripts/catalog/import-open-library.mjs`
- `/supabase/functions/catalog-import/index.ts`
- `/supabase/migrations/20260902064431_harden_production_function_boundaries.sql`
- `/supabase/migrations/20260905003000_seed_curated_beta_catalog.sql`
- `/supabase/migrations/20260905003500_fix_resurfacing_null_bootstrap.sql`
- `/supabase/migrations/20260905010000_profile_cold_start_calibration.sql`
- `/supabase/migrations/20260905113000_shared_common_fit_v1.sql`
- `/supabase/migrations/20260905114500_harden_shared_common_fit_v1_1.sql`
- `/supabase/migrations/20260905115500_fix_shared_common_fit_personal_policy.sql`

## Handoff

A fresh conversation may start with **"jatka reposta"** and must follow `/AGENTS.md` and `HANDOFF_PROTOCOL.md`.

Resolve PR #206 first, then execute the first unmet dependency in `ROADMAP.md`; the next coding task is specified above. Continue until a concrete gate is complete or a real external dependency blocks that task. Update this file with exact Issue/branch/PR, commit/deploy state, tests, blockers and one next action after each bounded slice. Never require the prior chat to reconstruct the plan.

TMDB execution prerequisites: project `mwrnvfosrzwygrunrltm` needs server-only `TMDB_READ_ACCESS_TOKEN` in Edge Function secrets. Run `npm run catalog:tmdb-beta -- --dry-run` first, then `npm run catalog:tmdb-beta` in a trusted admin shell with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`). No privileged credentials were available in the continuation shell, and the connected Supabase tools do not expose secret configuration or Edge invocation. No import was executed. Do not request secrets in chat or bypass the importer authorization boundary. Recheck nonblank image/description coverage and canonical external-ID uniqueness after the import; importedCount is an upsert count, not necessarily a count of new unique Items. Required TMDB attribution remains an external-release gate in #182.

Do not copy Personal history into Shared history, delete historical mock rows that still carry references, build a second recommender, expose member-level raw evidence, use Open Library Search as a runtime backend, introduce unofficial movie-poster scraping, bypass PopulationMemory privacy gates, or begin monetization work before MVP product/release gates are complete.
