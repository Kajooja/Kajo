# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprint 001 Foundation is merged and validated on `main`. Sprint 002 — Room is active, with the first Room shell implemented on Issue #6 / branch `feat/6-room-shell` pending validation and merge.

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
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript foundation merged and validated |
| Expo Router entry | `apps/mobile/app/` | Root route wires navigation callbacks into the Room; temporary book/movie routes under `app/discovery/` |
| Core domain contracts | `apps/mobile/src/domain/` | Initial Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts |
| Room feature | `apps/mobile/src/features/room/` | First 2D Room composition implemented in `RoomScreen.tsx`; pending validation/merge |
| Discovery feature | `apps/mobile/src/features/discovery/` | Later sprint; not created yet |
| Swipe | `apps/mobile/src/features/swipe/` | Later sprint; not created yet |
| Profiles/Shared Kajo | `apps/mobile/src/features/profiles/` | Later sprint; not created yet |
| Memory/history | `apps/mobile/src/features/memories/` | Later sprint; not created yet |
| Theme engine | `apps/mobile/src/theme/` | Sprint 003; not created yet |
| Mobile data boundary | `apps/mobile/src/data/` | Create when real data access requires it |
| Prediction service | `services/prediction/` | Later sprint |
| DB migrations | `supabase/migrations/` | Later sprint |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke checks |

Do not create empty feature folders merely to match the target architecture.
