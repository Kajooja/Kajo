# Kajo Canonical Glossary

This file is authoritative for domain terminology. Code must use these names unless an ADR intentionally changes them.

| Product concept | Canonical code term | Meaning |
|---|---|---|
| Kajo | `Kajo` | The product/system. |
| User | `User` | Human account/identity that can act in Kajo. |
| Nickname / nimimerkki | `nickname` | Unique user-visible login identity linked to the User's unique authentication email. Display casing is preserved; uniqueness, sign-in and search are case-insensitive. MVP target length is 2–24 characters. |
| Profile | `Profile` | Prediction, memory, Lists and messaging context. A profile is Personal or Shared. |
| Personal profile / oma Kajo | `PersonalProfile` | A Profile representing one user's personal Kajo context. |
| Shared profile / yhteinen Kajo | `SharedProfile` | Persistent 2-N accepted-member Profile with its own learned joint state/history/theme, Lists and later member chat. MVP target name length is 2–32 characters. |
| Profile member | `ProfileMember` | Accepted membership relation between User and Profile. Pending invitation is not membership. |
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
| Saved | `SAVED` | Item intentionally stored for later consideration. Named List membership may organize saved Items but must not redefine the canonical interaction signal. |
| Rating | `rating` | Integer 0–10 outcome for an Item; recording it always means the Item was consumed. |
| Not interested | `NOT_INTERESTED` | Explicit current irrelevance for an Item the actor has not consumed. |
| List / lista | `ItemList` | Named Profile-scoped collection of generic Items. A List may contain mixed ItemTypes and is independent from the Item's consumed/rating state. MVP list name length is 1–40 characters. |
| List membership | `ItemListEntry` | Relation placing one Item in one ItemList. Stores the adding actor and added time for traceability; does not copy rating/consumed state. |
| Inbox / postilaatikko | `Inbox` | User-facing delivery surface for pending Profile invitations and later message activity. Inbox/unread state is not generic Item interaction state. |
| Profile message / viesti | `ProfileMessage` | Message scoped to one Profile. PersonalProfile messages are owner-only; SharedProfile messages are accepted-member-only and retain the sending actor User. May optionally reference an ItemList and Item. |

## Forbidden synonym drift

Do not introduce alternative core terms such as `GroupTaste`, `JointProfile`, `FriendProfile`, `RecommendationUser`, `MediaUser`, `BookTasteProfile` or `MovieTasteProfile` for concepts already defined above.

Do not create media-specific List or chat types such as `BookList`, `MovieList` or `SharedMovieChat`. ItemType remains metadata inside the generic models.

Domain-specific metadata can use domain-specific names. Core prediction identity must remain generic.
