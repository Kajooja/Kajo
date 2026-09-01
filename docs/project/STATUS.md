# Kajo Current Status

Last updated: **2026-09-01**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 010 — Navigation & Profile lifecycle, device acceptance pending** (`sprints/SPRINT-010.md`)
Last fully accepted sprint: **Sprint 008 — Prediction V0** (`sprints/SPRINT-008.md`)

This is the authoritative current-state document. Sprint-specific history belongs in the sprint documents.

## Current state

Kajo is a phone-runnable Expo/React Native app with:

- a minimalist 2D Room as the visual home of the active Profile,
- a persistent top Kajo mark that returns to the active Profile Room,
- a restrained bottom dock for global navigation,
- a Profile-aware side drawer opened from the bottom-left three-line control,
- a bottom-right Inbox/mail control with invitation badge,
- BOOK/MOVIE grid discovery, Item detail and optional swipe-style browsing,
- one global three-state DiscoveryMode curtain,
- hosted generic Prediction V0 targeting Profile,
- 0–10 consumed rating, not-interested and save semantics with exact recent undo,
- Supabase/PostgreSQL/Auth behind typed mobile boundaries,
- unique email + unique nickname identity and email-or-nickname login,
- append-only Event/session persistence with actor/Profile/prediction correlation,
- PersonalProfile and invitation-based 2-N SharedProfile support.

## Sprint 009 — Shared Kajo residual acceptance

Sprint 009 implementation is merged. The original configured-device failure was corrected through invitation consent, actor-scoped active Profile switching and seamless interaction hydration.

Current real hosted evidence after the corrected Android use confirms:

- SharedProfile `Jeejee` has two accepted members,
- SharedProfile has **4 persisted item_interactions** and **62 Events** where the earlier failed build had 0/0,
- Shared Events contain both members as their real `actorUserId` values,
- PersonalProfile and SharedProfile interaction state remain separate even for the same Item IDs,
- Shared prediction impressions are traceable: **53/53 impressions** carried a prediction ID across 9 predictions.

Issue **#125 remains open for one residual device proof only**: there is still no real-device `ITEM_SUGGESTED` Event in hosted Events. During the next Android acceptance, activate a ready SharedProfile, open an Item detail and press **Ehdota yhteiseen** once. Then inspect the hosted Event fields before closing Sprint 009.

## Sprint 010 — implementation complete, device acceptance pending

### Navigation shell — #136 / PR #142

Merged main commit: `646999330758cf15a4cef6b929fef2b76990048d`.

- Top Kajo mark always returns to the Room of the active Profile.
- Persistent profile/inbox controls were removed from the top header.
- Bottom dock:
  - left: three-line menu opens side drawer,
  - center: restrained active Profile identity,
  - right: mailbox opens Inbox and shows invitation badge.
- Side drawer owns Profile switching and navigation sections `Profiili`, `Listat`, `Ryhmät`.
- `Listat` is intentionally marked `TULOSSA` until Sprint 011; no dead route is exposed.
- Up to five ready SharedProfiles are available for direct switching.
- Personal ↔ Shared switching keeps the current view mounted.

### Profile lifecycle — #137 / PR #141

Canonical implementation was merged before the navigation PR. Hosted migration: `20260901082902_profile_lifecycle_limits_and_leave`.

- nickname length: **2–24**,
- SharedProfile name length: **2–32**,
- PostgreSQL, signup provisioning and typed mobile validation enforce the limits,
- `leave_shared_profile` removes the actor's membership after authorization checks,
- `Poistu ryhmästä` requires an **Oletko varma?** destructive confirmation,
- leaving an active SharedProfile falls back to PersonalProfile,
- one remaining member keeps the SharedProfile/history as provisional,
- the last member leaving deletes the zero-member SharedProfile,
- pending invitations involving the departing member are cleaned,
- privileged `complete_personal_profile` logic moved to `private`; its public RPC is now a SECURITY INVOKER wrapper.

Verification:

- lifecycle/leave rollback suite: **11/11 pass**,
- PersonalProfile private/public wrapper suite: **3/3 pass**,
- post-migration hosted leave smoke: **5/5 pass** with rollback/no QA residue,
- security advisor no longer reports `public.complete_personal_profile` as an exposed SECURITY DEFINER function.

### Nickname UI consistency — #143 / PR #147

Merged main commit: `60db8aae63bd1f86e8cc1cabb132294643b17a4b`.

- both AuthGate nickname TextInputs now stop at 24 characters,
- PR CI passed lint, typecheck, tests and iOS/Android bundle smoke,
- no auth/backend behavior changed.

A later duplicate lifecycle merge commit `0db2ec37ef2b9d90585ec21c7614d1083cde88d6` had an identical tree to its parent and introduced no code changes; canonical lifecycle work remains **PR #141**.

## Current Android build

Final Sprint 010 runtime main is `60db8aae63bd1f86e8cc1cabb132294643b17a4b`.

GitHub Actions run `33496770667`:

- lint: pass,
- typecheck: pass,
- tests: pass,
- iOS + Android bundle smoke: pass,
- standalone Android APK: building/upload pending at the time of this status update.

Use only the standalone APK produced by this final main for Sprint 010 device acceptance.

## Sprint 010 device gate

On the fresh final-main APK verify:

1. top Kajo mark returns to active Profile Room,
2. top header has no duplicate profile/inbox navigation,
3. bottom-left three-line control opens the side drawer,
4. drawer shows active identity plus `Profiili`, `Listat`, `Ryhmät`,
5. `Listat` does not navigate to a dead screen before Sprint 011,
6. up to five ready SharedProfiles can be selected,
7. Personal ↔ Shared switching is seamless,
8. bottom-right mailbox opens invitation Inbox and badge count is correct,
9. invitation Accept/Reject still works,
10. group management offers `Poistu ryhmästä`,
11. cancel leaves state unchanged,
12. confirmed leave removes membership and active Shared falls back to Personal,
13. a one-member SharedProfile becomes provisional and a zero-member orphan is deleted,
14. nickname input stops at 24 and SharedProfile name at 32,
15. BOOK/MOVIE discovery, rating, save, DiscoveryMode and Room navigation still work,
16. while SharedProfile is active, press **Ehdota yhteiseen** once so #125 can be closed from hosted evidence.

## MVP sequence after acceptance

1. **Sprint 011 — Named Lists & Collaborative Curation** (`#102`)
   - Profile-owned named generic `ItemList`, name length 1–40,
   - PersonalProfile and SharedProfile may own multiple Lists,
   - `Tallenna` chooses/creates a destination List,
   - an Item may belong to multiple Lists,
   - mixed BOOK/MOVIE and future Item types may coexist in a List,
   - list/card view toggle, ItemType filters and sort by added order/supported metadata,
   - Shared List shows who added an Item and when; Personal List hides redundant actor identity,
   - consumed/read/watched state and rating continue to come from canonical `item_interactions`, not copied List fields.

2. **Sprint 012 — Profile Messaging** (`#138`)
   - PersonalProfile private owner-only note/thread stream,
   - SharedProfile accepted-member group chat with sender identity,
   - Inbox combines invitation and message activity,
   - saving an Item to a List can optionally create a message referencing Profile/List/Item,
   - no arbitrary user DMs, public feed or follower model in MVP 0.1.

3. **Sprint 013 — ScenarioMemory**
4. **Sprint 014 — MVP Hardening**

Do not start chat before the list model is stable. Do not skip directly to ScenarioMemory.

## Known open work

- **#125** — residual Sprint 009 real-device `ITEM_SUGGESTED` acceptance.
- **#127** — production-ready auth email delivery; verify a production sending domain/SMTP and test confirmation + password recovery to unrelated Gmail and Outlook/Hotmail addresses before external beta.
- **#102** — Sprint 011 named Lists.
- **#138** — Sprint 012 Profile messaging.
- **#78** — optional splash/in-app logo polish.
- **#73** — Google/Apple sign-in future work.
- Supabase advisor technical debt still includes `rls_auto_enable`, public `get_my_personal_profile`, leaked-password protection disabled and low-traffic unused-index notices.

## Important files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/product/MVP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-009.md`
- `/docs/project/sprints/SPRINT-010.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/auth/AuthGate.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/supabase/migrations/20260831200429_shared_profile_invitations.sql`
- `/supabase/migrations/20260901082902_profile_lifecycle_limits_and_leave.sql`
- `/.github/workflows/ci.yml`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Immediate next action: finish/fetch the final Sprint 010 APK, run the device checklist including one **Ehdota yhteiseen** action, verify hosted evidence, close #125 + Sprint 010 acceptance, then start Sprint 011 / #102.