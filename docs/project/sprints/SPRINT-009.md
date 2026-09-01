# Sprint 009 — Shared Kajo

Status: **COMPLETE**
Milestone: **MVP 0.1**
Started: **2026-08-31**
Accepted: **2026-09-01**

## Goal

Add the first persistent multi-user Kajo context without creating parallel social, Item, Event or Prediction architectures. A SharedProfile is a normal Profile target with 2-N accepted members, its own state/history/theme and actor-specific Events.

## Accepted MVP requirements

- `MVP-PROFILE-002`
- `MVP-ROOM-006`
- `MVP-SOCIAL-001`
- `MVP-SOCIAL-002`

The original `MVP-SOCIAL-003` suggestion experiment was superseded after acceptance by the new Sprint 011 Shared endorsement requirements. It is not considered an incomplete Sprint 009 defect.

## Delivered

### SharedProfile foundation

- persistent `profiles.profile_type = 'SHARED'` using the existing generic Profile model,
- accepted `profile_members` membership and typed active Profile scope,
- SharedProfile Event/current-state/Prediction operations use Shared `profileId` while preserving actual signed-in `actorUserId`,
- deterministic Shared Room/theme identity separate from DiscoveryMode.

### Consent-based invitations — #128 / PR #131

- pending invitations are separate from accepted membership,
- invite by nickname does not add membership until invitee accepts,
- invite list/accept/reject are typed authenticated RPC flows,
- rejected/responded invitations disappear without auth email exposure,
- legacy direct-add path cannot bypass consent.

Hosted verification:

- invitation rollback suite: **13/13 pass**,
- production-RPC smoke: **4/4 pass**,
- no QA residue persisted.

Migration: `20260831200429_shared_profile_invitations.sql`.

### Seamless Profile hydration — #130 / PR #132

- the signed-in actor's first configured interaction hydration may block,
- later Personal ↔ Shared switches keep shell/current route mounted,
- writes stay blocked until the newly selected Profile's interaction state is hydrated.

### Global Profile switching + Inbox — #129 / PR #133

- active Personal/Shared identity is globally visible,
- Profile switcher uses the persistent shell rather than a dedicated Shared Room wall object,
- pending invitations are exposed through a lightweight global Inbox,
- membership/invitation state refreshes while clients stay open.

## Acceptance history

### First configured Android run — failed

It exposed four real defects:

1. inviting another User added membership immediately instead of requiring consent,
2. ready SharedProfile `Jeejee` had **0 Shared item_interactions and 0 Shared Events** while PersonalProfiles held persisted activity,
3. Profile switching showed the Kajo startup/loading state,
4. the original dedicated Shared Room wall entry was the wrong navigation model.

The sprint remained open until these defects were fixed.

### Corrected configured Android run — accepted

Configured-device review on 2026-09-01 reported the corrected Shared flow working.

Hosted evidence from that real use confirmed:

- SharedProfile interactions persisted under the Shared `profileId`,
- Shared Events retained the real acting User for both members,
- Personal/Shared state remained isolated even for the same Item IDs,
- Shared Prediction V0 impressions remained prediction-traceable,
- invitation/membership authorization had already passed hosted rollback/smoke verification.

Issue **#125** was closed on 2026-09-01.

## Superseded experiment — `Ehdota yhteiseen`

Sprint 009 initially shipped a separate Item-detail `Ehdota yhteiseen` action emitting `ITEM_SUGGESTED` as append-only evidence without changing current Item state.

During the final product review this interaction was intentionally retired. It does not match the desired Shared Kajo model: Shared recommendations should already represent common taste, and one member's positive action should become pending collaboration state for the other members rather than a parallel suggestion feature.

Therefore:

- no fake `ITEM_SUGGESTED` device Event was created merely to satisfy the old checklist,
- `ITEM_SUGGESTED` remains historical/deprecated evidence for old rows only,
- the visible panel/helper is removed under #149 / PR #150,
- replacement semantics are implemented under Sprint 011/#151 (`Endorsement` + unanimity -> Shared saved state).

## Durable decisions

- One generic `Profile` architecture serves PersonalProfile and SharedProfile.
- `profile_members` means accepted membership only.
- Pending invitations are separate social delivery state.
- Auth email is not SharedProfile identity/discovery data.
- Shared Kajo is a Profile/place, not a filter or separate recommender.
- Shared actions retain actual actor User separately from Profile context.
- Shared visual identity and DiscoveryMode remain separate.
- No media-specific Shared predictor/model was introduced.

## Important files

- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/auth/AuthGate.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`
- `/supabase/migrations/20260831200429_shared_profile_invitations.sql`

## Handoff

Sprint 009 is historical and accepted. Do not reopen the old separate suggestion architecture. Current order is Sprint 010 navigation polish → Sprint 011/#151 Shared endorsement/common discovery → Sprint 011/#102 Lists.