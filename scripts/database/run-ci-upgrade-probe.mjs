// Source-checkpoint upgrade fixture in a third, independent, unlinked CI stack.
// The application installer is never called. Only the ordinary forward migration
// is applied after fixtures and pre-upgrade traces have been committed.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withCiSupabaseStack } from './ci-supabase-stack.mjs';
import { buildExistingApplicationFixture, probeExistingApplicationUpgrade } from './existing-application-upgrade.mjs';

try {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/database/run-ci-upgrade-probe.mjs <new-report.json>');
  const fixture = await buildExistingApplicationFixture();
  const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_upgrade', async exec => {
    await exec(`begin; ${fixture.sql} commit;`);
    return probeExistingApplicationUpgrade(exec);
  });
  await writeFile(process.argv[2], JSON.stringify({ ...result, fixture: fixture.metadata, runtime }, null, 2) + '\n', { flag: 'wx' });
  console.log('KAJO CI EXISTING APPLICATION UPGRADE PASS — existing rows, definitions, permissions, traces and platform preserved; runtime and future-function defaults verified');
} catch (error) {
  console.error(error.message);
  if (error.code === 'ERR_ASSERTION') console.error(JSON.stringify({ actual: error.actual, expected: error.expected }));
  process.exitCode = 1;
}
