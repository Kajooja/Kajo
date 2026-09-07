# Kajo Documentation Map

This directory is Kajo's permanent project memory. Chat conversations are temporary; important product/architecture/project decisions must live here.

## If you need to...

| Need | Read |
|---|---|
| Understand what Kajo ultimately is | `product/PRODUCT.md` |
| Know exactly what the first public release contains | `product/MVP.md` |
| Understand the Taste Test / link / Friend / Shared acquisition loop | `product/LAUNCH_LOOP.md` |
| Understand visual/interaction principles | `product/UX_PRINCIPLES.md` |
| Know where the project is right now | `project/STATUS.md` |
| Know the exact build order and Share Link Gate | `project/ROADMAP.md` |
| Know what is being built now | Current sprint/Issue linked from `project/STATUS.md` |
| Find the complete product target and preserved distant ideas | `product/FUTURE_PLAN.md` |
| Understand sprint/milestone rules | `project/WORKFLOW.md` |
| Continue in a new AI conversation | `project/HANDOFF_PROTOCOL.md` |
| Use the correct terms | `domain/GLOSSARY.md` |
| Understand User/Profile/Item/Event/Friend relationships | `domain/DOMAIN_MODEL.md` |
| Understand behavioral/growth event semantics | `domain/DATA_EVENTS.md` |
| Understand prediction, memory, evaluation and evolution | `domain/PREDICTION_MODEL.md` |
| Understand technical boundaries, scaling, services and recovery | `architecture/ARCHITECTURE.md` |
| Find important code | `architecture/CODEMAP.md` |
| Understand durable architecture choices | `architecture/decisions/` |

## Mandatory continuation order

When the owner says **"jatketaan reposta"** / **"Continue Kajo from the repository"**:

1. Read `AGENTS.md`.
2. Read this map.
3. Read `project/STATUS.md`.
4. Read `product/MVP.md`.
5. Read the active sprint/Issue handoff named by STATUS.
6. Read `project/ROADMAP.md` for dependency order.
7. If work touches onboarding/acquisition/friends, read `product/LAUNCH_LOOP.md` and ADR-0007.
8. Read relevant domain/architecture files before code.

The agent must continue the explicit next work package; it must not jump to distant FUTURE_PLAN ideas while release blockers remain.

## Documentation ownership model

- **Slow:** `PRODUCT.md`, UX principles, durable ADRs.
- **Medium:** `MVP.md`, domain/prediction models, `LAUNCH_LOOP.md`, roadmap.
- **Fast:** `STATUS.md`, active sprint documents, code map during implementation.
- **Historical:** completed sprint/milestone files; preserve accepted history.

Avoid duplicating full specifications. Link to the canonical owner document. `STATUS.md` is current-state authority; `ROADMAP.md` owns execution order; `MVP.md` owns the release boundary; `LAUNCH_LOOP.md` owns Taste-first acquisition semantics; `FUTURE_PLAN.md` preserves later ambitions.
