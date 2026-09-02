# Kajo Canonical Glossary

This file is authoritative for domain terminology. Code must use these names unless an ADR intentionally changes them.

| Product concept | Canonical code term | Meaning |
|---|---|---|
| Kajo | `Kajo` | The product/system. |
| User | `User` | Human account/identity that can act in Kajo. |
| Nickname / nimimerkki | `nickname` | Unique user-visible login identity linked to the User's authentication email. Display casing is preserved; uniqueness, sign-in and search are case-insensitive. MVP length 2–24. |
| Profile | `Profile` | Prediction, memory, Lists and messaging context. Personal or Shared. |
| Personal profile / oma Kajo | `PersonalProfile` | Profile representing one User's personal Kajo context. |
| Shared profile / yhteinen Kajo | `SharedProfile` | Persistent 2-N accepted-member Profile with its own learned joint state/history/theme, Lists and later member chat. MVP name length 2–32. |
| Profile member | `ProfileMember` | Accepted membership relation between User and Profile. Pending invitation is not membership. |
| Item | `Item` | Any recommendable thing or experience regardless of domain. |
| Item type | `ItemType` | Domain classification such as BOOK or MOVIE; must not redefine the core Item model. |
| Event | `Event` | Recorded behaviour/exposure/outcome involving an actor, Profile context and usually an Item. |
| Context | `Context` | Situation surrounding a prediction or event. |
| Human state | `HumanState` | Current learned representation of a person/Profile used by Prediction. |
| Long-term state / kaukomuisti | `LongTermState` | Slowly changing learned state based on longer history. |
| Short-term state / lähimuisti | `ShortTermState` | Recent/current learned state with stronger recency sensitivity. |
| Memory | `Memory` | Historical evidence available to the system; not immutable truth. |
| Scenario | `Scenario` | Historical state + context + candidate/pattern + prediction + observed outcome. |
| Scenario memory | `ScenarioMemory` | Retrieval layer for similar historical Scenarios. |
| Prediction | `Prediction` | Estimated outcome/suitability for Profile + Item + Context. |
| Prediction ID | `predictionId` | Identifier connecting recommendations/impressions to later outcomes. |
| Discovery mode | `DiscoveryMode` | Recommendation exploration policy: FOR_YOU, SURPRISE or RISK. |
| Ambient phase | `AmbientPhase` | Visual phase DAWN, EVENING or NIGHT. Separate from DiscoveryMode. |
| For you | `FOR_YOU` | High expected fit / relatively high confidence discovery policy. |
| Surprise | `SURPRISE` | Higher novelty with meaningful expected fit. |
| Risk | `RISK` | Higher uncertainty/variance and bolder exploration. |
| Dawn | `DAWN` | Ambient visual phase mapped to FOR_YOU. |
| Evening | `EVENING` | Ambient visual phase mapped to SURPRISE. |
| Night | `NIGHT` | Ambient visual phase mapped to RISK. |
| Consumed | `CONSUMED` | Generic state meaning the experience was actually consumed/read/watched/attended as appropriate. |
| Saved | `SAVED` | Profile-level current state meaning an Item is intentionally stored. In SharedProfile, one member's pending Endorsement is **not** Saved; automatic Shared Saved state begins only when #151 consensus is reached. |
| Rating | `rating` | Integer 0–10 outcome; recording it always means the Item was consumed. |
| Not interested | `NOT_INTERESTED` | Explicit current irrelevance for an Item the actor has not consumed. |
| Endorsement / yhteinen tykkäys | `Endorsement` | Actor-specific positive SharedProfile decision that an Item is worth doing together. In discovery the first actor makes it by choosing one target custom List; later members approve that same pending choice instead of choosing another List. There is no separate Like button. Pending Endorsement is separate from Shared saved/List state; unanimity among currently accepted members promotes the Item to the chosen custom List and system `Tallennetut`. |
| Pending endorsement | `PendingEndorsement` | Shared Item with at least one active Endorsement but without unanimous accepted-member consensus. It retains the proposing actor and target custom List, is hidden from endorsers' ordinary queue and is prioritized for non-endorsing members as an explicit approval card. |
| Shared list proposal / yhteislistan ehdotus | `SharedListProposal` | One pending `(profileId, itemId)` choice that binds the first actor's Endorsement to one target custom List. It is not `ItemListEntry` until all accepted members approve; completed proposer/List/approver provenance remains durable for retry and audit. |
| Shared consensus | `SharedConsensus` | State reached when every currently accepted SharedProfile member has endorsed the Item. Consensus promotes the Item once to Shared Saved/system `Tallennetut`; later new members do not retroactively revoke it. |
| List / lista | `ItemList` | Profile-scoped collection of generic Items. A List may contain mixed ItemTypes and is independent from consumed/rating state. MVP custom List name length 1–40. |
| System saved list / Tallennetut | `SYSTEM_SAVED` | Exactly one Profile-owned system ItemList representing Saved Items. Personal saving may add directly; Shared automatic promotion comes from SharedConsensus. |
| Custom list | `CUSTOM` | User-named ItemList. Personal additions commit immediately. A Shared discovery addition is pending until all accepted members approve the same Item/List choice; the final membership remains collaborative organizational state. |
| List membership | `ItemListEntry` | Relation placing one Item in one ItemList. One picker action targets exactly one List and preserves other existing memberships. Personal membership commits immediately; Shared discovery membership commits only at unanimous approval. It stores the original proposing actor and proposal time for traceability and does not copy rating/consumed state. |
| Inbox / postilaatikko | `Inbox` | User-facing delivery surface for pending Profile invitations and later message activity. Inbox/unread state is not generic Item interaction state. |
| Profile message / viesti | `ProfileMessage` | Message scoped to one Profile. PersonalProfile messages are owner-only; SharedProfile messages are accepted-member-only and retain sending actor. May reference ItemList and Item. |

## Forbidden synonym drift

Do not introduce alternative core terms such as `GroupTaste`, `JointProfile`, `FriendProfile`, `RecommendationUser`, `MediaUser`, `BookTasteProfile` or `MovieTasteProfile` for concepts already defined above.

Do not create media-specific List, endorsement or chat types such as `BookList`, `MovieList`, `MovieVote` or `SharedMovieChat`. ItemType remains metadata inside generic models.

`ITEM_SUGGESTED` is historical/deprecated Event vocabulary from the removed Sprint 009 experiment. Do not use `Suggestion` as the new canonical name for Shared Endorsement.

Domain-specific metadata can use domain-specific names. Core prediction identity must remain generic.
