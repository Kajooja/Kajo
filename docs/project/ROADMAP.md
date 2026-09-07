# Kajo Roadmap

Roadmap order is outcome-based, not tied to fixed two-week timeboxes. A sprint ends when its defined scope and handoff are complete.

## Milestone: MVP 0.1

MVP 0.1 now means the first **complete, store-downloadable BOOK/MOVIE Kajo**, not a mock-data prototype. Monetization is not required. Before completion the product must use real catalog data, establish useful first-session taste, pass a small external beta and then satisfy production auth/security/signing/store-release gates.

### Sprint 001 — Foundation

Repository memory, mobile skeleton, workspace, CI, domain contracts.

### Sprint 002 — Room

First recognisable minimalist illustrated Room with window, fireplace, bookshelf and movie screen using mock data.

Canonical visual direction now remains a warm simple cabin/living-room illustration: 2D first with only lightly layered 2.5D depth, never a navigable 3D world or futuristic control surface. Fireplace, window, bookshelf, TV/screen and the single DiscoveryMode curtain remain the MVP vocabulary.

### Sprint 003 — Curtain & Theme

Theme engine, user theme tokens, draggable curtain, three snap states, DAWN/EVENING/NIGHT transitions.

### Sprint 004 — Discovery UI

Books + Movies grids, Item cards/details, mock ranking, DiscoveryMode switching.

### Sprint 005 — Swipe & History

Optional swipe, watched/read, saved/current state, feedback drawer, consumed-history suppression, exact recent undo and one shared DiscoveryMode control.

### Sprint 006 — Backend Foundation

Supabase/PostgreSQL, authentication, unique nickname identity, Profile/ProfileMember, Item persistence, migrations and authorization foundations.

### Sprint 007 — Event Engine

Generic append-only event capture, sessions, actor/Profile separation, prediction traceability and analytics-quality behavioural contracts.

### Sprint 008 — Prediction V0

First real generic personalized ranking using Item similarity, behavioural history, LongTermState, ShortTermState, DiscoveryMode exploration policy, explicit feedback and impression cooldown. Mobile consumes server-owned rankings rather than owning recommendation logic.

### Sprint 009 — Shared Kajo — COMPLETE

Persistent SharedProfiles, consent-based invitations, Shared Room/theme identity, generic Shared interaction/Event/Prediction context and seamless Personal/Shared switching.

The first configured Android acceptance exposed real membership/persistence/navigation failures. Those were corrected and then accepted through configured-device use plus hosted verification. Issue #125 is closed.

The initial separate `Ehdota yhteiseen` experiment is historical and retired. Its replacement is the Sprint 011 Endorsement model, not a parallel suggestion list.

### Sprint 010 — Navigation & Profile Lifecycle — COMPLETE

Durable shell before adding more destination surfaces.

Accepted on configured Android 2026-09-01:

- persistent top Kajo mark returns to the active Profile Room,
- restrained bottom dock with menu + active Profile identity/Home + Inbox,
- Profile-aware side drawer instead of a conventional multi-tab bottom bar,
- drawer owns Profile switching plus Profile/Lists/Groups destinations as they become real,
- nickname max 24 and SharedProfile name max 32,
- safe `Poistu ryhmästä` confirmation and PersonalProfile fallback,
- bottom-center active Profile identity also returns Home,
- `Kirjaudu ulos` lives at drawer bottom,
- Room has no standalone heading/helper copy,
- obsolete separate `Ehdota yhteiseen` UI is removed.

Further visual Room work must preserve this accepted shell and the simple illustrated Room contract; it must not reopen Sprint 010.

### Sprint 011 — Shared Curation & Named Lists — DELIVERED, DEVICE ACCEPTANCE DEFERRED

Sprint 011 deliberately has **two ordered slices**.

#### 11A — Shared discovery + Endorsement consensus — #151

Accepted and closed on configured Android 2026-09-02.

Make Shared discovery behave like a joint decision surface without creating a separate social recommender.

- pending Endorsements remain first, ordinary unseen recommendations retain Prediction order next, and Items already consumed/rated in an accepted member's PersonalProfile form an attributed lower-priority tier,
- higher accepted-member ratings may reorder only that history tier; this does not define common-fit or EvoBot weights,
- SharedProfile-consumed/rated and consensus-saved Items remain suppressed from ordinary discovery; existing Lists/history keep the Item and may show consumed/rating state,
- Shared Prediction remains targeted to the SharedProfile,
- Prediction V0 may combine Shared joint evidence with accepted members' PersonalProfile evidence using an inspectable common-fit aggregate plus disagreement penalty,
- one member's Shared quick positive action becomes an actor-specific `Endorsement`, not Shared `saved=true`,
- the pending Item leaves the endorser's own ordinary queue,
- members who have not endorsed it receive it ahead of normal recommendations with restrained real-actor provenance,
- unanimity among currently accepted members promotes the Item once to Shared saved state,
- later new membership does not retroactively revoke an already-reached consensus.

No majority voting or chat is introduced here. The later #102 List slice attaches a target custom List to the same unanimous Endorsement flow rather than creating a second voting model.

#### 11B — Named Lists & collaborative browsing — #102

#151 is stable. The compact picker and final Shared target-List approval are merged and hosted; refreshed configured Android acceptance remains explicitly deferred:

- PersonalProfile and SharedProfile own generic system/custom Lists,
- List names are 1–40 characters,
- one List may contain BOOK, MOVIE and future ItemTypes together,
- every Profile has one system `Tallennetut` List,
- `Lisää listaan` opens a compact one-destination picker and can create/name/rename Lists,
- Shared discovery stores the first actor's custom-List choice as pending Endorsement state,
- other non-endorsing members see proposer/List provenance and approve the same choice,
- unanimity commits the chosen custom membership and auto-promotes to system `Tallennetut`,
- one Item may belong to multiple Lists,
- List detail supports list/card presentation, added-order sorting, generic ItemType filters and current consumed/rating display,
- Shared list entries show real added-by + added-at provenance; Personal hides redundant actor identity,
- existing saved/consumed/rating state remains canonical and is not duplicated into List rows.

### Sprint 012 — Profile Messaging — DELIVERED, DEVICE ACCEPTANCE DEFERRED

Add narrow messaging only after Lists are stable so messages can reference established Profile/List/Item identities.

- PersonalProfile owner-only note/thread stream,
- SharedProfile accepted-member group chat retaining actual sending User,
- Inbox combines invitations and message activity,
- optional message when adding/saving an Item references Profile/List/Item,
- messaging persistence stays separate from behavioural Prediction evidence by default,
- no unrelated-user DM graph, public feed or follower model.

Primary issue: #138.

### Sprint 013 — Prediction Nervous System & ScenarioMemory — COMPLETE

Accepted 2026-09-04. Issue #156 defines the full memory/prediction/controlled-evolution architecture and the accepted MVP slice now includes:

- WorkingState, ShortTermState, LongTermState and same-Profile ScenarioMemory,
- versioned complete PredictionRun/candidate trace including alternatives, Context and delivery/exposure separation,
- configured-Android Personal/Shared Prediction V1 acceptance,
- immutable PredictorGenomes and global baseline Champion audit,
- three bounded scalar SHADOW Challengers,
- prospective frozen ShadowPredictions and leakage-safe mature exposed-outcome evaluation,
- GLOBAL/PROFILE GenomeEvaluation with Profile shrinkage,
- one canonical V1 serving path with exact baseline equivalence,
- service-only evidence-gated manual Profile canary and reversible rollback,
- automatic/global Challenger promotion disabled through MVP 0.1.

Transparent scalar-genome evaluation landed before learned sequence/LLM Challengers, and pgvector remains blocked until real embeddings plus a measured need exist. Full autonomous evolution remains post-MVP.

### Accepted post-Sprint-013 follow-ups

- **#174 — reacted-Item resurfacing** is accepted: terminal reactions are suppressed and saved-only reminders are bounded/versioned.
- **#175 / MVP-NAV-004 — bottom SharedProfile quick switcher** is accepted on configured Android.

The current shell/bootstrap visual polish is on `main` and still needs configured-device visual acceptance, but it does not block backend catalog work.

### Remaining execution order — product decision 2026-09-07

Algorithm quality is the critical path. Preserve completed sprint history; the sequence below supersedes earlier future-phase suggestions in domain documents. Each row is a bounded work package, normally split into one Issue/PR per independently reviewable behavior. Do not implement all rows in one branch.

| Order | Work package and requirement IDs | Depends on / acceptance before proceeding |
|---|---|---|
| 14.0 | **Bootstrap serving + SQL regression foundation** — #207, ALG-001, ALG-009; existing #185/#191 context | First coding task. Reproduce the bootstrap-only failure; fix through shared feature semantics and a forward migration. Opposite-preference fresh Profiles rank the same unseen pool differently, import removal restores control, no Personal/Shared leakage. Start SQL CI here and extend it in later PRs. |
| 14.1 | **Trustworthy action and delivery evidence** — DATA-001..004, PRED-006 | After 14.0; persistent outbox + atomic action/Event boundary, exact Profile/prediction/slate cache and truthful Shared/search/List origins. Kill/retry/undo/switch/concurrency tests and device traces pass. |
| 14.2 | **Serving/shadow equivalence + candidate availability** — ALG-002..003 | Reliable evidence. One score/policy implementation for Personal/Shared, frozen versioned features, baseline parity; suppressed top candidates trigger bounded refill; stable pagination and realistic catalog exhaustion. No worker promotion before parity. |
| 14.3 | **Real catalog and common features** — CAT-001..003, ALG-005; #182 | Import/poster enrichment can proceed alongside 14.0–14.2 without blocking those fixes. Execute existing TMDB batches, enrich BOOK descriptions, establish repeatable provider refresh and normalized shared feature mapping with provenance. Hundreds/domain, licensed imagery/attribution and quality report required. |
| 14.4 | **Adaptive state and discovery policy** — ALG-004..007, BOOT-001..004, PRED-005 | 14.0–14.3. Ordered session state, evidence-aware forgetting/confidence, bounded cross-domain transfer, informative calibration and context-dependent weighting. Compare fixed control, ablations, contradictory-history and Shared disagreement cases; reject changes without useful evidence. |
| 14.5 | **Operating SleepLayer + evaluation** — ALG-008, BETA-002 | 14.1–14.4. Schedule bounded workers; drain/retry deterministically, reconcile delayed outcomes, freeze chronological evaluation. Manual canary/rollback rehearsal; automatic/global promotion stays disabled. Sparse outcomes mean insufficient evidence, not permission to lower the gate. |
| 14.6 | **Complete browse/core UX** — DISC-008..009, NAV-005, UX-001; #200/#201/#203, #102/#138/#199/#78 | Reuse stable catalog/evidence contracts. Complete contextual Lists, search/filters and authorized Profile-name search; accept Lists/messages/Room/import/Shared/device flows and accessibility. Owner APK testing can proceed throughout. |
| 14.7 | **Beta operations prerequisite** — OPS-001..004 minimum safe beta slice, AUTH/REL lifecycle; #160/#127/#184 | Before inviting external testers: isolated environment, reliable email, privacy/support/deletion/retention, backups, diagnostics and abuse controls operate. Inventory final hosting choices early; do not defer data architecture until release. |
| 14.8 | **External beta** — BETA-001..002; #186 | 14.0–14.7 accepted. Roughly 10 people use clean-install Personal/Shared BOOK/MOVIE without developer setup; collect useful delayed outcomes and fix defects. Sample size does not establish small statistical lifts. Owner accepts beta; close Sprint 014 only now. |
| 15.1 | **Production configuration and recovery** — AUTH-004, OPS-001..005, REL-001..002; #160/#184/#127 | Finalize production project/domain/SMTP/social linking, privileges, secrets, data lifecycle jobs, alerts/budget and verified restore. Recheck staged release against actual production configuration; no placeholder inventory values remain. |
| 15.2 | **Store release candidate** — REL-001..003, UX-001 | Signed immutable builds, store privacy/permissions/attribution/assets, account linking/deletion, clean install/update/device and load/rollback gates. Recheck current store/provider requirements at submission. |
| 15.3 | **Installed store acceptance and handoff** — all MVP IDs | All required code on main, CI/backend/device/ops evidence recorded, store-distributed build accepted by owner. Close Sprint 015 and milestone; document maintenance/recovery ownership. |

### Sprint 014 — algorithm reliability, real catalog and external beta — ACTIVE

Canonical execution record remains `sprints/SPRINT-014.md`. The 14.x identifiers above are work-package order, not claims that old 14A–14D implementation was absent. Newly discovered correctness work is required before closing those existing acceptance gates.

The exact next task and active PR live only in `STATUS.md`. Reuse existing issues when their scope matches; reopen an implementation issue only for an actual unresolved acceptance defect. Create a scoped follow-up when the old issue was correctly closed. Never close #182/#199 from partial PRs.

### Sprint 015 — production operations and store acceptance — PLANNED

Create its execution file when activated; do not create speculative sprint folders. Infrastructure/retention decisions and safe-beta provisioning start in 14.7 or earlier; Sprint 015 verifies and finalizes them for the store. `ARCHITECTURE.md` owns the service/data checklist and `MVP.md` owns completion requirements.

### Suggestions reconciled into scope

| Existing source / suggestion | Disposition |
|---|---|
| #200 contextual discovery Lists | Required: MVP-DISC-008, 14.6 |
| #201 catalog search/filters | Required: MVP-DISC-009, 14.6; normalized data before filters |
| #203 Profile-name search | Required bounded authorized-name filtering: MVP-NAV-005, 14.6 |
| Prediction model Phase B: WorkingState, multi-timescale memory, delayed outcomes | Required: ALG-004/006 and DATA-003/004, 14.1/14.4 |
| Candidate union previously grouped with learned retrieval | Required now: ALG-003, 14.2; does not require embeddings |
| SleepLayer persistence and proposed evaluation/retention | Operational evaluator required: ALG-008 and OPS-002/004, 14.5/14.7 |
| Optional explicit mood/time/context controls | Use bounded contextual policy/session inputs in 14.4; add a UI control only when useful and tested. No sensitive inference or mandatory demographics. |
| MEM-004 richer memory extension point | Document generic extension compatibility in domain model; no photo journal/storage feature required |
| Learned embeddings, sequence/LLM challengers, learned gating, stochastic bandit | Keep as replaceable evaluation extensions; bounded transparent adaptation is required now. Introduce only if measured need justifies complexity and evidence gates pass. |
| PopulationMemory, extra domains, monetization, public social features | Remain explicitly outside MVP; preserve privacy/licensing gates |

## Post-MVP execution queue

Owner direction **2026-09-07**, planning #213: the complete product extends beyond MVP 0.1. This queue is appended after **14.0–15.3**; it does not reset the active sprint or move unproven research onto the current critical path. Detailed scope, source options and measurable acceptance/stop criteria live once in [FUTURE_PLAN.md](../product/FUTURE_PLAN.md). Every ID below is planned, conditional or research, never a completion claim.

| Order | Package / durable IDs | Dependencies and exit gate |
|---|---|---|
| 16 | **Two-store completion and measured scale baseline** — FUT-REL-001, FUT-OPS-001 | Accepted MVP 15.3. Complete public Android **and** iOS distribution if either is still missing; verify install/update/core flows. Establish workload, latency/resource/cost/retention measurements. If both stores already passed, reuse evidence rather than building again. |
| 17 | **Catalog breadth, identity and search** — FUT-CAT-001 | 16 and existing CAT/DISC gates. Expand persisted BOOK/MOVIE breadth and Finnish enrichment, safe work/edition/alias matching, licensed images, normalized tags, provider refresh and bounded search. Coverage and outage behavior demonstrated. |
| 18 | **Series** — FUT-DOM-001 | 17. Compatible generic Item extension, series-level consumption semantics, search/Lists/Personal/Shared and real-device acceptance. No separate recommender. |
| 19 | **Friends and stronger group learning** — FUT-SOC-001 | 16 plus accepted Shared/evidence/privacy foundations. Consent-based nickname discovery and friend lifecycle, abuse controls, useful group-dynamics evaluation. Existing authorized Profile-name filtering is not global friend search. |
| 20 | **Helsinki pilot** — FUT-LOC-001, then FUT-LOC-002 | 17–19. Linked Events first, selected source-gap filling, recurrence/duplicates/cancellation freshness, then location-optional Personal/Shared event discovery. Accept one city before expanding. |
| 21 | **Music albums** — FUT-DOM-002 | Domain extension from 18; complete 20 as the default sequence. Provider/cover-rights gate, release identity and generic mixed-domain discovery/search/Lists; no implied streaming feature. |
| 22 | **Optional friend-review feed** — FUT-SOC-002 | 19, mature evidence and operated publishing/privacy/moderation. Accept useful audience-controlled review discovery; do not auto-publish private ratings. |
| 23 | **Conditional local/global feed** — FUT-SOC-003 | 22, opt-in public inventory, moderation capacity and applicable PopulationMemory gates. Pilot usefulness, privacy, abuse and sustainable cost; defer if not supported. |
| Continuous after 16 | **Evidence-gated evolution and compact memory** — FUT-ALG-001, FUT-OPS-001 | Finish current ALG/DATA/OPS gates first. Re-evaluate quality, latency, spend and retention at each domain/scale increment. Automatic promotion needs an explicit later decision plus sustained controlled evidence; new features do not waive the gate. |
| Research after operational baseline | **Planet network / local learning** — RES-NET-001, RES-EDGE-001 | Measured 16 baseline; edge learning also needs FUT-ALG-001 evidence. Separate public/synthetic experiments with normal infrastructure controls, security/failure/cost tests and go/no-go ADR. Never block ordinary delivery. |
| Distant research after 23 | **Real-world friendship / dating** — RES-PEOPLE-001 | Consenting users, separate purpose/age/safety/product design and operated moderation. Start with useful introductions; compatibility claims require real evidence and may be rejected. No automatic implementation when earlier rows finish. |

At each package close, record achieved requirements, exact evidence and deferred IDs; create the next bounded Issue/sprint from the first ready row. Do not create empty future sprint folders or one speculative code module per idea. Review the research backlog explicitly without treating `RESEARCH` as approved implementation. Existing richer memories, advanced Lists, other domains, learned-model families and monetization remain preserved in FUTURE_PLAN's other-directions section and keep their prior privacy/licensing/product gates.

Roadmap changes must be deliberate. Do not rewrite completed sprint history when sequencing changes.
