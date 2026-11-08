import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';
const other = 'ab157000-0000-4000-8000-000000000002';

test('owned Taste numeric sources require committed lineage and preserve native authority', { timeout: 240_000 }, async t => {
  const db = new PGlite();
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const transaction = async (fn, actor = owner, role = 'postgres') => {
    await db.exec('begin;');
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      if (role !== 'postgres') await db.exec(`set local role ${role};`);
      const result = await fn();
      await db.exec('commit;');
      // The emulator clock is millisecond-grained; distinct COMMITs are real.
      await db.exec('do $$begin perform pg_sleep(0.002);end;$$;');
      return result;
    } catch (error) { await db.exec('rollback;'); throw error; }
  };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const all = (await buildFreshInstallation()).files;
    const files = all.slice(0, all.findIndex(file => file.name.endsWith('_owned_taste_numeric_sources.sql')) + 1);
    for (const file of files.slice(0, -1)) await db.exec(`begin;${file.sql}commit;`);
    await db.exec(await personalTasteSessionFixtureSql());
    const { id: profile } = await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [owner]);
    const functions = await db.query("select oid,to_jsonb(p) body from pg_proc p where pronamespace in('private'::regnamespace,'public'::regnamespace) order by oid");
    await db.exec(`begin;${files.at(-1).sql}commit;`);
    for (const row of functions.rows.filter(row => !['erase_prediction_sources_v1', 'check_personal_rating_content_withdrawal_budget_v1'].includes(row.body.proname))) assert.deepEqual((await one('select to_jsonb(p) body from pg_proc p where oid=$1', [row.oid])).body, row.body);
    const read = (type = 'MOVIE', actor = owner, cutoff = null) => transaction(async () =>
      (await one('select private.personal_rating_training_sources_v2($1,$2,coalesce($3::timestamptz,clock_timestamp())) value',
        [profile, type, cutoff])).value, actor);
    const rpc = request => transaction(async () =>
      (await one('select public.taste_session_v2($1) value', [request])).value, owner, 'authenticated');
    const cmd = (state, operation, extra = {}) => ({ operation, profileId: profile, sessionId: state.sessionId,
      requestId: randomUUID(), expectedRevision: state.revision, ...extra });
    let state = await rpc({ operation: 'START', profileId: profile, requestId: randomUUID() });
    const answered = [];
    await t.test('all eleven integer grades retain distinct accepted response and bootstrap identities', async () => {
      assert.deepEqual(await read(), []);
      for (let grade = 0; grade <= 10; grade++) {
        state = await rpc(cmd(state, 'NEXT'));
        assert.equal(state.status, 'QUESTION');
        const question = { questionId: state.questionId, itemId: state.currentItem.id };
        state = await rpc(cmd(state, 'ANSWER', { questionId: state.questionId, answer: { kind: 'RATING', value: grade } }));
        answered.push(question);
        const labels = await read();
        assert.equal(labels.length, grade + 1);
        const label = labels.find(row => row.itemId === question.itemId);
        assert.equal(label.sourceStatus, 'OWNED_TASTE_RATING');
        assert.equal(label.bootstrap.rating, grade);
        assert.equal(label.bootstrap.questionId, question.questionId);
        assert.equal(label.bootstrap.experienceTime, 'UNKNOWN');
        assert.equal(label.bootstrap.availableAtMicros, label.bootstrap.acceptedAtMicros);
        assert.equal(label.sourceBootstrapId, label.bootstrap.id);
        assert.equal(label.event, undefined);
      }
      assert.deepEqual(await read('BOOK'), []);
      assert.deepEqual(await read('MOVIE', owner, '2000-01-01'), []);
      assert.equal((await one('select count(*)::integer n from public.events where profile_id=$1', [profile])).n, 0);
    });
    await t.test('matching provider flags, imported alternatives and ambiguous ties cannot manufacture an owned label', async () => {
      // A separate synthetic owner keeps deliberate source invalidation isolated
      // from the genuine correction/Undo scenarios below.
      const { id: profile } = await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [other]);
      const rpc = request => transaction(async () => (await one('select public.taste_session_v2($1) value', [request])).value, other, 'authenticated');
      let s = await rpc({ operation: 'START', profileId: profile, requestId: randomUUID() });
      const command = (operation, extra = {}) => ({ operation, profileId: profile, sessionId: s.sessionId,
        requestId: randomUUID(), expectedRevision: s.revision, ...extra });
      s = await rpc(command('NEXT'));
      const fake = randomUUID(), external = randomUUID(), originalItem = s.currentItem.id;
      s = await rpc(command('ANSWER', { questionId: s.questionId, answer: { kind: 'RATING', value: 0 } }));
      const read = () => transaction(async () => (await one('select private.personal_rating_training_sources_v2($1,\'MOVIE\',clock_timestamp()) value', [profile])).value, other);
      assert.equal((await read()).find(row => row.itemId === originalItem).bootstrap.rating, 0);
      const { id: unseen } = await one(`select i.id from public.items i where i.item_type='MOVIE'
        and not exists(select 1 from private.profile_bootstrap_evidence b where b.item_id=i.id) order by i.id limit 1`);
      await transaction(() => db.query(`insert into private.profile_bootstrap_evidence(id,actor_user_id,profile_id,item_id,item_type,
          source_provider,dataset_kind,source_job_id,source_row_key,evidence_kind,rating,source_occurred_at,imported_at,source_metadata)
        select $1,actor_user_id,profile_id,$2::uuid,item_type,source_provider,dataset_kind,source_job_id,($2::uuid)::text,
          evidence_kind,rating,source_occurred_at,imported_at,source_metadata from private.profile_bootstrap_evidence
          where profile_id=$3 and item_id=$4`, [fake, unseen, profile, originalItem]));
      assert.equal((await read()).some(row => row.itemId === unseen), false, 'Copied flags cannot replace the accepted question/Item join');
      await transaction(() => db.query(`insert into private.profile_bootstrap_evidence(id,actor_user_id,profile_id,item_id,item_type,
          source_provider,dataset_kind,source_job_id,source_row_key,evidence_kind,rating,source_occurred_at,imported_at,source_metadata)
        select $1,actor_user_id,profile_id,item_id,item_type,'IMDB','IMPORTED_RATINGS',source_job_id,source_row_key,
          evidence_kind,8,source_occurred_at,imported_at,source_metadata from private.profile_bootstrap_evidence
          where profile_id=$2 and item_id=$3`, [external, profile, originalItem]));
      assert.equal((await read()).some(row => row.itemId === originalItem), false, 'An exact availability tie is not verified native support');
      await transaction(() => db.query(`update private.profile_bootstrap_evidence set
        source_occurred_at=source_occurred_at+interval '1 microsecond',imported_at=imported_at+interval '1 microsecond' where id=$1`, [external]));
      assert.equal((await read()).some(row => row.itemId === originalItem), false, 'A winning imported label cannot enter owned training');
      await transaction(() => db.query('update private.profile_bootstrap_evidence set active=false where id=any($1::uuid[])', [[fake, external]]));
      assert.equal((await read()).some(row => row.itemId === originalItem), false,
        'Canonical source invalidation must not resurrect a redacted command receipt');
    });
    await t.test('correction replaces the effective label without retaining the old response', async () => {
      const prior = (await read()).find(row => row.itemId === answered[0].itemId);
      state = await rpc(cmd(state, 'CORRECT', { questionId: answered[0].questionId, answer: { kind: 'RATING', value: 7 } }));
      const labels = await read(), updated = labels.find(row => row.itemId === answered[0].itemId);
      assert.equal(labels.length, 11);
      assert.equal(updated.bootstrap.rating, 7);
      assert.equal(updated.bootstrap.responseRevision, 2);
      assert.notEqual(updated.bootstrap.responseId, prior.bootstrap.responseId);
      assert.equal(updated.sourceBootstrapId, prior.sourceBootstrapId);
    });
    await t.test('source resolution remains closed to client roles and foreign owners', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        await assert.rejects(transaction(() => one('select private.personal_rating_training_sources_v2($1,$2,clock_timestamp())',
          [profile, 'MOVIE']), owner, role), error => error.code === '42501');
      }
      await assert.rejects(read('MOVIE', other), error => error.code === '42501');
      await assert.rejects(read('OTHER'), error => error.code === '22023');
      await assert.rejects(read('MOVIE', owner, '2100-01-01'), error => error.code === '22023');
    });
    await t.test('canonical rating, undo and history clear never duplicate or resurrect a cleared Taste label', async () => {
      const item = answered[2].itemId, eventSession = randomUUID();
      const startedAt = (await one('select clock_timestamp()::text at')).at;
      const action = (kind, extra = {}) => transaction(async () => {
        const time = (await one('select clock_timestamp()::text at')).at;
        return (await one(`select public.${kind === 'CLEAR_HISTORY' ? 'commit_collection_action_v1' : 'commit_item_action_v1'}($1) value`, [{ version: 1, actionId: randomUUID(),
          actorUserId: owner, profileId: profile, itemId: item, occurredAt: time,
          session: { sessionId: eventSession, startedAt, context: {} }, discoveryMode: 'FOR_YOU',
          ...(kind === 'CLEAR_HISTORY' ? { source: 'LISTS' } : {}), kind, ...extra }])).value;
      }, owner, 'authenticated');
      const changed = await action('SET_RATING', { rating: 9 });
      let labels = (await read()).filter(row => row.itemId === item);
      assert.equal(labels.length, 1);assert.equal(labels[0].sourceStatus, 'NATIVE_RATING');assert.equal(labels[0].event.rating, 9);
      const correction = await action('SET_RATING', { rating: 4 });
      assert.equal((await read()).find(row => row.itemId === item).event.rating, 4);
      await action('UNDO', { reversesActionId: correction.actionId });
      assert.equal((await read()).find(row => row.itemId === item).event.rating, 9);
      await action('UNDO', { reversesActionId: changed.actionId });
      labels = (await read()).filter(row => row.itemId === item);
      // The existing native writer retires bootstrap on first native rating;
      // Undo restores native history, not a withdrawn imported/Taste source.
      assert.equal((await one('select active from private.profile_bootstrap_evidence where profile_id=$1 and item_id=$2', [profile, item])).active, false);
      assert.deepEqual(labels, []);
      await action('SET_RATING', { rating: 4 });
      await action('CLEAR_HISTORY');
      assert.equal((await read()).some(row => row.itemId === item), false);
    });
    await t.test('withdrawn and unknown answers are not numeric zero', async () => {
      state = await rpc(cmd(state, 'CORRECT', { questionId: answered.at(-1).questionId, answer: { kind: 'WITHDRAWN' } }));
      assert.equal((await read()).some(row => row.itemId === answered.at(-1).itemId), false);
      state = await rpc(cmd(state, 'NEXT'));
      if (state.status === 'QUESTION') {
        const item = state.currentItem.id;
        state = await rpc(cmd(state, 'ANSWER', { questionId: state.questionId, answer: { kind: 'UNKNOWN' } }));
        assert.equal((await read()).some(row => row.itemId === item), false);
      }
    });
    await t.test('source removal retires Taste support without publishing or rewriting its history', async () => {
      const { source_job_id: job } = await one('select source_job_id from private.sequential_taste_sessions where id=$1', [state.sessionId]);
      await transaction(() => one('select public.remove_profile_import_job_v1($1)', [job]), owner, 'authenticated');
      assert.deepEqual(await read(), []);
    });
  } finally { await db.close(); }
});
