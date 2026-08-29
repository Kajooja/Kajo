# Sprint 007 — Event Engine

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-29**

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
- Open the mobile event-emission Issue only after #85 fixes the persisted contract and boundary.

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
- indexed Profile, actor, Item, session and prediction access paths,
- one typed Supabase persistence boundary with deterministic serialization/error/retry tests,
- current Item-interaction snapshots retained as mutable UI hydration state rather than misrepresented as Event history.

## Decisions

- `DATA_EVENTS.md` remains the canonical Event vocabulary and payload-semantics source.
- Event history is immutable learning evidence; `item_interactions` remains a mutable current-state projection for fast UI hydration.
- Visible labels such as `Pidän`, `Tallenna`, `Luettu` and `Katsottu` never become Event identifiers.
- Prediction traceability is a correlation contract in Sprint 007, not permission to implement Prediction V0 or ranking logic in the mobile client.
- Add a new implementation location only when Issue #85 establishes its real responsibility; do not scaffold empty folders.

## Deferred / not done

- Prediction V0 and real learned re-ranking — Sprint 008.
- SharedProfile event use in user-facing flows — Sprint 009.
- `ITEM_RATED` emission — when MVP rating exists.
- `ITEM_DWELL` — until reliable visibility/duration measurement is defined.
- `SEARCH_PERFORMED` — until search exists.

## Known issues

- After a successful auth email flow, `Palaa Kajoon` can return to the email app rather than foregrounding Kajo login.
- Startup Kajo lettering is not yet nearly full-screen width.
- Fix both accepted Sprint 006 polish items in the first Sprint 007 user-facing mobile integration change, then phone-check them alongside Event emission. They are not part of Issue #85's persistence-only scope.

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
- `/apps/mobile/src/features/discovery/DiscoveryModeContext.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/itemInteractionPersistence.ts`
- `/supabase/migrations/`
- `/supabase/migrations/20260829211800_event_persistence_foundation.sql`

## Mid-sprint handoff

Sprint 007 opened after the configured Sprint 006 phone flow passed. Issue #85 establishes the append-only schema, RLS and typed persistence boundary. After it is merged and the committed migration is verified against the configured project, open the next Issue for mobile Event emission and the two recorded Sprint 006 UI-polish items. Do not begin Prediction V0 early.

## Final handoff

Fill at sprint close with the exact next sprint/action and device/database evidence.
