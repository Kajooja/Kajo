# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprints 001–008 are merged, validated and complete. Sprint 009 — Shared Kajo is active at configured Android re-acceptance. The app has one generic active Profile scope shared by PersonalProfile and ready SharedProfiles, consent-based SharedProfile invitations, a global Profile switcher/invitation inbox in the persistent shell, SharedProfile-specific visual identity and generic shared Item/Event/Prediction behavior.

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
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application; configured auth, persistence, Event and Prediction V0 flows are accepted on Android; Sprint 009 reuses the same app/runtime for SharedProfile context |
| Expo Router entry | `apps/mobile/app/` | Root opens Room; authenticated routes share one persistent `DiscoveryModeShell` above the Stack; book/movie discovery lives under `app/discovery/` and full Shared Kajo management under `app/profiles/shared.tsx` |
| Global app shell | `apps/mobile/src/features/discovery/DiscoveryModeShell.tsx` | Persistent Kajo mark + DiscoveryMode curtain plus top-right active Profile identity, mail invitation badge/overlay and left-side Personal/Shared Profile drawer; Profile selection changes context in place without forcing route navigation |
| Core domain contracts | `apps/mobile/src/domain/` | Generic Profile/Item/Event/Context/Prediction/DiscoveryMode/AmbientPhase contracts; `Profile` remains Personal or Shared without media/social-specific duplicates |
| Room feature | `apps/mobile/src/features/room/` | 2D Room home/navigation surface with bookshelf/projector; visual base theme follows active Profile. SharedProfile switching no longer uses a dedicated Room wall object |
| Theme engine | `apps/mobile/src/theme/` | Personal Room tokens are preserved; SharedProfiles resolve stable restrained base identity deterministically from `profileId`; AmbientPhase remains a separate DiscoveryMode-driven overlay |
| Discovery feature | `apps/mobile/src/features/discovery/` | Global shell/mode, generic grid/detail/swipe, hosted Prediction V0, rating/not-interested/save state, ordered persistence and exact undo; ranking/interaction scope and visible theme identity follow active Profile |
| Interaction persistence | `apps/mobile/src/features/discovery/ItemInteractionContext.tsx` | Active-Profile hydration/persistence boundary; remembers successful hydration for the signed-in actor so later Profile switches keep UI mounted while writes stay blocked until target Profile persistence is ready |
| Event Engine | `apps/mobile/src/features/events/` | Root-scoped session/correlation tracker and append boundary; active Profile changes `profileId` while the signed-in User remains `actorUserId` |
| Profiles | `apps/mobile/src/features/profiles/` | Personal identity, typed SharedProfile list/create/invite/invitation-response RPC operations, pure active-profile selection rules, actor-scoped invitation/membership refresh, `ActiveProfileProvider`, and `SharedProfilesScreen`; presentation does not call Supabase directly |
| Shared Kajo route | `apps/mobile/app/profiles/shared.tsx` | Full Shared Kajo management surface reached from bold `Ryhmät`: Personal fallback, ready/provisional groups, accepted-member display, creation and nickname-based invitation sending |
| Auth gate | `apps/mobile/src/features/auth/AuthGate.tsx` | Auth/profile onboarding gate; configured interaction hydration blocks only the signed-in actor's initial load, not subsequent Personal ↔ Shared switches |
| Swipe | `apps/mobile/src/features/swipe/` | Intentionally not created; optional swipe behavior stays in the generic discovery flow |
| Memory/history | `apps/mobile/src/features/memories/` | Intentionally not created; current saved/consumed state remains at the generic interaction boundary until Sprint 010 persistent list navigation requires a separate area |
| Mobile data boundary | `apps/mobile/src/data/` | Configured/unconfigured Supabase connection and root provider; direct Supabase calls stay out of presentation screens |
| Authentication | `apps/mobile/app/auth/`, `apps/mobile/src/features/auth/` | Persisted auth, unique email/nickname registration, email-or-nickname login, confirmation/recovery callbacks and safe unconfigured fallback |
| Password auth boundary | `supabase/functions/password-auth/` | Server-side email/nickname resolution and auth operations without returning resolved email or privileged keys |
| Auth email callback | `supabase/functions/auth-callback/` | Scanner-safe HTTPS callback hop that forwards token hashes to the mobile app for verification |
| Supabase function config | `supabase/config.toml` | Edge Function auth configuration; credential validation remains inside auth/Supabase flows |
| Prediction service | `public.rank_items_v0` via `supabase/migrations/20260831093000_prediction_v0_foundation.sql` | Server-owned generic scorer targeting any authorized Profile; mobile requests use the active Profile |
| SharedProfile membership persistence | `supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`, `20260831172000_fix_shared_profile_member_conflict.sql` | Existing `profiles` + accepted `profile_members` model, membership-only SharedProfile visibility, 2+ readiness and private privileged helpers with public authenticated wrappers |
| SharedProfile invitations | `supabase/migrations/20260831200429_shared_profile_invitations.sql` | Pending consent state separate from accepted membership; invite/list/respond RPCs, invitee-scoped RLS, atomic accept and reject-without-membership behavior; legacy direct-add path cannot bypass consent |
| DB migrations | `supabase/migrations/` | Identity/current state, Event/session persistence, Prediction V0, canonical feedback/cooldown, SharedProfile membership and invitation foundations with explicit grants/RLS |
| Shared contracts | `packages/contracts/` | Create only when real cross-package sharing exists |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; `main` also builds/verifies/uploads a standalone Android APK |

Do not create empty feature folders merely to match the target architecture.
