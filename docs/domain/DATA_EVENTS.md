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
A request without a reply times out after 20 seconds; retries retain the original
ID and a late reply cannot acknowledge it twice.
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

### Collection commands — #226 / Phase 14.1

`public.commit_collection_action_v1(request)` extends the same versioned envelope
and the same private receipt/head lineage with List create/rename/delete,
`SET_LIST_ENTRY`, `UNDO_LIST_ENTRY`, Shared Endorsement and pending withdrawal.
It also freezes `source` and the relevant name/List/presence/positive intent.
Metadata commands have no Item. Target Lists must belong to the exact authorized
Profile. Session, state, all canonical Events and the receipt commit together.

The server derives transitions from locked state. Custom membership emits
`ITEM_ADDED_TO_LIST` / `ITEM_REMOVED_FROM_LIST`; system Saved emits its Saved
transition. A Personal destination-picker action also sets positive interest and
emits `ITEM_LIKED` when needed, without doubling a simultaneous Saved transition.
An unchanged action gets a replayable receipt and no invented Event. Receipt IDs
therefore no longer require an Event FK; a changed command uses its action ID for
the first Event and records all additional Event IDs in its receipt. List deletion
preserves its receipt for retries. Account/Profile/Item deletion still cascades;
coordinated receipt/Event retention remains an OPS acceptance requirement.

List undo restores the recorded membership including its original adding actor,
time and source, plus the prior interaction. It emits one exact
`ITEM_INTERACTION_UNDONE.reversedEventId` correction for **each** Event of the
reversed command, so existing Memory/outcome readers cannot retain half of a
List+Like action. Item and List commands share ordered undo predecessors. Legacy
membership/projection changes invalidate that head, including delete/reinsert ABA.
The Item RPC cannot undo a List receipt because it cannot restore membership.
The client offers undo only after its current-session durable queue is ready and
empty. It does not offer List-removal undo: a changed removal invalidates prior
same-Item client undo entries; a List deletion clears session history because the
receipt omits affected Item IDs. Server reversal contracts remain unchanged.

The first Shared actor proposes a custom List; another member accepts the existing
proposal without supplying a replacement List. Only the last required endorsement
emits consensus Saved and committed custom membership. Completed consensus remains
durable after List deletion/member changes. Pending withdrawal clears an empty
proposal. Deleting a pending proposal's List records cancellation under the actual
deleting actor, with `endorsementActorUserId` and `reason=LIST_DELETED`; it is not a
negative preference attributed to that member. Withdrawal/cancellation also adds
exact Undo references to active Endorsement Events so outcome rewards are cancelled.
These administrative corrections carry no borrowed current-view prediction.

Mobile Lists, destination picker and Shared discovery use the same SQLite queue as
ratings. The old whole-state interaction writer and duplicate client mutation
Events are removed. Collection UI waits for a validated, durably acknowledged
receipt before reporting success, sending an optional message or starting a
dependent operation. While a collection choice awaits acknowledgement, new actions
wait; collection submission also waits for earlier commands. This prevents duplicate
creation and use of an unconfirmed List while preserving one FIFO after restart.
Background acknowledgements refresh List/Shared views. After the queue drains,
a guarded read reconciles the current interaction state even when a replayed
receipt describes an older commit; it cannot overwrite a newer read, queued action
or another scope. Pending/error/discard controls
are visible on Lists, List detail, the picker and discovery. An optional message is
still a separate message action and is not replayed after a lost collection reply.

Only explicit domain rejection `KJ002` or stale undo `KJ001` permits user discard,
followed by authoritative reload before resuming. Auth/identity/invalid receipt and
uncertain replies stay queued. Collection origin uses the same validated trace
guard as Item actions, and undo retains accepted original attribution. Full frozen
delivery, durable exposure, physical process-kill/reconnect acceptance and
`MVP-DATA-003/004` remain open. Sprint 014 and the PR own rollout/verification status.

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


### Delivered navigation checkpoint — #228

Grid opening now captures a bounded in-process navigation snapshot of the exact
visible Item sequence, prediction/source, DiscoveryMode, environment/actor/Profile
scope and Event session. Detail pins that snapshot; its successor Items cannot be
borrowed from another cached ranking. A mismatched/expired origin returns a retry
navigation surface. Unproven route prediction IDs are ignored; direct non-predicted
entries browse only their selected Item. Ambient presentation still follows the
global mode while evidence retains the mode at delivery.

This transport is not durable exposure or full delivery acceptance. Item-specific
Shared overlay provenance, asynchronous callback/session boundaries, persisted
exposure and exposure-before-outcome reconciliation remain #228 work. Existing
server trace authorization remains required; a client snapshot is not server proof.


### Durable Event checkpoint — #228 / draft PR #229

`eventOutbox.ts` replaces the old in-memory write coordinator. Before recordEvent
returns an ID, SQLite stores an immutable Event and its complete original session.
The existing bounded outbox supplies FIFO, size limits, backoff, reply deadlines,
validated restore, exact-ID replay and acknowledged-entry removal. Its storage
namespace is distinct from explicit commands and includes environment/actor/Profile;
all restored session/Event identities must agree. Failed storage is not accepted
and does not consume the in-process impression dedup key.

Restart under a new Event session still replays each queued Event with its own old
session and timestamps. Session persistence precedes that Event; a stopped context
cannot proceed from a delayed session reply into an Event write. Scope cleanup
stops dispatch/callbacks and retains unacknowledged evidence for authorized retry.
Auth/domain errors are retained with visible retry state, not silently discarded.

Exposure and Item/collection commands still use separate queues. This checkpoint
does not guarantee exposure-before-action delivery or fix delayed attribution by
itself. Persistent replay, frozen Shared origins, causal ordering/reconciliation
and physical-device acceptance must be evaluated together before DATA-003/004 close.


### Exposure-before-command checkpoint — #228 / draft PR #229

Immediately before Item/collection RPC dispatch, `createExposureOrderedSender`
checks the current action scope and `EventTracking.canSendAction`. A correlated
Item command waits while the durable Event queue contains an impression for the
same actor/Profile, original session, prediction and Item with timestamp no later
than the action. A pending/lost acknowledgement is not delivery: the command stays
unchanged in its own queue and retries through the existing bounded backoff.

The check reloads persisted evidence, including older sessions restored after
restart. An unreadable/corrupt exposure queue blocks correlated dispatch. Unrelated
impressions and non-predicted/metadata commands do not wait; stopped/mismatched
contexts cannot dispatch. The server's existing trace validation remains required.

This guard orders evidence that was successfully enqueued. It does not fabricate
missing impressions, revise already committed unattributed receipts or prove client
origin authenticity. Missing/already-committed late outcomes and frozen Shared
item-specific/async origins remain separate acceptance work on the same Issue.


### Shared per-Item origin checkpoint — #228

The delivered snapshot now contains an immutable per-Item origin. `deliveryTier`
is `RANKED`, `SHARED_PENDING` or `SHARED_MEMBER_HISTORY`; unknown origins are
`UNATTRIBUTED`. An Item receives the delivered ranking's `predictionId` only when
it was actually in that ranking. Shared-injected Items carry `shared_overlay`
predictionSource and no Prediction ID. A ranked Item moved by the overlay keeps
its original run and its Shared tier. This descriptor contains no member IDs,
private ratings, List names or author identities.

Grid open/impression and detail impression/dwell/Item/collection actions use the
per-Item descriptor. The detail copy survives Shared changes and reranking;
current consensus controls can still reflect live state. Dwell freezes its
recording callback, mode and descriptor at start. Unknown undo targets cannot
inherit the current slate's run. Server authorization and selected-candidate /
exposure validation remain required. Remaining async/session boundary review,
late-outcome reconciliation and representative runtime acceptance are still open.


### Deferred origin/session admission checkpoint — #228

`EventRecordInput.originSessionId` is a client-only admission guard captured by
Detail and its destination picker. `null` means an explicitly local origin;
omission keeps ordinary fresh, non-delivered actions compatible. Event recording
and explicit Item/collection enqueue reject a supplied mismatched session; explicit
actions also reject an origin for another Item. This field is not persisted as
an Event property and does not rewrite the actual Event/command session envelope.
Atomic commands still carry the existing Prediction/mode fields; `deliveryTier`
is client origin and exposure/attention Event metadata, not a new RPC schema field.

The active action session invalidates at layout time, preventing old hydration,
receipt projection or dispatch from surviving the interval before passive queue
cleanup. Lists/Shared pending completions also expire on session change/unmount.
The destination sheet scopes loading/saving to each open request and rejects
obsolete completions. Accepted persisted commands still replay their original
session through a current coordinator. Server late-outcome verification and
representative device/reopen/process-death acceptance remain open.


### Server delivery-order verification — #228

`delivery-order-smoke.sql` checks the installed server contracts through the
public authenticated RPCs. A selected run with matching actor/Profile/session,
mode and an already stored pre-action impression remains attributable when the
command arrives a day later, even after another session has requested a new run.
Missing exposure, an impression occurring after the action, wrong session/mode
and unselected candidates produce `UNATTRIBUTED` preference Events.

An impression inserted after the action receipt does not retrofit attribution,
even when its occurrence time precedes the action. Exact retries return the same
receipt/Event; undo inherits the accepted attribution. This intentionally preserves
immutable history: it is not a retrospective reconciliation implementation. The
mobile exposure-order guard prevents this ordering for locally pending impressions;
missing evidence is never invented. Both command families and secondary collection
Events are covered by 14 rollback-only cases in PGlite and required native CLI CI.


### Exposure waiting presentation correction — #228 device feedback

A local pending impression is a queue dependency, not a rejected action.
`waitingForExposure` keeps normal retry/backoff and persistence but suppresses the
error snapshot. Collection callers therefore continue waiting for the actual
receipt instead of receiving a premature failure. Genuine persistence errors
still publish their message. This does not discard actions, weaken trace checks
or invent exposure.


### Active List membership delivery correction — #228 candidate

Ordinary eligibility now considers current List entries belonging to the target
Profile, rather than treating historical ITEM_ADDED_TO_LIST/LIKED Events as
permanent membership. The latest active entry time participates in existing saved
reminder age. Removing the final Personal membership restores ordinary eligibility
unless another current Saved/bootstrap/terminal state suppresses it. Historical
taste evidence and receipts are unchanged.

A collection receipt changes the mobile ranking identity even when projection
fields stay unchanged; the old grid is invalidated until the updated ranking
arrives. Late viewability tokens from that grid do not establish new impressions.
Shared SYSTEM_SAVED remains governed by consensus: deleting a named Shared List
is not permission to bypass that separate state. Candidate forward is not yet
hosted/device acceptance; STATUS and Sprint 014 own the rollout/remaining undo work.


List/history navigation carries explicit `predictionSource=collection` and
`deliveryTier=COLLECTION` metadata without a Prediction ID. Loaded authorized Item
snapshots are scoped to Profile and Event session; this is collection browsing,
not a ranked recommendation delivery. Existing atomic action/attribution rules
remain in force. History-clear evidence is still a pending explicit action contract.
