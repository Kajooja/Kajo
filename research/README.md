# Isolated rating research — movies and books

The [Book Genome extension](#book-genome--undated-static-research-417) adds a separate
undated book experiment. The existing MovieLens path below remains dated.

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

## Movie and book paths

| Research path | Source ratings | Source scale → comparison scale | Time support |
| --- | ---: | --- | --- |
| MovieLens Latest Small, Kaggle v2 | 100,836; accepted cohort 84,849 / 500 users | 0.5–5 ×2 → 1–10; D2 retains original-scale metrics | Rating-entry timestamps; complete equal-time groups |
| Book Genome, 2021-12-30 | 5,152,656; exposed cohort 31,144 / 500 readers | 1–5 ×2 → 2/4/6/8/10 | Unknown; static masks only |

Both preserve original grades, unknown missingness, separate source identities
and all native Kajo integer 0–10 values. MovieLens already includes a complete
intake, eight-model comparison, cold-start masks and reproducible replay; its
rejected recent-state challenger remains rejected. New native quality or
book-to-movie transfer needs separate evidence.

## Selected source and alternatives

| Source | Decision |
| --- | --- |
| GroupLens Latest Small, Kaggle v2 | Selected and actually processed. Publisher identity, version, README, archive and every member are pinned; original half-star ratings and timestamps remain intact. |
| MovieLens 32M | Larger stable benchmark remains available as an explicit later intake. Its original file service fails upstream TLS verification in this environment; it no longer blocks the selected development experiment. |
| GroupLens MovieLens 20M on Kaggle | Publisher metadata/file listing is available. Its transformed package has different filenames/timestamp representation and an Unknown license label; exact terms and package verification are separate work before use. |
| Amazon Reviews 2023 | Useful candidate for broader categories, but the maintainer cannot assign its usage rights; unresolved for this project. |
| GroupLens Book Genome subset | Reviewed separately for noncommercial static book research; see the bounded extension below. |
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
| Factorization | Eight factors, twelve seeded shuffled SGD epochs, learning rate 0.01 and regularization 0.05; fixed item offsets and learned user bias/vectors during fit; inference ridge-folds the permitted prefix into an intercept plus factors with penalty 10 against frozen item vectors. Current source uses durable state when the target or every prefix item lacks fitted factors; the dated D2 report retains its original code/results |
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

## Exploratory prefix adaptation — #265

[Actual result and limits](reports/movielens-small-prefix-study.md) ·
[Aggregate evidence](reports/movielens-small-prefix-study.json).

The owner requested further research on the already authorized public preference
source on September 24. The [fixed study protocol](manifests/movielens-small-prefix-study.json)
compares the earliest and most recent complete rating-entry groups under maximum
prefix budgets 0/5/10/20. Its single primary contrast is recent minus earliest RMSE
at budget 10 using durable state. The other existing variants and budgets are
diagnostics, with no tuning, winner selection or automatic model admission.

This reuses **previously inspected D2 development outcomes**. It cannot produce
a new untouched-final claim. Original D2 membership, all partition hashes and both
cutoffs must match before freezing the study. Global models train on the same
regular-subject pre-cutoff rows. Every held-out subject's post-training-cutoff
rating is scored under every condition; pre-cutoff history and previously scored
groups may enter only that subject's visible prefix. All current tied labels
stay hidden until every condition has scored the complete group.

Recent selection retains a contiguous suffix of whole groups. Earliest selection
retains a contiguous prefix. Both stop when the next group cannot fit; they never
skip a large group to fill a budget. A maximum budget does not promise that many
visible ratings. Actual size, rating-entry age and oversized-group exclusions
are reported, together with cold-item and zero-history fallback. This compares
two practical policies at a maximum budget, **not pure recency at equal actual
information**. Paired policy uncertainty jointly resamples the same subjects and
is descriptive exploratory evidence.

After the existing pinned prepare/download/normalize commands above:

```sh
npm run research:movielens:prefixes -- freeze
npm run research:movielens:prefixes -- run
npm run research:movielens:prefixes -- run --output-dir research-artifacts/movielens-prefix-replay
```

The freeze records exact source, original split, current code/protocol and runtime
before fitting. The two run commands independently fit and evaluate those same
fixed conditions. For a fresh replay in an already used workspace, supply new
`--frozen-dir` / `--output-dir` paths; existing or partial directories are never
overwritten. `--input` accepts only the exact hashed D1 observation file. All
outputs remain under ignored `research-artifacts/`; source records, model
parameters and prediction journals are not repository/ordinary CI artifacts.
Publish only the aggregate report and integrity hashes.

The recorded September 24 freeze was made from the exact pre-run source snapshot
at local commit `e37f63d`, before later catalog script/package integration. Its
private recovery archive retains that source snapshot and runtime identity.
Unrelated later changes to a hashed package/script intentionally invalidate reuse
of the old freeze. For exact recovery, use the recorded source/runtime; for a new
current-source run, create a new freeze in a new directory and report its new
identity. Do not edit or relabel the old receipt to make a later checkout match.

The factorization support repair in this packet restores durable state when a
known target has no supported prefix item. It does not change training or the
historical D2 report. Source, training, evidence of benefit and serving admission
remain separate facts. MovieLens cannot establish BOOK transfer, Shared behavior
or native product usefulness; the source's research-only rights and the existing
withdrawal/admission gates remain in force.

## Book Genome — undated static research #417

The exact reviewed source, CC BY-NC 3.0 attribution and permitted scope are in
[`manifests/book-genome-2021.json`](manifests/book-genome-2021.json).
This is GroupLens's specifically published Goodreads subset, not blanket
approval for the UCSD dataset. Only its ratings member is used. Public Git
contains authored code, manifests and aggregate evidence; histories, frozen
partitions, fitted parameters and per-person predictions stay ignored locally.

The original records have 1–5 integer grades and no timestamps. The adapter
preserves the original grade and explicitly multiplies by two. Thus this source
observes 2/4/6/8/10, while **native Kajo still accepts all eleven 0–10 grades**.
Missing or unread is never zero. Source identity is not a native account and
cannot link an integer book-user ID to a MovieLens user.

Use Python standard library and the workspace's supported Node version:

```sh
npm run research:books:prepare
npm run research:books:download
npm run research:books:normalize
npm run build --workspace @kajo/prediction-engine
node scripts/research/evaluate-books.mjs freeze --input-dir <printed-normalized-path> --out research-artifacts/books-frozen
node scripts/research/evaluate-books.mjs run --input-dir research-artifacts/books-frozen --out research-artifacts/books-run
```

An already acquired compressed member can be supplied with
`research:books:normalize -- --member <ratings.deflate> --output-dir <new-stage-root>`.
It passes the same pinned hashes/CRC/count checks. Download fetches only the
selected 24,793,669 compressed bytes plus bounded header metadata over verified
HTTPS; it never disables TLS verification or downloads the 1.49-GB whole ZIP.
Existing member files and complete normalized stages are integrity-checked;
partial failures do not replace accepted bytes. Source/code changes produce a
new normalized stage identity. Ordinary tests use artificial sources offline.

The two-pass normalizer validates all 5,152,656 ratings and source counts. It
ranks potentially eligible readers by a fixed SHA-256 seed, deduplicates the
first 2,000 candidates and takes the first 500 with at least 20 unique,
nonconflicting ratings. All versions of a conflicting pair are excluded.
Complete selected histories yield **31,144 rows**, minimum 20, maximum 965.
The raw/expanded byte, row, line, identity, candidate and cohort bounds fail
closed; an insufficient candidate pool is never silently expanded.

The separate `./research-static` export accepts undated matrix evidence and
shares the numeric shrinkage calculation with other research/native callers.
It cannot be substituted for temporal E1 evidence. The
[`static-v1` protocol](manifests/book-genome-static-v1.json) is deliberately an
**exposed-development conformance replay**: 400 users supply 16,064 training,
3,461 validation and 3,669 test rows; 100 held-out users supply 1,632 fixed targets.
Hash masks are label-blind, not a simulation of real rating arrival. Global/item
means fit only training rows; profile offsets use only the supplied visible mask.
Three fixed baseline variants and shrinkage 10 were already declared. Validation
selection is written before test scoring, and tests cannot update the model.

| Static variant | Test MAE, mapped scale | Test RMSE, mapped scale |
| --- | ---: | ---: |
| Global mean | 1.689240 | 2.146890 |
| Shrunken item mean | 1.667715 | 2.118500 |
| Item mean plus shrunken profile offset | 1.537712 | 1.938469 |

The 0/5/10/20 cold budgets mean **numbers of visible ratings**, never allowed
grades. They retain exactly the same targets; the 20 budget has 16–20 available
rows per subject. Profile-offset RMSE is respectively 1.947316, 1.898324,
1.878759 and 1.844528. This selected cohort does not prove a universal benefit
from every additional rating, recommendation uplift, calibrated uncertainty or
native scale equivalence.

[`reports/book-genome-static-v1.json`](reports/book-genome-static-v1.json)
contains aggregate lineage, masks, metrics and conformance. All 31,144 raw-label
and source-line triples and all 3,669 test predictions match the prior private
Python audit (itself independently checked with SQLite); the largest difference
among 54 aggregate metrics is 3.11e-15. A second built run has identical output.
This is implementation evidence, **not a newly untouched final test**. Models,
raw rows and private owner evidence are not published. Quality admission and
serving activation remain **NONE**. A new model-selection question needs a
separate frozen, disjoint cohort/protocol; MovieLens's already exposed final
results likewise remain development/replay evidence.

## Disjoint book development comparison — #419

The [declared protocol](manifests/book-genome-development-v2.json) compares the
existing item-mean control with profile offset on 500 different readers. The
previous cohort is excluded by exact file hash and subject ID before selection;
its private ratings file is an exclusion witness, never new training data.
The new seed and numerical decision are fixed before the new scores are read.
No ratings from MovieLens are joined to these readers.

From a verified ratings member and the prior cohort file, normalize and then
freeze **before** fitting. Use the exact new stage path printed by normalize:

```sh
npm run research:books:normalize -- --experiment development \
  --member research-data/book-genome-2021/ratings.deflate \
  --exclude-cohort /path/to/prior-stage/ratings.jsonl \
  --output-dir research-artifacts/book-development-v2-intake
npm run research:books:evaluate -- freeze --experiment development \
  --input-dir /path/to/new-stage --out research-artifacts/book-development-v2-frozen
npm run research:books:evaluate -- run --experiment development \
  --input-dir research-artifacts/book-development-v2-frozen --out research-artifacts/book-development-v2-run
npm run research:books:evaluate -- run --experiment development \
  --input-dir research-artifacts/book-development-v2-frozen --out research-artifacts/book-development-v2-replay
```

The runner rechecks the source, code/runtime/protocol, exclusion bytes and every
partition identity. Prediction journals and fitted artifacts stay private.
Each reader receives equal weight in primary RMSE and MAE; 2,000 deterministic
paired reader-bootstrap samples describe the development comparison. Failure
of validation, holdout or any cold guard retains item mean. Zero visible ratings
must produce identical control/challenger forecasts. The existing replay command
remains explicitly exposed-data conformance. Neither mode activates serving,
proves temporal book learning or supplies a native FINAL window.

[The measured #419 result](reports/book-genome-development-v2.md) retains a new
500-reader/33,243-rating cohort with zero prior-reader overlap. Profile offset
passes all declared research guards; two built runs and the independent audit
agree. [Aggregate JSON](reports/book-genome-development-v2.json) preserves losses,
intervals, counts, coverage and provenance without raw histories or fitted data.

## Centered response spread — #421

The [frozen protocol](manifests/rating-response-spread-v1.json) compares one
centered, penalized slope with the same train-only item/global base and shrunk
location. It declares all parameters, source bounds, support, budgets, equal-user
loss/paired bootstrap and per-domain selection/holdout/cold decision rules.
Publish code/protocol **before** selecting either new cohort. A losing or
unsupported candidate retains the control; no serving artifact is admitted.

The third BOOK cohort excludes both exact private witnesses. MovieLens 32M uses
complete, label-blind longitudinal-support histories and 2021 validation / 2022+
test outcomes after the small release. Cross-release person overlap is unknown.
Original source grades and timestamps remain intact; BOOK dates stay unknown.

```bash
# Source-only preparation/download is separate from cohort selection.
python3 scripts/research/movielens.py prepare --source 32m
python3 scripts/research/movielens.py download --source 32m
# Only after the predeclaration is published:
python3 scripts/research/movielens.py normalize --source 32m --experiment response --output-dir research-artifacts/response-movie-intake
python3 scripts/research/book_genome.py normalize --experiment response --member research-data/book-genome-417-verified/ratings.deflate --exclude-cohorts PRIOR_FIRST_RATINGS_JSONL PRIOR_SECOND_RATINGS_JSONL --output-dir research-artifacts/response-book-intake
npm run build --workspace @kajo/prediction-engine
node --max-old-space-size=768 scripts/research/evaluate-response.mjs freeze book BOOK_STAGE research-artifacts/response-book-frozen
node --max-old-space-size=768 scripts/research/evaluate-response.mjs run book research-artifacts/response-book-frozen research-artifacts/response-book-run
node --max-old-space-size=768 scripts/research/evaluate-response.mjs freeze movie MOVIE_STAGE research-artifacts/response-movie-frozen
node --max-old-space-size=768 scripts/research/evaluate-response.mjs run movie research-artifacts/response-movie-frozen research-artifacts/response-movie-run
```

Replace uppercase paths with the observed intake stages / original private
witnesses, never reconstructed substitute identities. Freeze binds source,
normalizer, built arithmetic, runner, protocol, runtime, cohort and partitions.
Repeat `run` into a new output directory; deterministic files must match, with
variable resource measurements kept separately. Raw rows, witnesses, predictions
and fitted models remain private/ignored; publish aggregate reports only.

This bounded experiment precedes the owner's broad individual-rating pretraining
request (`MVP-ALG-013`). Scaling requires a separately frozen eligible-data plan,
protected evaluation, learning curves, coverage/cost and a reproducible admitted
artifact with rollback. Noncommercial research permission is not serving approval.
