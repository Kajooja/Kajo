# Kajo Current Status

Last updated: **2026-09-04**  
Current milestone: **MVP 0.1**  
Current sprint: **Sprint 013 — Prediction nervous system / ScenarioMemory** (`sprints/SPRINT-013.md`)  
Last accepted sprint: **Sprint 010 — Navigation & Profile lifecycle** (`sprints/SPRINT-010.md`)

This is the authoritative current-state document. Sprint files preserve detailed execution history; this file intentionally does **not** repeat that history.

## Current product state

Kajo is a phone-runnable Expo/React Native application with:

- one fixed illustrated 2D Room as the authenticated home/backdrop,
- global `DiscoveryMode` control and phase-aware Room atmosphere,
- BOOK/MOVIE discovery, detail and swipe-style browsing,
- Profile-targeted Prediction V1 on hosted Supabase,
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

- Sprints 001–010 are accepted.
- Sprint 011/#151 Shared discovery + Endorsement consensus is accepted.
- The persistent full-screen Room/backdrop/navigation direction is accepted.
- The current minimalist straight-on Room direction is accepted as the durable visual contract.
- **Sprint 013B Prediction V1 hosted + configured-Android trace gate is accepted.**

### Implemented/hosted but configured-device acceptance deferred

- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171 Room-lighting/target/profile-hydration follow-up needs refreshed Android review.

CI or hosted database verification does not substitute for these explicit device checks.

## Sprint 013 — current

Issue #156 owns the versioned Prediction nervous system and controlled evolution path.

### 13A — integrated

`main` contains the canonical five-layer design and first executable nervous-system slice:

- `WorkingState`, `ShortTermState`, `LongTermState`, `ScenarioMemory`, privacy-gated future `PopulationMemory`,
- immutable `PredictionRun` and complete `PredictionCandidate` trace,
- bounded prediction-time Context/state snapshots,
- `rank_items_v1` wrapping the proven V0 scorer,
- same-Profile ScenarioMemory retrieval and inspectable score components,
- Item impression/dwell evidence,
- controlled `SleepLayer`/`EvolutionEngine` design with immutable genomes, prospective shadows, mature outcome windows, scoped Champions and rollback,
- no automatic production self-modification in MVP 0.1.

### 13B — accepted on configured Android

Hosted Supabase contains the ordered Prediction V1 migrations, including the forward-only fix for the hosted PL/pgSQL `prediction_id` collision. Authorization, Scenario reward precedence, undo exclusion, cross-Profile isolation, candidate persistence and representative query plans were already verified against hosted data.

Configured Android acceptance on 2026-09-04 then proved the real mobile path:

- PersonalProfile rating produced a `hosted` Event tied to a real `prediction-v1.0` PredictionRun,
- SharedProfile rating produced the same complete hosted chain independently,
- for both actions `profile_id`, `actor_user_id` and `session_id` matched the PredictionRun,
- matching PredictionCandidate rows existed and were `selected_for_delivery = true`,
- the earlier immediate actions remained explicitly marked `predictionSource=fallback`, proving hosted and fallback traces are analytically distinguishable,
- the mobile hook has an intentional 600 ms refresh delay; accepted follow-up hosted impression persistence was observed roughly 0.56–1.40 s after the server run timestamp at current development scale. This is a device/development baseline, not a production SLO.

No duplicate predictor, schema or client-side recommendation path was introduced.

### 13C — next implementation slice

Continue the same Prediction architecture with:

- immutable `PredictorGenome` registry and constrained weight schemas,
- prospective `ShadowPrediction` persistence/worker using frozen production-run input,
- immutable `EvaluationWindow` plus outcome maturity/comparable-episode/coverage rules,
- global/cohort/Profile `GenomeEvaluation` with hierarchical shrinkage,
- versioned `PolicyAssignment` and `PromotionDecision` audit,
- manual promotion + reversible rollback only for MVP.

Automatic production promotion remains disabled until external-beta/online experiment gates exist. Do not create a second recommender, live genetic mutation loop or LLM serving path.

## Product findings queued without changing the 13C boundary

- **#174 — reacted Item resurfacing policy.** Normal discovery should suppress repeatedly reacted/terminal Items. A saved-only Item may occasionally return as a reminder after meaningful age if still unconsumed/unrated, with versioned cooldown/frequency limits and inspectable trace reasons.
- **#175 — bottom Profile control SharedProfile quick switcher.** Tapping the bottom Profile name/control should show up to five recent/used SharedProfiles and `Näytä lisää`, which routes to the existing canonical Groups/SharedProfile page. Reuse current Profile state/navigation; do not create duplicate group UI or membership state.

These are separate scopes. #174 belongs to the existing Prediction policy path; #175 is a navigation follow-up and must not be mixed into SleepLayer persistence work.

## Other open MVP work

- #160 — production Supabase security hardening; keep separate from Sprint 013 to avoid duplicate security work.
- #127 — production auth email delivery/SMTP/domain and confirmation/recovery acceptance.
- #102 — refreshed configured-Android List acceptance.
- #138 — configured-Android messaging acceptance.
- PR #171/current main APK — refreshed Room lighting/targets/profile-hydration acceptance.
- #174 — bounded resurfacing of already-reacted Items.
- #175 — recent SharedProfiles from bottom Profile control.
- #78 — optional logo polish only if it does not delay functional MVP.
- #73 — Google/Apple sign-in is future work unless promoted into MVP explicitly.

## Next MVP sequence

1. **Sprint 013C** — implement executable immutable Challenger/SleepLayer persistence, evaluation and manual promotion/rollback path.
2. **Prediction/UI follow-ups** — integrate #174 through the same versioned prediction policy and implement #175 through the existing Profile/navigation architecture.
3. **Deferred device acceptance** — close #102/#138 and refreshed PR #171 checks without reopening accepted navigation/Room architecture.
4. **Sprint 014** — production hardening, privacy/support/operations, signing/versioning, store assets, clean install/update acceptance and official store release.
5. **MVP COMPLETE gate** — accepted requirements/code on `main`, permanent hosted backend, Personal/Shared/Prediction end-to-end verification, real-device acceptance, security/rollback/monitoring readiness, official store availability and final product-owner acceptance.

## Repository hygiene / non-duplication rules

- Continue from `main` only after checking open PR/Issue handoffs per `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md`.
- One canonical implementation per capability; extend generic Profile/Item/Event/Prediction architecture rather than introducing parallel media-specific versions.
- Deployed migrations are immutable. Corrections use ordered forward migrations.
- `STATUS.md` states current truth; sprint files hold execution detail; `ROADMAP.md` holds ordered future work. Do not copy the same historical narrative into all three.
- Do not merge speculative empty feature folders, duplicate documentation or unused abstraction layers.
- Open PR #162/#160 security work is separately owned; Sprint 013 must not recreate it.

## Important files

- `/AGENTS.md`
- `/docs/project/STATUS.md`
- `/docs/project/ROADMAP.md`
- `/docs/project/HANDOFF_PROTOCOL.md`
- `/docs/project/milestones/MILESTONE-001-MVP.md`
- `/docs/project/sprints/SPRINT-013.md`
- `/docs/product/MVP.md`
- `/docs/product/UX_PRINCIPLES.md`
- `/docs/domain/GLOSSARY.md`
- `/docs/domain/DOMAIN_MODEL.md`
- `/docs/domain/DATA_EVENTS.md`
- `/docs/domain/PREDICTION_MODEL.md`
- `/docs/architecture/CODEMAP.md`
- `/docs/architecture/decisions/0005-versioned-prediction-nervous-system.md`
- `/apps/mobile/src/features/discovery/predictionOperations.ts`
- `/apps/mobile/src/features/discovery/usePredictionRanking.ts`
- `/apps/mobile/src/features/events/`
- `/supabase/migrations/20260902223000_prediction_nervous_system_v1.sql`
- `/supabase/migrations/20260904120420_fix_prediction_v1_candidate_returning.sql`

## Handoff

A fresh conversation must follow `/AGENTS.md` and may start with **"jatketaan reposta"**.

Immediate target: **Sprint 013C SleepLayer implementation** on top of the accepted hosted/device-verified Prediction V1. Do not reapply Prediction V1, recreate the scorer, fold #160 security work into this sprint, or mix #175 navigation work into the SleepLayer branch.