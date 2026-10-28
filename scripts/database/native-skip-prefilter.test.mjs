import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyNativeSkipPrefilter } from './native-skip-prefilter.mjs';

test('skip prefilter preserves the populated predecessor, boundary decisions and immutable retries', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(f => f.name.endsWith('_native_skip_acquisition_prefilter.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec('begin;' + file.sql + 'commit;');
    const functions = (await db.query(`select oid::regprocedure::text signature,prosrc,pg_get_functiondef(oid) definition
      from pg_proc where pronamespace='private'::regnamespace and proname in('acquire_native_candidates_v1',
        'resurfacing_policy_decision_v1','resurfacing_before_contextual_skip_v1','contextual_skip_decision_v1')`)).rows;
    for (const f of functions) for (const mutation of [f.definition.replace(f.prosrc, () => f.prosrc + '\n-- drift'),
      `grant execute on function ${f.signature} to service_role;`,
      `alter function ${f.signature} set search_path='public';`,
      `alter function ${f.signature} volatile;`]) {
      await db.exec('begin;' + mutation);
      await assert.rejects(db.exec(files[index].sql), /Skip prefilter source\/security drift/);
      await db.exec('rollback;');
    }
    const exec = async sql => {
      try { return (await db.exec(sql)).flatMap(r => r.rows.map(row => Object.values(row)[0])).filter(v => v !== null); }
      catch (error) { t.diagnostic(JSON.stringify({ message: error.message, code: error.code, where: error.where })); throw error; }
    };
    const report = await verifyNativeSkipPrefilter(exec, files[index]);
    assert.equal(report.status, 'PASS');
    assert.equal(report.acquisitionCases, 126);
    assert.equal(report.exactRetries, 2);
    assert.equal(report.cleanup, 'ALL_CANONICAL_ROWS_RESTORED');
    t.diagnostic(JSON.stringify(report));
  } finally { await db.close(); }
});
