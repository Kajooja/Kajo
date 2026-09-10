# Kajo Domain Model

This file defines canonical domain relationships and invariants. Detailed launch UX is in `product/LAUNCH_LOOP.md`; prediction math/evaluation remains in `PREDICTION_MODEL.md`.

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

A `TasteSession` is a bounded/versioned cold-start/acquisition session.

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

### TasteResponse

A `TasteResponse` records a canonical response to a real Item presented during Taste Test.

Supported semantics reuse Kajo concepts:

- known + 0–10 rating,
- unknown/skip,
- not-interest where appropriate.

Only responses with explicit taste semantics may enter bootstrap/Memory evidence. A link open/auth click is never a TasteResponse.

### TasteChallenge

A `TasteChallenge` evaluates held-out known Items.

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

Friend removal does not silently remove or rewrite existing SharedProfile history/membership. Any desired membership change uses SharedProfile lifecycle rules.

## Item

`Item` is the single domain-agnostic recommendable entity.

Current generic fields include stable Kajo ID, ItemType, title/description, normalized tags/creators, optional year/image/language, provider metadata and discoverability.

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

Ordinary Shared discovery order remains:

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

The first actor may bind a target custom List. Until unanimity the Item is pending and not Shared Saved.

`SharedConsensus` is reached when every currently accepted member endorses. At consensus:

- Shared Saved becomes true,
- durable consensus remains even if membership later changes,
- selected custom List membership is committed once,
- Item is promoted to system Saved,
- Item leaves ordinary Shared discovery.

Pending withdrawal removes the actor’s Endorsement and cancels its outcome evidence.
Deleting a pending proposal’s List records administrative cancellation with the
real deleting actor and affected endorsing actor separately. Completed consensus
and Saved survive List deletion.

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
