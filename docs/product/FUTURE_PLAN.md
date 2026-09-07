# Kajo complete product and research backlog

Product direction recorded **2026-09-07**, planning delivery #213. This is permanent project memory for the owner's complete vision and the preceding catalog/SleepLayer/distributed-network discussion. It specifies future work, not delivered features, purchased licenses or demonstrated model performance.

[ROADMAP.md](../project/ROADMAP.md#post-mvp-execution-queue) owns execution order; [MVP.md](MVP.md) owns the first release boundary; [STATUS.md](../project/STATUS.md) owns the next active task. Do not replace the unfinished 14.0–15.3 queue with this backlog. The final product target exceeds MVP 0.1 and requires **both Apple App Store and Google Play**, even if the first milestone ships through one store first.

## Completion target and recording rules

Kajo should offer books, movies, series, music albums and Helsinki-first hyperlocal events with useful names, creators, legally usable imagery, normalized tags, search and Personal/Shared discovery. The algorithm learns the person and the dynamics of each SharedProfile. Fast response, a quiet accessible mobile interface, privacy, reliable synchronization and bounded device/server resource use apply to every increment.

Friend discovery and groups lead to optional relevant review feeds. Local/global feeds and real-world friendship or dating are later possibilities; neither compatibility accuracy nor a public people network is promised by the first release. Research can legitimately conclude that an idea should not ship.

- `PLANNED`: accepted direction, implementation and acceptance outstanding.
- `CONDITIONAL`: useful extension only after the named product/evidence gates.
- `RESEARCH`: experiment with explicit comparison and stop criteria; no production commitment.
- Keep stable IDs below when splitting an activated package into Issues. Add the Issue/evidence links here; avoid copying the specification into many competing documents.
- Every future idea records purpose, dependency, smallest experiment, acceptance/stop decision and evidence date. Keep rejected/deferred rationale in this file or linked ADR; Git retains old revisions. Do not silently delete an idea because it is distant.
- Activate only the next ready package from ROADMAP; create a sprint file only when work begins. Feature flags, small PRs and reversible rollouts preserve the current product. Current MVP acceptance marks remain unchanged.

## FUT-CAT-001 — Broad canonical catalog — PLANNED

Build on MVP-CAT-001..003 / MVP-DISC-009 and the existing importers, `ItemSource`, `ItemExternalId` and canonical `Item`. Aim for very high findability in declared markets, not an unverifiable claim to every work worldwide.

| Domain | Candidate source and ingestion | Identity and rights gates |
|---|---|---|
| BOOK | Open Library monthly dumps for breadth; Finna/Fennica for Finnish bibliographic enrichment; additional licensed sources only for measured gaps | Work, translation and edition relationships; ISBN identifies an edition, not all versions of a work. Keep edition language/title/cover consistent. Metadata rights do not grant cover rights. |
| MOVIE | Existing TMDB adapter, bounded expansion and refresh | Namespace movie IDs; preserve alternate titles, creator roles and localization. Confirm API/data/image use, attribution and commercial license before monetization. |
| SERIES | TMDB TV is a source candidate to validate at activation | Separate TV/movie ID namespaces. Start with series-level discovery; season/episode progress must not imply whole-series consumption. |
| ALBUM | Evaluate MusicBrainz release-group/release data and Cover Art Archive; commercial provider adapters only if needed and permitted | Distinguish album concept, release/edition and artist identity. Metadata, cover art, playback and recommendation-training permissions are separate. No audio streaming is implied. |

Future type labels in this document are planning labels; production `ItemType` currently supports BOOK/MOVIE only. Each domain activation must update compatible backend/client contracts and migrations together. Never add a second domain-specific Profile, List or prediction core.

Ingestion design:

1. Fetch provider snapshots/changes through a bounded, checkpointed adapter with rate limits, conditional requests where supported, retry backoff and per-source cost ceilings.
2. Validate and normalize into the existing authorized catalog boundary. Store provenance, provider update/last-check timestamps, rights/attribution and lifecycle. Quarantine ambiguous cross-provider matches; title alone is not an identity key.
3. Maintain versioned shared tags/features with provider mappings, aliases, language and missing-value semantics. Generated enrichment keeps model/source provenance and cannot invent factual credits or become behavioral evidence.
4. Merge safe aliases into a canonical Item while preserving List/Event/Prediction references. Source removal affects eligibility and refresh, not historical referential integrity.
5. Serve normal search/discovery from Kajo's persisted index. A search miss may schedule bounded enrichment; it must not turn every keystroke into external crawling or block normal queries on provider uptime.
6. Retrieve a bounded union of candidates, then rank for the Profile. Cache allowed image sizes separately from metadata and private ranking; never download the whole catalog to a phone.

Acceptance: reproducible import/update/delete-source tests; multilingual title/creator/tag searches with bounded pagination; zero silent ambiguous merges; measured duplicate, image, description and language coverage by domain; provider-outage fallback; discoverability of a versioned owner-reviewed reference set. Define numerical coverage targets before implementation, including Finnish and long-tail cases. Missing imagery has a usable fallback and never uses unlicensed substitute scraping.

## FUT-DOM-001 — Series — PLANNED

Depends on FUT-CAT-001 and accepted generic evidence/search contracts. Deliver series detail, tags, creator search, save/rating/undo and Personal/Shared recommendations using the same core. Define ongoing/finished status and partial viewing explicitly before adding progress controls. Do not interpret opening a season or watching one episode as liking/consuming the entire series.

Acceptance: mixed BOOK/MOVIE/SERIES Lists, correct namespaced imports, unknown-type behavior on supported older clients, cross-domain transfer compared with a no-transfer baseline and safe neutral fallback. Actual store-device flows and delayed-outcome semantics must pass.

## FUT-DOM-002 — Music albums — PLANNED

Depends on the catalog/domain extension proven by FUT-DOM-001. Start with album discovery, artist/title/tag search, cover display, save/rating and optional links to external listening services. Evaluate MusicBrainz bulk/API suitability, licenses, rate limits and actual Finnish/international coverage before choosing a provider. Do not require installing a music connector to browse Kajo's catalog.

Acceptance: multiple releases of an album do not manufacture duplicate taste evidence; artist aliases and same-title albums resolve safely; missing covers work; listening-link clicks are intent rather than confirmed listening/enjoyment. Licensed image attribution and Personal/Shared mixed-domain flows pass. Playback, account-history import and tracks are separate later scope.

## FUT-LOC-001 — Helsinki event ingestion — PLANNED

Depends on FUT-CAT-001, generic new-domain contracts and existing OPS privacy/worker gates. Start with Helsinki Linked Events; it is an existing event/place API, not proof that every Helsinki happening is covered. A real-world event is recommendable `Item` metadata; canonical `Event` continues to mean recorded user behavior.

Incremental source order:

1. Linked Events upcoming Helsinki inventory, places, updates and cancellations.
2. Measured coverage gaps filled by selected venues, galleries, libraries, neighborhood associations and organizers through official API, iCalendar/RSS or agreed feeds.
3. Allowlisted public-page extraction only after source-specific permission/terms/rights review. Prefer structured Event data; bounded text extraction may propose missing fields but cannot fabricate date, venue, price or cancellation state. Protect fetchers from private-network URLs, oversized payloads and instruction injection in source text.
4. Organizer submission/edit channel with verification, moderation, duplicate review and correction/takedown route. Keep original source links visible.

Record title, description, tags, organizer, venue/coordinates, start/end with timezone, occurrence/series linkage, price/currency or unknown, language/accessibility/age details where supplied, ticket/source URL, image rights, status, provenance and last verification. Store timestamps consistently and display Europe/Helsinki including DST. Unknown is not free, accessible, sold out or cancelled.

Match source IDs first; compare normalized name, venue and time for cross-source duplicates, with review for uncertain matches. A recurring series and its distinct occurrences are not duplicates. Define refresh tiers and an explicit freshness SLA before the pilot; near-term events refresh more frequently within provider limits. Stale or cancelled entries cannot silently remain actionable. Updating an event invalidates relevant cached availability.

Acceptance: fixed Helsinki reference sample and coverage-gap report; repeat imports are idempotent; cancellation/reschedule/timezone/recurrence tests; provider outage and stale-state presentation; auditable rights; organizer correction. Operational cancellation freshness and maintenance cost must be measured before expanding cities or sources.

## FUT-LOC-002 — Hyperlocal Personal/Shared discovery — PLANNED

Depends on FUT-LOC-001 and accepted context/Shared prediction. Eligibility considers whether the event is still available and reachable in time; rank then combines taste with time, optional travel-time/radius, price, language and explicit group constraints. Start with location/radius and time; add routing/weather dependencies only after measured benefit and provider review.

Location is optional and purpose-bound. Manual neighborhood/place selection is a complete path; no continuous location tracking or member-location disclosure. Source-derived event location is separate from a person's private location. Saving/ticket click is intent; attendance or enjoyment requires appropriate actual evidence, never proximity alone.

Acceptance: realistic Helsinki scenarios for tonight/weekend, cancelled/past/unknown-time events, denied location, low connectivity and groups with conflicting constraints. Compare cross-domain transfer against neutral event priors, track useful choices and actual outcomes, and avoid claiming no interest when travel/time made attendance impossible.

## FUT-SOC-001 — Friends and learned group dynamics — PLANNED

Depends on accepted SharedProfile/Lists/messaging/authorization gates. Existing group-name filtering #203 is not global friend discovery. Extend the existing nickname invitation route into a deliberately consent-based friend relationship with search discoverability settings, invitation accept/decline/revoke, remove/block/report, enumeration/spam limits and clear audience controls. Friendship never grants membership or private memory access automatically.

SharedProfile remains a first-class learner. Improve prediction using real joint choices, member agreement/disagreement, membership changes and bounded aggregate member fit; do not merely average Personal taste. Avoid allowing one very active member or duplicate actions to dominate confidence. A member leaving revokes access and removes that member's future private contribution while retaining authorized shared history under the existing lifecycle policy.

Acceptance: full two-person and 3+ member flows, blocked/former-member/outsider tests, invitation abuse controls, no private-history exposure in explanations, and group-outcome evaluation against current common-fit and simple-average controls. Assess whether all members find choices acceptable, not only whether one person clicks. Do not infer private conversation content as taste by default.

## FUT-SOC-002 — Relevant friend review feed — CONDITIONAL

Depends on FUT-SOC-001, explicit review publishing/audience model and operated moderation. Begin with a small optional feed of reviews friends intentionally publish. An ordinary private rating is not automatically a public review. Use approved Item/taste features for relevance; retain author, Item, audience and spoiler handling. Provide hide/mute/report/block, audience change/deletion propagation, bounded pagination and notification controls.

Acceptance: no private reviews in queries or caches; revoked friendship/visibility is honored; edit/delete/blocked-user propagation passes; helpful-review feedback and successful discoveries improve without making endless scrolling the product goal. Friend-feed reading alone must not be counted as consuming or endorsing the reviewed Item.

## FUT-SOC-003 — Local/global review discovery — CONDITIONAL

Depends on FUT-SOC-002 usefulness, sufficient opted-in public content, moderation capacity and PopulationMemory privacy gates where population-derived ranking is used. Add opt-in local/global scopes with coarse/manual locality and no disclosure of someone's home or live location. Protect against brigading, fake reviews, coordinated engagement and popularity dominance. Preserve the quiet Room and an easy feed-off path.

Acceptance: privacy/cache and abuse tests, moderated pilot, useful diversity/quality compared with friends-only, sustainable moderation cost and no private-to-public default conversion. If the feed adds noise without helping choices, defer expansion.

## FUT-REL-001 — Both public mobile stores — PLANNED

MVP-REL-001..003 remain the current release contract. This target closes the eventual two-platform gap: Kajo must be publicly downloadable in the declared launch market from **both Google Play and Apple App Store**, with usable clean install, auth/linking, account deletion, Personal/Shared flows and updates on real Android and iOS devices. Internal testing, TestFlight, APK artifacts or submission alone do not complete public availability.

Carry forward existing signing, ownership, production email, privacy/support, accessibility, backup/recovery and dependency gates. Recheck current store rules, permissions, data-safety/privacy declarations and provider licenses at each relevant submission. Review/moderation/report/block requirements must be satisfied before introducing public user content. Record both listing URLs, accepted versions, devices, update/rollback evidence and operating owner. A later domain/feature release must preserve both stores' compatibility.

## FUT-ALG-001 — Evidence-gated evolution — PLANNED, automatic promotion CONDITIONAL

Current ALG-001..009 / DATA gates and [PREDICTION_MODEL.md](../domain/PREDICTION_MODEL.md#13-sleeplayer-and-evolutionengine) already own the main design. Finish them first; this is their continuation, not a competing algorithm.

The owner's metaphor maps to existing concepts: dreams = bounded Challenger simulations/shadows; DNA = immutable PredictorGenome plus referenced artifacts; learned subconscious = versioned derived Working/Short/LongTerm state and PolicyAssignment. Simulations may vary weights, memory horizons, feature subsets or model families. Counterfactual synthetic situations are model assumptions, not historical observations.

Never store imagined outcomes as real Events, Outcomes or historical Scenarios. Promote a tested policy/configuration; consolidate patterns into memory only with real provenance. Preserve chronological holdouts, actual exposures, selection probabilities if randomization is introduced, uncertainty, multiple-comparison controls and domain-specific mature outcomes. Off-policy estimates require adequate overlap/support and truthful propensities; unexposed alternatives cannot be declared wins. Ratings/consumption/group satisfaction outweigh raw clicks.

Acceptance: same serving/shadow semantics; fixed-control and component-ablation comparisons; uncertainty/support reports; replay-safe deletion/correction; scoped canary/A/B; tested rollback and latency/cost/privacy/fairness guardrails. Per-Profile Champions require evidence and shrinkage; SharedProfile earns its own assignment. Automatic/global promotion requires a later explicit decision and sustained evidence, not this plan or a small beta lift.

## FUT-OPS-001 — Fast, lightweight growth and compact memory — PLANNED

Build on the canonical [service inventory, retention and performance gates](../architecture/ARCHITECTURE.md#mvp-production-service-inventory). Online serving, evidence ingestion and background learning have separate resource budgets. Continue server-owned Prediction; phone storage initially holds only authorized delivered slates, bounded presentation caches, preferences and durable pending commands.

Use bounded retrieval before scoring, indexed catalog search, incremental profile projections and invalidatable Profile/model/slate caches. Never key private results by ItemType alone or acknowledge a durable save merely because it entered a volatile queue. Keep the UI responsive with explicit pending/error state. Provider refresh, image enrichment, compaction and dreams stay off the interaction path; backpressure can pause learning before it harms serving.

Measure cold/warm p50/p95/p99, first usable slate, action acknowledgement, image bytes/cache hit rate, crash/error rates, outbox recovery, memory/disk/battery and background activity on reference low/mid-range Android and iOS devices. Existing numerical budgets live in ARCHITECTURE; record baseline and tighter targets there when evidence supports them. Declare workload/network/catalog/history/active-profile assumptions for every performance claim.

Plan capacity at 10k, 100k and 1m registered users without confusing registrations with concurrent sessions. Model active users, sessions, ranking requests, candidates per trace, Events, shadow multiplier and retention; measure at increasing synthetic load before provisioning. Report monthly compute, storage, replicas, backups, image egress, provider licenses and support/moderation costs separately. Add services, partitions or regions only for a measured bottleneck and record owner/recovery/ADR.

Compact representation candidates:

| Representation | Suitable information | Constraint |
|---|---|---|
| Sparse features / vectors | Taste and Item similarity summaries | Version and benchmark against transparent baseline; neither anonymous nor lossless by default |
| Relational links / graph | Item/creator/tag and authorized relationship structure | A graph database is not automatically needed |
| Immutable genome/artifact references | Model version, weights, ancestry, changes and random seed | Store shared base once; bounded deltas/checkpoints and integrity hashes; reproduce only with retained versioned inputs/runtime |
| Bounded trace / representative Scenario | Context, alternatives, actual exposure/outcome and uncertainty | Preserve evaluation support and rare/negative cases; clustering must not inflate confidence |
| Images / media objects | Covers and future explicit user memories | Rights, size variants and access controls; not a default encoding of structured learning data |

Two 256-dimensional float32 vectors are 2,048 bytes/Profile, roughly 2.048 GB for one million Profiles before indexes/copies. This illustrates only a compact projection: users can have several Profiles, and catalog, trace candidates, raw evidence, backups and imagery can dominate total cost. Do not budget the service from vector size alone.

Acceptance: representative load and failure/restore tests, cost forecast with real measured row/object sizes, bounded worker queues, source deletion propagated through derived state, and no indefinite raw history. Trial compression must retain defined replay/quality ability within the retention window. Expired evidence makes an old experiment non-replayable; do not invent replacement evidence. User-requested explicit history, operational records and model audit have separate purposes/lifecycles.

## RES-NET-001 — Planet / folded-space network — RESEARCH

Preserved owner concept from 2024-10-13, recalled and refined 2026-09-07: a ledger distributed in virtual 4D space from an origin, vectors routed toward predicted nearby online nodes, returned confirmations, parallel transactions and cross-validation by separate neighborhoods (earlier suggestion: 2–3 groups). Users could retain encrypted fragments of recent transactions/data. This is a conceptual topology, not a proven secure consensus protocol or physical shortcut.

Investigate latency/load/availability-aware placement and routing, DHT discovery, content-addressed immutable blocks, signed manifests, replication/erasure recovery and bounded caching. Distinguish semantic similarity, network latency and independently controlled trust groups. Virtual distance alone cannot establish any of them. Several confirmations do not prove full history validity or independence.

Smallest experiment: isolated public/licensed catalog or synthetic blocks on controlled nodes, with a normal object-store/CDN baseline and then a standard DHT baseline. Define what is being verified: bytes/integrity, durable availability, authorized update ordering or consensus. Storage checks do not prove a recommendation is useful. No production user fragments, blockchain dependency, token economy or mandatory phone node.

Test churn, offline peers, network partitions, stale versions, adversarial/Sybil identities, colluding neighborhoods, corrupt/replayed data, repair traffic and hot keys. Compare p95/p99 read/write latency, durability/availability, bandwidth, replication overhead, total operator + device cost and deletion/key-loss recovery. Encryption is not availability, anonymity or automatic cheap computation over ciphertext.

Go only if a reproducible report shows a material advantage on a declared workload without weakening privacy, correctness or recovery. Stop/defer if overhead erases savings, independent trust cannot be established or reliable service depends on phones staying online. Any production adoption needs a new threat model, ADR and bounded opt-in deployment; this research never blocks Kajo delivery.

## RES-EDGE-001 — On-device prediction and federated learning — RESEARCH

Separate this from storing other people's encrypted data. Hypothesis: an optional compact model learns from the owner's local evidence; privacy-protected aggregate model updates can improve the common model. Current AGENTS/ADR server-owned scoring remains binding. This plan does not authorize mobile scoring or downloading private model/evidence artifacts.

Experiment after FUT-ALG-001/FUT-OPS-001: synthetic or explicitly consented local data, signed/versioned compact models and safe server fallback. Compare quality/latency, synchronization/replay parity, update bytes, charging/network constraints, battery and operational cost with server-only serving. Evaluate model-update leakage, poisoning, secure aggregation and any needed privacy/noise budget; federated learning alone is not a privacy guarantee. Cover offline/stale models, revoked membership, device theft/key recovery and deletion/retraining lineage.

Go only with measurable benefit, tested controls and an accepted architecture change updating AGENTS and ADRs. Fail/disable safely on unsupported devices. No phone must serve other users' requests or run continuous background work for Kajo to function.

## RES-PEOPLE-001 — Real-world friendship and relationship compatibility — DISTANT RESEARCH

Preserve the owner's idea: help consenting people meet nearby, exploring both shared interests and complementary differences; much later investigate who may fit as a friend or romantic partner. Depends on FUT-SOC-003 and operated safety/moderation, not merely a good movie recommender.

Start with optional shared-interest activity introductions, then separately evaluate whether outcome evidence supports any compatibility model. Similar media tastes do not establish relationship success; different tastes do not establish incompatibility. Friendship and dating have separate stated intent, eligibility, consent and evaluation. Never treat humans as public catalog Items or activate an identity recommendation model under the existing Item scorer without a dedicated domain/privacy/product design.

Before a human pilot: opt-in visibility and contact, mutual acceptance, coarse location, hide/block/report, anti-stalking/harassment controls, safety escalation ownership and age-appropriate access; dating requires an adult-only design. Do not infer sexuality, health or other sensitive traits from consumption; do not expose private taste/history or rank human worth. No meeting or contact occurs automatically.

Smallest pilot asks whether consenting adults find introductions useful and safe, with voluntary outcome feedback and a neutral baseline. Stop if safety cannot be operated, participation is insufficient, or an asserted compatibility score has no supported value. No guaranteed romantic success, manufactured compatibility percentage or engagement-only success metric. Independent legal/store review occurs at activation.

## Other preserved directions

Existing product ideas remain conditional: richer notes/photos/dates/places/people memories, Item/List comments and attachments, smart Lists/folders/public sharing, artists/tracks/podcasts/games/restaurants/activities/travel, learned sequence/semantic-ID/LLM challengers and monetization. Reuse existing contracts and the relevant privacy/licensing/evaluation gates. No speculative modules or photo buckets are required now. Reconsider each during the roadmap review rather than dropping it or silently treating it as MVP scope.

## Source register

References inspected in the planning conversation on 2026-09-07. Recheck terms, quotas, availability and store rules at activation; links do not constitute a granted license or implementation verification.

- [TMDB API and commercial-use FAQ](https://developer.themoviedb.org/docs/faq)
- [Open Library API usage](https://openlibrary.org/developers/api) and [monthly dumps](https://openlibrary.org/developers/dumps)
- [Finna API](https://www.kiwi.fi/spaces/Finna/pages/53839221/Finna%2BAPI%2Bin%2BEnglish) and [metadata/resource rights](https://www.kiwi.fi/spaces/Finna/pages/53839699/Finna%2BAPI%2BTerms%2Bof%2BUse)
- [Helsinki Linked Events](https://developer.hel.ninja/apis/linkedevents/) and [city-maintained implementation](https://github.com/City-of-Helsinki/linkedevents)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), [data licenses](https://musicbrainz.org/doc/About/Data_License) and [Cover Art Archive](https://coverartarchive.org/)
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/) and [account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play user content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en) and [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-GB)
- [Off-policy evaluation research](https://arxiv.org/abs/1612.01205)
- [Kademlia DHT](https://libp2p.io/docs/kademlia-dht/), [DHT security](https://libp2p.io/docs/dht/) and [IPFS persistence](https://docs.ipfs.tech/concepts/persistence/)
- [Federated learning research](https://research.google/pubs/communication-efficient-learning-of-deep-networks-from-decentralized-data/) and [Android background restrictions](https://developer.android.com/develop/background-work/background-tasks/bg-work-restrictions)
