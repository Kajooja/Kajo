# Kajo Architecture

Status: **canonical implemented boundaries + first-release target architecture**  
Architecture decisions: `docs/architecture/decisions/`  
Taste-first decision: ADR-0007  
Independent-engine refinement: [ADR-0008](decisions/0008-portable-predictive-memory-engine-and-external-priors.md)

This file owns Kajo product/runtime boundaries. The complete reusable 51-part engine target is [PREDICTIVE_MEMORY_ENGINE](PREDICTIVE_MEMORY_ENGINE.md); Kajo-specific prediction/evidence semantics remain in [PREDICTION_MODEL](../domain/PREDICTION_MODEL.md). [DATA_ENRICHMENT](DATA_ENRICHMENT.md) owns isolated public-data research and artifact admission. Planned contracts are not claims of implemented packages or deployed models.

## 1. Architecture principles

Kajo is one product with generic cross-domain recommendation, Profile-scoped memory and deliberately separated identity/social/acquisition concerns. It is the first application of an independent Predictive Memory Engine.

Non-negotiable boundaries:

```text
Identity/Auth          != Taste/Profile state
Taste/Profile state    != Social graph
Friendship             != SharedProfile membership
Acquisition telemetry  != recommendation evidence
Mobile presentation    != recommendation logic
Provider schemas       != Kajo domain model
Kajo domain adapter    != reusable prediction computation
External/Synthetic     != native observed Kajo evidence
```

Scale principle:

> **Design stable contracts for one million users; provision infrastructure for measured demand.**

Do not introduce Kafka, Kubernetes, a graph database, many microservices or regional complexity merely because Kajo may later need them. Split deployments only when measured latency, throughput, recovery, cost or isolation requires it. Logical engine separation is established through contracts without requiring a separate network service.

## 2. Repository shape

Kajo remains a monorepo while one product/team benefits from shared contracts and simple deployment.

Current/target shape:

```text
kajo/
├── apps/
│   ├── mobile/                  # React Native + Expo
│   └── web/                     # create only when Taste web implementation begins
├── services/
│   └── prediction/              # only when a separate serving deployment is justified
├── supabase/
│   ├── migrations/
│   └── functions/
├── packages/                    # executable reusable contracts/core when E1 begins
├── scripts/                     # bounded research/operational tools when implemented
├── docs/
└── .github/
```

Do not create empty folders to match this diagram. E1 may create an actual tested engine-contract package; it does not force an immediate SQL-to-service rewrite. CODEMAP lists real code paths, not every conceptual module in the target design.

## 3. Clients

### Mobile

Primary stack:

- React Native,
- Expo,
- TypeScript,
- Expo Router,
- gesture/animation tooling where justified.

The mobile client owns presentation, local cache/outbox and interaction state. It does **not** own recommendation truth, Friend authorization or SharedProfile membership rules.

### Taste web entry

The first public launch requires a browser-capable Taste route so a shared/ad link does not require app installation before value is visible.

The web client is intentionally narrow:

```text
link resolution
→ anonymous TasteSession
→ adaptive questions
→ holdout challenge
→ recommendation preview
→ Google/Apple continuation
→ app/store continuation
```

It must reuse canonical backend contracts rather than implement a second recommendation system.

If the installed app receives the equivalent Universal/App Link, it may render the same logical flow natively. The server-owned TasteSession/identity state is canonical across surfaces.

## 4. Identity architecture

### Permanent identity

One canonical Kajo `User` may have one or more linked auth identities. Production launch supports Google and Sign in with Apple; email/password may remain supported.

Provider linking must not create duplicate Kajo Users or PersonalProfiles.

### Anonymous Taste identity

Taste Test starts without an account wall. Kajo therefore needs a server-backed anonymous identity/session boundary.

Conceptual model:

```text
AnonymousIdentity
  └── PersonalProfile-compatible taste state
       └── TasteSession(s)

AnonymousIdentity
  ── authenticated upgrade/link ──>
User
  └── same logical PersonalProfile/taste state
```

Implementation may use Supabase anonymous auth or an equivalent explicit Kajo boundary. The invariant is continuity, not a specific provider feature.

Requirements:

- stable server identity during the retained Taste lifecycle,
- no duplicate PersonalProfile on conversion,
- safe handling when the auth provider already belongs to an existing User,
- failed/abandoned auth retains resumable Taste progress inside retention limits,
- abandoned anonymous identities expire automatically,
- raw auth/invite tokens never enter analytics/log payloads.

Existing email confirmation/recovery flows remain valid for email/password identity. Social auth becomes the primary low-friction launch continuation.

External dataset people are release-scoped research Subjects, not anonymous identities or Kajo Users. Do not manufacture accounts to reuse native event ingestion.

## 5. Acquisition architecture

Acquisition is a first-class operational domain but not a recommendation domain.

Conceptual entities:

```text
TasteSession
TasteResponse
TasteChallenge
AcquisitionAttribution
FriendInvite
```

### Link classes

Keep separate server semantics for:

1. public/reusable Taste/campaign link,
2. personal Friend invite,
3. SharedProfile membership invite.

A public Taste link carries no Friend/Shared authorization. A Friend invite may resolve the inviter after authorization but grants no Friendship until explicit acceptance. A SharedProfile invite remains membership-specific.

Tokens are opaque, expiring/revocable where appropriate, rate-limited and replay-safe.

## 6. Social architecture

### Friendship

`Friendship` is a lightweight reciprocal relationship between two permanent Users.

It provides:

- canonical Friends listing,
- a convenient source for SharedProfile creation/invitation,
- later optional social discovery features.

It does **not** provide:

- PersonalProfile Event/Memory access,
- automatic SharedProfile membership,
- implicit message/history access.

### SharedProfile

SharedProfile remains the learned joint recommendation target. Existing `ProfileMember`, Endorsement, Lists, Shared Saved consensus and Profile messaging rules remain canonical.

Canonical path:

```text
Friendship
→ explicit create yhteinen Kajo
→ SharedProfile
→ accepted ProfileMember lifecycle
→ joint Prediction/Memory
```

Friend removal and Shared membership are independent lifecycle operations.

## 7. Canonical data/backend

MVP backend direction remains:

- Supabase,
- PostgreSQL,
- Auth,
- migrations committed to Git,
- server-owned RPC/function boundaries,
- transparent SQL serving while volume/model complexity remains suitable,
- pgvector/ANN only after real licensed embeddings plus measured need.

Presentation components do not scatter direct database access. Use typed service/data boundaries.

Production clients contain only publishable/public configuration. Service-role credentials, database passwords and provider secrets remain server-only. The reusable computation core receives authorized/versioned inputs and injected storage/time/randomness ports, not auth tokens or provider clients.

The external-data workspace is separate from the production transactional database and has no production write credentials. Its batch jobs and learned artifacts have their own manifests, lifecycle and admission checks.

## 8. Event and command reliability

Recommendation evidence is append-only and actor/Profile separated. Mutable current-state tables are rebuildable/authorized projections.

First-release completion strengthens this with:

```text
explicit user command
→ stable action ID
→ authorized idempotent server boundary
→ atomic current-state + canonical Event commit
→ durable acknowledgement
```

The first release requires a bounded persistent mobile outbox for unacknowledged explicit commands. Process death/retry/account switch may not duplicate or leak actions.

Implementation checkpoint, 2026-09-09 / #224: rating, not-interest and their undo use `commit_item_action_v1` plus a SQLite-backed command outbox. The server patches current state and appends one canonical Event and an immutable receipt in one transaction. Actor/membership checks precede cached replies. A per-Item undo head is invalidated by every legacy projection write; undo restores the server-recorded predecessor instead of accepting a client state snapshot. The public wrapper is SECURITY INVOKER; its private command implementation has explicit authorization and narrowly granted execution. Private receipt/head tables have RLS and no API-role table access.

The mobile outbox persists before optimistic acknowledgement, preserves FIFO through lost replies/restarts and suspends stale actor/Profile/environment scopes. `DATA_EVENTS.md` owns retry/rejection and attribution details. #226 extends the same queue and receipt/head lineage to List lifecycle/membership and Shared Endorsement/consensus through `commit_collection_action_v1`. Collections wait for confirmed receipts; the old whole-state mobile writer and duplicate client mutation Events are removed. Zero-transition receipts need no Event, and List undo corrects every Event of its target command. Pending Endorsement withdrawal/List deletion cancels the original outcome evidence without impersonating the affected member. The exposure-only `EventTrackingContext.tsx` queue remains in memory. Full `MVP-DATA-003` (ROADMAP 14.1), device process-death acceptance and complete delivered-slate provenance remain open; rollout and CI state are recorded in the corresponding PR/Issue and Sprint 014.

Recommendation delivery origin is frozen truthfully. A cached Item from another Profile/mode/run cannot inherit a hosted `predictionId`.

The inspected main baseline still has fallback lookups across remembered runs in `predictionRankingCache.ts` without a Profile filter. Exact Profile/run/slate retrieval and overlay provenance remain release requirements under `MVP-DATA-004`; active #228/#229 source corrections are not accepted main by implication. Follow STATUS for the actual code/deployment/device gates.

Growth/acquisition telemetry has separate semantics and retention. Analytics failure must not roll back auth, Friendship, Taste or SharedProfile state. External research and synthetic observations use separate typed records, not new native Event variants introduced by this documentation change.

## 9. Catalog architecture

External providers are adapters, never parallel domain models.

```text
provider snapshots/API
→ validate / normalize
→ ItemSource + ItemExternalId
→ canonical Item
→ normalized versioned features
→ Kajo search/candidate generation
```

Normal discovery/search serves persisted Kajo catalog data rather than requiring live external calls per card.

`catalog-import` is a server-only administrative boundary. Its source configuration
explicitly sets `verify_jwt=false`; the handler independently matches the `apikey`
header against configured modern secret keys (named platform keys or the singular
local key). An exact configured legacy `service_role` key may also arrive as Bearer
during migration. A key prefix or JWT role claim alone never authorizes import.
Malformed key configuration fails closed, and the matched server credential scopes
the admin RPC without forwarding any caller user JWT. Explicit invalid parameters
are rejected before provider access; at most three pages within 1–500 are imported.

The checked-in SDK versions and Deno lock define the Edge source dependency graph.
Local HTTP fixtures run the registered deployment handlers and real SDK, while
provider/Data API responses are simulated. Hosted configuration, key provisioning,
provider imports and device catalog quality require separately recorded acceptance.

Requirements before release:

- useful BOOK/MOVIE breadth,
- repeatable bounded refresh,
- external-ID deduplication,
- provenance/attribution/licensing records,
- legal imagery path,
- normalized shared feature mapping,
- provider outage tolerance.

Research object-feature enrichment is a distinct input path. Admission requires validated canonical ID mapping, explicit score/encoder version, coverage, source rights and temporal availability. A public rating dataset does not grant image/metadata rights from every linked provider. Unmapped research objects remain unmapped rather than forcing fuzzy catalog merges.

## 10. Prediction architecture

Stable Kajo request:

```text
Profile + authorized actor + Context + DiscoveryMode
→ Kajo DomainAdapter
→ bounded eligible candidate and memory retrieval
→ versioned feature/state assembly
→ outcome/ranking estimates
→ policy/slate builder + hard constraints
→ atomic frozen PredictionRun + complete PredictionCandidates
→ delivered slate
```

The independent engine's full cycle and modules are in [PREDICTIVE_MEMORY_ENGINE](PREDICTIVE_MEMORY_ENGINE.md). The Kajo adapter maps Profile to prediction Subject, User to acting identity and Item to Object. It owns domain targets/rewards, provider feature normalization and trusted constraints; the reusable core does not know BOOK/MOVIE, UI components or authentication implementation.

Current V0/V1 SQL boundaries remain valid while appropriate. Only the accepted public serving boundary is exposed to clients; private baselines/workers remain private. A future service or package may replace a component only after behavior/parity and admission tests, not by duplicating the whole scorer independently. No transport/language choice is made mandatory by portability.

### Online state

Existing Kajo layers remain:

- `WorkingState`: ordered session intent; reconstructed/cached.
- `ShortTermState`: recent versioned projection.
- `LongTermState`: durable versioned projection.
- `ScenarioMemory`: similar same-Profile historical episodes.
- future native `PopulationMemory`: privacy-gated aggregate/collaborative layer.

The target adds explicit `BeliefState`, `WorldState` and `GroupState` composition without falsely declaring separate implemented tables. World trends are not durable personal taste. Unsupported probability/uncertainty outputs remain unavailable rather than fabricated.

Taste/import evidence initializes PersonalProfile state with explicit provenance and fades/supersedes behind native evidence according to versioned rules. A later admitted `ExternalTastePrior` is separately licensed, bounded and ablated; it is neither the existing catalog ColdStartPrior nor native PopulationMemory.

### Candidate/serving requirements

- bounded authorized eligibility/filtering and retrieval,
- candidate union/refill after suppression,
- stable pagination/cursor semantics and separate immutable page records,
- shared normalized features across domains with transfer reliability,
- one scoring/policy contract for serving/shadow parity,
- decision-time feature/encoder/index/model versions and information cutoff,
- complete frozen trace before correlated learning,
- horizon/observability semantics before introducing probability heads.

Authorization/source/time scope constrains memory search before nearest-neighbor selection and again at materialization. The query cannot contain its own future Outcome/After/Error. Frozen predictions remain historical records even though their estimates were computed by a model.

## 11. Taste Test architecture

Taste Test uses the production recommendation feature/state concepts, not a disconnected quiz model.

Conceptual loop:

```text
TasteSession state
→ choose recognizable + informative real Item
→ collect canonical TasteResponse
→ update bootstrap PersonalProfile state
→ repeat until stop/confidence/fail-open
```

Initial question selection may be deterministic/heuristic and inspectable. Learned active selection is introduced only when measured evidence shows improvement. An external offline cold-start benchmark does not substitute for Kajo first-session usefulness.

### Holdout challenge

Challenge must be leakage-safe:

```text
freeze taste/state snapshot
→ freeze model/policy/features
→ persist predicted value for held-out known Item
→ collect actual rating
→ compute documented error/hit metric
→ only then add response to future taste state
```

User-facing accuracy cannot be generated from answers already seen by the model, including through a fitted prior, prototype or preprocessing statistic.

### Recommendation preview

Preview uses the same canonical production ranking boundary as the authenticated product. It is a small delivery surface, not a separate teaser algorithm.

## 12. Shared prediction

SharedProfile remains one Prediction target.

Current common-fit architecture combines:

- direct Shared evidence/state,
- same-Shared ScenarioMemory,
- bounded aggregate accepted-member Personal fit,
- minimum/consensus lift,
- disagreement penalty,
- neutral sparse prior.

Personal raw evidence is not copied into Shared history/explanations. Friend status alone never enters this private evidence path. Membership changes invalidate dependent aggregates/caches while retaining truthful historical consensus. External movie ratings cannot establish joint-group outcomes.

## 13. SleepLayer / evolution architecture

Online serving never mutates/promotes its own model.

```text
PredictionRun + frozen state + candidates
→ prospective shadow/replay
→ wait for mature actual Outcomes
→ leakage-safe evaluation
→ Challenger vs Champion report
→ explicit canary/A/B decision
→ reversible PolicyAssignment
```

MVP requires an operating bounded/retry-safe evaluator and manual canary/rollback. Automatic/global promotion remains disabled until a later explicit evidence decision.

WorldModel estimates and PolicyEngine decisions are separate. The future DreamEngine generates bounded hypotheses; it does not prove causal effects or give observed rewards to unseen alternatives. Synthetic/counterfactual scenarios are model assumptions, never rewritten as historical Events/Outcomes. Keep representative real validation and a final untouched test outside evolutionary selection.

## 14. One-million-user scale path

The initial Postgres/Supabase architecture can remain simple while contracts anticipate separation.

Potential later decomposition—only after measured need:

```text
API / auth gateway
candidate retrieval
online Profile feature/state service
ranker/policy service
Prediction trace sink
Event ingestion stream
analytics warehouse
SleepLayer/training workers
image/catalog workers
```

Capacity planning distinguishes:

- registered Users,
- MAU/DAU,
- concurrent sessions,
- predictions/session,
- candidates/prediction,
- Events/action,
- TasteSession conversion volume,
- invite/friend graph volume,
- SharedProfiles/User,
- trace retention,
- shadow/dream multiplier,
- image egress,
- external training/index build resources when actually used.

Do not budget from User count alone. Isolated offline research does not imply a new production microservice.

### Data structures

PostgreSQL remains the default for identity, relationships, Profiles and transactional state. A graph database is not required for a million Friend edges if relational queries/indexes meet measured needs. Vector storage is introduced only for measured retrieval quality/latency benefit.

### Scaling migration rule

A scale migration must preserve:

- stable IDs,
- Profile prediction target,
- actor/Profile evidence separation,
- Taste lineage,
- Friend vs Shared separation,
- model/version/permission traceability,
- deletion lineage,
- authorization semantics.

Infrastructure may change; domain truth must not.

## 15. Caching and device efficiency

Clients cache only bounded authorized presentation data, delivered slates, preferences and pending commands.

Server may maintain invalidatable Profile/model/slate caches. Cache keys include every privacy/behavior dimension needed to prevent cross-Profile or cross-policy leakage. Derived continuation caches expire without deleting historical evidence.

Provider refresh, image enrichment, research training, compaction and SleepLayer work remain outside interaction latency paths. Model/index bundles are compatible and versioned; absent/invalid/withdrawn external artifacts fall back safely.

Backpressure pauses/degrades background learning before harming core serving.

## 16. Production service inventory requirements

Before external beta/public links, every runtime dependency must have:

- service/project/environment identity,
- owner/access/recovery route,
- region and data residency decision,
- secrets/configuration source,
- deployment procedure,
- cost cap/alert,
- monitoring/runbook,
- backup/restore or rebuild story,
- retention/deletion role,
- provider/licensing dependency where relevant.

At minimum inventory covers:

- Supabase Auth/Postgres/Functions,
- mobile/web hosting and routing,
- social auth providers,
- email delivery where supported,
- catalog provider ingestion,
- image delivery/storage/cache,
- background workers/SleepLayer,
- crash/diagnostic/analytics stack,
- build/signing/store infrastructure,
- model/artifact delivery only if admitted into runtime.

Research workspaces and dataset/artifact manifests have separate ownership/access/storage/cost rules. No production credentials or raw external histories belong in their public reports. Do not release with “some server later” placeholders.

## 17. Retention/deletion

Versioned lifecycle rules cover:

- Auth/User identities,
- abandoned AnonymousIdentity/TasteSession data,
- Taste responses/challenges,
- attribution,
- Friend invites/Friendship/block state,
- Personal/Shared Events/state,
- imports,
- Lists/messages,
- Prediction traces/shadows/evaluations,
- logs/analytics,
- caches/device outbox,
- backups,
- learned/prototype/index dependencies and research source/permission withdrawal where relevant.

Deletion propagates into derived state according to lineage and must not be resurrected by restore/worker replay. Evidential decay is not storage deletion. Removing a raw source or setting its runtime weight to zero does not establish removal from a jointly trained/distilled artifact; maintain replacement/retraining lineage.

## 18. Security / abuse

Public Taste/Friend links require:

- unguessable opaque tokens,
- expiration/revocation/use limits,
- rate limits,
- anti-enumeration,
- duplicate/replay protection,
- Friend remove/block rules,
- exact authorization for invite resolution/Shared creation,
- redacted logs,
- bounded anonymous-account creation.

Personal data is private by default. Friendship alone is not an authorization grant to PersonalProfile evidence. Neither embeddings nor anonymized-looking IDs automatically make private history safe to publish. Research imports validate archives/rows and never execute dataset content.

## 19. Release architecture gates

Architecture is ready for broad Taste-link distribution only after:

1. database clean-install/replay strategy is accepted,
2. recommendation evidence is reliable,
3. serving/shadow parity and candidate refill pass,
4. real catalog/features support useful cold start,
5. portable contracts and the bounded external-data report/permission decision are reproducible,
6. adaptive state/policy and Taste Test are validated,
7. anonymous → permanent identity continuity passes,
8. Friend invite/Friendship/Shared creation authorization passes,
9. outbox/telemetry/retention/abuse controls pass,
10. load/failure/restore/rollback drills pass,
11. owner accepts the store/public release.

A losing or unadmitted learned prior stays out of serving and does not require indefinite research. `ROADMAP.md` names the final decision **Share Link Gate**.

## 20. Current implementation-specific boundaries to preserve

Historical implementation details remain discoverable through sprint files, migrations, code and Git history. Current durable behaviors that future changes must preserve include:

- password/nickname resolution stays server-side when email/password auth is used,
- auth callback secrets/session material are not persisted unnecessarily on device,
- `event_sessions`/`events` remain append-only evidence foundations,
- `item_interactions` remains mutable current-state projection, not Event history,
- Shared List/Endorsement consensus writes use authorized server boundaries,
- direct Shared writes cannot forge consensus Saved state,
- Profile messaging persistence is separate from recommendation evidence,
- V1 Prediction traces are server-owned/non-client-readable where private,
- service-role/provider secrets never ship in clients,
- historical deployed migrations are immutable; fresh-install repair uses explicit accepted migration/baseline strategy rather than rewriting history.

See `CODEMAP.md`, active sprint handoff and ADRs for implementation paths/details.

## 21. Incremental portability and research boundary

E1 makes the engine contract executable with Kajo/media and small synthetic non-media fixtures. It does not move production scoring into the mobile app or bypass the trusted server. D1/D2 introduce an isolated external-data adapter and reproducible baselines. E2 may later replace one admitted component behind existing Kajo contracts with parity, fallback and rollback tests.

The complete source proposal is retained separately: transparent state/memory → latent representations → explicit outcome/next-state model → bounded multistep dreams → self-evolving geometry. Each generation needs its own suitable data and acceptance. Movie-only rating accuracy cannot close all of those gates.
