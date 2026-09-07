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
