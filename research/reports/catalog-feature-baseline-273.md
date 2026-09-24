# Catalog concept representation sensitivity — #273

This is a bounded synthetic diagnostic of the existing Personal bootstrap SQL,
using the already captured #269 catalog. It does not train a model, evaluate real
taste, change serving, or replace the primary #182 catalog packet.

## Protocol frozen before the real catalog run

[The executable protocol](../manifests/catalog-feature-baseline-273.json) pins
the 840-Item snapshot bytes, accepted registry, seven canonical SQL definitions
and disposable test clock. Six concepts and three fixed representations are
compared without tuning:

| Arm | Item tags inside the disposable fixture |
|---|---|
| A | Original legacy tags |
| B | Deduplicated `evidenceKind:concept` keys with at least one matched assertion already represented in Item tags |
| C | The same keys from all reviewed provider assertions |

C−B measures additional source-concept representation within a fixed vocabulary
and source-kind policy. B−A separately describes representation sensitivity: it
also removes unrelated legacy tags and separates topic/genre evidence. Neither
contrast measures prediction quality or proves why tags were missing.

For each BOOK/MOVIE × six-concept bucket, choose one deterministic whole-Item
anchor, then create synthetic rating-0 and rating-10 profiles. BOOK selection
prefers a missing concept, then lexical Item UUID; otherwise it falls back to
all supported Items. MOVIE uses lexical supported Item UUID. Missing buckets
are counted and skipped. There are at most 24 scenarios, not 24 real people;
anchors may repeat and contain several concepts. This deliberately enriched
diagnostic sample is not representative of users or catalog exposure.

All arms have identical anchors, profile identities and candidate rosters. Hide
only the current rated anchor; query BOOK and MOVIE independently with FOR_YOU
and limit 50. The canonical SQL orders final score descending, then UUID.
Report returned unions, entry/exit, and conditional rank/score/bootstrap deltas
among common returned Items. No missing score or rank is imputed, and returned
top-50 metrics are not all-840 score coverage.
Aggregate Item counts are Item-query occurrences, not distinct catalog Items.
Membership-change query counts exclude order-only changes, which are reported
separately as common returned Items changing rank.

`private.rank_items_v0` and `private.build_profile_memory_state_v1` plus five
dependencies are loaded byte-for-byte from repository SQL into the existing
isolated bootstrap PGlite schema fixture. Only that disposable database's
`pg_catalog.now()` is replaced with a hash-bound stable test clock. The fixed
instant is `2026-09-24T11:18:16.242881+00:00`, the snapshot observation boundary;
synthetic evidence is inserted at the same instant. No app function, migration,
hosted database or historical trace is changed. This is not historical replay.
Generated prediction UUIDs are omitted because they do not affect scoring.

Unasserted concepts stay absent from the sparse diagnostic tags, never a
negative feature. B/C keep `provider-subject` and `provider-genre` separate;
same-concept topic/genre names do not establish transfer reliability. Zero
cross-kind bootstrap contribution applies only to this base fixture. V1
Scenario similarity can use state/context/mode without shared tags; Shared,
Scenario, delivery and serving-shadow integration remain outside this packet.

## Reproduction

Use the private authorized snapshot; ordinary CI uses invented catalog fixtures.
Prepare a new private directory before any scoring, then use the exact freeze
with two new result directories:

```bash
npm run catalog:features:baseline -- --snapshot /private/snapshot.json --prepare --out /private/feature-baseline/freeze
npm run catalog:features:baseline -- --snapshot /private/snapshot.json --freeze /private/feature-baseline/freeze/freeze.json --out /private/feature-baseline/run-1
npm run catalog:features:baseline -- --snapshot /private/snapshot.json --freeze /private/feature-baseline/freeze/freeze.json --out /private/feature-baseline/run-2
```

The runner verifies snapshot, protocol, mapping, canonical definitions, clock,
selected anchors, implementation files and exact Node/V8/PGlite/platform runtime
before SQL execution. New directories and exclusive writes prevent overwrite.
`freeze.json` and `results.json` are private; only aggregate `report.json` may
enter Git. Runtime error output is generic to avoid leaking private payloads.

## Actual run

Protocol and implementation were committed locally at
`aca84fa21c02040d0ceaaa513d9a6b5e818c597a` before the first actual catalog run.
Independent pre-run review found and corrected a microsecond availability-boundary
check before that commit. The exact-time regression and Item-query metric labels
were accepted before the private anchor freeze.

Two separate Node processes with fresh PGlite databases completed on September
24. They used 840 Items, 12 distinct whole-Item anchors, 24 synthetic profiles
(12 positive / 12 negative), three arms and 144 domain-specific queries. All
twelve concept/type buckets were supported; all six BOOK anchors had the named
concept missing from B. Each arm returned 2,400 Item-query rows. There were no
observed outcomes, native Events or current interactions.

Both executions used the same unchanged private freeze; their results and public
[aggregate report](catalog-feature-baseline-273.json) are byte-identical. The
private recovery archive retains the local pre-run commit receipt, patch and
source tree; the local hash does not imply a retrievable GitHub commit. Selected
C−B results follow; every entry,
common and changed-Item count is an Item-query occurrence:

| Anchor → candidates | Queries | Queries with top-50 membership changes | Entered / exited | Common returned | Common scores changed |
|---|---:|---:|---:|---:|---:|
| Negative BOOK → BOOK | 6 | 6 | 171 / 171 | 129 | 0 |
| Positive BOOK → BOOK | 6 | 6 | 165 / 165 | 135 | 126 |
| MOVIE, both signs → BOOK | 12 | 12 | 264 / 264 | 336 | 0 |
| All anchors → MOVIE | 24 | 0 | 0 / 0 | 1,200 | 0 |

All 24 BOOK-target lists changed membership, with 600 entries and 600 exits in
total; all 24 MOVIE-target lists remained identical. For the six positive BOOK
queries, 114 common returned Items changed bootstrap contribution. The six
negative BOOK queries demonstrate why common-score-only summaries are inadequate:
their common scores stayed unchanged while 171 Item-query entries/exits changed.
No scores for unreturned Items were reconstructed or imputed.

**Metadata also affects the existing novelty policy without taste transfer.**
B has nonempty concept tags for 131 BOOKs; C has them for 244. With a MOVIE
anchor, all BOOK bootstrap contributions remain exactly zero in both arms.
Nevertheless, the current SQL gives an unmatched nonempty tag vector novelty
1 (a FOR_YOU contribution of 0.1), and an empty tag vector novelty 0. Newly
represented BOOK metadata can therefore change the returned ordering through
novelty and UUID tie-breaking alone. This explains the MOVIE→BOOK changes above;
they are not evidence of learned cross-domain taste. A separate synthetic
regression reproduces this existing formula directly with unchanged SQL.

B−A changes membership in all 48 queries. That contrast removes other legacy
tags, deduplicates the six concepts and separates topic/genre namespaces; it
cannot be described as an isolated correction or a neutral serving replacement.
The rank scores are neither calibrated predicted ratings nor probabilities.
No variant is selected, no quality threshold is claimed, and serving/model
admission remains unchanged. A future integration must address metadata-driven
novelty, joint consumer versioning and real held-out usefulness explicitly.

### Integrity and resources

| Artifact | SHA-256 |
|---|---|
| Input snapshot bytes | `9391286e83d3fe4de680b8456cd83990ade46d28d5dc3ec6030849c06465c3bb` |
| Canonical protocol | `90bfb9d250b4dfa2bb41dcd8f94d8c01fdbf401b5ca235022366f3116ab015db` |
| Canonical freeze | `f938a0f191b79e1016297a09223f4505d8fb54454b266bbab405c46431defbba` |
| Selected synthetic anchors | `79abd9381d7caff6879907258a2279088108a3211a79eaa31f1001f7687414ef` |
| Canonical results | `8adfbef9aa8202fc490904e3274e200e5245af5f882ba2036db73508569aa127` |
| Private results file bytes | `2039354833777359e8598d2c56b4f4ddbde3a36225350492f80e2638083c86ed` |
| Public report file bytes | `ff5deac98815ecef739172dced2b78d146ec001d7d2390b2a3a040cc2139b571` |

The report binds the registry, original and installed SQL function hashes,
fixture clock, implementation and exact runtime: Node 24.19.0, V8
13.6.233.17-node.51, PGlite 0.3.14, Linux x64. Executions took 3.073 and 3.140
seconds. The sequential launcher's child-process high-water RSS reached 947,100
KiB (approximately 925 MiB); this is observed fixture cost, not a production
latency/memory benchmark. Each private result file contains 6,446,714 bytes;
the public aggregate is 16,448 bytes. Complete private provenance retains the
commands and timings. Ordinary CI never reads the actual catalog snapshot.

### Validation and review

Independent review checked the protocol before execution and independently
recomputed the final public counts/hashes from both private runs. It verified
the novelty explanation directly: every MOVIE→BOOK result in B/C is the UUID-
ordered top 50 nonempty BOOK vectors, each with score 0.1 and zero bootstrap
contribution. No real catalog scoring was repeated during that review.

All ten new tests pass, including exact microsecond availability, frozen source
bindings, deterministic selection/results, neutral unsupported concepts,
duplicate-label handling, opposite synthetic Profile isolation, zero native
confidence/Events, top-50 accounting, novelty behavior and redacted CLI errors.
The final catalog suite passes 125 script tests plus three contract tests.
Local lint/typechecks, 248 mobile tests, 63 database tests, 44 engine tests,
19 Python plus 13 Node research tests, acceptance tests and four bundle exports
with companion isolation guards passed. The combined `npm run check` reached
the Deno registry dependency fetch and was stopped by its 180-second timeout
(exit 124); later gates were executed separately. Full root-check/required CI
acceptance is therefore a separate publication gate, not claimed by local work.
