import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';

test('committed Discovery source tolerates a slow phone clock without weakening provenance', async () => {
  const db = new PGlite();
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const rpc = async (name, request) => {
    await db.exec('begin');
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
      await db.exec('set local role authenticated');
      const result = (await one(`select public.${name}($1) value`, [request])).value;
      await db.exec('commit');
      return result;
    } catch (error) { await db.exec('rollback'); throw error; }
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const forward = files.find(file => file.name.endsWith('_contextual_skip_server_clock.sql'));
    assert.ok(forward);
    for (const file of files.filter(file => file.name < forward.name)) await db.exec(`begin;${file.sql}commit;`);
    await db.exec(await personalTasteSessionFixtureSql());
    const profileId = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [owner])).id;
    const sessionId = randomUUID();
    const page = await rpc('rank_items_page_v1', { version: 3, requestId: randomUUID(), profileId, sessionId,
      discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 5, context: {}, cursor: null });
    const itemId = page.items[0].item_id ?? page.items[0].itemId;
    const impressionEventId = randomUUID();
    await db.query(`insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      values($1,$2,$3,clock_timestamp()-interval '1 minute','{}')`, [sessionId, owner, profileId]);
    // Like the reported phone, the event exists after delivery but its reported
    // wall clock precedes the server's requested_at by a fraction of a second.
    await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,
      occurred_at,session_id,prediction_id,discovery_mode)
      select $1,$2,$3,$4,'BOOK','ITEM_IMPRESSION',r.requested_at-interval '116 milliseconds',$5,r.id,'FOR_YOU'
      from private.prediction_runs r where r.id=$6`, [impressionEventId, owner, profileId, itemId, sessionId, page.predictionId]);
    const origin = { surface: 'DISCOVERY', sessionId, predictionId: page.predictionId, deliveryRequestId: page.requestId, impressionEventId };
    const source = { actorUserId: owner, profileId, itemId, origin };
    await assert.rejects(rpc('discovery_contextual_skip_source_v1', source), /SOURCE_WITHDRAWN/);
    const before = await one("select oid,to_jsonb(p)-'prosrc' metadata,prosrc from pg_proc p where oid='private.discovery_contextual_skip_source_v1(jsonb)'::regprocedure");
    const eventBefore = await one('select to_jsonb(e) value from public.events e where id=$1', [impressionEventId]);
    await db.exec(`begin;${forward.sql}commit;`);
    const after = await one("select oid,to_jsonb(p)-'prosrc' metadata,prosrc from pg_proc p where oid='private.discovery_contextual_skip_source_v1(jsonb)'::regprocedure");
    assert.equal(after.oid, before.oid);
    assert.deepEqual(after.metadata, before.metadata);
    assert.deepEqual(await one('select to_jsonb(e) value from public.events e where id=$1', [impressionEventId]), eventBefore);
    assert.equal((await rpc('discovery_contextual_skip_source_v1', source)).acceptsNewSkip, true);
    for (const originChange of [{ impressionEventId: randomUUID() }, { deliveryRequestId: randomUUID() }, { predictionId: randomUUID() }]) {
      await assert.rejects(rpc('discovery_contextual_skip_source_v1', { ...source, origin: { ...origin, ...originChange } }), /SOURCE_WITHDRAWN/);
    }
    const command = { version: 'kajo-contextual-skip-v1', kind: 'CONTEXTUAL_SKIP', ...source,
      actionId: randomUUID(), occurredAt: '0', contextRef: null, reversesActionId: null };
    const receipt = await rpc('commit_discovery_contextual_skip_v1', command);
    assert.equal(receipt.semantic, 'CONTEXTUAL_SKIP');
    assert.ok(BigInt(receipt.acceptedAt) > BigInt(Date.now() - 60_000) * 1000n);
    assert.deepEqual(await rpc('commit_discovery_contextual_skip_v1', command), receipt);
    const undo = { ...command, kind: 'WITHDRAW_CONTEXTUAL_SKIP', actionId: randomUUID(), reversesActionId: command.actionId };
    assert.equal((await rpc('commit_discovery_contextual_skip_v1', undo)).semantic, 'WITHDRAW_CONTEXTUAL_SKIP');
    assert.deepEqual(await one('select to_jsonb(e) value from public.events e where id=$1', [impressionEventId]), eventBefore);
    // Unknown source bytes must never be normalized by replaying the forward.
    await assert.rejects(db.exec(`begin;${forward.sql}commit;`), /source clock drift/);
    await db.exec('rollback');
  } finally { await db.close(); }
});
