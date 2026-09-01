# Kajo Prediction Model

This document defines prediction semantics, not a final ML algorithm.

## Thesis

Kajo should not learn isolated models of "what books I read" and "what movies I watch". It should learn changing representations of Profile/person behavior and use evidence across domains.

## Core input/output

Conceptually:

```text
Profile
+ LongTermState
+ ShortTermState
+ Context
+ Candidate Item
+ DiscoveryMode
-----------------
Prediction
```

A Prediction eventually exposes outcome probabilities, score and confidence/uncertainty.

## HumanState

### LongTermState

Slowly changing evidence about a Profile/person: novelty appetite, intensity, complexity tolerance, pacing, darkness/lightness, experimental/familiar preference and similar latent dimensions.

Evidence has confidence/recency; it is not a permanent identity label.

### ShortTermState

Recent behavioral state. Signals may cross Item domains.

Example: recent book/music/movie behavior can affect a current movie recommendation without creating domain-specific user models.

## Behavior -> state -> refreshed ranking

```text
User action
  -> Event / observed outcome
  -> update relevant ShortTermState and/or LongTermState evidence
  -> Prediction inputs change
  -> affected recommendation ranking refreshes
```

Useful evidence includes explicit positive/negative feedback, saved/unsaved, consumed outcomes, ratings and later richer memory/context signals.

Rules:

- UI button wording is not learning semantics.
- Recent actions may affect ShortTermState quickly; repeated/historical evidence can affect LongTermState gradually.
- Re-ranking occurs when materially relevant inputs change rather than requiring one stale list.
- Continuous responsiveness does not require expensive model training after every tap.

## DiscoveryMode

`DiscoveryMode` changes recommendation policy and is a live Prediction input.

### FOR_YOU

- maximize expected fit,
- prefer higher confidence,
- lower exploration.

### SURPRISE

- keep meaningful expected fit,
- increase novelty/exploration,
- allow indirect cross-domain relationships.

### RISK

- accept greater uncertainty/variance,
- strongly increase exploration,
- surface possible exceptional fits and clear misses.

`AmbientPhase` is presentation; DiscoveryMode is algorithmic policy.

## Prediction V0

MVP V0 is intentionally simple and inspectable. Initial signals include:

- generic Item similarity/features,
- explicit feedback and 0–10 ratings,
- not-interested evidence,
- save state,
- consumed/history suppression,
- long-term tag affinity,
- recency-weighted short-term tag evidence,
- novelty/exploration,
- DiscoveryMode.

Prediction V0 queue policy distinguishes outcome from exposure. Explicit rating/not-interested/save rotates an Item out of the immediate queue. Mere impressions use temporary cooldown. Consumed/rated Items remain strongly suppressed from ordinary discovery and available through history instead.

### V0 scorer contract

Current server-owned implementation is `public.rank_items_v0`:

```text
profileId + DiscoveryMode + optional ItemType + limit + Context
  -> one predictionId + ordered generic Item Predictions
```

The RPC is SECURITY INVOKER and validates authenticated Profile membership. It is an MVP transport/deployment choice, not a permanent rejection of a later dedicated prediction service.

The current inspectable score combines current state, weighted append-only Event evidence, LongTerm/ShortTerm tag evidence, novelty/exploration, reaction penalties and impression cooldown.

## SharedProfile common-fit model — Sprint 011/#151

A SharedProfile remains a **single Prediction target**. Kajo must not create one Book/Movie recommender per member and merge lists afterward.

However, a genuinely shared recommendation needs evidence about all accepted members, not only Events already produced while explicitly acting inside the SharedProfile.

For SharedProfile V0, ranking may combine:

1. **Shared joint evidence** — behavior/events/current state produced directly in the SharedProfile. This remains the strongest evidence about the group's established joint taste.
2. **Accepted-member PersonalProfile evidence** — authorized taste signals from each current member's PersonalProfile.
3. **Common-fit aggregation** — an inspectable aggregate designed to favor Items that fit the group rather than only one extreme member.
4. **Disagreement penalty** — explicit penalty/uncertainty when member-specific fit signals diverge strongly.

Do not lock an opaque ML aggregation before enough evidence exists. V0 should expose component values in `explanation` so common-fit/disagreement behavior can be verified on configured accounts.

A simple V0 approach may use average member fit plus a penalty based on range/variance; the exact coefficient is an implementation detail to validate, not a new domain concept.

### Shared discovery eligibility from member history

For active SharedProfile, an Item is excluded from **ordinary Shared discovery** if any currently accepted member has already consumed/rated it in that member's PersonalProfile.

Conceptually:

```text
for candidate Item:
  if SharedProfile itself consumed/rated Item -> ineligible
  else if any accepted member PersonalProfile consumed/rated Item -> ineligible
  else -> eligible for ranking
```

This is not Event copying. Personal events remain PersonalProfile evidence. The scorer/eligibility query reads authorized state to decide whether the Item is still useful as a shared recommendation.

This rule does not remove the Item from Lists, Saved history or consumed history.

## Actor-specific pending Endorsement delivery

Sprint 011/#151 introduces collaboration delivery on top of the SharedProfile Prediction.

Example A+B:

1. A endorses Item X.
2. X is no longer part of A's ordinary Shared discovery queue.
3. B has not endorsed X, so X is delivered ahead of ordinary Shared recommendations to B.
4. B sees restrained provenance (`A tykkäsi` or equivalent presentation copy).
5. If B endorses too, consensus saves X to Shared current/system-saved state and X leaves ordinary Shared discovery.

Important architecture rule:

**This actor-specific delivery priority is not an actor-specific taste model.**

The shared fit/risk Prediction still targets the SharedProfile. Authenticated actor identity is used only to overlay pending collaboration state:

```text
SharedProfile Prediction ranking
+ pending Endorsements from other members
- Items already endorsed by current actor
= actor-visible Shared discovery queue
```

Prediction output/explanation should make this priority inspectable, e.g. pending endorsement flags/actor IDs or a clear delivery-priority component, without leaking auth email.

## Shared consensus and Saved evidence

One Endorsement must not set Shared `item_interactions.saved=true`.

When all currently accepted members have active Endorsements:

- consensus is reached,
- Shared Saved projection becomes true,
- canonical `ITEM_SAVED` evidence is appended with `source = SHARED_CONSENSUS`,
- once Lists exist the Item is present exactly once in Shared `SYSTEM_SAVED`,
- future new membership does not retroactively revoke the historical consensus.

Custom Shared Lists do not affect the prediction model as unanimous votes by default. They are organizational state unless later evidence semantics are explicitly defined.

## ScenarioMemory

Future ScenarioMemory encodes a current scenario and retrieves similar historical scenarios from:

- PersonalProfile history,
- SharedProfile history,
- population history.

Conceptually:

```text
CurrentScenario
   -> similarity retrieval
   -> top N historical scenarios
   -> weight by similarity, outcome quality, recency and confidence
   -> scenario signal
```

This contributes to ranking; it does not override the rest of the model.

## Population learning

Cold start begins with generic/content-based signals and optionally weak demographic priors. As behavioral evidence grows:

```text
actual behavior > demographic prior
personal/shared evidence increasingly > generic population prior
```

## Future evolution engine

Architecture later supports populations of predictor configurations/genomes with parameters such as long-term weight, short-term weight, scenario weight, population weight, novelty weight, decay rate, memory depth and similarity thresholds.

Evolution optimizes measurable prediction outcomes. MVP must retain prediction/outcome linkage needed for that later step.