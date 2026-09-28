# Sprint 014 — D1 source and real-data checkpoint

Date: **2026-09-12**. Issue [#236](https://github.com/Kajooja/Kajo/issues/236).
Source branch: `feat/236-movielens-research`, based on accepted main
`3747ecb58d69ba78440ca1b72b7cc554b1a9720a` / merged E1 PR #241. E1's five
required jobs passed in CI #471. STATUS owns the exact current continuation.

Current result: the owner-authorized GroupLens 2018 Kaggle v2 alternative supplied
84,849 real ratings from 500 subjects, independently reproduced. The initial 32M
source attempts below are historical; see the selected-alternative result and
exact continuation at the end.

## Initial 32M source delivered for review

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

## Initial validation and 32M source attempt

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
The follow-up below records published source CI. Full D1 acceptance remains open.

### Follow-up source diagnosis

The next continuation repeated the actual `prepare` command; it again exited 1
without source snapshots or a dataset. Reading the bounded checksum error response
identified HTTP 502 from the HTTPS proxy with the message `Certificate verify
failed: certificate has expired`. This is the proxy's reported upstream TLS failure,
not evidence that the release bytes or intended-use terms have changed. Normal
certificate verification remains enabled. The official landing page still works;
its linked Kaggle alternative and a focused search did not establish a verifiable
publisher-authorized 32M copy. Source identity and research approval stay pending.

Draft PR #242 is the source handoff. All five required jobs passed in
[CI #473](https://github.com/Kajooja/Kajo/actions/runs/34709751376) at implementation
head `aab39a51761b2047ff8de5fe522fc773a8c78221`: validation, platform defaults,
two clean application installations, the existing-application forward upgrade and
Supabase CLI/history. This follow-up changes documentation and attempt metadata
only; the implementation and the 338-test local result are unchanged. Manifest
JSON, pending source/rights gates and `git diff --check` were verified; the unchanged
full check was not repeated for this metadata-only follow-up.

## Selected alternative and actual intake — owner follow-up

The owner explicitly requested a suitable available seed instead of waiting for
32M. GroupLens's own Kaggle Latest Small version 2 was selected after reviewing
its archived README Usage License and publisher metadata. Research use has
attribution/no-endorsement conditions and commercial use requires permission.
The publisher labels this a development dataset, unsuitable for shared benchmark
claims. D2's first scope is therefore a pinned, bounded development comparison.
The source manifest records the exact reviewed purpose and five member hashes;
SHA-256 values were computed from actual retrieved bytes, not represented as
publisher-issued checksums. Both initial and authored archive downloads matched.

Actual source counts are 100,836 ratings, 610 subjects, 9,742 movies and 3,683 tags.
The fixed 500-subject hash cohort contains 84,849 ratings, retaining complete
20–2,698-rating histories. All ratings remained valid. One TMDb alias collision
quarantined both affected mapping records; ten objects lack usable TMDb aliases
in total, with no missing IMDb mappings. No source people or movie IDs were merged.
Raw data and per-subject histories remain ignored, separate from native Kajo.

Two fresh executions agree on all normalized hashes/manifests and the engine
Observation hash `2bf4213edc2e63b7fd208900342fab98d4b971a2ce9e1760c9339531cb0e9463`.
A third execution reused only verified stages. The final first/replay runs took
1.94/1.73 seconds; largest child RSS was 132,268 KiB, which is not total concurrent
process-tree memory. [Aggregate evidence](../../../research/reports/movielens-small-v2-intake.json)
records commands, exact source/code/output hashes and measured limits.

The real run exposed that first-N probe records can all share one timestamp.
The probe now retains at most twenty earlier records and waits for a strictly
later observed group; absence of such a group is explicitly unsupported. The
actual probe passed with twenty prior records. Regression tests cover both a
large equal-time batch and an all-tied history. This proves the bounded prefix
contract, not predictive quality, fitted parameters or serving readiness.

The final `EXPO_OFFLINE=1 CI=1 npm run check` passed **345 tests**: 212 mobile,
14 catalog, 61 database, 35 engine, 19 Python intake and four pipeline cases.
Lint/TypeScript and both Hermes exports passed, with the unchanged mobile Hook
warning. Tests are artificial and separate from the real-data evidence above.
No dependencies, hosted changes, UI edits or manual APK dispatch were added.

## Exact continuation

Finish the new source head's required CI and review, then accept D1 #236 / PR #242.
D2 #237 starts with this exact development cohort: freeze global temporal cutoffs,
held-out-subject prefixes, final test, source/code identity, seeds, candidate/task
semantics, metrics and resource limits before fitting. Compare train-only baselines
and bounded static-state/ordered-prefix memory under the declared data limits.
Do not wait for the unavailable 32M endpoint as an implicit prerequisite; it can
supply a separate larger stable benchmark later. Keep source-model admission and
native #229 acceptance independent. MVP-ENG-002 stays open through the D2 report.

## Source acceptance — 2026-09-12

All five required jobs passed in [CI #475](https://github.com/Kajooja/Kajo/actions/runs/34712191386)
at `816bf2e6c1437e29f664faef9669729507968209`. PR #242 was squash-merged to main
`7602b3418354687855f6b3384085684f4b37a373`; #236 is closed. The earlier current-head
acceptance/32M retry instructions above are historical. D1 is complete. D2's real
training/evaluation and the next release handoff are recorded in
[the D2 checkpoint](SPRINT-014-D2.md) and current STATUS.
