# MovieLens D2 — bounded development comparison

Date: **2026-09-12**. Issue [#237](https://github.com/Kajooja/Kajo/issues/237). D1 is accepted through [#242](https://github.com/Kajooja/Kajo/pull/242), main `7602b3418354687855f6b3384085684f4b37a373`, after all five required CI #475 jobs passed.

**Decision: reject challenger admission for this configuration; keep native serving unchanged.** The validation-selected recent-state challenger improved RMSE by only **0.001959**, below the predeclared **0.01** threshold. Its final frozen-batch improvement does not override that rule. No parameter was tuned or model reselected after final testing.

The independent replay reproduced fitted-parameter hashes, every prediction journal, all metrics and subject-bootstrap intervals, the decision and the absent/invalid/withdrawn fallback. The [aggregate JSON](movielens-small-d2.json) contains exact source/code/partition/result hashes, protocol, slices, intervals, costs and replay evidence; it contains no subject membership, histories or fitted weights.

## Frozen protocol

- Source: GroupLens Latest Small, September 2018 / Kaggle version 2; D1’s fixed 500-subject, 84,849-rating cohort. This is publisher-labeled development data, not a shared benchmark.
- Globally chronological regular-subject partitions: **46,410 train / 9,945 validation / 9,945 final**. Train is strictly before **2014-11-10 00:10:26 UTC**; final begins **2017-04-01 23:59:32 UTC**. Equal timestamp groups remain intact.
- **100 subjects** are held out from all global fits and validation selection. Final regular test has **58 subjects**; held-out-subject final test has **2,149 ratings from 13 subjects**. The remaining 87 reserved subjects have no final-window target.
- Frozen-batch subject state uses training history only. The separately named prequential run starts with permitted train/validation history and reveals a subject’s answer only after scoring its complete timestamp group. Global means, factors and memory bank never update during either final test.
- Models predict the same actually rated object on its original **0.5–5** scale. There are no sampled negatives, ranking metrics, probabilities, viewing-time claims or native exposure assumptions. Metadata is off because its historical availability is unestablished.
- One configuration per variant; select on validation RMSE before reading final partitions. Primary reference is durable state. Bootstrap uses 500 seeded subject-cluster replicates, preserving paired errors. Final tables for unselected variants are diagnostics only.

## Comparable rating errors

Lower is better. Frozen-batch and prequential columns describe different information availability. All rows use the same 9,945 final targets.

| Model | Validation RMSE | Final frozen MAE | Final frozen RMSE | Final prequential RMSE |
|---|---:|---:|---:|---:|
| Global mean | 1.132985 | 0.900117 | 1.114347 | 1.114347 |
| Shrunken item mean | 1.098825 | 0.852039 | 1.066349 | 1.066349 |
| Durable state | 1.085933 | 0.851243 | 1.064416 | 0.876094 |
| Durable + recent state | 1.083973 | 0.849022 | 1.062729 | 0.811834 |
| Item neighbors | 1.086433 | 0.851924 | 1.065278 | 0.882501 |
| 8-factor challenger | 1.085918 | 0.851245 | 1.064416 | 0.878900 |
| Static-prefix retrieval | 1.086210 | 0.851361 | 1.064702 | 0.896911 |
| Ordered-prefix retrieval | 1.084071 | 0.849243 | 1.063034 | 0.836502 |

The recent-state challenger’s paired final frozen RMSE difference versus durable state is **−0.001687**, with subject-bootstrap 95% interval **[−0.004772, −0.000116]**. Its earlier validation gain failed the acceptance threshold, so this final result is not promotion evidence.

In the separate prequential experiment, durable state gives RMSE **0.876094**, recent state **0.811834**, and ordered-prefix retrieval **0.836502**. The recent-state paired difference is **−0.064261**, interval **[−0.089145, −0.034840]**. Recent rating-entry history is useful within this experiment; adding this bounded retrieval bank is worse than recent state alone. This does not establish native recommendation usefulness or viewing trajectories.

## Support and cold start

Only **457/9,945** frozen final targets (seven subjects) have any training-era subject history. **9,488** targets belong to 51 subjects unseen by the global training period. This explains why frozen personalized variants mostly return the same item/global fallback. Prediction coverage is 100% through transparent fallback; that is not 100% coverage by the learned component.

| Final frozen item slice | Ratings | Subjects | Durable-state RMSE | Recent-state RMSE |
|---|---:|---:|---:|---:|
| Train support 0 | 2,614 | 57 | 1.182759 | 1.177783 |
| Train support 1–9 | 2,808 | 56 | 1.094741 | 1.094170 |
| Train support ≥10 | 4,523 | 56 | 0.968834 | 0.968665 |

The neighbor graph is bounded to 1,000 training-selected items; memory contains 10,000 train-only prefix/continuation records with at most 64 per item. Ordered retrieval matches **1.68%** of frozen targets and **56.12%** of prequential targets. Exact object matching, prefix support and different-subject eligibility remain required. No-match always returns the declared state baseline.

Held-out subjects use the same 2,149 final targets at all prefix budgets. Prefixes contain earliest complete timestamp groups strictly before final testing. Five of the thirteen scored subjects have no visible prefix at any budget.

| Maximum visible ratings | Actual mean visible | Durable-state RMSE | Recent-state RMSE | Factorization RMSE |
|---|---:|---:|---:|---:|
| 0 | 0.000 | 0.904236 | 0.904236 | 0.904236 |
| 5 | 2.923 | 0.906625 | 0.915984 | 0.906631 |
| 10 | 6.077 | 0.898327 | 0.921295 | 0.898367 |
| 20 | 12.308 | 0.924301 | 0.959973 | 0.909621 |

More earliest history does not consistently help this small, temporally distant cold-start slice. Thirteen subjects and wide grouped intervals do not support a general cold-start improvement claim. Full item/subject slices, actual prefix distributions, MAE/RMSE, error quantiles, component/no-match coverage and paired intervals are in the aggregate JSON.

## Cost, integrity and fallback

Each full local fit/evaluation took **6.69 / 6.72 seconds**. First-run fitting took 0.091 s for means, 0.228 s for neighbors, 0.409 s for factorization and 0.055 s for memories. Peak Node RSS was **372,784 / 368,548 KiB**, below the 1 GiB budget. The ignored serialized model is **8,014,330 bytes**, below 16 MB. These measurements exclude the npm/TypeScript build parent and are machine-specific.

All eight models together had query-batch p95 **0.0264 ms** frozen and **1.3586 ms** prequential; amortized cost per target was **0.0411 / 0.3129 ms**. Prefix validation/encoding and fold-in are included; IO, aggregation and bootstrap are excluded from model latency. Query groups can contain multiple targets.

Before fitting, the runner sealed protocol/code/runtime identity, exact cutoffs and partition/membership hashes. It saved validation selection and the model hash before its first read of final partition files. Two independent fits then produced model SHA256 `c3a1a337f3291477c29920d039de6e396626373e8e30f1e4eced23eb1f16b479` and deterministic result SHA256 `46e68b5310e6a3ff08793a85145b897992a43337b741ba93f360acb302ba49a8`.

Actual real-data probes for absent, invalid and withdrawn models each returned **unavailable with zero native support**, never an external mean or learned vector. Separate invented unit fixtures also verify that an authorized native observation remains usable and disallowed/out-of-domain/nonfinite/future artifacts fail closed. This research boundary is not wired into native serving.

Withdrawal means stopping every dependent model/index/cache and rebuilding from separately authorized inputs, then reevaluating; deleting raw files or zeroing one coefficient cannot remove jointly learned influence. Native admission is **deferred** pending rights, mapping, usefulness, compatibility, isolation, provenance and rollback/device gates. No hosted operation or UI change occurred.

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **357 tests**, lint/TypeScript and both Hermes exports. The existing mobile Hook dependency warning remains. Required current-head CI and merge are recorded on the source PR. [Repeat commands and exact model definitions](../README.md#d2--reproducible-development-evaluation).

## Attribution

GroupLens Research: [MovieLens Latest Small](https://www.kaggle.com/datasets/grouplens/movielens-latest-small). F. Maxwell Harper and Joseph A. Konstan (2015), [The MovieLens Datasets: History and Context](https://doi.org/10.1145/2827872), ACM TiiS 5(4), Article 19. Current use is local noncommercial development under the D1 reviewed terms. No GroupLens endorsement is implied.
