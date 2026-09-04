# Kajo Current Status

Last updated: **2026-09-04**  
Current milestone: **MVP 0.1 — complete non-commercial store release**  
Current sprint: **Sprint 014 — Real Catalog, Profile Bootstrap & External Beta** (`sprints/SPRINT-014.md`)  
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory** (`sprints/SPRINT-013.md`)

This is the authoritative current-state document. Sprint files preserve execution evidence; `ROADMAP.md` owns future sequencing. Avoid duplicating historical narrative here.

## MVP meaning

MVP 0.1 is no longer defined as merely a phone-runnable technical prototype. The product-owner requirement is now:

- fully usable BOOK/MOVIE Kajo with real content,
- useful first-session PersonalProfile from imported history or bounded calibration,
- complete Personal/Shared core flows suitable for roughly 10 external testers,
- production authentication/security/privacy/signing/store readiness,
- officially downloadable Google Play and/or Apple App Store release,
- no monetization requirement yet.

`docs/product/MVP.md` is the requirement authority for this boundary.

## Current product state

Kajo already has:

- one fixed illustrated 2D Room as the authenticated home/backdrop,
- global `DiscoveryMode` control and phase-aware Room atmosphere,
- BOOK/MOVIE discovery, detail and swipe-style browsing,
- hosted Profile-targeted Prediction V1 with complete run/candidate trace,
- Working/Short/Long state plus same-Profile ScenarioMemory,
- versioned reacted-Item suppression plus bounded saved-only reminders,
- controlled SleepLayer/EvolutionEngine with immutable genomes, frozen shadows, mature evaluation, manual Profile canary and rollback,
- PersonalProfile and consent-based 2-N SharedProfiles,
- Shared Endorsement -> unanimous consensus delivery,
- Profile-scoped system/custom Lists and messaging,
- combined invitation/message Inbox,
- accepted bottom Profile identity quick switcher for recent/used SharedProfiles,
- email + nickname identity and email-or-nickname login,
- hosted generic catalog provenance/dedup/discoverability foundation,
- hosted service-only catalog batch-import boundary and ACTIVE `catalog-import` Edge Function,
- mobile catalog enrichment for cover/poster, creators, release year and original language while Prediction V1 remains the ranking authority.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets the Profile; recommendable things remain `Item`s. Provider imports normalize into these same boundaries rather than creating Letterboxd/IMDb/TMDB/Book-specific user or predictor models.

## Acceptance truth

### Accepted

- Sprints 001–010.
- Sprint 011/#151 Shared discovery + Endorsement consensus.
- persistent Room/backdrop/navigation direction and current minimalist straight-on Room contract.
- Sprint 013A Prediction nervous-system evidence spine + ScenarioMemory V1.
- Sprint 013B hosted + configured-Android Personal/Shared Prediction V1 trace gate.
- Sprint 013C controlled SleepLayer serving/evaluation/manual-canary/rollback gate.
- #174 reacted-Item resurfacing policy (`resurfacing-v1`).
- #175 / `MVP-NAV-004` bottom SharedProfile quick switcher on configured Android.

### Implemented/hosted but configured-device acceptance still open

- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171/current Room-lighting/target/profile-hydration follow-up.
- latest merged shell/bootstrap polish: softer bottom identity, rounded Inbox glyph, top-mark alignment and real Kajo loading surface. Automated CI passed; configured-device visual/loading acceptance is still required.

## Sprint 014 — ACTIVE

### 14A — #182 real catalog — importer infrastructure hosted; first real provider data next

The catalog-write/lifecycle foundation and provider import infrastructure are hosted while ordinary discovery still uses the 24 seeded `KAJO_MOCK` Items until accepted real coverage exists.

Hosted repository migrations:

- repo `20260904193000_catalog_provider_foundation.sql` -> hosted `20260904155839 catalog_provider_foundation`,
- repo `20260904193200_fix_catalog_upsert_source_conflict.sql` -> hosted `20260904160033 fix_catalog_upsert_source_conflict`,
- repo `20260904162000_catalog_batch_import_boundary.sql` -> hosted `20260904163011 catalog_batch_import_boundary`.

Current foundation/import slice:

- `public.items` remains the only canonical recommendable table,
- generic Item presentation/lifecycle fields include `discoverable`, `creators`, `release_year`, `image_url` and `original_language`,
- private `ItemSource` stores provider provenance with unique provider+provider-item identity,
- private `ItemExternalId` stores namespaced stable aliases for TMDB/IMDb/ISBN/Open Library and later provider matching,
- service-role-only `public.upsert_catalog_item_v1` provides validated atomic import/dedup,
- service-role-only `public.upsert_catalog_batch_v1` adds a bounded max-50 batch boundary for importer workers,
- shared external aliases can merge another provider record into the same canonical Item; ambiguous aliases fail closed,
- `catalog-import` Edge Function version 1 is ACTIVE and keeps TMDB credentials server-side; it supports bounded TMDB MOVIE page imports with Finnish localization and controlled English fallback,
- TMDB genres normalize by stable genre ID into provider-language-independent generic Kajo tags,
- repository Open Library importer consumes monthly bulk dumps rather than using the public API as Kajo's bulk backend and normalizes edition/work/ISBN/cover metadata into the same Item boundary,
- mobile Prediction V1 results are enriched by one canonical `public.items` batch read with image/creator/year/language metadata without changing rank order or Prediction IDs,
- a bounded delivered-prediction slate cache keeps real hosted Item detail/swipe on the same delivered Item order/trace instead of falling back to a mock sequence,
- grid presentation can show real remote poster/cover imagery and creator/year metadata while mock fallback keeps the existing graphic card,
- normal Prediction candidate generation requires `candidate.discoverable` through the same private V0.3 baseline used by V1/SleepLayer,
- all 24 historical mock Items retain durable `kajo_mock` provenance and remain discoverable until accepted real BOOK/MOVIE coverage exists.

Hosted rollback smoke proved source idempotency, cross-provider alias merging, ambiguous-merge rejection, service-role-only writes and `discoverable=false/true` behavior through actual `rank_items_v1`. The batch boundary additionally proved a two-entry import, idempotent refresh, max-50 rejection, authenticated/anon execute denial, service-role execute allowance and 0 synthetic rows after rollback.

`catalog-import` deployed successfully as ACTIVE version 1. This execution environment could not perform an external HTTP request back into the Edge endpoint, so do not claim its 403/503 runtime paths as live-call accepted yet. The code itself validates the server secret before provider access. `TMDB_READ_ACCESS_TOKEN` is not yet configured, so a real TMDB import remains intentionally blocked until that server secret is supplied.

Automated PR #189 CI #294 passed lint, TypeScript, tests and iOS/Android bundle smoke for the importer/mobile slice before the handoff documentation update. Re-run the final head CI before merge.

Advisor status: no new catalog WARN. New private source tables report expected `RLS enabled/no policy` INFO because authenticated/anon have no table grants; their FK indexes are present. The existing leaked-password-protection WARN remains separate auth/security work.

**Immediate 14A target:** configure the server-only TMDB read token, run the first real TMDB movie pages, run a curated Open Library bulk import, verify useful real BOOK/MOVIE coverage and real cards on configured Android, then retire mock Items from ordinary discovery without deleting historical rows.

### 14B — #185 PersonalProfile bootstrap/import

After canonical provider IDs exist:

- Letterboxd user export ZIP/CSV import,
- IMDb ratings/check-ins/watchlist/list CSV import,
- at least one practical book-history CSV path plus generic Kajo CSV fallback,
- imported watched/read/ratings/saved intent becomes source-tagged canonical Kajo evidence,
- IMDb 1–10 ratings remain 1–10; Letterboxd 0.5–5 stars convert deterministically by x2,
- no rating is fabricated for watched/read-only history,
- re-import must be idempotent and ambiguous matches must be reviewable,
- no-import users get a short real-catalog calibration rather than mandatory demographics,
- native Kajo behaviour progressively supersedes stale bootstrap evidence.

Letterboxd and IMDb both expose user-controlled CSV export paths, so MVP import is deliberately file-based rather than relying on scraping or an assumed personal-history API.

### 14C — #177 SharedProfile common-fit

After real catalog/bootstrap evidence exists, implement `MVP-PRED-005` in the existing Prediction V1 path:

- Shared joint evidence,
- authorized accepted-member PersonalProfile fit,
- minimum-member/consensus behaviour,
- disagreement penalty,
- target remains SharedProfile,
- Personal history is not copied into Shared history,
- no second Shared recommender.

### 14D — #186 external beta

Before Sprint 014 closes, Kajo must be acceptable for roughly 10 external testers with real BOOK/MOVIE data, useful initial personalization, complete Personal/Shared core flows and sufficient diagnostics to investigate failures without developer access to tester phones.

## Sprint 015 — production/store gate after beta

### Authentication — #184 + #127

Before store submission:

- production SMTP/domain for confirmation/recovery,
- Google sign-in,
- Sign in with Apple for iOS when social login is offered,
- all providers link to one canonical Kajo User/nickname/PersonalProfile rather than duplicating identity,
- account deletion/data lifecycle covers linked providers.

Apple's current App Review Guideline 4.8 means Google/social login on iOS cannot be treated as a Google-only release feature; the privacy-preserving equivalent login requirement must be satisfied.

### Hardening / release

- #160 Supabase production security hardening,
- production identifiers/versioning/signing,
- privacy/support/account deletion and error/operations readiness,
- provider attribution/licensing decisions for the non-commercial release,
- store metadata/assets/permissions,
- clean install/update acceptance,
- official Google Play and/or Apple App Store availability.

## Prediction / evolution state

The canonical path remains:

```text
Events / imported bootstrap evidence
  -> Working / Short / Long state
  -> Prediction V1 + same-Profile ScenarioMemory
  -> resurfacing-v1 eligibility/slate policy
  -> generic Item lifecycle/discoverability
  -> immutable PredictionRun + complete Candidate pool
  -> prospective frozen Challenger shadows
  -> mature exposed-outcome EvaluationWindow / GenomeEvaluation
  -> evidence-gated manual Profile canary
  -> reversible rollback
```

Automatic production genome promotion remains **disabled in MVP 0.1**. Imported history is bootstrap evidence, not a reason to enable uncontrolled model evolution.

## Current ordered work

1. **#182 / Sprint 014A — configure provider secret, load real TMDB/Open Library Items, device-accept real cards, then retire mock discovery.**
2. **#185 / Sprint 014B — Letterboxd/IMDb/book history import + no-import calibration.**
3. **#177 / Sprint 014C — SharedProfile common-fit.**
4. Close deferred #102/#138/Room/shell configured-device gates required for beta.
5. **#186 / Sprint 014D — roughly 10-person external beta acceptance.**
6. **Sprint 015 — #184/#127 auth, #160 security, production hardening and official store release.**
7. Mark `MVP 0.1` complete only after the installed store build is accepted by the product owner.

## Repository hygiene / non-duplication rules

- Follow `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md` before starting work.
- One canonical implementation per capability; extend generic Profile/Item/Event/Prediction architecture.
- Provider integrations normalize into generic Items and imported evidence; never create separate mobile catalogs or provider-specific Profile/recommender state.
- Deployed migrations are immutable; corrections use ordered forward migrations.
- `STATUS.md` = current truth, sprint docs = execution/history, `ROADMAP.md` = ordered future work.
- Do not merge speculative empty feature folders, duplicate documentation or unused abstraction layers.
- #160 security work remains separate from catalog/Prediction product changes unless a blocking vulnerability requires immediate action.

## Important files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-014.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/supabase/migrations/20260904193000_catalog_provider_foundation.sql`
- `/supabase/migrations/20260904193200_fix_catalog_upsert_source_conflict.sql`
- `/supabase/migrations/20260904162000_catalog_batch_import_boundary.sql`
- `/supabase/functions/catalog-import/index.ts`
- `/supabase/functions/_shared/catalog-normalizers.mjs`
- `/scripts/catalog/import-open-library.mjs`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target: **Sprint 014A / #182 real provider data load + configured-device acceptance**. Do not mix #185 history import or #177 common-fit scoring into the same PR, delete historical mock Items, rebuild Prediction V1/SleepLayer, or begin monetization work.