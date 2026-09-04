# Kajo Current Status

Last updated: **2026-09-04**
Current milestone: **MVP 0.1**
Current sprint: **Sprint 013 — Prediction nervous system / ScenarioMemory** (`sprints/SPRINT-013.md`)
Last accepted sprint: **Sprint 010 — Navigation & Profile lifecycle** (`sprints/SPRINT-010.md`)

This is the authoritative current-state document. Sprint files preserve execution history; this file states what is true now and what comes next.

## Current product state

Kajo is a phone-runnable Expo/React Native app with:

- minimalist illustrated Room home/navigation for the active Profile,
- one persistent top Kajo Home mark and one global DiscoveryMode curtain,
- restrained bottom dock and Profile-aware side drawer,
- BOOK/MOVIE grid discovery, Item detail and optional swipe-style browsing,
- hosted generic Prediction V0 targeting `Profile`,
- 0–10 rating/consumed, not-interested, save and exact recent undo semantics,
- Supabase/PostgreSQL/Auth behind typed mobile boundaries,
- unique email + nickname identity and email-or-nickname login,
- append-only Event/session persistence with actor/Profile/prediction correlation,
- PersonalProfile plus consent-based 2-N SharedProfiles,
- accepted Shared Endorsement/consensus delivery,
- hosted Profile-scoped system/custom Lists with mobile browsing, compact destination flow and unanimous Shared approval; refreshed configured-device acceptance is intentionally deferred.
- hosted Profile-scoped messaging with combined invitation/message Inbox, unread state and optional List-context messages; configured-device acceptance is intentionally deferred.

## Sprint 010 — accepted

Sprint 010 navigation/Profile lifecycle implementation and its final configured Android polish are accepted.

Delivered:

- #136 / PR #142 — bottom dock + side drawer; Profile switching remains in place,
- #137 / PR #141 — nickname 2–24, SharedProfile name 2–32, safe `Poistu ryhmästä` confirmation and lifecycle hardening,
- #143 / PR #147 — AuthGate nickname input max 24,
- #149 / PR #150 — bottom-center Profile Home action, sign-out moved to drawer bottom, Room title/helper chrome removed and obsolete `Ehdota yhteiseen` UI removed.

Hosted lifecycle verification passed rollback/security smoke suites. The configured Android build was reviewed and accepted by the user on 2026-09-01. Navigation is now considered the durable MVP shell.

Do not reopen Sprint 010 for visual experimentation. Further Room art changes must preserve the accepted shell/navigation contract.

## Approved Room direction

The Room remains one fixed **illustrated 2D cabin-living-room surface**, not a navigable 3D world, video-game room or futuristic interface. Its approved composition uses a minimalist straight-on view, small muted palette, mobile-safe complete bookshelf and two independent runtime Kajo sources: the window and fireplace.

Canonical MVP scene:

- fireplace + rug/bench provide warmth,
- bookshelf opens BOOK,
- low shelf with TV/screen opens MOVIE,
- window carries outside light/time-of-day atmosphere,
- the single global curtain remains the DiscoveryMode control,
- no standalone Room title/instruction text,
- no heavy 3D, free camera, virtual walking, glossy sci-fi chrome, excessive animation or decorative clutter.

DiscoveryMode may change restrained atmosphere only: bright morning and a small flame for `FOR_YOU`, darker afternoon and a larger flame for `SURPRISE`, then night/moon/stars and the largest restrained cooler fireplace accent for `RISK`. Window/fireplace light fades softly and unevenly from its real source while the rest of the Room gains phase-appropriate shadow. The Room must remain inviting and easy to navigate in every mode.

The detailed visual contract lives in `/docs/product/UX_PRINCIPLES.md`.

## Sprint 009 — accepted Shared Kajo foundation

Issue #125 is closed after corrected configured Android use plus hosted verification.

The first Shared Kajo device build exposed invitation consent, persistence and switching problems. Those were corrected through #128/PR #131, #130/PR #132 and #129/PR #133. Final hosted evidence confirmed Shared interactions/Events, real distinct `actorUserId` values inside the same Shared `profileId`, Personal/Shared state isolation and prediction-traceable Shared impressions.

The former separate `Ehdota yhteiseen` / `ITEM_SUGGESTED` UI is intentionally retired. Replacement semantics belong to Sprint 011/#151 Endorsement + consensus.

## Sprint 011 — delivered, device acceptance deferred

Sprint 011 has two ordered slices.

### 11A — #151 Shared discovery + Endorsement consensus

Backend state/consensus foundation is merged in PR #157, authorized mobile delivery in PR #158 and member-history delivery in PR #159. Configured Android testing confirmed endorsement, consensus, Personal isolation, lower attributed member-history delivery and resilient retry. Issue #151 was accepted and closed on 2026-09-02 without changing `rank_items_v0` core weights.

1. Pending Endorsements are delivered first, unseen ordinary Predictions next and accepted-member PersonalProfile consumed/rated Items afterward with real-member `nähnyt` provenance; higher member ratings order only that final tier.
2. Shared Prediction remains Profile-targeted while using inspectable common-fit evidence from accepted members plus disagreement handling.
3. One member's Shared positive quick action becomes actor-specific `Endorsement`, not Shared saved state.
4. The endorsing actor stops receiving that Item in their own ordinary queue.
5. Non-endorsing members receive the pending Item ahead of ordinary recommendations with restrained real-actor provenance.
6. Unanimity promotes once to Shared saved state.

The MVP endpoint is now a genuinely shareable production application downloadable through an official app store, not only a locally installable APK. Sprint 014 therefore includes signing/versioning, production auth/email, privacy/support/store assets and clean install/update acceptance.

### 11B — #102 Profile-scoped Lists

#151 is stable and #102 is now the active implementation slice:

- one system `Tallennetut` List per Profile,
- generic custom Lists across Item types,
- compact one-destination picker (five recent Lists before expansion),
- List addition as the positive/like action with automatic next-card advance,
- Shared custom-List choices that commit only after accepted-member unanimity,
- list/card presentation, filters/sort and current consumed/rating display,
- real added-by/added-at provenance in Shared Lists.

The hosted migrations `20260901204135_profile_scoped_item_lists.sql`, `20260902074500_shared_saved_consensus_integrity.sql` and `20260902134621_shared_list_approval_flow.sql` are applied and rollback-tested. They create exactly one system List for every existing/new Profile, keep custom membership separate from Saved state, project Personal save and Shared consensus safely into system `Tallennetut`, enforce accepted-membership authorization and prevent direct interaction writes from forging/clearing Shared consensus Saved state. The mobile List home, consumed history, custom-list management and list/card/filter/sort detail are implemented. Configured Android feedback led to an accepted compact one-destination MRU picker. The final Shared correction is merged in PR #164: A's custom-List choice stays pending, B sees the green proposer/List `Hyväksy` bar, and unanimity commits the selected custom membership plus `Tallennetut`. Production verification covered A→B pending/approval, authorization, atomicity and idempotency inside a rolled-back transaction. Main CI #246 passed and produced the verified `326de6c` APK. The product owner explicitly deferred refreshed configured-Android acceptance and directed work to continue into Sprint 012; this is not recorded as device acceptance, and #102/Sprint 011 remain unaccepted until that check is later completed.

## Sprint 012 — delivered, device acceptance deferred

Issue #138 adds one deliberately narrow message thread per Profile:

- PersonalProfile thread is owner-only.
- SharedProfile thread is accepted-member-only and retains the real sending User.
- Inbox combines invitations and Profile message activity/unread state.
- a short optional message may reference the List and Item involved in a successful List addition, while message failure never rolls back the membership.
- chat text stays separate from behavioural Events and Prediction evidence.

The complete #138 foundation is merged in PR #165 at main commit `07f62dd`. The hosted `20260902185821_profile_messaging_foundation` migration is permanently applied and passed post-apply authorization, idempotency, contextual-reference and read-cursor verification inside a rolled-back smoke transaction. Main CI #248 passed and produced the standalone Android artifact. Configured-device acceptance remains deliberately deferred and must not be inferred from CI.

Product-owner feedback after that merge was handled in PR #167 and merged at main commit `4377987`:

- the global Kajo/DiscoveryMode atmosphere continues behind approximately 70%-opaque chrome and content surfaces,
- discovery removes duplicate `Huone`/`Discover` chrome and uses a smaller domain title,
- the 0–10 ribbon previews a small live value, commits only on tap/release and holds the committed number for 500 ms before advancing,
- the drawer removes its duplicated identity block and shows fixed `Tallennetut`, `Luetut` and `Katsotut` routes plus at most three actor-local most-used custom Lists,
- most-used ranking is frequency-first with latest use as the tie-break; the destination picker remains ordered strictly by latest use.

Main CI #252 passed with 147 tests and produced the standalone Android artifact. Configured-device review then exposed a visual acceptance defect: the Room retained card-like outer gutters and transparent secondary screens resolved against the navigator's white canvas instead of a blurred Room.

The correction merged in PR #168 at main commit `56fae50`: one edge-to-edge Room is now the persistent authenticated backdrop, the navigator canvas is transparent and secondary routes blur/dim the same Room. Main CI #254 passed with 148 tests and produced the standalone Android artifact. Configured-device review on 2026-09-03 accepted this full-screen persistent/blurred backdrop: the product owner reported that it otherwise works perfectly.

PR #169 merged the immediate-transition/Room-art follow-up at main commit `7bccc2a`; main CI #256 passed with lint, TypeScript, 149 tests, both platform bundle exports and the standalone Android APK build. Configured-device review confirmed the navigation and layout look good. The art follow-up was then refined away from realism, perspective and video-game/pixel styling toward a softer, mildly abstract straight-on 2D cabin with separately rendered window and fireplace Kajo.

PR #170 merged the minimalist straight-on Room at main commit `d4375c4`. Its neutral-lit, limited-palette illustration keeps the window and fireplace bloom/cast light out of the bitmap; named, independent phase-aware UI layers animate the slowly breathing window Kajo and gently flickering fireplace Kajo. The standalone main APK was downloaded and the configured-device review accepted the Room direction on 2026-09-04, while identifying three focused follow-ups: more natural source-local falloff/time-of-day contrast, exact TV/bookshelf targets and a transient first profile-load failure immediately after login.

PR #171 merged the focused Room-lighting/profile-load correction at main commit `344009c`; PR CI #259 passed with lint, TypeScript, 155 tests and both platform bundle exports including the new 35 KB light mask. Window scenery, light layers, flame and interaction targets now map through the source illustration's real `cover` geometry. The window progresses from morning sun/clouds through afternoon to moon/stars, phase shadows deepen, the flame grows by risk level and the highest flame is slightly blue. A soft irregular alpha mask replaces hard light ellipses. Initial PersonalProfile loading gets one delayed automatic retry after an error; a genuinely missing profile is never retried and persistent failures still expose the manual retry state. No database migration was required. The product owner approved the implementation/handoff, but this conversation intentionally did not poll, download or run the new main APK; refreshed device validation must not be inferred.

Hosted reaction/test evidence was reset on 2026-09-02 for clean device testing: Events, Event sessions, Item interactions and Shared Endorsements were removed; auth accounts, public User rows, Profiles, memberships, Items and system Lists were preserved.

## Sprint 013 — current

Issue #156 defines and begins the versioned Prediction nervous system. Sprint 013A and its design gate are integrated with the current `main` baseline through a canonical architecture covering WorkingState, ShortTermState, LongTermState, ScenarioMemory, privacy-gated PopulationMemory and the controlled SleepLayer/EvolutionEngine.

The first implementation slice adds:

- an immutable `PredictionRun` + `PredictionCandidate` trace for every candidate set, rank, score component, model version and delivered recommendation,
- Prediction V1 as an authorization-preserving wrapper around the proven V0 candidate pool,
- reconstructable session/context snapshots and Item dwell evidence,
- deterministic short/long memory construction and inspectable ScenarioMemory retrieval,
- a precise champion–challenger SleepLayer specification with prospective shadow predictions, outcome maturity, global/cohort/Profile evaluation, shrinkage and rollback rules,
- manual promotion only for MVP; no challenger can silently mutate or replace production behavior.

The schema/migration and mobile V1 wiring are integrated with all newer Room, navigation, Lists and messaging work. The rebased integration passes lint, TypeScript, all 156 tests and both platform export smokes; Android export was repeated successfully with `EXPO_OFFLINE=1` after this execution environment interrupted the first network-enabled export. The migration has not been applied to hosted Supabase and the flow has not received configured-device acceptance. Sprint 013B and 013C retain those gates and the first executable genome/shadow/promotion persistence respectively.

## Next MVP sequence

1. **Sprint 013B** — apply/rollback-test the migration in the hosted project and run configured-device trace acceptance.
2. **Sprint 013C** — implement immutable PredictorGenome, prospective ShadowPrediction, EvaluationWindow and manual PromotionDecision persistence.
3. **Latest main APK review** — validate the PR #171 morning/afternoon/night lighting, exact TV/bookshelf targets and first-login profile hydration on Android.
4. **Deferred acceptance** — run the refreshed #102/#138 configured-Android flows without treating their deferral as prior acceptance.
5. **Sprint 014** — MVP hardening/release readiness.

The List model is hosted and stable enough for #138. Its final configured-device acceptance remains an explicit deferred check. Do not let Room visual polish block these MVP behavior slices.

## Other open work

- #160 — production Supabase security hardening: privileged function execution grants, leaked-password protection, explicit Data API grants and store-install authorization verification.
- #156 — Prediction Core / SleepLayer implementation. The architecture design gate is resolved in Sprint 013; hosted verification, executable challenger evaluation and promotion tooling remain open.
- #127 — production-ready auth email delivery; production SMTP/domain and confirmation/recovery tests remain required before external beta.
- #78 — optional splash/in-app logo polish.
- #73 — Google/Apple sign-in future work.
- Existing Supabase advisor/security hygiene items remain separately scoped technical debt.

## Important files

- `/AGENTS.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/HANDOFF_PROTOCOL.md`
- `/docs/project/milestones/MILESTONE-001-MVP.md`
- `/docs/project/sprints/SPRINT-010.md`
- `/docs/project/sprints/SPRINT-011.md`
- `/docs/project/sprints/SPRINT-012.md`
- `/docs/project/sprints/SPRINT-013.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/discovery/ItemInteractionContext.tsx`
- `/apps/mobile/src/features/profiles/ActiveProfileContext.tsx`
- `/apps/mobile/src/features/profiles/PersonalProfileProvider.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/lists/`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/apps/mobile/src/features/room/roomGeometry.ts`
- `/supabase/migrations/20260901204135_profile_scoped_item_lists.sql`
- `/supabase/migrations/20260902074500_shared_saved_consensus_integrity.sql`
- `/supabase/migrations/20260902182643_profile_messaging_foundation.sql`
- `/supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Sprint 013A's Prediction V1 evidence spine and canonical design are integrated with the latest Room work. Immediate target: **Sprint 013B hosted migration and configured-device trace verification**. The PR #171 Room delivery is already on main at `344009c`, but its refreshed device validation and the #102/#138 configured Android acceptance remain explicitly deferred. Do not claim device acceptance from CI alone. The old `Ehdota yhteiseen` action must not be reintroduced, and the fixed illustrated/non-navigable Room contract must be preserved.
