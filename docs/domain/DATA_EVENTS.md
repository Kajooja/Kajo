# Kajo Event Model

Status: canonical behavioral + growth telemetry contract, with accepted-main commands and explicitly marked #229/#232 successors.

STATUS owns source, hosted and device acceptance. The #229 source sections below describe the inspected active branch, not code delivered by this documentation change. #232 SharedRatingRound remains planned required first-release work.

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
- `ITEM_HISTORY_CLEARED` — active #229 administrative correction; not a taste reward
- `ITEM_INTERACTION_UNDONE`
- `ITEM_RATED`

Personal rating 0–10 implies consumed/read/watched. Current Shared SET_RATING is a single-actor transition; the required #232 SharedRatingRound successor records each actor’s experience and completes joint consumption only after all required responses (section 10).

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

Required #232 SharedRatingRound semantics are planned, not existing Event names/API fields. Each response retains round ID, actor, SharedProfile, Item, participant-set version and truthful delivered origin. Pending responses do not emit completed joint consumption/reward. Final completion, joint state and Outcome Events commit atomically once. Rating 0 is valid; preserve responses/disagreement without attributing one actor’s score to the group or copying Personal Events.

Edits/Undo, cancellation and changed membership correct/reconcile prior outcomes. A rewatch uses a new round ID; earlier experiences and action receipts remain immutable. Completion is not automatically positive preference or predictor success. Version reward interpretation and test delayed attribution, participant loss, legacy single-actor history and Personal isolation before Phase 16.3 acceptance.

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

### Accepted-main collection commands — #226 / Phase 14.1

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

This paragraph describes the accepted-main single-List command; the active exact-set successor is specified in section 14. The first Shared actor proposes a custom List; another member accepts the existing
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


## 14. Active #229 source contracts and remaining boundaries

These compact contracts reconcile active source with accepted-main behavior above. The complete development/device record remains on `feat/228-delivered-origin` in Sprint 014 and DEVICE_TEST; STATUS identifies which head and gates apply. SharedRatingRound (#232) is not delivered by any of these changes.

### Frozen delivery, durable exposure and ordering

`deliveredSlate.ts` captures the exact visible sequence and per-Item origin for one environment/actor/Profile/session/mode. Detail and its actions retain that origin instead of borrowing a later ranking. Injected Shared Items have truthful overlay provenance and no invented Prediction ID. Collection navigation is identified as COLLECTION, with no borrowed rank. Direct entries do not acquire an unverified route Prediction.

`eventOutbox.ts` persists immutable Event/session envelopes in its own actor/Profile/environment namespace before acceptance. Original sessions survive restart. Stale scope stops dispatch/callbacks while unresolved evidence remains available to an authorized retry. Correlated commands wait only for their matching already-enqueued pre-action impression; acknowledgement wakes exposure-waiting work while retaining normal network backoff. Missing impressions are never invented. Layout/session admission rejects stale UI actions while already accepted commands retain their original envelope.

`EventRecordInput.originSessionId` is a client-only admission guard: null denotes an explicitly local origin, while omission preserves fresh non-delivered action compatibility. Delivered Detail/picker actions reject a mismatched session or Item. This guard is not persisted as an Event property and does not rewrite the real command/session envelope. `deliveryTier` is client origin/exposure metadata, not a new atomic-command RPC field. Layout-time session invalidation prevents old hydration/receipt/dispatch callbacks from surviving until passive queue cleanup; accepted persisted commands still replay their original session.

Event session persistence precedes its Event, and a stopped coordinator cannot continue a delayed session acknowledgement into an Event write. Acknowledged-session reuse is coordinator-local; restart confirms original sessions again. Exposure-acknowledgement wake-up covers the race where acknowledgement arrives before the command is classified as waiting; a bounded fallback remains. Missing/unreadable exposure queues block correlated dispatch rather than fabricating evidence. `waitingForExposure` suppresses a premature error display while callers continue waiting for the actual receipt; genuine persistence errors remain visible.

### Late Outcome attribution — hosted 2026-09-12

`20260912133402_late_outcome_attribution.sql` defines a private read projection shared by ScenarioMemory and evaluation. A previously unattributed command Outcome may be read with `LATE_EXPOSURE_V1` only when its original receipt owns that exact Event and actor/Profile/Item/session/mode/occurrence agree with the selected prior run and a real pre-action impression. A guessed action ID, another member/run or post-action occurrence does not qualify. Multiple impressions cannot duplicate the Outcome.

The reader separates Outcome occurrence cutoff from evidence-read cutoff; qualifying receipt/impression rows must be visible by that read cutoff. Old evaluations, raw Events and immutable command receipts are never rewritten. Undo still removes the outcome effect; rating 0 remains negative. This is evidence reconciliation, not a new exposure or reward.

For late attribution, the receipt must own the primary Event ID or include the exact secondary ID in its recorded `eventIds`. Receipt/Event actor, Profile, Item, occurrence time, session and mode must agree; the run belongs to that actor/Profile/session/mode, selects the Item and precedes the action. The actual impression occurred between that run and action. A client `actionId` property alone, another member/session/run or an impression occurring after the action cannot qualify. Only supported preference/List/Endorsement outcomes participate; metadata, history-clear and Undo do not acquire a new Prediction. Existing `RECORDED` attribution remains compatible; the projection labels reconciled proof `LATE_EXPOSURE_V1`.

### Frozen replay, candidate admission and continuation — hosted 2026-09-12

The active frozen-replay forward records full-precision as-of scoring inputs and original genome/version identity. Replay emits no Events, excludes incompatible legacy inputs and evaluates only the declared frozen source pool. The candidate-admission forward records eligibility/retention counts and ranks before bounded top-50 retention; this metadata is not exposure evidence.

Protocol 1 retains its identified first-page responses and false continuation capability. The deployed `20260912134224_atomic_prediction_pages.sql` adds opt-in protocol 2: each later page atomically commits its own PredictionRun, page-local candidate ranks/selection, exact scoped receipt, cursor consumption and seen advancement. Current eligibility is checked against a frozen original source; old runs are never revised and no impression is fabricated. Every delivered Item carries its page's own run ID, and the current client source carries that per-Item origin through grid/Shared reordering, captured detail/swipe and durable actions.

Private page context retains the original/parent run, observed seen prefix, reminder history and separate feature/eligibility times after derived-window cleanup. Exact authorized receipt retries survive cache expiry; another request cannot consume the same cursor. Shadow/evaluation conditions on the observed preceding production pages and declares `FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX`; unobserved challenger paths acquire no labels. Bounded-window exhaustion is not catalog exhaustion. The client reader binds readiness/cache/append to environment, actor, Profile, session, domain, mode and revision. Old native list callbacks retain their request/view and session instead of borrowing the new view's origins; page fetch/prefetch itself creates no impression. Source CI, exact hosted rollout and configured-device acceptance remain separate gates.

The owner-approved six-forward rollout was verified on 2026-09-12. STATUS and
Sprint014 record exact source/deployment identities and metadata preservation.
Configured-device evidence and full DATA acceptance remain open.

### Collection/history corrections and exact destination sets

The active branch records hosted rollout of membership resurfacing, history clear, bootstrap-history projection and Shared multi-destination forwards; recheck STATUS before deployment work. These source contracts are not proof of device acceptance.

- Current authorized List entries govern membership suppression; old addition Events are not permanent membership. Receipt revisions invalidate stale ranking identities without changing historical taste evidence.
- `CLEAR_HISTORY` clears same-Profile rated/consumed state, deactivates relevant bootstrap evidence, emits the administrative marker plus exact corrections for active rating/consumption Events, and preserves Saved/interest/other memberships. State, corrections and receipt commit together; no-op/retry adds no fake evidence. This is not deletion of the Event log or an undoable history action.
- `get_profile_item_states_v1` provides one authorized native/bootstrap read projection for hydration/history/badges, including rating 0. Reads create no Events. Personal history remains separate when authorized aggregates inform Shared delivery.
- Personal users freeze the checked destination set on one explicit Add. Existing durable per-List commands run in order; all acknowledgements close the picker and advance once, without a separate Done. Partial success retains confirmed additions and unresolved choices; it is not whole-batch atomicity.
- Shared `ENDORSE_SHARED_ITEM` uses an exact 1–32-List set in the same Profile. Every member must review the same set; incompatible legacy clients cannot approve it. Unanimity atomically commits all memberships, one Shared save transition and each new membership Event. Deleting any pending target cancels the whole proposal with truthful corrections; completed other memberships/Saved survive.
- UI Undo waits for a ready empty current-session queue. List removal is not offered as Undo; changed removal invalidates affected same-Item entries, and List deletion clears the relevant session history because the receipt omits affected Item IDs. Server predecessor/correction contracts remain authoritative.

The native/bootstrap history projection chooses one active bootstrap row per Item with the existing RATED > CONSUMED, source-time/import-time/ID order. Native rating wins display, including zero; consumed-only input receives no invented rating. Native Saved/interest/rejection retain ownership, and inactive/future-imported evidence is excluded. Clearing history deactivates matching initial RATED/CONSUMED evidence and corrects all still-active native rating/consumption Events, without borrowing a current Prediction. A changed clear advances the Item action head and is not undoable; exact retries return the original receipt even after a later rating. Undoing a native edit can reveal a surviving bootstrap rating. Authorized member aggregates reuse the projection without copying it to Shared consumed history.

Shared exact-set source retains primary `listId` for compatible old single-List commands, while `listIds` and `proposal_lists` identify the complete reviewed set. A receipt must confirm every requested destination. Both legacy approval paths reject sets they cannot display. Unanimity retains original proposer/time and rolls back all memberships/Events on any failure. Personal retries retain confirmed destinations and send optional messages only for newly acknowledged saves; closing the picker invalidates callbacks without cancelling accepted queued commands. There is no additional Done confirmation.

## 15. Portable observations and external research

E1 defines a source-typed Observation/Outcome boundary; [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md) owns dataset normalization and manifests. Research input is never sent through native Event ingestion by manufacturing Kajo accounts.

Preserve dataset/release namespaces, raw values/scales, occurrence time, availability time (or explicit uncertainty), correction/version identity and missingness. Rating-record time does not establish viewing time, recommendation exposure or action propensity. Imported user-authorized history, external research, native Kajo observations and generated hypotheses remain distinguishable even when an adapter maps their fields to a shared contract.

Only information available at prediction time may form input state, retrieval keys, transforms and memory. Later observed labels can evaluate eligible targets at their declared maturity/cutoff. An unchosen alternative has no observed counterfactual outcome; missing or not-yet-mature feedback is not rejection. Synthetic branches never become native Events, observed evaluation labels or independent support for their generator. External artifacts retain lineage and admission/withdrawal rules instead of appearing as copied Scenario history.

### Planned star, overflow and Next controls — owner decision 2026-09-12

#239 maps the star to the existing default SYSTEM_SAVED/SAVED action; Tykätyt is
presentation wording and does not imply a rating or consumption. Shared saves
retain Endorsement/unanimity. Overflow uses the existing destination commands.
Saving will stay on the card, and Next only changes the viewed card: it creates
no implicit negative/positive Outcome. Actual visibility/opening of the new card
still uses its original per-Item delivery origin. These planned controls preserve
atomic receipts, source/actor/Profile/session identity, partial success and
correction/Undo. #240 reconnects read attempts without discarding or fabricating
queued exposure/action evidence. Neither UI decision introduces new Event types.
