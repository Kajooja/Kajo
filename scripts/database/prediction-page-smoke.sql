-- Caller installs candidate-pool-fixture.sql inside BEGIN/ROLLBACK.
do $page$
declare
  actor uuid := 'a22a0000-0000-4000-8000-000000000001';
  outsider uuid := 'a22a0000-0000-4000-8000-000000000003';
  profile uuid; command jsonb; first_page jsonb; result jsonb; change jsonb;
  run_count integer; empty_id uuid; domain text; mode text;
begin
  select profile_id into strict profile from pg_temp.pool_profiles where profile_type='PERSONAL';
  command := jsonb_build_object('version',1,'requestId',gen_random_uuid(),'profileId',profile,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',20,'context','{}'::jsonb);
  perform set_config('role','authenticated',true);
  first_page := public.rank_items_page_v1(command);
  if first_page->>'availability'<>'ITEMS' or jsonb_array_length(first_page->'items')<>20
    or first_page->'continuationSupported'<>'false'::jsonb or first_page->'nextCursor'<>'null'::jsonb
    or first_page->>'profileId'<>profile::text or first_page->'sessionId'<>command->'sessionId' then
    raise exception 'Invalid identified page: %',first_page;
  end if;
  perform set_config('role','postgres',true);
  if not exists(select 1 from private.prediction_runs r where r.id=(first_page->>'predictionId')::uuid
    and r.session_id=(command->>'sessionId')::uuid and r.result_count=20) then
    raise exception 'Page did not retain its actual run';
  end if;
  if exists(select 1 from jsonb_array_elements(first_page->'items') with ordinality a(item,n)
    where item->>'prediction_id'<>first_page->>'predictionId' or (item->>'rank')::integer<>n)
    or (select count(distinct item->>'item_id') from jsonb_array_elements(first_page->'items') item)<>20 then
    raise exception 'Page lost exact unique Item origins/ranks';
  end if;
  select count(*) into run_count from private.prediction_runs;
  -- Changes to catalog/eligibility must not rerank an accepted request.
  update public.items set title=title||' changed';
  perform set_config('role','authenticated',true);
  if public.rank_items_page_v1(command)<>first_page then raise exception 'Retry changed response'; end if;
  for change in select value from jsonb_array_elements(jsonb_build_array(
    '{"limit":6}'::jsonb, '{"discoveryMode":"RISK"}'::jsonb, '{"itemType":"MOVIE"}'::jsonb,
    jsonb_build_object('sessionId',gen_random_uuid()), '{"context":{"x":1}}'::jsonb)) loop
    begin
      perform public.rank_items_page_v1(command||change);
      raise exception 'Accepted reused ID with changed payload';
    exception when invalid_parameter_value then null; end;
  end loop;
  for change in select value from jsonb_array_elements('[null,[],{},
    {"version":"1"},{"limit":null},{"limit":0},{"limit":51},{"limit":1.5},
    {"context":null},{"context":{"sessionId":"bad"}},{"cursor":"fake"},
    {"sessionId":"bad"},{"requestId":null},{"extra":true}]'::jsonb) loop
    begin
      perform public.rank_items_page_v1(case when change in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb)
        then change else command||change end);
      raise exception 'Accepted malformed request: %',change;
    exception when invalid_parameter_value then null; end;
  end loop;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.rank_items_page_v1(command);
    raise exception 'Outsider read cached response';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.rank_items_page_v1(command);
    raise exception 'Missing actor read cached response';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','postgres',true);
  if (select count(*) from private.prediction_runs)<>run_count then raise exception 'Retry/error wrote a run'; end if;
  -- Empty results across both domains/modes retain explicit identity.
  insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating)
    select profile,item_id,actor,true,8 from pg_temp.pool_items where kind='ORDINARY';
  update public.item_interactions set consumed=true where profile_id=profile;
  foreach domain in array array['BOOK','MOVIE'] loop
    foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
      command := command||jsonb_build_object('requestId',gen_random_uuid(),'itemType',domain,'discoveryMode',mode);
      perform set_config('role','authenticated',true);
      result := public.rank_items_page_v1(command);
      if result->>'availability'<>'WINDOW_EXHAUSTED' or result->'items'<>'[]'::jsonb
        or public.rank_items_page_v1(command)<>result then raise exception 'Suppressed result/retry misclassified'; end if;
      perform set_config('role','postgres',true);
      empty_id := (result->>'predictionId')::uuid;
      if not exists(select 1 from private.prediction_runs where id=empty_id and result_count=0 and candidate_count=50)
        then raise exception 'Empty result lost real source trace'; end if;
    end loop;
  end loop;
  update public.items set discoverable=false;
  command := command||jsonb_build_object('requestId',gen_random_uuid());
  perform set_config('role','authenticated',true);
  result := public.rank_items_page_v1(command);
  if result->>'availability'<>'CATALOG_EMPTY' or result#>>'{source,candidateCount}'<>'0'
    or result->'items'<>'[]'::jsonb then raise exception 'Empty catalog not distinguished'; end if;
  perform set_config('role','postgres',true);
  if not exists(select 1 from private.prediction_runs where id=(result->>'predictionId')::uuid
    and result_count=0 and candidate_count=0) then raise exception 'Catalog-empty run identity missing'; end if;
  -- A receipt failure after ranking must roll the new trace back as well.
  select count(*) into run_count from private.prediction_runs;
  alter table private.prediction_page_receipts add constraint page_failure_probe check(false) not valid;
  perform set_config('role','authenticated',true);
  begin
    perform public.rank_items_page_v1(command||jsonb_build_object('requestId',gen_random_uuid()));
    raise exception 'Injected receipt failure was ignored';
  exception when check_violation then null; end;
  perform set_config('role','postgres',true);
  alter table private.prediction_page_receipts drop constraint page_failure_probe;
  if (select count(*) from private.prediction_runs)<>run_count then
    raise exception 'Receipt failure left an orphan run';
  end if;
  delete from public.profile_members where profile_id=profile and user_id=actor;
  perform set_config('role','authenticated',true);
  begin
    perform public.rank_items_page_v1(command);
    raise exception 'Revoked member read receipt';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  if has_function_privilege('anon','public.rank_items_page_v1(jsonb)','execute')
    or has_function_privilege('authenticated','private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)','execute')
    or has_table_privilege('authenticated','private.prediction_page_receipts','select') then
    raise exception 'Page implementation privileges escaped boundary';
  end if;
end;
$page$;
select jsonb_build_object('predictionPage',
  'PASS: identified Items/suppressed/catalog-empty runs, exact retries, payload validation, immutable origins and current authorization') as snapshot;
