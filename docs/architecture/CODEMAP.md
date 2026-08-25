# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprint 001 Foundation, Sprint 002 Room and Sprint 003 Curtain & Theme are merged and validated on `main`. Sprint 004 — Discovery UI is the active implementation sprint.

Important current paths:

```text
AGENTS.md
README.md
package.json
package-lock.json
docs/
apps/mobile/
.github/workflows/ci.yml
```

## Implementation locations

| Area | Canonical path | Current state |
|---|---|---|
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application foundation merged and validated |
| Expo Router entry | `apps/mobile/app/` | Root route opens Room; current book/movie routes are placeholders pending Sprint 004 |
| Core domain contracts | `apps/mobile/src/domain/` | Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts and canonical mode mapping |
| Room feature | `apps/mobile/src/features/room/` | 2D Room shell plus merged three-state curtain control/state logic |
| Theme engine | `apps/mobile/src/theme/` | Reusable personal Room base tokens plus AmbientPhase overlays and tests |
| Discovery feature | `apps/mobile/src/features/discovery/` | Sprint 004 next implementation area; not created yet |
| Swipe | `apps/mobile/src/features/swipe/` | Later sprint; not created yet |
| Profiles/Shared Kajo | `apps/mobile/src/features/profiles/` | Later sprint; not created yet |
| Memory/history | `apps/mobile/src/features/memories/` | Later sprint; not created yet |
| Mobile data boundary | `apps/mobile/src/data/` | Create when real data access requires it |
| Prediction service | `services/prediction/` | Later sprint |
| DB migrations | `supabase/migrations/` | Later sprint |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke checks |

Do not create empty feature folders merely to match the target architecture.
