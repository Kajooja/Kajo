# Sprint 014 — D1 source checkpoint

Date: **2026-09-12**. Issue [#236](https://github.com/Kajooja/Kajo/issues/236).
Source branch: `feat/236-movielens-research`, based on accepted main
`3747ecb58d69ba78440ca1b72b7cc554b1a9720a` / merged E1 PR #241. E1's five
required jobs passed in CI #471. STATUS owns the exact current continuation.

## Source delivered for review

A pinned-release manifest and Python 3.12 standard-library intake implement
metadata review before download, verified atomic ZIP download, safe bounded
member streams, CSV/schema/reference/alias validation, counted quarantine,
seeded subject selection with complete valid histories and chronological JSONL.
Exact duplicate ratings count once; conflicting pair versions are all quarantined
without inventing correction history. Shared aliases are removed from all
affected mappings without merging movies. Missing aliases stay missing.

The independent engine's separate MovieLens export preserves raw 0.5–5 ratings,
release-scoped identities, external observed provenance and explicit offline
availability assumptions. Null actor/action/prediction and unknown exposure do
not become native Kajo facts. A Node runner invokes actual Python normalization
and streams records through the built TypeScript adapter into a second atomic
stage. Input/output/archive/file/code hashes bind repeatable checkpoints.
The core computation import graph remains independent. No native UI, SQL,
provider catalog or authentication code changed. No dependencies were added;
ordinary CI now sets up Python 3.12 for artificial source tests.

## Validation and actual source attempt

Local `EXPO_OFFLINE=1 CI=1 npm run check` passed **338 tests**: 212 mobile,
14 catalog, 61 isolated database, 34 engine, 15 Python intake and two actual
Python → built TypeScript fixture-pipeline cases. Lint/TypeScript and iOS/Android
Hermes exports passed; the existing DiscoveryScreen Hook dependency warning
was not changed. Cases include malformed quoting/headers, exact/conflicting
duplicates, missing/conflicting aliases, archive traversal/symlinks/duplicates,
byte/record/history/field bounds, counted quarantine, changed hashes/terms, safe ignored storage,
chronological order, equal-time prefix exclusion and atomic verified replay.

The GroupLens landing page was accessible, but README, publisher checksum and
archive requests returned HTTP 502 through both web retrieval and this runtime.
The publisher's linked Kaggle profile returned 404; no unverified substitute
release/mirror was used. The actual authored command
`npm run research:movielens:prepare` exited 1 with
`MovieLens intake stopped: HTTP Error 502: Bad Gateway`. It did not save a source
snapshot or download a dataset. Publisher hashes/research approval remain null
and pending in the tracked manifest. No real cohort counts/hashes, model training,
quality gain or serving permission are claimed. Raw/derived research paths were
confirmed ignored; temporary artificial test archives were removed by tests.
Published-head source CI and full D1 acceptance remain separate open gates.

## Exact continuation

Finish this source PR's required CI. Resume the same D1 issue/branch with
`research:movielens:prepare`; inspect the exact retrieved source terms/checksum
and record verified identities/reviewer/scope. Run download, inspect archived
README and file hashes, then normalize the real full-history cohort. Record actual
source/cohort/quarantine/mapping counts, resource evidence and repeat hashes in
an aggregate checkpoint without committing histories. Only after that does
D2 #237 start its frozen temporal/cold-start baseline comparison. D1 remains open
while publisher access blocks the real run; do not close it because fixtures pass.
No manual APK dispatch, hosted write, account reset or UI correction ran here.
