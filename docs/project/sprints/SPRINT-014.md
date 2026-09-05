# Sprint 014 — Real Catalog, Profile Bootstrap & External Beta

Status: **ACTIVE — 14A REAL CATALOG ON MAIN; 14B IMPORT + COLD-START ON MAIN; 14C SHARED COMMON-FIT HOSTED, DEVICE GATE OPEN**

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

### History import — implemented/hosted/main

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

### No-import cold start — merged PR #191 / `cold-start-v1`

PR #191 was rebuilt cleanly on #192 main rather than carrying the old random/image-gated implementation forward, passed final-head lint/typecheck/tests/iOS+Android bundle smoke, and merged to `main` at `0cfa9e73d14f66e309bae937d66124b88c0477c2`. Hosted migration:

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

Curated fallback is deliberately inspectable as `KAJO_CURATED_RECOGNITION` with `trend=0`; it must not masquerade as live trend. Provider aggregate popularity/trend is permitted catalog metadata. TMDB normalization already writes `popularity` and `voteCount` into generic Item metadata, so real provider imports feed the same prior automatically. Kajo-derived cross-Profile trend belongs to future privacy-gated `PopulationMemory`, not this MVP prior.

Hosted cold-start verification:

- status sees 30 real MOVIE + 30 real BOOK Items even though curated images are currently null,
- calibration is available without image dependency,
- first 12 candidates are deterministic, balanced and high-prior,
- requesting 24 preserves the first 12 as an exact prefix and extends the slate,
- current curated slate reports recognition fallback rather than fake trend,
- controlled 6-rating commit executes through the real RPC without producing native calibration Events,
- rollback leaves zero active calibration test rows,
- no `KAJO_MOCK` path exists in calibration eligibility,
- merged-main validate passed on CI #324.

### Remaining 14B gate

- configured-device Settings/drawer/file-picker/import acceptance,
- real CSV acceptance against canonical real Items,
- configured-device 6-of-12-to-24 cold-start acceptance with recognizable BOOK/MOVIE Items,
- first-session recommendation check after imported bootstrap and after calibration bootstrap,
- then mark `MVP-BOOT-001..004` accepted.

## 14C — SharedProfile common-fit — #177 / MVP-PRED-005

Implemented/hosted on branch `feat/177-shared-common-fit-v1`; device acceptance still open.

The implementation extends the existing `private.rank_items_v1_internal` / `public.rank_items_v1` path. Prediction target remains SharedProfile and no second recommender exists.

Current `shared-common-fit-v1.1` contract:

- sparse/new SharedProfile receives a small neutral `ColdStartPrior` component,
- accepted members are resolved through `profile_members` and each member's canonical PersonalProfile,
- Personal fit uses source-tagged bootstrap/native LongTerm plus native ShortTerm summaries without copying Personal rows into Shared history,
- sparse member estimates shrink toward the neutral catalog prior using evidence-strength reliability,
- aggregate mean/member-minimum fit contributes positively only when it exceeds the neutral prior,
- agreement above the prior earns a consensus component,
- member-fit range produces a bounded disagreement penalty,
- neutral prior contribution decays as SharedProfile's own evidence count grows,
- Shared joint state and same-Profile ScenarioMemory remain first-class existing V1 inputs,
- PersonalProfile ranking is an explicit no-op: old `scenario-memory-v1+resurfacing-v1` policy remains and common-fit contribution is zero,
- Shared PredictionRun policy version is `scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1`,
- PredictionCandidate explanation exposes only safe aggregates (`memberCount`, coverage, mean/min fit, consensus, disagreement, neutral prior, contribution), never member IDs, PersonalProfile IDs or raw history,
- private helper functions have no authenticated/anon execute grants; mobile continues through `public.rank_items_v1` only.

Hosted implementation history is immutable:

- `20260905113000_shared_common_fit_v1.sql` — first hosted common-fit version,
- `20260905114500_harden_shared_common_fit_v1_1.sql` — v1.1 context/reliability/ShortTerm/prior-decay hardening,
- `20260905115500_fix_shared_common_fit_personal_policy.sql` — forward fix preserving the PersonalProfile policy-version/no-op branch.

Hosted acceptance evidence:

- deterministic agreement control: contribution **+4.088**,
- deterministic sparse control: neutral-prior-only contribution **+0.0675**,
- deterministic disagreement control: contribution **−2.5945**, including **2.5** disagreement penalty,
- real hosted two-member SharedProfile run returns `shared-common-fit-v1.1` inside the canonical Prediction V1 trace,
- real run shows item-specific disagreement penalties and positive consensus components,
- candidate explanations contain no actor User ID or PersonalProfile ID and declare `AGGREGATE_ONLY`,
- PersonalProfile control returns `sharedCommonFit.applicable=false`, contribution `0`, and preserves `scenario-memory-v1+resurfacing-v1`,
- authenticated/anon cannot execute private common-fit config/context/candidate helpers; authenticated can still execute `public.rank_items_v1`,
- 10-result Shared hosted smoke measured about **136 ms** in the current development environment; this is a development baseline, not a production SLO,
- test PredictionRuns/candidates were removed after acceptance; zero tagged test-run residue remains,
- advisor pass introduced no new #177 WARN-level findings; existing leaked-password WARN remains separate #160/#184 release scope.

### Remaining 14C gate

- repository PR/CI/merge to `main`,
- configured Android SharedProfile acceptance with real Items and a persisted V1 trace,
- only then mark `MVP-PRED-005` complete and close #177.

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
- [-] `MVP-BOOT-003`: bounded popularity-led no-import profiling implemented/hosted/main; configured-device acceptance open.
- [-] `MVP-BOOT-004`: idempotent/source-tagged/removable LongTerm contract hosted/main; device acceptance open.
- [-] `MVP-PRED-005`: Shared common-fit v1.1 implemented/hosted; repository merge and configured-Android acceptance open.
- [ ] deferred List/messaging/Room device gates relevant to beta accepted.
- [x] hosted normal Prediction delivery contains no `KAJO_MOCK` Items; configured-device confirmation still required.
- [ ] import and no-import users both receive useful first-session recommendations on device.
- [ ] #186 external beta accepted by product owner.
- [ ] deterministic handoff to Sprint 015.

## Immediate next action

Finish #177 repository PR/CI/merge, then run one configured-device acceptance pass covering **real content + Settings/import + cold-start profiling + Shared common-fit**. Keep Personal history in PersonalProfile, do not create a second Shared recommender, do not expose member-level raw evidence, and do not bypass PopulationMemory privacy gates.