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
- reopened `MVP-DISC-007`, `MVP-SWIPE-002..005`
- `MVP-MEM-003`

## Non-goals

- ScenarioMemory or vector retrieval (`MVP-PRED-004`, Sprint 011).
- Evolutionary optimization or model training.
- Separate BOOK/MOVIE user models or predictors.
- SharedProfile product UI.
- Search or dwell measurement.
- Final external book/movie provider selection.
- Recommendation logic in mobile presentation components.

## Planned Issues

- #46 — product parent for adaptive ranking and DiscoveryMode semantics.
- #95 — server-owned generic scorer contract, authorization and foundation.
- #98 — typed mobile consumption and Event correlation; merged, configured
  hosted-Event acceptance remains pending.
- #100 — persistent global DiscoveryMode top bar.
- #101 — rating/not-interested/save feedback drawer and canonical persistence.
- #103 — impression cooldown and broader normalized MVP candidate catalog.
- #102 — Saved/Consumed navigation recorded for Sprint 010.

## Definition of Done

- A permitted Profile can request ranked generic Items from a server-owned
  boundary; an unrelated User cannot rank that Profile.
- Ranked responses contain one `predictionId` that flows into existing Events.
- Fixed evidence produces deterministic, inspectable and testable scores.
- Item similarity/features, longer-term behaviour and recency-weighted recent
  behaviour have measurable tested effects.
- Consumed suppression, 0–10 rating magnitude, not-interested evidence and save state affect subsequent ranking/queue placement without conflating consumption.
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
- Issue #98 merged typed mobile consumption, stale-response protection,
  controlled Event/state refresh and explicit mock fallback; configured-phone
  hosted correlation acceptance remains pending.
- Configured phone feedback reopened the interaction/mode acceptance boundary:
  #100 adds the persistent shared-mode top bar, #101 replaces binary reactions
  with the 0–10/not-interested/save drawer, and #103 adds impression cooldown
  plus enough candidates for observable testing. #102 records Saved/Consumed
  navigation for Sprint 010.
- Issue #100 implementation adds one authenticated app-shell mode bar above the
  navigation Stack, keeps auth/callback screens outside it, reuses the Room
  curtain state/gesture semantics. Configured-phone feedback removes the
  duplicate Room control and keeps this one global bar as the sole selector.
- PR #106 adds and deploys the canonical rating/not-interested projection and
  Event foundation. Rating implies consumed, not-interested remains unconsumed,
  save stays orthogonal and legacy binary evidence remains readable.
- PR #108 configured APK acceptance passed for the compact rating drawer and
  corrected item-detail layout.
- PR #109 teaches Prediction V0 to consume canonical `ITEM_RATED` magnitude and
  `ITEM_NOT_INTERESTED` evidence while preserving legacy evidence, undo
  compensation, consumed suppression and least-privilege Profile authorization.
  Its repository CI passed, the migration is deployed to hosted Supabase, and
  the hosted function definition verifies the new evidence paths.
- PR #110 implements #103 on top of the clean post-#109 main: the normalized MVP
  catalog grows to 12 BOOK and 12 MOVIE candidates, unreacted impressions get a
  decaying 30-minute cooldown, and explicit reaction state receives a stronger
  immediate queue penalty without becoming permanent suppression. Configured
  Android acceptance remains the gate before #103/Sprint 008 close.

## Decisions

- Mobile consumes prediction results; it does not own Prediction V0 scoring.
- Prediction remains generic and targets Profile, never separate media-specific
  taste profiles.
- Issue #95 must select and document the smallest real server deployment
  boundary before creating new service structure.
- A prediction identifier is evaluation correlation, not merely a UI render ID.
- The rating control mirrors the curtain interaction: one handle supports taps
  and drag gestures, snaps to integer 0–10 positions and commits only a snapped
  value. Every rating, including 0, implies consumed.
- Hosted mode rankings are allowed to converge with sparse evidence. The UI
  must not fake a reorder; #103 broadens the catalog and configured acceptance
  proves differentiation when the evidence/candidate set is sufficient.
- Prediction V0 uses a `SECURITY INVOKER` Postgres RPC while the data and model
  are small; a later dedicated service may replace its transport without
  changing the conceptual contract.
- A mere impression is temporary queue evidence, not a permanent rejection.
  Explicit reaction state rotates an Item out more strongly; consumed state
  remains the strongest suppression in Prediction V0.

## Deferred / not done

- Configured Android acceptance of the broader catalog, cooldown, Event
  correlation and observable DiscoveryMode behavior remains before sprint close.
- ScenarioMemory, population learning and evolutionary optimization remain later.

## Known issues

- Current normalized MVP Item features are intentionally small and mock-backed;
  Prediction V0 must remain measurable without pretending they are final
  production metadata.
- The amount of real behavioural evidence is still small, so deterministic
  fallback/prior behavior remains necessary for cold start.
- Supabase advisors currently expose pre-existing security hardening and unused
  index notices outside the Prediction V0 change set; they should be handled in
  a separately scoped hygiene/security task rather than mixed into #103.

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
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/`

## Mid-sprint handoff

#101 scorer input is merged and deployed. #103 is the active implementation:
keep the broader generic catalog, temporary impression cooldown and stronger
reaction queue rotation server-owned. After #110 passes CI and hosted deploy,
build the configured Android APK and verify mode persistence, queue rotation,
`predictionId` correlation and rating/not-interested Event effects. Do not begin
ScenarioMemory/SharedProfile work before Sprint 008 closes.

## Final handoff

Fill at sprint close with configured ranking evidence and the next sprint/action.
