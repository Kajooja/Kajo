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

`DiscoveryMode` changes recommendation policy:

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

The mode is algorithmic. Its visual representation is handled separately by `AmbientPhase`.

## Prediction V0

MVP Prediction V0 should be intentionally simple and measurable. Initial signals may include:

- generic Item similarity/features,
- explicit likes/dislikes,
- consumed/history suppression,
- LongTermState derived from history,
- recency-weighted ShortTermState,
- novelty preference,
- DiscoveryMode exploration parameters.

Population scenario retrieval and evolutionary optimization come later after enough outcome data exists.

## Future evolution engine

The architecture should later support populations of predictor configurations/genomes with parameters such as long-term weight, short-term weight, scenario weight, population weight, novelty weight, decay rate, memory depth and similarity thresholds.

Evolution must optimize measurable prediction outcomes. The MVP must collect the prediction/outcome linkage needed for that later step.
