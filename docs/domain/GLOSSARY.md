# Kajo Canonical Glossary

This file is authoritative for domain terminology. Code must use these names unless an ADR intentionally changes them.

| Product concept | Canonical code term | Meaning |
|---|---|---|
| Kajo | `Kajo` | The product/system. |
| User | `User` | Human account/identity that can act in Kajo. |
| Nickname / nimimerkki | `nickname` | Unique user-visible login identity linked to the User's unique authentication email. Display casing is preserved; uniqueness, sign-in and search are case-insensitive. |
| Profile | `Profile` | Prediction and memory context. A profile is Personal or Shared. |
| Personal profile / oma Kajo | `PersonalProfile` | A Profile representing one user's personal Kajo context. |
| Shared profile / yhteinen Kajo | `SharedProfile` | Persistent 2-N member Profile with its own learned joint state/history/theme. |
| Profile member | `ProfileMember` | Membership relation between User and Profile. |
| Item | `Item` | Any recommendable thing or experience regardless of domain. |
| Item type | `ItemType` | Domain classification such as BOOK or MOVIE; must not redefine the core Item model. |
| Event | `Event` | Recorded behaviour/exposure/outcome involving an actor, Profile context and usually an Item. |
| Context | `Context` | Situation surrounding a prediction or event. |
| Human state | `HumanState` | Current learned representation of a person/Profile used by prediction. |
| Long-term state / kaukomuisti | `LongTermState` | Slowly changing learned state based on longer history. |
| Short-term state / lähimuisti | `ShortTermState` | Recent/current learned state with stronger recency sensitivity. |
| Memory | `Memory` | Historical evidence available to the system; not immutable truth. |
| Scenario | `Scenario` | Historical state + context + candidate/pattern + prediction + observed outcome. |
| Scenario memory | `ScenarioMemory` | Retrieval layer for similar historical Scenarios. |
| Prediction | `Prediction` | Estimated outcome/suitability for Profile + Item + Context. |
| Prediction ID | `predictionId` | Identifier connecting recommendations/impressions to later outcomes. |
| Discovery mode | `DiscoveryMode` | Recommendation exploration policy: FOR_YOU, SURPRISE or RISK. |
| Ambient phase | `AmbientPhase` | Visual phase: DAWN, EVENING or NIGHT. Separate from DiscoveryMode. |
| For you | `FOR_YOU` | High expected fit / relatively high confidence discovery policy. |
| Surprise | `SURPRISE` | Higher novelty with meaningful expected fit. |
| Risk | `RISK` | Higher uncertainty/variance and bolder exploration. |
| Dawn | `DAWN` | Ambient visual phase mapped to FOR_YOU. |
| Evening | `EVENING` | Ambient visual phase mapped to SURPRISE. |
| Night | `NIGHT` | Ambient visual phase mapped to RISK. |
| Consumed | `CONSUMED` | Generic state meaning the experience was actually consumed/attended/read/watched as appropriate. |
| Saved | `SAVED` | Item intentionally stored for later consideration. |
| Rating | `rating` | Integer 0–10 outcome for an Item; recording it always means the Item was consumed. |
| Not interested | `NOT_INTERESTED` | Explicit current irrelevance for an Item the actor has not consumed. |
| List | `ItemList` | Profile-scoped presentation of saved or consumed Items; named custom lists remain a later extension. |

## Forbidden synonym drift

Do not introduce alternative core terms such as `GroupTaste`, `JointProfile`, `FriendProfile`, `RecommendationUser`, `MediaUser`, `BookTasteProfile` or `MovieTasteProfile` for concepts already defined above.

Domain-specific metadata can use domain-specific names. Core prediction identity must remain generic.
