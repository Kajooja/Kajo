# Kajo Event Model

Status: canonical behavioral contract for MVP implementation.

## Why events matter

Kajo must know not only what it predicted but what actually happened. Event data powers current-state reconstruction, learning, scenario memory, evaluation and future evolution of predictors.

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

## Event vocabulary

### Exposure

- `ITEM_IMPRESSION` — Item was meaningfully presented.
- `ITEM_OPENED` — details opened.
- `ITEM_DWELL` — meaningful dwell/visibility measurement where technically reliable.

### Preference / discovery

- `ITEM_LIKED`
- `ITEM_DISLIKED` — legacy binary signal retained for historical rows; current rating-drawer UI does not emit it.
- `ITEM_NOT_INTERESTED` — actor has not consumed the Item but marks it currently irrelevant.
- `ITEM_INTEREST_CLEARED` — prior explicit like/dislike returned to neutral.
- `ITEM_SAVED` — Profile-level Saved state became true.
- `ITEM_UNSAVED` — Profile-level Saved state became false.

### Shared endorsement — Sprint 011/#151

- `ITEM_ENDORSED` — actual actor, while acting inside a SharedProfile, marks an Item worth doing together. This is **actor-specific pending state**, not Shared `saved=true`.
- `ITEM_ENDORSEMENT_REVERSED` — actor explicitly removes their active pre-consensus Endorsement if reversal is exposed.

The #151 persistence migration supports these Event types. Mobile runtime emits `ITEM_ENDORSED` only after the actor-specific endorsement RPC succeeds. It emits the consensus `ITEM_SAVED` evidence only when the same RPC reports the one successful consensus transition.

At unanimous accepted-member consensus, Kajo also appends canonical Shared save evidence:

```text
eventType = ITEM_SAVED
profileId = shared_profile_id
actorUserId = actor_who_completed_or_triggered_consensus
properties.source = SHARED_CONSENSUS
properties.endorsementCount = ...
properties.requiredMemberCount = ...
```

The exact actor for an automatic membership-change recomputation must remain traceable and intentionally defined in implementation; do not invent a fake User actor.

### Historical/deprecated Shared suggestion

- `ITEM_SUGGESTED` — historical Sprint 009 experiment where a member explicitly used the removed `Ehdota yhteiseen` Item-detail action.

Rules:

- retain old rows for history/analytics,
- do not delete or reinterpret old `ITEM_SUGGESTED` Events as Endorsements,
- new UI must not emit `ITEM_SUGGESTED`,
- new Shared collaboration uses `ITEM_ENDORSED` semantics instead.

### Consumption / outcome

- `ITEM_CONSUMED` — generic historical/direct semantic; current rating UI records consumption through `ITEM_RATED`.
- `ITEM_CONSUMPTION_REVERSED` — prior consumed/read/watched mark explicitly removed.
- `ITEM_INTERACTION_UNDONE` — latest committed Item interaction undone; `properties.reversedEventId` identifies compensated Event and restored fields describe current state.
- `ITEM_RATED` — `properties.rating` integer 0–10 and always implies consumed/read/watched state.

### Search/session

- `SEARCH_PERFORMED`
- `DISCOVERY_MODE_CHANGED`

More Event types require explicit semantics here before broad use.

## Prediction traceability

When Kajo chooses an Item through Prediction, the impression should carry `predictionId`. Subsequent events should preserve traceability when feasible:

```text
prediction -> impression -> actor action -> actual outcome
```

## SharedProfile examples

### Current Shared interaction

```text
actorUserId = user_A
profileId   = shared_profile_A_B
itemId      = movie_X
eventType   = ITEM_RATED
```

This is User A acting inside the joint A+B Kajo. It is not identical to rating Movie X in A's PersonalProfile.

### Pending Endorsement

```text
actorUserId = user_A
profileId   = shared_profile_A_B
itemId      = movie_Y
eventType   = ITEM_ENDORSED
properties.source = SHARED_DISCOVERY
```

This means A wants Movie Y considered together. It does **not** mean the SharedProfile has saved Movie Y yet.

Until B endorses too:

- A should not keep receiving Y in ordinary Shared discovery,
- B may receive Y ahead of normal recommendations with A provenance,
- current Shared `saved` remains false.

### Consensus

When all accepted members endorse:

```text
profileId   = shared_profile_A_B
itemId      = movie_Y
eventType   = ITEM_SAVED
properties.source = SHARED_CONSENSUS
```

This records Profile-level transition to Shared Saved state. Pending member Endorsement evidence remains independently traceable.

## Shared discovery consumption rule

An Item already consumed/rated in any accepted member's PersonalProfile is ineligible for ordinary Shared discovery under #151.

Do not copy that Personal Event into the Shared Event stream merely to implement suppression. The scorer/eligibility layer may read authorized member PersonalProfile state while preserving original Profile provenance.

This rule does not delete the Item from Saved, named Lists or history.

## Data quality rules

- Use UTC timestamps in storage.
- Prefer append-only behavioural Events; corrections should be explicit rather than silently rewriting history.
- Undo/reversal appends compensating evidence; it does not delete original Event rows.
- Rating and not-interested are distinct: rating means consumed, not-interested means not consumed.
- Save is orthogonal to rating/not-interested.
- Pending Endorsement is orthogonal to Shared saved/rating/not-interested/consumed current state until consensus.
- UI wording is not Event semantics. `Tykkää`, `Tallenna` or later copy must map intentionally to canonical state depending on Profile context.
- Event names are canonical contracts, not analytics-only labels.
- Do not create media-specific duplicates such as `BOOK_ENDORSED` or `MOVIE_SAVED`.
- Sensitive/contextual fields are collected only when needed and permitted.

## MVP persistence contract

- Client supplies stable UUIDs for Event/session identity. Retry with same ID is insert-or-ignore so transient failures cannot create duplicate evidence.
- `occurredAt` is UTC action time from Event contract; database also stores server-side creation time.
- Event session belongs to one acting User and one Profile context. Session-linked Event retains same actor/Profile pair.
- Item Event stores `itemId` + `itemType` matching canonical Item row.
- Authenticated clients may append/read Events only for permitted Profile contexts; no update/delete capability for Event/session rows.
- Mutable current-state tables (`item_interactions`, future endorsement/list state) are projections. They do not rewrite append-only Event evidence.
