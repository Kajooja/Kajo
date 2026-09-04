# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprints 001–010 are accepted. Sprint 011/#151 Shared discovery/Endorsement is accepted; #102 named Lists and Sprint 012/#138 messaging are hosted with refreshed configured Android acceptance deferred. Sprint 013/#156 Prediction nervous system is the active work.

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
| Expo Router entry | `apps/mobile/app/` | Root opens Room; authenticated routes share one persistent `DiscoveryModeShell`; discovery under `app/discovery/`; Lists under `app/lists/`; Profile threads under `app/messages/`; Shared management under `app/profiles/shared.tsx` |
| Global app shell | `apps/mobile/src/features/discovery/DiscoveryModeShell.tsx` | Top Kajo Home mark + global curtain; bottom menu/active-Profile/Inbox dock; one persistent Room backdrop with secondary-route blur/dim treatment; translucent atmospheric chrome; side drawer owns Profile/Lists/Groups, fixed List/history shortcuts, three most-used custom Lists and final sign-out placement |
| Core domain contracts | `apps/mobile/src/domain/` | Generic Profile/Item/Event/Context/Prediction/DiscoveryMode contracts, including optional Prediction-correlated session context; no media-specific user/predictor architecture |
| Room feature | `apps/mobile/src/features/room/RoomScreen.tsx`, `apps/mobile/src/features/room/roomGeometry.ts`, `apps/mobile/assets/room-cabin-2d.png`, `apps/mobile/assets/soft-kajo-mask.png` | Edge-to-edge minimalist front-facing 2D cabin with morning/afternoon/night window scenery, phase-sized warm-to-blue flame, progressively deeper shadow and independent soft-falloff window/fireplace Kajo. Source-image geometry maps the TV-only and bookshelf-only Home targets through every `cover` crop. The shell retains the same scene beneath authenticated routes; reduced-motion disables continuous Room motion |
| Theme engine | `apps/mobile/src/theme/` | Personal/Shared stable base identity with separate DiscoveryMode-driven AmbientPhase plus centralized translucent surface-color tokens |
| Discovery feature | `apps/mobile/src/features/discovery/` | Grid/detail/swipe, Prediction V1 request wiring, Item impression/dwell evidence, rating/not-interested/save state, ordered persistence, undo, cooldown and global shell. `SharedEndorsementContext.tsx`, `sharedEndorsementOperations.ts` and `sharedEndorsement.ts` own the separate #151 collaboration overlay |
| Interaction persistence | `apps/mobile/src/features/discovery/ItemInteractionContext.tsx` | Active-Profile current-state hydration/persistence; later Profile switches keep UI mounted while writes wait for target Profile readiness |
| Event Engine | `apps/mobile/src/features/events/` | Root-scoped session/correlation append boundary; exposes the active session ID to Prediction context and records bounded detail dwell; active Profile changes `profileId`, signed-in User remains `actorUserId` |
| Profiles | `apps/mobile/src/features/profiles/` | Personal identity, Shared list/create/invite/respond/leave operations, active Profile rules/provider, invitation/membership refresh and Shared management UI |
| Lists | `apps/mobile/src/features/lists/`, `apps/mobile/app/lists/` | #102 Profile-scoped system/custom List operations/provider, compact latest-use destination picker, actor-local frequency/recency drawer ranking, Saved/consumed browsing, custom management, list/card/filter/sort detail and Shared provenance |
| Shared Kajo route | `apps/mobile/app/profiles/shared.tsx` | Full Shared management: ready/provisional groups, accepted members, creation, nickname invitations and leave confirmation |
| Auth gate | `apps/mobile/src/features/auth/AuthGate.tsx`, `apps/mobile/src/features/profiles/PersonalProfileProvider.tsx` | Auth/profile onboarding; nickname max 24; first configured hydration blocking only, one bounded delayed retry absorbs the transient post-login session/profile race without retrying a genuinely missing profile; later Profile switches remain seamless |
| Mobile data boundary | `apps/mobile/src/data/` | Supabase configured/unconfigured connection and root provider; presentation avoids scattered DB access |
| Authentication | `apps/mobile/app/auth/`, `apps/mobile/src/features/auth/` | Persisted auth, unique email/nickname registration, email-or-nickname login, confirmation/recovery callbacks |
| Password auth boundary | `supabase/functions/password-auth/` | Server-side email/nickname resolution without returning resolved auth email or privileged keys |
| Auth email callback | `supabase/functions/auth-callback/` | HTTPS callback hop forwarding verification token hashes to mobile app |
| Prediction V0 compatibility | private `rank_items_v0` implementation via `supabase/migrations/20260831093000_prediction_v0_foundation.sql` and later scorer migrations | Proven generic candidate-pool/scorer retained as the V1 baseline. Direct authenticated execution is revoked by Sprint 013 so requests enter through the traceable V1 boundary |
| Prediction V1 nervous system | `public.rank_items_v1` + private memory/scenario helpers in `supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`; mobile call in `apps/mobile/src/features/discovery/predictionOperations.ts` | #156 local first slice: authorized server-owned ranking, immutable run/candidate trace, deterministic working/short/long memory snapshot and inspectable ScenarioMemory reranking. Hosted application/device acceptance remain open |
| Prediction design | `docs/domain/PREDICTION_MODEL.md`, `docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`, `docs/project/sprints/SPRINT-013.md` | Canonical five-memory model and controlled SleepLayer: immutable genomes, prospective shadows, mature outcome windows, global/cohort/Profile champions, shrinkage, canary/rollback and manual MVP promotion |
| Shared membership | `supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`, `20260831172000_fix_shared_profile_member_conflict.sql` | Existing `profiles` + accepted `profile_members`, membership-scoped visibility and 2+ readiness |
| Shared invitations | `supabase/migrations/20260831200429_shared_profile_invitations.sql` | Pending consent separate from accepted membership; invite/list/respond RPCs and authorization |
| Profile lifecycle | `supabase/migrations/20260901082902_profile_lifecycle_limits_and_leave.sql` | 24/32 identity limits, safe Shared leave lifecycle and hardened PersonalProfile completion wrapper |
| List persistence | `supabase/migrations/20260901204135_profile_scoped_item_lists.sql`, `20260902134621_shared_list_approval_flow.sql` | Generic Lists plus pending Shared target-List approval: one member proposes, other accepted members approve, and unanimity atomically commits the chosen custom entry + Shared `Tallennetut`; explicit grants/RLS and guarded direct Shared insertion |
| Shared Endorsement | `supabase/migrations/20260901122000_shared_endorsement_state.sql`, `20260901124000_shared_endorsement_item_index.sql`, `20260901150500_shared_discovery_overlay.sql`, `20260901182156_shared_member_history_delivery.sql` | #151 foundation + prediction-core-independent delivery: membership-scoped actor/Profile/Item state, idempotent RPCs, consensus -> Shared Saved, pending provenance and mobile queue integration. Member Personal history is a lower attributed delivery tier; Shared current state remains suppressing. Common-fit stays gated by #156 |
| Shared Saved integrity | `supabase/migrations/20260902074500_shared_saved_consensus_integrity.sql` | Durable reached-consensus record and RLS guard prevent direct Shared interaction writes from forging, clearing or deleting unanimity-owned Saved state |
| Messaging | `apps/mobile/src/features/messages/`, `apps/mobile/app/messages/`, `supabase/migrations/20260902182643_profile_messaging_foundation.sql` | #138 hosted foundation: typed retry-safe RPC boundary/provider, combined Inbox activity/unread state, Profile thread UI, failed drafts and optional Profile/List/Item contextual message; configured-device acceptance remains deferred |
| DB migrations | `supabase/migrations/` | Identity/current state, Event persistence, Prediction V0/V1 evidence, feedback/cooldown, Shared membership/invitations/lifecycle, Endorsement, Profile-scoped Lists and Profile messaging with explicit grants/RLS |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; main also builds/verifies/uploads standalone Android APK |

Do not create empty feature folders merely to match future architecture. Shared collaboration and Lists extend generic Profile/Item boundaries rather than creating `GroupTaste`, media-specific queues or a second recommender.
