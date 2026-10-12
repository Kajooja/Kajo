-- Population-preserving post-forward runtime verification. All writes (runs,
-- derived readers and possible canary assignment) are rolled back. This uses a
-- real PersonalProfile's existing authorized context and never edits accounts,
-- catalog, ratings, Lists or Events. Set kajo.verify.profile_id to a known owned
-- PersonalProfile before executing if a specific owner is required.
begin;
create temp table catalog_chain_hosted_observations(snapshot jsonb) on commit drop;
do $verify$
declare
  actor uuid; profile_id uuid; domain text; request jsonb; response jsonb;
  seen uuid[]; ids uuid[]; root_id uuid; previous_id uuid; chain_id uuid;
  step integer; summaries jsonb := '[]'::jsonb;
begin
  if nullif(current_setting('kajo.verify.profile_id',true),'') is not null then
    select p.id,p.owner_user_id into strict profile_id,actor from public.profiles p
      where p.id=current_setting('kajo.verify.profile_id',true)::uuid and p.profile_type='PERSONAL';
  else
    select p.id,p.owner_user_id into profile_id,actor from public.profiles p
      where p.profile_type='PERSONAL' and p.owner_user_id is not null order by p.created_at,p.id limit 1;
  end if;
  if profile_id is null or actor is null then raise exception 'No owned PersonalProfile available for rolled-back verification'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  foreach domain in array array['BOOK','MOVIE'] loop
    request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',profile_id,
      'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType',domain,'limit',20,
      'context','{"attributes":{"surface":"DISCOVERY_GRID"}}'::jsonb,'cursor',null);
    seen := '{}'; previous_id := null; step := 0;
    loop
      perform set_config('role','authenticated',true);
      response := public.rank_items_page_v1(request);
      if public.rank_items_page_v1(request)<>response then raise exception 'Exact chain receipt replay changed'; end if;
      perform set_config('role','postgres',true);
      step := step+1;
      if step=1 then root_id := (response->>'predictionId')::uuid; chain_id := (response#>>'{source,chainId}')::uuid; end if;
      select coalesce(array_agg((item->>'item_id')::uuid order by (item->>'rank')::integer),'{}'::uuid[])
        into ids from jsonb_array_elements(response->'items') item;
      if response->'version'<>'3'::jsonb or response#>>'{source,version}'<>'catalog-chain-v1'
        or response#>>'{source,rootPredictionId}'<>root_id::text
        or response#>>'{source,chainId}'<>chain_id::text
        or response#>>'{source,parentPredictionId}' is distinct from previous_id::text
        or response#>>'{source,sourcePredictionId}'<>response->>'predictionId'
        or (response#>>'{source,pageIndex}')::integer<>step
        or (response#>>'{source,seenCount}')::integer<>cardinality(seen)+cardinality(ids)
        or seen&&ids or cardinality(ids)>20
        or exists(select 1 from jsonb_array_elements(response->'items') item
          where item->>'prediction_id'<>response->>'predictionId' or item->>'item_type'<>domain)
        or not exists(select 1 from private.prediction_catalog_chain_pages p
          where p.prediction_id=(response->>'predictionId')::uuid and p.seen_before=seen) then
        raise exception 'Hosted chain scope, append or provenance verification failed';
      end if;
      seen := seen||ids; previous_id := (response->>'predictionId')::uuid;
      exit when response->'nextCursor'='null'::jsonb or step=4;
      request := request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',response->'nextCursor');
    end loop;
    summaries := summaries||jsonb_build_array(jsonb_build_object('itemType',domain,
      'pages',step,'deliveredCount',cardinality(seen),
      'pastFormer50',cardinality(seen)>50,'continuationState',response#>>'{source,continuationState}'));
  end loop;
  insert into pg_temp.catalog_chain_hosted_observations values(jsonb_build_object(
    'catalogChainHosted','PASS: authorized BOOK/MOVIE append and immutable exact receipts',
    'domains',summaries,'rolledBack',true));
end;
$verify$;
select snapshot from pg_temp.catalog_chain_hosted_observations;
rollback;
