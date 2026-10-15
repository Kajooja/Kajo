# Kajo Domain Model

This file defines canonical domain relationships and invariants. Detailed launch UX is in [LAUNCH_LOOP](../product/LAUNCH_LOOP.md); prediction math/evaluation remains in [PREDICTION_MODEL](PREDICTION_MODEL.md). Planned acquisition entities are not claims of implemented tables. #232A's round evidence and #229's exact-set multi-List implementation are included in the owner-authorized #329 source integration. The coordinated Shared user/learning flow, hosted rollout and device acceptance retain their separate gates in STATUS.

## Core model

```text
AnonymousIdentity ── upgrade/link ──> User ── owns ──> PersonalProfile
       |                           |                    |
       |                           |                    +--> Memory
       |                           |                    +--> PredictionRun
       |                           |                    +--> ItemList
       |                           |
       +--> TasteSession           +--> Friendship <--> User
               |                   |
               +--> TasteResponse  +--> FriendInvite
               +--> TasteChallenge |
                                   +--> ProfileMember --> SharedProfile
                                                         |
                                                         +--> Memory
                                                         +--> PredictionRun
                                                         +--> ItemList
                                                         +--> Endorsement
                                                         +--> ProfileMessage

Item <----- ItemSource / ItemExternalId
 ^
 |
PredictionCandidate

Event records actor + Profile + Item/context where recommendation semantics apply.
Acquisition/funnel telemetry is separately classified and cannot silently become taste evidence.
```

## Independent engine boundary

The engine is a reusable computation domain; [ADR-0008](../architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md) and [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md) own its contracts.

| Kajo concept | Engine role | Invariant |
|---|---|---|
| Profile | Subject | Personal and Shared remain distinct prediction targets. |
| acting User | acting identity | Authorization and the actor are never inferred from Subject identity. |
| Item | Object | Provider/media schemas stay in adapters. |
| Event, eligible outcome | Observation, Outcome | Native, imported, external and synthetic provenance remain explicit. |
| authorized current state/context | State and trusted constraints | Only time-valid, authorized inputs cross the adapter. |

An external research subject has a dataset/release namespace and is never instantiated as a Kajo User, AnonymousIdentity or Profile. ExternalTastePrior is a versioned artifact, not native PopulationMemory or an Event history. The core receives already-authorized inputs; public APIs and access checks remain the Kajo adapter/runtime responsibility. No package or serving replacement is delivered by these target relationships.

## Identity

### User

A `User` is the canonical human/account identity. A User may authenticate through one or more `AuthIdentity` providers. Permanent provider linking must not create duplicate Kajo Users or duplicate PersonalProfiles.

### AnonymousIdentity

An `AnonymousIdentity` is a server-backed temporary identity used for Taste-first acquisition before permanent authentication.

Invariants:

- it has bounded retention/deletion,
- it may own/resume one logical Taste/PersonalProfile context,
- permanent auth upgrades/links it instead of copying Taste data into a new person,
- it cannot be used to merge two unrelated existing permanent Users,
- auth failure/abandonment must not silently destroy accepted Taste progress inside retention limits.

## Profile

A `Profile` is the unit for prediction, learned state and Profile-context history.

Invariant: every hosted Prediction belongs to exactly one Profile.

### PersonalProfile

Represents one person's personal Kajo context.

For Taste-first acquisition, an anonymous visitor may begin building the same logical PersonalProfile/taste state before permanent sign-in. Account conversion must preserve this continuity.

### SharedProfile

Represents 2-N accepted Users together. It has its own learned state and may develop preferences that do not equal a simple average of members.

Invariants:

- an Event in Shared context retains actual `actorUserId`,
- `ProfileMember` represents accepted membership only,
- pending invitations are not membership,
- Prediction target remains SharedProfile even when aggregate member Personal evidence contributes to common-fit,
- Personal evidence is not copied into Shared history merely to compute fit,
- SharedProfile is created explicitly and never as an automatic side effect of becoming Friends.

## Taste-first acquisition model

### TasteSession

A `TasteSession` is a versioned cold-start/acquisition session with explicit
safety budgets and pause/resume, not a fixed answer-count certificate.

Conceptual fields:

```text
tasteSessionId
anonymousIdentityId / userId
personalProfileId
source / campaign / friendInviteId?
questionPolicyVersion
model/feature versions
startedAt
completedAt?
status
```

A TasteSession is not a second Profile and not a media-specific taste silo.
Ending Taste with insufficient support retains the same PersonalProfile and its
source evidence for continued Discovery learning. Readiness is revisable state,
not a permanent completion/identity attribute.

The October 14 [sequential target](PREDICTION_MODEL.md#sequential-adaptive-taste)
retains a committed response-prefix revision, one pending question/forecast
commitment, immutable first-answer measurement and a source-provenanced future
projection. Delayed ordinal evaluation retains its earlier same-prefix pool;
pending labels do not prevent that answer from informing later questions.
Per-domain readiness reports support, forecast coverage, informative feature
dispersion, prospective evaluation and stability. Readiness is provisional;
unmet criteria at pause/exhaustion/budget mean insufficient evidence. Authorized
server operations must own prefix consumption, exact retries, conflicts and
erasure; #336's pure reference is not a new SQL/mobile protocol. Existing v1
sessions and completed state are preserved without reset or forecast rewrites.

### Own-Personal TasteSession source

The retained `personal-taste-session-v1` source implements one bounded session per existing
owned PersonalProfile. `public.taste_session_v1(request)` is an invoker wrapper
over a privately owned authorization/transaction boundary. Private session and
command tables have RLS, with no direct `anon`/`authenticated`/`service_role` access.
Every operation rechecks the canonical owner; Shared, foreign and anonymous
identities are rejected. This is not the anonymous launch entry. The #330 mobile consumer uses these RPCs for owned authenticated sessions; hosted/device acceptance is separate.

| Operation | Required JSON fields besides `operation` | Behavior |
|---|---|---|
| `START` | `profileId`, `requestId` | Create/freeze once or resume the one existing session; never reset accepted setup. |
| `RESUME` | `profileId`, `sessionId` | Return current authorized state without advancing. |
| `ANSWER` | `profileId`, `sessionId`, `requestId`, `expectedRevision`, `questionIndex`, `answer` | Append a bounded response revision to a server-issued question; persist the next opportunity atomically. |
| `ACK_TRANSITION` | `profileId`, `sessionId`, `requestId`, `expectedRevision` | Acknowledge the currently offered movie → book transition. |
| `REMOVE` | `profileId`, `sessionId`, `requestId`, `expectedRevision` | Withdraw this session's bootstrap source, tombstone the session and clear retained answer/command copies. |

IDs are UUIDs. Unknown/missing fields and malformed values are rejected; requests
are bounded to 4 KiB. `answer` is `{kind:"RATING",value:0..10}` with an integer
value, or `{kind:"UNKNOWN"}`, `{kind:"NOT_INTERESTED"}`, `{kind:"WITHDRAWN"}`.
Each question accepts at most eight revisions. Server receipt time, not a client
clock, orders them. The creation START and accepted ANSWER/ACK commands reserve their request IDs
within the session: an identical ID/body replays the frozen result and a different
body fails. Further START IDs act as unrecorded resume requests, so retries cannot
allocate unbounded creation receipts. A stale session revision fails with
SQLSTATE `40001`. A client must resume before constructing a new command; retries
retain the original command. Profile/session row locks serialize concurrent work;
transaction conflicts/deadlocks roll back completely and require bounded retry.

The server freezes at most 128 real Items per domain plus a frequency-ranked,
lexically tied 64-tag dictionary (`taste-tags-frequency-64-v1`). Catalog title,
provider identities, recognition proxy and binary features come from canonical
server records. These are capture-time features, not a claim of historical
provider availability. Missing recognition remains `null`/`UNAVAILABLE`, distinct
from an explicitly supplied zero; popularity alone is not recognition evidence.
The selected snapshot cannot be supplied or replaced by
a client. The policy is fixed to ADAPTIVE on public creation; private PRIOR_ONLY
is a diagnostic comparator, not a client override.

`CATALOG_UNAVAILABLE` means a retained catalog Item is no longer discoverable or
has lost real provenance. No old request result or new answer is returned/applied;
REMOVE remains available. This conservative version preserves the frozen session
for explicit recovery rather than silently changing its candidate universe.
`REMOVED` is terminal even for past request IDs and a new START. One logical
session bounds creation; a future restart policy requires separate versioning.

Import-source removal performs the same withdrawal atomically. Session/command
copies cascade on account/Profile deletion. Existing bootstrap rows follow the
canonical logical-removal/retention policy; this source does not claim complete
anonymous retention or physical erasure. Server-issued opportunities are durable
presentation receipts, not observed exposure. The native six-strong setup status remains independent of the longer server Taste policy. The #330 mobile consumer follows retained server state; legacy static calibration is used only when its first session RPC is confirmed unavailable. The separate challenge source is below; anonymous entry, hosted/device acceptance and observed usefulness remain required.

### TasteResponse

A `TasteResponse` records a canonical response to a real Item presented during Taste Test.

Supported semantics reuse Kajo concepts:

- known + 0–10 rating,
- unknown/skip,
- not-interest where appropriate.

Only responses with explicit taste semantics may enter bootstrap/Memory evidence. A link open/auth click is never a TasteResponse.

### TasteChallenge

A `TasteChallenge` evaluates Items whose answers are held out from their committed
prediction input. In the sequential target this is prospective per-question
evaluation; the current v1 source below retains its separate frozen batch.

Invariant sequence:

```text
freeze Profile/taste snapshot
→ freeze model/policy version
→ predict held-out Item
→ then accept actual answer
→ compute error/evaluation
→ only afterward allow answer to join future taste evidence
```

A challenge Item cannot improve the prediction that is being scored.
The first measurement and available evaluation precede future source projection;
delayed pair aggregation uses the unchanged earlier panel. Later corrections or
withdrawals update future state and copied-report lifecycle, without replacing
the original forecast/first measured answer. Pair evaluation requires a shared
prediction prefix, as defined by [PREDICTION_MODEL](PREDICTION_MODEL.md#sequential-adaptive-taste).

#### Own-Personal frozen challenge source

`public.taste_challenge_v1(request)` implements one evaluation-only challenge per
completed (`STOPPED`) own authenticated TasteSession. Shared, foreign and anonymous
access is denied before any retained response can be replayed. Private challenge
and command tables have RLS and no API table grants. No existing ranking function,
historical prediction or mobile calibration behavior is replaced.
The existing `taste_session_v1` response stays unchanged; the new consumer invokes
this separate RPC after `STOPPED`.

| Operation | Required JSON fields besides `operation` | Behavior |
|---|---|---|
| `START` | `profileId`, `sessionId`, `requestId` | Reserve and freeze once; further starts resume without allocating another run or resampling. |
| `RESUME` | `profileId`, `sessionId`, `challengeId` | Read the current authorized challenge without changing it. |
| `ANSWER` | `profileId`, `sessionId`, `challengeId`, `requestId`, `expectedRevision`, `itemId`, `answer` | Accept one first answer for a reserved Item; no retrospective correction of the measured answer. |
| `REMOVE` | `profileId`, `sessionId`, `challengeId`, `requestId`, `expectedRevision` | Clear the retained forecast/answer/command copies and leave a terminal tombstone. |

Requests are bounded to 4 KiB with exact fields and UUID identities. `answer` is an
integer `{kind:"RATING",value:0..10}`, `{kind:"UNKNOWN"}` or
`{kind:"NOT_INTERESTED"}`. Zero and neutral five remain actual ratings. A previously
accepted Item cannot be answered again. The creation START and accepted ANSWER
reserve their command IDs: identical ID/body replays the original response and
conflicting reuse fails. Later START IDs are unrecorded resume requests, avoiding
unbounded creation receipts. Stale revisions fail with `40001`;
resume before constructing a new command, retaining the old command for retries.

The server reserves up to three Items per domain from the frozen training catalog,
ordered by recognition then stable Item ID, **before** running the scorer. All
training presentations and every existing same-Profile Item Event/bootstrap row
(including inactive evidence) exclude that Item. The client cannot choose the
holdouts. One cross-domain `FOR_YOU` canonical PredictionRun freezes the complete
bounded pool, state and model; a reserved Item outside its deliverable pool is
explicitly unavailable. The challenge retains the Taste revision, model/base/
policy versions, genome ID, state digest and a digest of the complete run, candidate
pool, genome configuration and reserved forecasts. See the
[ordinal metric](PREDICTION_MODEL.md#frozen-personal-taste-challenge).

Items are presented in stable ID order. Scores, predicted order and partial metrics
remain hidden until all reserved answers are locked; an initial commitment alone
is visible. No new calibration, probability or observed exposure is implied.
`UNAVAILABLE / NO_UNSEEN_HOLDOUTS` records an empty eligible set without resampling.
`CATALOG_UNAVAILABLE / HOLDOUT_WITHDRAWN` blocks answers and old receipts if a
reserved Item loses discoverability or real provenance; REMOVE remains available.

Lock order is the canonical shared Prediction lifecycle gate, Profile, training
session, then challenge. Native actions use the same Profile serialization; a
post-scoring check rejects newly visible legacy Item evidence atomically. Source
Prediction erasure clears every copied forecast/answer/receipt and leaves the
challenge terminal. Taste/import removal does the same. Account/Profile deletion
cascades the new tables. Existing canonical Prediction history follows its own
retention/erasure lifecycle; logical challenge removal is not a physical-erasure
claim for that history.

The #330 mobile consumer retains only session/challenge IDs, dismissal and one
unacknowledged command in backend/actor/Profile-scoped SQLite. An exact replay is
followed by RESUME before another decision. A confirmed conflict is reloaded only
after explicit user action, without rebasing an old answer. New cold-start START
waits for the start action, preserving the import-first option; completed setup and
retained sessions are resolved through the server, independently of six-strong status.
The first missing RPC alone permits legacy fallback. Forecasts and partial metrics
are rejected by the adapter while the challenge is active; terminal withdrawal
clears the rendered state. This does not establish observed screen exposure.

`learningAdmission=EVALUATION_ONLY`: answers do not become native Events, bootstrap
rows, impressions, training outcomes or model-promotion evidence. Explicit future
projection must preserve this pre-answer freeze and source-removal lineage.
The owned mobile v1 presentation is accepted source; anonymous prerequisites,
actual device/usefulness acceptance and sequential v2 integration remain open.

### AcquisitionAttribution

Stores bounded campaign/referral/source metadata for funnel analysis. It is operational/growth state, not preference evidence.

## Friend graph

### FriendInvite

A `FriendInvite` is a personal relationship invitation created by one permanent User.

Invariants:

- opaque server-owned token,
- expiry/revocation/use limit,
- idempotent under repeated open/accept,
- rate-limited/anti-enumeration protected,
- opening may start the same Taste-first flow,
- invite acceptance does not itself grant SharedProfile membership,
- blocked/removed relationship rules cannot be bypassed by replaying an old token.

### Friendship

A `Friendship` is reciprocal active relationship state between two permanent Users.

Invariants:

- at most one active canonical relation per unordered User pair,
- pending invite is not Friendship,
- Friendship grants no read access to another User's private PersonalProfile Events, Memory, imports, messages or raw taste state,
- Friendship and ProfileMember lifecycles are independent,
- removal/block semantics are explicit.

Canonical transition:

```text
FriendInvite accepted
+ permanent identity resolved
→ Friendship ACTIVE
```

## SharedProfile creation from Friends

Friendship is a convenient source of candidate members, not group membership itself.

Two-person path:

```text
Friend A + Friend B
→ explicit "create yhteinen Kajo"
→ SharedProfile
→ membership acceptance/creation under canonical Shared rules
```

For 3+ users, selected Friends still pass through explicit Shared membership acceptance.

The planned compact creation UX uses 2–5 total people including the creator,
without replacing generic 2-N SharedProfile membership. Opaque link delivery
and Friend selection remain distinct from accepted Friendship/ProfileMember;
opening a link cannot create either relationship or grant private history access.
LAUNCH_LOOP/UX_PRINCIPLES own the planned slot/share presentation under ROADMAP 16.2.

Friend removal does not silently remove or rewrite existing SharedProfile history/membership. Any desired membership change uses SharedProfile lifecycle rules.

## Item

`Item` is the single domain-agnostic recommendable entity.

Current generic fields include stable Kajo ID, ItemType, title/description, normalized tags/creators, optional year/image/language, provider metadata and discoverability.

An attributed description carries a `DescriptionAttribution` value bound to its
exact text and source-record hashes. Missing or invalid required credit hides
only the description. Explicit canonical legacy status preserves unannotated
content; a text-only RPC or cache with missing status cannot establish that
compatibility. Permission evidence remains private ItemSource data, not a client
Item field or taste evidence. [ARCHITECTURE](../architecture/ARCHITECTURE.md#description-attribution--contract-182)
owns the review, persistence and display contract.

`discoverable=false` excludes an Item from ordinary candidate generation while preserving historical Event/List/Prediction references.

Domain metadata may extend Item but prediction consumes normalized generic features rather than provider schemas.

### ItemSource and ItemExternalId

`ItemSource` links canonical Item to provider provenance. `ItemExternalId` maps namespaced stable IDs to canonical Item.

Invariants:

- provider source key is unique,
- namespace+external ID resolves to at most one canonical Item,
- refresh is idempotent,
- ambiguous multi-Item matches fail rather than silently merge,
- raw provider payloads/secrets are server-owned,
- history imports resolve to canonical Items rather than provider-specific Profile state.

## ItemList

An `ItemList` is owned by one Profile.

MVP kinds:

- `SYSTEM_SAVED`,
- `CUSTOM`.

`ItemListEntry` stores List/Item relation plus truthful adding actor/time; it does not copy consumed/rating state.

Current invariants:

- one system Saved List per Profile,
- custom names unique within Profile under canonical normalization,
- one Item may belong to several Lists,
- Personal save and Shared unanimous consensus project into system Saved,
- Shared discovery custom List addition remains pending until consensus,
- former/outsider members lose Shared List access,
- canonical interaction state remains separate from membership rows,
- one authorized collection command commits membership/state, all transition Events and a replayable receipt,
- List undo restores exact prior entry provenance and corrects every Event of the target action; Item/List undo share one predecessor lineage.

## Shared discovery eligibility

Current delivered V1 Shared discovery order remains (the required #232 successor is specified below):

1. pending Endorsements for members who have not endorsed,
2. ordinary unseen Shared Predictions,
3. accepted-member Personal consumed/rated history as clearly attributed lower tier.

A higher member rating may reorder only the lower history tier. Shared consumed/rated and consensus-saved Items remain suppressed from ordinary Shared discovery. Lists/history are not deleted.

## Endorsement and SharedConsensus

`Endorsement` is actor-specific positive decision inside SharedProfile.

Current-state invariant:

```text
one active Endorsement per (profileId, itemId, actorUserId)
```

The first actor binds one or more custom Lists in one explicit selection. All accepted members must review and confirm exactly that set; a subset, a changed set or an older client that cannot show every destination cannot approve it. Until unanimity the Item is pending and not Shared Saved. Legacy single-List proposals remain valid.

`SharedConsensus` is reached when every currently accepted member endorses. At consensus:

- Shared Saved becomes true,
- durable consensus remains even if membership later changes,
- every selected custom List membership is committed once in the same transaction,
- Item is promoted to system Saved,
- Item leaves ordinary Shared discovery.

Pending withdrawal removes the actor’s Endorsement and cancels its outcome evidence.
Deleting any destination of a pending proposal cancels the whole proposal and records administrative cancellation with the
real deleting actor and affected endorsing actor separately. Completed consensus
and Saved survive List deletion.

## Planned bounded joint decision for today

ROADMAP 16.4 / MVP-SOCIAL-010..012 introduces a planned temporary Shared choice
context, after the existing round/rewatch evidence foundations. It uses canonical
BOOK/MOVIE Items and the same Shared predictor with at most five current options.
A frozen accepted roster, actor/scope/version identity and explicit expiry,
membership-change/retry/deletion rules precede interpretation of session actions.
Session veto or already-seen replacement does not delete history, prohibit future
rewatch, submit ordinary durable not-interest, complete a SharedRatingRound or
create confirmed consumption/reward. The proposed any-member veto threshold is
a product decision to confirm at implementation. Product documents own the UX;
this plan creates no delivered entity/table or new production evidence stream.

## SharedRatingRound — required first release, #232

Personal Taste setup comes first; an existing completed setup is retained. Joint
experience then learns in SharedProfile, without overwriting Personal history.
This contract is required by `MVP-SOCIAL-007..009`, not implemented by the
multi-List picker correction. Current Shared `SET_RATING` is still a single-actor
state transition and does not satisfy the round contract.

A round identifies one SharedProfile, generic Item, new experience ID and an
explicit snapshot of accepted participants. A submits 5: this records A’s response
and prompts B, “A antoi arvosanan 5, minkä sinä annat?” It does not mark the joint
experience complete. In a pair, B’s own 0–10 response completes the round; in an
N-member round every required participant must respond. Unknown, decline and
silence are never a zero rating or agreement. A membership change cannot silently
reduce the required set: cancel or explicitly reconfirm the participant set.

Only a completed round enters joint Katsotut/Luetut and supplies completed joint
outcome evidence. Keep individual responses and disagreement; SharedProfile is
not their simple average. The prompt discloses the rating explicitly submitted
in this Shared context, never an otherwise private Personal rating.

Editing/undoing a response corrects that round and its outcomes. Watching the same
Item again creates a new round, preserving earlier Personal and joint experiences.
Legacy Shared ratings with only one known actor remain identifiable legacy history;
never fabricate other participants’ responses or silently treat them as completed
new rounds. List Endorsement/SharedConsensus and a completed SharedRatingRound are
separate decisions, even if the UI uses “Pari!” for both.

### Phase 14.1 source foundation — #232A

The #232A source foundation, included in #329 integration, supplies an explicit
server round boundary independently of the legacy Item action path. A round
binds one SharedProfile, Item and experience ID to a frozen participant set.
Durable membership generation UUIDs distinguish leaving and rejoining from the
original enrollment; physical database row placement is not participant identity.
Membership drift requires explicit reconfirmation with fresh responses or
cancellation. A current accepted member can recover a stale round even after
all original participants have left; answering requires current membership in
the frozen set.

Ordinary membership departure preserves round history. Deleting a User removes
affected new round roots and their response/receipt lineage, including that
User's participation in an earlier reconfirmed snapshot. This prevents embedded
participant identities from surviving deletion inside other actors' receipts.
It does not alter legacy Shared data or establish a general retention policy.

Round revisions serialize commands; response revisions and command receipts
preserve each answer, unknown/clear, correction, cancellation and original
delivery claim. The projection distinguishes PENDING, COMPLETED, CANCELLED and
RECONFIRMATION_REQUIRED. Completion requires every frozen participant's actual
integer rating, including valid zero; unknown is not a rating. This foundation
returns `groupReward=null` and `learnable=false`. It does not update joint
Katsotut/Luetut, ordinary Item state or Events. The coordinated flow and versioned
joint outcome admission remain required before release; source/CI/hosted
acceptance belong to STATUS.

### Receipt-prefix outcome projection — #232B, source only

The private versioned reader reconstructs one round from its immutable command
receipts, retaining the acknowledged participant set and separate responses.
Its basis is `COMMAND_RECEIPT_PREFIX`, with `SERVER_COMMAND_ACCEPTED_AT` times.
Later corrections, cancellation and reconfirmation affect later prefixes; they
do not change an earlier prefix or merge answers across participant-set versions.
New experience IDs remain separate even for the same Item. Ordinary departure
does not erase an already acknowledged experience; User/Profile/Item deletion
removes the retained lineage rather than resurrecting it through replay.

The projection does not reconstruct historical membership between commands or
transaction commit visibility. It cannot use today's membership, current round
head or Item state to fill those gaps. `historicalFeatureEligible=false` excludes
it as proof of a past prediction-time feature snapshot. A complete, elapsed-window
response vector can be reviewed as observed outcome evidence; that is separate
from an admitted joint reward, current membership confirmation or predictor
success. DATA_EVENTS owns cutoffs and attribution; PREDICTION_MODEL owns admission.

The #232C source adds `SharedRoundOutcomeCapture`: the exact vector an internal
consumer actually observed, with its receipt identity, interpretation/cutoffs,
maturity, versions and observation time. Its replay remains fixed after a late
commit or correction; a new capture represents the new interpretation. A paired
production/shadow support artifact references the same capture and declared
evaluation window, retaining each actor's own attribution and unsupported
coordinates. Neither artifact defines a group reward or an independent sample
per member. Erasing the retained receipt lineage erases these derived artifacts.
Observation after a prediction does not establish historical feature availability.

The #232D internal owner preparation removes PredictionRun sources, their shadow
artifacts and copied comparison traces atomically, with whole affected evaluation
batches invalidated. It preserves ordinary artifact immutability and rejects
unresolved promoted-policy influence. User/Profile roots are deleted separately
in the same owner transaction after preparation, rather than by an automatic
Auth lifecycle hook. DATA_EVENTS owns scope, permission and concurrency semantics.

Member-seen Items remain eligible for a strong, truthfully explained joint fit.
Previously joint-consumed Items may reappear only through a versioned, bounded
rewatch policy. Existing history stays intact. Exact eligibility, cooldown and
frequency gates belong to PREDICTION_MODEL; neither a personal watch nor opening
a new round is itself a positive joint outcome.

### Prepared pre-first-response input — #232F, source only

`SharedRoundPredictionInputCapture` prepares one identified Shared round for a
future prediction consumer. It freezes the complete current accepted actor/
enrollment generation set, the actual command prefix and explicitly selected
earlier immutable outcome captures. Current roster and the round's acknowledged
roster must match exactly. Any prior response in this experience, including
unknown, clear or a response before participant reconfirmation, closes this
first-response boundary. An unanswered reconfirmation can prepare a new input;
it cannot relabel an answered experience as fresh.

Membership is known at input capture, not at an earlier PredictionRun's ranking
time. The use is `INPUT_CAPTURE_ONLY`, with predictor consumption unrecorded;
this creates no new PredictionRun, response, Event, reward or learned influence.
Target receipt deletion and selected source-capture deletion invalidate the
whole copied input artifact. DATA_EVENTS owns storage/replay/erasure and
PREDICTION_MODEL owns the future actual-consumer and admission gates.

## Event

An `Event` records meaningful recommendation-related evidence and at minimum may retain actor User, Profile context, Item, type, time, session, Context and predictionId.

Item/Prediction Events are the main evidence stream for learning/outcomes. Acquisition-only telemetry has its own event classification and may reference TasteSession/FriendInvite but does not become Item reward by default.

## ProfileMessage

A `ProfileMessage` is communication scoped to one Profile and retains actual sending actor. Personal messages are owner-only; Shared messages are accepted-member-only. Message text is not Prediction evidence by default.

## Prediction and memory

A `PredictionRun` targets one Profile and owns `PredictionCandidate` rows for considered Items. It captures Context, MemoryStateSnapshot and versioned model/policy information sufficient for evaluation.

Memory hierarchy:

- `WorkingState`: active session,
- `ShortTermState`: recent drift,
- `LongTermState`: durable tendencies,
- `ScenarioMemory`: similar historical episodes,
- future `PopulationMemory`: privacy-gated aggregate/collaborative layer.

Taste/import evidence initializes Personal state but must remain source-provenanced and supersedable by native behavior.

## Separation invariants

These relations must remain distinct:

```text
AuthIdentity != User
AnonymousIdentity != permanent User until linked/upgraded
TasteSession != PersonalProfile
FriendInvite != Friendship
Friendship != ProfileMember
Friendship != SharedProfile
ProfileMember != private PersonalProfile access
AcquisitionAttribution != taste evidence
SharedProfile != average(PersonalProfiles)
```

Any implementation that collapses these concepts requires an explicit ADR change.
