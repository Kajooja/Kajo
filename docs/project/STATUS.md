# Kajo Current Status

Last updated: **2026-09-06**  
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
- hosted Prediction V1 with Working/Short/Long state, same-Profile ScenarioMemory and complete Prediction trace,
- controlled SleepLayer / PredictorGenome shadow-evaluation architecture with automatic production promotion disabled for MVP,
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

| ItemType | Discoverable | With image |
|---|---:|---:|
| BOOK | **415** | **385** |
| MOVIE | **30** | **0** |

BOOK beta inventory is 385 Open Library provider Items plus 30 curated real BOOK seed Items. Historical mock Items remain stored for referential integrity but are non-discoverable.

MOVIE poster rendering is already generic in mobile, but there are currently **zero hosted MOVIE image URLs**. This is a catalog-data gap, not a mobile rendering fallback. The next canonical fix is to configure server-only `TMDB_READ_ACCESS_TOKEN` for the existing hosted TMDB importer and expand MOVIE provider coverage with real posters/descriptions. Do not add scraping or an unofficial image source.

## Latest configured-device feedback

PR #198 (`Polish real catalog cards and profile switching`) is merged. Main validation passed and standalone Android APK run **#346** was built successfully.

That APK confirmed the next Sprint 014 product-quality work:

- MOVIE has no posters because hosted MOVIE image coverage is 0/30,
- BOOK covers still feel slow during continuous scrolling,
- the old small image mount window intentionally allowed already-seen covers to fall back to placeholders when they left the window,
- the discovery grid still feels like spaced cards rather than a dense visual browse surface.

Issue **#199** is the active device-feedback follow-up. Its implementation must:

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

## Current ordered work

1. **Finish #199 and accept the dense BOOK/MOVIE discovery grid + bounded warm image cache on a new configured Android APK.**
2. **Run the remaining configured-device Sprint 014 acceptance:** Settings/CSV import, no-import cold start, Shared common-fit and deferred core List/message/shell gates.
3. **Configure TMDB server credential and expand MOVIE catalog/poster/description coverage before external beta.**
4. **Run #186 roughly 10-person external beta and fix bounded product-quality defects.**
5. **Sprint 015:** production SMTP/social auth/security/privacy/signing/store release.
6. Mark MVP 0.1 complete only after an installed store build is accepted.

## Future product ideas captured, not MVP blockers

The following ideas are intentionally recorded as separate issues so they are not lost and do not silently expand MVP 0.1:

- **#200 — contextual Profile Lists on BOOK/MOVIE discovery:** extend the top `Löydä` / consumed-history row with relevant active-Profile Lists and a final `…` that opens the canonical Lists page. Reuse generic `ItemList`; never create BookList/MovieList cores.
- **#201 — catalog search and filters:** title/creator search plus useful normalized tag/genre/subject/year/language filters. This is catalog browse, not a second recommender, and it must operate on canonical persisted Items rather than calling providers at runtime.

Promote either into MVP only if external-beta evidence shows it is necessary for a coherent first release.

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

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target: **finish/accept #199 dense discovery + warm image cache, then complete the configured-device Sprint 014 import/cold-start/Shared acceptance and expand MOVIE through the canonical TMDB importer.**

Do not copy Personal history into Shared history, delete historical mock rows that still carry references, build a second recommender, expose member-level raw evidence, use Open Library Search as a runtime backend, introduce unofficial movie-poster scraping, bypass PopulationMemory privacy gates, or begin monetization work before MVP product/release gates are complete.
