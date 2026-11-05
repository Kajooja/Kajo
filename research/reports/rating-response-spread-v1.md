# Centered response spread — BOOK/MOVIE development #421

Both domains retain the **location-only control** under the predeclared rule.
BOOK worsens slightly; MOVIE improves, but below the fixed 0.02 mapped-unit
minimum gain in both validation and holdout. No threshold was changed after scores.

The code/protocol was published as `8d3c50bcd940313f4bf26c9e97ff9ce81c8909d4`
before either cohort was selected. Source/CI acceptance remains separate from
this research disposition. No native rows, quality admission or serving activation.

| Domain / split | Subjects / ratings | Control macro RMSE | Added spread | Delta | Paired 95% delta interval |
|---|---:|---:|---:|---:|---|
| BOOK validation | 400 / 3,873 | 1.944038 | 1.949350 | +0.005312 | [+0.000989, +0.009770] |
| BOOK holdout | 400 / 4,088 | 1.942582 | 1.950134 | +0.007552 | [+0.002910, +0.012216] |
| MOVIE validation | 400 / 26,012 | 1.673578 | 1.656791 | -0.016787 | [-0.024033, -0.009609] |
| MOVIE holdout | 400 / 27,134 | 1.690601 | 1.681982 | -0.008619 | [-0.014349, -0.003078] |

Macro RMSE is the square root of mean per-subject MSE; each person has equal
weight. Paired bootstrap resamples subjects 2,000 times, separately per domain.
Intervals are development uncertainty, not calibrated personal confidence.

## Source, split and support

- BOOK: 500 new readers / 31,152 ratings, excluding both previous 500-reader
  cohorts through their exact private witnesses. Undated 70/15/15 masks; 100 of the 500 subjects held out for fixed cold targets. Original 1–5 maps ×2.
- MOVIE: verified MovieLens 32M archive, 32,000,204 ratings / 200,948 source users.
  Label-blind counts and complete-history size select a conditional eligible
  population of 2,672; deterministic 500-subject cohort retains 298,690 ratings.
  Global training before 2021, validation in 2021, test from 2022. Held-out
  subjects never enter shared fitting/validation. Original half-stars map ×2.
- Cross-release movie person overlap is unknown. Validation/test outcomes
  postdate the 2018 small snapshot; this is not a disjoint-person claim.
- Source alias checking quarantines 72 conflicting MovieLens aliases; ratings
  and source object identities remain separate, with no native catalogue join.
- Regular slope support: BOOK 399/400, MOVIE 400/400. At cold budget 20, BOOK
  100/100 and MOVIE 99/100; unsupported evidence uses the exact control.
- Cold budgets are counts of visible ratings, not grade choices. Zero/five
  observations reduce exactly to control. Every cold guard passes; movie
  timestamp groups stay whole and actual visible counts are reported.

## Reproduction and interpretation

- BOOK: all 16 deterministic run files match replay. Independent Python verifies 24,570 forecast values and 36 metric/interval entries, maximum forecast difference 2.03e-13. Intake 66.9 s / 73.3 MiB peak; model/evaluation 1.95 s / 138.8 MiB.
- MOVIE: all 16 deterministic run files match replay. Independent Python verifies 161,020 forecast values and 36 metric/interval entries, maximum forecast difference 1.4e-13. Intake 286.2 s / 309.1 MiB peak; model/evaluation 2.00 s / 333.0 MiB.

The comparison shares frozen train-only global/item means, location shrinkage
and source-bound clipping. Only one centered ridge slope is added. Own-training
contribution to item means is shared identically; no cross-fit claim is made.
The slope does not separately identify psychological scale usage and preference.
These rated-item results cannot establish recommendation benefit, cross-domain
transfer, native readiness or permission to serve a research-trained artifact.

The owner’s broad individual-rating pretraining requirement is now explicit as
`MVP-ALG-013`. [Next packet #422](https://github.com/Kajooja/Kajo/issues/422)
prepares scalable eligible-data training and protected learning curves. Rejected
spread remains inactive; current research-only rights do not admit production use.

## Evidence

- [Frozen protocol](../manifests/rating-response-spread-v1.json)
- [BOOK aggregates](rating-response-book-v1.json)
- [MOVIE aggregates](rating-response-movie-v1.json)
- [MovieLens exact source manifest and attribution](../manifests/movielens-32m.json)
- [Book Genome exact source manifest and attribution](../manifests/book-genome-2021.json)

MovieLens attribution: F. Maxwell Harper and Joseph A. Konstan. 2015.
*The MovieLens Datasets: History and Context*. ACM TiiS 5(4), Article 19.
https://doi.org/10.1145/2827872. Book Genome attribution is retained verbatim in
the linked reviewed source manifest. No endorsement is implied.
