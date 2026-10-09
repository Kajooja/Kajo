import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const uuid = n => `a9145000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('canonical Personal ItemCommand/session prefix feeds bounded source-only working adjustment (full schema)', async () => {
  const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'packages/prediction-engine/tsconfig.build.json'],
    { cwd: root, encoding: 'utf8', timeout: 120_000 });
  assert.equal(build.status, 0, `Engine build failed: ${build.stderr || build.stdout}`);
  const { normalizeKajoWorkingSession } = await import('../../packages/prediction-engine/dist/adapters/kajo-working-state.js');
  const { deriveWorkingState, scoreWorkingAdjustment } = await import('../../packages/prediction-engine/dist/working-state.js');
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    await db.exec('begin;');
    const actor = uuid(1); const sessionId = uuid(2); const otherSessionId = uuid(3);
    const items = [21, 22, 23, 24].map(uuid);
    await db.query(`insert into auth.users(id,email,raw_user_meta_data)
      values($1,$2,'{"kajo_nickname":"Working fixture"}')`, [actor, `${actor}@example.invalid`]);
    const personal = (await db.query(`select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'`, [actor])).rows[0].id;
    for (const [i, itemId] of items.entries()) await db.query(`insert into public.items(id,item_type,title,tags,discoverable)
      values($1,'BOOK',$2,array['working-warm'],true)`, [itemId, `Working fixture ${i}`]);
    const clock = Number((await db.query('select extract(epoch from now())*1000 clock')).rows[0].clock);
    const iso = milliseconds => new Date(clock + milliseconds).toISOString();
    const startedAt = iso(-300_000);
    const sourceId = 'kajo-canonical-events-v1';
    const artifact = { id: 'working-bridge-features', version: '1', representationVersion: 'normalized-v1',
      availableAt: clock - 400_000, trainedThrough: null, sourceRefs: [sourceId], use: 'fixture-only' };
    const objects = items.map(id => ({ id, features: { warm: 1 }, availableAt: artifact.availableAt, artifact }));
    const featureSchema = { id: artifact.id, version: '1', dimensions: ['warm'], artifact };
    const refs = { scopeId: 'bridge', subjectRef: 'bridge:subject', actorRef: 'bridge:actor', sessionRef: 'bridge:session' };
    let commandNumber = 100;
    const actorCall = async (name, request) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      await db.exec('set local role authenticated;');
      try { return (await db.query(`select public.${name}($1::jsonb) value`, [JSON.stringify(request)])).rows[0].value; }
      finally { await db.exec('reset role;'); }
    };
    const command = (itemId, offset, payload, chosenSession = sessionId) => ({ version: 1, actionId: uuid(commandNumber++),
      actorUserId: actor, profileId: personal, itemId, occurredAt: iso(offset), discoveryMode: 'FOR_YOU', predictionId: null,
      session: { sessionId: chosenSession, startedAt, context: {} }, ...payload });
    const read = async () => {
      const currentSession = (await db.query('select to_jsonb(s) value from public.event_sessions s where id=$1', [sessionId])).rows[0]?.value ?? null;
      const events = (await db.query(`select to_jsonb(e) value from public.events e where profile_id=$1
        order by occurred_at,id`, [personal])).rows.map(row => row.value);
      return { profile: { id: personal, type: 'PERSONAL', ownerUserId: actor }, actorUserId: actor,
        session: currentSession, events, objects, featureSchema, asOf: clock + 1, prefixComplete: true, refs };
    };
    const normalizeState = async () => deriveWorkingState(normalizeKajoWorkingSession(await read()));

    // Capture actual existing serving output; all later working adjustments are
    // reference computations and cannot mutate this PredictionRun/receipt.
    const page = await actorCall('rank_items_page_v1', { version: 3, requestId: uuid(4), profileId: personal,
      sessionId, discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 10, context: {} });
    assert.equal(page.items.length, 4);
    const sourceBefore = (await db.query('select to_jsonb(r) value from private.prediction_runs r where id=$1', [page.predictionId])).rows[0].value;
    const first = command(items[0], -240_000, { kind: 'SET_RATING', rating: 0 });
    const second = command(items[1], -180_000, { kind: 'SET_RATING', rating: 10 });
    const firstReceipt = await actorCall('commit_item_action_v1', first);
    assert.deepEqual(await actorCall('commit_item_action_v1', first), firstReceipt, 'Actual retry changes no evidence');
    await actorCall('commit_item_action_v1', second);
    const actual = await read();
    assert.equal(actual.events.length, 2);
    assert.equal(actual.events[0].properties.rating, 0);
    assert.equal(actual.events[0].id, first.actionId);
    const frozen = deriveWorkingState(normalizeKajoWorkingSession(actual));
    assert.equal(frozen.support.distinctItems, 2);
    const candidate = objects[2];
    const oracle = 0.25 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2);
    assert.ok(Math.abs(scoreWorkingAdjustment({ state: frozen, object: candidate, control: 'ORDERED' }).value - oracle) < 1e-12);
    assert.equal(scoreWorkingAdjustment({ state: frozen, object: candidate, control: 'STATIC' }).value, 0);
    const baseline = page.items.map(row => ({ id: row.item_id, score: row.score }));
    for (const row of baseline) { assert.ok(items.includes(row.id)); assert.ok(Number.isFinite(row.score)); }
    assert.deepEqual(baseline.map(row => ({ ...row, score: row.score + scoreWorkingAdjustment({ state: frozen, object: candidate }).value })), baseline,
      'WorkingState default OFF must preserve exact actual baseline numbers and rank order');

    // A real correction changes only the derived current state. Original Events,
    // receipt, earlier working snapshot and original serving source retain bytes.
    const correction = command(items[0], -120_000, { kind: 'SET_RATING', rating: 10 });
    await actorCall('commit_item_action_v1', correction);
    assert.equal(scoreWorkingAdjustment({ state: await normalizeState(), object: candidate, control: 'ORDERED' }).value, 0.25);
    await actorCall('commit_item_action_v1', command(items[0], -90_000, { kind: 'UNDO', reversesActionId: correction.actionId }, otherSessionId));
    const restored = await normalizeState();
    assert.equal(restored.items.find(row => row.objectId === items[0]).direction, -1);
    assert.equal(scoreWorkingAdjustment({ state: frozen, object: candidate, control: 'ORDERED' }).value,
      scoreWorkingAdjustment({ state: restored, object: candidate, control: 'ORDERED' }).value);
    assert.deepEqual((await db.query('select result from private.item_action_receipts where id=$1', [first.actionId])).rows[0].result, firstReceipt);

    const crossSessionReplacement = command(items[0], -75_000, { kind: 'SET_RATING', rating: 10 }, otherSessionId);
    await actorCall('commit_item_action_v1', crossSessionReplacement);
    assert.equal((await normalizeState()).support.distinctItems, 1,
      'Later other-session rating removes stale selected-session intent without supplying its new taste');
    await actorCall('commit_item_action_v1', command(items[0], -70_000,
      { kind: 'UNDO', reversesActionId: crossSessionReplacement.actionId }, otherSessionId));
    assert.equal((await normalizeState()).items.find(row => row.objectId === items[0]).direction, -1,
      'Exact Undo of cross-session replacement restores the selected-session original zero rating');
    assert.deepEqual((await db.query('select to_jsonb(e) value from public.events e where id=$1', [first.actionId])).rows[0].value,
      actual.events[0], 'Canonical corrections must preserve the original Event bytes');

    // Use the real selective command projection, not an invented all-signal clear.
    await actorCall('commit_collection_action_v1', command(items[0], -60_000, { kind: 'CLEAR_HISTORY', source: 'LISTS' }, otherSessionId));
    assert.equal((await normalizeState()).support.distinctItems, 1);
    const negative = command(items[1], -50_000, { kind: 'SET_NOT_INTERESTED', notInterested: true });
    await actorCall('commit_item_action_v1', negative);
    const beforeClear = await normalizeState();
    assert.equal(beforeClear.items.find(row => row.objectId === items[1]).direction, -1);
    await actorCall('commit_collection_action_v1', command(items[1], -40_000, { kind: 'CLEAR_HISTORY', source: 'LISTS' }, otherSessionId));
    assert.equal((await normalizeState()).items.find(row => row.objectId === items[1]).direction, -1,
      'Administrative history clear must retain canonical not-interest state');
    const projection = (await db.query('select not_interested,consumed,rating from public.item_interactions where profile_id=$1 and item_id=$2', [personal, items[1]])).rows[0];
    assert.deepEqual(projection, { not_interested: true, consumed: false, rating: null });
    await actorCall('commit_item_action_v1', command(items[1], -30_000, { kind: 'SET_NOT_INTERESTED', notInterested: false }, otherSessionId));
    assert.equal((await normalizeState()).support.distinctItems, 0, 'Clearing negative cannot resurrect an older removed rating');
    assert.deepEqual((await db.query('select to_jsonb(r) value from private.prediction_runs r where id=$1', [page.predictionId])).rows[0].value, sourceBefore);
    assert.deepEqual(deriveWorkingState(normalizeKajoWorkingSession(actual)), frozen, 'Current corrections must not rewrite frozen earlier prefix');
    await db.exec('rollback;');
    for (const relation of ['auth.users', 'public.event_sessions', 'public.events', 'public.item_interactions',
      'private.item_action_receipts', 'private.prediction_runs', 'private.prediction_page_receipts']) {
      assert.equal((await db.query(`select count(*)::integer n from ${relation}`)).rows[0].n, 0, `${relation} escaped rollback`);
    }
  } finally { await db.close(); }
});
