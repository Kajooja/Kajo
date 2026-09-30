-- Private bounded continuation source. This does not enable paging or alter
-- first-page receipts: later page delivery must create its own PredictionRun.
create table private.prediction_continuation_windows (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references private.prediction_page_receipts(request_id) on delete cascade,
  source_prediction_id uuid not null unique references private.prediction_runs(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  discovery_mode text not null check(discovery_mode in ('FOR_YOU','SURPRISE','RISK')),
  item_type text not null check(item_type in ('BOOK','MOVIE')),
  page_size integer not null check(page_size between 1 and 50),
  version text not null default 'frozen-window-v1' check(version='frozen-window-v1'),
  source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'
    and octet_length(source_snapshot::text)<=2097152
    and jsonb_typeof(source_snapshot->'candidates')='array'
    and jsonb_array_length(source_snapshot->'candidates')<=50),
  seen_item_ids uuid[] not null check(cardinality(seen_item_ids)<=50),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  check(expires_at>created_at and expires_at<=created_at+interval '15 minutes')
);
create index prediction_continuation_windows_scope_idx
  on private.prediction_continuation_windows(actor_user_id,profile_id,expires_at);
alter table private.prediction_continuation_windows enable row level security;
revoke all on private.prediction_continuation_windows from public,anon,authenticated,service_role;

create function private.prediction_window_source_v1(source_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$
  select jsonb_build_object('run',to_jsonb(r),'candidates',coalesce((
    select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c
      where c.prediction_id=r.id),'[]'::jsonb))
  from private.prediction_runs r where r.id=source_id;
$$;

create function private.read_prediction_window_v1(window_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare actor uuid := (select auth.uid()); stored_window private.prediction_continuation_windows%rowtype;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select w.* into stored_window from private.prediction_continuation_windows w where w.id=window_id for share;
  if not found or stored_window.actor_user_id<>actor then
    raise exception 'Continuation window unavailable' using errcode='42501';
  end if;
  perform 1 from public.profile_members m where m.profile_id=stored_window.profile_id and m.user_id=actor for share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  if stored_window.expires_at<=clock_timestamp() then
    raise exception 'Continuation window expired' using errcode='22023';
  end if;
  if private.prediction_window_source_v1(stored_window.source_prediction_id) is distinct from stored_window.source_snapshot then
    raise exception 'Continuation source changed' using errcode='22023';
  end if;
  return to_jsonb(stored_window);
end;
$$;

create function private.open_prediction_window_v1(source_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  actor uuid := (select auth.uid()); receipt private.prediction_page_receipts%rowtype;
  run private.prediction_runs%rowtype; existing_id uuid; window_id uuid;
  snapshot jsonb; seen uuid[]; now_at timestamptz;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select r.* into receipt from private.prediction_page_receipts r where r.request_id=source_request_id;
  if not found or receipt.actor_user_id<>actor then
    raise exception 'Prediction request unavailable' using errcode='42501';
  end if;
  -- One scope lock bounds simultaneous fresh-window creation across request IDs.
  -- Keep membership locks shared, including when called after first-page ranking.
  perform pg_advisory_xact_lock(hashtextextended('prediction-window:'||actor::text||':'||receipt.profile_id::text,0));
  perform 1 from public.profile_members m where m.profile_id=receipt.profile_id and m.user_id=actor for share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select w.id into existing_id from private.prediction_continuation_windows w where w.request_id=source_request_id;
  if found then return private.read_prediction_window_v1(existing_id); end if;
  select r.* into strict run from private.prediction_runs r where r.id=receipt.prediction_id;
  now_at := clock_timestamp();
  if run.requested_at+interval '15 minutes'<=now_at then
    raise exception 'Continuation source expired' using errcode='22023';
  end if;
  if run.actor_user_id<>actor or run.profile_id<>receipt.profile_id
    or run.session_id is distinct from (receipt.request->>'sessionId')::uuid
    or run.requested_item_type is distinct from receipt.request->>'itemType'
    or run.discovery_mode is distinct from receipt.request->>'discoveryMode'
    or run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1' then
    raise exception 'Continuation source scope/version mismatch' using errcode='22023';
  end if;
  snapshot := private.prediction_window_source_v1(run.id);
  if jsonb_array_length(snapshot->'candidates')<>run.candidate_count
    or exists(select 1 from jsonb_array_elements(snapshot->'candidates') c
      where c#>>'{explanation,scoringFeatures,version}' is distinct from 'prediction-features-v2') then
    raise exception 'Incomplete frozen continuation source' using errcode='22023';
  end if;
  select coalesce(array_agg(c.item_id order by c.final_rank),'{}'::uuid[]) into seen
    from private.prediction_candidates c where c.prediction_id=run.id and c.selected_for_delivery;
  if cardinality(seen)<>run.result_count then
    raise exception 'Incomplete first-page delivery set' using errcode='22023';
  end if;
  -- Only derived window state is reclaimed; never delete requests or evidence.
  delete from private.prediction_continuation_windows w
    where w.actor_user_id=actor and w.profile_id=receipt.profile_id and w.expires_at<=now_at;
  if (select count(*) from private.prediction_continuation_windows w
    where w.actor_user_id=actor and w.profile_id=receipt.profile_id)>=16 then
    raise exception 'Too many active continuation windows' using errcode='54000';
  end if;
  insert into private.prediction_continuation_windows(request_id,source_prediction_id,actor_user_id,
    profile_id,session_id,discovery_mode,item_type,page_size,source_snapshot,seen_item_ids,created_at,expires_at)
    values(source_request_id,run.id,actor,run.profile_id,run.session_id,run.discovery_mode,run.requested_item_type,
      (receipt.request->>'limit')::integer,snapshot,seen,now_at,run.requested_at+interval '15 minutes') returning id into window_id;
  return private.read_prediction_window_v1(window_id);
end;
$$;
-- No API grants until the page-delivery/replay boundary is implemented.
revoke all on function private.prediction_window_source_v1(uuid),
  private.read_prediction_window_v1(uuid),private.open_prediction_window_v1(uuid)
  from public,anon,authenticated,service_role;
