# Sprint 014 — Real Catalog, Profile Bootstrap & External Beta

Status: **ACTIVE — ALGORITHM COMPLETION GATES ADDED; CATALOG/BOOTSTRAP/SHARED FOUNDATIONS ON MAIN; DEVICE AND EXTERNAL-BETA ACCEPTANCE OPEN**

## Outcome

Turn Kajo into the first product-complete BOOK/MOVIE version suitable for roughly 10 external testers. Sprint 014 closes only when normal discovery uses useful real content, a new PersonalProfile becomes useful in the first session, Shared common-fit exists in the canonical Prediction path, and the product owner accepts an external-beta build.

Monetization and final public-store hardening are Sprint 015 scope.

## 14A — Real provider-backed catalog — #182 / device follow-up #199

Implemented/hosted/main:

- one canonical `public.items` catalog,
- provider provenance + namespaced external-ID dedup,
- generic discoverability/presentation lifecycle,
- service-only atomic and bounded batch import,
- ACTIVE TMDB Edge importer with server-side secrets/localization fallback,
- Open Library monthly bulk-dump importer as the long-term broad import path,
- mobile poster/cover/creator/year enrichment without changing Prediction rank/ID,
- hosted detail/swipe uses remembered catalog Items; exact delivered-slate identity now requires MVP-DATA-004 regression/fix,
- first guarded seed: **30 real MOVIE + 30 real BOOK Items** with `KAJO_CURATED_BETA` provenance,
- historical 24 `KAJO_MOCK` rows remain stored but are `discoverable=false`,
- hosted Prediction V1 acceptance returned real BOOK/MOVIE Items with **0 mock deliveries**,
- all 930 historical Event references to old mock Item IDs still resolve,
- forward fix `20260905003500_fix_resurfacing_null_bootstrap.sql` corrected bootstrap NULL propagation that had incorrectly classified untouched Items as `SAVED_SUPPRESSED` and caused mobile to fall back to mock cards,
- PR #192 merged to `main` at `c08513a3b00cda764004ed8c295466f26dc61e32` after final CI passed,
- bounded Open Library Search beta bootstrap used **13** explicit genre/language buckets and normalized **650 raw rows -> 385 new Work-ID/title-deduplicated BOOK Items**,
- current discoverable BOOK total is **415** (`385 open_library + 30 kajo_curated`),
- Open Library quality gate passed with **385/385 covers, 385/385 creators, 383/385 release years, 57 Items with Finnish editions, 65 with Swedish editions, 0 duplicate discoverable BOOK title groups and 0 discoverable mocks**,
- language-preferred Open Library Edition enrichment matched all 385 provider Items, changed 159 display titles and selected 385 display covers without introducing title collisions,
- provider `readinglog_count`/`ratings_count` normalize into generic `popularity`/`voteCount`, so the existing `ColdStartPrior` uses `PROVIDER_POPULARITY` without a provider-specific ranker,
- `metadata.openLibraryWorkId` mirrors the provider Work ID for repeat-safe admin refresh while private external-ID aliases remain authoritative,
- repeatable beta tooling is `scripts/catalog/open-library-search-beta.mjs` + `import-open-library-search-beta.mjs`: fixed bucket contract, fi/sv language-preferred editions, Work/title dedup, fail-closed coverage gate, provider-friendly request spacing and writes only through `upsert_catalog_batch_v1`,
- PR #196 passed final-head lint/typecheck/catalog tests/iOS+Android bundle smoke and squash-merged to `main` at `d3fe79865f855b8b3df5f42ae1027ed006169687`,
- PR #198 removed initial fallback-to-hosted reorder flash, kept the 600 ms delay only for interaction-driven reranking, virtualized the discovery grid, mounted only near-visible remote images, used Open Library `-M.jpg` grid thumbnails, preserved full detail images, added hero covers/posters, compacted detail metadata and corrected the bottom Profile control contract,
- main run **#346** passed and produced the configured standalone Android APK used for the 2026-09-06 device follow-up,
- hosted catalog recheck on 2026-09-06 confirmed **BOOK 415 discoverable / 385 images** and **MOVIE 30 discoverable / 0 images**.

Still open:

- configured-device acceptance of #199 dense-grid + warm-image-cache follow-up,
- configure `TMDB_READ_ACCESS_TOKEN` and expand MOVIE coverage beyond the 30-title seed with real posters/descriptions,
- enrich BOOK descriptions and stronger ISBN/Edition matching through the monthly Open Library dump path,
- optional Finnish bibliographic enrichment through Finna while respecting separate cover rights,
- provider attribution/licensing review before external/store release.

The bounded Search API importer is a beta seed/refresh mechanism, not Kajo's runtime book backend. The monthly Open Library dumps remain the intended large-scale persisted catalog path. Historical mock rows are never deleted because Events/Lists/Prediction traces may reference them.

### Configured-device follow-up 2026-09-06 — #199

The run #346 APK proved that real BOOK covers arrive, but the current presentation/perceived-loading quality is not yet accepted:

- BOOK scrolling still feels image-limited under continuous downward movement,
- the small image mount window intentionally allowed already-browsed covers to revert to placeholders once outside that window,
- the two-column surface still reads as separated cards instead of a dense visual browse grid,
- MOVIE has no posters because hosted canonical MOVIE image metadata is **0/30**, not because the generic mobile image renderer is missing.

#199 is the bounded follow-up and must preserve the existing Prediction/Event/Profile architecture:

- nearly edge-to-edge two-column rectangular tiles,
- minimal outer margin/gutter and sharp/minimal corners,
- `cover` image fill across the whole tile,
- restrained title/creator presentation as an image overlay instead of large text blocks between cards,
- bounded FlatList virtualization remains,
- once a discovery image URL is loaded/prefetched during the app session it may stay warm for later rows/revisits; this is UI cache only and must not become Prediction evidence,
- prefetch farther ahead than the mounted image window without mounting/downloading the whole 415-item catalog at once,
- add deterministic tests around image-window planning,
- device acceptance is required before #199 is closed.

Do not solve MOVIE posters by scraping or an unofficial image source. Configure the existing server-side TMDB credential/import path.

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

Curated fallback is deliberately inspectable as `KAJO_CURATED_RECOGNITION` with `trend=0`; it must not masquerade as live trend. Provider aggregate popularity/trend is permitted catalog metadata. TMDB and the bounded Open Library beta adapter both normalize provider popularity/recognition into generic metadata, so real provider imports feed the same prior automatically. Kajo-derived cross-Profile trend belongs to future privacy-gated `PopulationMemory`, not this MVP prior.

Hosted cold-start verification:

- status sees 30 real MOVIE + **415 real BOOK** Items; 385 BOOK Items now also have provider covers,
- calibration is available without image dependency,
- first 12 candidates are deterministic, balanced and high-prior,
- requesting 24 preserves the first 12 as an exact prefix and extends the slate,
- curated fallback reports recognition rather than fake trend; Open Library Items report `PROVIDER_POPULARITY`,
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

Implemented/hosted/main; configured-device acceptance still open.

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

Hosted/repository acceptance evidence:

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
- advisor pass introduced no new #177 WARN-level findings; existing leaked-password WARN remains separate #160/#184 release scope,
- PR #194 final-head CI #327 passed lint, TypeScript, tests and iOS/Android bundle smoke,
- PR #194 squash-merged to `main` at `5e1dc9cc993887ab19b943ac0f2a5943d53aa908`.

### Remaining 14C gate

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
- Open Library Search beta bootstrap is bounded/cached admin ingestion; the app never uses Open Library Search as its runtime backend.
- Do not judge common-fit quality on the historical mock catalog.
- Product decision 2026-09-07 promotes #200 contextual Lists, #201 catalog search/filters and #203 authorized Profile-name search into MVP; see ROADMAP 14.6.

## Dependencies

- #182 + #199 configured-device real-card/dense-grid acceptance and **TMDB MOVIE provider expansion** remain required for beta; BOOK beta already has 415 discoverable Items.
- #102 Lists, #138 messaging and Room/shell refreshed device gates remain before beta acceptance.
- stable email auth is needed for beta; production SMTP + Google/Apple store auth is finalized through #127/#184 before store release.
- #160 production security hardening remains release scope unless a blocking beta-safety issue appears. Repository/hosted migration parity for `harden_production_function_boundaries` was restored through PR #162; leaked-password protection remains the known release WARN.

## Acceptance

- [-] `MVP-CAT-001..003`: BOOK beta coverage now has 415 real Items with 385 provider covers; MOVIE remains 30-title seed with 0 images, #199 device presentation/cache acceptance and provider expansion are open.
- [-] `MVP-BOOT-001..002`: parser/backend/Settings implemented; real-data device acceptance open.
- [-] `MVP-BOOT-003`: bounded popularity-led no-import profiling implemented/hosted/main; configured-device acceptance open.
- [-] `MVP-BOOT-004`: idempotent/source-tagged/removable LongTerm contract hosted/main; device acceptance open.
- [-] `MVP-PRED-005`: Shared common-fit v1.1 implemented/hosted/main; configured-Android acceptance open.
- [ ] deferred List/messaging/Room device gates relevant to beta accepted.
- [x] hosted normal Prediction delivery contains no `KAJO_MOCK` Items; configured-device confirmation of current product presentation remains open.
- [ ] import and no-import users both receive useful first-session recommendations on device.
- [ ] #186 external beta accepted by product owner.
- [ ] deterministic handoff to Sprint 015.

## Immediate next action

Follow `STATUS.md` and ROADMAP 14.0: bootstrap-only Personal serving correction with SQL regression foundation. Owner APK #350 testing and existing TMDB ingestion can proceed independently. Do not close #199/#182 or claim first-session quality before acceptance. Required algorithm/evidence work now precedes the external-beta gate.

## Continuation checkpoint — 2026-09-06

PR #205 delivered the bounded TMDB beta orchestrator (`scripts/catalog/import-tmdb-beta.mjs`, `npm run catalog:tmdb-beta`) at `41c537eb`. Main #352 validation passed including both bundle smoke checks; its APK job was still running at the check. Hosted import has not run in this continuation. Current coverage, credential prerequisites and the executable next step are maintained in `../STATUS.md`. The SQL recheck also found zero nonblank BOOK descriptions. #182 and #199 were reopened because their actual catalog/device acceptance remains pending. Partial PRs must not auto-close these parent gates. No MVP requirement was marked complete.


## Scope and reliability checkpoint — 2026-09-07

The owner made algorithm correctness/adaptation and production completeness the priority. ROADMAP 14.0–14.8 now owns the remaining order within this active sprint. Earlier 14A–14D sections record delivered foundations; they do not waive the newly required ALG/DATA/OPS/UX and browse acceptance in MVP.md.

Before external beta, additionally require bootstrap-driven serving, exact/atomic evidence, serving-shadow parity, refill/continuation, adaptive state/common features, running bounded SleepLayer evaluation, promoted browse suggestions and safe-beta lifecycle/operations. Documentation-only changes have not fixed these code gaps or provisioned services. Current findings and the exact active handoff live in STATUS.md.


## Pre-APK verification — 2026-09-07

- Main APK #352 is now confirmed successful and available; current build link and acceptance state are in STATUS.md.
- `fix/pre-apk-import-dependency` declares the existing Expo-compatible `expo-file-system` 57.0.5 directly in mobile/package-lock because Settings imports it directly. No dependency upgrade, algorithm change or migration is included.
- `npm run check` passed on the final dependency change: lint, TypeScript, all 187 mobile tests, catalog tests and both iOS/Android bundle smoke exports. No Android emulator/phone runtime is available in this workspace, so file-picker and grid/cache device acceptance stay open.
- Public-source migration filter whitespace mismatch is tracked in #208 as a prerequisite of #207 SQL replay coverage. Both algorithm/bootstrap acceptance and full database replay remain open; no deployed migration was rewritten.
- PR #206 remains pending merge approval. This continuation is a dependent branch; resolve the documentation PR before retargeting/merging its follow-up. Do not mark Sprint 014 or any new MVP requirement complete.


## Bootstrap serving checkpoint — 2026-09-07, pending branch

- `fix/207-bootstrap-personal-ranking` depends on #209/#206. #207 stays open.
- Forward migration `20260907155201_bootstrap_personal_ranking.sql` reuses bootstrap selection/strength/decay for memory and direct Personal base ranking. It writes `prediction-v0.4-bootstrap` in base/V1 version metadata and preserves the existing V1 policy/trace body otherwise.
- CSV/calibration successes and import removal notify mounted rankings, including authorized Shared common-fit, through a bounded session-only revision; no scoring runs on the client.
- SQL fixtures reproduce the old missing-bootstrap effect and verify opposite tastes, removal/replacement, neutral/future/duplicate sources, BOOK-to-MOVIE shared tags, native/undo controls, Shared isolation, authorization, private function privileges and unchanged V1 policy definition apart from base version. These are function unit tests, not full migration replay or hosted public V1 execution.
- Final `npm run check` passed: lint/typecheck, 191 mobile tests, 14 catalog tests, 15 SQL runner tests (including the enclosing test) and iOS/Android bundle exports. SQL tests join the canonical npm test/CI gate. No deployed migration was edited, no hosted change was applied, and no new requirement is marked complete. Full replay (#208), hosted V1 acceptance and device acceptance remain open.
- Expo Metro was started offline successfully; React Native DevTools could not launch in this root container (Electron sandbox restriction). No device/emulator interaction was tested. Main CI produces the next APK only after approved merges; do not poll its completion.

### Next configured APK checklist

Use the next APK that includes the pending mobile changes **after** the forward migration passes deployment verification. The existing #352 APK is suitable for earlier grid/cache checks but lacks the new refresh behavior.

1. Existing account: sign in, open BOOK/MOVIE, open/close a card, switch Personal/Shared and confirm the right Profile and content remain active.
2. BOOK grid: scroll down and back; check dense two-column layout, cover fill and already-viewed covers. Movie posters remain a separate catalog gate until official provider enrichment is configured.
3. History import: first open discovery, then Settings. Cancel the picker once; then import a real supported CSV, review uncertain matches and commit. Return to discovery without restarting: a fresh hosted ranking must arrive, and imported consumed/rated Items must not appear as unseen.
4. Import removal: remove that source, return without restarting and confirm a fresh ranking. Native Kajo ratings/Lists must remain. Exact ordering need not revert after intervening native behavior.
5. No-import account: rate six known Items; unknown skips are neutral, the 12-to-24 bound/fail-open remains, and discovery works immediately after completion.
6. Compare personalization using enough matched, contrasting tastes: explainable changes in similar unseen Items, including risk-mode switching. A single pair of real-world lists is not a statistical quality guarantee.
7. Shared Profile: after Personal import/removal, switch back and verify authorized shared recommendations still work, without exposing or copying Personal history. Exercise pending List approval and consensus once.
8. Failed import/network interruption: show a recoverable error, do not falsely report success, and retry after reconnecting. Check ordinary rating, save and undo still advance/restore the intended card.

Report the APK/run identifier, Profile type, exact steps and screenshot for any failure. This checklist does not close the separate production, retention, SleepLayer or full-beta gates.


## Authorized deployment checkpoint — 2026-09-07

- Owner approved merges/deployment; #206 and #209 are merged. PR #210 is the remaining active branch.
- Hosted forward migration `20260907155201_bootstrap_personal_ranking.sql` applied successfully. Git filename was synchronized to the recorded hosted version without changing its SQL payload.
- `scripts/database/bootstrap-ranking.hosted-smoke.sql` passed authenticated public V1 bootstrap contribution, import-removal refresh of backend scores, outsider denial and persisted base version. The transaction rolled back all synthetic accounts, catalog/evidence rows and prediction traces. This is a bounded integration smoke, not full replay, Shared/Auth lifecycle or device acceptance.
- Earlier pending-deployment statements above describe the prior checkpoint. Current truth is in STATUS. #208 replay and #207 remaining acceptance stay open. APK testing is deferred; do not poll builds.


## Replay diagnostic checkpoint — 2026-09-07

- PR #210 merged at `dd53c0c371132efaff1efc196ba81ce7369102d6` after CI #359 passed. No APK polling or device acceptance.
- Branch `test/208-migration-replay-diagnostic` adds `npm run diagnose:database-replay`: complete unmodified files, per-file transactions, immediate error/exit 1. PGlite 0.3.14 uses explicit minimal platform fixtures; no new dependency.
- Reproduced #208 after 33 successful migrations at catalog provider foundation (`P0001`, expected candidate filter missing). This command intentionally remains failing until replay is actually repaired. It is separate from green function-unit checks, and no failed migration is skipped.
- No deployed migrations changed. Next document/validate a clean-install baseline strategy with archived immutable history and parity checks; a later forward migration cannot repair an earlier fresh-install failure. Full Supabase stack validation requires another execution environment because Docker/Postgres are unavailable here. #208/#207 acceptance stays open.


## Historical integrity checkpoint — 2026-09-07

- PR #211 merged at `ece70f5aa8ba5ae46b3f8481987be455f44c794f` after CI #361 passed.
- `test/208-migration-history-integrity` protects the 47 current migration files with a repository-provenance SHA-256 manifest. Two automatic tests reject changed/deleted history, duplicate versions and backdated new migrations. Future forward migrations remain allowed.
- Proposed ADR-0006 defines the separate empty-install baseline proof: schema/ACL/system-seed provenance and parity, repeatable pinned Supabase installation, synthetic Personal/Shared tests and independent existing-database upgrade verification. No baseline SQL or hosted/history change is included.
- The old chronological replay remains blocked at #208; passing history-integrity/unit tests does not satisfy it. Next schema-only capture and difference review. No APK polling or device acceptance.


## Migration tracking comparison — 2026-09-07

- PR #212 remains open: earlier CI #363 passed, but automatic approval review rejected its merge pending explicit approval for this PR. Parity additions stay on the same branch.
- Read-only metadata comparison: 47 repository files, 44 hosted rows, 5 exact version/name matches, 38 same-name/different-version repository entries, 4 repository names absent from hosted tracking and one repeated hosted name. Tracking mismatch does not establish missing schema. No history repair or hosted mutation.
- Added `migration-parity.mjs` and four regression tests; actual metadata returns MISMATCH/exit 1. No raw hosted snapshot is committed. This checker complements the immutable-file manifest and does not assert equivalent SQL from matching names.
- Schema-only export remains uncompleted: pg_dump/Docker and a direct export connection are unavailable. Next establish pinned export tooling and reconcile tracking with schema definitions. Baseline/replay acceptance remains open. No APK polling.

## Function parity checkpoint — 2026-09-07 / #208

- Continued accepted `main` `32a3a3f` on `test/208-function-schema-parity`; #212 and #216 are merged. Historical open-PR statements above are superseded.
- Added read-only function fingerprint SQL and a strict comparator with deterministic PGlite regressions for body literals, SECURITY DEFINER/search path, owners, grants/grant options, overload removal, malformed/empty inputs and major-version differences.
- Hosted PostgreSQL 17.6 query returned 123 function/procedure fingerprints (40 public / 83 private). Four functions defined by the latest bootstrap migration matched the existing repository SQL fixtures exactly in definition, owner and direct ACL. Optional fixture snapshot makes this limited comparison repeatable; ADR-0006 owns usage and exclusions.
- No hosted schema/data/history mutations, migration rewrites, new dependencies or APK build requests. Full schema-only export and Supabase installation/upgrade proof remain open; this diagnostic does not close #207/#208 or MVP-ALG-009.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. Final empty-ACL regression also passed. No device acceptance was performed.

## V1 definition parity checkpoint — 2026-09-08 / #208

- PR #217 merged at `42d605a` after owner approval and green CI #371.
- Follow-up `test/208-v1-definition-parity` extends the existing optional fixture snapshot to the complete `private.rank_items_v1_internal`. All five scoped definitions, owners and direct ACLs matched hosted PostgreSQL 17.6, including the V1 policy/trace function reconstructed from canonical patches.
- No runtime defect was found in this comparison; no hosted schema/history/data changes. Full installation proof remains open. Docker/pg_dump/psql/Supabase CLI are absent and no separate Supabase development branch exists. STATUS now names the environment prerequisite instead of sending a fresh agent back to merged PR #217.

- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. The optional five-function export and hosted comparison also passed. No device test or APK polling.

## Supplied export checkpoint — 2026-09-08 / #208

- #218 merged at `2d1b0d5`; owner supplied `kajo-schema.sql` from the pinned CLI export workflow. STATUS/ADR-0006 retain its checksum and exact next steps.
- Whole export loads unchanged into two disposable PGlite databases: 30 empty RLS-enabled tables, 205 constraints, 19 policies, 123 functions. All 123 function definitions/owners/direct ACLs match fresh hosted metadata. This comparison does not establish canonical repository equivalence for the remaining objects.
- Confirmed missing Auth provisioning trigger (present hosted), event triggers and model/policy system seeds. No hosted changes or migration rewrites. The uploaded DDL remains unaccepted source material, not a committed installation baseline.
- Added checksum-gated offline export diagnostic. Wrong checksum and an export containing an application row are rejected. Actual Supabase/Auth/Shared runtime, seed reconstruction and forward-upgrade acceptance remain open.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. Two export installations, full hosted function comparison and negative checksum/data checks passed separately. No device/APK acceptance or hosted write.

### Local rollback-only probe continuation

- Owner confirmed CLI 2.117.0 local Supabase starts on Mac. Same #219 branch now includes a Mac-only local Docker runner and exact-export probe builder; no additional dependency.
- Temporarily loads schema, canonical Auth trigger and three SleepLayer seed statements, verifies automatic PersonalProfile membership, runs authenticated bootstrap V1/import-removal/outsider/trace smoke, then rolls back the entire experiment. Existing Auth/application tables prevent execution.
- Full probe passed twice in PGlite; rollback restored empty state. Nonempty-database guard preserved an existing test table/row. Mac/platform execution is pending. Probe seeds are not a deterministic baseline bundle; Shared/platform/upgrade/replay gates remain open.

### Owner Mac result and Shared probe extension — 2026-09-08

- Owner reported original #219 probe PASS on local Supabase Postgres 17.6.1.167;
  all changes rolled back. ADR-0006 retains exact image ID and scope. This
  supersedes the preceding pending-Mac statement for the original probe only.
- Expanded rollback-only probe covers both accepted Shared members, aggregate-only
  explanation without member/PersonalProfile IDs, outsider and revoked-member
  denial, and exactly two versioned Shared traces. Synthetic membership setup does
  not validate invitations/consent or recommendation quality.
- Expanded full export + Auth + Shared + Personal probe passed twice in PGlite;
  expanded Mac run remains pending. No historical migration or hosted data changed.
- Next continue export/source reconciliation and deterministic seed supplements;
  complete pinned installs/platform/forward-upgrade gates remain open under #208.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database
  tests and iOS/Android bundle smoke. Expanded export probe passed separately twice.
