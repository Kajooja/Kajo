# Sprint 014 — Real Catalog, Profile Bootstrap & External Beta

Status: **ACTIVE — 14A CATALOG FOUNDATION HOSTED; REAL PROVIDER IMPORT NEXT**

## Outcome

Turn Kajo from a technically working BOOK/MOVIE MVP with seeded mock Items into the first product-complete version that can be evaluated by roughly 10 external testers.

Sprint 014 is complete only when normal discovery uses real BOOK/MOVIE data, a new PersonalProfile can become useful in the first session, Shared common-fit is implemented through the existing Prediction V1 path, and the product owner accepts a clean external-beta build.

This sprint does **not** own monetization or final public-store hardening. Production auth/security/signing/store submission follow in Sprint 015, although stable email auth must be usable for the external beta.

## Ordered slices

### 14A — Real provider-backed catalog — #182

Target:

- keep `public.items` as the only canonical recommendable Item table,
- add generic provider provenance/external-ID dedup/lifecycle/discoverability,
- MOVIE source: TMDB server-side import/refresh with localization fallback and attribution/license notes,
- BOOK source: Open Library bulk-based initial path plus optional Finnish Finna metadata enrichment where rights allow,
- normalize provider genres/subjects into generic Kajo tags,
- make real cover/poster metadata available under provider terms,
- preserve historical `KAJO_MOCK` rows but exclude them from normal discovery after acceptance,
- start with a curated useful catalog of hundreds/thousands rather than ingesting every provider record,
- Prediction V1 and SleepLayer continue consuming generic Items unchanged.

#### 14A foundation — hosted 2026-09-04

Repository migrations:

- `20260904193000_catalog_provider_foundation.sql`
- `20260904193200_fix_catalog_upsert_source_conflict.sql`

Hosted migrations:

- `20260904155839 catalog_provider_foundation`
- `20260904160033 fix_catalog_upsert_source_conflict`

Foundation now provides:

- generic `public.items.discoverable`, `creators`, `release_year`, `image_url` and `original_language`,
- private server-owned `ItemSource` provenance with unique `(providerKey, providerItemId)`,
- private namespaced `ItemExternalId` aliases with unique `(namespace, externalId)`,
- service-role-only `public.upsert_catalog_item_v1` as the validated atomic importer boundary,
- canonical Prediction baseline candidate generation filters `candidate.discoverable` without creating another recommender,
- all 24 existing `KAJO_MOCK` Items retain stable IDs and gained `kajo_mock` source + `kajo_mock_slug` alias provenance,
- mocks deliberately remain discoverable until enough accepted real data exists to replace them.

Hosted rollback-controlled verification proved:

- same provider + provider item ID is idempotent and produces one source row,
- another provider sharing an existing external ID resolves to the same canonical Item,
- external IDs resolving to more than one existing Item are rejected rather than silently merged,
- `discoverable=false` removes the synthetic Item from `rank_items_v1` delivery,
- switching the same Item back to `discoverable=true` makes it eligible again,
- authenticated/anon cannot read private source tables or execute catalog upsert; service role can,
- synthetic verification left 0 Items, source rows or external aliases after rollback.

The first hosted smoke found a PL/pgSQL conflict-target ambiguity in the new upsert. Because the base migration was already deployed, it was corrected through the ordered forward migration above rather than rewriting hosted history.

Security/performance advisors introduced no new WARN-level catalog finding. The new private tables report the expected `RLS enabled/no policy` INFO because client grants are absent; fresh FK indexes report unused-index INFO until provider traffic exists.

**Next 14A action:** implement and run the first real provider import through this boundary. Do not mark mocks non-discoverable until real BOOK/MOVIE coverage and mobile presentation have been verified.

### 14B — PersonalProfile bootstrap/import — #185

- user-authorized Letterboxd export ZIP/CSV import,
- IMDb ratings/check-ins/watchlist/list CSV import,
- at least one practical book-history import path (Goodreads-style or StoryGraph CSV) plus a generic Kajo CSV fallback,
- external IDs/ISBN/title metadata resolve imported rows to canonical Items,
- watched/read/ratings/saved intent normalize into existing Kajo state/evidence without a provider-specific Profile,
- imported evidence is source-tagged, idempotent, correctable and progressively superseded by native Kajo behaviour,
- no-import users complete a short real-catalog calibration instead of mandatory demographic profiling.

Rating normalization contract for the first slice:

- IMDb 1–10 -> Kajo 1–10 unchanged,
- Letterboxd 0.5–5 -> Kajo 1–10 by deterministic `rating * 2`,
- watched/read without a rating -> consumed with no fabricated rating,
- watchlist/to-read -> saved/list intent, not consumed.

### 14C — SharedProfile common-fit — #177 / MVP-PRED-005

Only after real catalog + useful PersonalProfile bootstrap exist:

- combine Shared joint evidence with authorized accepted-member PersonalProfile fit,
- include inspectable minimum-member/consensus behaviour and disagreement penalty,
- keep Prediction target as SharedProfile,
- do not copy Personal Events/Scenario history into SharedProfile,
- extend the same Prediction V1 trace and SleepLayer architecture; no second Shared recommender.

### 14D — External beta gate — #186

Target roughly 10 external testers.

Required flows:

- clean install and stable account entry,
- useful first-session PersonalProfile through import or calibration,
- real BOOK/MOVIE discovery/detail/swipe/rating/not-interested/save/List/history,
- SharedProfile create/invite/join/switch/common-fit/Endorsement/List flow,
- Profile messaging where already in MVP scope,
- repeated-session reacted/saved resurfacing behaviour,
- diagnosable backend/Prediction/runtime failures without developer access to tester phones.

## Product decisions

- MVP 0.1 means a **complete store-downloadable BOOK/MOVIE product**, not a mock prototype.
- Monetization/commercialization is not required for MVP 0.1.
- Do not require demographic data for recommendation quality. Content language/region constraints and optional taste priors may be collected only when useful; behaviour/import evidence should dominate.
- Letterboxd/IMDb MVP import is file-based and user-authorized. Do not depend on scraping or an assumed public personal-history API.
- Imported history becomes canonical Kajo evidence with source provenance, not a permanent external-provider profile.
- Do not evaluate common-fit quality seriously against the old tiny mock catalog.

## Dependencies / gates

- Current shell/bootstrap polish on `main` still requires configured-device visual acceptance, but it does not block backend catalog work.
- #102 Lists and #138 messaging still require refreshed configured-device acceptance before the external-beta gate.
- Stable email auth is needed for external beta; production SMTP + Google/Apple store auth is finalized in Sprint 015 through #127/#184.
- #160 production security hardening remains Sprint 015/release scope unless a finding blocks beta safety.

## Acceptance

- [-] `MVP-CAT-001..003` foundation exists; provider data/presentation/device acceptance still open.
- [ ] `MVP-BOOT-001..004` complete.
- [ ] `MVP-PRED-005` complete.
- [ ] deferred List/messaging/Room device gates relevant to beta are accepted.
- [ ] no normal discovery delivery comes from `KAJO_MOCK`.
- [ ] import and no-import users both receive useful first-session recommendations on configured devices.
- [ ] #186 external beta readiness gate accepted by product owner.
- [ ] repository/hosted state/documentation hand off deterministically to Sprint 015.

## Immediate next action

Continue **14A / #182** with the first real provider importer and mobile presentation of normalized catalog fields. Do not mix #185 import parsing or #177 common-fit scoring into the same PR.
