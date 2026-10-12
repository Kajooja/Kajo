-- Protocol 2 opts into bounded continuation; protocol 1 and committed receipts
-- remain unchanged. Cache expiry never removes page evidence or retry receipts.
create table private.prediction_page_contexts (
  prediction_id uuid primary key references private.prediction_runs(id) on delete cascade,
  source_prediction_id uuid not null,
  parent_prediction_id uuid not null,
  window_id uuid not null,
  page_index integer not null check(page_index between 2 and 51),
  feature_at timestamptz not null,
  eligibility_at timestamptz not null,
  seen_before uuid[] not null check(cardinality(seen_before)<=50),
  reminder_previously_delivered boolean not null,
  reminder_delivered boolean not null,
  version text not null default 'frozen-page-v1' check(version='frozen-page-v1'),
  unique(window_id,page_index)
);
alter table private.prediction_page_contexts enable row level security;
revoke all on private.prediction_page_contexts from public,anon,authenticated,service_role;
create trigger prediction_page_contexts_immutable before update on private.prediction_page_contexts
  for each row execute function private.reject_immutable_prediction_artifact_change_v1();

create table private.prediction_page_cursors (
  token uuid primary key default gen_random_uuid(),
  window_id uuid not null references private.prediction_continuation_windows(id) on delete cascade,
  parent_prediction_id uuid not null references private.prediction_runs(id) on delete cascade,
  page_index integer not null check(page_index between 2 and 51),
  used_request_id uuid unique references private.prediction_page_receipts(request_id) on delete cascade,
  unique(window_id,page_index)
);
create index prediction_page_cursors_parent_idx on private.prediction_page_cursors(parent_prediction_id);
alter table private.prediction_page_cursors enable row level security;
revoke all on private.prediction_page_cursors from public,anon,authenticated,service_role;

-- Apply hard page constraints before the shared reminder selection. Store this
-- input on every candidate so shadow uses the observed prefix, never live state.
create function private.prediction_page_policy_input_v1(
  policy jsonb, seen boolean, catalog_available boolean, reminder_spent boolean)
returns jsonb language sql immutable set search_path=''
as $$
  select case
    when seen then policy||'{"eligible":false,"classification":"PAGE_SEEN","reason":"ALREADY_DELIVERED_IN_WINDOW"}'::jsonb
    when not catalog_available then policy||'{"eligible":false,"classification":"PAGE_UNAVAILABLE","reason":"CATALOG_UNAVAILABLE_AT_DELIVERY"}'::jsonb
    when reminder_spent and policy->>'classification'='SAVED_REMINDER_ELIGIBLE'
      then policy||'{"eligible":false,"classification":"PAGE_REMINDER_CAP","reason":"WINDOW_REMINDER_ALREADY_DELIVERED"}'::jsonb
    else policy end;
$$;
revoke all on function private.prediction_page_policy_input_v1(jsonb,boolean,boolean,boolean)
  from public,anon,authenticated,service_role;

-- Keep an exact copy of the prior first-page contract, without exposing another
-- API function. No prior receipt, run, candidate, Event or window is rewritten.
do $legacy$
declare definition text := pg_get_functiondef('private.rank_items_page_v1(jsonb)'::regprocedure);
begin
  if position('continuation unavailable' in definition)=0
    or position('''continuationSupported'',false' in definition)=0 then
    raise exception 'Atomic page forward: unexpected first-page source';
  end if;
  execute replace(definition,'FUNCTION private.rank_items_page_v1(',
    'FUNCTION private.rank_items_first_page_v1(');
end;
$legacy$;
revoke all on function private.rank_items_first_page_v1(jsonb) from public,anon,authenticated,service_role;

create or replace function private.rank_items_page_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set extra_float_digits=3
as $$
<<page_request>>
declare
  actor uuid := (select auth.uid());
  request_id uuid; profile_id uuid; session_id uuid; prediction_id uuid;
  mode text; domain text; page_size integer; context jsonb; cursor_id uuid;
  receipt private.prediction_page_receipts%rowtype;
  root_receipt private.prediction_page_receipts%rowtype;
  stored_window private.prediction_continuation_windows%rowtype;
  cursor_row private.prediction_page_cursors%rowtype;
  source_run private.prediction_runs%rowtype;
  items jsonb; response jsonb; candidate_count integer; availability text;
  next_cursor uuid; window_json jsonb; now_at timestamptz;
  selected uuid[]; seen_after uuid[]; reminder_spent boolean; selected_reminder boolean;
  uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if request->'version'='1'::jsonb then return private.rank_items_first_page_v1(request); end if;
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>16384
    or request->'version' is distinct from '2'::jsonb
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
  if page_size<1 or page_size>50 or context ? 'sessionId' then
    raise exception 'Invalid page limit or nested session identity' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  -- Shared with window creation: serializes page consumption and scope capacity.
  perform pg_advisory_xact_lock(hashtextextended('prediction-window:'||actor::text||':'||profile_id::text,0));
  perform 1 from public.profile_members m
    where m.profile_id=page_request.profile_id and m.user_id=actor for share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select r.* into receipt from private.prediction_page_receipts r where r.request_id=page_request.request_id;
  if found then
    if receipt.actor_user_id<>actor or receipt.request<>request then
      raise exception 'Prediction request ID already used' using errcode='22023';
    end if;
    -- Exact historical retry remains valid after cache expiry, but still needs
    -- current membership. Its expired next cursor cannot start another page.
    return receipt.response;
  end if;

  prediction_id := gen_random_uuid();
  if cursor_id is null then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.rank),'[]'::jsonb) into items
      from private.rank_items_with_identity_v1(prediction_id,profile_id,mode,domain,page_size,
        context||jsonb_build_object('sessionId',session_id)) r;
    select r.* into strict source_run from private.prediction_runs r where r.id=page_request.prediction_id;
    candidate_count := source_run.candidate_count;
  else
    select c.* into cursor_row from private.prediction_page_cursors c where c.token=cursor_id;
    if not found then raise exception 'Continuation cursor unavailable' using errcode='22023'; end if;
    window_json := private.read_prediction_window_v1(cursor_row.window_id);
    select w.* into strict stored_window from private.prediction_continuation_windows w
      where w.id=cursor_row.window_id for update;
    select r.* into strict root_receipt from private.prediction_page_receipts r where r.request_id=stored_window.request_id;
    if stored_window.profile_id<>profile_id or stored_window.session_id<>session_id
      or stored_window.discovery_mode<>mode or stored_window.item_type<>domain
      or stored_window.page_size<>page_size or root_receipt.request->'context'<>context
      or root_receipt.request->'version'<>'2'::jsonb then
      raise exception 'Continuation request scope mismatch' using errcode='22023';
    end if;
    if cursor_row.used_request_id is not null then
      raise exception 'Continuation cursor already consumed' using errcode='22023';
    end if;
    source_run := jsonb_populate_record(null::private.prediction_runs,stored_window.source_snapshot->'run');
    now_at := clock_timestamp();
    reminder_spent := exists(select 1 from jsonb_array_elements(stored_window.source_snapshot->'candidates') c
      where (c->>'selected_for_delivery')::boolean and c#>>'{explanation,resurfacingPolicy,classification}'='SAVED_REMINDER')
      or exists(select 1 from private.prediction_page_contexts p where p.window_id=stored_window.id and p.reminder_delivered);
    insert into private.prediction_runs(id,actor_user_id,profile_id,session_id,requested_at,requested_item_type,
      discovery_mode,model_version,base_model_version,policy_version,experiment_key,context,state_snapshot,genome_id,policy_assignment_id)
    values(prediction_id,actor,profile_id,session_id,now_at,domain,mode,source_run.model_version,source_run.base_model_version,
      source_run.policy_version||'+frozen-page-v1',source_run.experiment_key,source_run.context,source_run.state_snapshot,
      source_run.genome_id,source_run.policy_assignment_id);

    with current_inputs as materialized (
      select c.*, private.prediction_page_policy_input_v1(
        private.resurfacing_policy_decision_v1(page_request.profile_id,c.item_id,jsonb_build_object(
          'consumedSuppressed',coalesce(s.consumed,false),'rating',s.rating,
          'notInterested',coalesce(s.not_interested,false),'saved',coalesce(s.saved,false)),now_at),
        c.item_id=any(stored_window.seen_item_ids),coalesce(i.discoverable and i.item_type=domain,false),reminder_spent) as policy
      from jsonb_populate_recordset(null::private.prediction_candidates,stored_window.source_snapshot->'candidates') c
      left join public.items i on i.id=c.item_id
      left join public.item_interactions s on s.profile_id=page_request.profile_id and s.item_id=c.item_id
    ), reminders as (
      select item_id,row_number() over(order by source_score desc,item_id)::integer as reminder_order
      from current_inputs where policy->>'classification'='SAVED_REMINDER_ELIGIBLE'
    ), finalized as (
      select c.*,private.finalize_resurfacing_policy_v1(c.policy,r.reminder_order) as final_policy
      from current_inputs c left join reminders r using(item_id)
    ), ranked as (
      select c.*,row_number() over(order by private.prediction_delivery_tier_v1(final_policy),final_score desc,item_id)::integer as page_rank
      from finalized c
    )
    insert into private.prediction_candidates(prediction_id,item_id,source_rank,final_rank,source_score,final_score,
      confidence,scenario_score,scenario_support,scenario_max_similarity,selected_for_delivery,selection_probability,explanation)
    select page_request.prediction_id,c.item_id,c.source_rank,c.page_rank,c.source_score,c.final_score,c.confidence,
      c.scenario_score,c.scenario_support,c.scenario_max_similarity,
      private.prediction_delivery_tier_v1(c.final_policy)<2 and c.page_rank<=page_size,null,
      c.explanation||jsonb_build_object('policyVersion',source_run.policy_version||'+frozen-page-v1',
        'resurfacingInput',c.policy,'resurfacingPolicy',c.final_policy,
        'continuation',jsonb_build_object('version','frozen-page-v1','sourcePredictionId',source_run.id,
          'parentPredictionId',cursor_row.parent_prediction_id,'pageIndex',cursor_row.page_index,
          'featureAt',source_run.requested_at,'eligibilityAt',now_at))
    from ranked c;
    select coalesce(array_agg(c.item_id order by c.final_rank),'{}'::uuid[]),
      coalesce(bool_or(c.explanation#>>'{resurfacingPolicy,classification}'='SAVED_REMINDER'),false)
      into selected,selected_reminder from private.prediction_candidates c
      where c.prediction_id=page_request.prediction_id and c.selected_for_delivery;
    seen_after := stored_window.seen_item_ids||selected;
    if cardinality(seen_after)>50 or cardinality(seen_after)<>(select count(distinct id) from unnest(seen_after) id) then
      raise exception 'Invalid continuation seen set' using errcode='22023';
    end if;
    insert into private.prediction_page_contexts(prediction_id,source_prediction_id,parent_prediction_id,window_id,
      page_index,feature_at,eligibility_at,seen_before,reminder_previously_delivered,reminder_delivered)
    values(prediction_id,source_run.id,cursor_row.parent_prediction_id,stored_window.id,cursor_row.page_index,
      source_run.requested_at,now_at,stored_window.seen_item_ids,reminder_spent,selected_reminder);
    update private.prediction_continuation_windows w set seen_item_ids=seen_after where w.id=stored_window.id;
    candidate_count := source_run.candidate_count;
    update private.prediction_runs r set candidate_count=page_request.candidate_count,result_count=cardinality(selected)
      where r.id=page_request.prediction_id;
    select coalesce(jsonb_agg(jsonb_build_object('prediction_id',c.prediction_id,'item_id',c.item_id,
      'item_type',i.item_type,'title',i.title,'description',i.description,'tags',i.tags,
      'score',c.final_score,'confidence',c.confidence,'rank',c.final_rank,'explanation',c.explanation) order by c.final_rank),'[]'::jsonb)
      into items from private.prediction_candidates c join public.items i on i.id=c.item_id
      where c.prediction_id=page_request.prediction_id and c.selected_for_delivery;
  end if;

  availability := case when jsonb_array_length(items)>0 then 'ITEMS'
    when cursor_id is null and candidate_count=0 and not exists(select 1 from public.items i where i.discoverable and i.item_type=domain)
      then 'CATALOG_EMPTY' else 'WINDOW_EXHAUSTED' end;
  response := jsonb_build_object('version',2,'requestId',request_id,'predictionId',prediction_id,
    'profileId',profile_id,'sessionId',session_id,'discoveryMode',mode,'itemType',domain,
    'items',items,'nextCursor',null,'continuationSupported',true,'availability',availability,
    'source',jsonb_build_object('version','frozen-page-v1','candidateCount',candidate_count,
      'resultCount',jsonb_array_length(items),'catalogEmpty',availability='CATALOG_EMPTY',
      'sourcePredictionId',source_run.id,'pageIndex',coalesce(cursor_row.page_index,1),
      'featureAt',source_run.requested_at));
  insert into private.prediction_page_receipts(request_id,actor_user_id,profile_id,prediction_id,request,response)
    values(request_id,actor,profile_id,prediction_id,request,response);
  if cursor_id is null and jsonb_array_length(items)>0 then
    window_json := private.open_prediction_window_v1(request_id);
    stored_window := jsonb_populate_record(null::private.prediction_continuation_windows,window_json);
    seen_after := stored_window.seen_item_ids;
  end if;
  if jsonb_array_length(items)>0 and cardinality(seen_after)<candidate_count then
    insert into private.prediction_page_cursors(window_id,parent_prediction_id,page_index)
      values(stored_window.id,prediction_id,coalesce(cursor_row.page_index,1)+1) returning token into next_cursor;
    response := jsonb_set(response,'{nextCursor}',to_jsonb(next_cursor));
    -- This row is still uncommitted: the externally visible receipt is written
    -- once atomically with the complete cursor, run, candidates and seen state.
    update private.prediction_page_receipts r set response=page_request.response where r.request_id=page_request.request_id;
  end if;
  if cursor_id is not null then
    update private.prediction_page_cursors c set used_request_id=request_id where c.token=cursor_id;
  end if;
  return response;
end;
$$;
revoke all on function private.rank_items_page_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.rank_items_page_v1(jsonb) to authenticated;

-- Reuse the established frozen scorer/reminder policy. Page inputs already
-- freeze hard exclusions and the actually observed preceding pages. Label that
-- conditional comparison explicitly; it is not a counterfactual whole session.
do $replay$
declare target regprocedure; definition text; patch record; matches integer;
begin
  foreach target in array array['private.process_shadow_prediction_jobs_v1(integer)'::regprocedure,
    'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure] loop
    definition := pg_get_functiondef(target);
    for patch in select * from (values
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$      shadow_run_id := gen_random_uuid();$old$,
        $new$      if 'frozen-page-v1'=any(string_to_array(source_run.policy_version,'+'))
        and not exists(select 1 from private.prediction_page_contexts p where p.prediction_id=source_run.id) then
        raise exception 'Missing immutable page context';
      end if;
      shadow_run_id := gen_random_uuid();$new$,1),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$        'shadow-replay-v2',
        'prediction-features-v2',$old$,
        $new$        case when 'frozen-page-v1'=any(string_to_array(source_run.policy_version,'+'))
          then 'shadow-page-replay-v1' else 'shadow-replay-v2' end,
        'prediction-features-v2',$new$,1),
      ('private.process_shadow_prediction_jobs_v1(integer)', $old$          'version', 'shadow-replay-v2',
          'comparisonScope', 'FROZEN_SOURCE_POOL',$old$,
        $new$          'version', case when 'frozen-page-v1'=any(string_to_array(source_run.policy_version,'+'))
            then 'shadow-page-replay-v1' else 'shadow-replay-v2' end,
          'comparisonScope', case when 'frozen-page-v1'=any(string_to_array(source_run.policy_version,'+'))
            then 'FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX' else 'FROZEN_SOURCE_POOL' end,$new$,1),
      ('private.evaluate_shadow_genome_v1(uuid,uuid)', $old$      and shadow.code_version = 'shadow-replay-v2'$old$,
        $new$      and shadow.code_version = case when 'frozen-page-v1'=any(string_to_array(production.policy_version,'+'))
        then 'shadow-page-replay-v1' else 'shadow-replay-v2' end$new$,1),
      ('private.evaluate_shadow_genome_v1(uuid,uuid)', $old$        'comparisonScope', 'FROZEN_SOURCE_POOL',$old$,
        $new$        'comparisonScope', 'FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX',
        'pageReplayVersion', 'shadow-page-replay-v1',$new$,2)
    ) changes(identity,old_source,new_source,expected_matches) where identity::regprocedure=target loop
      matches := (length(definition)-length(replace(definition,patch.old_source,'')))/length(patch.old_source);
      if matches<>patch.expected_matches then raise exception 'Atomic page forward: unexpected replay anchor in %',target; end if;
      definition := replace(definition,patch.old_source,patch.new_source);
    end loop;
    execute definition;
  end loop;
end;
$replay$;
