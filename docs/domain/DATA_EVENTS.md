# Kajo Event Model

Status: canonical behavioral + growth telemetry contract.

Kajo must know not only what it predicted but what actually happened. Recommendation evidence, state reconstruction, evaluation and SleepLayer depend on trustworthy events. The Taste-first launch adds acquisition/funnel telemetry, but growth events must not silently become recommendation reward.

## 1. Recommendation Event contract

Conceptual fields:

```text
eventId
actorUserId
profileId
itemId?
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

## 2. Recommendation event vocabulary

### Exposure

- `ITEM_IMPRESSION`
- `ITEM_OPENED`
- `ITEM_DWELL`

Meaningful dwell is weak attention evidence, not direct satisfaction.

### Preference/discovery

- `ITEM_LIKED`
- `ITEM_DISLIKED` — legacy only
- `ITEM_NOT_INTERESTED`
- `ITEM_INTEREST_CLEARED`
- `ITEM_SAVED`
- `ITEM_UNSAVED`

### Shared

- `ITEM_ENDORSED`
- `ITEM_ENDORSEMENT_REVERSED`
- historical `ITEM_SUGGESTED` is deprecated and must not be reused.

At unanimous Shared consensus, canonical Shared save evidence is emitted with source `SHARED_CONSENSUS`.

### Lists

- `LIST_CREATED`
- `LIST_RENAMED`
- `LIST_DELETED`
- `ITEM_ADDED_TO_LIST`
- `ITEM_REMOVED_FROM_LIST`

Shared discovery custom-List membership is committed only when the Endorsement consensus boundary reaches unanimity.

### Consumption/outcome

- `ITEM_CONSUMED`
- `ITEM_CONSUMPTION_REVERSED`
- `ITEM_INTERACTION_UNDONE`
- `ITEM_RATED`

Rating 0–10 always implies consumed/read/watched.

### Session/search

- `SEARCH_PERFORMED`
- `DISCOVERY_MODE_CHANGED`

New recommendation event types require explicit semantics before broad use.

## 3. Taste evidence

Taste Test must reuse canonical taste semantics rather than inventing a parallel marketing score.

A TasteSession response may become bootstrap evidence only when it expresses one of the defined recommendation meanings:

```text
known Item + rating 0..10
unknown/skip
not-interest when explicitly offered and semantically valid
```

Unknown/skip is useful for recognition/question-selection analysis but is not negative preference.

Taste evidence must retain at least:

```text
tasteSessionId
itemId
questionIndex
questionPolicyVersion
response semantic
occurredAt
source = TASTE_TEST
```

When a Taste response is projected into PersonalProfile bootstrap/Memory state, it remains distinguishable from native post-activation Kajo behavior and from imported history.

## 4. TasteChallenge evaluation

A held-out challenge prediction must be frozen before the actual answer can influence the state being scored.

Canonical order:

```text
1. freeze PersonalProfile/Taste state snapshot
2. freeze model/policy/feature versions
3. persist challenge Prediction / expected rating or fit
4. present held-out known Item
5. collect actual answer
6. persist evaluation result
7. only then allow answer to influence future Profile state
```

Required challenge audit fields include:

```text
tasteChallengeId
tasteSessionId
itemId
predictionId / challengePredictionId
stateSnapshotVersion
modelVersion
policyVersion
predictedValue
actualValue
evaluationMetricVersion
error / hit result
predictedAt
answeredAt
```

A challenge prediction whose answer was already in training evidence is invalid and excluded from user-facing accuracy/evaluation.

## 5. Acquisition/growth telemetry

Growth telemetry is a separate event class/stream/table boundary or an explicitly typed system event contract. It may correlate sessions/attribution but does not require `profileId`/`itemId` when those concepts do not apply.

Canonical growth concepts:

- `TASTE_LINK_OPENED`
- `TASTE_SESSION_STARTED`
- `TASTE_ITEM_PRESENTED`
- `TASTE_ITEM_RESPONDED`
- `TASTE_SESSION_COMPLETED`
- `TASTE_CHALLENGE_PREDICTED`
- `TASTE_CHALLENGE_ANSWERED`
- `TASTE_PREVIEW_SHOWN`
- `AUTH_CONVERSION_STARTED`
- `AUTH_CONVERSION_COMPLETED`
- `FRIEND_INVITE_CREATED`
- `FRIEND_INVITE_OPENED`
- `FRIEND_INVITE_ACCEPTED`
- `FRIEND_RELATIONSHIP_CREATED`
- `FRIEND_RELATIONSHIP_REMOVED`
- `FRIEND_BLOCKED`
- `SHARED_PROFILE_CREATE_STARTED`
- `SHARED_PROFILE_CREATED`

These names describe telemetry concepts. Implementation may group them in a typed acquisition table rather than the recommendation `events` table if that better preserves authorization/retention semantics.

### Growth telemetry rules

- link open is not preference,
- auth conversion is not preference,
- Friend acceptance is not preference,
- SharedProfile creation is not proof that any Item was liked,
- campaign source is not a model feature by default,
- experiment assignment may explain funnel outcomes but cannot silently change raw Event meaning.

## 6. Acquisition attribution

Bounded attribution may include:

```text
acquisitionSessionId
tasteSessionId?
friendInviteId?
campaignId?
referralSource?
landingVariant?
experimentAssignments?
firstSeenAt
convertedAt?
```

Do not store secrets/private Profile state in URLs or analytics payloads. Raw invite tokens must not be copied into logs/analytics; use server-side IDs/hashes designed for correlation where needed.

Attribution retention has an explicit lifecycle and deletion policy.

## 7. Friend-invite telemetry

A personal invite has operational lifecycle distinct from Friendship.

Relevant states/events:

```text
CREATED
OPENED
REVOKED
EXPIRED
ACCEPTED
CONSUMED
```

Repeated link opens must not create multiple Friendships. `FRIEND_RELATIONSHIP_CREATED` is emitted only for the one successful canonical transition.

Remove/block actions are social lifecycle facts, not taste evidence.

## 8. Prediction traceability

When Kajo chooses an Item through Prediction, subsequent relevant Events should preserve:

```text
PredictionRun
→ candidate selected for delivery
→ meaningful ITEM_IMPRESSION
→ ITEM_OPENED / DWELL
→ preference action
→ consumed / delayed rating
```

Do not infer that returned = seen. Do not infer rejection from impression alone.

Required trace dimensions include predictionId, profileId, actorUserId, sessionId, Context, MemoryStateSnapshot, model/base-model/policy/feature/reward versions, candidate source/final ranks, delivery state and Outcome latency.

Fallback correlation IDs cannot pretend a hosted PredictionRun exists.

## 9. Evidence classes

| Class | Examples | Interpretation |
|---|---|---|
| exposure | impression | denominator/bias correction |
| attention | open/dwell | weak intent |
| preference | rating/not-interest/list/save/endorsement | direct decision evidence |
| consumption | consumed/rating/reversal | actual experience |
| correction | undo/clear/unsave/reversal | changed prior evidence |
| taste bootstrap | Taste rating/known response | cold-start evidence with explicit source |
| growth | link/auth/invite/friend/group funnel | product acquisition telemetry, not taste |

Outcome precedence/reward remains versioned in `PREDICTION_MODEL.md`.

## 10. SharedProfile evidence rules

Personal evidence read for Shared common-fit remains Personal and is never copied to Shared Event history.

Pending Endorsement is actor-specific. Unanimous consensus produces one canonical Shared save transition. Accepted-member Personal consumed/rated history may be displayed in the lower attributed Shared tier without duplicating those Personal Events.

Friendship does not grant authorization to read another User's Personal Event stream.

## 11. Reliability contract

A meaningful explicit recommendation action must atomically/idempotently update its canonical current-state projection and append corresponding evidence through one authorized boundary.

Persistent actor/Profile-scoped device outbox requirements:

- stable action IDs,
- retry/backoff,
- process-death survival,
- dependency ordering,
- account/Profile switch safety,
- authorization-loss behavior,
- no duplicate effects under lost acknowledgements,
- pending/failed visibility where relevant.

Delivery provenance is frozen independently from score order. Cached data from another Profile/mode/run cannot inherit the current predictionId.

### Implemented command slice — #224 / Phase 14.1

`public.commit_item_action_v1(request)` accepts version 1 rating, not-interest and
undo commands for a generic Item. The envelope freezes action ID, actor/Profile,
Item, occurrence time, session ID/start/context and optional prediction/mode.
The server derives the Event type/properties and patches only the owned taste
fields; Saved and other unrelated fields come from locked current state. Rating
implies consumed. The state, session, Event and `private.item_action_receipts` row
commit together. Equal JSON payload under the same ID returns its original receipt;
a different payload is rejected. Current membership/actor authorization is checked
before execution **and** receipt replay.

`private.item_action_heads` protects undo against intervening actions and legacy
writes, including changes that later return to the same field values. Undo restores
the server's recorded prior state, appends `ITEM_INTERACTION_UNDONE` with the exact
reversed Event ID and restores the preceding undo head. It cannot undo another
actor's action or forge Shared consensus Saved state. A stale undo returns `KJ001`;
the UI can explicitly discard that rejected undo and reload authoritative state.
Uncertain network replies and authorization failures are retained, not discarded.

`itemActionOutbox.ts` persists commands synchronously through SQLite before the UI
accepts them. Keys include backend environment, actor and Profile; each bounded
queue holds at most 256 commands / 1,048,576 serialized characters. It sends FIFO,
stops at the first failure and retries transient failures after 1–30 seconds.
Lost acknowledgements reuse the original payload/ID. Corrupt/full/unwritable
storage rejects new acceptance without erasing queued data. Scope changes stop
subsequent dispatch and stale UI callbacks; a completed in-flight acknowledgement
may remove only its own command. Pending commands are reapplied over hydration
after restart, and pending/errors stay visible. Acknowledged commands are removed;
logout suspends the actor's remaining queue. Account/deletion/retention acceptance
still belongs to `MVP-OPS-002`.

For this slice, correlation requires an existing selected candidate, the same
actor/Profile/session/mode and a recorded impression preceding the action. An
unverified/fallback ID becomes an unattributed native Event without blocking the
preference itself. Undo retains its target action's original accepted trace and
mode. This is a validation guard, **not** proof of complete frozen delivered-slate
provenance: grid/detail/swipe cache/overlay origin and durable exposure delivery
remain `MVP-DATA-004` work.

Lists and Shared Endorsements are the next command slice. Their existing server
state writes and client Events are still separate. The detail List picker waits
for this slice's pending actions so its legacy whole-state projection cannot
overtake the new queue. Full Phase 14.1 and `MVP-DATA-003/004` remain open.

## 12. Taste/acquisition reliability contract

Taste/acquisition paths require equivalent discipline:

- stable TasteSession ID,
- idempotent response submission,
- no duplicate response under browser retry,
- server-owned question order/policy version sufficient for evaluation,
- auth conversion cannot duplicate the PersonalProfile/taste evidence,
- friend invite acceptance is idempotent,
- revoked/expired/blocked invite cannot transition Friendship,
- analytics delivery failure cannot roll back a successful auth/Friend/Profile action,
- raw token values are redacted.

## 13. Data quality and privacy

- UTC in storage.
- Prefer append-only facts and explicit compensating/correction events.
- Rating vs. not-interest vs. save remain distinct.
- User-facing wording is not event semantics.
- No media-specific duplicate event vocabulary.
- Profile chat text is not copied into recommendation events.
- Raw touch/contact/advertising-ID/precise-location/background sensor data remains outside V1 unless later explicitly approved.
- Friends cannot read each other's private Personal event/taste history.
- Anonymous/Taste/acquisition data has bounded retention and deletion.
- Growth telemetry must support product analysis without becoming a covert personalization feature.
