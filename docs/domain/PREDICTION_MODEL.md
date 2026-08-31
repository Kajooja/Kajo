# Kajo Prediction Model

This document defines prediction semantics, not a final ML algorithm.

## Thesis

Kajo should not learn separate isolated models of "what books I read" and "what movies I watch". It should learn a changing representation of the person/Profile and use evidence across domains.

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

A Prediction should eventually be able to expose one or more outcome probabilities, a ranking score and confidence/uncertainty.

## HumanState

### LongTermState

Slowly changing evidence about the person/Profile. It may represent latent dimensions such as novelty appetite, intensity, complexity tolerance, darkness/lightness, pacing and experimental/familiar preferences.

LongTermState is evidence with confidence and recency, not a permanent identity label.

### ShortTermState

Recent behavioural state. Signals may cross item domains.

Example: one member recently reads science fiction; another listens to heavy music; their SharedProfile is now choosing a movie. Those signals can contribute to the current shared scenario even though none of them is a recent movie action.

## Behaviour -> state -> refreshed ranking

Kajo's production recommendation loop is intended to remain responsive as evidence changes.

Conceptually:

```text
User action
  -> Event / observed outcome
  -> update relevant ShortTermState and/or LongTermState evidence
  -> Prediction inputs change
  -> affected recommendation ranking is refreshed
```

Examples of useful evidence include explicit positive/negative interest, saved/unsaved, consumed/read/watched outcomes, ratings and later richer memory/context signals.

Important rules:

- UI button wording is not learning semantics. A visible label may change while the underlying canonical event/state meaning remains stable.
- Recent actions may affect ShortTermState quickly; repeated/historical evidence can gradually affect LongTermState.
- Re-ranking should occur when materially relevant inputs change rather than requiring a fixed stale recommendation list.
- "Continuous" means recommendations can be refreshed from the latest available state and context; it does not require an expensive model-training job after every tap.
- Until Sprint 007 event persistence and Sprint 008 Prediction V0 exist, local mobile mock ordering must not be described as this real learning loop.

## ScenarioMemory

Future ScenarioMemory should encode a current scenario and retrieve similar historical scenarios from:

- personal history,
- SharedProfile history,
- population history.

Conceptual retrieval:

```text
CurrentScenario
   -> similarity retrieval
   -> top N historical scenarios
   -> weight by similarity, outcome quality, recency and confidence
   -> scenario signal
```

This signal contributes to ranking; it does not override the rest of the model.

## Population learning

Cold start begins with generic/content-based signals and optionally weak demographic priors. As behavioural evidence grows:

```text
actual behaviour > demographic prior
personal evidence increasingly > generic population prior
```

Similar scenarios can be more informative than simply finding globally similar users.

## DiscoveryMode

`DiscoveryMode` changes recommendation policy and is a live Prediction input, not merely a colour/theme preference.

### FOR_YOU

- maximize expected fit,
- prefer higher confidence,
- lower exploration.

### SURPRISE

- maintain meaningful expected fit,
- increase novelty/exploration,
- allow indirect cross-domain relationships.

### RISK

- deliberately accept greater uncertainty/variance,
- strongly increase exploration,
- surface items that may be exceptional fits or clear misses.

When the user changes DiscoveryMode, affected recommendation rankings should be refreshed using the new exploration/risk policy once Prediction V0 exists.

The mode is algorithmic. Its visual representation is handled separately by `AmbientPhase`. The same global curtain control may select DiscoveryMode and visually interpolate AmbientPhase, but the two concepts remain separate in the model.

## Prediction V0

MVP Prediction V0 should be intentionally simple and measurable. Initial signals may include:

- generic Item similarity/features,
- explicit likes/dislikes,
- consumed/history suppression,
- LongTermState derived from history,
- recency-weighted ShortTermState,
- novelty preference,
- DiscoveryMode exploration parameters.

Prediction V0 should support re-ranking after relevant behavioural evidence or DiscoveryMode changes so the user experience becomes progressively more personal during use.

Population scenario retrieval and evolutionary optimization come later after enough outcome data exists.

### V0.1 scorer contract

The first server-owned implementation is `public.rank_items_v0`:

```text
profileId + DiscoveryMode + optional ItemType + limit + Context
  -> one predictionId + ordered generic Item Predictions
```

The score is deliberately inspectable rather than learned. It combines:

- current explicit interest/save state as a direct signal,
- append-only positive and negative Event evidence after undo compensation,
- a slowly decaying tag-affinity signal for LongTermState,
- a stronger 14-day recency-weighted tag signal for ShortTermState,
- deterministic content novelty and exploration signals,
- a strong consumed penalty,
- different fit/novelty/exploration weights for each DiscoveryMode.

`FOR_YOU` emphasizes fit and recent evidence, `SURPRISE` increases novelty and
exploration while retaining fit, and `RISK` accepts substantially more
exploration. Hash-based exploration is stable for a Profile/Item pair, so fixed
evidence produces deterministic ordering even though each response receives a
new traceable `predictionId`. The response exposes component values for
measurement/debugging; they are not user-facing psychological labels.

The RPC is `SECURITY INVOKER` and validates authenticated Profile membership.
It is a transport/deployment choice for V0, not a permanent rejection of the
later Python prediction service.

## Future evolution engine

The architecture should later support populations of predictor configurations/genomes with parameters such as long-term weight, short-term weight, scenario weight, population weight, novelty weight, decay rate, memory depth and similarity thresholds.

Evolution must optimize measurable prediction outcomes. The MVP must collect the prediction/outcome linkage needed for that later step.
