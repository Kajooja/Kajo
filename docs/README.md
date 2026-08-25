# Kajo Documentation Map

This directory is the permanent project memory for Kajo.

## If you need to...

| Need | Read |
|---|---|
| Understand what Kajo is | `product/PRODUCT.md` |
| Know exactly what the MVP contains | `product/MVP.md` |
| Understand visual/interaction principles | `product/UX_PRINCIPLES.md` |
| Know where the project is right now | `project/STATUS.md` |
| Know what is being built now | Current sprint linked from `project/STATUS.md` |
| Know what comes next | `project/ROADMAP.md` |
| Understand sprint/milestone rules | `project/WORKFLOW.md` |
| Continue in a new AI conversation | `project/HANDOFF_PROTOCOL.md` |
| Use the correct terms | `domain/GLOSSARY.md` |
| Understand User/Profile/Item/Event relationships | `domain/DOMAIN_MODEL.md` |
| Understand behaviour tracking | `domain/DATA_EVENTS.md` |
| Understand prediction and memory concepts | `domain/PREDICTION_MODEL.md` |
| Understand technical boundaries | `architecture/ARCHITECTURE.md` |
| Find important code | `architecture/CODEMAP.md` |
| Understand why an architecture choice exists | `architecture/decisions/` |

## Documentation ownership model

Documents have different rates of change:

- **Slow:** `PRODUCT.md`, UX principles, architectural invariants.
- **Medium:** `MVP.md`, domain model, prediction model, roadmap.
- **Fast:** `STATUS.md`, active sprint documents, code map during implementation.
- **Historical:** completed sprint and milestone files; append closure information, then do not rewrite history casually.

Avoid duplicating the same truth in several documents. `STATUS.md` is the current-state authority; sprint files are historical execution records; ADRs explain durable decisions.
