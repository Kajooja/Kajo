# Sprint 014 — Algorithm Reliability, Real Catalog & Portable Engine

Status: **ACTIVE — PHASE 14 ACCEPTANCE OPEN; DELIVERED FOUNDATIONS ON MAIN**

## Outcome and current scope

Complete ROADMAP Phase 14: clean-database/bootstrap correctness, trustworthy action/delivery evidence, serving/shadow parity and candidate availability, real catalog/features, portable engine contracts and isolated public-data evaluation, adaptive memory/policy and operating bounded SleepLayer evaluation. Current requirements and acceptance belong to [MVP.md](../../product/MVP.md) and [ROADMAP.md](../ROADMAP.md).

The 2026-09-07 Taste-first release decision supersedes the old Sprint 014 external-beta / Sprint 015 store-close schedule. Taste acquisition is Phase 15, Friends/Shared is Phase 16, core UX/operations is Phase 17, complete-flow closed beta is Phase 18, production/stores are Phase 19 and owner acceptance is Phase 20. Monetization is outside MVP 0.1.

[STATUS.md](../STATUS.md) owns the exact next task. #208/#207 are technically complete through #223. Delivery #224 / PR #225 implements the first Phase 14.1 atomic/durable Item actions; Delivery #226 implements List/Shared commands and their durable mobile path; exact delivered provenance follows. PR #219's source/platform experiments are completed evidence.

## How to read this record

The 14A–14D sections below preserve earlier foundation deliveries and device evidence. Their labels are historical work packages, not the current numbered ROADMAP phases. Catalog counts and hosted evidence are dated checkpoints, not a live inventory. Dated continuation entries later in this file preserve what was pending then; the current STATUS overrides their old next-step instructions. The [2026-09-09 retro](../retros/2026-09-09.md) records the reconciliation.

## Current audit/handoff — 2026-09-12 / #233 / PR #234

The [repository audit](../retros/2026-09-12.md) reconciles the independent
51-part engine, public data and previously staged owner decisions. Preserve the
historical evidence below; the large #229 implementation/device ledger remains
on its named branch and PR until accepted, rather than copied here as main delivery.

- Accepted runtime source remains `6dd1fec` / PR #227. Audit cleanup removes only
  a proven-unused catalog hook/wrapper; no runtime endpoint or SQL changes.
- #229 head `44b11b4` now has all five required jobs passed in CI #458
  (`34582041579`). Its old request to wait for the corrected first-page race CI is
  resolved. Complete atomic next-page delivery plus window concurrency/populated
  upgrade, page replay and captured-session client tests next. Keep continuation
  disabled until accepted; hosted/device gates remain separate.
- E1 #235 → D1 #236 → D2 #237 is the next engine sequence. D1 supplies real
  isolated research data after executable contracts; it does not wait for native
  population volume. D3/D4/D5 are optional experiments after D2, and E2 serving
  integration has separate native/rights/quality/fallback gates.
- #232 joint rating/rewatch is mandatory first release: Phase14 evidence/policy,
  Phase15 Personal setup, Phase16.3 complete joint flow. #230/#231 and joint-list
  choice remain scoped later candidates in FUTURE_PLAN, not invented acceptance.
- Migration protection expands from the original 47 files to 50 by appending
  three accepted-main hashes; no original SQL/hash or source-baseline cutoff changes.
- This scoped audit does not close Sprint014, DATA/ALG/ENG requirements, device
  tests or the Share Link Gate. STATUS is the sole current next-task authority.

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

- New forward `20260910110344_list_membership_resurfacing.sql` changes only the
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


### Hosted List eligibility rollout — 2026-09-10 / #228 / draft PR #229

- Supersedes the preceding pending-hosted checkpoint. Exact candidate SQL SHA-256
  `889e424c3ebefa4145534e2cca0a531d107947b187d7c225f6d355dcc9f26711`
  deployed to `mwrnvfosrzwygrunrltm` as provider version `20260910110344` /
  `list_membership_resurfacing`. Repository filename aligned; SQL bytes unchanged.
- Captured the actual prior function and rehearsed its replacement in the full
  isolated PGlite schema. The manual recovery file restores its original function
  fingerprint `06da0244916a790932288371e71686a9`; recovery is a new forward migration,
  not deletion of deployed history. No recovery was applied hosted.
- Hosted metadata comparison: only the intended function definition changed;
  its owner/ACL/security/search path, 128 unrelated functions, 21 application
  triggers, default ACLs and all 46 old version/name rows remained unchanged.
  No application records were exported or whole-data parity asserted.
- The first hosted smoke rolled back on a fixture assumption: an eligible
  synthetic book need not reach the top 20 of the populated catalog. Corrected
  the probe to require exact return only with at most 20 discoverable books;
  eligibility restoration is unconditional. The corrected rollback-only hosted
  probe passed all Personal/List/reminder/terminal/isolation/Shared assertions,
  with top20ReturnRequired=false and top20ReturnObserved=false.
- Security advisors unchanged: 18 existing RLS-without-policy INFO findings and
  existing leaked-password-protection WARN. No permissions or Auth setting changed.
- Next: ineffective undo and Shared withdrawal/removal UX, then replacement APK
  and owner device tests. Keep the PR draft and DATA-003/004 open.
- Validation: full `npm run check` passed (241 mobile, 14 catalog, 61 database
  tests; both platform exports). Separate captured-prior upgrade/recovery rehearsal
  passed. Latest native CI and new device acceptance remain separate gates.


### Undo availability and Shared removal review — 2026-09-10 / #228 / #229

- Confirmed UI bug: canUndo used only stack length while the dispatch boundary
  could refuse pending collection work. Availability now uses current-session
  outbox readiness and zero pending commands; the handler also checks the current
  queue synchronously. A refused start shows feedback. The original phone symptom
  has not yet been reproduced/accepted on the replacement build.
- No List-removal undo affordance: a changed removal discards same-Item undo entries
  now behind its server head, while retaining other Items. List deletion clears
  session history because the receipt does not enumerate affected Item IDs.
  No-op receipts preserve history, and successful undo receipts do not repush it.
  Added five deterministic history/readiness regressions; server RPC semantics
  and immutable receipts are unchanged.
- Reviewed Shared withdrawal: existing REVERSE_ENDORSEMENT only handles a pending
  proposal. Completed consensus raises an explicit refusal. The Shared Saved view
  now explains that completed removal is unavailable and omits the invalid direct
  remove action. Custom Shared Lists retain direct removal; consent Saved survives.
  This is honest UI, not implementation/acceptance of completed-consensus removal.
- Next: required CI and a manually dispatched replacement APK from this branch;
  focused owner device acceptance, without build polling. Keep PR draft. Full
  completed-consensus removal needs a scoped lifecycle decision; keep it visible.
- Validation: `npm run check` passed all 321 tests (246 mobile, 14 catalog,
  61 database), TypeScript/lint and both exports. No emulator/phone test was
  available in this workspace; native CI and owner device acceptance are pending.


### Second owner device report and collection-source correction — 2026-09-10

- Owner reports b51f962 List behavior, undo (List/rating/rejection) and reconnect
  working; old choices still failed with “item not found”. This does not accept
  historical navigation or close all DATA-003/004 gates.
- Root causes found: Discovery's history tab filtered the serving recommendation
  pool that intentionally excludes consumed Items; Lists/history opened only an
  ID and Detail fell back to the mock catalog. History now uses the existing real
  collection route; collection navigation carries loaded Item snapshots into Detail.
- Collection transport is bound to Profile/session, has explicit COLLECTION origin
  and no Prediction ID, keeps consumed Items in swipe browsing, and labels the
  destination. History scope/revision keys prevent reuse across Profiles; interaction
  changes reload current history. Added two transport/order regressions.
- Pull refresh now works on Discovery, Lists and history. Green RYHMÄTILA appears
  beneath the global mode selector only for a Shared Profile.
- Remaining owner scope: multi-List addition before card advance; common cover
  grid/card selector on all Lists/history; visible rating and explicit history
  removal via atomic evidence; finish replacing ordinary retry UI. Completed Shared
  consensus removal remains a distinct unresolved lifecycle boundary.
- Owner authorizes all-Profile choice and Shared-group reset before the next test.
  Preserve accounts/catalog, review derived evidence and local outbox handling;
  reset has NOT run and no new APK is requested at this partial checkpoint.
  STATUS owns exact order and all requirements. Continue short saved work periods.
- Validation: full `npm run check` passed 323 tests (248 mobile, 14 catalog,
  61 database), TypeScript/lint and iOS/Android exports. No new device or visual
  runtime acceptance claimed; the next test waits for the remaining owner scope.


### Personal multi-destination picker — 2026-09-10 / #228 / #229

- A successful Personal List addition keeps the picker open, marks the membership,
  and allows another destination. Valmis advances once and sends no duplicate
  command/message. Each List addition is independently durable; failure on the
  second destination does not reverse the first. Close keeps committed/queued work.
- In-flight guards block repeated same-render taps. A new open request has distinct
  saved/progress identity, and stale completions cannot close it. Collection revision
  reloads no longer reset the user's message/create/expanded state. Optional messages
  attach to acknowledged additions; Done does not send them again.
- New-list creation also stays in the Personal picker after saving. Existing
  memberships are marked and cannot be added twice through the same open picker.
  Shared endorsement/proposal remains the existing single destination consent flow.
- Added a durable regression: first destination acknowledges, second fails offline,
  restart retries only the unchanged second command and preserves the first receipt.
- Next: common cover-grid/swipe selector on Lists/history, canonical history-clear
  action and remaining refresh UI. Then the already authorized all-Profile choice /
  Shared-group reset and combined device test. No reset or new APK in this step.
- Validation: full `npm run check` passed 324 tests (249 mobile, 14 catalog,
  61 database), TypeScript/lint and both platform exports. New picker interaction
  still needs the planned combined device test; no emulator/device was available.


### Shared collection cover grid — 2026-09-10 / #228 / #229

- Published the explicitly approved Personal multi-destination correction as
  `4e8e301`; remote/local publication handoff is resolved.
- Extracted DiscoveryItemCard without copying a parallel card design. Discovery,
  named Lists, Saved and Luetut/Katsotut now reuse the cover presentation. Rating
  badges render numeric zero as well as other ratings; consumed labels remain for
  unrated entries. Collection dates and original Shared provenance remain visible.
- CollectionGrid replaces ScrollView row maps with a bounded FlatList: six-cell
  initial/batch rendering, two columns and near-visible image mounting. Both List
  and history headers offer Ruudukko / Kortit; card mode opens the loaded collection
  and preserves its Profile/session/collection origin. Return goes back to that grid.
- List filters/sort, rename/delete and permitted entry removal remain available;
  completed Shared Saved removal is still explicitly unavailable. Removed obsolete
  row styles and the unused old LIST/GRID view type.
- Next: canonical atomic history-clear action, final ordinary retry/refresh UX,
  then the authorized choice/group reset and combined device test. No reset or new
  APK here; new card layout has not been accepted on a phone/emulator.
- Validation: `npm run check` passed all 324 tests, TypeScript/lint and both
  platform exports. Existing collection-origin/order tests remain passing; visual
  and gesture acceptance stays with the planned combined device checkpoint.


### History-clear server candidate — 2026-09-10 / #228 / #229

- Added atomic non-undoable CLEAR_HISTORY to the existing collection RPC; native
  rating/consumed and terminal import evidence clear together with corrective
  Events and the immutable receipt. Saved/List/interest/rejection state survives.
- Exact corrections remove every active old rating/consumption Event from Memory
  and outcome readers. No fabricated current-view attribution is attached.
- Rollback-only full-schema acceptance covers actual Memory, retry after rerating,
  no-op, stale undo, authorization, independent state and injected write failure.
  Forward metadata checks preserve all function identities/ACLs and unrelated bodies.
- Next: mobile durable command/UI wiring and reviewed hosted rollout, final
  refresh UX, authorized choice/group reset immediately before combined device test.
  Hosted database and accounts are unchanged; no APK/device acceptance claimed.
- Validation: full `npm run check` passed all 324 tests, lint/TypeScript and
  both platform exports (exit 0). Native CLI acceptance is wired for CI but was
  not executed locally; no device/emulator was available.


### History-clear mobile wiring — 2026-09-10 / #228 / #229

- Luetut/Katsotut grid exposes Poista historiasta through the existing durable
  collection action queue. Saved lists remain independent; copy explains this.
- Synchronous duplicate-tap guard, acknowledgement-driven refresh and content
  keyed by Profile/Event session protect against stale completion feedback.
- Command/receipt validation requires uncorrelated, fully cleared history state.
  Offline/restart regression verifies the exact persisted command reaches the RPC.
- Next: reviewed hosted history-clear rollout, final refresh UX, then authorized
  choice/group reset and combined device checkpoint. No hosted writes/reset/APK here.
- Validation: `npm run check` passed 325 tests, lint/TypeScript and both platform
  exports (exit 0). Phone/emulator interaction remains untested.


### History-clear hosted rollout — 2026-09-10 / #228 / #229

- Applied unchanged reviewed SQL as provider version 20260910134428; aligned the
  candidate filename without editing SQL bytes or historical tracking.
- Preflight matched the old function exactly; postflight matched the new body and
  preserved all function identities/ACLs plus 128 unrelated definitions.
- Rollback-only hosted acceptance passed Memory cancellation, import/state
  preservation, retry/rerating and authorization. Failure injection stays isolated.
- Security findings are unchanged. STATUS records hashes, recovery and exact
  next task: final refresh UX, authorized reset, combined real-device acceptance.
- Validation after filename alignment: full `npm run check` passed all 325 tests,
  lint/TypeScript and both platform exports (exit 0). Device acceptance remains open.


### Ordinary pull-refresh completion — 2026-09-10 / #228 / #229

- Added native pull refresh to the List index and vertical overscroll support to
  Discovery/collection grids. Shared refresh reflects both read requests.
- Replaced ordinary load retry buttons with pull guidance in Discovery, Lists
  and consumed history. Durable command recovery remains intact.
- Next: authorized all-Profile choices/Shared-group reset with stale-client queue
  protection, then combined device acceptance. No reset/APK performed here.
- Validation: full `npm run check` passed 325 tests, lint/TypeScript and both
  platform exports (exit 0); actual pull gestures remain device acceptance.


### Reset rehearsal and portable device handoff — 2026-09-10 / #228 / #229

- Runtime head 2cb204f passed CI #429. Prepared DEVICE_TEST.md with manual branch
  APK instructions, reset prerequisite and eight owner scenarios; linked in docs map.
- Rehearsed owner-device-reset.sql twice on hosted with ROLLBACK. Fresh Personal
  IDs reject old rating/collection/Event-session writes while preserving accounts,
  catalog and Personal custom List names; empty new Profiles can rate normally.
- Permanent COMMIT was rejected by automatic approval review as broader than the
  prior choices/groups permission. No data was reset. STATUS records exact scope
  and next approval/action so another conversation can continue without chat.
- No schema change, new app code, APK dispatch or device acceptance in this step.
- Final handoff validation: full `npm run check` passed 325 tests, lint/TypeScript
  and both platform exports (exit 0).


### Approved reset committed — 2026-09-10 / #228 / #229

- Owner explicitly approved the full identity/history/group reset; the earlier
  automatic-review block is resolved. Ran the reviewed transaction with COMMIT.
- Independent post-commit verification at 14:19:19 UTC: 2 Users, 2 new Personal
  Profiles, no Shared groups/Events/interactions/List entries/imports/receipts/
  Predictions. Accounts/catalog/Personal List names were preserved.
- Old Profile-bound replay was denied and new Profile writes succeeded in the
  transaction's rolled-back probe. No repeat reset; DEVICE_TEST.md and STATUS
  now direct the next conversation to the manual branch APK and owner tests.
- No app changes, APK dispatch/polling, merge or device acceptance in this step.


### Owner device feedback, documentation only — 2026-09-10 / #228 / #229

- Recorded numbered results in DEVICE_TEST.md; installed APK SHA/run unspecified.
  Core flows work, including multi-list saving, history removal, refresh, durability
  and scope switching. Initial-profiling ratings are missing from history and
  appear in Shared cards; determine the actual tier/evidence semantics before fixes.
- OnePlus destination picker overlaps bottom navigation. Fix after evidence parity;
  preserve accepted list/history behavior and new test data (no additional reset).
- Longer profiling proposal (~10 movies + 10 books with transition card) is recorded
  in LAUNCH_LOOP/Phase 15.0, with current calibration impact to be evaluated.
- Deferred invitation reveal/copy-link idea belongs to Phase 16, not this sprint fix.
- User explicitly requested no implementation now. STATUS gives the next
  “jatka reposta” order. No code/database changes, APK build, tests or merge performed
  for this documentation-only feedback update; prior checks remain historical.

### Initial-history and OnePlus correction — 2026-09-10 / #228 / #229

- Continued the explicit next-conversation handoff. Both consumed history and
  Shared member overlay omitted bootstrap evidence; a read-only hosted check
  confirmed the missing-history case without resetting or altering user data.
- Added one private native/terminal-bootstrap read projection and authorized
  hydration RPC; reused it for history, List badges and accepted-member Shared
  attribution. Native edits take display precedence, zero remains valid, and
  reads never synthesize Events or Shared state. Existing clear/undo/Memory and
  suppression contracts remain intact.
- Added full-schema calibration/import/native/Shared/privacy/clear regression
  and unchanged populated-forward rehearsal. Both are in required native CLI CI.
  Hosted preflight matches all three old target definitions/owners/ACLs.
- Fixed picker safe-area/dock clearance and keyboard/scroll behavior through a
  shared dock constant; book member-history labels now say lukenut/lukeneet.
- Evaluated the longer profiling request in LAUNCH_LOOP: current server supports
  20 balanced opportunities, but progression/order/stop behavior needs its own
  versioned Taste change in Phase 15.0. No forced repeat or higher known-rating
  minimum is introduced in this correction.
- `npm run check` passed 326 tests (251 mobile, 14 catalog, 61 database), lint,
  TypeScript and both platform exports. No local phone/emulator; focused device
  cases are in DEVICE_TEST. Publication, new-head native CI and hosted rollout
  are pending at this checkpoint; STATUS owns their current state. Keep draft,
  preserve new test data, and do not infer DATA-003/004 or phase acceptance.


### Initial-history rollout verified — 2026-09-10 / #228 / #229

- Published implementation `b8ff101` has the exact locally tested tree
  `00c5872bc4b82580f8fa1f682f1b8042f46e405f`. All five required CI #434 jobs passed,
  including native CLI calibration/history behavior and populated-forward checks.
- Applied only the reviewed read-functions forward as actual provider version
  `20260910153737`; SQL SHA-256 remains
  `40a6e3b32fe6e1555acb2ac85293b8235484f737c08d50172ddf6d19272b24b9`.
  Aligned the filename using the same SQL bytes; historical migration files remain
  unchanged. The new mobile hydration RPC is now available.
- Postflight preserved all 129 old function identities/owners/ACLs, 126 unrelated
  definitions, inventoried triggers/defaults and 48 previous migration identities.
  Three new functions and three replacement definitions match the source exactly.
- Unmodified rollback-only hosted history probe passed; a separate read confirmed
  initial history coverage and no fixture Item/Shared residue. Security advisor
  findings are unchanged. Real user data was not reset; no whole-data parity claim.
- STATUS owns the exact recovery procedure and next APK checkpoint. CI #434 skipped
  APK building by design; no new APK was dispatched or polled. Draft/owner device
  acceptance and full DATA-003/004 remain open.

### Owner-requested repeat test reset — 2026-09-10 / #228 / #229

- After the correction rollout, the owner explicitly requested the same full
  reset again to rerun the tests. This supersedes the earlier preservation
  instruction; it is not a reset caused automatically by the new app version.
- Scoped the retained operational script to the current Profile identity digest,
  added Auth-record preservation and both accounts' real calibration-API checks,
  rehearsed with ROLLBACK, and committed the exact reviewed transaction.
  The published script uses a blocking placeholder instead of the private digest;
  any future authorized use requires an independently reviewed current scope.
- Independent verification at 15:54:09 UTC: 2 accounts, 2 new PersonalProfiles,
  zero choices/bootstrap evidence/Events/List entries/imports/receipts/Predictions/
  Shared groups/invitations/messages. Both accounts can start calibration again.
  Auth/nicknames/catalog and 2 Personal custom List names survive. Old Profile-bound
  replay is denied; a new-Profile rating succeeds only in a rolled-back probe.
- STATUS and DEVICE_TEST now start from this second reset. Preserve subsequent
  legitimate test data unless the owner asks again. No schema/app change, APK
  dispatch/polling, merge or additional device acceptance in this checkpoint.
- Validation: `npm run check` logs confirm 326 passing tests, lint/TypeScript and
  both platform exports; hosted reset rehearsal and independent app-API checks
  passed. The two existing duplicate-import lint warnings remain unchanged.

### Second device feedback and destination correction — 2026-09-10 / #228 / #229

- Owner reports initial profiling/reset, initial history/edit/undo, history removal
  and Shared attribution working. The requested source was `621a03c`; the installed
  APK/run remains unspecified. OnePlus picker alignment and first-destination
  creation remained failing cases; record the next exact build during retest.
- Replaced the destination picker's separate native Modal with an overlay inside
  the shell content bounds above the dock, matching Inbox's bottom gap. Retained
  keyboard avoidance, scrolling and Back/close/confirmation controls.
- Read-only action inspection confirmed create-List immediately triggered Shared
  endorsement. Creation/selection now prepares a draft; sole/new destinations
  select automatically, optional message requires a usable target, and explicit
  Add/Propose is the only Item mutation. Shared failures keep the Item and draft;
  acknowledgement precedes advancement. Personal multi-List addition remains
  available; a message error is reported without undoing the successful List add.
- Owner accepts equal-score variation. Existing 30-minute exposure cooldown also
  explains refresh rotation; a bounded hosted trace read found expected descending
  unequal-score order. Added SQL regressions for unchanged taste priorities,
  exposure rotation/expiry and Profile isolation; serving SQL remains unchanged.
- Added draft-selection regressions for no destination, sole/new selection,
  refreshed ordering, already-saved Personal choices and creation/refresh races.
- Added the always-available unknown action after wheel movement to LAUNCH_LOOP
  and Phase 15.0 alongside longer Taste progression. Current calibration remains
  unchanged. No reset, migration, APK dispatch/polling or merge in this correction.
- STATUS/DEVICE_TEST own the next narrow APK gate. Physical layout/keyboard and
  the full device create→message→proposal flow still need owner acceptance.
- Local validation: `npm run check` passed 333 tests (256 mobile, 14 catalog,
  63 database), lint/TypeScript and both platform exports. Existing duplicate-import
  lint warnings remain unchanged. Publication/final-head CI belong to the PR.

### Owner ideas and rating-position report — 2026-09-10 / #228 / #229

- The owner reports the next APK is building and will test it when ready.
  Runtime remains `07b12ea86f3952844d475de9e8f02670a8381ffb`; this entry and its
  related canonical updates are documentation only.
- Recorded personal category statistics as FUT-UX-001 / #230: drawer/Profile
  destination, independent unlock, rated/mean/not-interest/List totals, working
  thresholds of 30 initial reactions and five new reactions per category/week,
  Monday countdown/snapshots, source deduplication and conditional comparisons.
  The earlier suggested 50 remains a tunable alternative.
- Recorded long-press multi-select as FUT-UX-002 / #231: upper-left checkbox,
  Discovery reject/List-add and List move/remove, accessible selection, preserved
  per-Item origin, atomic moves and partial/durable/Shared permission semantics.
- ROADMAP places both as separately scoped Phase 17.0 candidates, with weekly
  stats/comparisons dependent on 17.1/17.2. No new MVP blocker, future feature
  implementation or change to the current Phase 14 dependency order.
- Added the owner's current Katsotut card report to STATUS/DEVICE_TEST/UX: start
  the rating handle at the saved value, including 8 and 0. Existing control/prop
  initialization already expresses that rule; history versus Detail hydration
  needs reproduction before asserting a root cause. The report remains open.
- Local execution became unavailable (environment disconnected). Source inspection
  and document consistency checks used the exact GitHub branch snapshot; no new
  runtime test or npm check was run. The prior 333 tests apply to the unchanged
  runtime only. No APK dispatch/polling, merge, migration or reset.

## Third APK result and multi-destination correction — 2026-09-10 / #228

The owner reports the APK tested with only multi-List selection missing; exact
installed SHA/run was not supplied. Both Profile types now expose checkboxes and
one confirmation. Personal uses existing durable per-List commands with retained
unresolved choices. Shared binds the exact reviewed set, displays every target to
approvers and atomically commits all memberships/Events at unanimity. Creating a
List preserves earlier checks and never advances the card. Remaining messages
stop if the scoped view unmounts.

The new forward adds a private destination relation and six functions; four old
function definitions are intentionally replaced with identities/owners/ACLs kept.
Both legacy endorsement RPCs reject hidden multi-List consent. Full-schema tests
cover second-List Event failure rollback, exact replay, unchanged old receipts,
foreign/duplicate targets and whole pending cancellation when any target is deleted.
The populated-upgrade rehearsal preserves existing data/old function boundaries.
`npm run check`: 338 tests (261 mobile, 14 catalog, 63 database), lint/TypeScript
and both exports. Native CI and hosted rollout belong to the live STATUS checkpoint;
no local Docker/device runtime is claimed. DEVICE_TEST owns the next manual APK
cases; preserve current test data and let the owner start its workflow.

Issue #232 records required SharedRatingRound/rewatch semantics in the canonical
domain, evidence, prediction, UX and launch documents and `MVP-SOCIAL-007..009`.
Personal setup precedes joint responses; A’s rating is pending until the required
others answer; only completion enters joint history. Individual responses and
Personal history remain separate, and new experiences preserve earlier history.
Strong member-seen recommendations and controlled rewatch require a versioned,
validated policy. Phase 14 establishes correctness; Phase 16.3 delivers the full
flow before beta. No round API/schema/UI or rewatch-policy change is implemented
in this multi-List correction. Optional #230 statistics and #231 multi-Item actions
retain their Phase 17 candidate status.

### Publication gate — CI passed, hosted approval blocked

Implementation `e4a28bfae6e9edaa507242e4374d4d9ca0dd971a`, exact locally tested tree
`cd71b7035b31be4cac1daba1e8860fb3341bb573`, passed all five required jobs in
[CI #442](https://github.com/Kajooja/Kajo/actions/runs/34515831721); APK skipped.
Automatic approval review then rejected the exact hosted `shared_list_destinations`
forward: it classified the table/security-sensitive function changes as a shared
database mutation without explicit owner authorization, despite code publication
being authorized. No alternative mutation path is allowed. The forward remains
undeployed and needs a direct owner approval; the new app’s overlay v2 depends on
it. Keep the PR draft, preserve current data and complete no new APK acceptance
claim. STATUS records the exact SQL hash/target and post-approval continuation.

### Owner approval and hosted multi-destination rollout — 2026-09-10

The owner explicitly approved the previously blocked hosted migration. Applied the
unchanged reviewed SQL on `mwrnvfosrzwygrunrltm`; provider version/name is
`20260910190243_shared_list_destinations`, SHA-256
`c6196e699b3720755652f6b61c7dc8776333be0ebce1df592e6487d828757b4f`.
Aligned only this new filename to the provider record, without altering SQL or old
history. Native CI #442 already passed the identical implementation/forward.
After alignment, npm run check again passes all 338 tests, lint/TypeScript and
both iOS/Android exports.

Postflight preserves all 132 old function identities/owners/ACLs/security settings,
128 unrelated definitions, 32 old table identities/ACLs/RLS and creator defaults.
Four intended replacements plus six new bodies match source. Sixteen existing
application/Auth/history/List data fingerprints and counts are identical before,
after and after the rolled-back authenticated command probe. That probe passes
exact consent, two-List atomic consensus, forced second-List Event failure/retry,
old receipt replay, whole pending cancellation and outsider/legacy rejection.
No fixture trigger or destination rows remain; new private data/internal-core
access is denied and authorized overlay v2 works. Advisors report expected
private-table RLS-without-policy INFO; the existing Auth password warning/old FK
notices do not change this rollout’s access contract.

The earlier approval block is resolved. The owner may start the manual APK workflow
on the active branch and test the four DEVICE_TEST cases with both accounts on the
new build. No reset or local Docker is required. No APK was dispatched/polled and
no phone or merge acceptance is claimed. Retain server consent guards if reverting
the client; prefer a narrow corrective forward over erasing pending/history data.

### Late Outcome continuation while owner APK runs — 2026-09-10

The owner started manual APK CI after the multi-destination deployment. Its
requested source is `50bd1a8dd20f6ab617c266599be185d8b8d42412`; actual run/installed
SHA and four-case device result have not been supplied. No APK dispatch/poll,
account reset, hosted mutation, mobile edit or merge was performed in this step.

Closed the next bounded Phase 14.1 source gap: already committed unattributed
actions previously stayed absent from ScenarioMemory/SleepLayer even after their
exact pre-action impression arrived. The new CLI-generated forward is
`20260910192630_late_outcome_attribution.sql`, SHA-256
`36cffca7490bc46ba94882de52def69c1d0618cea0e4a33175d70bccb5256d9b`.
It adds one private invoker read helper and replaces only the serving/evaluation
readers, preserving existing function identities/owners/ACLs. Exact private
receipt ownership, original actor/Profile/Item/session/mode, selected run and
actual impression are required. Raw Events/receipts and old evaluations stay
unchanged. Both consumers use the same versioned attribution rule and existing
reward/priority/undo semantics; evaluation records its separate evidence-read
cutoff without modifying frozen prediction inputs.

Validation: `npm run check` exits 0 with **338 tests** (261 mobile, 14 catalog,
63 database), lint/TypeScript and both iOS/Android exports. Extended the existing
14-case full-schema delivery matrix to verify effective attribution. The new
`late-outcome-smoke.sql` exercises actual Shared serving and frozen-shadow labels
before proof, after proof and after undo, including zero rating, occurrence/read
cutoffs, wrong member/Profile/Item, duplicate impressions, forged receipt IDs and
unchanged historical results. `late-outcome-upgrade.mjs` applies the unchanged
forward over populated synthetic data including a real prior receipt, checks data
and old function boundaries and rolls back. Open creator defaults do not expose
the helper; a missing installed source anchor fails and rolls back partial DDL.
Both full-schema acceptance and populated upgrade are wired into required native
CLI CI. There is no local Docker, emulator or phone; native CI for this new source
and its separate hosted rollout remain pending at publication.

Continue the same #228/#229 handoff. Hosted stays on the accepted multi-destination
forward while the owner completes that APK test. Then verify required native CI
and prepare a separately reviewed exact-SQL rollout. Keep physical recovery and
remaining Phase 14.1 gates open before Phase 14.2; no SharedRatingRound, Stats or
multi-Item feature starts ahead of those dependencies.

### One-confirmation Personal Lists and queue latency — 2026-09-10

The fourth owner APK report says the rest is good but adding to two Lists feels
frozen and Personal Add must save the entire selection and open the next card
without Valmis. Requested prior source was `50bd1a8`; actual installed SHA/run and
timed device measurements were not supplied. Preserve that distinction and the
existing profiles/data; do not repeat account resets or dispatch/poll APK CI.

`commitPersonalListDestinations` now freezes the user's choice, awaits the existing
durable per-List acknowledgements and invokes completion once. The sheet removes
Done, displays confirmed progress/activity and suppresses intermediate destination
reloads. A partial failure keeps acknowledged saves and unresolved choices; only
newly acknowledged destinations receive optional messages, and scope changes stop
old callbacks/later commands. Shared continues through its existing exact-set
proposal/consent path.

The Event coordinator reuses a session only after its actual server acknowledgement,
with a fresh confirmation after restart/new scope. Six impressions need seven
session/Event writes instead of twelve. A scoped acknowledgement subscription wakes
only actions waiting for exposure, including acknowledgement while the waiting
result is still in flight. The guard rereads durable dependencies; network failures
keep backoff and rejected/stopped actions do not resume. No Event/command identity,
server API, migration or hosted data changed in this step.

Validation: 44 focused tests pass; `npm run check` exits 0 with **347 tests**
(270 mobile, 14 catalog, 63 database), clean lint, TypeScript and both platform exports. No
Docker/phone/emulator or measured physical timing is claimed. DEVICE_TEST records
the short one-confirmation/responsiveness/recovery/Shared regression for the next
owner-started APK. Native CI for this client source remains a publication gate.

Separately verified all five required CI jobs for algorithm commit
`316bd0858972e2e7bc4abc2d3e2360c89c83a97f` at
[run 34521599718](https://github.com/Kajooja/Kajo/actions/runs/34521599718), including
the native CLI late-outcome serving/evaluation and populated-forward probes.
That forward's tested SQL/hash is unchanged and still undeployed. Continue its
own reviewed hosted rollout plus remaining Phase 14.1 device recovery gates
before Phase 14.2. No merge, automatic APK action or distant feature work occurred.

### Frozen serving/shadow replay while APK acceptance is deferred — 2026-09-10

The owner explicitly deferred the Personal Add/latency APK regression and asked
continued development. Required client CI is now verified on
`1102d92e25ac973909b073fdcdaa8f2cdc9fcf22`,
[run 34524399404](https://github.com/Kajooja/Kajo/actions/runs/34524399404), all five
jobs successful. No APK dispatch/poll, reset, hosted mutation or merge occurred.
This checkpoint prepares the independent Phase 14.2 correctness slice; Phase 14.1
rollout and physical recovery gates remain open, and neither phase is accepted.

The full-schema reproduction gave the baseline Shared candidate −1.0406 in
serving and 0.1 in shadow because common-fit was omitted. Shadow also scored from
rounded display features and ignored resurfacing eligibility/tier ordering. The
CLI-generated forward `20260910202244_frozen_prediction_replay.sql` (SHA-256
`4ff3feab61d522d4763a63c23c7da8454d32322c7326c5b833b4db52f768dd7a`)
adds three private pure helpers and replaces five installed bodies with guarded
anchors. It changes no table data, existing identities/ACLs or immutable genomes.
The baseline generator, assigned scalar scorer, final serving and shadow share
full-precision scoring, including frozen Scenario/common-fit inputs. The run's
recorded genome controls both scalar and Scenario weights. Shared reminder-cap
and delivery-tier helpers preserve ordinary-before-reminder order and suppress
ineligible cards. The challenger recalculates its reminder choice from frozen
pre-cap input and its scalar weights.

Versioning is explicit: new raw inputs `prediction-features-v2`, serving policy
`+frozen-replay-v2`, shadow/evaluation `shadow-replay-v2`, comparison scope
`FROZEN_SOURCE_POOL`. Original traces/evaluations remain intact; pending legacy
jobs fail diagnostically and new comparisons exclude incompatible old shadows.
They are never reconstructed from later catalog/taste/member state. No automatic
promotion or accuracy claim is introduced.

The new full-schema `frozen-replay-smoke.sql` checks 18 Personal/Shared × three
modes × three page sizes with exact score/rank/policy/selection equality, nonzero
Scenario/common-fit, raw precision boundaries, deterministic ties, suppression,
one-reminder cap, an actual challenger reminder flip and later-state isolation.
An independent accepted-formula check uses 1e-12 arithmetic tolerance. The
`frozen-replay-upgrade.mjs` rehearsal preserves populated data, durable receipts,
old frozen shadows/evaluations, raw baseline scores across modes and all existing
function identities/ACLs/unrelated bodies. It verifies closed helper access even
with open creator defaults, diagnostic legacy-job failure and exclusion from a
new evaluation. A divergent source anchor rolls back all changes. Both probes
are wired into required native CLI CI; the prior late-attribution smoke accepts
its version token with the added replay suffix.

Repository gate: `EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **348 tests**
(270 mobile, 14 catalog, 64 database), clean lint/TypeScript and both platform
exports. New-head native CLI CI and the separate hosted rollout remain open gates.
There is no local Docker, emulator or phone. Hosted remains on multi-destination
`20260910190243`; the unchanged late-outcome forward must precede this new forward.

Next source work is the bounded baseline-top-50 starvation/eligibility/refill
reproduction and correction (`MVP-ALG-003`). This slice only proves parity on the
frozen source pool; empty/refilled pools, zero-result worker behavior and rollout
acceptance keep `MVP-ALG-002` open. Preserve Phase 14.1 recovery gates, the deferred
APK cases and the same draft #228/#229 handoff.

### Native replay precision correction — 2026-09-10

CI on `99bdecc` passed four required gates but failed native populated-upgrade
baseline-score equality in run 34527872429. The same failure is reproducible in
PGlite with `extra_float_digits=0` or -1: JSON construction rounds float inputs,
although the old direct scorer retains the binary value. V0 now pins
`extra_float_digits=3` in its own function configuration, restoring the caller's
setting on return. Existing identities/owners/ACLs and every other configuration
remain unchanged. Exact baseline equality is retained, not replaced by tolerance.
The complete upgrade/replay tests run with both rounded and precise callers;
native CLI acceptance explicitly exercises a rounded caller as well.

The still-undeployed replay migration was corrected in place; its current SHA-256
is `22d42dce06240092faec75550adcf70de75846079ac48ade0a80231671511f4a`.
The preceding checkpoint's hash identifies the earlier undeployed revision.
`EXPO_OFFLINE=1 CI=1 npm run check` passes all **348 tests**, lint/TypeScript and
both platform exports. Native CI for this correction is still required. No
hosted mutation, APK action or phase acceptance is implied; candidate availability
remains the active continuation.

### Candidate admission and empty replay — 2026-09-10

Owner instruction remains to continue development while the Personal Add/latency
APK regression is deferred. Same branch `feat/228-delivered-origin`, draft #229 /
Issue #228; accepted main `6dd1fec` and all hosted/device acceptance gates remain.

The new full-schema fixture first reproduces the defect on preceding source:
70 consumed high-fit Items fill raw baseline top-50 and public ranking returns
zero although 24 ordinary alternatives exist. This occurs in all 12 Personal/
Shared × BOOK/MOVIE × DiscoveryMode requests. The forward moves canonical
admission before retention and reuses that decision during scalar scoring; all
12 requests then deliver 20. Ordinary Items precede reminders and suppression;
the genome still chooses at most one reminder from its frozen retained pool.

CLI-created forward `20260910210520_eligibility_first_candidate_pool.sql` is
**undeployed**, SHA-256
`92bf98666e22c62873d54a74c586b4deddbc0cc0daff168c8dcd0e65a40b7b46`.
It replaces five existing bodies through guarded anchors and permits zero in the
shadow result-count constraint. It adds no tables/functions and preserves public
signatures, genome weights and historical data. New source policy and admission metadata use
`eligibility-first-v1`; counts/ranks identify the baseline-admission stage.
V0 retains at most 50 and expensive Scenario/common-fit plus persisted traces
retain at most `min(50, 3 × requested limit)`. All-suppressed and explicit empty
source controls complete with zero hypothetical selections. Automatic challenger
queueing still omits an empty pool. Pre-admission frozen v2 sources remain replayable.

`candidate-pool-smoke.sql` checks 36 Profile/domain/mode/limit combinations, two
mixed-domain pools, four exhausted and four empty controls. It verifies available
Items below the old top-50, member-Personal consumption versus Shared eligibility,
one-reminder limits, bounded traces, exact baseline scores/ranks/selection after
later consumption/catalog changes and denied outsider/missing-actor calls. No
synthetic Events or historical trace rewrites occur. The populated upgrade keeps
application/Auth/receipt rows and old frozen results, every existing function
identity/owner/ACL/configuration and unrelated constraint; old v2 replay remains
exact. Unexpected source rolls back the constraint and all prior replacements.
Both runtime and populated probes are wired into required native CLI CI.

CI for the preceding precision correction `5b9efd3` passed four required gates;
run 34529961511's native job completed the populated SQL but failed parsing a bare
UUID emitted by fixture `SELECT set_config`. Setup now uses `DO` / `PERFORM` with
no output. Both local probe adapters reject non-snapshot rows, closing the gap
where PGlite silently filtered output that native CI rejected. The precise replay
migration bytes and exact-score assertions remain unchanged.

`EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **349 tests** (270 mobile,
14 catalog, 65 database), clean lint/TypeScript and both platform exports.
New-head required CI remains to be observed. No local Docker/phone/emulator,
hosted mutation, reset, APK dispatch/poll or merge occurred. Hosted stays on
`20260910190243`; rollout dependencies are late Outcome attribution → precise
frozen replay → candidate admission, each still subject to its reviewed rollout.

This is a suppression-admission correction, not completion of `MVP-ALG-002..003`.
The existing full-catalog feature scan remains and admission now runs before the
cutoff; bounded indexed retrieval, independent Shared/novelty/Scenario sources,
cost/quality evidence and duplicate-free continuation remain open. Next source
slice is the versioned server/client continuation and empty-result contract:
the client currently treats an empty array as failure. Keep Phase 14.1 recovery
and deferred Personal two-List APK gates; no release checkbox is closed here.

A bounded local cost diagnostic also compared unchanged versus admitted full-schema
Personal `FOR_YOU` calls with 100, 1,000 and 5,000 ordinary MOVIE Items and no taste
history. Median of three warm PGlite samples after one warm-up: **50 → 47 ms**,
**115 → 144 ms**, **387 → 609 ms**, respectively. Each returned 20 and rolled back
its trace. This is a WASM fixture measurement, not hosted/device latency or a scale
acceptance result. It confirms that evaluating admission across the entire catalog
has a growing cost; indexed bounded sources remain necessary.

### Native candidate/replay acceptance — 2026-09-10

Implementation head `9fb48c286ecbcd6c706427819fadb61500dccb5c`, tested tree
`06691e988bff49a51a5913410be9941c22dbd461`, passed all five required jobs in
[CI run 34531767919](https://github.com/Kajooja/Kajo/actions/runs/34531767919).
The native CLI job 103054841812 reports `KAJO CI CLI INSTALL PASS` on pinned
Supabase Postgres `17.6.1.167`, image
`sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f`.
This includes rounded-caller replay precision, populated replay/admission upgrades,
runtime parity/admission/empty controls, repeated fresh installs, failed-migration
atomicity, defaults and unchanged native platform boundaries. The two preceding
native failures are resolved; no tolerance or gate was weakened.

This follow-up changes documentation only. Source/SQL bytes match the accepted
implementation head. Hosted rollout, physical device acceptance and the remaining
`MVP-ALG-002..003` retrieval/continuation gates remain open. Continue from STATUS's
versioned server/client continuation and empty-result slice on the same draft PR.


### Owner acceptance update and continuation contract — 2026-09-11

- Owner reports exercised tests working. Fresh/empty-account state could not be
  tested because additional accounts are unavailable; no cause or exact APK SHA
  is inferred. Future small-group reset/testing stays deferred; preserve data now.
- Extended planned #231 to history long-press/multi-select/trash, replacing the
  permanent removal label only after implementation. No selection code changed.
- Specified the next Phase 14.2 result/continuation contract in PREDICTION_MODEL:
  identifiable empty runs, immutable retry identity, bounded scoped cursors,
  distinct source-window exhaustion and per-page Prediction origins. Acceptance
  matrix is explicit; server/client implementation remains the next source task.
- Documentation-only checkpoint; no new runtime tests, hosted rollout, reset, APK
  polling or merge. Prior source 9fb48c2 passed 349 tests and all five CI gates.


### Identified first-page source boundary — 2026-09-11

Continued #228 / draft #229 on `feat/228-delivered-origin` after the owner’s
positive report for exercised device cases. Fresh-account/empty-state device
acceptance remains untested; current data is preserved.

CLI-created, undeployed `20260911070959_identified_prediction_page.sql`, SHA-256
`caf66c1e5558632e9dab78a538237d3e99594b41fa703b87f237b560445c4e08`,
adds a versioned first-page RPC. The prior scoring body is reused unchanged except
for its server-supplied run identity; legacy public row responses remain unchanged.
Private request receipts make exact retries immutable and reject changed payloads;
current membership is checked and locked even for cached responses. Request-ID
advisory locking serializes retries, and trace/receipt writes share a transaction.
Empty results retain actual PredictionRun identity and distinguish suppression
from a domain-empty catalog. Explicit `continuationSupported: false` advertises
that this slice does not implement cursors or switch the mobile reader.

Full-schema checks cover exact old scoring/public-wrapper preservation, guarded
source rejection, ordered unique origins, retry after catalog mutation, malformed
requests and changed payloads, six mode/domain suppressed empty runs, empty catalog,
revoked/outsider authorization, private ACLs and rollback after an injected receipt
write failure. `prediction-page.mjs` supplies the same rollback-only SQL probe to
PGlite and required native CLI CI. `EXPO_OFFLINE=1 CI=1 npm run check` exits 0:
**350 tests** (270 mobile, 14 catalog, 66 database), lint/TypeScript and iOS/Android
exports. Native CI for this new source, a populated upgrade preservation probe
and real multi-connection race validation remain open. No hosted deployment,
reset, APK dispatch/poll, device test or merge occurred.

Next: validate those native/populated gates, then implement the bounded immutable
continuation window and captured-scope client contract in PREDICTION_MODEL. Deploy
this fourth pending forward only after late Outcome attribution → frozen replay
→ candidate admission. Keep Phase 14.1 recovery/device gates and scalable retrieval
open. STATUS owns current branch/next action; CODEMAP includes the new paths.


### First-page upgrade and concurrency verification — 2026-09-11

Prior source `c7a4dddad31b54305a24fb0a71111d134e2ed191` passed all five required
jobs in [CI run 34573673279](https://github.com/Kajooja/Kajo/actions/runs/34573673279),
including native first-page behavior and CLI migration history. APK was skipped
as expected; no device or hosted acceptance is inferred.

This bounded follow-up changes test infrastructure only. The populated upgrade
probe in `prediction-page.mjs` fingerprints every existing application/Auth-user
table and preserves old function identities/owners/ACLs/configuration, unrelated
bodies and constraints. It permits exactly three added function identities,
checks no unsolicited receipts, and executes both public ranking contracts after
upgrade. It runs in the existing full-schema PGlite test and in native CLI CI.

`prediction-page-concurrency.mjs` uses independent native sessions through a new
asynchronous SQL adapter in the already owned, image-verified CI stack. The adapter
has 10-second statement and 30-second process timeouts, bounded output and no
external database URL. Each of two cases requires observing an actual ungranted
advisory lock for the waiting request: identical retry must return the same response;
changed-payload reuse must reject. Two accepted requests must create exactly two
receipts and two new runs. Synthetic committed fixture data is removed by the
next existing CLI reset; the normal complete-snapshot comparison follows it.

`EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **350 tests** (270 mobile,
14 catalog, 66 database), lint/TypeScript and both exports. The expanded populated
upgrade probe passes locally. New native concurrency and populated upgrade CI
results remain pending; PGlite is not evidence of concurrent execution. No runtime
migration bytes, hosted data, app behavior or APK were changed. All four pending
forwards keep their existing order and hashes.

Next: inspect this head’s required CI, fix any native probe failure, then continue
bounded immutable continuation windows and the captured-scope mobile contract.
Keep #229 draft; no merge, reset of hosted users or APK polling. STATUS remains
the continuation authority.


### Client first-page response validation — 2026-09-11

The new verification source `1a07dd5` reached CI run 34574927760, but its platform
stack failed at startup with `image-download,port-binding` diagnostic labels before
application SQL. These are observed symptoms only. Native populated-upgrade and
concurrent-retry acceptance remains pending; skipped downstream jobs are not passes.

Continued the independent client boundary while preserving the undeployed server
contract. `predictionPageOperations.ts` creates an immutable captured request/context
for reuse across transport retries, normalizes UUID scope and consumes the server's
identified first-page envelope. It verifies Profile/session/mode/domain/request/run,
ordered unique Item origins, source counts, size, availability and explicit unsupported
continuation. Valid empty responses preserve the server run ID; transport, auth and
malformed responses remain errors. The helper does not fabricate Predictions or
silently call another endpoint. The active legacy reader also now rejects duplicate
Items/ranks, wrong-domain responses and over-limit results, and copies Item tags.

Twenty-four new boundary tests cover normal/empty results, captured scope mismatches,
malformed/ambiguous rows, counts/capabilities, immutable requests after caller mutation,
exact retry and errors. Two legacy regressions cover duplicate origins/ranks and
wrong scope/size. `EXPO_OFFLINE=1 CI=1 npm run check` exits 0 with **376 tests**
(296 mobile, 14 catalog, 66 database), lint/TypeScript and both exports.

No server migration bytes or hosted data changed. The new reader is not activated
in `usePredictionRanking`; bare-empty legacy responses still error. No live runtime,
phone/emulator, hosted rollout, APK dispatch/poll or merge occurred. This is client
response parsing, not delivered pagination or empty-state UI. Next: clear native
upgrade/race gates, implement bounded immutable server continuation windows and
per-page runs, then activate captured-scope append/empty rendering and validate
per-Item origins on device. STATUS owns exact continuation; #229 remains draft.


### Bounded frozen continuation source — 2026-09-11

Prepared CLI-created forward `20260911074543_prediction_continuation_windows.sql`,
SHA-256 `1dad709b42d2072ea93166dccd846f01a91f6435763f1687c95d0b676358e415`.
It is the fifth undeployed forward, after the identified first-page boundary.
Source `91d07ee` has four passed jobs in CI 34575684407; the CLI/native-race job was
still running at this checkpoint. The preceding platform-start symptom did not
recur, but the pending job must still be inspected before claiming acceptance.

The new private derived cache retains a committed first-page source's exact run,
ordered candidate rows, scope and initial seen Item IDs. Owner-only open/read
helpers check actor and current Profile membership, reject expired/drifted sources,
and reuse the same window without reranking or fabricating Events/PredictionRuns.
No API grants, public endpoint, first-page receipt changes or mobile activation.

Bounds: 50 candidates/seen IDs, 2 MiB snapshot, 15 minutes from source ranking and
16 windows per actor/Profile. Scope advisory locking serializes creation. New
requests reclaim expired cache rows only; receipt/run/Event history stays intact.
Parent actor/Profile/run/receipt deletion cascades. No background cleanup job is
claimed; dormant scopes retain at most 16 expired rows until reopen/parent removal.

The rollback-only full-schema probe checks exact first-page seen IDs and source,
idempotence, later catalog/taste state, historical trace drift, empty sources,
expiry, capacity/reclamation, outsider/missing/revoked actor and API-role denial.
The same SQL is wired into native CLI CI. `EXPO_OFFLINE=1 CI=1 npm run check` exits
0 with **377 tests** (296 mobile, 14 catalog, 67 database), lint/TypeScript and both
platform exports. New native CI, real concurrent window-cap behavior and populated
window-forward acceptance remain open. No hosted mutation, reset, device test,
APK dispatch/poll or merge occurred.

Next: atomic page delivery against this frozen ledger, with current eligibility,
captured-scope/cursor validation, seen-set advancement, independent page run/ranks
and page-aware frozen/shadow replay. Raw cached candidates include suppressed and
already selected alternatives: they are not a deliverable page. Keep the public
first-page capability false until the whole page boundary is implemented and
verified; then activate the prepared client. STATUS owns the continuation.


## Active branch reconciliation — 2026-09-12

The independent-engine architecture and repository audit from #233/#234 are
reconciled into #229 while preserving every dated implementation/device record
below the original sprint checkpoint. Current STATUS supersedes historical next
actions: the corrected source `44b11b4` passed all five CI #458 jobs, so earlier
pending or failed first-page CI notes are historical. Atomic next-page delivery,
concurrent window-cap and populated-window upgrade tests, captured-session reader
activation, five undeployed forwards and device acceptance remain open. This
reconciliation changes documentation and carries the validated main hygiene fixes;
it does not complete those feature gates or change hosted data.

Reconciled local validation: `EXPO_OFFLINE=1 CI=1 npm run check` passed 377 tests
(296 mobile, 14 catalog, 67 database), lint/TypeScript and iOS/Android exports.
All 53 Markdown files passed local-target/heading-anchor checks. An independent
310-file source/tooling comparison found no feature implementation or migration
loss; differences are only the approved unused hook/wrapper removal, js-yaml patch
and migration-history manifest extension. The entire feature sprint appendix and
DEVICE_TEST are retained. Current published-head CI remains a separate gate.


## Atomic next-page source — 2026-09-12

Resume base: `e0eacb5` / PR #229; all five CI #462 jobs passed. Added CLI-created
forward `20260912105528_atomic_prediction_pages.sql`, SHA-256
`594e293f91a8ec4493bcbac4f68e30e64e33bf2611d8c6d37b3801ba38a1c7a1`. This is the sixth undeployed forward, after the
private continuation window. Existing SQL history is unchanged.

Numeric request protocol 2 opts into bounded pages through the existing public
endpoint; protocol 1 is preserved by an exact private first-page implementation.
Each next page owns its immutable run, ranks, frozen feature/state/genome inputs,
current eligibility snapshot and exact receipt. Request/scope locks serialize
cursor consumption and cache capacity. Later pages exclude the observed seen
prefix and enforce one reminder per window; the original source is unchanged.
Expiry/reclamation removes cache/cursors but retains authorized retry receipts
and historical page context. No arbitrary live candidate refill is introduced.

Page shadow uses `shadow-page-replay-v1`; evaluation declares
`FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX`. Comparisons remain conditional on
actual preceding production pages, not hypothetical whole-session outcomes.
The matching version reaches mature evaluation, including a native 0 rating
attributed to the page that delivered the Item.

Local full check: **378 tests** (296 mobile, 14 catalog, 68 database), lint,
TypeScript and iOS/Android exports. The focused page test additionally verifies
12 Personal/Shared/domain/mode windows with 48 page runs, exact baseline replay,
zero-rating evaluation, current state/catalog eligibility, actor/scope rejection,
rollback, expiry/reclamation and protocol-1 retries. A populated pre-window
upgrade preserves old data, first-page receipts, window snapshots and ACLs;
source-anchor mismatch rolls the forward back without partial DDL.

The required CLI CI runner now observes genuine native lock contention for
same-request retries, competing cursor consumers and concurrent 16-window
capacity, and runs the populated upgrade plus both page probes. Published-head
CI is the native acceptance record; inspect it before advancing the client.

First published head `19247e0` passed four jobs in
[CI](https://github.com/Kajooja/Kajo/actions/runs/34690842376); the CLI job reached
the final page-boundary probe and rejected its owner-side snapshot comparison.
The probe used native `extra_float_digits=0` to compare with a snapshot produced
inside protocol 2 at precision 3. The same failure was reproduced locally at 0.
The corrected probe compares at the snapshot's full precision and restores the
caller setting. Both page probes now run locally at 0 and 3, including caller-GUC
restoration; no migration or stored-row behavior changed. The follow-up head's
five CI jobs remain the acceptance gate.

No hosted database change, user-data reset, manual APK dispatch or device
acceptance is part of this source packet. PR #229 remains draft.

Next: captured-scope protocol-2 validation/reader/cache/append, per-page grid and
detail origins, then exact reviewed forward rollout and configured-device
acceptance. STATUS owns this next unit; E1 → D1 → D2 remains the subsequent
independent-engine research sequence.


## Captured-scope mobile pages — 2026-09-12

Resume source: `0a184a7` / PR #229, all five jobs accepted in
[CI #464](https://github.com/Kajooja/Kajo/actions/runs/34691537142). This resolves
the preceding atomic-page/native precision checkpoint. No SQL, migration history,
package version or lockfile changed in this client packet.

The active client now requests protocol 2. `predictionPageOperations.ts` validates
first/next lineage, exact scoped envelopes, genuine empty identity and contiguous
unique ranks; explicit protocol-1 compatibility remains. Requests and primitive
Context attributes are frozen, with a conservative 8,000-byte client bound.

`predictionPageReader.ts` owns one captured environment/actor/Profile/session/
domain/mode/limit/evidence-revision controller. Retry keeps its exact request;
refresh replaces the window. Later pages require the original source/time/count,
next index/cursor and unseen Item/run/request identities. Accepted prefixes are
immutable, including their per-Item page IDs and terminal empty-run identity.
Scope/focus cleanup invalidates pending requests and catalog enrichment. Context
is captured when the focused fetch begins; hidden feedback does not repeatedly
open unused windows. First scope entry is immediate; subsequent evidence updates
retain the 600 ms delay only after an earlier page was actually loaded.

Discovery exposes initial/next loading, scoped failures/retry, explicit fresh
search, empty catalog and bounded exhaustion. A request/view token keys the native
list and guards its retained visibility/open callbacks with the captured session.
Shared reordering, clicked detail/swipe and durable actions keep each Item's actual
page origin. Appending/prefetching creates no impression. The eight-slate navigation
handoff remains; the old global Item cache and unused row-RPC client were removed.
Catalog enrichment cannot change a delivered Item's domain.

Validation: `EXPO_OFFLINE=1 CI=1 npm run check` passed **420 tests** (338 mobile,
14 catalog, 68 database), lint/TypeScript and iOS/Android Hermes exports. Focused
regressions cover A → B → A, actor/environment/session/revision changes, delayed
enrichment/error replies, hidden/cancelled activation, exact first/next retries,
duplicate taps, interrupted/resumed delivery, refresh versus late append,
lineage/cursor/duplicate rejection, terminal empty runs and mixed-page captured
origins. Published-head CI remains the required independent gate.

No native emulator/`adb` or React Native web renderer is available in this workspace;
no configured-device/visual acceptance is claimed. Hosted state was not queried or
changed, and no APK was dispatched or polled. This client requires all six pending
forwards; it intentionally fails closed against an older endpoint. DEVICE_TEST
contains the next configured flow checks. PR #229 and Sprint014 remain open.

Next: exact existing-database six-forward preflight/rehearsal/rollout, then the
identified configured client/device checks. STATUS is the authoritative next task;
E1 → D1 → D2 retains its separate engine/public-data order.
