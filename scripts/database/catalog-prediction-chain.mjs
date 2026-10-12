import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export async function catalogPredictionChainSmokeSql(name = 'catalog-prediction-chain-smoke.sql') {
  assert.ok(['catalog-prediction-chain-smoke.sql', 'catalog-prediction-chain-boundaries.sql'].includes(name));
  const [fixture, smoke] = await Promise.all([
    readFile(new URL('catalog-prediction-chain-fixture.sql', import.meta.url), 'utf8'),
    readFile(new URL(name, import.meta.url), 'utf8'),
  ]);
  return `begin; ${fixture}\n${smoke}\nrollback;`;
}

// Upgrade preservation needs populated v1/v2 origins and a still-open cursor,
// independently of catalog breadth. Reuse the canonical smaller fixture here;
// the mandatory runtime fixtures still traverse 145 eligible Items/domain and
// exercise the actual 1000-Item reader cap without reducing their corpus.
export async function catalogPredictionChainUpgradeFixtureSql() {
  return readFile(new URL('candidate-pool-fixture.sql', import.meta.url), 'utf8');
}

// The ordinary forward is rehearsed against populated v1/v2 receipts, source
// candidates, a live window and a committed later page. No old bytes are edited.
export function catalogPredictionChainUpgradeSql(migration, fixture) {
  assert.ok(migration.name.endsWith('_catalog_prediction_chain.sql'), 'Expected the append-only catalog-chain forward');
  return `begin; set local extra_float_digits=3;
    ${fixture}
    create temp table chain_upgrade(request jsonb,response jsonb,cached_window jsonb) on commit drop;
    do $seed$ declare profile uuid;
      request jsonb; root jsonb; response jsonb; stored_window jsonb;
    begin
      select profile_id into strict profile from pg_temp.pool_profiles where profile_type='PERSONAL';
      request := jsonb_build_object('version',1,'requestId',gen_random_uuid(),'profileId',profile,
        'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',10,'context','{}'::jsonb);
      perform set_config('role','authenticated',true);
      response := public.rank_items_page_v1(request);
      perform set_config('role','postgres',true);
      insert into pg_temp.chain_upgrade values(request,response,null);
      request := request||jsonb_build_object('version',2,'requestId',gen_random_uuid());
      perform set_config('role','authenticated',true);
      root := public.rank_items_page_v1(request);
      perform set_config('role','postgres',true);
      select private.read_prediction_window_v1(id) into strict stored_window from private.prediction_continuation_windows
        where request_id=(request->>'requestId')::uuid;
      insert into pg_temp.chain_upgrade values(request,root,stored_window);
      request := request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',root->'nextCursor');
      perform set_config('role','authenticated',true);
      response := public.rank_items_page_v1(request);
      perform set_config('role','postgres',true);
      if response->'version'<>'2'::jsonb or jsonb_array_length(response->'items')<>10 then raise exception 'Pre-upgrade v2 fixture failed'; end if;
      update pg_temp.chain_upgrade u set cached_window=private.read_prediction_window_v1((u.cached_window->>'id')::uuid) where u.cached_window is not null;
      insert into pg_temp.chain_upgrade values(request,response,null);
    end; $seed$;
    create temp table chain_upgrade_rows(identity text primary key,digest text) on commit drop;
    do $snapshot$ declare relation record; digest text;
    begin
      for relation in select format('%I.%I',n.nspname,c.relname) identity from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
          and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.chain_upgrade_rows values(relation.identity,digest);
      end loop;
    end; $snapshot$;
    create temp table chain_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      p.proowner,p.proacl,case when p.oid='private.rank_items_page_v1(jsonb)'::regprocedure then null
      else pg_get_functiondef(p.oid) end definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.prokind='f';
    ${migration.sql}
    do $verify$ declare relation record; digest text; checkpoint record; response jsonb;
    begin
      for relation in select * from pg_temp.chain_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest<>relation.digest then raise exception 'Catalog-chain forward changed populated %',relation.identity; end if;
      end loop;
      if exists(select 1 from pg_temp.chain_upgrade_functions before left join pg_proc p on p.oid=before.oid
        where p.oid is null or p.proowner<>before.proowner or p.proacl is distinct from before.proacl
          or (before.definition is not null and before.definition<>pg_get_functiondef(p.oid))) then
        raise exception 'Catalog-chain forward changed existing OIDs, owners, ACLs or unrelated bodies'; end if;
      if exists(select 1 from private.prediction_catalog_chains) or exists(select 1 from private.prediction_catalog_chain_pages)
        or exists(select 1 from private.prediction_catalog_chain_cursors) then raise exception 'Upgrade manufactured catalog-chain evidence'; end if;
      for checkpoint in select * from pg_temp.chain_upgrade loop
        if checkpoint.cached_window is not null and private.read_prediction_window_v1((checkpoint.cached_window->>'id')::uuid)<>checkpoint.cached_window then
          raise exception 'Upgrade changed exact old v2 window'; end if;
        perform set_config('role','authenticated',true);
        if public.rank_items_page_v1(checkpoint.request)<>checkpoint.response then raise exception 'Upgrade rewrote old v1/v2 receipt'; end if;
        perform set_config('role','postgres',true);
      end loop;
      select * into strict checkpoint from pg_temp.chain_upgrade where request->'version'='1'::jsonb;
      perform set_config('role','authenticated',true);
      response := public.rank_items_page_v1(checkpoint.request||jsonb_build_object('version',3,'requestId',gen_random_uuid()));
      if response->'version'<>'3'::jsonb or jsonb_array_length(response->'items')<>10
        or response#>>'{source,continuationState}'<>'MORE' then raise exception 'Upgraded v3 reader failed'; end if;
      perform set_config('role','postgres',true);
    end; $verify$;
    select jsonb_build_object('catalogChainUpgrade','PASS: populated v1/v2 receipts, exact live windows, candidates/page rows and existing OIDs/owners/ACLs/functions preserved; v3 dispatch works') snapshot;
    rollback;`;
}

// Native independent sessions must be observed holding/waiting for the scope
// advisory lock. These fixtures only run in the existing disposable CI stack.
export async function verifyCatalogPredictionChainConcurrency(exec) {
  const actor = 'a22d0000-0000-4000-8000-000000000001';
  await exec(`begin;
    insert into auth.users(id,email,raw_user_meta_data) values('${actor}','catalog-chain@example.invalid','{"kajo_nickname":"Native chain"}');
    insert into public.items(id,item_type,title,tags,discoverable) select md5('native-catalog-chain:'||n)::uuid,
      'BOOK','Native chain '||n,array['native-chain'],true from generate_series(1,144) n;
    commit;`, { stage: 'catalog-chain-concurrency-fixture' });
  const [scope] = await exec(`select jsonb_build_object('profileId',id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`,
    { stage: 'catalog-chain-concurrency-scope' });
  const base = { version: 3, profileId: scope.profileId, sessionId: 'a22d0000-0000-4000-8000-000000000002',
    discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 2, context: {} };
  let sequence = 10;
  const id = () => `a22d0000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const call = (request, name, hold = false) => `begin; set local application_name='${name}';
    set local request.jwt.claim.sub='${actor}'; set local role authenticated;
    select public.rank_items_page_v1(${literal(request)});
    ${hold ? 'do $$ begin perform pg_sleep(3); end $$;' : ''} commit;`;
  const counts = async () => (await exec(`select jsonb_build_object(
    'runs',(select count(*) from private.prediction_runs where actor_user_id='${actor}'),
    'receipts',(select count(*) from private.prediction_page_receipts where actor_user_id='${actor}'),
    'windows',(select count(*) from private.prediction_continuation_windows where actor_user_id='${actor}' and expires_at>clock_timestamp()),
    'chains',(select count(*) from private.prediction_catalog_chains where actor_user_id='${actor}' and expires_at>clock_timestamp()),
    'pages',(select count(*) from private.prediction_catalog_chain_pages p join private.prediction_runs r on r.id=p.prediction_id where r.actor_user_id='${actor}'));`,
  { stage: 'catalog-chain-concurrency-evidence' }))[0];
  const waitForLock = async (name, granted) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const [found] = await exec(`select to_jsonb(exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid
        where a.application_name='${name}' and l.locktype='advisory' and l.granted=${granted}));`,
      { stage: 'catalog-chain-concurrency-observed-lock' });
      if (found) return;
      await delay(50);
    }
    throw new Error(`Catalog-chain race did not observe ${name} ${granted ? 'holding' : 'waiting'}`);
  };
  const race = async (a, b) => {
    const settle = promise => promise.then(value => ({ value }), error => ({ error }));
    const first = settle(exec(call(a, 'kajo_catalog_chain_holder', true),
      { stage: 'catalog-chain-concurrency-holder', timeoutMs: 120_000 }));
    let second;
    try {
      await waitForLock('kajo_catalog_chain_holder', true);
      second = settle(exec(call(b, 'kajo_catalog_chain_waiter'),
        { stage: 'catalog-chain-concurrency-waiter', timeoutMs: 120_000 }));
      await waitForLock('kajo_catalog_chain_waiter', false);
      return await Promise.all([first, second]);
    } finally { await Promise.all([first, second]); }
  };
  for (const competing of [false, true]) {
    const [root] = await exec(call({ ...base, requestId: id() }, 'kajo_catalog_chain_root'),
      { stage: 'catalog-chain-concurrency-root', timeoutMs: 120_000 });
    assert.ok(root.nextCursor);
    const command = { ...base, requestId: id(), cursor: root.nextCursor };
    const before = await counts();
    const [a, b] = await race(command, competing ? { ...command, requestId: id() } : command);
    if (a.error) throw a.error;
    if (competing) assert.match(b.error?.message ?? '', /cursor already consumed/i);
    else {
      if (b.error) throw b.error;
      assert.deepEqual(b.value, a.value, 'Concurrent catalog-chain retry changed immutable page receipt');
    }
    assert.deepEqual(await counts(), { ...before, runs: before.runs + 1, receipts: before.receipts + 1, pages: before.pages + 1 });
    const [seen] = await exec(`select to_jsonb(cardinality(seen_item_ids)) from private.prediction_catalog_chains where id='${root.source.chainId}';`,
      { stage: 'catalog-chain-concurrency-prefix' });
    assert.equal(seen, 4, 'Concurrent catalog-chain request advanced the prefix twice');
  }
  while ((await counts()).windows < 8) await exec(call({ ...base, version: 2, requestId: id() }, 'kajo_catalog_chain_fill_v2'),
    { stage: 'catalog-chain-concurrency-fill-v2', timeoutMs: 120_000 });
  for (;;) {
    const count = await counts();
    if (count.windows + count.chains >= 15) break;
    await exec(call({ ...base, requestId: id() }, 'kajo_catalog_chain_fill_v3'),
      { stage: 'catalog-chain-concurrency-fill-v3', timeoutMs: 120_000 });
  }
  const before = await counts();
  const [a, b] = await race({ ...base, requestId: id() }, { ...base, version: 2, requestId: id() });
  if (a.error) throw a.error;
  assert.match(b.error?.message ?? '', /Too many active continuation (windows|sources|readers|chains)/);
  assert.deepEqual(await counts(), { ...before, chains: before.chains + 1, runs: before.runs + 1,
    receipts: before.receipts + 1, pages: before.pages + 1 });
  return { status: 'PASS', activeReaders: 16, cases: ['observed lock: identical catalog-chain retry',
    'observed lock: competing chain cursor consumers', 'observed lock: shared v2/v3 16-reader cap with no orphan evidence'] };
}
