// Offline diagnostic for an owner-supplied schema export, not migration replay.
// No database URL or network client: all SQL runs in disposable in-memory PGlite.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { compareFunctionSchemas, compareFunctionPrivileges } from './function-schema-parity.mjs';
import { verifyExportTriggers } from './trigger-source.mjs';
import { compareRelationSchemas } from './relation-schema-parity.mjs';
import { compareExportFunctionSource } from './function-source.mjs';
import { createSourceRelationDatabase } from './relation-source.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
try {
  if (process.argv.length < 4 || process.argv.length > 6) {
    throw new Error('Usage: node scripts/database/schema-export-diagnostic.mjs <schema.sql> <expected-sha256> [function-snapshot.json] [relation-snapshot.json]');
  }
  const bytes = await readFile(process.argv[2]);
  const checksum = hash(bytes);
  if (!/^[a-f0-9]{64}$/.test(process.argv[3]) || checksum !== process.argv[3]) {
    throw new Error('Schema export checksum mismatch');
  }
  const snapshotSql = await readFile(new URL('function-schema-snapshot.sql', import.meta.url), 'utf8');
  let first;
  const relationSql = await readFile(new URL('relation-schema-snapshot.sql', import.meta.url), 'utf8');
  const { db: sourceDb, source } = await createSourceRelationDatabase();
  let sourceRelations;
  let sourceFunctions;
  let reviewedRelations;
  let reviewedFunctions;
  const compatibility = await readFile(new URL('baseline-compatibility-grants.sql', import.meta.url), 'utf8');
  try {
    sourceRelations = (await sourceDb.exec(relationSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
    sourceFunctions = (await sourceDb.exec(snapshotSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
    await sourceDb.exec(compatibility);
    reviewedRelations = (await sourceDb.exec(relationSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
    reviewedFunctions = (await sourceDb.exec(snapshotSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
  }
  finally { await sourceDb.close(); }
  let firstRelations;
  let firstInventory;
  for (let install = 1; install <= 2; install++) {
    const db = new PGlite();
    try {
      // Signature-only Auth fixtures. No Auth lifecycle/platform-trigger claim.
      await db.exec(`create role anon; create role authenticated; create role service_role;
        create schema auth;
        create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
        $$;`);
      // Execute the complete export unchanged. Any statement failure stops the run.
      await db.exec(bytes.toString('utf8'));
      const triggerParity = await verifyExportTriggers(db);
      const functionSourceParity = await compareExportFunctionSource(db);
      const tables = (await db.query(`select format('%I.%I', n.nspname,c.relname) as name,
          c.relrowsecurity as rls
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private') and c.relkind in ('r','p')
        order by 1`)).rows;
      assert.ok(tables.length > 0, 'Export contains no application tables');
      for (const table of tables) {
        // Identifier is quoted by PostgreSQL format(%I), never unquoted input.
        const count = (await db.query(`select count(*)::text as n from ${table.name}`)).rows[0].n;
        assert.equal(count, '0', `Schema export contains data in ${table.name}`);
      }
      const snapshot = (await db.exec(snapshotSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
      const relations = (await db.exec(relationSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;
      const inventory = {
        triggerParity,
        functionSourceParity,
        relationSourceParity: {
          ...compareRelationSchemas(sourceRelations, relations, { fingerprint: 'structureSha256' }),
          checkpoint: source.sourceCheckpoint, cutoff: source.cutoff,
          statements: source.statements.length, ddlSha256: source.ddlSha256,
        },
        sourcePrivilegeReference: {
          scope: 'Plain PostgreSQL defaults and postgres-owned source objects; Supabase initial/default grants, schema ACL and role inheritance NOT reconstructed',
          statements: source.privileges.length,
          excludedPlatformStatements: source.platformPrivileges,
          tables: compareRelationSchemas(sourceRelations, relations),
          functions: compareFunctionPrivileges(sourceFunctions, { ...snapshot,
            functions: snapshot.functions.filter(row => row.identity !== 'private.rls_auto_enable()') }),
        },
        reviewedPrivilegeParity: {
          contract: 'Source grants plus explicit existing-service-role compatibility; ADR-0006',
          compatibilitySha256: hash(compatibility),
          tables: compareRelationSchemas(reviewedRelations, relations),
          functions: compareFunctionPrivileges(reviewedFunctions, { ...snapshot,
            functions: snapshot.functions.filter(row => row.identity !== 'private.rls_auto_enable()') }),
        },
        tables: tables.length,
        tablesWithoutRls: tables.filter(t => !t.rls).map(t => t.name),
        functions: snapshot.functions.length,
        constraints: (await db.query(`select count(*)::int as n from pg_constraint c
          join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private')`)).rows[0].n,
        policies: (await db.query(`select count(*)::int as n from pg_policy p
          join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
          where n.nspname in ('public','private')`)).rows[0].n,
        authProvisioningTriggerPresent: (await db.query(`select exists(select 1 from pg_trigger
          where tgrelid='auth.users'::regclass and tgname='provision_kajo_personal_profile') as present`)).rows[0].present,
        eventTriggers: (await db.query('select count(*)::int as n from pg_event_trigger')).rows[0].n,
        predictorGenomes: (await db.query('select count(*)::int as n from private.predictor_genomes')).rows[0].n,
        policyAssignments: (await db.query('select count(*)::int as n from private.policy_assignments')).rows[0].n,
      };
      if (first) {
        assert.equal(compareFunctionSchemas(first, snapshot).status, 'MATCH');
        assert.equal(compareRelationSchemas(firstRelations, relations).status, 'MATCH');
        assert.deepEqual(inventory, firstInventory);
      } else { first = snapshot; firstRelations = relations; firstInventory = inventory; }
    } finally { await db.close(); }
  }
  if (process.argv[4]) await writeFile(process.argv[4], JSON.stringify(first, null, 2) + '\n', { flag: 'wx' });
  if (process.argv[5]) await writeFile(process.argv[5], JSON.stringify(firstRelations, null, 2) + '\n', { flag: 'wx' });
  const sourceMatched = firstInventory.functionSourceParity.status === 'MATCH'
    && firstInventory.relationSourceParity.status === 'MATCH'
    && firstInventory.reviewedPrivilegeParity.tables.status === 'MATCH'
    && firstInventory.reviewedPrivilegeParity.functions.status === 'MATCH';
  console.log(JSON.stringify({ status: sourceMatched ? 'PASS' : 'REQUIRES_RECONCILIATION',
    exportRepeatability: 'PASS', engine: 'PGlite 0.3.14', postgresMajor: first.serverMajor,
    exportSha256: checksum, installs: 2, inventory: firstInventory,
    scope: 'Unmodified export loads twice; application tables empty; function and table-definition/direct ACL parity between installs; source reconciliation reported separately. Not canonical full repository parity, complete schema parity, seed or Supabase platform acceptance.' }, null, 2));
  if (!sourceMatched) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', code: error.code, message: error.message }));
  process.exitCode = 1;
}
