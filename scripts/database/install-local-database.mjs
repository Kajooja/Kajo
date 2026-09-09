import assert from 'node:assert/strict';
import { buildFreshInstallation, installFreshDatabase } from './fresh-installation.mjs';
import { withLocalSupabaseStack } from './ci-supabase-stack.mjs';

try {
  assert.equal(process.argv.length, 3, 'Usage: npm run database:install -- /absolute/new/workspace');
  const installation = await buildFreshInstallation();
  const report = await withLocalSupabaseStack(process.argv[2], (exec, { applyMigrations }) =>
    installFreshDatabase(exec, applyMigrations, installation));
  console.log(`KAJO LOCAL INSTALL PASS — verified workspace: ${report.workspace}`);
  console.log(`Project: ${report.projectId}; source, CLI history, Auth/Personal/Shared runtime verified.`);
  console.log('The new local stack remains running. Read kajo-installation.json in that workspace.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
