# Disjoint book development comparison — #419

Date: **2026-11-05**. [Declared question](https://github.com/Kajooja/Kajo/issues/419)
· [Frozen protocol](../manifests/book-genome-development-v2.json)
· [Aggregate evidence](book-genome-development-v2.json).

**Decision: retain the existing profile-offset model as the offline research
baseline.** It passes the declared validation, development-holdout and cold-start
rules. Quality admission and native serving activation remain **NONE**.
The source and protocol were published as `b99cf819b23fcd2701a3d1d0826a95b0b0e882f8`
before selecting the new cohort; source/CI acceptance belongs to the implementation PR.

## New cohort and fixed test

The verified Book Genome ratings member supplies **500 different readers and
33,243 ratings** (20–814 per reader). Every reader in the earlier 500-reader,
31,144-rating pilot is excluded using its exact private cohort bytes and declared
SHA-256. Independent normalization produces identical cohort/receipt/witness files;
verified subject overlap is **zero**. No source user identities are published.

Four hundred readers supply 17,915 training, 3,860 validation and 4,078 development
holdout ratings. One hundred readers remain outside all fitting and validation;
their 5,873 eligible evidence ratings and 1,517 fixed targets supply cold tests.
These are label-blind hash masks, **not chronology**: Book Genome has no dates.
No model configuration, seed or threshold changed after seeing these scores.

Original integer 1–5 ratings remain intact; the explicit ×2 transform gives
2/4/6/8/10. Native Kajo retains every integer 0–10. Missing and unread are not
zero, dislike, negative sampling or made-up source outcomes.

## Equal-reader outcome

Primary RMSE is `sqrt(mean(per-reader MSE))`; MAE also gives each reader equal
weight. This differs from a rating-weighted error when history lengths vary.
Both models predict exactly the same targets through explicit item/global fallback.
A complete forecast does not imply fitted item or personal support.

| Partition | Item-mean RMSE | Profile-offset RMSE | Item-mean MAE | Profile-offset MAE |
| --- | ---: | ---: | ---: | ---: |
| Validation, 400 readers | 2.053515 | 1.903041 | 1.626356 | 1.508653 |
| Development holdout, 400 readers | 2.117010 | 1.994163 | 1.663276 | 1.565323 |

The held-out RMSE improvement is **0.122847 mapped scale points (5.80%)**.
The paired-reader bootstrap 95% difference interval, challenger minus control,
is **[−0.148940, −0.097318]** using 2,000 deterministic replicates. This interval
describes this development comparison; it is not personal prediction confidence
or a percentage of knowing a Kajo user.

The control and only challenger use fixed shrinkage 10. Eligibility required
at least 0.05 RMSE improvement, a negative upper paired interval bound, no more
than 0.02 MAE deterioration and full target coverage. Selection was written
before holdout scoring. Both stages pass. The development margins were fixed
from the exposed pilot before this new cohort; they are not native utility criteria.

## Same-target cold checks

All budgets use the same 1,517 targets from all 100 excluded readers. Budgets
are **visible rating counts**, never a restriction of the native grade scale.
The 20-record maximum can expose only 16 records for a minimum-length history;
actual minimum/maximum evidence counts are in the JSON report.

| Maximum visible ratings | Profile-offset minus item-mean RMSE | MAE difference |
| ---: | ---: | ---: |
| 0 | 0.000000 | 0.000000 |
| 5 | −0.081230 | −0.036722 |
| 10 | −0.127055 | −0.079524 |
| 20 | −0.141012 | −0.099240 |

Every cold noninferiority guard passes; with zero evidence every prediction
matches control exactly. No cold target label is visible to its own prediction.

## Verification and resource scope

Two built runs reproduce **every output file byte for byte**. An independent
SQLite fit/Python prediction and paired-bootstrap audit checked **42,018 forecast
values and 36 macro-metric/interval values**, maximum difference **1.78e-15**
(tolerance 1e-11). The independent audit script and full artifacts are retained
privately; Git contains protocol, source and aggregate evidence only.

The two Node executions took 1.22 and 1.02 seconds. Maximum observed cumulative
child RSS across the two runs was 170,492 KiB, with a 512 MiB Node heap limit.
These are this machine's execution measurements, excluding intake/build;
they are not serving latency or a calibrated resource guarantee.

Local focused checks pass (nine Python intake tests and eight Node runner/macro
tests). The root check passes lint/typecheck and its earlier suites but stops
at Deno's registry connection refusal. Remaining checks and exact-head required
CI are recorded in the implementation PR; no check is disabled or inferred passed.

## Movie counterpart and next question

The equivalent movie intake/evaluation already exists: **MovieLens Latest Small,
Kaggle v2**, 500 selected users and 84,849 ratings. Its 0.5–5 half-star scale maps
by ×2 to 1–10, while the historical D2 report keeps its explicitly original-scale
metrics. Rating-entry timestamps support chronology and complete equal-time
groups. Its [eight-model D2 comparison](movielens-small-d2.md) and prefix study
remain separate; the validation-selected recent-state challenger was rejected
under its declared gain threshold. This book result does not reverse that result.

The next bounded question is whether supported, regularized response-spread
modeling improves over this location-only baseline. Declare the comparison and
fresh selection/holdout evidence per domain before fitting; use exposed data
only for development/conformance. No book/movie identities may be joined.
Native recommendation benefit, permissions for serving, source-specific scale
behavior, cross-domain transfer and prospective Kajo outcomes remain open gates.

## Attribution

GroupLens Book Genome, 2021-12-30. Kotkov, Medlar, Maslov, Satyal, Neovius and
Glowacka (2022), *The Tag Genome Dataset for Books*, CHIIR,
https://doi.org/10.1145/3498366.3505833. Reviewed noncommercial research under
CC BY-NC 3.0; no endorsement, commercial/serving admission, raw-history publication
or fitted-artifact redistribution. No descriptions, review texts or genome scores
trained on all source labels entered this experiment.
