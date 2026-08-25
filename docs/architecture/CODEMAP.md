# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

The repository is in Sprint 001 Foundation. The first mobile engineering foundation lives under `apps/mobile/` on Issue #2 / PR #3 and has passed CI validation. Merge and sprint close are still pending.

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
| Mobile app | `apps/mobile/` | Expo/TypeScript foundation validated; pending merge |
| Expo Router entry | `apps/mobile/app/` | Minimal root layout and entry screen |
| Core domain contracts | `apps/mobile/src/domain/` | Initial Profile/Item/Event/Context/DiscoveryMode/AmbientPhase contracts |
| Room feature | `apps/mobile/src/features/room/` | Not created yet |
| Discovery feature | `apps/mobile/src/features/discovery/` | Not created yet |
| Swipe | `apps/mobile/src/features/swipe/` | Not created yet |
| Profiles/Shared Kajo | `apps/mobile/src/features/profiles/` | Not created yet |
| Memory/history | `apps/mobile/src/features/memories/` | Not created yet |
| Theme engine | `apps/mobile/src/theme/` | Not created yet |
| Mobile data boundary | `apps/mobile/src/data/` | Not created yet |
| Prediction service | `services/prediction/` | Later sprint |
| DB migrations | `supabase/migrations/` | Later sprint |
| Shared contracts | `packages/contracts/` | Create only when real sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke checks |

Do not create empty feature folders merely to match the target architecture.
