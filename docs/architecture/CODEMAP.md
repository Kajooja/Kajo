# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprint 001 Foundation, Sprint 002 Room, Sprint 003 Curtain & Theme and Sprint 004 Discovery UI are merged and validated. Sprint 005 — Swipe & History is the active sprint.

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
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application foundation merged and validated on a real Android phone |
| Expo Router entry | `apps/mobile/app/` | Root opens Room; book/movie discovery routes and one generic Item detail route live under `app/discovery/` |
| Core domain contracts | `apps/mobile/src/domain/` | Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts and canonical mode mapping |
| Room feature | `apps/mobile/src/features/room/` | 2D Room shell plus three-state curtain; bookshelf/projector navigate to discovery; curtain acceptance polish is next work |
| Theme engine | `apps/mobile/src/theme/` | Reusable personal Room base tokens plus AmbientPhase overlays and tests |
| Discovery feature | `apps/mobile/src/features/discovery/` | Shared DiscoveryMode state, generic mock Items/ranking, reusable grid and generic Item detail presentation |
| Swipe | `apps/mobile/src/features/swipe/` | Sprint 005 target; do not create until the first real swipe implementation requires it |
| Profiles/Shared Kajo | `apps/mobile/src/features/profiles/` | Later sprint; not created yet |
| Memory/history | `apps/mobile/src/features/memories/` | Sprint 005 may establish consumed-history presentation/state; create only when implementation begins |
| Mobile data boundary | `apps/mobile/src/data/` | Create when real data access requires it |
| Prediction service | `services/prediction/` | Later sprint |
| DB migrations | `supabase/migrations/` | Sprint 006 target; not created yet |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; `main` also builds/verifies/uploads a standalone Android release APK |

Do not create empty feature folders merely to match the target architecture.
