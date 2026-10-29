import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePaths = [
  'packages/prediction-engine/src/personal-rating.ts',
  'packages/prediction-engine/src/rating-location.ts',
  'packages/prediction-engine/src/adapters/kajo-personal-rating.ts',
  'scripts/database/personal-rating-baseline.mjs',
  'scripts/database/personal-rating-baseline-fixture.sql',
];
export async function personalRatingBaselineFixtureSql() {
  return `begin;\n${await readFile(new URL('personal-rating-baseline-fixture.sql', import.meta.url), 'utf8')}\nrollback;`;
}

export async function verifyPersonalRatingBaseline(exec) {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p',
    'packages/prediction-engine/tsconfig.build.json'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', timeout: 120_000,
  });
  assert.equal(build.status, 0, `Personal rating baseline build failed: ${build.stderr || build.stdout}`);
  const [{ normalizeKajoPersonalRatingPrefix }, { forecastPersonalRatingBaseline }] = await Promise.all([
    import('../../packages/prediction-engine/dist/adapters/kajo-personal-rating.js'),
    import('../../packages/prediction-engine/dist/personal-rating.js'),
  ]);
  let fixture;
  try { [fixture] = await exec(await personalRatingBaselineFixtureSql(), {
    stage: 'personal-numeric-baseline-native-prefix-and-rebuild', timeoutMs: 120_000,
  }); } catch (error) { await exec('rollback;', { stage: 'personal-numeric-baseline-cleanup' }).catch(() => {}); throw error; }
  assert.equal(fixture?.version, 'native-personal-rating-baseline-fixture-v1');
  assert.equal(fixture.scope, 'ISOLATED_NATIVE_FIXTURE');
  assert.equal(fixture.frozenInputs, 'CAPTURED_BEFORE_NEXT_ACTION');
  const expected = {
    empty: [0, null], base: [2, 7], zero: [3, 14 / 3], zero_retry: [3, 14 / 3],
    five: [3, 19 / 3], ten: [3, 8], undo_ten: [3, 19 / 3], clear: [2, 7],
    before_withdrawal: [3, 14 / 3], withdrawal: [2, 7], movie: [2, 6],
    excluded: [2, 7], microsecond_exact: [3, 14 / 3], microsecond_later: [4, 6],
    microsecond_repeat: [3, 14 / 3],
  };
  assert.deepEqual(fixture.cases.map(row => row.name), Object.keys(expected));
  const near = (actual, value, message) => {
    if (value === null) assert.equal(actual, null, message);
    else assert.ok(Number.isFinite(actual) && Math.abs(actual - value) <= 1e-12, `${message}: ${actual} != ${value}`);
  };
  const cases = fixture.cases.map(({ name, capture, oracle }) => {
    const [support, mean] = expected[name];
    assert.equal(capture.labels.length, support, `${name}: independently expected resolved native support`);
    assert.equal(oracle.support, support);
    near(oracle.mean, mean, `${name}: frozen native oracle`);
    const config = { version: 'numeric-fixture-config-v1', shrinkage: 2 };
    const input = normalizeKajoPersonalRatingPrefix(capture, { config });
    const fallback = forecastPersonalRatingBaseline(input);
    const prior = { sourceId: 'synthetic-numeric-fixture', sourceVersion: '1', artifactId: 'fixture-domain-prior-v1',
      domainId: capture.itemType, value: 7, availableAtMicros: '0', permission: 'PERMITTED' };
    const forecast = forecastPersonalRatingBaseline({ ...input, prior });
    assert.equal(forecast.prefix.support, support);
    assert.equal(forecast.forecasts.length, 1, `${name}: same-cutoff declared domain pool`);
    near(forecast.forecasts[0].control.value, mean, `${name}: actual native raw-label mean`);
    near(forecast.forecasts[0].candidate.value, oracle.shrunk, `${name}: native oracle versus pure residual candidate`);
    near(fallback.forecasts[0].candidate.value, mean, `${name}: absent-prior Personal fallback`);
    assert.equal(forecast.qualityAdmission, 'NONE');
    assert.equal(forecast.servingActivation, 'NONE');
    assert.deepEqual(forecastPersonalRatingBaseline({ ...input, prior }), forecast, `${name}: exact repeated read`);
    return { name, origin: 'ISOLATED_NATIVE_FIXTURE', capture, oracle, forecast, fallback };
  });
  const byName = Object.fromEntries(cases.map(row => [row.name, row]));
  const values = name => byName[name].forecast.prefix.ratings.map(row => [row.objectId, row.value, row.sourceEventId]);
  assert.deepEqual(values('zero'), values('zero_retry'), 'Exact action retry cannot multiply source support');
  assert.deepEqual(values('five'), values('undo_ten'), 'Backdated Undo restores the original five Event');
  for (const name of ['clear', 'withdrawal', 'excluded']) {
    assert.deepEqual(values(name), values('base'), `${name}: complete canonical rebuild parity`);
  }
  assert.deepEqual(byName.microsecond_exact.forecast, byName.microsecond_repeat.forecast,
    'Later available Event cannot alter exact-cutoff rebuild, source or pool');
  assert.equal(BigInt(byName.microsecond_later.capture.cutoffMicros)
    - BigInt(byName.microsecond_exact.capture.cutoffMicros), 1n);
  assert.equal(byName.base.forecast.forecasts[0].control.value, 7, 'Frozen pre-answer baseline remains seven');
  const sources = await Promise.all(sourcePaths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(new URL(`../../${path}`, import.meta.url))).digest('hex') })));
  return { status: 'PASS', version: 'native-personal-rating-baseline-conformance-v1',
    origin: 'ISOLATED_NATIVE_FIXTURE', cases, sources, caseCount: cases.length,
    rawLabelOwner: 'private.personal_source_evidence_v1 + original ITEM_RATED Event',
    candidatePool: 'DECLARED_CANONICAL_ITEM_SNAPSHOT_NOT_SERVING_POLICY',
    numericOracle: 'FROZEN_BEFORE_NEXT_ACTION_INDEPENDENT_SQL_ARITHMETIC',
    qualityAdmission: 'NONE', servingActivation: 'NONE', cleanup: 'ROLLED_BACK' };
}
