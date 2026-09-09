# ADR-0006: Verifiable clean-install database baseline

Status: Proposed
Date: 2026-09-07

## Context

#208 prevents a new database from replaying the repository history: the catalog
migration expects a single-line function fragment while an earlier migration
defines it on two lines. A later forward migration cannot run before that failure.
The hosted service already has these capabilities. Rewriting deployed migrations,
skipping their errors or marking failed statements applied would hide the problem.

## Decision proposed

Prepare a separate, schema-only installation baseline for **empty test databases**.
Do not activate it for deployment, change the canonical migration directory or
replace the current ALG-009 acceptance contract until the following proof passes.
The existing chronological diagnostic must continue reporting its actual failure.

1. Preserve every historical SQL file byte-for-byte. The committed SHA-256 manifest
   records the repository checkpoint, not hosted parity. CI checks the files and
   rejects duplicate versions or new files inserted before the protected cutoff.
   Append future accepted migrations through review; changing stored checksums is
   not a repair. Git review must protect the manifest itself.
2. Collect schema-only definitions using a pinned PostgreSQL/Supabase toolchain.
   Export public/private schema, constraints, indexes, functions, triggers, RLS,
   grants and default privileges. Explicitly account for Auth references and the
   platform RLS event trigger. Never export application rows, auth accounts,
   migration statement payloads containing data, secrets or credentials.
3. Compare that export against canonical repository definitions. Record each
   difference with its source and resolution. An export alone is not authoritative:
   hosted drift must not become accepted architecture merely by being captured.
4. Separate required system seed records (catalog providers, model/genome/policy
   defaults and their references) from schema DDL. Reconstruct these from reviewed
   repository sources using deterministic identities. Never copy production
   Profile/Event/bootstrap/trace rows. Prove a fresh Profile can rank with these
   defaults; an empty schema that merely compiles is insufficient.
5. In a fresh pinned Supabase stack, install the baseline and then apply only
   migrations after its explicit cutoff, unchanged. Repeat from another empty
   database. Compare normalized schema/function/ACL fingerprints and system seeds,
   then run the hosted-smoke equivalent and Personal/Shared authorization and
   ranking regressions with synthetic fixtures.
6. Prove the existing-database forward-upgrade path independently. Never reset the
   hosted database, alter its migration history or apply the baseline to it.
   Any eventual canonical CLI/history transition needs its own reviewed procedure
   and rollback plan; this proposal does not authorize that transition.

Baseline metadata must identify source Git commit, tool/image versions, schema
fingerprints, historical cutoff, seed provenance and validation evidence. A missing
or mismatching fingerprint fails installation/testing before further migrations.

## Consequences

This separates immutable historical evidence from a reproducible installation
route without claiming the broken original chronology has started passing.
It requires a real disposable Supabase environment, schema parity work and an
explicit acceptance-contract update before #208 can close. PGlite fixtures do not
verify Supabase Auth, platform triggers or deployment tracking.

The first delivered part is the historical integrity check in `npm run check`.
No baseline SQL, seed bundle, deployment switch or accepted recovery procedure is
delivered by this ADR. Next perform the schema-only capture and difference review.

## Function parity diagnostic — 2026-09-07

`scripts/database/function-schema-snapshot.sql` is a read-only catalog query for
public/private functions and procedures. It returns qualified identities, SHA-256
of `pg_get_functiondef`, owners and direct ACLs (including implicit defaults).
It fixes the deparser search path to `pg_catalog`, preserves all body whitespace
(including string literals), resolves role names rather than comparing database
OIDs, and exports neither function bodies nor application records.

Run the complete SQL transaction on each database with an authorized administrative
reader and save the single `snapshot` JSON value. Compare with:

```bash
node scripts/database/function-schema-parity.mjs /tmp/expected.json /tmp/actual.json
```

Exit codes: 0 = exact match within this scope, 1 = differences, 2 = invalid/empty
input or incompatible PostgreSQL major versions. Input row/ACL order is irrelevant;
overloads remain separate. A matching name alone never establishes code parity.
Review differences rather than normalizing away function text or ownership changes.

For the four functions defined by `20260907155201_bootstrap_personal_ranking.sql`
plus the complete reconstructed `private.rank_items_v1_internal`, the existing
isolated regression fixture can also produce a scoped reference:

```bash
KAJO_BOOTSTRAP_SCHEMA_SNAPSHOT=/tmp/bootstrap-functions.json node --test scripts/database/bootstrap-ranking.test.mjs
```

The output path must not already exist. Compare only the same five explicit
identities from the hosted snapshot, and report the five-function scope. The
fixture is PGlite 0.3.14 / PostgreSQL 17; it is not a complete installation.

The first read-only hosted check captured 123 function/procedure fingerprints
(40 public, 83 private) on PostgreSQL 17.6. The four bootstrap functions matched
repository fixtures in definition, owner and ACL. Raw hosted snapshots are not
committed or accepted as canonical source. This result does not cover the other
119 functions, tables, constraints, RLS, schema privileges, role inheritance,
default privileges for future objects, Auth/platform event triggers or system
seeds. It does not repair migration tracking, replace the schema-only export, or
close #208 / MVP-ALG-009.

On 2026-09-08 the scope was extended to V1's complete reconstructed definition
after ScenarioMemory, SleepLayer, resurfacing, Shared common-fit and bootstrap
patches. All five definitions/owners/ACLs matched hosted truth. The earlier
four-function checkpoint remains historical; 118 other functions and all
non-function schema/installation gates remain unverified by this comparison.

## Owner-supplied export diagnostic — 2026-09-08

The owner supplied a CLI 2.117.0 public/private schema export with SHA-256
`3f29a88a8937f38fd2014b3c8b8c4e2f9a46a0ee49b71bec680b5cdad7170c3e`.
The original remains an attachment; it is not promoted to canonical repository DDL.

```bash
node scripts/database/schema-export-diagnostic.mjs /path/to/kajo-schema.sql 3f29a88a8937f38fd2014b3c8b8c4e2f9a46a0ee49b71bec680b5cdad7170c3e /tmp/export-functions.json
```

This executes the whole file unchanged in two disposable PGlite databases, using
explicit signature-only Auth fixtures. It rejects checksum mismatch, SQL errors,
nonempty application tables and differences between function snapshots/inventory.
The optional output must not exist. It does not connect to any hosted database.

Observed: 30 empty tables (all RLS-enabled), 205 constraints, 19 policies and 123
functions. Both installations matched; all 123 exported function definitions,
owners and direct ACLs also matched the live hosted snapshot. This is
export-to-hosted parity, not proof of canonical repository equivalence or complete
schema/behavior parity. Inventory counts alone do not compare object definitions.

Required missing pieces confirmed before platform acceptance:

- Auth trigger `provision_kajo_personal_profile` on `auth.users`: present hosted,
  absent from this schema-filtered export; reconstruct from
  `20260827173000_auth_identifier_and_profile_fix.sql` through reviewed supplement.
- Platform event triggers: none exported. Hosted includes `ensure_rls` invoking
  `private.rls_auto_enable` and six `supabase_admin`-owned platform triggers. Reconcile
  against the actual pinned Supabase stack rather than copying blindly.
- System seeds: `private.predictor_genomes` and `private.policy_assignments` are
  empty. Reconstruct reviewed defaults from `20260904170000_sleep_layer_v1_foundation.sql`
  and subsequent applicable migrations; never copy live learning/history rows.

The owner now has a Docker-capable Mac. Next run real empty Supabase installation
tests after source reconciliation and supplements; the PGlite diagnostic does not
close #208 and does not repair chronological migration replay.

## Local rollback-only probe

The owner confirmed the empty local Supabase stack starts. From a checkout of
the active #219 branch, with the export path supplied explicitly:

```bash
node scripts/database/run-local-install-probe.mjs /path/to/kajo-schema.sql
```

The Mac-only runner requires Docker Desktop's `desktop-linux` context to use a
local Unix socket and exactly one running `supabase_db_` container. It prints the
container/image identity, accepts no database URL/password, and runs psql with
`ON_ERROR_STOP`. It builds a temporary SQL probe and removes that file afterward.

`build-local-install-probe.mjs` verifies the exact recorded export SHA-256, opens
one transaction, rejects nonempty Auth or public/private table schemas, loads the
export unchanged, adds the exact canonical Auth trigger, and copies the three
system-seed INSERT statements from SleepLayer's foundation migration. It checks
automatic Auth-to-PersonalProfile provisioning and executes the existing hosted
bootstrap smoke body. The smoke's final ROLLBACK also removes the schema and seeds;
a subsequent assertion verifies the application schema disappeared.

The seed statements retain their original ID/time defaults in this experiment;
this is not the final deterministic seed bundle. No platform event trigger is
recreated or disabled. Two sequential PGlite runs passed, including empty-state
restoration; an existing table/data guard rejected execution and preserved data.
This describes the original probe. The audited revision uses the proposed
deterministic supplement below; owner Mac evidence does not cover that revision.
Owner-reported original probe result on 2026-09-08: PASS, with all changes rolled
back. Runtime: local Docker Desktop macOS arm64, CLI 2.117.0; image
`public.ecr.aws/supabase/postgres:17.6.1.167`, image ID
`sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb`.
The report verifies Auth provisioning, authenticated Personal V1 bootstrap ranking,
import removal, outsider denial and persisted trace version. It is owner-reported
execution of the original probe at #219 head `4ba1fe9`, not agent-run Docker proof.

The expanded probe additionally loads `scripts/database/shared-install-smoke.sql`
inside the same transaction before the Personal smoke. Synthetic accepted members
both rank through public V1; the common-fit explanation must have two members,
aggregate-only privacy, no copied evidence flag and no member/PersonalProfile IDs.
Outsider and removed-member calls must fail with insufficient privilege. Exactly
two versioned Shared traces must exist; denied calls must add none. Membership
fixtures bypass invitation creation deliberately: invitation/consent lifecycle and
statistical ranking quality are not covered. The expanded probe passed twice in
PGlite with rollback, but has not yet run on the owner's Mac.

Complete canonical schema comparison, deterministic seeds, platform event-trigger
reconciliation, repeatable installed baseline and forward-upgrade gates remain open.

## Reconstructed system-seed source — 2026-09-08

`scripts/database/system-seed-source.mjs` reconstructs only the three initial
SleepLayer seed statements from immutable migration
`20260904170000_sleep_layer_v1_foundation.sql`. It verifies the boundaries,
the four semantic genome keys and the baseline genome UUID derivation before it
writes an output file. It prints the complete source and seed SHA-256 values;
an existing output file is never overwritten.

```bash
node scripts/database/system-seed-source.mjs /tmp/kajo-system-seeds.sql
```

At this checkpoint its source hash is
`77a0a81ed37552003c62fd13cbdd557d8795feb87cda796c3965cb27da014ade`, and the
reconstructed SQL hash is
`8fc0a15d9769715152985f46cde3e73edb7f441ef25eccb857aaae288f91689d`.
The source defines four semantic-ID PredictorGenomes, four audit decisions and
one initial GLOBAL baseline PolicyAssignment. The experimental source keeps
random UUID defaults for promotion decisions and policy assignments, plus
installation-time `created_at` and `effective_from` fields. Only genome identities
and source bytes are deterministic. These defaults still need an explicit reviewed
resolution before claiming the deterministic baseline metadata gate is complete.

The generated SQL remains a supplement to the schema export. It contains no
User, Profile, Event, import, prediction-run or hosted-learning row.

## Audit corrections and trigger definition parity — 2026-09-08

- The previous API upload at `87fd3f8` corrupted STATUS and omitted the latest
  sprint checkpoint. Restored both from the verified local commit `61d1974`.
- Original claims that the export contained zero ordinary triggers were caused
  by a case-sensitive text search that also missed `CREATE OR REPLACE TRIGGER`.
  The export contains 21 application-table triggers; only the Auth trigger is
  omitted. The export still omits platform event triggers.
- `schema-export-diagnostic.mjs` now compares all 21 trigger definitions and
  enabled states against the protected migration sources using PostgreSQL's own
  deparser in a rolled-back disposable transaction. This covers table identity,
  timing, events, column lists, conditions, called functions and enabled state.
  The previous name-only check did not establish definition parity.
- CI no longer depends on an uncommitted conversation attachment. The exact export
  remains an explicit argument of the offline diagnostic. Seed generation now
  actually rejects a mismatching source checksum before emitting executable SQL.
- These corrections do not change deployed migrations or the serving algorithm.
  Roadmap remains 14.0 → 14.1 (evidence) → 14.2 (serving/shadow and candidates).

## Deterministic empty-install seed proposal — audited continuation

`buildDeterministicSeedSql()` in `system-seed-source.mjs` now builds the probe's
empty-install supplement from the hash-verified seed statements. Genome IDs,
weights, parent relationships, versions, audit reasons and Champion/SHADOW states
are unchanged. New promotion IDs derive from `kajo:baseline-v1:promotion:<key>`;
the initial assignment ID derives from `kajo:baseline-v1:global-policy`. All initial
timestamps use the explicit schema cutoff `2026-09-07T15:52:01Z`. This is a logical
baseline epoch, not the date of an actual production promotion or installation.
An eventual installer must record its actual execution time separately.

The supplement refuses nonempty genome, promotion or assignment tables. Two
independent PGlite tests prove exact equality of every stored seed field, semantic
equality to the original source (excluding the intentionally replaced audit IDs
and times), preserved genome IDs/configuration and unchanged rows after a rejected
reinstall. Full export + deterministic seeds + Auth/Personal/Shared rollback smoke
also passed twice. The revised Mac probe and real repeated pinned installations,
complete remaining schema parity and independent forward upgrade remain pending.

## Table-definition repeatability diagnostic

`relation-schema-snapshot.sql` captures read-only SHA-256 fingerprints for each
ordinary/partitioned `public`/`private` table. Covered fields include column order,
types, defaults, nullability, identity/generated flags and collation; constraint
definitions/validation/deferral; index definitions and validity/readiness;
partition keys/bounds/parents; RLS policy expressions, roles, permissiveness and
table flags; owner and normalized direct table/column ACL. Object/role OIDs are
resolved to names before hashing. No application rows or expression bodies are
returned in the snapshot.

The export diagnostic now compares these fingerprints across both installations.
An optional fifth CLI argument (after the function snapshot path) writes the
relation JSON with no overwrite. Compare two snapshots using:

```sh
node scripts/database/relation-schema-parity.mjs expected-relations.json actual-relations.json
```

Exit codes: 0 match, 1 drift, 2 malformed/empty snapshots or different PostgreSQL
major versions. Regressions use independent PGlite fixtures without the owner's
attachment and check altered definitions with unchanged object counts, ACL
insertion-order independence and OID independence. The exact owner export passed
twice with all 30 table fingerprints matching.

This proves repeatability of the exported definitions, **not** reconciliation to
all canonical migrations or production. It excludes views, sequences, schema and
default ACL, inherited/effective role privileges, type/domain definitions,
extensions, triggers (separate diagnostic), platform objects and physical storage
settings such as tablespaces/index options. Same-major deparser fingerprints also
need matching engine versions for acceptance. Remaining #208 gates stay open.

## Canonical function source reconciliation — 2026-09-09

`function-source.mjs` reconstructs the latest 122 literal application function
definitions through cutoff `20260907155201_bootstrap_personal_ranking.sql`,
plus the three still-applicable source DO patches for catalog upsert, import stage
limit and bootstrap resurfacing. The complete 47-file source checksum must match
`755d0b0b4787bec834ed184b85b2fe56cbd095c26090c8aec37342a71f3df6af` before extraction.
This is a restricted checkpoint-specific definition fixture, not a general SQL
parser or a migration runner. V0/V1 and Shared already have complete final literal
definitions, so their superseded intermediate text patches are not replayed here.

The comparison replaces function definitions in the diagnostic's disposable
PGlite transaction, executes the three source patches unchanged, reads PostgreSQL
fingerprints and rolls back. Function-body validation is off because the existing
export supplies type/signature scaffolding; this does not test function behavior.
CREATE OR REPLACE retains input ownership/ACL, so **this proves definitions only**,
not source-derived ownership/privileges. Missing/unexpected functions and overloads
fail closed. Platform `private.rls_auto_enable()` is explicitly excluded and must
be reconciled separately. No hosted DB is accessed and no SQL baseline is emitted.

Observed against the exact owner export, repeated in both disposable installations:

- 96 application definitions match exactly; 26 differ. No application function
  is missing or unexpected. Report entries include identity, source migration,
  applicable patches and both SHA-256 fingerprints; function bodies are not output.
- The catalog upsert conflict-target patch applies unchanged.
- `20260904210000_expand_profile_import_stage_limit.sql` fails with
  `Expected profile import stage limit guard was not found`: it expects
  `jsonb_array_length(input_rows)<1 or jsonb_array_length(input_rows)>500`, while
  its original source uses spaces around `<` and `>`.
- `20260905003500_fix_resurfacing_null_bootstrap.sql` fails with
  `Expected bootstrap boolean fragment was not found`: its compact four-assignment
  string does not match the original multiline/space-separated assignments.
- Each failed patch is rolled back to its savepoint and explicitly remains
  `BLOCKED` while other differences are collected. This continuation is diagnostic
  reporting only, never successful migration replay or a skipped-error install.

Checkpoint difference ledger (before the source-derived resolution below; all remain bytewise mismatches):

| Source migration | Functions | Review/resolution |
| --- | --- | --- |
| `20260904203000_profile_bootstrap_import_foundation.sql` | Public wrappers: `create_profile_import_job_v1`, `stage_profile_import_rows_v1`, `resolve_profile_import_row_v1`, `commit_profile_import_job_v1`, `remove_profile_import_job_v1`, `get_profile_import_job_v1` | Inspected full diffs: formatting only. Preserve exact fingerprints; a future baseline should take reviewed repository definitions rather than normalize the export. |
| Same import foundation | Private: `assert_personal_profile_owner_v1`, `bootstrap_evidence_weight_v1`, `create_profile_import_job_v1`, `stage_profile_import_rows_v1`, `resolve_profile_import_row_v1`, `commit_profile_import_job_v1`, `remove_profile_import_job_v1`, `get_profile_import_job_v1`, `resurfacing_policy_decision_v1` | Nine definitions need semantic reconciliation. Includes alias/format changes and the two blocked patches; neither patch may be silently omitted from the proposed baseline. |
| `20260904170000_sleep_layer_v1_foundation.sql` | Private: `attach_prediction_policy_v1`, `evaluate_shadow_genome_v1`, `genome_config_is_valid_v1`, `genome_weight_v1`, `jsonb_numeric_component_v1`, `process_shadow_prediction_jobs_v1`, `reject_immutable_prediction_artifact_change_v1`, `resolve_policy_assignment_v1`, `shadow_candidate_score_v1` | Nine definitions need semantic reconciliation; compressed bodies alone do not prove equivalence. |
| `20260905114500_harden_shared_common_fit_v1_1.sql` | Private: `shared_common_fit_candidate_v1_1`, `shared_common_fit_v1` | Inspected full diffs: formatting/comments only, including unchanged prior/member/consensus/disagreement arithmetic. No Shared scoring fix inferred from these differences. |

The same export command now returns `REQUIRES_RECONCILIATION`, exit 1, and separate
`exportRepeatability: PASS`. It no longer permits a top-level PASS to be mistaken
for source acceptance. CI uses repository-only fixtures to reproduce both blocked
patches, check input rollback, source checksum protection and missing/extra/changed
definition handling. The previous export/Mac PASS checkpoints remain historical
evidence of their stated scope. Original chronological replay still stops at the
earlier catalog migration after 33 successful files; no history was changed.

This checkpoint left 18 function reviews and both broken patch resolutions open.
The next section records their resolution. Source table/RLS/ACL/platform
reconciliation, repeated real installations and independent forward-upgrade proof
remain separate gates. No baseline/history transition or #208 closure was approved.

## Source-derived function supplement — 2026-09-09

The complete 26-definition review is now resolved for the **proposed empty-install
route**. Full-definition inspection, with lexical diffs used only as a review aid,
classified the differences as follows; exact fingerprint comparison still preserves
all text and does not normalize the export to claim a match.

| Difference | Count | Resolution |
| --- | --- | --- |
| Formatting/comments, including all nine SleepLayer functions | 19 | Use complete repository definitions; constants, conditions, expressions and statements are unchanged. |
| Alias declarations/references and optional `AS` in private import ownership/read/resolve/commit/remove functions | 5 | Use repository names. Reviewed alias scopes preserve the same joins, ownership predicates, projections and writes. |
| Import staging and resurfacing, including the intended forward changes | 2 | Use repository bodies plus the explicit corrections below; retain canonical alias names. |

`baseline-functions.mjs` builds all 122 final application definitions from the
existing checksum-verified source loader. It implements exactly these two intended
corrections in the separate supplement:

- Stage guard/message: accept 1–5000 rows; reject 0 and 5001 before deleting staged
  rows. The original 500-row fragment must occur exactly once before replacement.
- Resurfacing: wrap the three nullable bootstrap predicates for consumed/rated/
  saved in `coalesce(..., false)`. Absent bootstrap evidence cannot turn a native
  false into SQL NULL. Native terminal/saved evidence still applies.

The catalog upsert conflict patch is appended unchanged and applies successfully.
Historical migrations and the raw-source diagnostic remain unchanged. The proposal
neither skips historical migration failures nor applies the baseline to production.
Other functions use their complete final repository definitions. Body validation
is explicitly enabled against the export's table/type scaffolding.

The generated function bundle has SHA-256
`d2748da4cc432d689af11c86cad0bc494da50460168910e0af4ffb75f11862be`, records the source
checkpoint/cutoff, and is embedded in the existing rollback-only local probe after
its empty-database guard and schema load. It is not emitted as a deployment file.
CREATE OR REPLACE deliberately retains export ownership/ACL: this still does not
prove source-derived permissions. Platform `rls_auto_enable` is not replaced.

Verification:

- Two independent empty PGlite installations produce identical post-supplement
  function fingerprints. Exactly 26 definitions change from the supplied export;
  every function identity, owner and direct ACL remains unchanged.
- The complete source-function + deterministic seed + Auth/Personal/Shared probe
  passes twice with rollback, including existing opposite-bootstrap ranking,
  import removal, membership/privacy and versioned-trace checks.
- `baseline-function-smoke.sql`, shared by that probe and repository-only CI
  fixtures, stages 5000 rows through public RPCs, rejects 5001/empty batches without
  changing staged data, skips/corrects a row, commits twice without duplicate taste
  evidence or native Events, and verifies import removal restores ordinary
  eligibility. Outsider writes/removal and unauthenticated reads fail.
- The same behavior smoke fails with each original unresolved function body.
  This proves both resolutions affect the intended behavior. Fixture Auth/table
  signatures are explicitly limited; they do not establish full Supabase acceptance.

The revised Mac probe is pending. Next reconcile source ownership/ACL and remaining
non-function schema/platform definitions, then complete real repeated installation
and independent forward-upgrade acceptance. Do not repeat the 26-function review
or describe the raw-source diagnostic's expected failure as an unfixed supplement.

## Source table definitions and privilege reference — 2026-09-09

`relation-source.mjs` builds a disposable, source-only PostgreSQL reference using
the same protected 47-file checkpoint/cutoff as the function reconstruction. Its
188 literal CREATE/ALTER/DROP table/index/policy statements are applied unchanged.
Their concatenated SQL SHA-256 is
`07014005ed10f101d61e37446a204285c19e6907818437af32e3ec4ceafba6c5`, checked before
execution. Final function signatures supply CHECK/policy dependencies. This is a
restricted definition reconstruction, not historical replay, a complete schema
installer or proof of the function bodies' behavior.

The relation snapshot now adds `structureSha256`, excluding only owner and direct
table/column ACL from the existing definition representation. It retains column
order, constraints, indexes, RLS roles/conditions and other recorded table fields.
The default comparator/CLI still uses the original full `definitionSha256`;
structural comparison requires an explicit option and rejects missing hashes.
Existing v1 snapshots remain valid for the full comparison.

Both unchanged export installations match **all 30 source table structures**:
205 constraints, 112 indexes and 19 policies, with no missing/unexpected tables.
This completes source reconciliation for those structural fields, not for the
excluded schema/platform/privilege objects. CI uses no attachment: real synthetic
membership reads isolate Profiles, bad unique/FK/check writes fail, and the
fingerprint catches an altered policy that actually exposes the other Profile.

The reference additionally applies 296 literal source privilege statements,
including four per-schema default REVOKEs. One source REVOKE for the absent
platform `private.rls_auto_enable()` is explicitly reported as excluded. Objects
are created by `postgres` with plain PostgreSQL defaults; no initial Supabase
grants are copied from the export. Final default statements are applied after
object creation, so this is a source privilege reference, not reconstruction of
historical platform defaults or proof of future default behavior.

Observed differences against the owner export, identical in both runs:

| Scope | Result |
| --- | --- |
| Owners of 30 tables and 122 application functions | All are `postgres`, matching the explicit reference creator assumption. |
| Table definitions + direct ACL | 18 match; 12 have additional exported `service_role` privileges. |
| Function owners + direct ACL, bodies compared separately | 104 match; 18 public functions have additional exported `service_role` EXECUTE. |
| Direct `anon`, `authenticated` and PUBLIC grants on compared objects | No difference. Effective privileges, schema usage and role inheritance are outside this comparison. |

The 12 tables are `public.event_sessions`, `events`, `item_interactions`,
`item_list_entries`, `item_lists`, `items`, `profile_invitations`, `profile_members`,
`profiles`, `shared_item_consensus`, `shared_item_endorsements` and `users`. Export
grants `service_role` all table privileges. Source explicitly grants that role
SELECT/INSERT/UPDATE on `items`; the other 11 have no source-only service grant.
The 18 public functions are `add_shared_profile_member`, `complete_personal_profile`,
`create_custom_item_list`, `create_shared_profile`, `delete_custom_item_list`,
`endorse_shared_item`, `get_item_list_entries`, `get_my_shared_profile_invitations`,
`get_my_shared_profiles`, `get_profile_consumed_items`, `get_profile_item_lists`,
`invite_shared_profile_member`, `leave_shared_profile`, `rename_custom_item_list`,
`respond_shared_profile_invitation`, `reverse_shared_item_endorsement`,
`set_item_list_destinations` and `set_item_list_entry`. The diagnostic prints full
identities. These extra grants are consistent with inherited installation defaults,
but that explanation is an **inference**, not verified pinned-platform provenance.
Neither retaining nor removing them is accepted by this comparison.

### Future-function default gap

The closed-default comment in
`20260902064431_harden_production_function_boundaries.sql` overstates what its
per-schema function REVOKEs establish. In a plain PostgreSQL database, newly
created public/private functions still grant PUBLIC EXECUTE after those source
statements. PostgreSQL documents that per-schema defaults add to global defaults;
they cannot revoke a globally granted privilege. See the
[PostgreSQL 17 default-privilege documentation](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

The new regression reproduces this with harmless functions. In the disposable
fixture only, a global default REVOKE followed by an explicit authenticated grant
closes anon/service execution as intended. That demonstration is **not** a shipped
default-privilege correction: a global change affects future functions created by
`postgres` beyond application schemas and must be reconciled with platform needs.
Current application functions have separate explicit ACLs; this result does not
establish a current hosted RPC exposure. The export also cannot establish all
global defaults outside its schema filter.

Next resolve initial/global/schema-default privileges and the platform RLS event
trigger from the pinned stack, choose the explicit proposed baseline/forward
privilege contract, then prove repeated real installations and the independent
forward upgrade. Historical migrations remain immutable, the existing probe's
export ACLs are unchanged, and #208 remains open. The raw export diagnostic still
returns `REQUIRES_RECONCILIATION`, with separate `exportRepeatability: PASS` and
`relationSourceParity: MATCH`; this is the expected result, not a failed test suite.

## Explicit compatibility grants and forward defaults — 2026-09-09

This checkpoint supersedes the unresolved retention/default decision above. The
proposed empty-install contract explicitly preserves the accepted export's extra
`service_role` rights on the 12 named tables and 18 exact function signatures in
`scripts/database/baseline-compatibility-grants.sql`. Its SHA-256 is
`dea675709e4bee50443522b1ed6b5ed5d2a2dedc80bb6021be679cf6c161e4f2`.
No other caller, grant option or future-object default is added. This is a reviewed
compatibility choice, not a claim those grants came from application migrations.
Supabase's [initial schema source](https://github.com/supabase/postgres/blob/3a68ef75aabc583b11030e5eea29216d0d44c5b9/migrations/db/init-scripts/00000000000000-initial-schema.sql)
contains broad initial public-schema defaults, but does not prove the exact history
of this hosted project or pinned image. Preserve current service capabilities
explicitly rather than making that inference an installation requirement.

After the contract, both exact export installations match **all 30 table
definitions/owners/direct ACLs and all 122 application-function owners/direct
ACLs**, with no missing, unexpected or changed objects in those comparisons.
`schema-export-diagnostic.mjs` records this as `reviewedPrivilegeParity`; raw source
differences remain separately visible. Its overall `REQUIRES_RECONCILIATION`/exit 1
still reflects historical function text differences, with export repeatability
PASS. It does not reject the separately resolved function supplement.

New forward migration
`20260909131913_close_postgres_function_defaults.sql`, generated with Supabase CLI
2.117.0, revokes the global future-function defaults of creator `postgres` from
PUBLIC/anon/authenticated/service_role, then clears additions in public/private.
The global control applies **across schemas**, including future platform/extension
functions created by postgres. Their intended callers need explicit grants;
existing outside-schema default additions and other creators' defaults remain
unchanged. The migration changes no existing function body, owner or ACL. It is
included in the rollback probe and prepared for a separately verified forward
upgrade, **not applied hosted**. It cannot repair the earlier chronological replay
failure; the protected 47 historical files remain unchanged.

Tests reproduce the original PUBLIC-execution defect and verify the correction,
actual denied anon execution followed by an explicit successful authenticated
grant, idempotence, rollback of all default-ACL rows, unchanged existing function
fingerprints, retained table defaults, other creators and outside-schema explicit
grants. Compatibility tests verify exactly the 12/18 object differences, unchanged
non-service grants and no grants on unlisted/future objects. The complete revised
Auth/Personal/Shared/import/default probe passed twice in PGlite; both rollbacks
restored the empty application state and original default privileges.

Read-only hosted catalogs confirm PostgreSQL 17.6, no global default row for
postgres and owner-only public-schema function defaults. This leaves the global
implicit PUBLIC default for future functions; current RPCs have explicit ACLs.
Audit correction: six platform event triggers are **owned by supabase_admin**, not
extension-owned. All seven, including postgres-owned `ensure_rls`, have no
`pg_depend` extension membership. Their functions' `extensions` schema does not
establish extension ownership. `ensure_rls` calls `private.rls_auto_enable` for new
public tables; that function catches/logs ALTER failures, so its existence alone
does not prove every table has RLS. No hosted object or role was modified.

### Exact continuation after the pause

From the owner's existing Mac export directory, with local Supabase running:

```sh
git -C kajo-testityokalut pull --ff-only
node kajo-testityokalut/scripts/database/run-local-install-probe.mjs ./kajo-schema.sql
```

The runner writes `kajo-install-report-*.json` only after success and equality of
the before/after platform snapshots. Collect that file and the PASS output. The
report records the actual image, generated probe hash, schema owner/direct ACLs,
creator defaults, event-trigger definitions as hashes and true extension membership,
selected role flags and memberships. It contains no application rows, function
bodies, passwords, connection strings or API keys. The snapshot uses read-only
transactions and PostgreSQL 17 catalogs; tests normalize OIDs, detect changed
defaults/event triggers and verify rollback without leaking fixture data.

Revised Mac/Docker execution remains pending. Compare its platform metadata with
hosted truth before choosing platform supplements; the report is not a complete
type/schema/effective-privilege audit. Two real pinned installations with full
schema/seed/runtime comparison and an independent existing-database forward
upgrade remain required. No canonical baseline, history transition or #208 closure
is accepted. `npm run check` passed 191 mobile, 14 catalog and 45 database tests,
TypeScript, lint with one existing Hook warning, and iOS/Android bundles.

## Automated pinned-platform verification — 2026-09-09

The owner resumed work after the pause request. CI can provide the Docker runtime
missing from the coding workspace, as documented in Supabase's
[GitHub Actions setup](https://supabase.com/docs/guides/deployment/managing-environments#configure-github-actions).
The new `database-platform` job creates a separate temporary, unlinked project
using CLI 2.117.0 and requires Postgres image tag 17.6.1.167. It records the actual
image ID, architecture, generated config hash and workflow commit; it does not
infer that Linux and the owner's arm64 image IDs are identical.

`platform-default-probe.mjs` runs the unchanged forward default migration twice
in one transaction. Real denied/explicitly granted function calls, idempotence,
unchanged existing non-system function definitions/owners/direct ACLs and
unaffected role/event-trigger/schema/default metadata must all pass. A temporary
private schema is allowed only when absent, and rollback must restore the complete
initial platform snapshot. Existing application tables/Auth accounts reject the
probe. The executor is restricted to GitHub Linux, a local Unix Docker socket and
a newly created stack; it accepts no database URL, reuses no existing stack and
never copies or repairs historical application migrations. Cleanup stops the
new project without backup before the PASS report is written.

The report is uploaded as `kajo-platform-<workflow commit>` with
`kajo-platform-report.json` inside. It contains only metadata/fingerprints; CLI
output containing development keys/connection strings is kept out of logs.
This job also gates the existing main APK job. Tests exercise the same SQL with
PGlite, including repeated rollback and refusal to change an existing test row.
`npm run check` passed 191 mobile, 14 catalog and 47 database tests, TypeScript,
lint with one existing Hook warning, and both platform bundles. The real CI result
and catalog comparison follow; this is scoped evidence, not a full baseline gate.

This supersedes the manual Mac prerequisite for **platform discovery and the
scoped default correction only**. The expanded application-function/import/Shared
Mac probe, two complete pinned application installations and the independent
existing-application upgrade remain separate gates. No hosted deployment or
canonical baseline/history transition is authorized by this test job.

### Real CI result and platform difference ledger

[CI #385](https://github.com/Kajooja/Kajo/actions/runs/34361244321) passed both jobs
for PR head `533cc54522bedbc0c70db5ee18f362050d30e8d4` (workflow merge commit
`c70efd1bedf695a8f51c763ab5bac6a88ee23569`). The new job completed in about 80
seconds. It retained all **99 non-system platform function** definitions, owners
and direct ACLs, passed denied/explicitly granted execution and repeated migration,
restored metadata through rollback and removed its own stack. No APK was built.

- CLI: 2.117.0; PostgreSQL: 17.6; architecture: Linux x64.
- Image: `public.ecr.aws/supabase/postgres:17.6.1.167`.
- Actual image ID: `sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f`.
- Artifact ID: `10107958813`; name: `kajo-platform-c70efd1bedf695a8f51c763ab5bac6a88ee23569`.
- Report SHA-256: `aee5aa37a3c5d6dd4a925423204ec4f6aea4373ca4c76eb55b7d71ae4de197a6`.
- ZIP SHA-256: `5ab0cb609b151e96425edc1cd846bfa9fbf23cfe9d63bd5a96dd9de5617a49be`.

The report was retrieved and compared with a read-only hosted snapshot produced by
the same SQL on 2026-09-09. Artifact retention is seven days; this ledger preserves
the result and exact provenance after expiry.

| Scope | Observed difference and proposed application-install boundary |
| --- | --- |
| auth/extensions/public/storage schema owners and direct ACLs | Exact match. Fresh CI has no private schema; canonical source supplies its postgres ownership and authenticated/service usage. |
| Selected role flags | Exact match, including postgres non-superuser status and service-role RLS bypass. |
| Memberships | CI additionally gives postgres membership in native `supabase_functions_admin`. Do not remove provider roles or depend on that extra membership for application ACLs. |
| postgres public table/sequence/function defaults | CI initially grants anon/authenticated/service_role broad rights; hosted has owner-only schema additions. Apply canonical source default REVOKEs before creating candidate application objects, then source direct grants and explicit compatibility grants. New global function hardening remains the normal post-cutoff migration. |
| Other creator defaults | Matching except three additional native `supabase_admin` default rows for CI's `supabase_functions` schema. Keep native provider defaults; the forward probe proves they are unaffected. |
| Six native event triggers | Names, events, tags, enabled states, function identities and owners match; all six function-definition hashes differ. They have no extension membership. No semantic equality is inferred and no hosted body is copied over native callbacks. |
| Hosted `ensure_rls` / private.rls_auto_enable | Absent in the fresh pinned stack. It is not an implicit local-platform prerequisite. The candidate application installation must explicitly enable RLS from source and verify all tables; relying on or silently fabricating this best-effort callback is insufficient. Its existing hosted definition remains untouched. |

Additional read-only hosted inventory found no public/private views, sequences,
foreign tables, standalone composite relations or standalone base/domain/enum/range
types. Table row types are covered by table definitions. Installed extensions are
pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1 and uuid-ossp
1.1. This inventory does not replace source/actual-install fingerprint checks.

Next prepare the application candidate from the already reviewed source DDL,
functions, direct grants, triggers and seeds, leaving native callbacks intact.
Prove repeat installation and runtime behavior on the pinned CI stack. The
independent existing-application upgrade still needs separate evidence; passing
this scoped platform/default test does not establish that broader gate.

## Source-only application installation candidate — 2026-09-09

`baseline-installation.mjs` now assembles the candidate entirely from the protected
source DDL, reviewed function supplement, source direct privileges, explicit
compatibility grants, all 22 source application/Auth triggers and deterministic
system seeds. There is no dump input. The four source default-privilege REVOKEs
run before object creation to prevent native auto-grants surviving the final
direct-grant contract. Function signatures are temporarily created with body
validation off for CHECK/policy dependencies, then all reviewed bodies are
recreated with validation on before commit. The existing catalog final patch runs
unchanged. No source migration byte, native callback or migration-history row is
rewritten, skipped or marked applied by this candidate.

The candidate requires creator postgres and empty application relation/function/
standalone-type namespaces plus empty Auth users. The caller owns its transaction.
`sourceApplicationReference` independently constructs the plain-PostgreSQL source
reference and supplements without the candidate's installation ordering. Exact
table/function owner/direct-ACL fingerprints, all trigger definitions/enabled
states, full deterministic seed rows and application/Auth row counts are compared.
Native schema defaults are explicitly broad in the regression fixture, proving
they do not leak into the installed ACLs. Two independent committed PGlite
installations match, pass source parity and Auth/Personal/Shared/import smokes,
restore every synthetic row through rollback and reject reinstall without change.

The `database-installation` CI job owns two distinct unlinked Supabase projects.
Each commits the candidate, applies the unchanged post-cutoff default migration,
checks unchanged application definitions/ACL/seeds, runs the same runtime smoke,
rejects reinstall and verifies native functions/roles/callbacks remain intact.
Both results must match and both stacks must be removed. The shared lifecycle now
checks the actual Linux image ID recorded in CI #385, so a moved image tag fails
before application SQL. This is repeated candidate installation and a forward
step on that new candidate, **not the independent existing-application upgrade**.

`npm run check` passed 191 mobile, 14 catalog and 49 database tests, lint/typecheck
and both bundles. CI #387 at `b829b32702794e84e96924d349281b910b7d2577` passed
validation and the platform job. The first application installation passed its
source/schema/seed/default/runtime comparisons and then hit a transport failure
at the negative reinstall test: psql's early ON_ERROR_STOP exit closed Docker
stdin while Node was still sending the large SQL body, surfacing EPIPE instead of
the expected SQL error. Consequently the full two-installation gate did not pass.

The correction buffers SQL into a private container temporary file before starting
psql and removes the file on exit. The shell executes only a fixed program and
quoted command arguments, never the SQL input. Both CI and Mac runners use it.
A multi-megabyte Unicode/literal regression verifies complete delivery, mode 0600,
exact successful/failed exit status, preserved error output and file cleanup. The
database guard and expected error are unchanged. The full check passed with 191
mobile, 14 catalog and 50 database tests, TypeScript/lint and both bundles. Real CI
rerun evidence remains to be recorded before accepting the repeated native runs.

## Alternatives considered

- Rewrite the failed historical migration: violates immutable deployed history.
- Insert a backdated compatibility migration: changes chronology and deployment
  tracking and leaves existing installations ambiguous; rejected.
- Patch SQL in the replay runner or skip the failed file: hides the actual
  acceptance failure; rejected.
- Add a normal later migration: useful for hosted fixes, but cannot repair this
  earlier clean-install failure.
- Keep only scorer function fixtures: valuable unit tests, but insufficient for
  complete schema, authorization, seed and upgrade acceptance.
