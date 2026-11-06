// Disposable SQL rehearsal only. The caller owns and identifies
// the isolated runtime. This module never connects to a hosted database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { withPersonalRatingProspectiveFixture }
  from './personal-rating-prospective.mjs';
import {
  personalRatingHostedManifest, loadPersonalRatingHostedSources, loadPersonalRatingHostedLineage,
  personalRatingHostedMetadataSql, personalRatingHostedRowsSql,
  personalRatingHostedPreflightSql, personalRatingHostedGuardedMigrationSql,
  personalRatingHostedPostflightAssertionSql,
} from './personal-rating-hosted-upgrade.mjs';

const quote = value => "'" + value.replaceAll("'", "''") + "'";
const hash = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
const acquisition = 'private.acquire_native_candidates_v1(jsonb)';
const resolver = 'private.personal_source_evidence_v1(uuid,timestamp with time zone)';
const QUERY_MS = 45_000, REHEARSAL_MS = 120_000;

/** Run after the existing first-53 CLI reset and before optional54's verifier.
 * Every forward/history write rolls back. No capture worker is nested inside
 * this transaction: those workers require their own committed transactions. */
export async function verifyPersonalRatingHostedUpgrade(execSql, {
  expectedProjectRef = 'aaaaaaaaaaaaaaaaaaaa', runtimeScope = 'DISPOSABLE_SQL_ONLY',
} = {}) {
  assert.equal(typeof execSql, 'function', 'Disposable SQL executor required');
  assert.ok(['DISPOSABLE_SQL_ONLY', 'DISPOSABLE_PGLITE_ONLY', 'OWNED_PINNED_NATIVE_CI'].includes(runtimeScope),
    'Explicit disposable runtime scope required');
  const started = performance.now();
  let cleanupPhase = false, original, failure, result;
  const exec = async (sql, options = {}) => {
    const stage = options.stage ?? 'numeric-hosted-sql';
    assert.match(stage, /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/);
    const cleanup = cleanupPhase || stage.endsWith('fixture-cleanup') || stage.endsWith('canonical-snapshot')
      || stage.endsWith('rollback');
    const remaining = Math.floor(REHEARSAL_MS - (performance.now() - started));
    // Generated SQL caps statements at30s. Never shorten the45s outer deadline
    // below that server cap as the overall execution budget runs out. Refuse
    // new work instead; cleanup and its canonical snapshots retain their full
    // independent deadline, including failure before fixture setup completes.
    assert.ok(cleanup || remaining >= QUERY_MS, 'Numeric hosted rehearsal lacks a full query deadline within its execution budget');
    return execSql(sql, { stage, timeoutMs: QUERY_MS });
  };
  const checkpoint = async phase => {
    const [metadata] = await exec(personalRatingHostedMetadataSql, { stage: `numeric-hosted-${phase}-metadata` });
    const [rows] = await exec(personalRatingHostedRowsSql(metadata), { stage: `numeric-hosted-${phase}-rows` });
    return { target: { projectRef: expectedProjectRef, postgresMajor: 17 }, metadata, rows };
  };
  try {
    const files = await loadPersonalRatingHostedLineage();
    assert.equal(files.length, 56, 'Exact reviewed canonical lineage required');
    assert.equal(files[53].name, personalRatingHostedManifest.omitted);
    const sources = await loadPersonalRatingHostedSources();
    assert.deepEqual(files.slice(54).map(file => file.name), sources.map(file => file.name));
    original = await checkpoint('original');
    assert.deepEqual(original.metadata.history.map(({ version, name }) => ({ version, name })),
      files.slice(0, 53).map(file => ({ version: file.name.slice(0, 14), name: file.name.slice(15, -4) })),
      'Native rehearsal requires the existing canonical first-53 reset');
    const [ready] = await exec(await personalRatingHostedPreflightSql(original, expectedProjectRef),
      { stage: 'numeric-hosted-original-preflight' });
    assert.match(ready, /^PASS:/);
    result = await withPersonalRatingProspectiveFixture(exec, null, async ({ f }) => {
      try {
        const before = await checkpoint('populated');
        assert.ok(before.rows['public.events'].count >= 2 && before.rows['private.prediction_page_receipts'].count >= 3,
          'Committed predecessor observations and page receipts required');
        const wrapper = await personalRatingHostedGuardedMigrationSql(before, expectedProjectRef);
        for (const source of sources) assert.equal(wrapper.split(source.sql).length, 2, 'Exact source must occur once');
        assert.ok(wrapper.indexOf(sources[0].sql) < wrapper.indexOf(sources[1].sql));
        assert.ok(!wrapper.includes(personalRatingHostedManifest.omitted));
        const faults = [];
        const rejectAndRestore = async (name, sql, expected) => {
          try { await assert.rejects(exec(sql, { stage: 'numeric-hosted-' + name }), expected); }
          finally { await exec('rollback;', { stage: 'numeric-hosted-' + name + '-rollback' }); }
          assert.deepEqual(await checkpoint(name + '-restored'), before, 'Failed rehearsal changed its complete checkpoint');
          faults.push({ name, status: 'REJECTED', restoration: 'EXACT_CHECKPOINT' });
        };
        await rejectAndRestore('old-row-drift', `begin;
          update public.items set title=title||' injected drift' where id=${quote(f.items[0])};
          ${wrapper}rollback;`, /Numeric retained rows changed/);
        const interruptionPoint = 'create function private.guard_personal_rating_content_artifact_v1()';
        assert.equal(sources[1].sql.split(interruptionPoint).length, 2);
        const interrupted = sources[1].sql.replace(interruptionPoint, () => 'select 1/0;\n' + interruptionPoint);
        await rejectAndRestore('second-forward-failure',
          'begin;' + wrapper.replace(sources[1].sql, () => interrupted) + 'rollback;', /division by zero/);
        const marker = '/* numeric-forward:postcheck */';
        assert.equal(wrapper.split(marker).length, 2);
        await rejectAndRestore('new-column-grant', 'begin;' + wrapper.replace(marker,
          () => 'grant select (id) on private.personal_rating_inputs to service_role;\n' + marker) + 'rollback;',
        /Numeric post-install metadata\/security drift/);

        // This is an intentionally simulated receipt in the owned disposable
        // transaction, not proof of a provider API's transaction implementation.
        const receipt = { version: (BigInt(before.metadata.history.at(-1).version) + 1n).toString(),
          name: personalRatingHostedManifest.providerName, statementMd5: hash(wrapper, 'md5') };
        const receiptSql = `insert into supabase_migrations.schema_migrations(version,name,statements)
          values(${quote(receipt.version)},${quote(receipt.name)},array[${quote(wrapper)}]);`;
        const postcheck = await personalRatingHostedPostflightAssertionSql(before, expectedProjectRef, receipt);
        const installedSummary = `select jsonb_build_object('status','PASS','phase','GUARDED_FORWARD_AND_RECEIPT',
          'historyCount',(select count(*) from supabase_migrations.schema_migrations),
          'acquisitionMd5',(select md5(prosrc) from pg_proc where oid=${quote(acquisition)}::regprocedure),
          'sourceEvidenceMd5',(select md5(prosrc) from pg_proc where oid=${quote(resolver)}::regprocedure));`;
        let observed;
        try {
          observed = await exec(`begin;${wrapper}${receiptSql}${postcheck}${installedSummary}rollback;`,
            { stage: 'numeric-hosted-exact-forward-and-receipt' });
        } finally { await exec('rollback;', { stage: 'numeric-hosted-success-rollback' }); }
        const installed = observed.find(value => value?.phase === 'GUARDED_FORWARD_AND_RECEIPT');
        assert.equal(installed?.status, 'PASS');assert.equal(installed.historyCount, before.metadata.history.length + 1);
        assert.equal(installed.acquisitionMd5, '6e0aba591a90c194c5bae49f0361084f');
        assert.equal(installed.sourceEvidenceMd5, 'fc23518ea578c1db99498c958178aaf5');
        assert.deepEqual(await checkpoint('success-restored'), before, 'Successful rollback changed its complete checkpoint');
        return { version: 'personal-rating-private-native-rehearsal-v1', status: 'PASS', runtimeScope,
          baseline: 'CANONICAL_FIRST_53', optional54: 'NOT_INSTALLED',
          sources: personalRatingHostedManifest.sources, wrapperSha256: hash(wrapper),
          predecessorCheckpointSha256: hash(JSON.stringify(before)),
          preservedTables: Object.keys(before.rows).length,
          preservedFunctions: Object.keys(before.metadata.functions).length,
          preservedHistoryReceipts: before.metadata.history.length,
          newTables: 8, newFunctions: 20, newTriggers: 18, faults,
          providerReceipt: 'SIMULATED_SINGLE_TRANSACTION', providerReceiptStatementMd5: receipt.statementMd5,
          oldRows: 'UNCHANGED', oldMetadata: 'UNCHANGED', rollback: 'EXACT_CHECKPOINT',
          acquisitionMd5: installed.acquisitionMd5, sourceEvidenceMd5: installed.sourceEvidenceMd5,
          hostedDeployment: 'NONE', qualityAdmission: 'NONE', servingActivation: 'NONE' };
      } finally { cleanupPhase = true; }
    });
  } catch (error) { failure = error; }
  finally {
    cleanupPhase = true;
    if (original) {
      try {
        await exec('rollback;', { stage: 'numeric-hosted-final-rollback' });
        assert.deepEqual(await checkpoint('final'), original, 'Numeric hosted rehearsal did not restore canonical metadata/history/rows');
      } catch (error) {
        failure = failure ? new AggregateError([failure, error], 'Numeric hosted rehearsal and cleanup both failed') : error;
      }
    }
  }
  if (failure) { delete failure.query;throw failure; }
  return { ...result, cleanup: 'EXACT_CANONICAL_CHECKPOINT', elapsedMs: Math.round(performance.now() - started),
    perCallDeadlineMs: QUERY_MS, executionBudgetMs: REHEARSAL_MS, additionalResets: 0 };
}
