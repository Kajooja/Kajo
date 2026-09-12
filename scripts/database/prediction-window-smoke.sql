-- Caller owns BEGIN/ROLLBACK and installs candidate-pool-fixture.sql.
do $window_probe$
declare
  actor uuid := 'a22a0000-0000-4000-8000-000000000001';
  profile uuid; request jsonb; response jsonb; frozen_window jsonb; again jsonb;
  request_id uuid := gen_random_uuid(); window_id uuid; before_runs integer; n integer;
  selected uuid[];
begin
  select profile_id into strict profile from pg_temp.pool_profiles where profile_type='PERSONAL';
  request := jsonb_build_object('version',1,'requestId',request_id,'profileId',profile,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',20,'context','{}'::jsonb);
  perform set_config('role','authenticated',true);
  response := public.rank_items_page_v1(request);
  begin
    perform private.open_prediction_window_v1(request_id);
    raise exception 'API role can open unfinished continuation boundary';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  select count(*) into before_runs from private.prediction_runs;
  frozen_window := private.open_prediction_window_v1(request_id); window_id := (frozen_window->>'id')::uuid;
  if frozen_window->>'version'<>'frozen-window-v1' or frozen_window->>'profile_id'<>profile::text
    or frozen_window->>'source_prediction_id'<>response->>'predictionId'
    or jsonb_array_length(frozen_window#>'{source_snapshot,candidates}')<>50
    or jsonb_array_length(frozen_window->'seen_item_ids')<>20 then raise exception 'Incomplete frozen frozen_window'; end if;
  select array_agg((r->>'item_id')::uuid order by (r->>'rank')::integer) into selected
    from jsonb_array_elements(response->'items') r;
  if to_jsonb(selected)<>frozen_window->'seen_item_ids' then raise exception 'Seen set differs from committed first page'; end if;
  if private.open_prediction_window_v1(request_id)<>frozen_window
    or private.read_prediction_window_v1(window_id)<>frozen_window then raise exception 'Window retry changed identity/source'; end if;
  if (select count(*) from private.prediction_runs)<>before_runs then raise exception 'Opening a frozen_window reranked or fabricated evidence'; end if;
  -- Catalog/taste changes do not replace the snapshot; delivery eligibility must
  -- be checked by the future page commit, not by treating this as a new ranking.
  update public.items set title=title||' changed',discoverable=false;
  update public.item_interactions set rating=2 where profile_id=profile and rating is not null;
  if private.read_prediction_window_v1(window_id)<>frozen_window then raise exception 'Later state rewrote frozen source'; end if;
  begin
    update private.prediction_candidates set final_score=final_score+1
      where prediction_id=(response->>'predictionId')::uuid;
    perform private.read_prediction_window_v1(window_id);
    raise exception 'Source drift was accepted';
  exception when invalid_parameter_value then null; end;
  if private.read_prediction_window_v1(window_id)<>frozen_window then raise exception 'Drift probe did not roll back'; end if;
  perform set_config('request.jwt.claim.sub','a22a0000-0000-4000-8000-000000000003',true);
  begin
    perform private.read_prediction_window_v1(window_id);
    raise exception 'Outsider read frozen source';
  exception when insufficient_privilege then null; end;
  begin
    perform private.open_prediction_window_v1(request_id);
    raise exception 'Outsider opened another actor request';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform private.read_prediction_window_v1(window_id);
    raise exception 'Missing actor read frozen source';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  -- The remaining catalog is empty: these windows still have real source IDs.
  for n in 2..16 loop
    request_id := gen_random_uuid();
    perform public.rank_items_page_v1(request||jsonb_build_object('requestId',request_id));
    again := private.open_prediction_window_v1(request_id);
    if again#>'{source_snapshot,candidates}'<>'[]'::jsonb or again->'seen_item_ids'<>'[]'::jsonb then
      raise exception 'Empty source manufactured candidates';
    end if;
  end loop;
  request_id := gen_random_uuid();
  perform public.rank_items_page_v1(request||jsonb_build_object('requestId',request_id));
  begin
    perform private.open_prediction_window_v1(request_id);
    raise exception 'Active frozen_window cap ignored';
  exception when program_limit_exceeded then null; end;
  update private.prediction_continuation_windows set created_at=now()-interval '16 minutes',expires_at=now()-interval '1 minute'
    where id=window_id;
  begin
    perform private.read_prediction_window_v1(window_id);
    raise exception 'Expired frozen_window accepted';
  exception when invalid_parameter_value then null; end;
  again := private.open_prediction_window_v1(request_id);
  if (select count(*) from private.prediction_continuation_windows where profile_id=profile)<>16
    or exists(select 1 from private.prediction_continuation_windows where id=window_id)
    or not exists(select 1 from private.prediction_runs where id=(response->>'predictionId')::uuid) then
    raise exception 'Expired cache cleanup removed evidence or failed to bound state';
  end if;
  delete from public.profile_members where profile_id=profile and user_id=actor;
  begin
    perform private.read_prediction_window_v1((again->>'id')::uuid);
    raise exception 'Revoked member read frozen_window';
  exception when insufficient_privilege then null; end;
end;
$window_probe$;
select jsonb_build_object('predictionWindow',
  'PASS: bounded frozen sources, idempotent open, exact seen set, empty runs, source drift, expiry/cap/cleanup and actor/member isolation') as snapshot;
