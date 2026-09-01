# Kajo Current Status

Last updated: **2026-09-01**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 010 — Navigation & Profile lifecycle, final polish** (`sprints/SPRINT-010.md`)
Last accepted sprint: **Sprint 009 — Shared Kajo** (`sprints/SPRINT-009.md`)

This is the authoritative current-state document. Sprint files preserve execution history; this file states what is true now and what comes next.

## Current product state

Kajo is a phone-runnable Expo/React Native app with:

- minimalist 2D Room home/navigation for the active Profile,
- one persistent top Kajo mark and one global DiscoveryMode curtain,
- a restrained bottom dock and Profile-aware side drawer,
- BOOK/MOVIE grid discovery, Item detail and optional swipe-style browsing,
- hosted generic Prediction V0 targeting `Profile`,
- 0–10 rating/consumed, not-interested, save and exact recent undo semantics,
- Supabase/PostgreSQL/Auth behind typed mobile boundaries,
- unique email + nickname identity and email-or-nickname login,
- append-only Event/session persistence with actor/Profile/prediction correlation,
- PersonalProfile plus consent-based 2-N SharedProfiles.

## Sprint 009 — accepted

Issue #125 is closed after corrected configured Android use plus hosted verification.

The first Shared Kajo device build had real failures: invitation consent was missing, Shared actions persisted into PersonalProfile instead of SharedProfile, Profile switching showed the startup/loading state, and the original Room wall-object navigation was wrong.

Those failures were corrected through:

- #128 / PR #131 — invitation-based membership consent,
- #130 / PR #132 — seamless post-initial Profile hydration,
- #129 / PR #133 — global Profile switching + invitation Inbox.

Final hosted evidence from real configured use confirmed:

- existing ready SharedProfile `Jeejee` has persisted Shared `item_interactions` and Events where the failed build had 0/0,
- both real members remain distinct `actorUserId` values inside the same Shared `profileId`,
- Personal/Shared interaction state stays isolated for the same Item,
- Shared Prediction V0 impressions remain prediction-traceable.

The former separate `Ehdota yhteiseen` / `ITEM_SUGGESTED` UI requirement was intentionally retired during the 2026-09-01 product review. No obsolete Event was manufactured merely to close acceptance. The replacement is Sprint 011/#151 Shared member endorsement semantics.

## Sprint 010 — implementation complete, final polish in progress

Delivered:

- #136 / PR #142 — bottom dock + side drawer; top Kajo mark returns to active Profile Room; Profile switching remains in place,
- #137 / PR #141 — nickname 2–24, SharedProfile name 2–32, safe `Poistu ryhmästä` confirmation, membership removal/fallback and lifecycle hardening,
- #143 / PR #147 — AuthGate nickname input max length aligned to 24.

Hosted lifecycle verification passed rollback/security smoke suites; final runtime main before polish was `60db8aae63bd1f86e8cc1cabb132294643b17a4b` and its standalone Android build passed embedded-JS verification.

### Final navigation polish — #149 / PR #150

Configured Android review requested:

- bottom-center active Profile name also returns to the active Profile Room,
- `Kirjaudu ulos` moves from Room to the bottom of the side drawer,
- standalone `Huone` heading and helper copy disappear so the home surface is only Room + global top/bottom shell,
- obsolete separate `Ehdota yhteiseen` panel/helper is removed before the new endorsement model.

PR #150 is the current runtime polish gate. Do not add new navigation concepts while it is being validated.

## Product decision — Shared discovery and saving

Shared Kajo is not a separate recommendation/suggestion list. The active SharedProfile remains the recommendation target.

Sprint 011 starts with **#151 Shared discovery member-history suppression + endorsement consensus** before named Lists:

1. **Member consumption suppresses Shared discovery.** If any accepted member has consumed/rated an Item in their PersonalProfile, that Item is excluded from ordinary Shared discovery. This does not delete it from Lists/history.
2. **Common taste uses all members.** Shared Prediction remains Profile-targeted but V0 may combine SharedProfile joint evidence with accepted members' PersonalProfile taste evidence and an explicit disagreement penalty.
3. **One member endorsement is pending, not shared saved state.** A Shared quick positive action (`Tykkää` or equivalent copy) records the real actor's endorsement.
4. **Pending endorsement is delivered to the others.** The endorser stops receiving it in their own normal queue; members who have not endorsed it receive it ahead of ordinary recommendations with restrained actor provenance such as `Mirri tykkäsi`.
5. **Unanimity creates Shared saved state.** When every currently accepted member has endorsed the Item, Shared `saved` becomes true and the Item is promoted once to the Shared system `Tallennetut` List when #102 Lists exist.
6. **Custom Shared Lists remain collaborative, not unanimous voting.** Any accepted member can explicitly add an Item to a custom list with `addedBy`/`addedAt` provenance.

The underlying predictor remains generic. Actor-specific pending-endorsement delivery is a collaboration overlay, not a separate per-user/media recommender.

## Next MVP sequence

1. Finish/merge **#149 / PR #150** and validate the navigation polish.
2. **Sprint 011 / #151** — Shared discovery eligibility, common-fit evidence and endorsement consensus.
3. **Sprint 011 / #102** — system + named Profile-scoped Lists, list/card view, filters/sort, provenance and Personal save destination picker.
4. **Sprint 012 / #138** — Profile messaging/chat after Lists are stable.
5. **Sprint 013** — ScenarioMemory.
6. **Sprint 014** — MVP hardening/release readiness.

Do not implement #102 before #151 is stable. Do not start chat before the List model is stable.

## Other open work

- #127 — production-ready auth email delivery; production SMTP/domain and confirmation/recovery tests remain required before external beta.
- #78 — optional splash/in-app logo polish.
- #73 — Google/Apple sign-in future work.
- Existing Supabase advisor/security hygiene items remain separately scoped technical debt.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/sprints/SPRINT-009.md`
- `/docs/project/sprints/SPRINT-010.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/supabase/migrations/20260831200429_shared_profile_invitations.sql`
- `/supabase/migrations/20260901082902_profile_lifecycle_limits_and_leave.sql`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Immediate order: finish #149/PR #150 → implement #151 → implement #102. The old `Ehdota yhteiseen` action must not be reintroduced.