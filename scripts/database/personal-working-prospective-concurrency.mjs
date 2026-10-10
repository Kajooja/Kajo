import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const id = n => `a9173000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actors = [1, 2, 3, 4].map(id), sessions = [10, 11, 12, 13].map(id);
const evidenceItems = [20, 21].map(id), candidateItems = [22, 23, 24, 25].map(id);
const plans = [30, 31, 32, 33].map(id), requests = [40, 41, 42, 43].map(id);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const array = values => `array[${values.map(value => `${quote(value)}::uuid`).join(',')}]`;
const json = value => `${quote(JSON.stringify(value))}::jsonb`;
const profile = index => `(select id from public.profiles where owner_user_id='${actors[index]}' and profile_type='PERSONAL')`;
const relations = ['auth.users', 'public.users', 'public.profiles', 'public.profile_members', 'public.items',
  'public.events', 'public.event_sessions', 'public.item_interactions', 'private.item_action_receipts', 'private.item_action_heads',
  'private.prediction_runs', 'private.prediction_candidates', 'private.prediction_page_receipts',
  'private.prediction_continuation_windows', 'private.prediction_page_contexts', 'private.prediction_catalog_chains',
  'private.prediction_catalog_chain_pages', 'private.prediction_catalog_chain_cursors', 'private.personal_working_shadow_comparisons',
  'private.personal_working_enrollments', 'private.personal_working_outcome_allocations',
  'private.personal_working_outcome_captures', 'private.personal_working_outcome_event_refs'];

export function personalWorkingProspectiveCanonicalEvidenceSql() {
  return `select jsonb_object_agg(identity,snapshot) from (${relations.map(relation => `select '${relation}' identity,
    jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) snapshot
    from ${relation} r`).join(' union all ')}) snapshots;`;
}

export function personalWorkingProspectiveNativeFixtureSql() {
  return `begin;
    insert into auth.users(id,email,raw_user_meta_data)
      select actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Prospect race '||right(actor::text,4))
      from unnest(${array(actors)}) actor;
    insert into public.items(id,item_type,title,tags,discoverable)
      select item,'BOOK','Native prospective fixture '||right(item::text,4),array['native-prospective-lock'],false
      from unnest(${array(evidenceItems)}) item;
    insert into public.items(id,item_type,title,tags,discoverable)
      select item,'BOOK','Native prospective candidate '||right(item::text,4),array['native-prospective-lock'],true
      from unnest(${array(candidateItems)}) item;
    insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      select fixture.session,fixture.actor,p.id,date_trunc('milliseconds',clock_timestamp())-interval '5 minutes','{}'
      from (values ${actors.map((actor, index) => `('${actor}'::uuid,'${sessions[index]}'::uuid)`).join(',')}) fixture(actor,session)
      join public.profiles p on p.owner_user_id=fixture.actor and p.profile_type='PERSONAL';
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,discovery_mode,properties)
      select gen_random_uuid(),p.owner_user_id,p.id,e.item,'BOOK','ITEM_RATED',clock_timestamp()-interval '3 minutes',
        s.id,'FOR_YOU',jsonb_build_object('rating',e.rating)
      from public.profiles p join public.event_sessions s on s.profile_id=p.id
      cross join (values ('${evidenceItems[0]}'::uuid,0),('${evidenceItems[1]}'::uuid,10)) e(item,rating)
      where p.owner_user_id=any(${array(actors)}) and s.id=any(${array(sessions)});
    commit;`;
}

export function personalWorkingProspectiveNativeSourcesSql() {
  return actors.map((actor, index) => `begin;set local request.jwt.claim.sub='${actor}';
    select public.rank_items_page_v1(jsonb_build_object('version',3,'requestId','${requests[index]}',
      'profileId',${profile(index)},'sessionId','${sessions[index]}','discoveryMode','FOR_YOU','itemType','BOOK','limit',2,'context','{}'::jsonb));
    commit;`).join('\n');
}

export function personalWorkingProspectiveNativeCleanupSql() {
  return `begin;
    do $cleanup$ declare actor uuid;begin foreach actor in array ${array(actors)} loop
      if exists(select 1 from public.users where id=actor) then perform private.erase_prediction_sources_v1('ACTOR',actor);end if;
    end loop;end;$cleanup$;
    delete from public.item_interactions where actor_user_id=any(${array(actors)});
    delete from auth.users where id=any(${array(actors)});
    delete from public.items where id=any(${array([...evidenceItems, ...candidateItems])});
    select jsonb_build_object('users',(select count(*) from auth.users where id=any(${array(actors)})),
      'events',(select count(*) from public.events where actor_user_id=any(${array(actors)})),
      'sources',(select count(*) from private.prediction_runs where actor_user_id=any(${array(actors)})),
      'plans',(select count(*) from private.personal_working_enrollments where actor_user_id=any(${array(actors)})),
      'captures',(select count(*) from private.personal_working_outcome_captures c join private.personal_working_enrollments e
        on e.id=c.enrollment_id where e.actor_user_id=any(${array(actors)})),
      'items',(select count(*) from public.items where id=any(${array([...evidenceItems, ...candidateItems])})));
    commit;`;
}

/** Independently connected real PostgreSQL sessions; PGlite cannot certify these locks. */
export async function verifyPersonalWorkingProspectiveConcurrency(execConcurrentSql) {
  const exec = (sql, stage, timeoutMs = 30_000) => execConcurrentSql(sql, { stage, timeoutMs });
  const active = [], proofs = [];
  let original, fixtureAttempted = false, failure, result;
  const hold = `do $hold$ begin begin perform pg_sleep(45);exception when query_canceled then null;end;end;$hold$;`;
  const transaction = (name, index, expression, held = false, rejection = false) => `begin;
    set local application_name='${name}';set local request.jwt.claim.sub='${actors[index]}';
    ${rejection ? `do $reject$ declare value jsonb;rejected text;begin
      begin value:=${expression};exception when others then rejected:=sqlstate;end;
      if rejected is null then raise exception 'Native prospective expected rejection';end if;
      perform set_config('kajo.prospective_result',jsonb_build_object('rejected',rejected)::text,true);end;$reject$;
      select current_setting('kajo.prospective_result')::jsonb;`
    : `with response as materialized(select ${expression} value) select jsonb_build_object('value',value,
      'utf8',encode(convert_to(value::text,'UTF8'),'hex')) from response;`}
    ${held ? hold : ''}commit;`;
  function launch(name, sql, stage, held = false) {
    const session = { name, held };
    active.push(session);
    session.promise = exec(sql, stage, 60_000).then(value => (session.state = { value }), error => (session.state = { error }));
    return session;
  }
  async function finish(session) { const state = await session.promise;if (state.error) throw state.error;return state.value; }
  async function observe(session, blocker = null, requiredMode = null, lockType = 'advisory') {
    const until = Date.now() + 8000;
    while (Date.now() < until) {
      const [state] = await exec(`do $refresh$ begin perform pg_stat_clear_snapshot();end;$refresh$;
        select coalesce((select jsonb_build_object('pid',a.pid,'waitEvent',a.wait_event,'waitEventType',a.wait_event_type,
          'blockers',to_jsonb(pg_blocking_pids(a.pid))) from pg_stat_activity a
          where a.application_name='${session.name}' and a.state='active'
          ${blocker ? `and a.wait_event_type='Lock' and ${blocker.pid}=any(pg_blocking_pids(a.pid))` : "and a.wait_event='PgSleep'"}
          ${requiredMode ? `and exists(select 1 from pg_locks l where l.pid=a.pid and l.locktype='${lockType}'
            ${lockType === 'advisory' ? 'and l.classid=1946841873::oid and l.objid=232004::oid and l.objsubid=2'
              : "and l.relation='public.events'::regclass"} and l.mode='${requiredMode}' and l.granted=${!blocker})` : ''}),
          'null'::jsonb);`, 'working-prospective-observe-owned-blocker', 10_000);
      if (state !== null) {
        assert.ok(Number.isSafeInteger(state.pid) && state.pid > 0);session.pid = state.pid;
        if (blocker) assert.notEqual(state.pid, blocker.pid);
        return state;
      }
      if (session.state?.error) throw session.state.error;
      assert.equal(session.state, undefined, 'Native participant finished before observed lock boundary');
      await delay(40);
    }
    throw new Error(`Native prospective proof did not observe ${session.name}`);
  }
  async function release(session) {
    if (session.state) return;
    assert.ok(Number.isSafeInteger(session.pid) && session.pid > 0);
    const [released] = await exec(`select coalesce((select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
      where pid=${session.pid} and application_name='${session.name}' and state='active' and wait_event='PgSleep'),'false'::jsonb);`,
    'working-prospective-release-owned-observed-holder');
    assert.equal(released, true);
  }
  const evidence = async stage => (await exec(personalWorkingProspectiveCanonicalEvidenceSql(), stage))[0];
  const enrollment = (index, source, selected) => `private.enroll_personal_working_evaluation_v1('${plans[index]}','${source}',
    ${json([{ pairId: id(60 + index), leftItemId: selected[0], rightItemId: selected[1] }])},30,0)`;
  const action = (index, item) => `public.commit_item_action_v1(jsonb_build_object('version',1,'actionId','${id(70 + index)}',
    'actorUserId','${actors[index]}','profileId',${profile(index)},'itemId','${item}','occurredAt',clock_timestamp(),
    'discoveryMode','FOR_YOU','predictionId',null,'session',jsonb_build_object('sessionId','${sessions[index]}',
      'startedAt',(select started_at from public.event_sessions where id='${sessions[index]}'),'context','{}'::jsonb),
    'kind','SET_RATING','rating',0))`;
  async function paired(order, holder, waitingFactory, holderMode, waiterMode, lockType, assertion) {
    const first = await observe(holder, null, holderMode, lockType === 'relation' ? 'relation' : 'advisory');
    const waiter = waitingFactory();
    const second = await observe(waiter, holder, waiterMode, lockType);
    if (lockType === 'relation') {
      const [ownsExclusive] = await exec(`select to_jsonb(exists(select 1 from pg_locks l where l.pid=${second.pid}
        and l.locktype='advisory' and l.classid=1946841873::oid and l.objid=232004::oid and l.objsubid=2
        and l.mode='ExclusiveLock' and l.granted));`, 'working-prospective-exclusive-before-events-share');
      assert.equal(ownsExclusive, true, 'Enrollment must own lifecycle EXCLUSIVE before waiting for raw Event writers');
    }
    await release(holder);
    await assertion((await finish(holder))[0], (await finish(waiter))[0]);
    proofs.push({ order, holder: first, waiter: second });
  }
  try {
    const [reserved] = await exec(`select jsonb_build_object('users',(select count(*) from auth.users where id=any(${array(actors)})),
      'items',(select count(*) from public.items where id=any(${array([...evidenceItems, ...candidateItems])})),
      'backends',(select count(*) from pg_stat_activity where application_name like 'kajo_prospective_%'));`,
    'working-prospective-reserved-namespace');
    assert.deepEqual(reserved, { users: 0, items: 0, backends: 0 });
    original = await evidence('working-prospective-original-canonical-state');fixtureAttempted = true;
    await exec(personalWorkingProspectiveNativeFixtureSql(), 'working-prospective-owned-fixture');
    const pages = await exec(personalWorkingProspectiveNativeSourcesSql(), 'working-prospective-actual-v3-sources');
    assert.equal(pages.length, 4);
    const sources = pages.map(page => page.predictionId), selected = [];
    for (const source of sources) {
      const [items] = await exec(`select jsonb_agg(item_id order by final_rank) from private.prediction_candidates
        where prediction_id='${source}' and selected_for_delivery;`, 'working-prospective-selected-own-receipt-items');
      assert.equal(items.length, 2);selected.push(items);
    }
    const [preheld] = await exec(`begin;set local request.jwt.claim.sub='${actors[0]}';
      do $lock$ begin perform pg_advisory_xact_lock_shared(1946841873,232004);end;$lock$;
      do $guard$ declare rejected text;begin
        begin perform ${enrollment(0, sources[0], selected[0])};exception when others then rejected:=sqlstate;end;
        if rejected is distinct from '25001' then raise exception 'Native held SHARE enrollment guard failed';end if;
        perform set_config('kajo.prospective_guard',jsonb_build_object('rejected',rejected)::text,true);end;$guard$;
      select current_setting('kajo.prospective_guard')::jsonb;rollback;`, 'working-prospective-preheld-share-native-guard');
    assert.deepEqual(preheld, { rejected: '25001' });
    let name = 'kajo_prospective_action_first';
    let holder = launch(name, transaction(name, 0, action(0, selected[0][0]), true), 'working-prospective-action-share-holder', true);
    await paired('CANONICAL_ACTION_COMMIT_PRECEDES_ENROLLMENT', holder,
      () => launch('kajo_prospective_enroll_after_action', transaction('kajo_prospective_enroll_after_action', 0,
        enrollment(0, sources[0], selected[0]), false, true), 'working-prospective-exclusive-after-action'),
      'ShareLock', 'ExclusiveLock', 'advisory', async (written, rejected) => {
        assert.equal(written.value.version, 1);assert.equal(rejected.rejected, '55000');
      });

    name = 'kajo_prospective_raw_first';
    holder = launch(name, `begin;set local application_name='${name}';
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,discovery_mode,properties)
        values('${id(81)}','${actors[1]}',${profile(1)},'${selected[1][0]}','BOOK','ITEM_RATED',clock_timestamp(),'${sessions[1]}','FOR_YOU','{"rating":0}');
      select jsonb_build_object('written',true);${hold}commit;`, 'working-prospective-raw-event-rowexclusive-holder', true);
    await paired('RAW_EVENT_COMMIT_PRECEDES_ENROLLMENT', holder,
      () => launch('kajo_prospective_enroll_after_raw', transaction('kajo_prospective_enroll_after_raw', 1,
        enrollment(1, sources[1], selected[1]), false, true), 'working-prospective-events-share-after-exclusive'),
      'RowExclusiveLock', 'ShareLock', 'relation', async (written, rejected) => {
        assert.equal(written.written, true);assert.equal(rejected.rejected, '55000');
      });
    assert.match(proofs.at(-1).waiter.waitEvent, /relation/i);

    name = 'kajo_prospective_enroll_first';
    holder = launch(name, transaction(name, 2, enrollment(2, sources[2], selected[2]), true),
      'working-prospective-enrollment-exclusive-holder', true);
    await paired('ENROLLMENT_COMMIT_PRECEDES_CANONICAL_ACTION', holder,
      () => launch('kajo_prospective_action_after_enroll', transaction('kajo_prospective_action_after_enroll', 2,
        action(2, selected[2][0])), 'working-prospective-action-share-waiter'),
      'ExclusiveLock', 'ShareLock', 'advisory', async (enrolled, written) => {
        assert.equal(enrolled.value.version, 'personal-working-enrollment-v1');assert.equal(written.value.version, 1);
        const [separate] = await exec(`select to_jsonb(e.xmin<>p.xmin and e.occurred_at>=p.declared_at)
          from public.events e cross join private.personal_working_enrollments p
          where e.id='${id(72)}' and p.id='${plans[2]}';`, 'working-prospective-post-commit-event-xmin');
        assert.equal(separate, true);
      });

    name = 'kajo_prospective_same_holder';
    holder = launch(name, transaction(name, 3, enrollment(3, sources[3], selected[3]), true),
      'working-prospective-identical-enrollment-holder', true);
    await paired('IDENTICAL_ENROLLMENT_RETURNS_ONE_FROZEN_RECEIPT', holder,
      () => launch('kajo_prospective_same_waiter', transaction('kajo_prospective_same_waiter', 3,
        enrollment(3, sources[3], selected[3])), 'working-prospective-identical-enrollment-waiter'),
      'ExclusiveLock', 'ExclusiveLock', 'advisory', async (first, second) => {
        assert.deepEqual(second.value, first.value);assert.equal(second.utf8, first.utf8);
        const [count] = await exec(`select to_jsonb(count(*)) from private.personal_working_enrollments where id='${plans[3]}';`,
          'working-prospective-one-enrollment-after-race');assert.equal(count, 1);
      });
    result = { status: 'PASS', proofs, servingControl: 'OFF', qualityAdmission: false, nativeActivated: false,
      cases: ['canonical writer shares lifecycle before enrollment exclusive admission',
        'raw Event writer blocks events SHARE after lifecycle exclusive; visible prior evidence rejects enrollment',
        'enrollment commit precedes later canonical Event from a distinct transaction',
        'concurrent same-ID enrollment returns one immutable byte-exact receipt'] };
  } catch (error) { failure = error; }
  finally {
    const cleanupFailures = [];
    for (const session of active.filter(row => row.held && !row.pid && !row.state)) {
      try { await observe(session); } catch (error) { cleanupFailures.push(error); }
    }
    for (const session of active.filter(row => row.held && row.pid && !row.state)) {
      try { await release(session); } catch (error) { cleanupFailures.push(error); }
    }
    for (const session of active) {
      const state = await session.promise;if (state.error && state.error !== failure) cleanupFailures.push(state.error);
    }
    if (fixtureAttempted) {
      try {
        const [remaining] = await exec(personalWorkingProspectiveNativeCleanupSql(), 'working-prospective-owned-cleanup', 60_000);
        assert.deepEqual(remaining, { users: 0, events: 0, sources: 0, plans: 0, captures: 0, items: 0 });
        if (original) assert.deepEqual(await evidence('working-prospective-cleanup-canonical-readback'), original);
      } catch (error) { cleanupFailures.push(error); }
    }
    if (cleanupFailures.length) throw new AggregateError(failure ? [failure, ...cleanupFailures] : cleanupFailures,
      'Native prospective proof retains original, owned-session and cleanup failures');
  }
  if (failure) throw failure;return result;
}
