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
- controlled SleepLayer/EvolutionEngine foundation with immutable genomes, frozen shadows, mature evaluation, manual Profile canary and rollback,
- 0–10 rating/consumed, not-interested, save/List and recent undo semantics,
- append-only Event/session evidence with actor/Profile/prediction correlation,
- PersonalProfile and consent-based 2-N SharedProfiles,
- Shared Endorsement -> unanimous consensus delivery,
- Profile-scoped system/custom Lists and Shared List approval,
- Profile-scoped messaging and combined invitation/message Inbox,
- email + nickname identity and email-or-nickname login.

Core architecture remains generic: `User` acts inside a `Profile`; `Prediction` targets the Profile; recommendable things remain `Item`s. Do not create media-specific duplicate user, List, Event or predictor architectures.

## Acceptance truth

### Accepted

- Sprints 001–010.
- Sprint 011/#151 Shared discovery + Endorsement consensus.
- persistent Room/backdrop/navigation direction and current minimalist straight-on Room contract.
- Sprint 013A Prediction nervous-system evidence spine + ScenarioMemory V1.
- Sprint 013B hosted + configured-Android Personal/Shared Prediction V1 trace gate.
- **Sprint 013C controlled SleepLayer serving/evaluation/manual-canary/rollback gate.**

### Implemented/hosted but configured-device acceptance deferred

- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171/current Room-lighting/target/profile-hydration follow-up needs refreshed Android review.

CI or hosted verification does not substitute for those explicit device checks.

## Sprint 013 — accepted

Issue #156's MVP implementation slice is complete. The same canonical Prediction path now covers online serving and controlled offline evolution:

```text
Events
  -> Working / Short / Long state
  -> Prediction V1 + same-Profile ScenarioMemory
  -> immutable PredictionRun + complete Candidate pool
  -> prospective frozen Challenger shadows
  -> mature exposed-outcome EvaluationWindow / GenomeEvaluation
  -> evidence-gated manual Profile canary
  -> reversible rollback
```

### 13C hosted state

Ordered hosted migrations:

- repository `20260904170000_sleep_layer_v1_foundation.sql` -> hosted `20260904134409 sleep_layer_v1_foundation`,
- repository `20260904172000_sleep_layer_v1_fk_indexes.sql` -> hosted `20260904134901 sleep_layer_v1_fk_indexes`,
- repository `20260904180000_sleep_layer_v1_serving_and_profile_canary.sql` -> hosted `20260904140919 sleep_layer_v1_serving_and_profile_canary`.

The implementation contains:

- immutable constrained `PredictorGenome` registry,
- current Prediction V1 baseline as global `Champion`,
- three bounded scalar `SHADOW` Challengers: ShortTerm tilt, Scenario tilt and novelty/exploration tilt,
- Profile/global `PolicyAssignment` resolution and append-only `PromotionDecision` audit,
- prospective shadow queue/worker using the exact frozen production candidate pool and as-of trace,
- immutable `EvaluationWindow`, `ShadowPredictionRun/Candidate` and `GenomeEvaluation`,
- exposed-outcome-only evaluation with explicit coverage and Profile shrinkage,
- one proven private V0.3 baseline candidate generator plus one genome-aware scalar policy layer; the historical public V0 symbol is only a non-serving baseline wrapper,
- canonical `rank_items_v1` serving the resolved genome without a second recommender,
- service-only evidence-gated manual **Profile** canary and rollback,
- no global Challenger promotion operation and no automatic promotion trigger.

### 13C acceptance evidence

Hosted rollback smokes proved:

- baseline compatibility: **36/36** compared BOOK/MOVIE-mode rows across FOR_YOU/SURPRISE/RISK had identical ranks, scores and confidence between the proven V0.3 baseline and the new baseline wrapper in the same transaction,
- authenticated users cannot execute V0 or the private scalar scorer; authenticated V1 remains allowed,
- a V1 baseline run attaches the baseline genome and queues three global shadow Challengers,
- the worker produced complete frozen shadow pools and the evaluator correctly reacted to controlled positive/negative rank changes,
- an evidence-qualified Profile canary caused real `rank_items_v1` serving to use `short-term-tilt-v1`,
- the canary affected only its target Profile; global and another Profile stayed on baseline,
- rollback restored `prediction-v1-baseline` and the following V1 run recorded baseline again,
- canary and rollback are executable by service role and denied to authenticated clients,
- deliberately weak evidence (`29` mature Outcomes) was rejected by the canary gate,
- all synthetic canary/evaluation data was rolled back.

Automatic production promotion remains **disabled in MVP 0.1**. Full autonomous genetic optimization, global auto-promotion, cohort production assignment and learned/LLM Challenger families remain post-MVP evidence work.

Supabase security guidance is followed for privileged internal functions: private schema, pinned empty `search_path` and explicit execution grants. Current advisors add no new exposed-API blocker from the serving gate. Private SleepLayer tables intentionally show `RLS enabled/no policy` INFO because direct client grants are absent. Existing leaked-password protection and unrelated Shared/List advisor items remain #160/release scope. See the Supabase database function and API-security guidance referenced during implementation.

## Immediate product follow-ups

### #174 — bounded resurfacing of already-reacted Items

Normal discovery must strongly suppress repeatedly reacted/terminal Items. A saved-only Item may intentionally return as a reminder after meaningful age when still unconsumed/unrated, but only behind versioned cooldown/frequency rules with an inspectable Prediction trace reason. Extend the existing generic Prediction policy; do not create another recommender.

### #175 — bottom Profile control SharedProfile quick switcher

Tapping the bottom Profile name/control should show up to five recent/used SharedProfiles plus `Näytä lisää`, which routes to the existing canonical group page. Reuse current Profile/navigation state and membership source; do not create duplicate group management.

These remain separate scopes. #174 is Prediction policy; #175 is navigation.

## Other open MVP work

- #160 — production Supabase security hardening / release security.
- #127 — production auth email delivery/SMTP/domain and confirmation/recovery acceptance.
- #102 — refreshed configured-Android List acceptance.
- #138 — configured-Android messaging acceptance.
- PR #171/current main APK — refreshed Room lighting/targets/profile-hydration acceptance.
- #78 — optional logo polish only if it does not delay functional MVP.
- #73 — Google/Apple sign-in remains future unless explicitly promoted into MVP.

## Next MVP sequence

1. **#174 reacted-Item resurfacing policy** through the existing versioned Prediction path.
2. **#175 bottom Profile quick switcher** through the existing Profile/navigation architecture.
3. **Deferred configured-device acceptance** for #102/#138/current Room follow-up without reopening accepted architecture.
4. **Sprint 014** — production hardening, privacy/support/operations, auth delivery, signing/versioning, store assets, clean install/update acceptance and official store release.
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
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`
- `/apps/mobile/src/features/discovery/predictionOperations.ts`
- `/apps/mobile/src/features/discovery/usePredictionRanking.ts`
- `/supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`
- `/supabase/migrations/20260904120420_fix_prediction_v1_candidate_returning.sql`
- `/supabase/migrations/20260904170000_sleep_layer_v1_foundation.sql`
- `/supabase/migrations/20260904172000_sleep_layer_v1_fk_indexes.sql`
- `/supabase/migrations/20260904180000_sleep_layer_v1_serving_and_profile_canary.sql`

## Handoff

A fresh conversation may start with **"jatketaan reposta"** and must follow `/AGENTS.md`.

Immediate target after this Sprint 013 acceptance branch lands: **#174**, then **#175**. Do not rebuild Prediction V1/SleepLayer, enable automatic promotion, create a second scorer, or fold #160 into these product follow-ups.
