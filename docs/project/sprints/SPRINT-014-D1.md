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

## Exact continuation

Verify any later PR-head CI before merging. Once normal HTTPS verification succeeds or
an independently verifiable publisher-authorized exact copy is available, resume
the same D1 issue/branch with
`research:movielens:prepare`; inspect the exact retrieved source terms/checksum
and record verified identities/reviewer/scope. Run download, inspect archived
README and file hashes, then normalize the real full-history cohort. Record actual
source/cohort/quarantine/mapping counts, resource evidence and repeat hashes in
an aggregate checkpoint without committing histories. Only after that does
D2 #237 start its frozen temporal/cold-start baseline comparison. D1 remains open
while publisher access blocks the real run; do not close it because fixtures pass.
No manual APK dispatch, hosted write, account reset or UI correction ran here.
