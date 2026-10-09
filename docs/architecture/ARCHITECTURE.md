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
├── packages/                    # implemented reusable engine contracts/core
├── scripts/                     # bounded research/operational tools when implemented
├── docs/
└── .github/
```

Do not create empty folders to match this diagram. E1 delivered the tested
`packages/prediction-engine` contract package; D1/D2 delivered isolated research
intake/evaluation. This does not force a SQL-to-service rewrite or admit a serving
model. CODEMAP lists real code paths, not every conceptual target module.

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

This boundary, minimum retention/deletion and abuse controls, and versioned Taste
measurement precede real anonymous Taste acceptance under ROADMAP 15.0. Provider
linking and full browser/app continuity complete under 15.1; full launch operations
remain later gates. Selection/challenge source work can use authorized fixtures
before this runtime exists, without claiming an anonymous launch flow.

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

`apps/mobile/app.config.js` validates before Expo build/export/prebuild, using the
same pure `supabaseConfigPolicy.js` as the runtime connection. Production is the
default; both public settings and a non-loopback HTTPS origin are required.
Publishable keys and legacy JWTs with explicit `anon` role are allowed; secret,
service-role, session, malformed and unknown key shapes are rejected. This is
configuration validation, not verification that an API key is authentic or live.
Explicit `KAJO_BUILD_MODE=demo` is embedded in Expo config; only that identity
permits an unconfigured client. Missing runtime identity fails closed. CI's
standalone release job pins production mode. No key enters error messages.

The password-auth boundary validates a closed action/identifier/password object
before privileged lookup. JSON null/arrays/scalars, unknown fields/actions,
invalid field types and oversized values are rejected. Request reading is bounded
to 8 KiB, 8,192 chunks and five seconds, including absent Content-Length and
invalid UTF-8. Responses are no-store; parser failures expose no submitted text.
Named server-key configuration rejects non-object JSON. Existing account-exists
and not-found semantics remain; distributed abuse limits and their deliberate
enumeration policy still require the separate #160 public-entry acceptance.

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

The mobile outbox persists before optimistic acknowledgement, preserves FIFO through lost replies/restarts and suspends stale actor/Profile/environment scopes. `DATA_EVENTS.md` owns retry/rejection and attribution details. #226 extends the same queue and receipt/head lineage to List lifecycle/membership and Shared Endorsement/consensus through `commit_collection_action_v1`. Collections wait for confirmed receipts; the old whole-state mobile writer and duplicate client mutation Events are removed. Zero-transition receipts need no Event, and List undo corrects every Event of its target command. Pending Endorsement withdrawal/List deletion cancels the original outcome evidence without impersonating the affected member. The #228 draft replaces the memory-only `EventTrackingContext.tsx` queue with immutable Event/session envelopes in SQLite, using the existing bounded outbox with a separate environment/actor/Profile identity. Replay retains the original session; deduplication follows durable acceptance. Exposure and explicit commands drain separately, but both Item and collection dispatch now check persisted matching impressions first. Correlated commands wait for their original actor/Profile/session/prediction/Item impression acknowledgement; normal exposure waiting stays pending without publishing a persistence error or prematurely settling collection callers; missing exposure is not invented and retrospective late-outcome reconciliation remains open. Full `MVP-DATA-003` (ROADMAP 14.1), device process-death acceptance and complete delivered-slate provenance remain open; rollout and CI state are recorded in the corresponding PR/Issue and Sprint 014.

The #228 List correction extends the existing private resurfacing decision with active Profile-scoped List membership and entry age. Collection receipts invalidate mobile grid ranking identity even if interaction projection fields are unchanged. The correction preserves function identity/ACLs, historical evidence and Shared consensus boundaries. The exact server forward is deployed; mobile/device acceptance remains pending (STATUS owns rollout evidence).

Recommendation delivery origin is frozen truthfully. A cached Item from another Profile/mode/run cannot inherit a hosted `predictionId`.

The inspected accepted-main runtime baseline (`6dd1fec`) has fallback lookups across remembered runs in `predictionRankingCache.ts` without a Profile filter. Exact Profile/run/slate retrieval and overlay provenance remain release requirements under `MVP-DATA-004`; active #228/#229 source corrections are not accepted main by implication. Follow STATUS for the actual code/deployment/device gates.

The active #228/#229 source replaces detail latest-pool guessing with a bounded, scope/session-checked delivered snapshot. Per-Item Shared tiers are frozen; injected pending/member-history Items cannot borrow the ranking Prediction. Detail actions and dwell use the captured descriptor, while live consensus controls remain current. Dwell retains its start-time recording callback. A client-only origin session/Item guard rejects stale Event/action admission; action dispatch and result projection invalidate at layout-time session changes. Lists/Shared async completion tokens expire on session changes and unmount, and destination loading/saving is specific to the current open request. Full `MVP-DATA-004` acceptance still requires late-outcome rollout and representative async/session runtime verification; this client snapshot does not replace server trace validation. Visible ranking/cache readiness also needs the separately recorded captured-session acceptance before the prepared identified reader is activated.

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
are rejected before provider access; legacy discovery imports at most three pages
within 1–500. Versioned bucket requests use fixed language/primary-era/genre budgets
and a reviewed release-date cutoff. Exact-IMDb requests resolve at most ten movie
IDs, verify the returned aliases and full metadata, then call one atomic canonical
batch upsert. No title-based identity guess is introduced. Unknown/mixed selection
controls fail before provider access, and older deployments reject the new actions.
Source acceptance and actual hosted rollout are tracked separately in STATUS.

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

### Offline shared-concept audit — #269

`scripts/catalog/item-features.mjs` defines `catalog-concepts-v1`: six shared
concepts (fantasy, horror, mystery, romance, science fiction and thriller), with
six exact TMDB genre IDs and 28 reviewed Open Library subject labels. Labels
receive only case/whitespace normalization; the registry never infers from
descriptions, acquisition buckets, people, places, popularity or current tags.
The registry cites the provider documentation and subject pages consulted on
September 24. [TMDB](https://developer.themoviedb.org/reference/genre-movie-list)
declares genres; [Open Library subjects](https://openlibrary.org/dev/docs/api/subjects)
are topics and can include books *about* a genre. These assertions retain
`provider-genre` or `provider-subject` evidence and unknown transfer reliability.
A positive concept is `1` once per Item, regardless of duplicate/synonymous
labels; every unasserted or unavailable concept is `null`, never a dislike or
known absence. Drama/plays, history/documentary and comics/animation are not
assumed equivalent.

Run `scripts/catalog/catalog-feature-snapshot.sql` read-only, save its result
outside Git, then run:

```bash
npm run catalog:features -- --snapshot /private/catalog-snapshot.json --out dist/catalog-features/NEW_RUN
```

The SQL allowlists only Item identity/tags/times and provider genre/subject
fields, with exact source-ID/alias checks. The credential-free, network-free
inspector writes private `features.json` and aggregate `coverage.json` to a new
directory. The private artifact retains source positions, rules, row times,
source hashes (including unknown/null), unmatched labels and calculated
`projectionSha256`; that digest is not a full provider-record hash. The report
binds input bytes, canonical snapshot/artifact, mapping version/hash and the
producer source files. `checkedAt` is the observation boundary; neither an old
provider timestamp nor a current source row proves historical availability.
Only the aggregate report may be committed.

The [September 24 aggregate](../project/catalog-feature-coverage-2026-09-24.json)
was reproduced byte-for-byte from the actual 840-Item snapshot. At least one
supported concept is available for 244/415 BOOKs and 280/425 MOVIEs, with zero
identity mismatches. Thirty curated-only BOOKs have no supported provider
projection. On 171 BOOKs, at least one asserted concept has no matching
source-label slug in the current Item tags (231 concepts across those Items).
This measures tag omission, without establishing its cause or claiming broad
feature quality. The remaining 171 BOOKs and 145 MOVIEs lack these six supported
concepts; they are not classified as negative examples.

This packet supplies inspectable feature candidates and coverage only. It does
not change `public.items.tags`, native memory/ranking, #229 frozen replay,
DomainAdapter inputs or trained models. Serving admission still needs bounded
transfer/reliability, historical feature freezing and comparative quality
evidence; `MVP-ALG-005` remains open.

### Offline canonical bootstrap sensitivity — #273

`catalog:features:baseline` connects the #269 projection to an isolated fixture
of the actual Personal bootstrap SQL. A frozen protocol compares legacy tags,
source-kind concepts already represented in tags, and the full audited concept
projection on the same catalog and at most 24 synthetic anchor profiles. It
records top-50 entry/exit and conditional score/rank/contribution changes; this
is computational sensitivity, not accuracy or user-benefit evidence. Anchors
deliberately prefer missing BOOK concepts and can repeat whole Items.

Application SQL bodies remain unmodified; only the disposable PGlite fixture's
clock is replaced at a pinned instant at/after source observation. Source,
mapping, plan, code/runtime and output hashes make the private run reproducible.
Missing concepts remain absent, while topic/genre keys remain separate. No
native Events, actual people, training, production tags or model admission are
introduced. V1 Scenario/Shared behavior and serving-shadow parity are outside
this base-scorer diagnostic. The [protocol and report](../../research/reports/catalog-feature-baseline-273.md)
own exact experimental limits; Phase 14.3 and MVP-ALG-005 remain open.

### BOOK description enrichment — guarded contract, #182

The guarded writer supports `open-library-description-v1` and the attributed
`open-library-description-v2` contract below. Both hosted forwards are installed.
Source-specific permission review, guarded apply/readback and native usefulness
are separate gates; [STATUS](../project/STATUS.md) owns the current approvals and
write state. The [Sprint 014 pilot](../project/sprints/SPRINT-014.md#book-description-plan--2026-09-13--182)
owns the fixed ten candidates and call budget; the
[implementation checkpoint](../project/sprints/SPRINT-014.md#book-description-implementation--2026-09-14--182)
owns executable review/apply/verification steps.

Identity comes from the existing `open_library` source and matching
`open_library_work` alias on the same Item. `metadata.openLibraryWorkId` is a
checked mirror. The selected `displayEditionKey` is a lookup hint until an exact
Edition response links back to that Work. Reject a different response key,
redirect, multiple/different Work linkage or alias collision; never follow an
identity redirect silently or match by display title. After object/key/type
validation, an own `location` field is allowed only when it is the exact expected
canonical path string; absent location is also allowed. Foreign, null and
non-string locations remain identity failures. A `/type/redirect` record fails
the type check even when its location points to itself. The upstream
[Work redirect-chain implementation](https://github.com/internetarchive/openlibrary/blob/master/openlibrary/core/models.py)
follows `location` only for `/type/redirect`; this supports keeping redirect type
separate from a normal record's self-location, without inferring why the field
was supplied. A curated Item without a provider alias requires a separately
reviewed exact mapping before enrichment.

Only the provider's `description` field is eligible. Accept a string or a
`{type: '/type/text', value: string}` block; null/absent/blank means missing.
Reject other types instead of stringifying them. Normalize Unicode to NFC,
line endings, control characters and whitespace; retain paragraph boundaries.
Bound incoming text to 32 KiB UTF-8 and normalized display text to 80–2,000
Unicode code points. Oversize, short, markup-bearing or URL-only text is staged
for review, not silently truncated/rendered. Never substitute bibliographic
`notes`, excerpts, first sentences, reviews or generated/translated summaries.
These bounds are Kajo's versioned selection policy, not provider guarantees.

Fetch the exact selected Edition first. The preview stops for review after ten
Edition lookups; the separate fallback step fetches only Works whose Edition
description was rejected with a hash-bound reason. Prefer its usable description when the
text is verified as Finnish or English; otherwise inspect the exact Work's
description as fallback. Preserve the selected title/cover/Edition regardless
of fallback. Edition language, available translation languages, description
language and original language are separate facts. A Finnish Edition does not
prove its description is Finnish. Initial text-language/fitness review is
explicit; unknown language stays unknown and is excluded from this pilot's
display writes. Do not infer or overwrite `original_language`.

`metadata.descriptionProvenance` records contract version, provider, Work and
chosen record keys, field path, source URL/revision/modified time when supplied,
fetch time, raw-record SHA-256, normalized-text SHA-256, verified text language
and review/fallback reason. A missing provider revision/time remains null.
Keep the existing private source payload intact and append only a versioned
`descriptionEnrichment` envelope containing both record references/hashes and
review outcome. Public provenance excludes raw records, personal reviewer
identifiers and credentials. Raw records/description text stay out of Git.

The legacy full-replacement upsert is insufficient for a description patch.
An opt-in overload of the existing generic batch boundary,
`upsert_catalog_batch_v1(entries jsonb, refresh_mode text)`, **without a default
for the second argument**, accepts this mode. A top-level mode makes the request fail on an older
server; an extra JSON entry property alone would currently be silently ignored.
The existing one-argument contract remains. Accept only the declared description
mode, max ten entries, exact expected Item/source identities and expected current
Item/source versions. Lock Items then sources in deterministic identity order,
recheck aliases/lifecycle/versions under the locks, and merge only description,
its provenance and its source envelope through the canonical Item writer's narrow
`upsert_catalog_item_v1(entry jsonb, refresh_mode text)` overload. It also validates
and locks when called directly. The legacy 17-argument Item signature would sort
existing arrays and trim display fields; the narrow overload updates only the
three managed fields plus automatic row timestamps. Source URL/hash/upstream
time/sync time still describe the preserved original import. Perform provider
calls before this short transaction.

Preserve UUIDs, creation times, all aliases, title, cover, creators, tags, years,
language, popularity and unrelated metadata/source fields. Missing/invalid text
never clears an existing description. Equal text, source revision and review/
policy identity is a no-op; a new fetch timestamp alone does not force a rewrite.
Version mismatch rejects mutations; already-applied identical content can return
a read-only no-op after identity verification. Changed text is an explicit
guarded refresh. Existing full BOOK writers reject refreshes of Items with managed
provenance/envelopes under the Item lock; Search Work and dump Edition alias
replays are tested. Unmanaged legacy imports keep their existing behavior.
No new catalog, account, Event, model or general
admin endpoint is introduced. Use an incremental catalog migration, not edits
to deployed history or the separate six native forwards. All catalog writer
signatures remain service-role-only and SECURITY INVOKER with an empty search
path. The catalog migration requests a PostgREST schema-cache reload; real named
argument resolution, old-server rejection and anonymous denial join native CI.

Persist starting/prepared/reviewed/completed/failed checkpoints. Count actual
provider attempts separately from accepted/skipped candidates and acknowledged
writes. A 404 or missing description is an explicit sparse result; malformed
identity/JSON, 429, 5xx, timeout or connection failure stops collection. No
automatic retry or replacement candidate. An ambiguous database acknowledgement
is an unknown write outcome: read back exact IDs/text hashes/versions before
resuming, never assume rollback or refund the consumed budget. Provider-only
preview needs no database credential. The review artifact's hashes and current
database versions must still match at the eventual apply step.

`amend-review` changes a reviewed local packet only before any database batch
attempt. A versioned proposal binds `digest(state.review)`, gives an explicit
reason and supplies all ten decisions plus a non-older SQL baseline. The command
re-inspects every cached Edition/Work, including skipped Works, and reconciles
each record with the existing attempt ledger. It retains complete prior reviews
and baselines in `reviewHistory`, links each successor to its parent's hash and
atomically saves the new review under the existing operation lock. Apply and
readback also validate the amendment chain. No provider call, budget refund,
claim replacement, failed-run recovery or write retry is implicit. Structural
validation does not establish copyright permission or waive attribution.

The official [API usage guidance](https://openlibrary.org/developers/api) was
checked on 2026-09-13: cache and identify requests; the default limit is one
request/second, while identified requests with contact details receive a higher
limit. Do not fan out hundreds of single-book requests. The small pilot uses
sequential requests at least 1,100 ms apart; broader enrichment uses the
[monthly Work/Edition dumps](https://openlibrary.org/developers/dumps), pinned by
release and hashes. Dump records include revision and modified time, so the same
normalization/provenance contract can be reused without rerunning popularity
selection or ingesting external people's ratings.

The offline `catalog:book-descriptions:dump` intake stages exact existing Work and
selected Edition records from two local files of the same dated release. Its
read-only target snapshot checks source/alias/mirror identity and freezes row
versions; existing or managed descriptions are excluded. `plan` validates this
snapshot without opening dumps. `stage` requires explicit publisher URLs, full
file SHA-256 values, byte lengths, compression and decoded-byte/row limits. It
streams both files to EOF, checks gzip integrity and hashes, rejects duplicate or
conflicting target records and reconciles dump envelopes with their JSON. Missing
records and rejected text remain counted results. The existing strict description
policy is reused; legacy ratings-based selection and `notes` normalization are not.

Intake is bounded to 385 snapshot Items, 1,049,600 bytes per line and 64 MiB of
retained raw records. Each run exclusively claims a new direct child of ignored
`dist/catalog-enrichment/`, with private files and a failed/staged checkpoint.
Only after complete input verification does it publish candidates for review.
Their language, fallback choice, rights and attribution start unreviewed; Edition
language proves none of those facts. The output is not an apply packet and cannot
be passed into the fixed ten-Item pilot. Intake has no network/database client,
does not reset old attempt budgets and never imports ratings or creates aliases.
Source-specific review and a separately bounded guarded application remain
necessary after staging; implementation/fixture success is not real dump execution.

Example local commands (the source manifest pins actual files, never `latest`):

```bash
npm run catalog:book-descriptions:dump -- plan --targets SNAPSHOT.json
npm run catalog:book-descriptions:dump -- stage --targets SNAPSHOT.json --manifest SOURCE.json \
  --works LOCAL_WORKS.txt.gz --editions LOCAL_EDITIONS.txt.gz --out dist/catalog-enrichment/NEW_RUN
```

`scripts/catalog/book-description-dump-targets.sql` produces `SNAPSHOT.json` via
read-only SQL. `SOURCE.json` has contract
`open-library-description-dump-source-v1`, `release` (`YYYY-MM-DD`), `retrievedAt`
and `sources.works` / `sources.editions`; each source supplies `url`, `sha256`,
`bytes`, `compression` (`gzip` or `none`), `maxDecodedBytes` and `maxRows`.
File acquisition is separate; the intake does not download multi-gigabyte dumps
or infer hashes from publisher names. Preserve its completed private run together
with the pinned source manifest before later review.

The separate `catalog-book-dump-acquisition.yml` workflow can acquire the fixed
**2026-08-31** release in GitHub's runtime when the local publisher connection is
unavailable. This is one explicitly activated catalog request, not a scheduled
import. It uses only public Work/Edition pairs, downloads no rating histories and
has no database credentials or writes. The source collector validates publisher
metadata and complete file checksums while streaming both compressed files;
only selected raw records are retained in memory. The public request declares
all byte/row/time caps. In addition to those limits, the job is bounded to
120 minutes and the requested collector to 110 minutes.

Merge the workflow and collector to main before activation. The sole trigger is
the exact branch `catalog-acquisition/ol-20260831` adding
`scripts/catalog/requests/ol-20260831.json`. The runner checks out current main,
disables persistent Git credentials and accepts only one child commit of that
exact source, with that request as its sole added file. It validates the request's
canonical digest, roster, limits and recipient fingerprint before source access.
Pinned third-party Actions use read-only contents/actions permissions. No
production credentials, request-branch code or package lifecycle scripts run.
`run_attempt` must be 1, and any earlier workflow run on that request branch
consumes the request, including a preflight failure. The workflow has no dispatch,
automatic retry or reset path. A failure requires reconciling the retained
accounting and separately reviewing any future request and cumulative budget.

Prepare custody locally, before publishing the request:

```bash
node scripts/catalog/prepare-dump-acquisition-request.mjs keys --out NEW_PRIVATE_KEY_DIRECTORY
node scripts/catalog/prepare-dump-acquisition-request.mjs request \
  --snapshot PRIVATE_TARGET_SNAPSHOT.json --source-head ACCEPTED_CURRENT_MAIN_SHA \
  --key-dir PRIVATE_KEY_DIRECTORY --out PUBLIC_REQUEST.json
```

Durably retain the private key and private catalog snapshot before activation.
The public request contains no Item/source UUIDs, versions, raw text or private
key. The runner encrypts its result with a random AES-256-GCM key wrapped using
the recipient's RSA-3072 key and RSA-OAEP-SHA256. Authenticated envelope fields
bind the exact request, recipient, source, roster and plaintext hash. Only this
ciphertext is uploaded; no raw selected records reach artifacts or logs. On a
source failure, the step remains failed and may upload an encrypted failure
receipt containing actual partial byte/request counts. Preflight failures that
cannot validate the recipient produce no artifact. Public error messages are
fixed codes. Ordinary CI uses synthetic streams and never downloads the dumps.
Complete metadata response bytes, URLs, SHA-256 and known validation failures
are retained inside the encrypted receipt before decoding or source validation;
partial/oversized responses retain accounting only. Neither diagnostic detail
nor publisher text is printed in public failure logs.

After downloading the single sealed JSON from its artifact, recover locally:

```bash
node scripts/catalog/prepare-dump-acquisition-request.mjs unseal \
  --request PUBLIC_REQUEST.json --key-dir PRIVATE_KEY_DIRECTORY \
  --input open-library-20260831.sealed.json --out NEW_PRIVATE_RESULT_DIRECTORY
```

Recovery verifies authenticated identities, hashes and complete source/roster
bindings; tampering or the wrong key fails closed. A failed receipt remains a
failed result. Encryption authenticates envelope integrity, not the sender:
retain the verified GitHub run/head/request and downloaded artifact ID/SHA-256
receipt, and recover only that run's artifact. Anyone holding the public key
could otherwise produce a different valid encrypted envelope.
A successful collected result still has zero approvals: bind it
to a fresh private catalog snapshot and complete source-specific language/rights
review before designing a separately bounded guarded application. Do not pass
either result into the completed ten-Item pilot or replay that pilot's batches.

The separate `catalog-book-metadata-diagnostic.yml` workflow diagnoses the
consumed acquisition run **35995362978**, whose original receipt retained a
complete metadata hash/count but lost its bytes and precise validation code.
Its distinct `open-library-metadata-diagnostic-request-v1` request is the sole
added file `scripts/catalog/requests/ol-20260831-metadata.json` on one child of
accepted main, on the exact branch `catalog-diagnostic/ol-20260831`. The request
binds the consumed run, source/request commits and canonical request digest,
original Actions artifact ID/ZIP size/SHA-256, enclosed sealed JSON SHA-256, and
metadata size/SHA-256. Preparation validates the original public request; the
runner fetches that fixed Git object and requires its same recipient public key.

This is a distinct one-shot metadata budget: at most one official metadata GET,
at most 2 MiB and 30 seconds, with redirects disabled. The core inspection entry
point never opens Work or Edition streams, even when metadata is valid. It
returns complete byte evidence plus the independently revalidated source verdict
or an encrypted partial-transport failure. No roster, catalog snapshot, database
access or approval enters the diagnostic. The runner uses the same accepted-main,
sole-added-request and first-run gates, with a separate workflow-run ledger;
any previous diagnostic run consumes this budget. The earlier full acquisition
remains consumed, and this workflow cannot reset or resume it.

Prepare and recover only on the local private-key custodian:

```bash
node scripts/catalog/prepare-dump-metadata-diagnostic.mjs request \
  --previous-request ORIGINAL_PUBLIC_REQUEST.json --source-head ACCEPTED_CURRENT_MAIN_SHA \
  --out PUBLIC_METADATA_REQUEST.json
node scripts/catalog/prepare-dump-metadata-diagnostic.mjs unseal \
  --request PUBLIC_METADATA_REQUEST.json --key-dir ORIGINAL_PRIVATE_KEY_DIRECTORY \
  --input open-library-metadata-20260831.sealed.json --out NEW_PRIVATE_DIAGNOSTIC_DIRECTORY
```

Only authenticated ciphertext leaves the runner. Recovery writes exact private
evidence and reports `bodyMatchesPrevious`; only an identical complete metadata
SHA-256 can reproduce the original input. A different body diagnoses the current
response and cannot establish the historical failure cause. Verified diagnostic
run/head/request/artifact provenance remains required alongside decryption.
The result has zero approvals, zero dump requests and zero database writes;
neither a valid source verdict nor successful recovery authorizes a full retry.

The separately reviewed `catalog-book-reviewed-acquisition.yml` forward uses
the authenticated diagnosis from run **35998771483**. Its complete metadata body
matches the original response and establishes the size-limit failure: Work is
**4,058,336,593 bytes**, Edition is **12,586,485,055 bytes**, totaling
**16,644,821,648 bytes**. The old 15,000,000,000-byte acquisition limit remains
unchanged. `open-library-reviewed-dump-acquisition-request-v1` freezes this exact
new sum, both publisher MD5/SHA-1/size/URL pins and the prior run/request/artifact
evidence. It permits no wider source budget and performs **zero metadata GETs**.

The new trigger is only `catalog-acquisition/ol-20260831-reviewed`, adding only
`scripts/catalog/requests/ol-20260831-reviewed.json` as one child of accepted
main. Before streaming, the runner fetches both fixed predecessor request Git
objects, checks the original roster and recipient, then verifies the new
workflow's unused one-shot ledger. The original acquisition and diagnostic
branches remain consumed. Full compressed EOF, gzip validity, exact bytes and
both publisher checksums are still mandatory; SHA-256 is calculated from the
actual complete streams. All other parser, retention, official-redirect and
time bounds remain unchanged, including 110 collector minutes and 120 job
minutes. Full dumps never reach disk or artifacts.

Local preparation requires the exact archived diagnostic sealed JSON hash,
decrypts/authenticates it with the original private key, validates its complete
metadata evidence and re-derives the fixed pins before writing a public request:

```bash
node scripts/catalog/prepare-reviewed-dump-acquisition.mjs request \
  --previous-request ORIGINAL_PUBLIC_REQUEST.json --diagnostic-request PUBLIC_METADATA_REQUEST.json \
  --diagnostic-input open-library-metadata-20260831.sealed.json \
  --key-dir ORIGINAL_PRIVATE_KEY_DIRECTORY --source-head ACCEPTED_CURRENT_MAIN_SHA \
  --out PUBLIC_REVIEWED_REQUEST.json
node scripts/catalog/prepare-reviewed-dump-acquisition.mjs unseal \
  --request PUBLIC_REVIEWED_REQUEST.json --key-dir ORIGINAL_PRIVATE_KEY_DIRECTORY \
  --input open-library-reviewed-20260831.sealed.json --out NEW_PRIVATE_RESULT_DIRECTORY
```

Reviewed results bind `sourceEvidence` to the archived diagnosis instead of
claiming a new metadata response; their accounting records zero metadata
requests. Selected records or actual partial failure accounting remain encrypted.
Recovery still requires verified Actions artifact provenance, complete source
and record validation, and reconciliation against the original plus fresh private
catalog snapshot. Source acquisition grants zero approvals and performs no
per-item provider requests, ratings intake or database writes.

The provider's [Work schema](https://github.com/internetarchive/openlibrary-client/blob/master/olclient/schemata/work.schema.json)
and [text-block definition](https://github.com/internetarchive/openlibrary-client/blob/master/olclient/schemata/shared_definitions.json)
describe description/text records. The [licensing page](https://openlibrary.org/developers/licensing)
does not assert new rights over the database and flags possible pre-existing
rights. This is not blanket permission for every blurb or cover. Preserve source
links and review the actual contribution/origin and intended use before display
writes; unknown permission remains staged. Public beta/store rights, attribution
runtime acceptance and withdrawal remain open `MVP-CAT-003` gates. No source documentation check
alone constitutes rights clearance for a record.

### Selected-row failure evidence — #182

The bounded failure-evidence forward keeps the public
`provider-identity-mismatch` code. `scripts/catalog/dump-failure-evidence.mjs`
validates the private object in `accounting.failureEvidence` against the request's
roster, exact canonical source and limits. It records a fixed private
object/key/type/location predicate, source kind, roster hash, expected Work and
Edition identities, dump row and fetch time, plus exact Base64 row bytes, byte
length and SHA-256. Row bytes exclude the LF delimiter but retain CR; `terminated`
distinguishes a row ended by LF from a final EOF row. The diagnostic row is bounded
to 1,049,600 bytes.

New captures use `open-library-selected-row-failure-evidence-v2`. Predicate replay
uses the current ordered object/key/type checks and then
`record-location-mismatch`: only absence or the exact expected canonical path
is accepted. Existing `open-library-selected-row-failure-evidence-v1` receipts
retain frozen legacy replay, including `record-location-present` for every own
location field, the original 1 MiB raw JSON bound and parse-before-guard order.
A v1 self-location failure remains valid historical evidence even though live
inspection now accepts that same identity. Contract versions are never rewritten
and a v1 receipt cannot be interpreted through the relaxed live guard. Source
acceptance of this correction is recorded separately in STATUS.

The scanner forwards only the offending selected row through the collector to
encrypted output. `diagnosticRetainedBytes` counts these bytes separately from
prior matched/retained records. Local authenticated recovery checks the bounds, hash,
source/roster binding and reproduced predicate; older receipts without evidence
remain valid. Public logs retain fixed codes and never emit row data or the
private predicate. A failed stream remains incomplete: this evidence cannot
verify full-source EOF/checksums or become a review candidate. It neither
recovers a discarded historical row nor activates a new request/source budget.
A private source-bound inspection helper must include the new failure-evidence
dependency in its accepted-source manifest; archived helpers remain unchanged.
Source/fixture acceptance and any later bounded source diagnosis are separate.

### Bounded Work-prefix diagnosis — #182

`open-library-work-prefix-diagnostic-v1` is a separate partial-source diagnosis.
It binds the consumed reviewed acquisition, unchanged 383-pair public roster and
recipient, and the same dated Work URL/full-size/publisher pins. Local preparation
authenticates the exact archived failure before emitting a request. The fixed
branch `catalog-diagnostic/ol-20260831-work-prefix` may add only
`scripts/catalog/requests/ol-20260831-work-prefix.json` to accepted main; a separate
one-shot ledger prevents replay. Previous request ledgers and limits stay intact.

The reader sends `Range: bytes=0-104857599` and accepts only HTTP 206 with
`Content-Range: bytes 0-104857599/4058336593`, Content-Length **104,857,600** and
identity encoding; multipart or transfer-encoded bodies are rejected. It never
falls back to HTTP 200/full-body acquisition. Limits
are **100 MiB compressed / 1 GiB decoded / 1,000,000 rows / 600 seconds**, with
four official redirects (at most five Work GET attempts) and the existing
1,049,600-byte line bound. The 100 MiB limit bounds the requested range and
accepted compressed parser input. `receivedBodyBytes` also records discarded
redirect-body or already-buffered bytes without clamping; an observed cumulative
crossing fails immediately with `work-prefix-body-limit`. It is not a zero-
overshoot guarantee for socket traffic. There are no metadata, Edition or per-Item
requests.

The first complete selected identity rejection yields `diagnosed` and exactly
one validated encrypted failure-evidence row. Range/decoded/row exhaustion without
a diagnosis yields `inconclusive`; early truncation, corruption, timeout or
header/transport failure yields `failed`. There is no record collection or source
manifest. `fullSourceComplete` and `publisherChecksumsVerified` remain false;
candidates, approvals and database writes remain zero. A prefix hash covers only
accepted compressed bytes; buffered counters are not the offending row's offset.

Prepare and recover on the original private-key custodian:

```bash
node scripts/catalog/prepare-work-prefix-diagnostic.mjs request \
  --previous-request PUBLIC_REVIEWED_REQUEST.json --previous-input open-library-reviewed-20260831.sealed.json \
  --key-dir ORIGINAL_PRIVATE_KEY_DIRECTORY --source-head ACCEPTED_CURRENT_MAIN_SHA \
  --out PUBLIC_WORK_PREFIX_REQUEST.json
node scripts/catalog/prepare-work-prefix-diagnostic.mjs unseal \
  --request PUBLIC_WORK_PREFIX_REQUEST.json --key-dir ORIGINAL_PRIVATE_KEY_DIRECTORY \
  --input WORK_PREFIX_SEALED.json --out NEW_PRIVATE_RESULT_DIRECTORY
```

Preparation first requires the known predecessor ciphertext hash, then decrypts
and validates its exact failed receipt. Recovery writes private
`work-prefix-diagnostic.json`. After accepted source and durable request/key
custody, the request is activated once and its artifact is recovered with
verified run/head/artifact provenance.
A new private inspector binds all source dependencies and replays the exact
predicate offline under its recorded evidence version; existing archives remain
unchanged. This establishes only the current diagnostic row. No original row
hash survived, so byte-identical historical reproduction cannot be established.
The actual v1 diagnostic remains replayable after the live guard's correction
for exact self-location. Neither a diagnosis nor an inconclusive result grants text
rights, a full-source verification or a retry. STATUS owns the consumed request
and any later separately specified acquisition continuation.

### Full acquisition after the self-location correction — #182

The continuation implementation reuses `acquireReviewedOpenLibraryDumps` and
the existing streaming, source-pin and encrypted-result validation. Source
acceptance and actual activation are separate; STATUS records their current state.
The four earlier one-shot ledgers
remain consumed. Do not change their contracts, branches, request files or caps
or make the old reviewed workflow rerunnable.

| New protocol identity | Selected value |
| --- | --- |
| Request contract | `open-library-full-dump-continuation-request-v1` |
| Purpose | `full-acquisition-after-self-location-correction` |
| Request branch | `catalog-acquisition/ol-20260831-continuation` |
| Sole added request path | `scripts/catalog/requests/ol-20260831-continuation.json` |
| Workflow | `.github/workflows/catalog-book-full-continuation.yml` |
| Sealed filename | `open-library-continuation-20260831.sealed.json` |

These names reserve one bounded operation, not a generic retry service. The
`prepare-full-dump-continuation.mjs`, `seal-full-dump-continuation.mjs` and
`run-full-dump-continuation.mjs` entry points live under `scripts/catalog/` with
focused protocol tests. `inspect-full-dump-continuation.mjs` verifies accepted source and
private recovery. The runtime uses the existing full collector.

#### Immutable inputs and proof of the correction

The new request retains the reviewed request's exact release, canonical sorted
383 Work/Edition pairs, recipient PEM/fingerprint, `sourcePins`, `sourceEvidence`
and limits. Its canonical digest covers all fields except the digest itself;
reject extra fields, altered order, pins, limits or predecessor identities. Its
`sourceHead` names the exact accepted main containing the new implementation.

Bind both consumed predecessor Git objects: reviewed request
`4727b4cb3d82a7bc10d134d1c2b7e9fcdbdf22bb` and prefix request
`6a6dc390940db1b15d68a8d850dd08bfbb88bd4a`, at their original fixed paths. Validate
their canonical request hashes and unchanged roster/key, including the reviewed
request's original acquisition/metadata lineage. Freeze the prefix run, artifact
ID, ZIP byte length/hash, sealed-file hash and exact decrypted plaintext SHA-256 from the
[Sprint diagnosis](../project/sprints/SPRINT-014.md#bounded-work-prefix-diagnosis--2026-09-27--182)
and its private recovery receipt. The public request contains these identities,
never raw rows, private keys or catalog UUID/version snapshots.

Before emitting a request, local preparation must authenticate the exact archived
prefix ciphertext with the original key, validate its `diagnosed` result and
frozen v1 evidence, and replay the captured row through the corrected live
identity guard. Require the recorded exact self-location case, unchanged row
hash and matching outer revision/time; do not reinterpret the old receipt as
success. Description text remains independently eligible or rejected. Reuse the
existing reviewed request validation for the retained pins; do not fetch fresh
metadata or infer publisher hashes from the prefix.

The accepted source must descend from correction main
`8c4d8ecf65187f12bb30ed4207d03848fd87d292`. Its exact source receipt binds the
workflow, lockfiles and all imported parser/collector/crypto/validator files,
including `dump-failure-evidence.mjs`; ancestry alone is not a file-integrity
check. Required source CI and tests must confirm that the exact self-location
rule and versioned evidence replay still hold at this source head.

#### Fixed resource budget and honest accounting

Use the unchanged `REVIEWED_SOURCE_PINS` and `REVIEWED_ACQUISITION_LIMITS`:

| Bound | Value |
| --- | --- |
| Work compressed file | 4,058,336,593 bytes |
| Edition compressed file | 12,586,485,055 bytes |
| Combined compressed source input | 16,644,821,648 bytes |
| Decoded input / rows | 128 GiB / 100,000,000 per source |
| Line / retained selected records | 1,049,600 bytes / 64 MiB across both sources |
| Failure evidence / sealed plaintext | One bounded line / 160 MiB maximum plaintext |
| Collector / Actions job deadline | 110 / 120 minutes |
| Provider attempts | Work then Edition; at most five GETs each, including four official redirects |
| Metadata / per-Item / ratings / database requests | Zero |

This starts each compressed stream from byte zero. No range resume, source
substitution, retry, extra release, title matching or additional target is allowed.
Fail on the first error; never begin Edition after a Work failure. Require full
EOF/gzip integrity, exact byte lengths, publisher MD5 and SHA-1, and actual
computed SHA-256 for **both** sources before exposing a collected result. Missing
selected records and rejected description text remain counted outcomes. A Work
success followed by Edition failure is an overall failure, not partial success.

The compressed-source cap describes accepted parser input, not all network
traffic. Current full-collector accounting does not measure discarded redirect
bodies; do not relabel it as a cumulative transport cap or exact row offset.
The prior reviewed and prefix runs recorded 78,731,116 and 78,690,134 compressed
bytes respectively: **157,421,250** already consumed. This distinct full attempt
adds at most 16,644,821,648 accepted source bytes, giving **16,802,242,898** for
those recorded dump inputs plus this ceiling. The two historical 4,248-byte
metadata responses are separate; the prefix's 78,821,206 observed body bytes use
a different counter. Failed/unknown transfer accounting never becomes zero or
an unused budget. Preserve each original ledger and counter definition.

#### Activation, recovery and next acceptance

Implementation and its five required CI gates precede activation. The workflow
accepts only a push to the exact new branch, one child of current accepted main
with the request as the sole added file, `run_attempt=1`, and its own first-run
ledger. It checks out accepted main, validates fixed predecessor Git objects,
uses read-only GitHub permissions and installs frozen dependencies without
lifecycle scripts. Exclusively claim a new empty private output directory before
opening any provider stream; existing output fails before consuming network I/O. No schedule, dispatch or rerun path is added. Any prior run on
this branch consumes the request, including preflight failure.

Before publishing that request, preserve a separate private recovery archive:
original key, original target snapshot, predecessor requests/artifacts/receipts,
new request bytes/hash, accepted source/CI/dependency receipt and a tested local
inspector. Verify archive hashes and durable custody first. Do not overwrite the
completed pilot or earlier acquisition/diagnostic archives. Before recovery,
verify run/head/request, exact artifact ID and downloaded ZIP/hash/sole member;
encryption alone cannot establish the sender. The inspector uses the new
request's accepted source, not whatever main later contains.

Reuse the existing success/failure payload validation through an explicit adapter
for the new request, without weakening historical request dispatch.
The shared `validatePinnedAcquisitionPayload` adapter passes explicitly validated
source pins to failure-evidence validation, so a zero-metadata continuation
failure does not enter the historical metadata-body path. Bind the new request digest/source/roster/recipient in the
authenticated envelope; never pass
a successor through an old request validator by silently changing its contract.
New identity failures retain v2 evidence; v1 receipts still replay their original
rule. On any stream failure discard candidate records and retain only bounded
encrypted accounting/evidence. Interrupted jobs or missing artifacts stay
consumed with unknown details; never replay to recreate evidence.

Successful acquisition has zero approvals/writes. Recover all records privately,
recompute raw-record hashes and `inspectRecord` results, and verify source
manifest/pin bindings; encrypted payload shape alone is insufficient. Then
reconcile exact original and fresh read-only catalog snapshots before
selecting review candidates. Changed identities, existing descriptions or row
versions are explicit reconciliation results, not permission to overwrite them.
Per-record language, exact origin, intended-use rights and attribution review
precede a separately bounded guarded apply/readback design. The completed
ten-Item pilot cannot accept these results. Neither acquisition nor this plan
adds Items, trains a model or completes catalog/device/release acceptance.

Implementation acceptance includes synthetic successful two-source collection;
self-location accepted while foreign/null/redirect identity fails; Work failure
preventing Edition access; Edition failure discarding prior Work candidates;
EOF/hash/budget errors; exact predecessor/ciphertext/roster/key/source binding;
first-run/sole-file/accepted-source gates; tampered envelopes and forged recovery
provenance; bounded v2 failure replay and unchanged v1 recovery; sanitized public
logs and output overwrite refusal. Validate local-only CLI behavior in an isolated
child environment so GitHub CI cannot accidentally disable its production guard.
Ordinary CI never downloads the real dumps. After merge and verified custody,
activate once, record the result, and pause at recovered failure or collected
unreviewed records rather than silently extending the budget.

### Offline selected-record conflict policy — #182

`open-library-selected-record-conflict-policy-v1` is an explicit local-only
exclusion policy. The separate `stage-with-conflicts` command requires a policy
file containing exactly `contract`, `maxConflictedPairs` and
`maxDiagnosticBytes`. Both budgets are positive safe integers, bounded by the
selected roster (at most 385 pairs) and 64 MiB respectively; there are no default
budgets. This grants no provider access or new acquisition attempt. Existing
`stage`, strict scanning and historical cloud acquisition paths keep fail-fast identity
semantics. No foreign location is followed or substituted.

Only validated current v2 `record-location-mismatch` evidence can exclude a
pair. Replay the original bytes and original identity failure first. The record
must have the exact selected object/key/type and a different canonical path of
the same source kind, outside the entire selected roster. Require nonnull valid
revision and modification metadata matching the original TSV fields exactly;
an Edition must still link to its single selected Work. V1 evidence, true
redirects, null/arbitrary/cross-kind locations, another selected identity and
invalid/mismatched metadata or Work links remain fatal. A minimal metadata
projection checks fields after the failed identity guard; it never accepts or
rewrites the original record. No text or rights approval follows from exclusion.

The branded, roster-bound ledger retains immutable copies of original evidence
and assessments. Both members of each conflicted Work–Edition pair are excluded,
including an already collected counterpart. Selected outer-key duplicates remain
fatal, even after quarantine. Diagnostic raw rows consume both the explicit
policy budget and the same cumulative 64 MiB staging budget as valid records;
suppressing a counterpart never refunds consumed bytes. Pair caps, row/decoded
bounds, malformed data and all existing parser/integrity checks remain active.

Both complete local sources must pass EOF, gzip and pinned checksum verification
before candidate artifacts are written. The separate
`open-library-description-dump-conflict-intake-v1` result binds target snapshot,
source manifest, policy and canonical roster hashes. Private `records.json`,
`review.json`, `quarantine.json` and `report.json` distinguish physical valid
matches, quarantined rows/pairs, suppressed counterparts, surviving records,
missing records and consumed/retained bytes. A failed intake retains only a
private diagnostic checkpoint; it cannot supply successful candidates. Output
paths remain exclusive and private; CLI output contains aggregate counts or
fixed error codes. All surviving reviews start unreviewed, with zero approvals,
provider requests, database writes and model admissions.

Synthetic tests cover eligibility/mutations, budgets, immutable ledgers, whole
pair exclusion, duplicates and failures after a conflict, including EOF/gzip/hash
checks and CLI isolation. The source-bound full-continuation inspector includes
the new imported policy module in its dependency closure; archived recovery
still executes its original accepted source and unchanged v1/v2 rules.

This local policy is not an acquisition successor. The separate core below
supplies request/collector/result and payload-recovery contracts; guarded
source/run/custody bindings, explicit operational budgets and one-shot activation
still precede new provider access. All five prior requests stay consumed. Complete-source verification,
fresh catalog reconciliation and individual language/origin/rights review still
precede a separately bounded writer bridge.

### Conflict-aware acquisition core and successor boundary — #182

The successor uses the accepted offline exclusion policy without changing any
existing acquisition entrypoint. Its source packet supplies a request protocol,
a shared streaming collector, encrypted result validation and pure private
payload inspection. The guarded operator path below adds local preparation, a
distinct Actions workflow and receipt-based recovery. Source/CI acceptance and
private custody still precede publication of an actual executable request.

#### Public request and private predecessor proof

`open-library-conflict-aware-dump-acquisition-request-v1` has purpose
`full-acquisition-with-bounded-pair-exclusion`. It preserves the exact original
383-pair roster, recipient, dated publisher pins, source evidence, acquisition
limits and public lineage from the consumed full-continuation request. The new
request adds its implementation `sourceHead`, accepted `policySourceHead`, an
explicit `conflictPolicy` and the consumed continuation's public run/source/
request-head/request-digest identity. The complete body is hash-bound; unknown
fields, changed ordering, substituted keys/targets/pins or historical dispatch
are rejected. Policy acceptance is PR #283, main
`1f3bd049a37f182a773a4101791f9962b87cfb99`.

The source contract requires positive explicit policy caps; no operational pair
or diagnostic budget is chosen by a default. Ceilings remain the selected roster
and 64 MiB, with diagnostic rows also charged to the cumulative 64 MiB selected
record budget. An actual request must freeze its reviewed values before the
future one-shot activation. This source acceptance grants no provider budget.

Do not add new private archive/artifact/plaintext/row hashes, identifiers or disguised
receipt commitments to the new public request or fixtures. Local preparation
must authenticate the retained predecessor using its original accepted-source
inspector and trusted run/artifact/custody receipts, then replay the new policy.
Preserve that proof privately. The cloud gate can verify public lineage, accepted
source and caps; it cannot independently authenticate unpublished private custody.

#### Streaming and encrypted result

`acquireConflictAwareOpenLibraryDumps` validates the exact original public
383-pair roster and freezes the reviewed source pins, source evidence and limits.
It reuses the same official HTTPS
transport, bounded redirects, Work-then-Edition sequence and deadline. The
lower-level `collectConflictDumpStreams` requires an explicit source-opening
callback and bounded structural inputs; it has no default network transport and
supports real synthetic gzip fixtures. Neither entrypoint uses private Item IDs
as scanner keys. Historical acquisition functions always select the strict
scanner, including when callers pass unknown conflict options.

The fixed source ceiling remains **16,644,821,648 compressed bytes**, with
128 GiB decoded / 100 million rows per source, 1,049,600-byte lines, 64 MiB
cumulative selected-record-plus-diagnostic bytes and a 110-minute collector
limit. There are no metadata, per-Item, ratings or database requests, retries,
range resumes or source substitutions. The guarded workflow keeps a 120-minute job
ceiling. These measure accepted source input, not discarded redirect traffic.
Both files must reach verified EOF/gzip integrity and match exact byte lengths,
publisher MD5/SHA-1 and computed SHA-256 before a collected result exists.

`open-library-conflict-aware-dump-acquisition-result-v1` is separate from both
historical cloud results and local staging. Successful results keep surviving
pair records and **separately suppressed valid counterpart records**, plus one
bounded quarantine ledger. Suppressed raw records remain private recovery
evidence and can never enter candidates. Retaining them permits independent
raw hash, inspection, envelope and byte-accounting replay without fabricating
missing counterparts or trusting an unverifiable byte total. Every original
pair belongs to exactly one group. The only quarantined identity is the original
selected pair; a foreign location is never followed or substituted.

The result distinguishes physical valid matches, quarantined rows/pairs,
suppressed counterparts, missing quarantined counterparts, surviving found/
missing records and eligible text shapes. Per complete source, rows equal valid
matches plus quarantine plus unrelated rows. Across both sources, physical
valid matches equal surviving found plus suppressed records; twice the target
count equals surviving found plus surviving missing plus twice quarantined
pairs. Cumulative byte charge equals all valid raw bytes, including suppressed
counterparts, plus diagnostic raw bytes. Exclusion never refunds charge.

Any failure discards both surviving and suppressed record arrays and the
whole-source result manifest. It retains only bounded earlier quarantine
evidence, truthful partial counters and a successor-specific fixed error code.
`terminalFailureEvidence: null` explicitly means the final rejected row was not
retained; it does not claim an unknown cause was diagnosed or grant a retry.
Failed counters preserve an attempted row/chunk that crossed a stop threshold;
recovery checks the corresponding failure reason rather than pretending it was
accepted input or resetting it to zero. Completed Work assertions may survive an
Edition failure, but they do not make the acquisition partially successful.

The existing RSA-OAEP/AES-GCM primitives enforce a **160 MiB plaintext ceiling**
and bind the new request identity. The new seal/unseal wrappers validate the
strict request and separate result contract; old wrappers reject the successor.
Encryption and payload consistency alone do not authenticate the sender.

#### Pure recovery and the remaining operator gate

`validateConflictDumpPayload` checks a result against supplied request context.
`inspectConflictDumpPayload` additionally binds original/fresh private catalog
snapshots, produces unapproved surviving candidates and reports reconciliation.
Both are pure offline functions; strict real-request validation belongs to the
new seal/unseal wrapper. Inspection explicitly reports
`validationScope: payload-consistency-only` and `provenanceVerified: false`.
It replays original conflict evidence and every surviving/suppressed valid raw
record, recomputes inspection and complete counters, and excludes every
quarantined pair. Collector full-file assertions are checked against pins; the
full dumps are not downloaded or rehashed during recovery. No result supplies
language/origin/rights approval, catalog writes or model admission.

#### Guarded operator path

The separate `catalog-book-conflict-acquisition.yml` workflow accepts only the
fixed `catalog-acquisition/ol-20260831-conflicts` push with the sole new file
`scripts/catalog/requests/ol-20260831-conflicts.json`. Its parent must be current
accepted main, descending from the accepted core and policy. It checks out main,
requires clean source, reads all five predecessor requests from fixed Git objects
at their original paths, and checks its own workflow/branch first-run ledger.
Any earlier attempt consumes this branch, including preflight failure. Git
replacement objects cannot substitute provenance. Read-only GitHub permissions,
frozen dependencies without lifecycle scripts, 110/120-minute collector/job
limits, one exclusive output directory and ciphertext-only upload are mandatory.
No schedule, dispatch or retry exists. Unknown exceptions cannot mint fabricated
accounting; missing ciphertext remains a consumed failure with unknown detail.

Local `prepare-conflict-dump-acquisition.mjs` and
`recover-conflict-dump-acquisition.mjs` run from the accepted source checkout.
They verify its entire imported code/workflow/package/lock closure and actual ESM
package routes and dependency bytes before importing parsers or using the key.
The operator-captured source receipt binds the accepted tree, reviewed PR head,
five successful CI jobs, test/export counts and acceptance chronology. Recovery
also checks the sole-file request Git child, the explicit policy digest, first
push/run, artifact metadata, ZIP bytes and exact single ciphertext member, then
authenticated unseal and complete payload replay. API receipts are trusted
operator observations checked against Git and supplied bytes, not signatures or
an independent online attestation. Core `provenanceVerified: false` stays intact;
`operatorProvenance` separately records this narrower receipt-verification scope.

Preparation and recovery both authenticate the consumed full continuation using
its **original accepted inspector in a separate process at the fixed historical
head**. Before executing it, verify that checkout head and inspector bytes against
the original Git object. The historical inspector then verifies its own complete
source/dependency closure, source/run/artifact receipts, old prefix, original
snapshot and ciphertext under the original key. Today's parser cannot reinterpret
that evidence. Only a verified failed result with replayable narrow conflict
evidence may feed the new explicit policy ledger. No terminal evidence is invented.

The private predecessor input manifest maps these exact keys to absolute local
file paths: `request`, `prefix-sealed`, `sealed`, `artifact-zip`, `recipient-key`,
`snapshot`, `source-receipt`, `run-receipt`. Every input is bounded and a regular
file; the key and custody archive must have private permissions. The custody
receipt has contract
`kajo-conflict-predecessor-custody-v1`, `storage` (`fileId`, positive `version`,
`readBackAt`), `archive` (`bytes`, `sha256`) and `files` (each manifest key maps to
`member`, `bytes`, `sha256`). Verify actual read-back archive bytes and every
required member, including the key; reject duplicate/unsafe member paths and
oversized archives. This checks an operator-captured durable readback claim, not
the remote storage service independently. Those identifiers and hashes remain
private. New public requests add only the already public Git/run lineage.

Both CLIs exclusively claim a private output directory, reject linked parents
and never overwrite old evidence. Historical inputs are staged from the exact
custody-checked bytes; the staged key is removed after the child exits and its
in-memory buffer is cleared. Preparation writes private predecessor proof before
writing `request.json` last. Recovery writes unapproved candidates, quarantines,
reconciliation and collected evidence privately, then its summary last. Neither
CLI accesses the provider or database.

Example preparation (all paths are private local inputs; caps are explicit in
`policy.json`, with no selected default):

```sh
node scripts/catalog/prepare-conflict-dump-acquisition.mjs \
  --repo /private/accepted-source --source-head ACCEPTED_MAIN_SHA \
  --source-receipt /private/source-receipt.json --policy /private/policy.json \
  --predecessor-repo /private/original-continuation-source \
  --predecessor-inputs /private/predecessor-inputs.json \
  --custody-receipt /private/custody-receipt.json --custody-archive /private/readback.zip \
  --out /private/new-preparation
```

Recovery uses the same predecessor/custody arguments with `--repo`, `--request`,
`--sealed`, `--artifact-zip`, `--source-receipt`, `--run-receipt`, optional
`--current-snapshot` and a new `--out` directory. Before activation, save and read
back a **separate new recovery archive** containing the prepared request/proof,
accepted source/CI/dependency receipt and original recovery inputs. That later
archive must not overwrite any predecessor archive. Confirm these gates and
freeze the operational policy caps before publishing the one-shot request. This
source packet adds no request file or actual provider budget. Stop the distinct
bounded execution at recovered failure or unreviewed complete collection. Fresh
reconciliation and individual rights review precede a separately bounded writer
bridge; all five historical requests remain consumed.

### Local Edition line-framing diagnosis — #182

`scanEditionLinePrefix` is a separate local diagnostic entrypoint over a supplied
gzip stream. It reuses `createDumpRowParser` from complete dump acquisition, with
the same byte ceiling before target classification, fatal UTF-8 handling and
completed-row identity/envelope/duplicate guards. Historical strict, conflict
and Work-prefix entrypoints cannot activate it through an extra option. It
retains no candidates and never skips an oversized row to continue collection.

The caller explicitly supplies the dated canonical Edition source pin, original
unique Work/Edition roster, observation time and all six limits:
`compressedBytes`, `maxDecodedBytes`, `maxRows`, `lineBytes`, `prefixBytes` and
`timeoutMs`. No operational defaults are selected. The prefix cap is at most
4,096 bytes and cannot exceed the line cap; other schema ceilings do not grant
an acquisition allowance. Context is validated and copied before stream access.

`open-library-edition-line-limit-evidence-v1` captures only the first overflow
observed by that framer. It binds the canonical source, roster/limits digests,
observation time, one-based row, zero-based decoded `lineStartByte` and an exact
retained-prefix byte count/hash. Evidence ends immediately after the fourth tab
when present, retaining no following JSON; otherwise it fills the explicit
prefix cap. UTF-8 bytes and any CR count toward the line ceiling; LF does not.
`observedLineBytesAtLeast` is exactly `lineBytes + 1`, a scanner-observed lower
bound. `rowComplete` is false and `rowBytes`/`rowSha256` are null. The small
retained header cannot independently prove the whole line exceeded its cap.

A complete valid outer Edition envelope yields `envelopeSelection.status` of
`selected` or `unrelated` by its outer key against the supplied roster. Invalid,
future-dated, incomplete or invalid-UTF-8 headers yield `unknown` with a fixed
reason and no extracted identity. Even `selected` is strictly an outer-envelope
classification: inner JSON, key/type/location, Work linkage, language, content
and rights remain unchecked for that oversized row. A new observed header never
proves the identity of the earlier discarded terminal row, even at the same
position. No raw header, private identifier or digest belongs in public logs.

`open-library-edition-line-prefix-diagnostic-v1` has a closed result schema,
source/roster/limit bindings, bounded counters, observed compressed-prefix hash
and one of these outcomes:

| Outcome | Meaning |
| --- | --- |
| `diagnosed` / `dump-line-limit` | The scanner's own first overflow, with validated bounded header evidence |
| `inconclusive` | Exact prefix exhaustion, row cap or decoded-byte cap before an overflow witness |
| `failed` | Early EOF, compressed overrun, gzip corruption, abort/timeout, transport error or existing parser guard |

Only expected incomplete gzip at the exact declared **partial** prefix end is
ordinary exhaustion; a truncated full-size input fails. The unterminated tail
is not parsed as a complete record, though an observed tail exceeding the line
ceiling can be diagnosed. The stream pipeline closes on completion, failure or
abort. Whole compressed chunks crossing their cap are rejected; decoded chunks
are clipped to the remaining budget. Counters can include buffered lookahead
within the caps and do not identify compressed row offsets. Input errors cannot
forge a diagnosis by supplying the scanner's error text or evidence properties.

Validation replays the minimal prefix, classification, hashes and consistent
accounting; `validationScope` remains `payload-consistency-only` and
`provenanceVerified` is false. `fullSourceComplete` and
`publisherChecksumsVerified` remain false even if a supplied gzip reaches EOF.
Source pins are context, not authenticated local bytes. `candidates`, `approved`,
`databaseWrites`, `modelAdmissions` and `inspectionSourceRequests` are all zero.

The local-only `inspect-edition-line-prefix.mjs` CLI requires the consumed conflict
request and explicit limits as bounded JSON regular files. It validates that
public request schema, preserves its exact line ceiling and does not exceed its
decoded/row/time caps. It blocks GitHub Actions, accepts a regular local gzip
input, reads from byte zero to the compressed cap, and exclusively claims a new
private direct child of ignored `dist/catalog-enrichment`. Request, limits and
diagnostic are mode 0600 under a mode 0700 directory; symlink output parents and
overwriting are rejected. `diagnostic.json` is written last with request/context
hashes and `sourceAuthentication: not-performed`. Output contains only a fixed
status/code and zero action counts. This is neither private predecessor recovery
nor a provider operation.

```sh
npm run catalog:book-descriptions:lines -- \
  --request /private/consumed-conflict-request.json \
  --limits /private/explicit-line-limits.json \
  --editions /private/local-edition-prefix.gz \
  --out dist/catalog-enrichment/new-line-diagnosis
```

Actual provider diagnosis uses the separate guarded path below. Keep the original
roster, pins, line ceiling and identity rules. All six historical requests remain
consumed; no rerun, limit increase, source completion, description approval or
serving/model admission follows from the local diagnostic.

#### Guarded Edition-prefix operator path

`open-library-edition-prefix-request-v1` has purpose
`bounded-edition-line-framing-diagnosis`. It retains the consumed conflict
request's original roster, key, pins, full acquisition limits, conflict policy
and public lineage. Validation reconstructs that exact prior request digest;
changed pairs, ordering, recipients or policy cannot be substituted. New fields
bind the accepted local diagnostic core and the consumed conflict's public
source/request/run identity, plus all six explicit `diagnosticLimits` fields.
No new private row, artifact or archive commitment enters the public request.

The prefix begins at compressed byte zero of the same pinned Edition file.
Schema ceilings are **1 GiB compressed, 8 GiB decoded, 10 million rows and
20 minutes**, with the unchanged line ceiling and at most 4 KiB retained prefix.
They are not defaults or a selected operational allowance. Preparation must
explicitly select and review all caps. There are at most four redirects/five
Edition HTTP requests; Work, metadata and individual-record requests remain zero.
The original conflict policy is retained as historical identity, not enabled as
a skip policy in this strict prefix scanner.

The collector reuses the bounded curl transport, checking status and headers
before forwarding body bytes. Only a single exact 206 `Content-Range` and
`Content-Length`, identity encoding and non-multipart body are accepted. Reject
200, changed ranges, transfer encoding, query parameters, changed filenames or
unapproved hosts/routes. Redirects preserve the range, are loop-checked and count
toward the same request/body budget; observed discarded redirect bodies also
consume bytes. A redirect cannot reset a cap. Timeout, abort, invalid headers,
overflow or transport failure terminate without a retry. Unknown exceptions
become fixed public categories and never supply a fabricated scanner diagnosis.

`open-library-edition-prefix-result-v1` binds the exact request/source, observation
times, request/body counters, redirect chain, accepted response and optional
local diagnostic. A scanner result replays the existing closed local contract;
transport failures retain no header diagnosis. The local diagnostic may be
diagnosed, inconclusive or failed. No outcome verifies a complete dump, grants
provenance, retains candidates or approves text. `seal-edition-prefix-diagnostic`
uses the existing RSA-OAEP/AES-GCM protocol with a 128 KiB plaintext ceiling and
one neutral `edition-prefix-diagnostic` payload kind for every outcome. Pure
payload replay supports synthetic cryptographic fixtures; production seal/unseal
always enforces the frozen operational request first.

The distinct workflow accepts only
`catalog-diagnostic/ol-20260831-edition-prefix` with the sole added
`scripts/catalog/requests/ol-20260831-edition-prefix.json`. It checks out accepted
main without stored credentials, installs frozen catalog dependencies without
lifecycle scripts and uses read-only contents/actions permissions. The runner
checks clean source, current main, accepted-core ancestry, exact single-parent
request diff and all six fixed predecessor Git objects at their original paths.
Its workflow/branch ledger must contain exactly the current first push and
attempt. Any prior run consumes this branch, including preflight failure. No
dispatch, schedule or retry exists. The 30-minute job exclusively claims private
output and uploads only its single ciphertext file, including a validated failed
result. An unexpected exception cannot invent accounting; missing ciphertext is
a consumed failure with unknown detail.

Local preparation and recovery authenticate the current complete code/workflow/
package/lock closure and actual ESM dependency routes/bytes before loading
parsers or using private keys. A `kajo-edition-prefix-source-acceptance-v1` receipt
binds accepted source/tree, reviewed PR head, all five required CI jobs and the
test/export counts. Recovery also binds the new request Git child, explicit
diagnostic-limit digest, run chronology, ZIP member/bytes and authenticated
plaintext through `kajo-edition-prefix-runtime-receipt-v1`. These are
operator-captured receipts checked against supplied Git/bytes, not independent
online attestation. The result's `provenanceVerified: false` remains intact;
the private summary separately records receipt-verification scope.

`kajo-edition-prefix-predecessor-custody-v1` uses the same bounded archive/member
readback checks as conflict preparation. Its exact input manifest maps the fifteen
names below to absolute local paths:

| Inputs | Meaning |
| --- | --- |
| `request`, `sealed`, `artifact-zip`, `source-receipt`, `run-receipt` | Consumed conflict acquisition |
| `continuation-request`, `continuation-sealed`, `continuation-artifact-zip`, `continuation-source-receipt`, `continuation-run-receipt` | Its original full-continuation predecessor |
| `prefix-sealed`, `recipient-key`, `snapshot` | Original prefix, unchanged recovery key and original snapshot |
| `continuation-custody-receipt`, `continuation-custody-archive` | Earlier durable readback needed by the original conflict recovery |

Verify the supplied archive and every named member, including the owner-only key
and nested custody archive, before executing a historical inspector. The consumed
conflict is recovered with **its original accepted recovery script at its fixed
source head**, in a new process; its continuation likewise uses the original
accepted continuation checkout. Check historical heads and inspector bytes against
the fixed Git object first. The old recovery verifies its own closure, receipts,
encryption, original snapshot and predecessor. Today's scanner does not reinterpret
the discarded row. Only its verified failed `dump-line-limit` in Edition after
publisher-verified complete Work can support preparation. The terminal row remains
unknown. Temporary staged key copies are removed on success/failure, including
the known child copy after timeout; the original key/archive are preserved.

Both CLIs block Actions and claim a new private output directory with no linked
parents or overwrite. Preparation writes the private predecessor proof and then
`request.json` last. Recovery authenticates the predecessor again, writes private
`diagnostic.json` and its receipt-bound `summary.json` last, printing no header or
classification. Existing conflict wrappers retain their fixed v1 contracts and
bounds while sharing file, source, ZIP and receipt primitives with this path.

```sh
node scripts/catalog/prepare-edition-prefix-diagnostic.mjs \
  --repo /private/accepted-edition-source --source-head ACCEPTED_MAIN_SHA \
  --source-receipt /private/edition-source-receipt.json --limits /private/reviewed-limits.json \
  --conflict-repo /private/original-conflict-source \
  --continuation-repo /private/original-continuation-source \
  --predecessor-inputs /private/edition-predecessor-inputs.json \
  --custody-receipt /private/conflict-result-custody.json --custody-archive /private/readback.zip \
  --out /private/new-edition-preparation
```

Recovery uses the same historical checkout, input/custody and new-output arguments
with `--repo`, `--request`, `--sealed`, `--artifact-zip`, `--source-receipt` and
`--run-receipt`. After accepted source and successful actual preparation, freeze
the public request Git identity and save/read back a **separate new recovery
archive** containing the request/proof, source/CI/dependency receipts and original
recovery inputs before activation. The source implementation supplies no request
file or selected caps. Stop actual execution at one privately recovered outcome;
inconclusive/failure does not authorize expansion. Any later correction or full
collection needs its own accepted packet, fresh reconciliation and rights review.

### Bounded Edition framing core — #182

`scanEditionFramedStream` is an explicit local complete-gzip scanner in
`open-library-dump-descriptions.mjs`. It reuses the shared byte framer, record
inspection, conflict ledger and complete-source checksum pipeline. No existing
strict/conflict acquisition, prefix diagnostic, CLI, request, result schema or
historical recovery enables this rule through an extra option. The separate
full-collection core below integrates it; guarded activation is still required
before any provider execution.

The caller supplies the canonical dated Edition source with exact compressed
size, SHA-256 or publisher MD5/SHA-1, decoded/row bounds, the **entire original
unique Work/Edition roster**, observation time, cumulative staging budget and
explicit `lineBytes`, `retainedBytes`, `timeoutMs`. There are no operational cap
defaults. Existing schema ceilings apply, including the unchanged maximum
1,049,600-byte line limit. Validate/copy source and roster before reading. An
optional branded conflict ledger must bind that same roster; quarantined pairs
are never removed from header selection. Caller cancellation and the bounded
scanner timer share the stream's abort boundary. The timer keeps a stalled scan
alive even without another I/O handle and is cleared when the scan settles. A
separate-process regression verifies this liveness boundary. The successor below
also preserves its global two-source deadline and cumulative budgets.

At overflow only, inspect at most `min(4096, lineBytes)` bytes from the line start,
ending at the fourth tab. Discard requires an ASCII canonical `/type/edition`
header, `/books/OL…M` key outside the roster, positive safe integer revision and
valid nonfuture timestamp. Incomplete headers, invalid encoding, BOM/control
characters, normalized impossible dates and 24:00 timestamps cannot authorize
discard. Selected and unknown headers still fail `dump-line-limit`. These new
strict discard predicates do not reinterpret historical diagnostic evidence.

Once proven unrelated, release the pending row buffer and count/skip subsequent
bytes through LF without decoding JSON, following inner IDs or retaining the
body. CR counts toward line bytes; LF does not. Resume normal framing at exactly
the next byte. Ordinary rows preserve existing encoding/envelope/identity/Work
linkage/duplicate/retention rules. An oversized discarded tail without LF fails
`dump-unterminated-oversized-row`; ordinary under-limit EOF retains its original
semantics. Truncated/corrupt gzip, source errors, premature close, abort, timeout
or any resource overrun reject the scan without returning records.

New-entrypoint statistics add `oversizedUnrelatedRows` (LF-completed discarded
rows), `oversizedUnrelatedBytes` (all their observed non-LF bytes, including a
partial discarded tail on failure) and `maxBufferedLineBytes` (largest logical
buffered/parsed ordinary row, bounded by `lineBytes`, not process RSS). Discarded
rows are also `unrelatedRows`; discarded bytes remain in total decoded/compressed
accounting and **every full-file checksum**. They do not consume retained-record
bytes or become candidates, verified JSON records or conflict evidence. Only
complete EOF, exact source size, gzip integrity and all supplied checksum matches
return `complete: true`. These counters do not authenticate the publisher or
grant rights, approval, database writes or model admission.

Synthetic tests cover split headers/overflow/CRLF, consecutive skips, 4 KiB header
boundaries, selected/quarantined and malformed headers, preserved identity
guards, exact global accounting/checksums, EOF/truncation/error/abort/timeout and
historical-entrypoint isolation. A streamed 32 MiB row checks bounded allocations
independently of the reported logical buffer peak. No real dump was requested or
historical row reconstructed by this source packet. New request/result/encryption
contracts are supplied below; original-source predecessor recovery and separate
operational custody remain prerequisites for execution.

### Framed full-collection successor core — #182

`collectFramedDumpStreams` is an explicit transport-injected full-collection seam;
`acquireFramedOpenLibraryDumps` supplies the exact reviewed production pins and
383-pair roster. Work retains strict conflict-aware parsing; only Edition uses
`scanEditionFramedStream`. Both must reach EOF with exact compressed sizes,
publisher MD5/SHA-1 verification and recorded SHA-256. Work must complete before
Edition opens. Exclusion covers whole original pairs; the original roster stays
in the Edition header guard even when a Work conflict excludes a pair. Retained
valid/suppressed records and diagnostics share the unchanged cumulative budget.

The global deadline covers both openers and both streams. This successor keeps
its timer referenced until settlement, bounds an opener even if it ignores
AbortSignal, destroys late response bodies and blocks late request accounting.
Remaining time is supplied to transport and Edition scanning. Historical public
collector entrypoints ignore framing flags; their scanners, timers, result
schemas and error vocabulary remain unchanged. Shared implementation is private,
not a public option to silently upgrade a consumed contract.

`open-library-framed-dump-acquisition-request-v1` has purpose
`full-acquisition-with-bounded-edition-framing` and binds accepted framing source
`b34aca7451199e3cf78578318d8f5f151ad80c32`. It reconstructs the exact consumed
Edition-prefix request under its own historical schema/digest, preserving all
seven public predecessor identities, original recipient, roster, pins, source
evidence, full-source limits and conflict policy. The latter remains **8 pairs /
8 MiB diagnostics**. The old diagnostic limits remain historical data and cannot
be substituted for the full-collection limits. Unknown/private fields, recipient
replacement or any retained-budget change are rejected even after rehashing.
Construction and schema validation neither authenticate the previous private
diagnosis nor authorize a run. No executable request is included here.

`open-library-framed-dump-acquisition-result-v1` and neutral encrypted kind
`framed-acquisition-result` are distinct from previous results. Only Edition
source/accounting objects add the three framing counters. Pure
`validateFramedDumpPayload` / `inspectFramedDumpPayload` reuse record, whole-pair,
quarantine, coverage, source-manifest and fresh-snapshot replay with a closed new
schema. They check completed-discard row/byte bounds, LF accounting, buffer limits,
agreement between source and accounting objects and retained-record decoded-byte
minimums. Partial failures preserve observed skip bytes but no terminal row or
candidates. `dump-unterminated-oversized-row` requires a partial Edition discard;
row-budget failures distinguish a pre-row bound from the old counted extra row.

These checks do not recompute full-file hashes or replay absent discarded headers
and JSON. Their summary explicitly remains **payload-consistency-only**, with
`provenanceVerified: false`. A fresh catalog mismatch blocks review eligibility;
even unchanged candidates remain unapproved until source-specific language/rights
review. Production seal/unseal validates the frozen request first; synthetic test
contexts use the generic envelope seam and cannot replace its fixed recipient.

The guarded operator below supplies preparation, one-shot activation controls and
original-source recovery. Every old request remains consumed; no historical row
is reclassified, budget widened or text approved.

### Framed full-collection operator — #182

`prepare-framed-dump-acquisition.mjs`, `run-framed-dump-acquisition.mjs` and
`recover-framed-dump-acquisition.mjs` implement a distinct operator boundary.
The push-only `catalog-book-framed-acquisition.yml` workflow checks out accepted
main, requires the full-collection core `cfa36d5810c1f5e6f91c4112e4376415f2f4ced1`
as an ancestor, and refuses a dirty checkout. The sole request addition must be
`scripts/catalog/requests/ol-20260831-framed.json` on
`catalog-acquisition/ol-20260831-framed`, with accepted main as its only parent.
All seven fixed predecessor Git objects are fetched and revalidated. The exact
push/head and a separate ledger containing only the current first-attempt run
must pass before a new private output directory is claimed or provider I/O starts.
There is no dispatch, schedule, retry, write permission or limit override.

The workflow retains the frozen 16,644,821,648-byte compressed total, 128 GiB
decoded and 100 million rows per source, 64 MiB cumulative retention, 1,049,600-byte
line ceiling, 8-pair/8 MiB conflict policy and 110-minute collector deadline. Its
120-minute job budget leaves time for ciphertext upload. The runner validates
and encrypts both complete and failed results; only the neutral sealed artifact
is uploaded for seven days. Failed collection sets the upload marker before
returning a fixed generic failure. CI stdout contains no raw result, discarded
header, candidate count or recipient key. Actions are pinned to immutable commits;
dependency installation disables lifecycle scripts.

Preparation and recovery are local-only and require a new private output.
Before dynamic parser import, the new inspector binds its complete source closure,
workflow/lock files and actual ESM dependency bytes to an accepted source receipt,
the identical reviewed tree and all five successful CI jobs. New receipt contracts
are `kajo-framed-acquisition-source-acceptance-v1`,
`kajo-framed-acquisition-runtime-receipt-v1` and
`kajo-framed-acquisition-predecessor-custody-v1`. Source/run receipts bind request,
recipient, full limits digest, framing source, conflict policy, first push/run,
chronology and exact artifact/ZIP/plaintext hashes. ZIP membership and CRC are
checked against supplied ciphertext. These are verified operator assertions,
not independent sender or storage-service authentication.

The predecessor manifest has exactly **22 absolute paths**: the Edition
`request`, `sealed`, `artifact-zip`, `source-receipt`, `run-receipt`; the same five
conflict inputs prefixed `conflict-`; `continuation-request`, `prefix-sealed`,
`continuation-sealed`, `continuation-artifact-zip`, `recipient-key`, `snapshot`,
`continuation-source-receipt`, `continuation-run-receipt`,
`continuation-custody-receipt`, `continuation-custody-archive`,
`conflict-custody-receipt` and `conflict-custody-archive`. Fresh durable custody
readback must bind every member, including the key and both nested archives.
Key/archive inputs require private modes; manifests reject symlinks, missing or
extra names, and oversized inputs. No private custody digest enters the public
request.

Before staging a key or starting a historical process, read-only preflight checks
all three original source closures, installed ESM dependencies and reviewed trees:

| Inspector | Original accepted head | Original source files |
| --- | --- | --- |
| Edition diagnosis | `3d12a7f69534fef305b7ca37767626ae584b688e` | 26 |
| Conflict acquisition | `24631688fbbbf73b2197768d5df686e26ff361dd` | 20 |
| Full continuation | `8a9aefbf87870abd932dac53c6d4abae7fd0683d` | 17 |

The continuation's original manifest predates `dump-conflict-policy.mjs`; today's
expanded manifest cannot replace it. Only the original Edition inspector then
executes, recursively calling the original conflict and continuation inspectors.
A POSIX process group bounds the complete child chain to 60 seconds, discards
child stdout/stderr and stops descendants even if the parent exits early. All
three known temporary key copies are removed on success, failure and timeout;
the caller clears its in-memory key in `finally`. Nested custody archives remain
private recovery evidence.

The original child must recover `diagnosed` / `dump-line-limit` with an unrelated
canonical outer header, bounded-header-only scope, no complete row/hash or full
source proof, and zero candidates/approvals/writes/admissions. New preparation
does not rerun today's framing predicate over that private header. Only after
these checks is `predecessor-proof.json` saved; `request.json` is written last.
Recovery additionally checks all seven Git requests, the original snapshot and
the new encrypted result, then writes collected/candidate/quarantine/reconciliation
outputs and a final summary. An optional fresh snapshot records changes. The core
summary stays `payload-consistency-only` / `provenanceVerified: false`; an
additional field records the narrower receipt verification. Candidates remain
unreviewed and ineligible for writes.

Source delivery includes no executable request. Next capture accepted source/CI
evidence, reconstruct the private predecessor inputs using their original code,
record the unchanged operational limits, and save/read back a new recovery archive
before activation. A completed collection still needs fresh catalog reconciliation
and individual rights review before a separately bounded writer operation.

### Terminal-conflict diagnostic core and recovery cleanup — #182

`collectTerminalConflictDumpStreams` is an explicit transport-injected successor.
`open-library-terminal-conflict-diagnostic-policy-v1` permits one record with a
positive `maxBytes` no larger than existing line/cumulative retention ceilings.
It supplies no default network transport, executable request, workflow or new
encryption contract. Historical entrypoints ignore the extra policy and retain
their old schemas/null terminal evidence. All eight consumed operations stay fixed.

The ledger brands its fatal exception with the validated selected row and exact
assessment. Only the new collector retains it under
`open-library-terminal-conflict-dump-acquisition-result-v1`, charging raw bytes once
to cumulative retention. Accepted quarantine keeps its separate 8-pair/8-MiB bound.
Exceeding the terminal cap returns `dump-terminal-diagnostic-limit` without a row.
Original predicate, source, roster, row, LF/CR bytes, hash and policy reason are
replayed under a closed evidence schema. A transport error cannot impersonate
parser evidence. Exclusion rules stay unchanged; failure returns no candidates.

`inspect-terminal-conflict-dump.mjs` validates the allocation, original policy,
source/row/time order, decoded minimum and Edition buffer accounting, then reuses
unchanged framed source/record/quarantine checks. It cannot authenticate a publisher
or prove absent full-source bytes. Results remain payload-consistency-only and
unapproved. Tests cover fatal reasons, prior quarantine, source order, caps,
tampering, malformed/transport/timeout/checksum failures and historical isolation.

`historical-recovery-cleanup.mjs` attempts all three temporary keys even if one
removal fails, flushes directory metadata, checks leaf absence including dangling
symlinks and verifies it in a fresh process. After SIGKILL, recovery waits for all
live group members before cleanup. Linux checks translate PID namespaces when
`/proc` belongs to an outer namespace; direct host-PGID comparison can falsely
report absence. Zombies cannot execute. Unverified termination/cleanup prevents
successful preparation/recovery. Original historical sources are not modified.

The actual September 28 key reappearance was not reproduced synthetically. These
are demonstrated cleanup/verification fixes, not a proved explanation of that
observation. Independent post-command absence remains mandatory before archiving
or activation. Tests require no historical private key or provider stream.

### Description attribution — contract, #182

`@kajo/catalog-contracts` defines the generic `DescriptionAttribution` value.
`description-attribution-v1` has exactly ten public fields: `contract`,
`sourceTitle` (200 code points), `sourceUrl`, `sourceRevision` (nullable, otherwise
200), `credit` (500), `licenseName` (100), `licenseUrl`, `changes` (500),
`textSha256` and `recordSha256`. Text is trimmed, nonempty and plain; control/
format characters and markup are rejected. URLs are bounded to 2,048 ASCII
characters with explicit HTTPS and DNS host labels; credentials, ports, unsafe
schemes, malformed percent escapes and encoded ASCII controls are rejected.
No source or license is fabricated from provider identity alone.

Supplying attribution or permission on an approved offline decision opts the
whole packet into `open-library-description-v2`. Every approval in that packet
needs valid credit bound to its exact normalized text and provider-record hashes,
plus private `permission: { evidenceSha256, intendedUse }`, currently restricted
to `kajo-internal-pilot`. The evidence digest refers to the separately reviewed
permission artifact; it is not itself proof of permission. The private stored
envelope binds that decision to the same attribution and text/record hashes.
Public `metadata.descriptionProvenance.attribution` contains only display credit;
the private `descriptionEnrichment.permission` stays in `ItemSource.source_payload`.
Legacy v1 checkpoints reconstruct unchanged, including retained review history.
Apply selects the packet's explicit RPC mode; readback checks public and private
bindings. A future public release requires separately accepted rights/use scope.

New forward `20260920000607_description_attribution.sql` extends the existing
narrow invoker/service-only Item/batch overloads, with no default mode, backfill,
new endpoint or change to installed migration files. It permits guarded v1→v2
upgrades and rejects v2→v1 downgrades and legacy full-writer overwrites. A changed
credit or permission digest is a version-guarded update; identical replay keeps
timestamps. Existing deterministic locks, atomicity, identities, preserved core
fields and ACLs remain. Populated-upgrade and full-schema synthetic tests include
native CLI/PostgREST and concurrent writers. Source acceptance and hosted rollout
are separate; STATUS/#182 own the installed version and rollout decision.

Canonical catalog reads select metadata and project text with status `legacy`,
`attributed` or `unverified`. Only an actual metadata object without the managed
provenance key establishes legacy compatibility. Missing metadata, malformed
managed credit, unsupported contracts (including managed v1), unsafe links or
text-hash mismatch hide the description while preserving the other Item data.
Text-only ranking, Shared and List RPC fallbacks are unverified; successful
canonical enrichment replaces the complete Item without altering order or actor/
Profile state. Remembered Items retain credit; the detail boundary revalidates
cached text and attribution. Source, revision, credit, license link and changes
remain visible with a collapsed description and accessible independent links.
List/history detail routes without a delivered Prediction ID load their exact
canonical Item through `CatalogDetailEntry` / `catalogDetailLoad` and
`loadCatalogItems`, instead of depending on a remembered recommendation. Reads
have a 15-second deadline, retry/back states and discarded late responses after
scope/client/Item/attempt changes. A successful entry renders only that Item;
it neither inserts a synthetic Prediction slate nor borrows another slate's
metadata. Delivered-Prediction routing retains its separate evidence gates.
Structural/component/bundle tests do not establish native visual/link acceptance.
`ItemDescription` owns the shared paragraph/collapse/credit rendering boundary.
The separate `apps/description-acceptance` companion renders it with isolated
synthetic Items and a distinct native application ID. It has no production
router/auth/database/Event providers. Actual exported source maps enforce the
allowed shared modules and a single React instance. Its optional link-opener
injection is labelled test failure; production continues to use the native
opener. Source commit/dirty state and observed device results remain separate.
The companion cannot accept full Profile/List/Shared entry, real-text rights or
the independently configured Kajo application merely by passing its own tests.
The independent #229 reader/delivery-provenance scope remains unchanged.

[Wikimedia's reuse terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)
require the applicable license and attribution; page history and third-party
imports can matter. [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
also requires a license link and change indication, and ShareAlike for adaptations.
These requirements were checked on 2026-09-19. They do not establish that a
particular cached Open Library paragraph has a verified Wikimedia origin or
that its exact source revision uses that license version. Match and review the
actual contribution first. Publisher overlap likewise does not confer permission.

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

E1 implements the executable engine contract with Kajo/media and small synthetic
non-media fixtures. D1/D2 implement the isolated external-data adapter and
reproducible baseline report; their bounded foundation is accepted. Production
scoring remains server-owned. E2 may later replace one admitted component behind
existing Kajo contracts with parity, fallback and rollback tests.

The October 9 dependency audit prioritizes the native memory/serving
decay divergence before bounded ordered Personal session/state policy and adaptive
Taste/frozen challenge. Preserve the current server boundary and version actual
features/interpretation; normalized-feature activation must coordinate every
consumer. Known Shared evidence defects remain mandatory, while its queued
genuine prepared-input consumer and advanced models are not a blanket prerequisite
to Personal source work. ROADMAP owns order; STATUS owns exact acceptance.

The complete source proposal is retained separately: transparent state/memory → latent representations → explicit outcome/next-state model → bounded multistep dreams → self-evolving geometry. Each generation needs its own suitable data and acceptance. Movie-only rating accuracy cannot close all of those gates.


### Focused prediction reconnect recovery — #240

The protocol-2 reader retains its failed request object, captured scope/context,
cursor and immutable accepted prefix across transport recovery. `expo-network`
provides advisory native connectivity, subscribed only while router-focused and
application-foregrounded. Initial async state cannot override a newer native
event; callbacks after cleanup have no effect. A reachable transition coalesces
one retry, including a transition during a hung request, with at most three
automatic attempts per pending request. Repeated online notifications do nothing.
Manual retry remains available; a new page/new search resets the bounded budget.

The 15-second abort/race deadline remains. An online event never acknowledges a
backend response, clears an error or changes Event/Item/List queues. During
recovery the prior failure stays visible with a disabled pending retry control.
Only the current successful response clears it. Server-proven cursor expiry or
other refresh-only recovery requires explicit new search. Scope/revision changes,
blur, backgrounding and unmount invalidate prior work before it can publish.


## Verified local dependency security corrections — #238

When a published dependency has no fixed release, a local source correction must
retain its real npm identity and the raw advisory result. It is not an upstream
version upgrade or permission to suppress unrelated scanner findings.

`scripts/dependencies/security-patches.mjs` binds the braces 3.0.3 and node-forge
1.4.0 archives to their exact lockfile identities/integrities and original source
SHA-256 hashes. Installation is idempotent and refuses unknown or partially
patched source. Verification is read-only and checks every locked installed copy.
Installed-directory containment uses native path-relative rules on Windows and
POSIX. The audit launches npm's CLI through Node under `npm run`, falling back to
a fixed command through `cmd.exe` for direct Windows execution; `.cmd` files
cannot be directly spawned as native executables.

- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
  bound brace/parenthesis parser nesting and all three recursive output walkers
  at 128 levels, including direct AST calls. Depth rejection is a controlled
  SyntaxError, analogous to the existing maximum input length. Escaped, quoted
  and character-class braces remain literal. The upstream diagnosis is
  [micromatch/braces#70](https://github.com/micromatch/braces/issues/70).
- [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv):
  require exactly the validated OID plus an optional, empty primitive NULL in
  DigestAlgorithm, retaining the outer DigestInfo count check. Counting children
  alone is insufficient: an unexpected second element or nonempty NULL must also
  be rejected. The correction covers `lib/rsa.js` and both distributed browser
  bundles; the same malformed-signature controls execute against all three.
  The upstream diagnosis/proposal is
  [digitalbazaar/forge#1149](https://github.com/digitalbazaar/forge/issues/1149)
  / [#1152](https://github.com/digitalbazaar/forge/pull/1152).

`audit-dependencies.mjs` first verifies those exact corrections and runs the
installed security regressions (including pristine-upstream negative controls),
then obtains fresh `npm audit --json`. It prints the complete raw report,
verified source hashes, mitigated findings and unmitigated findings separately.
Only the exact two advisory/package identities on verified copies qualify. Parent
meta-vulnerabilities qualify only when all reachable advisory leaves qualify;
cycles without a real leaf fail. New findings, unknown copies/source, missing
patches, malformed/incomplete reports and scanner transport failure fail closed.
Moderate/high/critical findings without verified corrections block CI. Published
upstream findings are never described as zero vulnerabilities.

The corrections are temporary compatibility backports. Review/remove each when
a fixed upstream release is available; changed source/version fails until reviewed.
All normal checks, actual APK build and owner device acceptance remain required.

For October 6, compatible published fixes replace the compression 1.8.1 and
source-map-js 1.2.1 lock leaves with 1.8.2 and 1.2.2. They fit the existing Expo
CLI/PostCSS ranges and require no audit exception. The regression boundary covers
compressed-response abort cleanup and validated/bounded indexed source-map
offsets, with ordinary source-map and consumer behavior retained.
