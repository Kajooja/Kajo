# Kajo Event Model

Status: canonical behavioral + growth telemetry contract. #329 integrates the #229/#232 source foundations; dated predecessor semantics remain explicitly identified below. STATUS owns deployment and acceptance.

STATUS owns source, hosted and device acceptance. The #229 source sections below describe the inspected active branch, not code delivered by this documentation change. #232's coordinated user/learning flow remains required; its source-only round evidence foundation is described separately below.

Kajo must know not only what it predicted but what actually happened. Recommendation evidence, state reconstruction, evaluation and SleepLayer depend on trustworthy events. The Taste-first launch adds acquisition/funnel telemetry, but growth events must not silently become recommendation reward.

The Personal source-fusion correction now resolves available same-owner native
rating authority before assigning weights. Exact scoped canonical command
receipt lineage governs revisions, including backdated/equal occurrence clocks;
legacy raw Events retain explicit chronological ambiguity rules. A valid later
revision replaces earlier same-Item authority and bootstrap contribution; zero
and neutral five remain real answers. Exact scoped Undo, selective clears and unavailable/ambiguous replacements
retain their distinct effects. Receipt-bound history erasure cannot resurrect an
earlier negative merely by reversing a later rating. The resolver reads existing
Events/receipts/bootstrap sources and writes no synthetic or duplicate Event.
Retained bootstrap fallback remains explicitly source-labelled prior evidence.
Newly computed Personal traces version this source/floor correction while old
frozen forecasts/receipts keep their original values and versions. Exact semantics
and limits belong to [Personal source fusion](PREDICTION_MODEL.md#49-personal-source-fusion-and-forgetting);
STATUS owns implementation and acceptance. Setup strong support is not a count
of known Taste ratings, and mutable future display state cannot certify a prefix.

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

The separate source-only Personal WorkingState adapter maps already-authorized
canonical Events and `event_sessions` into an immutable ordered prefix. Native
Event IDs remain exact source references; Profile/User/session identities map
through explicit scoped handles. Ratings retain valid zero, malformed/unknown
values do not invent dislike, and not-interest is an explicit negative action
rather than a fabricated rating. History clear and interest clear retain their
different canonical effects. Visible same-owner corrections and exact UNDO links
are reconciled before selected-session taste is derived; another session supplies
no positive taste or activity-clock renewal. Foreign/private/synthetic/bootstrap
inputs are not native support. The caller explicitly declares complete session
prefix plus correction closure; stored `created_at` is an availability proxy,
not commit-time certification. The portable adapter adds no Event writer or
core table. The separate versioned native bridge consumes its frozen current
capture in Personal PredictionRuns with exact OFF serving; historical learning
eligibility remains false. Exact limits and
OFF/STATIC/ORDERED controls belong to the [engine README](../../packages/prediction-engine/README.md#bounded-session-intent).

The separate private prospective Personal producer declares actual delivered
same-tier Item pairs and OFF/STATIC/ORDERED comparisons before own exposure or
terminal evidence. Declaration and evidence use separate committed transactions;
a private deferred commit guard rejects own paired evidence added before the
declaration commits, including SAVEPOINT children. Tuple xmin is only additional
transaction-identity defense, not an availability certificate. Actual
source/session/mode `ITEM_IMPRESSION` after declaration and controls is required;
page retrieval does not fabricate it. Canonical Event names remain unchanged.

`personal-latest-terminal-v1` resolves the complete own Item correction prefix
through a fixed maturity boundary. Latest surviving occurrence wins; valid rating
zero stays observed. Exact own UNDO restores a prior surviving terminal, while
history clear, not-interest, interest clear, malformed/missing UNDO and simultaneous
terminal times remain clear/unknown/undone/missing coverage. A rating after horizon
end is unscored even if visible before maturity. Raw rating session/Prediction
origins remain available for audit without a causal attribution claim. This target
is separate from strongest-episode reward. Immutable captures retain every copied
raw Event dependency; Event/origin-forecast withdrawal removes the entire capture,
never just its binding. A reservation prevents withdrawn capture ID/revision reuse.
Stored clocks remain UNKNOWN commit proxies and grant no historical learning.

The private native reset ledger records session lifecycle controls rather than
Item/taste Events. Each authorized reset freezes one server-clock boundary and
its exact actor/Profile/session identity; retries preserve that receipt. The
reset-aware capture copies all cutoff-visible controls alongside its complete
Event/correction prefix, excludes taste and activity at or before the latest
boundary, and retains the original session lifetime. Reset neither writes a
preference nor deletes history. Forecast-only erasure retains raw controls with
surviving raw Events; actual User/Profile/session removal cascades them. The
ledger and controller are API-denied, with no public reset RPC or mobile control.
The version, quota, availability and frozen replay contract belongs to
[private native session reset controls](PREDICTION_MODEL.md#private-native-session-reset-controls).

The portable WorkingState evaluation boundary consumes already-reconciled
immutable label captures with exact source/actor/Profile/forecast-session and
Item/exposure references. Later outcome Events need not share the original
forecast session; the captured forecast context remains bound to its plan. It creates no canonical Event, enrollment ledger or
outcome-capture writer. Missing, cleared, unknown, immature and unexposed labels
remain unscored; corrections/replays of one stable source record cannot add
independent observations. Stored source/control creation times do not certify
commit availability or prospective enrollment. Declared sources/completeness do
not authorize current access; the trusted owner must invalidate or remove
retained captures/plans/reports after withdrawal. This packet adds no native
outcome producer or automatic withdrawal protection. The existing strongest-effective
V1 reward evaluator remains unchanged, and strict own-rating capture is a
separate admission gate. Conditional ranking/coverage and weight-concentration
interpretation belongs to [bounded offline WorkingState evaluation](PREDICTION_MODEL.md#bounded-offline-workingstate-evaluation).

The planned ROADMAP 16.4 joint decision session keeps session exposure, veto,
already-seen replacement and choice telemetry separate from canonical consumed
ratings/SharedRatingRound outcomes. A choice is not verified consumption or group
reward; session rejection cannot silently become a permanent group dislike.
Actor/roster/scope/version/expiry and erasure semantics must be specified before
runtime admission. No new production Event or table is created by this plan.

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

The October 15 owner clarification retains every meaningful choice and eventually
measured visible attention (dwell, stops and resumptions) behind the active
Profile, with actor, Item, session/context and original Prediction provenance.
These observations contribute to available-at-time Profile state and observed
Scenario continuations; they are not a separate fixed taste profile. Record
bounded visible-duration intervals/aggregates in milliseconds, not an invented
per-second preference label. Pause the clock when the app or surface is inactive;
retain missing visibility, source identity and exact retry/deduplication. Multiple
views of one interval are not independent support. Existing Item detail already
records bounded `ITEM_DWELL` and stops on background/Item change/screen exit;
complete grid/swipe pause instrumentation and its admitted state/Scenario consumer
remain staged work. Passive duration is weaker than explicit preference, and
absence of attention is not dislike. Retention/erasure follows the source.
For the present packet the owner explicitly prioritizes predictions updating from
accepted choices; exhaustive attention instrumentation is not required yet.

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

### Shared feed Ohita — required target, 2026-10-15

The owner's [near-term feed refinement](../project/ROADMAP.md#near-term-feed-and-first-answer-personalization--2026-10-15)
requires the same **Ohita** interaction in Taste and Discovery. A deliberate,
completed upward swipe dismisses the active card; the equivalent accessibility
action has the same meaning. As refined on October 23, forward navigation after
a durably accepted rating or confirmed List choice creates no additional skip. With no such choice,
it records a neutral/contextual skip and removes the Item
from the current feed. It is neither rating zero, explicit negative preference,
nor proof that the actor does not recognize the Item. It cannot count as a known
rating or a definite recognition answer for readiness. Combining the former
unknown/not-interest UI choices does not combine their historical evidence.
Partial scrolling, cancelled gestures, layout/reflow, navigation or app backgrounding
must not manufacture a skip, exposure or preference observation.

The new versioned semantic boundary must retain the authorized actor/Profile,
Item, Taste question or actual Discovery delivery origin, session/surface,
occurrence and acknowledgement/availability times, original prediction/context
and committed source prefix. Preserve unavailable context as unavailable. One
logical gesture writes at most once: an exact retry keeps its command identity,
body, origin and result; a failed or pending write is not confirmed learning.
Question forecasts remain pre-answer and immutable. An evaluation-only Taste
panel cannot be relabelled as a Discovery delivery or impression.

Suppression is contextual rather than permanent dislike. A separately versioned
policy must specify its scope/cooldown and evidence-supported Scenario change
before the Item can become eligible again; log the skip and later eligibility
reason without rewriting either origin. New eligibility is permission to rank,
not a guaranteed repeat. Rated/consumed, blocked, unavailable and unauthorized
Items retain their independent hard constraints. Existing UNKNOWN,
NOT_INTERESTED, ratings and immutable command/forecast receipts retain their
original semantics; no retroactive recognition or negative labels are guessed.

This is a mandatory planned successor, not a new deployed Event type or writer.
The v1/v2 source facts below and existing explicit negative-interest weights remain
unchanged. The earlier planned #239 Next control only changed the viewed card;
that neutral navigation design did not provide this contextual-skip
observation/suppression contract and is superseded by this feed target.

### Neutral skip conformance reference — 2026-10-16

The first bounded #239 source packet defines an **executable reference**, not a
native writer or mobile control. `kajo-contextual-skip-v1` separates
`CONTEXTUAL_SKIP` and `WITHDRAW_CONTEXTUAL_SKIP` from every existing Taste answer,
rating and Item action. The proposed Discovery Event names are
`ITEM_CONTEXTUALLY_SKIPPED` / `ITEM_CONTEXTUAL_SKIP_WITHDRAWN`; neither was admitted
by the Event constraint or mobile EventType at this reference checkpoint. Taste keeps a private
question-bound response. No new Event, bootstrap contribution, recognition,
consumption, readiness support, impression or reward is emitted by this reference.

The strict command contains version/kind, actionId, actorUserId, profileId, itemId,
decimal Unix-microsecond occurredAt, contextRef (an immutable server-bound snapshot
reference or null), reversesActionId (null for a skip), and exactly one origin:

| Adapter | Required origin |
|---|---|
| Taste | `surface=TASTE`, sessionId, questionId, panelId and committed prefixRevision |
| Discovery | `surface=DISCOVERY`, Event sessionId, predictionId, deliveryRequestId and actual impressionEventId |

These are required inputs to the future trusted adapters, not a claim that the
native RPCs already return this envelope. The native Taste adapter must resolve
the current question/panel/prefix; the Discovery adapter must resolve the actual
delivered page and acknowledged impression. Neither accepts caller-invented
origins or turns an evaluation panel into delivery. Context missingness remains
explicit; the reference supplies no Context/Scenario database or resolver.

The command oracle requires a permanent authenticated identity and currently accepted membership on every
call, including retry. Taste is own-Personal only; Discovery also permits an
accepted Shared member in that SharedProfile. Original actor, Profile, Item,
origin and context must match the trusted source. The source must have committed
before the server acceptance clock. Client-reported occurrence is retained,
permits up to five minutes of future skew and supplies neither prefix ordering
nor the cooldown clock; a slow client clock cannot invalidate a genuine earlier
server-origin binding. Foreign/anonymous/service-role
calls fail. Exact semantic-JSON retries retain the original receipt/time; any
changed body conflicts. The trusted source's `acceptsNewSkip` must still be true
for a new skip; a committed rating/save closes that opportunity. Exact retries
and same-actor withdrawal remain available after it closes. A different request ID cannot skip the same shown
opportunity again, even by changing contextRef or after withdrawal. Withdrawal
belongs to the original actor and exact source and removes only that skip.
An unavailable source blocks cached replay. The native erasure/tombstone writer
must additionally remove all copied private payloads and prevent resurrection.

`applyKajoContextualSkip` is a **serialized pure oracle**, not a concurrency lock,
authorization service or durable store. Its caller must supply the complete
authorized committed prefix. The 256-record reference bound fails closed on
overflow; it is not an accepted lifetime product quota or permission to truncate.
`kajoContextualSkipRecords` projects confirmed receipts only. The existing mobile
outbox is tested against this oracle for lost replies, restart, local-ack failure,
scope cancellation, blocked conflicts and corrupt/legacy queues. Production RPC
routing, native concurrent-retry/withdrawal locks, source erasure and client
capability negotiation were outside this reference checkpoint; the native
successor below supplies their implementation and separate acceptance boundary.

Suppression uses the separate
[`contextual-skip-cooldown-v1` policy](PREDICTION_MODEL.md#neutral-skip-eligibility-reference--2026-10-16).
Pending commands never enter that input. Native candidate admission, page rechecks,
catalogue-chain refill/exhaustion and stale-undelivered-work retirement must all
consume the same confirmed cross-surface source before Ohita can be enabled.
Frozen panels, DeliveredSlates and old exact replies remain immutable. An
acknowledged rating/save auto-advance must not also issue this command.

### Native contextual skip source — 2026-10-16

The native #239 successor implements the reference using separate authenticated
`commit_taste_contextual_skip_v1(command)` and
`commit_discovery_contextual_skip_v1(command)` RPCs. Both consume the exact
`kajo-contextual-skip-v1` command and return the reference receipt. Only permanent
own-Personal owners may write Taste; Discovery also accepts current Shared
members. Server authority is rechecked on every retry. Native contextRef is
explicitly null until a trusted snapshot provider exists.

Private command storage retains exact semantic JSON, server acceptance and the
original result. Request identity conflicts fail; a second ID cannot duplicate
the same shown opportunity, including after withdrawal. An unavailable source
blocks cached replay. Erasure clears copied payloads and retains minimal replay
barriers. A private run/source relation records the latest surviving skip set at
the run cutoff, including suppression before candidate insertion; erasure follows
these dependencies and clears derived copies. The initial relation conservatively
covers same-Profile Items, never a different Profile or future cutoff. Deleting an
account/Profile removes its scoped records. Storage uses
indexed native rows rather than the oracle's 256-entry fixture lifetime bound.

Taste validates its actual session/question/panel/committed prefix and appends a
neutral private response. It creates no Event, numeric first-answer measurement
or bootstrap label. NEXT remains a separate committed operation. Legacy CORRECT
cannot turn the neutral response into an old answer kind; withdrawal uses the
new same-actor command. New snapshots advertise an optional exact current-question
capability; old durable replies remain unchanged.

Discovery resolves the exact delivered page/request, Prediction, Event session
and acknowledged impression. The source read
`discovery_contextual_skip_source_v1(request)` exposes that authorized binding.
Only the dedicated writer admits `ITEM_CONTEXTUALLY_SKIPPED` and
`ITEM_CONTEXTUAL_SKIP_WITHDRAWN`; generic Event insertion/update cannot forge them.
No ItemInteraction, rating undo head, rating/consumption, recognition, outcome
reward or negative evidence is produced. Neutral Events are excluded before
Working-prefix budgets, not merely assigned zero weight afterward.

Native writes acquire the source-lifecycle gate before scope/receipt locks, using
READ COMMITTED. The initial implementation serializes these bounded operations
with source erasure and serving; this is a correctness tradeoff, not a measured
throughput claim. Legacy removal/history-clearing entries that reach these
erasers also acquire the exclusive gate before existing row locks; other
ordinary actions retain shared locking. Earlier frozen forecasts/delivered receipts remain historical.
Learning-changing rating/List acknowledgement marks the future reader dirty;
the already started bounded refill and its exact retries may finish and fill only
free slots. Coalesce acknowledgements and renew the root from the latest committed
prefix before the next new refill. Neutral skip acknowledgement retains the reader. The October 23
Discovery refinement retains the active card and at most five already prepared
successors across ordinary rating/skip/List acknowledgements, with each frozen
page origin intact. New refills use the latest committed prefix; this bounded
latency/freshness tradeoff supersedes the earlier suppression-only exception.
Server Undo, scope changes, source withdrawal and rejected-command discard still
invalidate the prepared window and preserve canonical restoration requirements.

The October 24 feed-local cancellation exception delays dispatch, never durable
admission: the newest skip/rating is persisted under its exact frozen command
and temporarily held. Admission of the next feed choice releases the preceding
one. A sender-owned atomic cancel succeeds only before any dispatch attempt and
removes that unsent command plus its local optimistic intent. Its valid original
delivery may resume in the same scope without a server reversal or extra
impression; eligible prepared successors survive. Sent/uncertain commands cannot
use this path. Cancellation failure, expired origin, source invalidation or scope
change preserves canonical recovery. Runtime holds release after 30 seconds idle or on navigation blur/exit/background/
scope change and are not restored after process death; durable restart replays
the original commands. Pending or cancelled local intent is never confirmed
learning or a fabricated canonical receipt. One-step Undo remains bounded.

After successful durable admission of the first exact undo/withdrawal command,
Discovery may immediately display the prior Item's cached appearance in a separate
`restoringPresentation`. This is not a restored delivery and has no actionable
origin. It cannot produce impression/dwell or accept mutations until all ordered
undo receipts and fresh delivery of the same Item have been obtained. Keep its
visual identity on activation. Exact action origins, partial-undo retry, rejection
and cancellation remain authoritative; showing the preview is not undo success.

A proven unusable/expired pending refill may retire quietly when ordinary
acknowledgement already scheduled reader renewal, retaining the prepared window
and continuing that fresh root without admitting the error response. Without
scheduled renewal, existing explicit refresh/recovery remains. Ambiguous failures
still retry their exact request; hard invalidation always rejects late results.

Mobile routing validates capabilities and every receipt identity before clearing
a persisted command. Taste shares its existing one-command queue; Discovery has
a separately namespaced durable service. Missing capability or an outage never
maps a skip to an old answer or silently discards it. The October 17 shared-feed
source wires Taste to the exact question capability and Discovery to the actual
per-Item page request plus recorded impression ID. Discovery may durably accept
an exact displayed-origin skip intent before the impression reply. The sender
waits for the actual impression acknowledgement, then the existing canonical
writer validates source authority atomically. A separate source-read RPC is not
a mandatory dispatch preflight: a lost-reply retry must reach its exact cached
receipt even when that opportunity no longer accepts a new skip. Local intent is
not a fabricated capability or exposure; optional source status stays quiet.
A scope-level queue resumes original commands independently of card navigation
or new Event sessions. Successful durable local skip/rating admission advances
presentation immediately; failure to persist does not. Track each pending action
ID with its frozen Item/delivery/origin, so a later receipt reconciles that action
without retargeting the active card, clearing its prepared successor or recording
a second response. A successful retry is not a discard. Recovery resets only
after explicit confirmed discard of the exact known rejected action ID; an old
or unknown head ID cannot discard a newly admitted pending command. New Discovery reads retain exact retry identity and request
the current committed prefix; retained prepared cards keep their original page
identities. Rating auto-advance never also submits a skip. Partial/terminated gestures,
slow reading within the card's content extent, layout and backgrounding are inert.
A gesture starting above a long card's reading bottom stops at its rating controls,
even if fast or overshooting. Only a fresh deliberate upward gesture from that
bottom can dismiss; compact-card flicks retain the same exact skip command.
Moving expanded text alone is not evidence. Actual hosted
installation and phone acceptance remain separate. The source PR/STATUS own the
exact tests, CI and installation boundaries.

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

The October 14 [sequential target](PREDICTION_MODEL.md#sequential-adaptive-taste)
adds an explicit pre-answer forecast/evaluation lineage to each response:
committed prefix and version, question/forecast identity, first measured answer,
metric/result or pending/unavailable reason, projection source/revision and the next
consumed prefix. Commit the forecast first, then the first measurement/available
evaluation, then project
the answer for future questions. Rating magnitude affects future preference;
UNKNOWN is recognition-only and explicit negative interest remains distinct.
Corrections/withdrawals amend future source state and invalidate affected copied
reports; original forecasts and measured first answers cannot be rewritten.
Erasure clears retained copies and old retries cannot resurrect them. The bounded
#336 reference does not supply a new native Event writer or SQL/mobile v2.
Its subsequent private explicit-candidate scoring boundary freezes canonical
PredictionRun/Candidate evidence with the server receipt lower bound and a new
transaction cutoff. Evaluation-only candidates are never selected for delivery
and create no Events or exposure. Persistent v2 commands still own prefix/retry,
first-measurement/projection and copied-panel lifecycle; see the
[scoring contract](PREDICTION_MODEL.md#sequential-adaptive-taste).

The current own-Personal `personal-taste-session-v1` source records bounded server-time
response revisions against its frozen session/question ledger. Its SQL policy
adapter consumes only that retained prefix. A zero rating is known; five is a
neutral known rating; UNKNOWN supplies no taste support. WITHDRAWN removes the
current contribution while retaining the revision history until source removal.
NOT_INTERESTED is stored distinctly and may affect question feature coverage;
this version deliberately admits **only RATING** to the existing bootstrap
schema, which has no not-interest source kind. It does not fabricate native
Events, exposure, consumption commands, ShortTerm evidence or challenge results.

A rating projects into the existing `KAJO_CALIBRATION` storage family under the
separate `TASTE_SESSION_V1` dataset, with `source=TASTE_TEST`, `tasteSessionId`,
`questionIndex`, `questionPolicyVersion` and `responseRevision` metadata. It never
replaces the older `COLD_START_V1` dataset or an imported source. Only the answered
Item is updated, so another response cannot reactivate an unrelated removed
rating. Native authority is still resolved by the Personal source-fusion policy.
Session/import removal withdraws this source and clears session and exact-retry
copies; old request IDs cannot resurrect it. Broader bootstrap retention remains
owned by its existing lifecycle.

The #330 mobile consumer persists one immutable pending RPC command before
sending it. A lost reply or process restart retains its original request ID/body;
local acknowledgement failure retains the same command too. Accepted receipts
refresh bootstrap-serving caches, not native taste Events. Unknown discards the
unsubmitted rating draft and sends UNKNOWN, never a zero or negative rating.
Server-owned state and the subsequent RESUME decide the next opportunity.
SQLite keys include backend, actor and Profile; corrupt or stale-scope data is not
dispatched/overwritten. Source/receipt issuance still does not prove screen exposure.

### Sequential own-Personal v2 source

The successor `public.taste_session_v2` separates START/NEXT/ANSWER transactions.
NEXT commits an owned canonical non-delivery panel and one question. ANSWER retains
its first server measurement and currently available same-prefix evaluation before
projecting `TASTE_SESSION_V2` / `KAJO_CALIBRATION` evidence. Both the full-precision
receipt and transaction identity precede a later NEXT; a lock wait alone cannot
make a transaction that began before the answer eligible to score it.

Numeric zero/five/ten remain genuine ratings. UNKNOWN changes recognition/history;
NOT_INTERESTED also projects a distinct negative bootstrap prior with a null
rating. It uses the existing native not-interest weight times the existing
bootstrap/native rating trust ratio (`-5.5 × 0.75 / 1.2 = -3.4375`), under
`taste-prior-v2`; this is an inspectable baseline, not measured quality admission.
Existing bootstrap kinds retain their weights. Only this owned v2 source may
write the new kind; it creates no consumed/native Event or native confidence.
A later authoritative native rating/not-interest supersedes it through existing
Personal source fusion. UNKNOWN supplies no preference weight.
No question panel becomes an impression, delivered outcome origin or Scenario
reward. Ordinary Discovery retains its existing canonical Item action writers.

Command IDs retain canonical JSON hashes and exact sanitized replies. Corrections
append response revisions; original first measurements and panels cannot be
rewritten. Label withdrawal invalidates its dependent panel/question closure and
removes those copied canonical evaluation runs; source-erasure retries return a
redacted result. Whole session/import removal clears copies with a terminal
session; account cascade clears ownership. External source erasure invalidates
copied panels, and an Item rated elsewhere after freeze is no longer a valid first
holdout. Existing v1 sessions and completed setup are preserved without conversion.
PAUSE retains the same Profile/evidence and declares insufficient support for
Discovery continuation; the mobile consumer and full readiness admission remain
separate integration gates. See [the current source boundary](PREDICTION_MODEL.md#sequential-own-personal-v2-source).

The [versioned pool successor](../architecture/decisions/0010-versioned-taste-candidate-pools.md)
binds a fresh bounded candidate catalog to each new V4 question panel. Pool
acquisition is neither an exposure nor a preference Event. Original panel/cutoff
and first-label identities remain the evaluation source; later membership cannot
rewrite earlier comparisons. Question display, answer projection and contextual
skip resolve the exact original pool, including lost-reply retries. Panel/source
invalidation redacts copied pool data and parent deletion cascades. Retained
session policies keep their existing fixed-catalog behavior. STATUS distinguishes
this successor's source and hosted acceptance.

## 4. TasteChallenge evaluation

A held-out challenge prediction must be frozen before the actual answer can influence the state being scored.

Canonical order, applied per question for the sequential target:

```text
1. freeze PersonalProfile/Taste state snapshot
2. freeze model/policy/feature versions
3. persist challenge Prediction / expected rating or fit
4. present held-out known Item
5. collect actual answer
6. persist first measurement and any currently available evaluation
7. only then allow answer to influence future Profile state
```

Conceptual challenge audit fields include the following. These do not introduce
a new native wire contract or change the retained v1 response:

```text
tasteChallengeId
tasteSessionId
itemId
predictionId / challengePredictionId
stateSnapshotVersion
committedPrefixRevision / source references
forecastPanelIdentity
modelVersion
policyVersion
forecastAvailability / predictedValue?
responseSemantic / actualValue?
firstMeasurementReceiptId
evaluationMetricVersion
evaluationStatus / result? / unavailableReason?
predictedAt
answeredAt
```

A challenge prediction whose answer was already in training evidence is invalid and excluded from user-facing accuracy/evaluation.
UNKNOWN/non-rating answers and unsupported forecasts retain their explicit
semantics; nullable numeric fields must not be filled with invented values.

Each evaluation identifies the exact committed prediction prefix; ordinal pairs
require the same domain, prefix/model and declared panel with both first labels
unseen at that prefix. A delayed second label completes a comparison from that
original panel, without rescoring after intervening learning. Pending comparison
is neither an accuracy result nor a failure. Scalar scores from different learned
prefixes are incomparable. Sequential projection follows the stored first
measurement/available evaluation and declares its source revision. A later
correction
does not replace the original label; withdrawal invalidates/removes affected
copied reports rather than retroactively improving their metrics. See the
[scoring/cutoff boundary](PREDICTION_MODEL.md#sequential-adaptive-taste).

The preserved v1 own-Personal `personal-taste-challenge-v1` implementation stores private first
answers only after one canonical run and the entire reserved holdout slate have
been committed. It excludes every training presentation and all existing native/
bootstrap evidence on those Items, even inactive rows. It retains the actual run
identity, Taste revision, model/policy/genome lineage, trace/state digests and
server answer receipt times. Exact request retries cannot allocate another run,
answer or score. Scores and the metric are withheld until completion.

These answers are explicitly **EVALUATION_ONLY**. They create no native Event,
bootstrap row, impression, Scenario reward or learnable outcome. RATING zero/five,
UNKNOWN and NOT_INTERESTED remain distinct; no unknown/negative label is converted
to a numeric rating. The [ordinal evaluation contract](PREDICTION_MODEL.md#frozen-personal-taste-challenge)
counts same-domain agreement/ties/missing support without calibrated-rating or
accuracy claims. Source Prediction erasure and Taste/import removal clear copied
forecast, answer and command state; account deletion cascades it. Future explicit
learning projection requires its own source lifecycle while retaining the frozen
pre-answer lineage. Existing Prediction retention remains a separate boundary.

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

This paragraph preserves the earlier #226 single-List baseline; the current exact-set implementation is specified in section 14. The first Shared actor proposes a custom List; another member accepts the existing
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
- sequential forecast → first measurement/available evaluation → projection → committed next prefix,
- separate committed ANSWER/NEXT cutoffs until an end-to-end later-as-of path is proven,
- per-domain readiness/missingness and explicit insufficient pause/budget outcomes,
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

These #229 contracts supersede the explicitly historical baselines above and are included in #329 integration. Sprint 014 and DEVICE_TEST preserve their development/device record; STATUS identifies the source and remaining gates. These #229 changes do not themselves implement SharedRatingRound; its later #232A/B source foundation and remaining user/learning scope are documented separately.

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

The October 24 Discovery/history pager creates no preference or membership Event
when selecting, dragging or previewing a page. Only the settled selected and
route-focused grid may record an actual visible impression or open with its
exact per-Item origin. Hidden/dragging/settling pages are not actionable and their
viewability callbacks cannot borrow a new scope. Embedded history retains the
same authorized collection source and COLLECTION navigation as standalone history;
it never borrows a recommendation Prediction from the adjacent grid.

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

### Earlier star, overflow and Next controls — owner decision 2026-09-12

This historical plan is superseded for Discovery feed mode by the October 22
List-picker star and direct-rating contract in UX_PRINCIPLES. Retain its evidence
boundaries; do not restore its default-save/Next controls.

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

The October 23 continuous-feed refinement prepares at most five upcoming
Discovery cards beside the active card. An adjacent preview remains inert and
accessibility-hidden; it cannot record an impression or acquire skip capability.
On activation, the card retains its original Prediction/page origin. Same-Item
restoration first probes a fresh five-Item root after every ordered reversal
receipt. A successful current-epoch missing-target probe may replace its known
reader with the original bounded three-page, 50-Item search; ambiguous requests
retain exact retry identity. Restoration may prepare up to five eligible siblings from the successful
fresh page that contains the exact restored target, after all reversal receipts.
Their original fresh-page origins remain immutable, and preparation creates no
impression, dwell, skip capability or new choice. Missing-target, stale and error
replies supply no siblings; invalidated pre-Undo deliveries remain excluded.
Ordinary rating/List acknowledgements mark future reads dirty without aborting the bounded
refill already in flight; it may admit only currently free slots. Exact retries
precede the next new latest-prefix root. Neutral skip retains the reader; neither
clears this prepared window. Undo/scope/source invalidation and rejected-command discard
remain hard boundaries. Deduplicate new refills against current, queued,
displayed and locally handled pending Item IDs while preserving server order.
`rank_items_feed_v1` atomically replaces
owned derived reader state while retaining immutable page evidence and exact
full-envelope retry receipts. Reader replacement introduces no taste Event or
Outcome, and it does not alter adaptive Taste question ordering.
