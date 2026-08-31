# Sprint 008 — Prediction V0

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-31**

## Goal

Replace static mock-only ordering with the first real, generic and measurable
personalized ranking owned outside the mobile presentation layer. Prediction V0
uses current Item features, behavioural history, recency and DiscoveryMode to
rank Items for a Profile and returns traceable Predictions whose outcomes can
be evaluated through Sprint 007 Events.

## Scope

- Establish a server-owned Prediction request/response boundary shaped as
  `Profile + Context + DiscoveryMode + candidate scope -> ranked Predictions`.
- Keep Profile as the prediction target and actor authorization separate.
- Produce one traceable `predictionId` per ranked response.
- Use one generic scorer for BOOK and MOVIE candidates.
- Combine inspectable Item similarity/features, explicit behavioural evidence,
  longer-horizon evidence and recency-weighted ShortTermState-style evidence.
- Strongly suppress consumed Items and reflect explicit positive/negative evidence.
- Make `FOR_YOU`, `SURPRISE` and `RISK` measurably change exploration policy.
- Refresh affected rankings after materially relevant behavioural evidence or
  DiscoveryMode changes without requiring model training after every tap.
- Preserve an unconfigured/local fallback without describing it as Prediction V0.
- Carry returned `predictionId` through existing impression/action Events.

## Relevant MVP requirements

- `MVP-PRED-001`
- `MVP-PRED-002`
- `MVP-PRED-003`

## Non-goals

- ScenarioMemory or vector retrieval (`MVP-PRED-004`, Sprint 011).
- Evolutionary optimization or model training.
- Separate BOOK/MOVIE user models or predictors.
- SharedProfile product UI.
- Ratings, search or dwell measurement.
- Final external book/movie provider selection.
- Recommendation logic in mobile presentation components.

## Planned Issues

- #46 — product parent for adaptive ranking and DiscoveryMode semantics.
- #95 — server-owned generic scorer contract, authorization and foundation.
- A later scoped Issue will connect accepted Prediction V0 responses to mobile
  discovery and configured-phone re-ranking after #95 is hosted and verified.

## Definition of Done

- A permitted Profile can request ranked generic Items from a server-owned
  boundary; an unrelated User cannot rank that Profile.
- Ranked responses contain one `predictionId` that flows into existing Events.
- Fixed evidence produces deterministic, inspectable and testable scores.
- Item similarity/features, longer-term behaviour and recency-weighted recent
  behaviour have measurable tested effects.
- Consumed suppression and explicit likes/dislikes affect subsequent ranking.
- DiscoveryMode changes exploration/risk semantics, not only ambient visuals.
- A relevant user action or mode change can refresh later ranking at a
  controlled cadence.
- BOOK and MOVIE use the same generic contracts and scoring implementation.
- Existing Event, auth and current-interaction behavior remains intact.
- Hosted security/advisor verification passes for any backend changes.
- `npm run check`, service-specific tests and configured Android acceptance pass.
- MVP, prediction, architecture, sprint, status and code-map documentation match
  the delivered boundary at close.

## Delivered

- Sprint opened after configured Sprint 007 Event acceptance.
- Issue #95 created as the first bounded implementation step.
- Issue #95 selected an authenticated Postgres RPC as the smallest real
  server-owned V0 boundary and added the generic scorer migration.
- Rollback-only hosted smokes proved deterministic ordering, separate
  DiscoveryMode orderings, consumed suppression, one response-level
  `predictionId`, BOOK/MOVIE-generic output, least-privilege execution grants
  and unrelated-User denial without retaining test rows.
- PR #97 merged and the exact migration is deployed. Hosted function ACL,
  configured ranking, mode-order, suppression and security/performance advisor
  verification passed; Issue #95 is complete.
- Issue #98 is active for typed mobile consumption, stale-response protection,
  controlled Event/state refresh, explicit mock fallback and configured-phone
  correlation acceptance.

## Decisions

- Mobile consumes prediction results; it does not own Prediction V0 scoring.
- Prediction remains generic and targets Profile, never separate media-specific
  taste profiles.
- Issue #95 must select and document the smallest real server deployment
  boundary before creating new service structure.
- A prediction identifier is evaluation correlation, not merely a UI render ID.
- Prediction V0.1 uses a `SECURITY INVOKER` Postgres RPC while the data and
  model are small; a later dedicated service may replace its transport without
  changing the conceptual contract.

## Deferred / not done

- Mobile Prediction V0 consumption and phone re-ranking acceptance follow the
  hosted scorer foundation.
- ScenarioMemory, population learning and evolutionary optimization remain later.

## Known issues

- Current normalized MVP Item features are intentionally small and mock-backed;
  Prediction V0 must remain measurable without pretending they are final
  production metadata.
- The amount of real behavioural evidence is still small, so deterministic
  fallback/prior behavior remains necessary for cold start.

## Important files

- `/docs/product/MVP.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/STATUS.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/events/`
- `/supabase/migrations/`

## Mid-sprint handoff

Issue #95's server-owned scorer is merged, deployed and hosted-verified. Continue
Issue #98 from `apps/mobile/src/features/discovery/`: configured discovery must
consume `rank_items_v0`, preserve its response-level `predictionId` through
Events and retain mock ranking only as an explicit fallback. Do not create an
empty `services/prediction/` tree or begin ScenarioMemory/SharedProfile work.

## Final handoff

Fill at sprint close with configured ranking evidence and the next sprint/action.
