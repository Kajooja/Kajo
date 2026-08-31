# Sprint 009 — Shared Kajo

Status: **ACTIVE**
Milestone: **MVP 0.1**
Started: **2026-08-31**

## Goal

Add the first persistent multi-user Kajo context without creating parallel social,
Item, Event or Prediction architectures. A SharedProfile is a normal Profile target
with 2-N members, its own state/history and actor-specific Events.

## Relevant MVP requirements

- `MVP-PROFILE-002`
- `MVP-ROOM-006`
- `MVP-SOCIAL-001`
- `MVP-SOCIAL-002`
- `MVP-SOCIAL-003`

## Scope

- Create/manage persistent SharedProfiles with at least two members.
- Reuse existing `profiles` + `profile_members` and Profile membership authorization.
- Let the authenticated user select the active PersonalProfile or a SharedProfile.
- Keep `actorUserId` separate from active `profileId` for every shared-context Event/action.
- Reuse existing generic Item interaction persistence and Prediction V0 for SharedProfiles.
- Provide shared saved/history/discovery semantics through the same generic boundaries.
- Add a minimal shared Room/theme identity and member suggestion action.
- Validate membership isolation and configured Android flows.

## Non-goals

- Public social graph, followers, feed or influencer mechanics.
- General messaging/chat.
- Separate SharedProfile-specific prediction model.
- ScenarioMemory or vector retrieval.
- Named/custom lists.
- Complex Room editor or final art assets.

## Implementation order

1. SharedProfile creation/member persistence + RLS/RPC boundary. **Complete (#111).**
2. Typed mobile SharedProfile listing and active Profile context. **Complete (#115).**
3. Typed create/member mutation boundary. **Complete (#118).**
4. Room entry + visible SharedProfile setup/selection flow. **Complete (#117).**
5. Stable SharedProfile-specific Room/theme identity. **Active (#121).**
6. Verify shared discovery/saved/current-interaction behavior through existing boundaries.
7. Add traceable member suggestion behavior.
8. Configured Android and hosted authorization/Event acceptance.

## Definition of Done

- A signed-in User can belong to one PersonalProfile and multiple SharedProfiles.
- A SharedProfile cannot operate with fewer than two members in accepted product flow.
- Non-members cannot read or mutate SharedProfile-scoped state.
- SharedProfile actions retain the actual actor User separately from Profile context.
- Existing Prediction V0 ranks the SharedProfile without a media/social-specific scorer.
- Shared saved/history/discovery work through existing generic Item contracts.
- Shared Room/theme identity exists without changing PersonalProfile identity.
- One member can create a traceable suggestion in SharedProfile context.
- CI, hosted advisors/RLS verification and configured Android acceptance pass.

## Delivered

### #111 — SharedProfile membership foundation

- Reuses `profiles.profile_type = 'SHARED'` and `profile_members`; no parallel SharedProfile table.
- `create_shared_profile(name)` creates a provisional one-member SharedProfile.
- `add_shared_profile_member(profileId, nickname)` resolves existing Kajo Users by case-insensitive nickname and requires existing membership from the actor.
- `get_my_shared_profiles()` returns only memberships visible to the current User and exposes member user id + display-cased nickname, never auth email.
- Product-ready SharedProfile semantics begin at 2+ members.
- Public authenticated RPC wrappers are `SECURITY INVOKER`; privileged helpers remain in `private`.
- PR #113 merged/deployed. PR #114 fixed the hosted-test PL/pgSQL conflict-target ambiguity.
- Rollback-only hosted acceptance passed provisional creation, second-member addition, readiness, duplicate idempotency, creator/member listing, outsider isolation, non-member denial and email-free payload.

### #115 — Active Profile context

- PR #116 merged after lint, TypeScript, tests and both bundle smokes passed.
- PersonalProfile remains the safe default.
- Only ready 2+ member SharedProfiles are selectable.
- Event tracking, Item interaction hydration/persistence and Prediction V0 use the active `profileId` while keeping the signed-in User as `actorUserId`.

### #118 — Typed SharedProfile mutations

- PR #119 merged after full CI.
- `sharedProfileOperations` owns typed list/create/add-member RPC calls and payload validation.
- Shared Kajo name is validated at 2–64 characters and member nickname at 2–32 characters before backend calls.
- Display casing is preserved and backend details are not exposed in presentation errors.

### #117 — Room entry and Shared Kajo setup/selection flow

- PR #120 merged after lint, TypeScript, all tests and iOS/Android bundle smoke passed.
- Main standalone Android APK also built, embedded JS bundle verification passed and the APK artifact uploaded successfully.
- Adds one restrained Shared Kajo wall object in the Room.
- Adds `/profiles/shared` and `SharedProfilesScreen`.
- PersonalProfile remains an always-available safe return choice.
- Ready/provisional SharedProfiles and member nicknames are visible.
- SharedProfile creation and nickname-based member addition stay behind `ActiveProfileProvider` and the typed operations boundary; screens do not call Supabase directly.
- Only ready 2+ member SharedProfiles can be activated.
- Room identity shows `OMA KAJO` or `YHTEINEN KAJO` according to the active Profile.

## Active issue

### #121 — Stable Shared Room theme identity

- Extend the existing Room theme resolver instead of creating a parallel SharedProfile theme system.
- Preserve PersonalProfile base tokens exactly.
- Select one of a small restrained SharedProfile base-theme set deterministically from `profileId`, so every member/device sees the same identity without new persistence.
- Keep DiscoveryMode ambient overlays (`DAWN`, `EVENING`, `NIGHT`) fully independent from visual Profile identity.
- The global DiscoveryMode shell, Room and discovery grid consume the active Profile theme directly.
- Large content surfaces such as Item detail and Shared setup receive the same subtle SharedProfile identity through the global shell tint, avoiding duplicated screen-level theme architecture.
- Theme tests cover PersonalProfile compatibility, same-id stability, shared variation and ambient independence.

## Decisions

- Do not add a second SharedProfile table.
- Creation with one provisional member is allowed only as setup state; product-ready use begins at two members.
- Nickname is the MVP member-discovery identifier; authentication email remains outside the SharedProfile API/UI.
- Existing `private.is_profile_member` remains the authorization primitive.
- PersonalProfile remains the safe default active context.
- Shared Kajo is entered from the Room and should feel like entering another place, not changing a filter.
- SharedProfile visual identity and DiscoveryMode/risk remain separate concepts.
- MVP shared theme identity is deterministic rather than persisted; later explicit customization can replace it without changing Profile or DiscoveryMode contracts.

## Important files

- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/product/MVP.md`
- `/apps/mobile/app/profiles/shared.tsx`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/profiles/activeProfileState.ts`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/apps/mobile/src/theme/roomTheme.test.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`

## Handoff

#111, #115, #118 and #117 are complete. #121 is active. Finish its CI gate, then
verify shared discovery/save/rating/Prediction/Event behavior in configured runtime.
After that, add traceable `ITEM_SUGGESTED` behavior and run Sprint 009 Android/hosted
acceptance. Do not start ScenarioMemory or a separate shared predictor.
