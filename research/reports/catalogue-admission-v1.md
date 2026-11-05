# Research catalogue compatibility — #425

The current catalogue supports **309 exact MovieLens32M → Kajo movie links**
out of 425 discoverable MOVIE Items. Only **270** of those have item statistics
in the retained pre-2021 research model. BOOK has no reviewed identity bridge.
These are identity/support observations, not admission or native prediction quality.
The complete [aggregate evidence](catalogue-admission-v1.json) binds source,
snapshot, model, implementation and independent verification hashes.

## Observed identity coverage

One read-only statement at **2026-11-05T16:23:22.264783Z** captured 841 active
Items, existing aliases and the established six-concept feature projection.
It reads no User, Profile, Event, rating or owned evaluation data and changes no
hosted row. Current metadata is not historical feature-availability evidence.

| Current active catalogue | Items | Disposition |
| --- | ---: | --- |
| MOVIE with an exact, consistent source link | 309 / 425 | Research mapping only; 72.71% |
| Linked MOVIE with retained training-item support | 270 / 425 | 63.53% of catalogue, before any rights/native-quality gate |
| Linked MOVIE without training-item support | 39 | A link alone cannot provide an item-trained prior |
| MOVIE with no source alias match | 114 | No invented title/year link or preference |
| MOVIE with conflicting known IMDb/TMDB identities | 2 | Both quarantined; neither provider's alias wins automatically |
| BOOK with a verified Book Genome identity bridge | 0 / 416 | No reviewed crosswalk; actual title/work overlap remains UNKNOWN |

The complete pinned `links.csv` has 87,585 source objects. Thirty-six aliases
identify multiple source objects; all 72 affected source objects are quarantined
before catalogue intersection, even if their other alias is unique. None of those
72 is a current native candidate in this snapshot. Of all source objects, 87,202
have no catalogue match, two disagree across aliases, and 309 match. Every source
object gets one disposition. Two-source-to-one-Item convergence also fails closed.
IMDb leading zeroes remain strings; missing aliases never become zero identifiers.

The largest research model has 65,959 trained objects. This is distinct from
the 84,432 rated objects and 87,585 catalogue objects in the full release, and
from the #422 confirmation's **27.445% source-cold target fraction**. Current
catalogue coverage and historical target-weighted coverage have different
denominators. This audit does not refit a model or inspect new held-out outcomes.

For BOOK, the publisher describes `metadata.json` with its dataset `item_id`, a
Goodreads URL and title/author metadata, without an ISBN/Open Library field.
Its example even has different dataset and Goodreads URL numbers. The current
native aliases contain Open Library Works and curated slugs; no approved
dataset-to-Work/Edition crosswalk exists. No metadata download, fuzzy identity
merge, fabricated ISBN or assertion of zero real-world overlap follows.

## Native structural feature coverage

Reuse `inspectItemFeatures` and its unchanged `catalog-concepts-v1` mapping.
The native-content projection's existing 128-label/256-code-point bounds give
the following **structural upper bound**, before feature-use permission, capture
clocks/provenance, personal label support, candidate support or predictive quality.

| Native source structure | BOOK / 416 | MOVIE / 425 |
| --- | ---: | ---: |
| Within label bounds with at least one mapped assertion | 235 | 280 |
| Valid source within bounds but no mapped concept | 137 | 145 |
| Source exceeds native label bounds | 14 | 0 |
| No supported provider source | 30 | 0 |

The broader existing inspector finds assertions for 244 BOOKs; nine of those
are among the fourteen oversized sources. Its larger inspection budget does
not widen the native capture contract. No source is silently truncated and
unasserted concepts remain unknown. Fixed six-concept coverage is not a complete
content representation, equivalent book/movie semantics or cross-domain transfer.

## Admission and fallback inventory

| Existing boundary | Reusable behavior | Remaining dependency |
| --- | --- | --- |
| `personal-rating.ts` / #398 | Original 0–10 labels, Personal/domain mean and separately permitted domain prior | External item statistics do not fit this domain-prior API by relabeling them |
| `personal-content-rating.ts` / #405 | Fixed-mean ridge residual; same-target mean control; no labels → unavailable; unsupported content → full-prefix mean | Eligible prospective native evidence must establish useful differentiation |
| Native content adapter / private v2 capture | Source/alias-frozen six concepts, purpose-bound feature-use manifest, lifecycle/withdrawal and original first answers | Structural inspection grants no feature permission; each use requires the retained reviewed manifest |
| #422 external global/item/location baseline | Reproducible separate research source/model; current movie mapping subset above | Current source permission is isolated noncommercial research, not production/derived-artifact approval; constant personal offsets do not learn personal Item ordering |

The native input still has no admitted external-prior channel. Do not copy
external people/ratings, pass an item mean as a domain prior, enlarge source
bounds, add a hidden model family or turn the research result into serving.
Absent/disallowed/withdrawn external artifacts leave the existing native-only
path intact. No numeric support remains unavailable; zero is a valid native grade.
`qualityAdmission: NONE`, `servingActivation: NONE`, and `MVP-ALG-013` remain open.

The next bounded packet is the **native-only content-evaluation preflight**:
reuse the accepted private observation route and operational source pins;
reconcile its current declarations and source-use review; establish supported
training/candidate features and complete opportunity coverage before preparing
any fresh first-answer comparison. Preserve the pending/unread target and all
consumed allocations. No historical answer is a fresh forecast. If permission
or eligible prospective support is missing, retain the mean and record that
exact dependency. More external fits cannot remove it. BOOK identity enrichment
and any eventual external-prior permission/interface proposal remain separate
conditional work, with re-entry only when the intended use and target are clear.

## Verification and limits

The pinned 1,950,748-byte source links match SHA-256
`ef17da7710be76f7d510d5768d1b61826e3af4bf57812b9ca377e4c912123b22`.
The completed research model is opened with SQLite `mode=ro` and `query_only`;
its source/protocol/partition/statistic digest and withdrawal status are checked.
Only model/meta tables are read, not individual research histories or outcomes.
Independent SQLite joins, without importing the implementation, reproduce all
**87,585 object dispositions** and the 36 collision groups. Eleven Python
regressions cover source/native conflicts, missing/zero-padded IDs, domain and
source checks, non-unique targets, drift/withdrawal and read-only behavior. Two
additional catalogue tests cover native label bounds and explicit nonadmission.
Final source CI/merge evidence belongs to the PR; a fixture or successful audit
is not phone, serving, source-rights or recommendation-benefit acceptance.

Sources: [MovieLens32M publisher documentation](https://files.grouplens.org/datasets/movielens/ml-32m-README.html),
[Book Genome publisher documentation](https://files.grouplens.org/datasets/book-genome/book-genome-readme.txt).
Source attribution and reviewed purpose remain in the existing dataset manifests
and [source-use register](../manifests/broad-training-source-use-v1.json).
