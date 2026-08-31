# Kajo Current Status

Last updated: **2026-09-01**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 009 — Shared Kajo, configured Android re-acceptance (#125)** (`sprints/SPRINT-009.md`)
Last completed sprint: **Sprint 008 — Prediction V0** (`sprints/SPRINT-008.md`)

This is the authoritative current-state document.

## Current state

Sprints 001–008 are complete. Kajo is a phone-runnable Expo/React Native app with:

- a minimalist 2D Room as the home/navigation surface,
- a persistent Kajo logo that returns to the Room,
- one global three-state DiscoveryMode curtain,
- BOOK/MOVIE grid discovery, Item detail and optional swipe-style browsing,
- hosted generic Prediction V0 targeting Profile,
- 0–10 consumed rating, not-interested and save semantics with exact recent undo,
- temporary impression cooldown and a 12 BOOK + 12 MOVIE MVP candidate catalog,
- Supabase/PostgreSQL/Auth behind typed mobile boundaries,
- unique email + unique nickname identity and email-or-nickname login,
- append-only Event/session persistence with actor/Profile/prediction correlation.

Sprint 009 Shared Kajo implementation is merged, but final configured Android acceptance remains open:

- persistent `SHARED` Profiles reuse existing `profiles` + accepted `profile_members`,
- membership is now consent-based through persistent pending invitations,
- creating a group starts with one accepted member; inviting another User does not create membership until acceptance,
- invitation list/accept/reject are authenticated typed RPC flows without auth email exposure,
- one generic active Profile scope is shared by PersonalProfile and ready SharedProfiles,
- Event, interaction persistence/hydration and Prediction V0 use active `profileId` while retaining the signed-in User as `actorUserId`,
- the global shell shows the active Personal nickname or SharedProfile name,
- pressing the active identity opens a left-side Profile drawer with bold `Ryhmät` and up to five ready groups,
- `Ryhmät` opens `/profiles/shared` for full group creation/list/member invitation management,
- a global mail control shows a red badge for pending invitations and opens a lightweight accept/reject overlay,
- accepted/rejected invitations disappear immediately from UI and are revalidated in background,
- SharedProfile memberships and invitations refresh periodically so two already-open clients converge,
- Personal ↔ Shared switching keeps the current route mounted after the signed-in User's initial interaction hydration,
- active SharedProfile still receives its deterministic visual base identity independently from DiscoveryMode,
- contextual `Ehdota yhteiseen` writes canonical `ITEM_SUGGESTED` without changing Item current state.

## Sprint 009 acceptance history

Backend/membership foundation originally passed rollback-only hosted tests. Before the first device run, a broader hosted pre-acceptance with temporary Users A/B/C passed **14/14** checks under authenticated role/RLS and rolled back cleanly.

The first configured Android Shared Kajo acceptance then found concrete product/runtime failures:

1. the original member-add flow added B directly instead of requiring B's consent,
2. an existing SharedProfile `Jeejee` had two accepted members but hosted verification showed **0 SharedProfile item_interactions and 0 SharedProfile Events**, while PersonalProfiles had persisted activity,
3. Personal ↔ Shared switching entered interaction hydration by replacing the app with the Kajo loading/status screen instead of remaining seamless,
4. the original Room wall entry/setup page was not the desired primary Profile navigation model.

These failures were fixed without creating parallel social/recommendation architecture:

- **#128 / PR #131** — invitation-based membership and typed invitation operations; hosted rollback behavior passed **13/13**, followed by **4/4** production-RPC smoke checks using the two existing Kajo identities, with no test rows persisted,
- **#130 / PR #132** — only the signed-in actor's first configured interaction hydration blocks the app; later Profile switches keep the shell/content mounted while writes remain disabled until the target Profile is ready,
- **#129 / PR #133** — global active-identity switcher, left group drawer, invitation inbox/badge and removal of the old Shared Kajo Room wall object.

PR #133 passed lint, TypeScript, all tests and iOS/Android bundle smoke before merge. Main commit `ce11d7cecac6896eedda338a81abceb04c43cb39` is the first commit containing the complete corrected device flow; its standalone Android APK is the next acceptance artifact.

Supabase advisors showed no new invitation-specific security finding. Existing legacy SECURITY DEFINER, leaked-password protection and low-traffic unused-index notices remain separately scoped technical debt.

## MVP progress

Completed through Sprint 008:

- `MVP-FOUND-001..003`
- `MVP-AUTH-001..002`
- `MVP-ROOM-001..005`
- `MVP-DISC-001..007`
- `MVP-SWIPE-001..006`
- `MVP-MEM-001..003`
- `MVP-PROFILE-001`, `MVP-PROFILE-003`
- `MVP-DATA-001..002`
- `MVP-PRED-001..003`

Sprint 009 implementation exists for:

- `MVP-PROFILE-002` — persistent 2-N accepted-member SharedProfile with invitation consent,
- `MVP-ROOM-006` — SharedProfile-specific Room/theme identity,
- `MVP-SOCIAL-001` — joint Profile-scoped saved/current Item state,
- `MVP-SOCIAL-002` — browse/swipe/Prediction in SharedProfile context,
- `MVP-SOCIAL-003` — traceable Item suggestion inside SharedProfile.

These Sprint 009 requirements are not marked finally accepted until #125 real-device re-acceptance passes. Saved/Consumed persistent list navigation remains Sprint 010. ScenarioMemory remains Sprint 011.

## Active gate — #125 configured SharedProfile end-to-end re-acceptance

Use two real Kajo accounts and the standalone APK built from current main. Validate the corrected product flow:

1. **Invitation rejection:** A creates a SharedProfile and invites B by nickname. B gets the red mail badge, opens the lightweight invite overlay, sees the group name/inviter, presses `Hylkää`, and the invitation disappears without B becoming a member.
2. **Invitation acceptance:** A invites B again. B presses `Hyväksy`; the invitation disappears and the group becomes a ready 2-member SharedProfile for both clients without exposing auth email.
3. **Global Profile switcher:** top-right initially shows the Personal nickname. Pressing it opens the left drawer; bold `Ryhmät` opens full management and up to five ready groups are directly selectable. Selecting the group changes only active Profile/name/theme and keeps the current route mounted with no Kajo loading/startup screen.
4. **Shared persistence:** while SharedProfile is active, save/rate/not-interested an Item. State persists under the SharedProfile and stays separate from A PersonalProfile.
5. **Second member:** B activates the same SharedProfile and sees the shared current Item state while B PersonalProfile remains separate.
6. **Prediction/Event actor separation:** Prediction V0 ranks under the SharedProfile for both members; resulting Events/interactions use SharedProfile `profileId` but the actual signed-in User as `actorUserId`.
7. **Suggestion/regression:** `Ehdota yhteiseen` persists `ITEM_SUGGESTED` without changing Item current state; Kajo logo → Room, DiscoveryMode curtain and existing PersonalProfile behavior remain intact.

After device confirmation, inspect the concrete hosted `item_interactions`, Events and Prediction authorization produced by this session. Only then close #125, mark Sprint 009/MVP requirements accepted and proceed to Sprint 010.

## Exact next actions

1. Finish main CI for `ce11d7c` and obtain its standalone Android APK artifact.
2. Install that single artifact for the next #125 run; do not test older intermediate APKs.
3. Run the two-account invite/reject/reinvite/accept and seamless Personal ↔ Shared checklist above.
4. Inspect resulting hosted SharedProfile interactions, Events and Prediction authorization.
5. If all pass, close #125, close Sprint 009 and update MVP/status/roadmap for Sprint 010.

## Known issues / open decisions

- Startup-logo sizing remains optional polish under Issue #78 and does not block MVP work.
- Google and Apple authentication remain separately tracked in Issue #73.
- Final book/movie metadata providers are not locked.
- Current Room/theme/mock covers remain structural rather than final artwork.
- Current Item feature volume is small, so Prediction V0 retains explicit cold-start prior/fallback behavior.
- Prediction V0 currently uses an authenticated Postgres RPC; a dedicated service remains a later scale/tooling decision.
- Existing Supabase advisor findings remain separately scoped hygiene/security debt.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/sprints/SPRINT-009.md`
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
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 009 implementation plus the first device-acceptance fixes are merged. #125 remains the final real-device gate using the main APK from `ce11d7c`. Do not start ScenarioMemory or new social architecture before this re-acceptance is complete.
