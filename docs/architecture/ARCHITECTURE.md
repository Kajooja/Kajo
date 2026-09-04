# Kajo Architecture

Status: target architecture for MVP development. Implementation folders are created only when needed.

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
- pgvector when vector similarity/scenario memory is introduced

Presentation components should use service/data boundaries, not arbitrary direct Supabase calls.

Configured CI and standalone APK builds read the optional GitHub Actions
repository variables `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If both are absent, the accepted local
mock path remains active. These values are public mobile configuration, but
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
