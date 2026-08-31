# Sprint 007 — Event Engine

Status: **COMPLETED**
Milestone: **MVP 0.1**
Started: **2026-08-29**
Completed: **2026-08-31**

## Goal

Turn meaningful Kajo behavior into a durable, generic and analytics-quality evidence stream that connects the acting User, Profile context, session, Item and recommendation trace without coupling Event semantics to BOOK/MOVIE presentation or visible UI copy.

## Scope

- Add reproducible append-only Event and session persistence through committed migrations.
- Keep `actorUserId` separate from `profileId` and protect Event access through authenticated profile membership.
- Preserve the canonical generic Event vocabulary in `DATA_EVENTS.md`.
- Add one typed/testable Event persistence boundary; presentation components must not write directly to Supabase.
- Retain UTC occurrence time, stable client Event identity and retry-safe append behavior.
- Capture meaningful existing behavior: impressions, Item opens, interest, saved/unsaved, consumed, and DiscoveryMode changes.
- Carry session and recommendation/prediction correlation so impressions and subsequent actions can be evaluated later.
- Keep current Item-interaction snapshots as render/hydration state while Events become immutable learning evidence.
- Validate the integrated configured flow without changing the accepted Sprint 006 auth and PersonalProfile behavior.

## Relevant MVP requirements

- `MVP-DATA-001`
- `MVP-DATA-002`
- `MVP-PROFILE-003`

## Non-goals

- Prediction V0, model scoring, learned ranking refresh or a prediction service; Sprint 008.
- Book-specific or movie-specific Event tables/names.
- SharedProfile product flows, joint discovery or member suggestions.
- Ratings, rich memories, search implementation or technically unreliable dwell tracking.
- Replacing the current interaction snapshot with a replay-derived UI state.
- Google or Apple sign-in.

## Planned Issues

- #85 — generic append-only Event/session schema, authorization and typed persistence foundation.
- #89 — mobile Event emission, session/prediction correlation and the two deferred auth/splash phone-polish fixes.

## Definition of Done

- A clean database can reproduce the Event/session schema from committed migrations.
- Events are append-only, use UTC timestamps and have stable identities suitable for safe retry.
- Every Event retains `actorUserId` and `profileId` separately; optional Item, item type, session, prediction, DiscoveryMode, Context and properties remain generic.
- Valid Events can be appended/read only within the authenticated User's permitted Profile context.
- Meaningful existing impressions, opens, interest, save/unsave, consume and DiscoveryMode changes emit canonical Events through one data boundary.
- Ranked Item impressions carry a traceable `predictionId`/recommendation correlation, and later actions preserve it when available, without claiming that mock ranking is Prediction V0.
- Current interaction snapshot persistence, undo, restart hydration and sign-out/sign-in persistence continue to work.
- Deterministic contract, mapping, retry and authorization tests cover the new behavior where practical.
- `npm run check` passes for every merged Issue.
- The configured integrated Event flow is verified against Supabase and on a real phone before sprint close.
- `MVP.md`, `STATUS.md`, `CODEMAP.md`, this sprint file and affected Event/architecture documentation match repository truth at close.

## Delivered

### Event/session persistence foundation — Issue #85

- committed append-only `event_sessions` and generic `events` schema,
- stable client-supplied Event/session IDs with retry-safe insert-or-ignore behavior,
- separate actor User and Profile context with session/Event consistency enforced by the database,
- optional canonical Item, prediction and DiscoveryMode traceability fields,
- UTC occurrence time plus a separate server-side ingestion timestamp,
- membership-scoped RLS and least-privilege authenticated `SELECT`/`INSERT` grants with no client update/delete path,
- indexed Profile, actor, Item, session and prediction access paths, including composite indexes that cover both multi-column foreign keys,
- one typed Supabase persistence boundary with deterministic serialization/error/retry tests,
- current Item-interaction snapshots retained as mutable UI hydration state rather than misrepresented as Event history.

Hosted validation after PRs #87 and #88:

- both committed migrations applied successfully,
- RLS enabled with authenticated `SELECT`/`INSERT` only,
- expected membership policies, generic constraints and access-path indexes present,
- transaction-scoped member append/read and unrelated-user isolation passed,
- rollback left zero Event/session test rows,
- performance advisor reports no unindexed Event foreign keys.

### Mobile Event integration and deferred phone polish — Issue #89

- one root-scoped mobile Event tracker creates the active User/Profile session and persists it lazily before queued Events,
- stable UUIDv7-compatible client Event/session identities retain retry safety, while one recommendation correlation follows grid impressions, Item opens and subsequent Item actions,
- meaningful grid and Item-sequence impressions are deduplicated by prediction/Item trace,
- existing interest, save/unsave, consume/reverse and DiscoveryMode behavior maps to the canonical generic Event vocabulary through the typed persistence boundary,
- exact undo retains the original Event identity and appends `ITEM_INTERACTION_UNDONE` with the restored current-state snapshot,
- current interaction snapshot hydration and serialized persistence remain unchanged,
- Android auth callbacks foreground/reuse Kajo's task and callback buttons clear the callback stack before signed-out login,
- visible startup lettering is enlarged to nearly the full phone width without changing the Android-compatible PNG asset,
- deterministic mapping, correlation, retry, undo-link and auth-navigation regression tests cover the new pure behavior.

Configured real-phone acceptance passed. The user exercised BOOK and MOVIE
discovery, a DiscoveryMode change, Item opens/actions and exact undo in the
standalone Android app. The existing current-interaction flow remained usable,
and the user reported the Event/undo behavior working correctly.

PR #91 merged after green CI #137 with lint, TypeScript, 87 tests and both
platform bundle smokes. The reversal-vocabulary migration is applied, the live
Event constraint contains all three new compensation/reversal types and
`auth-callback` v7 is active. Hosted advisors report no Event-specific security
finding or unindexed Event foreign key.

The configured phone run produced 34 hosted Events for one actor, one Profile
and one session. All 34 rows matched the session actor/Profile identity, all 32
Item-linked Events retained `predictionId`, and zero Item-linked Events lacked
correlation. The rows included BOOK and MOVIE impressions, opens and actions,
two DiscoveryMode changes and four `ITEM_INTERACTION_UNDONE` Events. All four
undo rows referenced an existing original Event for the same Item,
actor/Profile and session. No account identifier is stored in documentation.

The startup-logo sizing follow-ups in PRs #93 and #94 are presentation polish.
The user explicitly removed logo sizing from the MVP acceptance gate; Issue #78
continues to own optional brand treatment rather than blocking Prediction V0.

## Decisions

- `DATA_EVENTS.md` remains the canonical Event vocabulary and payload-semantics source.
- Event history is immutable learning evidence; `item_interactions` remains a mutable current-state projection for fast UI hydration.
- Visible labels such as `Pidän`, `Tallenna`, `Luettu` and `Katsottu` never become Event identifiers.
- Prediction traceability is a correlation contract in Sprint 007, not permission to implement Prediction V0 or ranking logic in the mobile client.
- A mobile Event session is scoped to the active actor/Profile context, created in memory with the root provider and persisted only when its first Event is queued.
- One meaningful Item impression is retained per `predictionId` + `itemId` pair in an active Event-tracking scope; opening or acting on an Item remains independently observable.
- Mock ranking gets stable per-view/type/mode correlation IDs for traceability, but those IDs do not turn the mock ordering into Prediction V0.
- Add a new implementation location only when Issue #85 establishes its real responsibility; do not scaffold empty folders.

## Deferred / not done

- Prediction V0 and real learned re-ranking — Sprint 008.
- SharedProfile event use in user-facing flows — Sprint 009.
- `ITEM_RATED` emission — when MVP rating exists.
- `ITEM_DWELL` — until reliable visibility/duration measurement is defined.
- `SEARCH_PERFORMED` — until search exists.

## Known issues

- Startup-logo sizing remains non-blocking visual polish under Issue #78.
- Final book/movie metadata providers remain intentionally undecided.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/ARCHITECTURE.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/STATUS.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/data/`
- `/apps/mobile/src/features/events/eventPersistence.ts`
- `/apps/mobile/src/features/events/eventPersistence.test.ts`
- `/apps/mobile/src/features/events/EventTrackingContext.tsx`
- `/apps/mobile/src/features/events/eventTracking.ts`
- `/apps/mobile/src/features/events/itemInteractionEvents.ts`
- `/apps/mobile/src/features/discovery/DiscoveryModeContext.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/migrations/`
- `/supabase/migrations/20260829211800_event_persistence_foundation.sql`
- `/supabase/migrations/20260829213200_event_foreign_key_indexes.sql`
- `/supabase/migrations/20260829214500_interaction_reversal_events.sql`

## Historical mid-sprint handoff

Before final acceptance, Issue #85's append-only schema, RLS and typed persistence boundary and Issue #89's mobile Event integration were merged and deployed. The configured Android and hosted-row acceptance described above subsequently passed, so this checkpoint is superseded by the final handoff.

## Final handoff

Sprint 007 is complete. `MVP-DATA-001`, `MVP-DATA-002` and
`MVP-PROFILE-003` are accepted through automated, hosted and configured-phone
evidence. Sprint 008 — Prediction V0 is active. Issue #46 remains its product
parent and Issue #95 is the first scoped implementation: create the
server-owned generic scorer foundation before any mobile ranking integration.
