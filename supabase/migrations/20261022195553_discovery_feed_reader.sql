-- A feed refresh replaces only its owned, derived reader. Every delivered
-- PredictionRun, page origin and exact v1-v3 receipt remains immutable.
create table private.prediction_feed_receipts (
  request_id uuid primary key references private.prediction_page_receipts(request_id) on delete cascade,
  replaces_chain_id uuid unique,
  request jsonb not null check(jsonb_typeof(request)='object')
);
alter table private.prediction_feed_receipts enable row level security;
revoke all on private.prediction_feed_receipts from public,anon,authenticated,service_role;
create trigger prediction_feed_receipts_immutable before update
  on private.prediction_feed_receipts for each row
  execute function private.reject_immutable_prediction_artifact_change_v1();

create function private.rank_items_feed_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set extra_float_digits=3
as $$
<<feed_request>>
declare
  actor uuid := (select auth.uid());
  request_id uuid; profile_id uuid; replaces_chain_id uuid;
  receipt private.prediction_page_receipts%rowtype;
  feed_receipt private.prediction_feed_receipts%rowtype;
  source_run private.prediction_runs%rowtype;
  response jsonb;
  uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>16384
    or request->'version' is distinct from '3'::jsonb
    or not coalesce(request->>'requestId' ~* uuid_pattern,false)
    or not coalesce(request->>'profileId' ~* uuid_pattern,false)
    or not coalesce(request->>'sessionId' ~* uuid_pattern,false)
    or coalesce(request->'cursor','null'::jsonb)<>'null'::jsonb
    or not(request ? 'replacesChainId')
    or (request->'replacesChainId'<>'null'::jsonb and
      (jsonb_typeof(request->'replacesChainId') is distinct from 'string'
        or not coalesce(request->>'replacesChainId' ~* uuid_pattern,false))) then
    raise exception 'Invalid feed prediction request' using errcode='22023';
  end if;
  request_id := (request->>'requestId')::uuid;
  profile_id := (request->>'profileId')::uuid;
  replaces_chain_id := (request->>'replacesChainId')::uuid;
  -- The same lock order as v3 serializes receipt identity, all reader opens,
  -- continuation consumption and replacement under the existing shared cap.
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('prediction-window:'||actor::text||':'||profile_id::text,0));
  perform 1 from public.profile_members m where m.profile_id=feed_request.profile_id and m.user_id=actor for share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select r.* into receipt from private.prediction_page_receipts r where r.request_id=feed_request.request_id;
  if found then
    select r.* into feed_receipt from private.prediction_feed_receipts r where r.request_id=feed_request.request_id;
    if not found or receipt.actor_user_id<>actor or feed_receipt.request<>request then
      raise exception 'Prediction request ID already used' using errcode='22023';
    end if;
    return receipt.response;
  end if;
  if replaces_chain_id is not null then
    -- Root evidence outlives the cache, so an expired reader can still be
    -- replaced safely. Client-supplied IDs never authorize another scope.
    select r.* into source_run from private.prediction_runs r
      join private.prediction_catalog_chain_pages p on p.prediction_id=r.id
      where p.chain_id=feed_request.replaces_chain_id and p.page_index=1;
    if not found or source_run.actor_user_id<>actor or source_run.profile_id<>profile_id
      or source_run.session_id is distinct from (request->>'sessionId')::uuid
      or source_run.discovery_mode is distinct from request->>'discoveryMode'
      or source_run.requested_item_type is distinct from request->>'itemType' then
      raise exception 'Feed reader scope unavailable' using errcode='42501';
    end if;
    if exists(select 1 from private.prediction_feed_receipts r
      where r.replaces_chain_id=feed_request.replaces_chain_id) then
      raise exception 'Feed reader already replaced' using errcode='22023';
    end if;
    delete from private.prediction_catalog_chains c where c.id=feed_request.replaces_chain_id;
  end if;
  -- V3 performs all remaining envelope/context validation and fresh ranking.
  -- Any failure rolls back retirement together with the attempted successor.
  response := private.rank_items_page_v1(request-'replacesChainId');
  insert into private.prediction_feed_receipts(request_id,replaces_chain_id,request)
    values(request_id,replaces_chain_id,request);
  return response;
end;
$$;
revoke all on function private.rank_items_feed_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.rank_items_feed_v1(jsonb) to authenticated;

create function public.rank_items_feed_v1(request jsonb)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select private.rank_items_feed_v1(request); $$;
revoke all on function public.rank_items_feed_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rank_items_feed_v1(jsonb) to authenticated;
