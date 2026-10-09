# Kajo Event Model

Status: canonical behavioral + growth telemetry contract, with accepted-main commands and explicitly marked #229/#232 successors.

STATUS owns source, hosted and device acceptance. The #229 source sections below describe the inspected active branch, not code delivered by this documentation change. #232's coordinated user/learning flow remains required; its source-only round evidence foundation is described separately below.

Kajo must know not only what it predicted but what actually happened. Recommendation evidence, state reconstruction, evaluation and SleepLayer depend on trustworthy events. The Taste-first launch adds acquisition/funnel telemetry, but growth events must not silently become recommendation reward.

The active native memory/serving parity correction changes a versioned current
decay calculation, not canonical Event identity or evidence strength. A newly
computed PredictionRun/state/feature trace identifies its live kernel version;
old runs, scalar feature vectors, receipts and shadow/page replay remain frozen
with their original numbers and versions. Correcting current calculation must
not fabricate earlier knowledge or rewrite a historical forecast. Exact native
decay interpretation belongs to PREDICTION_MODEL; source/native/hosted acceptance
belongs to STATUS. Current native Events and UNDOs require finite `occurred_at`
at or before their respective cutoff; future/nonfinite UNDOs cannot remove current
evidence. `nativeEvidenceAsOf` records memory's explicit `state_as_of` or the base
transaction's `now()`. This occurrence-time selection neither unifies those clocks
nor proves commit-time availability.

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

Required #232 coordinated SharedRatingRound semantics remain planned beyond the source-only foundation below; no new joint Outcome Event is activated. Each response retains round ID, actor, SharedProfile, Item, participant-set version and truthful delivered origin. Pending responses do not emit completed joint consumption/reward. Final completion, joint state and Outcome Events must eventually commit atomically once. Rating 0 is valid; preserve responses/disagreement without attributing one actor’s score to the group or copying Personal Events.

Edits/Undo, cancellation and changed membership correct/reconcile prior outcomes. A rewatch uses a new round ID; earlier experiences and action receipts remain immutable. Completion is not automatically positive preference or predictor success. Version reward interpretation and test delayed attribution, participant loss, legacy single-actor history and Personal isolation before Phase 16.3 acceptance.

### Executable round evidence foundation — #232A, source only

`public.commit_shared_rating_round_v1` accepts a bounded version-1 command with
`commandId`, authenticated `actorUserId`, `profileId`, `roundId`, `kind` and
`expectedRevision`. Its round-command namespace is separate from legacy Item/
collection `actionId`; it does not promise cross-family UUID deduplication.
OPEN_ROUND binds the Item/experience and snapshots current accepted participants.
SET_RESPONSE records the actor's integer 0–10 rating or explicit unknown;
CLEAR_RESPONSE removes that actor's current answer without erasing its revision.
CANCEL_ROUND and RECONFIRM_ROUND retain history, and reconfirmation requires fresh
answers against the new enrollment snapshot. Exact payload retry returns the
original receipt only after current authorization; a changed payload or stale
revision fails. Occurrence/receipt times are server-owned.

The v1 boundary caps JSON commands at 4096 bytes, participants at 32 and revisions
at 4096 per round. OPEN_ROUND refuses allocation when 16 other pending/
reconfirmation rounds already exist for the Profile. Correcting or reconfirming
an existing round remains possible at that allocation limit; resource admission
cannot prevent an answer from becoming unknown or being cleared. The immutable
receipt is an acknowledgement of that command's historical result; the read API
supplies current status after intervening answers or membership changes.

Each optional origin claims its own prediction/session/mode. Validated attribution
requires the actor's same-SharedProfile run, selected Item and actual impression.
Missing proof remains UNATTRIBUTED with the claim retained separately; a later
impression cannot rewrite a response or receipt. An unranked response is permitted
without inventing an exposure. `public.get_shared_rating_round_v1` returns the
authorized current round projection and per-actor response vector. Completed
answers do not collapse into an average or imply satisfaction.

Private round/participant/response-revision/receipt storage and membership
generation bookkeeping are API-denied and RLS-enabled. This source writes no
native Event, legacy Item interaction, existing action receipt or joint reward.
The explicit `groupReward=null`, `learnable=false` output keeps these new records
out of the legacy scalar learning loop. The old single-actor Shared evidence
reader remains legacy. The source-only receipt-prefix reader below adds temporal
interpretation without admission into those consumers. Joint learning admission,
rewatch eligibility, durable mobile commands and Phase 16.3 activation remain
required. STATUS records source verification and deployment separately.

### Versioned receipt-prefix outcomes — #232B, source only

`private.shared_rating_round_outcome_v1` reads one SharedProfile/round and returns
`shared-round-outcome-v1`. It is an internal invoker function with an empty search
path; PUBLIC, anon, authenticated and service_role cannot execute it directly.
No public RPC, Event, history entry, scalar reward or existing reader is changed.

The caller supplies finite past/present `outcome_cutoff`, `evidence_cutoff` and
an explicit nonnegative maturity interval of at most 90 days, without calendar
months/years. Commands must belong to the receipt prefix accepted by both cutoffs.
Revision orders that prefix, including timestamp ties; a later revision cannot
skip an earlier cutoff-invisible receipt when the server clock regresses. Before
the OPEN receipt, or after lineage deletion, there is no round projection.

`outcome_cutoff` is a server-command timeline point. A correction after it remains
outside that historical prefix even when `evidence_cutoff` is later. Advancing the
outcome cutoff exposes the correction; an old vector is not a claim about current
truth. Reconfirmation retains only responses for its newly acknowledged set.
The maturity anchor is the latest accepted time in the selected prefix, including
a rating edit that leaves the round completed; clock regression cannot move that
anchor backwards. Elapsed time is a caller-declared review
window, not evidence of satisfaction, calibration or immunity to later correction.

Each response retains its immutable recorded origin. A separate derived
attribution can reconcile a late actual impression only for that response's own
actor, SharedProfile, Item, selected run, session and mode. The run/impression
must precede the response in occurrence time and the stored Event creation
timestamp must be at or before the evidence cutoff. This inherited timestamp
convention is labelled `proofAvailabilityBasis=STORED_EVENT_CREATED_AT`;
`proofAvailableAt` does not establish trusted server arrival or commit visibility.
The existing Event insert boundary permits the recorded column, so a future
availability/admission ledger must capture its own server observation time.
A claim or another member's exposure is insufficient.
Neither response nor receipt is rewritten; advancing the evidence cutoff can
change only derived attribution.

The output declares `COMMAND_RECEIPT_PREFIX`, `SERVER_COMMAND_ACCEPTED_AT` and
`historicalFeatureEligible=false`. These records contain no full membership
timeline or commit-visibility history; timestamps cannot prove a past transaction
was already visible. Current membership/head/catalog tables do not replace that
missing evidence. A future prediction-time consumer needs a genuinely captured
visible prefix or a separately admitted availability ledger.
In particular, a command accepted before a cutoff can commit after the original
read: rereading the same cutoffs may then include it. These arguments alone are
not a frozen replay token. Retain the selected command/revision and actual
observation boundary when a future consumer freezes a result.

Coverage distinguishes rated, unknown, cleared and unanswered participants and
attributed responses. Complete vectors preserve zero and disagreement; minimum
rating and rating spread are descriptive summaries, never a joint reward.
`READY_FOR_VECTOR_REVIEW` requires all ratings and the declared elapsed interval;
other results distinguish incomplete, immature and cancelled evidence.
`groupReward=null` and `learnable=false` remain explicit. The next learning
consumer must freeze interpretation/cutoffs/window, correction lineage and the
same observable vectors for production and shadow before admitting a label.

### Observed outcome captures and paired support — #232C, source only

`private.capture_shared_rating_round_outcome_v1` creates an internal
`shared-round-capture-v1` artifact from the reader's actual statement-visible
result. The caller supplies a capture ID and the reader arguments, never a
rating vector. The artifact freezes the complete outcome JSON, selected receipt,
revision/participant-set identity, cutoffs, elapsed maturity and interpreter
versions, a content checksum and server observation time after the read.
Retrying the same ID/arguments returns the original artifact; changed arguments
under that ID fail. Replay reads stored JSON rather than rerunning timestamps.
Later commits, late exposure, edits, cancellation or reconfirmation require a
new capture ID and retain the earlier interpretation as a separate version.

The capture references its selected immutable receipt with cascading deletion.
It does not lock a mutable round/Profile through a direct parent foreign key;
this permits an independent consumer to finish capturing an older committed
prefix while a newer response transaction remains open. The existing receipt
lineage carries round/Profile/Item and former-participant erasure into captures
and their comparisons. Captures and comparisons are immutable, RLS-enabled and
API-denied; only the internal owner can execute these invoker functions.
Allocation is bounded to 16 captures per round and 16 comparisons per capture;
exact retries remain possible at capacity. These are derived-artifact limits,
not limits on correcting the underlying response.
New allocation requires READ COMMITTED isolation so a waiter sees earlier
committed allocations after its advisory lock. REPEATABLE READ/SERIALIZABLE
allocation fails closed; stored replay and exact existing-ID retries still work
under those isolation levels.

This new-lineage cascade is conditional on successful source erasure. The older
SleepLayer shadow tables retain non-cascading source/Profile/User foreign keys
and DELETE-denying triggers. A processed shadow can therefore block the source
actor/Profile deletion; that failed transaction also rolls back derived erasure.
The #232C tests preserve this inherited failure explicitly and prove new-lineage
erasure for a former participant without those old shadow dependencies. Repair
of the older shadow deletion boundary is the next separate source prerequisite,
not an accepted privacy behavior or evidence of full account erasure.
Independently purging a PredictionRun is a different boundary: these comparisons
retain copied trace metadata and have no run foreign key. Stored replay survives
such a purge; a new comparison reports unavailable source support. The source
eraser must explicitly include copied comparison lineage when deleting traces
for privacy, rather than assume its receipt foreign key covers that operation.
The #232D source implements that separate owner preparation boundary below;
direct User/Profile deletion still does not call it automatically.

`private.compare_shared_round_outcome_capture_v1` freezes one capture, one
Challenger genome and one existing evaluation window. It checks the declared
prediction interval, input/outcome cutoffs and maturity. For each response it
requires that actor's own Shared run, selected/exposed Item and compatible frozen
shadow run/candidate pool. Both sides retain the same capture/vector and common
support mask. Partial support is reported rather than filling missing ratings
or crediting another actor's trace. A fully supported, ready vector is a paired
review artifact, not a scalar evaluation result. Window and run/candidate/version
metadata are retained so later mutable state cannot redefine the comparison.
Candidate snapshots retain frozen IDs, ranks/scores/selection and explanation
checksums after validation of the bounded full pool; this is a paired support
artifact, not a new full-feature replay engine. Capture/result sizes and
candidate enumeration are bounded as well as artifact counts.

The artifact use is `OUTCOME_EVIDENCE_ONLY`. `observedAt` establishes what the
consumer read, not a receipt's commit time, Event arrival time or availability
to an earlier PredictionRun. `historicalFeatureEligible=false`, null production/
challenger metrics, advantage and group reward, and `learnable=false` remain
explicit. No legacy `genome_evaluations` row, Event, Memory or policy promotion
is produced. One round/experience remains one observation unit across member
coordinates and multiple captures. A prospective feature consumer must freeze
the capture reference it actually used; a separately declared joint target and
exposed-outcome metric are still required before learning admission.

### Prepared pre-first-response inputs — #232F, source only

`private.capture_shared_round_prediction_input_v1(capture_id, profile_id,
round_id, expected_revision, source_capture_ids)` is an internal owner-invoker
producer. The owner supplies identities and an explicit set of earlier outcome
capture IDs, never a fabricated roster, response vector or prediction output.
An empty source set represents preparation without prior captured outcomes.
The private input and source-binding tables are RLS-enabled, API-denied and
immutable; a getter replays stored JSON rather than querying cutoffs again.

New allocation acquires the shared prediction lifecycle gate first and requires
READ COMMITTED. A capture-ID lock, current Profile/actor/full ordered membership
locks and the target round lock serialize it with the existing answer and
membership writers. The current full 2–32-member enrollment must equal the
acknowledged participant vector; the pending head must match the requested
revision and the complete contiguous OPEN/RECONFIRM receipt prefix. Any response
row or SET_RESPONSE/CLEAR_RESPONSE receipt anywhere in this round's history
rejects allocation, including unknown, clear and earlier participant sets.
A membership reconfirmation without any prior response remains eligible.
This is a locked pre-first-response observation, not an accepted-at reconstruction
of an earlier global commit timeline.

Source selection is caller-declared, with 0–16 unique capture IDs in canonical
order. The producer reads the exact stored #232C snapshots under source-row
locks, preserving their outcome/cutoff/maturity/attribution versions and status.
Sources require the same SharedProfile and complete actor/enrollment vector;
different source rounds/experiences cannot masquerade as independent revisions
of one experience. Source observations must be finite and visible within the
new observation boundary. Current membership at preparation does not prove old
source prediction-time membership or availability to an earlier consumer.

The artifact records `INPUT_CAPTURE_ONLY`, `predictorConsumption=NOT_RECORDED`,
`historicalFeatureEligible=false`, `learnable=false` and null group reward.
It is neither a PredictionRun nor a receipt proving that a scorer used these
features. Existing ordinal/outcome artifacts keep their original interpretation.
Exact ID/payload retries return the original artifact after current actor
reauthorization, including after subsequent answers; a changed payload rejects.
There are at most 16 inputs per round, a 4 KiB request and an 8 MiB result.
New allocation under REPEATABLE READ/SERIALIZABLE fails closed; exact stored
replay does not create a new allocation or restore erased lineage.

The parent references its selected target receipt with cascading deletion.
Indexed reverse source bindings plus a READ COMMITTED-only source-capture
BEFORE DELETE trigger
remove the whole copied input parent when any selected source is deleted;
removing only an edge would leave erased data in the stored JSON. Existing
round/receipt/User/Profile/Item cascades carry both target and source erasure.
The #232D preparation is extended after its existing safety checks to invalidate
these inputs for an erased Profile or any frozen actor, including a departed
member whose run belongs to another actor. Typed producer metadata covers every
copied current/former prefix participant and actor, plus retained validated and
claimed prediction references. A claim receives no exposure or outcome credit;
its copied identifier still participates in conservative erasure. The combined
deletion budget includes input parents and reverse-binding rows before mutation.
Direct binding removal while a parent exists is denied; whole-parent cascades
remain valid. Unresolved learned-policy influence
still rejects the entire preparation before mutation. Automatic Auth/account
erasure integration and genuine consumer-run lineage remain separate gates.

### Closed prediction-source erasure preparation — #232D, source only

`private.erase_prediction_sources_v1(scope, id)` is an internal owner-only,
READ COMMITTED transaction operation. Its scopes are `PREDICTION_RUN`, `PROFILE`
and `ACTOR`; it removes the canonical PredictionRun source closure and dependent
shadow jobs/runs/candidates and copied vector comparisons. ACTOR includes runs
in that User's owned PersonalProfiles, as well as their actor-owned runs. PROFILE
includes every actor's runs in that Profile. Actual protocol-2/3 source/root/
parent page links extend the closure to dependent production runs, without
including independent requests. A missing PREDICTION_RUN root is rejected;
ACTOR/PROFILE copied comparison metadata is checked even if its original run
is no longer present. User/Profile roots remain locked
and present: an owner may delete the root in the same transaction after this
preparation succeeds. This is not an automatic Auth deletion or mobile account
deletion integration.

Evaluation rows do not retain exact source-contribution lineage. Erasure therefore
invalidates whole existing evaluation batches in windows intersecting the erased
runs or their copied trace times, and windows retained by matching comparisons
or directly scoped PROFILE evaluations. This includes GLOBAL and every shrunk
PROFILE scope and genome. It cannot keep
a profile metric whose shrinkage still contains the erased global evidence.
Unrelated source rows, windows and genomes remain. Promotion decisions retain
copied metrics and policy assignments retain rollback ancestry without a complete
evaluation foreign key. Unresolved learned policy influence rejects the entire
operation before any deletion; ordinary rollback is not influence erasure.
The owner operation rejects a truncated closure rather than deleting a partial
set; source and total dependent-row caps bound the preparation.

An API-denied, RLS-enabled permission relation authorizes only exact immutable
DELETE rows for this backend and transaction. Ordinary UPDATE/DELETE stays denied;
there is no caller-settable bypass or disabled trigger. The eraser obtains an
exclusive lifecycle advisory lock before parent/source locks. An owner must call
it as the first lifecycle writer in a dedicated transaction, before acquiring
parent locks; upgrading an earlier producer's shared lock is not a safe concurrent
composition. Shadow worker,
scalar evaluator, manual canary, rollback and new vector comparison operations
obtain shared access before their own locks and use fresh READ COMMITTED snapshots
for writes after waiting. Serving rank/page/window and atomic Item/collection/
Shared command entrances join this gate before their parent/receipt locks.
Exact stored comparison retries remain read-only.
The permission rows are removed before successful return; any error rolls back
the preparation, including permission allocation and all derived invalidation.

Standalone run erasure removes copied production/shadow trace comparisons even
though they lack a source FK. It retains the canonical round outcome capture;
that capture records outcome/response origins, not a copied prediction feature
trace, and a later comparison reports missing source support. Actual round or
participant-root erasure still follows the receipt cascade. Arbitrary Item hard
erasure and automatic Auth/Profile lifecycle integration require separate closure.
Existing canonical Item state can independently restrict User deletion; successful
prediction preparation does not remove that state or make that root deletion
unconditionally succeed. Bootstrap/import/calibration and account lifecycle
writers still need their own integration review before full concurrent account
erasure can be claimed.

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

### Catalogue-chain delivery — protocol 3 source, 2026-10-06

The owner-promoted append correction uses `catalog-chain-v1` over the same page
RPC. Server-owned delivered-prefix exclusion precedes bounded source admission.
Each new page is a fresh immutable PredictionRun with its own per-Item origin;
chain/root/parent/index metadata preserves global delivery order without claiming
a frozen catalogue-wide ranking. Prior cards and trace identities remain unchanged.
Private immutable chain-page evidence survives derived cache expiry.

No new Event type or fabricated exposure is introduced. A page fetch/prefetch is
not an impression. The existing captured visible origins/detail/actions and late
exposure resolver retain the particular page run, including rating 0 received
before its delayed impression. Shadow and mature evaluation compare the actual
page's frozen candidate source; they do not simulate unseen whole-chain actions.
Exact receipt retries after cache cleanup add no duplicate run/action/outcome.
Source/PGlite, native CI, hosted rollout and real visibility remain separate gates.
