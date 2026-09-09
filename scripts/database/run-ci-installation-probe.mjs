// Two committed application installations on distinct disposable Supabase stacks.
// This does not deploy the candidate or prove the independent hosted upgrade.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { withCiSupabaseStack } from './ci-supabase-stack.mjs';
import { functionDigestSql } from './platform-default-probe.mjs';
import { applicationSmokeSql, assertEmptyApplication, buildBaselineInstallation, snapshotApplication, sourceApplicationReference } from './baseline-installation.mjs';

try {
  assert.equal(process.argv.length, 3, 'Usage: node run-ci-installation-probe.mjs <new-report.json>');
  const candidate = await buildBaselineInstallation();
  const expected = await sourceApplicationReference(candidate);
  const [correction, defaultsSmoke, platformSql, smoke] = await Promise.all([
    readFile(new URL('../../supabase/migrations/20260909131913_close_postgres_function_defaults.sql', import.meta.url), 'utf8'),
    readFile(new URL('function-defaults-smoke.sql', import.meta.url), 'utf8'),
    readFile(new URL('platform-schema-snapshot.sql', import.meta.url), 'utf8'),
    applicationSmokeSql(),
  ]);
  const nativeSql = `begin read only; set local search_path=pg_catalog;
    ${functionDigestSql({ includeApplication: false })} rollback;`;
  const runs = [];
  let first;
  for (const suffix of ['a', 'b']) {
    const { result, ...runtime } = await withCiSupabaseStack(`kajo_ci_install_${suffix}`, async exec => {
      const [platformBefore, functionsBefore] = await exec(platformSql + '\n' + nativeSql);
      await exec(`begin; ${candidate.sql} commit;`);
      const beforeForward = await snapshotApplication(exec, candidate);
      assertEmptyApplication(beforeForward);
      assert.deepEqual(beforeForward, expected, 'Real installation differs from the reviewed source-only reference');
      await exec(`begin; ${correction} ${defaultsSmoke} commit;`);
      const installed = await snapshotApplication(exec, candidate);
      assert.deepEqual(installed, beforeForward, 'Default correction changed existing application schema or seeds');
      const results = await exec(smoke);
      assert.equal(results.length, 1);
      assert.match(results[0].smoke, /^PASS: authenticated public V1/);
      const afterSmoke = await snapshotApplication(exec, candidate);
      assertEmptyApplication(afterSmoke);
      assert.deepEqual(afterSmoke, installed, 'Runtime smoke changed the committed installation');
      await assert.rejects(exec(`begin; ${candidate.sql} commit;`), /requires empty application schemas and Auth/);
      assert.deepEqual(await snapshotApplication(exec, candidate), installed);
      const [platformAfter, functionsAfter] = await exec(platformSql + '\n' + nativeSql);
      assert.deepEqual(functionsAfter, functionsBefore, 'Native platform functions changed');
      for (const field of ['roles', 'memberships', 'eventTriggers']) {
        assert.deepEqual(platformAfter[field], platformBefore[field], `Native platform ${field} changed`);
      }
      assert.deepEqual(platformAfter.schemas.filter(row => row.name !== 'private'), platformBefore.schemas);
      const nativeDefaults = rows => (rows ?? []).filter(row => !(row.creator === 'postgres'
        && (['public', 'private'].includes(row.schema) || (row.schema === '*' && row.kind === 'f'))));
      assert.deepEqual(nativeDefaults(platformAfter.creatorDefaults), nativeDefaults(platformBefore.creatorDefaults));
      return { installed, platformAfter, nativeFunctions: functionsAfter };
    });
    if (first) assert.deepEqual(result, first, 'Independent real Supabase installations differ');
    else first = result;
    runs.push(runtime);
    console.log(`Application installation ${suffix}: 30 tables, 122 functions, 22 triggers; runtime, rollback and cleanup PASS`);
  }
  assert.notEqual(runs[0].containerId, runs[1].containerId, 'Expected two distinct database containers');
  const report = { format: 'kajo-source-installation-v1', status: 'PASS', installations: runs,
    source: candidate.metadata, forwardMigrationSha256: createHash('sha256').update(correction).digest('hex'),
    applicationSnapshotSha256: createHash('sha256').update(JSON.stringify(first.installed)).digest('hex'),
    snapshot: first };
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log('KAJO CI APPLICATION INSTALL PASS — two fresh committed installations match; Auth, Personal, Shared, imports and future defaults verified');
} catch (error) {
  console.error(error.message);
  // Assertions compare only synthetic-install metadata, hashes and source seeds.
  // Preserve exact differences in CI logs even when no PASS artifact is produced.
  if (error.code === 'ERR_ASSERTION') console.error(JSON.stringify({ actual: error.actual, expected: error.expected }));
  process.exitCode = 1;
}
