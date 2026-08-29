# Kajo Event Model

Status: conceptual contract for MVP implementation.

## Why events matter

Kajo must know not only what it predicted but what actually happened. Event data powers user state, scenario memory, evaluation and future evolution of predictors.

## Required conceptual fields

```text
eventId
actorUserId
profileId
itemId?                 # optional for non-item events
itemType?
eventType
timestamp
sessionId?
predictionId?
discoveryMode?
context
properties?
```

`actorUserId` and `profileId` are intentionally separate.

## Initial event vocabulary

### Exposure

- `ITEM_IMPRESSION` — an Item was meaningfully presented.
- `ITEM_OPENED` — details opened.
- `ITEM_DWELL` — meaningful dwell/visibility measurement where technically reliable.

### Preference / discovery

- `ITEM_LIKED`
- `ITEM_DISLIKED`
- `ITEM_SAVED`
- `ITEM_UNSAVED`
- `ITEM_SUGGESTED`

### Consumption / outcome

- `ITEM_CONSUMED` — generic underlying semantic; UI wording may be watched/read/attended.
- `ITEM_RATED`

### Search/session

- `SEARCH_PERFORMED`
- `DISCOVERY_MODE_CHANGED`

More event types require explicit semantics in this document before broad use.

## Prediction traceability

When Kajo chooses an Item through a prediction, the impression should carry `predictionId`. Subsequent events should preserve traceability when feasible so the system can evaluate:

```text
prediction -> impression -> user action -> actual outcome
```

## SharedProfile rule

Example:

```text
actorUserId = user_A
profileId   = shared_profile_A_B
itemId      = movie_X
eventType   = ITEM_SAVED
```

This means User A saved Movie X while acting inside the joint A+B Kajo. It is not identical to saving the same movie in User A's PersonalProfile.

## Data quality rules

- Use UTC timestamps in storage.
- Prefer append-only behavioural events; corrections should be explicit rather than silently rewriting behavioural history.
- Event names and semantics are canonical contracts, not analytics-only labels.
- Do not create domain-specific duplicates such as `BOOK_SAVED` and `MOVIE_SAVED` when `ITEM_SAVED` is sufficient.
- Sensitive/contextual fields must be collected only when needed and permitted.

## MVP persistence contract

- The client supplies stable UUIDs for Event and session identity. A retry with the same ID is an insert-or-ignore operation, so a transient failure cannot create duplicate evidence.
- `occurredAt` is the UTC action time supplied by the Event contract. The database also records a separate server-side creation time for ingestion/audit purposes.
- An Event session belongs to one acting User and one Profile context. A session-linked Event must retain that same actor/Profile pair.
- When an Event references an Item, its `itemId` and `itemType` are stored together and must match the canonical Item row.
- Authenticated clients may append and read Events only for permitted Profile contexts. They receive no update or delete capability for Event/session rows.
- The mutable `item_interactions` row is the current projection used for UI hydration. It does not replace or rewrite the append-only Event evidence stream.
