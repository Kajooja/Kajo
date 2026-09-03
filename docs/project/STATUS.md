# Kajo Current Status

Last updated: **2026-09-03**
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

The Room remains a **simple illustrated 2D / lightly layered 2.5D cabin-living-room**, not a 3D world or futuristic interface.

Canonical MVP scene:

- fireplace + rug/bench provide warmth,
- bookshelf opens BOOK,
- low shelf with TV/screen opens MOVIE,
- window carries outside light/time-of-day atmosphere,
- the single global curtain remains the DiscoveryMode control,
- no standalone Room title/instruction text,
- no heavy 3D, free camera, virtual walking, glossy sci-fi chrome, excessive animation or decorative clutter.

DiscoveryMode may change restrained atmosphere only: calm dawn/day for `FOR_YOU`, warmer sunset/evening for `SURPRISE`, night/moon/stars with a restrained cooler fireplace accent for `RISK`. The Room must remain inviting and easy to navigate in every mode.

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

The complete #138 slice is merged on `main` in commit `07f62dd`: ProfileMessage/read-state schema and narrow RPCs, typed mobile operations/provider, combined Inbox activity/unread state, Profile thread UI, retryable failed drafts, and an optional collapsed List message whose failure cannot roll back the successful List action. Earlier hosted-schema rollback smoke left no tables or migration history behind. Permanent hosted application and configured-device acceptance remain explicit deferred checks; their absence is not recorded as acceptance.

Hosted reaction/test evidence was reset on 2026-09-02 for clean device testing: Events, Event sessions, Item interactions and Shared Endorsements were removed; auth accounts, public User rows, Profiles, memberships, Items and system Lists were preserved.

## Sprint 013 — current

Issue #156 defines and begins the versioned Prediction nervous system. The design gate is now resolved in the feature branch by a canonical architecture covering WorkingState, ShortTermState, LongTermState, ScenarioMemory, privacy-gated PopulationMemory and the controlled SleepLayer/EvolutionEngine.

The first implementation slice adds:

- an immutable `PredictionRun` + `PredictionCandidate` trace for every candidate set, rank, score component, model version and delivered recommendation,
- Prediction V1 as an authorization-preserving wrapper around the proven V0 candidate pool,
- reconstructable session/context snapshots and Item dwell evidence,
- deterministic short/long memory construction and inspectable ScenarioMemory retrieval,
- a precise champion–challenger SleepLayer specification with prospective shadow predictions, outcome maturity, global/cohort/Profile evaluation, shrinkage and rollback rules,
- manual promotion only for MVP; no challenger can silently mutate or replace production behavior.

The schema/migration and mobile V1 wiring are implemented on the #156 feature branch. Repository lint, TypeScript, all 145 tests and both platform export smokes pass. They have not been applied to hosted Supabase and have not received configured-device acceptance. Sprint 013B and 013C retain those gates and the first executable genome/shadow/promotion persistence respectively.

## Next MVP sequence

1. **#156 / Sprint 013A** — review and merge the Prediction V1 evidence spine and canonical design.
2. **Sprint 013B** — apply/rollback-test the migration in the hosted project and run configured-device trace acceptance.
3. **Sprint 013C** — implement immutable PredictorGenome, prospective ShadowPrediction, EvaluationWindow and manual PromotionDecision persistence.
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
- `/apps/mobile/src/features/profiles/sharedProfileOperations.ts`
- `/apps/mobile/src/features/profiles/SharedProfilesScreen.tsx`
- `/apps/mobile/src/features/lists/`
- `/apps/mobile/src/features/room/RoomScreen.tsx`
- `/supabase/migrations/20260901204135_profile_scoped_item_lists.sql`
- `/supabase/migrations/20260902074500_shared_saved_consensus_integrity.sql`
- `/supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`

## Handoff

A fresh conversation must follow `/AGENTS.md` and can start with **"jatketaan reposta"**.

Immediate target: **#156 Sprint 013A Prediction V1 evidence spine and design review**, followed by hosted migration/device trace verification. Keep #102 and #138 configured Android acceptance explicitly deferred, not completed. The old `Ehdota yhteiseen` action must not be reintroduced, and the approved simple illustrated Room direction must be preserved.
