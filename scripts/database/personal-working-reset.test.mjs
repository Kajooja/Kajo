import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalNativeDecayFixtureSql } from './personal-native-decay.mjs';
import { personalWorkingResetPatches, personalWorkingResetSmokeSql, personalWorkingResetUpgradeSql } from './personal-working-reset.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const uuid = n => `a9148000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const near = (actual, expected, label) => {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: expected finite numbers`);
  assert.ok(Math.abs(actual - expected) <= 1e-12, `${label}: ${actual} differs from oracle ${expected}`);
};

test('native private Working reset is bounded, prospective and scope-owned while frozen forecasts remain exact (full schema)', async t => {
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
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_personal_working_reset.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_personal_working_bridge.sql')));
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const upgrade = (await db.exec(await personalWorkingResetUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(upgrade[0]?.personalWorkingResetUpgrade, /^PASS:/);
    await db.exec(`begin;${await personalNativeDecayFixtureSql()}`);
    const actor = uuid(1), foreign = uuid(2), shared = uuid(10), sessionId = uuid(11), otherSession = uuid(12), foreignSession = uuid(13);
    for (const id of [actor, foreign]) await db.query(`insert into auth.users(id,email,raw_user_meta_data)
      values($1,$2,jsonb_build_object('kajo_nickname',$3::text))`, [id, `${id}@example.invalid`, `Reset ${id.slice(-2)}`]);
    const personal = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).rows[0].id;
    const foreignPersonal = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [foreign])).rows[0].id;
    await db.query("insert into public.profiles(id,profile_type,name) values($1,'SHARED','Reset Shared control')", [shared]);
    await db.query('insert into public.profile_members(profile_id,user_id) values($1,$2),($1,$3)', [shared, actor, foreign]);
    await db.exec('update public.items set discoverable=false;');
    const evidence = [20, 21, 22, 23].map(uuid);
    const books = Array.from({ length: 10 }, (_, n) => uuid(40 + n));
    const movies = [60, 61, 62, 63].map(uuid);
    for (const [n, item] of [...evidence, ...books, ...movies].entries()) await db.query(`insert into public.items
      (id,item_type,title,tags,discoverable) values($1,$2,$3,array['reset-warm'],$4)`,
    [item, movies.includes(item) ? 'MOVIE' : 'BOOK', `Reset fixture ${n}`, !evidence.includes(item)]);
    const clock = Number((await db.query('select extract(epoch from now())*1000 value')).rows[0].value);
    const startedAt = new Date(clock - 300_000).toISOString();
    const iso = offset => new Date(clock + offset).toISOString();
    const now = async () => (await db.query('select clock_timestamp()::text value')).rows[0].value;
    let actionNumber = 1000, requestNumber = 2000, resetNumber = 3000;
    const command = (item, at, payload, session = sessionId) => ({ version: 1, actionId: uuid(actionNumber++), actorUserId: actor,
      profileId: personal, itemId: item, occurredAt: at, discoveryMode: 'FOR_YOU', predictionId: null,
      session: { sessionId: session, startedAt, context: {} }, ...payload });
    const request = (protocol = 3, domain = 'BOOK', cursor = undefined, profile = personal, session = sessionId) => ({
      version: protocol, requestId: uuid(requestNumber++), profileId: profile, sessionId: session,
      discoveryMode: 'FOR_YOU', itemType: domain, limit: 2, context: {}, ...(cursor === undefined ? {} : { cursor }),
    });
    const actorCall = async (name, payload, acting = actor) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [acting]);
      await db.exec('set local role authenticated;');
      try { return (await db.query(`select public.${name}($1::jsonb) value`, [JSON.stringify(payload)])).rows[0].value; }
      finally { await db.exec('reset role;').catch(() => {}); }
    };
    const capture = async (chosen = sessionId, cutoff = null, profile = personal, acting = actor) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [acting]);
      return (await db.query(`select private.capture_personal_working_state_v1($1,$2,$3,
        coalesce($4::timestamptz,clock_timestamp())) value`, [acting, profile, chosen, cutoff])).rows[0].value;
    };
    const reset = async (id = uuid(resetNumber++), chosen = sessionId, profile = personal, acting = actor, authActor = acting) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [authActor]);
      return (await db.query('select private.commit_personal_working_reset_v1($1,$2,$3,$4) value', [id, acting, profile, chosen])).rows[0].value;
    };
    // Owner-written legacy rows exercise capture's independent source bounds;
    // ordinary resets always go through the typed server-clock writer above.
    const legacyControl = async (id, at, chosen = sessionId) => db.query(`insert into private.personal_working_resets
      (id,actor_user_id,profile_id,session_id,reset_at,created_at,result) values($1,$2,$3,$4,$5,$5,
      jsonb_build_object('version','personal-working-reset-v1','resetId',$1::uuid,'actorUserId',$2::uuid,
        'profileId',$3::uuid,'sessionId',$4::uuid,'resetAt',$5::timestamptz,'createdAt',$5::timestamptz))`, [id, actor, personal, chosen, at]);
    const adjustment = async (state, control = 'ORDERED') => Number((await db.query(
      'select private.personal_working_adjustment_v1($1::jsonb,array[\'reset-warm\'],$2) value', [JSON.stringify(state), control])).rows[0].value);
    const compare = async (id, control = 'OFF', acting = actor) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [acting]);
      return (await db.query('select private.record_personal_working_shadow_v1($1,$2) value', [id, control])).rows[0].value;
    };
    const run = async id => (await db.query('select to_jsonb(r) value from private.prediction_runs r where id=$1', [id])).rows[0]?.value;
    const pool = async id => (await db.query(`select item_id,final_score,final_rank,selected_for_delivery,
      private.prediction_delivery_tier_v1(explanation->'resurfacingPolicy') tier,
      coalesce((explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) eligible,explanation
      from private.prediction_candidates where prediction_id=$1 order by final_rank`, [id])).rows;
    const reject = async (operation, pattern) => {
      await db.exec('savepoint expected_reset_rejection;');
      try { await assert.rejects(operation, pattern); }
      finally { await db.exec('rollback to savepoint expected_reset_rejection;release savepoint expected_reset_rejection;'); }
    };
    const caseTest = async (label, operation) => t.test(label, async () => {
      await db.exec('savepoint reset_case;');
      try { await operation(); }
      finally { await db.exec('rollback to savepoint reset_case;release savepoint reset_case;'); }
    });
    const oracle = async state => {
      const portable = deriveWorkingState(normalizeKajoWorkingSession({ profile: state.profile, actorUserId: state.actorUserId,
        session: state.session, events: state.rawEvents, objects: state.itemFeatures, featureSchema: state.featureSchema,
        asOf: state.asOf, prefixComplete: state.prefixComplete, refs: state.refs, resetAt: state.resetAt }));
      for (const key of ['status', 'items', 'groups', 'support', 'exclusions']) assert.deepEqual(state[key], portable[key], `Native reset ${key} exact portable parity`);
      assert.deepEqual(Object.keys(state.vectors).sort(), ['ordered', 'static']);
      for (const control of ['ordered', 'static']) {
        assert.deepEqual(Object.keys(state.vectors[control]).sort(), Object.keys(portable.vectors[control]).sort());
        for (const tag of Object.keys(portable.vectors[control])) near(state.vectors[control][tag], portable.vectors[control][tag], `Reset ${control}/${tag}`);
      }
      const object = { id: books[0], features: Object.fromEntries(state.featureSchema.dimensions.map(tag => [tag, tag === 'reset-warm' ? 1 : 0])),
        availableAt: state.featureSchema.artifact.availableAt, artifact: state.featureSchema.artifact };
      for (const control of ['OFF', 'STATIC', 'ORDERED']) near(await adjustment(state, control), scoreWorkingAdjustment({ state: portable, object, control }).value, `Reset ${control} numeric oracle`);
      return portable;
    };
    const exactOff = async id => {
      const actual = await pool(id), off = await compare(id);
      const frozen = (await run(id)).state_snapshot.workingState;
      assert.equal(off.version, frozen.version === 'native-working-capture-v2' ? 'personal-working-shadow-v2' : 'personal-working-shadow-v1');
      if (frozen.version === 'native-working-capture-v2') {
        assert.equal(off.captureVersion, frozen.version);assert.equal(off.resetAt, frozen.resetAt);
        assert.deepEqual(off.resetSourceRefs, frozen.resetSourceRefs, 'Copied v2 comparison freezes exact reset lineage');
      }
      assert.deepEqual(off.candidates.map(row => [row.itemId, row.score, row.rank, row.tier, row.eligible, row.selected, row.adjustment]),
        actual.map(row => [row.item_id, row.final_score, row.final_rank, row.tier, row.eligible, row.selected_for_delivery, 0]),
      'Reset default OFF preserves exact complete Item/score/rank/eligibility/tier/selection');
      return off;
    };
    const first = command(evidence[0], iso(-240_000), { kind: 'SET_RATING', rating: 0 });
    const second = command(evidence[1], iso(-180_000), { kind: 'SET_RATING', rating: 10 });
    await actorCall('commit_item_action_v1', first);await actorCall('commit_item_action_v1', second);
    await db.query(`insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      values($1,$2,$3,$4,'{}'),($5,$6,$7,$4,'{}')`, [otherSession, actor, personal, startedAt, foreignSession, foreign, foreignPersonal]);
    const oldRequests = [request(2), request(3)];
    const oldPages = [];
    for (const oldRequest of oldRequests) {
      const page = await actorCall('rank_items_page_v1', oldRequest);
      const source = await run(page.predictionId);
      assert.equal(source.state_snapshot.workingState.version, 'native-working-capture-v1');
      const comparisons = {};
      for (const control of ['OFF', 'STATIC', 'ORDERED']) comparisons[control] = await compare(page.predictionId, control);
      oldPages.push({ request: oldRequest, page, source, candidates: await pool(page.predictionId), comparisons });
    }
    const functionsBefore = (await db.query(`select p.oid,p.oid::regprocedure::text identity,to_jsonb(p)-'prosrc' properties,p.prosrc body
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f' order by p.oid`)).rows;
    await db.exec(files[index].sql);
    const expectedFunctions = functionsBefore.map(row => {
      let body = row.body;
      for (const edit of personalWorkingResetPatches.find(patch => patch.signature === row.identity)?.replacements ?? []) {
        assert.equal(body.split(edit.before).length - 1, edit.count, `${row.identity} reset manifest source anchor`);
        body = body.replaceAll(edit.before, edit.after);
      }
      return { ...row, body };
    });
    assert.deepEqual((await db.query(`select p.oid,p.oid::regprocedure::text identity,to_jsonb(p)-'prosrc' properties,p.prosrc body
      from pg_proc p where p.oid=any($1::oid[]) order by p.oid`, [functionsBefore.map(row => row.oid)])).rows, expectedFunctions,
    'Reset forward preserves all existing function identities/owners/ACL/configuration with only reviewed bodies changed');
    for (const old of oldPages) {
      assert.deepEqual(await actorCall('rank_items_page_v1', old.request), old.page);
      assert.deepEqual(await run(old.page.predictionId), old.source);
      assert.deepEqual(await pool(old.page.predictionId), old.candidates);
      for (const control of ['OFF', 'STATIC', 'ORDERED']) assert.deepEqual(await compare(old.page.predictionId, control), old.comparisons[control]);
    }

    await caseTest('server-owned reset boundary excludes prior taste without changing canonical evidence or memories', async () => {
      const before = await capture();assert.equal(before.version, 'native-working-capture-v2');await oracle(before);
      const canonical = (await db.query(`select relation,id,value from (
        select 'event' relation,id::text,to_jsonb(e) value from public.events e where profile_id=$1
        union all select 'receipt',id::text,to_jsonb(r) from private.item_action_receipts r where profile_id=$1
        union all select 'interaction',item_id::text,to_jsonb(i) from public.item_interactions i where profile_id=$1) rows order by relation,id`, [personal])).rows;
      const memory = (await db.query('select private.build_profile_memory_state_v1($1,now()) value', [personal])).rows[0].value;
      const resetId = uuid(resetNumber++);const receipt = await reset(resetId);
      assert.equal(receipt.version, 'personal-working-reset-v1');assert.equal(receipt.resetId, resetId);
      assert.equal(receipt.actorUserId, actor);assert.equal(receipt.profileId, personal);assert.equal(receipt.sessionId, sessionId);
      assert.equal(receipt.affects, 'WORKING_STATE_ONLY');assert.equal(receipt.learnable, false);assert.equal(receipt.nativeActivated, false);
      assert.equal(receipt.resetAt, receipt.createdAt, 'Server issues occurrence and availability together after scope locking');
      assert.deepEqual(await reset(resetId), receipt, 'Exact reset retry preserves its original server-clock receipt');
      const cleared = await capture();assert.equal(cleared.status, 'RESET_EMPTY');assert.equal(cleared.support.distinctItems, 0);
      assert.equal(cleared.resetControlCount, 1);assert.equal(cleared.resetControlPrefixComplete, true);
      assert.deepEqual(cleared.resetControls.map(row => row.resetId), [resetId]);
      assert.equal(await adjustment(cleared), 0);await oracle(cleared);
      assert.deepEqual((await db.query(`select relation,id,value from (
        select 'event' relation,id::text,to_jsonb(e) value from public.events e where profile_id=$1
        union all select 'receipt',id::text,to_jsonb(r) from private.item_action_receipts r where profile_id=$1
        union all select 'interaction',item_id::text,to_jsonb(i) from public.item_interactions i where profile_id=$1) rows order by relation,id`, [personal])).rows, canonical);
      assert.deepEqual((await db.query('select private.build_profile_memory_state_v1($1,now()) value', [personal])).rows[0].value, memory,
        'Working reset does not delete native taste, alter durable memory or create reward evidence');
      const oldCutoff = await capture(sessionId, before.cutoff);assert.equal(oldCutoff.resetAt, null);
      assert.deepEqual(oldCutoff.items, before.items);assert.equal(oldCutoff.resetControlCount, 0);
      assert.equal((await capture(sessionId, iso(4 * 60 * 60_000))).status, 'SESSION_EXPIRED', 'Reset cannot renew the original four-hour session');
    });

    await caseTest('post-reset independent Items regain intent while exact UNDO/clear cannot resurrect pre-reset taste', async () => {
      const receipt = await reset();
      await actorCall('commit_item_action_v1', command(evidence[2], await now(), { kind: 'SET_RATING', rating: 0 }));
      assert.equal((await capture()).status, 'INSUFFICIENT_SUPPORT');
      const positive = command(evidence[3], await now(), { kind: 'SET_RATING', rating: 10 });
      await actorCall('commit_item_action_v1', positive);
      const active = await capture();assert.equal(active.status, 'ACTIVE');assert.equal(active.support.distinctItems, 2);await oracle(active);
      near(await adjustment(active), 0.25 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2), 'Ordered post-reset two-group independent oracle');
      await actorCall('commit_item_action_v1', command(evidence[3], await now(), { kind: 'UNDO', reversesActionId: positive.actionId }, otherSession));
      assert.equal((await capture()).support.distinctItems, 1);await oracle(await capture());
      await actorCall('commit_collection_action_v1', command(evidence[2], await now(), { kind: 'CLEAR_HISTORY', source: 'LISTS' }, otherSession));
      const empty = await capture();assert.equal(empty.status, 'RESET_EMPTY');await oracle(empty);
      assert.equal(empty.resetControlCount, 1);assert.equal(empty.resetControls[0].resetId, receipt.resetId);
      const secondReset = await reset();assert.notEqual(secondReset.resetId, receipt.resetId);
      assert.deepEqual(await reset(receipt.resetId), receipt, 'A later reset cannot rewrite the earlier reset receipt');
      assert.equal((await capture()).resetControls.length, 2);
    });

    await caseTest('new versioned V2/V3 pages consume reset under exact OFF, copied V2 and legacy forecasts stay frozen', async () => {
      const firstRequests = [request(2), request(3)];const beforePages = [];
      for (const firstRequest of firstRequests) {
        const page = await actorCall('rank_items_page_v1', firstRequest);const source = await run(page.predictionId);
        assert.equal(source.state_snapshot.workingState.version, 'native-working-capture-v2');
        assert.match(source.policy_version, /\+personal-working-off-v2$/);
        for (const candidate of await pool(page.predictionId)) assert.equal(candidate.explanation.workingIntent.version, 'personal-working-features-v2');
        assert.ok(page.nextCursor);beforePages.push({ request: firstRequest, page, source, off: await exactOff(page.predictionId) });
      }
      const currentReceipt = await reset();
      assert.equal((await capture(sessionId, iso(0))).resetControls.some(row => row.resetId === currentReceipt.resetId), false,
        'The earlier transaction-start cutoff cannot observe a later server control');
      const v2NextRequest = request(2, 'BOOK', beforePages[0].page.nextCursor);
      const v3NextRequest = request(3, 'BOOK', beforePages[1].page.nextCursor);
      const v2Next = await actorCall('rank_items_page_v1', v2NextRequest), v3Next = await actorCall('rank_items_page_v1', v3NextRequest);
      assert.deepEqual((await run(v2Next.predictionId)).state_snapshot.workingState, beforePages[0].source.state_snapshot.workingState,
        'Copied V2 continuation retains the precise pre-reset capture');await exactOff(v2Next.predictionId);
      const freshCapture = (await run(v3Next.predictionId)).state_snapshot.workingState;
      assert.equal(freshCapture.status, 'RESET_EMPTY');assert.deepEqual(freshCapture.resetControls.map(row => row.resetId), [currentReceipt.resetId],
        'V3 existing post-gate request clock consumes the actual preceding server reset');
      assert.equal((await db.query('select requested_at>=$2::timestamptz value from private.prediction_runs where id=$1',
        [v3Next.predictionId, currentReceipt.createdAt])).rows[0].value, true, 'Reset was available by the frozen source request instant');
      await exactOff(v3Next.predictionId);
      for (const protocol of [2, 3]) {
        const movie = await actorCall('rank_items_page_v1', request(protocol, 'MOVIE'));
        assert.equal((await run(movie.predictionId)).state_snapshot.workingState.status, 'RESET_EMPTY');await exactOff(movie.predictionId);
      }
      for (const old of [...oldPages, ...beforePages]) {
        assert.deepEqual(await actorCall('rank_items_page_v1', old.request), old.page);assert.deepEqual(await run(old.page.predictionId), old.source);
        if (old.comparisons) for (const control of ['OFF', 'STATIC', 'ORDERED']) assert.deepEqual(await compare(old.page.predictionId, control), old.comparisons[control]);
        else assert.deepEqual(await compare(old.page.predictionId), old.off);
      }
      assert.deepEqual(await actorCall('rank_items_page_v1', v2NextRequest), v2Next);assert.deepEqual(await actorCall('rank_items_page_v1', v3NextRequest), v3Next);
    });

    await caseTest('reset ownership/session scope and every retry reauthorize while API roles remain denied', async () => {
      const receipt = await reset();
      await reject(() => reset(receipt.resetId, sessionId, personal, actor, foreign), error => error.code === '42501');
      await reject(() => reset(uuid(resetNumber++), sessionId, personal, foreign), error => error.code === '42501');
      await reject(() => reset(uuid(resetNumber++), foreignSession, personal), error => ['42501', '22023'].includes(error.code));
      await reject(() => reset(uuid(resetNumber++), sessionId, foreignPersonal), error => error.code === '42501');
      await reject(() => reset(uuid(resetNumber++), sessionId, shared), error => ['42501', '22023'].includes(error.code));
      await reject(() => reset(uuid(resetNumber++), uuid(999)), error => ['42501', '22023'].includes(error.code));
      await reject(() => reset(receipt.resetId, otherSession), error => error.code === '22023');
      assert.equal((await capture(otherSession)).resetControlCount, 0, 'A reset never crosses the owned session boundary');
      assert.equal(await capture(sessionId, null, shared), null);
      await db.exec('savepoint revoked_membership;');
      await db.query('delete from public.profile_members where profile_id=$1 and user_id=$2', [personal, actor]);
      await reject(() => reset(receipt.resetId), error => error.code === '42501');
      await db.exec('rollback to savepoint revoked_membership;release savepoint revoked_membership;');
      assert.deepEqual(await reset(receipt.resetId), receipt);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await db.query("select has_function_privilege($1,'private.commit_personal_working_reset_v1(uuid,uuid,uuid,uuid)','EXECUTE') value", [role])).rows[0].value, false);
        assert.equal((await db.query("select has_table_privilege($1,'private.personal_working_resets','SELECT,INSERT,UPDATE,DELETE') value", [role])).rows[0].value, false);
      }
      const writer = (await db.query(`select p.prosecdef,pg_get_function_identity_arguments(p.oid) args,p.provolatile,p.proconfig
        from pg_proc p where p.oid='private.commit_personal_working_reset_v1(uuid,uuid,uuid,uuid)'::regprocedure`)).rows[0];
      assert.equal(writer.prosecdef, false);assert.equal(writer.provolatile, 'v');
      assert.equal(writer.args, 'reset_id uuid, actor uuid, profile uuid, session uuid');
      assert.ok(writer.proconfig.includes('search_path=""'));assert.ok(writer.proconfig.includes('TimeZone=UTC'));
      await reject(() => db.exec('update private.personal_working_resets set reset_at=reset_at;'), /immutable/i);
      await reject(() => db.exec('delete from private.personal_working_resets;'), /immutable/i);
    });

    await caseTest('128 real controls are complete, cached retries precede quota, the 129th writer rejects', async () => {
      let earliest;
      for (let n = 0; n < 128; n++) {
        const receipt = await reset();if (n === 0) earliest = receipt;
      }
      const bounded = await capture();assert.equal(bounded.resetControlCount, 128);assert.equal(bounded.resetControlPrefixComplete, true);
      assert.equal(bounded.resetControls.length, 128);assert.equal(bounded.status, 'RESET_EMPTY');await oracle(bounded);
      assert.deepEqual(await reset(earliest.resetId), earliest, 'Exact old receipt retry is not blocked by current quota');
      await reject(() => reset(), error => error.code === '54000');
      assert.equal((await db.query('select count(*)::integer value from private.personal_working_resets where actor_user_id=$1 and profile_id=$2 and session_id=$3',
        [actor, personal, sessionId])).rows[0].value, 128);
      const other = await reset(undefined, otherSession);assert.equal(other.sessionId, otherSession, 'Control budget is scoped to its exact session');
    });

    await caseTest('cutoff-visible controls preserve exact ties, reject unavailable boundaries and exclude taste at the reset instant', async () => {
      const before = await capture();const future = iso(120_000);const one = uuid(resetNumber++), two = uuid(resetNumber++);
      await legacyControl(one, future);await legacyControl(two, future);
      const unseen = await capture(sessionId, before.cutoff);
      assert.equal(unseen.resetControlCount, 0);assert.equal(unseen.resetAt, null);assert.deepEqual(unseen.items, before.items);
      await reject(() => db.query(`insert into private.personal_working_resets
        (id,actor_user_id,profile_id,session_id,reset_at,created_at,result) values($1,$2,$3,$4,$5,$6,
          jsonb_build_object('version','personal-working-reset-v1','resetId',$1::uuid,'actorUserId',$2::uuid,
          'profileId',$3::uuid,'sessionId',$4::uuid,'resetAt',$5::timestamptz,'createdAt',$6::timestamptz))`,
      [uuid(resetNumber++), actor, personal, sessionId, iso(-60_000), future]), error => error.code === '23514');
      assert.equal((await capture(sessionId, before.cutoff)).resetControlCount, 0, 'A delayed availability control cannot impersonate a prior server boundary');
      const visible = await capture(sessionId, future);
      assert.equal(visible.status, 'RESET_EMPTY');assert.equal(visible.resetControlCount, 2);
      assert.deepEqual(visible.resetSourceRefs, [one, two].sort().map(recordId => ({ sourceId: 'kajo-personal-working-reset-v1', recordId })),
        'Equal visible reset instants preserve every exact source lineage');await oracle(visible);
      await db.exec('savepoint invalid_legacy_boundary;');
      await legacyControl(uuid(resetNumber++), iso(-301_000));
      const unavailable = await capture();assert.equal(unavailable.status, 'INPUT_UNAVAILABLE');
      assert.equal(unavailable.inputUnavailableReason, 'UNSUPPORTED_RESET_BOUNDARY');assert.equal(unavailable.resetControlPrefixComplete, false);
      assert.deepEqual(unavailable.rawEvents, []);assert.deepEqual(unavailable.resetControls, []);assert.equal(await adjustment(unavailable), 0);
      await db.exec('rollback to savepoint invalid_legacy_boundary;release savepoint invalid_legacy_boundary;');
      const receipt = await reset();
      await actorCall('commit_item_action_v1', command(evidence[2], receipt.resetAt, { kind: 'SET_RATING', rating: 10 }));
      const equal = await capture();assert.equal(equal.status, 'RESET_EMPTY');assert.equal(equal.support.distinctItems, 0);await oracle(equal);
    });

    await caseTest('independent control/prefix budgets accept both complete bounds and abstain honestly on legacy 129 controls', async () => {
      for (let n = 0; n < 128; n++) await legacyControl(uuid(resetNumber++), iso(-299_000));
      await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties,session_id)
        select md5('working-reset-attention:'||n)::uuid,$1,$2,$3,'BOOK','ITEM_OPENED',$4,'{}',$5 from generate_series(1,126) n`,
      [actor, personal, evidence[0], iso(-120_000), sessionId]);
      const bounded = await capture();assert.equal(bounded.status, 'ACTIVE');assert.equal(bounded.rawEvents.length, 128);
      assert.equal(bounded.resetControls.length, 128);assert.equal(bounded.resetControlPrefixComplete, true);assert.equal(bounded.prefixComplete, true);await oracle(bounded);
      await legacyControl(uuid(resetNumber++), iso(-298_000));
      const overflow = await capture();assert.equal(overflow.status, 'BUDGET_EXCEEDED');
      assert.equal(overflow.resetControlCount, null);assert.equal(overflow.resetControlCountLowerBound, 129);
      assert.equal(overflow.resetControlPrefixComplete, false);assert.equal(overflow.prefixComplete, false);
      for (const key of ['rawEvents', 'itemFeatures', 'items', 'groups', 'resetControls', 'resetSourceRefs']) assert.deepEqual(overflow[key], [], `Overflow never accepts a truncated ${key}`);
      assert.deepEqual(overflow.vectors, { static: {}, ordered: {} });assert.deepEqual(overflow.featureSchema.dimensions, []);
      for (const control of ['OFF', 'STATIC', 'ORDERED']) assert.equal(await adjustment(overflow, control), 0);
      const page = await actorCall('rank_items_page_v1', request());
      assert.equal((await run(page.predictionId)).state_snapshot.workingState.status, 'BUDGET_EXCEEDED');await exactOff(page.predictionId);
    });

    await caseTest('forecast erasure retains raw reset controls; genuine User/Profile/session parent removal cascades them', async () => {
      const receipt = await reset();const page = await actorCall('rank_items_page_v1', request());await exactOff(page.predictionId);
      const ledger = (await db.query('select to_jsonb(r) value from private.personal_working_resets r order by to_jsonb(r)::text')).rows;
      for (const [scope, id] of [['PREDICTION_RUN', page.predictionId], ['PROFILE', personal], ['ACTOR', actor]]) {
        await db.exec('savepoint forecast_erasure;');
        try {
          await db.query('select private.erase_prediction_sources_v1($1,$2)', [scope, id]);
          assert.deepEqual((await db.query('select to_jsonb(r) value from private.personal_working_resets r order by to_jsonb(r)::text')).rows, ledger,
            `${scope} forecast withdrawal must not erase the raw reset boundary or resurrect old intent`);
          const after = await capture();assert.equal(after.status, 'RESET_EMPTY');assert.equal(after.resetControls[0].resetId, receipt.resetId);
        } finally { await db.exec('rollback to savepoint forecast_erasure;release savepoint forecast_erasure;'); }
      }
      for (const [scope, id, sql] of [['PROFILE', personal, 'delete from public.profiles where id=$1']]) {
        await db.exec('savepoint genuine_parent_erasure;');
        try {
          await db.query('select private.erase_prediction_sources_v1($1,$2)', [scope, id]);await db.query(sql, [id]);
          assert.equal((await db.query('select count(*)::integer value from private.personal_working_resets where actor_user_id=$1 or profile_id=$2', [actor, personal])).rows[0].value, 0);
        } finally { await db.exec('rollback to savepoint genuine_parent_erasure;release savepoint genuine_parent_erasure;'); }
      }
      const foreignReset = await reset(undefined, foreignSession, foreignPersonal, foreign);
      await db.query('select private.erase_prediction_sources_v1($1,$2)', ['ACTOR', foreign]);
      await db.query('delete from auth.users where id=$1', [foreign]);
      assert.equal((await db.query('select count(*)::integer value from private.personal_working_resets where id=$1', [foreignReset.resetId])).rows[0].value, 0,
        'Genuine User erasure cascades an independent actor control without changing unrelated canonical evidence');
      assert.equal((await db.query('select count(*)::integer value from private.personal_working_resets where id=$1', [receipt.resetId])).rows[0].value, 1);
      await reset(undefined, otherSession);
      await db.query('delete from public.event_sessions where id=$1', [otherSession]);
      assert.equal((await db.query('select count(*)::integer value from private.personal_working_resets where session_id=$1', [otherSession])).rows[0].value, 0);
      assert.equal((await capture(otherSession)).status, 'NO_SESSION');
    });
    await db.exec('rollback;');await db.exec(`begin;${files[index].sql}commit;`);
    const smoke = (await db.exec(await personalWorkingResetSmokeSql())).flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(smoke[0]?.personalWorkingReset, /^PASS:/);
    for (const relation of ['auth.users', 'public.events', 'public.event_sessions', 'private.personal_working_resets',
      'private.prediction_runs', 'private.personal_working_shadow_comparisons']) assert.equal(
      (await db.query(`select count(*)::integer value from ${relation}`)).rows[0].value, 0, `${relation} escaped owned rollback`);
  } finally { await db.close(); }
});
