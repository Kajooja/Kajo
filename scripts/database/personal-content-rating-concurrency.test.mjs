import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { runIsolatedSqlProbe } from './ci-supabase-stack.mjs';
import { withIsolatedSqlSession } from './isolated-sql-session.mjs';
import { executePersonalContentRatingProbe, withPersonalContentRatingDeletionItems } from './personal-content-rating-concurrency.mjs';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { withPersonalContentRatingFixture } from './personal-content-rating.mjs';
import { literal } from './personal-rating-prospective.mjs';

test('content concurrency launches pass the actual one-shot validator without changing SQL application identities', async () => {
  const names = ['kajo_content_upsert_waiter', 'kajo_content_source_waiter', 'kajo_content_alias_insert_waiter',
    'kajo_content_source_eraser', 'kajo_content_alias_reassignment', 'kajo_content_item_delete_waiter',
    'content-absent-canonical-alias', 'content-item-deletion-setup', 'content-item-deletion-cleanup'];
  for (const name of names) {
    const sql = `begin;set local application_name='${name}';select to_jsonb(true);commit;`;
    let calls = 0;
    const docker = (args, options) => {
      calls++;
      assert.equal(options.input, sql, 'Stage normalization must not rename the observed backend');
      assert.equal(options.timeout, 45_000);
      assert.ok(args.includes('PGOPTIONS=-c statement_timeout=40000 -c lock_timeout=30000'));
      return 'true\n';
    };
    assert.deepEqual(await executePersonalContentRatingProbe((query, options) =>
      runIsolatedSqlProbe(docker, 'owned-container', query, options), sql, name), [true]);
    assert.equal(calls, 1);
  }
  await assert.rejects(runIsolatedSqlProbe(() => assert.fail('Malformed stage must not start Docker'),
    'owned-container', 'select 1;', { stage: names[0] }), /fixed SQL probe stage label/);
});

test('actual Item deletion probes use fresh unreferenced Items and restore canonical rows on success and failure',
  { timeout: 240_000 }, async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
      const exec = async sql => {
        try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
        catch (error) { await db.exec('rollback;');throw error; }
      };
      await withPersonalContentRatingFixture(exec, callback => callback(exec), async ({ f, snapshot, one }) => {
        const before = await snapshot();
        assert.ok(await one(`select to_jsonb(count(*)) from private.prediction_candidates
          where item_id in(${f.movieTargets.map(literal).join(',')});`, 'retained-movie-candidates') > 0,
        'The original fixture MOVIE Items deliberately retain source-page foreign keys');
        await withPersonalContentRatingDeletionItems(exec, async ids => {
          assert.ok(ids.every(id => !f.items.includes(id)));
          assert.equal(await one(`select to_jsonb(count(*)) from private.prediction_candidates
            where item_id in(${ids.map(literal).join(',')});`, 'unreferenced-delete-items'), 0);
          assert.equal(await one(`select to_jsonb(count(*)) from public.items
            where id in(${ids.map(literal).join(',')}) and not discoverable;`, 'hidden-delete-items'), 2);
          await exec(`begin;lock table public.items in row exclusive mode;
            delete from public.items where id=${literal(ids[0])};commit;`);
          await exec(`begin;delete from public.items where id=${literal(ids[1])};commit;`);
          assert.equal(await one(`select to_jsonb(count(*)) from public.items
            where id in(${ids.map(literal).join(',')});`, 'both-item-deletions'), 0);
        });
        assert.deepEqual(await snapshot(), before, 'Successful deletion probes changed retained canonical rows');
        await assert.rejects(withPersonalContentRatingDeletionItems(exec, async () => {
          throw new Error('Synthetic deletion probe failure');
        }), /Synthetic deletion probe failure/);
        assert.deepEqual(await snapshot(), before, 'Failed deletion probe leaked its temporary Items');
      });
    } finally { await db.close(); }
  });

test('content writer stages satisfy the actual persistent-session validator', async () => {
  // This child acknowledges framing only; SQL and lock behavior remain native
  // PostgreSQL checks. Exercise the real separate session-stage validator.
  const receiver = String.raw`import { createInterface } from 'node:readline';
    createInterface({input:process.stdin}).on('line', line => {
      if (line === '\\q') process.exit(0);
      if (line.startsWith('\\echo ')) process.stdout.write(line.slice(6)+'\n');
    });`;
  await withIsolatedSqlSession(process.execPath, ['--input-type=module', '-e', receiver],
    { stage: 'content-stage-contract', timeoutMs: 10_000 }, async exec => {
      for (const name of ['kajo_content_upsert_holder', 'kajo_content_source_holder', 'kajo_content_batch_holder',
        'kajo_content_alias_holder', 'kajo_content_item_delete_holder']) {
        for (const suffix of ['begin', 'writer-role', 'initial-mutation', 'complete-mutation', 'commit', 'rollback']) {
          assert.deepEqual(await exec('select 1;', { stage: name + '-' + suffix }), []);
        }
      }
      for (const stage of ['content-session-name', 'content-session-pid', 'content-nowait-bound']) {
        assert.deepEqual(await exec('select 1;', { stage }), []);
      }
    });
});
