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
5. Stable SharedProfile-specific Room/theme identity. **Complete (#121).**
6. Traceable SharedProfile Item suggestion behavior. **Active (#123).**
7. Verify shared discovery/saved/current-interaction/Prediction/Event behavior in configured runtime.
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
- Hosted rollback-only acceptance passed membership/readiness/isolation/email-free payload checks.

### #115 — Active Profile context

- PR #116 merged after full CI.
- PersonalProfile remains the safe default.
- Only ready 2+ member SharedProfiles are selectable.
- Event tracking, Item interaction hydration/persistence and Prediction V0 use the active `profileId` while keeping the signed-in User as `actorUserId`.

### #118 — Typed SharedProfile mutations

- PR #119 merged after full CI.
- `sharedProfileOperations` owns typed list/create/add-member RPC calls and payload validation.
- Shared Kajo name is validated at 2–64 characters and member nickname at 2–32 characters before backend calls.
- Display casing is preserved and backend details are not exposed in presentation errors.

### #117 — Room entry and Shared Kajo setup/selection flow

- PR #120 merged after full CI.
- Main standalone Android APK built successfully, embedded JS bundle verification passed and the artifact uploaded.
- Adds the Room Shared Kajo object, `/profiles/shared`, creation/member setup, ready/provisional cards, Personal fallback and ready-profile activation.
- Screens remain Supabase-free.

### #121 — Stable Shared Room theme identity

- PR #122 merged after lint, TypeScript, all tests and both bundle smokes passed.
- PersonalProfile base tokens remain unchanged.
- SharedProfile base identity is selected deterministically from `profileId` from a small restrained palette set, requiring no new persistence.
- DiscoveryMode ambient phases remain independent from Profile visual identity.
- Global shell, Room and discovery grid follow active Profile identity; shell-level tint carries the identity across remaining content surfaces without a parallel theme provider.

## Active issue

### #123 — Traceable Item suggestion

- Reuse canonical `ITEM_SUGGESTED`; no schema/EventType expansion is needed.
- The action appears only for a valid Item detail while a ready SharedProfile is active.
- The shell resolves the current Item using route context, avoiding a parallel social implementation inside the large Item detail component.
- One tap records `ITEM_SUGGESTED` through existing `EventTrackingContext`, preserving the real actor User and active SharedProfile.
- `properties.source = 'ITEM_DETAIL'` and current `DiscoveryMode` are retained.
- Suggestion does not mutate save/rating/not-interested/consumed state and creates no message/feed/read-state table.
- Existing Event persistence retry behavior is reused.
- Pure eligibility/Event-input tests are included.

## Decisions

- Do not add a second SharedProfile table or predictor.
- Provisional one-member SharedProfiles are setup state only; product-ready use begins at two members.
- Nickname is the MVP member-discovery identifier; auth email stays outside SharedProfile UI/API.
- PersonalProfile remains the safe default active context.
- Shared Kajo is entered from the Room and should feel like another place, not a filter.
- SharedProfile visual identity and DiscoveryMode/risk remain separate concepts.
- MVP shared theme identity is deterministic rather than persisted; later customization can replace it without changing Profile/DiscoveryMode contracts.
- `ITEM_SUGGESTED` is append-only behavioral evidence, not chat or Item current state.

## Important files

- `/docs/domain/DATA_EVENTS.md`
- `/docs/product/MVP.md`
- `/apps/mobile/app/profiles/shared.tsx`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/discovery/sharedSuggestion.ts`
- `/apps/mobile/src/features/discovery/sharedSuggestion.test.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`

## Handoff

#111, #115, #118, #117 and #121 are complete. #123 is active. Finish its CI gate,
then verify SharedProfile save/rating/Prediction/Event behavior in configured Android/
hosted runtime before closing Sprint 009. Preserve the generic Profile architecture and
do not begin ScenarioMemory or a separate shared predictor.
