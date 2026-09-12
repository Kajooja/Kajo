# Isolated MovieLens research — D1 and D2

The owner authorized an available alternative to MovieLens 32M on 2026-09-12.
D1 now uses **GroupLens MovieLens Latest Small, September 2018, Kaggle version 2**
for a bounded noncommercial development experiment. The actual source contains
100,836 ratings, 610 users, 9,742 movies and 3,683 tags. A deterministic 500-user
cohort preserves **84,849 complete-history ratings**, all converted into external
engine Observations. Independent fresh normalization/conversion and verified cache
replay produced matching hashes. [Aggregate evidence](reports/movielens-small-v2-intake.json)
records exact counts, hashes, commands, resource measurements and limitations.

The [publisher's Kaggle release](https://www.kaggle.com/datasets/grouplens/movielens-latest-small)
is the alternative location linked by [GroupLens](https://grouplens.org/datasets/movielens/).
Its archived README permits research with attribution and no implied endorsement;
commercial/revenue-bearing use requires prior permission. The publisher labels
Latest Small a **development dataset**, unsuitable for shared benchmark claims.
Freezing version 2 and hashes makes this internal development run reproducible;
it does not change that scope or prove Kajo product usefulness.

## Selected source and alternatives

| Source | Decision |
| --- | --- |
| GroupLens Latest Small, Kaggle v2 | Selected and actually processed. Publisher identity, version, README, archive and every member are pinned; original half-star ratings and timestamps remain intact. |
| MovieLens 32M | Larger stable benchmark remains available as an explicit later intake. Its original file service fails upstream TLS verification in this environment; it no longer blocks the selected development experiment. |
| GroupLens MovieLens 20M on Kaggle | Publisher metadata/file listing is available. Its transformed package has different filenames/timestamp representation and an Unknown license label; exact terms and package verification are separate work before use. |
| Amazon Reviews 2023 | Useful candidate for broader categories, but the maintainer cannot assign its usage rights; unresolved for this project. |
| UCSD Goodreads | Book ratings/shelves are relevant, but its academic-only scope is not established for this independent project. |

[DATA_ENRICHMENT](../docs/architecture/DATA_ENRICHMENT.md) owns source comparisons,
rights and research/model-admission semantics. [STATUS](../docs/project/STATUS.md)
owns the current PR and next bounded step. A source change always has an explicit
release identity; equal integer IDs never join users across releases.

## Repeat the real intake

Use Node 22+ and Python 3.12 (standard library). From the repository root:

```sh
npm ci
npm run research:movielens:prepare
npm run research:movielens:download
npm run research:movielens:normalize -- --output-dir research-artifacts/movielens-small-verified
npm run research:movielens:normalize -- --output-dir research-artifacts/movielens-small-verified-replay
```

The default source is `small`. `prepare` retrieves only the README and publisher
metadata into ignored `research-data/movielens-small/`. It checks the GroupLens
owner, dataset identity, version 2, exact README hash and five-file inventory.
The tracked `manifests/movielens-small-v2.json` records the reviewed research scope,
original source URLs and actual archive/member SHA-256 values. These are hashes
computed from retrieved publisher bytes, **not a claimed publisher-issued checksum**.
No flags are automatically promoted by retrieval.

`download` requires that reviewed source snapshot and uses a bounded temporary
file. It verifies the pinned version's SHA-256/byte count before atomic publication.
The first inspected archive and a second independent authored download matched.
Existing archives are rechecked; failed/changed downloads cannot replace accepted
bytes. A publisher update requires a new review and identity, not a silent repin.

`normalize` checks every ZIP member's allowlisted path, type, size, CRC and pinned
hash, streams strict UTF-8 CSV, then creates an atomic normalized stage. The built
TypeScript adapter creates a separate atomic engine stage. Repeat commands reuse
only completed stages whose input/output hashes and code lineage still match.
Different output roots permit independent execution without deleting prior work.
The run ID binds the source archive, manifest and Python code; the conversion ID
also binds the built adapter and runner. Source retrieval time stays separate from
simulated observation time. No real download runs in ordinary CI.

The original 32M source remains explicit and gated by its own unresolved review:

```sh
npm run research:movielens:prepare -- --source 32m
```

Do not retry that failing endpoint repeatedly as a prerequisite for the small run.

## Normalized files and selection

| File | Meaning |
| --- | --- |
| `ratings.jsonl` | Original 0.5–5 ratings, ordered by timestamp, numeric source user ID and movie ID |
| `subjects.jsonl` | Release-scoped research subjects and their complete valid history counts |
| `objects.jsonl` | Source movie metadata and explicit IMDb/TMDb aliases; metadata availability remains unknown |
| `quarantine.jsonl` | Counted invalid/conflicting records and source references |
| `manifest.json` | Source/output/code hashes, counts, cohort policy, mapping coverage and unknown semantics |
| `engine-*/observations.jsonl` | External observed E1 records; unknown exposure and null native actor/action/prediction |
| `engine-*/manifest.json` | Conversion hashes, counts and bounded available-prefix contract probe |

Select the 500 lowest SHA-256 ranks of
`movielens:ml-latest-small-2018-kaggle-v2:<seed>:<source-user-id>` among subjects
with at least 20 valid unique ratings. The fixed seed is
`kajo-d1-mlsmall-v2-500-v1`. Keep complete valid histories; never take the first N
sorted rows. The actual selected history lengths range from 20 to 2,698 ratings.

Exact duplicate pairs count once. All conflicting pair versions enter quarantine;
the importer does not invent historical corrections. Conflicting aliases are
removed from every affected mapping without merging movies. The real run found
one TMDb alias shared by two source movies: both mapping records were quarantined,
ratings remained valid, and ten objects lacked a usable TMDb mapping in total.
No IMDb mapping was missing. Live Kajo catalog intersection was not queried.
Tags are validated/counted/hashed and are not model inputs in this packet.

The small-source manifest caps archive bytes at 2 MiB, expanded bytes at 8 MiB,
source rows at 110,000, subjects at 1,000, objects at 12,000, one subject's history
at 5,000 and cohort ratings at 110,000. Limits fail rather than truncate histories.
The original 32M source keeps its own larger resource bounds.

## Time, testing and next experiment

Timestamps are rating activity in epoch seconds, not viewing time. Availability
at occurrence is an explicit offline simulation assumption. Whole equal-time
label groups stay outside a query's historical prefix. The bounded probe retains
at most 20 earlier records and waits for a strictly later group; an all-tied history
is reported as unsupported instead of passing vacuously. The real probe passed
with 20 earlier records. Object metadata is an undated release snapshot and cannot
silently become historical features, native exposure, context or consumption.

`EXPO_OFFLINE=1 CI=1 npm run check` passed **345 tests**: 212 mobile, 14 catalog,
61 database, 35 engine, 19 Python intake and four cross-language/pipeline tests.
Lint/TypeScript and both Hermes exports passed; one pre-existing mobile Hook
warning remains. Tests use explicitly artificial archives. The real-data report
above is separate evidence and contains no histories or fitted artifacts.

D1 is accepted through merged PR #242 / CI #475 at main `7602b34`.
The 345-test count above is its historical gate. D2's measured result follows.

## D2 — reproducible development evaluation

[Readable result](reports/movielens-small-d2.md) · [Full aggregate evidence](reports/movielens-small-d2.json)
· [Frozen protocol](manifests/movielens-small-d2.json) · Issue #237.

The real run and independent replay agree on fitted parameters, predictions,
metrics, grouped intervals and the rejection/fallback decision. Recent state won
the validation comparison but missed its predeclared minimum improvement; no
challenger is admitted. The separately named prequential comparison supports
using recent rating-entry state within this development task. Native usefulness,
Shared behavior, cross-domain transfer and model serving remain separate gates.

After the D1 prepare/download steps above, a new workspace uses:

```sh
npm run research:movielens:normalize -- --output-dir research-artifacts/movielens-small-verified
npm run research:movielens:evaluate
```

The single evaluation command builds the actual TypeScript package, freezes the
protocol/code/runtime and data split, fits eight declared variants and evaluates
the selected configuration without changing parameters after the final test.
It uses Node standard library only; raw/fitted files never enter ordinary CI.
The public run used Node 24.19.0 / V8 13.6.233.17 on Linux x64. A different runtime
requires its own freeze; it cannot silently reuse a frozen code/runtime identity.

For an auditable pause before any fitting and a fresh independent replay:

```sh
npm run research:movielens:evaluate -- freeze
npm run research:movielens:evaluate -- run
npm run research:movielens:evaluate -- run --output-dir research-artifacts/movielens-d2-replay
```

Use either the single command or the staged commands in a fresh workspace.
Defaults are `research-artifacts/movielens-d2-frozen` and `movielens-d2-run`.
`--frozen-dir`, `--output-dir` and optional verified D1 `--input` allow explicit
new paths. A completed or partial directory is not overwritten; inspect it and
choose a new path for another run. Existing frozen partitions are hash-verified
when reused. Their subject memberships and all prediction journals remain ignored.
The public report publishes only aggregate slices and integrity hashes.

### Implemented models and boundaries

All variants consume the same E1 `Observation`, `PredictionScope`, target scale
and artifact lineage through the package's separate `./research` export. Queries
contain visible prefixes and target object IDs; current target labels are passed
to error calculation only after the full timestamp group's forecasts exist.
This is an offline object-rating boundary, not E1's fixture reference estimator,
a SQL replacement or a fabricated action-outcome Scenario.

| Variant | Exact implemented role |
| --- | --- |
| Global / item mean | Training mean μ; item estimate `(sum + 10μ)/(count + 10)`; unknown item uses μ |
| Durable state | Item baseline plus sum of permitted subject residuals divided by `(prefix count + 10)` |
| Recent state | Item baseline plus 0.65 durable residual and 0.35 recent residual; recent residual averages the last three complete time-group residual means, shrunk by `groups/(groups+1)` |
| Item neighbors | Positive cosine of training item-centered vectors, overlap shrinkage `n/(n+10)`, overlap ≥3; train-support ≥5, top 1,000 items, top 20 edges; no match uses durable state |
| Factorization | Eight factors, twelve seeded shuffled SGD epochs, learning rate 0.01 and regularization 0.05; fixed item offsets and learned user bias/vectors during fit; inference ridge-folds the permitted prefix into an intercept plus factors with penalty 10 against frozen item vectors |
| Static retrieval | Same-item, different-subject train memories matched by normalized raw durable prefix mean; at least three earlier time groups; fallback durable state |
| Ordered retrieval | Same bank plus three ordered complete-group raw means in distance; fallback recent state. Both retrieve at most ten within RMS distance 0.35 and blend 0.35 continuation mean into the fallback |

Memory encoding never reads the continuation or later training labels. Fixed raw
scale normalization does not use fitted future statistics. The bank is selected
by a stable seeded record hash, independent of response values; 10,000 total,
64 per item. Undated metadata is excluded from all variants. Final global model
parameters and bank stay frozen even in prequential evaluation. Numbers remain
uncalibrated estimates on 0.5–5, with component support and explicit fallback.

The optional artifact boundary rejects absent/invalid/withdrawn/disallowed or
out-of-domain inputs and uses only authorized observed native-prefix evidence,
otherwise unavailable. It retains no learned external parameter in that fallback.
File/manifest hashes are checked by the runner; this boundary is not wired into
native serving. Withdrawal requires replacing every dependent model/index/cache,
a separately authorized rebuild and fresh evaluation, not just raw-file deletion.

The code gate passed **357 tests**, lint/typecheck and both Hermes exports.
New cases exercise cutoff/held-out/synthetic leakage, unavailable/equal-time
prefixes, label-blind splits, continuation-free encoders, tied-group order,
prequential score-before-update, deterministic fits/metrics and fallback. No
network download or real-data training is performed by ordinary CI.
