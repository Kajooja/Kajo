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

Owner device feedback on 2026-09-12 accepts the exercised #229 flows with the
reconnect retry-UI defect retained as #240. The owner places application UI work
in a later pre-MVP packet. **E1 #235, D1 #236 and D2 #237 are accepted**; D2 retains its measured,
independently reproduced development report and rejection decision.
The owner subsequently authorized an available alternative to 32M; the first
real seed is the pinned 2018 GroupLens Latest Small / Kaggle v2 development dataset.
This bounded development comparison can precede a larger stable benchmark with
its own manifest. STATUS names the branch and actual acceptance. #229 retains
its native/fresh-account gates; external research does not close them. #182's
bounded enrichment/expansion is verified on catalog-import v10: 425
discoverable MOVIE Items with complete TMDB core metadata and all eight declared
coverage checks passing. English (259) and Finnish (60) remain the main offering;
other languages complement them. The pass is finished within its explicit cap,
including a Korean repeat, deferred Spanish and a failed science-fiction attempt
with unknown upstream progress. Failure diagnostics are accepted through PR #252
and deployed on catalog-import v12. BOOK guarded preservation/preview source is
implemented and its catalog-only rollout and ten-Item pilot are complete. The
initial cached audit retained zero approvals; the September 23 pinned-source
review now approves two English descriptions for the internal pilot, with six
rights holds and two text exclusions remaining. The owner completed the guarded
apply on September 24: two updates and the verified empty second batch. Structured
attribution is accepted through PR #257 with all five required CI #508 gates,
and its exact catalog-only forward is installed and verified. The September 23
owner reports successful companion and full-application exercises; STATUS records
their scope and separately queued Discovery/UI observations. A focused observation
of the two real paragraphs/links remains. The exact-ID Work/Edition dump intake
and reviewed acquisition are accepted. After the metadata diagnostic proved the
original 15 GB size-budget failure, the separate exact-pinned acquisition ran
once and failed at a selected Work identity guard. All three requests are
consumed; preserve their budgets and evidence. The next primary step is offline
bounded selected-row failure evidence, with no new acquisition or retry. No
complete dump scan or additional approved text exists. The six-description
usefulness target remains unmet.
STATUS and #182 own exact source/hosted acceptance. Optional further research
and a winning external model are not prerequisites for this release work.

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

Finish the active source packet through its native concurrency/populated-upgrade gates before reader activation or hosted acceptance. Every new page has its own immutable delivery trace; an old run cannot be rewritten to explain a new page.

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

#182's provider-path recovery and bounded expansion are accepted through
PR #251 / catalog-import v10. The 2026-09-13 final hosted checkpoint has 425
discoverable MOVIE Items, all with complete TMDB core metadata/posters, and all
30 original curated identities enriched. All declared language/era/genre and
documentary coverage checks pass; English/Finnish are the principal offering.
The 18-attempt pass is complete with its conservative 30-page accounting.
PR #252's additive failure/progress diagnostics are accepted and deployed on v12.
The next BOOK unit follows the
[description contract](../architecture/ARCHITECTURE.md#book-description-enrichment--guarded-contract-182):
guarded refresh is accepted through PR #254 and its catalog-only rollout is
verified. The fixed ten-Item preview exhausted its twenty provider attempts;
eight English Work descriptions pass the text rules. The September 23 exact
Wikipedia-source review and offline amendment approve two for the internal pilot
with structured credit, preserving six rights holds and two text exclusions. The
[structured attribution path](../architecture/ARCHITECTURE.md#description-attribution--contract-182)
is accepted through PR #257 / CI #508 and the new catalog-only forward is
installed with exact function/ACL, history and full-catalog preservation checks.
The owner completed both importer batches on September 24, with two updates,
full preservation checks and a verified empty second batch. STATUS records the
completed archive and the remaining focused real-text phone observation.
The metadata-only diagnostic proved the old 15 GB cap was below the two files’
observed 16,644,821,648 bytes. PR #275's separately accepted exact-pinned
acquisition then ran once and failed at a selected Work identity guard, before
EOF or full-source verification. Its recovered artifact contains no raw records;
the selected identity and failing predicate remain unknown. All three requests
are consumed, and fresh read-only reconciliation confirms 383 unchanged targets.
Next, implement and test bounded selected-row failure evidence offline, preserving
the fail-closed guard and fixed public code while retaining diagnostic evidence
only in encrypted output. No acquisition, retry or new provider budget is selected.
A future source run still requires its own explicit selection; complete-source
verification, private recovery, fresh reconciliation and source-specific rights
review precede a guarded writer bridge. Curated
books need exact alias review before enrichment. Do not repeat the completed
source matches, redeploy either installed description forward or the six native
forwards, reset the pilot or expand the exhausted API pass. STATUS/Issue #182 own
source/rollout and execution.
Do not repeat accepted canary/setup or extend the completed MOVIE budget.
Repeatable refresh, BOOK descriptions, provider rights/attribution, normalized
feature quality and native acceptance still keep Phase 14.3 open.

The independently selected #269 offline concept audit now maps exact provider
fields with versioned lineage and neutral unknowns. On the actual 840-Item
snapshot, six supported concepts cover 244 BOOKs and 280 MOVIEs; 171 BOOKs have
mapped provider concepts absent from current matching tag slugs. The aggregate
report in STATUS records the limited taxonomy and distinct topic/genre evidence.
Serving tags and scorers remain unchanged. A coordinated versioned rollout and
parity/evaluation are still required before these projections become prediction
inputs; this audit alone closes no algorithm or catalog release requirement.

Public research features are a separate path from provider presentation metadata. Do not contaminate production catalog or user evidence while building the research workspace.

### 14.3A — Portable contracts and external-data research

Requirements: `MVP-ENG-001..003`. Canonical design: ADR-0008 and [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md). This is a bounded foundation, not an indefinite model-search project.

**E1 — contracts and fixtures, first engine-specific packet ([#235](https://github.com/Kajooja/Kajo/issues/235)).** E1 source now supplies `packages/prediction-engine` as an executable generic contract boundary for Subject/acting identity, State, Object, Action, Observation, Outcome, Scenario and version/provenance information. Map Kajo Profile/Item without renaming app identities. Exercise deterministic media and small synthetic non-media adapters through a standalone command. The package joins `packages/*` workspaces and root `npm run check` through its lint/typecheck/tests, build and real ESM export check. STATUS records actual source/CI acceptance. Test missingness, observed/external/synthetic separation, horizons, as-of inputs and hard constraints. Keep runtime SQL unchanged; source extraction requires parity, not a duplicate drifting scorer.

**D1 — isolated MovieLens manifest and adapter ([#236](https://github.com/Kajooja/Kajo/issues/236)).** After E1's record boundary, implement streaming/idempotent normalization and deterministic small-cohort processing. Validate checksums, CSV/ratings/IDs, namespaces, mappings, duplicates, chronological ordering, quarantine and resource bounds. Then record the actual permitted download and normalized real cohort. No production credentials or native User/Profile/Event writes. Use ignored `research-data/` and `research-artifacts/` locations or explicitly equivalent isolated storage; exclude raw/derived data from ordinary CI artifacts before download.

**D2 — reproducible baseline evaluation ([#237](https://github.com/Kajooja/Kajo/issues/237)).** Compare train-only transparent means/neighbors and an explicit-rating factorization challenger through the same research contract. Include one bounded declared static-state versus ordered-prefix/trajectory-retrieval experiment; a negative or insufficient-evidence result is valid. Freeze global chronological splits, held-out-subject cold-start prefixes, transforms/artifact cutoffs, baselines, metrics and final test before selection. Report coverage, uncertainty, task limitations, cost and prior/enrichment ablations where available. Scale to the full dataset only after the small run is correct and resource-bounded.

D2’s [actual development report](../../research/reports/movielens-small-d2.md) records
46,410 training rows, fixed temporal/held-out-subject tests, two matching executions
and rejection of the validation-selected challenger under the frozen rule. This
completes the bounded experiment; current-head source acceptance is in STATUS.

The explicitly selected independent **#265** follow-up now corrects unsupported
latent fallback and reports one reproduced exploratory earliest/recent prefix
study on the same authorized D1 cohort. Original training boundaries/parameters
and historical D2 rejection are preserved. On 5,707 ratings from 23 held-out
subjects, the fixed recent-prefix durable-state comparison improves RMSE from
0.850843 to 0.807788, with paired subject interval wholly below zero. This is reused
development data and compares policies with potentially different actual prefix
counts; no new final, native, BOOK or model-admission claim follows. The bounded
packet is complete; it does not make further model search an MVP prerequisite.

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

Requirements: `MVP-DISC-008..009`, `MVP-NAV-005`, `MVP-UX-001`, `MVP-UX-003..006`, Lists/messages/Room/device acceptance.

Exit: contextual Lists, search/filters and authorized Profile surfaces; accessibility/reduced motion/error/offline states; deferred device gates; graphics may evolve without changing domain contracts. Preserve planned #231 multi-select/trash work in its product scope rather than mixing it into engine extraction.

Owner decision 2026-09-12 promotes #230 private category statistics/weekly tracking
and #231 multi-select/List moves/history trash to required pre-MVP work, with
#239 star/overflow/explicit-Next card controls and #240 reconnect recovery. These
map to MVP-UX-003..006. FUT-UX-003 joint-list choice remains a separate candidate.
UX_PRINCIPLES and FUTURE_PLAN own the detailed contracts. The promoted requirements
are release gates. Weekly tracking requires the relevant 17.1/17.2 telemetry and
privacy work before beta; community comparisons remain conditional.

The owner explicitly queues the September 23 browse/detail refinements here:
#200 canonical Katsotut/Luetut entry; #199/#200 one-row ItemType dropdown and
collection navigation; #199 removal of unused grid space and continued loading;
#231 list/poster-grid controls also for history; #239 fit-aware descriptions and
arrow-only Back to the real origin. UX_PRINCIPLES owns the full contract. Address
canonical navigation correctness before visual refinements; continuous loading
depends on #228/#229's accepted server cursor/delivery path. These are deferred
refinements of existing browse work, not a request to interrupt the current bounded
BOOK enrichment or an automatic expansion of MVP gates. Later cast/director
presentation stays under FUT-CAT-001, outside this immediate UI packet.

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
