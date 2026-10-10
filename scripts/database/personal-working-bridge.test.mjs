import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalNativeDecayFixtureSql } from './personal-native-decay.mjs';
import { personalWorkingBridgePatches, personalWorkingBridgeSmokeSql, personalWorkingBridgeUpgradeSql } from './personal-working-bridge.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const uuid = n => `a9146000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const near = (actual, expected, label) => {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: both oracle values must be finite numbers`);
  assert.ok(Math.abs(actual - expected) <= 1e-12,
    `${label}: ${actual} differs from independent oracle ${expected}`);
};
const nearVectors = (actual, expected, label) => {
  for (const [name, vectors] of [['native', actual], ['portable', expected]]) {
    assert.ok(vectors !== null && typeof vectors === 'object' && !Array.isArray(vectors), `${label}: ${name} vector envelope`);
    assert.deepEqual(Object.keys(vectors).sort(), ['ordered', 'static'], `${label}: ${name} control keys`);
  }
  for (const control of ['ordered', 'static']) {
    for (const [name, vector] of [['native', actual[control]], ['portable', expected[control]]]) {
      assert.ok(vector !== null && typeof vector === 'object' && !Array.isArray(vector), `${label}: ${name} ${control} vector shape`);
    }
    assert.deepEqual(Object.keys(actual[control]).sort(), Object.keys(expected[control]).sort(), `${label}: exact ${control} feature keys`);
    for (const feature of Object.keys(expected[control])) near(actual[control][feature], expected[control][feature],
      `${label}: ${control}/${feature}`);
  }
};

test('Working vector parity allows only finite bounded roundoff while preserving complete control/feature keys', () => {
  // CI #625 sample 7 exposed independent SQL/JavaScript evaluation of the
  // same ordered mean differing in the last binary floating-point digits.
  const native = { ordered: { 'bridge-cold': -0.17157287525380988 }, static: { 'bridge-cold': 0 } };
  const portable = { ordered: { 'bridge-cold': -0.17157287525380996 }, static: { 'bridge-cold': 0 } };
  assert.notDeepEqual(native, portable, 'The concrete platform roundoff fixture must expose unequal scalar bytes');
  nearVectors(native, portable, 'CI sample 7 independent numeric parity');
  assert.throws(() => nearVectors({ ...native, ordered: { 'bridge-cold': portable.ordered['bridge-cold'] + 2e-12 } }, portable,
    'material discrepancy'), /differs from independent oracle/);
  for (const invalid of [NaN, Infinity, -Infinity, '0', null, undefined]) assert.throws(() => nearVectors(
    { ...native, ordered: { 'bridge-cold': invalid } }, portable, 'invalid numeric component'), /finite numbers/);
  assert.throws(() => nearVectors(native, { ...portable, ordered: { 'bridge-cold': NaN } }, 'invalid portable oracle'), /finite numbers/);
  assert.throws(() => nearVectors({ ...native, ordered: {} }, portable, 'missing feature'), /exact ordered feature keys/);
  assert.throws(() => nearVectors({ ...native, ordered: { ...native.ordered, unexpected: 0 } }, portable, 'extra feature'), /exact ordered feature keys/);
  assert.throws(() => nearVectors({ ordered: native.ordered }, portable, 'missing control'), /control keys/);
  assert.throws(() => nearVectors({ ...native, future: {} }, portable, 'extra control'), /control keys/);
});

test('native Personal Working capture and frozen default-OFF consumer preserve baseline, ownership and lifecycle (full schema)', async t => {
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
    const index = files.findIndex(file => file.name.endsWith('_personal_working_bridge.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_personal_native_decay_parity.sql')),
      'Working capture must be a new forward after the accepted native decay lineage');
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const populatedUpgrade = (await db.exec(await personalWorkingBridgeUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(populatedUpgrade[0]?.personalWorkingBridgeUpgrade, /^PASS: every populated old/);
    // Independently challenge the verifier with exact-count row replacement
    // and an unapproved extra byte in a body already allowed to change.
    for (const [label, sql] of [
      ['populated native Item row', "update public.items set title=title||' unapproved mutation';"],
      ['extra approved-ranker body', `do $unexpected$ declare p record;begin
        select pg_get_functiondef(oid) definition,prosrc into strict p from pg_proc
          where oid='private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)'::regprocedure;
        execute replace(p.definition,p.prosrc,p.prosrc||E'\\n-- extra unapproved source');end;$unexpected$;`],
    ]) {
      try {
        await assert.rejects(db.exec(await personalWorkingBridgeUpgradeSql({ ...files[index], sql: files[index].sql + '\n' + sql })),
          /changed|approved|preserv/i, `${label} escaped reusable populated-upgrade preservation`);
      } finally { await db.exec('rollback;'); }
    }
    await db.exec(`begin;${await personalNativeDecayFixtureSql()}`);

    const actor = uuid(1), other = uuid(2), shared = uuid(10), sessionId = uuid(11), otherSession = uuid(12);
    for (const id of [actor, other]) await db.query(`insert into auth.users(id,email,raw_user_meta_data)
      values($1,$2,jsonb_build_object('kajo_nickname',$3::text))`, [id, `${id}@example.invalid`, `Bridge ${id.slice(-2)}`]);
    const personal = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).rows[0].id;
    const otherPersonal = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [other])).rows[0].id;
    await db.query("insert into public.profiles(id,profile_type,name) values($1,'SHARED','Working shared control')", [shared]);
    await db.query('insert into public.profile_members(profile_id,user_id) values($1,$2),($1,$3)', [shared, actor, other]);
    // Keep the populated historical fixture intact but out of the new candidate pool.
    await db.exec('update public.items set discoverable=false;');
    const evidence = [40, 41].map(uuid);
    const candidates = Array.from({ length: 12 }, (_, n) => uuid(50 + n));
    const movies = [70, 71, 72, 73].map(uuid);
    for (const [n, id] of [...evidence, ...candidates, ...movies].entries()) {
      const tags = n < 2 ? ['bridge-warm'] : n % 3 === 0 ? ['bridge-cold']
        : n % 3 === 1 ? ['bridge-warm', 'bridge-cold'] : ['bridge-warm'];
      await db.query(`insert into public.items(id,item_type,title,tags,discoverable)
        values($1,$2,$3,$4,$5)`, [id, movies.includes(id) ? 'MOVIE' : 'BOOK', `Bridge Item ${n}`, tags, !evidence.includes(id)]);
    }
    const clock = Number((await db.query('select extract(epoch from now())*1000 clock')).rows[0].clock);
    const iso = offset => new Date(clock + offset).toISOString();
    let actionNumber = 1000;
    let requestNumber = 2000;
    const request = (version = 3, itemType = 'BOOK', cursor = undefined, session = sessionId, profile = personal, mode = 'FOR_YOU') => ({
      version, requestId: uuid(requestNumber++), profileId: profile, sessionId: session, discoveryMode: mode,
      itemType, limit: 2, context: {}, ...(cursor === undefined ? {} : { cursor }),
    });
    const command = (itemId, offset, payload, session = sessionId, profile = personal, acting = actor) => ({
      version: 1, actionId: uuid(actionNumber++), actorUserId: acting, profileId: profile, itemId,
      occurredAt: iso(offset), discoveryMode: 'FOR_YOU', predictionId: null,
      session: { sessionId: session, startedAt: iso(-300_000), context: {} }, ...payload,
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
    const adjustment = async (state, tags = ['bridge-warm'], control = undefined) => Number((await db.query(
      `select private.personal_working_adjustment_v1($1::jsonb,$2::text[]${control === undefined ? '' : ',$3::text'}) value`,
      [JSON.stringify(state), tags, ...(control === undefined ? [] : [control])])).rows[0].value);
    const compare = async (sourceId, control, acting = actor) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [acting]);
      return (await db.query('select private.record_personal_working_shadow_v1($1,$2) value', [sourceId, control])).rows[0].value;
    };
    const rows = async (sourceId) => (await db.query(`select item_id,final_score,final_rank,selected_for_delivery,explanation,
      private.prediction_delivery_tier_v1(explanation->'resurfacingPolicy') tier,
      coalesce((explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) eligible
      from private.prediction_candidates where prediction_id=$1 order by final_rank`, [sourceId])).rows;
    const run = async sourceId => (await db.query('select to_jsonb(r) value from private.prediction_runs r where id=$1', [sourceId])).rows[0]?.value;
    const reject = async (operation, pattern) => {
      await db.exec('savepoint expected_rejection;');
      try { await assert.rejects(operation, pattern); }
      finally { await db.exec('rollback to savepoint expected_rejection;release savepoint expected_rejection;'); }
    };
    const savepointTest = async (label, operation) => t.test(label, async () => {
      await db.exec('savepoint working_case;');
      try { await operation(); }
      finally { await db.exec('rollback to savepoint working_case;release savepoint working_case;'); }
    });
    const oracle = async state => {
      const portable = deriveWorkingState(normalizeKajoWorkingSession({ profile: state.profile,
        actorUserId: state.actorUserId, session: state.session, events: state.rawEvents, objects: state.itemFeatures,
        featureSchema: state.featureSchema, asOf: state.asOf, prefixComplete: state.prefixComplete, refs: state.refs }));
      assert.equal(state.status, portable.status, 'Native capture state status must match independent portable replay');
      assert.equal(state.support.distinctItems, portable.support.distinctItems);
      assert.equal(state.support.observedRatings, portable.support.observedRatings);
      for (const control of ['OFF', 'STATIC', 'ORDERED']) {
        const object = { id: candidates[0], features: Object.fromEntries(state.featureSchema.dimensions.map(tag =>
          [tag, tag === 'bridge-warm' ? 1 : 0])), availableAt: state.featureSchema.artifact.availableAt,
        artifact: state.featureSchema.artifact };
        near(await adjustment(state, ['bridge-warm'], control),
          scoreWorkingAdjustment({ state: portable, object, control }).value, `SQL/portable ${control}`);
      }
      return portable;
    };

    const first = command(evidence[0], -240_000, { kind: 'SET_RATING', rating: 0 });
    const second = command(evidence[1], -180_000, { kind: 'SET_RATING', rating: 10 });
    const firstReceipt = await actorCall('commit_item_action_v1', first);
    await actorCall('commit_item_action_v1', second);
    const oldRequest = request(2);
    const oldPage = await actorCall('rank_items_page_v1', oldRequest);
    const oldRun = await run(oldPage.predictionId);
    const oldCandidates = await rows(oldPage.predictionId);
    const sharedBefore = (await db.query("select item_id,score,rank,confidence,explanation-'candidatePool' explanation from private.rank_items_v1_internal($1,'FOR_YOU','BOOK',50,'{}')", [shared])).rows;
    const immutableBefore = (await db.query(`select relation,id,body from (
      select 'run' relation,r.id::text id,to_jsonb(r) body from private.prediction_runs r
      union all select 'candidate',c.prediction_id||':'||c.item_id,to_jsonb(c) from private.prediction_candidates c
      union all select 'shadow',r.id::text,to_jsonb(r) from private.shadow_prediction_runs r
      union all select 'shadow_candidate',c.shadow_prediction_id||':'||c.item_id,to_jsonb(c) from private.shadow_prediction_candidates c
      union all select 'event',e.id::text,to_jsonb(e) from public.events e
      union all select 'action_receipt',r.id::text,to_jsonb(r) from private.item_action_receipts r
      union all select 'page_receipt',r.request_id::text,to_jsonb(r) from private.prediction_page_receipts r
      ) all_rows order by relation,id`)).rows;
    const oldFunctions = (await db.query(`select p.oid,p.oid::regprocedure::text identity,to_jsonb(p)-'prosrc' properties,p.prosrc body
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f' order by p.oid`)).rows;
    const oldTables = (await db.query(`select c.oid,to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] properties
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth') and c.relkind='r' order by c.oid`)).rows;
    const oldColumns = (await db.query(`select a.attrelid,a.attnum,to_jsonb(a) properties,to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where n.nspname in('public','private','auth') and c.relkind='r' and a.attnum>0 and not a.attisdropped order by a.attrelid,a.attnum`)).rows;
    // Apply the actual new forward over populated, real old forecasts and shadows.
    await db.exec(files[index].sql);
    assert.deepEqual((await db.query(`select c.oid,to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] properties
      from pg_class c where c.oid=any($1::oid[]) order by c.oid`, [oldTables.map(row => row.oid)])).rows, oldTables,
    'Every existing table keeps identity, owner, ACL, RLS and structural properties');
    assert.deepEqual((await db.query(`select a.attrelid,a.attnum,to_jsonb(a) properties,to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=any($1::oid[]) and a.attnum>0 and not a.attisdropped order by a.attrelid,a.attnum`, [oldTables.map(row => row.oid)])).rows,
    oldColumns, 'Every old column/default retains exact definition, ownership and ACL');
    const expectedFunctions = oldFunctions.map(row => {
      const patch = personalWorkingBridgePatches.find(value => value.signature === row.identity);
      let body = row.body;
      for (const replacement of patch?.replacements ?? []) {
        assert.equal(body.split(replacement.before).length - 1, replacement.count, `${row.identity} independently reviewed exact source anchor`);
        body = body.replaceAll(replacement.before, replacement.after);
      }
      return { ...row, body };
    });
    assert.deepEqual((await db.query(`select p.oid,p.oid::regprocedure::text identity,to_jsonb(p)-'prosrc' properties,p.prosrc body
      from pg_proc p where p.oid=any($1::oid[]) order by p.oid`, [oldFunctions.map(row => row.oid)])).rows, expectedFunctions,
    'All old function OIDs/owner/ACL/configuration survive; only explicitly reviewed body transformations are allowed');
    assert.deepEqual(await actorCall('rank_items_page_v1', oldRequest), oldPage);
    assert.deepEqual(await run(oldPage.predictionId), oldRun);
    assert.deepEqual(await rows(oldPage.predictionId), oldCandidates);
    const immutableAfter = (await db.query(`select relation,id,body from (
      select 'run' relation,r.id::text id,to_jsonb(r) body from private.prediction_runs r
      union all select 'candidate',c.prediction_id||':'||c.item_id,to_jsonb(c) from private.prediction_candidates c
      union all select 'shadow',r.id::text,to_jsonb(r) from private.shadow_prediction_runs r
      union all select 'shadow_candidate',c.shadow_prediction_id||':'||c.item_id,to_jsonb(c) from private.shadow_prediction_candidates c
      union all select 'event',e.id::text,to_jsonb(e) from public.events e
      union all select 'action_receipt',r.id::text,to_jsonb(r) from private.item_action_receipts r
      union all select 'page_receipt',r.request_id::text,to_jsonb(r) from private.prediction_page_receipts r
      ) all_rows order by relation,id`)).rows;
    assert.deepEqual(immutableAfter, immutableBefore, 'Forward/retry must preserve all populated old artifacts byte for byte');
    assert.deepEqual((await db.query("select item_id,score,rank,confidence,explanation-'candidatePool' explanation from private.rank_items_v1_internal($1,'FOR_YOU','BOOK',50,'{}')", [shared])).rows,
      sharedBefore, 'Shared scoring receives no Personal Working feature or score change');

    await savepointTest('actual zero/positive command prefix has exact independent ordered/static/off oracles', async () => {
      assert.deepEqual(await actorCall('commit_item_action_v1', first), firstReceipt);
      const state = await capture();
      assert.equal(state.version, 'native-working-capture-v1');
      assert.equal(state.stateVersion, 'working-state-v1');
      assert.equal(state.status, 'ACTIVE');
      assert.equal(state.prefixComplete, true);
      assert.equal(state.commitAvailability, 'UNKNOWN');
      assert.equal(state.historicalFeatureEligible, false);
      assert.equal(state.learnable, false);
      assert.equal(state.rawEvents.find(event => event.id === first.actionId).properties.rating, 0);
      const portable = await oracle(state);
      assert.equal(portable.support.distinctItems, 2);
      near(await adjustment(state, ['bridge-warm'], 'ORDERED'),
        0.25 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2), 'Independent two-group ordered oracle');
      assert.equal(await adjustment(state, ['bridge-warm'], 'STATIC'), 0);
      assert.equal(await adjustment(state), 0, 'Default adjustment must be exact zero');
      assert.equal(await adjustment(state, ['unseen-tag'], 'ORDERED'), 0);
      assert.equal(await adjustment(state, [], 'ORDERED'), 0);
      await reject(() => adjustment(state, ['bridge-warm'], 'UNKNOWN'), /control|invalid/i);
    });

    await savepointTest('new BOOK/MOVIE V2/V3 runs capture before scoring and default OFF exactly preserves baseline', async () => {
      for (const protocol of [2, 3]) for (const domain of ['BOOK', 'MOVIE']) for (const mode of ['FOR_YOU', 'SURPRISE', 'RISK']) {
        const pageRequest = request(protocol, domain, undefined, sessionId, personal, mode);
        const page = await actorCall('rank_items_page_v1', pageRequest);
        const source = await run(page.predictionId);
        assert.equal(source.state_snapshot.workingState.version, 'native-working-capture-v1');
        assert.equal(source.state_snapshot.workingState.status, 'ACTIVE');
        const pool = await rows(page.predictionId);
        const off = await compare(page.predictionId, 'OFF');
        assert.equal(off.control, 'OFF');
        assert.equal(off.candidates.length, pool.length);
        assert.deepEqual(off.candidates.map(row => ({ itemId: row.itemId, score: row.score, rank: row.rank,
          eligible: row.eligible, tier: row.tier, selected: row.selected, adjustment: row.adjustment })),
        pool.map(row => ({ itemId: row.item_id, score: row.final_score, rank: row.final_rank,
          eligible: row.eligible, tier: row.tier, selected: row.selected_for_delivery, adjustment: 0 })),
        'OFF preserves exact complete candidate set, scores, ranks, hard policy tier and selection');
        for (const candidate of pool) {
          const feature = candidate.explanation.workingIntent;
          assert.equal(feature.version, 'personal-working-features-v1');
          assert.equal(feature.control, 'OFF');
          const scorer = (await db.query(`select
            private.prediction_candidate_score_v2($4,$1::jsonb,scenario_score,g.config) baseline,
            private.prediction_candidate_score_working_v1($4,$1::jsonb,scenario_score,g.config) working
            from private.prediction_candidates c cross join private.predictor_genomes g
            where c.prediction_id=$2 and c.item_id=$3 and g.id=md5('kajo:predictor-genome:prediction-v1-baseline')::uuid`,
          [JSON.stringify(candidate.explanation), page.predictionId, candidate.item_id, mode])).rows[0];
          assert.equal(scorer.working, scorer.baseline, 'Versioned pure default-OFF scorer returns the exact baseline number');
        }
        assert.deepEqual(await compare(page.predictionId, 'OFF'), off, 'Exact shadow retry is deterministic');
        assert.deepEqual(await actorCall('rank_items_page_v1', pageRequest), page, 'Exact source retry returns frozen receipt');
        assert.deepEqual(await run(page.predictionId), source);
        assert.deepEqual(await rows(page.predictionId), pool);
      }
    });

    await savepointTest('visible own corrections/UNDO/selective clears alter only future captures', async () => {
      const before = await capture();
      const sourceRequest = request();
      const page = await actorCall('rank_items_page_v1', sourceRequest);
      const source = await run(page.predictionId);
      const oldOrdered = await compare(page.predictionId, 'ORDERED');
      const change = command(evidence[0], -120_000, { kind: 'SET_RATING', rating: 10 });
      await actorCall('commit_item_action_v1', change);
      const positive = await capture();
      await oracle(positive);
      assert.equal(await adjustment(positive, ['bridge-warm'], 'ORDERED'), 0.25);
      assert.equal(await adjustment(before, ['bridge-warm'], 'ORDERED'),
        await adjustment(source.state_snapshot.workingState, ['bridge-warm'], 'ORDERED'));
      await actorCall('commit_item_action_v1', command(evidence[0], -110_000,
        { kind: 'UNDO', reversesActionId: change.actionId }, otherSession));
      const restored = await capture();
      await oracle(restored);
      near(await adjustment(restored, ['bridge-warm'], 'ORDERED'), await adjustment(before, ['bridge-warm'], 'ORDERED'), 'Cross-session exact UNDO restores zero');
      const cross = command(evidence[0], -100_000, { kind: 'SET_RATING', rating: 10 }, otherSession);
      await actorCall('commit_item_action_v1', cross);
      assert.equal((await capture()).support.distinctItems, 1, 'Foreign-session taste removes stale intent but supplies no support');
      await oracle(await capture());
      await actorCall('commit_item_action_v1', command(evidence[0], -90_000, { kind: 'UNDO', reversesActionId: cross.actionId }, otherSession));
      assert.equal((await capture()).support.distinctItems, 2);
      await actorCall('commit_collection_action_v1', command(evidence[0], -80_000, { kind: 'CLEAR_HISTORY', source: 'LISTS' }, otherSession));
      assert.equal((await capture()).support.distinctItems, 1);
      await actorCall('commit_item_action_v1', command(evidence[1], -70_000, { kind: 'SET_NOT_INTERESTED', notInterested: true }));
      await actorCall('commit_collection_action_v1', command(evidence[1], -60_000, { kind: 'CLEAR_HISTORY', source: 'LISTS' }, otherSession));
      const negative = await capture();
      await oracle(negative);
      assert.equal(negative.support.explicitNegativeItems, 1, 'History clear preserves canonical negative slot');
      await actorCall('commit_item_action_v1', command(evidence[1], -50_000, { kind: 'SET_NOT_INTERESTED', notInterested: false }, otherSession));
      assert.equal((await capture()).support.distinctItems, 0, 'Interest clear cannot revive replaced rating');
      assert.deepEqual(await compare(page.predictionId, 'ORDERED'), oldOrdered);
      assert.deepEqual(await run(page.predictionId), source);
      assert.deepEqual(await actorCall('rank_items_page_v1', sourceRequest), page);
      assert.deepEqual((await db.query('select result from private.item_action_receipts where id=$1', [first.actionId])).rows[0].result, firstReceipt);
    });

    await savepointTest('V2 copied continuation keeps root capture while V3 captures the fresh page prefix', async () => {
      const v2Request = request(2), v3Request = request(3);
      const v2 = await actorCall('rank_items_page_v1', v2Request);
      const v3 = await actorCall('rank_items_page_v1', v3Request);
      assert.ok(v2.nextCursor && v3.nextCursor, 'Both real continuation protocols retain an eligible next page');
      const v2State = (await run(v2.predictionId)).state_snapshot.workingState;
      const v3State = (await run(v3.predictionId)).state_snapshot.workingState;
      const v3Ordered = await compare(v3.predictionId, 'ORDERED');
      await actorCall('commit_item_action_v1', command(evidence[0], -100_000, { kind: 'SET_RATING', rating: 10 }));
      const v2NextRequest = request(2, 'BOOK', v2.nextCursor);
      const v3NextRequest = request(3, 'BOOK', v3.nextCursor);
      const v2Next = await actorCall('rank_items_page_v1', v2NextRequest);
      const v3Next = await actorCall('rank_items_page_v1', v3NextRequest);
      assert.deepEqual((await run(v2Next.predictionId)).state_snapshot.workingState, v2State,
        'V2 is a copied frozen source slice, including its exact old Working capture');
      const v2Copied = await rows(v2Next.predictionId);
      const v2Off = await compare(v2Next.predictionId, 'OFF');
      assert.deepEqual(v2Off.candidates.map(row => [row.itemId, row.score, row.rank, row.tier, row.eligible, row.selected]),
        v2Copied.map(row => [row.item_id, row.final_score, row.final_rank, row.tier, row.eligible, row.selected_for_delivery]),
      'OFF comparison also preserves the actual copied continuation Item/score/rank/policy/selection slice');
      const fresh = (await run(v3Next.predictionId)).state_snapshot.workingState;
      assert.notDeepEqual(fresh, v3State, 'V3 genuinely fresh scoring takes a new authorized capture');
      assert.equal(await adjustment(fresh, ['bridge-warm'], 'ORDERED'), 0.25);
      assert.deepEqual(await compare(v3.predictionId, 'ORDERED'), v3Ordered);
      assert.deepEqual(await actorCall('rank_items_page_v1', v2NextRequest), v2Next);
      assert.deepEqual(await actorCall('rank_items_page_v1', v3NextRequest), v3Next);
    });

    await savepointTest('cutoff, no session, ownership, passive attention and expiry remain explicit', async () => {
      const state = await capture();
      const frozenCutoff = state.cutoff;
      const availableLater = command(evidence[0], -100_000, { kind: 'SET_RATING', rating: 10 });
      await actorCall('commit_item_action_v1', availableLater);
      // NOW() is the transaction-start proxy. Give this newly allocated test
      // Event the stored creation instant of a later transaction, independently
      // of its earlier occurrence; commit-time availability remains unknown.
      await db.query('update public.events set created_at=clock_timestamp() where id=$1', [availableLater.actionId]);
      const oldPrefix = await capture(sessionId, frozenCutoff);
      assert.deepEqual(oldPrefix.rawEvents, state.rawEvents, 'Stored-created cutoff excludes subsequently available correction');
      assert.deepEqual(oldPrefix.items, state.items);
      assert.deepEqual(oldPrefix.vectors, state.vectors);
      assert.equal((await capture(null)).status, 'NO_SESSION');
      assert.equal((await capture(uuid(999))).status, 'NO_SESSION');
      assert.equal(await adjustment(await capture(null), ['bridge-warm'], 'ORDERED'), 0);
      assert.equal((await capture(sessionId, iso(4 * 60 * 60_000))).status, 'SESSION_EXPIRED');
      assert.equal((await capture(sessionId, iso(31 * 60_000))).status, 'IDLE_EXPIRED');
      await reject(() => capture(sessionId, null, personal, other), error => error.code === '42501');
      await reject(() => capture(otherSession, null, otherPersonal, actor), error => error.code === '42501');
      await reject(() => capture(sessionId, 'infinity'), error => error.code === '22023');
      await reject(() => capture(sessionId, '-infinity'), error => error.code === '22023');
      assert.equal(await capture(sessionId, null, shared), null, 'Shared never inherits its member Personal Working capture');
      await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties,session_id)
        values($1,$2,$3,$4,'BOOK','ITEM_RATED',$5,'{"rating":0}',$6)`, [uuid(actionNumber++), other, personal, evidence[1], iso(-50_000), null]);
      assert.equal(await adjustment(await capture(), ['bridge-warm'], 'ORDERED'), 0.25,
        'Foreign actor row in this Profile cannot enter ownership-complete closure');
      await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties,session_id)
        values($1,$2,$3,$4,'BOOK','ITEM_RATED',$5,'{"rating":0}',$6)`, [uuid(actionNumber++), actor, personal, evidence[1], iso(60_000), sessionId]);
      assert.equal(await adjustment(await capture(), ['bridge-warm'], 'ORDERED'), 0.25, 'Future occurrence is outside capture');
    });

    await savepointTest('complete prefix overflow abstains without a truncated active state', async () => {
      await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties,session_id)
        select md5('working-overflow:'||n)::uuid,$1,$2,$3,'BOOK','ITEM_RATED',now()-interval '1 minute',
          '{"rating":10}',$4 from generate_series(1,129) n`, [actor, personal, evidence[0], sessionId]);
      const overflow = await capture();
      assert.equal(overflow.status, 'BUDGET_EXCEEDED');
      assert.equal(overflow.prefixComplete, false);
      assert.deepEqual(overflow.rawEvents, []);
      assert.deepEqual(overflow.itemFeatures, []);
      assert.equal(await adjustment(overflow, ['bridge-warm'], 'ORDERED'), 0);
      const page = await actorCall('rank_items_page_v1', request());
      assert.equal((await run(page.predictionId)).state_snapshot.workingState.status, 'BUDGET_EXCEEDED');
      const off = await compare(page.predictionId, 'OFF');
      const ordered = await compare(page.predictionId, 'ORDERED');
      assert.deepEqual(ordered.candidates.map(row => [row.itemId, row.score, row.rank, row.selected]),
        off.candidates.map(row => [row.itemId, row.score, row.rank, row.selected]));
    });

    await savepointTest('legacy source unsupported by the portable component leaves real OFF serving available', async () => {
      const inactivePage = async label => {
        const inactive = await capture();
        assert.equal(inactive.status, 'INPUT_UNAVAILABLE', label);
        assert.equal(inactive.prefixComplete, false);
        assert.deepEqual(inactive.rawEvents, []);
        assert.deepEqual(inactive.itemFeatures, []);
        assert.equal(await adjustment(inactive, ['bridge-warm'], 'ORDERED'), 0);
        for (const protocol of [2, 3]) {
          const page = await actorCall('rank_items_page_v1', request(protocol));
          const pool = await rows(page.predictionId);
          assert.ok(pool.length > 0, `${label}: ordinary ${protocol} native page stays available`);
          const baseline = await compare(page.predictionId, 'OFF');
          const ordered = await compare(page.predictionId, 'ORDERED');
          assert.deepEqual(baseline.candidates.map(row => [row.itemId, row.score, row.rank, row.tier, row.eligible, row.selected]),
            pool.map(row => [row.item_id, row.final_score, row.final_rank, row.tier, row.eligible, row.selected_for_delivery]));
          assert.deepEqual(ordered.candidates, baseline.candidates, `${label}: unavailable component cannot change baseline score/rank/policy`);
        }
      };
      for (const tag of ['x'.repeat(257), '💡'.repeat(129), '', null, 'bad\u0001tag']) {
        await db.exec('savepoint invalid_source;');
        try {
          await db.query('update public.items set tags=$1::text[] where id=$2', [[tag], evidence[0]]);
          await inactivePage(`Legacy unsupported tag ${tag === null ? 'NULL' : JSON.stringify(tag.slice(0, 10))}`);
        } finally { await db.exec('rollback to savepoint invalid_source;release savepoint invalid_source;'); }
      }
      await db.exec('savepoint supported_utf16_dimension;');
      try {
        await db.query('update public.items set tags=$1::text[] where id=$2', [['💡'.repeat(128)], evidence[0]]);
        const utf16Boundary = await capture();
        assert.equal(utf16Boundary.status, 'ACTIVE', 'Exactly 256 UTF16 units is a portable-supported native dimension');
        await oracle(utf16Boundary);
      } finally { await db.exec('rollback to savepoint supported_utf16_dimension;release savepoint supported_utf16_dimension;'); }
      for (const [type, properties, itemType] of [
        ['ITEM_INTERACTION_UNDONE', { reversedEventId: 'not-a-uuid' }, 'BOOK'],
        ['ITEM_RATED', { rating: 10 }, null],
      ]) {
        await db.exec('savepoint invalid_source;');
        try {
          const insert = () => db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties,session_id)
            values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [uuid(actionNumber++), actor, personal, evidence[0], itemType, type, iso(-60_000), JSON.stringify(properties), sessionId]);
          if (itemType === null) {
            await reject(insert, error => error.code === '23514' && error.constraint === 'events_item_identity_complete');
            assert.equal((await capture()).status, 'ACTIVE', 'Existing canonical Item identity guard prevents malformed source from entering capture');
          } else {
            await insert();
            await inactivePage(`Legacy unsupported ${type}/${itemType}`);
          }
        } finally { await db.exec('rollback to savepoint invalid_source;release savepoint invalid_source;'); }
      }
    });

    await savepointTest('distinct Item and feature budgets also reject complete oversized capture rather than slicing it', async () => {
      await db.exec('savepoint feature_budget;');
      await db.query("update public.items set tags=array(select 'dimension-'||n from generate_series(1,33) n) where id=$1", [evidence[0]]);
      const wide = await capture();
      assert.equal(wide.status, 'BUDGET_EXCEEDED');
      assert.equal(wide.budgetExceeded.features, true);
      assert.deepEqual(wide.rawEvents, []);
      assert.deepEqual(wide.itemFeatures, []);
      assert.equal(await adjustment(wide, ['bridge-warm'], 'ORDERED'), 0);
      await db.exec('rollback to savepoint feature_budget;release savepoint feature_budget;');
      const extraIds = Array.from({ length: 33 }, (_, n) => uuid(300 + n));
      for (const id of extraIds) await db.query(`insert into public.items(id,item_type,title,tags,discoverable)
        values($1,'BOOK','Working budget source',array['bridge-warm'],false)`, [id]);
      for (const itemId of extraIds) await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,
        event_type,occurred_at,properties,session_id) values($1,$2,$3,$4,'BOOK','ITEM_RATED',$5,'{"rating":10}',$6)`,
      [uuid(actionNumber++), actor, personal, itemId, iso(-60_000), sessionId]);
      const many = await capture();
      assert.equal(many.status, 'BUDGET_EXCEEDED');
      assert.equal(many.budgetExceeded.items, true);
      assert.deepEqual(many.rawEvents, []);
      assert.deepEqual(many.itemFeatures, []);
      assert.equal(await adjustment(many, ['bridge-warm'], 'ORDERED'), 0);
    });

    await savepointTest('representable PostgreSQL microseconds retain order while precision collapse abstains', async () => {
      await db.query("update public.events set occurred_at=date_trunc('second',now()-interval '1 minute')+interval '1 microsecond' where id=$1", [first.actionId]);
      await db.query("update public.events set occurred_at=date_trunc('second',now()-interval '1 minute')+interval '2 microseconds' where id=$1", [second.actionId]);
      const precise = await capture();
      const portable = await oracle(precise);
      assert.equal(precise.groups.length, 2);
      assert.deepEqual(precise.groups, portable.groups, 'Microseconds survive the same decimal-millisecond conversion as the portable normalizer');
      near(await adjustment(precise, ['bridge-warm'], 'ORDERED'),
        0.25 * (1 - Math.SQRT1_2) / (1 + Math.SQRT1_2), 'Microsecond semantic group order');
      await db.query("update public.event_sessions set started_at='2300-01-01 00:00:00+00' where id=$1", [sessionId]);
      await db.query("update public.events set occurred_at='2300-01-01 00:01:00.000001+00' where id=$1", [first.actionId]);
      await db.query("update public.events set occurred_at='2300-01-01 00:01:00.000002+00' where id=$1", [second.actionId]);
      const collapsed = await capture(sessionId, '2300-01-01T00:02:00.000Z');
      assert.equal(collapsed.status, 'INPUT_UNAVAILABLE');
      assert.equal(collapsed.inputUnavailableReason, 'TIMESTAMP_PRECISION_COLLAPSE');
      assert.equal(collapsed.prefixComplete, false);
      assert.deepEqual(collapsed.rawEvents, []);
      assert.equal(await adjustment(collapsed, ['bridge-warm'], 'ORDERED'), 0);
    });

    await savepointTest('seeded mixed native prefixes replay exact portable tie/correction/attention and expiry semantics', async () => {
      let seed = 7235;
      const random = n => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
      const selectedSession = uuid(90), foreignSession = uuid(91);
      const sampledItems = [evidence[0], candidates[1], candidates[2]];
      for (const selected of [selectedSession, foreignSession]) await db.query(`insert into public.event_sessions
        (id,actor_user_id,profile_id,started_at,context) values($1,$2,$3,$4,'{}')`, [selected, other, otherPersonal, iso(-300_000)]);
      for (let sample = 0; sample < 24; sample++) {
        await db.query('delete from public.events where profile_id=$1', [otherPersonal]);
        const records = [];
        for (let index = 0; index < 20; index++) {
          const itemId = sampledItems[random(sampledItems.length)];
          const chosenSession = random(4) === 0 ? foreignSession : selectedSession;
          const minute = random(18) - 2;
          let eventType = ['ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_HISTORY_CLEARED', 'ITEM_INTEREST_CLEARED', 'ITEM_OPENED'][random(5)];
          let properties = eventType === 'ITEM_RATED' ? { rating: random(11) } : {};
          const eligible = records.filter(row => row.itemId === itemId && row.eventType !== 'ITEM_INTERACTION_UNDONE');
          if (random(7) === 0 && eligible.length) {
            eventType = 'ITEM_INTERACTION_UNDONE';
            properties = { reversedEventId: eligible[random(eligible.length)].id };
          }
          const id = uuid(actionNumber++);
          records.push({ id, itemId, eventType });
          await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,
            occurred_at,properties,session_id) values($1,$2,$3,$4,'BOOK',$5,$6,$7::jsonb,$8)`,
          [id, other, otherPersonal, itemId, eventType, iso(-300_000 + minute * 60_000), JSON.stringify(properties), chosenSession]);
        }
        const state = await capture(selectedSession, iso(-300_000 + [60, 20, 240][sample % 3] * 60_000), otherPersonal, other);
        const portable = await oracle(state);
        for (const key of ['items', 'groups', 'support', 'exclusions']) assert.deepEqual(state[key], portable[key],
          `Seed 7235 sample ${sample} exact ${key} portable parity`);
        nearVectors(state.vectors, portable.vectors, `Seed 7235 sample ${sample} bounded numeric vector parity`);
      }
      t.diagnostic('24 deterministic native prefixes / 480 mixed Events / 72 explicit control numeric oracles');
    });

    await savepointTest('private comparison rows replay frozen inputs, deny API roles and close source/actor/Profile erasure', async () => {
      const page = await actorCall('rank_items_page_v1', request());
      const source = await run(page.predictionId);
      const pool = await rows(page.predictionId);
      const controls = {};
      for (const control of ['OFF', 'STATIC', 'ORDERED']) controls[control] = await compare(page.predictionId, control);
      assert.equal((await db.query('select count(*)::integer n from private.personal_working_shadow_comparisons where source_prediction_id=$1', [page.predictionId])).rows[0].n, 3);
      const frozenRows = (await db.query('select to_jsonb(c) value from private.personal_working_shadow_comparisons c where source_prediction_id=$1 order by control', [page.predictionId])).rows;
      await actorCall('commit_item_action_v1', command(evidence[0], -100_000, { kind: 'SET_RATING', rating: 10 }));
      await db.exec("update public.items set tags=array['future-unrelated'],discoverable=false;");
      for (const control of ['OFF', 'STATIC', 'ORDERED']) assert.deepEqual(await compare(page.predictionId, control), controls[control]);
      assert.deepEqual((await db.query('select to_jsonb(c) value from private.personal_working_shadow_comparisons c where source_prediction_id=$1 order by control', [page.predictionId])).rows, frozenRows);
      assert.deepEqual(await run(page.predictionId), source);
      assert.deepEqual(await rows(page.predictionId), pool);
      await reject(() => compare(page.predictionId, 'OFF', other), error => error.code === '42501');
      await reject(() => compare(page.predictionId, 'UNKNOWN'), /control|invalid/i);
      await reject(() => compare(oldPage.predictionId, 'ORDERED'), /working|capture|feature|unsupported/i);
      for (const role of ['anon', 'authenticated', 'service_role']) for (const signature of [
        'private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamptz)',
        'private.personal_working_adjustment_v1(jsonb,text[],text)',
        'private.personal_working_explanation_v1(jsonb,text[])',
        'private.prediction_candidate_score_working_v1(text,jsonb,double precision,jsonb,text)',
        'private.guard_personal_working_comparison_v1()',
        'private.record_personal_working_shadow_v1(uuid,text)',
      ]) assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, signature])).rows[0].allowed,
        false, `${role} cannot invoke ${signature}`);
      for (const role of ['anon', 'authenticated', 'service_role']) assert.equal((await db.query(
        "select has_table_privilege($1,'private.personal_working_shadow_comparisons','SELECT,INSERT,UPDATE,DELETE') allowed", [role])).rows[0].allowed, false);
      await reject(() => db.query('update private.personal_working_shadow_comparisons set result=result where source_prediction_id=$1', [page.predictionId]), /immutable/i);
      await reject(() => db.query('delete from private.personal_working_shadow_comparisons where source_prediction_id=$1', [page.predictionId]), /immutable/i);
      for (const [scope, id] of [['PREDICTION_RUN', page.predictionId], ['PROFILE', personal], ['ACTOR', actor]]) {
        await db.exec('savepoint source_erasure_case;');
        try {
          const oldOtherRows = (await db.query('select to_jsonb(r) value from private.prediction_runs r where actor_user_id<>$1 and profile_id<>$2 order by id', [actor, personal])).rows;
          await db.query('select private.erase_prediction_sources_v1($1,$2)', [scope, id]);
          assert.equal((await db.query('select count(*)::integer n from private.personal_working_shadow_comparisons where source_prediction_id=$1', [page.predictionId])).rows[0].n, 0,
            `${scope} erasure must remove every frozen derived comparison`);
          assert.deepEqual((await db.query('select to_jsonb(r) value from private.prediction_runs r where actor_user_id<>$1 and profile_id<>$2 order by id', [actor, personal])).rows,
            oldOtherRows, 'Owned erasure must preserve unrelated historical sources');
        } finally { await db.exec('rollback to savepoint source_erasure_case;release savepoint source_erasure_case;'); }
      }
    });
    await db.exec('rollback;');
    // The upgrade itself was rollback-tested with the owned fixture. Install
    // its empty lineage separately before checking the newly introduced table.
    await db.exec(`begin;${files[index].sql}commit;`);
    for (const table of ['auth.users', 'public.events', 'public.item_interactions', 'public.event_sessions',
      'private.prediction_runs', 'private.prediction_candidates', 'private.shadow_prediction_runs',
      'private.shadow_prediction_candidates', 'private.prediction_page_receipts', 'private.personal_working_shadow_comparisons']) {
      assert.equal((await db.query(`select count(*)::integer n from ${table}`)).rows[0].n, 0, `${table} escaped rollback`);
    }
    const nativeSmoke = (await db.exec(await personalWorkingBridgeSmokeSql())).flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(nativeSmoke[0]?.personalWorkingBridge, /^PASS: actual canonical native Personal capture/);
  } finally { await db.close(); }
});
