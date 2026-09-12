# ADR-0008 — Portable Predictive Memory Engine and external research priors

Date: 2026-09-12
Status: **owner-approved design, publication through Issue #233 / PR #234; runtime implementation pending**

## Context

The owner supplied a 51-section Predictive Memory Engine proposal and wants the engine to remain a reusable independent system. Kajo is the first application. Public movie-preference data can support non-commercial research before Kajo accumulates enough native evidence.

Existing ADR-0002/0003/0005/0007, Profile privacy, the SQL serving boundary and the Phase 14 → Taste → Friend → Shared release march remain valid. The currently active code is draft PR #229 / Issue #228; it is not accepted main merely because this architecture is documented.

## Decision

1. Adopt [PREDICTIVE_MEMORY_ENGINE](../PREDICTIVE_MEMORY_ENGINE.md) as the complete generic target architecture, retaining the supplied 51-part organization and explicitly recording review amendments. Keep Kajo-specific semantics in [PREDICTION_MODEL](../../domain/PREDICTION_MODEL.md).
2. Separate prediction **Subject** from acting identity. Kajo maps Profile to Subject and the requesting User to actor; SharedProfile remains independent learned joint state. No identity/schema rename is performed by this ADR.
3. Keep WorldModel/OutcomeModel prediction separate from PolicyEngine action choice. Declare target horizons, uncertainty/calibration status and observed-outcome eligibility. A scalar score is not a probability and overlapping outcomes are not exclusive branches.
4. Separate canonical observations and frozen predictions from rebuildable state/embeddings/prototypes/indexes. Enforce point-in-time features, artifact cutoffs and prefix-only retrieval. Authorization and source/time scope constrain retrieval before nearest-neighbor selection and again at use.
5. Preserve local, global and synthetic memories, but add **ExternalTastePrior** as a distinct licensed research artifact. Rating-only datasets are not complete global Scenarios. Kajo PopulationMemory remains privacy/evidence gated; no external identities become Kajo accounts.
6. Start an isolated, reproducible MovieLens research pipeline according to [DATA_ENRICHMENT](../DATA_ENRICHMENT.md). Tag Genome enrichment, Beliefs analysis and KuaiRand sequence/exposure evaluation are optional later packets, not automatic training inputs or launch dependencies. Source permissions follow derived models and indexes.
7. Prove portability with executable contracts, two small domain adapters and parity/fallback tests. Keep existing SQL as the serving baseline until a component is independently admitted. No forced Python service, pgvector, graph database, monorepo split or new microservice is introduced now.
8. Preserve the full future WorldModel/DreamEngine/self-evolving-geometry ambition. Bounded scalar evaluation and error diagnostics come first; causal claims, multistep rollouts and automatic/global promotion require separate evidence. Synthetic outcomes never validate themselves or enter real-outcome denominators.

## Changed scope and unchanged gates

Earlier wording deferred learned embeddings/population work broadly. This ADR advances **offline external-preference research and portability contracts** into Phase 14, without admitting Kajo-wide population retrieval or externally trained production models. The distinction is mandatory wherever older roadmap/future wording is read.

`ROADMAP` owns packet order; `STATUS` owns the exact resumable task; `MVP` owns first-release acceptance. E1 #235 / D1 #236 / D2 #237 establish executable contracts and an honest external-data report, not a requirement that a learned challenger must win. Production quality remains a separate gate. Optional D3/D4/D5 and generations 2–5 are not silently promoted into MVP.

The active #229 evidence/pagination work retains its own CI, five undeployed forwards, rollout and device gates. This documentation change does not apply migrations, reset accounts, launch APK builds, activate a new reader or merge the active code branch.

## Alternatives considered

- **Keep the engine entirely Kajo-specific:** rejected because it makes the requested reusable architecture depend on UI, provider and identity details.
- **Rewrite all serving into a new service immediately:** rejected because it risks losing already tested evidence/authorization semantics before parity and usefulness exist.
- **Treat MovieLens people as fake Kajo users and ratings as complete Scenarios:** rejected because it invents context/decision/exposure facts and contaminates product evidence.
- **Wait for substantial native data before any representation research:** unnecessary; a clearly bounded external offline experiment is useful without claiming full behavioral/world-model validation.
- **Require a neural world model or a winning external prior before first release:** rejected; the release needs trustworthy useful predictions and evidence, not one specific model family.

## Consequences and acceptance

Benefits: independent engine contracts, repeatable early experiments, explicit uncertainty/data limits and a migration path that preserves working Kajo behavior.

Costs: adapter and artifact versioning, research/production isolation, license lineage, temporal evaluation and separate model admission must be maintained. Public data does not remove native-data, consent, device or cross-domain validation work.

The documentation PR must update the navigation and canonical scope/continuation owners, retain existing release gates, and distinguish planned modules from delivered code. Implementation requires deterministic contract/leakage/authorization tests, reproducible source manifests and explicit evidence before any serving change.
