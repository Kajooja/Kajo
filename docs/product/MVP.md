# Kajo MVP

Milestone: **MVP 0.1 — first public Kajo**

Product decision **2026-09-07**: algorithm correctness remains the critical path, but the first public release must also include Kajo's complete Taste-first acquisition loop. This file defines release blockers; it does not claim newly planned behavior is implemented. Graphics and detailed copy may evolve through existing theme/UX boundaries without changing the release contract.

Engine refinement **2026-09-12 / ADR-0008**: the Predictive Memory Engine remains an independent reusable system, with Kajo as its first adapter. Portable contracts and an isolated reproducible public-data baseline are added as bounded foundations below. No trained external prior is required to win, and no new runtime/model is accepted by documenting it.

Status legend: `[ ] planned`, `[-] in progress`, `[x] complete`.

Canonical launch flow: [LAUNCH_LOOP.md](LAUNCH_LOOP.md). Execution order: [ROADMAP.md](../project/ROADMAP.md). Long-term vision: [FUTURE_PLAN.md](FUTURE_PLAN.md). Generic engine: [PREDICTIVE_MEMORY_ENGINE](../architecture/PREDICTIVE_MEMORY_ENGINE.md). External data: [DATA_ENRICHMENT](../architecture/DATA_ENRICHMENT.md).

## MVP completion meaning

`MVP 0.1` is the first **complete externally usable BOOK/MOVIE Kajo**. It is not a mock prototype and not merely a store build.

Before the milestone may be marked complete:

- normal discovery uses a useful real BOOK/MOVIE catalog,
- the recommendation/evidence system passes algorithm correctness, memory, trace, SleepLayer and replay gates,
- the engine's independent contracts and external-data baseline report are reproducible, with explicit source/artifact admission or rejection rather than assumed model benefit,
- a previously unknown visitor can begin a real Taste Test from a public link without registration,
- Taste Test creates useful first-session PersonalProfile taste and an honest holdout prediction challenge,
- a small personalized recommendation preview is shown before registration,
- anonymous taste state survives Google/Apple conversion without duplicate identity/Profile creation,
- a personal invite can convert the receiver into an accepted Friend of the inviter,
- accepting a Friend invite does **not** automatically create a SharedProfile,
- Friends can explicitly create a SharedProfile through a short consent-based flow,
- the full link → Taste → auth → Friend → Shared loop is measurable, privacy-safe and abuse-resistant,
- core PersonalProfile/SharedProfile/Lists/search flows work end-to-end,
- a controlled external beta validates the complete intended acquisition path,
- production auth/security/privacy/support/retention/recovery/signing/store requirements pass,
- a store/public destination is usable and accepted by the owner,
- the `ROADMAP.md` **Share Link Gate** is explicitly accepted before broad distribution.

Commercial monetization, public stranger discovery, dating, extra production domains and automatic global predictor promotion remain outside MVP unless explicitly promoted later.

## Foundation

- [x] `MVP-FOUND-001` Mobile project runs on iOS and Android through React Native + Expo.
- [x] `MVP-FOUND-002` Repository has CI for lint/typecheck/tests once code exists.
- [x] `MVP-FOUND-003` Core domain contracts use Profile, Item, Event and Context terminology.

## Authentication and identity

- [x] `MVP-AUTH-001` User can register with a unique email + nickname, confirm email, sign in and recover password.
- [x] `MVP-AUTH-002` Nickname belongs to the same canonical identity; uniqueness/search/sign-in are case-insensitive while display casing is preserved.
- [x] `MVP-AUTH-003` Nickname length is consistently bounded to 2–24 characters.
- [ ] `MVP-AUTH-004` Production supports Google plus Sign in with Apple through the same canonical Kajo User; linked providers must not create duplicate PersonalProfiles or nicknames.
- [ ] `MVP-AUTH-005` Anonymous Taste identity can be upgraded/linked to a permanent Google/Apple User while preserving the same logical PersonalProfile/taste state and without unsafe merging of two permanent Users.

## Room and theme

- [x] `MVP-ROOM-001` A user has a personal minimalist 2D Room.
- [x] `MVP-ROOM-002` Room is the primary home/navigation surface.
- [x] `MVP-ROOM-003` Bookshelf opens book discovery.
- [x] `MVP-ROOM-004` Screen/projector opens movie discovery.
- [x] `MVP-ROOM-005` Theme is represented by reusable tokens rather than screen-local hard coding.
- [x] `MVP-ROOM-006` SharedProfile has its own restrained Room/theme identity.

## Navigation shell

- [x] `MVP-NAV-001` Persistent Kajo mark returns to the currently active Profile Room.
- [x] `MVP-NAV-002` Persistent bottom dock exposes menu + Inbox without conventional multi-tab navigation.
- [x] `MVP-NAV-003` Drawer owns Profile switching plus Profile/Lists/Groups destinations without duplicate/dead entries.
- [x] `MVP-NAV-004` Bottom-center Profile identity returns to the active Room from other routes and opens the accepted lightweight Profile quick switcher when already home.
- [ ] `MVP-NAV-005` Canonical Groups/Profile surface filters only already-authorized Profile names; unrelated/private Profiles are never exposed.

## Discovery

- [x] `MVP-DISC-001` Books and movies have visual grid discovery.
- [x] `MVP-DISC-002` Discovery supports `FOR_YOU`, `SURPRISE` and `RISK`.
- [x] `MVP-DISC-003` Curtain control selects DiscoveryMode with three snap states.
- [x] `MVP-DISC-004` DiscoveryMode maps visually to dawn/evening/night.
- [x] `MVP-DISC-005` Ranking changes through hosted scorer when DiscoveryMode changes.
- [x] `MVP-DISC-006` Item details are reachable.
- [x] `MVP-DISC-007` One shared DiscoveryMode value persists through Room/discovery/detail.
- [ ] `MVP-DISC-008` Discovery exposes a bounded contextual row of active Profile Lists with canonical overflow.
- [ ] `MVP-DISC-009` Canonical catalog supports title/creator search plus normalized tag/year/language/ItemType filtering with bounded server pagination and truthful provenance.

## Real catalog

- [ ] `MVP-CAT-001` Normal BOOK/MOVIE discovery uses a useful real provider-backed catalog with at least hundreds of Items/domain and sufficient Finnish/international diversity; `KAJO_MOCK` is not normally discoverable.
- [ ] `MVP-CAT-002` Provider-backed Items have canonical provenance, external-ID deduplication, lifecycle/discoverability and repeatable refresh semantics.
- [ ] `MVP-CAT-003` Presentation can show legally usable image/title/creator/release/genre-or-subject metadata without provider-specific recommender branches.

## Profile bootstrap and history import

- [ ] `MVP-BOOT-001` User can import Letterboxd/IMDb movie history through a user-authorized file flow.
- [ ] `MVP-BOOT-002` User has at least one practical book-history import path plus a generic fallback.
- [ ] `MVP-BOOT-003` No-import user can establish initial taste from recognizable real Items, with unknown skips and bounded fail-open behavior.
- [ ] `MVP-BOOT-004` Imported/calibration evidence is idempotent, removable/correctable, source-provenanced and progressively superseded by native behavior.

## Taste-first acquisition — release blockers

These requirements implement [LAUNCH_LOOP.md](LAUNCH_LOOP.md).

- [ ] `MVP-TASTE-001` An unauthenticated visitor can start a server-backed Taste session from a public link or personal Friend invite without an account wall; abandoned sessions follow a bounded retention policy.
- [ ] `MVP-TASTE-002` Taste question selection uses only real canonical Items and adaptively balances recognition, diversity and information gain. The normal opportunity bound is approximately 12–24 recognized/unknown opportunities with a versioned stop/fail-open rule; no demographic profiling is required.
- [ ] `MVP-TASTE-003` Taste responses reuse canonical rating/unknown/not-interest semantics and initialize the visitor's PersonalProfile-compatible taste state without pretending campaign/auth behavior is recommendation evidence.
- [ ] `MVP-TASTE-004` Kajo performs a holdout prediction challenge on known Items whose answers have not yet entered that Taste session's training state. Prediction/model/taste snapshot is frozen before answer capture and the challenge response can join taste only afterward.
- [ ] `MVP-TASTE-005` User-facing challenge quality uses an explicitly documented mathematical metric, sample size and uncertainty; no fabricated percentage or retroactively improved self-score is permitted.
- [ ] `MVP-TASTE-006` After the challenge, Kajo shows a small unseen recommendation preview generated through the canonical production ranking boundary, including safe explanation and optional FOR_YOU/SURPRISE/RISK contrast.
- [ ] `MVP-TASTE-007` A completed Taste session produces useful first-session recommendations compared with a fixed transparent baseline/reference set; if evidence does not show usefulness, public launch remains blocked.

## Acquisition links, web continuation and conversion

- [ ] `MVP-ACQ-001` A public/reusable Taste link opens the Taste flow in a normal browser when the app is absent and the equivalent route in the installed app where supported; campaign attribution grants no Friend/Shared permission.
- [ ] `MVP-ACQ-002` A personal Friend invite uses a separate opaque server-owned token with inviter reference, expiry, revocation, bounded use and anti-replay semantics. It never exposes private Profile data in the URL.
- [ ] `MVP-ACQ-003` Anonymous Taste state is server-backed and survives browser/app/auth continuation according to retention rules; local state is only a cache/continuation aid, not the sole canonical record.
- [ ] `MVP-ACQ-004` Google/Apple conversion preserves Taste responses, attribution and the same logical PersonalProfile exactly once; failed/abandoned auth can resume safely.
- [ ] `MVP-ACQ-005` Taste completion presents the recommendation preview before the primary Google/Apple continuation CTA; registration is not required to discover whether Kajo provides value.
- [ ] `MVP-ACQ-006` Campaign/referral/invite attribution is versioned, bounded and separately queryable from recommendation evidence.
- [ ] `MVP-ACQ-007` Web/app/auth/link continuation passes clean-session, installed/not-installed, expired/revoked token, duplicate-open and account-collision tests.

## Friends and viral loop — release blockers

`Friendship` is a lightweight social relationship and is intentionally separate from SharedProfile membership.

- [ ] `MVP-FRIEND-001` Activated User can create a personal Friend invite that sends the receiver through the same Taste-first flow.
- [ ] `MVP-FRIEND-002` Receiver explicitly accepts the inviter connection after/through permanent identity conversion; pending invite is not Friendship.
- [ ] `MVP-FRIEND-003` Successful acceptance creates at most one reciprocal active Friendship for the pair and is idempotent under retries/replayed links.
- [ ] `MVP-FRIEND-004` Friendship grants no access to the Friend's private PersonalProfile Events, Memory, imports, messages or raw taste state.
- [ ] `MVP-FRIEND-005` Both users see the accepted Friend on the canonical Friends surface.
- [ ] `MVP-FRIEND-006` Remove/block/reinvite behavior is explicit; blocked/removed states cannot be bypassed with old tokens.
- [ ] `MVP-FRIEND-007` Invite creation/open/accept and nickname/search surfaces use enumeration/spam/rate-limit controls suitable for public release.

## Shared Kajo creation from Friends

Existing SharedProfile learning semantics remain canonical.

- [x] `MVP-PROFILE-001` Every permanent User has a PersonalProfile.
- [x] `MVP-PROFILE-002` 2-N Users can belong to persistent SharedProfile through accepted membership.
- [x] `MVP-PROFILE-003` Events store `actorUserId` separately from `profileId`.
- [x] `MVP-PROFILE-004` SharedProfile name length is 2–32 characters.
- [x] `MVP-PROFILE-005` Member can leave SharedProfile safely with confirmation and correct fallback/access loss.
- [ ] `MVP-GROUP-001` Two Friends can explicitly create a new SharedProfile through one short consent-based flow; accepting a Friend invite never creates it automatically.
- [ ] `MVP-GROUP-002` 3+ SharedProfile creation can select Friends but still requires canonical membership acceptance; Friendship and Shared membership lifecycles remain independent.
- [ ] `MVP-GROUP-003` Newly created SharedProfile immediately uses the existing canonical joint/common-fit prediction boundary; no pair-specific duplicate recommender is introduced.

## Existing Shared discovery

- [x] `MVP-SOCIAL-001` SharedProfile has joint current Item state and actor/Profile-separated persistence.
- [x] `MVP-SOCIAL-002` Members can browse/swipe and receive Prediction in Shared context without a separate media/social predictor.
- [x] `MVP-SOCIAL-003` Member can create actor-specific pending Endorsement.
- [x] `MVP-SOCIAL-004` Pending Endorsement is hidden for endorser and prioritized for non-endorsing accepted members with provenance.
- [x] `MVP-SOCIAL-005` Unanimous endorsement promotes once to Shared Saved/system `Tallennetut` and remains durable after later membership changes.
- [x] `MVP-SOCIAL-006` Delivered V1: accepted-member Personal history appears as an attributed lower Shared tier; Shared consumed/consensus-saved Items are suppressed. Required successor eligibility is tracked separately in `MVP-SOCIAL-009`.
- [ ] `MVP-SOCIAL-007` After Personal Taste setup, SharedRatingRound retains each participant's own 0–10 response: A's rating prompts B; all required responses precede completed joint Katsotut/Luetut. #232, Phase 16.3.
- [ ] `MVP-SOCIAL-008` Joint learning keeps actor/round provenance and disagreement, with atomic completion, correction/Undo, retry and membership-change semantics; Personal history remains separate and legacy single-actor history is not fabricated into confirmed rounds. #232.
- [ ] `MVP-SOCIAL-009` A member-seen Item may rank strongly for joint use; a bounded/versioned rewatch policy permits a new joint experience of the same Item while retaining all prior history. Serving/shadow eligibility and delayed outcomes agree. #232.

## Swipe and state

- [x] `MVP-SWIPE-001` Optional swipe mode exists for books/movies.
- [x] `MVP-SWIPE-002` Consumed rating 0–10 and unconsumed not-interest are distinct.
- [x] `MVP-SWIPE-003` Personal rating implies consumed/read/watched; joint completion additionally requires `MVP-SOCIAL-007`.
- [x] `MVP-SWIPE-004` Consumed/reacted Items are suppressed appropriately; impressions have bounded cooldown.
- [x] `MVP-SWIPE-005` Rating, not-interest and List addition use one restrained action drawer; List add is positive action.
- [x] `MVP-SWIPE-006` Recent interactions can be undone with exact Item/state restoration.

## Saved, consumed and memory

- [x] `MVP-MEM-001` User can save/unsave Item.
- [x] `MVP-MEM-002` User can view consumed books/movies.
- [x] `MVP-MEM-003` Personal rating 0–10 records consumed; the Shared round requirement is tracked in `MVP-SOCIAL-007`.
- [ ] `MVP-MEM-004` Data model retains an extension point for future note/photo/people/location/date memories.
- [-] `MVP-MEM-005` Profile-scoped Saved and consumed collections are reachable without duplicating canonical interaction state.

## Named Lists

- [-] `MVP-LIST-001` Personal/Shared Profiles can own multiple named generic Lists plus one system Saved List.
- [-] `MVP-LIST-002` Compact multi-destination List picker supports recent Lists and create/name/rename in Personal and Shared Profiles; Shared members review the exact full set before atomic unanimous addition. The final Add submits the selection without a second Done action; create alone never adds Items.
- [-] `MVP-LIST-003` Personal add is positive action; Shared custom List proposal/approval follows Endorsement unanimity for the exact selected set and then system Saved promotion.
- [-] `MVP-LIST-004` List detail supports list/card presentation, deterministic sort and generic ItemType filters.
- [-] `MVP-LIST-005` Membership stores truthful added-by/time while canonical consumed/rating state stays elsewhere.
- [-] `MVP-LIST-006` Shared List access follows accepted membership authorization.

## Profile messaging

- [-] `MVP-MSG-001` Profile exposes narrow owner/member-only thread retaining real actor.
- [-] `MVP-MSG-002` Inbox surfaces invitations/message activity without Room clutter.
- [-] `MVP-MSG-003` Optional Item/List message references canonical Profile/List/Item while message text is not prediction evidence by default.

## Data and prediction

- [-] `MVP-DATA-001` Meaningful discovery behavior is captured through canonical generic event interface.
- [-] `MVP-DATA-002` Recommendation impressions are traceable to a `predictionId`.
- [-] `MVP-DATA-003` Meaningful action commits canonical Event(s) and current-state projection atomically/idempotently; persistent actor/Profile outbox survives termination/retry safely. #224 delivers rating/not-interest/undo; #226 extends the same atomic/durable path to Lists/Endorsements with mixed undo and outcome corrections. Real-device termination/reconnect acceptance remains open; see the active PR/Sprint 014 for rollout status.
- [ ] `MVP-DATA-004` Grid/detail/swipe/search/Lists/Shared overlays use exact truthful delivered Profile/prediction/slate origin; delayed outcomes never inherit guessed provenance.
- [x] `MVP-PRED-001` Prediction ranks generic Items for a Profile.
- [x] `MVP-PRED-002` Prediction includes long-term, recent and Item-similarity signals.
- [x] `MVP-PRED-003` DiscoveryMode changes ranking/exploration semantics.
- [x] `MVP-PRED-004` Core supports ScenarioMemory without redesigning Profile/Item/Event/Prediction contracts.
- [-] `MVP-PRED-005` Shared Prediction combines direct Shared evidence and authorized aggregate member fit/disagreement while retaining privacy and Shared target identity.
- [-] `MVP-PRED-006` Learnable hosted recommendation persists versioned PredictionRun + complete candidate trace before correlated learning.
- [x] `MVP-PRED-007` V1 uses bounded inspectable same-Profile ScenarioMemory and safe fallback.

## Algorithm correctness and adaptation — release blockers

- [x] `MVP-ALG-001` Imported/calibrated taste changes unseen Personal ranking directly; opposite bootstrap tastes produce explainably different orders and removal/correction recomputes influence. Technical acceptance: #207/#210 and adopted fresh-install gate #208/#223; device/bootstrap usability and measured quality remain separate BOOT/CAT/TASTE gates.
- [ ] `MVP-ALG-002` Serving/shadow share versioned feature/score/eligibility/delivery semantics and baseline replay parity.
- [ ] `MVP-ALG-003` Bounded candidate generation refills after suppression and paginates without duplicates/leakage/false exhaustion.
- [ ] `MVP-ALG-004` Working/Short/Long state use ordered, source-aware, evidence-aware decay/support; contradictions can change taste without one session erasing durable state.
- [ ] `MVP-ALG-005` BOOK/MOVIE share versioned normalized features with bounded cross-domain transfer and safe neutral fallback.
- [ ] `MVP-ALG-006` FOR_YOU/SURPRISE/RISK have evaluated context-dependent policy differences; unsupported confidence/probability claims are forbidden.
- [ ] `MVP-ALG-007` Cold-start/Taste selection is recognizable, diverse and informative with measured completion/usefulness.
- [ ] `MVP-ALG-008` SleepLayer has scheduled bounded retry-safe worker, mature-outcome evaluation, monitoring and tested manual canary/rollback; no tiny-sample promotion.
- [-] `MVP-ALG-009` Clean database/replay and deterministic SQL regression tests cover bootstrap, parity, suppression/refill, time/undo/outcome reconciliation and authorization.

## Portable engine and external-data foundation — bounded completion contracts

[ADR-0008](../architecture/decisions/0008-portable-predictive-memory-engine-and-external-priors.md) and [ROADMAP Phase 14.3A](../project/ROADMAP.md#143a--portable-contracts-and-external-data-research) define the owner-requested new direction. These are planned, not delivered by the architecture documentation.

- [ ] `MVP-ENG-001` Executable generic engine contracts preserve Subject/acting-identity separation, Object/Action/State/Observation/Outcome semantics, missingness, time/version scope and hard constraints. Deterministic Kajo/media and small synthetic non-media adapter fixtures run without UI/hosted DB and without importing provider/UI/auth dependencies into core. The real package joins workspace/exports and root lint/typecheck/tests. Current SQL serving is unchanged until a parity-tested component replacement is admitted. E1 #235.
- [ ] `MVP-ENG-002` An isolated MovieLens manifest/adapter and baseline report are reproducible on a declared deterministic real-data cohort, with validation/quarantine, train-only artifacts, chronological and cold-start splits, a fixed final test, coverage/uncertainty/resource reporting and explicit task limitations. Include a bounded declared static-state versus ordered-prefix/trajectory-retrieval comparison. No external identities or invented context/exposures become native Kajo evidence. Dataset scale and experiment limits are reported honestly; a challenger is not required to win. D1 #236 → D2 #237.
- [ ] `MVP-ENG-003` Source/derived-artifact permissions and lineage are explicit and fail closed for unsupported uses. A tested absent/invalid/withdrawn-prior fallback and recorded admission/rejection decision preserve native serving. Synthetic records cannot enter observed-outcome evaluation or validate their own generator. Jointly learned source influence requires a documented replacement/retraining path rather than assuming raw-file deletion removes it.

D3 Tag Genome, D4 Beliefs and D5 KuaiRand are optional independent enrichment/research packets after D2. E2 serving integration is conditional on rights, useful evidence, compatibility and the existing native reliability/rollback gates. External hidden-rating accuracy does not close Kajo first-session, exposure, Shared, cross-domain or device acceptance. A useful transparent baseline remains acceptable; indefinite model search is not a release requirement.

## Growth/funnel measurement — release blockers

- [ ] `MVP-GROWTH-001` Funnel telemetry can reconstruct public link/open → Taste start/response/completion → challenge → preview → auth conversion → Friend invite/open/accept → Friendship → SharedProfile creation.
- [ ] `MVP-GROWTH-002` Funnel events are semantically separate from Item preference/consumption evidence; growth clicks cannot become recommender reward by default.
- [ ] `MVP-GROWTH-003` Taste policy, model/policy versions, campaign/referral source and relevant experiment assignment are traceable for evaluation.
- [ ] `MVP-GROWTH-004` Release metrics include Taste completion, recognition, holdout error/hit rate, account conversion, D1/D7, invites/activated User, invite→Friend conversion, Friends→Shared creation and successful discoveries; installs/time-spent alone are not success.

## UX and accessibility

- [ ] `MVP-UX-001` Core flows support screen readers, larger text, accessible gesture alternatives, contrast/reduced motion plus usable loading/empty/offline/permission/recovery states on representative devices.
- [ ] `MVP-UX-002` Taste-first link flow is usable on representative mobile browsers and inside the installed app, with clear continuation when an external browser/app-store/auth round-trip occurs.

## Production services and data lifecycle

- [ ] `MVP-OPS-001` Every production service has owner/environment/region/access/recovery/cost/deployment record; staging and production data/secrets are isolated.
- [ ] `MVP-OPS-002` Versioned retention/deletion/export covers Auth, anonymous identities/Taste sessions, attribution/invites/Friendship, Personal/Shared evidence, imports, Lists/messages, traces, derived state, device data, logs and backups.
- [ ] `MVP-OPS-003` Backup and isolated restore drills meet recorded objectives for database/objects/config/signing recovery.
- [ ] `MVP-OPS-004` Alerts/runbooks cover API/auth/Taste/link/import/worker failures, crash rate, queue age, Prediction quality/latency, database/storage growth and spend.
- [ ] `MVP-OPS-005` Dependency/secret/license checks, protected release workflow, migration/config parity and proven-unused artifact cleanup are complete; production builds fail closed on missing production config/mock discovery.
- [ ] `MVP-OPS-006` Anonymous Taste and Friend-invite creation/open/accept have abuse/rate limits, anti-enumeration, revoke/expiry, block handling and redacted diagnostics suitable for public links.

## External beta readiness

- [ ] `MVP-BETA-001` A clean external visitor can use the **actual intended flow** without developer setup: link → Taste → challenge → preview → Google/Apple → Kajo → invite Friend → accepted Friendship → explicit SharedProfile → joint recommendation.
- [ ] `MVP-BETA-002` Failures are diagnosable and beta outcomes drive bounded fixes/calibration rather than silent architecture changes; small beta percentages are not treated as proof of small statistical lifts.
- [ ] `MVP-BETA-003` Owner accepts the complete link-to-app flow on representative Android/iOS devices before the Share Link Gate.

## Production release

- [ ] `MVP-REL-001` Stable production identifiers/versioning/signing/release config exist; no privileged credential is embedded in clients.
- [ ] `MVP-REL-002` Production email/social auth, privacy/support, store assets, permissions and account/data lifecycle are verified for external users.
- [ ] `MVP-REL-003` Signed production release is downloadable through Google Play and/or Apple App Store and clean install/auth/Personal/Shared/real discovery/Lists/update flows pass on representative real devices.
- [ ] `MVP-REL-004` `ROADMAP.md` Share Link Gate is explicitly accepted. Before this requirement is complete, agents must not claim Kajo is ready for broad Taste-link distribution.

## Explicitly outside MVP 0.1

- Monetization/subscriptions/ads.
- Full autonomous genetic/evolutionary production promotion.
- Privacy-gated cross-Profile PopulationMemory before consent/cohort/deletion/exposure-bias gates.
- Mandatory deployment of a learned external prior, Tag Genome or Beliefs pipeline; these are conditional/optional beyond the bounded E1/D1/D2 foundation.
- Learned multistep WorldModel/DreamEngine, unrestricted synthetic training and self-evolving geometry as release prerequisites.
- Music, series, games, restaurants, travel and live-event production domains.
- Public follower/influencer/global feed mechanics.
- Local stranger discovery or matching.
- Dating/relationship compatibility product.
- Arbitrary DMs between unrelated Users.
- Public Lists/advanced smart-list rules/rich list media.
- Majority-vote Shared automatic saving; current automatic promotion remains unanimity.
- Complex 3D/game-like Room editor.
- Full photo-rich life journal.
- Advanced demographic personalization.
- Continuous precise-location tracking.
- Speculative Kafka/Kubernetes/graph-database/microservice infrastructure solely for hypothetical scale.

The complete long-term vision—including series, music, hyperlocal activities/events, richer memories, friend-review feeds, local/global discovery, possible people matching/dating research, compact learning infrastructure and distributed research ideas—remains preserved in `FUTURE_PLAN.md`. The complete five-generation engine direction is in `PREDICTIVE_MEMORY_ENGINE.md`; neither displaces the release sequence above.
