// Proposed fresh-install lineage through the actual Supabase CLI. Test-only:
// files are generated inside a new CI workspace; canonical history is untouched.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { withCiSupabaseStack } from './ci-supabase-stack.mjs';
import { applicationSmokeSql, assertEmptyApplication, buildBaselineInstallation,
  snapshotApplication, sourceApplicationReference } from './baseline-installation.mjs';
import { functionDigestSql } from './platform-default-probe.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
try {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/database/run-ci-cli-installation-probe.mjs <new-report.json>');
  const candidate = await buildBaselineInstallation();
  const expected = await sourceApplicationReference(candidate);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(name => /^\d{14}_.+\.sql$/.test(name)
    && name > candidate.metadata.cutoff).sort();
  assert.ok(names.length > 0, 'Expected ordinary post-cutoff migrations');
  // CLI owns migration execution and history recording. Do not insert an inner
  // COMMIT that could detach application changes from its history transaction.
  const files = [{ name: `${candidate.metadata.cutoff.slice(0, 14)}_kajo_source_baseline.sql`, sql: candidate.sql },
    ...await Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, directory), 'utf8') })))];
  const expectedHistory = files.map(file => ({ version: file.name.slice(0, 14), name: file.name.slice(15, -4) }));
  const [smoke, defaults, platformSql] = await Promise.all([
    applicationSmokeSql(), readFile(new URL('function-defaults-smoke.sql', import.meta.url), 'utf8'),
    readFile(new URL('platform-schema-snapshot.sql', import.meta.url), 'utf8'),
  ]);
  const historySql = `begin read only; set local search_path=pg_catalog;
    select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) as snapshot
      from supabase_migrations.schema_migrations; rollback;`;
  const nativeSql = `begin read only; set local search_path=pg_catalog;
    ${functionDigestSql({ includeApplication: false })} rollback;`;
  const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_cli_install', async (exec, { resetFromMigrations }) => {
    const [platformBefore, functionsBefore] = await exec(platformSql + '\n' + nativeSql);
    const firstRuntime = await resetFromMigrations(files);
    const first = await snapshotApplication(exec, candidate);
    assertEmptyApplication(first);
    assert.deepEqual(first, expected, 'CLI installation differs from the source reference');
    assert.deepEqual((await exec(historySql))[0], expectedHistory, 'CLI recorded unexpected migration history');

    const failure = { name: '20991231235959_kajo_cli_atomicity_probe.sql', sql: `
      create table public.kajo_cli_partial_change(id integer);
      do $$ begin raise exception 'KAJO_CLI_ATOMICITY_PROBE'; end $$;` };
    assert.ok(files.every(file => file.name < failure.name));
    await assert.rejects(resetFromMigrations([...files, failure]), /KAJO_CLI_ATOMICITY_PROBE/);
    assert.deepEqual(await snapshotApplication(exec, candidate), first, 'Failed CLI migration left partial application changes');
    assert.deepEqual((await exec(historySql))[0], expectedHistory, 'Failed CLI migration was recorded as applied');

    const secondRuntime = await resetFromMigrations(files);
    assert.deepEqual(await snapshotApplication(exec, candidate), first, 'Repeated CLI installation differs');
    assert.deepEqual((await exec(historySql))[0], expectedHistory);
    const results = await exec(smoke);
    assert.match(results[0]?.smoke, /^PASS: authenticated public V1/);
    await exec(`begin; ${defaults} rollback;`);
    assert.deepEqual(await snapshotApplication(exec, candidate), first, 'CLI installation runtime smoke left changes');
    const [platformAfter, functionsAfter] = await exec(platformSql + '\n' + nativeSql);
    assert.deepEqual(functionsAfter, functionsBefore, 'Native function definitions/permissions differ after CLI reset');
    for (const key of ['roles', 'memberships', 'eventTriggers']) {
      assert.deepEqual(platformAfter[key], platformBefore[key], `CLI reset changed native ${key}`);
    }
    assert.deepEqual(platformAfter.schemas.filter(row => row.name !== 'private'), platformBefore.schemas);
    const nativeDefaults = rows => (rows ?? []).filter(row => !(row.creator === 'postgres'
      && (['public', 'private'].includes(row.schema) || (row.schema === '*' && row.kind === 'f'))));
    assert.deepEqual(nativeDefaults(platformAfter.creatorDefaults), nativeDefaults(platformBefore.creatorDefaults));
    return { resets: [firstRuntime, secondRuntime], history: expectedHistory,
      failedMigrationAtomicity: 'PASS', applicationSnapshotSha256: hash(JSON.stringify(first)),
      nativeFunctions: functionsAfter, platform: platformAfter };
  });
  await writeFile(process.argv[2], JSON.stringify({ format: 'kajo-cli-installation-v1', status: 'PASS', runtime,
    source: candidate.metadata, files: files.map(file => ({ name: file.name, sha256: hash(file.sql) })),
    ...result }, null, 2) + '\n', { flag: 'wx' });
  console.log('KAJO CI CLI INSTALL PASS — two resets match source; failed migration leaves no DDL/history; runtime, defaults and native platform verified');
} catch (error) {
  console.error(error.message);
  if (error.code === 'ERR_ASSERTION') console.error(JSON.stringify({ actual: error.actual, expected: error.expected }));
  process.exitCode = 1;
}
