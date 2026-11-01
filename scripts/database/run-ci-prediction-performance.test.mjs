import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { skipPrefilterMigration } from './native-performance-comparison.mjs';

const sha256 = text => createHash('sha256').update(text).digest('hex');
const moduleUrl = file => new URL(file, import.meta.url).href;

test('actual CI diagnostic caller excludes later forwards from the frozen 53/54 comparison and diagnostic SQL', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-performance-caller-'));
  try {
    const pinnedSql = await readFile(new URL('../../supabase/migrations/' + skipPrefilterMigration, import.meta.url), 'utf8');
    const files = [
      ...Array.from({ length: 53 }, (_, n) => ({ name: `synthetic-predecessor-${n}.sql`, sql: `-- synthetic source ${n}` })),
      { name: skipPrefilterMigration, sql: pinnedSql },
      { name: '20261029095452_personal_rating_prospective.sql', sql: '-- later numeric source must stay outside the old diagnostic' },
      { name: '20990101000000_later_fixture.sql', sql: '-- a second future source must also stay outside' },
    ];
    const installation = { files,
      history: files.map(file => ({ version: file.name.slice(0, 14), name: file.name.slice(15, -4) })),
      manifest: { format: 'SYNTHETIC_CALLER_CONTRACT_ONLY', files: files.map(({ name, sql }) => ({ name, sha256: sha256(sql) })) },
    };
    await writeFile(join(directory, 'installation.json'), JSON.stringify(installation));
    // Execute the actual CLI entrypoint. Only expensive runtime/measurement
    // boundaries are synthetic; the comparison selector and protocols are the
    // real modules. This checks the caller's wiring, not native timings.
    await writeFile(join(directory, 'run-ci-prediction-performance.mjs'),
      await readFile(new URL('run-ci-prediction-performance.mjs', import.meta.url), 'utf8'));
    const stubs = {
      'fresh-installation.mjs': `import {readFile} from 'node:fs/promises';
        export async function buildFreshInstallation(){return JSON.parse(await readFile(new URL('installation.json',import.meta.url),'utf8'));}
        export async function installFreshDatabase(exec,apply,installation){await apply(installation.files);return {manifest:installation.manifest,history:installation.history};}`,
      'ci-supabase-stack.mjs': `import assert from 'node:assert/strict';
        export async function withCiSupabaseStack(project,work){
          assert.equal(project,'kajo_ci_prediction_performance');
          const result=await work(async()=>['synthetic pinned predecessor function definition'],{applyMigrations:async files=>{
            assert.ok([53,54].includes(files.length),'Later forwards reached the frozen comparison installer');
          }});return {result,cleanup:'SYNTHETIC_CALLER_CONTRACT_ONLY'};}`,
      'native-prediction-performance.mjs': `export async function collectNativePredictionPerformance(exec,options){
        if(options?.observeHistoryCohort)await options.observeHistoryCohort({origin:'SYNTHETIC_CALLER_CONTRACT_ONLY'});
        return {status:'PASS',origin:'SYNTHETIC_CALLER_CONTRACT_ONLY'};}`,
      'native-performance-series.mjs': `export {performanceSeriesProtocol,summarizePerformanceSeries} from ${JSON.stringify(moduleUrl('native-performance-series.mjs'))};`,
      'native-performance-comparison.mjs': `export {performanceComparisonProtocol,performanceComparisonInstallations,summarizePerformanceComparison} from ${JSON.stringify(moduleUrl('native-performance-comparison.mjs'))};`,
      'native-skip-history-comparison.mjs': `export {skipHistoryComparisonProtocol,summarizeSkipHistoryComparison} from ${JSON.stringify(moduleUrl('native-skip-history-comparison.mjs'))};`,
      'native-skip-call-diagnostics.mjs': `import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
        export {skipCallDiagnosticProtocol} from ${JSON.stringify(moduleUrl('native-skip-call-diagnostics.mjs'))};
        export async function collectSkipCallDiagnostics(exec,context){
          assert.equal(context.origin,'SYNTHETIC_CALLER_CONTRACT_ONLY');
          assert.equal(context.migration.name,${JSON.stringify(skipPrefilterMigration)},'Caller selected a later forward');
          const sha256=createHash('sha256').update(context.migration.sql).digest('hex');
          assert.equal(sha256,${JSON.stringify(sha256(pinnedSql))},'Caller changed the pinned candidate SQL');
          return {status:'PASS',origin:context.origin,migration:context.migration.name,migrationSha256:sha256};}`,
      'native-skip-call-series.mjs': `export function summarizeSkipCallSeries(runs){return {status:'PASS',admission:'NONE',origin:'SYNTHETIC_CALLER_CONTRACT_ONLY',count:runs.length};}`,
    };
    await Promise.all(Object.entries(stubs).map(([name, source]) => writeFile(join(directory, name), source)));
    const reportPath = join(directory, 'report.json');
    const child = spawnSync(process.execPath, [join(directory, 'run-ci-prediction-performance.mjs'), reportPath,
      '--diagnose-skip-history'], { cwd: directory, encoding: 'utf8', timeout: 30_000 });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(report.status, 'PASS');assert.equal(report.reportedRuns, 6);assert.equal(report.missingRuns, 0);
    assert.deepEqual(report.runs.map(run => run.variant), ['BASELINE', 'CANDIDATE', 'CANDIDATE', 'BASELINE', 'BASELINE', 'CANDIDATE']);
    for (const run of report.runs) {
      const count = run.variant === 'BASELINE' ? 53 : 54;
      assert.deepEqual(run.installed.manifest.files, installation.manifest.files.slice(0, count));
      assert.deepEqual(run.installed.history, installation.history.slice(0, count));
      assert.equal(run.skipCallDiagnostics.migration, skipPrefilterMigration);
      assert.equal(run.skipCallDiagnostics.migrationSha256, sha256(pinnedSql));
      assert.equal(run.skipCallDiagnostics.origin, 'SYNTHETIC_CALLER_CONTRACT_ONLY');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
