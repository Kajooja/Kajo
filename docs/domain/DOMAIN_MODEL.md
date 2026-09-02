# Kajo Domain Model

## Core model

```text
User
  |
  | acts as actor
  v
Event ----------------------> Item
  |
  | occurs within
  v
Profile
  |\
  | \-- PersonalProfile
  | \-- SharedProfile
  |
  +--> HumanState
  +--> Theme
  +--> Memory
  +--> ItemList
  +--> Prediction ----> Item
         |
         +--> Context
         +--> DiscoveryMode

SharedProfile
  +--> Endorsement (actor-specific, Item-specific)
         |
         +--> unanimous accepted-member consensus
                  |
                  +--> Shared Saved / SYSTEM_SAVED
```

## User

A `User` is an account/human identity. A User performs actions. MVP identity includes one unique nickname and one unique authentication email linked to the same account. Nickname display casing is preserved while uniqueness, sign-in and nickname search are case-insensitive.

User is intentionally distinct from Profile because the same User can act in a PersonalProfile and several SharedProfiles.

## Profile

A `Profile` is the unit for prediction, learned state and profile-context history.

Invariant: every Prediction belongs to exactly one Profile.

### PersonalProfile

Represents one User's personal Kajo context.

Invariant: one User owns at most one PersonalProfile. Configured onboarding completes User, PersonalProfile and ProfileMember identity before entering the personal Room.

### SharedProfile

Represents 2-N accepted Users together. It has its own learned state and may develop preferences that do not equal a simple average of member PersonalProfiles.

Invariants:

- an Event in SharedProfile context retains the actual acting `actorUserId`,
- `profile_members` represents accepted membership only,
- pending invitations are not membership,
- prediction target remains the SharedProfile even when accepted-member PersonalProfile evidence contributes to an inspectable common-fit signal,
- actor-specific collaboration delivery may change which pending endorsed Item a member sees first without creating a separate per-member recommender.

## Shared discovery eligibility

Ordinary SharedProfile discovery may retain an Item that a currently accepted member has already consumed in that member's PersonalProfile, but it must not present that Item as an unseen recommendation.

For MVP, either `consumed = true` or a non-null rating is sufficient consumed evidence.

This is a **collaboration delivery rule**, not Event copying or data deletion:

- pending Endorsements are delivered first,
- ordinary unseen SharedProfile Predictions follow in their Prediction order,
- accepted-member PersonalProfile history follows as a lower tier with restrained real-member provenance,
- a higher member rating may reorder only this lower history tier,
- SharedProfile's own consumed/rated state and consensus-saved state remain suppressed from ordinary discovery,
- the Item may remain in a named List,
- the Item may remain in Saved/history,
- the UI may continue to show watched/read/rating state on those historical/organizational surfaces.

A PersonalProfile save alone does not make the Item ineligible for Shared discovery.

## Endorsement and SharedConsensus

An `Endorsement` is an actor-specific positive decision made while acting inside a SharedProfile: this Item is worth doing together.

A single Endorsement is intentionally not the same thing as Shared `saved=true`.

Current-state invariant:

```text
one active Endorsement per (profileId, itemId, actorUserId)
```

Pending behavior:

- after User A endorses Item X, X leaves A's ordinary Shared discovery queue,
- accepted members who have not endorsed X may receive X ahead of ordinary recommendations,
- delivery provenance identifies the real endorser,
- this actor-specific priority is collaboration state layered onto the SharedProfile Prediction, not a separate taste model.

`SharedConsensus` is reached when every currently accepted member has an active Endorsement for the Item.

At consensus:

- SharedProfile Saved/current-state projection becomes true,
- a durable `(profileId, itemId)` SharedConsensus record preserves the reached decision even if membership later changes,
- the Item is promoted once to the Shared `SYSTEM_SAVED` / `Tallennetut` List,
- the Item leaves ordinary Shared discovery,
- the reached consensus becomes durable shared history; a later new member does not retroactively revoke it.

Custom Shared Lists are not consensus-vote mechanisms. Accepted members may explicitly curate custom Lists according to List authorization rules and real `addedByUserId` provenance.

## Item

`Item` is domain-agnostic.

Common fields will eventually include ID, ItemType, title, description, tags/features/embedding and optional availability/context metadata.

Domain-specific metadata may extend Item:

- BOOK: author, pages, publication data.
- MOVIE: runtime, director, cast.
- EVENT later: location, start/end time, price.

Prediction code should consume generic features/contracts rather than external provider schemas.

## ItemList

An `ItemList` is owned by exactly one Profile.

MVP List kinds:

- `SYSTEM_SAVED` — exactly one system `Tallennetut` List per Profile,
- `CUSTOM` — user-named collaborative/personal Lists.

`ItemListEntry` stores List/Item relation plus adding actor/time. It does not copy consumed/rating state.

Current invariants:

- one `SYSTEM_SAVED` List exists per Profile and cannot be renamed/deleted,
- a custom name is 1–40 characters and case-insensitively unique inside its Profile,
- one Item may belong once to each of several Lists,
- Personal Saved state and Shared unanimous consensus project into `SYSTEM_SAVED`,
- custom List membership never changes canonical Saved state,
- direct Shared writes to `SYSTEM_SAVED` are denied; consensus owns that transition,
- direct Shared interaction writes cannot forge, clear or delete Saved state unless it matches the durable SharedConsensus record,
- accepted Shared members may collaborate on custom Lists, and former/outsider members have no read/write access,
- `addedByUserId` may remain nullable only for safely backfilled historical rows where no truthful actor exists,
- current consumed/rating state is joined from `item_interactions`, not copied into List entries.

## Event

An Event records something meaningful that happened. At minimum it can retain:

- actor User,
- Profile context,
- Item when relevant,
- event type,
- timestamp,
- Context,
- session identity when relevant,
- predictionId when the event resulted from a Kajo prediction.

Events are the main evidence stream for learning and outcome evaluation.

## HumanState

HumanState is a learned representation used by Prediction.

Conceptually it contains:

- `LongTermState`: slowly changing identity/taste tendencies,
- `ShortTermState`: recent/current tendencies,
- optional session-level state later.

It must remain capable of cross-domain learning.

## Prediction

A Prediction is defined conceptually by:

```text
Profile + HumanState + Context + Item + DiscoveryMode -> predicted outcomes / score / confidence
```

For SharedProfile, accepted-member PersonalProfile evidence may contribute to a common-fit component while the Prediction still belongs to the SharedProfile.

## Scenario

A Scenario is historical evidence combining state, context, candidate/pattern, prediction and observed outcome.

ScenarioMemory later retrieves similar scenarios across personal/shared/population history.

## Consumed experience / memory

Consumed Items form history. The MVP stores consumed state and simple rating. The model leaves extension points for future note, memory text, images, date, location and people.

## Important separations

- An action made in a SharedProfile does not automatically carry identical evidence weight into a member's PersonalProfile.
- A PersonalProfile consumed outcome may lower and annotate the same Item in Shared discovery without copying the Personal action into Shared state.
- Pending Endorsement is not Shared Saved state.
- Custom Shared List membership is not unanimous consensus.
- Actor-specific pending delivery is not a separate per-User Prediction model.
