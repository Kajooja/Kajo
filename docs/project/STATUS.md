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
- **first real hosted beta catalog: 30 MOVIE + 30 BOOK Items with `KAJO_CURATED_BETA` provenance**,
- historical 24 `KAJO_MOCK` Items retained but `discoverable=false`,
- hosted V1 proof of 10/10 real MOVIE + 10/10 real BOOK delivery and 0 mock delivery,
- mobile real-catalog presentation fields without a second recommender,
- hosted PersonalProfile bootstrap-evidence foundation for imported viewing/reading history,
- Letterboxd/IMDb/Goodreads/StoryGraph/generic-CSV normalization,
- PersonalProfile-only Settings import workflow with reviewable ambiguous matches and removable persisted imports,
- hosted `cold-start-v1` PersonalProfile profiling backend with versioned `cold-start-prior-v1` and bounded 6-of-12-to-24 contract,
- **PR #191 merged to `main` at `0cfa9e73d14f66e309bae937d66124b88c0477c2`; final-head PR CI and main validate both passed**.

A bootstrap/resurfacing integration bug discovered by real-data acceptance is fixed forward: missing bootstrap evidence had propagated SQL NULL into boolean state and incorrectly classified untouched Items as `SAVED_SUPPRESSED`, causing hosted V1 to return no delivery and mobile to fall back to mocks. Untouched real Items now classify `ORDINARY/eligible=true`.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets a `Profile`; recommendable content remains `Item`. Personal evidence is never copied into Shared history. Shared common-fit (#177) may read authorized accepted members' Personal taste through the Prediction boundary.

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
- #182 first real 30+30 catalog + mock retirement hosted/merged through #192; device acceptance and provider enrichment still open.
- #185 PersonalProfile history import backend/parser/Settings slice; device acceptance open.
- #191 no-import cold-start profiling backend + mobile gate is hosted and merged to `main`; configured-device acceptance remains open.

## Sprint 014 — ACTIVE

### 14A — #182 real catalog — FIRST REAL CATALOG HOSTED/MAIN

Implemented/hosted:

- canonical `public.items` lifecycle/presentation fields,
- private provider provenance + namespaced external IDs,
- service-only atomic and max-50 batch catalog upsert,
- TMDB Edge importer with server-side credential boundary, Finnish localization and English fallback,
- Open Library monthly-dump importer,
- Prediction V1 mobile enrichment with covers/posters, creators and year,
- real hosted Item detail/swipe preserves the delivered Prediction slate,
- `discoverable` remains part of the one canonical Prediction candidate generator,
- guarded `KAJO_CURATED_BETA` seed contains 30 real movies and 30 real books,
- old 24 mock Items are non-discoverable but not deleted,
- all 930 historical mock Event references still resolve,
- V1 hosted acceptance returns only real curated Items after the NULL bootstrap fix,
- PR #192 is merged to `main` at `c08513a3b00cda764004ed8c295466f26dc61e32`.

Still required:

- configured-device confirmation of real Item delivery,
- real posters/covers/descriptions through provider enrichment,
- configure server-only `TMDB_READ_ACCESS_TOKEN`,
- expand beyond the bounded first seed with TMDB/Open Library,
- beta-scale coverage/dedup/metadata review.

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

Curated Items deliberately report `trend=0` and `KAJO_CURATED_RECOGNITION`; no fake live trend is created. Kajo-wide aggregate user trend is not MVP `ColdStartPrior`; it belongs to later privacy-gated `PopulationMemory`. TMDB metadata already normalizes provider `popularity` and `voteCount` into generic Item metadata, so real provider imports can feed this prior without a second recommender or mobile change.

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
- profiling status sees 30 real movies + 30 real books without requiring images,
- 12-card candidate slate is deterministic and remains the prefix of the 24-card extension,
- current curated candidates are inspectably recognition-prior only (`trend=0`),
- controlled six-rating calibration executes without native calibration Events and rollback leaves zero active test rows,
- PR #191 final-head lint/typecheck/tests/iOS+Android bundle smoke passed before merge,
- merged-main validate passed on CI #324.

**Next 14B target:** configured-device real-card + Settings/CSV + no-import profiling acceptance from the merged main APK. #185 remains open until both import and no-import paths are accepted.

### 14C — #177 SharedProfile common-fit

After useful Personal evidence exists, extend the existing Prediction V1 path so SharedProfile ranking can combine:

- neutral `ColdStartPrior` while Shared joint evidence is sparse,
- Shared joint evidence,
- authorized accepted-member PersonalProfile fit (including bootstrap-derived LongTerm taste),
- inspectable minimum-member/consensus behavior,
- disagreement penalty.

The Prediction target remains the SharedProfile. Personal Events/bootstrap history are read through the authorized scoring boundary and are not copied into Shared history. New SharedProfiles may shrink toward the non-personal catalog prior plus accepted-member fit; this is not PopulationMemory and not a second recommender.

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
  -> Prediction V1 + same-Profile ScenarioMemory
  -> reacted/resurfacing + generic Item discoverability
  -> immutable PredictionRun/Candidate trace
  -> frozen Challenger shadows + mature evaluation
  -> manual Profile canary / rollback
```

Imported/calibration history affects LongTerm only. Automatic production genome promotion remains disabled in MVP 0.1. Kajo-derived cross-Profile trend remains future PopulationMemory until privacy/cohort gates exist.

## Current ordered work

1. **Configured-device real-content + Settings/CSV import + no-import profiling acceptance from merged main; then close the remaining #185 / `MVP-BOOT-001..004` gates that pass.**
2. **#177 SharedProfile common-fit using neutral ColdStartPrior + authorized member Personal taste.**
3. Expand #182 catalog with TMDB/Open Library covers/posters/metadata and device-confirm real delivery before beta.
4. Close deferred #102/#138/Room/shell device gates required for beta.
5. **#186 roughly 10-person external beta acceptance.**
6. **Sprint 015 — production auth/security/signing/store release.**
7. Mark MVP 0.1 complete only after the installed store build is accepted by the product owner.

## Repository hygiene

- Follow `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md`.
- One canonical implementation per capability.
- Provider imports normalize into generic Items/bootstrap evidence.
- `ColdStartPrior` is a sparse-evidence Item prior, not a second recommender or PopulationMemory shortcut.
- Personal evidence remains Personal; Shared common-fit reads it rather than copying it.
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
- `/supabase/migrations/20260905003000_seed_curated_beta_catalog.sql`
- `/supabase/migrations/20260905003500_fix_resurfacing_null_bootstrap.sql`
- `/supabase/migrations/20260905010000_profile_cold_start_calibration.sql`
- `/supabase/functions/catalog-import/index.ts`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target: **configured-device real-content/import/cold-start profiling acceptance from merged main, then #177 Shared common-fit**. Do not copy Personal history into Shared history, delete historical mock Items, build a second recommender, treat curated recognition as live trend, bypass PopulationMemory privacy gates, or begin monetization work.