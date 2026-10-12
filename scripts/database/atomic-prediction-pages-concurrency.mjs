import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Runs only inside the existing disposable native CI stack. Real independent
// sessions must be observed waiting; elapsed time alone is not race evidence.
export async function verifyAtomicPredictionPageConcurrency(exec) {
  const actor = 'a22b0000-0000-4000-8000-000000000001';
  await exec(`begin;
    insert into auth.users(id,email,raw_user_meta_data) values('${actor}','atomic-pages@example.invalid','{"kajo_nickname":"Native pages"}');
    insert into public.items(id,item_type,title,tags,discoverable)
      select md5('native-page:'||n)::uuid,'BOOK','Native page '||n,array['native-page'],true from generate_series(1,30) n;
    commit;`);
  const [scope] = await exec(`select jsonb_build_object('profileId',id) from public.profiles
    where owner_user_id='${actor}' and profile_type='PERSONAL';`);
  const base = { version: 2, profileId: scope.profileId,
    sessionId: 'a22b0000-0000-4000-8000-000000000002', discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 2, context: {} };
  let sequence = 10;
  const id = () => `a22b0000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const call = (request, name, hold = false) => `begin; set local application_name='${name}';
    set local request.jwt.claim.sub='${actor}'; set local role authenticated;
    select public.rank_items_page_v1(${literal(request)});
    ${hold ? 'do $$ begin perform pg_sleep(3); end $$;' : ''} commit;`;
  const counts = async () => (await exec(`select jsonb_build_object(
    'runs',(select count(*) from private.prediction_runs where actor_user_id='${actor}'),
    'receipts',(select count(*) from private.prediction_page_receipts where actor_user_id='${actor}'),
    'windows',(select count(*) from private.prediction_continuation_windows where actor_user_id='${actor}'),
    'pages',(select count(*) from private.prediction_page_contexts p join private.prediction_runs r on r.id=p.prediction_id where r.actor_user_id='${actor}'));`))[0];
  const waitForLock = async (name, granted) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const [found] = await exec(`select to_jsonb(exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid
        where a.application_name='${name}' and l.locktype='advisory' and l.granted=${granted}));`);
      if (found) return;
      await delay(50);
    }
    throw new Error(`Atomic page race did not observe ${name} ${granted ? 'holding' : 'waiting'}`);
  };
  const race = async (a, b) => {
    const settle = promise => promise.then(value => ({ value }), error => ({ error }));
    const first = settle(exec(call(a, 'kajo_atomic_page_holder', true)));
    let second;
    try {
      await waitForLock('kajo_atomic_page_holder', true);
      second = settle(exec(call(b, 'kajo_atomic_page_waiter')));
      await waitForLock('kajo_atomic_page_waiter', false);
      return await Promise.all([first, second]);
    } finally { await Promise.all([first, second]); }
  };
  for (const competing of [false, true]) {
    const [root] = await exec(call({ ...base, requestId: id() }, 'kajo_atomic_page_root'));
    assert.ok(root.nextCursor);
    const command = { ...base, requestId: id(), cursor: root.nextCursor };
    const before = await counts();
    const [a, b] = await race(command, competing ? { ...command, requestId: id() } : command);
    if (a.error) throw a.error;
    if (competing) assert.match(b.error?.message ?? '', /Continuation cursor already consumed/);
    else {
      if (b.error) throw b.error;
      assert.deepEqual(b.value, a.value, 'Concurrent retry changed immutable page response');
    }
    const after = await counts();
    assert.deepEqual(after, { ...before, runs: before.runs + 1, receipts: before.receipts + 1, pages: before.pages + 1 });
    const [seen] = await exec(`select to_jsonb(cardinality(w.seen_item_ids)) from private.prediction_continuation_windows w
      where w.request_id='${root.requestId}';`);
    assert.equal(seen, 4, 'Concurrent page dispatch advanced seen more than once');
  }
  // Independent first-page requests share the scope-cap lock. The losing
  // seventeenth request must roll back its new run and receipt, not just its cache.
  while ((await counts()).windows < 15) {
    await exec(call({ ...base, requestId: id() }, 'kajo_atomic_page_fill'));
  }
  const before = await counts();
  const [a, b] = await race({ ...base, requestId: id() }, { ...base, requestId: id() });
  if (a.error) throw a.error;
  assert.match(b.error?.message ?? '', /Too many active continuation windows/);
  assert.deepEqual(await counts(), { ...before, windows: 16, runs: before.runs + 1, receipts: before.receipts + 1 });
  return { status: 'PASS', windows: 16, cases: ['observed lock: identical page retry',
    'observed lock: competing cursor consumers', 'observed lock: concurrent 16-window cap without orphan evidence'] };
}
