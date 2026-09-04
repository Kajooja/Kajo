# Sprint 014 — Real Catalog, Profile Bootstrap & External Beta

Status: **ACTIVE — 14A FIRST REAL CATALOG ON MAIN; 14B IMPORT HOSTED + COLD-START PR #191 HOSTED, FINAL CI/DEVICE GATES OPEN**

## Outcome

Turn Kajo into the first product-complete BOOK/MOVIE version suitable for roughly 10 external testers. Sprint 014 closes only when normal discovery uses useful real content, a new PersonalProfile becomes useful in the first session, Shared common-fit exists in the canonical Prediction path, and the product owner accepts an external-beta build.

Monetization and final public-store hardening are Sprint 015 scope.

## 14A — Real provider-backed catalog — #182

Implemented/hosted/main:

- one canonical `public.items` catalog,
- provider provenance + namespaced external-ID dedup,
- generic discoverability/presentation lifecycle,
- service-only atomic and bounded batch import,
- ACTIVE TMDB Edge importer with server-side secrets/localization fallback,
- Open Library bulk-dump importer,
- mobile poster/cover/creator/year enrichment without changing Prediction rank/ID,
- real hosted Item detail/swipe remains on the delivered Prediction slate,
- first guarded beta seed: **30 real MOVIE + 30 real BOOK Items** with `KAJO_CURATED_BETA` provenance,
- historical 24 `KAJO_MOCK` rows remain stored but are `discoverable=false`,
- hosted Prediction V1 acceptance returned 10/10 MOVIE + 10/10 BOOK real Items with **0 mock deliveries**,
- all 930 historical Event references to old mock Item IDs still resolve,
- forward fix `20260905003500_fix_resurfacing_null_bootstrap.sql` corrected bootstrap NULL propagation that had incorrectly classified untouched Items as `SAVED_SUPPRESSED` and caused mobile to fall back to mock cards,
- PR #192 merged to `main` at `c08513a3b00cda764004ed8c295466f26dc61e32` after final CI passed.

Still open:

- configured-device acceptance that the APK renders real titles through the hosted path,
- add real covers/posters and richer descriptions through TMDB/Open Library,
- configure `TMDB_READ_ACCESS_TOKEN` and expand beyond the bounded curated seed,
- run useful coverage/dedup/metadata acceptance at beta scale.

The curated beta seed is a controlled first real catalog, not a replacement for provider ingestion. Historical mock rows are never deleted because Events/Lists/Prediction traces may reference them.

## 14B — PersonalProfile bootstrap/import + no-import profiling — #185

### History import — implemented/hosted

Repository migrations:

- `20260904203000_profile_bootstrap_import_foundation.sql`
- `20260904203200_harden_bootstrap_rating_constraints.sql`
- `20260904210000_expand_profile_import_stage_limit.sql`
- `20260904211000_profile_bootstrap_actor_index.sql`
- `20260904212000_list_profile_import_jobs.sql`

Data contract:

- history import belongs only to the authenticated owner's PersonalProfile,
- SharedProfile is never a direct import target,
- imported provider history is not appended as native Kajo Events,
- private import jobs/staged rows/bootstrap evidence retain source provenance,
- re-import is idempotent snapshot replacement for the provider/dataset,
- import effects can be removed without deleting native Kajo behavior,
- external-ID match is preferred; safe title/year fallback comes second,
- ambiguous/unmatched rows remain explicit until the user chooses or skips,
- across active imports one strongest state per Item wins: `RATED > CONSUMED > SAVED`,
- imported evidence contributes only to LongTerm taste,
- imported evidence does not enter Working/ShortTerm/ScenarioMemory,
- stale bootstrap evidence decays slowly and native Kajo Events progressively dominate it,
- imported RATED/CONSUMED participates in existing reacted-item suppression,
- imported SAVED remains saved intent and uses the existing reminder policy,
- one staged dataset supports up to 5,000 normalized rows.

Parser contract:

- robust quoted CSV parsing,
- Letterboxd ratings/watched/diary/watchlist CSV,
- IMDb ratings/check-ins/watchlist/list CSV with canonical `imdb_title` matching,
- Goodreads-style library CSV,
- StoryGraph CSV,
- generic Kajo CSV fallback,
- IMDb 1–10 remains unchanged,
- Letterboxd/Goodreads/StoryGraph 0.5/1–5 style ratings normalize deterministically to Kajo 1–10,
- watched/read with no rating becomes CONSUMED with no fabricated rating,
- watchlist/to-read becomes SAVED.

Settings UX:

- `Asetukset` is second from bottom in the side drawer above `Kirjaudu ulos`,
- import controls and instructions are shown only for active PersonalProfile,
- SharedProfile state explains the boundary and offers `Vaihda omaan Kajoon`,
- Letterboxd export ZIP is currently unzipped by the user and its CSV selected,
- flow: file picker -> local parse -> hosted stage/match -> summary -> resolve/skip ambiguous/unmatched -> commit,
- persisted imports reload after app restart under `Aiemmat tuonnit`,
- imports can later be removed independently of native Kajo interactions.

Hosted import verification:

- sample stage returned 3 matched / 1 ambiguous / 1 unmatched,
- ambiguous resolution and commit passed,
- SharedProfile import denied,
- PersonalProfile isolation passed,
- imported rating suppression passed,
- aged imported saved reminder eligibility passed,
- import removal deactivated active bootstrap evidence,
- empty/cold-start profile gained imported LongTerm taste while ShortTerm stayed empty,
- 5,000-row function guard verified hosted,
- persistent import listing is PersonalProfile-owner-only and rejects Shared targets,
- bootstrap actor FK advisor finding was fixed with a forward index,
- PR #190 merged to `main` at `d140cab3151530e40688fd95164997ece9de1009` after lint, TypeScript, tests and iOS/Android bundle smoke passed.

### No-import cold start — PR #191 / `cold-start-v1`

PR #191 was rebuilt cleanly on #192 main rather than carrying the old random/image-gated implementation forward. Hosted migration:

- `20260905010000_profile_cold_start_calibration.sql` / hosted `profile_cold_start_calibration`.

Product contract:

- import and profiling are the two intended sparse-PersonalProfile bootstrap paths,
- `ProfileBootstrapGate` allows the user to open Settings/import; returning without enough strong import/native evidence brings profiling back,
- no normal “skip everything” action is offered while sufficient real calibration candidates exist,
- completion requires **6 ratings of known Items**, not 20 mandatory ratings,
- first slate contains **12** deterministic candidates,
- unknown Items are skipped without negative evidence,
- if needed the same ordered slate extends to at most **24** candidates,
- finish is enabled immediately after six ratings; remaining cards are optional,
- after the bounded maximum or technical catalog insufficiency, fail open rather than trap the user,
- only real discoverable non-mock Items are eligible,
- images are optional presentation enrichment and do not gate calibration,
- no demographic input is required,
- calibration is source-tagged `KAJO_CALIBRATION` bootstrap LongTerm evidence; it is not a native Event and never enters Working/ShortTerm/ScenarioMemory.

`ColdStartPrior` / `cold-start-prior-v1` candidate order:

1. provider/catalog trend or popularity when available,
2. provider/catalog recognition when available,
3. explicit recognition-only fallback for the temporary curated beta seed,
4. weak freshness component.

Curated fallback is deliberately inspectable as `KAJO_CURATED_RECOGNITION` with `trend=0`; it must not masquerade as live trend. Provider aggregate popularity/trend is permitted catalog metadata. Kajo-derived cross-Profile trend belongs to future privacy-gated `PopulationMemory`, not this MVP prior.

Hosted cold-start verification:

- status sees 30 real MOVIE + 30 real BOOK Items even though curated images are currently null,
- calibration is available without image dependency,
- first 12 candidates are deterministic, balanced and high-prior,
- requesting 24 preserves the first 12 as an exact prefix and extends the slate,
- current curated slate reports recognition fallback rather than fake trend,
- controlled 6-rating commit executes through the real RPC without producing native calibration Events,
- rollback leaves zero active calibration test rows,
- no `KAJO_MOCK` path exists in calibration eligibility.

### Remaining 14B gate

- final-head PR #191 lint/typecheck/tests/bundle smoke and merge,
- configured-device Settings/drawer/file-picker/import acceptance,
- real CSV acceptance against canonical real Items,
- configured-device 6-of-12-to-24 cold-start acceptance with recognizable BOOK/MOVIE Items,
- first-session recommendation check after imported bootstrap and after calibration bootstrap,
- then mark `MVP-BOOT-001..004` accepted.

## 14C — SharedProfile common-fit — #177 / MVP-PRED-005

Personal choices must influence Shared recommendations without copying Personal history into the SharedProfile.

Implement in the existing Prediction V1 path:

- target remains SharedProfile,
- sparse/new SharedProfile may use the same neutral non-personal `ColdStartPrior` as fallback,
- combine Shared joint evidence with authorized accepted-member PersonalProfile taste,
- Personal taste includes normal Personal Events and bootstrap-derived LongTerm state,
- minimum-member/coverage behavior is inspectable,
- disagreement penalty prevents one member's strong preference from hiding poor fit for another,
- sparse member fit shrinks toward the neutral catalog prior rather than letting one member dominate,
- keep Personal and Shared ScenarioMemory separate,
- persist explanation/trace in the existing Prediction candidate architecture,
- no Personal bootstrap rows are copied into Shared history,
- no second Shared recommender and no PopulationMemory shortcut.

## 14D — External beta gate — #186

Target roughly 10 external testers.

Required flows:

- clean install/account entry,
- useful first-session import or profiling,
- real BOOK/MOVIE discovery/detail/swipe/rating/not-interested/save/List/history,
- Shared create/invite/join/switch/common-fit/Endorsement/List,
- Profile messaging where already in MVP scope,
- repeated-session suppression/reminder behavior,
- backend/runtime failures diagnosable without developer access to tester phones.

## Product decisions

- MVP 0.1 is a complete store-downloadable BOOK/MOVIE product, not a mock prototype.
- No monetization is required yet.
- Demographics are not required for recommendation quality; import/content choices/behavior dominate.
- Letterboxd/IMDb import is user-authorized file import, not scraping.
- Personal import/calibration evidence remains Personal. Shared common-fit reads authorized Personal taste rather than copying evidence.
- Provider aggregate popularity/trend may seed sparse profiles; Kajo-wide aggregate behaviour remains PopulationMemory-gated.
- Do not judge common-fit quality on the historical mock catalog.

## Dependencies

- #182 configured-device real-card acceptance and provider expansion remain required for beta.
- #102 Lists, #138 messaging and Room/shell refreshed device gates remain before beta acceptance.
- stable email auth is needed for beta; production SMTP + Google/Apple store auth is finalized through #127/#184 before store release.
- #160 production security hardening remains release scope unless a blocking beta-safety issue appears.

## Acceptance

- [-] `MVP-CAT-001..003`: first real 30+30 catalog hosted/main and mock delivery retired; device acceptance/provider enrichment still open.
- [-] `MVP-BOOT-001..002`: parser/backend/Settings implemented; real-data device acceptance open.
- [-] `MVP-BOOT-003`: bounded popularity-led no-import profiling implemented/hosted on PR #191; final CI/merge/device acceptance open.
- [-] `MVP-BOOT-004`: idempotent/source-tagged/removable LongTerm contract hosted; device acceptance open.
- [ ] `MVP-PRED-005`: Shared common-fit.
- [ ] deferred List/messaging/Room device gates relevant to beta accepted.
- [x] hosted normal Prediction delivery contains no `KAJO_MOCK` Items; configured-device confirmation still required.
- [ ] import and no-import users both receive useful first-session recommendations on device.
- [ ] #186 external beta accepted by product owner.
- [ ] deterministic handoff to Sprint 015.

## Immediate next action

Finish **PR #191 final CI/merge**, then run configured-device real-content/import/cold-start profiling acceptance. After that implement **#177 SharedProfile common-fit**. Do not copy Personal history into Shared history, create a second recommender, treat curated recognition as live trend or bypass PopulationMemory privacy gates.