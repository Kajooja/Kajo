import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalSourceFusionFixtureSql } from './personal-source-fusion.mjs';

async function installPredecessor() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const forwardIndex = files.findIndex(file => file.name.endsWith('_personal_source_fusion.sql'));
    assert.ok(forwardIndex > 0, 'the source-fusion forward must be in the fresh lineage');
    for (const file of files.slice(0, forwardIndex)) await db.exec(`begin;${file.sql}commit;`);
    return { db, forwards: files.slice(forwardIndex) };
  } catch (error) { await db.close(); throw error; }
}

async function fixture(db, run) {
  await db.exec('begin;');
  try {
    await db.exec(await personalSourceFusionFixtureSql());
    // Each case starts without a rating or active import, so stale Saved/List/
    // consumed support cannot hide behind the fixture's independent rating.
    await db.exec("delete from public.events where id='a181d000-0000-4000-8000-000000000100';");
    const [input] = (await db.query('select * from pg_temp.item_support_fixture')).rows;
    await run(input);
  } finally { await db.exec('rollback;'); }
}

async function status(db, profileId) {
  return (await db.query('select private.get_profile_bootstrap_status_v1($1) body', [profileId])).rows[0].body;
}

async function expectSupport(db, profileId, count, label) {
  const body = await status(db, profileId);
  assert.equal(body.nativeStrongCount, count, `${label}: native support`);
  assert.equal(body.strongEvidenceCount, count, `${label}: union support`);
  assert.equal(body.calibrationRatingCount, 0, `${label}: inactive fixture calibration`);
  assert.equal(body.minimumStrongEvidence, 6, `${label}: existing setup contract`);
  assert.equal(body.needsCalibration, count < 6, `${label}: setup completion`);
  return body;
}

async function action(db, kind, fields, offset) {
  return (await db.query('select pg_temp.fusion_collection_action($1,$2,$3) body', [kind, fields, offset])).rows[0].body;
}

async function savedList(db, input) {
  return (await db.query('select private.ensure_system_saved_list($1,$2) id', [input.personal, input.actor])).rows[0].id;
}

async function customList(db, name, offset = -100) {
  return (await action(db, 'CREATE_LIST', { itemId: null, name }, offset)).listId;
}

async function rejectQuery(db, sql, params, pattern) {
  await db.exec('savepoint expected_denial;');
  try { await assert.rejects(db.query(sql, params), pattern); }
  finally { await db.exec('rollback to savepoint expected_denial;release savepoint expected_denial;'); }
}

// Fresh serving legitimately produces a new eligibility clock, but every score,
// confidence, policy, support count and other explanation field remains compared.
const sharedComparable = body => ({ ...body, prediction_id: undefined,
  explanation: { ...body.explanation, candidatePool: body.explanation.candidatePool
    ? { ...body.explanation.candidatePool, eligibilityAt: undefined } : undefined } });

async function sharedSnapshot(db, profileId) {
  const body = (await db.query('select private.build_profile_memory_state_v1($1,now()) body', [profileId])).rows[0].body;
  const ordinary = (await db.query("select * from private.rank_items_v0($1,'FOR_YOU','BOOK',50,'{}')", [profileId])).rows.map(sharedComparable);
  const catalog = (await db.query("select * from private.rank_items_catalog_base_v1('{}',false,$1,'FOR_YOU','BOOK',50,'{}')", [profileId])).rows.map(sharedComparable);
  return { body, ordinary, catalog };
}

test('Personal effective setup support follows available Saved/List/consumed state and preserves direct Shared semantics (full schema)', async t => {
  const { db, forwards } = await installPredecessor();
  try {
    await t.test('genuine two-member Shared direct native memory/ordinary/catalog baseline is unchanged by Personal fusion', async () => {
      await fixture(db, async input => {
        const shared = (await db.query("select profile_id from public.create_shared_profile('Fusion Shared fixture')")).rows[0].profile_id;
        await db.query('insert into public.profile_members(profile_id,user_id) values($1,$2)', [shared, input.foreign_actor]);
        await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties) values
          (gen_random_uuid(),$1,$3,$4,'BOOK','ITEM_RATED',now()-interval '2 days','{"rating":10}'),
          (gen_random_uuid(),$2,$3,$4,'BOOK','ITEM_RATED',now()-interval '1 day','{"rating":0}')`,
        [input.actor, input.foreign_actor, shared, input.evidence]);
        const before = await sharedSnapshot(db, shared);
        assert.equal(before.body.nativeEvidenceCount, 2, 'Shared retains its existing direct member evidence aggregation');
        assert.ok(before.ordinary.length > 0 && before.catalog.length > 0, 'both real Shared serving kernels are exercised');
        await db.query(`insert into private.profile_bootstrap_evidence(id,actor_user_id,profile_id,item_id,item_type,source_provider,
          dataset_kind,source_job_id,source_row_key,evidence_kind,rating,source_occurred_at,imported_at,active,source_metadata)
          select gen_random_uuid(),actor_user_id,$1,item_id,item_type,source_provider,dataset_kind,source_job_id,
          source_row_key,evidence_kind,rating,source_occurred_at,imported_at,true,'{"scopeSentinel":"PERSONAL_ONLY"}'
          from private.profile_bootstrap_evidence where item_id=$2`, [shared, input.evidence]);
        assert.deepEqual(await sharedSnapshot(db, shared), before, 'raw Shared import is ignored even before the forward');
        for (const file of forwards) await db.exec(file.sql);
        const after = await sharedSnapshot(db, shared);
        assert.deepEqual(after, before, 'Personal forward leaves genuine Shared direct scores, support and memory unchanged');
        assert.equal(after.body.bootstrapEvidenceCount, 0, 'Shared does not acquire bootstrap evidence');
        assert.equal(Object.hasOwn(after.body, 'sourceFusion'), false, 'Personal metadata does not enter Shared memory');
        assert.equal((await db.query('select count(*)::integer n from private.personal_source_evidence_v1($1,now())', [shared])).rows[0].n, 0);
        for (const row of [...after.ordinary, ...after.catalog]) {
          assert.equal(Object.hasOwn(row.explanation, 'sourceFusion'), false, 'Personal explanation does not enter Shared serving');
          assert.equal(Object.hasOwn(row.explanation.scoringFeatures, 'sourceFusion'), false, 'Personal feature metadata does not enter Shared serving');
          assert.equal(row.explanation.version, 'prediction-v0.5-native-decay', 'Shared keeps its existing native scoring version');
          assert.equal(JSON.stringify(row).includes('PERSONAL_ONLY'), false, 'raw bootstrap metadata does not leak');
        }
      });
    });
    for (const file of forwards) await db.exec(`begin;${file.sql}commit;`);

    await t.test('canonical corrections use receipt order across equal/backdated clocks and interposed List actions', async () => {
      for (const offsets of [[-20, -100], [-20, -20]]) {
        await fixture(db, async input => {
          const first = (await db.query("select pg_temp.fusion_item_action('SET_RATING','{\"rating\":10}',$1) body", [offsets[0]])).rows[0].body;
          const listId = await customList(db, 'Interposed list');
          await action(db, 'SET_LIST_ENTRY', { listId, present: true, positive: false }, -10);
          const second = (await db.query("select pg_temp.fusion_item_action('SET_RATING','{\"rating\":0}',$1) body", [offsets[1]])).rows[0].body;
          const sources = (await db.query("select * from private.personal_source_evidence_v1($1,now()) where source_status='NATIVE_RATING'", [input.personal])).rows;
          assert.equal(sources.length, 1);
          assert.equal(sources[0].source_event_id, second.actionId);
          assert.equal(sources[0].event_weight, -6, 'a backdated zero replaces the earlier positive');
          assert.equal(sources[0].ordering_basis, 'CANONICAL_RECEIPT_LINEAGE');
          await db.query("select pg_temp.fusion_item_action('UNDO',$1,-110)", [{ reversesActionId: second.actionId }]);
          const restored = (await db.query("select * from private.personal_source_evidence_v1($1,now()) where source_status='NATIVE_RATING'", [input.personal])).rows;
          assert.equal(restored.length, 1);
          assert.equal(restored[0].source_event_id, first.actionId, 'ordinary Undo reveals the prior rating through the list receipt');
          await expectSupport(db, input.personal, 1, 'rating and List union remains one Item');
        });
      }
    });

    await t.test('legacy equal-time disagreement and malformed replacement retain distinct explicit prior fallbacks', async () => {
      await fixture(db, async input => {
        await db.query('update private.profile_bootstrap_evidence set active=true where item_id=$1', [input.evidence]);
        await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
          select gen_random_uuid(),$1,$2,$3,'BOOK','ITEM_RATED',now()-interval '60 seconds',jsonb_build_object('rating',rating)
          from (values(0),(10)) r(rating)`, [input.actor, input.personal, input.evidence]);
        let sources = (await db.query('select source_status from private.personal_source_evidence_v1($1,now())', [input.personal])).rows.map(row => row.source_status);
        assert.deepEqual(sources.sort(), ['AMBIGUOUS_NATIVE', 'BOOTSTRAP_AMBIGUOUS_FALLBACK']);
        await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
          values(gen_random_uuid(),$1,$2,$3,'BOOK','ITEM_RATED',now()-interval '30 seconds','{"rating":"bad"}')`, [input.actor, input.personal, input.evidence]);
        sources = (await db.query('select source_status from private.personal_source_evidence_v1($1,now())', [input.personal])).rows.map(row => row.source_status);
        assert.deepEqual(sources.sort(), ['BOOTSTRAP_UNAVAILABLE_FALLBACK', 'UNAVAILABLE_NATIVE_VALUE']);
      });
    });

    await t.test('broken receipt scope, cyclic ancestry and competing roots never choose a native rating', async () => {
      for (const corruption of ['scope', 'cycle', 'fork', 'payload']) {
        await fixture(db, async input => {
          const first = (await db.query("select pg_temp.fusion_item_action('SET_RATING','{\"rating\":10}',-60) body")).rows[0].body;
          const second = (await db.query("select pg_temp.fusion_item_action('SET_RATING','{\"rating\":0}',-30) body")).rows[0].body;
          if (corruption === 'scope') await db.query('update private.item_action_receipts set actor_user_id=$1 where id=$2', [input.foreign_actor, second.actionId]);
          if (corruption === 'cycle') await db.query('update private.item_action_receipts set previous_action_id=$1 where id=$2', [second.actionId, first.actionId]);
          if (corruption === 'fork') await db.query('update private.item_action_receipts set previous_action_id=null where id=$1', [second.actionId]);
          if (corruption === 'payload') await db.query("update private.item_action_receipts set result=jsonb_set(result,'{interaction,rating}','10') where id=$1", [second.actionId]);
          const sources = (await db.query("select source_status from private.personal_source_evidence_v1($1,now()) where item_id=$2", [input.personal, input.evidence])).rows;
          assert.deepEqual(sources, [{ source_status: 'UNAVAILABLE_CANONICAL_LINEAGE' }], corruption);
          const body = await expectSupport(db, input.personal, 0, corruption);
          assert.equal(body.setupSupportAvailability, 'PARTIAL_UNAVAILABLE', corruption);
        });
      }
    });

    await t.test('receipt ancestry admits depth 512 and rejects overflow without truncating to an older answer', async () => {
      await fixture(db, async input => {
        const first = (await db.query("select pg_temp.fusion_item_action('SET_RATING','{\"rating\":10}',-60) body")).rows[0].body;
        await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
          select ('a182d000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1,$2,$3,'BOOK','ITEM_RATED',now()-interval '60 seconds',
            jsonb_build_object('rating',0,'actionId',('a182d000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid)
          from generate_series(1,513) n`, [input.actor, input.personal, input.evidence]);
        await db.query(`insert into private.item_action_receipts(id,actor_user_id,profile_id,item_id,command,before_state,previous_action_id,result)
          select next.id,r.actor_user_id,r.profile_id,r.item_id,
            r.command||jsonb_build_object('actionId',next.id,'rating',0),r.before_state,
            case when n=1 then r.id else ('a182d000-0000-4000-8000-'||lpad((n-1)::text,12,'0'))::uuid end,
            jsonb_set(r.result||jsonb_build_object('actionId',next.id),'{interaction,rating}','0')
          from private.item_action_receipts r cross join generate_series(1,512) n
          cross join lateral(select ('a182d000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid id) next
          where r.id=$1 order by n`, [first.actionId]);
        // Keep the unclaimed 513th Event outside the available prefix initially.
        await db.exec("update public.events set created_at=now()+interval '1 day' where id='a182d000-0000-4000-8000-000000000513';");
        let sources = (await db.query("select source_event_id,source_status from private.personal_source_evidence_v1($1,now())", [input.personal])).rows;
        assert.deepEqual(sources, [{ source_event_id: 'a182d000-0000-4000-8000-000000000512', source_status: 'NATIVE_RATING' }]);
        await db.exec(`update public.events set created_at=now() where id='a182d000-0000-4000-8000-000000000513';
          insert into private.item_action_receipts(id,actor_user_id,profile_id,item_id,command,before_state,previous_action_id,result)
          select 'a182d000-0000-4000-8000-000000000513',actor_user_id,profile_id,item_id,
            command||'{"actionId":"a182d000-0000-4000-8000-000000000513"}',before_state,id,
            result||'{"actionId":"a182d000-0000-4000-8000-000000000513"}'
          from private.item_action_receipts where id='a182d000-0000-4000-8000-000000000512';`);
        sources = (await db.query("select source_event_id,source_status from private.personal_source_evidence_v1($1,now())", [input.personal])).rows;
        assert.deepEqual(sources, [{ source_event_id: null, source_status: 'UNAVAILABLE_CANONICAL_LINEAGE' }]);
      });
    });

    await t.test('actual SYSTEM_SAVED add then remove loses setup support', async () => {
      await fixture(db, async input => {
        const listId = await savedList(db, input);
        const added = await action(db, 'SET_LIST_ENTRY', { listId, present: true, positive: false }, -100);
        assert.equal(added.changed, true);
        assert.equal(added.interaction.saved, true);
        await expectSupport(db, input.personal, 1, 'available Saved');
        const removed = await action(db, 'SET_LIST_ENTRY', { listId, present: false, positive: false }, -90);
        assert.equal(removed.interaction.saved, false);
        assert.deepEqual((await db.query('select event_type from public.events where id=any($1::uuid[])', [removed.eventIds])).rows,
          [{ event_type: 'ITEM_UNSAVED' }], 'the actual command emitted the negative Saved control');
        await expectSupport(db, input.personal, 0, 'available unsave');
      });
    });

    await t.test('backdated canonical Saved and CustomList removals do not leave stale setup support', async () => {
      for (const kind of ['SAVED', 'CUSTOM', 'DELETE']) {
        await fixture(db, async input => {
          const listId = kind === 'SAVED' ? await savedList(db, input) : await customList(db, 'Backdated removal');
          await action(db, 'SET_LIST_ENTRY', { listId, present: true, positive: false }, -20);
          if (kind === 'DELETE') await action(db, 'DELETE_LIST', { itemId: null, listId }, -60);
          else await action(db, 'SET_LIST_ENTRY', { listId, present: false, positive: false }, -60);
          await expectSupport(db, input.personal, 0, `backdated ${kind} removal`);
        });
      }
    });

    await t.test('future actual UNSAVED and future UNDO_LIST_ENTRY do not erase available Saved support', async () => {
      for (const operation of ['UNSAVED', 'UNDO_LIST_ENTRY']) {
        await fixture(db, async input => {
          const listId = await savedList(db, input);
          const added = await action(db, 'SET_LIST_ENTRY', { listId, present: true, positive: false }, -100);
          if (operation === 'UNSAVED') await action(db, 'SET_LIST_ENTRY', { listId, present: false, positive: false }, 60);
          else await action(db, 'UNDO_LIST_ENTRY', { reversesActionId: added.actionId }, 60);
          assert.equal((await db.query('select saved from public.item_interactions where profile_id=$1 and item_id=$2',
            [input.personal, input.evidence])).rows[0].saved, false, `${operation} already changed mutable state`);
          await expectSupport(db, input.personal, 1, `unavailable future ${operation}`);
        });
      }
    });

    await t.test('actual CustomList add/remove, multi-list union and deletion remove only effective support', async () => {
      await fixture(db, async input => {
        const first = await customList(db, 'First fixture list', -120);
        const second = await customList(db, 'Second fixture list', -115);
        await action(db, 'SET_LIST_ENTRY', { listId: first, present: true, positive: false }, -100);
        await action(db, 'SET_LIST_ENTRY', { listId: second, present: true, positive: false }, -90);
        await expectSupport(db, input.personal, 1, 'same Item in two CustomLists counts once');
        await action(db, 'SET_LIST_ENTRY', { listId: first, present: false, positive: false }, -80);
        await expectSupport(db, input.personal, 1, 'other CustomList still supports Item');
        const deleted = await action(db, 'DELETE_LIST', { itemId: null, listId: second }, -70);
        assert.deepEqual((await db.query('select event_type,item_id from public.events where id=any($1::uuid[])', [deleted.eventIds])).rows,
          [{ event_type: 'LIST_DELETED', item_id: null }], 'actual deletion emits a list-scoped control');
        await expectSupport(db, input.personal, 0, 'last CustomList deleted');
      });
      await fixture(db, async input => {
        const listId = await customList(db, 'Removed fixture list');
        await action(db, 'SET_LIST_ENTRY', { listId, present: true, positive: false }, -90);
        await action(db, 'SET_LIST_ENTRY', { listId, present: false, positive: false }, -80);
        await expectSupport(db, input.personal, 0, 'last CustomList entry removed');
      });
    });

    await t.test('future actual CustomList removal/deletion/Undo retain the available prefix despite mutable projection', async () => {
      for (const operation of ['REMOVE', 'DELETE', 'UNDO_LIST_ENTRY']) {
        await fixture(db, async input => {
          const listId = await customList(db, 'Future control fixture list');
          const added = await action(db, 'SET_LIST_ENTRY', { listId, present: true, positive: false }, -90);
          if (operation === 'REMOVE') await action(db, 'SET_LIST_ENTRY', { listId, present: false, positive: false }, 60);
          else if (operation === 'DELETE') await action(db, 'DELETE_LIST', { itemId: null, listId }, 60);
          else await action(db, 'UNDO_LIST_ENTRY', { reversesActionId: added.actionId }, 60);
          assert.equal((await db.query('select count(*)::integer n from public.item_list_entries where list_id=$1 and item_id=$2',
            [listId, input.evidence])).rows[0].n, 0, `${operation} already removed current entry`);
          await expectSupport(db, input.personal, 1, `unavailable future CustomList ${operation}`);
        });
      }
    });

    await t.test('legacy consumed then actual rejection/interest clear cannot resurrect stale consumed setup support', async () => {
      await fixture(db, async input => {
        await db.query('insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed) values($1,$2,$3,true)',
          [input.personal, input.evidence, input.actor]);
        await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
          values(gen_random_uuid(),$3,$1,$2,'BOOK','ITEM_CONSUMED',now()-interval '100 seconds','{}')`,
        [input.personal, input.evidence, input.actor]);
        await expectSupport(db, input.personal, 1, 'available legacy consumed');
        await db.query("select pg_temp.fusion_item_action('SET_NOT_INTERESTED','{\"notInterested\":true}',-90)");
        await expectSupport(db, input.personal, 1, 'explicit current rejection remains strong setup support');
        await db.query("select pg_temp.fusion_item_action('SET_NOT_INTERESTED','{\"notInterested\":false}',-80)");
        const current = (await db.query('select consumed,not_interested from public.item_interactions where profile_id=$1 and item_id=$2',
          [input.personal, input.evidence])).rows[0];
        assert.deepEqual(current, { consumed: false, not_interested: false });
        await expectSupport(db, input.personal, 0, 'cleared rejection does not restore legacy consumed');
      });
    });

    await t.test('effective setup honors own actor/Profile source scopes and public role authorization', async () => {
      await fixture(db, async input => {
        const listId = await savedList(db, input);
        await action(db, 'SET_LIST_ENTRY', { listId, present: true, positive: false }, -100);
        await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties) values
          (gen_random_uuid(),$2,$3,$5,'BOOK','ITEM_UNSAVED',now()-interval '50 seconds','{}'),
          (gen_random_uuid(),$1,$4,$5,'BOOK','ITEM_UNSAVED',now()-interval '40 seconds','{}'),
          (gen_random_uuid(),$2,$3,$6,'BOOK','ITEM_SAVED',now()-interval '30 seconds','{}')`,
        [input.actor, input.foreign_actor, input.personal, input.foreign_personal, input.evidence, input.unmatched]);
        await expectSupport(db, input.personal, 1, 'foreign actors/Profiles neither erase own Saved nor create own support');
        await db.exec('set local role authenticated;');
        const owner = (await db.query('select public.get_profile_bootstrap_status_v1($1) body', [input.personal])).rows[0].body;
        assert.equal(owner.nativeStrongCount, 1, 'actual owner API reads scoped effective support');
        await rejectQuery(db, 'select public.get_profile_bootstrap_status_v1($1)', [input.foreign_personal], /owner|denied/i);
        await db.exec('set local role postgres;');
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [input.foreign_actor]);
        await db.exec('set local role authenticated;');
        await rejectQuery(db, 'select public.get_profile_bootstrap_status_v1($1)', [input.personal], /owner|denied/i);
        await db.exec('set local role postgres;set local role anon;');
        await rejectQuery(db, 'select public.get_profile_bootstrap_status_v1($1)', [input.personal], /permission denied/i);
        await db.exec('set local role postgres;');
      });
    });
  } finally { await db.close(); }
});
