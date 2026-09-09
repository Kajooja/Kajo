// Checkpoint-specific structural reference, NOT historical migration replay.
// No connection parameter: this module creates only a disposable local PGlite DB.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { reconstructFunctionSource } from './function-source.mjs';
import { resolveBaselineDefinition } from './baseline-functions.mjs';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const cutoff = '20260907155201_bootstrap_personal_ranking.sql';

export async function loadRelationSource() {
  const names = (await readdir(migrations)).filter(name => /^\d{14}_.+\.sql$/.test(name) && name <= cutoff).sort();
  const files = await Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, migrations), 'utf8') })));
  const functions = reconstructFunctionSource(files); // Validates all 47 file hashes before extraction.
  const statements = files.flatMap(({ name, sql }) => {
    // Restricted to reviewed literal DDL syntax in the fixed checkpoint. No DML,
    // function body, DO patch, trigger or platform operation is a replayed migration.
    const matches = [...sql.matchAll(/^(?:create(?: unique)? (?:table|index|policy)|alter table|drop (?:index|policy))\b[\s\S]*?;$/gim)];
    return matches.map(match => ({ migration: name, sql: match[0] }));
  });
  const privileges = files.flatMap(({ name, sql }) => [...sql.matchAll(/^(?:grant|revoke|alter default privileges)\b[\s\S]*?;$/gim)]
    .map(match => ({ migration: name, sql: match[0] })));
  // This one statement targets the separately reconciled platform function,
  // which is deliberately absent from the application-only reference database.
  const platformPrivileges = privileges.filter(row => row.sql.includes('private.rls_auto_enable()'));
  assert.equal(platformPrivileges.length, 1);
  assert.equal(privileges.length, 297, 'Unexpected source privilege statement count');
  assert.equal(statements.filter(row => /^create table\b/i.test(row.sql)).length, 30,
    'Unexpected literal source table count');
  assert.equal(statements.length, 188, 'Unexpected source DDL statement count');
  const ddlSha256 = createHash('sha256').update(statements.map(row => row.sql).join('\n\n')).digest('hex');
  assert.equal(ddlSha256, '07014005ed10f101d61e37446a204285c19e6907818437af32e3ec4ceafba6c5',
    'Source DDL extraction changed; review before comparing');
  return { functions, statements, privileges: privileges.filter(row => !platformPrivileges.includes(row)),
    platformPrivileges, cutoff, sourceCheckpoint: functions.checkpoint, ddlSha256 };
}

export async function createSourceRelationDatabase() {
  const source = await loadRelationSource();
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      set check_function_bodies = off;`);
    // Signature/type scaffolding for CHECKs and policies; bodies are not invoked
    // as part of the definition comparison. Function/runtime parity is separate.
    for (const definition of source.functions.definitions) await db.exec(resolveBaselineDefinition(definition));
    for (const statement of source.statements) {
      try { await db.exec(statement.sql); }
      catch (error) { throw new Error(`Source DDL failed in ${statement.migration}: ${error.message}`, { cause: error }); }
    }
    // Plain PostgreSQL owner/defaults plus literal source privilege statements.
    // No Supabase initial/default grants are inferred from the supplied export.
    // The checkpoint has only per-schema default REVOKEs; applying these after
    // object creation captures their final metadata, not historical defaults.
    for (const statement of source.privileges) {
      try { await db.exec(statement.sql); }
      catch (error) { throw new Error(`Source privilege failed in ${statement.migration}: ${error.message}`, { cause: error }); }
    }
    return { db, source };
  } catch (error) { await db.close(); throw error; }
}
