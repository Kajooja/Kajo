# Kajo Documentation Map

Git is the project's durable memory. This map names the owner of each kind of truth; do not duplicate entire specifications across documents.

## Start here

Read `AGENTS.md`, this map, [STATUS](project/STATUS.md), [MVP](product/MVP.md), the active sprint/handoff named by STATUS, then [ROADMAP](project/ROADMAP.md). Inspect main and the explicitly named active PR before continuing code. An unmerged PR is not accepted main.

For engine or external-data work, also read the **Predictive Memory Engine**, **Data enrichment**, **Kajo Prediction model** and **ADR-0008** entries below. The portable engine is independent; Kajo is its first adapter. The 51-part design is a target architecture, not a list of already implemented modules.

## Canonical owners

| Question | Document |
|---|---|
| What is Kajo? | [PRODUCT](product/PRODUCT.md) |
| What blocks first release? | [MVP](product/MVP.md) |
| How does the Taste → auth → Friend → Shared launch loop work? | [LAUNCH_LOOP](product/LAUNCH_LOOP.md) |
| What UX principles constrain it? | [UX_PRINCIPLES](product/UX_PRINCIPLES.md) |
| What exactly is the current state and next bounded task? | [STATUS](project/STATUS.md) |
| In what dependency order do we build? | [ROADMAP](project/ROADMAP.md) |
| Which sprint is active? | [STATUS](project/STATUS.md), then its named sprint |
| Which longer-term ideas remain preserved? | [FUTURE_PLAN](product/FUTURE_PLAN.md) |
| How do branches, tests and review work? | [WORKFLOW](project/WORKFLOW.md) |
| How do agents leave a resumable checkpoint? | [HANDOFF_PROTOCOL](project/HANDOFF_PROTOCOL.md) |
| What did the repository retrospective establish? | [2026-09-09 retrospective](project/retros/2026-09-09.md) |
| What did the engine-direction, branch and hygiene audit change? | [2026-09-12 audit](project/retros/2026-09-12.md) |
| What do canonical terms mean? | [GLOSSARY](domain/GLOSSARY.md) |
| What are Kajo's entity relationships and privacy boundaries? | [DOMAIN_MODEL](domain/DOMAIN_MODEL.md) |
| What counts as native event/exposure/outcome evidence? | [DATA_EVENTS](domain/DATA_EVENTS.md) |
| What is the complete reusable engine architecture? | [PREDICTIVE_MEMORY_ENGINE](architecture/PREDICTIVE_MEMORY_ENGINE.md) |
| How does Kajo bind that engine to Profile/Item, serving and evaluation? | [PREDICTION_MODEL](domain/PREDICTION_MODEL.md) |
| How are public taste data, enrichment and learned artifacts handled? | [DATA_ENRICHMENT](architecture/DATA_ENRICHMENT.md) |
| What are product/runtime/service boundaries? | [ARCHITECTURE](architecture/ARCHITECTURE.md) |
| Where does implemented code actually live? | [CODEMAP](architecture/CODEMAP.md) |
| Why were durable decisions made? | [ADRs](architecture/decisions/README.md) |
| Why is portability/public-data research now part of Phase 14? | [ADR-0008](architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md) |

## Documentation boundaries

Slow-changing truth belongs to product/domain/architecture documents. Execution order belongs to ROADMAP; fast-changing source, CI, deployment and device acceptance belong to STATUS and the active sprint/PR. Historical sprints and retrospectives retain dated evidence rather than acting as the current to-do list.

The 2026-09-12 refinement advances **portable contracts and isolated external-preference research**. It does not turn external ratings into native Kajo Scenarios, approve model deployment or waive the later gates for Kajo PopulationMemory, multistep dreaming or autonomous evolution. Read older broad deferral language together with ADR-0008.

Planned paths in diagrams are not implemented folders. Create code packages only with a real work packet and tests. Documentation acceptance, code CI, dataset ingestion/training, hosted rollout and device acceptance are separate facts.
