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
- email + nickname identity and email-or-nickname login.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets the Profile; recommendable things remain `Item`s. Provider imports must normalize into these same boundaries rather than creating Letterboxd/IMDb/TMDB/Book-specific user or predictor models.

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

### 14A — #182 real catalog — immediate implementation target

The current discovery catalog is still a tiny seeded `KAJO_MOCK` set. Replace normal discovery with a real provider-backed catalog while preserving `public.items` as the only canonical recommendable Item table.

Direction:

- MOVIE: TMDB server-side provider import/refresh with localization fallback,
- BOOK: Open Library bulk-based initial import; optional Finna bibliographic enrichment for Finnish metadata where rights permit,
- generic provider provenance/external-ID dedup/lifecycle/discoverability,
- real cover/poster metadata only under accepted provider rights,
- normalize provider genres/subjects into Kajo tags,
- preserve historical mock Items for Event/List/Prediction referential integrity but remove them from normal discovery after acceptance,
- start with hundreds/thousands of useful Items rather than millions,
- Prediction V1/SleepLayer remain generic and unchanged by provider identity.

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
  -> immutable PredictionRun + complete Candidate pool
  -> prospective frozen Challenger shadows
  -> mature exposed-outcome EvaluationWindow / GenomeEvaluation
  -> evidence-gated manual Profile canary
  -> reversible rollback
```

Automatic production genome promotion remains **disabled in MVP 0.1**. Imported history is bootstrap evidence, not a reason to enable uncontrolled model evolution.

## Current ordered work

1. **#182 / Sprint 014A — real catalog foundation and provider import.**
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
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/supabase/migrations/20260826203000_backend_foundation.sql`
- `/supabase/migrations/20260827073000_seed_mvp_items.sql`
- `/supabase/migrations/20260831163000_expand_mvp_candidate_catalog.sql`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target: **Sprint 014A / #182 real catalog**. Do not mix #185 import parsing or #177 common-fit scoring into the same PR, delete historical mock Items, rebuild Prediction V1/SleepLayer, or begin monetization work.
