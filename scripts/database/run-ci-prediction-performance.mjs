import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, totalmem, platform, release } from 'node:os';
import { withCiSupabaseStack } from './ci-supabase-stack.mjs';
import { buildFreshInstallation, installFreshDatabase } from './fresh-installation.mjs';
import { collectNativePredictionPerformance } from './native-prediction-performance.mjs';
import { performanceSeriesProtocol, summarizePerformanceSeries } from './native-performance-series.mjs';
import { performanceComparisonProtocol, performanceComparisonInstallations,
  summarizePerformanceComparison } from './native-performance-comparison.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const hostInventory = () => ({ platform: platform(), kernel: release(), node: process.version,
  logicalCpus: cpus().length, cpuModel: cpus()[0]?.model ?? null, totalHostMemoryBytes: totalmem(),
  resourceScope: 'RUNNER_HOST_INVENTORY_NOT_CONTAINER_LIMITS_OR_PEAK_USAGE' });

try {
  const comparison = process.argv[3] === '--compare-skip-prefilter';
  assert.ok(process.argv.length === (comparison ? 4 : 3),
    'Usage: node scripts/database/run-ci-prediction-performance.mjs <new-report.json> [--compare-skip-prefilter]');
  const installation = await buildFreshInstallation();
  const variants = comparison ? performanceComparisonInstallations(installation) : null;
  const protocol = comparison ? performanceComparisonProtocol() : performanceSeriesProtocol();
  const count = comparison ? protocol.order.length : protocol.baselineRuns;
  const report = { format: comparison ? 'kajo-native-prediction-performance-comparison-v1' : 'kajo-native-prediction-performance-series-v1', status: 'FAIL', protocol,
    protocolSha256: hash(JSON.stringify(protocol)),
    runnerSourceSha256: hash(await readFile(new URL(import.meta.url))),
    seriesSourceSha256: hash(await readFile(new URL('native-performance-series.mjs', import.meta.url))),
    ...(comparison ? { comparisonSourceSha256: hash(await readFile(new URL('native-performance-comparison.mjs', import.meta.url))) } : {}),
    job: { runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB },
    runs: [] };
  try {
    for (let index = 1; index <= count; index++) {
      const variant = comparison ? protocol.order[index - 1] : null;
      console.log(`Native performance ${variant ?? 'baseline'} ${index}/${count}`);
      const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_prediction_performance', async (exec, { applyMigrations }) => {
        const installed = await installFreshDatabase(exec, applyMigrations, comparison ? variants[variant] : installation);
        const performance = await collectNativePredictionPerformance(exec);
        const diagnostics = (comparison || index === count) && performance.status === 'PASS'
          ? await collectNativePredictionPerformance(exec, { profileFunctions: true }) : undefined;
        return { installed, performance, ...(diagnostics ? { diagnostics } : {}) };
      });
      // The lifecycle has verified container/volume cleanup before the next run.
      report.runs.push({ index, ...(comparison ? { variant } : {}), runtime, host: hostInventory(), ...result });
      assert.equal(result.performance.status, 'PASS', 'Incomplete baseline; artifact retains failed/missing denominators');
    }
    if (comparison) report.comparison = summarizePerformanceComparison(report.runs);
    else report.repeatability = summarizePerformanceSeries(report.runs);
    report.status = 'PASS';
  } finally {
    report.reportedRuns = report.runs.length;
    report.missingRuns = count - report.runs.length;
    await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(comparison ? 'Native comparison: ' + report.comparison.decision
    : 'Native prediction performance: three same-worker baselines and separate function diagnostics; no latency or quality admission.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
