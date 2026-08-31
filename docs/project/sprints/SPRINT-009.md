# Sprint 009 — Shared Kajo

Status: **ACTIVE — FINAL ACCEPTANCE (#125)**
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

## Implementation status

1. SharedProfile creation/member persistence + authorization. **Complete (#111).**
2. Typed SharedProfile listing and generic active Profile scope. **Complete (#115).**
3. Typed create/member mutation boundary. **Complete (#118).**
4. Room entry + visible setup/selection flow. **Complete (#117).**
5. Stable SharedProfile-specific Room/theme identity. **Complete (#121).**
6. Traceable SharedProfile Item suggestion behavior. **Complete (#123).**
7. Hosted SharedProfile pre-acceptance. **Complete — 14/14 rollback checks passed.**
8. Configured Android end-to-end acceptance. **Active (#125).**

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
- Provisional creation, nickname-based member addition and membership-only listing are server-owned RPC operations.
- Product-ready SharedProfile semantics begin at 2+ members.
- Public authenticated wrappers remain `SECURITY INVOKER`; privileged helpers stay in `private`.
- Auth email is not exposed through the SharedProfile boundary.

### #115 / #118 — Mobile Profile/data boundaries

- `ActiveProfileProvider` keeps PersonalProfile as the safe default and only exposes ready SharedProfiles as selectable.
- Event tracking, Item interaction hydration/persistence and Prediction V0 use active `profileId`; signed-in User remains `actorUserId`.
- `sharedProfileOperations` owns typed list/create/add-member calls, validation and user-facing error mapping.

### #117 — Visible Shared Kajo flow

- Room has one restrained Shared Kajo entrance.
- `/profiles/shared` supports Personal fallback, ready/provisional SharedProfiles, member display, creation, nickname member add and ready-profile activation.
- Screens do not call Supabase directly.
- PR #120 main APK built and embedded JS bundle verification passed.

### #121 — Shared Room identity

- PR #122 merged after full CI.
- PersonalProfile base tokens remain unchanged.
- SharedProfile base identity is deterministic from `profileId` using a small restrained palette set, requiring no persistence.
- DiscoveryMode ambient/risk remains independent from visual identity.

### #123 — Traceable Item suggestion

- PR #124 merged after lint, TypeScript, tests and both bundle smokes passed.
- A valid Item detail inside a SharedProfile exposes one restrained `Ehdota yhteiseen` action.
- The action writes canonical append-only `ITEM_SUGGESTED` through existing EventTracking.
- Event retains active SharedProfile, actual actor User, Item, ItemType, DiscoveryMode and `properties.source = 'ITEM_DETAIL'`.
- Suggestion does not mutate save/rating/not-interested/consumed state and creates no chat/feed/read-state table.
- Existing retry-safe Event persistence is reused.

## Hosted pre-acceptance — passed 14/14

A rollback-only transaction created temporary Users A/B/C through the real auth provisioning trigger and exercised production RLS/RPCs as the `authenticated` role with JWT subjects.

Passed checks:

- all three PersonalProfiles provisioned,
- SharedProfile created provisional at one member,
- B added case-insensitively and SharedProfile became ready at two members,
- A's shared saved/rated Item state stayed separate from A's PersonalProfile,
- A's `ITEM_SUGGESTED` Event retained correct actor/Profile/Item/type/mode/source,
- B listed the SharedProfile,
- B read A's shared Item state,
- B read the suggestion while actor remained A,
- Prediction V0 returned ranked Items for B in the SharedProfile,
- outsider C could not list the SharedProfile,
- C could not read shared interactions,
- C could not read shared Events,
- C's Prediction request was denied with `42501`,
- C's shared interaction write was rejected by RLS.

All test rows were rolled back.

Security/performance advisors showed no new Sprint 009-specific findings. Existing warnings remain separately tracked technical debt: public/authenticated legacy SECURITY DEFINER functions, leaked-password protection disabled, and currently unused Event/session indexes. Do not delete indexes solely because this small test workload has not exercised them.

## Active issue — #125 configured SharedProfile end-to-end acceptance

The remaining gate is real Android behavior with two Kajo accounts. Validate:

1. A creates/adds B and both see the same ready SharedProfile without auth email exposure.
2. Personal ↔ Shared switching changes Room identity/theme and restores the correct context without restart.
3. Shared save/rating state persists and is isolated from PersonalProfile.
4. B sees the same shared current Item state while B's PersonalProfile remains separate.
5. Prediction V0 ranks the SharedProfile for both members.
6. `Ehdota yhteiseen` persists `ITEM_SUGGESTED` without changing Item current state.
7. Logo → Room, DiscoveryMode and existing personal flows remain intact.

Only after this device acceptance should Sprint 009 and its MVP requirements be marked complete.

## Decisions

- No second SharedProfile table or predictor.
- One-member SharedProfile is setup state only.
- Nickname is the MVP member-discovery identifier; auth email stays outside SharedProfile UI/API.
- Shared Kajo is a Profile/place, not a filter.
- Shared visual identity and DiscoveryMode remain separate.
- `ITEM_SUGGESTED` is behavioral evidence, not messaging or current Item state.
- ScenarioMemory remains out of Sprint 009.

## Important files

- `/docs/domain/DATA_EVENTS.md`
- `/docs/product/MVP.md`
- `/apps/mobile/app/profiles/shared.tsx`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/discovery/sharedSuggestion.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`

## Handoff

All Sprint 009 implementation slices are merged. #125 is the final configured Android
acceptance gate. Hosted pre-acceptance is 14/14 green and rollback-clean. Do not add new
social architecture before device acceptance; fix only concrete failures. Do not begin
ScenarioMemory early.
