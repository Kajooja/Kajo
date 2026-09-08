// Offline comparison input for the protected historical checkpoint, not an installer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');

export async function loadApplicationTriggerSource() {
  const names = (await readdir(migrations)).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  const triggers = new Map();
  const sourceHashes = [];
  for (const name of names) {
    if (name > '20260907155201_bootstrap_personal_ranking.sql') continue;
    const source = await readFile(new URL(name, migrations), 'utf8');
    sourceHashes.push(`${name}:${hash(source)}`);
    for (const match of source.matchAll(/^create trigger\s+([a-z_][a-z0-9_]*)\s+[\s\S]*?;$/gim)) {
      triggers.set(match[1], match[0]);
    }
  }
  assert.equal(hash(sourceHashes.join('\n')), '755d0b0b4787bec834ed184b85b2fe56cbd095c26090c8aec37342a71f3df6af',
    'Trigger source history changed; review extraction before comparing');
  const sql = [...triggers.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ddl]) => ddl).join('\n\n') + '\n';
  assert.ok(triggers.size >= 20, 'Unexpectedly few application triggers reconstructed');
  assert.match(sql, /create trigger provision_kajo_personal_profile\nafter insert on auth\.users/i);
  assert.match(sql, /create trigger prediction_runs_attach_policy_v1/i);
  assert.doesNotMatch(sql, /create event trigger/i);
  return { migrationSourceSha256: hash(sourceHashes.join('\n')), triggerSqlSha256: hash(sql), triggerCount: triggers.size, sql };
}

const snapshotSql = `select n.nspname || '.' || c.relname || ':' || t.tgname as identity,
  pg_get_triggerdef(t.oid) as definition, t.tgenabled as enabled
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and not t.tgisinternal order by 1`;

export function compareTriggerSnapshots(expected, actual) {
  assert.ok(expected.length > 0 && actual.length > 0, 'Empty trigger snapshot');
  const sorted = rows => [...rows].sort((a,b) => a.identity.localeCompare(b.identity));
  assert.deepEqual(sorted(actual), sorted(expected), 'Application trigger definitions/enabled states differ from source');
}

export async function verifyExportTriggers(db) {
  const actual = (await db.query(snapshotSql)).rows;
  const source = await loadApplicationTriggerSource();
  // This is called only in the diagnostic's disposable PGlite database.
  // PostgreSQL deparses both definitions identically; literals are never normalized.
  await db.exec('begin; set local search_path = pg_catalog');
  try {
    for (const row of actual) {
      const [table, name] = row.identity.split(':');
      assert.match(table, /^(public|private)\.[a-z_][a-z0-9_]*$/);
      assert.match(name, /^[a-z_][a-z0-9_]*$/);
      await db.exec(`drop trigger ${name} on ${table}`);
    }
    await db.exec(source.sql);
    const expected = (await db.query(snapshotSql)).rows;
    compareTriggerSnapshots(expected, actual);
    return { applicationTriggers: actual.length, authSupplement: 'provision_kajo_personal_profile' };
  } finally { await db.exec('rollback'); }
}

export function triggerNames(sql) {
  return [...sql.matchAll(/^create(?:\s+or\s+replace)?\s+trigger\s+(?:"([a-z_][a-z0-9_]*)"|([a-z_][a-z0-9_]*))\s+/gim)]
    .map(match => match[1] ?? match[2]).sort();
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    assert.ok(process.argv.length === 2 || process.argv.length === 3,
      'Usage: node scripts/database/trigger-source.mjs [output.sql]');
    const result = await loadApplicationTriggerSource();
    if (process.argv[2]) await writeFile(process.argv[2], result.sql, { flag: 'wx' });
    console.log(JSON.stringify({ ...result, sql: undefined }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
