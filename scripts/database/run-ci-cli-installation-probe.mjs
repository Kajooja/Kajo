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
import { atomicPredictionPagesSmokeSql, predictionContinuationUpgradeSql } from './atomic-prediction-pages.mjs';
import { verifyAtomicPredictionPageConcurrency } from './atomic-prediction-pages-concurrency.mjs';
import { catalogPredictionChainSmokeSql, catalogPredictionChainUpgradeSql,
  catalogPredictionChainUpgradeFixtureSql, verifyCatalogPredictionChainConcurrency } from './catalog-prediction-chain.mjs';
import { predictionChainProvenanceSmokeSql } from './prediction-chain-provenance.mjs';
import { sharedRatingRoundsSmokeSql, sharedRatingRoundsUpgradeSql } from './shared-rating-rounds.mjs';
import { verifySharedRatingRoundsConcurrency } from './shared-rating-rounds-concurrency.mjs';
import { sharedRoundOutcomesSmokeSql, sharedRoundOutcomesUpgradeSql } from './shared-round-outcomes.mjs';
import { verifySharedRoundOutcomesVisibility } from './shared-round-outcomes-visibility.mjs';
import { sharedRoundOutcomeCapturesSmokeSql, sharedRoundOutcomeCapturesUpgradeSql } from './shared-round-outcome-captures.mjs';
import { verifySharedRoundOutcomeCapturesConcurrency } from './shared-round-outcome-captures-concurrency.mjs';
import { shadowSourceErasureSmokeSql, shadowSourceErasureUpgradeSql } from './shadow-source-erasure.mjs';
import { verifyShadowSourceErasureConcurrency } from './shadow-source-erasure-concurrency.mjs';
import { sharedRoundPredictionInputsSmokeSql, sharedRoundPredictionInputsUpgradeSql } from './shared-round-prediction-inputs.mjs';
import { verifySharedRoundPredictionInputsConcurrency } from './shared-round-prediction-inputs-concurrency.mjs';
import { personalNativeDecaySmokeSql, personalNativeDecayUpgradeSql } from './personal-native-decay.mjs';
import { personalWorkingBridgeSmokeSql, personalWorkingBridgeUpgradeSql } from './personal-working-bridge.mjs';
import { personalWorkingResetSmokeSql, personalWorkingResetUpgradeSql } from './personal-working-reset.mjs';
import { verifyPersonalWorkingResetConcurrency } from './personal-working-reset-concurrency.mjs';
import { predictionHostedUpgradeSql } from './prediction-hosted-upgrade.mjs';
import { catalogDescriptionSmokeSql, catalogDescriptionUpgradeSql, catalogDescriptionConcurrency } from './catalog-descriptions.mjs';
import { ATTRIBUTION_MODE, catalogAttributionFixtureSql, catalogAttributionSmokeSql, catalogAttributionUpgradeSql } from './catalog-attribution.mjs';

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
  const { result, ...runtime } = await withCiSupabaseStack('kajo_ci_cli_install', async (exec, { resetFromMigrations, applyMigrations, execConcurrentSql, catalogRpc }) => {
    const [platformBefore, functionsBefore] = await exec(platformSql + '\n' + nativeSql);
    const operationalInstall = await installFreshDatabase(exec, applyMigrations, installation);
    // The server must cancel before Docker's deadline, aborting this entire
    // transaction. A separate acknowledgement proves no partial DDL survived.
    await assert.rejects(exec(`begin;
      create table public.kajo_ci_sql_deadline_probe(id integer primary key);
      insert into public.kajo_ci_sql_deadline_probe values(1);
      do $$ begin perform pg_sleep(10); end $$;
      commit;`, { stage: 'sql-deadline-canary', timeoutMs: 10_000 }),
    /canceling statement due to statement timeout/);
    const [deadlineRollback] = await exec(`select jsonb_build_object('absent',
      to_regclass('public.kajo_ci_sql_deadline_probe') is null);`, { stage: 'sql-deadline-rollback' });
    assert.equal(deadlineRollback.absent, true, 'Timed-out server statement left partial DDL');
    const sqlStatementDeadline = { status: 'PASS', serverTimeoutMs: 5000, dockerTimeoutMs: 10_000,
      rollback: 'owned test table absent after server statement cancellation' };
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
    const [hostedPredictionUpgrade, hostedPredictionRuntime] = await exec(await predictionHostedUpgradeSql(files.slice(lateIndex, lateIndex + 6)));
    assert.match(hostedPredictionUpgrade?.hostedPredictionUpgrade, /^PASS: reviewed compact/);
    assert.match(hostedPredictionRuntime?.atomicPages, /^PASS: 12 Personal/);
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
    const windowIndex = files.findIndex(file => file.name.endsWith('_prediction_continuation_windows.sql'));
    const atomicPageIndex = files.findIndex(file => file.name.endsWith('_atomic_prediction_pages.sql'));
    assert.equal(atomicPageIndex, windowIndex + 1);
    await resetFromMigrations(files.slice(0, windowIndex));
    const [continuationUpgrade] = await exec(predictionContinuationUpgradeSql(files[windowIndex], files[atomicPageIndex], projectionFixture));
    assert.match(continuationUpgrade?.continuationUpgrade, /^PASS: populated pre-window/);
    const descriptionIndex = files.findIndex(file => file.name.endsWith('_book_description_refresh.sql'));
    assert.ok(descriptionIndex > collectionIndex);
    await resetFromMigrations(files.slice(0, descriptionIndex));
    const oldDescriptionMode = await catalogRpc({ entries: [], refresh_mode: 'open-library-description-v1' });
    assert.equal(oldDescriptionMode.status, 404, 'Older PostgREST must reject the top-level refresh mode');
    assert.equal(oldDescriptionMode.body.code, 'PGRST202');
    const [catalogDescriptionUpgrade] = await exec(catalogDescriptionUpgradeSql(files[descriptionIndex]));
    assert.match(catalogDescriptionUpgrade?.catalogDescriptionUpgrade, /^PASS: unchanged populated/);
    const attributionIndex = files.findIndex(file => file.name.endsWith('_description_attribution.sql'));
    assert.ok(attributionIndex > descriptionIndex);
    await resetFromMigrations(files.slice(0, attributionIndex));
    const unsupportedAttribution = await catalogRpc({ entries: [], refresh_mode: ATTRIBUTION_MODE });
    assert.equal(unsupportedAttribution.status, 400, 'The v1-only writer must reject the v2 mode');
    assert.equal(unsupportedAttribution.body.code, '22023');
    const [catalogAttributionUpgrade] = await exec(catalogAttributionUpgradeSql(files[attributionIndex]));
    assert.match(catalogAttributionUpgrade?.catalogAttributionUpgrade, /^PASS: unchanged populated/);
    const chainIndex = files.findIndex(file => file.name.endsWith('_catalog_prediction_chain.sql'));
    assert.ok(chainIndex > atomicPageIndex);
    await resetFromMigrations(files.slice(0, chainIndex));
    const chainFixture = await catalogPredictionChainUpgradeFixtureSql();
    const [catalogChainUpgrade] = await exec(catalogPredictionChainUpgradeSql(files[chainIndex], chainFixture),
      { stage: 'catalog-chain-populated-upgrade', timeoutMs: 300_000 });
    assert.match(catalogChainUpgrade?.catalogChainUpgrade, /^PASS: populated v1\/v2/);
    const roundsIndex = files.findIndex(file => file.name.endsWith('_shared_rating_round_evidence.sql'));
    assert.ok(roundsIndex > chainIndex);
    await resetFromMigrations(files.slice(0, roundsIndex));
    const [sharedRatingRoundsUpgrade] = await exec(await sharedRatingRoundsUpgradeSql(files[roundsIndex]),
      { stage: 'shared-rating-rounds-populated-upgrade', timeoutMs: 120_000 });
    assert.match(sharedRatingRoundsUpgrade?.sharedRatingRoundsUpgrade, /^PASS: every populated old row/);
    const outcomesIndex = files.findIndex(file => file.name.endsWith('_shared_round_outcomes.sql'));
    assert.ok(outcomesIndex > roundsIndex);
    await resetFromMigrations(files.slice(0, outcomesIndex));
    const [sharedRoundOutcomesUpgrade] = await exec(await sharedRoundOutcomesUpgradeSql(files[outcomesIndex]),
      { stage: 'shared-round-outcomes-populated-upgrade', timeoutMs: 120_000 });
    assert.match(sharedRoundOutcomesUpgrade?.sharedRoundOutcomesUpgrade, /^PASS: every existing row/);
    const capturesIndex = files.findIndex(file => file.name.endsWith('_shared_round_outcome_captures.sql'));
    assert.ok(capturesIndex > outcomesIndex);
    await resetFromMigrations(files.slice(0, capturesIndex));
    const [sharedRoundOutcomeCapturesUpgrade] = await exec(await sharedRoundOutcomeCapturesUpgradeSql(files[capturesIndex]),
      { stage: 'shared-round-outcome-captures-populated-upgrade', timeoutMs: 120_000 });
    assert.match(sharedRoundOutcomeCapturesUpgrade?.sharedRoundOutcomeCapturesUpgrade, /^PASS: every populated row/);
    const erasureIndex = files.findIndex(file => file.name.endsWith('_shadow_source_erasure.sql'));
    assert.ok(erasureIndex > capturesIndex);
    await resetFromMigrations(files.slice(0, erasureIndex));
    const [shadowSourceErasureUpgrade] = await exec(await shadowSourceErasureUpgradeSql(files[erasureIndex]),
      { stage: 'shadow-source-erasure-populated-upgrade', timeoutMs: 120_000 });
    assert.match(shadowSourceErasureUpgrade?.shadowSourceErasureUpgrade, /^PASS: every populated/);
    const predictionInputsIndex = files.findIndex(file => file.name.endsWith('_shared_round_prediction_inputs.sql'));
    assert.ok(predictionInputsIndex > erasureIndex);
    await resetFromMigrations(files.slice(0, predictionInputsIndex));
    const [sharedRoundPredictionInputsUpgrade] = await exec(await sharedRoundPredictionInputsUpgradeSql(files[predictionInputsIndex]),
      { stage: 'shared-round-prediction-inputs-populated-upgrade', timeoutMs: 120_000 });
    assert.match(sharedRoundPredictionInputsUpgrade?.sharedRoundPredictionInputsUpgrade, /^PASS:/);
    const nativeDecayIndex = files.findIndex(file => file.name.endsWith('_personal_native_decay_parity.sql'));
    assert.ok(nativeDecayIndex > predictionInputsIndex);
    await resetFromMigrations(files.slice(0,nativeDecayIndex));
    const [personalNativeDecayUpgrade] = await exec(await personalNativeDecayUpgradeSql(files[nativeDecayIndex]),
      { stage: 'personal-native-decay-populated-upgrade', timeoutMs: 120_000 });
    assert.match(personalNativeDecayUpgrade?.personalNativeDecayUpgrade, /^PASS: actual old memory/);
    const workingBridgeIndex = files.findIndex(file => file.name.endsWith('_personal_working_bridge.sql'));
    assert.ok(workingBridgeIndex > nativeDecayIndex);
    await resetFromMigrations(files.slice(0,workingBridgeIndex));
    const [personalWorkingBridgeUpgrade] = await exec(await personalWorkingBridgeUpgradeSql(files[workingBridgeIndex]),
      { stage: 'personal-working-populated-upgrade', timeoutMs: 120_000 });
    assert.match(personalWorkingBridgeUpgrade?.personalWorkingBridgeUpgrade, /^PASS: every populated old/);
    const workingResetIndex = files.findIndex(file => file.name.endsWith('_personal_working_reset.sql'));
    assert.ok(workingResetIndex > workingBridgeIndex);
    await resetFromMigrations(files.slice(0,workingResetIndex));
    const [personalWorkingResetUpgrade] = await exec(await personalWorkingResetUpgradeSql(files[workingResetIndex]),
      { stage: 'personal-working-reset-populated-upgrade', timeoutMs: 120_000 });
    assert.match(personalWorkingResetUpgrade?.personalWorkingResetUpgrade, /^PASS: every populated old/);
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

    const predictionPageConcurrency = await verifyPredictionPageConcurrency(execConcurrentSql);
    const atomicPageConcurrency = await verifyAtomicPredictionPageConcurrency(execConcurrentSql);
    const catalogChainConcurrency = await verifyCatalogPredictionChainConcurrency(execConcurrentSql);
    const sharedRatingRoundsConcurrency = await verifySharedRatingRoundsConcurrency(execConcurrentSql);
    const sharedRoundOutcomesVisibility = await verifySharedRoundOutcomesVisibility(execConcurrentSql);
    const sharedRoundOutcomeCapturesConcurrency = await verifySharedRoundOutcomeCapturesConcurrency(execConcurrentSql);
    const shadowSourceErasureConcurrency = await verifyShadowSourceErasureConcurrency(execConcurrentSql);
    const sharedRoundPredictionInputsConcurrency = await verifySharedRoundPredictionInputsConcurrency(execConcurrentSql);
    const personalWorkingResetConcurrency = await verifyPersonalWorkingResetConcurrency(execConcurrentSql);
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
    const [atomicPages] = await exec(await atomicPredictionPagesSmokeSql());
    assert.match(atomicPages?.atomicPages, /^PASS: 12 Personal/);
    const [atomicPageBoundaries] = await exec(await atomicPredictionPagesSmokeSql('atomic-prediction-pages-boundaries.sql'));
    assert.match(atomicPageBoundaries?.atomicPages, /^PASS: current eligibility/);
    const [catalogChain] = await exec(await catalogPredictionChainSmokeSql(),
      { stage: 'catalog-chain-profile-domain-mode-matrix', timeoutMs: 300_000 });
    assert.match(catalogChain?.catalogChain, /^PASS: 12 Personal\/Shared/);
    const [catalogChainBoundaries] = await exec(await catalogPredictionChainSmokeSql('catalog-prediction-chain-boundaries.sql'),
      { stage: 'catalog-chain-prefix-expiry-reader-limit', timeoutMs: 600_000 });
    assert.match(catalogChainBoundaries?.catalogChain, /^PASS: current suppression/);
    const [catalogChainProvenance] = await exec(await predictionChainProvenanceSmokeSql(),
      { stage: 'catalog-chain-later-page-outcome-provenance', timeoutMs: 120_000 });
    assert.match(catalogChainProvenance?.catalogChainProvenance, /^PASS:/);
    const [sharedRatingRounds] = await exec(await sharedRatingRoundsSmokeSql(),
      { stage: 'shared-rating-rounds-command-evidence-matrix', timeoutMs: 120_000 });
    assert.match(sharedRatingRounds?.sharedRatingRounds, /^PASS:/);
    const [sharedRoundOutcomes] = await exec(await sharedRoundOutcomesSmokeSql(),
      { stage: 'shared-round-outcomes-cutoff-maturity-attribution', timeoutMs: 120_000 });
    assert.match(sharedRoundOutcomes?.sharedRoundOutcomes, /^PASS:/);
    const [sharedRoundOutcomeCaptures] = await exec(await sharedRoundOutcomeCapturesSmokeSql(),
      { stage: 'shared-round-outcome-captures-replay-support-privacy', timeoutMs: 120_000 });
    assert.match(sharedRoundOutcomeCaptures?.sharedRoundOutcomeCaptures, /^PASS:/);
    const [shadowSourceErasure] = await exec(await shadowSourceErasureSmokeSql(),
      { stage: 'shadow-source-erasure-lineage-permissions-rollback', timeoutMs: 120_000 });
    assert.match(shadowSourceErasure?.shadowSourceErasure, /^PASS:/);
    const [sharedRoundPredictionInputs] = await exec(await sharedRoundPredictionInputsSmokeSql(),
      { stage: 'shared-round-prediction-inputs-enrollment-prefix-sources-erasure', timeoutMs: 120_000 });
    assert.match(sharedRoundPredictionInputs?.sharedRoundPredictionInputs, /^PASS:/);
    const [personalNativeDecay] = await exec(await personalNativeDecaySmokeSql(),
      { stage: 'personal-native-decay-state-score-frozen-parity', timeoutMs: 120_000 });
    assert.match(personalNativeDecay?.personalNativeDecay, /^PASS: shared native LT math/);
    const [personalWorkingBridge] = await exec(await personalWorkingBridgeSmokeSql(),
      { stage: 'personal-working-native-capture-frozen-consumer-parity', timeoutMs: 120_000 });
    assert.match(personalWorkingBridge?.personalWorkingBridge, /^PASS: actual canonical native Personal capture/);
    const [personalWorkingReset] = await exec(await personalWorkingResetSmokeSql(),
      { stage: 'personal-working-reset-frozen-lifecycle-consumer', timeoutMs: 120_000 });
    assert.match(personalWorkingReset?.personalWorkingReset, /^PASS:/);
    const [historyClear] = await exec(await readFile(new URL('history-clear-smoke.sql', import.meta.url), 'utf8'));
    assert.match(historyClear?.historyClear, /^PASS: atomic correction/);
    const [bootstrapHistory] = await exec(await readFile(new URL('bootstrap-history-smoke.sql', import.meta.url), 'utf8'));
    assert.match(bootstrapHistory?.bootstrapHistory, /^PASS: calibration/);
    const [sharedListDestinations] = await exec(await readFile(new URL('shared-list-destinations-smoke.sql', import.meta.url), 'utf8'));
    assert.match(sharedListDestinations?.sharedListDestinations, /^PASS: exact target consent/);
    const [listMembership] = await exec(await readFile(new URL('list-membership-smoke.sql', import.meta.url), 'utf8'));
    assert.match(listMembership?.listMembership, /^PASS: public delivery/);
    const [catalogDescriptions] = await exec(await catalogDescriptionSmokeSql());
    assert.match(catalogDescriptions?.catalogDescriptions, /^PASS: guarded/);
    const catalogDescriptionLocks = await catalogDescriptionConcurrency(exec, execConcurrentSql, catalogRpc);
    const [catalogAttribution] = await exec(await catalogAttributionSmokeSql());
    assert.match(catalogAttribution?.catalogAttribution, /^PASS: v1 upgrade/);
    const catalogAttributionLocks = await catalogDescriptionConcurrency(exec, execConcurrentSql, catalogRpc,
      { mode: ATTRIBUTION_MODE, fixtureSql: catalogAttributionFixtureSql() });
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
    return { operationalInstall, sqlStatementDeadline, itemActions, itemActionUpgrade, collectionActions, collectionActionUpgrade,
      bootstrapHistory, historyProjectionUpgrade, sharedListDestinations, sharedListDestinationsUpgrade,
      lateOutcomes, lateOutcomeUpgrade, hostedPredictionUpgrade, hostedPredictionRuntime, frozenReplay, frozenReplayUpgrade,
      candidatePool, candidatePoolUpgrade, predictionPage, predictionPageUpgrade, predictionPageConcurrency, predictionWindow,
      atomicPages, atomicPageBoundaries, atomicPageConcurrency, continuationUpgrade,
      catalogChain, catalogChainBoundaries, catalogChainUpgrade, catalogChainConcurrency,
      catalogChainProvenance,
      sharedRatingRounds, sharedRatingRoundsUpgrade, sharedRatingRoundsConcurrency,
      sharedRoundOutcomes, sharedRoundOutcomesUpgrade, sharedRoundOutcomesVisibility,
      sharedRoundOutcomeCaptures, sharedRoundOutcomeCapturesUpgrade, sharedRoundOutcomeCapturesConcurrency,
      shadowSourceErasure, shadowSourceErasureUpgrade, shadowSourceErasureConcurrency,
      sharedRoundPredictionInputs, sharedRoundPredictionInputsUpgrade, sharedRoundPredictionInputsConcurrency,
      personalNativeDecay, personalNativeDecayUpgrade, personalWorkingBridge, personalWorkingBridgeUpgrade,
      personalWorkingReset, personalWorkingResetUpgrade, personalWorkingResetConcurrency,
      catalogDescriptions, catalogDescriptionUpgrade, catalogDescriptionLocks,
      catalogAttribution, catalogAttributionUpgrade, catalogAttributionLocks,
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
