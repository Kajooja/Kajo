import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { nativePredictionAdapterFixtureSql, verifyNativePredictionAdapter, verifyNativeTasteConsumer,
  verifyNativeDiscoveryParity } from './native-prediction-adapter.mjs';

test('actual native sources and independent frozen replay cross the Kajo adapter and generic conformance boundary', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    // PGlite's wall clock normally has millisecond precision. Exercise native
    // microseconds and Supabase's rounded caller default explicitly instead.
    const { evidence, request } = (await db.query(`select
      (date_trunc('second',clock_timestamp()+interval '1 second')+interval '0.123456 second')::text evidence,
      (date_trunc('second',clock_timestamp()+interval '1 second')+interval '0.123578 second')::text request`)).rows[0];
    await db.exec(`create or replace function pg_catalog.now() returns timestamptz language sql stable
      as $$select '${evidence}'::timestamptz$$;
      create or replace function pg_catalog.clock_timestamp() returns timestamptz language sql volatile
      as $$select '${request}'::timestamptz$$;
      set extra_float_digits=0;`);
    const tables = (await db.query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') order by 1`)).rows;
    const snapshot = async () => Promise.all(tables.map(async ({ name }) => [name,
      (await db.query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)).rows]));
    const before = await snapshot();
    const report = await verifyNativePredictionAdapter(async sql => (await db.exec(sql))
      .flatMap(result => result.rows.map(row => row.snapshot)));
    assert.equal(report.status, 'PASS');
    assert.equal(report.cases.length, 6);
    assert.ok(report.comparedCandidates > 50);
    assert.ok(report.scenarioCandidates > 0);
    assert.ok(report.maxAbsoluteScoreDifference <= report.absoluteTolerance);
    assert.equal(report.absoluteTolerance, 1e-12);
    assert.equal(report.predictiveQuality, 'NOT_EVALUATED');
    assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits, '0');
    // Producing the same microsecond capture under rounded serialization loses
    // Working.asOf precision. Never admit or silently repair that old record.
    const lowPrecisionSql = (await nativePredictionAdapterFixtureSql()).replace(
      'set local extra_float_digits=3;', 'set local extra_float_digits=0;');
    await assert.rejects(verifyNativePredictionAdapter(async () => (await db.exec(lowPrecisionSql))
      .flatMap(result => result.rows.map(row => row.snapshot))), /incompatible-snapshots/);
    assert.deepEqual(await snapshot(), before, 'Native/portable conformance must leave every canonical table unchanged');
    t.diagnostic(JSON.stringify(report));
  } finally { await db.close(); }
});

test('actual committed V4 Taste commands reach native input conformance and preserve numeric-prefix isolation', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const report = await verifyNativeTasteConsumer(async sql => {
      try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;'); throw error; }
    });
    assert.equal(report.status, 'PASS');
    assert.equal(report.captures, 7);
    assert.equal(report.version, 'native-taste-consumer-conformance-v2');
    assert.equal(report.independentReceiptAlignedEvaluations, 7);
    assert.equal(report.independentSameInputEvaluations,
      report.independentReceiptComparisons.filter(x => x.fullInputConforms).length);
    assert.equal(report.independentReceiptComparisons.length, 7);
    for (const comparison of report.independentReceiptComparisons) {
      assert.equal(comparison.boundary, comparison.fullInputConforms
        ? 'EXACT_INPUT' : 'SCORING_INPUTS_MATCH_RECEIPT_WITNESSES_DIFFER');
      assert.equal(comparison.mismatches.length, comparison.fullInputConforms ? 0 : 2);
    }
    assert.match(report.receiptWitnessControls, /SYNTHETIC_COPY_ONLY/u);
    assert.deepEqual(report.committedRatings, [0, 5, 10]);
    assert.ok(report.sensitivity.taste.numericallySensitiveCandidates > 0);
    assert.ok(report.sensitivity.discovery.numericallySensitiveCandidates > 0);
    assert.equal(report.preservedSources, 21);
    assert.equal(report.otherProfileIsolation, 'RETAINED_AND_FRESH_FORECAST');
    assert.equal(report.nonComparableConsumers.length, 7);
    assert.equal(report.acquisitionOwner, 'native-candidate-acquisition-v1');
    assert.equal(report.remainingDependency, 'GUIDED_RECOGNITION_AND_DELIVERY_SELECTION_POLICY_ALIGNMENT');
    assert.equal(report.cleanup, 'CANONICAL_ROWS_RESTORED');
    t.diagnostic(JSON.stringify(report));
  } finally { await db.close(); }
});

test('all supported Discovery scope, mode, domain and acquisition inputs match frozen native shadow replay', async t => {
  const db = new PGlite();
  let failure;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const tables = (await db.query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') order by 1`)).rows;
    const snapshot = async connection => Promise.all(tables.map(async ({ name }) => [name,
      (await connection.query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)).rows]));
    const before = await snapshot(db), installed = await db.dumpDataDir();
    await db.close();
    const report = await verifyNativeDiscoveryParity(async sql => {
      // Match the native runner's distinct psql connections. Reusing one WASM
      // session for these rollback fixtures reproducibly fails on its third
      // batch; the same batch passes from this identical installed snapshot.
      const connection = new PGlite({ loadDataDir: installed });
      let batchFailure;
      try {
        const result = (await connection.exec(sql)).flatMap(result => result.rows.map(row => row.snapshot));
        assert.deepEqual(await snapshot(connection), before, 'Every batch must restore every canonical row');
        return result;
      } catch (error) { batchFailure = error; throw error; }
      finally {
        try { await connection.close(); }
        catch (error) { throw new AggregateError(batchFailure ? [batchFailure, error] : [error], 'Discovery batch and cleanup failures'); }
      }
    });
    assert.equal(report.status, 'PASS');
    assert.equal(report.cases.length, 54);
    assert.equal(report.publicRpcCases, 24);
    assert.ok(report.comparedCandidates >= 270);
    assert.equal(report.absoluteTolerance, 1e-12);
    assert.ok(report.maxAbsoluteScoreDifference <= report.absoluteTolerance);
    assert.equal(report.predictiveQuality, 'NOT_EVALUATED');
    assert.equal(report.cleanup, 'ROLLED_BACK');
    t.diagnostic(JSON.stringify(report));
  } catch (error) { failure = error; throw error; }
  finally {
    try { if (!db.closed) await db.close(); }
    catch (error) { throw new AggregateError(failure ? [failure, error] : [error], 'Discovery parity and cleanup failures'); }
  }
});
