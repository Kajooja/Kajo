// Canonical new local/CI database lineage. Historical files remain immutable.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { buildBaselineInstallation, applicationSmokeSql, assertEmptyApplication,
  snapshotApplication, sourceApplicationReference } from './baseline-installation.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export const installationHistorySql = `begin read only; set local search_path=pg_catalog;
  select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb) as snapshot
  from supabase_migrations.schema_migrations; rollback;`;

export function validateMigrationFiles(files) {
  assert.ok(Array.isArray(files) && files.length > 0, 'Migration lineage is empty');
  const versions = new Set();
  let previous = '';
  for (const file of files) {
    assert.match(file.name, /^\d{14}_[a-z0-9_]+\.sql$/, 'Invalid migration filename');
    const version = file.name.slice(0, 14);
    assert.ok(!versions.has(version), `Duplicate migration version ${version}`);
    assert.ok(file.name > previous, 'Migrations must be in chronological order');
    assert.equal(typeof file.sql, 'string');
    assert.ok(file.sql.trim(), `Empty migration ${file.name}`);
    versions.add(version);
    previous = file.name;
  }
}

export async function buildFreshInstallation() {
  const candidate = await buildBaselineInstallation();
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  const all = await Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, directory), 'utf8') })));
  validateMigrationFiles(all);
  const files = [{ name: `${candidate.metadata.cutoff.slice(0, 14)}_kajo_source_baseline.sql`, sql: candidate.sql },
    ...all.filter(file => file.name > candidate.metadata.cutoff)];
  validateMigrationFiles(files);
  const history = files.map(file => ({ version: file.name.slice(0, 14), name: file.name.slice(15, -4) }));
  return { candidate, files, history, manifest: { format: 'kajo-fresh-lineage-v1', source: candidate.metadata,
    files: files.map(file => ({ name: file.name, sha256: hash(file.sql) })) } };
}

// The lifecycle starts a new, unlinked local stack and checks its actual pinned
// image BEFORE this function can apply SQL. The baseline itself refuses existing
// application objects/Auth users. Supabase CLI owns transactions and history.
export async function installFreshDatabase(exec, applyMigrations, installation) {
  const { candidate, files, history, manifest } = installation;
  validateMigrationFiles(files);
  assert.deepEqual(files.map(file => ({ name: file.name, sha256: hash(file.sql) })), manifest.files,
    'Installation bytes changed after source verification');
  const guard = candidate.sql.match(/^do \$application_install_guard\$[\s\S]*?\$application_install_guard\$;/)?.[0];
  assert.ok(guard, 'Source baseline is missing its empty-database preflight');
  // Run even when a restored CLI history might otherwise skip the baseline.
  await exec(`begin; ${guard} rollback;`);
  const expected = await sourceApplicationReference(candidate, files.slice(1));
  const runtime = await applyMigrations(files);
  assert.deepEqual((await exec(installationHistorySql))[0], history, 'Unexpected actual CLI migration history');
  const actual = await snapshotApplication(exec, candidate, { forward: true });
  assertEmptyApplication(actual);
  assert.deepEqual(actual, expected, 'Fresh database differs from source plus unchanged forward migrations');
  const smoke = await exec(await applicationSmokeSql());
  assert.match(smoke[0]?.smoke, /^PASS: authenticated public V1/);
  assert.deepEqual(await snapshotApplication(exec, candidate, { forward: true }), actual, 'Runtime smoke left changes');
  return { runtime, history, manifest, applicationSnapshotSha256: hash(JSON.stringify(actual)) };
}
