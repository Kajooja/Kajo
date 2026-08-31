# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprints 001–008 are merged, validated and complete. Sprint 009 — Shared Kajo is active. The app now has one generic active Profile scope shared by PersonalProfile and ready SharedProfiles; visible Shared Kajo setup/selection is the current implementation slice.

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
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application; configured auth, persistence, Event and Prediction V0 flows are accepted on Android; Sprint 009 extends the same app with SharedProfile context |
| Expo Router entry | `apps/mobile/app/` | Root opens Room; authenticated routes share one persistent DiscoveryMode shell above the Stack; book/movie discovery lives under `app/discovery/` and Shared Kajo setup/selection under `app/profiles/shared.tsx` |
| Core domain contracts | `apps/mobile/src/domain/` | Generic Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts; `Profile` remains Personal or Shared without media/social-specific duplicates |
| Room feature | `apps/mobile/src/features/room/` | 2D Room home/navigation surface with bookshelf, projector and a restrained Shared Kajo wall object; active Profile identity is visible while final SharedProfile-specific Room/theme identity remains later Sprint 009 scope |
| Theme engine | `apps/mobile/src/theme/` | Reusable Room base tokens plus AmbientPhase overlays; no separate hard-coded SharedProfile theme system |
| Discovery feature | `apps/mobile/src/features/discovery/` | Global DiscoveryMode, generic grid/detail/swipe, hosted Prediction V0, rating/not-interested/save state, ordered persistence and exact undo; ranking/interaction scope now follows the active Profile |
| Event Engine | `apps/mobile/src/features/events/` | Root-scoped session/correlation tracker and append boundary; active Profile changes `profileId` while the signed-in User remains `actorUserId` |
| Profiles | `apps/mobile/src/features/profiles/` | Personal identity, typed SharedProfile list/create/member RPC operations, pure active-profile selection rules, `ActiveProfileProvider`, and `SharedProfilesScreen`; screens do not call Supabase directly |
| Shared Kajo route | `apps/mobile/app/profiles/shared.tsx` | Minimal Shared Kajo setup/selection surface: personal fallback, ready/provisional SharedProfiles, member display, creation, nickname member add and ready-profile activation |
| Swipe | `apps/mobile/src/features/swipe/` | Intentionally not created; optional swipe behavior stays in the generic discovery flow |
| Memory/history | `apps/mobile/src/features/memories/` | Intentionally not created; current saved/consumed state remains at the generic interaction boundary until Sprint 010 persistent list navigation requires a separate area |
| Mobile data boundary | `apps/mobile/src/data/` | Configured/unconfigured Supabase connection and root provider; direct Supabase calls stay out of presentation screens |
| Authentication | `apps/mobile/app/auth/`, `apps/mobile/src/features/auth/` | Persisted auth, unique email/nickname registration, email-or-nickname login, confirmation/recovery callbacks and safe unconfigured fallback |
| Password auth boundary | `supabase/functions/password-auth/` | Server-side email/nickname resolution and auth operations without returning resolved email or privileged keys |
| Auth email callback | `supabase/functions/auth-callback/` | Scanner-safe HTTPS callback hop that forwards token hashes to the mobile app for verification |
| Supabase function config | `supabase/config.toml` | Edge Function auth configuration; credential validation remains inside auth/Supabase flows |
| Prediction service | `public.rank_items_v0` via `supabase/migrations/20260831093000_prediction_v0_foundation.sql` | Server-owned generic scorer targeting any authorized Profile; mobile requests now use the active Profile |
| SharedProfile persistence | `supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`, `20260831172000_fix_shared_profile_member_conflict.sql` | Existing `profiles` + `profile_members` model, membership-protected create/add/list RPCs, 2+ readiness and private privileged helpers with public SECURITY INVOKER wrappers |
| DB migrations | `supabase/migrations/` | Identity/current state, Event/session persistence, Prediction V0, canonical feedback/cooldown and SharedProfile membership foundations with explicit grants/RLS |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; `main` also builds/verifies/uploads a standalone Android APK |

Do not create empty feature folders merely to match the target architecture.
