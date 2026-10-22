import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';

test('feed reader refresh is atomic, scoped and replayable beyond the active-reader cap', async () => {
  const db = new PGlite();
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const rpc = async (name, request, actor = owner) => {
    await db.exec('begin');
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      await db.exec('set local role authenticated');
      const result = (await one(`select public.${name}($1) value`, [request])).value;
      await db.exec('commit');
      return result;
    } catch (error) { await db.exec('rollback'); throw error; }
  };
  const count = async relation => (await one(`select count(*)::integer n from private.${relation}`)).n;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const forward = files.find(file => file.name.endsWith('_discovery_feed_reader.sql'));
    assert.ok(forward);
    for (const file of files.filter(file => file.name < forward.name)) await db.exec(`begin;${file.sql}commit;`);
    await db.exec(await personalTasteSessionFixtureSql());
    const profileId = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [owner])).id;
    const base = { version: 3, requestId: randomUUID(), profileId, sessionId: randomUUID(),
      discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 1, context: {}, cursor: null };
    const original = await rpc('rank_items_page_v1', base);
    const oldDefinitions = (await db.query(`select p.oid,pg_get_functiondef(p.oid) definition,p.proacl
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('private','public') and p.prokind='f' order by p.oid`)).rows;
    const oldRows = await one(`select
      (select jsonb_agg(to_jsonb(r) order by request_id) from private.prediction_page_receipts r) receipts,
      (select jsonb_agg(to_jsonb(r) order by id) from private.prediction_runs r) runs,
      (select jsonb_agg(to_jsonb(r) order by prediction_id,item_id) from private.prediction_candidates r) candidates,
      (select jsonb_agg(to_jsonb(r) order by prediction_id) from private.prediction_catalog_chain_pages r) pages`);
    await db.exec(`begin;${forward.sql}commit;`);
    const afterDefinitions = (await db.query(`select p.oid,pg_get_functiondef(p.oid) definition,p.proacl
      from pg_proc p where p.oid=any($1::oid[]) order by p.oid`, [oldDefinitions.map(row => row.oid)])).rows;
    assert.deepEqual(afterDefinitions, oldDefinitions, 'Additive forward changed an existing function or grant');
    assert.equal(await count('prediction_feed_receipts'), 0);
    assert.deepEqual(await rpc('rank_items_page_v1', base), original);

    const replace = { ...base, requestId: randomUUID(), replacesChainId: original.source.chainId };
    // A failed delegated validation must restore the old chain and its cursor.
    await assert.rejects(rpc('rank_items_feed_v1', { ...replace, limit: 0 }), /Invalid page limit/);
    assert.equal(await count('prediction_catalog_chains'), 1);
    assert.equal(await count('prediction_feed_receipts'), 0);
    for (const change of [{ sessionId: randomUUID() }, { discoveryMode: 'RISK' }, { itemType: 'MOVIE' },
      { replacesChainId: randomUUID() }]) {
      await assert.rejects(rpc('rank_items_feed_v1', { ...replace, ...change }), /Feed reader scope unavailable/);
    }
    await assert.rejects(rpc('rank_items_feed_v1', { ...replace, cursor: original.nextCursor }), /Invalid feed prediction request/);
    await assert.rejects(rpc('rank_items_feed_v1', { ...replace, requestId: base.requestId }), /Prediction request ID already used/);
    await assert.rejects(rpc('rank_items_feed_v1', replace, ''), /Authentication required/);
    await assert.rejects(rpc('rank_items_feed_v1', replace, 'ab157000-0000-4000-8000-000000000002'), /Profile access denied/);
    const refreshed = await rpc('rank_items_feed_v1', replace);
    assert.deepEqual(await rpc('rank_items_feed_v1', replace), refreshed);
    assert.equal(await count('prediction_catalog_chains'), 1);
    await assert.rejects(rpc('rank_items_feed_v1', { ...replace, requestId: randomUUID() }), /Feed reader already replaced/);
    await assert.rejects(rpc('rank_items_feed_v1', { ...replace, replacesChainId: null }), /Prediction request ID already used/);
    await assert.rejects(rpc('rank_items_page_v1', { ...base, requestId: randomUUID(), cursor: original.nextCursor }), /Continuation cursor unavailable/);
    assert.deepEqual(await rpc('rank_items_page_v1', base), original, 'Retirement changed exact old receipt');
    const preserved = await one(`select
      (select jsonb_agg(to_jsonb(r) order by request_id) from private.prediction_page_receipts r where request_id=$1) receipts,
      (select jsonb_agg(to_jsonb(r) order by id) from private.prediction_runs r where id=$2) runs,
      (select jsonb_agg(to_jsonb(r) order by prediction_id,item_id) from private.prediction_candidates r where prediction_id=$2) candidates,
      (select jsonb_agg(to_jsonb(r) order by prediction_id) from private.prediction_catalog_chain_pages r where prediction_id=$2) pages`, [base.requestId, original.predictionId]);
    assert.deepEqual(preserved, oldRows, 'Retirement changed immutable delivery evidence');

    // Another 15 readers keep the original mixed-reader cap fully occupied.
    for (let n = 0; n < 15; n++) await rpc('rank_items_page_v1', { ...base, requestId: randomUUID() });
    assert.equal(await count('prediction_catalog_chains'), 16);
    await assert.rejects(rpc('rank_items_feed_v1', { ...base, requestId: randomUUID(), replacesChainId: null }), /Too many active continuation windows/);
    let current = refreshed;
    for (let n = 0; n < 20; n++) {
      const request = { ...base, requestId: randomUUID(), replacesChainId: current.source.chainId };
      current = await rpc('rank_items_feed_v1', request);
      assert.deepEqual(await rpc('rank_items_feed_v1', request), current);
      assert.equal(await count('prediction_catalog_chains'), 16, 'Replacement leaked a live reader');
    }
    assert.deepEqual(await rpc('rank_items_feed_v1', replace), refreshed, 'Historical feed replay depended on a live reader');
    assert.equal(await count('prediction_feed_receipts'), 21);
    const continuationRequest = { ...base, requestId: randomUUID(), cursor: current.nextCursor };
    const continuation = await rpc('rank_items_page_v1', continuationRequest);
    assert.equal(continuation.source.chainId, current.source.chainId);
    assert.equal(continuation.source.pageIndex, 2);

    // Expired derived state may be absent; immutable root provenance still
    // permits a valid replacement and never permits an unrelated actor.
    await db.query('delete from private.prediction_catalog_chains where id=$1', [current.source.chainId]);
    const expiredReplacement = await rpc('rank_items_feed_v1', { ...base, requestId: randomUUID(), replacesChainId: current.source.chainId, limit: 5 });
    assert.equal(expiredReplacement.source.pageIndex, 1);
    assert.equal(await count('prediction_catalog_chains'), 16);
    assert.deepEqual(await rpc('rank_items_page_v1', continuationRequest), continuation,
      'A delivered continuation receipt must survive parent reader retirement');
    const security = await one(`select
      has_function_privilege('anon','public.rank_items_feed_v1(jsonb)','EXECUTE') anonymous,
      has_function_privilege('authenticated','public.rank_items_feed_v1(jsonb)','EXECUTE') authenticated,
      has_table_privilege('authenticated','private.prediction_feed_receipts','SELECT') receipt_read,
      (select relrowsecurity from pg_class where oid='private.prediction_feed_receipts'::regclass) rls`);
    assert.deepEqual(security, { anonymous: false, authenticated: true, receipt_read: false, rls: true });
  } finally { await db.close(); }
});
