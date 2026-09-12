# Kajo Roadmap

Roadmap order is outcome-based, not tied to fixed two-week timeboxes. A sprint ends when its defined scope and handoff are complete.

This file owns execution order. `STATUS.md` owns the exact next task. `MVP.md` owns release requirements. `LAUNCH_LOOP.md` owns the Taste-first acquisition flow. Historical sprint files preserve implementation detail and must not be replaced by this summary.

## Product decision — 2026-09-07

The first public Kajo is not only a store-downloadable BOOK/MOVIE recommender. It must contain the complete **Taste-first launch loop**:

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

Algorithm quality remains the critical path. Do not build growth mechanics on a recommendation system that cannot produce trustworthy first-session value.

Scale principle: **design contracts for one million users; provision infrastructure for measured demand.** Do not add speculative distributed infrastructure before measured need.

## Engine refinement — 2026-09-12 / ADR-0008

The [Predictive Memory Engine](../architecture/PREDICTIVE_MEMORY_ENGINE.md) is an independent reusable system; Kajo is its first adapter. Preserve all 51 conceptual sections and their staged ambitions. [Data enrichment](../architecture/DATA_ENRICHMENT.md) adds isolated public-data research before large native volume exists.

Advance portable contracts and an honest MovieLens baseline experiment into Phase 14. This is not permission to treat external ratings as complete Kajo Scenarios, create external people as Kajo accounts, deploy a licensed artifact without review or turn on Kajo-wide PopulationMemory. No full neural world model, multistep DreamEngine, ANN index or automatic promotion is required for first release.

The active #229 evidence/pagination packet keeps its own acceptance and rollout gates. E1/D1/D2 can proceed independently as explicitly named source/research work; E2 runtime integration cannot bypass Phase 14.1/14.2. STATUS identifies the exact active branch and next bounded unit.

Default continuation is **finish the next #228/#229 page-delivery unit**, then
complete its native/client/recovery/rollout acceptance before closing that packet.
The next engine packet is [E1 #235](https://github.com/Kajooja/Kajo/issues/235),
followed by [D1 #236](https://github.com/Kajooja/Kajo/issues/236) and
[D2 #237](https://github.com/Kajooja/Kajo/issues/237). An explicit switch to isolated
E1 research is possible while native gates wait, but must be recorded in STATUS.
Do not interleave two implicit tasks or wait for a large Kajo population to start D1.

## Milestone: MVP 0.1 — first public Kajo

MVP 0.1 means the first complete, externally usable BOOK/MOVIE Kajo that can acquire a new person from a link, learn them before registration, preserve that learning through account creation and turn the activated user into the next potential inviter.

The milestone may close only after:

- real BOOK/MOVIE catalog and legally usable presentation are ready,
- the algorithm and evidence spine pass correctness/evaluation gates,
- portable engine contracts and the external-data baseline report are reproducible, with a recorded artifact admission/rejection decision,
- Taste Test establishes useful first-session taste and its holdout challenge is truthful,
- anonymous → Google/Apple conversion preserves the same PersonalProfile,
- personal invite → Friend works without automatically creating a SharedProfile,
- Friends → explicit SharedProfile creation is easy and consent-based,
- the link-to-app funnel is observable and abuse-safe,
- closed beta validates the complete flow,
- production/privacy/recovery/store gates and owner acceptance pass,
- the **Share Link Gate** is explicitly accepted.

Only after that gate may the project say: **“Nyt on aika jakaa käyttäjille linkki.”**

## Completed foundation — Sprints 001–013

These foundations remain valid; exact implementation/acceptance truth stays in historical sprint records and current requirement statuses.

1. **001 — Foundation:** repository memory, mobile skeleton, CI and domain contracts.
2. **002 — Room:** minimalist 2D Room.
3. **003 — Curtain & Theme:** global DiscoveryMode and ambient phase.
4. **004 — Discovery UI:** BOOK/MOVIE discovery.
5. **005 — Swipe & History:** rating, not-interest, save/list/undo state.
6. **006 — Backend Foundation:** Supabase/Postgres/auth/Profile persistence.
7. **007 — Event Engine:** actor/Profile-separated append-only evidence.
8. **008 — Prediction V0:** first generic server-owned ranking.
9. **009 — Shared Kajo:** persistent SharedProfiles and membership.
10. **010 — Navigation & Profile Lifecycle:** Room/shell/Profile switching.
11. **011 — Shared Curation & Named Lists:** Endorsement consensus and Lists.
12. **012 — Profile Messaging:** narrow Profile-scoped messaging.
13. **013 — Prediction Nervous System & ScenarioMemory:** Working/Short/Long/Scenario memory, versioned traces and controlled challenger foundations.

Accepted work is not reopened merely because later release gates are stricter.

# Release march order

## Phase 14 — Make the algorithm trustworthy and the engine portable

Taste Test must not hide algorithm defects behind attractive onboarding. Research is isolated from production; documentation and offline results are not rollout acceptance.

### 14.0 — Clean database/replay and bootstrap-ranking truth

Requirements: `MVP-ALG-001`, `MVP-ALG-009`, #207/#208 lineage.

Exit: accepted clean-install/replay strategy; opposite fresh Personal bootstrap evidence changes unseen ranking; correction/removal recomputes influence; no Personal/Shared leakage; deterministic SQL regression coverage. Preserve accepted technical work and its distinct remaining quality/device gates.

### 14.1 — Trustworthy action and delivery evidence

Requirements: `MVP-DATA-001..004`, `MVP-PRED-006`.

Exit: canonical action/current state is idempotent and atomic; persistent outbox survives termination/retry/account switch; exact delivered Profile/prediction/slate origin; delayed outcomes never guessed onto a run; Shared/search/List overlays retain truthful provenance.

The first-release [#232](https://github.com/Kajooja/Kajo/issues/232) SharedRatingRound
contract also needs participant/round provenance, pending versus completed
outcomes and correction semantics here. Specify member-seen/rewatch eligibility
under 14.2; deliver the coordinated user flow in 16.3. An already known evidence
defect must not be hidden behind that later UI milestone.

### 14.2 — Serving/shadow equivalence and candidate availability

Requirements: `MVP-ALG-002..003`.

Exit: one versioned scoring/eligibility/policy contract for Personal/Shared; baseline shadow parity within declared tolerance; bounded refill after suppression; identified empty responses; duplicate-free, scope-safe pagination without falsely claiming catalog exhaustion.

The active source packet implements protocol-2 atomic pages and the captured-scope mobile reader with per-page origins, alongside native concurrency/populated-upgrade checks. Verify the current published head, then perform the exact existing-database forward preflight/rollout before configured-client and device acceptance. Every new page has its own immutable delivery trace; an old run cannot be rewritten to explain a new page. Protocol 1 stays compatible and has no continuation.

The captured reader must also bind visible cache/readiness to environment, actor,
Profile, session, domain, mode and request/revision. Test rapid A → B → A Profile
return, session changes, delayed responses and errors; an effect refetch alone
does not prove that a cached run belongs to the current session. Continuation
acceptance includes concurrent window-cap creation and populated window upgrades,
not only first-page retry races.

### 14.3 — Real catalog and normalized shared features

Requirements: `MVP-CAT-001..003`, `MVP-ALG-005`.

May proceed alongside independent 14.0–14.2 work.

Exit: useful BOOK/MOVIE beta breadth; legal images/attribution; sufficient description/creator/year/language/tags; repeatable bounded refresh; versioned normalized cross-domain feature mapping with provenance and neutral missing-feature behavior.

Before catalog expansion, close #182's source-audit deployment gaps: explicitly
declare the catalog Edge JWT/service-key boundary, pin reproducible Edge imports
and validate entrypoints plus unauthorized/authorized requests. Existing mobile
and Node normalizer tests alone do not verify Edge deployment.

Public research features are a separate path from provider presentation metadata. Do not contaminate production catalog or user evidence while building the research workspace.

### 14.3A — Portable contracts and external-data research

Requirements: `MVP-ENG-001..003`. Canonical design: ADR-0008 and [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md). This is a bounded foundation, not an indefinite model-search project.

**E1 — contracts and fixtures, first engine-specific packet ([#235](https://github.com/Kajooja/Kajo/issues/235)).** Create an executable generic contract boundary for Subject/acting identity, State, Object, Action, Observation, Outcome, Scenario and version/provenance information. Map Kajo Profile/Item without renaming app identities. Exercise deterministic media and small synthetic non-media adapters through a standalone command. Add the actual workspace/exports and engine lint/typecheck/tests to root `npm run check`; currently only `apps/*` workspaces exist. Test missingness, observed/external/synthetic separation, horizons, as-of inputs and hard constraints. Keep runtime SQL unchanged; source extraction requires parity, not a duplicate drifting scorer.

**D1 — isolated MovieLens manifest and adapter ([#236](https://github.com/Kajooja/Kajo/issues/236)).** After E1's record boundary, implement streaming/idempotent normalization and deterministic small-cohort processing. Validate checksums, CSV/ratings/IDs, namespaces, mappings, duplicates, chronological ordering, quarantine and resource bounds. Then record the actual permitted download and normalized real cohort. No production credentials or native User/Profile/Event writes. Use ignored `research-data/` and `research-artifacts/` locations or explicitly equivalent isolated storage; exclude raw/derived data from ordinary CI artifacts before download.

**D2 — reproducible baseline evaluation ([#237](https://github.com/Kajooja/Kajo/issues/237)).** Compare train-only transparent means/neighbors and an explicit-rating factorization challenger through the same research contract. Include one bounded declared static-state versus ordered-prefix/trajectory-retrieval experiment; a negative or insufficient-evidence result is valid. Freeze global chronological splits, held-out-subject cold-start prefixes, transforms/artifact cutoffs, baselines, metrics and final test before selection. Report coverage, uncertainty, task limitations, cost and prior/enrichment ablations where available. Scale to the full dataset only after the small run is correct and resource-bounded.

Exit: reproducible contracts/adapter/report and a documented admit/reject/defer decision. A challenger need not win. No probabilities, counterfactual uplift, group behavior or cross-domain competence may be fabricated from rating-only data. A losing or rights-blocked prior stays out of serving; the transparent baseline remains usable.

**D3 — optional Tag Genome enrichment** follows the baseline: one named variant, mapping/coverage/range/rights checks, temporal-feature availability and no-enrichment comparison.

**D4 — optional Beliefs release-2 study** follows verified schema and pairing rules: distinguish no-response, expected and actual rating; require valid temporal follow-up and report missing outcomes. Neither optional packet is a hidden MVP blocker.

**D5 — optional KuaiRand-1K sequence/exposure study** follows D2 and its own
release/rights/adapter manifest; D3/D4 are not prerequisites. Test temporal state
and exposure selection with the source's random-intervention support. Pure is not
a complete sequence substitute; exclude whole-period aggregates from historical
features. Random exposure still does not reveal every individual's counterfactual.
Goodreads/Amazon and real non-recommendation tasks remain conditional later
research, not downloads hidden inside D1 or automatic release blockers.

**E2 — optional admitted component integration** occurs only after relevant 14.1/14.2 gates and artifact rights/compatibility/quality checks. Reuse the existing Kajo serving boundary, freeze artifact versions in traces and test absence/withdrawal/fallback, Personal/Shared isolation and rollback. Hosted and device acceptance are separate. Offline training is never an automatic production switch.

### 14.4 — Adaptive memory and discovery policy

Requirements: `MVP-ALG-004..007`, bootstrap requirements and E1 contracts.

Exit: ordered session intent; source-aware Short/Long decay and effective support; native contradiction can supersede imports; one unusual session cannot erase durable taste; bounded/ablated cross-domain transfer; meaningful tested FOR_YOU/SURPRISE/RISK differences; informative recognition-aware cold start.

BeliefState may explicitly say uncalibrated/unknown. WorldState stays separate from durable personal memory. A future admitted ExternalTastePrior must be separately bounded and ablated, not double-counted as both bootstrap and native evidence.

### 14.5 — Operating SleepLayer and evaluation

Requirements: `MVP-ALG-008`, `MVP-BETA-002` foundations.

Exit: bounded retry-safe scheduled worker; correct delayed/corrected outcomes; chronological evaluation with sample/support/coverage; manual canary and rollback rehearsed. Automatic/global promotion remains disabled.

Error diagnostics and consolidation operate on truthful evidence. Synthetic dreams stay separate; a model cannot validate itself against its own generated outcomes. Long-horizon simulation is not required here.

## Phase 15 — Taste-first acquisition foundation

Canonical product contract: [LAUNCH_LOOP](../product/LAUNCH_LOOP.md). Architecture decision: ADR-0007. Build on useful, trustworthy Phase 14 behavior.

### 15.0 — Adaptive Taste Test + honest prediction challenge

Requirements: `MVP-TASTE-001..005` plus preview/usefulness gates.

Exit: bounded 12–24-opportunity anonymous test; unknown Items do not poison taste; recognition/information/diversity balance; held-out predictions frozen before answers; documented metric/support; preview from canonical production ranking; useful first-session behavior against a fixed baseline.

LAUNCH_LOOP retains the owner's roughly ten movies → transition → ten books
proposal inside adaptive bounds, always-available unknown response even after
rating-wheel movement, and preservation of already accepted Personal taste.

External benchmark results cannot substitute for this real Kajo first-session acceptance.

### 15.1 — Anonymous identity and web/app continuation

Requirements: `MVP-ACQ-001..004`, `MVP-AUTH-004` and identity continuity requirements.

Exit: browser-capable public Taste link; equivalent installed-app route; server-backed resumable anonymous state; Google/Apple link/upgrade without duplicate User/PersonalProfile; failed/abandoned auth preserves accepted taste inside retention; safe account collisions.

Resolve the runtime routing decoder advisory in #238 before public-link acceptance.
Use a compatible parent update/interop fix with malformed-link regressions; a bare
decoder override breaks the installed CommonJS consumer. Coordinated build/test
dependency maintenance remains under MVP-OPS-005; no forced framework downgrade.

### 15.2 — Recommendation preview and conversion funnel

Requirements: `MVP-ACQ-005..007`.

Exit: personalized preview before primary auth CTA; auth does not reset cold start; campaign/referral attribution survives exactly once; funnel measured separately from reward; experiments versioned.

## Phase 16 — Friend viral loop and Shared creation

### 16.0 — Personal Friend invite

Requirements: `MVP-FRIEND-001..004`.

Exit: activated User creates opaque expiring/revocable/rate-limited invite; receiver uses the same Taste flow; explicit acceptance after/through permanent identity; one reciprocal idempotent Friendship; no private Personal evidence exposed.

Include LAUNCH_LOOP's explicit link reveal/one-tap-copy UX; keep Friend and Shared
invites distinct.

### 16.1 — Friend list and safety lifecycle

Requirements: `MVP-FRIEND-005..007`.

Exit: both users see the connection; remove/block/reinvite behavior is safe under replay; enumeration/spam protection; Friendship independent of Shared membership.

### 16.2 — SharedProfile creation from Friends

Requirements: `MVP-GROUP-001..003` and existing SharedProfile requirements.

Exit: short explicit two-Friend creation; 3+ members still accept membership; invites never create a group automatically; canonical joint/common-fit predictor, not a second recommender; Friend removal does not rewrite Shared history/membership.

### 16.3 — Shared experience rating and controlled rewatch

Requirements: `MVP-SOCIAL-007..009`, [#232](https://github.com/Kajooja/Kajo/issues/232).
Required before the complete beta, after Personal Taste/setup and Phase 14's
evidence/eligibility contracts.

Exit: A's attributed Shared rating prompts the other required participants; all
required individual responses precede completed joint history. Keep disagreement,
Personal/joint separation, atomic completion, corrections/retries/membership
changes and truthful legacy provenance. A new joint rewatch is a new experience
with retained history and a bounded versioned eligibility policy. Two-account and
N-member server/CI/device cases must pass; completion alone is not satisfaction.

## Phase 17 — Complete core product and operational quality

### 17.0 — Browse/core UX completion

Requirements: `MVP-DISC-008..009`, `MVP-NAV-005`, `MVP-UX-001`, Lists/messages/Room/device acceptance.

Exit: contextual Lists, search/filters and authorized Profile surfaces; accessibility/reduced motion/error/offline states; deferred device gates; graphics may evolve without changing domain contracts. Preserve planned #231 multi-select/trash work in its product scope rather than mixing it into engine extraction.

Size #230 private category statistics, #231 multi-select/List moves/history trash
and FUT-UX-003 joint-list choice as separate candidates here. Their full contracts
belong to FUTURE_PLAN; they are not automatically added release blockers. Weekly
statistics/community comparisons additionally depend on 17.1/17.2.

### 17.1 — Launch telemetry and experimentation

Requirements: `MVP-GROWTH-001..004`.

Exit: complete link/Taste/auth/Friend/Shared funnel observable; model/Taste/campaign/CTA versions traceable; completion, activation, D1/D7, invite conversion and useful discoveries queryable; growth telemetry is not automatically reward.

### 17.2 — Privacy, abuse and beta operations

Requirements: `MVP-OPS-001..006`, Taste/Friend privacy requirements.

Exit: staging/production isolation; anonymous/Taste/invite retention/deletion; backups/restore; crash/queue/prediction/funnel diagnostics; invite limits/anti-enumeration/block and abuse-report handling; cost alerts; fail-closed production configuration.

The repository audit found production build configuration still optional and
unconfigured clients still able to enter mock mode. `MVP-OPS-005` must reject
missing production settings and privileged key shapes before bundling, while
retaining explicit local demo/test behavior. Under #160/#184 validate password
endpoint JSON shapes, intended enumeration responses and rate limits before
anonymous/public entry. These are open source findings, not verified hosted defects.

Research artifacts and derived model/index dependencies participate in their own rights, withdrawal and lifecycle controls. Do not ship research data or service credentials to clients.

## Phase 18 — Closed beta of the complete growth loop

Target: first approximately 10–50 controlled external testers, expanding only when defects are diagnosable.

Test the intended path, not merely pre-created accounts:

```text
link → Taste Test → challenge → preview → Google/Apple → Kajo
     → invite Friend → Friendship → explicit SharedProfile → joint recommendation
```

Exit: clean external users complete it without developer intervention; useful initial recommendations; no critical identity/taste/invite/privacy defects; delayed outcomes collected; major funnel/UX defects fixed; owner acceptance on representative Android/iOS devices.

A small beta is not proof of a small statistical model lift. Sparse evidence remains insufficient evidence.

## Phase 19 — Production/store release candidate

### 19.0 — Production configuration and recovery

Finalize project/domain/email/social auth, secrets, data/artifact lifecycle, diagnostics, budget, restore and rollback.

### 19.1 — Store release candidate

Signed immutable builds, privacy/data-safety declarations, permissions, attribution, store assets, account linking/deletion, clean install/update, load and rollback gates.

### 19.2 — Installed store acceptance

Owner accepts the store-distributed build; all required code and evidence are on main. An open documentation or implementation PR alone is not release acceptance.

## Phase 20 — Share Link Gate

This is a **decision gate**, not another feature sprint. The assistant/agent may say **“Nyt on aika jakaa käyttäjille linkki”** only after Phase 14, truthful/useful Taste, identity continuity, Friend/Shared authorization, complete-flow beta, production privacy/recovery, usable store/public destination, monitoring/spend controls and owner release acceptance all pass.

Then begin controlled real acquisition through Taste links, personal invites and measured campaigns.

# After first release

The full vision remains in [FUTURE_PLAN](../product/FUTURE_PLAN.md), and the complete reusable engine generations remain in [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md).

Default product continuation: two-store completion if needed; broader BOOK/MOVIE/search quality; series; stronger friend/group learning; Helsinki hyperlocal events pilot; music albums; optional friend-review feed; conditional local/global discovery; richer memories; privacy-gated native PopulationMemory/evolution extensions; much later, consented local people discovery/friendship/dating research.

Engine progression is evidence-driven: Transparent Engine → Latent Memory Engine → explicit World Model → bounded multistep Dreaming Engine → self-evolving geometry. Early external representation research does not automatically advance production to a later generation. On-device/distributed/graph-infrastructure experiments remain conditional and must not displace the release march.
