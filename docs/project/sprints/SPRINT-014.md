# Sprint 014 — Algorithm Reliability, Real Catalog & Portable Engine

Status: **ACTIVE — PHASE 14 ACCEPTANCE OPEN; DELIVERED FOUNDATIONS ON MAIN**

## Outcome and current scope

Complete ROADMAP Phase 14: clean-database/bootstrap correctness, trustworthy action/delivery evidence, serving/shadow parity and candidate availability, real catalog/features, portable engine contracts and isolated public-data evaluation, adaptive memory/policy and operating bounded SleepLayer evaluation. Current requirements and acceptance belong to [MVP.md](../../product/MVP.md) and [ROADMAP.md](../ROADMAP.md).

The 2026-09-07 Taste-first release decision supersedes the old Sprint 014 external-beta / Sprint 015 store-close schedule. Taste acquisition is Phase 15, Friends/Shared is Phase 16, core UX/operations is Phase 17, complete-flow closed beta is Phase 18, production/stores are Phase 19 and owner acceptance is Phase 20. Monetization is outside MVP 0.1.

[STATUS.md](../STATUS.md) owns the exact next task. #208/#207 are technically complete through #223. Delivery #224 / PR #225 implements the first Phase 14.1 atomic/durable Item actions; Delivery #226 implements List/Shared commands and their durable mobile path; exact delivered provenance follows. PR #219's source/platform experiments are completed evidence.

## How to read this record

The 14A–14D sections below preserve earlier foundation deliveries and device evidence. Their labels are historical work packages, not the current numbered ROADMAP phases. Catalog counts and hosted evidence are dated checkpoints, not a live inventory. Dated continuation entries later in this file preserve what was pending then; the current STATUS overrides their old next-step instructions. The [2026-09-09 retro](../retros/2026-09-09.md) records the reconciliation.

## Structured description attribution — 2026-09-20 / #182

Branch `feat/182-description-attribution` starts from accepted PR #256/main
`1d8ed155bc39a0d543df27ca4d68006910f7f755` (all five required CI #505 gates).
[Issue #182](https://github.com/Kajooja/Kajo/issues/182) owns this source packet's
exact PR/head/CI/merge outcome when published. The recovery checkpoint below
records the publication interruption and its subsequent owner approval.
This packet uses synthetic records only.

- The shared `@kajo/catalog-contracts` package defines the public credit schema,
  safe bounded text/HTTPS links and browser/native UTF-8 SHA-256 using pinned
  `@noble/hashes` 1.8.0. Root check includes its tests; no engine/domain fork.
- Offline review opts attributed approvals into v2, binds source/text hashes and
  private permission evidence to the public credit and preserves legacy review
  reconstruction/history. Mixed approved v1/v2 entries cannot silently omit
  required credit. Apply selects the packet mode and readback verifies both
  public attribution and private permission bindings.
- CLI-generated forward `20260920000607_description_attribution.sql` extends
  only the narrow catalog writers and adds a private validator. Invoker/service
  ACLs, empty search paths, deterministic locks, exact identities/versions,
  preserved core metadata and batch atomicity remain. Populated v1→v2 upgrade
  preserves all existing rows; v2→v1 and legacy overwrite attempts are rejected.
  Credit/evidence changes require current versions; identical replay is a no-op.
- Canonical Item reads select metadata and preserve explicit legacy content.
  Text-only RPC fallbacks and invalid/missing required attribution hide only the
  description. Ranking, Shared and List enrichment carry whole canonical Items
  without changing order, authorization or actor/Profile state. Detail cache
  revalidation rejects altered text or dropped/unsafe credit. The view shows
  source, revision, credit, license and changes even when the text is collapsed,
  with independently accessible links and recoverable link-opening errors.
- Tests cover shared hash/URL/plain-text behavior; v1 review-history preservation
  and v2 synthetic apply/readback; complete-schema forward/data preservation,
  ACLs, downgrade/stale-version denial and atomic batch failure; canonical
  enrichment/error fallback/cache binding; and source/license link activation.
  A Unicode-trim mismatch found by the SQL fixture was corrected to match the
  JavaScript contract. Native CI additionally exercises old-server rejection,
  PostgREST v2 resolution, anonymous denial and overlapping writers.

The complete local `npm run check` passed: **220 mobile, 3 shared-contract,
46 catalog, 28 Edge, 63 database, 43 engine and 27 research tests (430 total)**,
lint/typechecks and iOS/Android exports. Frozen Edge dependencies used existing
archives verified against their lock integrities. Only the new workspace and
pinned hashing dependency changed the npm lock. Final mobile lint retains only
the pre-existing Discovery Hook warning. Required final-head native CI/merge
identities are recorded in #182, not inferred from local PGlite tests.

No native emulator/device was available; actual layout, screen-reader navigation
and native external-link behavior are not accepted by component/bundle success.
No hosted query/write, provider request, source permission decision, pilot
amendment or APK dispatch occurred. The saved checkpoint SHA-256 remains
`09e6de176eca698a7db582a4f9d4e892ce2f3fe841771b251b0581dee23b91a8`:
**20 consumed attempts / 1 prior review / 0 approvals / 8 rights holds /
2 text exclusions / 0 database batches**. September 17 catalog counts remain
the last verified inventory. #229 and MVP/Phase 14 acceptance stay open.

After source publication and required CI/merge acceptance, continue the new
catalog-only forward rollout (source SHA-256
`57af455775f7f43d7cfe81fc8af887128358c3c3e056f785b4cbb3545bfab043`) and native
description-credit acceptance. Do not redeploy installed v1/history, broaden
budgets or repeat the general licensing search. Exact matching contribution/
revision and applicable permission are still required before approving real
text; rendering support alone grants no rights. [ARCHITECTURE](../../architecture/ARCHITECTURE.md#description-attribution--contract-182)
owns the durable schema/display rules; STATUS owns the single next packet.

### Interrupted-publication recovery and rollout preparation — 2026-09-20

Fresh repository synchronization confirms accepted main is still
`1d8ed155bc39a0d543df27ca4d68006910f7f755`. Runtime commit
`89371e094c8259c9bce73719c35e73b583dbfd0b` and its 39-file implementation were
recovered intact. No remote attribution branch or PR exists. The interrupted
chat's claim of a published PR waiting for CI was incorrect. Automatic approval
review rejected the push to public `Kajooja/Kajo`, citing insufficient explicit
publication authorization for this source packet. No alternate publication
method was attempted. The owner subsequently explicitly approved publication to
public `Kajooja/Kajo`, PR creation and merge after all five required checks, and
requested immediate continuation afterward. The publication block is resolved;
Issue #182 records the resulting exact source/CI/merge evidence.

PR #257 was actually opened at `f6e2ab325edb8bae1e99f7ac9756d8804667105b`, with
tree `1e5c74c4133f2e0220fec47341db53051d330b30` matching the local checked tree.
Initial CI #507 passed validation, platform, clean-install and existing-upgrade
gates. The native CLI job failed because the attribution upgrade fixture emitted
an intermediate UUID/outcome row into the strict JSON-line reader. Replacing
the setup `select` with `perform` preserves the seeded v1 row without emitting
it. The local full-schema regression now asserts exactly one final snapshot;
it failed with two rows before the fix and passes afterward. No parser relaxation,
gate removal or production migration change was used. Final-head CI remains
required before source acceptance or hosted rollout.

- A fresh complete `npm run check` passed all **430 tests**, lint/typechecks and
  both iOS/Android exports. Runtime source and migration bytes are unchanged.
  The existing verified frozen Edge archive cache was reused. The existing
  Discovery Hook warning and Metro's `@noble/hashes/crypto.js` export-resolution
  fallback warning remain; successful bundles do not prove native execution.
- A repeatable-read, read-only hosted snapshot at **2026-09-20 19:32 UTC** verified
  the configured target, migration history, all four catalog writers, their
  function definitions/owners/ACLs/settings, catalog fingerprints, unrelated
  functions, triggers and default privileges. The four definitions still match
  the verified September 17 readback and the locally installed accepted source.
  All remain invoker functions with empty search paths and service-role-only
  client execution. The new private attribution validator is absent.
- The fresh inventory is unchanged in count: BOOK **415 visible / 427 stored /
  385 images / 0 descriptions**; MOVIE **425 / 437 / 425 / 425**. There are zero
  managed descriptions and zero discoverable mocks. Exact full catalog hashes
  and function preimages are retained in the separate local preparation evidence;
  no raw source paragraphs or private evidence are added to Git.
- An isolated PGlite rehearsal matched all four target function definitions,
  owners, ACLs and settings before applying the unchanged new forward. V2
  binding/upgrade/downgrade/atomicity fixtures passed. A recovery candidate,
  generated from the two exact prior writer definitions, restores those writers
  and removes only the new validator. It requires quiesced catalog writers,
  bounded locks and unchanged v2 function/ACL hashes, and refuses existing v2
  data. The rehearsal restored the original function and application snapshots;
  repeating the rollback was rejected. It deliberately does not alter migration
  history; any real recovery still needs its own reviewed history reconciliation.
- The pilot archive remains SHA-256
  `09e6de176eca698a7db582a4f9d4e892ce2f3fe841771b251b0581dee23b91a8`, and the local
  pilot state matches the archived state byte for byte. No provider call, pilot
  amendment, hosted write, migration installation, APK dispatch or device test
  occurred. The new forward remains uninstalled.

After source acceptance, refresh the read-only snapshots immediately before the
bounded admin rollout and compare all catalog/unrelated metadata afterward.
Native acceptance must cover Personal, Shared and List detail entry, collapsed
and expanded credit, source/license link activation and failure, screen-reader
labels, and missing/invalid-credit fallback. Keep the device and #229 gates open.
Preparation evidence does not approve any real text or extend the spent budget.

## Cached BOOK rights audit and review amendment — 2026-09-19 / #182

Branch `feat/182-book-review-amendment` starts from accepted PR #255, main
`6257561b3f2e5a566925abe0e1b82537ebecb4d3`. [Issue #182](https://github.com/Kajooja/Kajo/issues/182)
owns this packet's exact PR/head/CI/merge result. The prior deployment and all
twenty raw provider records were reused; no fresh provider record, hosted
query/write, APK dispatch or device test belongs to this packet.

### Source findings and display gate

The saved Work records contain no explicit rights/license field. The
[Open Library licensing page](https://openlibrary.org/developers/licensing),
rechecked on September 19, still flags possible existing contribution rights.
Record availability and text eligibility do not establish display permission.
The controlled `rights-audit.json` binds these findings to each cached record
revision/hash and text hash; it contains references and conclusions, not new
replacement descriptions.

| Frozen position | New source finding | Decision |
| --- | --- | --- |
| 1 — Pieni elämä | [Wikipedia revision 686759357](https://en.wikipedia.org/w/index.php?title=A_Little_Life&oldid=686759357), October 21, 2015, matches the first two sentences; the third differs. Current prose also differs. | Hold: exact contribution/revision and attribution unresolved |
| 2 — Ei enää ihminen | [Publisher's current page](https://www.ndbooks.com/book/no-longer-human/) uses different copy; the cached text includes a critic quotation. The publisher provides a separate [permissions process](https://www.ndbooks.com/permissions/). | Hold: exact source and permission unresolved |
| 3 — Rikos ja rangaistus | Existing Markdown/URLs remain excluded. | Unchanged text-policy exclusion |
| 4 — Romeo ja Julia | [Linked Wikipedia lead](https://en.wikipedia.org/wiki/Romeo_and_Juliet) overlaps but differs; no exact matching revision was established. | Hold: origin/revision and attribution unresolved |
| 5 — Ajan lyhyt historia | The cached asterisk remains excluded. | Unchanged text-policy exclusion |
| 6 — Atomic Habits | [Publisher opening](https://www.penguinrandomhouse.com/books/543993/atomic-habits-by-james-clear/) closely matches, with punctuation differences; [site terms](https://www.penguinrandomhouse.com/terms-of-use/) do not supply a Kajo display grant. | Hold: use permission unresolved |
| 7 — It Ends With Us | [Publisher page](https://www.simonandschuster.com/books/It-Ends-with-Us/Colleen-Hoover/It-Ends-with-Us/9781501110368) matches three paragraphs, with a different closing paragraph; [site terms](https://www.simonandschuster.com/p/terms-of-use) do not establish permission for this cached copy. | Hold: use permission unresolved |
| 8 — The Subtle Art of Not Giving a Fuck | [Author page](https://markmanson.net/books/subtle-art) does not contain the cached description. | Hold: primary contribution/permission unconfirmed |
| 9 — Control Your Mind and Master Your Feelings | No primary origin or license was established. | Hold: origin/permission unconfirmed |
| 10 — Harry Potter and the Philosopher's Stone | [Author page](https://www.jkrowling.com/book/harry-potter-philosophers-stone/) differs; cached text includes a narrative excerpt. | Hold: exact contribution/permission unresolved |

These are documented matches/leads, not assertions of an exact copyright-owner
chain. Date-filtered Wikipedia history retrieval was unavailable; that limitation
does not turn a partial match into a licensed revision. No publisher/contributor
was contacted and no permission grant was obtained. **Zero display approvals;
eight rights holds and two unchanged text-policy exclusions.**

The implementation audit found `Item.description` alone in the domain contract,
no description provenance selection in `catalogItemOperations.ts`, and plain
description rendering in `ItemDetailScreen.tsx` without source/license credit.
[Wikimedia reuse terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)
and [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) therefore cannot
be satisfied by merely storing an attribution note in the private import review.
The [attribution contract](../../architecture/ARCHITECTURE.md#description-attribution--contract-182)
owns the minimum structured data and display behavior. No UI/schema extension is
claimed delivered here, and no existing publisher text is relabeled as CC-licensed.

### Delivered offline review amendment

`amend-review --run <existing-run> --amendment <proposal.json> --baseline <baseline.json>`
accepts a proposal with exactly `contract`, `expectedReviewSha256`, `reason` and
all ten `decisions`. The contract is
`open-library-description-review-amendment-v1`; the expected hash is
`digest(state.review)` using the existing canonical JSON digest. A non-older
baseline may refresh expected row versions; the original baseline stays in
the retained review. Actual apply still requires a current SQL readback and
guarded rollback preimages in the configured admin runtime.

The command requires a reviewed, non-failed run with **no database batch attempt**.
It verifies every saved record/hash and the exact consumed attempt accounting,
including skipped Work records. It validates the old and new packets, preserves
complete decisions/baselines in `reviewHistory`, links the new review to its
parent, and saves atomically under the existing lock. Replayed/stale proposals,
unchanged inputs, invalid history, failed runs and any previous attempted write
are rejected without resetting state. Apply and verify also validate review
history. The rights/text/identity rules and SQL v1 payload remain unchanged.

The actual CLI recorded the ten source-specific skip reasons in the original
run: **20 unchanged attempts / 1 prior review / 0 approved entries / 10 skips /
0 database batches**. The old raw state, applied proposal and rights audit are
retained in `Kajo-book-description-pilot-v1.zip`; the applied proposal must not
be replayed. No operation-lock recovery or global-claim replacement was needed.
Catalog totals remain the September 17 verified baseline, not a fresh readback.

Validation covers legacy behavior plus exact parent/history retention, successive
amendments, skipped-record tampering, spent budgets, stale/locked/replayed
proposals, unchanged permission/language gates and amended synthetic apply/
readback through the existing RPC contract. The actual CLI test disables fetch
and supplies no credentials. All 19 description tests and the complete root
`npm run check` passed, including both platform bundle smokes. The first root
attempt stopped at a refused npm registry connection; the successful run reused
cached package archives whose integrity matched every frozen Edge lock entry.
No dependency or lockfile was changed. All 46 local Markdown link targets and
the whitespace check passed. Exact remote CI/merge outcomes remain in #182.

Next implement the structured attribution path with synthetic fixtures and
preserve #229's independent reader/native gates. Matching source revisions and
appropriate permission evidence remain necessary before real approval; complete
general licensing research is not the next default task. The pilot and MOVIE
budgets stay closed; do not redeploy installed SQL or broaden the provider pass.

## BOOK rollout and description review — 2026-09-17 / #182

Branch `docs/182-book-description-rollout` starts from accepted PR #254,
main `dce94df96e965f26810c979cf8af550d551c8597`. Publication initially stopped
at automatic approval review. The owner explicitly authorized the public
documentation and #182 update on 2026-09-17. [Issue #182](https://github.com/Kajooja/Kajo/issues/182)
records this documentation packet's exact PR/head/CI/merge outcome.

### Completed rollout and preserved data

The exact accepted `20260914060616_book_description_refresh.sql` was applied
once. Its source bytes and filename remain unchanged. The owner-controlled
checkpoint retains the source/hosted version mapping and exact verification;
do not apply the forward again or repair previous history.

Readback verified both new function bodies, the exact intended legacy guard,
unchanged legacy batch, service-only invoker permissions and no default mode.
All previous migration rows, unrelated function definitions/ACLs, triggers and
global defaults were preserved. An anonymous empty-entry HTTP probe reached the
named overload and received permission denial, establishing hosted schema-cache
resolution without a privileged write. It is not an actual import ACK.

Before/after and final catalog comparisons are equal: BOOK **415 discoverable /
427 stored / 385 images / zero descriptions**; MOVIE **425 / 437 / 425 images and
descriptions**. All ten pilot identities, row versions and preservation hashes
match. Detailed database identifiers/fingerprints stay in controlled evidence.
Security review found no new function/search-path/permission finding; existing
private-table RLS-without-policy notices and the previously tracked
[Auth password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remain separate operations work.

### Actual frozen preview and review outcome

The unchanged CLI collected all ten selected Editions and, after hash-bound
fallback review, their ten exact Works. All twenty responses passed exact
record/Work identity checks. **20 attempted GETs / 20 found records / zero
retries / zero redirects / zero database batches.** The original request spacing,
timeouts, size cap, candidate identities and exclusive pilot claim were retained.
This provider budget is exhausted; no further candidate fetch is part of it.

| Frozen position | Edition description | Work description | Review decision |
| --- | --- | --- | --- |
| 1 — Pieni elämä | Finnish; source URL | Eligible English, 199 code points | Stage: permission/attribution unconfirmed |
| 2 — Ei enää ihminen | Missing | Eligible English, 863 | Stage: permission unconfirmed; embedded critic quotation |
| 3 — Rikos ja rangaistus | Missing | Markdown/URLs | Stage: text policy rejects it |
| 4 — Romeo ja Julia | Missing | Eligible English, 388 | Stage: origin/license and attribution need confirmation |
| 5 — Ajan lyhyt historia | Missing | Contains an asterisk | Stage: unchanged text policy rejects it |
| 6 — Atomic Habits | Missing | Eligible English, 315 | Stage: permission unconfirmed |
| 7 — It Ends With Us | Missing | Eligible English, 1,212 | Stage: permission unconfirmed |
| 8 — The Subtle Art of Not Giving a Fuck | Missing | Eligible English, 470 | Stage: contribution/permission unconfirmed |
| 9 — Control Your Mind and Master Your Feelings | Missing | Eligible English, 1,182 | Stage: permission unconfirmed |
| 10 — Harry Potter and the Philosopher's Stone | Missing | Eligible English, 683 | Stage: permission unconfirmed; narrative excerpt present |

The eight structurally eligible descriptions are all English. A Finnish Edition
did not supply an eligible Finnish description. No markup was stripped, text
rewritten/translated, notes substituted or original language changed.

The official [Open Library licensing page](https://openlibrary.org/developers/licensing)
still flags possible pre-existing rights. Actual saved records do not establish
a permission basis for these display writes. Linked encyclopedia/author pages
are origin leads, not an exact licensed revision or completed attribution plan.
The matching current encyclopedia prose is not identical to the cached text;
do not assert an exact source match without evidence. None is marked approved.

The accepted `review` command generated a **reviewed packet with zero entries
and ten skips** (eight permission holds, two text-policy exclusions). No `apply`
or `verify` batch command was run, and no empty batches were sent. The target of
six approved usable descriptions was **not met**. Preview/review completion is
not description-import or native-usefulness acceptance.

### Controlled checkpoint and continuation

`Kajo-book-description-pilot-v1.zip` is the owner-controlled checkpoint. It holds
the original claim, all twenty raw responses/record and text hashes, attempt
ledger, fallback/content/text decisions, before/final coverage and rollout
evidence. Real descriptions, raw records, database identifiers and review inputs
remain outside Git. The local run is `dist/catalog-enrichment/book-pilot-v1`.
Recover the saved run before any future action; never create another pilot to
reset its counters or fetch the same candidates again.

One local fallback invocation stopped on a stale operation lock before any
request. The completed preview's records, hashes, prepared status, zero Work
attempts/batches and process exit were reconciled before archiving that lock;
the same claim/state then completed its ten Work calls. The fallback command
reported no lock after successful exit, but a subsequent tool snapshot again
contained that lock. Its completed state was reconciled before the no-I/O review.
This observed persistence limitation is recorded without claiming a source-code
defect. Restored locks require the same explicit reconciliation; never delete
the global claim or turn a failed/uncertain operation into success.

Next complete a bounded **cached-source permission and attribution packet**.
Prioritize exact origin/revision and license evidence for the existing candidate
texts, determine required public credit/license links, and review the actual
display contract/UI before approving any text. Resolve unknown permissions with
documented evidence or keep them staged. Do not change the normalizer simply to
meet the target or begin a broad dump/API pass first.

The run is already `reviewed` with zero entries. The current CLI intentionally
does not reopen reviews. If a later decision approves cached text, use a reviewed
and tested amendment workflow retaining the original decisions, hashes, spent
attempts and zero batch history; do not edit its status back to `prepared`.
Refresh the exact SQL baseline and prepare a guarded description-only rollback
before any write. Actual apply still belongs to the configured admin runtime;
no privileged credential was available in this workspace and none was retrieved.
Do not bypass that boundary through SQL HTTP/vault or new admin endpoints.

Validation: accepted PR #254/CI #501 remains the runtime source/native proof.
This documentation PR runs the normal required CI gates; #182 owns their outcome.
Hosted readback, anonymous HTTP denial, all twenty
provider receipts, actual normalization/review and unchanged catalog comparison
are new evidence. No device test, APK dispatch, new model admission, native
forward or catalog-import v12 redeployment occurred. Documentation links and
whitespace passed separately before publication (36 local links across four
changed Markdown files). #182 / MVP-CAT-001..003 /
Phase14.3, broader dump coverage, curated mapping, rights and native usefulness
stay open; the completed MOVIE budget and #229/D2 decisions are unchanged.

## BOOK description implementation — 2026-09-14 / #182

Branch `feat/182-book-description-refresh` starts from accepted planning PR #253,
main `1ea3a8c64beff8571bde4dc39cf73c30fc68b944`. This packet implements the
[guarded contract](../../architecture/ARCHITECTURE.md#book-description-enrichment--guarded-contract-182)
and the frozen pilot below. [Issue #182](https://github.com/Kajooja/Kajo/issues/182)
owns the exact PR/head/CI/merge result. This is source acceptance; the migration,
candidate provider reads and description writes have not run against the hosted
project. Read-only SQL on 2026-09-14 confirms the earlier BOOK/MOVIE baseline.

### Delivered behavior and deliberate implementation choices

- `open-library-descriptions.mjs` accepts only typed/plain `description`, applies
  NFC/plain-text/size bounds, verifies exact Edition/Work linkage and hashes raw
  records/text. Missing notes-only records stay missing. Verified description
  language is separate from the selected Edition and original language.
- `import-open-library-descriptions.mjs` supplies `plan`, `preview`, `fallback`,
  `review`, `apply` and `verify`. The fixed manifest is tested against the SQL's
  ten UUID/Work/Edition/language tuples. `plan` has no I/O or credential need.
  Preview uses provider reads only; it collects ten Editions, then pauses for
  actual review before fetching any fallback Works. This implements the planned
  Edition-first preference without assuming description language from Edition
  metadata or spending fallback requests on already acceptable text.
- One exclusive pilot claim under ignored `dist/catalog-enrichment/`, plus an
  exclusive per-run lock and atomically replaced checkpoints, prevents parallel
  starts/reset budgets in different run directories. Every request is recorded
  before transport. There are at most twenty sequential starts spaced 1,100 ms,
  a 15-second response deadline and 1 MiB decoded limit. A 404 is sparse; a
  redirect, identity/JSON/encoding failure, 429, 5xx, timeout or network error
  fails the run. No automatic retries, replacements or counter reset.
- Review binds the actual record/text hashes, explicit fi/en text language,
  contribution/use permission basis and fresh SQL Item/source identities and
  versions. The public provenance contains the basis hash; the private source
  envelope contains its bounded explanation. Unknown language/permission stays
  skipped/staged. Raw records, real descriptions and reviewer files stay ignored.
- CLI-created forward `20260914060616_book_description_refresh.sql` adds named
  two-argument overloads at the existing canonical Item/batch boundary, with no
  default mode. The batch accepts 1–10 distinct Item/source identities and locks
  Items, sources, then aliases in deterministic order. The narrow Item overload
  also validates/locks when called directly. It changes only description, its
  provenance and the private envelope plus automatic update timestamps. Calling
  the old full writer would normalize existing arrays/title again, so the narrow
  Item overload is the canonical implementation of the preserving mode.
- Equal text/source revision/review identity returns a read-only `unchanged`,
  including an older expected row version. New fetch time/raw-record hash alone
  does not rewrite existing evidence. A changed text needs exact current Item
  and source versions. Identity/lifecycle checks still precede no-op. Legacy
  Search Work and dump Edition imports reject managed refreshes under the same
  Item lock; unmanaged imports remain supported. All signatures are invoker,
  empty-search-path and service-role-only; PostgREST receives schema reload.
- Apply rebuilds and checks the reviewed packet before transport. Positions 1–5
  and 6–10 are separate atomic requests, each with exact index/UUID/outcome ACKs.
  `verify` requires a fresh SQL report: catalog/nonpilot fingerprints, all ten
  identities/core/source fields and actual description SHA-256/provenance must
  match. Batch 2 is blocked until batch 1 readback passes. The run completes only
  after the second readback. A lost/malformed response or checkpoint after a
  possible commit consumes the batch as `unknown-write-outcome`; no auto replay.

### Operator continuation after source/rollout acceptance

Review/apply only the new catalog migration after checking the current hosted
catalog definitions/ACLs. Do not replay the six native forwards or deploy the
unchanged v12 Edge function. The Supabase connector does not expose a privileged
catalog import invocation or secret retrieval; do not work around that boundary
through SQL HTTP/vault/new endpoints. Use the already configured admin runtime
for `apply`, with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; provider-only
commands need neither. No new key setup is required by this packet.

The commands below are the operational sequence, **not completed provider work**.
Run from the repository root. Run paths must be under the ignored staging root.

```bash
npm run catalog:book-descriptions -- plan
npm run catalog:book-descriptions -- preview --run dist/catalog-enrichment/book-pilot-v1
npm run catalog:book-descriptions -- fallback --run dist/catalog-enrichment/book-pilot-v1 --review dist/catalog-enrichment/book-pilot-v1/fallback-review.json
npm run catalog:book-descriptions -- review --run dist/catalog-enrichment/book-pilot-v1 --review dist/catalog-enrichment/book-pilot-v1/text-review.json --baseline dist/catalog-enrichment/book-pilot-v1/before.json
npm run catalog:book-descriptions -- apply --run dist/catalog-enrichment/book-pilot-v1 --batch 1
npm run catalog:book-descriptions -- verify --run dist/catalog-enrichment/book-pilot-v1 --baseline dist/catalog-enrichment/book-pilot-v1/after-batch-1.json
npm run catalog:book-descriptions -- apply --run dist/catalog-enrichment/book-pilot-v1 --batch 2
npm run catalog:book-descriptions -- verify --run dist/catalog-enrichment/book-pilot-v1 --baseline dist/catalog-enrichment/book-pilot-v1/after-batch-2.json
```

Inspect the saved `preview.json` and source records before writing review inputs.
Skip `fallback` entirely if no Work lookup is needed; each selected Work can be
fetched once. `fallback-review.json` is an array of positions, Edition
`recordSha256`/`textSha256` (null for missing text) and a reason from
`edition-missing`, `edition-language`, `edition-rights`, `edition-unsuitable`.
`text-review.json` contains exactly one decision for each of the ten positions:

| Decision | Required fields in addition to `position` |
| --- | --- |
| Accept reviewed text | `choice: "edition"` or `"work"`, exact chosen `recordSha256`, `textSha256`, `textLanguage: "fi"` or `"en"`, `rights: "approved-for-pilot"`, actual 20–1,000-character permission/use `basis` |
| Leave staged | `choice: "skip"`, nonblank `reason` (max 200 characters) |

Run `scripts/catalog/book-description-coverage.sql` at each named checkpoint and
save its **`book_description_coverage` object**, not the SQL client's row wrapper,
as the corresponding private JSON file. The query now exports source UUID/current
version, description SHA-256 and prior description/provenance/envelope in addition
to the unchanged preservation fingerprint definitions. Retain complete controlled
preimages for the reviewed guarded rollback procedure below. No rollback switch
clears managed fields automatically. Do not delete a failed run's pilot claim,
edit an ambiguous batch to completed, or invent a new run to reset the budget.
Read back exact identities/text hashes/versions and record reconciliation plus
the remaining-attempt decision in #182 before any further operation.

### Verification and remaining gates

Local root `npm run check` passed 411 tests, lint/typecheck and both Hermes
exports. Catalog fixtures cover bounds, notes exclusion, text/Edition languages,
hash-bound review, Work fallback, rate/timeout/budget stops, packet tampering,
exact/unknown ACKs and enforced readbacks. Full-schema PGlite fixtures cover a
populated catalog upgrade, exact preservation (including unsorted arrays/title),
stale Item/source versions, conflicting aliases/lifecycle, atomic rollback,
no-op/changed refresh, ACLs and both legacy replay paths.

Required CLI CI adds the same populated upgrade/smoke on the pinned native
Supabase stack. Independent service-role sessions must visibly wait for actual
row locks: reversed input batches update once/no-op once, while a waiting legacy
refresh is rejected. Real PostgREST must reject the mode on the older schema,
resolve the new overload with exact read-only replay ACKs and deny anonymous
access. Source/CLI migration-history/native-platform gates remain required;
Issue #182 records their actual result rather than treating PGlite as concurrency
proof. Local dependencies use the existing archive cache after all eleven frozen
Edge SHA-512 checks; CI uses its normal dependency path. The existing unrelated
mobile Hook lint warning remains.

Initial source CI #500 passed validate/platform/fresh-install/populated-upgrade
but failed in native concurrency fixture cleanup: catalog source foreign keys
restrict Item deletion. The fixture now deletes its synthetic aliases/sources
before Items, also checks committed cleanup in PGlite, and preserves any earlier
probe error if cleanup fails. The application migration is unchanged. Corrected
head/CI acceptance is recorded in #182; the failed run is not native acceptance.

The updated read-only coverage query executed at
**2026-09-14T06:34:32.501146+00:00**: BOOK 415 visible / 427 stored, 385 images,
zero descriptions; MOVIE 425 visible / 437 stored, all 425 images/descriptions.
All ten identities and source UUID/version fields match; all existing preservation
fingerprints are unchanged. Query SHA-256:
`e4803671f63815416202a733d6ca9f97ddc429880e571bdab61cc1ebc6919278`.
Catalog forward SHA-256:
`c592fd19949eb6a5484711bc9c73a35b596c163175896c60d7bcc6a654652188`.

No hosted DDL/deploy, candidate GET, description write, device test or APK
dispatch occurred. Source success does not supply a per-record rights decision,
pilot coverage, native rendering/attribution, broader dump coverage or curated
identity mapping. #182 / MVP-CAT-001..003 / Phase 14.3 stay open. The completed
MOVIE cap, #229 native gates and rejected D2 challenger admission are unchanged.

## BOOK description plan — 2026-09-13 / #182

Planning branch: `docs/182-book-description-plan`, based on accepted
`f8ed71db6186ee9f810d985462119cf7085e1f08` / PR #252. The completed diagnostic
rollout is catalog-import ACTIVE v12, with exact five-file readback and unchanged
425-movie coverage recorded in [#182](https://github.com/Kajooja/Kajo/issues/182).
Do not repeat its CI/deploy/import sequence. This packet adds a reviewed BOOK
contract and read-only coverage query; it does not implement/apply that contract.

### Observed data and source gaps

Hosted read-only audit at **2026-09-13T22:03:54.804507+00:00**, followed by the committed
final query at **2026-09-13T22:16:34.12922+00:00**, found:

- **415 discoverable / 427 stored BOOK Items**, 385 covers and zero descriptions.
- All 385 Open Library Items have one matching Work alias, a matching metadata
  mirror/source key and a selected Edition key. No saved Search payload contains
  `description` or `notes`; the Search normalizer explicitly returns null.
- Display-Edition languages are eng 336, fin 39, swe 3, spa 2, and fre/ita/por/tur/yid
  one each. These are not original-language or description-language counts.
  All 385 provider Items have unknown original language. The historical 57 Finnish
  edition-availability count is a different measure from 39 selected Finnish editions.
- All 30 original curated BOOK Items have only `kajo_curated_slug` aliases.
  They retain their original UUIDs and 2026-09-04 creation times. The query lists
  them for a later exact identity review; exclude them from this pilot.
- MOVIE remains 425 discoverable / 437 stored, all 425 with images/descriptions.
  Discoverable mocks remain zero.

The bulk importer currently consumes ratings and Editions, not Work descriptions;
its normalizer can substitute `notes` and treats Edition language as original
language. Neither behavior belongs in the new description contract. Its raw
error-body echo and unverified successful-count fallback, also present in Search
orchestration, must not be copied into new orchestration.

The deployed single-item upsert confirms full replacement of description and
metadata (definition MD5 `26418016af759bce2e580fdd7d3236a2`);
the batch wrapper is `abd9f4d40e35096d1cc1a9fa2a39e497`. A description-only entry
would clear unrelated fields. Implement the guarded overload described in
[Catalog architecture](../../architecture/ARCHITECTURE.md#book-description-enrichment--guarded-contract-182)
before any write. Current RPCs and six installed native forwards were not changed.

### Frozen first pilot — open-library-description-pilot-v1

Select five fin and five eng display Editions from existing alias-verified Items,
ordered by stored popularity descending then Work ID inside each group. This
selection was frozen from the audit; later checkpoints retain the exact identities
even after their descriptions change. It is a technical/quality pilot, not a
representative catalogue sample or evidence about original language.

| Order | Current title | Canonical Item UUID | Work ID | Selected Edition ID | Edition language |
| --- | --- | --- | --- | --- | --- |
| 1 | Pieni elämä | `a7f6d2cd-e290-4bc4-97b7-cf1180ea86b9` | `OL17370186W` | `OL26433779M` | fin |
| 2 | Ei enää ihminen | `43c6e886-0858-4f3e-b188-72cc62b6dfbc` | `OL3923952W` | `OL44944392M` | fin |
| 3 | Rikos ja rangaistus | `25fa7fee-2a4d-4b8e-9c63-f9f6f367aff9` | `OL166894W` | `OL16835710M` | fin |
| 4 | Romeo ja Julia | `6aa4020d-fdfa-4010-ad8d-2217c71f06f8` | `OL362427W` | `OL26501345M` | fin |
| 5 | Ajan lyhyt historia | `9d8a5234-5565-4f42-aa77-30422e780419` | `OL1892617W` | `OL39218444M` | fin |
| 6 | Atomic Habits | `ccbdb717-0a27-4099-8b56-64b3c5f9aaed` | `OL17930368W` | `OL27918581M` | eng |
| 7 | It Ends With Us | `b54ebb75-2e4c-48e1-8349-5f73bf0d789b` | `OL18020194W` | `OL27213498M` | eng |
| 8 | The Subtle Art of Not Giving a Fuck | `c3548ac2-ae85-4ee6-aeeb-8101fa909fb1` | `OL17590212W` | `OL27351482M` | eng |
| 9 | Control Your Mind and Master Your Feelings | `4af3c2b6-7a8a-4107-b198-ac0ed0afa2c9` | `OL25312237W` | `OL33899062M` | eng |
| 10 | Harry Potter and the Philosopher's Stone | `fad9046f-f67a-42f2-9fb8-57657035593e` | `OL82563W` | `OL59004869M` | eng |

No substitutions, title search, new Items, new aliases or Edition enumeration.
If a selected Edition now links to another/multiple Works, stop and review the
identity conflict; do not repair it inside this pilot.

| Pilot resource | Hard cap |
| --- | ---: |
| Existing canonical candidates | 10, exactly as above |
| Provider GET attempts | 20 total: at most one selected Edition + one exact Work per candidate |
| Concurrent provider requests | 1 |
| Minimum spacing | 1,100 ms between request starts; respect Retry-After before any later explicit resume |
| Per-response timeout / decoded JSON size | 15 seconds / 1 MiB |
| Automatic retries / redirect follows / replacement candidates | 0 / 0 / 0 |
| Reviewed database batches | At most 2, positions 1–5 then 6–10, each atomic |
| Entries written / new Items / alias additions | At most 10 / 0 / 0 |

These are proposed pilot limits, **not operations performed in this planning
packet**. Documentation lookups and read-only SQL are separate from the future
candidate GET ledger. Inspect the exact Edition first; fetch its Work only when
the selected description cannot be used, within the same cap. Every started
attempt consumes its slot even on failure. A resumed failure needs an explicit
revised remaining-attempt ledger; never silently reset counters. A successful
ten-candidate pass does not authorize another 375 single-book API sweep.

Use the application's honest User-Agent/contact identification and the default
one-request/second tier; do not assume a repository URL grants the provider's
higher identified tier. Collect and cache provider records before review and
before opening database transactions. Dry-run planning performs no I/O;
preview performs only the bounded provider reads and reports no writes.

### Review, apply and continuation

1. Implement/test the strict text normalizer, no-write planner/preview and
   guarded generic batch mode from the architecture contract. Keep current
   Search/dump writes from clearing managed descriptions. Old deployments must
   reject the top-level refresh mode. Accept source/CI and review the exact
   catalog-only migration/rollout before using it; no new credential setup or
   unrelated function/native rollout is part of this work.
2. Run `scripts/catalog/book-description-coverage.sql` and existing
   `catalog-coverage.sql`. Require all ten `identity_matches=true`; preserve the
   complete per-Item/source preimage in controlled admin staging for guarded
   rollback. Keep only IDs, hashes, counts and decisions in Git/#182.
3. Prepare a frozen preview with source record URLs/revisions/hashes, candidate
   text hashes, source/fallback, text-language review and actual attempted-call
   ledger. Review fitness and contribution/use rights before any display write.
   Unknown permission/language, notes, markup, absent or rejected text stays
   staged/skipped with fixed reasons. A 404 is a sparse result; transport/rate
   limit/JSON/identity errors stop. Do not fabricate Finnish copy or claim
   Edition language proves the text's language.
4. Apply only approved candidates from positions 1–5 through the guarded mode.
   Require exact returned input-index/UUID mapping for every acknowledged row.
   Compare the SQL report before proceeding to positions 6–10. A malformed/lost
   acknowledgement is an unknown write: stop and reconcile actual hashes/versions.
   Never automatically replay the batch or continue after uncertainty.
5. After each batch, require unchanged stored/discoverable counts, all ten
   identities, all `preservation` fingerprints, each pilot `core_md5` and
   `source_base_md5`. The query allows only pilot description/provenance/envelope
   plus automatic timestamps to change. Record added, unchanged, skipped and
   uncertain counts separately. Use `catalog-coverage.sql` to recheck service
   privileges. Hashes detect drift; they are not authorization tokens.
6. The pilot's working usefulness target is **at least six reviewed, usable
   Finnish/English descriptions out of ten**, with every candidate accounted for,
   exact identity preservation and no data loss. Record actual Finnish/English
   text counts and every fallback. Missing the target is a valid failed-coverage
   result; no automatic extra requests. Native rendering/attribution acceptance
   remains separate from normalized text/SQL success.
7. After pilot review, plan the remaining exact Work/Edition join from one
   pinned monthly dump release, streamed against the existing target IDs.
   Description enrichment needs no rating-history input or new popularity ranking.
   Pin source checksums/revisions and use the same guarded mode/checkpoints.
   Default to filling missing text; changed owned text is an explicit reviewed
   refresh. Missing upstream text never erases current text. No recurring
   scheduler is enabled by this plan.
8. Review the 30 curated identities separately using authoritative Work/Edition
   linkage and creator/edition evidence. Their current title/author is a search
   aid, not permission to attach an alias. No fuzzy duplicate creation.

Rollback restores only the prior description/provenance/source envelope on the
same Items, and only while current hashes/versions still equal this pilot's
writes. Retain canonical sources/aliases and all user history. A concurrent edit
or uncertain write requires reconciliation; do not restore entire old Item rows.

### Required implementation verification and remaining gates

Next source packet needs meaningful fixtures for typed/missing/markup/oversize
descriptions, Edition-vs-text language, Work fallback, notes exclusion, preserved
presentation/popularity fields, conflicting/redirected IDs, old-server rejection,
stale/concurrent source/Item versions, identical rerun/no-op, legacy BOOK refresh
preservation, atomic rollback, lost acknowledgement, call-budget exhaustion,
404/429/5xx/timeouts, strict UUID receipts and secret/error-body redaction.

Local `npm run check` passed **396 tests**, lint/typecheck and both Hermes exports.
It used the existing loopback package-archive cache after verifying all eleven
archives against the unchanged frozen Edge lock SHA-512 values; normal CI remains
required. The existing unrelated mobile Hook lint warning remains. Changed
Markdown file/anchor links and all ten SQL/Sprint identity mappings passed.
The final read-only SQL executed successfully; all ten identities match, and
inventory/provider/language/preservation values equal the first query's report.
Only the source-base fingerprint was strengthened to cover all preserved source
fields as well as its original payload; no stored value changed. Exact source
CI/merge and the full SQL checkpoint belong to #182. No Work/Edition
candidate API calls, provider imports, description writes, schema changes,
deployment, native tests or APK dispatch occurred in this packet. Broader
rights/attribution, BOOK completeness, bounded refresh and native usefulness keep
#182 / MVP-CAT-001..003 / Phase 14.3 open. #229 and rejected D2 challenger admission
are independent and unchanged.

## Catalog expansion verified and failure diagnostics — 2026-09-13 / #182

The PR #251 source is accepted on main
`f462aaa20e3a65899452be847ee9ff3af22f167d`; catalog-import v10 is ACTIVE.
The completed hosted pass has **425 discoverable MOVIE Items with complete
TMDB core metadata/images/descriptions**, all 30 original curated identities
preserved, and all eight declared expansion coverage checks passing. Coverage
was read at 20:51:19 UTC; original UUID/IMDb/creation-time identity was independently
rechecked at 20:54:38 UTC. The final documentary page added 18 Items/refreshed two;
all 20 of its posters returned HTTP 200 / image/jpeg.

English (259) and Finnish (60) are the two largest original-language groups
(75.1% together), matching the owner's catalogue emphasis. Non-English coverage
is 166; Finnish production is 60; seven languages have at least ten movies.
The five era counts are 66/55/74/79/151; sixteen genres have at least fifteen
movies; documentaries total 22. BOOK remains 415 discoverable, 385 images and
zero descriptions. Native image/Taste quality and rights/refresh remain open.

The actual bounded pass used 18 request attempts with 28 verified page fetches,
including a Korean repeat. Spanish page 1 was deferred to preserve the cap.
A subsequent science-fiction request failed without observed committed writes;
its exact fetched-page progress is unknown, so its entire two-page allowance is
reserved. The final documentary request consumed the last slot. No more imports
are authorized by this completed 18-request / 30-page plan. The exact response
ledger, original 29-gap identity table and final 30-identity check belong to
[Issue #182](https://github.com/Kajooja/Kajo/issues/182).

### Narrow diagnostic source packet

Branch `fix/182-catalog-import-diagnostics` addresses the generic failure
receipt, not a proven cause of the observed science-fiction error. The existing
HTTP 502 / `provider-import-failed` remains, with additive
`diagnostics.version=catalog-import-diagnostics-v1`. Success and authorization
contracts, fixed selection budgets, FI/EN normalization and canonical atomic
per-page upsert semantics remain unchanged.

| Diagnostic field | Meaning |
| --- | --- |
| `stage` | Fixed Discover, Find, detail, English fallback, normalization, catalog-upsert or unexpected import stage |
| `reason` | Fixed HTTP, timeout, network, JSON, response-shape, identity, metadata or unexpected-error category |
| `httpStatus` | Upstream numeric response status when observed; otherwise null |
| `completedPages` | Fully processed pages whose writes were acknowledged; an all-skipped/empty page may complete without a write |
| `failedPage` | Current page, or null for exact-IMDb enrichment |
| `confirmedImportedCount` / `confirmedSkippedCount` | Counts from the confirmed completed-page prefix; upserts are not unique growth |
| `writeOutcome` | `not-started` for the current failed unit before a write; `unknown` when its write acknowledgement failed |

A request that fails on page 2 after page 1 committed reports page 1 and its
confirmed counts. A database timeout/malformed acknowledgement on page 2 cannot
prove rollback and never reports that page complete. The CLI validates the
version, fixed fields and progress against the requested page prefix before
emitting a failed checkpoint; old generic errors remain supported. Extra/raw
server fields and unknown codes are not reflected. It stops before any later
request or retry. Progress is scoped to this request; earlier request checkpoints
remain separate. If no valid receipt arrives, progress remains unknown.

The shared module is `_shared/catalog-import-diagnostics.mjs`; both Edge and
CLI consume it. Deployment preparation now verifies all five shipped files with
a fresh Deno cache and npm/remote imports disabled. Fixtures cover stage/status
classification, secret reflection, malformed/timeout responses, all-skipped
pages, retained first failure under concurrency, and an acknowledged first page
followed by a potentially committed but unacknowledged second write.

Local `npm run check` passed **396 tests**: 212 mobile, 25 catalog, 28 Edge,
61 database, 43 engine, 19 Python research and eight Node research, plus
lint/typecheck and both Hermes exports. The existing mobile Hook lint warning
remains. Direct Deno registry access failed with connection refused; the successful
root run used the existing loopback archive cache after verifying every one of
the eleven packages against the unchanged frozen Edge lock SHA-512 values.
No dependency, lock or repository gate was weakened; normal CI must also pass.
The exact final five-file payload independently passed **26 catalog HTTP cases**
with a fresh cache and npm/remote imports disabled.

Prepared payload SHA-256:
`c5e5a4adceeebd2b87d30f1b74dc972a64d52e93ebdaddf13ee6e3aaa7ff09e5`.
Entrypoint SHA-256:
`6469138981a0a7463ad884c017519de875cd5603473894458b1503433727faa3`.
Diagnostic module SHA-256:
`48c80ec66eef1bd186ecb0b4f631eed8a5577639e2c0eb599b2f252c9d110858`.
Normalizer, selection plan and function-local configuration contents are unchanged.

The official [Supabase error-handling guide](https://supabase.com/docs/guides/functions/error-handling)
and [logging guide](https://supabase.com/docs/guides/functions/logging) were checked
on 2026-09-13. Current source fixtures and required root/CI results belong to the
PR/#182 checkpoint. Source changes do not retroactively diagnose the old failure;
hosted rollout is a separate verified step. No provider call, secret request,
account reset, schema change or unrelated native rollout is needed for this packet.

## Balanced TMDB expansion and curated enrichment — 2026-09-13 / #182

Source packet: `feat/182-tmdb-balanced-expansion`, from accepted PR #250 main
`95d2a32ecebb704bc4b7d8105dd2d7552e81accd`. This prepares the exact next catalog
unit. The old canary is complete; no new hosted import/deployment, DDL, account
reset, model admission or APK operation is implied by source acceptance.
Issue #182 records actual source CI/merge and subsequent hosted execution.

### Bounded selection and working targets

`supabase/functions/_shared/tmdb-import-plan.mjs` owns the executable versioned
selection contract. Changing bucket meaning/budget requires a new reviewed
contract version. All requests use Finnish metadata with English fallback and
FI regional release eligibility. A separate fixed `asOf` bounds release dates;
provider popularity/content may change between requests, so this is not a frozen
provider snapshot. The `finnish` bucket means original language `fi`, not an
inferred production country. Coverage reports Finnish production separately.

| Selection | Pages | Minimum votes | Provider filters |
| --- | ---: | ---: | --- |
| Finnish-language | 3 | 10 | original language fi |
| Before 1990; 1990s; 2000s; 2010s; 2020–asOf | 2 each | 40 | primary release-date ranges |
| Swedish, French, German, Japanese, Korean, Spanish | 1 each | 40 | original language sv/fr/de/ja/ko/es |
| Animation, comedy, thriller, horror, science-fiction | 2 each | 40 | fixed TMDB genre IDs |
| Documentary | 1 | 40 | fixed TMDB genre ID |
| **Total** | **30** | per bucket | **18 sequential requests; at most 600 raw candidates** |

This lower Finnish-language vote floor avoids applying the international-volume
threshold to a smaller language catalog. It is a coverage choice, not a quality
score or a recommendation-weight change. Popularity orders within each bucket;
primary-year, original-language, genre and vote filters are rechecked against
details before admission. New paths require title, description, valid poster path,
director, tags, original language, primary date, runtime, vote count, popularity
and IMDb alias. Missing/off-filter records are counted as skipped. Ambiguous IDs,
malformed pages and provider/DB errors stop the request; no fuzzy title merge.

These are **working targets for reviewing this expansion**, not preclaimed results:

- at least 300 discoverable TMDB Items with core metadata;
- at least 25 Finnish-language and 90 non-English movies;
- at least six original languages with ten complete movies each;
- at least 25 complete movies in each of the five era bins;
- at least eight normalized genres with fifteen complete movies each, plus ten documentaries;
- all 30 existing curated movies enriched with their existing canonical identity.

`tmdb-expansion-coverage.sql` reports every target and the underlying counts.
Genres overlap, while canonical Items/eras/languages are not duplicated by source
rows. The existing `catalog-coverage.sql` separately checks provider aliases,
BOOK inventory, mock suppression and privileged RPC access. Missing a target
keeps acceptance open: inspect gaps and choose a new bounded follow-up. Never
silently expand page budgets, lower thresholds or claim provider ranking is
representative of user taste. Rights/attribution and native image/quality gates
remain separate even when every inventory target passes.

### Exact execution order

1. Accept source after required CI, generate the four-file deployment packet with
   `npm run catalog:prepare-deployment`, review/read back the exact catalog-only
   rollout. Keep `verify_jwt=false` and the existing proven server-key boundary.
2. Run both read-only coverage queries. Compare with the last checkpoint before
   sending anything. The 2026-09-13 11:37:42 UTC report is 49 discoverable movies,
   20 complete TMDB movies, only English, era counts 1/1/0/0/18 and 29 curated gaps.
   Every gap has exactly one IMDb alias; zero matching ambiguity was observed.
3. Enrich the remaining curated movies first. The exact IDs below produce three
   sequential requests of 10 + 10 + 9, each fully resolved/validated before one
   atomic canonical batch upsert. Expected result: 29 enriched existing Items,
   49 discoverable movies retained, all 30 curated movies provider-backed.
   Counts and IDs must be verified; this is an expectation, not a hosted result.
4. Execute the 18 bounded discovery buckets, with before/after checkpoints.
   Start with Finnish-language, then era, other-language and genre coverage.
   A successful first bucket is an inspection checkpoint before the rest.
5. Record actual unique inventory, overlap/skips, full metadata/aliases, all
   remaining gaps, locale fallback and bounded poster checks. Require a later
   real-device catalog/Taste check; do not equate CDN success with native UX.

The CLI dry-runs below read no credentials and perform no network/DB I/O:

```bash
npm run catalog:tmdb-beta -- --imdb-ids tt2543164,tt1856101,tt1160419,tt15239678,tt0338013,tt6710474,tt0137523,tt0109830,tt0172495,tt2267998,tt1798709,tt1375666,tt0816692,tt3783958,tt1392190,tt0209144,tt15398776,tt6751668,tt1392214,tt0110912,tt0114369,tt0468569,tt0120737,tt0167260,tt0167261,tt0133093,tt0482571,tt0102926,tt2582802 --as-of 2026-09-13 --dry-run
npm run catalog:tmdb-beta -- --balanced-plan --as-of 2026-09-13 --dry-run
npm run catalog:tmdb-beta -- --bucket finnish --as-of 2026-09-13 --dry-run
```

After reviewed rollout, use the printed `batches` bodies in the already working
owner Test view, or remove `--dry-run` in an authorized admin environment.
For the first Finnish inspection, use `--bucket finnish`; then execute remaining
named buckets once rather than rerunning the whole balanced plan. `--bucket ID`
accepts `--start-page`/`--pages` within that bucket's fixed budget for recovery.
Never repeat the completed old unfiltered page-1 canary. New actions are
`tmdb-movie-bucket-v1` and `tmdb-movies-by-imdb-v1`; older hosted code returns
unsupported-action before I/O instead of silently dropping new filters.

The runner prints a safe starting/completed checkpoint with exact request and
validated response selection identity. An error/timeout stops further requests.
Earlier page/batch writes may already be committed; recheck coverage/source sync
before a manual retry. Do not claim all-or-nothing for the entire multi-request
plan. Exact source/alias upserts are repeat-safe but provider pages may move.
Invocation redirects are rejected and calls have explicit transport deadlines.
No secret values enter request logs or Git. Configuration, sign-in, initial
preflight and provider token already work and are not prerequisites to repeat.

Provider semantics were checked against the official
[TMDB Discover reference](https://developer.themoviedb.org/reference/discover-movie)
and [Find by ID reference](https://developer.themoviedb.org/reference/find-by-id).
FI localization/region is distinct from original-language selection; era buckets
use primary dates so regional rereleases cannot redefine a film's original era.
Local fixture/SQL validation and later CI are recorded in Issue #182.

### Source verification

`npm run check` passed **387 tests** (212 mobile, 21 catalog, 23 Edge,
61 database, 43 engine, 19 Python research and 8 Node research), lint/typecheck
and both Hermes exports. The existing mobile Hook lint warning remains.
The workspace's Deno registry connection failed; the successful full run used
already downloaded npm archives through a loopback registry cache, verifying all
eleven archives against the unchanged frozen Edge lock SHA-512 values first.
No dependency, lock or repository check was weakened. Ordinary hosted CI must
also pass. Actual final deployment files separately passed **21 catalog HTTP
cases** with a fresh Deno cache and npm/remote imports disabled.

Final four-file payload SHA-256:
`b6f440baf81ea326ac5c4144179a9655406cd1817ef911b18a14a8304d8e93f5`.
Entrypoint SHA-256:
`84671a86435c385f9476890a7d9f3b3d792cc4241c95517eec8926a89ac39be7`.
Plan module SHA-256:
`25447fc9e4ba9a811db552e185c3f2e78a0dff81fdade13a3e343dd58b846025`.
The existing normalizer and local deployment config are unchanged. The actual
no-I/O balanced plan is 18 requests / 30 pages; the curated plan is 3 requests /
29 identifiers. Read-only hosted coverage executed successfully. No new native
runtime acceptance or broader catalog result is claimed.

## TMDB one-page canary accepted — 2026-09-13 / #182

**The owner-authorized configuration/rollout/preflight/one-page canary unit is
complete.** The owner supplied this successful import body with a response date
of **2026-09-13 11:03:06 UTC**:

```json
{
  "status": "imported",
  "provider": "tmdb",
  "importedCount": 20,
  "skippedCount": 0,
  "pages": [1],
  "language": "fi-FI",
  "region": "FI",
  "minimumVoteCount": 40
}
```

`validateTmdbImportResponse` from the existing CLI accepts the supplied body with
the exact requested page/locale/threshold. The agent did not invoke another
provider import. The committed read-only coverage query and a bounded inspection
of all 20 provider Items independently confirm the stored result; all sources
have `synced_at = 2026-09-13T11:03:06.083766Z`. Provider-token authentication and
the matched modern-key Data API upsert have now worked in the hosted path.
Only the response/result and minimal timing evidence are recorded, not cookies,
request headers, secret values or full provider payloads.

| Measure | Before | After |
| --- | ---: | ---: |
| Discoverable MOVIE Items | 30 | 49 |
| Stored MOVIE Items | 42 | 61 |
| MOVIE Items with images | 0 | 20 |
| MOVIE Items with descriptions | 0 | 20 |
| TMDB source rows / distinct Items | 0 / 0 | 20 / 20 |
| Discoverable BOOK Items | 415 | 415 |
| Stored BOOK Items | 427 | 427 |
| BOOK Items with images / descriptions | 385 / 0 | 385 / 0 |
| Discoverable mocks | 0 | 0 |

The net increase is **19**, not 20: TMDB `278` / IMDb `tt0111161`
(*Rita Hayworth - avain pakoon*) maps to one existing curated Item. Its original
creation time remains `2026-09-04T21:30:52.825771Z`, while the new TMDB source was
created at the import time. The curated source remains attached. Each of the
other 19 Items was created at the canary time. This is observed cross-provider
identity reuse, not an inferred count discrepancy or a new duplicate.

All 20 have nonblank title/description, TMDB poster URL, directors, release year,
original language and normalized genre tags. Runtime, popularity and vote count
are present on all 20. Each provider row has exactly one matching `tmdb_movie`
alias and one matching `imdb_title` alias on the same Item; all 20 provider IDs
and Item IDs are distinct. No matching alias is missing. The source and alias
constraints remain unchanged. Batch RPC EXECUTE remains false for anon and
authenticated and true for service_role.

The agent checked **all 20 stored poster URLs** with bounded parallel HTTP HEAD
requests: every response was **200 / image/jpeg**. This verifies CDN availability,
not rendering/cache behavior on a native device. Stored description previews show
both Finnish text and the existing English fallback; no all-Finnish claim is made.
All 20 original languages are `en`; year counts are 1984: 1, 1994: 1, 2021: 1,
2026: 17. One popularity-sorted page is not a representative cold-start catalog.
Twenty of 49 discoverable movies now have images/descriptions; the other 29
curated movies still need provider metadata. BOOK description coverage is still
zero. Broad catalog, rights/attribution, native quality and MVP acceptance stay open.

Fresh hosted readback remains ACTIVE v9, bundle digest
`9e04d650a398c79c9e0a0ed8e7adefb97c4b45aebfb9b7ee3f2f2f944a01ab88`.
All three contents exactly match accepted PR #248, with `verify_jwt=false` and the
function-local import map. No source/deployment, schema, account or other-function
change was needed for this verification. PR #249's earlier preflight handoff is
accepted on `395b0bf222000377cd04322436e6f398e5f8c1e2` after all five CI #490
jobs passed at `e3aa37ad940412e30ae5f8792f14706b722fafe6`. Older dated sections
below retain what was pending then; they are not current instructions to repeat
configuration, preflight or the completed canary.

**Next bounded continuation — #182 catalog expansion:** prepare a concrete plan
for hundreds of discoverable movies with measured genre/year/original-language
diversity, Finnish/international coverage and the remaining curated metadata.
The existing orchestration can resume after the accepted page 1. This actual
dry-run performed no provider or database I/O:

```bash
npm run catalog:tmdb-beta -- --start-page 2 --pages 14 --pages-per-request 3 --dry-run
```

It yields five requests: pages 2–4, 5–7, 8–10, 11–13 and 14–15, retaining
`fi-FI` / `FI` / minimum votes 40. This is a transport proposal only; it neither
promises 280 unique new Items nor supplies diversity controls. Review the proposed
content mix and source filters before broader import. Any chosen execution stays
bounded, sequential and stop-on-error, with fresh before/after coverage and actual
metadata review. Inspect the latest Issue #182 checkpoint before sending requests
so completed work is not repeated. Source/control improvements needed by the
expansion plan do not depend on an admin key; actual calls use an authorized admin
environment or the now-proven owner Test view. No repeated key setup/sign-in is
needed, and the one-page canary must not be requested again.

Keep #182 and `MVP-CAT-001..003` open for those remaining gates. Do not substitute
native #229/device work, optional dataset research or the later pre-MVP UI packet,
and do not promote the rejected D2 challenger. STATUS names the next bounded
catalog task; Issue #182 records this documentation packet's merge/CI completion.

## Catalog privileged preflight — 2026-09-13 / #182

**The configuration repair and privileged preflight are accepted.** PR #248
merged to main `bd7a23f776e99b452404fef0393155b62d96ade0` after all five
[CI #488 jobs](https://github.com/Kajooja/Kajo/actions/runs/34726762173) passed at
`9884088099635bd60cd0b6bb929b0b5480b97c3f`; the accepted tree
`c2ec468e1359cb7fbbf637ed9eb85119411df07c` matches verified source. APK was
skipped. Root validation passed 377 tests, lint/typecheck and both Hermes exports;
the actual deployment packet replay passed 15 catalog HTTP cases. The older
source-preparation and diagnostic sections below retain their dated pending state,
not the current next task.

The agent deployed the exact three-file repair once as ACTIVE v8. Its verified
bundle digest was
`c5c781a5cbe182b7646c1cf7530afa3a9bc0b84e27d81e30e89adb56728ca3d4`.
The latest pre-canary readback now reports ACTIVE v9, digest
`9e04d650a398c79c9e0a0ed8e7adefb97c4b45aebfb9b7ee3f2f2f944a01ab88`.
All three contents still match accepted PR #248 source exactly, with
`verify_jwt=false` and the function-local import map. The agent did not redeploy
in this continuation; the metadata change's cause is not inferred. Payload and
per-file hashes remain the ones in the recovery checkpoint below.

Real negative HTTPS probes at 2026-09-13 00:07 UTC returned GET 405,
anonymous/synthetic-user/forged-legacy POST 403 and foreign-modern-fixture gateway
401. All POSTs used `invalid-preflight-only`, so no probe could start a provider
import. These synthetic JWT checks are not a real signed-in session test.

The owner subsequently used the supported Dashboard **Test > Headers > Add secret
key** route with the existing Default key. At **2026-09-13 00:23:14 UTC**, the
reported status/body for `{"action":"invalid-preflight-only"}` was exactly:

```json
{"status":"error","code":"unsupported-action"}
```

HTTP 400 here proves configured-key acceptance and reaching body validation;
provider and Data API work have not started. The owner supplied status, body and
response metadata, not the secret request header. Only this minimal result is
recorded; response cookies and unrelated headers are not part of the handoff.
No new key/rotation, repeated presence check or repeated privileged preflight is
needed. The old `invalid-legacy-service-role-key` blocker is resolved by PR #248.

The agent re-ran the committed read-only coverage query after this preflight:

| Inventory | Stored | Discoverable | Images | Descriptions |
| --- | ---: | ---: | ---: | ---: |
| BOOK | 427 | 415 | 385 | 0 |
| MOVIE | 42 | 30 | 0 | 0 |

TMDB source rows and distinct TMDB Items remain zero, and no mock is discoverable.
All 415 discoverable books and 30 movies have creators; release-year coverage is
413 BOOK / 30 MOVIE. Batch EXECUTE remains false for anon/authenticated and true
for service_role. These are dated pre-canary aggregates, not an import result.

**Exact continuation:** use the same owner Test view, keep POST and the successful
secret-key header, and send this already-authorized one-page body once:

```json
{
  "action": "tmdb-movies",
  "startPage": 1,
  "pages": 1,
  "language": "fi-FI",
  "region": "FI",
  "minimumVoteCount": 40
}
```

The owner has been given this request while the agent prepares the resumable
handoff. Check Issue #182 for a later result before sending or retrying it. The
connector cannot invoke functions or read secret values, and the local admin
environment has no privileged invocation credential; the working Dashboard route
keeps the key within Supabase. Do not restart the incomplete browser sign-in.

Require HTTP 200 with `status: imported`, `provider: tmdb`, `pages: [1]`, exact
FI locale/region and vote threshold, and inspect returned import/skip counts.
Those counts alone are not unique catalog coverage. Re-run
`scripts/catalog/catalog-coverage.sql`, inspect actual title/description/poster/
creator/year/language/tags and matching TMDB aliases, and record before/after
changes and any gaps. On an error, preserve the observed response and inspect
coverage before retrying; do not claim provider-token validity from the preflight.
The default 15-page expansion remains outside this initial canary. Keep #182 open
for catalog breadth/quality; no Phase 14/MVP closure is implied by this packet.

The owner requested completion and a handoff resumable with “jatka reposta”.
STATUS names this one active task and Issue #182 owns later owner/runtime results.
Other Edge functions, six installed forwards, accounts, #229 native/device gates,
rejected research challenger admission and the pre-MVP UI queue retain their scope.

## Catalog modern-key recovery — 2026-09-12 / #182

PR #247 accepted the diagnostic source on main
`4fbf5bd8eb0346b18395d633569efc23549c1dc4`, tree
`d4cd56ec1efa4cd92b1a4dabc19d098f1845f306`, after all five CI #486 jobs passed
at `e8125f3381b2fff7947ddb78cd87eef1ac481e35`. The deployment response reported
ACTIVE v6; subsequent readback reported ACTIVE v7 with bundle digest
`c5ce84272cb674e1c0705e03dc27a308e6c4b328be12a8014a547d128e1130ed`.
Only one diagnostic deployment call was made; the metadata difference is recorded
without inferring its cause. All three readback contents match the verified
PR #247 payload, with `verify_jwt=false` and the function-local import map.

The owner supplied a v7 private log at **2026-09-12T23:40:08.656Z**:
`catalog-import configuration failed: invalid-legacy-service-role-key`.
The failed check is now identified: the optional legacy value is not in the
accepted JWT format and blocks the entire configured-key set. Its actual value
and the platform's reason for supplying it remain unknown and are not needed for
this bounded repair. Default modern secret keys are independent of legacy JWT
compatibility, as described in the
[current API-key migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
The owner's existing Default secret key is suitable; creating or rotating keys is
not a prerequisite. Token setup, built-in variable presence and the private-log
request are complete and must not be requested again.

`fix/182-modern-key-legacy-recovery` excludes malformed optional legacy values
only when validated usable modern keys exist. Excluded legacy strings are never
accepted through apikey/Bearer or forwarded to the Data API. Without a usable
modern key, the same malformed legacy input still produces the generic 500 and
fixed private reason. Malformed modern maps and local keys still fail closed;
valid legacy exact matching, modern apikey-only matching, named rotation and
immediate revocation remain unchanged. No role claim authorizes a request.

The HTTP regression exercises named Default/rotation keys and the optional local
key against two malformed legacy values, including a modern-looking string that
is deliberately absent from the configured modern set. It checks anonymous/user,
publishable, foreign, invalid-legacy and modern-Bearer rejection before I/O, then
normalized import with only the matched modern apikey forwarded. Existing generic
configuration/redaction tests retain invalid-legacy-only and empty-modern-map
failure coverage. The catalog still has no external runtime packages.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed 377 tests, lint/typecheck and both
Hermes exports; the existing mobile Hook warning remains. Deployment preparation
passed all 15 catalog HTTP cases against the actual staged files with a fresh
cache and npm/remote imports disabled. Payload SHA-256 is
`e5e3f85dfe0e76103d7b3c66591395c30cca6ec03796b237da162050f632d4e3`;
entrypoint SHA-256 is
`774b3d3f90d240dd4db49000b00004adc212e732dd1cb7b3d80e27e5601b7157`.
The local config/normalizer hashes remain unchanged. Current-head CI must also
pass before merge and rollout. Issue #182 owns the actual post-merge commit, CI,
deployment/readback and probe checkpoint; inspect it before repeating a rollout.
The earlier diagnostic/v3 sections retain dated evidence rather than current
next-action instructions. No provider import has been performed at this source
checkpoint, and no catalog breadth/MVP gate is closed by this repair.

After configuration recovery and negative request checks, use the supported
owner Dashboard **Edge Functions > catalog-import > Test** path:

1. Choose POST, then **Headers > Add secret key**. The tester defaults to a
   publishable key; the secret-key action adds the privileged `apikey` through
   the Dashboard server proxy. Do not paste any key into chat.
2. First body: `{"action":"invalid-preflight-only"}`. Require 400
   `unsupported-action`; this proves configured-key acceptance without provider
   or database I/O. Share only status and response, not request headers.
3. After that success and fresh read-only baseline coverage, run the already
   authorized canary exactly once with the following body:

```json
{
  "action": "tmdb-movies",
  "startPage": 1,
  "pages": 1,
  "language": "fi-FI",
  "region": "FI",
  "minimumVoteCount": 40
}
```

4. Record returned counts/pages, re-run `scripts/catalog/catalog-coverage.sql`
   and inspect actual movie metadata. One page is the initial canary; the CLI's
   default 15-page expansion is not implied. Keep #182 open for breadth/quality.

The Dashboard path was verified from current official Studio
[tester source](https://github.com/supabase/supabase/blob/26585dd4a4d6db8910a595214c9f6e8fdd206768/apps/studio/components/interfaces/Functions/EdgeFunctionDetails/EdgeFunctionTesterSheet.tsx)
and [header actions](https://github.com/supabase/supabase/blob/26585dd4a4d6db8910a595214c9f6e8fdd206768/apps/studio/components/interfaces/Functions/httpHeaderAddActions.ts).
It has not yet been exercised with this project's privileged key. The connector
cannot invoke functions or read secrets; no local privileged credentials exist.
Use the supported owner path instead of repeating the unfinished browser sign-in.
Other functions, six installed forwards, accounts and the #229 device ledger are
outside this catalog-only packet.

## Catalog configuration diagnostics — 2026-09-12 / #182

PR #246 accepted the v3 rollout handoff on main
`65317c03fde0ee85ce560f61489d3434a79a843f` after all five required CI #484 jobs
passed at `27bd5999da67fc16622a86251f93532528ec6af4`. The owner subsequently added
`TMDB_READ_ACCESS_TOKEN` and confirmed `SUPABASE_URL` and plural
`SUPABASE_SECRET_KEYS` are visible under Edge Functions > Secrets. API Keys shows
a Default secret key. Legacy anon/service-role variables show Deprecated; the
optional singular local-development key is absent. Those setup/presence questions
are resolved. Token validity and runtime key parsing are still unverified.

A bounded anonymous unsupported-action POST after token setup returned the same
500 `server-not-configured`. Fresh pre-diagnostic metadata reports ACTIVE v5,
`verify_jwt=false`, import map enabled, bundle digest
`574dd2d7e2f45f5affddc0a88eec0ce3bf98e036b636fe0880ef3cf57bc26a18`.
All three downloaded source files still exactly match PR #245. No provider call
or new source deployment was performed during that recheck. The earlier v3 hashes
below remain historical deployment evidence, not the latest version number.

`fix/182-catalog-config-diagnostics` makes the existing failure diagnosable through
fixed private-log reason codes. It does not accept previously rejected keys, add
a public diagnostic endpoint or return configuration details in HTTP responses.
Malformed JSON exceptions, key values/names and request data must never be logged.
The real HTTP fixtures verify the unchanged generic 500, no provider/Data API I/O,
and exact redacted log output, including environment-read exceptions containing
synthetic secrets. The catalog still has no external runtime packages.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed 376 tests, lint/typecheck and both
Hermes exports; the existing mobile Hook warning remains. Preparation replayed
all 14 catalog HTTP cases against the actual staged files with a fresh cache and
npm/remote imports disabled. The diagnostic payload SHA-256 is
`0176a96a151103235ef71066556ed32ed7168b5a60c6d1792d4004ebe714787a`;
its entrypoint SHA-256 is
`9e4a6dcdcd332a69124b69c01d095d7b8812930452b1cd00e90091429d6d1b9e`.
The function-local config and normalizer hashes match the earlier packet. These
source checks do not identify or resolve the hosted configuration failure.

The log prefix is `catalog-import configuration failed:`:

| Reason | Failed check |
| --- | --- |
| `missing-supabase-url` | `SUPABASE_URL` is absent or empty in the function runtime |
| `invalid-secret-keys-json` | `SUPABASE_SECRET_KEYS` cannot be parsed as JSON |
| `invalid-secret-keys-object` | Parsed named keys are null, an array or a scalar |
| `invalid-secret-keys-value` | A named key is not a supported secret-key string |
| `invalid-local-secret-key` | Optional singular `SUPABASE_SECRET_KEY` has an invalid format |
| `invalid-legacy-service-role-key` | Configured legacy value is not in the accepted JWT format |
| `missing-server-key` | No modern or legacy server key is available |
| `unreadable-server-key-configuration` | Another environment/key-read operation threw; its exception is suppressed |

After root/current-head checks, publish the verified three-file catalog payload
and verify source readback. Inspect Issue #182 first for a completed deployment.
Trigger only an unsupported-action probe, then open **Edge Functions >
catalog-import > Logs** and filter for the prefix above. **Logs**, not the request
headers/body under Invocations, contains this diagnostic. The connected tool has
no log-read capability, so the owner may send the fixed reason line alone. Do not
ask for environment dumps, screenshots showing key values or credentials in chat.
[Supabase's logging guide](https://supabase.com/docs/guides/functions/logging)
documents the private custom-log view.

Use the observed reason to select the next configuration/source correction. A
Dashboard presence report is not a reason to relax validation speculatively.
Verify anonymous/ordinary-user denial and a privileged unsupported-action request
before the already-authorized `--pages 1 --pages-per-request 1` canary. The owner
has completed token setup; do not repeat it or confuse the preceding Supabase
configuration error with the later `tmdb-not-configured` check. Keep #182 open;
#229, installed forwards, APK/device work and other deployments remain separate.

## Catalog v3 hosted checkpoint — 2026-09-12 / #182

The owner requested completion of the reviewed PR #245/Edge/one-page canary packet
and a resumable repository handoff. PR #245 was merged after rechecking all five
required CI #482 jobs at `9214a268d84281663a728ea055dd4b4dd073a262` and unchanged
base `969c1195700dfc67b3787eb4a51eb70fda8c6ee9`. Accepted source is now
`ad75fc00b100099af4986abfc9955afe308eb6e6`. No repeat approval is needed for these
completed actions or the same bounded canary once its credential prerequisites hold.

The three-file deployment was regenerated from accepted main and replayed all
13 catalog HTTP cases with a fresh cache and npm/remote imports disabled. Its
payload SHA-256 remains
`3533d2bf02ebe02be9f8bb30c8ea7ccbd8b8090f455aaa5fcd8f357efd74f010`.
It was deployed only to `catalog-import` on `mwrnvfosrzwygrunrltm`:

| Deployed property | Verified value |
| --- | --- |
| Function ID | `852f5604-48d0-4fad-8868-1f276feb4621` |
| Version / status | 3 / ACTIVE |
| JWT gateway check / import map | `false` / `true` |
| ESZIP SHA-256 | `a0ec5d55a2cf61737b11f6a2191d2778f3121e438827e2d141dd9c493a8690b7` |
| Source readback | All three file contents exactly match the approved payload |

**The hosted configuration acceptance gate failed.** Real HTTPS probes after
deployment used the deliberately unsupported action `invalid-preflight-only`,
so no successful authorization could accidentally start a provider import:

| Probe | Observed response | Evidence limit |
| --- | --- | --- |
| GET, no credentials | 405 `method-not-allowed` | Handler boots and method guard runs |
| POST, no credentials | 500 `server-not-configured` | Environment validation stops before caller/provider work |
| POST, foreign modern fixture apikey | 401 `Invalid API key` | Gateway rejection; not the handler's exact-key test |
| POST, forged legacy fixture Bearer | 500 `server-not-configured` | Same configuration gate; hosted key acceptance unverified |

A later bounded anonymous POST recheck returned the same 500 response; the gate
did not clear during this session.

The exact missing or rejected environment input has not been identified.
`SUPABASE_URL` and `readServerKeys()` are checked before request authentication;
the latter rejects malformed named/local keys or legacy configuration. This error
does not establish that TMDB_READ_ACCESS_TOKEN is absent, nor justify changing
key validation speculatively. The source/test success cannot be reported as
successful hosted authorization or import.

The read-only coverage query passed again after deployment and matches the baseline:
415 visible BOOK / 30 MOVIE, 385 book images, no movie images or visible descriptions,
zero TMDB source rows and zero visible mocks. Batch EXECUTE remains false for
anon/authenticated and true for service_role. No provider data, secret value,
account state or installed migration was changed by the deployment/probes.

The Supabase connector is connected but has no secret-listing or function-invocation
capability. No privileged invocation credentials are configured in the local admin
environment. Browser inspection of the Secrets page led to sign-in; the secure
GitHub choice/manual continuation did not produce a verified signed-in Supabase
page. No secret values were requested or printed. The owner offered to retrieve
settings instead and was asked for the five relevant secret names' presence plus
active secret/legacy-key status, with values concealed. Wait for/use that report
instead of repeating the uncompleted browser flow or requesting values in chat.

Recovery remains within #182: resolve the configuration cause through a supported
authorized administration path, keep the exact-key boundary, verify anonymous/user
denial and an authorized unsupported-action request, then run the already-authorized
one-page canary and before/after coverage. Stop before broader pages. Do not restore
unlocked v2 or delete Items to hide this failure. Any needed source correction uses
its own bounded branch/PR and root/current-head gates; the six #229 forwards,
password/auth callback deployments, APKs and native/device work remain separate.

## Catalog rollout preparation — 2026-09-12 / #182

PR #244 was owner-approved and merged to `969c1195700dfc67b3787eb4a51eb70fda8c6ee9`
after all five required CI #480 jobs passed. The successor branch
`fix/182-catalog-rollout-packet` starts there. This checkpoint records read-only
hosted evidence and a source deployment candidate; it does not record a deployment.

### Hosted comparison

Project `mwrnvfosrzwygrunrltm` (Kajo, eu-west-1) is ACTIVE_HEALTHY. The deployed
`catalog-import` is ACTIVE v2, `verify_jwt=false`, `import_map=false`, with ESZIP
SHA-256 `8a85347f51f02dec066495263919f2d575d1b6b60e31d7faaf830c589c7cd2d1`.
Its entrypoint still imports floating `npm:@supabase/supabase-js@2` and uses the old
single-selected-key boundary. It does not contain the PR #244 source fixes.
Downloaded entrypoint SHA-256:
`230c5e5a90a58392a7a7081599f986c2c4009cc93617f744e8526373bee46b83`.
The shared normalizer matches accepted source exactly:
`c45821528593b64763d83860975d979d6466cd9cd01d3e440462402afeaa4283`.

Real unauthenticated HTTPS probes returned GET 405 `method-not-allowed` and POST
403 `forbidden`. The POST deliberately used an unsupported action as an additional
guard against provider work. These verify the deployed rejection path only.

The available Supabase connector has no secret-name listing tool. The local admin
environment has no Supabase access token, URL/server invocation key or TMDB token;
there is no authenticated CLI setup verified here. Consequently the hosted names
`TMDB_READ_ACCESS_TOKEN`, `SUPABASE_SECRET_KEYS` and any configured legacy key remain
**unverified**, rather than asserted absent. Do not infer TMDB availability from a
403, zero inventory or the existence of an Edge function. A supported authenticated
`supabase secrets list` can supply names/digests only; discover its flags with CLI
help first, avoid debug output and retain no values in Git/chat. Provider-token
setup and an authorized server invocation environment are still required for import.

The committed `scripts/catalog/catalog-coverage.sql` ran successfully as a read-only
hosted transaction. Counts below exclude hidden Items in the presentation columns:

| Item type | Stored | Discoverable | Image | Description | Creators | Year |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BOOK | 427 | 415 | 385 | 0 | 415 | 413 |
| MOVIE | 42 | 30 | 0 | 0 | 30 | 30 |

Providers remain 385 Open Library BOOK, 30 curated BOOK and 30 curated MOVIE;
24 historical mock Items are stored but hidden. TMDB source rows/distinct Items
and discoverable mocks are all zero. The canonical batch RPC's EXECUTE is false
for anon/authenticated and true for service_role. This refreshes catalog evidence
only; it is not a native/account/migration acceptance check.

### Reproducible deployment candidate

The catalog function's sole SDK operation is now a native HTTPS POST to the same
`upsert_catalog_batch_v1` RPC. Modern matched keys use apikey; only a matched legacy
key adds Bearer. Incoming user Authorization is never forwarded, redirects fail,
and incomplete/malformed RPC success fails instead of assuming the batch succeeded.
The database still owns atomic validation/upsert/dedup. FI/EN behavior and request
bounds remain. Password auth and its pinned SDK/lock are outside this rollout.

There are exactly three deployment files: `catalog-import/index.ts`, its local
`deno.json`, and `_shared/catalog-normalizers.mjs`. Runtime imports are those local
sources plus `node:crypto`; there are no registry packages to resolve during deploy.
The local configuration therefore has `lock:false` and empty imports. The existing
root frozen Deno graph remains the source/type/other-entrypoint gate.

`npm run catalog:prepare-deployment` stages exactly those files, checks their Deno
module graph, and replays all 13 catalog HTTP cases against the staged entrypoint
with Deno 2.1.4, a fresh cache, and `--no-npm --no-remote --cached-only`. Output is
created only after verification. A regression test proves that adding a registry
import prevents payload publication. Preparation never reads credentials or sends
real provider/database requests. Output is regenerated from Git, not committed.

```sh
npm run catalog:prepare-deployment -- --project-ref mwrnvfosrzwygrunrltm --output dist/catalog-deployment-182
npm run catalog:tmdb-beta -- --pages 1 --pages-per-request 1 --dry-run
```

Use a new output directory on a repeat run. The tested candidate manifest is:

| Content | SHA-256 |
| --- | --- |
| Entry point | `db9beae8159f4527ab70af04506669072d81f532ad857832ab0877e07e32cd49` |
| Function-local configuration | `fdacae7775337096157bc6921a7e19eec4e59fbf865549dff8d9f9f4199062a7` |
| Shared normalizer | `c45821528593b64763d83860975d979d6466cd9cd01d3e440462402afeaa4283` |
| Exact serialized deployment payload | `3533d2bf02ebe02be9f8bb30c8ea7ccbd8b8090f455aaa5fcd8f357efd74f010` |

`deploy-payload.json` is the complete `deploy_edge_function` argument, including
project, function name, relative entrypoint/import-map paths, `verify_jwt:false`
and file contents. `manifest.json` records byte hashes; `verification.txt` records
the packet tests. This verifies the source closure, not hosted ESZIP/runtime parity.

### Authorized rollout and canary sequence

1. Finish the successor PR's five required current-head CI gates and source merge.
   Record separate authorization for this exact Edge update and initial provider
   canary. PR #244's completed merge approval is not a hosted change approval.
2. Resolve provider-token availability and an authorized server invocation key
   through supported secret administration. Do not print/copy values into chat.
   Refresh hosted v2/config and baseline coverage before any authorized change;
   unexpected drift requires comparing the changed source/config first.
3. Regenerate/verify the payload hash and pass that exact JSON to the Supabase
   deployment tool. Deploy only `catalog-import`; no auth-function or database
   migration deployment, account reset or APK build belongs to this packet.
4. Read back the new function version/config and downloaded source hashes. Repeat
   rejection probes and an authorized unsupported-action request (400, no import).
   Local fixture success does not replace this real gateway/key verification.
5. In the authorized admin environment, run the single-page canary:
   `npm run catalog:tmdb-beta -- --pages 1 --pages-per-request 1`.
   Defaults are start page 1, fi-FI, FI and minimum vote count 40. The preparatory
   dry-run above was executed; it made no TMDB call. Do not run the default 15-page
   import before inspecting the canary.
6. Re-run `catalog-coverage.sql`. Require positive TMDB source/distinct counts,
   matching external aliases, useful posters/descriptions, and zero discoverable
   mocks. Report actual metadata gaps and unique inventory separately from upsert
   counts. Inspect a small real metadata sample before authorizing broader pages.

Stop immediately on failed preflight, deployment/readback mismatch, import error
or unacceptable coverage. This importer is an admin operation, not a mobile serving
path, so stopping invocations contains a failed rollout. Completed batches may
already be committed even if a later request fails: do not delete Items or restore
database history. Reconcile source identities and retry the bounded idempotent
upsert after repair. Do not automatically restore floating v2 code; any code
recovery must use reviewed captured source with explicit dependency verification.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **375 tests** and the additional
13-case packaged replay, lint/typecheck and both Hermes exports. Only the previously
recorded mobile Hook warning remains. CI/merge status belongs to the PR/Issue handoff.
No hosted write, secret change, real TMDB call or native/device operation occurred.
#182 remains open for useful catalog breadth, presentation/attribution and quality.

Current primary sources checked after the Supabase changelog scan:
[function dependencies](https://supabase.com/docs/guides/functions/dependencies),
[CLI v2.117.0 deployment implementation](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/shared/functions/deploy.ts),
[API key behavior](https://supabase.com/docs/guides/getting-started/api-keys),
[PostgREST RPC](https://docs.postgrest.org/en/v13/references/api/functions.html) and
[secret-name listing](https://supabase.com/docs/reference/cli/supabase-secrets-list).
Function-local config is the supported deployment boundary; the inspected bundler
does not expose a frozen-lock guarantee. Removing the single catalog SDK operation
avoids relying on that unverified guarantee or adding a separate bundling toolchain.

## Catalog Edge source checkpoint — 2026-09-12 / #182

Branch `fix/182-catalog-edge-boundary` starts from accepted D2 main
`3658d1c78b19c6f9c391c14e8e2d66bf814cdcd9`. It closes the bounded source-audit
gap from #182 once the PR's five required current-head CI jobs pass and it merges.
The broader catalog issue and Phase14.3/MVP-CAT requirements remain open.

- `catalog-import` explicitly disables gateway JWT verification and independently
  matches modern named/local apikeys or the exact configured legacy service-role
  apikey/Bearer. Malformed configuration, foreign/publishable/user credentials and
  a modern key supplied only as Bearer fail closed before provider/database work.
  The matched key scopes the admin client; a supplied user JWT is never forwarded.
- The admin CLI sends apikey only. Non-object JSON, invalid explicit parameters
  and requested pages beyond 500 return bounded errors. Provider/RPC failures stop
  the import without exposing upstream messages in logs or responses.
- Both SDK imports are exactly 2.112.4. `deno.json`/`deno.lock` pin their transitive
  graph and Node types; npm locks the Deno 2.1.4 validation tool. Deno's implicit
  `npm:@types/node@*` compiler alias is locked to the same explicit 22.5.4 types.
- `npm run test:edge`, included in root check and CI `validate`, checks all three
  deployment entrypoints and runs 14 local HTTP tests using real handlers/SDK and
  fixture keys/TMDB/Data API responses. Password auth has dependency pinning and
  resolution smoke coverage only; its input/enumeration/abuse work stays with #160.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **372 tests**, lint/typecheck and
both Hermes exports. The existing `DiscoveryScreen.tsx:83` Hook warning remains.
This workspace's HTTP/2 proxy stalled Deno registry reads; local verification used
a temporary loopback registry cache fetching unchanged official npm tarballs over
certificate-verified HTTPS/HTTP1.1. Deno checked upstream integrity hashes. That
temporary transport is not committed; CI uses the normal registry and frozen lock.

Current official documentation checked 2026-09-12:
[auth patterns](https://supabase.com/docs/guides/functions/auth),
[authorization headers](https://supabase.com/docs/guides/functions/auth-headers),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Edge dependency locking](https://supabase.com/docs/guides/security/npm-security#edge-functions-specifics)
and the [Deno 2.1 platform announcement](https://supabase.com/changelog/37941-all-regions-now-run-deno-2-1-compatible-release),
after scanning the changelog. The live authorization page describes transitional
API-key passthrough by the gateway; its indexed search copy still says such keys
are rejected. Both prescribe apikey plus independent service authentication. This
implementation declares its boundary explicitly and does not rely on either
transitional gateway behavior or a key prefix/JWT claim as authorization.

No hosted configuration, secret value, provider inventory or deployed Edge version
was inspected/changed here. No SQL, native model, APK, device or account-reset
operation was performed. STATUS owns the next hosted comparison/import preparation;
the six installed #229 forwards remain immutable and need no repeat deployment.

## D2 development checkpoint — 2026-09-12

E1 #235 / PR #241 and D1 #236 / PR #242 are accepted. D2 #237 now has a measured,
independently reproduced eight-variant temporal/cold-start report, with rejected
challenger admission and tested native-only/unavailable artifact fallback.
[SPRINT-014-D2](SPRINT-014-D2.md) owns this source/evaluation checkpoint;
STATUS owns its required CI/merge and subsequent #182 catalog source-audit task.
Native #229 and full Phase14/MVP/device acceptance remain separate and open.
The audit and 14A–14D records below retain their dated historical meaning.

## Current audit/handoff — 2026-09-12 / #233 / PR #234

The [repository audit](../retros/2026-09-12.md) reconciles the independent
51-part engine, public data and previously staged owner decisions. Preserve the
historical evidence below; the large #229 implementation/device ledger remains
on its named branch and PR until accepted, rather than copied here as main delivery.

- Accepted runtime source remains `6dd1fec` / PR #227. Audit cleanup removes only
  a proven-unused catalog hook/wrapper; no runtime endpoint or SQL changes.
- #229 head `44b11b4` now has all five required jobs passed in CI #458
  (`34582041579`). Its old request to wait for the corrected first-page race CI is
  resolved. Complete atomic next-page delivery plus window concurrency/populated
  upgrade, page replay and captured-session client tests next. Keep continuation
  disabled until accepted; hosted/device gates remain separate.
- E1 #235 → D1 #236 → D2 #237 is the next engine sequence. D1 supplies real
  isolated research data after executable contracts; it does not wait for native
  population volume. D3/D4/D5 are optional experiments after D2, and E2 serving
  integration has separate native/rights/quality/fallback gates.
- #232 joint rating/rewatch is mandatory first release: Phase14 evidence/policy,
  Phase15 Personal setup, Phase16.3 complete joint flow. #230/#231 and joint-list
  choice remain scoped later candidates in FUTURE_PLAN, not invented acceptance.
- Migration protection expands from the original 47 files to 50 by appending
  three accepted-main hashes; no original SQL/hash or source-baseline cutoff changes.
- This scoped audit does not close Sprint014, DATA/ALG/ENG requirements, device
  tests or the Share Link Gate. STATUS is the sole current next-task authority.

## 14A — Real provider-backed catalog — #182 / device follow-up #199

Implemented/hosted/main:

- one canonical `public.items` catalog,
- provider provenance + namespaced external-ID dedup,
- generic discoverability/presentation lifecycle,
- service-only atomic and bounded batch import,
- ACTIVE TMDB Edge importer with server-side secrets/localization fallback,
- Open Library monthly bulk-dump importer as the long-term broad import path,
- mobile poster/cover/creator/year enrichment without changing Prediction rank/ID,
- hosted detail/swipe uses remembered catalog Items; exact delivered-slate identity now requires MVP-DATA-004 regression/fix,
- first guarded seed: **30 real MOVIE + 30 real BOOK Items** with `KAJO_CURATED_BETA` provenance,
- historical 24 `KAJO_MOCK` rows remain stored but are `discoverable=false`,
- hosted Prediction V1 acceptance returned real BOOK/MOVIE Items with **0 mock deliveries**,
- all 930 historical Event references to old mock Item IDs still resolve,
- forward fix `20260905003500_fix_resurfacing_null_bootstrap.sql` corrected bootstrap NULL propagation that had incorrectly classified untouched Items as `SAVED_SUPPRESSED` and caused mobile to fall back to mock cards,
- PR #192 merged to `main` at `c08513a3b00cda764004ed8c295466f26dc61e32` after final CI passed,
- bounded Open Library Search beta bootstrap used **13** explicit genre/language buckets and normalized **650 raw rows -> 385 new Work-ID/title-deduplicated BOOK Items**,
- current discoverable BOOK total is **415** (`385 open_library + 30 kajo_curated`),
- Open Library quality gate passed with **385/385 covers, 385/385 creators, 383/385 release years, 57 Items with Finnish editions, 65 with Swedish editions, 0 duplicate discoverable BOOK title groups and 0 discoverable mocks**,
- language-preferred Open Library Edition enrichment matched all 385 provider Items, changed 159 display titles and selected 385 display covers without introducing title collisions,
- provider `readinglog_count`/`ratings_count` normalize into generic `popularity`/`voteCount`, so the existing `ColdStartPrior` uses `PROVIDER_POPULARITY` without a provider-specific ranker,
- `metadata.openLibraryWorkId` mirrors the provider Work ID for repeat-safe admin refresh while private external-ID aliases remain authoritative,
- repeatable beta tooling is `scripts/catalog/open-library-search-beta.mjs` + `import-open-library-search-beta.mjs`: fixed bucket contract, fi/sv language-preferred editions, Work/title dedup, fail-closed coverage gate, provider-friendly request spacing and writes only through `upsert_catalog_batch_v1`,
- PR #196 passed final-head lint/typecheck/catalog tests/iOS+Android bundle smoke and squash-merged to `main` at `d3fe79865f855b8b3df5f42ae1027ed006169687`,
- PR #198 removed initial fallback-to-hosted reorder flash, kept the 600 ms delay only for interaction-driven reranking, virtualized the discovery grid, mounted only near-visible remote images, used Open Library `-M.jpg` grid thumbnails, preserved full detail images, added hero covers/posters, compacted detail metadata and corrected the bottom Profile control contract,
- main run **#346** passed and produced the configured standalone Android APK used for the 2026-09-06 device follow-up,
- hosted catalog recheck on 2026-09-06 confirmed **BOOK 415 discoverable / 385 images** and **MOVIE 30 discoverable / 0 images**.

Still open:

- configured-device acceptance of #199 dense-grid + warm-image-cache follow-up,
- configure `TMDB_READ_ACCESS_TOKEN` and expand MOVIE coverage beyond the 30-title seed with real posters/descriptions,
- enrich BOOK descriptions and stronger ISBN/Edition matching through the monthly Open Library dump path,
- optional Finnish bibliographic enrichment through Finna while respecting separate cover rights,
- provider attribution/licensing review before external/store release.

The bounded Search API importer is a beta seed/refresh mechanism, not Kajo's runtime book backend. The monthly Open Library dumps remain the intended large-scale persisted catalog path. Historical mock rows are never deleted because Events/Lists/Prediction traces may reference them.

### Configured-device follow-up 2026-09-06 — #199

The run #346 APK proved that real BOOK covers arrive, but the current presentation/perceived-loading quality is not yet accepted:

- BOOK scrolling still feels image-limited under continuous downward movement,
- the small image mount window intentionally allowed already-browsed covers to revert to placeholders once outside that window,
- the two-column surface still reads as separated cards instead of a dense visual browse grid,
- MOVIE has no posters because hosted canonical MOVIE image metadata is **0/30**, not because the generic mobile image renderer is missing.

#199 is the bounded follow-up and must preserve the existing Prediction/Event/Profile architecture:

- nearly edge-to-edge two-column rectangular tiles,
- minimal outer margin/gutter and sharp/minimal corners,
- `cover` image fill across the whole tile,
- restrained title/creator presentation as an image overlay instead of large text blocks between cards,
- bounded FlatList virtualization remains,
- once a discovery image URL is loaded/prefetched during the app session it may stay warm for later rows/revisits; this is UI cache only and must not become Prediction evidence,
- prefetch farther ahead than the mounted image window without mounting/downloading the whole 415-item catalog at once,
- add deterministic tests around image-window planning,
- device acceptance is required before #199 is closed.

Do not solve MOVIE posters by scraping or an unofficial image source. Configure the existing server-side TMDB credential/import path.

## 14B — PersonalProfile bootstrap/import + no-import profiling — #185

### History import — implemented/hosted/main

Repository migrations:

- `20260904203000_profile_bootstrap_import_foundation.sql`
- `20260904203200_harden_bootstrap_rating_constraints.sql`
- `20260904210000_expand_profile_import_stage_limit.sql`
- `20260904211000_profile_bootstrap_actor_index.sql`
- `20260904212000_list_profile_import_jobs.sql`

Data contract:

- history import belongs only to the authenticated owner's PersonalProfile,
- SharedProfile is never a direct import target,
- imported provider history is not appended as native Kajo Events,
- private import jobs/staged rows/bootstrap evidence retain source provenance,
- re-import is idempotent snapshot replacement for the provider/dataset,
- import effects can be removed without deleting native Kajo behavior,
- external-ID match is preferred; safe title/year fallback comes second,
- ambiguous/unmatched rows remain explicit until the user chooses or skips,
- across active imports one strongest state per Item wins: `RATED > CONSUMED > SAVED`,
- imported evidence contributes only to LongTerm taste,
- imported evidence does not enter Working/ShortTerm/ScenarioMemory,
- stale bootstrap evidence decays slowly and native Kajo Events progressively dominate it,
- imported RATED/CONSUMED participates in existing reacted-item suppression,
- imported SAVED remains saved intent and uses the existing reminder policy,
- one staged dataset supports up to 5,000 normalized rows.

Parser contract:

- robust quoted CSV parsing,
- Letterboxd ratings/watched/diary/watchlist CSV,
- IMDb ratings/check-ins/watchlist/list CSV with canonical `imdb_title` matching,
- Goodreads-style library CSV,
- StoryGraph CSV,
- generic Kajo CSV fallback,
- IMDb 1–10 remains unchanged,
- Letterboxd/Goodreads/StoryGraph 0.5/1–5 style ratings normalize deterministically to Kajo 1–10,
- watched/read with no rating becomes CONSUMED with no fabricated rating,
- watchlist/to-read becomes SAVED.

Settings UX:

- `Asetukset` is second from bottom in the side drawer above `Kirjaudu ulos`,
- import controls and instructions are shown only for active PersonalProfile,
- SharedProfile state explains the boundary and offers `Vaihda omaan Kajoon`,
- Letterboxd export ZIP is currently unzipped by the user and its CSV selected,
- flow: file picker -> local parse -> hosted stage/match -> summary -> resolve/skip ambiguous/unmatched -> commit,
- persisted imports reload after app restart under `Aiemmat tuonnit`,
- imports can later be removed independently of native Kajo interactions.

Hosted import verification:

- sample stage returned 3 matched / 1 ambiguous / 1 unmatched,
- ambiguous resolution and commit passed,
- SharedProfile import denied,
- PersonalProfile isolation passed,
- imported rating suppression passed,
- aged imported saved reminder eligibility passed,
- import removal deactivated active bootstrap evidence,
- empty/cold-start profile gained imported LongTerm taste while ShortTerm stayed empty,
- 5,000-row function guard verified hosted,
- persistent import listing is PersonalProfile-owner-only and rejects Shared targets,
- bootstrap actor FK advisor finding was fixed with a forward index,
- PR #190 merged to `main` at `d140cab3151530e40688fd95164997ece9de1009` after lint, TypeScript, tests and iOS/Android bundle smoke passed.

### No-import cold start — merged PR #191 / `cold-start-v1`

PR #191 was rebuilt cleanly on #192 main rather than carrying the old random/image-gated implementation forward, passed final-head lint/typecheck/tests/iOS+Android bundle smoke, and merged to `main` at `0cfa9e73d14f66e309bae937d66124b88c0477c2`. Hosted migration:

- `20260905010000_profile_cold_start_calibration.sql` / hosted `profile_cold_start_calibration`.

Product contract:

- import and profiling are the two intended sparse-PersonalProfile bootstrap paths,
- `ProfileBootstrapGate` allows the user to open Settings/import; returning without enough strong import/native evidence brings profiling back,
- no normal “skip everything” action is offered while sufficient real calibration candidates exist,
- completion requires **6 ratings of known Items**, not 20 mandatory ratings,
- first slate contains **12** deterministic candidates,
- unknown Items are skipped without negative evidence,
- if needed the same ordered slate extends to at most **24** candidates,
- finish is enabled immediately after six ratings; remaining cards are optional,
- after the bounded maximum or technical catalog insufficiency, fail open rather than trap the user,
- only real discoverable non-mock Items are eligible,
- images are optional presentation enrichment and do not gate calibration,
- no demographic input is required,
- calibration is source-tagged `KAJO_CALIBRATION` bootstrap LongTerm evidence; it is not a native Event and never enters Working/ShortTerm/ScenarioMemory.

`ColdStartPrior` / `cold-start-prior-v1` candidate order:

1. provider/catalog trend or popularity when available,
2. provider/catalog recognition when available,
3. explicit recognition-only fallback for the temporary curated beta seed,
4. weak freshness component.

Curated fallback is deliberately inspectable as `KAJO_CURATED_RECOGNITION` with `trend=0`; it must not masquerade as live trend. Provider aggregate popularity/trend is permitted catalog metadata. TMDB and the bounded Open Library beta adapter both normalize provider popularity/recognition into generic metadata, so real provider imports feed the same prior automatically. Kajo-derived cross-Profile trend belongs to future privacy-gated `PopulationMemory`, not this MVP prior.

Hosted cold-start verification:

- status sees 30 real MOVIE + **415 real BOOK** Items; 385 BOOK Items now also have provider covers,
- calibration is available without image dependency,
- first 12 candidates are deterministic, balanced and high-prior,
- requesting 24 preserves the first 12 as an exact prefix and extends the slate,
- curated fallback reports recognition rather than fake trend; Open Library Items report `PROVIDER_POPULARITY`,
- controlled 6-rating commit executes through the real RPC without producing native calibration Events,
- rollback leaves zero active calibration test rows,
- no `KAJO_MOCK` path exists in calibration eligibility,
- merged-main validate passed on CI #324.

### Remaining 14B gate

- configured-device Settings/drawer/file-picker/import acceptance,
- real CSV acceptance against canonical real Items,
- configured-device 6-of-12-to-24 cold-start acceptance with recognizable BOOK/MOVIE Items,
- first-session recommendation check after imported bootstrap and after calibration bootstrap,
- then mark `MVP-BOOT-001..004` accepted.

## 14C — SharedProfile common-fit — #177 / MVP-PRED-005

Implemented/hosted/main; configured-device acceptance still open.

The implementation extends the existing `private.rank_items_v1_internal` / `public.rank_items_v1` path. Prediction target remains SharedProfile and no second recommender exists.

Current `shared-common-fit-v1.1` contract:

- sparse/new SharedProfile receives a small neutral `ColdStartPrior` component,
- accepted members are resolved through `profile_members` and each member's canonical PersonalProfile,
- Personal fit uses source-tagged bootstrap/native LongTerm plus native ShortTerm summaries without copying Personal rows into Shared history,
- sparse member estimates shrink toward the neutral catalog prior using evidence-strength reliability,
- aggregate mean/member-minimum fit contributes positively only when it exceeds the neutral prior,
- agreement above the prior earns a consensus component,
- member-fit range produces a bounded disagreement penalty,
- neutral prior contribution decays as SharedProfile's own evidence count grows,
- Shared joint state and same-Profile ScenarioMemory remain first-class existing V1 inputs,
- PersonalProfile ranking is an explicit no-op: old `scenario-memory-v1+resurfacing-v1` policy remains and common-fit contribution is zero,
- Shared PredictionRun policy version is `scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1`,
- PredictionCandidate explanation exposes only safe aggregates (`memberCount`, coverage, mean/min fit, consensus, disagreement, neutral prior, contribution), never member IDs, PersonalProfile IDs or raw history,
- private helper functions have no authenticated/anon execute grants; mobile continues through `public.rank_items_v1` only.

Hosted implementation history is immutable:

- `20260905113000_shared_common_fit_v1.sql` — first hosted common-fit version,
- `20260905114500_harden_shared_common_fit_v1_1.sql` — v1.1 context/reliability/ShortTerm/prior-decay hardening,
- `20260905115500_fix_shared_common_fit_personal_policy.sql` — forward fix preserving the PersonalProfile policy-version/no-op branch.

Hosted/repository acceptance evidence:

- deterministic agreement control: contribution **+4.088**,
- deterministic sparse control: neutral-prior-only contribution **+0.0675**,
- deterministic disagreement control: contribution **−2.5945**, including **2.5** disagreement penalty,
- real hosted two-member SharedProfile run returns `shared-common-fit-v1.1` inside the canonical Prediction V1 trace,
- real run shows item-specific disagreement penalties and positive consensus components,
- candidate explanations contain no actor User ID or PersonalProfile ID and declare `AGGREGATE_ONLY`,
- PersonalProfile control returns `sharedCommonFit.applicable=false`, contribution `0`, and preserves `scenario-memory-v1+resurfacing-v1`,
- authenticated/anon cannot execute private common-fit config/context/candidate helpers; authenticated can still execute `public.rank_items_v1`,
- 10-result Shared hosted smoke measured about **136 ms** in the current development environment; this is a development baseline, not a production SLO,
- test PredictionRuns/candidates were removed after acceptance; zero tagged test-run residue remains,
- advisor pass introduced no new #177 WARN-level findings; existing leaked-password WARN remains separate #160/#184 release scope,
- PR #194 final-head CI #327 passed lint, TypeScript, tests and iOS/Android bundle smoke,
- PR #194 squash-merged to `main` at `5e1dc9cc993887ab19b943ac0f2a5943d53aa908`.

### Remaining 14C gate

- configured Android SharedProfile acceptance with real Items and a persisted V1 trace,
- only then mark `MVP-PRED-005` complete and close #177.

## 14D — External beta gate — #186

Target roughly 10 external testers.

Required flows:

- clean install/account entry,
- useful first-session import or profiling,
- real BOOK/MOVIE discovery/detail/swipe/rating/not-interested/save/List/history,
- Shared create/invite/join/switch/common-fit/Endorsement/List,
- Profile messaging where already in MVP scope,
- repeated-session suppression/reminder behavior,
- backend/runtime failures diagnosable without developer access to tester phones.

## Product decisions

- MVP 0.1 is a complete store-downloadable BOOK/MOVIE product, not a mock prototype.
- No monetization is required yet.
- Demographics are not required for recommendation quality; import/content choices/behavior dominate.
- Letterboxd/IMDb import is user-authorized file import, not scraping.
- Personal import/calibration evidence remains Personal. Shared common-fit reads authorized Personal taste rather than copying evidence.
- Provider aggregate popularity/trend may seed sparse profiles; Kajo-wide aggregate behaviour remains PopulationMemory-gated.
- Open Library Search beta bootstrap is bounded/cached admin ingestion; the app never uses Open Library Search as its runtime backend.
- Do not judge common-fit quality on the historical mock catalog.
- Product decision 2026-09-07 promotes #200 contextual Lists, #201 catalog search/filters and #203 authorized Profile-name search into MVP; see current ROADMAP 17.0.

## Dependencies

- #182 + #199 configured-device real-card/dense-grid acceptance and **TMDB MOVIE provider expansion** remain required for beta; BOOK beta already has 415 discoverable Items.
- #102 Lists, #138 messaging and Room/shell refreshed device gates remain before beta acceptance.
- #127 owns production email; #184 owns Google/Apple identity linking and taste-preserving conversion in Phase 15.1. Both precede the complete-flow beta in Phase 18.
- #160 production security hardening remains release scope unless a blocking beta-safety issue appears. Repository/hosted migration parity for `harden_production_function_boundaries` was restored through PR #162; leaked-password protection remains the known release WARN.

## Current acceptance

Phase 14 exits only when its ROADMAP 14.0–14.5 gates have evidence, including the following still-open work:

- [-] `MVP-ALG-001..009`: bootstrap/replay foundations are implemented in part; serving/shadow, candidates, adaptive state/features/modes/cold start and operating evaluation acceptance remain open. Individual statuses are in MVP.md.
- [ ] `MVP-DATA-003..004`: atomic actions, durable outbox and exact delivery provenance.
- [-] `MVP-PRED-006`: trace foundation exists; complete delivery/evidence acceptance remains open.

- [-] `MVP-CAT-001..003`: BOOK beta coverage now has 415 real Items with 385 provider covers; MOVIE remains 30-title seed with 0 images, #199 device presentation/cache acceptance and provider expansion are open.
- [-] `MVP-BOOT-001..002`: parser/backend/Settings implemented; real-data device acceptance open.
- [-] `MVP-BOOT-003`: bounded popularity-led no-import profiling implemented/hosted/main; configured-device acceptance open.
- [-] `MVP-BOOT-004`: idempotent/source-tagged/removable LongTerm contract hosted/main; device acceptance open.
- [-] `MVP-PRED-005`: Shared common-fit v1.1 implemented/hosted/main; configured-Android acceptance open.
- [x] hosted normal Prediction delivery contains no `KAJO_MOCK` Items; configured-device confirmation of current product presentation remains open.
- [ ] import and no-import users both receive useful first-session recommendations on device.
- [ ] deterministic handoff to Phase 15 Taste acquisition after Phase 14 acceptance.

Deferred release gates retain their own owners: refreshed List/messaging/Room acceptance in Phase 17; #186 full-flow closed beta in Phase 18. They are not claimed complete here.

## Immediate next action

Finish the current #208 operational PR according to [STATUS.md](../STATUS.md), then implement ROADMAP 14.1 atomic actions, persistent outbox and exact delivery origin. ADR-0006 explicitly adopts the local/CI lineage and the replacement clean-install criterion. #207/#208 technical closure does not close #199/#182, device, catalog or algorithm-quality gates.

## Continuation checkpoint — 2026-09-06

PR #205 delivered the bounded TMDB beta orchestrator (`scripts/catalog/import-tmdb-beta.mjs`, `npm run catalog:tmdb-beta`) at `41c537eb`. Main #352 validation passed including both bundle smoke checks; its APK job was still running at the check. Hosted import has not run in this continuation. Current coverage, credential prerequisites and the executable next step are maintained in `../STATUS.md`. The SQL recheck also found zero nonblank BOOK descriptions. #182 and #199 were reopened because their actual catalog/device acceptance remains pending. Partial PRs must not auto-close these parent gates. No MVP requirement was marked complete.


## Scope and reliability checkpoint — 2026-09-07

The owner made algorithm correctness/adaptation and production completeness the priority. At that checkpoint ROADMAP 14.0–14.8 owned the order; the later Taste-first decision superseded those phase numbers with the current Phase 14–20 sequence. Earlier 14A–14D sections record delivered foundations; they do not waive the newly required ALG/DATA/OPS/UX and browse acceptance in MVP.md.

Before external beta, additionally require bootstrap-driven serving, exact/atomic evidence, serving-shadow parity, refill/continuation, adaptive state/common features, running bounded SleepLayer evaluation, promoted browse suggestions and safe-beta lifecycle/operations. Documentation-only changes have not fixed these code gaps or provisioned services. Current findings and the exact active handoff live in STATUS.md.


## Pre-APK verification — 2026-09-07

- Main APK #352 is now confirmed successful and available; current build link and acceptance state are in STATUS.md.
- `fix/pre-apk-import-dependency` declares the existing Expo-compatible `expo-file-system` 57.0.5 directly in mobile/package-lock because Settings imports it directly. No dependency upgrade, algorithm change or migration is included.
- `npm run check` passed on the final dependency change: lint, TypeScript, all 187 mobile tests, catalog tests and both iOS/Android bundle smoke exports. No Android emulator/phone runtime is available in this workspace, so file-picker and grid/cache device acceptance stay open.
- Public-source migration filter whitespace mismatch is tracked in #208 as a prerequisite of #207 SQL replay coverage. Both algorithm/bootstrap acceptance and full database replay remain open; no deployed migration was rewritten.
- PR #206 remains pending merge approval. This continuation is a dependent branch; resolve the documentation PR before retargeting/merging its follow-up. Do not mark Sprint 014 or any new MVP requirement complete.


## Bootstrap serving checkpoint — 2026-09-07, pending branch

- `fix/207-bootstrap-personal-ranking` depends on #209/#206. #207 stays open.
- Forward migration `20260907155201_bootstrap_personal_ranking.sql` reuses bootstrap selection/strength/decay for memory and direct Personal base ranking. It writes `prediction-v0.4-bootstrap` in base/V1 version metadata and preserves the existing V1 policy/trace body otherwise.
- CSV/calibration successes and import removal notify mounted rankings, including authorized Shared common-fit, through a bounded session-only revision; no scoring runs on the client.
- SQL fixtures reproduce the old missing-bootstrap effect and verify opposite tastes, removal/replacement, neutral/future/duplicate sources, BOOK-to-MOVIE shared tags, native/undo controls, Shared isolation, authorization, private function privileges and unchanged V1 policy definition apart from base version. These are function unit tests, not full migration replay or hosted public V1 execution.
- Final `npm run check` passed: lint/typecheck, 191 mobile tests, 14 catalog tests, 15 SQL runner tests (including the enclosing test) and iOS/Android bundle exports. SQL tests join the canonical npm test/CI gate. No deployed migration was edited, no hosted change was applied, and no new requirement is marked complete. Full replay (#208), hosted V1 acceptance and device acceptance remain open.
- Expo Metro was started offline successfully; React Native DevTools could not launch in this root container (Electron sandbox restriction). No device/emulator interaction was tested. Main CI produces the next APK only after approved merges; do not poll its completion.

### Next configured APK checklist

Use the next APK that includes the pending mobile changes **after** the forward migration passes deployment verification. The existing #352 APK is suitable for earlier grid/cache checks but lacks the new refresh behavior.

1. Existing account: sign in, open BOOK/MOVIE, open/close a card, switch Personal/Shared and confirm the right Profile and content remain active.
2. BOOK grid: scroll down and back; check dense two-column layout, cover fill and already-viewed covers. Movie posters remain a separate catalog gate until official provider enrichment is configured.
3. History import: first open discovery, then Settings. Cancel the picker once; then import a real supported CSV, review uncertain matches and commit. Return to discovery without restarting: a fresh hosted ranking must arrive, and imported consumed/rated Items must not appear as unseen.
4. Import removal: remove that source, return without restarting and confirm a fresh ranking. Native Kajo ratings/Lists must remain. Exact ordering need not revert after intervening native behavior.
5. No-import account: rate six known Items; unknown skips are neutral, the 12-to-24 bound/fail-open remains, and discovery works immediately after completion.
6. Compare personalization using enough matched, contrasting tastes: explainable changes in similar unseen Items, including risk-mode switching. A single pair of real-world lists is not a statistical quality guarantee.
7. Shared Profile: after Personal import/removal, switch back and verify authorized shared recommendations still work, without exposing or copying Personal history. Exercise pending List approval and consensus once.
8. Failed import/network interruption: show a recoverable error, do not falsely report success, and retry after reconnecting. Check ordinary rating, save and undo still advance/restore the intended card.

Report the APK/run identifier, Profile type, exact steps and screenshot for any failure. This checklist does not close the separate production, retention, SleepLayer or full-beta gates.


## Authorized deployment checkpoint — 2026-09-07

- Owner approved merges/deployment; #206 and #209 are merged. PR #210 is the remaining active branch.
- Hosted forward migration `20260907155201_bootstrap_personal_ranking.sql` applied successfully. Git filename was synchronized to the recorded hosted version without changing its SQL payload.
- `scripts/database/bootstrap-ranking.hosted-smoke.sql` passed authenticated public V1 bootstrap contribution, import-removal refresh of backend scores, outsider denial and persisted base version. The transaction rolled back all synthetic accounts, catalog/evidence rows and prediction traces. This is a bounded integration smoke, not full replay, Shared/Auth lifecycle or device acceptance.
- Earlier pending-deployment statements above describe the prior checkpoint. Current truth is in STATUS. #208 replay and #207 remaining acceptance stay open. APK testing is deferred; do not poll builds.


## Replay diagnostic checkpoint — 2026-09-07

- PR #210 merged at `dd53c0c371132efaff1efc196ba81ce7369102d6` after CI #359 passed. No APK polling or device acceptance.
- Branch `test/208-migration-replay-diagnostic` adds `npm run diagnose:database-replay`: complete unmodified files, per-file transactions, immediate error/exit 1. PGlite 0.3.14 uses explicit minimal platform fixtures; no new dependency.
- Reproduced #208 after 33 successful migrations at catalog provider foundation (`P0001`, expected candidate filter missing). This command intentionally remains failing until replay is actually repaired. It is separate from green function-unit checks, and no failed migration is skipped.
- No deployed migrations changed. Next document/validate a clean-install baseline strategy with archived immutable history and parity checks; a later forward migration cannot repair an earlier fresh-install failure. Full Supabase stack validation requires another execution environment because Docker/Postgres are unavailable here. #208/#207 acceptance stays open.


## Historical integrity checkpoint — 2026-09-07

- PR #211 merged at `ece70f5aa8ba5ae46b3f8481987be455f44c794f` after CI #361 passed.
- `test/208-migration-history-integrity` protects the 47 current migration files with a repository-provenance SHA-256 manifest. Two automatic tests reject changed/deleted history, duplicate versions and backdated new migrations. Future forward migrations remain allowed.
- Proposed ADR-0006 defines the separate empty-install baseline proof: schema/ACL/system-seed provenance and parity, repeatable pinned Supabase installation, synthetic Personal/Shared tests and independent existing-database upgrade verification. No baseline SQL or hosted/history change is included.
- The old chronological replay remains blocked at #208; passing history-integrity/unit tests does not satisfy it. Next schema-only capture and difference review. No APK polling or device acceptance.


## Migration tracking comparison — 2026-09-07

- PR #212 remains open: earlier CI #363 passed, but automatic approval review rejected its merge pending explicit approval for this PR. Parity additions stay on the same branch.
- Read-only metadata comparison: 47 repository files, 44 hosted rows, 5 exact version/name matches, 38 same-name/different-version repository entries, 4 repository names absent from hosted tracking and one repeated hosted name. Tracking mismatch does not establish missing schema. No history repair or hosted mutation.
- Added `migration-parity.mjs` and four regression tests; actual metadata returns MISMATCH/exit 1. No raw hosted snapshot is committed. This checker complements the immutable-file manifest and does not assert equivalent SQL from matching names.
- Schema-only export remains uncompleted: pg_dump/Docker and a direct export connection are unavailable. Next establish pinned export tooling and reconcile tracking with schema definitions. Baseline/replay acceptance remains open. No APK polling.

## Function parity checkpoint — 2026-09-07 / #208

- Continued accepted `main` `32a3a3f` on `test/208-function-schema-parity`; #212 and #216 are merged. Historical open-PR statements above are superseded.
- Added read-only function fingerprint SQL and a strict comparator with deterministic PGlite regressions for body literals, SECURITY DEFINER/search path, owners, grants/grant options, overload removal, malformed/empty inputs and major-version differences.
- Hosted PostgreSQL 17.6 query returned 123 function/procedure fingerprints (40 public / 83 private). Four functions defined by the latest bootstrap migration matched the existing repository SQL fixtures exactly in definition, owner and direct ACL. Optional fixture snapshot makes this limited comparison repeatable; ADR-0006 owns usage and exclusions.
- No hosted schema/data/history mutations, migration rewrites, new dependencies or APK build requests. Full schema-only export and Supabase installation/upgrade proof remain open; this diagnostic does not close #207/#208 or MVP-ALG-009.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. Final empty-ACL regression also passed. No device acceptance was performed.

## V1 definition parity checkpoint — 2026-09-08 / #208

- PR #217 merged at `42d605a` after owner approval and green CI #371.
- Follow-up `test/208-v1-definition-parity` extends the existing optional fixture snapshot to the complete `private.rank_items_v1_internal`. All five scoped definitions, owners and direct ACLs matched hosted PostgreSQL 17.6, including the V1 policy/trace function reconstructed from canonical patches.
- No runtime defect was found in this comparison; no hosted schema/history/data changes. Full installation proof remains open. Docker/pg_dump/psql/Supabase CLI are absent and no separate Supabase development branch exists. STATUS now names the environment prerequisite instead of sending a fresh agent back to merged PR #217.

- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. The optional five-function export and hosted comparison also passed. No device test or APK polling.

## Supplied export checkpoint — 2026-09-08 / #208

- #218 merged at `2d1b0d5`; owner supplied `kajo-schema.sql` from the pinned CLI export workflow. STATUS/ADR-0006 retain its checksum and exact next steps.
- Whole export loads unchanged into two disposable PGlite databases: 30 empty RLS-enabled tables, 205 constraints, 19 policies, 123 functions. All 123 function definitions/owners/direct ACLs match fresh hosted metadata. This comparison does not establish canonical repository equivalence for the remaining objects.
- Confirmed missing Auth provisioning trigger (present hosted), event triggers and model/policy system seeds. No hosted changes or migration rewrites. The uploaded DDL remains unaccepted source material, not a committed installation baseline.
- Added checksum-gated offline export diagnostic. Wrong checksum and an export containing an application row are rejected. Actual Supabase/Auth/Shared runtime, seed reconstruction and forward-upgrade acceptance remain open.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database tests and iOS/Android bundle smoke. Two export installations, full hosted function comparison and negative checksum/data checks passed separately. No device/APK acceptance or hosted write.

### Local rollback-only probe continuation

- Owner confirmed CLI 2.117.0 local Supabase starts on Mac. Same #219 branch now includes a Mac-only local Docker runner and exact-export probe builder; no additional dependency.
- Temporarily loads schema, canonical Auth trigger and three SleepLayer seed statements, verifies automatic PersonalProfile membership, runs authenticated bootstrap V1/import-removal/outsider/trace smoke, then rolls back the entire experiment. Existing Auth/application tables prevent execution.
- Full probe passed twice in PGlite; rollback restored empty state. Nonempty-database guard preserved an existing test table/row. Mac/platform execution is pending. Probe seeds are not a deterministic baseline bundle; Shared/platform/upgrade/replay gates remain open.

### Owner Mac result and Shared probe extension — 2026-09-08

- Owner reported original #219 probe PASS on local Supabase Postgres 17.6.1.167;
  all changes rolled back. ADR-0006 retains exact image ID and scope. This
  supersedes the preceding pending-Mac statement for the original probe only.
- Expanded rollback-only probe covers both accepted Shared members, aggregate-only
  explanation without member/PersonalProfile IDs, outsider and revoked-member
  denial, and exactly two versioned Shared traces. Synthetic membership setup does
  not validate invitations/consent or recommendation quality.
- Expanded full export + Auth + Shared + Personal probe passed twice in PGlite;
  expanded Mac run remains pending. No historical migration or hosted data changed.
- Next continue export/source reconciliation and deterministic seed supplements;
  complete pinned installs/platform/forward-upgrade gates remain open under #208.
- Validation: `npm run check` passed lint, TypeScript, mobile/catalog/database
  tests and iOS/Android bundle smoke. Expanded export probe passed separately twice.

### System-seed source checkpoint — 2026-09-08

- Added a checksum-verified source reconstruction for the initial four
  PredictorGenomes, four promotion decisions and baseline PolicyAssignment. It
  reads only the immutable SleepLayer migration and refuses to overwrite output.
- Source/model identities are deterministic; the initial policy's effective time
  remains installation time by design. No hosted data or learning rows are used.
- Validation: 24 database tests passed, including source-boundary, semantic-key
  and no-overwrite regressions. Pinned full-install/platform/upgrade gates remain
  open.

### Prior-change audit — 2026-09-08 / #219

- Restored STATUS and this checkpoint after truncated API payloads corrupted the
  remote documentation. Future uploads must match the entire tested Git tree SHA.
- Fixed seed source verification: changed source/weight now fails on checksum.
- Removed the CI test's hard-coded conversation attachment. The explicit offline
  export diagnostic now checks all 21 application-table trigger definitions and
  enabled states against protected migration source; both export installs pass.
- Preserved immutable history, public/privileged boundaries and #208's open gates.
- Correction: promotion/policy seed IDs are also random, not only timestamps;
  the deterministic metadata gate was never completed by the extraction tool.
- Added proposed deterministic empty-install seeds with explicit audit/assignment
  identities and schema-cutoff epoch. Two independent seed installs match every
  field and preserve original genome/policy semantics. Nonempty reinstall fails
  without changing rows. Full Auth/Personal/Shared probe passes twice with these
  seeds. Revised Mac/full-platform/forward-upgrade gates remain pending.
- Final validation: `npm run check` passed lint, TypeScript, mobile/catalog tests,
  29 database tests and iOS/Android bundles. Exact export trigger parity passed in
  two disposable databases; the expanded rollback probe passed twice separately.
- Added read-only table-definition/direct-ACL fingerprints and same-count drift
  regressions. Exact export fingerprints match across two independent installs
  for all 30 tables. This strengthens export repeatability only; remaining
  canonical schema/platform/upgrade gates remain open (ADR-0006).

### 2026-09-09 — Canonical function source discrepancies

- Reconstructed all 122 application function definitions from the immutable
  checkpoint. Both export installs show 96 exact matches, 26 definition differences
  and no missing/unexpected application functions; platform RLS function excluded.
- Reproduced two additional source-patch failures: import stage-limit expansion
  and null-bootstrap resurfacing both expect compact text absent from the earlier
  repository definitions. Catalog upsert's conflict patch applies unchanged.
- Six public import wrappers and two Shared functions have inspected formatting/
  comment-only diffs. ADR-0006 owns the complete difference ledger and remaining
  18-function semantic review. No historical bytes or serving logic were changed.
- Export diagnostic now exits 1 with `REQUIRES_RECONCILIATION` while preserving
  separate successful export-repeatability evidence. Added repository-only
  regressions for both defects, drift detection, checksum guards and rollback.
- Validation: `npm run check` passed (191 mobile, 14 catalog and 36 database
  tests, lint/typecheck, iOS/Android bundles). The exact export loaded twice with
  repeatability PASS and source status REQUIRES_RECONCILIATION as documented.

### 2026-09-09 — Source-derived function resolutions

- Completed all 26 definition reviews: 19 formatting/comments, five alias-only
  changes and two intended import-stage/null-bootstrap corrections. ADR-0006 owns
  the resolution and provenance; the previous remaining-18 statement is superseded.
- Added the deterministic 122-function supplement and connected it to the guarded
  rollback-only probe. Original historical files and hosted runtime are unchanged.
- Two independent installations match all post-supplement fingerprints; exactly
  26 definitions change and all owners/direct ACL remain unchanged. The expanded
  Auth/Personal/Shared plus 5000-row import probe passes twice with rollback.
- Added repository-only behavior tests for boundary rejection without data loss,
  row correction, repeated commit, removal/eligibility and unauthorized access.
  The same smoke rejects both original broken definitions.
- Next: source owner/ACL and remaining non-function/platform reconciliation,
  revised Mac probe, repeated pinned full installation and independent upgrade.
- Validation: `npm run check` passed after the interrupted run was restarted:
  191 mobile, 14 catalog and 39 database tests, lint/typecheck and both bundles.

### 2026-09-09 — Source table definitions and privilege reference

- CI #382 for the previous published head passed; development continued on #219.
- Reconstructed 188 literal DDL statements from the protected source checkpoint.
  Both unchanged export installations match all 30 source table structures,
  including 205 constraints, 112 indexes and 19 RLS policies. No structural fix
  was needed; ownership/ACL are checked separately and not silently normalized.
- Added a plain-PostgreSQL source privilege reference from 296 literal statements.
  It exposes additional exported `service_role` rights on 12 tables and 18 public
  functions. Platform default/history provenance remains unresolved; there is no
  direct anon/authenticated grant difference in the compared objects.
- Reproduced the source future-function default gap: per-schema REVOKE does not
  remove the global PUBLIC EXECUTE default. Current explicit function ACLs are a
  separate matter. ADR-0006 owns the finding, correction boundary and remaining
  platform/default/installation/upgrade gates; no historical or hosted SQL changed.
- Source-only regressions enforce real membership isolation, unique/FK/check
  constraints and explicit grants, and detect an altered policy that really leaks
  the other synthetic Profile. Existing same-count fingerprint regressions also
  verify that only the explicit structural mode excludes ownership/ACL.
- Validation: `npm run check` completed all stages: 191 mobile, 14 catalog and 41
  database tests, TypeScript, lint (zero errors; one existing DiscoveryScreen Hook
  warning) and both iOS/Android bundles. The exact export diagnostic completed two
  installs with structural MATCH and explicitly unresolved privilege/source status.

### 2026-09-09 — Explicit compatibility/default contract and pause checkpoint

- CI #383 passed the preceding published head. Owner requested a pause after this
  checkpoint; resume from STATUS and the existing #219 branch, not a new workstream.
- Proposed compatibility SQL preserves only the exported service_role rights on
  12 named tables and 18 functions. Both export installations now match reviewed
  source owner/direct ACLs for all 30 tables and 122 application functions. Raw
  historical differences stay visible; exact platform provenance is not invented.
- Prepared CLI-generated forward migration to close future postgres-created
  function defaults globally and clear public/private additions. Existing function
  ACLs and other creators remain unchanged. Global scope includes future platform
  functions; real-platform and independent upgrade verification remain pending.
- Read-only hosted catalogs confirmed the global PUBLIC default gap. Corrected an
  earlier audit error: six platform event triggers have supabase_admin ownership,
  and none of the seven triggers is extension-owned. Hosted objects are unchanged.
- Full revised rollback probe passed twice in PGlite, including compatibility,
  defaults, Auth/Personal/Shared and import checks; application tables and default
  privileges were restored. New regressions verify execution boundaries,
  idempotence, unchanged existing rights and OID-independent platform metadata.
- Mac runner now saves image/probe hash and read-only platform metadata after
  checking before/after equality. Next run the revised probe on the owner's pinned
  local stack and collect `kajo-install-report-*.json`; ADR-0006 has exact commands.
  Prior Mac PASS covers only the original probe. Repeated full installations,
  platform reconciliation and independent forward upgrade still gate #208.
- Validation: `npm run check` passed 191 mobile, 14 catalog and 45 database tests,
  TypeScript, lint (zero errors; one existing Hook warning) and both bundles.
  No historical migration was edited and no hosted change or APK build was made.

### 2026-09-09 — Automated platform runtime continuation

- Owner resumed work after the pause request. Default/compatibility checkpoint
  `d98e652` is published in #219; CI #384 passed.
- Added a separate GitHub Ubuntu job that starts an unlinked Supabase CLI 2.117.0
  stack, requires Postgres 17.6.1.167 and reports actual image/config/commit metadata.
  This removes the need for a manual Mac capture before platform discovery.
- Shared SQL probe tests actual future-function execution, repeat migration,
  unchanged existing platform functions and unaffected schema/role/event/default
  metadata. All changes roll back; only the newly created stack is stopped/deleted.
- `npm run check` passed 191 mobile, 14 catalog and 47 database tests, TypeScript,
  lint with one existing Hook warning and both bundles. CI #385 passed the same
  validation and the real Supabase job at `533cc54`, retaining 99 native function
  definitions/owners/ACLs and verifying execution, rollback and cleanup.
- Retrieved report and compared hosted catalogs: four shared schema owner/ACL sets
  and selected role flags match. Differences are private schema/ensure_rls absence,
  native function callback hashes, initial public defaults and native
  supabase_functions role/default additions. ADR-0006 preserves the exact ledger,
  image/report hashes and boundaries; do not repeat platform discovery on Mac.
- Next build the candidate application installation from reviewed source with
  source default REVOKEs applied before object creation and explicit source RLS.
  Repeated full installs and independent existing-application upgrade still gate
  #208; no hosted write or native platform callback replacement.

### 2026-09-09 — Source-only installation candidate and CI transport correction

- Added the proposed full application candidate from reviewed source, with source
  default REVOKEs applied before object creation. All 30 tables, 122 functions,
  22 triggers and deterministic seed rows match the independent source reference.
- Two committed PGlite installations match exactly; full Auth/Personal/Shared and
  import smokes pass with rollback, and reinstall preserves the existing state.
  `npm run check` passed 191 mobile, 14 catalog and 49 database tests, TypeScript,
  lint with the existing Hook warning and both bundles.
- Added two distinct real Supabase installation runs to CI. Shared lifecycle pins
  the actual Linux Postgres image ID and owns/cleans only each new unlinked stack.
- CI #387 passed validation/platform. The first application run reached the
  negative reinstall check after its source/runtime comparisons, but Docker stdin
  EPIPE masked psql's early error. The full repeated-install gate remains pending.
- Added buffered SQL transport for CI/Mac with a regression for large Unicode
  input, real child exit status and private temporary-file cleanup. The SQL guard
  remains strict. The complete check passed with 191 mobile, 14 catalog and 50
  database tests plus both bundles; record the corrected real CI result next.
- Independent existing-application upgrade and accepted installer/history
  procedure are still open; no hosted write or migration-history change.

### Repeated native installation accepted as test evidence; independent upgrade prepared — 2026-09-09

- CI #388 at `0c9a480` passed validation, platform/default checks and both real
  application installations after the buffered SQL transport correction.
  All 30 tables, 122 functions, 22 triggers, seed rows, runtime behavior and
  rollback/reinstall/cleanup checks matched. ADR-0006 records verified report and
  image identities. This supersedes CI #387's EPIPE-blocked experiment.
- The tested checkpoint passed 191 mobile + 14 catalog + 50 database tests,
  TypeScript/lint and both bundles. The expanded Mac run is distinct and unrun;
  the repeated Linux CI gate no longer needs another manual Mac capture.
- Added a separate populated pre-upgrade fixture/probe and CI job. Existing
  Auth/Profile/membership, native/imported evidence, committed predictions and
  system seeds must survive the unchanged forward migration exactly. It checks
  complete row hashes, schema/function/trigger metadata, native defaults/platform
  and runtime before/after, with repeated commit and negative regressions.
- The local workspace disconnected while preparing the new upgrade package;
  its CI result is pending. No independent upgrade PASS is inferred from the
  installation job. Historical and hosted SQL/history remain unchanged; canonical
  installer/history transition, #208 and MVP-ALG-009 remain open.

### Populated upgrade and rollback local proof — 2026-09-09

- CI #389 caught an invalid synthetic import fingerprint; the fixture now meets
  the existing minimum length and includes a matched staging row/counts.
  Four local upgrade regressions passed, including exact restoration of global/
  per-schema default grants and their grant options, followed by reapplication.
- Optional checksum-gated unchanged-export upgrade passed in PGlite with all
  123 original function bodies/owners/ACLs, populated row hashes and runtime
  preserved. It applies no function/compatibility supplement. ADR-0006 records
  the command, final report hashes and exact provider/fixture scope.
- The workspace connection recovered. Full `npm run check` passed 191 mobile, 14 catalog and 54 database tests,
  TypeScript/lint and both bundles. Corrected native CI is the next evidence; canonical CLI/history activation is
  still separately gated and is not inferred from these SQL experiments.

### Native upgrade PASS; CLI lineage experiment prepared — 2026-09-09

- CI #390 at `7507d35` passed validation, platform/default checks, both application
  installations and the separate populated upgrade/rollback/reapplication job.
  Its downloaded report preserves 221 existing functions and all synthetic row
  hashes; ZIP/report/source/runtime identities are recorded in ADR-0006.
- Added a restricted CI-only CLI reset experiment. A generated source baseline
  plus unchanged forward files must yield matching clean installs and exact CLI
  history. A deliberately failed extra test migration must leave no table/history
  entry. Repository history and hosted state remain untouched.
- Full local `npm run check` passed 191 mobile, 14 catalog and 54 database tests,
  lint/typecheck and both bundles. The first real CLI job is pending. Proposed
  lineage adoption and existing hosted-history procedure remain separate gates.

### CLI lineage PASS and identical-image registry correction — 2026-09-09

- The actual CLI job in CI #391 passed two resets, source/runtime/seed/default
  parity and failure atomicity: the deliberately failed migration left no table
  or history row. Its verified report and exact two-row history are in ADR-0006.
- The same run's upgrade job stopped before application SQL because Supabase
  used its GHCR reference with the exact reviewed ECR image content ID. The check
  now accepts those two observed references only, retaining the exact tag/digest
  requirement. Changed image content/version/registry regression passes.
- Full local check passed 191 mobile, 14 catalog and 55 database tests plus
  lint/typecheck and both bundles. CI #392 at `bbe4dd5` then passed all five
  required jobs, including the repeated installs, populated upgrade/rollback and
  CLI history/atomicity. APK was skipped for the PR event.
- #208's literal unmodified-replay criterion is still unsatisfied. Fresh-lineage
  adoption/acceptance is explicit; no historical or hosted mutation is inferred.

### Verification package completion and pause — 2026-09-09

PR #219's verification implementation is complete. Its code head `9fcbbb4` passed
all five required jobs in CI #393. The final closeout updates documentation only:
STATUS now separates completed evidence from the adoption decision, ADR-0006
states the concrete proposed fresh lineage, and CODEMAP reflects the populated
upgrade and five CI gates. Resolve #219's current publication state from GitHub;
a merged PR is continued from `main`, not from an obsolete local branch.

The next work is the explicit acceptance/installation-procedure decision and its
operational wiring, as specified in STATUS and ADR-0006. #208's literal original
replay criterion remains unsatisfied. #207/#208/MVP-ALG-009 and Sprint 014 remain
open; no hosted schema/data/history change or new device acceptance occurred.
Do not restart completed export/fingerprint/platform/install/upgrade/CLI discovery
or create another docs-only commit merely to record this closeout's own CI or
merge number. Complete publication, then pause as requested by the owner.


### Operational local lineage adoption — 2026-09-09 / #208

- Added `npm run database:install` for a new, unlinked local workspace. Reuses the
  reviewed builder and pinned stack lifecycle; checks image/source/empty-state,
  actual CLI history, independent source-plus-forward snapshots and runtime smoke.
- Success retains the owned local stack with a metadata manifest; failure cleans
  only that stack/workspace. Existing containers/volumes and application/Auth state
  are refused. CI runs the same install boundary before its reset/atomicity checks.
- Forward-added tables/functions participate in full snapshots. Regressions reject
  changed source bytes, duplicate versions/unsafe ordering, unexpected new rows,
  missing RLS and reuse of an existing application even if CLI history could skip it.
- ADR-0006 explicitly replaces #208's impossible unchanged-history success criterion
  with accepted fresh-lineage installation. The original failing diagnostic and
  protected bytes remain intact; existing hosted forward deployment is separate.
- No hosted migration, HTTP Auth, device or quality acceptance is inferred. Finish
  required CI/merge, then proceed to 14.1; GitHub owns exact run/merge identities.
- Local `npm run check` passed: 191 mobile, 14 catalog and 59 database tests
  (264 total), lint/typecheck and both bundles. The existing Hook warning remains;
  native operational installation is verified by the required PR CI gate.


### Atomic rating/not-interest/undo and durable outbox — 2026-09-09 / #224

- The CLI-created `*_atomic_item_actions.sql` forward adds the public invoker/private
  authorized command, private receipt/head tables with RLS and an undo-invalidation
  trigger. Current state, session, canonical Event and receipt are transactional.
  Cached replies still require current actor/Profile authorization; altered payloads
  cannot reuse an ID. Server-recorded undo predecessors prevent intervening/legacy
  updates from being erased, including changes back to the same values.
- Mobile rating/not-interest/undo enters one persisted command path before optimistic
  feedback. SQLite keys include environment/actor/Profile; FIFO retry, immutable
  payloads, restart recovery, storage failure and stale-scope callback/dispatch guards
  have deterministic tests. A rejected stale undo has an explicit discard/reload
  action; uncertain acknowledgements and permission failures remain queued.
- SQL acceptance runs on the complete source-plus-forward schema and in the required
  native CLI job. A populated old-schema rehearsal applies the exact new file with
  hosted-style global defaults and requires unchanged hashes for every existing
  application/Auth table. Rolled-back command smoke covers retry, failure after
  projection write, ordered undo, actor/member denial and trace guards.
- Correlation validates existing selected candidate + actor/Profile/session/mode +
  prior impression. Unverified IDs yield unattributed native Events; undo keeps its
  original accepted trace. This does not complete frozen client slate provenance.
- Lists/Endorsement atomicity and durable exposure delivery remain the next 14.1
  package. Their legacy detail List projection cannot overtake pending atomic
  commands. Full DATA-003/004 and real-device process-death acceptance remain open.
- Verification: local `npm run check` passed 207 mobile, 14 catalog and 61 database
  tests (282 total), lint/typecheck and both bundles. All five required jobs in
  [CI #403](https://github.com/Kajooja/Kajo/actions/runs/34402219263) passed at
  `55b025a0805e65a639295132026461a18057b020`, including the native populated forward
  rehearsal and full command smoke on the pinned Supabase stack.
- Hosted rollout: Kajo `mwrnvfosrzwygrunrltm` accepted only the new forward under
  actual version `20260909204512_atomic_item_actions.sql`. The CLI-created filename
  was synchronized to that provider identity without changing SQL bytes; SHA-256
  `81bc4304d24dc063b04fdd567b1b1c3cc8c2a0bda4ecaff286395701b84f1cdb`.
  All 31 existing application/Auth table hashes, 123 function fingerprints, 21
  triggers, defaults and 44 old migration rows remained unchanged. All three new
  function definitions/owners/ACLs match the reviewed source; the two private RLS
  tables deny all API-role table access and only authenticated can call the command.
- Hosted command acceptance passed using rollback-only fixture DML: retry, ordered
  undo, legacy invalidation, authorization and accepted/fabricated trace cases.
  It selected an actual ranked Item for the synthetic Profile. Forced late Event
  failure was exercised only in isolated native CI, avoiding a hosted test trigger.
  The complete post-smoke snapshot matched pre-smoke state and left zero receipts
  or heads. Security advisors added only the two expected private RLS-without-policy
  INFO notices; the pre-existing [Auth password-protection WARN](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is unchanged.
- The separate global-default forward and old tracking remain untouched. Rollback
  preserves accepted commands/evidence and uses the previous client or narrowly
  disables the new endpoint. PR #225 / #224 own final-head CI and merge evidence;
  filename/documentation synchronization is subject to those same required gates.
- No emulator/phone interaction or physical process-kill/SQLite recovery test was
  available in this workspace. Type/JS/SQL/bundle checks do not claim that acceptance.


### Atomic List/Shared commands and durable mobile integration — 2026-09-09 / #226

- Branch `feat/226-atomic-collection-actions` starts from accepted `e0d7610` (#225).
  The new CLI-created collection forward extends existing private Item receipts and
  undo heads; no old deployed file is edited. Nullable List metadata supports
  no-op/deleted-List replay without fabricating Events. The only old function change
  restricts Item undo to Item command kinds; List undo also restores membership.
- List create/rename/delete/membership and Shared proposal/endorsement/unanimity/
  pending withdrawal commit state, all transition Events and receipt atomically.
  Mixed List/rating undo and legacy membership ABA are protected. Undo corrects
  every Event of a List+Like action; withdrawal/cancelled proposals also cancel
  original Endorsement outcome reward with exact correction references.
- Mobile uses one SQLite actor/Profile/environment FIFO. List/Shared screens and
  picker show pending/errors with explicit safe rejection recovery. Confirmed
  receipts drive state, refreshes and Undo; uncertain actions cannot launch dependent
  creation/messaging or report success. Hung calls have a 20-second reply deadline.
  Old whole-state mobile writes and duplicate mutation Event calls are removed.
  After the queue drains, a guarded current-state read reconciles replayed receipts
  without overwriting newer pending actions, a newer read or another scope.
- Targeted mobile tests cover old payload compatibility, mixed FIFO/restart,
  acknowledgements, timeouts/late replies, scopes/environments, malformed receipts,
  shared consensus counts and discard authorization. SQL smoke additionally covers
  exact Entry actor/time restoration, no-op evidence, consensus late failure rollback,
  membership loss, pending cancellation, complete undo evidence and valid/fake traces.
  Actual Memory returns to zero native evidence after the mixed undone sequence.
- Populated forward rehearsal preserves every existing application/Auth/receipt/head
  column, exact old cached replies and undo. It verifies all unrelated function
  bodies/ACLs and the single intended Item guard replacement. Both rehearsals and
  collection smoke are wired into native CLI CI; all fixtures/DDL/grants roll back.
- Publication checkpoint: local full check passed 212 mobile + 14 catalog + 61
  database tests (287 total), lint/typecheck and iOS/Android bundles; the existing
  Discovery Hook warning remains. The final correction SQL also passed the full
  schema/rehearsal smoke. Required native CI and scoped hosted deployment are still
  pending at this checkpoint; the PR will own final-head run and merge identities.
- No phone/emulator or physical process-kill/SQLite test was available. Full
  DATA-003/004, late-outcome/frozen delivery and exposure acceptance remain open.
  Next after #226: exact delivered provenance plus durable exposure, then device
  acceptance and 14.2. The separate hosted global-default forward is still excluded.
- PR #227 initial CI #406 reached a CLI startup failure before application SQL
  (bounded signals: image-download/port-binding; exact cause unproven). General
  validation, platform/defaults and existing-application upgrade passed. The next
  head includes the receipt replay reconciliation and must pass all required jobs;
  no database failure is waived and no hosted DDL has been applied at this point.

- Implementation head `0d299d5157cee2d8c20b2db64405b23ff646655d` passed all five
  required [CI #407](https://github.com/Kajooja/Kajo/actions/runs/34410390133) jobs.
  Its merge-check tree exactly equals `97949e3823e2364f21054703fecab3ade3556771`;
  native CLI logs confirm reset/history/atomicity/runtime verification. The artifact
  was published by CI; a workspace download returned HTTP 403, so no local artifact
  digest inspection is claimed. Native job success/logs and exact tested tree were
  verified through GitHub. Local final check is 287 tests and both bundles.
- Hosted preflight: Kajo `mwrnvfosrzwygrunrltm`, PostgreSQL 17.6; all 33 old
  application/Auth/receipt/head table hashes, 126 functions, 22 triggers, defaults
  and 45 tracking rows were stable. Object-key order was normalized when comparing
  connector JSON; the SQL fingerprints were identical. Existing receipt/head counts
  were zero. Security advisors remain 18 intended RLS-without-policy INFO findings
  and the existing Auth leaked-password-protection WARN.
- **Deployment was not executed:** automatic approval review rejected
  `apply_migration(atomic_collection_actions)` because it did not find explicit
  authorization for the hosted target/DDL side effect. STATUS records the exact
  source/hash/target to approve; no alternative write path was attempted. Main merge
  and current branch retirement wait for that approval plus successful deployment.
- On approval, preserve SQL SHA-256
  `fbe319423f4f935e87435f4101db71677fa958a02aa7a820f6a55ae68d6ab5ce`, synchronize only
  the filename to the actual provider version, verify all old columns/125 unrelated
  functions/22 old triggers/defaults/history, the one intended Item undo guard,
  three new functions and two new triggers. Hosted smoke must omit isolated-only
  failure-injection DDL and choose an actual delivered Item for trace acceptance;
  that rollback-only variant was rehearsed locally without residue.
- Rollback must preserve accepted receipts/Events/List data and device queues. A
  narrow forward can disable the collection entrypoints while retaining pending
  commands for a corrected deployment. Do not blindly reinstall #225 over devices
  with collection commands: its old queue validator cannot interpret those entries.
  No rollback or separate global-default migration is part of this pending action.


### Approved collection deployment — 2026-09-10 / #226 / PR #227

- Owner explicitly approved the exact hosted migration and subsequent verification/
  merge. `apply_migration` succeeded on Kajo `mwrnvfosrzwygrunrltm` with actual
  version `20260910071110_atomic_collection_actions.sql`. SQL SHA-256 remains
  `fbe319423f4f935e87435f4101db71677fa958a02aa7a820f6a55ae68d6ab5ce`;
  the repository filename alone was synchronized. Do not deploy it again.
- Fresh metadata comparison preserved all 125 unrelated function definitions and
  all 126 old owners/ACLs, the exact intended Item undo guard replacement, all
  23 inventoried noninternal public/private/Auth-user triggers, global defaults,
  and all 45 previous tracking rows. Three functions, two triggers and one tracking
  row were added. Function/table API access checks passed.
- The approval reviewer rejected export of table-wide counts/data hashes during
  this fresh preflight. A safer metadata-only check succeeded. No fresh hosted
  whole-data fingerprint comparison is claimed; the earlier isolated populated
  forward rehearsal remains the data-preservation proof. No alternative path
  exported the rejected private/Auth row-derived snapshot.
- Hosted rollback-only collection smoke passed List lifecycle/membership, exact
  membership undo, mixed Item/List undo and Memory correction, repeat/no-op/denial,
  real delivered-item trace versus fabricated attribution, Shared consensus and
  pending cancellation. It selected an actual ranked MOVIE and omitted isolated-only
  failure-injection DDL. The transaction rolled back its synthetic data.
- Security advisors retain the same 18 intended RLS-without-policy INFO findings
  and existing Auth leaked-password-protection WARN. The unrelated global-default
  migration and historical tracking are untouched. No physical-device acceptance.
- CI #408 passed the prior handoff head. PR #227 owns the final filename/docs CI
  and merge result. Next is exact delivered provenance and durable exposure in
  14.1; DATA-003/004 and Sprint 014 remain open. Work continues in short checkpoints.
