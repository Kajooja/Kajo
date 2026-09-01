# Prediction Core / EvoBot design gate

Status: **OPEN — implementation gate**
Tracking issue: **#156**

Kajo's current `Prediction V0` is an inspectable, replaceable MVP baseline. It is not the final EvoBot architecture.

Do not implement or hard-code the following until #156 has an explicitly approved design:

- final `LongTermState` representation or update algorithm,
- final `ShortTermState` / near-memory representation,
- Scenario creation schema and lifecycle,
- Scenario similarity/retrieval,
- population ScenarioMemory,
- EvoBot genome structure,
- mutation/crossover/selection rules,
- champion/challenger lifecycle,
- final objective/outcome function,
- final Personal/Shared/population signal composition.

Sprint 011 may continue with prediction-core-independent collaboration mechanics:

- accepted-member authorization,
- Shared consumed/rated eligibility as a discovery rule,
- actor-specific Endorsement current state,
- Endorsement Events,
- unanimous consensus -> Shared Saved state,
- actor-specific pending collaboration delivery layered outside the core taste model.

`MVP-PRED-005` common-fit coefficient/formula work remains gated until #156 clarifies how member evidence composes with the future core predictor.

The permanent architecture requirement is replaceability: candidate generation, state/memory retrieval, core outcome prediction, DiscoveryMode policy and collaboration/eligibility delivery must remain separable/versioned enough that the temporary V0 scorer can later be replaced without rewriting mobile interaction state or core domain contracts.
