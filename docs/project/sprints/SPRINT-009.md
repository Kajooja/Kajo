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

1. SharedProfile creation/member persistence + RLS/RPC boundary. **Complete.**
2. Typed mobile SharedProfile operations and active Profile context. **Active (#115).**
3. Shared discovery/saved/current interaction behavior through existing boundaries.
4. Shared Room/theme identity and suggestion Event/state behavior.
5. Configured Android and hosted authorization acceptance.

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

The first slice reuses the existing generic tables and adds a small server-owned
operation boundary:

- `create_shared_profile(name)` creates a `SHARED` Profile and adds the actor as
  the first member.
- `add_shared_profile_member(profileId, nickname)` resolves an existing Kajo User
  by case-insensitive nickname and adds them only when the actor is already a
  member of that SharedProfile.
- `get_my_shared_profiles()` returns only SharedProfiles the actor belongs to,
  member count/readiness and member `userId` + display-cased nickname.
- One-member profiles are persisted but reported `isReady = false`; accepted UI
  must not treat the SharedProfile as usable until member count reaches at least two.
- Privileged writes/lookups live only in the non-exposed `private` schema.
  Public authenticated RPC wrappers remain `SECURITY INVOKER`.
- No email or auth credential is returned by the SharedProfile boundary.
- PR #113 merged and deployed. Hosted rollback testing found one PL/pgSQL conflict
  target ambiguity; PR #114 fixed it using the named `profile_members_pkey`.
- The corrected rollback-only hosted acceptance passed all checks: provisional
  creation, case-insensitive second-member addition, 2+ readiness, duplicate
  idempotency, creator/member listing, outsider isolation, non-member add denial
  and email-free member payload. Test rows were rolled back.
- Security/performance advisors showed no new SharedProfile-specific warning.

## Active issue

### #115 — Active Profile context in mobile

- Add typed mapping for `get_my_shared_profiles()`.
- Keep PersonalProfile as the default active Profile.
- Only ready 2+ member SharedProfiles are selectable.
- Shared-list loading/errors stay independent from the personal flow.
- Refactor Event, Item-interaction and Prediction scopes to use one active Profile
  while preserving the signed-in User as `actorUserId`.
- Visible Profile selection UI remains a later bounded slice.

## Decisions

- Do not add a second SharedProfile table: `profiles.profile_type = 'SHARED'` and
  `profile_members` already represent the required core relation.
- Creation with one provisional member is allowed as setup state; product-ready
  SharedProfile semantics begin at two members.
- Nickname is the MVP member-discovery identifier; authentication email remains
  outside the SharedProfile API.
- Existing `private.is_profile_member` remains the authorization primitive.
- PersonalProfile remains the safe default active context; SharedProfile loading
  must never block the existing personal app flow.

## Important files

- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/product/MVP.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`

## Handoff

#111 is complete and host-verified. #115 is active. Finish the generic mobile
Profile scope and tests before exposing Profile switching in UI. Preserve
Profile-targeted Prediction and actor-vs-profile Event separation; do not begin
ScenarioMemory or a separate shared predictor.
