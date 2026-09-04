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

### Sprint 014 — Real Catalog, Profile Bootstrap & External Beta — ACTIVE

Canonical sprint file: `sprints/SPRINT-014.md`.

Sprint 014 turns the technically working app into the first product-complete BOOK/MOVIE version that can be given to roughly 10 external testers.

#### 14A — Real provider-backed catalog — #182

- replace normal `KAJO_MOCK` discovery with real BOOK/MOVIE Items,
- preserve one generic `public.items` architecture,
- add generic provider provenance, external-ID deduplication, lifecycle/discoverability and repeatable refresh,
- TMDB is the first MOVIE provider path,
- Open Library bulk data is the first broad BOOK path, with optional Finna metadata enrichment where rights permit,
- real covers/posters and normalized metadata are presented under provider terms,
- historical mock Items stay for referential integrity but become non-discoverable.

#### 14B — Imported history + cold-start PersonalProfile — #185

- Letterboxd export ZIP/CSV and IMDb export CSV for movie history,
- at least one practical book-history CSV path plus generic Kajo fallback,
- imported watched/read/ratings/watchlist/to-read normalize into canonical Kajo evidence with provenance,
- no scraping or assumed public personal-history API,
- no-import users get a short real-catalog calibration instead of mandatory demographic profiling,
- imported/calibration evidence initializes PersonalProfile taste and is progressively superseded by real Kajo behaviour.

#### 14C — SharedProfile common-fit — #177 / MVP-PRED-005

Implement only after the real catalog/bootstrap foundation exists so quality can be judged against meaningful evidence:

- Shared joint evidence + authorized accepted-member PersonalProfile fit,
- minimum-member/consensus and disagreement terms,
- same Prediction V1 trace and SleepLayer,
- target remains SharedProfile and Personal history is not copied into Shared history.

#### 14D — External beta gate — #186

Before leaving Sprint 014:

- clean install and stable account flow for external users,
- useful first-session PersonalProfile via import or calibration,
- real BOOK/MOVIE discovery/detail/swipe/rating/save/List/history,
- Shared create/invite/join/switch/common-fit/Endorsement/List flows,
- messaging where already in MVP scope,
- deferred #102/#138/current Room device acceptances closed as relevant,
- failures diagnosable without developer access to tester phones,
- product owner accepts the build for roughly 10-person testing.

### Sprint 015 — Production Auth, Hardening & Store Release

Sprint 015 starts only after the external-beta product is coherent. It owns the final transition from beta-ready to officially downloadable MVP 0.1.

#### Production authentication — #184 + #127

- reliable production SMTP/domain for email confirmation and recovery,
- Google sign-in through the existing Supabase/Kajo User boundary,
- Sign in with Apple for iOS when third-party social login is offered,
- safe account linking so providers do not create duplicate Kajo Users/PersonalProfiles/nicknames,
- account deletion/data lifecycle across linked identities.

Apple App Review Guideline 4.8 is treated as a release requirement when Google/social login is enabled on iOS; do not ship a Google-only primary social-login choice on iOS.

#### Security / operations / store

- #160 production Supabase security hardening,
- performance/accessibility/end-to-end quality checks,
- privacy/support/account deletion and operational/error-monitoring readiness,
- stable production identifiers, versioning and signing,
- provider attribution/licensing decisions required for the non-commercial store release,
- store metadata/assets/permissions,
- representative clean install and update testing,
- official Google Play and/or Apple App Store release.

Sprint 015 ends with the full `MILESTONE-001-MVP.md` completion gate. All MVP requirements must be accepted, code must be on `main`, hosted state must match migrations, end-to-end Personal/Shared/Prediction flows must pass on real devices, and the product owner must accept the installed store build.

## Post-MVP direction

After sufficient real prediction/outcome data exists:

- scale Sprint 013C's constrained SleepLayer shadow worker and manual promotion audit into sustained evaluation, guarded canary/A/B rollout and eventually controlled automatic genome promotion,
- population scenario learning at scale behind privacy/minimum-cohort gates,
- learned sequence, semantic-ID and LLM-backed Challenger families,
- additional domains such as music, events and travel,
- richer personal/shared memories including images, people, location and context,
- richer Item/List comments and media attachments built on the MVP message reference model,
- public/shared discovery features only after privacy/product rules are intentionally designed,
- advanced List features such as folders, smart rules and public sharing,
- monetization only after the non-commercial first release is stable and licensing/product decisions are explicit.

Roadmap changes must be deliberate. Do not rewrite completed sprint history when sequencing changes.
