import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyPersonalTasteRecovery } from './personal-taste-recovery.mjs';

test('long Taste replies and movie-first progression preserve populated sessions', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(f => f.name.endsWith('_taste_reply_capacity_and_movie_first.sql'));
    assert.ok(index > 0);
    for (const f of files.slice(0, index)) await db.exec(`begin;${f.sql}commit;`);
    const migration = files[index];
    for (const [name, drift] of [
      ['body', `do $$ declare d text;b text;begin select pg_get_functiondef(oid),prosrc into d,b from pg_proc
        where oid='private.taste_session_v2(jsonb)'::regprocedure;execute replace(d,b,b||E'\n-- drift');end;$$;`],
      ['configuration', 'alter function private.taste_session_v2(jsonb) set search_path=public;'],
      ['access', 'grant execute on function private.taste_session_v2(jsonb) to anon;'],
      ['constraint', `alter table private.sequential_taste_commands drop constraint sequential_taste_commands_result_check;
        alter table private.sequential_taste_commands add constraint sequential_taste_commands_result_check check(true);`],
      ['default access', 'create role taste_extra;alter default privileges for role postgres in schema private grant execute on functions to taste_extra;'],
    ]) await t.test('atomic migration rejects unknown ' + name, async () => {
      await db.exec('begin;' + drift);
      await assert.rejects(db.exec(migration.sql), /Taste recovery .*drift/);
      await db.exec('rollback;');
    });
    const exec = async sql => {
      try { return (await db.exec(sql)).flatMap(r => r.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;'); throw error; }
    };
    const report = await verifyPersonalTasteRecovery(exec, migration);
    t.diagnostic(JSON.stringify(report));
    await t.test('phase exhaustion, old mixed history and within-domain ranking are explicit', async () => {
      const catalog = ['MOVIE', 'MOVIE', 'BOOK', 'BOOK'].map((itemType, n) => ({
        id: `item-${n}`, itemType, tags: [n % 2 ? 'a' : 'b'], recognitionPrior: itemType === 'BOOK' ? 1 : .2,
      }));
      const panel = { predictionId: 'fixture', items: catalog.map((c, n) => ({
        itemId: c.id, status: 'AVAILABLE', labelSeen: false, score: n,
      })) };
      const choose = async (ledger = [], candidates = catalog, forecast = panel, helper = 'select_movie_first_taste_v1') =>
        (await db.query(`select private.${helper}($1,$2,$3,'CANONICAL_FORECAST_POOL_V4') value`, [candidates, ledger, forecast])).rows[0].value;
      const history = n => Array.from({ length: n }, (_, index) => ({
        objectId: `old-${index}`, itemType: 'MOVIE', tags: ['a'], invalidated: false,
        responses: [{ answer: { kind: 'RATING', value: index % 11 } }],
      }));
      const mixed = [...history(23), { objectId: 'old-book', itemType: 'BOOK', tags: ['b'], responses: [] }];
      const movie = await choose(mixed);
      assert.equal(movie.item.itemType, 'MOVIE', 'Old unversioned BOOK exposure does not force the new phase');
      const control = await choose(mixed, catalog.filter(c => c.itemType === 'MOVIE'), panel, 'select_sequential_taste_v3');
      assert.deepEqual(movie.item, control.item); assert.deepEqual(movie.components, control.components);
      const book = await choose(history(24));
      assert.equal(book.item.itemType, 'BOOK');
      assert.equal(book.trace.domainProgression.transitionReason, 'MOVIE_OPPORTUNITY_LIMIT');
      const unsupported = { ...panel, items: panel.items.map((f, n) => n < 2 ? { ...f, status: 'UNAVAILABLE' } : f) };
      const fallback = await choose([], catalog, unsupported);
      assert.equal(fallback.item.itemType, 'BOOK');
      assert.equal(fallback.trace.domainProgression.transitionReason, 'MOVIE_SUPPORT_EXHAUSTED');
      const phase = [{ objectId: 'old-book', itemType: 'BOOK', tags: ['a'], invalidated: true,
        selectionTrace: fallback.trace, responses: [] }];
      assert.equal((await choose(phase)).item.itemType, 'BOOK', 'Returning MOVIE support cannot reverse an exposed BOOK phase');
      assert.equal(await choose(phase, catalog.filter(c => c.itemType === 'MOVIE')), null);
      assert.equal(await choose([], []), null);
      assert.equal((await choose([], catalog.slice(1))).item.itemType, 'BOOK', 'One unsupported MOVIE must not block BOOK');
    });
  } finally { await db.close(); }
});
