# Sprint 009 — Shared Kajo

Status: **ACTIVE — CONFIGURED ANDROID RE-ACCEPTANCE (#125)**
Milestone: **MVP 0.1**
Started: **2026-08-31**

## Goal

Add the first persistent multi-user Kajo context without creating parallel social,
Item, Event or Prediction architectures. A SharedProfile is a normal Profile target
with 2-N accepted members, its own state/history and actor-specific Events.

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
4. Initial Room entry + visible setup/selection flow. **Complete (#117), later replaced as primary navigation by #129.**
5. Stable SharedProfile-specific Room/theme identity. **Complete (#121).**
6. Traceable SharedProfile Item suggestion behavior. **Complete (#123).**
7. Hosted SharedProfile pre-acceptance. **Complete — original 14/14 rollback checks passed.**
8. First configured Android end-to-end acceptance. **Failed with concrete findings under #125.**
9. Consent-based SharedProfile invitation model. **Complete (#128 / PR #131).**
10. Seamless post-initial Profile interaction hydration. **Complete (#130 / PR #132).**
11. Global Profile switcher + invitation inbox. **Complete (#129 / PR #133).**
12. Configured Android re-acceptance. **Active (#125).**

## Definition of Done

- A signed-in User can belong to one PersonalProfile and multiple SharedProfiles.
- A new SharedProfile cannot gain another accepted member without the invited User's explicit acceptance.
- A SharedProfile cannot operate with fewer than two accepted members in product flow.
- Non-members cannot read or mutate SharedProfile-scoped state.
- SharedProfile actions retain the actual actor User separately from Profile context.
- Existing Prediction V0 ranks the SharedProfile without a media/social-specific scorer.
- Shared saved/history/discovery work through existing generic Item contracts.
- Shared Room/theme identity exists without changing PersonalProfile identity.
- Personal ↔ Shared switching is globally available from the active identity and does not replace the app with startup/auth loading UI after initial actor hydration.
- Pending invitations are visible through a lightweight global inbox and can be accepted/rejected.
- One member can create a traceable suggestion in SharedProfile context.
- CI, hosted advisors/RLS verification and configured Android re-acceptance pass.

## Delivered

### #111 / #115 / #118 — SharedProfile foundation and generic Profile boundaries

- Reuses `profiles.profile_type = 'SHARED'` and `profile_members`; no parallel SharedProfile table.
- `ActiveProfileProvider` keeps PersonalProfile as the safe default and only exposes ready SharedProfiles as selectable.
- Event tracking, Item interaction hydration/persistence and Prediction V0 use active `profileId`; signed-in User remains `actorUserId`.
- Screens stay behind typed data/RPC boundaries and do not call Supabase directly.

### #117 / #121 / #123 — First visible Shared Kajo product slice

- `/profiles/shared` supports Personal fallback, ready/provisional SharedProfiles, member display and creation.
- SharedProfile base identity is deterministic from `profileId` and independent from DiscoveryMode ambient/risk.
- Item detail in a SharedProfile can emit canonical `ITEM_SUGGESTED` without mutating save/rating/not-interested/consumed state.

## Original hosted pre-acceptance — passed 14/14

A rollback-only transaction created temporary Users A/B/C through the real auth provisioning trigger and exercised production RLS/RPCs as the `authenticated` role with JWT subjects.

The original direct-add architecture passed its authorization/state checks:

- all three PersonalProfiles provisioned,
- SharedProfile created provisional at one member,
- B was added and SharedProfile became ready at two members,
- shared saved/rated Item state stayed separate from A's PersonalProfile,
- `ITEM_SUGGESTED` retained correct actor/Profile/Item/type/mode/source,
- B could list/read the SharedProfile state/Event while actor remained A,
- Prediction V0 returned rankings for B,
- outsider C could not list/read/write/predict against the SharedProfile.

All rows were rolled back. This proved the generic authorization boundaries but did not prove the final product membership consent or real-device Profile-switch behavior.

## First configured Android acceptance — failed and produced fixes

The first #125 device run exposed four concrete issues:

1. **Membership consent was wrong.** A adding B by nickname immediately made B a member. Product semantics require a pending invitation that B explicitly accepts or rejects.
2. **Shared context was not reaching persisted user actions.** Existing SharedProfile `Jeejee` had two accepted members, but hosted verification showed **0 `item_interactions` and 0 Events** for that SharedProfile while PersonalProfiles contained persisted activity.
3. **Profile switching was visibly disruptive.** Active Profile changes sent interaction persistence back to hydration and `AuthGate` replaced the app with the Kajo loading/status screen.
4. **Navigation model was wrong.** Shared Kajo should not be primarily entered through a dedicated Room wall object/setup button. Active identity must be globally switchable from the shell.

The sprint stayed open and only these concrete acceptance failures were fixed.

## #128 — invitation-based accepted membership

PR #131 replaced direct member-add product semantics with consent-based invitations.

- New `public.profile_invitations` persists pending invitation state.
- `profile_members` now represents accepted membership only.
- `invite_shared_profile_member` creates/idempotently returns a pending invite instead of membership.
- `get_my_shared_profile_invitations` only returns the signed-in invitee's invitations with group/inviter display context and no auth email.
- `respond_shared_profile_invitation` accepts or rejects; accept inserts membership and removes the invitation atomically, reject only removes the invitation.
- The legacy direct-add RPC implementation maps to invitation behavior so acceptance cannot be bypassed.
- Mobile operations are typed as invite/list/respond rather than direct add-member actions.
- `/profiles/shared` now sends invitations by nickname.

Verification:

- rollback behavior suite: **13/13 passed**,
- production-RPC smoke with the two existing Kajo identities: **4/4 passed**,
- no test rows persisted,
- invitation table RLS enabled,
- no new invitation-specific security advisor warning.

Migration:

- `/supabase/migrations/20260831200429_shared_profile_invitations.sql`

## #130 — seamless Profile hydration

PR #132 fixes the Kajo loading-screen flash without weakening persistence safety.

- `ItemInteractionProvider` records when the current signed-in actor has completed a successful configured interaction hydration.
- `AuthGate` still blocks the actor's **first** configured interaction hydration.
- Later Personal ↔ Shared switches keep the shell and current route mounted while the target Profile hydrates.
- During that hydration, interaction commits remain rejected until persistence status is ready, preventing writes to stale/wrong context.

PR #132 passed lint, TypeScript, tests and iOS/Android bundle smoke before merge.

## #129 — global Profile switcher and invitation inbox

PR #133 implements the requested final navigation model.

- Top-right shell shows Personal nickname or active SharedProfile name.
- Pressing the identity opens a left-side drawer.
- Drawer shows PersonalProfile, bold `Ryhmät`, and up to five ready SharedProfiles.
- Pressing `Ryhmät` opens `/profiles/shared` for full listing/creation/invitation management.
- Selecting a ready Profile changes active context **in place** and closes the drawer; it does not force navigation back to Room.
- Global mail control shows a red badge when invitations exist.
- Mail opens a lightweight overlay with group/inviter context and `Hyväksy` / `Hylkää`.
- Successful invite response removes the message immediately and revalidates the server state.
- Shared memberships and invitation inbox refresh every 30 seconds so already-open clients converge after another member accepts.
- The old Shared Kajo Room wall object and duplicate Room-local profile identity were removed.

PR #133 passed lint, TypeScript, all tests and iOS/Android bundle smoke before merge.
Main commit containing the complete corrected flow: `ce11d7cecac6896eedda338a81abceb04c43cb39`.

## Active issue — #125 configured SharedProfile end-to-end re-acceptance

Use two real Kajo accounts and the standalone APK built from current main. Validate:

1. **Reject path:** A creates a SharedProfile and invites B by nickname. B receives the red mail badge, opens the invite overlay, verifies group/inviter, presses `Hylkää`, invitation disappears and B is not a member.
2. **Accept path:** A invites B again; B presses `Hyväksy`; invitation disappears and both clients converge to the ready 2-member SharedProfile.
3. **Switcher UX:** top-right shows active Personal nickname/group name; identity opens the left drawer; bold `Ryhmät` opens full management; up to five ready groups are directly selectable.
4. **Seamless context:** switch Personal → Shared and Shared → Personal while staying on the current route. No startup/auth Kajo loading screen appears.
5. **Shared state:** A saves/rates/not-interested in SharedProfile; state persists under Shared `profileId` and remains isolated from A PersonalProfile.
6. **Second actor:** B activates the same SharedProfile and sees shared current Item state while B PersonalProfile remains separate.
7. **Prediction/Event:** Prediction V0 runs for the SharedProfile for both members; interactions/Events retain Shared `profileId` and real signed-in `actorUserId`.
8. **Suggestion/regression:** `Ehdota yhteiseen`, Kajo logo → Room, DiscoveryMode and PersonalProfile flows still work.

After the device run, inspect the exact hosted rows from the session. Only after this re-acceptance should Sprint 009 and its MVP requirements be marked complete.

## Decisions

- No second SharedProfile table or predictor.
- `profile_members` means accepted membership; pending invitations are separate transient social state.
- One-member SharedProfile is setup state only.
- Nickname is the MVP invitation/discovery identifier; auth email stays outside SharedProfile UI/API.
- Shared Kajo is a Profile/place, not a filter.
- Profile switching is global shell navigation, not a Room object.
- Shared visual identity and DiscoveryMode remain separate.
- `ITEM_SUGGESTED` is behavioral evidence, not messaging or current Item state.
- ScenarioMemory remains out of Sprint 009.

## Important files

- `/docs/domain/DATA_EVENTS.md`
- `/docs/product/MVP.md`
- `/apps/mobile/app/profiles/shared.tsx`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/auth/AuthGate.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/discovery/sharedSuggestion.ts`
- `/apps/mobile/src/features/events/`
- `/apps/mobile/src/theme/roomTheme.ts`
- `/supabase/migrations/20260831171000_shared_profile_membership_foundation.sql`
- `/supabase/migrations/20260831172000_fix_shared_profile_member_conflict.sql`
- `/supabase/migrations/20260831200429_shared_profile_invitations.sql`

## Handoff

Sprint 009 implementation and the first configured-device acceptance fixes are merged.
#125 remains the final configured Android re-acceptance gate using the main APK from
`ce11d7c`. Do not begin Sprint 010/ScenarioMemory until this gate is explicitly passed.
