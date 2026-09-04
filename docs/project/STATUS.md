# Kajo Current Status

Last updated: **2026-09-04**  
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
- mobile real-catalog presentation fields without a second recommender,
- hosted PersonalProfile bootstrap-evidence foundation for imported viewing/reading history,
- Letterboxd/IMDb/Goodreads/StoryGraph/generic-CSV normalization,
- PersonalProfile-only Settings import workflow with reviewable ambiguous matches and removable persisted imports.

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
- #182 real-catalog mobile presentation/import infrastructure; physical real provider data/device acceptance still open.
- #185 PersonalProfile history import backend/parser/Settings slice; device acceptance and no-import calibration still open.

## Sprint 014 — ACTIVE

### 14A — #182 real catalog

Implemented/hosted:

- canonical `public.items` lifecycle/presentation fields,
- private provider provenance + namespaced external IDs,
- service-only atomic and max-50 batch catalog upsert,
- TMDB Edge importer with server-side credential boundary, Finnish localization and English fallback,
- Open Library monthly-dump importer,
- Prediction V1 mobile enrichment with covers/posters, creators and year,
- real hosted Item detail/swipe preserves the delivered Prediction slate,
- `discoverable` remains part of the one canonical Prediction candidate generator.

Still required:

- configure server-only `TMDB_READ_ACCESS_TOKEN`,
- load useful real TMDB and Open Library data,
- inspect coverage/dedup/metadata,
- configured-device real-card acceptance,
- then set historical `KAJO_MOCK` Items non-discoverable without deleting them.

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

**Next 14B target:** configured-device Settings/CSV import acceptance, then implement the real-catalog no-import cold-start calibration flow. #185 remains open until both paths are accepted.

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

1. **Finish #185 device import acceptance + no-import real-catalog calibration.**
2. **#177 SharedProfile common-fit using authorized member Personal taste.**
3. In parallel unblock #182 physical real data: TMDB secret + TMDB/Open Library loads + device acceptance + retire mock discovery.
4. Close deferred #102/#138/Room/shell device gates required for beta.
5. **#186 roughly 10-person external beta acceptance.**
6. **Sprint 015 — production auth/security/signing/store release.**
7. Mark MVP 0.1 complete only after the installed store build is accepted by the product owner.

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
- `/supabase/migrations/20260904203000_profile_bootstrap_import_foundation.sql`
- `/supabase/functions/catalog-import/index.ts`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target: **Sprint 014B / #185 device import acceptance + cold-start calibration**, then #177 SharedProfile common-fit. Do not copy Personal history into Shared history, delete historical mock Items, build a second recommender, or begin monetization work.