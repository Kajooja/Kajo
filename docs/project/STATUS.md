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
- membership is consent-based through persistent pending invitations,
- creating a group starts with one accepted member; inviting another User does not create membership until acceptance,
- invitation list/accept/reject are authenticated typed RPC flows without auth email exposure,
- one generic active Profile scope is shared by PersonalProfile and ready SharedProfiles,
- Event, interaction persistence/hydration and Prediction V0 use active `profileId` while retaining the signed-in User as `actorUserId`,
- the current global shell shows the active Personal nickname or SharedProfile name and supports in-place Profile switching,
- a global mail control shows pending invitations and accept/reject actions,
- accepted/rejected invitations disappear immediately from UI and memberships/invitations refresh periodically,
- Personal ↔ Shared switching keeps the current route mounted after the signed-in User's initial interaction hydration,
- active SharedProfile receives its deterministic visual base identity independently from DiscoveryMode,
- contextual `Ehdota yhteiseen` writes canonical `ITEM_SUGGESTED` without changing Item current state.

## Sprint 009 acceptance history

Backend/membership foundation originally passed rollback-only hosted tests. Before the first device run, a broader hosted pre-acceptance with temporary Users A/B/C passed **14/14** checks under authenticated role/RLS and rolled back cleanly.

The first configured Android Shared Kajo acceptance then found concrete product/runtime failures:

1. the original member-add flow added B directly instead of requiring B's consent,
2. an existing SharedProfile `Jeejee` had two accepted members but hosted verification showed **0 SharedProfile item_interactions and 0 SharedProfile Events**, while PersonalProfiles had persisted activity,
3. Personal ↔ Shared switching entered interaction hydration by replacing the app with the Kajo loading/status screen instead of remaining seamless,
4. the original Room wall entry/setup page was not the desired primary Profile navigation model.

These failures were fixed without creating parallel social/recommendation architecture:

- **#128 / PR #131** — invitation-based membership and typed invitation operations; hosted rollback behavior passed **13/13**, followed by **4/4** production-RPC smoke checks with no test rows persisted,
- **#130 / PR #132** — only the signed-in actor's first configured interaction hydration blocks the app; later Profile switches keep shell/content mounted while writes remain disabled until the target Profile is ready,
- **#129 / PR #133** — global active-identity switcher, group drawer, invitation inbox/badge and removal of the old Shared Kajo Room wall object.

PR #133 passed lint, TypeScript, all tests and iOS/Android bundle smoke before merge. The corrected code and acceptance documentation are merged through main commit `601498cc662da964fc8a9ebbc14ca9ea7a843fc4`.

Configured Android review on 2026-09-01 reports the corrected Shared Kajo flow as visually/functionally working. #125 still remains open until the concrete resulting hosted SharedProfile interactions/Events/authorization are inspected and the acceptance gate is explicitly closed.

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

These Sprint 009 requirements are not marked finally accepted until #125 is closed.

## Product decision — next MVP sequence

Configured-device review on 2026-09-01 explicitly moved three capabilities into the MVP before ScenarioMemory: durable navigation, named Profile-scoped Lists and narrow Profile-scoped messaging.

The planned sequence after Sprint 009 is now:

1. **Sprint 010 — Navigation & Profile Lifecycle** (`#136`, `#137`)
   - top Kajo logo always returns to the active Profile Room,
   - a small bottom dock has a three-line menu on the left and envelope/Inbox on the right,
   - the menu opens a Profile-aware side drawer; general navigation comes from Room or drawer rather than a conventional tab bar,
   - drawer owns Profile switching plus Profile, Lists and Groups destinations,
   - nickname length becomes 2–24 characters; SharedProfile name 2–32,
   - members can leave a SharedProfile after `Oletko varma?` confirmation with safe PersonalProfile fallback and authorization removal.

2. **Sprint 011 — Named Lists & Collaborative Curation** (`#102`)
   - PersonalProfile/SharedProfile own multiple named generic Lists, name length 1–40,
   - `Tallenna` selects a destination List and can create/name/rename Lists,
   - mixed BOOK/MOVIE Items are supported in one List and the same Item may belong to multiple Lists,
   - List detail toggles list/card view, filters by ItemType and sorts by added order/supported metadata,
   - SharedProfile displays who added each Item and when; PersonalProfile hides redundant actor identity,
   - consumed/read/watched state and rating are read from canonical Profile interaction state rather than copied into List rows.

3. **Sprint 012 — Profile Messaging** (`#138`)
   - PersonalProfile has a private owner-only thread/note stream,
   - SharedProfile has accepted-member-only group chat with actual sender identity,
   - bottom-envelope Inbox combines invitations and message activity,
   - saving an Item to a List can optionally include a message referencing Profile/List/Item,
   - arbitrary user DMs, public feed/followers and chat-based recommendation weighting remain outside MVP.

4. **Sprint 013 — Scenario Memory**
5. **Sprint 014 — MVP Hardening**

This sequence is intentional: build the stable navigation shell first; Lists then become a real destination/data model; messaging comes after Lists so contextual messages can reference established `ItemList`/Item identities instead of being redesigned later.

## Active gate — #125 configured SharedProfile end-to-end re-acceptance

Use two real Kajo accounts and current main to validate the corrected product flow:

1. invitation reject and reinvite/accept paths behave correctly,
2. both members see the same ready SharedProfile without auth email exposure,
3. Personal ↔ Shared Profile switching remains seamless without the startup/loading screen,
4. shared save/rating/not-interested state persists under SharedProfile and stays separate from PersonalProfile,
5. the second actor sees shared current Item state while their PersonalProfile remains separate,
6. Prediction/Event actor separation remains correct,
7. `ITEM_SUGGESTED`, logo → Room, DiscoveryMode and personal flows remain intact.

After device confirmation, inspect the concrete hosted `item_interactions`, Events and Prediction authorization produced by this session. Only then close #125 and Sprint 009.

## Exact next actions

1. Inspect the configured-device session's hosted SharedProfile interactions, Events, membership and Prediction authorization.
2. If correct, close #125 and Sprint 009 and mark its MVP requirements complete.
3. Start Sprint 010 with #136 navigation shell before introducing new List/chat destinations.
4. Implement #137 naming limits + safe SharedProfile leave semantics while navigation/group management is being stabilized.
5. Continue to #102 named Lists, then #138 Profile messaging; ScenarioMemory remains after those foundations.

## Known issues / open decisions

- Startup-logo sizing remains optional polish under Issue #78 and does not block MVP work.
- Google and Apple authentication remain separately tracked in Issue #73.
- Final book/movie metadata providers are not locked.
- Current Room/theme/mock covers remain structural rather than final artwork.
- Current Item feature volume is small, so Prediction V0 retains explicit cold-start prior/fallback behavior.
- Prediction V0 currently uses an authenticated Postgres RPC; a dedicated service remains a later scale/tooling decision.
- Existing Supabase advisor findings remain separately scoped hygiene/security debt.
- Public Lists, arbitrary DMs, follower/feed mechanics and rich chat media remain outside MVP 0.1.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/project/ROADMAP.md`
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

Sprint 009 corrected Shared Kajo flow is visually reported working on configured Android but #125 still requires hosted evidence verification before closure. After that, the deliberate MVP order is navigation/lifecycle → named Lists → Profile messaging → ScenarioMemory → hardening. Do not skip directly to ScenarioMemory.
