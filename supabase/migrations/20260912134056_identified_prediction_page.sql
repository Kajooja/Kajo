-- Identified first-page boundary. Continuation is explicitly unavailable until
-- bounded windows are implemented. Legacy callers keep their row response.
do $core$
declare
  definition text := pg_get_functiondef('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure);
  header text := 'FUNCTION private.rank_items_v1_internal(';
  identity_anchor text := 'current_prediction_id uuid := gen_random_uuid();';
begin
  if (length(definition)-length(replace(definition,header,'')))/length(header) <> 1
    or (length(definition)-length(replace(definition,identity_anchor,'')))/length(identity_anchor) <> 1
    or position('+frozen-replay-v2+eligibility-first-v1' in definition)=0 then
    raise exception 'Identified page forward: unexpected ranking source';
  end if;
  definition := replace(definition,header,
    'FUNCTION private.rank_items_with_identity_v1(supplied_prediction_id uuid, ');
  definition := replace(definition,identity_anchor,
    'current_prediction_id uuid := supplied_prediction_id;');
  execute definition;
end;
$core$;

revoke all on function private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)
  from public,anon,authenticated,service_role;

create or replace function private.rank_items_v1_internal(
  target_profile_id uuid, requested_mode text, requested_item_type text default null,
  result_limit integer default 20, request_context jsonb default '{}')
returns table(prediction_id uuid,item_id uuid,item_type text,title text,description text,
  tags text[],score double precision,confidence double precision,rank integer,explanation jsonb)
language sql volatile security definer set search_path=''
as $$
  select * from private.rank_items_with_identity_v1(gen_random_uuid(),target_profile_id,
    requested_mode,requested_item_type,result_limit,request_context);
$$;

create table private.prediction_page_receipts (
  request_id uuid primary key,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  prediction_id uuid not null unique references private.prediction_runs(id) on delete cascade,
  request jsonb not null check(jsonb_typeof(request)='object'),
  response jsonb not null check(jsonb_typeof(response)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index prediction_page_receipts_actor_idx on private.prediction_page_receipts(actor_user_id);
create index prediction_page_receipts_profile_idx on private.prediction_page_receipts(profile_id);
alter table private.prediction_page_receipts enable row level security;
revoke all on private.prediction_page_receipts from public,anon,authenticated,service_role;

create function private.rank_items_page_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
<<page_request>>
declare
  actor uuid := (select auth.uid());
  request_id uuid; profile_id uuid; session_id uuid; prediction_id uuid;
  mode text; domain text; page_size integer; context jsonb;
  receipt private.prediction_page_receipts%rowtype;
  items jsonb; response jsonb; candidate_count integer; availability text;
  uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>16384
    or request->'version' is distinct from '1'::jsonb
    or not coalesce(request->>'requestId' ~* uuid_pattern,false)
    or not coalesce(request->>'profileId' ~* uuid_pattern,false)
    or not coalesce(request->>'sessionId' ~* uuid_pattern,false)
    or not coalesce(request->>'discoveryMode' in ('FOR_YOU','SURPRISE','RISK'),false)
    or not coalesce(request->>'itemType' in ('BOOK','MOVIE'),false)
    or jsonb_typeof(request->'limit') is distinct from 'number'
    or not coalesce(request->>'limit' ~ '^[0-9]{1,2}$',false)
    or jsonb_typeof(request->'context') is distinct from 'object'
    or coalesce(request->'cursor','null'::jsonb)<>'null'::jsonb
    or exists(select 1 from jsonb_object_keys(request) k where k not in
      ('version','requestId','profileId','sessionId','discoveryMode','itemType','limit','context','cursor')) then
    raise exception 'Invalid prediction page request (continuation unavailable)' using errcode='22023';
  end if;
  request_id := (request->>'requestId')::uuid; profile_id := (request->>'profileId')::uuid;
  session_id := (request->>'sessionId')::uuid;
  mode := request->>'discoveryMode'; domain := request->>'itemType';
  page_size := (request->>'limit')::integer; context := request->'context';
  if page_size<1 or page_size>50 or context ? 'sessionId' then
    raise exception 'Invalid page limit or nested session identity' using errcode='22023';
  end if;
  -- Serializes identical request IDs, including concurrent retries. Membership
  -- is checked after waiting and locked through the response/trace commit.
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  perform 1 from public.profile_members m
    where m.profile_id=page_request.profile_id and m.user_id=actor for share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select r.* into receipt from private.prediction_page_receipts r
    where r.request_id=page_request.request_id;
  if found then
    if receipt.actor_user_id<>actor or receipt.request<>request then
      raise exception 'Prediction request ID already used' using errcode='22023';
    end if;
    return receipt.response;
  end if;
  prediction_id := gen_random_uuid();
  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank),'[]'::jsonb) into items
    from private.rank_items_with_identity_v1(prediction_id,profile_id,mode,domain,page_size,
      context||jsonb_build_object('sessionId',session_id)) r;
  select r.candidate_count into strict candidate_count from private.prediction_runs r
    where r.id=page_request.prediction_id;
  availability := case when jsonb_array_length(items)>0 then 'ITEMS'
    when not exists(select 1 from public.items i where i.discoverable and i.item_type=domain)
      then 'CATALOG_EMPTY' else 'WINDOW_EXHAUSTED' end;
  response := jsonb_build_object('version',1,'requestId',request_id,'predictionId',prediction_id,
    'profileId',profile_id,'sessionId',session_id,'discoveryMode',mode,'itemType',domain,
    'items',items,'nextCursor',null,'continuationSupported',false,'availability',availability,
    'source',jsonb_build_object('version','eligibility-first-v1','candidateCount',candidate_count,
      'resultCount',jsonb_array_length(items),'catalogEmpty',availability='CATALOG_EMPTY'));
  insert into private.prediction_page_receipts(request_id,actor_user_id,profile_id,prediction_id,request,response)
    values(request_id,actor,profile_id,prediction_id,request,response);
  return response;
end;
$$;
revoke all on function private.rank_items_page_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.rank_items_page_v1(jsonb) to authenticated;

create function public.rank_items_page_v1(request jsonb)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select private.rank_items_page_v1(request); $$;
revoke all on function public.rank_items_page_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rank_items_page_v1(jsonb) to authenticated;
