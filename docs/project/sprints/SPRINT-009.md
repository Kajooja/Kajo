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
4. Room entry + visible SharedProfile setup/selection flow. **Active (#117).**
5. Verify shared discovery/saved/current-interaction behavior through existing boundaries.
6. Add shared Room/theme identity and suggestion Event/state behavior.
7. Configured Android and hosted authorization/Event acceptance.

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
- PR #113 merged/deployed. PR #114 fixed a hosted-test PL/pgSQL conflict-target ambiguity using `profile_members_pkey`.
- Rollback-only hosted acceptance passed provisional creation, second-member addition, readiness, duplicate idempotency, creator/member listing, outsider isolation, non-member denial and email-free payload.
- Advisors showed no new SharedProfile-specific warning.

### #115 — Active Profile context

- PR #116 merged after lint, TypeScript, tests and both bundle smokes passed.
- Adds one `ActiveProfileProvider` after PersonalProfile identity.
- PersonalProfile remains the default active Profile.
- Only ready 2+ member SharedProfiles are selectable.
- Shared-list loading/error/retry does not block the personal flow.
- Event tracking, Item interaction hydration/persistence and Prediction V0 use the active `profileId` while keeping the signed-in User as `actorUserId`.
- Profile switches re-scope Event sessions, interaction hydration and prediction ranking without adding media/social-specific variants.

### #118 — Typed SharedProfile mutations

- PR #119 merged after full CI.
- `sharedProfileOperations` now owns typed list/create/add-member RPC calls and payload validation.
- Shared Kajo name is validated at 2–64 characters and member nickname at 2–32 characters before backend calls.
- Display casing is preserved; backend details are not exposed in presentation errors.
- Missing nickname is distinguished from a stale/missing SharedProfile without broadening API data exposure.

## Active issue

### #117 — Room entry and Shared Kajo setup/selection flow

Current branch adds:

- one restrained Shared Kajo wall object in the Room rather than dashboard navigation,
- `/profiles/shared` route and `SharedProfilesScreen`,
- PersonalProfile as an always-available safe return choice,
- ready/provisional SharedProfile cards and member display,
- one-field SharedProfile creation and nickname-based member addition through provider actions,
- activation only for ready 2+ member SharedProfiles,
- active Room identity text (`OMA KAJO` vs `YHTEINEN KAJO`) without yet claiming final Shared Room artwork/theme completion.

Presentation remains Supabase-free; mutations are exposed through `ActiveProfileProvider` and the typed profile operations boundary.

## Decisions

- Do not add a second SharedProfile table.
- Creation with one provisional member is allowed only as setup state; product-ready use begins at two members.
- Nickname is the MVP member-discovery identifier; authentication email remains outside the SharedProfile API/UI.
- Existing `private.is_profile_member` remains the authorization primitive.
- PersonalProfile remains the safe default active context.
- Shared Kajo is entered from the Room and should feel like entering another place, not changing a filter.
- #117 changes active Profile identity/navigation but does not mark `MVP-ROOM-006` complete until a real SharedProfile-specific Room/theme identity exists.

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
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`

## Handoff

#111, #115 and #118 are complete. #117 is active. Finish its CI/runtime boundary,
then verify that shared discovery, saving/rating and Prediction V0 genuinely use the
selected SharedProfile while Event rows retain the acting User. After that, implement
the minimal SharedProfile-specific Room/theme identity and traceable `ITEM_SUGGESTED`
action. Do not start ScenarioMemory or a separate shared predictor.
