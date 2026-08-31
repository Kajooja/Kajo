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
- `ITEM_DISLIKED` — legacy binary signal retained for historical rows; new UI must not emit it after the rating-drawer migration.
- `ITEM_NOT_INTERESTED` — the actor has not consumed the Item but explicitly marks it currently irrelevant.
- `ITEM_INTEREST_CLEARED` — a prior explicit like/dislike was explicitly returned to neutral.
- `ITEM_SAVED`
- `ITEM_UNSAVED`
- `ITEM_SUGGESTED` — the acting User explicitly suggests an Item while inside a SharedProfile. In the MVP this is append-only behavioral evidence for the shared Kajo, not a message, recipient inbox or mutable Item state.

### Consumption / outcome

- `ITEM_CONSUMED` — generic underlying semantic retained for historical/direct integrations; the new rating UI records consumption through `ITEM_RATED`.
- `ITEM_CONSUMPTION_REVERSED` — a prior consumed/read/watched mark was explicitly removed.
- `ITEM_INTERACTION_UNDONE` — the latest committed Item interaction was undone; `properties.reversedEventId` identifies the compensated Event and restored interaction fields describe the resulting current state.
- `ITEM_RATED` — `properties.rating` is an integer 0–10 and the Event always implies consumed/read/watched state.

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

A suggestion follows the same actor/Profile separation:

```text
actorUserId = user_A
profileId   = shared_profile_A_B
itemId      = movie_Y
eventType   = ITEM_SUGGESTED
properties.source = ITEM_DETAIL
```

This means User A suggested Movie Y to the shared A+B Kajo while browsing that SharedProfile. The MVP suggestion does **not** create chat content, a per-recipient delivery/read state or a second suggestion table. It also does not change `saved`, `rating`, `notInterested` or `consumed` current state. If later product behavior needs notifications or an inbox, that must be modeled explicitly rather than inferred from the Event.

## Data quality rules

- Use UTC timestamps in storage.
- Prefer append-only behavioural events; corrections should be explicit rather than silently rewriting behavioural history.
- Undo appends `ITEM_INTERACTION_UNDONE`; it never deletes the original Event. Directly clearing interest or removing a consumed mark uses its own explicit canonical Event instead of pretending that the original action never happened.
- Rating and not-interested are mutually distinct: rating means consumed, while not-interested explicitly means not consumed.
- Save state is orthogonal to rating/not-interested even though any explicit reaction may rotate the Item out of the immediate discovery queue.
- `ITEM_SUGGESTED` is orthogonal to current Item interaction state. It records the suggestion act only.
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
