import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withCiSupabaseStack } from './ci-supabase-stack.mjs';
import { probePlatformDefaults } from './platform-default-probe.mjs';

try {
  assert.equal(process.argv.length, 3, 'Usage: node run-ci-platform-probe.mjs <new-report.json>');
  const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_platform', probePlatformDefaults);
  await writeFile(process.argv[2], JSON.stringify({ ...result, ...runtime }, null, 2) + '\n', { flag: 'wx' });
  console.log(`KAJO CI PLATFORM PROBE PASS — ${result.existingFunctions.count} existing functions unchanged; rollback and cleanup verified`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
