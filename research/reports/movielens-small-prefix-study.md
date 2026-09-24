# MovieLens prefix adaptation — exploratory study #265

Date: **2026-09-24**. Issue [#265](https://github.com/Kajooja/Kajo/issues/265).
[Fixed protocol](../manifests/movielens-small-prefix-study.json) ·
[Aggregate evidence](movielens-small-prefix-study.json).

**Finding:** on the declared reused development outcomes, recent rating-entry
history improved the fixed durable-state estimate compared with earliest history
under the same maximum ten-rating budget. RMSE fell from **0.850843 to 0.807788**;
recent minus earliest is **−0.043054**, with paired subject-bootstrap 95% interval
**[−0.060646, −0.024471]**. This is an exploratory finding, **not a fresh holdout
result, native recommendation uplift or model admission**. Existing D2 rejection
and native admission deferral remain unchanged.

## Fixed question and actual execution

The source is the same owner-authorized GroupLens Latest Small September 2018 /
Kaggle version 2. A new bounded download matched the original **993,937 bytes**
and archive SHA-256. Normalization reproduced the original **84,849 observations
from 500 subjects**, with the same source/member/adapter/output identities.
No new source or serving rights were assumed.

The protocol and implementation were committed at **`e37f63d` before fitting**.
Freeze receipt **`e21f14b673a33161f95643d4e0eeeee4f4e1c4fffa8c61d5c41ccbf481c59aa8`**
binds source, code, runtime, original D2 membership, all four original partitions,
both cutoffs and the unchanged model configuration. The study makes no parameter
search, winner selection or final-window reselection.

- Global models use exactly the original **46,410 training ratings from 299
  actually observed training subjects**, with **6,367 training items**, before
  **2014-11-10 00:10:26 UTC**. All 100 reserved subjects remain excluded from fit.
- Targets are every reserved-subject rating at or after that cutoff:
  **5,707 ratings from 23 subjects on 2,646 objects**, in **5,701 query groups**.
  The other 77 reserved subjects have no post-cutoff targets. This broadens the
  declared exploratory time window; it does not select subjects by their errors.
- Four scored subjects supply **1,562 pre-cutoff history rows**. The other
  nineteen start with no earlier history. Later answers enter only the same
  subject's history after every condition scores the entire current time group.
- Earliest and recent policies retain contiguous complete timestamp groups under
  maximum budgets **0/5/10/20**, stopping when the next group cannot fit. There is
  no within-group label leakage, group skipping or global model update.
- Every condition scores identical subject/object/time/label identities, including
  zero-prefix cases and all **1,218 cold-item targets**. No missing rating is
  treated as dislike, and no recommendation-exposure/ranking claim is made.

The primary contrast was fixed to **recent vs earliest / budget 10 / durable
state**. Twenty-three subjects meet the declared descriptive minimum of twenty.
Its RMSE improvement exceeds the prespecified 0.01 material-gain threshold.
These thresholds interpret this experiment only and authorize no promotion.

## Results and actual information available

All rows below score the same 5,707 targets. RMSE is on the original 0.5–5 scale.
The other budgets are diagnostics, not opportunities to select a new primary.

| Maximum ratings | Earliest mean visible | Recent mean visible | Earliest durable RMSE | Recent durable RMSE |
|---|---:|---:|---:|---:|
| 0 | 0.000 | 0.000 | 0.867481 | 0.867481 |
| 5 | 4.925 | 4.949 | 0.870991 | 0.817959 |
| **10 — primary** | **9.700** | **9.816** | **0.850843** | **0.807788** |
| 20 | 19.301 | 19.300 | 0.861593 | 0.802708 |

Mean visible counts here are weighted by target rows. At budget ten, both policies
had **19 query groups with no available history**. Earliest selection encountered
an oversized boundary group in **665 queries**, recent selection in **five**;
none of these boundary cases left the selected history empty. Equal maximum
budgets can therefore expose different actual counts: the primary comparison is
between practical prefix policies, **not a pure recency effect at equal actual
information**.

For nonempty ten-rating prefixes, target-weighted mean age of the newest visible
rating was **224.03 days** for earliest history versus **1.62 days** for recent
history. The oldest visible rating averaged **224.11 versus 13.89 days**.
Many entries are seconds apart and may be batch rating activity; these are not
inferred viewing sessions or evidence of a psychological state.

The cold-item diagnostic has **1,218 ratings from all 23 scored subjects**.
Durable-state RMSE was **0.923641 earliest / 0.882978 recent** at budget ten;
its paired interval is **[−0.074902, −0.015482]**. Both policies retain subject
state while the item component uses its global fallback. Complete MAE/RMSE,
subject-macro errors, error quantiles, support, tail/cold slices, prefix age,
coverage and paired policy intervals are retained in the aggregate JSON.

The fixed eight existing variants were also measured. At recent budget ten,
durable-plus-recent state gave RMSE **0.798610** and factorization **0.810902**.
These diagnostic values do not change the primary question or select a serving
model. No book-domain or native Kajo quality follows from them.

## Correctness repair, reproducibility and cost

The prior factorization path returned a plain item mean for a known target even
when every prefix item lacked fitted factors, despite reporting zero component
support and fallback. The repaired path retains the declared durable-state
fallback. An invented regression demonstrates the old loss of available subject
state; tests also cover mixed, empty and unknown-target cases.

This correction changes inference only. Replacing the new artifact's
code-manifest ID with the original D2 ID exactly reproduced the original serialized
model SHA-256 **`be74fda4e587d3c21f2b54369742662ffebac7bee9c6512018db4ec911fb1fd4`**.
Historical D2 reports were not edited or relabeled as fresh evidence.

Two independent study fits/evaluations reproduced every parameter, prediction
journal, metric, prefix summary and primary comparison:

- New model SHA-256: **`808283339e023db236a4dd20412cf9b873072457a5c717aa2ed969763684e3ef`**.
- Deterministic result SHA-256: **`1f40db237a52cff34a1ed8b7a91b048939632beaa32456dd831cb1713dd2034b`**.
- Actual fit/evaluation elapsed time: **3.631 / 3.838 seconds**.
- Peak Node RSS: **380,952 / 367,052 KiB**, below 1 GiB.
- Fitted artifact size: **8,014,330 bytes**, below 16 MB.

Costs are machine-specific, measured on Node 24.19.0 / Linux x64, and exclude the
npm/TypeScript build parent. Prefix selection and forecast times are separately
reported. The code/source freeze is separate from a real training run and from
source CI; ordinary CI uses invented fixtures only.

Local engine lint/typecheck and **44 engine tests** passed, as did **19 Python
intake tests, 13 research runner tests and 63 database tests**. The root check
passed lint/typechecks and mobile/catalog tests, then remained blocked retrieving
Deno package metadata; that retry was stopped. **The complete root check is not
claimed as passed.** A separate `EXPO_OFFLINE=1 CI=1 npm run smoke` completed all
four mobile/companion exports and companion isolation verification. Required
current-head CI and merge acceptance remain separate. Independent read-only
method/code/report review confirmed the fixed protocol, original split/config
binding, paired denominator, report arithmetic and exploratory limits.

## Interpretation and remaining limits

The reusable engine can now execute and reproduce this bounded memory-policy
comparison while retaining source, time, label, uncertainty and fallback rules.
The observed gain supports further investigation of recent rating-entry state.
It does not justify fitting on every available label and calling that validation,
automatically swapping Kajo's scorer, or claiming that external ratings trained
Kajo's live Personal/Shared Profiles.

Only 23 selected development subjects support the primary comparison. Cluster
intervals describe this cohort and do not remove source selection bias or make
diagnostic multiple comparisons confirmatory. New model choices informed by
these results require a separately declared untouched evaluation source/window
before a new final claim. Native serving also retains its separate rights,
mapping, compatibility, usefulness, trace, fallback/rollback and device gates.

Raw histories, membership, journals and fitted parameters remain private and
ignored. Publication consists of code, protocol, non-identifying aggregates and
hashes. Source withdrawal still requires removing/rebuilding every dependent
artifact; no externally learned parameter becomes a native-only fallback.

Attribution: GroupLens Research. F. Maxwell Harper and Joseph A. Konstan (2015),
*The MovieLens Datasets: History and Context*, ACM TiiS 5(4), Article 19,
https://doi.org/10.1145/2827872. Noncommercial research only under the reviewed
source terms. No GroupLens endorsement is implied.
