# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprints 001–005 are merged, CI-validated and complete. The final Sprint 005 standalone APK was accepted on a real phone. Sprint 006 — Backend Foundation is active with the schema/RLS foundation, one root-scoped mobile Supabase boundary, email/nickname password authentication, mobile auth deep links and PersonalProfile identity onboarding.

Important current paths:

```text
AGENTS.md
README.md
package.json
package-lock.json
docs/
apps/mobile/
supabase/migrations/
supabase/functions/password-auth/
.github/workflows/ci.yml
```

## Implementation locations

| Area | Canonical path | Current state |
|---|---|---|
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application; Sprint 005 main CI #77 is green and its standalone APK is accepted on a real phone |
| Expo Router entry | `apps/mobile/app/` | Root opens Room; book/movie discovery routes and one generic Item detail/swipe route live under `app/discovery/` |
| Core domain contracts | `apps/mobile/src/domain/` | Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts and canonical mode mapping |
| Room feature | `apps/mobile/src/features/room/` | 2D Room shell plus one window-aligned continuous three-state DiscoveryMode curtain with drag and tap-to-snap; bookshelf/projector navigate to discovery |
| Theme engine | `apps/mobile/src/theme/` | Reusable personal Room base tokens plus AmbientPhase overlays and tests |
| Discovery feature | `apps/mobile/src/features/discovery/` | Shared DiscoveryMode state, generic seeded MVP Items/ranking, grid and horizontal Item swipe; one interaction store stays local when unconfigured and hydrates/persists PersonalProfile current state when configured, including ordered writes, retry feedback and exact-card in-session undo |
| Swipe | `apps/mobile/src/features/swipe/` | Intentionally not created; current optional swipe behavior is part of the existing generic discovery flow rather than a duplicate feature tree |
| Personal identity | `apps/mobile/src/features/profiles/` | User-bound profile hydration, unique display-cased nickname onboarding/fallback and canonical User/PersonalProfile mapping behind one root provider; SharedProfile product flow remains later scope |
| Memory/history | `apps/mobile/src/features/memories/` | Intentionally not created; Sprint 005 consumed-history presentation/state currently lives at the generic discovery interaction boundary until persistent memory work requires a separate area |
| Mobile data boundary | `apps/mobile/src/data/` | Public Expo configuration validation, testable configured/unconfigured connection factory, one persistent-session Supabase client and root provider; no direct Supabase calls in screens |
| Authentication | `apps/mobile/app/auth/`, `apps/mobile/src/features/auth/` | Root-scoped persisted login state, email-or-nickname password sign-in, email+nickname registration, explicit static and token-path Android callback routes, redundant intent token parsing, explicit confirmation success, in-memory recovery sessions and return-to-login password updates; unconfigured builds preserve the accepted mock flow |
| Password auth boundary | `supabase/functions/password-auth/` | One public Edge Function resolves email/nickname identifiers server-side, checks account existence, signs in against Supabase Auth, resends signup confirmation and requests recovery without returning resolved email or privileged keys |
| Auth email callback | `supabase/functions/auth-callback/` | Scanner-safe HTTPS hop maps signup to the documented email OTP type and forwards token hashes redundantly in the native path and query without consuming them; only the app verifies the token |
| Supabase function config | `supabase/config.toml` | `password-auth` is explicitly callable before login (`verify_jwt = false`); credential validation remains inside the auth function/Supabase Auth flow |
| Prediction service | `services/prediction/` | Later sprint |
| DB migrations | `supabase/migrations/` | Sprint 006 foundation, case-insensitive unique nickname identity, unique PersonalProfile ownership, auth-user profile provisioning/fallback, authenticated identity RPCs and 12 stable-UUID MVP Item seeds; explicit grants and membership-based interaction RLS remain the authorization base |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; optional public Supabase repository variables feed Expo, and `main` also builds/verifies/uploads a standalone Android release APK |

Do not create empty feature folders merely to match the target architecture.
