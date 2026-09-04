# Kajo Current Status

Last updated: **2026-09-04**  
Current milestone: **MVP 0.1**  
Last accepted sprint: **Sprint 013 — Prediction Nervous System & ScenarioMemory** (`sprints/SPRINT-013.md`)

This is the authoritative current-state document. Sprint files preserve execution evidence; `ROADMAP.md` owns future sequencing. Avoid duplicating historical narrative here.

## Current product state

Kajo is a phone-runnable Expo/React Native application with:

- one fixed illustrated 2D Room as the authenticated home/backdrop,
- global `DiscoveryMode` control and phase-aware Room atmosphere,
- BOOK/MOVIE discovery, detail and swipe-style browsing,
- hosted Profile-targeted Prediction V1 with full run/candidate trace,
- Working/Short/Long state plus same-Profile ScenarioMemory,
- versioned reacted-Item suppression plus bounded saved-only reminders,
- controlled SleepLayer/EvolutionEngine foundation with immutable genomes, frozen shadows, mature evaluation, manual Profile canary and rollback,
- 0–10 rating/consumed, not-interested, save/List and recent undo semantics,
- append-only Event/session evidence with actor/Profile/prediction correlation,
- PersonalProfile and consent-based 2-N SharedProfiles,
- Shared Endorsement -> unanimous consensus delivery,
- Profile-scoped system/custom Lists and Shared List approval,
- Profile-scoped messaging and combined invitation/message Inbox,
- a compact bottom Profile identity control with actor-local SharedProfile quick access,
- email + nickname identity and email-or-nickname login.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets the Profile; recommendable things remain `Item`s. Do not create media-specific duplicate user, List, Event, Profile or predictor architectures.

## Acceptance truth

### Accepted

- Sprints 001–010.
- Sprint 011/#151 Shared discovery + Endorsement consensus.
- persistent Room/backdrop/navigation direction and current minimalist straight-on Room contract.
- Sprint 013A Prediction nervous-system evidence spine + ScenarioMemory V1.
- Sprint 013B hosted + configured-Android Personal/Shared Prediction V1 trace gate.
- Sprint 013C controlled SleepLayer serving/evaluation/manual-canary/rollback gate.
- **#174 reacted-Item resurfacing policy**: hosted `resurfacing-v1` suppression/reminder policy with rollback-tested terminal suppression, age/cooldown/frequency caps, candidate-pool cap and Profile isolation.

### Implemented but configured-device acceptance deferred

- **#175 / `MVP-NAV-004` bottom SharedProfile quick switcher**: implementation uses the existing `ActiveProfileContext` and canonical Groups route; automated CI is required before merge and configured-Android acceptance is still required before the requirement is marked complete.
- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171/current Room-lighting/target/profile-hydration follow-up needs refreshed Android review.

CI or hosted verification does not substitute for those explicit device checks.

## Prediction / evolution state

Issue #156's MVP implementation slice is complete. The same canonical Prediction path covers online serving and controlled offline evolution:

```text
Events
  -> Working / Short / Long state
  -> Prediction V1 + same-Profile ScenarioMemory
  -> resurfacing-v1 eligibility/slate policy
  -> immutable PredictionRun + complete Candidate pool
  -> prospective frozen Challenger shadows
  -> mature exposed-outcome EvaluationWindow / GenomeEvaluation
  -> evidence-gated manual Profile canary
  -> reversible rollback
```

Hosted SleepLayer migrations remain:

- `20260904170000_sleep_layer_v1_foundation.sql` -> hosted `20260904134409 sleep_layer_v1_foundation`,
- `20260904172000_sleep_layer_v1_fk_indexes.sql` -> hosted `20260904134901 sleep_layer_v1_fk_indexes`,
- `20260904180000_sleep_layer_v1_serving_and_profile_canary.sql` -> hosted `20260904140919 sleep_layer_v1_serving_and_profile_canary`.

Hosted reacted-Item policy:

- repository `20260904183000_reacted_item_resurfacing_policy_v1.sql` -> hosted `20260904142845 reacted_item_resurfacing_policy_v1`.

`resurfacing-v1` terminally suppresses consumed/rated/not-interested Items from normal discovery. Saved-only Items are normally suppressed but may become one reminder after 30 days when still unconsumed/unrated; reminder impressions have a 30-day cooldown, maximum two impressions in 90 days and maximum one reminder per candidate pool. Ordinary candidates always rank before a reminder. Suppressed candidates remain inspectable in the internal trace but are never selected for delivery. Lists/history remain unaffected.

Automatic production genome promotion remains **disabled in MVP 0.1**. Full autonomous genetic optimization, global auto-promotion, cohort production assignment and learned/LLM Challenger families remain post-MVP evidence work.

## Current navigation follow-up — #175

The bottom-center active Profile identity is being changed from a second Home shortcut into the requested compact SharedProfile switcher. The top Kajo mark remains the canonical Home control.

Implementation contract:

- up to five SharedProfiles,
- actor-local **usage count first, recency as tie-breaker**, deterministic membership-order fallback,
- local persistence through the already-installed SQLite-backed `expo-sqlite/kv-store`; no new package or backend table,
- selecting a row calls existing `ActiveProfileContext.selectProfile`,
- any active SharedProfile transition is observed by the persistent shell and updates local use ordering once,
- `Näytä lisää` routes to existing `/profiles/shared`,
- PersonalProfile remains available through the existing Profile/drawer flow,
- no direct database read from presentation and no duplicate membership/Profile state.

This remains **implemented/pending acceptance** until the merged main APK passes configured-Android switching and `Näytä lisää` checks.

## Remaining MVP Prediction work — #177 / `MVP-PRED-005`

The Sprint 013 design gate is resolved, but SharedProfile common-fit is still open. Implement an inspectable Shared-only common-fit component using Shared joint evidence plus authorized accepted-member PersonalProfile fit, minimum-member/consensus behavior and disagreement penalty. The Prediction target stays the SharedProfile; Personal Events/Scenarios are not copied into Shared history and no second Shared recommender is allowed.

## Other open MVP work

- #160 — production Supabase security hardening / release security.
- #127 — production auth email delivery/SMTP/domain and confirmation/recovery acceptance.
- #102 — refreshed configured-Android List acceptance.
- #138 — configured-Android messaging acceptance.
- PR #171/current main APK — refreshed Room lighting/targets/profile-hydration acceptance.
- `MVP-MEM-004` — confirm/document future memory-extension point before final MVP gate.
- #78 — optional logo polish only if it does not delay functional MVP.
- #73 — Google/Apple sign-in remains future unless explicitly promoted into MVP.

## Next MVP sequence

1. **Finish #175 acceptance** — CI/merge, then configured Android quick-switcher validation; mark `MVP-NAV-004` complete only after device evidence.
2. **#177 SharedProfile common-fit / MVP-PRED-005** through the existing canonical Prediction V1 path.
3. **Deferred configured-device acceptance** for #102/#138/current Room follow-up without reopening accepted architecture.
4. **Sprint 014** — production hardening, privacy/support/operations, auth delivery, signing/versioning, store assets, clean install/update acceptance and official store release; also close any remaining explicit MVP requirement such as `MVP-MEM-004`.
5. **MVP COMPLETE gate** — all accepted requirements/code on `main`, hosted state matches migrations, end-to-end Personal/Shared/Prediction flows pass, security/rollback/monitoring are ready, official store availability exists and the product owner accepts the installed release.

## Repository hygiene / non-duplication rules

- Follow `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md` before starting new work.
- One canonical implementation per capability; extend generic Profile/Item/Event/Prediction architecture.
- Deployed migrations are immutable; corrections use ordered forward migrations.
- `STATUS.md` = current truth, sprint docs = execution/history, `ROADMAP.md` = ordered future work.
- Do not merge speculative empty feature folders, duplicate documentation or unused abstraction layers.
- #160 security work stays separate from product/Prediction follow-ups.

## Important files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/HANDOFF_PROTOCOL.md`
- `/docs/project/sprints/SPRINT-013.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`
- `/apps/mobile/src/features/discovery/DiscoveryModeShell.tsx`
- `/apps/mobile/src/features/profiles/BottomProfileControl.tsx`
- `/apps/mobile/src/features/profiles/sharedProfileQuickAccess.ts`
- `/apps/mobile/src/features/profiles/sharedProfileRecentUse.ts`
- `/supabase/migrations/20260904183000_reacted_item_resurfacing_policy_v1.sql`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target after #175 implementation lands: **configured-Android #175 acceptance**, then **#177**. Do not rebuild Prediction V1/SleepLayer, enable automatic promotion, create a second Profile/group state, or fold #160 into these product follow-ups.
