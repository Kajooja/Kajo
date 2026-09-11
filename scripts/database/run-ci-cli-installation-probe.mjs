// Canonical fresh installation and CLI reset/history regression in a new local
// CI workspace. Existing hosted databases and historical source stay untouched.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { withCiSupabaseStack } from './ci-supabase-stack.mjs';
import { applicationSmokeSql, assertEmptyApplication,
  snapshotApplication, sourceApplicationReference } from './baseline-installation.mjs';
import { functionDigestSql } from './platform-default-probe.mjs';
import { buildFreshInstallation, installFreshDatabase, installationHistorySql } from './fresh-installation.mjs';
import { itemActionUpgradeSql } from './item-action-upgrade.mjs';
import { collectionActionUpgradeSql } from './collection-action-upgrade.mjs';
import { historyProjectionUpgradeSql } from './history-projection-upgrade.mjs';
import { sharedListDestinationsUpgradeSql } from './shared-list-destinations-upgrade.mjs';
import { lateOutcomeUpgradeSql } from './late-outcome-upgrade.mjs';
import { frozenReplayUpgradeSql } from './frozen-replay-upgrade.mjs';
import { candidatePoolSmokeSql, candidatePoolUpgradeSql } from './candidate-pool-upgrade.mjs';
import { predictionPageSmokeSql, predictionPageUpgradeSql, predictionWindowSmokeSql } from './prediction-page.mjs';
import { verifyPredictionPageConcurrency } from './prediction-page-concurrency.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
try {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/database/run-ci-cli-installation-probe.mjs <new-report.json>');
  const installation = await buildFreshInstallation();
  const { candidate, files, history: expectedHistory } = installation;
  const expected = await sourceApplicationReference(candidate, files.slice(1));
  const [smoke, defaults, platformSql] = await Promise.all([
    applicationSmokeSql(), readFile(new URL('function-defaults-smoke.sql', import.meta.url), 'utf8'),
    readFile(new URL('platform-schema-snapshot.sql', import.meta.url), 'utf8'),
  ]);
  const historySql = installationHistorySql;
  const nativeSql = `begin read only; set local search_path=pg_catalog;
    ${functionDigestSql({ includeApplication: false })} rollback;`;
  const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_cli_install', async (exec, { resetFromMigrations, applyMigrations, execConcurrent }) => {
    const [platformBefore, functionsBefore] = await exec(platformSql + '\n' + nativeSql);
    const operationalInstall = await installFreshDatabase(exec, applyMigrations, installation);
    const actionIndex = files.findIndex(file => file.name.endsWith('_atomic_item_actions.sql'));
    assert.ok(actionIndex > 0);
    await resetFromMigrations(files.slice(0, actionIndex));
    const [itemActionUpgrade] = await exec(itemActionUpgradeSql(files[actionIndex], candidate.tables));
    assert.match(itemActionUpgrade?.itemActionUpgrade, /^PASS: unchanged populated/);
    const collectionIndex = files.findIndex(file => file.name.endsWith('_atomic_collection_actions.sql'));
    assert.ok(collectionIndex > actionIndex);
    await resetFromMigrations(files.slice(0, collectionIndex));
    const [collectionActionUpgrade] = await exec(collectionActionUpgradeSql(files[collectionIndex], candidate.tables));
    assert.match(collectionActionUpgrade?.collectionActionUpgrade, /^PASS: unchanged populated/);
    const projectionIndex = files.findIndex(file => file.name.endsWith('_bootstrap_history_projection.sql'));
    assert.ok(projectionIndex > collectionIndex);
    await resetFromMigrations(files.slice(0, projectionIndex));
    const projectionFixture = await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8');
    const [historyProjectionUpgrade] = await exec(historyProjectionUpgradeSql(files[projectionIndex], projectionFixture, candidate.tables));
    assert.match(historyProjectionUpgrade?.historyProjectionUpgrade, /^PASS: unchanged populated/);
    const destinationsIndex = files.findIndex(file => file.name.endsWith('_shared_list_destinations.sql'));
    assert.ok(destinationsIndex > projectionIndex);
    await resetFromMigrations(files.slice(0, destinationsIndex));
    const [sharedListDestinationsUpgrade] = await exec(sharedListDestinationsUpgradeSql(files[destinationsIndex], projectionFixture, candidate.tables));
    assert.match(sharedListDestinationsUpgrade?.sharedListDestinationsUpgrade, /^PASS: unchanged populated/);
    const lateIndex = files.findIndex(file => file.name.endsWith('_late_outcome_attribution.sql'));
    assert.ok(lateIndex > destinationsIndex);
    await resetFromMigrations(files.slice(0, lateIndex));
    const [lateOutcomeUpgrade] = await exec(lateOutcomeUpgradeSql(files[lateIndex], projectionFixture, candidate.tables));
    assert.match(lateOutcomeUpgrade?.lateOutcomeUpgrade, /^PASS: unchanged populated/);
    const replayIndex = files.findIndex(file => file.name.endsWith('_frozen_prediction_replay.sql'));
    assert.ok(replayIndex > lateIndex);
    await resetFromMigrations(files.slice(0, replayIndex));
    const [frozenReplayUpgrade] = await exec('set extra_float_digits=0;\n'
      + frozenReplayUpgradeSql(files[replayIndex], projectionFixture, candidate.tables));
    assert.match(frozenReplayUpgrade?.frozenReplayUpgrade, /^PASS: unchanged populated/);
    const poolIndex = files.findIndex(file => file.name.endsWith('_eligibility_first_candidate_pool.sql'));
    assert.ok(poolIndex > replayIndex);
    await resetFromMigrations(files.slice(0, poolIndex));
    const [candidatePoolUpgrade] = await exec(candidatePoolUpgradeSql(files[poolIndex], projectionFixture, candidate.tables));
    assert.match(candidatePoolUpgrade?.candidatePoolUpgrade, /^PASS: unchanged populated/);
    const pageIndex = files.findIndex(file => file.name.endsWith('_identified_prediction_page.sql'));
    assert.ok(pageIndex > poolIndex);
    await resetFromMigrations(files.slice(0, pageIndex));
    const [predictionPageUpgrade] = await exec(predictionPageUpgradeSql(files[pageIndex], projectionFixture));
    assert.match(predictionPageUpgrade?.predictionPageUpgrade, /^PASS: unchanged populated/);
    const firstRuntime = await resetFromMigrations(files);
    const first = await snapshotApplication(exec, candidate, { forward: true });
    assertEmptyApplication(first);
    assert.deepEqual(first, expected, 'CLI installation differs from the source reference');
    assert.deepEqual((await exec(historySql))[0], expectedHistory, 'CLI recorded unexpected migration history');

    const failure = { name: '20991231235959_kajo_cli_atomicity_probe.sql', sql: `
      create table public.kajo_cli_partial_change(id integer);
      do $$ begin raise exception 'KAJO_CLI_ATOMICITY_PROBE'; end $$;` };
    assert.ok(files.every(file => file.name < failure.name));
    await assert.rejects(resetFromMigrations([...files, failure]), /KAJO_CLI_ATOMICITY_PROBE/);
    assert.deepEqual(await snapshotApplication(exec, candidate, { forward: true }), first, 'Failed CLI migration left partial application changes');
    assert.deepEqual((await exec(historySql))[0], expectedHistory, 'Failed CLI migration was recorded as applied');

    const predictionPageConcurrency = await verifyPredictionPageConcurrency(execConcurrent);
    const secondRuntime = await resetFromMigrations(files);
    assert.deepEqual(await snapshotApplication(exec, candidate, { forward: true }), first, 'Repeated CLI installation differs');
    assert.deepEqual((await exec(historySql))[0], expectedHistory);
    const results = await exec(smoke);
    assert.match(results[0]?.smoke, /^PASS: authenticated public V1/);
    const [itemActions] = await exec(await readFile(new URL('item-action-smoke.sql', import.meta.url), 'utf8'));
    assert.match(itemActions?.itemActions, /^PASS: atomic/);
    const [collectionActions] = await exec(await readFile(new URL('collection-action-smoke.sql', import.meta.url), 'utf8'));
    assert.match(collectionActions?.collectionActions, /^PASS: atomic/);
    const [deliveryOrder] = await exec(await readFile(new URL('delivery-order-smoke.sql', import.meta.url), 'utf8'));
    assert.match(deliveryOrder?.deliveryOrder, /^PASS: 14 Item/);
    const [lateOutcomes] = await exec(await readFile(new URL('late-outcome-smoke.sql', import.meta.url), 'utf8'));
    assert.match(lateOutcomes?.lateOutcomes, /^PASS: exact late Shared/);
    const [frozenReplay] = await exec('set extra_float_digits=0;\n'
      + await readFile(new URL('frozen-replay-smoke.sql', import.meta.url), 'utf8'));
    assert.match(frozenReplay?.frozenReplay, /^PASS: 18 Personal\/Shared/);
    const [candidatePool] = await exec(await candidatePoolSmokeSql());
    assert.match(candidatePool?.candidatePool, /^PASS: 36 mode\/domain\/Profile\/limit/);
    const [predictionPage] = await exec(await predictionPageSmokeSql());
    assert.match(predictionPage?.predictionPage, /^PASS: identified/);
    const [predictionWindow] = await exec(await predictionWindowSmokeSql());
    assert.match(predictionWindow?.predictionWindow, /^PASS: bounded frozen/);
    const [historyClear] = await exec(await readFile(new URL('history-clear-smoke.sql', import.meta.url), 'utf8'));
    assert.match(historyClear?.historyClear, /^PASS: atomic correction/);
    const [bootstrapHistory] = await exec(await readFile(new URL('bootstrap-history-smoke.sql', import.meta.url), 'utf8'));
    assert.match(bootstrapHistory?.bootstrapHistory, /^PASS: calibration/);
    const [sharedListDestinations] = await exec(await readFile(new URL('shared-list-destinations-smoke.sql', import.meta.url), 'utf8'));
    assert.match(sharedListDestinations?.sharedListDestinations, /^PASS: exact target consent/);
    const [listMembership] = await exec(await readFile(new URL('list-membership-smoke.sql', import.meta.url), 'utf8'));
    assert.match(listMembership?.listMembership, /^PASS: public delivery/);
    await exec(`begin; ${defaults} rollback;`);
    assert.deepEqual(await snapshotApplication(exec, candidate, { forward: true }), first, 'CLI installation runtime smoke left changes');
    const [platformAfter, functionsAfter] = await exec(platformSql + '\n' + nativeSql);
    assert.deepEqual(functionsAfter, functionsBefore, 'Native function definitions/permissions differ after CLI reset');
    for (const key of ['roles', 'memberships', 'eventTriggers']) {
      assert.deepEqual(platformAfter[key], platformBefore[key], `CLI reset changed native ${key}`);
    }
    assert.deepEqual(platformAfter.schemas.filter(row => row.name !== 'private'), platformBefore.schemas);
    const nativeDefaults = rows => (rows ?? []).filter(row => !(row.creator === 'postgres'
      && (['public', 'private'].includes(row.schema) || (row.schema === '*' && row.kind === 'f'))));
    assert.deepEqual(nativeDefaults(platformAfter.creatorDefaults), nativeDefaults(platformBefore.creatorDefaults));
    return { operationalInstall, itemActions, itemActionUpgrade, collectionActions, collectionActionUpgrade,
      bootstrapHistory, historyProjectionUpgrade, sharedListDestinations, sharedListDestinationsUpgrade,
      lateOutcomes, lateOutcomeUpgrade, frozenReplay, frozenReplayUpgrade,
      candidatePool, candidatePoolUpgrade, predictionPage, predictionPageUpgrade, predictionPageConcurrency, predictionWindow,
      resets: [firstRuntime, secondRuntime], history: expectedHistory,
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
