# Kajo Canonical Glossary

This file is authoritative for domain terminology. Code must use these names unless an ADR intentionally changes them.

| Product concept | Canonical code term | Meaning |
|---|---|---|
| Kajo | `Kajo` | The product/system. |
| User | `User` | Human account/identity that can act in Kajo. A Taste visitor may begin anonymously and later become/link to a permanent User. |
| Auth identity | `AuthIdentity` | Authentication-provider identity linked to one canonical User. Google/Apple/email providers must not create parallel Kajo Users/PersonalProfiles for the same linked account. |
| Anonymous identity | `AnonymousIdentity` | Server-backed temporary Kajo identity used before permanent sign-in during Taste-first acquisition. It has bounded retention and can be upgraded/linked without losing the same logical PersonalProfile/taste state. |
| Nickname / nimimerkki | `nickname` | Unique user-visible identity linked to the User. Display casing is preserved; uniqueness/sign-in/search are case-insensitive. MVP length 2–24. |
| Profile | `Profile` | Prediction, memory, Lists and messaging context. Personal or Shared. |
| Personal profile / oma Kajo | `PersonalProfile` | Profile representing one person's personal Kajo context. Anonymous Taste state must upgrade into the same logical PersonalProfile rather than creating a second profile at sign-in. |
| Shared profile / yhteinen Kajo | `SharedProfile` | Persistent 2-N accepted-member Profile with its own learned joint state/history/theme/Lists/chat. MVP name length 2–32. It is created explicitly; Friendship alone is not membership. |
| Profile member | `ProfileMember` | Accepted membership relation between User and Profile. Pending invitation is not membership. |
| Friend invite | `FriendInvite` | Opaque, server-owned, expiring/revocable invitation from one User to another prospective User. Opening it may start Taste Test; acceptance after identity conversion can create Friendship. It is not SharedProfile membership. |
| Friendship | `Friendship` | Reciprocal active social relationship between two permanent Users. It grants no access to private PersonalProfile evidence and does not automatically create a SharedProfile. |
| Taste session | `TasteSession` | Versioned acquisition/cold-start session in which a visitor answers real-Item taste questions, builds initial PersonalProfile taste and may complete a holdout prediction challenge before registration. |
| Taste response | `TasteResponse` | Canonical known/unknown/rating/not-interest answer captured in a TasteSession. Only responses with defined recommendation semantics may become bootstrap/taste evidence. |
| Taste challenge | `TasteChallenge` | Held-out known-Item prediction test where the prediction/state/model are frozen before the user's actual answer is accepted. Used for honest cold-start evaluation and value demonstration. |
| Acquisition attribution | `AcquisitionAttribution` | Bounded source/campaign/referral metadata connecting an external entry to a Taste/auth funnel. It is growth telemetry, not Item-preference evidence. |
| Item | `Item` | Any recommendable thing or experience regardless of domain. |
| Item type | `ItemType` | Domain classification such as BOOK or MOVIE; must not redefine the core Item model. |
| Item source | `ItemSource` | Server-owned provenance linking one canonical Item to one provider record. |
| External item ID | `ItemExternalId` | Namespaced stable provider/domain identifier used for safe matching/history import. |
| Discoverable | `discoverable` | Item lifecycle flag controlling eligibility for normal candidate generation while preserving historical references. |
| Event | `Event` | Recorded behavior/exposure/outcome involving an actor, Profile context and usually an Item. Growth-only telemetry is separately classified and must not silently become preference evidence. |
| Context | `Context` | Situation surrounding a prediction or event. |
| Human state | `HumanState` | Current learned representation of a person/Profile used by Prediction. |
| Working state / työmuisti | `WorkingState` | Active-session representation of ordered recent actions and immediate intent; temporary, not durable taste. |
| Long-term state / kaukomuisti | `LongTermState` | Slowly changing learned state based on longer history. |
| Short-term state / lähimuisti | `ShortTermState` | Recent/current learned state with stronger recency sensitivity. |
| Memory state snapshot | `MemoryStateSnapshot` | Versioned point-in-time Working/Short/Long summary captured with a Prediction. |
| Memory | `Memory` | Historical evidence available to the system; not immutable truth. |
| Scenario | `Scenario` | Historical state + context + candidate/pattern + prediction + observed outcome. |
| Scenario memory | `ScenarioMemory` | Retrieval layer for similar historical Scenarios. |
| Population memory | `PopulationMemory` | Privacy-gated aggregate/collaborative evidence across Profiles. Post-MVP and never raw cross-user exposure. |
| Cold-start prior / lähtöpriori | `ColdStartPrior` | Versioned non-personal Item prior used while Profile evidence is sparse. It fades behind Taste/import/native evidence. |
| Prediction | `Prediction` | Estimated outcome/suitability for Profile + Item + Context. |
| Prediction ID | `predictionId` | Identifier connecting recommendations/impressions to later outcomes. |
| Prediction run | `PredictionRun` | One versioned hosted prediction request including actor, Profile, Context, state and model/policy versions. |
| Prediction candidate | `PredictionCandidate` | One Item considered in a PredictionRun with rank/score/confidence/delivery/explanation data. |
| Outcome | `Outcome` | Strongest currently observed result attributed to one predicted Item/Scenario. |
| Reward | `Reward` | Versioned bounded numeric evaluation derived from Outcome; not the raw Event. |
| Predictor genome | `PredictorGenome` | Immutable configuration/artifact references for one EvolutionEngine challenger or champion. |
| Evolution engine | `EvolutionEngine` | Controlled offline-to-online process that evaluates predictors and promotes only through explicit gates. |
| Sleep layer / unikerros | `SleepLayer` | Background evaluation/consolidation layer using frozen/reconstructable prediction-time evidence and matured Outcomes. |
| Champion | `Champion` | PredictorGenome selected to serve a defined scope. |
| Challenger | `Challenger` | Non-serving PredictorGenome evaluated against comparable evidence. |
| Shadow prediction | `ShadowPrediction` | Frozen Challenger ranking for the same as-of Context/state/candidate pool; never changes delivery. |
| Policy assignment | `PolicyAssignment` | Versioned Champion selection for global/cohort/Profile scope with fallback and rollback target. |
| Evaluation window | `EvaluationWindow` | Immutable cutoff/outcome-maturity interval for leakage-safe evaluation. |
| Discovery mode | `DiscoveryMode` | Recommendation exploration policy: FOR_YOU, SURPRISE or RISK. |
| Ambient phase | `AmbientPhase` | Visual phase DAWN, EVENING or NIGHT; separate from DiscoveryMode. |
| For you | `FOR_YOU` | High expected fit / relatively high confidence discovery policy. |
| Surprise | `SURPRISE` | Higher novelty with meaningful expected fit. |
| Risk | `RISK` | Higher uncertainty/variance and bolder exploration. |
| Dawn | `DAWN` | Ambient visual phase mapped to FOR_YOU. |
| Evening | `EVENING` | Ambient visual phase mapped to SURPRISE. |
| Night | `NIGHT` | Ambient visual phase mapped to RISK. |
| Consumed | `CONSUMED` | Generic state meaning experience was actually consumed/read/watched/attended as appropriate. |
| Saved | `SAVED` | Profile-level current state meaning an Item is intentionally stored. Pending Shared Endorsement is not Shared Saved. |
| Rating | `rating` | Integer 0–10 outcome; recording it means the Item was consumed. |
| Not interested | `NOT_INTERESTED` | Explicit current irrelevance for an Item the actor has not consumed. |
| Endorsement / yhteinen tykkäys | `Endorsement` | Actor-specific positive SharedProfile decision that an Item is worth doing together. |
| Pending endorsement | `PendingEndorsement` | Shared Item with at least one active Endorsement but without unanimous accepted-member consensus. |
| Shared list proposal / yhteislistan ehdotus | `SharedListProposal` | Pending `(profileId,itemId)` choice binding the first Endorsement to one target custom List until unanimity. |
| Shared consensus | `SharedConsensus` | State reached when every currently accepted SharedProfile member endorsed the Item; promotes once to Shared Saved/system list. |
| List / lista | `ItemList` | Profile-scoped collection of generic Items; may contain mixed ItemTypes. |
| System saved list / Tallennetut | `SYSTEM_SAVED` | Exactly one Profile-owned system List representing Saved Items. |
| Custom list | `CUSTOM` | User-named ItemList. Personal additions commit immediately; Shared discovery additions follow consensus. |
| List membership | `ItemListEntry` | Relation placing one Item in one ItemList with truthful actor/time provenance and no copied rating/consumed state. |
| Inbox / postilaatikko | `Inbox` | User-facing delivery surface for pending Profile invitations and message activity. |
| Profile message / viesti | `ProfileMessage` | Message scoped to one Profile, retaining real sending actor; message text is not prediction evidence by default. |

## Critical relationship rules

```text
AnonymousIdentity ──upgrade/link──> User ──owns──> PersonalProfile
User A + User B ──Friendship──> lightweight social graph
Friendship ──explicit consent flow──> SharedProfile membership
```

- `FriendInvite` is not `Friendship`.
- `Friendship` is not `SharedProfile`.
- `ProfileMember` is not `Friendship`.
- `TasteSession` is not a separate media-specific Profile.
- `AcquisitionAttribution` is not taste evidence.

## Forbidden synonym drift

Do not introduce alternative core terms such as `GroupTaste`, `JointProfile`, `FriendProfile`, `RecommendationUser`, `MediaUser`, `BookTasteProfile`, `MovieTasteProfile`, `ReferralProfile` or `TasteUser` for concepts already defined above.

Do not create media-specific List, endorsement, catalog, chat or Taste types such as `BookList`, `MovieList`, `MovieVote`, `MovieTasteTest`, `TmdbMovieItem` or `OpenLibraryBookItem`.

`ITEM_SUGGESTED` is historical/deprecated Event vocabulary from the removed Sprint 009 experiment. Do not use `Suggestion` as the canonical Shared Endorsement term.

Domain-specific metadata may use domain-specific names. Core identity, social, prediction and Taste concepts remain generic.
