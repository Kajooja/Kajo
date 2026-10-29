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
import { skipHistoryComparisonProtocol, summarizeSkipHistoryComparison } from './native-skip-history-comparison.mjs';
import { collectSkipCallDiagnostics, skipCallDiagnosticProtocol } from './native-skip-call-diagnostics.mjs';
import { summarizeSkipCallSeries } from './native-skip-call-series.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const hostInventory = () => ({ platform: platform(), kernel: release(), node: process.version,
  logicalCpus: cpus().length, cpuModel: cpus()[0]?.model ?? null, totalHostMemoryBytes: totalmem(),
  resourceScope: 'RUNNER_HOST_INVENTORY_NOT_CONTAINER_LIMITS_OR_PEAK_USAGE' });

try {
  const diagnose = process.argv[3] === '--diagnose-skip-history';
  const histories = diagnose || process.argv[3] === '--compare-skip-history';
  const comparison = histories || process.argv[3] === '--compare-skip-prefilter';
  assert.ok(process.argv.length === (comparison ? 4 : 3),
    'Usage: node scripts/database/run-ci-prediction-performance.mjs <new-report.json> [--compare-skip-prefilter|--compare-skip-history|--diagnose-skip-history]');
  const installation = await buildFreshInstallation();
  const variants = comparison ? performanceComparisonInstallations(installation) : null;
  const protocol = diagnose ? { version: 'native-skip-call-series-v1', order: skipHistoryComparisonProtocol().order,
    prelude: skipHistoryComparisonProtocol(), diagnostics: skipCallDiagnosticProtocol(),
    admission: 'NONE_DIAGNOSTIC_PROTOCOL_PRESERVES_ALL_ORIGINAL_V1_RESULTS',
    insertion: 'AFTER_FIRST_CATALOGUE_PERSONAL_HISTORY_FUNCTION_SAMPLE_BEFORE_CLEANUP',
    subsequentState: 'OBSERVER_ROLLBACK_RESTORES_LOGICAL_ROWS_NOT_PHYSICAL_STATE' }
    : histories ? skipHistoryComparisonProtocol() : comparison ? performanceComparisonProtocol() : performanceSeriesProtocol();
  const count = comparison ? protocol.order.length : protocol.baselineRuns;
  const report = { format: diagnose ? 'kajo-native-skip-call-diagnostics-v1' : histories ? 'kajo-native-skip-history-envelope-v1' : comparison ? 'kajo-native-prediction-performance-comparison-v1' : 'kajo-native-prediction-performance-series-v1', status: 'FAIL', protocol,
    protocolSha256: hash(JSON.stringify(protocol)),
    runnerSourceSha256: hash(await readFile(new URL(import.meta.url))),
    seriesSourceSha256: hash(await readFile(new URL('native-performance-series.mjs', import.meta.url))),
    ...(comparison ? { comparisonSourceSha256: hash(await readFile(new URL('native-performance-comparison.mjs', import.meta.url))) } : {}),
    ...(histories ? { historyComparisonSourceSha256: hash(await readFile(new URL('native-skip-history-comparison.mjs', import.meta.url))) } : {}),
    ...(diagnose ? { skipCallDiagnosticSourceSha256: hash(await readFile(new URL('native-skip-call-diagnostics.mjs', import.meta.url))),
      skipCallSeriesSourceSha256: hash(await readFile(new URL('native-skip-call-series.mjs', import.meta.url))) } : {}),
    job: { runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB },
    runs: [] };
  let baselineDefinition;
  try {
    for (let index = 1; index <= count; index++) {
      const variant = comparison ? protocol.order[index - 1] : null;
      console.log(`Native performance ${variant ?? 'baseline'} ${index}/${count}`);
      const pending = { index, ...(comparison ? { variant } : {}), phase: 'STACK_START',
        cleanup: 'NOT_VERIFIED', host: hostInventory() };
      report.incompleteRun = pending;
      const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_prediction_performance', async (exec, { applyMigrations }) => {
        pending.phase = 'INSTALLATION';
        const installed = await installFreshDatabase(exec, applyMigrations, comparison ? variants[variant] : installation);
        pending.installed = installed;
        const collect = async (field, options) => {
          pending.phase = field;
          try { return pending[field] = await collectNativePredictionPerformance(exec, options); }
          catch (error) {
            if (error.performanceReport) pending[field] = error.performanceReport;
            throw error;
          }
        };
        const performance = await collect('performance');
        const diagnostics = (comparison || index === count) && performance.status === 'PASS'
          ? await collect('diagnostics', { profileFunctions: true }) : undefined;
        const historyPerformance = histories && diagnostics?.status === 'PASS'
          ? await collect('historyPerformance', { skipHistory: true }) : undefined;
        let skipCallDiagnostics;
        const observeHistoryCohort = diagnose ? async context => {
          pending.phase = 'skipCallDiagnostics';
          // Obtain the actual baseline only after the complete original target
          // prelude. Preparing references beforehand would change its state.
          if (variant === 'BASELINE') {
            const [definition] = await exec("select to_jsonb(pg_get_functiondef('private.acquire_native_candidates_v1(jsonb)'::regprocedure));",
              { stage: 'skip-call-baseline-definition', timeoutMs: 120_000 });
            if (baselineDefinition) assert.equal(definition, baselineDefinition);
            else baselineDefinition = definition;
          }
          assert.ok(baselineDefinition, 'First diagnostic stack must provide the actual predecessor');
          skipCallDiagnostics = await collectSkipCallDiagnostics(exec, { ...context, baselineDefinition,
            // This diagnostic belongs to the frozen comparison's candidate,
            // even after unrelated forwards extend the current installation.
            migration: variants.CANDIDATE.files.at(-1) });
          pending.skipCallDiagnostics = skipCallDiagnostics;
          pending.phase = 'historyDiagnostics';
        } : undefined;
        const historyDiagnostics = historyPerformance?.status === 'PASS'
          ? await collect('historyDiagnostics', { skipHistory: true, profileFunctions: true, observeHistoryCohort }) : undefined;
        pending.phase = 'STACK_CLEANUP';
        return { installed, performance, ...(diagnostics ? { diagnostics } : {}),
          ...(histories ? { historyPerformance, historyDiagnostics } : {}),
          ...(diagnose ? { skipCallDiagnostics } : {}) };
      });
      // The lifecycle has verified container/volume cleanup before the next run.
      report.runs.push({ index, ...(comparison ? { variant } : {}), runtime, host: hostInventory(), ...result });
      delete report.incompleteRun;
      assert.equal(result.performance.status, 'PASS', 'Incomplete baseline; artifact retains failed/missing denominators');
      if (histories) assert.equal(result.historyDiagnostics?.status, 'PASS', 'Incomplete history collection');
      if (diagnose) assert.equal(result.skipCallDiagnostics?.status, 'PASS', 'Incomplete scoped diagnosis');
    }
    if (diagnose) {
      report.diagnosis = summarizeSkipCallSeries(report.runs);
    } else if (histories) report.comparison = summarizeSkipHistoryComparison(report.runs);
    else if (comparison) report.comparison = summarizePerformanceComparison(report.runs);
    else report.repeatability = summarizePerformanceSeries(report.runs);
    report.status = 'PASS';
  } finally {
    report.reportedRuns = report.runs.length;
    report.missingRuns = count - report.runs.length;
    await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(diagnose ? 'Native skip-call diagnostics complete; no rollout admission.'
    : comparison ? 'Native comparison: ' + report.comparison.decision
    : 'Native prediction performance: three same-worker baselines and separate function diagnostics; no latency or quality admission.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
