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
  `private.rls_auto_enable` and six extension-owned platform triggers. Reconcile
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
one initial GLOBAL baseline PolicyAssignment. Its `effective_from` remains
installation time (`clock_timestamp()`), intentionally: the first policy must
be effective at the actual baseline installation and is later comparable by
genome key/version rather than wall-clock time. This is deterministic source
provenance and model identity, not byte-identical timestamp metadata.

The generated SQL remains a supplement to the schema export. It contains no
User, Profile, Event, import, prediction-run or hosted-learning row.

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
