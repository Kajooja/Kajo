# Kajo Current Status

Last updated: **2026-09-05**  
Current milestone: **MVP 0.1 — complete non-commercial store release**  
Current sprint: **Sprint 014 — Real Catalog, Profile Bootstrap & External Beta** (`sprints/SPRINT-014.md`)  
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory** (`sprints/SPRINT-013.md`)

This is the authoritative current-state document. Sprint files preserve execution evidence; `ROADMAP.md` owns future sequencing.

## MVP meaning

MVP 0.1 is the first complete, non-commercial BOOK/MOVIE Kajo that can be downloaded from Google Play and/or the Apple App Store. A mock-data technical prototype does not satisfy the milestone.

Required before completion:

- real BOOK/MOVIE catalog,
- useful first-session PersonalProfile through imported history or bounded profiling,
- complete Personal/Shared core flows for roughly 10 external testers,
- production authentication/security/privacy/signing/store readiness,
- official store availability and product-owner acceptance.

## Current product state

Kajo already has:

- persistent illustrated Room, global DiscoveryMode and Personal/Shared theme identity,
- BOOK/MOVIE grid/detail/swipe flows,
- hosted Prediction V1 + Working/Short/Long state + same-Profile ScenarioMemory,
- reacted-Item suppression/saved reminders and controlled SleepLayer evolution,
- PersonalProfile + consent-based SharedProfiles, Endorsement consensus, Lists and messaging,
- accepted bottom SharedProfile quick switcher,
- hosted generic provider catalog foundation + batch importer + ACTIVE `catalog-import` Edge Function,
- **hosted beta catalog with 30 real MOVIE Items and 415 real BOOK Items**: 30 guarded `KAJO_CURATED_BETA` books plus 385 Open Library books,
- **385/385 Open Library beta books have provider covers + creators, 383/385 have release years, 57 expose Finnish editions and 65 Swedish editions**,
- historical 24 `KAJO_MOCK` Items retained but `discoverable=false`,
- hosted V1 proof of real BOOK/MOVIE delivery and 0 mock delivery,
- mobile real-catalog presentation fields without a second recommender,
- hosted PersonalProfile bootstrap-evidence foundation for imported viewing/reading history,
- Letterboxd/IMDb/Goodreads/StoryGraph/generic-CSV normalization,
- PersonalProfile-only Settings import workflow with reviewable ambiguous matches and removable persisted imports,
- hosted `cold-start-v1` PersonalProfile profiling backend with versioned `cold-start-prior-v1` and bounded 6-of-12-to-24 contract,
- #191 cold-start merged to `main` at `0cfa9e73d14f66e309bae937d66124b88c0477c2`,
- **SharedProfile common-fit v1.1 hosted and merged to `main` through PR #194 at `5e1dc9cc993887ab19b943ac0f2a5943d53aa908`**, inside the same canonical Prediction V1 path with accepted-member Personal taste read through an aggregate-only boundary, sparse shrinkage toward `ColdStartPrior`, consensus/minimum-member behavior and disagreement penalty.

A bootstrap/resurfacing integration bug discovered by real-data acceptance is fixed forward: missing bootstrap evidence had propagated SQL NULL into boolean state and incorrectly classified untouched Items as `SAVED_SUPPRESSED`, causing hosted V1 to return no delivery and mobile to fall back to mocks. Untouched real Items now classify `ORDINARY/eligible=true`.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets a `Profile`; recommendable content remains `Item`. Personal evidence is never copied into Shared history. Shared common-fit reads authorized accepted members' Personal taste through the Prediction boundary and stores only aggregate fit components in the Shared Prediction trace.

## Acceptance truth

### Accepted

- Sprints 001–010.
- Sprint 011/#151 Shared discovery + Endorsement consensus.
- persistent Room/backdrop/navigation direction.
- Sprint 013A–C Prediction nervous system + controlled SleepLayer.
- #174 reacted-Item resurfacing policy.
- #175 / `MVP-NAV-004` bottom SharedProfile quick switcher on configured Android.

### Implemented/hosted/main but configured-device acceptance still open

- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171/current Room-lighting/target/profile-hydration follow-up.
- latest shell/bootstrap visual polish.
- #182 real catalog foundation + mock retirement + **415-book beta coverage** are hosted/main through #192/#196; configured-device acceptance and movie-provider expansion remain open.
- #185 PersonalProfile history import backend/parser/Settings slice; device acceptance open.
- #191 no-import cold-start profiling backend + mobile gate is hosted and merged to `main`; configured-device acceptance remains open.
- #177 SharedProfile common-fit v1.1 is hosted and merged to `main` through #194; configured-Android acceptance remains open.

## Sprint 014 — ACTIVE

### 14A — #182 real catalog — BOOK BETA COVERAGE HOSTED/MAIN

Implemented/hosted:

- canonical `public.items` lifecycle/presentation fields,
- private provider provenance + namespaced external IDs,
- service-only atomic and max-50 batch catalog upsert,
- TMDB Edge importer with server-side credential boundary, Finnish localization and English fallback,
- Open Library monthly-dump importer as the long-term bulk path,
- Prediction V1 mobile enrichment with covers/posters, creators and year,
- real hosted Item detail/swipe preserves the delivered Prediction slate,
- `discoverable` remains part of the one canonical Prediction candidate generator,
- guarded `KAJO_CURATED_BETA` seed contains 30 real movies and 30 real books,
- old 24 mock Items are non-discoverable but not deleted,
- all 930 historical mock Event references still resolve,
- V1 hosted acceptance returns real Items after the NULL bootstrap fix,
- PR #192 is merged to `main` at `c08513a3b00cda764004ed8c295466f26dc61e32`,
- bounded Open Library Search beta bootstrap ran 13 explicit genre/language buckets and normalized **650 raw rows -> 385 new Work-ID-deduplicated BOOK Items**,
- current discoverable BOOK total is **415** (`385 open_library + 30 kajo_curated`),
- Open Library quality gate: **385 covers, 385 creators, 383 years, 57 Finnish-edition Items, 65 Swedish-edition Items, 0 duplicate discoverable BOOK title groups, 0 discoverable mocks**,
- language-preferred Open Library Edition enrichment matched all 385 provider Items, changed 159 display titles and selected 385 display covers without title collisions,
- Open Library `readinglog_count`/`ratings_count` normalize into generic `popularity`/`voteCount`, so existing `ColdStartPrior` uses `PROVIDER_POPULARITY` without a provider-specific recommender,
- `metadata.openLibraryWorkId` mirrors the public admin-refresh identity while private external-ID aliases remain canonical,
- repeatable admin tooling lives in `scripts/catalog/open-library-search-beta.mjs` + `import-open-library-search-beta.mjs`; it uses explicit language-preferred Edition fields, work/title dedup, a fail-closed coverage gate (default 180 Items / 8 buckets), rate spacing and only `upsert_catalog_batch_v1`,
- PR #196 final-head CI passed lint/typecheck/catalog tests/iOS+Android bundle smoke and squash-merged to `main` at `d3fe79865f855b8b3df5f42ae1027ed006169687`.

Still required:

- configured-device confirmation of real cover/title delivery,
- configure server-only `TMDB_READ_ACCESS_TOKEN`,
- expand MOVIE coverage from the current 30-title seed to beta-scale provider data with real posters/descriptions,
- enrich BOOK descriptions/ISBN-edition matching through the existing Open Library dump path and optional Finna metadata where useful,
- provider attribution/licensing review before external/store release.

### 14B — #185 PersonalProfile bootstrap/import + no-import profiling — HOSTED/MAIN, DEVICE GATES OPEN

Hosted import migrations:

- `20260904203000_profile_bootstrap_import_foundation.sql`,
- `20260904203200_harden_bootstrap_rating_constraints.sql`,
- `20260904210000_expand_profile_import_stage_limit.sql`,
- `20260904211000_profile_bootstrap_actor_index.sql`,
- `20260904212000_list_profile_import_jobs.sql`.

Hosted profiling migration:

- `20260905010000_profile_cold_start_calibration.sql` (`profile_cold_start_calibration` hosted migration).

Import contract:

- imports are PersonalProfile-owner-only,
- imported provider history is **not** appended as native Kajo Events,
- import jobs/rows/evidence are source-tagged, removable and idempotent,
- match order is canonical external ID first, then safe title/year fallback,
- ambiguous/unmatched rows remain explicit and user-reviewable; no silent guess,
- strongest active state per Item wins across imports: `RATED > CONSUMED > SAVED`,
- Letterboxd 0.5–5 stars -> Kajo 1–10 by x2,
- IMDb 1–10 stays unchanged,
- watched/read without rating -> consumed with no fabricated rating,
- watchlist/to-read -> saved intent,
- bootstrap contributes to LongTerm only; it never enters ShortTerm/ScenarioMemory,
- imported consumed/rated Items feed the existing suppression policy,
- native Kajo Events remain append-only and progressively dominate stale bootstrap evidence,
- staged import bound is 5,000 normalized rows,
- prior imports can be reloaded in Settings and removed after app restart.

No-import `cold-start-v1` contract:

- import and profiling are the two intended sparse-PersonalProfile bootstrap paths,
- Settings/import is reachable from the profiling gate; returning without sufficient import evidence brings the gate back,
- minimum completion is **6 ratings of known real Items**,
- first slate is **12** deterministic high-prior Items; unknown Items are skipped without negative evidence,
- if needed the same slate extends to at most **24** Items,
- the user may finish as soon as six ratings exist and never needs to rate all cards,
- after the bounded maximum/technical insufficiency, fail open rather than trap the user,
- image is presentation enrichment, not eligibility,
- `KAJO_MOCK` and demographic profiling are excluded,
- calibration is source-tagged `KAJO_CALIBRATION` LongTerm bootstrap evidence, not native Events/ShortTerm/ScenarioMemory.

`ColdStartPrior` / `cold-start-prior-v1`:

1. provider/catalog trend or popularity when available,
2. provider/catalog recognition when available,
3. explicit recognition-only fallback for the first curated beta seed,
4. weak freshness component.

Curated Items deliberately report `trend=0` and `KAJO_CURATED_RECOGNITION`; no fake live trend is created. Kajo-wide aggregate user trend is not MVP `ColdStartPrior`; it belongs to later privacy-gated `PopulationMemory`. TMDB metadata and Open Library beta metadata both normalize provider popularity/recognition into generic fields, so real provider imports feed this prior without a second recommender or mobile change.

Mobile Settings/import:

- `Asetukset` is second from bottom in the side drawer, immediately above `Kirjaudu ulos`,
- import controls/instructions are available only while PersonalProfile is active,
- SharedProfile state shows the boundary and `Vaihda omaan Kajoon`,
- flow: select CSV -> parse -> stage summary -> choose/skip ambiguous rows -> commit,
- committed imports remain visible under `Aiemmat tuonnit` and can be removed without touching native Kajo interactions,
- Letterboxd ZIP is currently instructed to be unzipped first; its CSV files are imported directly.

Hosted acceptance already proved:

- controlled import stage sample: 3 matched / 1 ambiguous / 1 unmatched,
- manual resolution + commit,
- SharedProfile import/listing denied,
- Profile isolation,
- imported rating suppression,
- old saved-import reminder eligibility,
- import removal deactivates bootstrap evidence,
- empty-profile import adds LongTerm taste while ShortTerm remains empty,
- 5,000-row guard is active,
- new FK index advisor finding was corrected forward,
- profiling status sees real movies + hundreds of real books without requiring images,
- 12-card candidate slate is deterministic and remains the prefix of the 24-card extension,
- curated candidates are inspectably recognition-prior only (`trend=0`) while Open Library Items use provider popularity,
- controlled six-rating calibration executes without native calibration Events and rollback leaves zero active test rows,
- #191 final-head lint/typecheck/tests/iOS+Android bundle smoke passed before merge,
- merged-main validate passed.

**Next 14B target:** configured-device real-card + Settings/CSV + no-import profiling acceptance from the merged main APK. #185 remains open until both import and no-import paths are accepted.

### 14C — #177 SharedProfile common-fit — HOSTED/MAIN, DEVICE GATE OPEN

Current `shared-common-fit-v1.1` extends the same Prediction V1 candidate pool, score and trace. It does not create a second Shared recommender.

Inputs and behavior:

- target remains SharedProfile,
- sparse/new SharedProfile receives a small neutral non-personal `ColdStartPrior` component,
- accepted members are resolved from `profile_members`; each member contributes only through their canonical PersonalProfile memory summary,
- member fit combines LongTerm taste with native ShortTerm state; imported/calibration evidence can influence LongTerm but is never copied into Shared history,
- sparse member evidence shrinks toward the neutral prior,
- aggregate mean/minimum member fit above the neutral prior can add score,
- common agreement receives a consensus bonus,
- member-fit range creates a disagreement penalty,
- neutral prior weight decays as direct SharedProfile evidence accumulates,
- existing Shared joint state and same-Profile ScenarioMemory remain first-class V1 inputs,
- PersonalProfile ranking is unchanged: common-fit is explicit no-op and old Personal policy version remains,
- Shared trace policy version is `scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1`,
- candidate explanation is aggregate-only and does not expose member identifiers, PersonalProfile IDs or raw histories,
- private common-fit helpers are not executable by authenticated/anon users; mobile still uses `public.rank_items_v1`.

Hosted migrations/fixes:

- `20260905113000_shared_common_fit_v1.sql`,
- `20260905114500_harden_shared_common_fit_v1_1.sql`,
- `20260905115500_fix_shared_common_fit_personal_policy.sql`.

Hosted/repository acceptance:

- agreement control contribution **+4.088**,
- sparse control prior-only contribution **+0.0675**,
- disagreement control contribution **−2.5945** with **2.5** disagreement penalty,
- real two-member SharedProfile run persisted `shared-common-fit-v1.1` in the canonical V1 trace,
- item-level disagreement and consensus components were visible in aggregate explanation,
- no User ID / PersonalProfile ID leakage in explanations,
- PersonalProfile control: `applicable=false`, contribution `0`, original policy version preserved,
- 10-result Shared hosted smoke around **136 ms** in current development environment,
- all tagged #177 test PredictionRuns/candidates cleaned to zero residue,
- advisor pass introduced no new #177 WARN-level finding; existing leaked-password WARN remains #160/#184 scope,
- PR #194 final-head CI #327 passed lint, TypeScript, tests and iOS/Android bundle smoke,
- PR #194 squash-merged to `main` at `5e1dc9cc993887ab19b943ac0f2a5943d53aa908`.

Remaining:

- configured Android SharedProfile acceptance with real Items and persisted V1 trace,
- then complete `MVP-PRED-005` and close #177.

### 14D — #186 external beta

Before Sprint 014 closes, roughly 10 external testers must be able to use real BOOK/MOVIE discovery, useful first-session personalization and complete Personal/Shared flows without developer setup.

## Sprint 015 — production/store gate after beta

Required before store submission:

- #184/#127 production SMTP/domain, Google sign-in and Sign in with Apple where required,
- all auth providers link to one canonical Kajo User/nickname/PersonalProfile,
- #160 security hardening including leaked-password protection decision/fix,
- privacy/support/account deletion/data lifecycle,
- production identifiers/versioning/signing,
- provider attribution/licensing decisions,
- store metadata/assets/permissions and clean install/update acceptance.

## Prediction / evolution state

```text
provider/catalog ColdStartPrior (only while sparse)
+ Native Events + imported/calibration Personal bootstrap evidence
  -> Working / Short / Long state
  -> Personal Prediction V1 / Shared Prediction V1 common-fit aggregation
  -> same-Profile ScenarioMemory
  -> reacted/resurfacing + generic Item discoverability
  -> immutable PredictionRun/Candidate trace
  -> frozen Challenger shadows + mature evaluation
  -> manual Profile canary / rollback
```

Imported/calibration history affects Personal LongTerm only. Shared common-fit reads authorized Personal memory summaries but never copies their evidence. Automatic production genome promotion remains disabled in MVP 0.1. Kajo-derived cross-Profile trend remains future PopulationMemory until privacy/cohort gates exist.

## Current ordered work

1. **Run configured-device acceptance covering 415-book real-content delivery + Settings/CSV import + no-import profiling + Shared common-fit.**
2. **Configure TMDB server credential and expand #182 MOVIE coverage with real posters/descriptions before external beta.**
3. Close deferred #102/#138/Room/shell device gates required for beta.
4. **#186 roughly 10-person external beta acceptance.**
5. **Sprint 015 — production auth/security/signing/store release.**
6. Mark MVP 0.1 complete only after the installed store build is accepted by the product owner.

## Repository hygiene

- Follow `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md`.
- One canonical implementation per capability.
- Provider imports normalize into generic Items/bootstrap evidence.
- Open Library Search beta bootstrap is a bounded cached seed/refresh adapter; monthly dumps remain the broad catalog path.
- `ColdStartPrior` is a sparse-evidence Item prior, not a second recommender or PopulationMemory shortcut.
- Personal evidence remains Personal; Shared common-fit reads authorized memory summaries rather than copying evidence.
- Shared common-fit explanation stays aggregate-only; do not expose member raw history.
- Deployed migrations are immutable; fixes are ordered forward migrations.
- `STATUS.md` = current truth, sprint docs = execution/history, `ROADMAP.md` = planned sequence.

## Important files

- `/docs/product/MVP.md`
- `/docs/project/sprints/SPRINT-014.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/settings/ProfileBootstrapGate.tsx`
- `/apps/mobile/src/features/settings/profileCalibrationOperations.ts`
- `/apps/mobile/src/features/settings/SettingsScreen.tsx`
- `/apps/mobile/src/features/settings/historyImportParser.ts`
- `/apps/mobile/src/features/settings/historyImportOperations.ts`
- `/scripts/catalog/open-library-search-beta.mjs`
- `/scripts/catalog/import-open-library-search-beta.mjs`
- `/scripts/catalog/import-open-library.mjs`
- `/supabase/migrations/20260905003000_seed_curated_beta_catalog.sql`
- `/supabase/migrations/20260905003500_fix_resurfacing_null_bootstrap.sql`
- `/supabase/migrations/20260905010000_profile_cold_start_calibration.sql`
- `/supabase/migrations/20260905113000_shared_common_fit_v1.sql`
- `/supabase/migrations/20260905114500_harden_shared_common_fit_v1_1.sql`
- `/supabase/migrations/20260905115500_fix_shared_common_fit_personal_policy.sql`
- `/supabase/functions/catalog-import/index.ts`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target: **configured-device real-content/import/cold-start/Shared-common-fit acceptance from merged main, then TMDB MOVIE expansion**. Do not copy Personal history into Shared history, delete historical mock Items, build a second recommender, expose member raw evidence, treat curated recognition as live trend, use Open Library Search as Kajo's runtime backend, bypass PopulationMemory privacy gates, or begin monetization work.