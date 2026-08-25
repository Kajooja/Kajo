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
  +--> Prediction ----> Item
         |
         +--> Context
         +--> DiscoveryMode
```

## User

A `User` is an account/human identity. A User performs actions.

User is intentionally distinct from Profile because the same User can act in a PersonalProfile and several SharedProfiles.

## Profile

A `Profile` is the unit for prediction, learned state and profile-context history.

Invariant: every Prediction belongs to exactly one Profile.

### PersonalProfile

Represents one user's personal Kajo context.

### SharedProfile

Represents 2-N users together. It has its own learned state and may develop preferences that do not equal any simple average of member PersonalProfiles.

Invariant: an Event in SharedProfile context still retains the acting `actorUserId`.

## Item

`Item` is domain-agnostic.

Common fields will eventually include ID, ItemType, title, description, tags/features/embedding and optional availability/context metadata.

Domain-specific metadata may extend Item:

- BOOK: author, pages, publication data.
- MOVIE: runtime, director, cast.
- EVENT later: location, start/end time, price.

Prediction code should consume generic features/contracts rather than be coupled to external provider schemas.

## Event

An Event records something meaningful that happened. At minimum event semantics should be capable of retaining:

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

- `LongTermState`: slowly changing identity/taste tendencies.
- `ShortTermState`: recent/current tendencies.
- optional session-level state later.

It must remain capable of cross-domain learning.

## Prediction

A Prediction is defined conceptually by:

```text
Profile + HumanState + Context + Item + DiscoveryMode -> predicted outcomes / score / confidence
```

## Scenario

A Scenario is historical evidence combining state, context, candidate/pattern, prediction and observed outcome.

ScenarioMemory later retrieves similar scenarios across personal/shared/population history.

## Consumed experience / memory

Consumed Items form history. The MVP stores consumed state and simple rating. The model must leave extension points for future note, memory text, images, date, location and people.

## Important separation

An action made in a SharedProfile does not automatically carry identical evidence weight into a member's PersonalProfile. Kajo needs both actor identity and profile context to learn this distinction.
