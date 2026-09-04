# Sprint 014 — Real Catalog, Profile Bootstrap & External Beta

Status: **ACTIVE — 14A INFRASTRUCTURE READY; 14B HISTORY IMPORT IMPLEMENTED/HOSTED, DEVICE GATE + CALIBRATION NEXT**

## Outcome

Turn Kajo into the first product-complete BOOK/MOVIE version suitable for roughly 10 external testers. Sprint 014 closes only when normal discovery uses useful real content, a new PersonalProfile becomes useful in the first session, Shared common-fit exists in the canonical Prediction path, and the product owner accepts an external-beta build.

Monetization and final public-store hardening are Sprint 015 scope.

## 14A — Real provider-backed catalog — #182

Implemented/hosted:

- one canonical `public.items` catalog,
- provider provenance + namespaced external-ID dedup,
- generic discoverability/presentation lifecycle,
- service-only atomic and bounded batch import,
- ACTIVE TMDB Edge importer with server-side secrets/localization fallback,
- Open Library bulk-dump importer,
- mobile poster/cover/creator/year enrichment without changing Prediction rank/ID,
- real hosted Item detail/swipe remains on the delivered Prediction slate.

Still open:

- configure `TMDB_READ_ACCESS_TOKEN`,
- load curated real TMDB/Open Library datasets,
- verify useful BOOK/MOVIE coverage/dedup/metadata,
- configured-device real-card acceptance,
- only then mark historical `KAJO_MOCK` Items non-discoverable.

Historical mock rows are never deleted because Events/Lists/Prediction traces may reference them.

## 14B — PersonalProfile bootstrap/import — #185

### Implemented/hosted slice

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

Hosted verification:

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
- bootstrap actor FK advisor finding was fixed with a forward index.

Automated repo gate:

- PR #190 implementation CI #306 passed lint, TypeScript, tests and iOS/Android bundle smoke before final documentation commits.

### Remaining 14B gate

- configured-device Settings/drawer/file-picker/import acceptance,
- real CSV acceptance against real canonical provider Items,
- bounded no-import cold-start calibration using recognizable real BOOK/MOVIE Items,
- then mark `MVP-BOOT-001..004` accepted.

## 14C — SharedProfile common-fit — #177 / MVP-PRED-005

Personal choices must influence Shared recommendations without copying Personal history into the SharedProfile.

Implement in the existing Prediction V1 path:

- target remains SharedProfile,
- combine Shared joint evidence with authorized accepted-member PersonalProfile taste,
- Personal taste includes normal Personal Events and bootstrap-derived LongTerm state,
- minimum-member/coverage behavior is inspectable,
- disagreement penalty prevents one member's strong preference from hiding poor fit for another,
- keep Personal and Shared ScenarioMemory separate,
- persist explanation/trace in the existing Prediction candidate architecture,
- no second Shared recommender.

## 14D — External beta gate — #186

Target roughly 10 external testers.

Required flows:

- clean install/account entry,
- useful first-session import or calibration,
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
- Personal import evidence remains Personal. Shared common-fit reads authorized Personal taste rather than copying evidence.
- Do not judge common-fit quality on the tiny historical mock catalog.

## Dependencies

- #182 physical real-data load/device gate remains required for beta.
- #102 Lists, #138 messaging and Room/shell refreshed device gates remain before beta acceptance.
- stable email auth is needed for beta; production SMTP + Google/Apple store auth is finalized through #127/#184 before store release.
- #160 production security hardening remains release scope unless a blocking beta-safety issue appears.

## Acceptance

- [-] `MVP-CAT-001..003`: infrastructure implemented; physical real data/mock retirement/device acceptance open.
- [-] `MVP-BOOT-001..002`: parser/backend/Settings implemented; real-data device acceptance open.
- [ ] `MVP-BOOT-003`: no-import cold-start calibration.
- [-] `MVP-BOOT-004`: idempotent/source-tagged/removable LongTerm contract hosted; device acceptance open.
- [ ] `MVP-PRED-005`: Shared common-fit.
- [ ] deferred List/messaging/Room device gates relevant to beta accepted.
- [ ] no normal discovery delivery from `KAJO_MOCK`.
- [ ] import and no-import users both receive useful first-session recommendations.
- [ ] #186 external beta accepted by product owner.
- [ ] deterministic handoff to Sprint 015.

## Immediate next action

Complete **14B/#185 configured-device import acceptance and no-import calibration**, then implement **#177 SharedProfile common-fit**. In parallel unblock #182 real provider data. Do not copy Personal history into Shared history or create a second recommender.