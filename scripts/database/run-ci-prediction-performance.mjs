import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release } from 'node:os';
import { withCiSupabaseStack } from './ci-supabase-stack.mjs';
import { buildFreshInstallation, installFreshDatabase } from './fresh-installation.mjs';
import { collectNativePredictionPerformance } from './native-prediction-performance.mjs';

try {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/database/run-ci-prediction-performance.mjs <new-report.json>');
  const installation = await buildFreshInstallation();
  const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_prediction_performance', async (exec, { applyMigrations }) => {
    const installed = await installFreshDatabase(exec, applyMigrations, installation);
    const performance = await collectNativePredictionPerformance(exec);
    return { installed, performance };
  });
  const host = { platform: platform(), kernel: release(), node: process.version,
    logicalCpus: cpus().length, cpuModel: cpus()[0]?.model ?? null, totalHostMemoryBytes: totalmem(),
    resourceScope: 'RUNNER_HOST_INVENTORY_NOT_CONTAINER_LIMITS_OR_PEAK_USAGE' };
  const report = { format: 'kajo-native-prediction-performance-report-v1', runtime, host, ...result };
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  assert.equal(result.performance.status, 'PASS', 'Incomplete performance report (artifact retains failed/missing denominators)');
  console.log('Native prediction performance: complete diagnostic baseline; no latency or quality admission.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
