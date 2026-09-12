# Isolated MovieLens research — D1

E1 contracts are accepted through PR #241. D1 source supplies bounded intake and
a real engine adapter. **The actual MovieLens 32M download/cohort is not accepted**:
the 2026-09-12 publisher README/checksum/archive requests returned HTTP 502 from
this environment. The tracked manifest intentionally has no invented hashes or
research-rights approval. [STATUS](../docs/project/STATUS.md) owns current progress.

The source is the [GroupLens MovieLens 32M release](https://grouplens.org/datasets/movielens/32m/).
Its [README](https://files.grouplens.org/datasets/movielens/ml-32m-README.html)
and [checksum](https://files.grouplens.org/datasets/movielens/ml-32m.zip.md5)
must be available and reviewed for the declared noncommercial research purpose.
The complete project rights/admission rules belong to
[DATA_ENRICHMENT](../docs/architecture/DATA_ENRICHMENT.md).

## Commands and source gate

Use Node 22+ and Python 3.12 (standard library only). From the repository root:

```sh
npm ci
npm run research:movielens:prepare
```

`prepare` retrieves only the small publisher README and checksum into ignored
`research-data/movielens-32m/`. Read the actual snapshot, verify the exact release
and intended-use terms, then record its SHA-256 and publisher MD5 in
`research/manifests/movielens-32m.json`. Set `sourceVerification.status` to
`verified` and the research decision to `approved-for-noncommercial-research`
only with the named reviewer/date and source evidence. Changing flags alone is
not a rights review. No commercial/serving/redistribution permission follows.

After source review:

```sh
npm run research:movielens:download
npm run research:movielens:normalize
```

`download` requires the pinned, unchanged reviewed snapshot before fetching an
archive. It uses a bounded temporary file, verifies the publisher MD5, records
SHA-256 and atomically makes the verified archive available. Existing archives
are rechecked, not silently replaced. A failed download leaves no accepted ZIP;
retry restarts that bounded stage. HTTPS publisher URLs are fixed by source.

`normalize` checks the archive again, validates its allowlisted members and CRCs,
streams them directly without extracting supplied paths, and creates a complete
normalized stage under ignored `research-artifacts/movielens-32m/<run-id>/`.
The built TypeScript adapter then atomically writes an `engine-<conversion-id>`
stage. Repeat commands reuse only completed outputs whose recorded hashes and
lineage still match. Interrupted stages are restarted; unknown/corrupt completed
outputs fail for inspection rather than being overwritten. The script removes
only temporary paths it created itself.

The run identity binds archive bytes, manifest/normalization policy and source
code. The adapter stage also binds its built implementation and input hash.
Source snapshot retrieval time stays distinct from simulated observation time.

## Data and deterministic selection

| File | Meaning |
| --- | --- |
| `ratings.jsonl` | Valid cohort ratings on the original 0.5–5 scale, ordered by rating timestamp, numeric source user ID and movie ID |
| `subjects.jsonl` | Release-scoped external subject IDs and complete valid history counts; no native account mapping |
| `objects.jsonl` | Source movie metadata and explicit IMDb/TMDb aliases; unknown metadata availability; static-release use only |
| `quarantine.jsonl` | Counted malformed/conflicting records and mapping entries, with source file/line references |
| `manifest.json` | Archive/file/output hashes, source counts, cohort/selection policy, scope, code/runtime identity and aggregate quarantine/mapping coverage |
| `engine-*/observations.jsonl` | Source-typed E1 Observations with external provenance and original raw scale; unknown exposure and null native actor/action/prediction |
| `engine-*/manifest.json` | Exact converted input/output hashes, counts and a bounded available-prefix contract probe |

The default cohort takes the 1,000 lowest SHA-256 ranks of
`movielens:ml-32m:<seed>:<source-user-id>`, among subjects with at least 20 valid
unique ratings. It retains their complete valid histories. It never takes the
first N user-sorted rows. User grouping is validated while scanning; within-user
movie order is irrelevant, and output is chronologically sorted. Equal-time
targets must use a cutoff strictly before their entire timestamp group in D2.

Exact duplicate user/movie ratings count once. Conflicting rows for a pair are
all quarantined; this release does not establish which is a legitimate historical
correction, so the importer does not silently choose the latest or invent revision
history. Conflicting movie/link IDs are also quarantined. Alias collisions remove
the conflicting mappings from every affected movie without merging research
objects. Missing aliases remain missing and are reported. No title-based match or
live Kajo catalog query is performed. Tags are hashed/validated/counted but are
not model inputs or converted rating Observations in D1.

The manifest bounds compressed/expanded bytes, download duration, row/subject/
object counts, field/line sizes, per-subject history, retained cohort ratings and
quarantine entries. Defaults cap the archive at 300 MiB, expanded data at 2 GiB
and the retained cohort at 500,000 ratings. Exceeding a bound fails; it does not
truncate a selected history. No fitted model or raw data enters ordinary CI.

## Time and observation limits

Timestamps record rating activity in epoch seconds. The adapter preserves them
as milliseconds and explicitly declares availability-at-occurrence as an **offline
simulation assumption**. It does not invent viewing time, a shown recommendation,
an action propensity, mood or native Kajo consumption. Metadata is an undated
release snapshot and cannot silently supply historical features. A research
rating target uses object-observation conditioning, not a causal action claim.

Raw archives, histories, cohort records, checkpoints and future fitted artifacts
stay out of Git and ordinary CI uploads. Publish only authored code, schemas,
non-identifying manifests, aggregate reports and attribution under project policy.
Source/derivative rights and serving admission remain separate gates.

## Verification and next step

`npm run check` includes the existing app/database checks, engine adapter tests,
15 standard-library intake tests and two actual Python → built TypeScript
pipeline tests using explicitly artificial archives. Existing CI sets up Python
3.12 and performs no real dataset download. These tests passed locally (338 total),
along with lint/typecheck and both Hermes exports. They prove source behavior;
they are not evidence of a real MovieLens cohort or predictive usefulness.

Resume D1 by obtaining and reviewing the exact publisher metadata, running the
three commands above, inspecting archived README/terms and recording real
archive/file/cohort hashes, counts, quarantine and resource evidence. Verify one
independent rerun produces the same normalized/adapter hashes. Only then does D2
begin its frozen temporal/cold-start baseline and ordered-prefix experiment.
Do not substitute another release or an unverified third-party mirror for 32M.
