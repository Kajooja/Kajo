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

### Implemented/hosted but configured-device acceptance deferred

- #102 Profile-scoped Lists.
- Sprint 012/#138 Profile messaging.
- PR #171 Room-lighting/target/profile-hydration follow-up needs refreshed Android review.

CI or hosted database verification does not substitute for these explicit device checks.

## Sprint 013 — current

Issue #156 owns the versioned Prediction nervous system and controlled evolution path.

### 13A — integrated

`main` contains the canonical five-layer design and the first executable nervous-system slice:

- `WorkingState`, `ShortTermState`, `LongTermState`, `ScenarioMemory`, privacy-gated future `PopulationMemory`,
- immutable `PredictionRun` and complete `PredictionCandidate` trace,
- bounded prediction-time Context/state snapshots,
- `rank_items_v1` wrapping the proven V0 scorer,
- same-Profile ScenarioMemory retrieval and inspectable score components,
- Item impression/dwell evidence,
- controlled `SleepLayer`/`EvolutionEngine` design with immutable genomes, prospective shadows, mature outcome windows, scoped Champions and rollback,
- no automatic production self-modification in MVP 0.1.

The integrated local gate passed lint, TypeScript, 156 tests and iOS/Android export smokes before the hosted phase.

### 13B — hosted database gate verified; device acceptance pending

Hosted Supabase project `Kajo` now contains:

- `20260904120025 prediction_nervous_system_v1`, corresponding to repository migration `20260902223000_prediction_nervous_system_v1.sql`,
- `20260904120420 fix_prediction_v1_candidate_returning`, preserved in the repository as the forward migration `20260904120420_fix_prediction_v1_candidate_returning.sql`.

The first hosted authenticated smoke exposed a real PL/pgSQL name collision in the candidate-write CTE: `RETURNING prediction_id` conflicted with the function OUT parameter of the same name. The original deployed migration remains immutable; the second forward migration qualifies the returned table column. No parallel predictor, replacement schema or duplicate recommendation path was introduced.

Post-fix hosted rollback verification proves:

- authenticated direct execution of `rank_items_v0` is denied,
- authenticated `rank_items_v1` is allowed only for an authorized Profile member,
- anonymous V1 and outsider V1 calls are denied,
- authenticated/anonymous clients have no direct SELECT/INSERT access to private Prediction trace tables,
- one PersonalProfile V1 request returning 5 results created exactly one `PredictionRun`, 15 candidates and 5 delivered candidates,
- one SharedProfile V1 request returning 4 results created exactly one matching Shared run and 12 candidates,
- controlled exact-Item delayed rating evidence produced Scenario reward `1.0` and support `1`, superseding the weaker earlier save,
- undo of that rating excluded the rating and correctly fell back to the still-valid weaker save reward (`0.5`),
- a second PersonalProfile received zero Scenario support from the first Profile's controlled evidence,
- all synthetic verification data was rolled back.

Representative query plans also use the intended Prediction run/candidate indexes. Current small-data baselines were approximately 9.9 ms for rebuilding one Profile memory snapshot and 0.24 ms for indexed run/candidate retrieval; these are development baselines, not scale SLOs.

Supabase advisors introduced no new exposed-API security blocker from Prediction V1. The `private.prediction_runs` / `private.prediction_candidates` “RLS enabled with no policy” INFO is intentional defense in depth because clients have no direct table grants. Existing leaked-password protection and unrelated performance advisories remain separately scoped release/security work.

**Remaining 13B gate:** configured Android acceptance must execute real discovery/actions and inspect resulting hosted run/candidate/Event correlation. Do not mark Sprint 013 accepted before that device evidence exists.

### 13C — next implementation slice

After configured-device trace acceptance, continue the same prediction architecture with:

- immutable `PredictorGenome` registry,
- prospective `ShadowPrediction` persistence/worker boundary,
- immutable `EvaluationWindow` and outcome-maturity rules,
- global/cohort/Profile evaluation with hierarchical shrinkage,
- versioned `PolicyAssignment` / `PromotionDecision`,
- manual promotion + reversible rollback only for MVP.

Do not create a second recommender, live genetic mutation loop or LLM serving path.

## Other open MVP work

- #160 — production Supabase security hardening; keep separate from Sprint 013 to avoid duplicate security work.
- #127 — production auth email delivery/SMTP/domain and confirmation/recovery acceptance.
- #102 — refreshed configured-Android List acceptance.
- #138 — configured-Android messaging acceptance.
- PR #171/current main APK — refreshed Room lighting/targets/profile-hydration acceptance.
- #78 — optional logo polish only if it does not delay functional MVP.
- #73 — Google/Apple sign-in is future work unless promoted into MVP explicitly.

## Next MVP sequence

1. **Finish Sprint 013B on Android** — run real Personal + Shared Prediction V1 discovery/action flow and inspect hosted trace/Event correlation.
2. **Sprint 013C** — implement the executable immutable Challenger/SleepLayer persistence and manual promotion/rollback path.
3. **Deferred device acceptance** — close #102/#138 and the PR #171 refreshed device checks without reopening accepted navigation/Room architecture.
4. **Sprint 014** — production hardening, privacy/support/operations, signing/versioning, store assets, clean install/update acceptance and official store release.
5. **MVP COMPLETE gate** — accepted requirements and code on `main`, permanent hosted backend, Personal/Shared/Prediction end-to-end verification, real-device acceptance, security/rollback/monitoring readiness, official store availability and final product-owner acceptance.

## Repository hygiene / non-duplication rules

- Continue from `main` only after checking open PR/Issue handoffs per `/AGENTS.md` and `/docs/project/HANDOFF_PROTOCOL.md`.
- One canonical implementation per capability; extend the generic Profile/Item/Event/Prediction architecture rather than introducing parallel media-specific versions.
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

Immediate target: finish **Sprint 013B configured-device trace acceptance** against the already-hosted Prediction V1. When that passes, move linearly to **Sprint 013C**. Do not reapply the hosted base migration, do not recreate the V1 scorer, do not duplicate #160 security hardening, and do not claim deferred #102/#138/Room acceptance from CI alone.
