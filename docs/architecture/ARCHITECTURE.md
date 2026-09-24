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
identity redirect silently or match by display title. A curated Item without a
provider alias requires a separately reviewed exact mapping before enrichment.

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

The provider's [Work schema](https://github.com/internetarchive/openlibrary-client/blob/master/olclient/schemata/work.schema.json)
and [text-block definition](https://github.com/internetarchive/openlibrary-client/blob/master/olclient/schemata/shared_definitions.json)
describe description/text records. The [licensing page](https://openlibrary.org/developers/licensing)
does not assert new rights over the database and flags possible pre-existing
rights. This is not blanket permission for every blurb or cover. Preserve source
links and review the actual contribution/origin and intended use before display
writes; unknown permission remains staged. Public beta/store rights, attribution
runtime acceptance and withdrawal remain open `MVP-CAT-003` gates. No source documentation check
alone constitutes rights clearance for a record.

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

E1 makes the engine contract executable with Kajo/media and small synthetic non-media fixtures. It does not move production scoring into the mobile app or bypass the trusted server. D1/D2 introduce an isolated external-data adapter and reproducible baselines. E2 may later replace one admitted component behind existing Kajo contracts with parity, fallback and rollback tests.

The complete source proposal is retained separately: transparent state/memory → latent representations → explicit outcome/next-state model → bounded multistep dreams → self-evolving geometry. Each generation needs its own suitable data and acceptance. Movie-only rating accuracy cannot close all of those gates.
