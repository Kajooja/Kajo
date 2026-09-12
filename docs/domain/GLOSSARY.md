# Kajo Canonical Glossary

This file is authoritative for domain terminology. Code must use these names unless an ADR intentionally changes them. The reusable engine's generic vocabulary is distinguished from Kajo's application entities below; it does not create parallel account or media-specific domain models.

| Product concept | Canonical code term | Meaning |
|---|---|---|
| Kajo | `Kajo` | The product/system and first adapter of the independent Predictive Memory Engine. |
| User | `User` | Human account/identity that can act in Kajo. A Taste visitor may begin anonymously and later become/link to a permanent User. |
| Auth identity | `AuthIdentity` | Authentication-provider identity linked to one canonical User. Google/Apple/email providers must not create parallel Kajo Users/PersonalProfiles for the same linked account. |
| Anonymous identity | `AnonymousIdentity` | Server-backed temporary Kajo identity before permanent sign-in during Taste-first acquisition; bounded retention and continuity of logical PersonalProfile/taste state. |
| Nickname / nimimerkki | `nickname` | Unique user-visible User identity; display casing preserved, uniqueness/sign-in/search case-insensitive; MVP length 2–24. |
| Profile | `Profile` | Prediction, memory, Lists and messaging context; Personal or Shared. Maps to engine Subject, not acting User. |
| Personal profile / oma Kajo | `PersonalProfile` | One person's Kajo context; anonymous Taste state upgrades into the same logical context rather than a duplicate profile. |
| Shared profile / yhteinen Kajo | `SharedProfile` | Persistent 2-N accepted-member Profile with its own learned joint state/history/theme/Lists/chat; name length 2–32; created explicitly, not through Friendship alone. |
| Profile member | `ProfileMember` | Accepted User/Profile membership. Pending invitation is not membership. |
| Friend invite | `FriendInvite` | Opaque server-owned expiring/revocable invitation; may start Taste and create Friendship after consent/identity conversion; not Shared membership. |
| Friendship | `Friendship` | Reciprocal active social relationship between permanent Users; no private Personal evidence access or automatic SharedProfile. |
| Taste session | `TasteSession` | Versioned real-Item acquisition/cold-start session and optional honest holdout challenge before registration. |
| Taste response | `TasteResponse` | Canonical known/unknown/rating/not-interest answer; only defined recommendation semantics become taste evidence. |
| Taste challenge | `TasteChallenge` | Held-out known-Item test with prediction/state/model frozen before the actual answer; answer joins future learning only afterward. |
| Acquisition attribution | `AcquisitionAttribution` | Bounded campaign/referral metadata for the funnel; not Item preference evidence. |
| Item | `Item` | Any recommendable object/experience regardless of domain; maps to generic engine Object. |
| Item type | `ItemType` | Domain classification such as BOOK/MOVIE; never a separate core Item model. |
| Item source | `ItemSource` | Server-owned provenance linking a canonical Item to a provider record. |
| External item ID | `ItemExternalId` | Namespaced stable provider/domain identifier for safe matching/import. |
| Discoverable | `discoverable` | Normal candidate eligibility lifecycle flag preserving historical references. |
| Event | `Event` | Recorded behavior/exposure/outcome with actor and Profile context; acquisition-only telemetry and external research records are not native preference Events. |
| Context | `Context` | Allowlisted local situation around prediction/event; missing fields remain missing. |
| Human state | `HumanState` | Kajo-facing learned subject representation assembled from supported memory; the full CurrentState also contains current situation/environment. |
| Working state / työmuisti | `WorkingState` | Ordered active-session actions and immediate intent; temporary, not durable taste. |
| Long-term state / kaukomuisti | `LongTermState` | Slowly changing, source-aware state from durable supported history. |
| Short-term state / lähimuisti | `ShortTermState` | Recent state with stronger recency/contradiction sensitivity. |
| Memory state snapshot | `MemoryStateSnapshot` | Versioned prediction-time summary; cannot be reconstructed from later mutable state without valid as-of evidence. |
| Memory | `Memory` | Evidence-grounded representations/retrieval; interpretations are revisable, original observation records remain distinct. |
| Scenario | `Scenario` | Decision-time state/context/options/action/prediction plus observed transition, delayed outcomes and error, with missingness and provenance explicit. |
| Scenario memory | `ScenarioMemory` | Retrieval of compatible authorized historical Scenarios. |
| Population memory | `PopulationMemory` | Kajo-derived privacy-gated cross-Profile aggregate/collaborative evidence. Post-MVP until consent/cohort/deletion/exposure-bias gates; never raw cross-user exposure. |
| Cold-start prior / lähtöpriori | `ColdStartPrior` | Versioned non-personal Item prior while Profile evidence is sparse; existing provider/catalog recognition/trend prior is not a learned external taste model. |
| External taste prior | `ExternalTastePrior` | Separately licensed/versioned preference artifact from external research data; not a Kajo User, native Scenario or permission to activate PopulationMemory. |
| Prediction | `Prediction` | Estimated outcome/suitability for Profile + Item + Context; scores are not probabilities unless a supported calibrated target is defined. |
| Prediction ID | `predictionId` | Identifier connecting the precise recommendation origin to eligible later observations/outcomes. |
| Prediction run | `PredictionRun` | Immutable record of what was originally predicted, for one request/target/context and model/policy/state/artifact versions. |
| Prediction candidate | `PredictionCandidate` | Considered Item with score/rank/delivery/explanation; selected for delivery is not proof of exposure. |
| Outcome | `Outcome` | Source/target/horizon-specific observed result. Current Kajo V1 derives a strongest-outcome projection; future multiple heads remain distinct rather than mutually exclusive raw events. |
| Reward | `Reward` | Versioned bounded objective value derived from eligible Outcome; not the raw Event. |
| Predictor genome | `PredictorGenome` | Immutable configuration plus model/feature/retrieval/rights lineage references for a challenger or champion. |
| Evolution engine | `EvolutionEngine` | Controlled offline-to-online evaluation and explicit promotion process. |
| Sleep layer / unikerros | `SleepLayer` | Bounded replay/evaluation/consolidation using prediction-time evidence and matured real Outcomes; later dreams are a separately typed component. |
| Champion | `Champion` | Admitted PredictorGenome for an explicit serving scope. |
| Challenger | `Challenger` | Alternative genome under evaluation; ordinary delivery stays on Champion unless explicitly canaried. |
| Shadow prediction | `ShadowPrediction` | Frozen alternative prediction on a declared as-of source pool; not a delivered slate or proof of response to unseen Items. |
| Policy assignment | `PolicyAssignment` | Versioned global/cohort/Profile Champion selection with fallback and rollback. |
| Evaluation window | `EvaluationWindow` | Frozen input/label-maturity scope and eligibility for evaluation. |
| Discovery mode | `DiscoveryMode` | FOR_YOU, SURPRISE or RISK recommendation policy. |
| Ambient phase | `AmbientPhase` | DAWN, EVENING or NIGHT presentation phase; separate from policy. |
| For you | `FOR_YOU` | Supported expected fit with bounded exploration. |
| Surprise | `SURPRISE` | Relevant novelty while retaining useful expected fit. |
| Risk | `RISK` | Bolder relevant uncertainty/exploration inside hard constraints; not arbitrary unsafe behavior. |
| Dawn | `DAWN` | Visual phase mapped to FOR_YOU. |
| Evening | `EVENING` | Visual phase mapped to SURPRISE. |
| Night | `NIGHT` | Visual phase mapped to RISK. |
| Consumed | `CONSUMED` | Experience actually consumed/read/watched/attended in its domain. |
| Saved | `SAVED` | Profile-level intentionally stored state; pending Shared Endorsement is not Shared Saved. |
| Rating | `rating` | Kajo integer 0–10 outcome implying consumed; research raw scales remain separately preserved. |
| Not interested | `NOT_INTERESTED` | Explicit current irrelevance for an unconsumed Item. |
| Endorsement / yhteinen tykkäys | `Endorsement` | Actor-specific positive Shared decision to do an Item together. |
| Pending endorsement | `PendingEndorsement` | At least one active Endorsement without unanimous accepted-member consensus. |
| Shared list proposal / yhteislistan ehdotus | `SharedListProposal` | Pending `(profileId,itemId)` target-List proposal bound to Endorsement/consensus semantics; source changes remain governed by current accepted contracts. |
| Shared consensus | `SharedConsensus` | Unanimous currently accepted-member endorsement; promotes once to Shared Saved/system List and remains durable. |
| List / lista | `ItemList` | Profile-owned collection of generic, potentially mixed-type Items. |
| System saved list / Tallennetut | `SYSTEM_SAVED` | Exactly one system Saved List per Profile. |
| Custom list | `CUSTOM` | Named List; Personal additions commit directly, Shared discovery additions follow consensus. |
| List membership | `ItemListEntry` | List/Item relation with truthful actor/time; no copied rating/consumed state. |
| Inbox / postilaatikko | `Inbox` | Pending Profile invitations/message activity. |
| Profile message / viesti | `ProfileMessage` | Profile-scoped communication retaining actual actor; text is not prediction evidence by default. |

## Reusable engine vocabulary — target contracts

The following terms are proposed contract names, **not a claim that matching code/tables exist**. Definitions and all 51 conceptual parts are in [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md).

| Engine term | Meaning |
|---|---|
| `Subject` | Entity whose outcomes are predicted; maps to Kajo Profile. The supplied architecture's target Actor role is not confused with the acting User. |
| `Object` / `Action` | Domain-neutral object and eligible decision/slate; Kajo Item/recommendation are adapter mappings. |
| `CurrentState` | Composition of supported subject, working/recent/durable, uncertainty, group, world and context representations with time/version scope. |
| `BeliefState` | Estimate/support/uncertainty/calibration metadata distinguishing poor fit from insufficient knowledge. |
| `GroupState` | A group's own learned state plus permitted aggregate inputs; Kajo SharedProfile is its subject. |
| `WorldState` | Time-valid environment, availability and trend signals, separate from personal durable memory. |
| `Observation` | Source-typed evidence with occurrence/availability semantics and observability mask. |
| `Trajectory` | Ordered decision/observation/state path; only available prefix enters current prediction. |
| `RealityPath` | Actually observed portions of a trajectory, never model-invented history. |
| `Branch` | Predicted horizon-defined event/path; exclusive path categories and overlapping outcome heads are different contracts. |
| `LocalScenarioMemory` | Subject-scoped authorized real episodes. |
| `GlobalScenarioMemory` | Separately admitted privacy-protected cross-subject episodes/prototypes; not rating-only ExternalTastePrior. |
| `SyntheticScenarioMemory` | Isolated generated hypotheses, excluded from default real-evidence retrieval/evaluation. |
| `ScenarioEncoder` | Versioned decision-prefix representation for memory retrieval; future labels are excluded from the query. |
| `MetricEngine` | Context/task-aware compatible-space similarity with support/missingness handling. |
| `ScenarioPrototype` | Consolidated evidence-grounded pattern retaining support, source/time and deletion lineage. |
| `WorldModel` | Conditional outcome/next-state predictor; not automatically a causal intervention model. |
| `OutcomeModel` | Target/horizon/conditioning-specific estimates or distributions with explicit calibration status. |
| `PolicyEngine` | Action/slate choice using estimates/objectives inside immutable hard constraints. |
| `DreamEngine` | Bounded synthetic branch/trajectory generator using a WorldModel; dreams never validate themselves. |
| `DomainAdapter` | Application-specific mapping, target/reward semantics and trusted constraints outside generic computation. |
| `DatasetManifest` | Exact external release, hashes, schema, time semantics, rights, transformations and attribution. |
| `ModelArtifact` | Immutable learned/preprocessing/index-compatible artifact with training/split/permission lineage and admission/rollback state. |

## Critical relationship rules

```text
AnonymousIdentity ──upgrade/link──> User ──owns──> PersonalProfile
User A + User B ──Friendship──> lightweight social graph
Friendship ──explicit consent flow──> SharedProfile membership
Kajo Profile ──DomainAdapter──> engine Subject
Kajo acting User != engine prediction Subject
external research subject != Kajo User/Profile
```

FriendInvite is not Friendship; Friendship is not SharedProfile or ProfileMember; membership does not grant raw private Personal evidence access. TasteSession is not another media-specific Profile. AcquisitionAttribution is not taste evidence. ExternalTastePrior, native PopulationMemory and SyntheticScenarioMemory are not interchangeable.

## Forbidden synonym drift

Do not introduce `GroupTaste`, `JointProfile`, `FriendProfile`, `RecommendationUser`, `MediaUser`, `BookTasteProfile`, `MovieTasteProfile`, `ReferralProfile` or `TasteUser` for existing Kajo concepts. Generic engine Subject/Object roles are adapter contracts, not competing application entities.

Do not create media-specific List, endorsement, catalog, chat or Taste types such as `BookList`, `MovieList`, `MovieVote`, `MovieTasteTest`, `TmdbMovieItem` or `OpenLibraryBookItem`.

`ITEM_SUGGESTED` is historical/deprecated vocabulary from the removed Sprint 009 experiment. Use Endorsement for canonical Shared semantics.

Domain metadata may use domain-specific names; core identity, social, prediction and Taste concepts remain generic.
