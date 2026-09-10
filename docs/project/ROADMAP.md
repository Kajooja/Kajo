# Kajo Roadmap

Roadmap order is outcome-based, not tied to fixed two-week timeboxes. A sprint ends when its defined scope and handoff are complete.

This file owns execution order. `STATUS.md` owns the exact next task. `MVP.md` owns release requirements. `LAUNCH_LOOP.md` owns the Taste-first acquisition flow. Historical sprint files preserve implementation detail and must not be replaced by this summary.

## Product decision — 2026-09-07

The first public Kajo is no longer defined only as a store-downloadable BOOK/MOVIE recommender. It must also contain the complete **Taste-first launch loop**:

```text
external Taste/Friend link
→ anonymous Taste Test
→ useful cold-start PersonalProfile
→ honest holdout prediction challenge
→ recommendation preview
→ Google/Apple conversion without resetting taste
→ full Kajo
→ Friend invite / friend list
→ explicit SharedProfile creation from Friends
→ next invite
```

Algorithm quality remains the critical path. Do not build growth mechanics on top of a recommendation system that cannot yet produce trustworthy first-session value.

Scale principle: **design contracts for one million users; provision infrastructure for measured demand.** Do not add speculative distributed infrastructure before measured need.

## Milestone: MVP 0.1 — first public Kajo

MVP 0.1 means the first complete, externally usable BOOK/MOVIE Kajo that can acquire a new person from a link, learn them before registration, preserve that learning through account creation and turn the activated user into the next potential inviter.

The milestone may close only after:

- real BOOK/MOVIE catalog and legally usable presentation are production-ready,
- the algorithm and evidence spine pass correctness/evaluation gates,
- Taste Test establishes useful first-session taste,
- the holdout prediction challenge is mathematically truthful,
- anonymous → Google/Apple conversion preserves the same PersonalProfile/taste state,
- personal invite → accepted Friend relationship works without automatically creating a SharedProfile,
- Friends → explicit SharedProfile creation is easy and consent-based,
- the complete link-to-app funnel is observable and abuse-safe,
- a closed external beta validates the complete flow,
- production operations, privacy, recovery and store gates pass,
- the owner explicitly accepts the **Share Link Gate**.

Only after the Share Link Gate may the project say: **“Nyt on aika jakaa käyttäjille linkki.”**

## Completed foundation — Sprints 001–013

The following foundations already exist and remain valid. Detailed truth lives in the historical sprint files and current requirement statuses.

1. **Sprint 001 — Foundation**: repository memory, mobile skeleton, CI, domain contracts.
2. **Sprint 002 — Room**: recognizable minimalist 2D Room.
3. **Sprint 003 — Curtain & Theme**: global DiscoveryMode / ambient phase.
4. **Sprint 004 — Discovery UI**: BOOK/MOVIE discovery foundations.
5. **Sprint 005 — Swipe & History**: rating, not-interested, save/list/undo state foundations.
6. **Sprint 006 — Backend Foundation**: Supabase/Postgres/auth/Profile persistence.
7. **Sprint 007 — Event Engine**: actor/Profile-separated append-only evidence foundations.
8. **Sprint 008 — Prediction V0**: first generic server-owned ranking.
9. **Sprint 009 — Shared Kajo**: persistent SharedProfiles and membership foundations.
10. **Sprint 010 — Navigation & Profile Lifecycle**: stable Room/shell/Profile switching.
11. **Sprint 011 — Shared Curation & Named Lists**: Endorsement consensus + Lists foundations.
12. **Sprint 012 — Profile Messaging**: narrow Profile-scoped messaging foundations.
13. **Sprint 013 — Prediction Nervous System & ScenarioMemory**: Working/Short/Long/Scenario memory, versioned traces, PredictorGenome/SleepLayer architecture and controlled challenger foundations.

Accepted historical work is not reopened merely because later release gates are stricter.

# Release march order

## Phase 14 — Make the algorithm trustworthy

This phase remains first. Taste Test is not allowed to hide algorithm defects behind attractive onboarding.

### 14.0 — Clean database/replay and bootstrap-ranking truth

Requirements: `MVP-ALG-001`, `MVP-ALG-009`, current #207/#208 lineage.

Exit gate:

- clean install/replay strategy is accepted,
- opposite fresh PersonalProfiles with opposite bootstrap evidence rank the same unseen pool differently,
- correcting/removing bootstrap evidence changes ranking predictably,
- no Personal/Shared leakage,
- deterministic SQL regression coverage exists.

### 14.1 — Trustworthy action and delivery evidence

Requirements: `MVP-DATA-001..004`, `MVP-PRED-006`.

Exit gate:

- canonical action + current-state change is idempotent/atomic,
- persistent outbox survives termination/retry/account switch safely,
- exact delivered Profile/prediction/slate origin is preserved,
- delayed outcomes cannot be guessed onto the wrong prediction,
- Shared/search/List overlays keep truthful provenance.

### 14.2 — Serving/shadow equivalence and candidate availability

Requirements: `MVP-ALG-002..003`.

Exit gate:

- one versioned scoring/eligibility/policy contract serves Personal and Shared controls,
- shadow replay matches baseline semantics within documented tolerance,
- suppressed candidates trigger bounded refill,
- pagination does not duplicate or falsely exhaust the catalog.

### 14.3 — Real catalog and normalized shared features

Requirements: `MVP-CAT-001..003`, `MVP-ALG-005`.

May proceed alongside 14.0–14.2 where independent.

Exit gate:

- useful BOOK and MOVIE beta breadth,
- legal image/attribution path,
- descriptions/creator/year/language/tags sufficient for product and model use,
- repeatable provider refresh,
- versioned normalized cross-domain feature mapping with provenance.

### 14.4 — Adaptive memory and discovery policy

Requirements: `MVP-ALG-004..007`, bootstrap requirements.

Exit gate:

- WorkingState represents ordered session intent,
- Short/Long state use evidence-aware decay/support,
- native contradictory behavior can supersede old imports,
- one unusual session cannot erase durable taste,
- cross-domain transfer is bounded and ablated against no-transfer control,
- FOR_YOU/SURPRISE/RISK produce meaningfully different, tested policies,
- cold-start question selection is informative and recognition-aware.

### 14.5 — Operating SleepLayer and evaluation

Requirements: `MVP-ALG-008`, `MVP-BETA-002` foundations.

Exit gate:

- bounded scheduled worker runs retry-safely,
- delayed outcomes reconcile correctly,
- chronological evaluation and sample/support reporting work,
- manual canary and rollback are rehearsed,
- automatic/global promotion remains disabled until a later explicit evidence gate.

## Phase 15 — Taste-first acquisition foundation

This phase converts the good algorithm into a product that can acquire users. Canonical product contract: `docs/product/LAUNCH_LOOP.md`. Architecture decision: ADR-0007.

### 15.0 — Adaptive Taste Test + honest prediction challenge

Requirements: `MVP-TASTE-001..005`.

Build the Taste Test on the same real catalog, feature versions and prediction semantics proven in Phase 14.

Owner proposal (2026-09-10): roughly 10 movies then 10 books, with a clear
transition card before books; preserve the adaptive bounds and skip behavior
in LAUNCH_LOOP. The later device follow-up requires an always-available unknown
action even after accidental rating-wheel movement; unknown clears an unsubmitted
draft rather than becoming a rating. Current calibration evidence defects remain
Phase 14 priorities.

Exit gate:

- anonymous visitor can complete a bounded 12–24-opportunity adaptive test,
- unknown Items can be skipped without poisoning taste,
- question selection balances recognition and information gain,
- held-out known Items are predicted before their answers enter learning,
- challenge quality uses a documented honest metric and sample size,
- unseen preview recommendations come from the canonical production ranking boundary,
- first-session usefulness is validated against a fixed transparent baseline.

### 15.1 — Anonymous identity and web/app continuation

Requirements: `MVP-ACQ-001..004`, `MVP-AUTH-004`.

Exit gate:

- public Taste link works in a browser without installed app,
- installed app can receive the same canonical link route,
- anonymous identity/taste state is server-backed and recoverable within retention rules,
- Google/Apple conversion links/upgrades the identity without duplicate User/PersonalProfile,
- abandoned/failed auth does not destroy Taste progress,
- account-collision cases are safe.

### 15.2 — Recommendation preview and conversion funnel

Requirements: `MVP-ACQ-005..007`.

Exit gate:

- Taste completion shows a small personalized preview,
- CTA to Apple/Google does not reset cold start,
- campaign/referral attribution survives exactly once,
- funnel events are measurable without being misused as taste evidence,
- experiments are versioned.

## Phase 16 — Friend viral loop and Shared creation

### 16.0 — Personal Friend invite

Include the deferred owner UX idea: small “lähetä linkki” below Send invitation,
revealing the URL with one-tap copy. LAUNCH_LOOP owns the distinction between
Friend and Shared links; no premature public link implementation in Phase 14.

Requirements: `MVP-FRIEND-001..004`.

Exit gate:

- activated User can create a personal invite link,
- opaque token has expiry/revocation/use/rate limits,
- receiver follows the same Taste-first flow,
- receiver explicitly accepts after/auth conversion,
- one reciprocal Friend relationship is created idempotently,
- friendship exposes no private PersonalProfile evidence.

### 16.1 — Friend list and safety lifecycle

Requirements: `MVP-FRIEND-005..007`.

Exit gate:

- both users see each other in Friends,
- remove/block/reinvite rules are explicit and tested,
- enumeration/spam controls exist,
- Friendship remains distinct from SharedProfile membership.

### 16.2 — SharedProfile creation from Friends

Requirements: `MVP-GROUP-001..003` plus existing SharedProfile requirements.

Exit gate:

- two Friends can create a SharedProfile in one short explicit flow,
- 3+ member creation uses explicit member acceptance,
- no personal invite creates a group automatically,
- SharedProfile immediately uses the existing joint-learning/common-fit Prediction path,
- friend removal does not silently rewrite existing SharedProfile membership/history.

## Phase 17 — Complete core product and operational quality

### 17.0 — Browse/core UX completion

Requirements: existing `MVP-DISC-008..009`, `MVP-NAV-005`, `MVP-UX-001`, Lists/messages/Room/device acceptance.

Owner follow-up ideas recorded 2026-09-10, to size as separate increments here
once the existing dependencies pass:

- [#231](https://github.com/Kajooja/Kajo/issues/231): long-press selection in
  Discovery/Lists, grid not-interest/List add, then safe List moves/removals.
  Requires the canonical atomic/durable commands and truthful per-Item origin.
- [#230](https://github.com/Kajooja/Kajo/issues/230): private category statistics
  and independent unlock progress; weekly updates follow the 17.1/17.2 scheduling,
  measurement and privacy contracts. Enable community comparisons only with
  sufficiently supported anonymous aggregates.

Detailed rules and provisional 30/5 thresholds live in
[FUTURE_PLAN.md](../product/FUTURE_PLAN.md#fut-ux-001--personal-category-statistics--planned--230).
These are planned phase candidates, not delivered behavior or automatic new MVP
release blockers. They do not displace Phase 14 correctness, Taste or Friends.

Exit gate:

- contextual Lists, search/filters and authorized Profile surfaces are complete,
- accessibility/reduced-motion/error/offline states are usable,
- deferred Lists/messages/Room/device gates are accepted,
- graphics may continue to be tuned without changing domain contracts.

### 17.1 — Launch telemetry and experimentation

Requirements: `MVP-GROWTH-001..004`.

Exit gate:

- complete funnel is observable from link open through Taste, auth, Friend conversion and SharedProfile creation,
- model/Taste/campaign/CTA experiment versions are traceable,
- dashboards/queries can calculate completion, activation, D1/D7, invite conversion and successful discoveries,
- growth telemetry is not automatically recommendation reward.

### 17.2 — Privacy, abuse and beta operations

Requirements: `MVP-OPS-001..005`, Taste/Friend privacy requirements.

Exit gate:

- staging/production isolation,
- anonymous/Taste/invite retention and deletion,
- backups and restore,
- crash/queue/prediction/funnel diagnostics,
- invite rate limits, anti-enumeration, block/report paths,
- cost alerts/budgets,
- release build rejects development/mock configuration.

## Phase 18 — Closed beta of the complete growth loop

Target: first ~10–50 controlled external testers, expanding only when defects are diagnosable.

Beta must test **the actual intended acquisition flow**, not only pre-created accounts:

```text
link
→ Taste Test
→ challenge
→ preview
→ Google/Apple
→ Kajo
→ invite friend
→ Friend
→ create SharedProfile
→ joint recommendation
```

Exit gate:

- clean external users complete the flow without developer intervention,
- first-session recommendations are useful enough to continue,
- no critical identity/taste/invite duplication or privacy defects,
- delayed recommendation outcomes are collected,
- obvious funnel drop-offs and UX defects are fixed,
- owner accepts the beta behavior on representative Android/iOS devices.

A small beta does not prove small statistical model lifts. Sparse evidence remains insufficient evidence.

## Phase 19 — Production/store release candidate

### 19.0 — Production configuration and recovery

Finalize production project/domain/email/social auth, secrets, data lifecycle jobs, diagnostics, budget, restore and rollback.

### 19.1 — Store release candidate

Signed immutable builds, privacy/data-safety declarations, permissions, attribution, store assets, account linking/deletion, clean install/update and representative load/rollback gates.

### 19.2 — Installed store acceptance

The owner accepts the store-distributed build and all required code/evidence is on `main`.

## Phase 20 — Share Link Gate

This is a **decision gate**, not another feature sprint.

The assistant/agent may tell the owner **“Nyt on aika jakaa käyttäjille linkki”** only when all of the following are true:

- Phase 14 algorithm gates pass,
- Taste challenge is honest and useful,
- anonymous → permanent identity conversion is proven,
- Friend invite and Shared creation are proven,
- the full link-to-app funnel passes closed beta,
- production privacy/abuse/retention/recovery gates pass,
- store/public destination is usable,
- monitoring can detect failures and spend,
- owner has accepted the release build.

At that point Kajo may begin controlled real acquisition through Taste links, personal invites and measured campaigns.

# After first release

The long-term product vision is preserved in `docs/product/FUTURE_PLAN.md`. It does not block the first release unless explicitly promoted into MVP.

Default post-release order:

1. two-store completion if one platform is still pending,
2. broader BOOK/MOVIE catalog/search quality,
3. series,
4. stronger friend/group learning,
5. Helsinki hyperlocal events pilot,
6. music albums,
7. optional friend-review feed,
8. conditional local/global review discovery,
9. richer experience-memory layer,
10. evidence-gated PopulationMemory/evolution extensions,
11. only much later: consented local people discovery / friendship matching / dating research.

Distant ideas such as stranger compatibility, dating, planet/distributed network experiments and on-device learning remain preserved research directions. They must never displace the algorithm → Taste → Friend → Shared → public-release sequence above.
