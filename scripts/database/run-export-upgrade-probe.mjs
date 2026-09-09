// Optional offline proof against the exact supplied pre-upgrade schema export.
// Executes only in a disposable in-memory PGlite database, never hosted/over a URL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildDeterministicSeedSql } from './system-seed-source.mjs';
import { probeExistingApplicationUpgrade } from './existing-application-upgrade.mjs';

let db;
try {
  assert.equal(process.argv.length, 4,
    'Usage: node scripts/database/run-export-upgrade-probe.mjs <kajo-schema.sql> <new-report.json>');
  const bytes = await readFile(process.argv[2]);
  const exportSha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(exportSha256, '3f29a88a8937f38fd2014b3c8b8c4e2f9a46a0ee49b71bec680b5cdad7170c3e',
    'Unexpected export; review it before executing any fixture SQL');
  const [authSource, seeds, data] = await Promise.all([
    readFile(new URL('../../supabase/migrations/20260827173000_auth_identifier_and_profile_fix.sql', import.meta.url), 'utf8'),
    buildDeterministicSeedSql(), readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8'),
  ]);
  const trigger = authSource.match(/^create trigger provision_kajo_personal_profile\nafter insert on auth\.users\nfor each row execute function private\.provision_personal_profile_from_auth_user\(\);$/m)?.[0];
  assert.ok(trigger, 'Canonical Auth trigger not found');
  db = new PGlite();
  // Minimal Auth signatures only. Real provider/platform behavior is tested in CI.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;`);
  // No function replacement or compatibility supplement: preserve all 123
  // originally exported functions and their permissions, including the RLS helper.
  // pg_dump disables row_security for its restore session. Restore ordinary
  // caller RLS/body validation before exercising authenticated application SQL.
  await db.exec(`begin; ${bytes.toString('utf8')}
    set row_security=on; set check_function_bodies=on;
    ${trigger} ${seeds} ${data} commit;`);
  const result = await probeExistingApplicationUpgrade(async sql => (await db.exec(sql))
    .flatMap(response => response.rows.filter(row => Object.hasOwn(row, 'snapshot')).map(row => row.snapshot)));
  assert.equal(result.before.applicationFunctions.functions.length, 123);
  const report = JSON.stringify({ ...result, fixture: { kind: 'unchanged-owner-export',
    exportSha256, dataSha256: createHash('sha256').update(data).digest('hex'), engine: 'PGlite 0.3.14' } }, null, 2) + '\n';
  await writeFile(process.argv[3], report, { flag: 'wx' });
  console.log(JSON.stringify({ status: result.status, applicationFunctions: 123,
    reportSha256: createHash('sha256').update(report).digest('hex'),
    existingSnapshotSha256: result.existingSnapshotSha256, correctedSnapshotSha256: result.correctedSnapshotSha256 }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { if (db) await db.close(); }
