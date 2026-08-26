# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprint 001 Foundation, Sprint 002 Room, Sprint 003 Curtain & Theme and Sprint 004 Discovery UI are merged and validated. Sprint 005 — Swipe & History is active with application implementation merged and real-device acceptance pending.

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
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application foundation; Sprint 004 baseline validated on a real Android phone |
| Expo Router entry | `apps/mobile/app/` | Root opens Room; book/movie discovery routes and one generic Item detail/swipe route live under `app/discovery/` |
| Core domain contracts | `apps/mobile/src/domain/` | Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts and canonical mode mapping |
| Room feature | `apps/mobile/src/features/room/` | 2D Room shell plus continuous three-state curtain with thinner handle and full-scene DiscoveryMode atmosphere; bookshelf/projector navigate to discovery |
| Theme engine | `apps/mobile/src/theme/` | Reusable personal Room base tokens plus AmbientPhase overlays and tests |
| Discovery feature | `apps/mobile/src/features/discovery/` | Shared DiscoveryMode state, generic mock Items/ranking, grid, Item detail/horizontal swipe, generic local Item interaction state, interest/saved/consumed actions, consumed suppression/history and tests |
| Swipe | `apps/mobile/src/features/swipe/` | Intentionally not created; current optional swipe behavior is part of the existing generic discovery flow rather than a duplicate feature tree |
| Profiles/Shared Kajo | `apps/mobile/src/features/profiles/` | Later sprint; not created yet |
| Memory/history | `apps/mobile/src/features/memories/` | Intentionally not created; Sprint 005 consumed-history presentation/state currently lives at the generic discovery interaction boundary until persistent memory work requires a separate area |
| Mobile data boundary | `apps/mobile/src/data/` | Create when real data access requires it |
| Prediction service | `services/prediction/` | Later sprint |
| DB migrations | `supabase/migrations/` | Sprint 006 target; not created yet |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; `main` also builds/verifies/uploads a standalone Android release APK |

Do not create empty feature folders merely to match the target architecture.
