# Sprint 014 — Algorithm Reliability, Real Catalog & Profile Bootstrap

Status: **ACTIVE — PHASE 14 ACCEPTANCE OPEN; DELIVERED FOUNDATIONS ON MAIN**

## Outcome and current scope

Complete ROADMAP Phase 14: clean-database/bootstrap correctness, trustworthy action/delivery evidence, serving/shadow parity and candidate availability, real catalog/features, adaptive memory/policy and operating bounded SleepLayer evaluation. Current requirements and acceptance belong to [MVP.md](../../product/MVP.md) and [ROADMAP.md](../ROADMAP.md).

The 2026-09-07 Taste-first release decision supersedes the old Sprint 014 external-beta / Sprint 015 store-close schedule. Taste acquisition is Phase 15, Friends/Shared is Phase 16, core UX/operations is Phase 17, complete-flow closed beta is Phase 18, production/stores are Phase 19 and owner acceptance is Phase 20. Monetization is outside MVP 0.1.

[STATUS.md](../STATUS.md) owns the exact next task. #208/#207 are technically complete through #223. Delivery #224 / PR #225 implements the first Phase 14.1 atomic/durable Item actions; Delivery #226 implements List/Shared commands and their durable mobile path; exact delivered provenance follows. PR #219's source/platform experiments are completed evidence.

## How to read this record

The 14A–14D sections below preserve earlier foundation deliveries and device evidence. Their labels are historical work packages, not the current numbered ROADMAP phases. Catalog counts and hosted evidence are dated checkpoints, not a live inventory. Dated continuation entries later in this file preserve what was pending then; the current STATUS overrides their old next-step instructions. The [2026-09-09 retro](../retros/2026-09-09.md) records the reconciliation.

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
- Product decision 2026-09-07 promotes #200 contextual Lists, #201 catalog search/filters and #203 authorized Profile-name search into MVP; see current ROADMAP 17.0.

## Dependencies

- #182 + #199 configured-device real-card/dense-grid acceptance and **TMDB MOVIE provider expansion** remain required for beta; BOOK beta already has 415 discoverable Items.
- #102 Lists, #138 messaging and Room/shell refreshed device gates remain before beta acceptance.
- #127 owns production email; #184 owns Google/Apple identity linking and taste-preserving conversion in Phase 15.1. Both precede the complete-flow beta in Phase 18.
- #160 production security hardening remains release scope unless a blocking beta-safety issue appears. Repository/hosted migration parity for `harden_production_function_boundaries` was restored through PR #162; leaked-password protection remains the known release WARN.

## Current acceptance

Phase 14 exits only when its ROADMAP 14.0–14.5 gates have evidence, including the following still-open work:

- [-] `MVP-ALG-001..009`: bootstrap/replay foundations are implemented in part; serving/shadow, candidates, adaptive state/features/modes/cold start and operating evaluation acceptance remain open. Individual statuses are in MVP.md.
- [ ] `MVP-DATA-003..004`: atomic actions, durable outbox and exact delivery provenance.
- [-] `MVP-PRED-006`: trace foundation exists; complete delivery/evidence acceptance remains open.

- [-] `MVP-CAT-001..003`: BOOK beta coverage now has 415 real Items with 385 provider covers; MOVIE remains 30-title seed with 0 images, #199 device presentation/cache acceptance and provider expansion are open.
- [-] `MVP-BOOT-001..002`: parser/backend/Settings implemented; real-data device acceptance open.
- [-] `MVP-BOOT-003`: bounded popularity-led no-import profiling implemented/hosted/main; configured-device acceptance open.
- [-] `MVP-BOOT-004`: idempotent/source-tagged/removable LongTerm contract hosted/main; device acceptance open.
- [-] `MVP-PRED-005`: Shared common-fit v1.1 implemented/hosted/main; configured-Android acceptance open.
- [x] hosted normal Prediction delivery contains no `KAJO_MOCK` Items; configured-device confirmation of current product presentation remains open.
- [ ] import and no-import users both receive useful first-session recommendations on device.
- [ ] deterministic handoff to Phase 15 Taste acquisition after Phase 14 acceptance.

Deferred release gates retain their own owners: refreshed List/messaging/Room acceptance in Phase 17; #186 full-flow closed beta in Phase 18. They are not claimed complete here.

## Immediate next action

Finish the current #208 operational PR according to [STATUS.md](../STATUS.md), then implement ROADMAP 14.1 atomic actions, persistent outbox and exact delivery origin. ADR-0006 explicitly adopts the local/CI lineage and the replacement clean-install criterion. #207/#208 technical closure does not close #199/#182, device, catalog or algorithm-quality gates.

## Continuation checkpoint — 2026-09-06

PR #205 delivered the bounded TMDB beta orchestrator (`scripts/catalog/import-tmdb-beta.mjs`, `npm run catalog:tmdb-beta`) at `41c537eb`. Main #352 validation passed including both bundle smoke checks; its APK job was still running at the check. Hosted import has not run in this continuation. Current coverage, credential prerequisites and the executable next step are maintained in `../STATUS.md`. The SQL recheck also found zero nonblank BOOK descriptions. #182 and #199 were reopened because their actual catalog/device acceptance remains pending. Partial PRs must not auto-close these parent gates. No MVP requirement was marked complete.


## Scope and reliability checkpoint — 2026-09-07

The owner made algorithm correctness/adaptation and production completeness the priority. At that checkpoint ROADMAP 14.0–14.8 owned the order; the later Taste-first decision superseded those phase numbers with the current Phase 14–20 sequence. Earlier 14A–14D sections record delivered foundations; they do not waive the newly required ALG/DATA/OPS/UX and browse acceptance in MVP.md.

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

### System-seed source checkpoint — 2026-09-08

- Added a checksum-verified source reconstruction for the initial four
  PredictorGenomes, four promotion decisions and baseline PolicyAssignment. It
  reads only the immutable SleepLayer migration and refuses to overwrite output.
- Source/model identities are deterministic; the initial policy's effective time
  remains installation time by design. No hosted data or learning rows are used.
- Validation: 24 database tests passed, including source-boundary, semantic-key
  and no-overwrite regressions. Pinned full-install/platform/upgrade gates remain
  open.

### Prior-change audit — 2026-09-08 / #219

- Restored STATUS and this checkpoint after truncated API payloads corrupted the
  remote documentation. Future uploads must match the entire tested Git tree SHA.
- Fixed seed source verification: changed source/weight now fails on checksum.
- Removed the CI test's hard-coded conversation attachment. The explicit offline
  export diagnostic now checks all 21 application-table trigger definitions and
  enabled states against protected migration source; both export installs pass.
- Preserved immutable history, public/privileged boundaries and #208's open gates.
- Correction: promotion/policy seed IDs are also random, not only timestamps;
  the deterministic metadata gate was never completed by the extraction tool.
- Added proposed deterministic empty-install seeds with explicit audit/assignment
  identities and schema-cutoff epoch. Two independent seed installs match every
  field and preserve original genome/policy semantics. Nonempty reinstall fails
  without changing rows. Full Auth/Personal/Shared probe passes twice with these
  seeds. Revised Mac/full-platform/forward-upgrade gates remain pending.
- Final validation: `npm run check` passed lint, TypeScript, mobile/catalog tests,
  29 database tests and iOS/Android bundles. Exact export trigger parity passed in
  two disposable databases; the expanded rollback probe passed twice separately.
- Added read-only table-definition/direct-ACL fingerprints and same-count drift
  regressions. Exact export fingerprints match across two independent installs
  for all 30 tables. This strengthens export repeatability only; remaining
  canonical schema/platform/upgrade gates remain open (ADR-0006).

### 2026-09-09 — Canonical function source discrepancies

- Reconstructed all 122 application function definitions from the immutable
  checkpoint. Both export installs show 96 exact matches, 26 definition differences
  and no missing/unexpected application functions; platform RLS function excluded.
- Reproduced two additional source-patch failures: import stage-limit expansion
  and null-bootstrap resurfacing both expect compact text absent from the earlier
  repository definitions. Catalog upsert's conflict patch applies unchanged.
- Six public import wrappers and two Shared functions have inspected formatting/
  comment-only diffs. ADR-0006 owns the complete difference ledger and remaining
  18-function semantic review. No historical bytes or serving logic were changed.
- Export diagnostic now exits 1 with `REQUIRES_RECONCILIATION` while preserving
  separate successful export-repeatability evidence. Added repository-only
  regressions for both defects, drift detection, checksum guards and rollback.
- Validation: `npm run check` passed (191 mobile, 14 catalog and 36 database
  tests, lint/typecheck, iOS/Android bundles). The exact export loaded twice with
  repeatability PASS and source status REQUIRES_RECONCILIATION as documented.

### 2026-09-09 — Source-derived function resolutions

- Completed all 26 definition reviews: 19 formatting/comments, five alias-only
  changes and two intended import-stage/null-bootstrap corrections. ADR-0006 owns
  the resolution and provenance; the previous remaining-18 statement is superseded.
- Added the deterministic 122-function supplement and connected it to the guarded
  rollback-only probe. Original historical files and hosted runtime are unchanged.
- Two independent installations match all post-supplement fingerprints; exactly
  26 definitions change and all owners/direct ACL remain unchanged. The expanded
  Auth/Personal/Shared plus 5000-row import probe passes twice with rollback.
- Added repository-only behavior tests for boundary rejection without data loss,
  row correction, repeated commit, removal/eligibility and unauthorized access.
  The same smoke rejects both original broken definitions.
- Next: source owner/ACL and remaining non-function/platform reconciliation,
  revised Mac probe, repeated pinned full installation and independent upgrade.
- Validation: `npm run check` passed after the interrupted run was restarted:
  191 mobile, 14 catalog and 39 database tests, lint/typecheck and both bundles.

### 2026-09-09 — Source table definitions and privilege reference

- CI #382 for the previous published head passed; development continued on #219.
- Reconstructed 188 literal DDL statements from the protected source checkpoint.
  Both unchanged export installations match all 30 source table structures,
  including 205 constraints, 112 indexes and 19 RLS policies. No structural fix
  was needed; ownership/ACL are checked separately and not silently normalized.
- Added a plain-PostgreSQL source privilege reference from 296 literal statements.
  It exposes additional exported `service_role` rights on 12 tables and 18 public
  functions. Platform default/history provenance remains unresolved; there is no
  direct anon/authenticated grant difference in the compared objects.
- Reproduced the source future-function default gap: per-schema REVOKE does not
  remove the global PUBLIC EXECUTE default. Current explicit function ACLs are a
  separate matter. ADR-0006 owns the finding, correction boundary and remaining
  platform/default/installation/upgrade gates; no historical or hosted SQL changed.
- Source-only regressions enforce real membership isolation, unique/FK/check
  constraints and explicit grants, and detect an altered policy that really leaks
  the other synthetic Profile. Existing same-count fingerprint regressions also
  verify that only the explicit structural mode excludes ownership/ACL.
- Validation: `npm run check` completed all stages: 191 mobile, 14 catalog and 41
  database tests, TypeScript, lint (zero errors; one existing DiscoveryScreen Hook
  warning) and both iOS/Android bundles. The exact export diagnostic completed two
  installs with structural MATCH and explicitly unresolved privilege/source status.

### 2026-09-09 — Explicit compatibility/default contract and pause checkpoint

- CI #383 passed the preceding published head. Owner requested a pause after this
  checkpoint; resume from STATUS and the existing #219 branch, not a new workstream.
- Proposed compatibility SQL preserves only the exported service_role rights on
  12 named tables and 18 functions. Both export installations now match reviewed
  source owner/direct ACLs for all 30 tables and 122 application functions. Raw
  historical differences stay visible; exact platform provenance is not invented.
- Prepared CLI-generated forward migration to close future postgres-created
  function defaults globally and clear public/private additions. Existing function
  ACLs and other creators remain unchanged. Global scope includes future platform
  functions; real-platform and independent upgrade verification remain pending.
- Read-only hosted catalogs confirmed the global PUBLIC default gap. Corrected an
  earlier audit error: six platform event triggers have supabase_admin ownership,
  and none of the seven triggers is extension-owned. Hosted objects are unchanged.
- Full revised rollback probe passed twice in PGlite, including compatibility,
  defaults, Auth/Personal/Shared and import checks; application tables and default
  privileges were restored. New regressions verify execution boundaries,
  idempotence, unchanged existing rights and OID-independent platform metadata.
- Mac runner now saves image/probe hash and read-only platform metadata after
  checking before/after equality. Next run the revised probe on the owner's pinned
  local stack and collect `kajo-install-report-*.json`; ADR-0006 has exact commands.
  Prior Mac PASS covers only the original probe. Repeated full installations,
  platform reconciliation and independent forward upgrade still gate #208.
- Validation: `npm run check` passed 191 mobile, 14 catalog and 45 database tests,
  TypeScript, lint (zero errors; one existing Hook warning) and both bundles.
  No historical migration was edited and no hosted change or APK build was made.

### 2026-09-09 — Automated platform runtime continuation

- Owner resumed work after the pause request. Default/compatibility checkpoint
  `d98e652` is published in #219; CI #384 passed.
- Added a separate GitHub Ubuntu job that starts an unlinked Supabase CLI 2.117.0
  stack, requires Postgres 17.6.1.167 and reports actual image/config/commit metadata.
  This removes the need for a manual Mac capture before platform discovery.
- Shared SQL probe tests actual future-function execution, repeat migration,
  unchanged existing platform functions and unaffected schema/role/event/default
  metadata. All changes roll back; only the newly created stack is stopped/deleted.
- `npm run check` passed 191 mobile, 14 catalog and 47 database tests, TypeScript,
  lint with one existing Hook warning and both bundles. CI #385 passed the same
  validation and the real Supabase job at `533cc54`, retaining 99 native function
  definitions/owners/ACLs and verifying execution, rollback and cleanup.
- Retrieved report and compared hosted catalogs: four shared schema owner/ACL sets
  and selected role flags match. Differences are private schema/ensure_rls absence,
  native function callback hashes, initial public defaults and native
  supabase_functions role/default additions. ADR-0006 preserves the exact ledger,
  image/report hashes and boundaries; do not repeat platform discovery on Mac.
- Next build the candidate application installation from reviewed source with
  source default REVOKEs applied before object creation and explicit source RLS.
  Repeated full installs and independent existing-application upgrade still gate
  #208; no hosted write or native platform callback replacement.

### 2026-09-09 — Source-only installation candidate and CI transport correction

- Added the proposed full application candidate from reviewed source, with source
  default REVOKEs applied before object creation. All 30 tables, 122 functions,
  22 triggers and deterministic seed rows match the independent source reference.
- Two committed PGlite installations match exactly; full Auth/Personal/Shared and
  import smokes pass with rollback, and reinstall preserves the existing state.
  `npm run check` passed 191 mobile, 14 catalog and 49 database tests, TypeScript,
  lint with the existing Hook warning and both bundles.
- Added two distinct real Supabase installation runs to CI. Shared lifecycle pins
  the actual Linux Postgres image ID and owns/cleans only each new unlinked stack.
- CI #387 passed validation/platform. The first application run reached the
  negative reinstall check after its source/runtime comparisons, but Docker stdin
  EPIPE masked psql's early error. The full repeated-install gate remains pending.
- Added buffered SQL transport for CI/Mac with a regression for large Unicode
  input, real child exit status and private temporary-file cleanup. The SQL guard
  remains strict. The complete check passed with 191 mobile, 14 catalog and 50
  database tests plus both bundles; record the corrected real CI result next.
- Independent existing-application upgrade and accepted installer/history
  procedure are still open; no hosted write or migration-history change.

### Repeated native installation accepted as test evidence; independent upgrade prepared — 2026-09-09

- CI #388 at `0c9a480` passed validation, platform/default checks and both real
  application installations after the buffered SQL transport correction.
  All 30 tables, 122 functions, 22 triggers, seed rows, runtime behavior and
  rollback/reinstall/cleanup checks matched. ADR-0006 records verified report and
  image identities. This supersedes CI #387's EPIPE-blocked experiment.
- The tested checkpoint passed 191 mobile + 14 catalog + 50 database tests,
  TypeScript/lint and both bundles. The expanded Mac run is distinct and unrun;
  the repeated Linux CI gate no longer needs another manual Mac capture.
- Added a separate populated pre-upgrade fixture/probe and CI job. Existing
  Auth/Profile/membership, native/imported evidence, committed predictions and
  system seeds must survive the unchanged forward migration exactly. It checks
  complete row hashes, schema/function/trigger metadata, native defaults/platform
  and runtime before/after, with repeated commit and negative regressions.
- The local workspace disconnected while preparing the new upgrade package;
  its CI result is pending. No independent upgrade PASS is inferred from the
  installation job. Historical and hosted SQL/history remain unchanged; canonical
  installer/history transition, #208 and MVP-ALG-009 remain open.

### Populated upgrade and rollback local proof — 2026-09-09

- CI #389 caught an invalid synthetic import fingerprint; the fixture now meets
  the existing minimum length and includes a matched staging row/counts.
  Four local upgrade regressions passed, including exact restoration of global/
  per-schema default grants and their grant options, followed by reapplication.
- Optional checksum-gated unchanged-export upgrade passed in PGlite with all
  123 original function bodies/owners/ACLs, populated row hashes and runtime
  preserved. It applies no function/compatibility supplement. ADR-0006 records
  the command, final report hashes and exact provider/fixture scope.
- The workspace connection recovered. Full `npm run check` passed 191 mobile, 14 catalog and 54 database tests,
  TypeScript/lint and both bundles. Corrected native CI is the next evidence; canonical CLI/history activation is
  still separately gated and is not inferred from these SQL experiments.

### Native upgrade PASS; CLI lineage experiment prepared — 2026-09-09

- CI #390 at `7507d35` passed validation, platform/default checks, both application
  installations and the separate populated upgrade/rollback/reapplication job.
  Its downloaded report preserves 221 existing functions and all synthetic row
  hashes; ZIP/report/source/runtime identities are recorded in ADR-0006.
- Added a restricted CI-only CLI reset experiment. A generated source baseline
  plus unchanged forward files must yield matching clean installs and exact CLI
  history. A deliberately failed extra test migration must leave no table/history
  entry. Repository history and hosted state remain untouched.
- Full local `npm run check` passed 191 mobile, 14 catalog and 54 database tests,
  lint/typecheck and both bundles. The first real CLI job is pending. Proposed
  lineage adoption and existing hosted-history procedure remain separate gates.

### CLI lineage PASS and identical-image registry correction — 2026-09-09

- The actual CLI job in CI #391 passed two resets, source/runtime/seed/default
  parity and failure atomicity: the deliberately failed migration left no table
  or history row. Its verified report and exact two-row history are in ADR-0006.
- The same run's upgrade job stopped before application SQL because Supabase
  used its GHCR reference with the exact reviewed ECR image content ID. The check
  now accepts those two observed references only, retaining the exact tag/digest
  requirement. Changed image content/version/registry regression passes.
- Full local check passed 191 mobile, 14 catalog and 55 database tests plus
  lint/typecheck and both bundles. CI #392 at `bbe4dd5` then passed all five
  required jobs, including the repeated installs, populated upgrade/rollback and
  CLI history/atomicity. APK was skipped for the PR event.
- #208's literal unmodified-replay criterion is still unsatisfied. Fresh-lineage
  adoption/acceptance is explicit; no historical or hosted mutation is inferred.

### Verification package completion and pause — 2026-09-09

PR #219's verification implementation is complete. Its code head `9fcbbb4` passed
all five required jobs in CI #393. The final closeout updates documentation only:
STATUS now separates completed evidence from the adoption decision, ADR-0006
states the concrete proposed fresh lineage, and CODEMAP reflects the populated
upgrade and five CI gates. Resolve #219's current publication state from GitHub;
a merged PR is continued from `main`, not from an obsolete local branch.

The next work is the explicit acceptance/installation-procedure decision and its
operational wiring, as specified in STATUS and ADR-0006. #208's literal original
replay criterion remains unsatisfied. #207/#208/MVP-ALG-009 and Sprint 014 remain
open; no hosted schema/data/history change or new device acceptance occurred.
Do not restart completed export/fingerprint/platform/install/upgrade/CLI discovery
or create another docs-only commit merely to record this closeout's own CI or
merge number. Complete publication, then pause as requested by the owner.


### Operational local lineage adoption — 2026-09-09 / #208

- Added `npm run database:install` for a new, unlinked local workspace. Reuses the
  reviewed builder and pinned stack lifecycle; checks image/source/empty-state,
  actual CLI history, independent source-plus-forward snapshots and runtime smoke.
- Success retains the owned local stack with a metadata manifest; failure cleans
  only that stack/workspace. Existing containers/volumes and application/Auth state
  are refused. CI runs the same install boundary before its reset/atomicity checks.
- Forward-added tables/functions participate in full snapshots. Regressions reject
  changed source bytes, duplicate versions/unsafe ordering, unexpected new rows,
  missing RLS and reuse of an existing application even if CLI history could skip it.
- ADR-0006 explicitly replaces #208's impossible unchanged-history success criterion
  with accepted fresh-lineage installation. The original failing diagnostic and
  protected bytes remain intact; existing hosted forward deployment is separate.
- No hosted migration, HTTP Auth, device or quality acceptance is inferred. Finish
  required CI/merge, then proceed to 14.1; GitHub owns exact run/merge identities.
- Local `npm run check` passed: 191 mobile, 14 catalog and 59 database tests
  (264 total), lint/typecheck and both bundles. The existing Hook warning remains;
  native operational installation is verified by the required PR CI gate.


### Atomic rating/not-interest/undo and durable outbox — 2026-09-09 / #224

- The CLI-created `*_atomic_item_actions.sql` forward adds the public invoker/private
  authorized command, private receipt/head tables with RLS and an undo-invalidation
  trigger. Current state, session, canonical Event and receipt are transactional.
  Cached replies still require current actor/Profile authorization; altered payloads
  cannot reuse an ID. Server-recorded undo predecessors prevent intervening/legacy
  updates from being erased, including changes back to the same values.
- Mobile rating/not-interest/undo enters one persisted command path before optimistic
  feedback. SQLite keys include environment/actor/Profile; FIFO retry, immutable
  payloads, restart recovery, storage failure and stale-scope callback/dispatch guards
  have deterministic tests. A rejected stale undo has an explicit discard/reload
  action; uncertain acknowledgements and permission failures remain queued.
- SQL acceptance runs on the complete source-plus-forward schema and in the required
  native CLI job. A populated old-schema rehearsal applies the exact new file with
  hosted-style global defaults and requires unchanged hashes for every existing
  application/Auth table. Rolled-back command smoke covers retry, failure after
  projection write, ordered undo, actor/member denial and trace guards.
- Correlation validates existing selected candidate + actor/Profile/session/mode +
  prior impression. Unverified IDs yield unattributed native Events; undo keeps its
  original accepted trace. This does not complete frozen client slate provenance.
- Lists/Endorsement atomicity and durable exposure delivery remain the next 14.1
  package. Their legacy detail List projection cannot overtake pending atomic
  commands. Full DATA-003/004 and real-device process-death acceptance remain open.
- Verification: local `npm run check` passed 207 mobile, 14 catalog and 61 database
  tests (282 total), lint/typecheck and both bundles. All five required jobs in
  [CI #403](https://github.com/Kajooja/Kajo/actions/runs/34402219263) passed at
  `55b025a0805e65a639295132026461a18057b020`, including the native populated forward
  rehearsal and full command smoke on the pinned Supabase stack.
- Hosted rollout: Kajo `mwrnvfosrzwygrunrltm` accepted only the new forward under
  actual version `20260909204512_atomic_item_actions.sql`. The CLI-created filename
  was synchronized to that provider identity without changing SQL bytes; SHA-256
  `81bc4304d24dc063b04fdd567b1b1c3cc8c2a0bda4ecaff286395701b84f1cdb`.
  All 31 existing application/Auth table hashes, 123 function fingerprints, 21
  triggers, defaults and 44 old migration rows remained unchanged. All three new
  function definitions/owners/ACLs match the reviewed source; the two private RLS
  tables deny all API-role table access and only authenticated can call the command.
- Hosted command acceptance passed using rollback-only fixture DML: retry, ordered
  undo, legacy invalidation, authorization and accepted/fabricated trace cases.
  It selected an actual ranked Item for the synthetic Profile. Forced late Event
  failure was exercised only in isolated native CI, avoiding a hosted test trigger.
  The complete post-smoke snapshot matched pre-smoke state and left zero receipts
  or heads. Security advisors added only the two expected private RLS-without-policy
  INFO notices; the pre-existing [Auth password-protection WARN](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is unchanged.
- The separate global-default forward and old tracking remain untouched. Rollback
  preserves accepted commands/evidence and uses the previous client or narrowly
  disables the new endpoint. PR #225 / #224 own final-head CI and merge evidence;
  filename/documentation synchronization is subject to those same required gates.
- No emulator/phone interaction or physical process-kill/SQLite recovery test was
  available in this workspace. Type/JS/SQL/bundle checks do not claim that acceptance.


### Atomic List/Shared commands and durable mobile integration — 2026-09-09 / #226

- Branch `feat/226-atomic-collection-actions` starts from accepted `e0d7610` (#225).
  The new CLI-created collection forward extends existing private Item receipts and
  undo heads; no old deployed file is edited. Nullable List metadata supports
  no-op/deleted-List replay without fabricating Events. The only old function change
  restricts Item undo to Item command kinds; List undo also restores membership.
- List create/rename/delete/membership and Shared proposal/endorsement/unanimity/
  pending withdrawal commit state, all transition Events and receipt atomically.
  Mixed List/rating undo and legacy membership ABA are protected. Undo corrects
  every Event of a List+Like action; withdrawal/cancelled proposals also cancel
  original Endorsement outcome reward with exact correction references.
- Mobile uses one SQLite actor/Profile/environment FIFO. List/Shared screens and
  picker show pending/errors with explicit safe rejection recovery. Confirmed
  receipts drive state, refreshes and Undo; uncertain actions cannot launch dependent
  creation/messaging or report success. Hung calls have a 20-second reply deadline.
  Old whole-state mobile writes and duplicate mutation Event calls are removed.
  After the queue drains, a guarded current-state read reconciles replayed receipts
  without overwriting newer pending actions, a newer read or another scope.
- Targeted mobile tests cover old payload compatibility, mixed FIFO/restart,
  acknowledgements, timeouts/late replies, scopes/environments, malformed receipts,
  shared consensus counts and discard authorization. SQL smoke additionally covers
  exact Entry actor/time restoration, no-op evidence, consensus late failure rollback,
  membership loss, pending cancellation, complete undo evidence and valid/fake traces.
  Actual Memory returns to zero native evidence after the mixed undone sequence.
- Populated forward rehearsal preserves every existing application/Auth/receipt/head
  column, exact old cached replies and undo. It verifies all unrelated function
  bodies/ACLs and the single intended Item guard replacement. Both rehearsals and
  collection smoke are wired into native CLI CI; all fixtures/DDL/grants roll back.
- Publication checkpoint: local full check passed 212 mobile + 14 catalog + 61
  database tests (287 total), lint/typecheck and iOS/Android bundles; the existing
  Discovery Hook warning remains. The final correction SQL also passed the full
  schema/rehearsal smoke. Required native CI and scoped hosted deployment are still
  pending at this checkpoint; the PR will own final-head run and merge identities.
- No phone/emulator or physical process-kill/SQLite test was available. Full
  DATA-003/004, late-outcome/frozen delivery and exposure acceptance remain open.
  Next after #226: exact delivered provenance plus durable exposure, then device
  acceptance and 14.2. The separate hosted global-default forward is still excluded.
- PR #227 initial CI #406 reached a CLI startup failure before application SQL
  (bounded signals: image-download/port-binding; exact cause unproven). General
  validation, platform/defaults and existing-application upgrade passed. The next
  head includes the receipt replay reconciliation and must pass all required jobs;
  no database failure is waived and no hosted DDL has been applied at this point.

- Implementation head `0d299d5157cee2d8c20b2db64405b23ff646655d` passed all five
  required [CI #407](https://github.com/Kajooja/Kajo/actions/runs/34410390133) jobs.
  Its merge-check tree exactly equals `97949e3823e2364f21054703fecab3ade3556771`;
  native CLI logs confirm reset/history/atomicity/runtime verification. The artifact
  was published by CI; a workspace download returned HTTP 403, so no local artifact
  digest inspection is claimed. Native job success/logs and exact tested tree were
  verified through GitHub. Local final check is 287 tests and both bundles.
- Hosted preflight: Kajo `mwrnvfosrzwygrunrltm`, PostgreSQL 17.6; all 33 old
  application/Auth/receipt/head table hashes, 126 functions, 22 triggers, defaults
  and 45 tracking rows were stable. Object-key order was normalized when comparing
  connector JSON; the SQL fingerprints were identical. Existing receipt/head counts
  were zero. Security advisors remain 18 intended RLS-without-policy INFO findings
  and the existing Auth leaked-password-protection WARN.
- **Deployment was not executed:** automatic approval review rejected
  `apply_migration(atomic_collection_actions)` because it did not find explicit
  authorization for the hosted target/DDL side effect. STATUS records the exact
  source/hash/target to approve; no alternative write path was attempted. Main merge
  and current branch retirement wait for that approval plus successful deployment.
- On approval, preserve SQL SHA-256
  `fbe319423f4f935e87435f4101db71677fa958a02aa7a820f6a55ae68d6ab5ce`, synchronize only
  the filename to the actual provider version, verify all old columns/125 unrelated
  functions/22 old triggers/defaults/history, the one intended Item undo guard,
  three new functions and two new triggers. Hosted smoke must omit isolated-only
  failure-injection DDL and choose an actual delivered Item for trace acceptance;
  that rollback-only variant was rehearsed locally without residue.
- Rollback must preserve accepted receipts/Events/List data and device queues. A
  narrow forward can disable the collection entrypoints while retaining pending
  commands for a corrected deployment. Do not blindly reinstall #225 over devices
  with collection commands: its old queue validator cannot interpret those entries.
  No rollback or separate global-default migration is part of this pending action.


### Approved collection deployment — 2026-09-10 / #226 / PR #227

- Owner explicitly approved the exact hosted migration and subsequent verification/
  merge. `apply_migration` succeeded on Kajo `mwrnvfosrzwygrunrltm` with actual
  version `20260910071110_atomic_collection_actions.sql`. SQL SHA-256 remains
  `fbe319423f4f935e87435f4101db71677fa958a02aa7a820f6a55ae68d6ab5ce`;
  the repository filename alone was synchronized. Do not deploy it again.
- Fresh metadata comparison preserved all 125 unrelated function definitions and
  all 126 old owners/ACLs, the exact intended Item undo guard replacement, all
  23 inventoried noninternal public/private/Auth-user triggers, global defaults,
  and all 45 previous tracking rows. Three functions, two triggers and one tracking
  row were added. Function/table API access checks passed.
- The approval reviewer rejected export of table-wide counts/data hashes during
  this fresh preflight. A safer metadata-only check succeeded. No fresh hosted
  whole-data fingerprint comparison is claimed; the earlier isolated populated
  forward rehearsal remains the data-preservation proof. No alternative path
  exported the rejected private/Auth row-derived snapshot.
- Hosted rollback-only collection smoke passed List lifecycle/membership, exact
  membership undo, mixed Item/List undo and Memory correction, repeat/no-op/denial,
  real delivered-item trace versus fabricated attribution, Shared consensus and
  pending cancellation. It selected an actual ranked MOVIE and omitted isolated-only
  failure-injection DDL. The transaction rolled back its synthetic data.
- Security advisors retain the same 18 intended RLS-without-policy INFO findings
  and existing Auth leaked-password-protection WARN. The unrelated global-default
  migration and historical tracking are untouched. No physical-device acceptance.
- CI #408 passed the prior handoff head. PR #227 owns the final filename/docs CI
  and merge result. Next is exact delivered provenance and durable exposure in
  14.1; DATA-003/004 and Sprint 014 remain open. Work continues in short checkpoints.


### Delivered navigation first checkpoint — 2026-09-10 / #228

- Continues merged #227 (`6dd1fec`), whose final CI #409 passed all five gates.
- Grid captures the visible, already overlaid sequence and source/mode/run with
  environment/actor/Profile scope and Event session. Detail pins the snapshot and
  refuses mismatched scope/session or evicted navigation tokens. Ambient visuals
  still follow global mode; event/action origin keeps the delivered mode.
- Removed the latest-media-ranking cache fallback. Direct entries remain one Item
  with fallback origin; query prediction IDs alone cannot establish correlation.
- Six deterministic regressions cover reranking, source mutation, cross-scope/
  session/Item rejection, missing hosted identity, eviction and token reuse.
- The PR owns local/full CI validation results. No emulator/phone/runtime acceptance
  is claimed. Shared item-specific overlay origin, async callback boundaries,
  durable exposure and delayed action reconciliation remain open on #228. Keep
  DATA-003/004 and the Issue open; resume this branch in the next short work period.


### Durable Event queue checkpoint — 2026-09-10 / #228 / draft PR #229

- Replaced the disposable memory Event map with the existing bounded SQLite outbox
  mechanism under a separate environment/actor/Profile key. Each entry retains the
  complete original Event and session; new sessions never rewrite older entries.
- recordEvent acknowledges only successful durable enqueue. Impression dedup occurs
  afterward, so a failed disk write can be retried. Provider layout lifecycle stops
  old coordinators and rejects stale callbacks; delayed session completion checks
  scope before starting Event delivery. No hosted schema/API change.
- Seven queue regressions replace two old memory-coordinator tests: session ordering,
  restart/lost reply, scope change during session persistence, namespace separation,
  storage failure/recovery, payload/corruption checks and timeout/late acknowledgement.
- PR owns full check/CI evidence. Physical process-death/device testing remains open.
  Exposure/action queue coordination and late outcomes are explicitly not solved
  by persisting a separate queue. Continue the same draft branch; do not merge or
  close #228 until the remaining provenance/delivery gates are met.


### Exposure/action ordering checkpoint — 2026-09-10 / #228 / draft PR #229

- Prior durable Event head `2e0c068` passed all required CI #412 jobs.
- Both Item and collection senders now check durable matching impressions before
  RPC dispatch. The exact queued command remains pending until acknowledgement;
  a restarted action can wait for its original older session's exposure.
- Five regressions add delayed acknowledgement, both-queue restart/lost reply,
  exact matching/no invented evidence, unreadable storage and stale coordinator
  coverage. Unrelated/non-predicted actions are not globally blocked.
- No hosted migration. Missing impressions and already-committed unattributed
  outcomes are not retroactively manufactured/fixed. Next: Shared per-Item origin,
  remaining async callback review and server late-outcome/runtime acceptance.
  Keep #228 and PR #229 in progress; PR owns current full-check/CI evidence.


### Shared per-Item origin checkpoint — 2026-09-10 / #228 / draft PR #229

- Prior head `dd6d86b` passed CI #413. The snapshot now captures each Item's
  ranking membership and Shared tier without private member/history payloads.
  Overlay-injected Items carry no ranking Prediction; ranked Items preserve
  the run even when the overlay changes their order.
- Grid/detail evidence and Item/collection action origins use those descriptors.
  Detail remains frozen through Shared updates. Dwell keeps its start-time
  callback/mode/origin, and undo navigation no longer borrows an unrelated run.
- Six new origin regressions cover injected pending/history, ranked reordering,
  Shared mutation/reranking, unknown origins, fallback and defensive copying.
  PR owns full-check/current CI evidence. No hosted migration or physical-device
  acceptance. Remaining: async/session boundary review, late-outcome/server
  verification and runtime acceptance. Keep #228/#229 in progress.


### Async session admission checkpoint — 2026-09-10 / #228 / draft PR #229

- Detail/picker origins capture a client-only session admission token. Event and
  explicit Item/collection admission reject mismatched sessions; explicit actions
  also reject another Item. Actual persisted session envelopes remain unchanged.
- Action dispatch, hydration and receipt projection check layout-time session
  identity. Lists/Shared completion tokens include session and unmount cleanup.
  Direct Detail remounts on session change. Destination loading/saving belongs to
  one open request, fixing close-during-save/reopen state leakage.
- Five admission regressions cover session/Item mismatch, a deferred destination
  completed through a new session, local-to-auth transition, fresh non-delivered
  actions and omission of the guard token from persisted Events. PR owns the full
  check/CI evidence. Interactive session switch, reopen and process-death checks
  remain untested. No hosted migration or server reconciliation is claimed.
- Next: missing/already-committed exposure and delayed outcome verification at
  the server boundary, then representative runtime acceptance. Keep #228/#229 open.


### Server delivery matrix / next APK checkpoint — 2026-09-10 / #228 / draft PR #229

- Added `delivery-order-smoke.sql` to PGlite and required native CLI installation
  acceptance. Fourteen cases exercise authenticated Item and collection RPCs with
  old-session delayed-valid, absent, late-arriving, post-action, wrong-session,
  wrong-mode and unselected exposure. Secondary collection Events agree with the
  receipt, and retries/undo preserve accepted attribution.
- Existing server behavior passes the targeted matrix. Late-arriving exposure
  does not rewrite an immutable unattributed receipt. No new reconciliation or
  schema migration is claimed. PR owns full-check/current native CI evidence.
- Owner is ready to download and test the next APK when explicitly notified.
  Next: exact-head native CI + standalone APK, then the checklist below. Do not
  wait in a build-poll loop. Record build SHA, artifact URL and results here/PR.

#### #228 device acceptance checklist (pending)

Use the next explicitly identified #228 APK; bundle exports and older main APKs
are not this acceptance build. Record phone/Android version, build SHA and test
time. Use a few recognizable test Items/Lists. Report each row PASS/FAIL and any
screenshots or exact unexpected behavior. The developer checks server evidence
for these operations afterward; the owner need not inspect Event IDs or SQL.

| Test | Actions | Expected visible behavior |
|---|---|---|
| Grid/detail/mode | Open a card, swipe forward/back, change global mode and reopen from grid | Stable opened sequence; the next newly opened sequence follows the new grid; no flash of another cached sequence |
| Item action/undo | Rate an Item, mark another not interested, undo in order | State and undo target remain correct; no duplicate operations |
| Lists | Create a test List, add/remove an Item and undo | One intended transition each time; consistent state on reopening |
| Close while saving | Select a List, close promptly, reopen the same Item's picker | Picker recovers and responds; no stuck saving indicator or duplicate addition |
| Offline/restart | Open online, disable network, make one action, force-close, reopen and restore network | Pending action remains visible and completes once; correct state after reload |
| Profile switch with pending action | Queue an offline action in Profile A, switch to B, reconnect, then return to A | B never receives A's action; A's pending state eventually resolves correctly |
| Shared | With an existing Shared Profile, inspect a pending suggestion, endorse, then complete consensus with the other member | Correct pending/consensus state and destination; no Personal Profile state leakage |
| Background/session | Open Detail/picker, background/foreground; also sign out/in and switch Profiles while a picker is open | Old screen either recovers explicitly or reloads correctly; stale callbacks do not advance or save into the new context |

The exact APK and all results remain pending. Dispatch limitation: the GitHub
connector has no workflow-dispatch capability and the cloud browser is signed
out. The owner can start CI using Run workflow on `feat/228-delivered-origin`.
Its APK job already depends on all five validation jobs; do not bypass those
gates or change workflow triggers merely to start a build. Keep #228/#229 and
DATA-003/004 open.


### Owner APK feedback and correction checkpoint — 2026-09-10 / #228

Expected candidate: run #417 / `e7c84a7`. The owner reported results after receiving
that download target; phone/Android/build confirmation was not supplied.

| Report | Acceptance interpretation |
|---|---|
| Cards/order worked | Owner-observed pass |
| Recommendations seemed to change after actions/undo, then did not change on repeat | Non-reproducible observation; do not invent a cause or close ranking quality |
| List addition did not remove the Item from Discovery | Confirmed product failure; named List membership must suppress ordinary delivery |
| Undo appeared to do nothing | Open; List-removal undo is not required, but retained undo must work |
| Closing while saving worked | Owner-observed pass |
| Offline/restart “seems to work” | Tentative pass; retain server evidence/device follow-up |
| Rejection showed exposure-wait error; a new choice eventually worked despite it | Normal queue wait was incorrectly presented as failure; correcting below |
| Background/login worked | Owner-observed pass |

Correction in this checkpoint: `waitingForExposure` distinguishes a local queue
dependency from an actual persistence error. The action remains pending with
normal automatic backoff; no error snapshot prematurely settles collection
waiters. Real network/storage/authorization failures remain visible. Tests verify
silent pending state, automatic retry after exposure acknowledgement, and a real
subsequent error. PR owns complete validation. No hosted migration in this part.

Next bounded package: active named-list membership in resurfacing and immediate
Discovery refresh; last-list removal/reappearance, multiple Lists, deletion and
Shared behavior; review ineffective undo and omit List-removal undo from required
UX. Preserve the existing bounded reminder interval/caps, without treating an
Item still in another List as new. Do not mark device acceptance complete yet.

Owner idea: “Mitä tänään” chooses from a saved List using the active Personal or
Shared Profile and current context, with an explicitly distinct List-card browsing
surface. Captured in FUTURE_PLAN; it is a product idea, not another reported defect.


### Named List eligibility candidate — 2026-09-10 / #228 / draft PR #229

- New forward `20260910104420_list_membership_resurfacing.sql` changes only the
  existing private resurfacing decision. It includes current target-Profile List
  entries in saved-like suppression and their latest added_at in reminder age.
  Existing native/bootstrap/terminal precedence, reminder limits and ranking
  order remain. Historical Events, receipts, tables and migration history are not
  rewritten. Policy metadata gains `listMembershipPolicyVersion: active-list-v1`.
- A collection revision changes the mobile grid request identity and forces a
  current ranking even when LIKED/interaction fields are unchanged by removal.
  Loading cannot reuse the prior grid; its late visible tokens cannot create new
  impressions. Opened Detail retains its frozen delivery snapshot as before.
- `list-membership-smoke.sql` runs in PGlite and required native CLI acceptance:
  authenticated Personal add and public ranking suppression, two memberships,
  last removal and public ranking return, List deletion, older reminder eligibility,
  terminal precedence, Profile isolation and two-member Shared consensus.
  PGlite also verifies the forward preserves function identity/ACL/security
  metadata and every unrelated definition.
- Shared nuance verified: deleting the named consensus destination leaves the
  separate SYSTEM_SAVED membership, so suppression continues. Direct Personal-style
  removal from Shared Tallennetut is rejected by existing consent rules. Do not
  relabel that as a successful final Shared removal test; withdrawal/removal UX
  still needs review together with the owner's ineffective undo report.
- No hosted deployment, hosted advisor run or new-device acceptance yet. PR owns
  current full-check/native CI. Next: exact-forward hosted rollout/verification,
  remaining undo/Shared UX correction, then a focused replacement APK.
