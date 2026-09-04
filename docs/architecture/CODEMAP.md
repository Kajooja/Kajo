# Kajo Code Map

This file answers: **where is the important implementation?**

Update it when meaningful implementation areas are created, moved or renamed. Do not list every source file.

## Current repository

Sprints 001–010 are accepted. Sprint 011/#151 Shared discovery/Endorsement is accepted; #102 named Lists and Sprint 012/#138 messaging are hosted with refreshed configured-Android acceptance deferred. **Sprint 013/#156 Prediction nervous system + controlled SleepLayer, #174 reacted-Item resurfacing and #175 bottom Profile quick access are accepted.** Current polish refines shell/bootstrap presentation; #182 real catalog and #177 Shared common-fit follow.

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
| Mobile app | `apps/mobile/` | Expo SDK 57 / TypeScript application; configured Personal/Shared auth, persistence, Event and Prediction flows are phone-runnable |
| Expo Router entry | `apps/mobile/app/_layout.tsx`, `apps/mobile/app/` | Root provider composition + route stack; authenticated routes share one persistent `DiscoveryModeShell`; auth callbacks bypass bootstrap loading interception |
| Bootstrap loading | `apps/mobile/src/features/auth/BootstrapLoadingGate.tsx`, `apps/mobile/src/features/branding/KajoBrand.tsx` | Real session/Profile/interaction hydration drives the single Kajo-logo loading surface; the old arbitrary fixed two-second splash delay is removed |
| Global app shell | `apps/mobile/src/features/discovery/DiscoveryModeShell.tsx` | Top Kajo Home mark + global curtain; bottom menu / `BottomProfileControl` / rounded Inbox glyph; one persistent Room backdrop; side drawer remains the full Profile/Lists/Groups/account surface |
| Bottom Profile quick access | `apps/mobile/src/features/profiles/BottomProfileControl.tsx`, `sharedProfileQuickAccess.ts`, `sharedProfileRecentUse.ts` | #175 accepted on configured Android: bottom active Profile identity opens at most five actor-local usage/recency-ranked SharedProfiles; selection reuses `ActiveProfileContext`; `Näytä lisää` routes to canonical Groups; ordering persists through SQLite-backed `expo-sqlite/kv-store` |
| Core domain contracts | `apps/mobile/src/domain/` | Generic Profile/Item/Event/Context/Prediction/DiscoveryMode contracts; no media-specific user/predictor architecture |
| Canonical Item catalog | `public.items`, foundation migration `20260826203000_backend_foundation.sql`, mock seeds `20260827073000_seed_mvp_items.sql` + `20260831163000_expand_mvp_candidate_catalog.sql` | Current active catalog is still seeded `KAJO_MOCK` BOOK/MOVIE data. #182 owns generic provider provenance/dedup/lifecycle plus real provider-backed imports; historical mocks must remain referentially intact and later become non-discoverable rather than deleted |
| Room feature | `apps/mobile/src/features/room/RoomScreen.tsx`, `apps/mobile/src/features/room/roomGeometry.ts`, Room assets | Accepted straight-on illustrated cabin; window/fireplace Kajo and TV/bookshelf targets remain the canonical Room vocabulary |
| Theme engine | `apps/mobile/src/theme/` | Personal/Shared stable identity plus DiscoveryMode-driven AmbientPhase and centralized translucent surface tokens |
| Discovery feature | `apps/mobile/src/features/discovery/` | Grid/detail/swipe, Prediction V1 wiring, impression/dwell evidence, rating/not-interested/save, undo/cooldown and Shared Endorsement overlay; provider integrations must normalize to generic Items before reaching this layer |
| Interaction persistence | `apps/mobile/src/features/discovery/ItemInteractionContext.tsx` | Active-Profile current-state hydration/persistence with safe Profile switching |
| Event Engine | `apps/mobile/src/features/events/` | Root-scoped append boundary; session ID is shared with Prediction context; actor User and target Profile remain separate |
| Profiles | `apps/mobile/src/features/profiles/ActiveProfileContext.tsx`, `SharedProfilesScreen.tsx`, `sharedProfileOperations.ts` | One canonical Profile state/membership boundary for Personal identity, Shared create/invite/respond/leave and selection; quick access is local presentation ordering only |
| Lists | `apps/mobile/src/features/lists/`, `apps/mobile/app/lists/` | Profile-scoped system/custom Lists, compact recent destination picker, browsing/filter/sort and Shared provenance; refreshed device acceptance deferred |
| Shared Kajo route | `apps/mobile/app/profiles/shared.tsx`, `apps/mobile/src/features/profiles/SharedProfilesScreen.tsx` | Canonical full Shared management page; bottom `Näytä lisää` routes here rather than creating another group surface |
| Auth gate | `apps/mobile/src/features/auth/AuthGate.tsx`, `BootstrapLoadingGate.tsx`, `apps/mobile/src/features/profiles/PersonalProfileProvider.tsx` | Auth/profile onboarding and bounded post-login hydration retry; bootstrap loading is presentation only and error/recovery semantics stay in AuthGate |
| Mobile data boundary | `apps/mobile/src/data/` | Supabase configured/unconfigured connection and root provider; presentation avoids scattered direct DB access; future catalog provider secrets stay server-side |
| Authentication | `apps/mobile/app/auth/`, `apps/mobile/src/features/auth/` | Persisted auth, unique email/nickname registration, email-or-nickname login, confirmation/recovery callbacks |
| Password auth boundary | `supabase/functions/password-auth/` | Server-side email/nickname resolution without exposing privileged keys |
| Auth email callback | `supabase/functions/auth-callback/` | HTTPS callback forwarding verification token hashes to mobile |
| Prediction V0 baseline | historical V0 migrations; current private `rank_items_v0` after `20260904180000_sleep_layer_v1_serving_and_profile_canary.sql` | One proven V0.3 baseline candidate generator retained privately. `public.rank_items_v0` is only a non-serving baseline compatibility wrapper and authenticated execution remains revoked |
| Prediction V1 nervous system | `public.rank_items_v1`, private V1 helpers in `20260902223000_prediction_nervous_system_v1.sql`, forward fix `20260904120420_fix_prediction_v1_candidate_returning.sql`, resurfacing policy `20260904183000_reacted_item_resurfacing_policy_v1.sql`, mobile `predictionOperations.ts` | Hosted + configured-device accepted core with #174 policy extension: authorized Profile-targeted ranking, immutable run/candidate trace, Working/Short/Long snapshot, same-Profile ScenarioMemory, reacted-Item suppression/saved-reminder eligibility and fallback distinction |
| Reacted-Item resurfacing V1 | `supabase/migrations/20260904183000_reacted_item_resurfacing_policy_v1.sql` | #174 accepted forward policy: consumed/rated/not-interested terminal suppression; saved-only reminder after 30d; 30d reminder cooldown; max 2 reminder impressions/90d; max one reminder/candidate pool; ordinary candidates before reminder; suppression inspectable and Profile-scoped |
| SleepLayer / EvolutionEngine V1 | `supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql`, `20260904172000_sleep_layer_v1_fk_indexes.sql`, `20260904180000_sleep_layer_v1_serving_and_profile_canary.sql` | Accepted 13C slice: immutable scalar genomes, baseline Champion + three SHADOW Challengers, PolicyAssignment tagging, frozen shadow worker, mature exposed-outcome evaluation with Profile shrinkage, genome-aware V1 policy layer, evidence-gated service-only Profile canary and reversible rollback. Automatic/global Challenger promotion remains unavailable |
| Prediction design | `docs/domain/PREDICTION_MODEL.md`, ADR-0005, `docs/project/sprints/SPRINT-013.md` | Canonical five-memory model, controlled evolution contract and versioned resurfacing policy; learned/LLM families and automatic promotion are later gates |
| Shared membership | `20260831171000_shared_profile_membership_foundation.sql`, `20260831172000_fix_shared_profile_member_conflict.sql` | Existing `profiles` + accepted `profile_members`, membership-scoped visibility and readiness |
| Shared invitations | `20260831200429_shared_profile_invitations.sql` | Pending consent separate from accepted membership |
| Profile lifecycle | `20260901082902_profile_lifecycle_limits_and_leave.sql` | Identity limits, safe Shared leave and Personal fallback |
| List persistence | `20260901204135_profile_scoped_item_lists.sql`, `20260902134621_shared_list_approval_flow.sql` | Generic Lists plus pending Shared target-List approval and unanimous commit |
| Shared Endorsement | `20260901122000_shared_endorsement_state.sql`, `20260901124000_shared_endorsement_item_index.sql`, `20260901150500_shared_discovery_overlay.sql`, `20260901182156_shared_member_history_delivery.sql` | Actor/Profile/Item Endorsement state, consensus Saved promotion, pending provenance and member-history delivery tier |
| Shared Saved integrity | `20260902074500_shared_saved_consensus_integrity.sql` | Consensus record + RLS guard prevent forging/clearing unanimity-owned Shared Saved state |
| Messaging | `apps/mobile/src/features/messages/`, `apps/mobile/app/messages/`, `20260902182643_profile_messaging_foundation.sql` | Profile-scoped messaging + Inbox; configured-device acceptance deferred |
| DB migrations | `supabase/migrations/` | Ordered canonical source for hosted schema; deployed migrations are immutable and corrections use forward migrations |
| CI | `.github/workflows/ci.yml` | `npm ci` + lint + typecheck + tests + iOS/Android bundle smoke; main also builds/verifies/uploads standalone Android APK |

Do not create empty feature folders merely to match future architecture. Shared collaboration, Lists, SleepLayer, resurfacing, quick access and provider-backed catalogs extend generic Profile/Item/Event/Prediction boundaries rather than creating media/provider-specific queues, duplicate group state or a second recommender. Deployed migrations are never rewritten after hosting.
