-- Opt-in protocol 3: append newly ranked, unseen catalog Items. Protocols 1/2
-- and every committed receipt/run remain immutable. Each page is its own
-- complete source-pool comparison; it is not a frozen whole-catalog ranking.
create table private.prediction_catalog_chains (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  discovery_mode text not null check(discovery_mode in ('FOR_YOU','SURPRISE','RISK')),
  item_type text not null check(item_type in ('BOOK','MOVIE')),
  page_size integer not null check(page_size between 1 and 50),
  request_context jsonb not null check(jsonb_typeof(request_context)='object'),
  root_prediction_id uuid not null unique references private.prediction_runs(id) on delete cascade,
  seen_item_ids uuid[] not null check(cardinality(seen_item_ids)<=1000),
  reminder_delivered boolean not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  check(expires_at>created_at and expires_at<=created_at+interval '15 minutes')
);
create index prediction_catalog_chains_scope_idx
  on private.prediction_catalog_chains(actor_user_id,profile_id,expires_at);
alter table private.prediction_catalog_chains enable row level security;
revoke all on private.prediction_catalog_chains from public,anon,authenticated,service_role;

-- This evidence survives derived cursor/chain expiry and contains only the
-- server-owned delivered prefix. Fetching a page does not record an impression.
create table private.prediction_catalog_chain_pages (
  prediction_id uuid primary key references private.prediction_runs(id) on delete cascade,
  chain_id uuid not null,
  root_prediction_id uuid not null,
  parent_prediction_id uuid,
  page_index integer not null check(page_index between 1 and 1001),
  seen_before uuid[] not null check(cardinality(seen_before)<=1000),
  reminder_previously_delivered boolean not null,
  reminder_delivered boolean not null,
  version text not null default 'catalog-chain-v1' check(version='catalog-chain-v1'),
  unique(chain_id,page_index),
  check((page_index=1)=(parent_prediction_id is null))
);
alter table private.prediction_catalog_chain_pages enable row level security;
revoke all on private.prediction_catalog_chain_pages from public,anon,authenticated,service_role;
create trigger prediction_catalog_chain_pages_immutable before update
  on private.prediction_catalog_chain_pages for each row
  execute function private.reject_immutable_prediction_artifact_change_v1();

create table private.prediction_catalog_chain_cursors (
  token uuid primary key default gen_random_uuid(),
  chain_id uuid not null references private.prediction_catalog_chains(id) on delete cascade,
  parent_prediction_id uuid not null references private.prediction_runs(id) on delete cascade,
  page_index integer not null check(page_index between 2 and 1001),
  used_request_id uuid unique references private.prediction_page_receipts(request_id) on delete cascade,
  unique(chain_id,page_index)
);
alter table private.prediction_catalog_chain_cursors enable row level security;
revoke all on private.prediction_catalog_chain_cursors from public,anon,authenticated,service_role;

-- Copy the reviewed source into private, explicit-argument helpers. A client
-- cannot provide an exclusion list in context or change canonical eligibility.
-- Whole-definition hashes reject unknown source drift before any source clone.
do $ranking$
declare
  target regprocedure; definition text; expected_hash text; patch record;
begin
  foreach target in array array[
    'private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure,
    'private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)'::regprocedure,
    'private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)'::regprocedure,
    'private.rank_items_page_v1(jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    expected_hash := case target::text
      when 'private.rank_items_v0(uuid,text,text,integer,jsonb)' then '376dcafe903d7b1b93e7854aec694c495d465523ff8c08161e761a50d9597c25'
      when 'private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)' then '0d25029d22651a8576eb42c05932b2cc6b5580f82180f4e96941de715b384be0'
      when 'private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)' then '28dac384409c70896222897c5aecec143e416dd5783e8e777ec35d19cad041fd'
      when 'private.rank_items_page_v1(jsonb)' then 'a856d7259d902bc5f29686d68b43b3a48531faee779930cda1d0153e0bad9842'
    end;
    if expected_hash is null or encode(sha256(convert_to(definition,'UTF8')),'hex')<>expected_hash then
      raise exception 'Catalog chain forward: unexpected ranking source %',target;
    end if;
    for patch in select * from (values
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)',
        $old$FUNCTION private.rank_items_v0($old$,
        $new$FUNCTION private.rank_items_catalog_base_v1(_chain_seen uuid[], _chain_reminder_spent boolean, $new$),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)',
        $old$    where candidate.discoverable$old$,
        $new$    where candidate.discoverable
      and not(candidate.id=any(_chain_seen))$new$),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)',
        $old$    from scored
  ),$old$,
        $new$    from scored
    where not(_chain_reminder_spent and private.resurfacing_policy_decision_v1(
      target_profile_id,scored.id,jsonb_build_object('consumedSuppressed',scored.consumed,
        'rating',scored.rating,'notInterested',scored.not_interested,'saved',scored.saved),
      eligibility_time)->>'classification'='SAVED_REMINDER_ELIGIBLE')
  ),$new$),
      ('private.rank_items_v0(uuid,text,text,integer,jsonb)',
        $old$'version','eligibility-first-v1','eligibilityAt',eligibility_time,$old$,
        $new$'version','eligibility-first-v1','eligibilityAt',eligibility_time,
        'catalogChainVersion','catalog-chain-v1','seenCount',cardinality(_chain_seen),
        'seenPrefixHash',md5(array_to_string(_chain_seen,',')),
        'reminderPreviouslyDelivered',_chain_reminder_spent,$new$),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)',
        $old$FUNCTION private.rank_items_scalar_v1($old$,
        $new$FUNCTION private.rank_items_catalog_scalar_v1(_chain_seen uuid[], _chain_reminder_spent boolean, $new$),
      ('private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)',
        $old$    from private.rank_items_v0(
$old$,
        $new$    from private.rank_items_catalog_base_v1(
      _chain_seen,
      _chain_reminder_spent,
$new$),
      ('private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',
        $old$FUNCTION private.rank_items_with_identity_v1($old$,
        $new$FUNCTION private.rank_items_catalog_with_identity_v1(_chain_seen uuid[], _chain_reminder_spent boolean, $new$),
      ('private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',
        $old$    from private.rank_items_scalar_v1(
$old$,
        $new$    from private.rank_items_catalog_scalar_v1(
      _chain_seen,
      _chain_reminder_spent,
$new$),
      ('private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',
        $old$  end || '+frozen-replay-v2+eligibility-first-v1';$old$,
        $new$  end || '+frozen-replay-v2+eligibility-first-v1+catalog-chain-v1';$new$),
      ('private.rank_items_page_v1(jsonb)',
        $old$FUNCTION private.rank_items_page_v1($old$,
        $new$FUNCTION private.rank_items_frozen_page_v2($new$)
    ) as replacements(identity,old_text,new_text) where identity=target::text loop
      if (length(definition)-length(replace(definition,patch.old_text,'')))/length(patch.old_text)<>1 then
        raise exception 'Catalog chain forward: unexpected source anchor %',target;
      end if;
      definition := replace(definition,patch.old_text,patch.new_text);
    end loop;
    execute definition;
  end loop;
end;
$ranking$;
revoke all on function private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)
  from public,anon,authenticated,service_role;
revoke all on function private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.rank_items_frozen_page_v2(jsonb) from public,anon,authenticated,service_role;

create function private.rank_items_catalog_chain_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set extra_float_digits=3
as $$
<<chain_request>>
declare
  actor uuid := (select auth.uid());
  request_id uuid; profile_id uuid; session_id uuid; prediction_id uuid := gen_random_uuid();
  mode text; domain text; page_size integer; context jsonb; cursor_id uuid;
  receipt private.prediction_page_receipts%rowtype;
  chain private.prediction_catalog_chains%rowtype;
  cursor_row private.prediction_catalog_chain_cursors%rowtype;
  previous_page private.prediction_catalog_chain_pages%rowtype;
  source_run private.prediction_runs%rowtype;
  chain_id uuid; root_id uuid; parent_id uuid; page_index integer := 1;
  seen_before uuid[] := '{}'::uuid[]; seen_after uuid[]; selected uuid[];
  reminder_spent boolean := false; selected_reminder boolean; remaining boolean;
  items jsonb; response jsonb; next_cursor uuid; candidate_count integer;
  availability text; continuation_state text; now_at timestamptz := clock_timestamp();
  uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>16384
    or request->'version' is distinct from '3'::jsonb
    or not coalesce(request->>'requestId' ~* uuid_pattern,false)
    or not coalesce(request->>'profileId' ~* uuid_pattern,false)
    or not coalesce(request->>'sessionId' ~* uuid_pattern,false)
    or not coalesce(request->>'discoveryMode' in ('FOR_YOU','SURPRISE','RISK'),false)
    or not coalesce(request->>'itemType' in ('BOOK','MOVIE'),false)
    or jsonb_typeof(request->'limit') is distinct from 'number'
    or not coalesce(request->>'limit' ~ '^[0-9]{1,2}$',false)
    or jsonb_typeof(request->'context') is distinct from 'object'
    or (coalesce(request->'cursor','null'::jsonb)<>'null'::jsonb
      and (jsonb_typeof(request->'cursor') is distinct from 'string'
        or not coalesce(request->>'cursor' ~* uuid_pattern,false)))
    or exists(select 1 from jsonb_object_keys(request) k where k not in
      ('version','requestId','profileId','sessionId','discoveryMode','itemType','limit','context','cursor')) then
    raise exception 'Invalid prediction page request' using errcode='22023';
  end if;
  request_id := (request->>'requestId')::uuid; profile_id := (request->>'profileId')::uuid;
  session_id := (request->>'sessionId')::uuid; cursor_id := (request->>'cursor')::uuid;
  mode := request->>'discoveryMode'; domain := request->>'itemType';
  page_size := (request->>'limit')::integer; context := request->'context';
  if page_size<1 or page_size>50
    or exists(select 1 from jsonb_object_keys(context) k where k not in ('locale','timezone','occurredAt','attributes'))
    or exists(select 1 from jsonb_each(context) e where e.key in ('locale','timezone','occurredAt') and jsonb_typeof(e.value)<>'string')
    or (context ? 'attributes' and (jsonb_typeof(context->'attributes')<>'object'
      or exists(select 1 from jsonb_each(case when jsonb_typeof(context->'attributes')='object'
        then context->'attributes' else '{}'::jsonb end) e where jsonb_typeof(e.value) not in ('null','string','number','boolean')))) then
    raise exception 'Invalid page limit or prediction context' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  -- The established actor/Profile lock also bounds combined live v2/v3 readers.
  perform pg_advisory_xact_lock(hashtextextended('prediction-window:'||actor::text||':'||profile_id::text,0));
  perform 1 from public.profile_members m where m.profile_id=chain_request.profile_id and m.user_id=actor for share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select r.* into receipt from private.prediction_page_receipts r where r.request_id=chain_request.request_id;
  if found then
    if receipt.actor_user_id<>actor or receipt.request<>request then
      raise exception 'Prediction request ID already used' using errcode='22023';
    end if;
    return receipt.response;
  end if;
  now_at := clock_timestamp();

  if cursor_id is null then
    delete from private.prediction_catalog_chains c
      where c.actor_user_id=actor and c.profile_id=chain_request.profile_id and c.expires_at<=now_at;
    if (select count(*) from private.prediction_catalog_chains c where c.actor_user_id=actor
        and c.profile_id=chain_request.profile_id and c.expires_at>now_at)
      +(select count(*) from private.prediction_continuation_windows w where w.actor_user_id=actor
        and w.profile_id=chain_request.profile_id and w.expires_at>now_at)>=16 then
      raise exception 'Too many active continuation windows' using errcode='54000';
    end if;
    chain_id := gen_random_uuid(); root_id := prediction_id;
  else
    select c.* into cursor_row from private.prediction_catalog_chain_cursors c where c.token=cursor_id;
    if not found then raise exception 'Continuation cursor unavailable' using errcode='22023'; end if;
    select c.* into strict chain from private.prediction_catalog_chains c where c.id=cursor_row.chain_id for update;
    if chain.actor_user_id<>actor then
      raise exception 'Continuation access denied' using errcode='42501';
    end if;
    if chain.profile_id<>profile_id or chain.session_id<>session_id
      or chain.discovery_mode<>mode or chain.item_type<>domain or chain.page_size<>page_size
      or chain.request_context<>context then
      raise exception 'Continuation request scope mismatch' using errcode='22023';
    end if;
    if cursor_row.used_request_id is not null then
      raise exception 'Continuation cursor already consumed' using errcode='22023';
    end if;
    if chain.expires_at<=clock_timestamp() then
      raise exception 'Continuation window expired' using errcode='22023';
    end if;
    chain_id := chain.id; root_id := chain.root_prediction_id;
    parent_id := cursor_row.parent_prediction_id; page_index := cursor_row.page_index;
    select p.* into previous_page from private.prediction_catalog_chain_pages p where p.prediction_id=parent_id;
    if not found or previous_page.chain_id<>chain_id or previous_page.root_prediction_id<>root_id
      or previous_page.page_index<>page_index-1
      or chain.seen_item_ids is distinct from previous_page.seen_before||coalesce((
        select array_agg(c.item_id order by c.final_rank) from private.prediction_candidates c
        where c.prediction_id=parent_id and c.selected_for_delivery),'{}'::uuid[])
      or chain.reminder_delivered is distinct from
        (previous_page.reminder_previously_delivered or previous_page.reminder_delivered) then
      raise exception 'Continuation source changed' using errcode='22023';
    end if;
    seen_before := chain.seen_item_ids; reminder_spent := chain.reminder_delivered;
    if cardinality(seen_before)>=1000 then
      raise exception 'Continuation reader limit reached' using errcode='22023';
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank),'[]'::jsonb) into items
    from private.rank_items_catalog_with_identity_v1(seen_before,reminder_spent,prediction_id,
      profile_id,mode,domain,least(page_size,1000-cardinality(seen_before)),
      context||jsonb_build_object('sessionId',session_id)) r;
  select r.* into strict source_run from private.prediction_runs r where r.id=chain_request.prediction_id;
  candidate_count := source_run.candidate_count;
  select coalesce(array_agg(c.item_id order by c.final_rank),'{}'::uuid[]),
    coalesce(bool_or(c.explanation#>>'{resurfacingPolicy,classification}'='SAVED_REMINDER'),false)
    into selected,selected_reminder from private.prediction_candidates c
    where c.prediction_id=chain_request.prediction_id and c.selected_for_delivery;
  seen_after := seen_before||selected;
  if cardinality(seen_after)>1000
    or cardinality(seen_after)<>(select count(distinct i) from unnest(seen_after) i)
    or (reminder_spent and selected_reminder) then
    raise exception 'Invalid catalog continuation prefix' using errcode='22023';
  end if;

  -- Exhaustion is proven over the current domain using canonical hard policy,
  -- independently of retained candidate/trace counts. A source top50 cutoff
  -- and the explicit reader resource cap must never masquerade as catalog end.
  select exists(
    select 1 from public.items i left join public.item_interactions s
      on s.profile_id=chain_request.profile_id and s.item_id=i.id
    cross join lateral (select private.resurfacing_policy_decision_v1(chain_request.profile_id,i.id,
      jsonb_build_object('consumedSuppressed',coalesce(s.consumed,false),'rating',s.rating,
        'notInterested',coalesce(s.not_interested,false),'saved',coalesce(s.saved,false)),
      clock_timestamp()) as policy) p
    where i.discoverable and i.item_type=domain and not(i.id=any(seen_after))
      and coalesce((p.policy->>'eligible')::boolean,false)
      and not((reminder_spent or selected_reminder) and p.policy->>'classification'='SAVED_REMINDER_ELIGIBLE')
  ) into remaining;
  if jsonb_array_length(items)=0 and remaining then
    raise exception 'Catalog continuation failed to refill eligible source' using errcode='55000';
  end if;
  continuation_state := case when not remaining then 'CATALOG_EXHAUSTED'
    when cardinality(seen_after)>=1000 then 'READER_LIMIT' else 'MORE' end;
  availability := case when jsonb_array_length(items)>0 then 'ITEMS'
    when cursor_id is null and not exists(select 1 from public.items i where i.discoverable and i.item_type=domain)
      then 'CATALOG_EMPTY' else 'CATALOG_EXHAUSTED' end;
  insert into private.prediction_catalog_chain_pages(prediction_id,chain_id,root_prediction_id,
    parent_prediction_id,page_index,seen_before,reminder_previously_delivered,reminder_delivered)
    values(prediction_id,chain_id,root_id,parent_id,page_index,seen_before,reminder_spent,selected_reminder);
  if cursor_id is null then
    insert into private.prediction_catalog_chains(id,actor_user_id,profile_id,session_id,
      discovery_mode,item_type,page_size,request_context,root_prediction_id,seen_item_ids,
      reminder_delivered,created_at,expires_at)
    values(chain_id,actor,profile_id,session_id,mode,domain,page_size,context,root_id,seen_after,
      selected_reminder,source_run.requested_at,source_run.requested_at+interval '15 minutes');
  else
    update private.prediction_catalog_chains c set seen_item_ids=seen_after,
      reminder_delivered=reminder_spent or selected_reminder where c.id=chain_id;
  end if;
  if continuation_state='MORE' then
    insert into private.prediction_catalog_chain_cursors(chain_id,parent_prediction_id,page_index)
      values(chain_id,prediction_id,page_index+1) returning token into next_cursor;
  end if;
  response := jsonb_build_object('version',3,'requestId',request_id,'predictionId',prediction_id,
    'profileId',profile_id,'sessionId',session_id,'discoveryMode',mode,'itemType',domain,
    'items',items,'nextCursor',next_cursor,'continuationSupported',true,'availability',availability,
    'source',jsonb_build_object('version','catalog-chain-v1','candidateCount',candidate_count,
      'resultCount',jsonb_array_length(items),'catalogEmpty',availability='CATALOG_EMPTY',
      'sourcePredictionId',prediction_id,'rootPredictionId',root_id,'parentPredictionId',parent_id,
      'chainId',chain_id,'pageIndex',page_index,'featureAt',source_run.requested_at,
      'seenCount',cardinality(seen_after),'chainLimit',1000,'continuationState',continuation_state));
  insert into private.prediction_page_receipts(request_id,actor_user_id,profile_id,prediction_id,request,response)
    values(request_id,actor,profile_id,prediction_id,request,response);
  if cursor_id is not null then
    update private.prediction_catalog_chain_cursors c set used_request_id=request_id where c.token=cursor_id;
  end if;
  return response;
end;
$$;
revoke all on function private.rank_items_catalog_chain_v1(jsonb) from public,anon,authenticated,service_role;

create or replace function private.rank_items_page_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set extra_float_digits=3
as $$
<<dispatch_request>>
declare
  actor uuid := (select auth.uid());
  profile_id uuid; request_id uuid; now_at timestamptz := clock_timestamp();
begin
  if request->'version'='3'::jsonb then
    return private.rank_items_catalog_chain_v1(request);
  end if;
  -- Preserve the exact v2 body and historical receipts while preventing a v2
  -- fresh open from bypassing the shared active-reader budget through v3.
  if request->'version'='2'::jsonb and coalesce(request->'cursor','null'::jsonb)='null'::jsonb
    and actor is not null
    and coalesce(request->>'profileId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
    and coalesce(request->>'requestId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false) then
    profile_id := (request->>'profileId')::uuid; request_id := (request->>'requestId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
    perform pg_advisory_xact_lock(hashtextextended('prediction-window:'||actor::text||':'||profile_id::text,0));
    if not exists(select 1 from private.prediction_page_receipts r where r.request_id=dispatch_request.request_id)
      and exists(select 1 from private.prediction_catalog_chains c where c.actor_user_id=actor
        and c.profile_id=dispatch_request.profile_id and c.expires_at>now_at)
      and (select count(*) from private.prediction_catalog_chains c where c.actor_user_id=actor
        and c.profile_id=dispatch_request.profile_id and c.expires_at>now_at)
        +(select count(*) from private.prediction_continuation_windows w where w.actor_user_id=actor
          and w.profile_id=dispatch_request.profile_id and w.expires_at>now_at)>=16 then
      perform 1 from public.profile_members m where m.profile_id=dispatch_request.profile_id and m.user_id=actor for share;
      if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
      raise exception 'Too many active continuation windows' using errcode='54000';
    end if;
  end if;
  return private.rank_items_frozen_page_v2(request);
end;
$$;
revoke all on function private.rank_items_page_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.rank_items_page_v1(jsonb) to authenticated;
