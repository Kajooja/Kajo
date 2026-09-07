# Kajo Architecture

Status: **canonical implemented boundaries + first-release target architecture**  
Architecture decisions: `docs/architecture/decisions/`  
Taste-first decision: ADR-0007

## 1. Architecture principles

Kajo is one product with generic cross-domain recommendation, Profile-scoped memory and deliberately separated identity/social/acquisition concerns.

Non-negotiable boundaries:

```text
Identity/Auth          != Taste/Profile state
Taste/Profile state    != Social graph
Friendship             != SharedProfile membership
Acquisition telemetry  != recommendation evidence
Mobile presentation    != recommendation logic
Provider schemas       != Kajo domain model
```

Scale principle:

> **Design stable contracts for one million users; provision infrastructure for measured demand.**

Do not introduce Kafka, Kubernetes, a graph database, many microservices or regional complexity merely because Kajo may later need them. Split components only when measured latency, throughput, recovery, cost or isolation requires it.

## 2. Repository shape

Kajo remains a monorepo while one product/team benefits from shared contracts and simple deployment.

Current/target shape:

```text
kajo/
├── apps/
│   ├── mobile/                  # React Native + Expo
│   └── web/                     # create only when Taste web implementation begins
├── services/
│   └── prediction/              # create only when Postgres serving no longer suffices
├── supabase/
│   ├── migrations/
│   └── functions/
├── packages/                    # shared contracts/UI only after actual reuse exists
├── scripts/
├── docs/
└── .github/
```

Do not create empty folders to match this diagram.

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

Production clients contain only publishable/public configuration. Service-role credentials, database passwords and provider secrets remain server-only.

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

Mobile maintains a bounded persistent outbox for unacknowledged explicit commands. Process death/retry/account switch may not duplicate or leak actions.

Recommendation delivery origin is frozen truthfully. A cached Item from another Profile/mode/run cannot inherit a hosted `predictionId`.

Growth/acquisition telemetry has separate semantics and retention. Analytics failure must not roll back auth, Friendship, Taste or SharedProfile state.

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

Requirements before release:

- useful BOOK/MOVIE breadth,
- repeatable bounded refresh,
- external-ID deduplication,
- provenance/attribution/licensing records,
- legal imagery path,
- normalized shared feature mapping,
- provider outage tolerance.

## 10. Prediction architecture

Stable conceptual request:

```text
Profile + Context + DiscoveryMode
→ bounded candidate retrieval
→ feature/state assembly
→ ranker
→ policy/slate builder
→ PredictionRun + complete PredictionCandidates
→ delivered slate
```

Current V0/V1 SQL boundaries remain valid while appropriate. Prediction transport may later move to Python/FastAPI without changing the Profile/Item/Event/Prediction contract.

### Online state

- `WorkingState`: ordered session intent; reconstructed/cached.
- `ShortTermState`: recent versioned projection.
- `LongTermState`: durable versioned projection.
- `ScenarioMemory`: similar same-Profile historical episodes.
- future `PopulationMemory`: privacy-gated aggregate/collaborative layer.

Taste/import evidence initializes PersonalProfile state with explicit provenance and fades/supersedes behind native evidence according to versioned rules.

### Candidate/serving requirements

- bounded eligibility/filtering,
- candidate union/refill after suppression,
- stable pagination/cursor semantics,
- shared normalized features across domains,
- one scoring/policy implementation for serving/shadow parity,
- complete versioned trace before correlated learning.

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

Initial question selection may be deterministic/heuristic and inspectable. Learned active selection is introduced only when measured evidence shows improvement.

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

User-facing accuracy cannot be generated from answers already seen by the model.

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

Personal raw evidence is not copied into Shared history/explanations. Friend status alone never enters this private evidence path.

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

Synthetic/counterfactual scenarios are model assumptions, never rewritten as historical Events/Outcomes.

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
- shadow multiplier,
- image egress.

Do not budget from User count alone.

### Data structures

PostgreSQL remains the default for identity, relationships, Profiles and transactional state. A graph database is not required for a million Friend edges if relational queries/indexes meet measured needs. Vector storage is introduced only for measured retrieval quality/latency benefit.

### Scaling migration rule

A scale migration must preserve:

- stable IDs,
- Profile prediction target,
- actor/Profile evidence separation,
- Taste lineage,
- Friend vs Shared separation,
- model/version traceability,
- deletion lineage,
- authorization semantics.

Infrastructure may change; domain truth must not.

## 15. Caching and device efficiency

Clients cache only bounded authorized presentation data, delivered slates, preferences and pending commands.

Server may maintain invalidatable Profile/model/slate caches. Cache keys include every privacy/behavior dimension needed to prevent cross-Profile or cross-policy leakage.

Provider refresh, image enrichment, compaction and SleepLayer work remain outside interaction latency paths.

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
- build/signing/store infrastructure.

Do not release with “some server later” placeholders.

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
- backups.

Deletion propagates into derived state according to lineage and must not be resurrected by restore/worker replay.

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

Personal data is private by default. Friendship alone is not an authorization grant to PersonalProfile evidence.

## 19. Release architecture gates

Architecture is ready for broad Taste-link distribution only after:

1. database clean-install/replay strategy is accepted,
2. recommendation evidence is reliable,
3. serving/shadow parity and candidate refill pass,
4. real catalog/features support useful cold start,
5. adaptive state/policy and Taste Test are validated,
6. anonymous → permanent identity continuity passes,
7. Friend invite/Friendship/Shared creation authorization passes,
8. outbox/telemetry/retention/abuse controls pass,
9. load/failure/restore/rollback drills pass,
10. owner accepts the store/public release.

`ROADMAP.md` names the final decision **Share Link Gate**.

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
