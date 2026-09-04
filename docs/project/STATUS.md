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
- useful first-session PersonalProfile through imported history or bounded calibration,
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
- historical 24 `KAJO_MOCK` Items retained but now `discoverable=false`,
- hosted V1 proof of 10/10 real MOVIE + 10/10 real BOOK delivery and 0 mock delivery,
- mobile real-catalog presentation fields without a second recommender,
- hosted PersonalProfile bootstrap-evidence foundation for imported viewing/reading history,
- Letterboxd/IMDb/Goodreads/StoryGraph/generic-CSV normalization,
- PersonalProfile-only Settings import workflow with reviewable ambiguous matches and removable persisted imports.

A bootstrap/resurfacing integration bug discovered by real-data acceptance is also fixed forward: missing bootstrap evidence had propagated SQL NULL into boolean state and incorrectly classified untouched Items as `SAVED_SUPPRESSED`, causing hosted V1 to return no delivery and mobile to fall back to mocks. Untouched real Items now classify `ORDINARY/eligible=true`.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets a `Profile`; recommendable content remains `Item`. Personal evidence is never copied into Shared history. Shared common-fit (#177) may read authorized accepted members' Personal taste through the Prediction boundary.

## Acceptance truth

### Accepted

- Sprints 001–010.
- Sprint 011/#151 Shared discovery + Endorsement consensus.
- persistent Room/backdrop/navigation direction.
- Sprint 013A–C Prediction nervous system + controlled SleepLayer.
- #174 reacted-Item resurfacing policy.
- #175 / `MVP-NAV-004` bottom SharedProfile quick switcher on configured Android.

### Implemented/hosted but configured-device acceptance still open

- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171/current Room-lighting/target/profile-hydration follow-up.
- latest shell/bootstrap visual polish.
- #182 first real 30+30 catalog + mock retirement hosted; device acceptance and provider enrichment still open.
- #185 PersonalProfile history import backend/parser/Settings slice; device acceptance open.
- PR #191 no-import cold-start calibration; branch implementation/hosted backend exists but must be rebased/final-CI/device-tested after the real-catalog fix.

## Sprint 014 — ACTIVE

### 14A — #182 real catalog — FIRST REAL CATALOG HOSTED

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
- V1 hosted acceptance returns only real curated Items after the NULL bootstrap fix.

Still required:

- configured-device confirmation of real Item delivery,
- real posters/covers/descriptions through provider enrichment,
- configure server-only `TMDB_READ_ACCESS_TOKEN`,
- expand beyond the bounded first seed with TMDB/Open Library,
- beta-scale coverage/dedup/metadata review.

### 14B — #185 PersonalProfile bootstrap/import — IMPLEMENTED/HOSTED, DEVICE GATE + CALIBRATION NEXT

Hosted repository migrations:

- `20260904203000_profile_bootstrap_import_foundation.sql`,
- `20260904203200_harden_bootstrap_rating_constraints.sql`,
- `20260904210000_expand_profile_import_stage_limit.sql`,
- `20260904211000_profile_bootstrap_actor_index.sql`,
- `20260904212000_list_profile_import_jobs.sql`.

Current contract:

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

Mobile Settings:

- `Asetukset` is second from bottom in the side drawer, immediately above `Kirjaudu ulos`,
- import controls/instructions are available only while PersonalProfile is active,
- SharedProfile state shows the boundary and `Vaihda omaan Kajoon`,
- flow: select CSV -> parse -> stage summary -> choose/skip ambiguous rows -> commit,
- committed imports remain visible under `Aiemmat tuonnit` and can be removed without touching native Kajo interactions,
- Letterboxd ZIP is currently instructed to be unzipped first; its CSV files are imported directly.

Hosted acceptance already proved:

- controlled stage sample: 3 matched / 1 ambiguous / 1 unmatched,
- manual resolution + commit,
- SharedProfile import/listing denied,
- Profile isolation,
- imported rating suppression,
- old saved-import reminder eligibility,
- import removal deactivates bootstrap evidence,
- empty-profile bootstrap adds LongTerm taste while ShortTerm remains empty,
- 5,000-row guard is active,
- new FK index advisor finding was corrected forward.

PR #191 cold-start follow-up is implemented on `feat/185-cold-start-calibration`: only real non-mock Items, minimum six known ratings, PersonalProfile LongTerm bootstrap only, no demographics, no Shared direct write. Its first CI found a React `set-state-in-effect` lint issue; that branch now contains the clean Profile-ID-scoped state fix. It is intentionally not merged until this real-catalog branch reaches `main`, after which #191 is rebased and revalidated.

**Next 14B target:** configured-device real-card + Settings/CSV + cold-start acceptance against the hosted real catalog. #185 remains open until both import and no-import paths are accepted.

### 14C — #177 SharedProfile common-fit

After useful Personal evidence exists, extend the existing Prediction V1 path so SharedProfile ranking can combine:

- Shared joint evidence,
- authorized accepted-member PersonalProfile fit (including bootstrap-derived LongTerm taste),
- inspectable minimum-member/consensus behavior,
- disagreement penalty.

The Prediction target remains the SharedProfile. Personal Events/bootstrap history are read through the authorized scoring boundary and are not copied into Shared history. No second Shared recommender.

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
Native Events + imported Personal bootstrap evidence
  -> Working / Short / Long state
  -> Prediction V1 + same-Profile ScenarioMemory
  -> reacted/resurfacing + generic Item discoverability
  -> immutable PredictionRun/Candidate trace
  -> frozen Challenger shadows + mature evaluation
  -> manual Profile canary / rollback
```

Imported history affects LongTerm only. Automatic production genome promotion remains disabled in MVP 0.1.

## Current ordered work

1. **Merge #182 first real catalog + NULL bootstrap eligibility fix and device-test real delivery.**
2. **Rebase/finalize PR #191 cold-start calibration; device-test import + no-import bootstrap.**
3. **#177 SharedProfile common-fit using authorized member Personal taste.**
4. Expand #182 catalog with TMDB/Open Library covers/posters/metadata before beta.
5. Close deferred #102/#138/Room/shell device gates required for beta.
6. **#186 roughly 10-person external beta acceptance.**
7. **Sprint 015 — production auth/security/signing/store release.**
8. Mark MVP 0.1 complete only after the installed store build is accepted by the product owner.

## Repository hygiene

- Follow `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md`.
- One canonical implementation per capability.
- Provider imports normalize into generic Items/bootstrap evidence.
- Personal evidence remains Personal; Shared common-fit reads it rather than copying it.
- Deployed migrations are immutable; fixes are ordered forward migrations.
- `STATUS.md` = current truth, sprint docs = execution/history, `ROADMAP.md` = planned sequence.

## Important files

- `/docs/product/MVP.md`
- `/docs/project/sprints/SPRINT-014.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/settings/SettingsScreen.tsx`
- `/apps/mobile/src/features/settings/historyImportParser.ts`
- `/apps/mobile/src/features/settings/historyImportOperations.ts`
- `/supabase/migrations/20260905003000_seed_curated_beta_catalog.sql`
- `/supabase/migrations/20260905003500_fix_resurfacing_null_bootstrap.sql`
- `/supabase/functions/catalog-import/index.ts`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target: **merge first real catalog fix, rebase/finalize PR #191, then configured-device real-content/import/calibration acceptance**. Do not copy Personal history into Shared history, delete historical mock Items, build a second recommender, or begin monetization work.