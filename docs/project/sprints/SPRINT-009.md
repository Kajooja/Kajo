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

1. SharedProfile creation/member persistence + RLS/RPC boundary.
2. Typed mobile SharedProfile operations and active Profile context.
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

## Planned first issue

Create one bounded backend foundation for SharedProfile creation, member lookup/addition
and membership-protected reads before introducing active-profile UI state.

## Important files

- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/product/MVP.md`
- `/apps/mobile/src/domain/contracts.ts`
- `/apps/mobile/src/features/profiles/`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/features/discovery/`
- `/supabase/migrations/`

## Handoff

Sprint 008 is complete. Start with existing `profiles`/`profile_members`; do not add
a parallel SharedProfile table unless a verified invariant cannot be represented by
the current generic Profile model. Preserve Profile-targeted Prediction and
actor-vs-profile Event separation.
