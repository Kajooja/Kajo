# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprints 001–009 are accepted. Sprint 010 navigation/Profile lifecycle implementation is merged; final Room/dock polish is tracked under #149 / PR #150. Sprint 011 starts with #151 Shared discovery/Endorsement semantics before #102 named Lists.

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
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application; configured Personal/Shared auth, persistence, Event and Prediction V0 flows are phone-runnable |
| Expo Router entry | `apps/mobile/app/` | Root opens Room; authenticated routes share one persistent `DiscoveryModeShell`; discovery under `app/discovery/`; Shared management under `app/profiles/shared.tsx` |
| Global app shell | `apps/mobile/src/features/discovery/DiscoveryModeShell.tsx` | Top Kajo Home mark + global curtain; bottom menu/active-Profile/Inbox dock; side drawer owns Profile/Lists/Groups and final sign-out placement under #149 |
| Core domain contracts | `apps/mobile/src/domain/` | Generic Profile/Item/Event/Context/Prediction/DiscoveryMode contracts; no media-specific user/predictor architecture |
| Room feature | `apps/mobile/src/features/room/RoomScreen.tsx` | 2D Room home with bookshelf/projector. #149 removes standalone title/helper/sign-out so Room remains only visual domain navigation between global bars |
| Theme engine | `apps/mobile/src/theme/` | Personal/Shared stable base identity with separate DiscoveryMode-driven AmbientPhase |
| Discovery feature | `apps/mobile/src/features/discovery/` | Grid/detail/swipe, hosted Prediction V0, rating/not-interested/save state, ordered persistence, undo, cooldown and global shell. `SharedEndorsementContext.tsx`, `sharedEndorsementOperations.ts` and `sharedEndorsement.ts` own the separate #151 collaboration overlay |
| Interaction persistence | `apps/mobile/src/features/discovery/ItemInteractionContext.tsx` | Active-Profile current-state hydration/persistence; later Profile switches keep UI mounted while writes wait for target Profile readiness |
| Event Engine | `apps/mobile/src/features/events/` | Root-scoped session/correlation append boundary; active Profile changes `profileId`, signed-in User remains `actorUserId` |
| Profiles | `apps/mobile/src/features/profiles/` | Personal identity, Shared list/create/invite/respond/leave operations, active Profile rules/provider, invitation/membership refresh and Shared management UI |
| Shared Kajo route | `apps/mobile/app/profiles/shared.tsx` | Full Shared management: ready/provisional groups, accepted members, creation, nickname invitations and leave confirmation |
| Auth gate | `apps/mobile/src/features/auth/AuthGate.tsx` | Auth/profile onboarding; nickname max 24; first configured hydration blocking only, later Profile switches seamless |
| Mobile data boundary | `apps/mobile/src/data/` | Supabase configured/unconfigured connection and root provider; presentation avoids scattered DB access |
| Authentication | `apps/mobile/app/auth/`, `apps/mobile/src/features/auth/` | Persisted auth, unique email/nickname registration, email-or-nickname login, confirmation/recovery callbacks |
| Password auth boundary | `supabase/functions/password-auth/` | Server-side email/nickname resolution without returning resolved auth email or privileged keys |
| Auth email callback | `supabase/functions/auth-callback/` | HTTPS callback hop forwarding verification token hashes to mobile app |
| Prediction service | `public.rank_items_v0` via `supabase/migrations/20260831093000_prediction_v0_foundation.sql` and later scorer migrations | Server-owned generic scorer targeting authorized Profile; the temporary V0 core remains unchanged while #151 adds prediction-core-independent eligibility/collaboration composition. Common-fit formula work is gated by #156 |
| Shared membership | `supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`, `20260831172000_fix_shared_profile_member_conflict.sql` | Existing `profiles` + accepted `profile_members`, membership-scoped visibility and 2+ readiness |
| Shared invitations | `supabase/migrations/20260831200429_shared_profile_invitations.sql` | Pending consent separate from accepted membership; invite/list/respond RPCs and authorization |
| Profile lifecycle | `supabase/migrations/20260901082902_profile_lifecycle_limits_and_leave.sql` | 24/32 identity limits, safe Shared leave lifecycle and hardened PersonalProfile completion wrapper |
| Lists | planned under #102 | Do not create implementation before #151. Planned generic `ItemList`/entries with `SYSTEM_SAVED` + `CUSTOM` |
| Shared Endorsement | `supabase/migrations/20260901122000_shared_endorsement_state.sql`, `20260901124000_shared_endorsement_item_index.sql`, `20260901150500_shared_discovery_overlay.sql` | #151 foundation + prediction-core-independent delivery: membership-scoped actor/Profile/Item state, idempotent RPCs, consensus -> Shared Saved, member-history eligibility, pending provenance and mobile Event/queue integration. Common-fit stays gated by #156 |
| Messaging | planned under #138 | Starts after Lists; Profile-scoped narrow chat/thread only |
| DB migrations | `supabase/migrations/` | Identity/current state, Event persistence, Prediction V0, feedback/cooldown, Shared membership/invitations/lifecycle and Shared Endorsement state with explicit grants/RLS |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; main also builds/verifies/uploads standalone Android APK |

Do not create empty feature folders merely to match future architecture. #151 should extend the generic Profile/Prediction boundaries rather than create `GroupTaste`, media-specific queues or a second recommender.
