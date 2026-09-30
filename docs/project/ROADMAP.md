# Kajo Roadmap

Roadmap order is outcome-based, not tied to fixed two-week timeboxes. A sprint ends when its defined scope and handoff are complete.

This file owns execution order. `STATUS.md` owns the exact next task. `MVP.md` owns release requirements. `LAUNCH_LOOP.md` owns the Taste-first acquisition flow. Historical sprint files preserve implementation detail and must not be replaced by this summary.

## Unfinished work disposition — 2026-09-29

The owner explicitly permits scheduling unfinished work at its correct dependency
slot and retiring work superseded by accepted solutions. This table is the single
current disposition of the 18 issues inventoried by the
[September 28 audit](retros/2026-09-28.md). STATUS owns the one active handoff and
exact source/CI/hosted/device acceptance. Sprint 014 remains active; later rows
are queued work for the existing phases, not parallel active sprints or waived
release requirements. Historical sprint plans do not override this order.

| Work | Disposition and execution slot | Dependency and remaining acceptance |
| --- | --- | --- |
| #228 / draft #229 delivery | Critical current Sprint 014, 14.1–14.2. Reconciled source; native acceptance open. | Preserve immutable origins, trace, captured reader and deployed forwards. Integrate accepted dependency fixes and verify the resulting exact head; complete configured-device/fresh-account observations. No repeated DDL or account reset. |
| #240 reconnect | Source implemented in #229 under 14.2; MVP-UX-003 remains open for acceptance. | Exact failed request/cursor/context, focused foreground scope, bounded/coalesced retry and backend success before error removal. Keep expiry and real-device regression; do not create a duplicate future implementation. |
| #177 common fit | 14.1–14.2 acceptance only; scorer and hosted rollout already accepted. | Observe authorized Shared sparse/disagreement/trace behavior on the configured Android build. No replacement scorer or repeated deployment. |
| #182 catalog | Critical catalog work, 14.3. Diagnostic/cleanup source accepted through #294. | Separate bounded operator/budget before new acquisition; then rights, fresh reconciliation and guarded writes. Eight old requests stay consumed. Six useful descriptions and actual text/link device observations remain. Completed MOVIE expansion is not repeated. |
| #238 dependencies | Recorded source advisories resolved through #296; ongoing MVP-OPS-005 maintenance. | Accepted compatible decoder/UUID/Vitest fixes, audit receipt and required CI. Actual web/native link round-trips remain under 15.1 / MVP-ACQ-007; Node parser tests do not close them. |
| #160 security | Immediate accepted-source deployment/platform follow-up; complete abuse/privacy gate in 17.2, production recheck in 19.0. | #295 fixes source configuration/input validation. Hosted verification, password protection, supported security upgrade and distributed abuse/anti-enumeration remain. Public-entry controls must pass before external users, even when built ahead of their numbered operations phase. |
| #184 identity conversion | Scheduled 15.1 after 14 and adaptive Taste 15.0. | Same logical User/PersonalProfile, ownership-proved collisions, interruption/retry and real Google/Apple browser/app configuration. No email-only merge or duplicate taste state. |
| #232 Shared rounds | Evidence/eligibility contracts 14.1–14.2; coordinated user flow 16.3. | Personal Taste/setup and explicit Shared creation first. Participant/round provenance, individual answers, atomic completion/correction, membership races and bounded rewatch. Known evidence defects cannot be deferred merely because UI is later. |
| #200 history navigation | Scheduled 17.0, before visual browse refinements. | Discovery Katsotut/Luetut must use canonical active-Profile/ItemType history and contextual Lists, with cold entry, permission/error handling and real-origin return. Reuse #229 and accepted cold-history work. |
| #199 grid | Broad refinements scheduled 17.0 after accepted #229 pagination; September 30 terminal-refresh defect is a focused current-reader follow-up. | The end notice needs downward-pull and accessible refresh without returning to the top, through the existing scoped reader; source/CI and new APK gesture acceptance remain separate. Later density, coalesced loading, stable order/deduplication, safe final rows and small-screen/large-text checks retain their slot. Old poster/token/import defect is superseded by accepted catalog work, not grounds for another MOVIE acquisition. |
| #239 cards | Scheduled 17.0, required MVP-UX-006. | Reuse Saved/Shared Endorsement, multi-destination commands and exact origins. Star/overflow/explicit Next, fit-aware description/credit and accessible Back; saving stays on card and Next adds no taste evidence. |
| #231 selection | Scheduled 17.0, required MVP-UX-005, after DATA-003/004 and List/history correctness. | Canonical selected IDs/origins, durable partial results, atomic moves, Shared consent, retry/restart and membership changes. History list/poster views use the same collection; trash does not erase unrelated state. |
| #230 statistics | Scheduled 17.0 private summaries; weekly work depends on 17.1/17.2 telemetry/privacy. | Source-aware distinct counts including rating zero, independent unlock, retry-safe weekly snapshots and Helsinki/DST boundaries, correction/deletion/isolation. Community comparisons remain conditional on cohort/privacy evidence. |
| #201 catalog search | Scheduled 17.0, MVP-DISC-009. | Canonical persisted Items, title/creator and normalized filters, bounded server pagination and honest provenance. Browse is not a second recommender; filters are not preference events. |
| #203 Profile filtering | Scheduled 17.0, MVP-NAV-005. | Filter already-authorized Personal/accepted Shared names; preserve account scope and revocation. No public directory or membership bypass. |
| #78 startup | Scheduled 17.0, MVP-UX-001. | Canonical logo sizing and target Android margins/auth/startup observation; hydration-driven loading without a fabricated delay. |
| #127 SMTP | Scheduled 17.2 before external beta; final production recheck 19.0. | Owner's verified sender/domain and supported SMTP configuration, then authorized confirmation/recovery delivery to external providers. Disabling confirmation is not acceptance. |
| #186 beta | Scheduled Phase 18 after the complete launch loop and operations gates. | Controlled 10–50-person actual link → Taste → challenge → preview → Google/Apple → Friend → Shared flow, diagnostics and owner Android/iOS acceptance. Fixtures cannot replace participants or distribution. |

Requirements without one of these issue numbers remain in their phase: adaptive
memory/cross-domain/mode behavior in 14.4; bounded SleepLayer/evaluation in 14.5;
Taste/holdout/usefulness and continuation in 15; Friend safety and explicit Shared
creation in 16; Lists/messages/accessibility, telemetry, retention/restore and
operations in 17; complete beta in 18; production/stores in 19; Share Link Gate
in 20. The bounded E1/D1/D2 foundation is complete; optional further research and
model admission are not new release blockers.

Retire a superseded source branch only after checking accepted commit/tree
coverage, unique changes and live PR/document/workflow references. Consumed
catalog request identities, original recovery sources and immutable deployed
migration history are retained dependencies. The old Sprint 015 store-close plan
is superseded; it is not revived by scheduling future work here.

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
once and failed at a selected Work identity guard. The separately accepted
100 MiB Work-prefix diagnosis then recovered a current selected row whose
`location` exactly equals its canonical Work key. Its object, key and type are
valid; the old guard rejects every present location field. Those four predecessor
requests remain consumed. The exact-self-location correction and versioned
historical failure replay are accepted through PR #279. PR #281's separate bounded full-acquisition
continuation passed all five required CI gates and activated once. Its public
run ended in failure; private recovery and authentication verification are
complete. All five requests are now consumed. PR #283 accepted the explicit
local conflict policy. The separate successor core now supplies shared bounded
streaming, strict request/result encryption contracts and pure payload replay,
with complete-source verification and whole-pair exclusion. [STATUS](STATUS.md)
and #182 record source/CI acceptance. The guarded operator path now supplies
one-shot activation controls and receipt-based source/run/custody recovery.
PR #285 accepted that path; a separately bounded request then activated once.
Its failed result was recovered and preserved. PR #288 accepted the separate
guarded Edition-prefix operator; actual preparation, explicit caps and separate
custody readback preceded its one successful diagnosis. Private recovery verified
an oversized Edition row whose complete outer header is outside the original
roster. All seven requests are consumed. The explicit local framing core now
discards only oversized rows with a complete canonical unrelated header, retaining
selected/unknown failures, original limits, checksum accounting and historical
replay. The separately versioned full-collection core now integrates the scanner,
frozen predecessor request and new encrypted accounting/replay. Its guarded
operator now supplies original-source predecessor checks, one-shot controls and
source/dependency/CI/custody gates. Original-source preparation and exact durable
readback now precede one activated framed full-collection run, attempt one. All
eight requests are consumed. Its failed Edition result is privately recovered,
freshly reconciled and preserved. A separate diagnostic core now preserves bounded
terminal evidence and replays the original predicate/policy on synthetic fixtures.
Recovery checks process termination/PID namespaces and all key copies in a fresh
process; independent post-command absence remains mandatory. The owner's closure
audit also selects existing source defects for correction. STATUS owns exact
source acceptance, continuation and later operational gates.
Source acceptance grants no provider allowance. The discarded historical
terminal row's identity and selection status remain unknown; the new prefix does
not validate the oversized JSON or full source.
Foreign locations are never remapped.
No additional text is approved and no database write was performed. The prefix
diagnosis still cannot prove the earlier discarded row was identical.
The six-description usefulness target remains unmet.
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
its historical selected identity and predicate cannot be recovered. The later
one-shot Work-prefix diagnosis is accepted and consumed: it retained an exact
self-location row and reproduced the old presence-only rejection privately.
The prior read-only reconciliation confirmed 383 unchanged targets; the diagnosis
made no database requests or writes. Its bounded partial stream is not a complete
source scan, and matching row position does not establish historical byte identity.

PR #279 accepted the narrow exact-self-location correction and versioned v1/v2
failure replay. PR #281 accepted the
[full-acquisition continuation contract](../architecture/ARCHITECTURE.md#full-acquisition-after-the-self-location-correction--182).
Its one-shot public run ended in failure; private recovery and authentication
verification are complete. The fifth request is consumed. PR #283 accepted the
[offline conflict policy](../architecture/ARCHITECTURE.md#offline-selected-record-conflict-policy--182).
The [successor core](../architecture/ARCHITECTURE.md#conflict-aware-acquisition-core-and-successor-boundary--182)
now implements bounded streaming, separate request/result contracts, encrypted
recovery and pure consistency/snapshot replay. It supplies no executable request or
provider execution. The guarded operator path now supplies the distinct workflow,
original-source predecessor preparation, private custody checks and source-bound
recovery. PR #285 accepted that path, and actual preparation/custody verification
preceded one distinct request. Its failed result is privately recovered and
preserved. The local Edition diagnostic and its guarded operator were accepted
through PR #288. Original-source predecessor verification, explicit caps and
separate custody readback preceded one owner-approved Edition-prefix request.
Its successful run was privately recovered as `diagnosed` / `dump-line-limit`;
the retained complete outer header classifies the new oversized row as outside
the original roster. All seven requests are consumed. The
[local framing core](../architecture/ARCHITECTURE.md#bounded-edition-framing-core--182)
now supplies bounded discard through LF only after complete canonical outer-header
proof. Selected/unknown rows, global limits, selected identity guards, checksum
accounting and historical replay remain strict. The
[framed full-collection core](../architecture/ARCHITECTURE.md#framed-full-collection-successor-core--182)
now integrates this explicit entrypoint with the full two-source collector,
separate request/result accounting and encrypted payload replay. Its request
retains all seven fixed predecessor identities and the exact previous roster,
recipient, source pins, full budgets and conflict policy. The
[guarded operator](../architecture/ARCHITECTURE.md#framed-full-collection-operator--182)
now checks all seven Git objects, distinct first-push/first-run controls and
source/dependency/CI/custody receipts. Original-source diagnosis recovery preflights
all three historical closures before key staging, then bounds the nested process
chain and cleans temporary keys. Actual preparation verified all 22 inputs and
the three original inspectors, then saved and read back the new private request
and exact source/Git receipt before one distinct first-attempt activation. The
eighth request is consumed; no retry, reset, reuse or limit expansion is allowed.
Its failed Edition result is privately recovered as dump-conflict-fatal; the
terminal row/predicate/policy reason were not retained. Fresh reconciliation
found no original-target changes and exact private archive readback passed.
A separate bounded terminal-conflict diagnostic core and strengthened key cleanup
now have synthetic source tests. This grants no provider run; STATUS owns the
closure audit's next correction and the later encrypted operational boundary.
Neither core acceptance nor the local policy grants a rerun or provider budget.
Complete-source verification, fresh reconciliation and
source-specific rights review still precede a guarded writer bridge. Curated
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

The runtime routing decoder advisory is resolved through #238 / PR #296 with
compatible parent interop and malformed-link regressions. Preserve that fix during
web/app integration and still exercise real link round-trips before acceptance.
Ongoing dependency maintenance remains under MVP-OPS-005; no forced framework downgrade.

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
#239 star/overflow/explicit-Next card controls. #240 reconnect source is now part
of the Phase 14.2 native reader packet; its device acceptance remains required.
Together these map to MVP-UX-003..006. FUT-UX-003 joint-list choice remains a separate candidate.
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

The #160 source correction supplies fail-closed build/runtime production config,
explicit demo identity, public-key shape validation and bounded password JSON
validation before lookup. STATUS/#160 own exact source/CI/hosted acceptance.
Distributed abuse limits and deliberate enumeration policy remain required before
public entry, alongside hosted password protection, current platform security
updates and release dependency checks. Source fixtures alone do not certify the
complete production service.

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
