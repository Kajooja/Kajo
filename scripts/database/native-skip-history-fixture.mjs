import assert from 'node:assert/strict';

export const skipHistories = ['CATALOGUE_HISTORY', 'OFF_CATALOGUE_HISTORY'];
export const offCatalogueSize = contractTest => contractTest ? 40 : 10000;

export function expectedSkipHistoryInventory(history, catalogSize, contractTest = false) {
  assert.ok(skipHistories.includes(history));
  assert.ok(Number.isInteger(catalogSize) && catalogSize >= 40 && catalogSize % 8 === 0);
  const current = history === 'CATALOGUE_HISTORY';
  return {
    currentItems: catalogSize, offCatalogueItems: current ? 0 : offCatalogueSize(contractTest),
    commands: current ? catalogSize * 11.5 : offCatalogueSize(contractTest) * 2 + catalogSize,
    withdrawals: current ? catalogSize / 2 : 0, erased: current ? catalogSize / 2 : 0,
    future: current ? catalogSize / 2 : 0,
    personal: current ? { SKIP_COOLDOWN: catalogSize / 4, SKIP_COOLDOWN_ELAPSED: catalogSize * 3 / 4 }
      : { NO_ACTIVE_SKIP: catalogSize },
    shared: current ? { SKIP_COOLDOWN: catalogSize / 4, SKIP_COOLDOWN_ELAPSED: catalogSize * 3 / 4 }
      : { NO_ACTIVE_SKIP: catalogSize },
  };
}

// Only called after the collector's empty/disposable-installation refusal.
// These are synthetic retained ledger states, not public-writer admission tests.
// Every real measured RPC still executes as the authenticated fixture actor.
export function skipHistoryFixtureSql(profileId, history, catalogSize, contractTest = false) {
  expectedSkipHistoryInventory(history, catalogSize, contractTest);
  assert.match(profileId, /^[a-f0-9-]{36}$/);
  const current = history === 'CATALOGUE_HISTORY';
  return `begin;
    create temp table history_targets on commit drop as
      select 1 scope,'${profileId}'::uuid profile union all
      select 2,'ab157000-0000-4000-8000-000000000900'::uuid;
    create temp table history_current on commit drop as
      select id,row_number() over(order by id)::bigint n,
        ((row_number() over(partition by item_type order by id)-1)%4)::integer bucket
      from public.items where discoverable;
    ${current ? '' : `insert into public.items(id,item_type,title,discoverable)
      select ('ab157000-0000-4000-8000-'||lpad((1000000+n)::text,12,'0'))::uuid,
        'MOVIE','Excluded history fixture '||n,false from generate_series(1,${offCatalogueSize(contractTest)}) n;`}
    create temp table history_rows(n bigint,profile uuid,item uuid,kind text,at_time timestamptz,
      reversal bigint,erased boolean default false) on commit drop;
    ${current ? `
      insert into history_rows(n,profile,item,kind,at_time)
        select t.scope*100000000+c.n*10+k,t.profile,c.id,'CONTEXTUAL_SKIP',now()-(48+k)*interval '1 hour'
        from history_targets t cross join history_current c cross join generate_series(1,4) k;
      insert into history_rows(n,profile,item,kind,at_time)
        select t.scope*100000000+c.n*10+5,t.profile,c.id,'CONTEXTUAL_SKIP',now()-interval '1 hour'
        from history_targets t cross join history_current c where c.bucket=0;
      insert into history_rows(n,profile,item,kind,at_time)
        select t.scope*100000000+c.n*10+6,t.profile,c.id,'CONTEXTUAL_SKIP',now()-interval '2 hours'
        from history_targets t cross join history_current c where c.bucket=1;
      insert into history_rows(n,profile,item,kind,at_time,reversal)
        select t.scope*100000000+c.n*10+7,t.profile,c.id,'WITHDRAW_CONTEXTUAL_SKIP',now()-interval '1 hour',
          t.scope*100000000+c.n*10+6 from history_targets t cross join history_current c where c.bucket=1;
      insert into history_rows(n,profile,item,kind,at_time)
        select t.scope*100000000+c.n*10+8,t.profile,c.id,'CONTEXTUAL_SKIP',now()+interval '1 day'
        from history_targets t cross join history_current c where c.bucket=2;
      insert into history_rows(n,profile,item,kind,at_time,erased)
        select t.scope*100000000+c.n*10+9,t.profile,null,'CONTEXTUAL_SKIP',now()-interval '1 hour',true
        from history_targets t cross join history_current c where c.bucket=3;
    ` : `insert into history_rows(n,profile,item,kind,at_time)
        select t.scope*100000000+n*10+1,t.profile,
          ('ab157000-0000-4000-8000-'||lpad((1000000+n)::text,12,'0'))::uuid,
          'CONTEXTUAL_SKIP',now()-interval '72 hours'
        from history_targets t cross join generate_series(1,${offCatalogueSize(contractTest)}) n;`}
    -- Current Items have active history in an unrelated PersonalProfile in both
    -- regimes. Membership in Shared must not copy those decisions into its scope.
    insert into history_rows(n,profile,item,kind,at_time)
      select 300000000+c.n*10+1,p.id,c.id,'CONTEXTUAL_SKIP',now()-interval '1 hour'
      from public.profiles p cross join history_current c
      where p.owner_user_id='ab157000-0000-4000-8000-000000000002' and p.profile_type='PERSONAL';
    insert into private.contextual_skip_commands(action_id,actor_user_id,profile_id,item_id,surface,kind,
      origin_hash,origin,command,result,accepted_at,reverses_action_id,erased_at)
      select ('ab157900-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
        case when n>=300000000 then 'ab157000-0000-4000-8000-000000000002'::uuid
          else 'ab157000-0000-4000-8000-000000000001'::uuid end,
        profile,item,'DISCOVERY',kind,n::text,case when not erased then '{}'::jsonb end,
        case when not erased then '{}'::jsonb end,case when not erased then '{}'::jsonb end,at_time,
        case when reversal is not null then ('ab157900-0000-4000-8000-'||lpad(reversal::text,12,'0'))::uuid end,
        case when erased then now() end from history_rows;
    analyze private.contextual_skip_commands;
    select jsonb_build_object('currentItems',(select count(*) from public.items where discoverable),
      'offCatalogueItems',(select count(*) from public.items where not discoverable),
      'commands',(select count(*) from private.contextual_skip_commands),
      'withdrawals',(select count(*) from private.contextual_skip_commands where kind='WITHDRAW_CONTEXTUAL_SKIP'),
      'erased',(select count(*) from private.contextual_skip_commands where erased_at is not null),
      'future',(select count(*) from private.contextual_skip_commands where accepted_at>now()),
      'personal',(select jsonb_object_agg(reason,n) from (
        select private.contextual_skip_decision_v1('${profileId}',id,now(),true)->>'reason' reason,count(*) n
        from history_current group by reason) counts),
      'shared',(select jsonb_object_agg(reason,n) from (
        select private.contextual_skip_decision_v1('ab157000-0000-4000-8000-000000000900',id,now(),true)->>'reason' reason,count(*) n
        from history_current group by reason) counts));
    commit;`;
}

export const skipLedgerHashSql = `select to_jsonb(encode(sha256(convert_to(coalesce(
  (select jsonb_agg(to_jsonb(c) order by action_id) from private.contextual_skip_commands c),'[]')::text,'UTF8')),'hex'));`;
