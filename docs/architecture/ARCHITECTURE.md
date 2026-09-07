# Kajo Architecture

Status: implemented boundaries plus explicitly labelled completion targets. Operational inventory last reviewed against the repository on **2026-09-07**; unverified hosted settings remain open gates.

## Repository model

Use a single monorepo while Kajo is one product/team.

Target shape:

```text
kajo/
├── apps/
│   └── mobile/               # React Native + Expo + TypeScript
├── services/
│   └── prediction/           # Python prediction service when introduced
├── supabase/
│   ├── migrations/
│   └── functions/
├── packages/
│   ├── contracts/            # shared contracts when justified
│   └── ui/                   # shared UI only when justified
├── docs/
└── .github/
```

Do not create empty complexity merely to match this diagram.

## Mobile

Planned stack:

- React Native
- Expo
- TypeScript
- Expo Router
- Reanimated / gesture tooling where needed

Feature-oriented organization is preferred:

```text
apps/mobile/src/features/
├── room/
├── discovery/
├── swipe/
├── profiles/
├── memories/
└── onboarding/
```

Cross-feature primitives may live under `components`, `theme`, `data` or `lib` once real reuse exists.

## Theme architecture

Theme/ambient logic must be centralized rather than hard-coded across Room components.

Conceptually:

```text
RenderedTheme = ProfileTheme + ContentAreaTheme + AmbientPhase
```

`DiscoveryMode` is domain/prediction state. `AmbientPhase` is UI state. Mapping between them is explicit.

## Data/backend

MVP backend direction:

- Supabase
- PostgreSQL
- Auth
- migrations committed to repository
- transparent SQL ScenarioMemory now; pgvector only with licensed embeddings and a measured need

Presentation components should use service/data boundaries, not arbitrary direct Supabase calls.

Configured CI and standalone APK builds read the optional GitHub Actions
repository variables `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If both are absent, the current local
mock path remains active. MVP-OPS-005 requires production builds to fail closed on missing configuration; mock fallback is a development-only facility. These values are public mobile configuration, but
project access tokens, secret/service-role keys and database passwords must
never be stored in repository variables or committed files.

Sprint 006 password authentication has one server-side identifier boundary in
`supabase/functions/password-auth`. The mobile client may submit an email or
nickname, but nickname-to-email resolution stays inside that Edge Function.
The function may use Supabase secret/service-role credentials only in its
hosted environment and must never return the resolved email or privileged key
to the mobile client. Email/nickname existence checks intentionally support the
MVP's explicit user-facing not-found/duplicate messages.

Email confirmation and password recovery first open the public
`auth-callback` Edge Function. The email template passes `{{ .TokenHash }}` and
the fixed `email` or `recovery` type to that HTTPS endpoint. For compatibility,
the callback also maps the earlier `signup` value to Supabase's documented
`email` verification type. The endpoint does not consume the token: it carries
the token in both the Android intent path and query string (and uses the
`kajo://` scheme on other clients) before routing to `auth/confirm` or
`auth/recovery`. Only the mobile client verifies the token hash, so mail
scanners and tracking redirects cannot invalidate the link.

The native router has explicit token-path routes under both auth callbacks in
addition to the URL rewrite. If an Android launch reaches Expo Router before
the rewrite is applied, `/auth/confirm/:token` and `/auth/recovery/:token`
still resolve to the same verification screens instead of the unmatched-route
fallback. The Android callback intent foregrounds and clears to Kajo's existing
task, and the callback actions clear the callback route stack before returning
to signed-out login. This prevents the visible return action from dropping the
user back into the email application's task.

Auth callbacks use a non-persisting Supabase client. Signup verification shows
an explicit success state and returns to signed-out login. Recovery keeps its
temporary session credentials in memory only, opens the native new-password
form, updates the password, discards the temporary session and returns to
signed-out login. An unconfirmed login also offers a server-side resend action
without exposing the resolved account email to the mobile client.

Sprint 007 Event persistence uses append-only `event_sessions` and `events`
tables behind one typed mobile persistence boundary. Authenticated clients have
membership-scoped `SELECT` and `INSERT` only; they cannot update or delete
behavioural evidence. Stable client-generated IDs make retries idempotent with
insert-or-ignore semantics. Current `item_interactions` remains the mutable
UI hydration projection and is intentionally not treated as Event history.

The root-scoped mobile Event tracker creates one session for the active
User/Profile context and persists it lazily before the first queued Event. It
uses stable UUIDv7-compatible client IDs, retries the same rows, deduplicates
meaningful impressions within one recommendation trace and carries the trace
from discovery into Item actions. Current mock ranking receives correlation
IDs for evaluation but remains explicitly separate from Prediction V0.
Interaction undo appends a compensating `ITEM_INTERACTION_UNDONE` Event that
references the original Event ID; it never deletes or rewrites evidence.

Sprint 011 Lists persist through Profile-scoped `item_lists` and
`item_list_entries` behind security-invoker RPC wrappers. RLS and explicit
grants require Profile ownership/accepted membership. One system
`Tallennetut` List projects canonical Saved state; custom List memberships are
orthogonal and never overwrite `item_interactions`. Shared consensus writes
the system projection and the chosen pending custom membership atomically;
direct Shared custom insertion from discovery is denied.
Presentation joins current consumed/rating state instead of copying it into
membership rows.

Personal discovery uses the single-entry `set_item_list_entry` boundary rather
than the legacy bulk destination mutation: one tap adds to one destination and
never silently removes memberships created by earlier actions. Shared discovery
uses `endorse_shared_list_item`: the first actor stores one pending target List
plus Endorsement, and unanimous approval atomically commits the custom membership
and Shared Saved/system-List projection. Direct Shared custom insertion is guarded.
Per-actor recent-List
ordering is presentation state persisted on-device through Expo SQLite-backed
`localStorage`; it is scoped by Profile and does not let one Shared member's UI
ordering rewrite another member's ordering. Personal custom-List addition maps
to current Like state and Personal system addition maps to Like + Saved.

Sprint 012 messaging uses `profile_messages` plus per-User/Profile
`profile_message_read_states` behind four narrow RPCs. Direct authenticated
mutation grants remain closed; membership-checked definer functions implement
retry-safe sending, chronological thread reads and monotonic read cursors while
public wrappers remain security-invoker boundaries. The root-scoped mobile
message provider owns Inbox thread/unread hydration and failed outgoing drafts.
Profile thread UI never reads tables directly. Optional List messages run only
after the List/proposal RPC succeeds and retry with the same message ID, so a
message failure cannot roll back or duplicate List membership.

## Prediction service

Prediction logic belongs outside the mobile UI. Initial implementation may evolve, but the boundary must preserve a stable conceptual request:

```text
Profile + Context + DiscoveryMode -> ranked Items / Predictions
```

Python is the preferred language for the later dedicated prediction service because of ML/data tooling. FastAPI is a likely transport layer when a separate service is necessary.

Sprint 008 Prediction V0 begins as the authenticated Postgres RPC
`public.rank_items_v0`. This is the smallest real server-owned boundary for the
current twelve normalized Items and early Event volume: scoring executes beside
the RLS-protected evidence, avoids shipping personal history to the mobile
client and does not create an otherwise empty service deployment. The function
is `SECURITY INVOKER`, explicitly checks Profile membership, grants execution
only to `authenticated` and returns one response-level `predictionId` with
ranked generic Items and inspectable score components. The transport may move
behind a dedicated Python/FastAPI service once model/tooling or scale requires
it; the conceptual request/response contract must remain stable when that
happens.

Sprint 013 introduces the versioned `public.rank_items_v1` boundary. It keeps
V0 as an internal base scorer, adds same-Profile ScenarioMemory retrieval and
persists the full decision trace in non-client-readable
`private.prediction_runs` and `private.prediction_candidates`. Direct
authenticated execution of V0 is revoked so hosted mobile traffic cannot
bypass trace persistence. V1 returns the same row shape as V0, allowing the
mobile boundary to remain stable while model/policy versions evolve.

The MVP V1 data flow is:

```text
mobile Context + sessionId
  -> rank_items_v1
     -> derive MemoryStateSnapshot from append-only Events
     -> V0 candidate pool
     -> retrieve traced same-Profile Outcomes
     -> ScenarioMemory re-score
     -> persist PredictionRun + all PredictionCandidates
  -> returned slate
  -> meaningful ITEM_IMPRESSION / OPENED / DWELL / actions
  -> correlated delayed Outcome
```

At scale, the boundary separates into candidate retrieval, online feature
store, ranker, policy/slate builder, trace sink and offline evaluation/training.
This decomposition does not change the canonical Profile + Context +
DiscoveryMode request.

### Memory storage strategy

- `WorkingState`: reconstructed/cached per active session.
- `ShortTermState` and `LongTermState`: rebuildable versioned projections from Events; V1 captures a compact JSON snapshot per Prediction.
- `ScenarioMemory`: V1 reconstructs episodes by joining Prediction traces to correlated Events and uses transparent sparse similarity.
- `PopulationMemory`: post-MVP aggregate/embedding service behind privacy and minimum-cohort gates.
- pgvector/ANN is introduced only when learned/licensed embeddings and volume justify it; opaque fake vectors are not an MVP requirement.

### Learning and experimentation separation

Online serving never promotes its own changed weights. Offline evaluation owns
challenger generation, replay and shadow results; experimentation owns guarded
canary/A/B comparison; an explicit model registry promotion changes the
champion. Every transition retains feature/reward/model/policy versions and a
rollback target. See ADR-0005 and `PREDICTION_MODEL.md`.

### SleepLayer target architecture

The SleepLayer consumes immutable Prediction traces and matured Outcomes through
a background worker, never through the mobile request latency path.

```text
PredictionRun + frozen MemoryStateSnapshot + candidate pool
  -> N prospective ShadowPredictions / strict as-of replays
  -> wait for domain-specific Outcome maturity
  -> comparable-episode scoring + coverage
  -> global / cohort / Profile GenomeEvaluation
  -> candidate recommendation
  -> canary/A/B approval
  -> versioned PolicyAssignment
```

Assignment resolution is Profile -> eligible cohort -> global fallback. One
SharedProfile may earn its own Champion, but never inherits a member's Personal
assignment implicitly. MVP keeps automatic promotion disabled.

The eventual background service owns `PredictorGenome`, shadow,
`EvaluationWindow`, evaluation, promotion and assignment persistence. Those
tables are not created speculatively in Sprint 013A; the PredictionRun evidence
spine lands first so the worker has trustworthy inputs when implemented.

## External content

External providers are adapters/data sources, not the Kajo domain model. TMDB/Open Library or future sources must be normalized into Kajo `Item` representations.

## Observability and learning

Every recommendation intended for learning should be traceable through `predictionId` into Event outcomes.

Monitor trace completeness, unknown hosted prediction IDs, candidate/exposure
mismatches, outcome delay, Scenario support/influence, fallback rate, model
version traffic, latency and trace storage growth. Engagement-only gains are
not sufficient promotion evidence.

## Security/privacy

- No secrets in repository.
- `.env.example` documents required configuration only.
- Access to personal/shared data must follow profile membership/authorization rules.
- Location/demographic/context data should be minimized and permission-aware.
- Prediction Context is server-sanitized to an allowlist before internal trace
  persistence.
- Internal Prediction traces are not granted to `anon` or `authenticated`;
  user export/deletion is implemented through an explicit audited boundary.
- Population learning is blocked until purpose, retention, deletion lineage,
  cohort privacy and legal basis are documented.


## MVP production service inventory

This is the canonical inventory for `MVP-OPS-001..005`, not proof that all services are provisioned. Current observed project: Supabase `mwrnvfosrzwygrunrltm`. Its production designation, plan, region and backup settings must be verified before external beta. Do not assume the current development/test project is the final production environment or copy real user data into tests.

The target keeps one Supabase/PostgreSQL backend and server-side Edge/admin workers. A separate Python server, Redis, vector database, Kubernetes cluster or permanent application web server is not required by the present MVP. Add a service only through an ADR with a measured need, operating cost and owner.

| Service / storage | MVP purpose and target | Current evidence / completion work |
|---|---|---|
| GitHub `Kajooja/Kajo` + Actions | Source, migrations, CI, reviewed releases | Active; verify protected main/release rules and required checks, add SQL migration/regression gate, dependency/secret scans and recovery access. Actions artifact retention is currently seven days; it is not the permanent store/signing archive. |
| Supabase PostgreSQL | Canonical Items, Auth-linked User/Profile state, Events, Lists/messages, private bootstrap/Prediction/SleepLayer records | Hosted project exists; record actual staging/production IDs, region, plan, capacity, RLS/grants/function versions and migration parity. Use isolated synthetic-data test databases. |
| Supabase Auth + Edge Functions | Login/recovery, catalog ingestion and narrow privileged boundaries | Existing auth/callback/import code; inventory deployed function versions/JWT/auth settings and secret **names**, never values. Configure production redirects, abuse limits, leaked-password protection and linked Google/Apple identities. |
| Scheduled bounded worker | SleepLayer evaluation, expiry/deletion retries and provider refresh | Persistence exists; operating scheduler is not evidenced. Prefer a Supabase-hosted scheduled invocation of bounded private work if available on the chosen plan; document exact scheduler/identity/interval, leases, retry caps, dead-letter path and kill switch. Only choose external worker hosting if measured runtime requires it. |
| Provider metadata and image CDNs | TMDB MOVIE, Open Library BOOK metadata; canonical normalized records in Postgres, provider image URLs | Importers exist; configure TMDB server token, descriptions, recurring refresh and stale-source behavior. Record licensing/attribution/cache permissions before external release. Provider outage cannot be required for normal catalog queries. |
| Device storage | Session credentials, bounded image/catalog caches, preferences and pending commands | SQLite KV/cache facilities exist; durable action outbox is required. Audit OS-backed credential protection, device-backup behavior, per-account cache scoping, sign-out/deletion purge and offline retry; do not claim SQLite alone encrypts data. |
| Object storage | Only required backup/export/model artifacts; future user media excluded | No user-photo bucket is required for MVP. Inventory actual buckets before provisioning. If exports/backups need objects, use private storage with explicit region/access/TTL and separate object backup; no public raw history/imports. Avoid storing uploaded raw CSV when parsed staging suffices. |
| Backup destination and recovery material | Recover DB, required objects, configuration and signing credentials | Verify provider backup coverage and independently recoverable encrypted off-site copy or equivalent recovery arrangement. Record exact destination/account, encryption/key recovery, expiry and restore evidence; a Git clone is not a data backup. |
| Production domain/DNS/SMTP | Verified confirmation/recovery mail and stable callback/support URLs | Provider/domain/region and DNS ownership are not recorded as finalized. Select and configure before external beta; verify sender authentication, delivery/bounces/rate limits and token-redacted logs. Record renewal owner and spend. |
| Public privacy/support/deletion pages | Stable HTTPS information and user help without developer access | Hosting/domain/support address must be chosen and published. Static hosting is sufficient; it stores no raw user history. Record uptime/link checks and support ownership. |
| Error/metric monitoring | Mobile crashes, backend errors, quality, queues, cost/latency alerts | Choose actual service/destination and configure before beta; Supabase operational logs alone do not prove mobile crash monitoring. Redact auth tokens, imports and message content; document log region/retention and alert recipient. |
| Google/Apple developer services | OAuth client registration, signing, store distribution/update | Inventory IDs, account ownership, certificate expiry/recovery and access. Official store distribution and installed-build acceptance remain open; APK is a test artifact. |

For every used row, the 14.7/15.1 implementation record must supply: **owner/account, environment, actual resource ID/URL, region, purpose/data categories, access roles, secret names/location, deployment/configuration source, recurring schedule, retention/deletion behavior, monitoring destination, recurring cost/limit, recovery procedure and evidence date**. Use a verified `not used` with rationale where applicable. No `TBD`/unknown remains at release. User-controlled account registration, paid plan/domain purchase and unavailable credentials are specific owner dependencies; continue other unblocked work while documenting them.

Configuration must be reproducible without committing secrets: version migrations/function code, public environment templates and an exact hosted-setting manifest with value-free secret references. Server-only secrets stay in the selected server secret store/CI secret environment. Protect administrative accounts with MFA and least privilege; record emergency recovery without exposing credentials.

## Data lifecycle and retention gate

These are **planning defaults requiring purpose/provider review and implementation in 14.7**. They are not a claim about current expiry jobs or a blanket legal-compliance determination. A changed duration requires a documented decision before collection under that policy. Store both the source lineage and deletion/rebuild consequences.

| Data / location | Planned retention and deletion behavior | Verification |
|---|---|---|
| Auth identity/session, User/PersonalProfile in Supabase | Account lifetime; account deletion disables access immediately and queues complete removal, target completion within 30 days. Verify session revocation and sensitive access after deletion. | Export/delete linked-provider account, retry partial failure, attempt stale-token access |
| Explicit ratings/consumed/saved/Lists and intentional history | User-controlled account/Profile lifetime; source corrections and deletion propagate to projections and learned state. Retention of an explicit user record is distinct from its decaying predictive weight. | Export completeness, remove/import/undo and rebuild parity |
| Shared membership/Events/Lists/messages | Retain only under documented Shared purpose while the Profile exists. Leave revokes access immediately; account deletion removes private evidence and removes or pseudonymizes actor attribution under the chosen policy while preserving remaining members' lawful joint records. Last-member/Profile deletion has an explicit cleanup path. | Owner/member/former-member/outsider controls; no Personal evidence retained through Shared summaries |
| Raw CSV/file copies and parsed import staging | Raw file: process transiently, no server archive by default. Uncommitted staging: expire after 7 days. Committed source-tagged evidence follows user history; retain only metadata required for correction/removal. | Abandoned-job TTL, repeat import, remove dataset and local temp-file cleanup |
| Behavioral Events, PredictionCandidate/Run, Scenarios and shadow evidence | Proposed rolling 13 months maximum online; use shorter retention where purpose/volume permits. Expiry reconciles linked Outcomes/jobs and preserves user-requested explicit history separately. No dangling or falsely attributable learning records. | Synthetic clock/expiry tests, trace size forecast and scheduled purge evidence |
| Rebuildable memory/feature projections | No independent lifetime beyond permitted source evidence/Profile; invalidate on source deletion, membership change, correction and feature-version change. | Full rebuild versus incremental projection, including after purge |
| Genomes/evaluation/model artifacts | Keep active/rollback version plus the documented audit window; personal artifacts inherit Profile deletion/retention. Population artifacts remain outside MVP. | Artifact dependency/lineage inventory and rollback after source deletion |
| Operational logs/crash payloads | Default 30 days; minimal redacted diagnostic data. Longer security/audit retention needs an explicit purpose and duration. | Token/CSV/message redaction samples, TTL and access check |
| Device outbox/cache and temporary exports | Pending explicit actions retry with visible status until committed or explicitly discarded; never silently expire them as cache. Purge delivered payloads promptly and remove account data on logout/deletion under documented pending-action UX. Export download objects expire within 24 hours. | Process kill, full cache, logout/account switch, lost ACK, export URL expiry |
| Encrypted backups | Target maximum 35-day rolling recovery window, subject to selected provider capability. Restricted recovery use; deletion journal is reapplied after restore before serving users. Do not promise instant selective deletion from immutable backups. | Isolated restore plus deletion replay; verify actual provider expiry and off-site lifecycle |
| Provider payload/images/catalog | Provider terms and refresh/takedown policy determine permitted storage; stable referenced Items may become non-discoverable without breaking history. Remove prohibited payload/image caches through the documented process. | Revoked source/stale URL/duplicate refresh and reference-integrity checks |

The public privacy/account controls must match actual implementation. Export and deletion traverse personal source rows, derived summaries, traces/jobs, local data and service logs where applicable; deletion work is idempotent, observable and retryable. Anonymous aggregation is not assumed merely because emails were removed.

## Operational acceptance and recovery

Record measured evidence in the active sprint/linked Issue, using synthetic accounts and an isolated restore target. Never rehearse destructive recovery on the live user database.

- Planning recovery objectives: **RPO <=24 hours** (maximum acknowledged data loss) and **RTO <=8 hours** (restoration time). Confirm product suitability and provision a plan that demonstrably meets these before beta; tighten if evidence requires. Verify database plus required objects, deployment/configuration, credentials and store-signing recovery. Restore first, replay deletions, validate access/integrity, then reopen service.
- Suggested initial service budgets for a representative 10-concurrent-session beta workload: ranking API p95 <=500 ms server-side and first usable hosted slate p95 <=2 s on the declared reference network/device; explicit-action acknowledgement p95 <=2 s. These are target gates, not current measurements. Record catalog/history size, device/network, sample count, error rate and cold/warm results. Revisit documented budgets before store load increases.
- Monitor trace/delivery mismatch, unknown hosted IDs, unacknowledged action age, worker oldest-job age, retry/dead-letter rate, import freshness/coverage, auth/mail failures, mobile crashes, API latency, DB locks/size and spend. Define alert thresholds, destination, owner and response action; test at least one induced failure per critical path.
- Record deployment and compatibility order: additive migration -> backend function/config -> compatible client -> validation -> traffic. Preserve supported older clients during update; dangerous schema retirement waits for an explicit compatibility decision. Backend rollback may require a forward fix; code rollback does not undo data migrations.
- Maintain working runbooks for provider outage, auth/mail outage, database incident, lost signing/access credentials, leaked secret rotation, stuck worker, bad model canary and failed release. Rehearse model rollback and restore; keep a kill switch for background learning and a known safe scorer.
- Security release verification includes RLS and RPC authorization for all roles, revoked membership/session behavior, request/payload/rate limits, sanitized callback logs, secret scanning, dependency/license review and stable store configuration. Security Advisor output is one input, not a complete audit.

Provider verification references, checked 2026-09-07: [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) and [backup documentation](https://supabase.com/docs/guides/platform/backups). Supabase database backups do not include Storage object contents; verify the chosen plan's actual recovery coverage rather than assuming database restore also restores files.
