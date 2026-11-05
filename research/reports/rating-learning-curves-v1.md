# Individual-rating learning curves — #422

The frozen comparison retains the larger research model in both domains. The
largest background fits use **5,007,233 BOOK** and **28,445,684 MOVIE** individual
observations, with unchanged item/subject shrinkage 10. All evaluation people,
including their visible ratings, are excluded from the shared fit. This measures
broader item support at fixed personal evidence, not a new model family or native
recommendation benefit. Source/CI acceptance remains separate.

Protocol/code were published at `900291d7fe10cced63e080e81ce8ff8459e25e96`
before fresh selection or fitting. The original MOVIE ingestion rejected its
CRLF header at zero records, before selection. Header-only correction
`3418d006ee1421cbd12a39765fade02fe555275b` and a regression test were published
before MOVIE selection. No numerical rule, source byte or cohort seed changed.
BOOK's original protected confirmation is retained; a complete second run under
the correction reproduces its exact statistics, partitions, metrics and decision.
That replay is exposed conformance, not another untouched confirmation.

## Observed development curves

Primary error is sqrt(mean per-person MSE), with up to 20 fixed visible ratings.
Each size scores the same 400 development people and same targets. Native Kajo
grades remain 0–10; BOOK source grades map to 2/4/6/8/10 and MOVIE to 1–10.

| Domain | Background people | Individual training ratings | Macro RMSE | Macro MAE |
| --- | ---: | ---: | ---: | ---: |
| BOOK | 1,000 | 14,636 | 1.946822 | 1.540857 |
| BOOK | 5,000 | 71,295 | 1.910133 | 1.505211 |
| BOOK | 20,000 | 280,803 | 1.884256 | 1.473170 |
| BOOK | 348,032 | 5,007,233 | 1.862088 | 1.455416 |
| MOVIE | 1,000 | 145,133 | 1.698514 | 1.281657 |
| MOVIE | 5,000 | 738,985 | 1.673818 | 1.256495 |
| MOVIE | 20,000 | 3,057,924 | 1.661469 | 1.242064 |
| MOVIE | 186,650 | 28,445,684 | 1.649356 | 1.229853 |

The predetermined smallest-size-within-0.01-of-best rule selects the largest
size in both domains. All four finite size points were completed; there is no
post-result expansion or guarantee that more data must always help.

## Protected research confirmation

Selection receipts were committed before opening separate 400-person confirmation
groups. Only the selected size and smallest control were compared there.

| Domain | Fixed targets | Small → selected RMSE | Relative decrease | Paired 95% delta interval | Small → selected MAE |
| --- | ---: | --- | ---: | --- | --- |
| BOOK | 4,959 | 1.898911 → 1.825152 | 3.88% | −0.096781…−0.050345 | 1.514161 → 1.446338 |
| MOVIE | 24,416 | 1.656061 → 1.625156 | 1.87% | −0.042599…−0.020118 | 1.265919 → 1.235771 |

Both meet the frozen 0.02 RMSE gain, negative paired interval, MAE, coverage and
all 0/5/10/20 cold guards. The intervals resample 400 people jointly, not ratings
as independent samples. Coverage is 100% of declared targets, including fallback.
At zero personal evidence, RMSE also falls: BOOK 2.040917 → 1.964186; MOVIE
1.774252 → 1.744473. Actual mean evidence at budget 20 is BOOK 19.5775 and MOVIE
19.99 records. Complete timestamp groups are never split to force exactly 20.

BOOK remains an undated mask experiment. MOVIE shared training and visible
evidence end before 2021; development targets are in 2021 and confirmation targets
from 2022 onward. Cross-release person overlap with Latest Small is unknown.
All these outcomes are now exposed research evidence, not reusable untouched
FINAL, and none is an owned/native prospective outcome.

## Source integrity, coverage and resources

The whole-source scan verifies 5,152,656 BOOK and 32,000,204 MOVIE records. Neither
source contains identical duplicate or conflicting pairs in this run. The code
still resolves conflicts across checkpoints and all selected populations, as
verified by artificial late-conflict/duplicate fixtures. BOOK has 350,332 people
and 9,374 rated Items; MOVIE has 200,948 people and **84,432 rated Items**, distinct
from the release's 87,585-object catalogue. Unrated objects are not zero grades.

All three exposed BOOK cohorts (1,500 people) and the exposed 32M cohort (500)
are excluded entirely. Independent membership reconstruction agrees. BOOK has
59,217 untouched count-eligible evaluation people; MOVIE has 2,172 longitudinally
eligible people after exclusions. The 400+400 groups are fixed before fitting.

At the largest size, **0% of BOOK** versus **27.445% of MOVIE confirmation targets**
have no background item support. The latter uses the global/item fallback; the
smallest MOVIE size had 37.893% such targets. The frozen pre-2021 model cannot
learn later Items from more of the same old data. Native catalogue mapping is
NOT_QUERIED, so external prediction coverage is not Kajo catalogue coverage.
A constant subject offset changes expected marks, not personalized within-user
item ordering except clipping ties; this baseline alone is not the full engine.

In the corrected run, ingestion / fitting took roughly 75 / 13 seconds for BOOK
and 144 / 32 seconds for MOVIE (wall time, concurrent local work; not a paired
performance benchmark). Peak recorded RSS was about 163 MiB / 110 MiB. Completed
SQLite stores are 148,049,920 / 920,047,616 bytes, plus separately retained
271,599,056 / 877,076,222-byte publisher rating streams. The private resource
counters retain stage timings and observed directory bytes, including transient
workspace overhead; all predeclared time/RSS/directory budgets passed.

## Verification and disposition

Twelve offline regressions cover exact interrupted/uninterrupted replay, conflicts
arriving after a checkpoint, identical repeats, CRLF boundaries, single-writer
locking, source/code/protocol/statistic drift, exact membership/leakage, protected
selection, time ties, scale/missingness, budgets and withdrawal/native-only fallback.
A bounded fixture matches the built engine's global/item/location arithmetic.

An independent raw-row/NumPy audit rereads all **37,152,860 source records**,
reconstructs evaluation/background membership, verifies every count/sum in all
eight models, recomputes **663,496 forecast values**, and verifies confirmation
bootstrap intervals. Maximum numerical discrepancy is **4.45e-16**. It imports
none of the trainer's implementation. Full private stores, original failure,
selection receipts, models, journals, audit code/results and source identities
are retained outside public Git; [aggregate JSON](rating-learning-curves-v1.json)
contains the public evidence.

Disposition: **RETAIN_LARGER_RESEARCH_MODEL** in both domains. Rights remain
noncommercial isolated research only under the
[source-use register](../manifests/broad-training-source-use-v1.json).
No external weights enter native serving. Production/commercial/redistribution
permission, source-to-Item compatibility, native quality, rollout/rollback and
`MVP-ALG-013` pre-release admission remain open. Existing D2 and response-spread
rejections remain unchanged; Sprint 016 and Engine V1 are not closed.

Next, audit catalogue linkage/coverage, temporal cold Items and the exact rights/
adapter boundaries before choosing a useful native-scoped offline comparison.
No account reset, native write, migration, target replacement or owner input is
needed for that read-only/source work.

Attribution: GroupLens MovieLens — Harper & Konstan (2015),
DOI 10.1145/2827872; Book Genome — Kotkov et al. (2022),
DOI 10.1145/3498366.3505833, CC BY-NC 3.0. See the pinned source manifests for
publisher links, exact source identities and intended-use reviews. No publisher
endorsement or demonstrated Kajo recommendation uplift is claimed.
