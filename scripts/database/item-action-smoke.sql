-- Synthetic, rollback-only command acceptance. Run on the full installed schema.
begin;
create function pg_temp.reject_item_action_event() returns trigger language plpgsql as $$
begin
  if new.id::text=current_setting('kajo.reject_action',true) then
    raise exception 'Forced Event failure';
  end if;
  return new;
end;
$$;
create trigger reject_item_action_event before insert on public.events
for each row execute function pg_temp.reject_item_action_event();

do $actions$
declare
  actor uuid := gen_random_uuid();
  partner uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  personal uuid;
  shared uuid := gen_random_uuid();
  item uuid := gen_random_uuid();
  trace_item uuid := gen_random_uuid();
  session uuid := gen_random_uuid();
  started timestamptz := now();
  first_id uuid := gen_random_uuid();
  second_id uuid := gen_random_uuid();
  cmd jsonb;
  first_cmd jsonb;
  second_cmd jsonb;
  undo_cmd jsonb;
  result jsonb;
  first_result jsonb;
  before_rows bigint;
  state_before jsonb;
  rejected uuid;
  shared_cmd jsonb;
  ranked record;
  trace_result jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Action '||left(id::text,17))
    from unnest(array[actor,partner,outsider]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Action smoke');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into public.items(id,item_type,title,tags,discoverable)
    values(item,'BOOK','Action book','{action-smoke}',true),(trace_item,'MOVIE','Action film','{action-smoke}',true);
  insert into public.item_interactions(profile_id,item_id,actor_user_id,saved)
    values(personal,item,actor,true);
  cmd := jsonb_build_object('version',1,'actionId',first_id,'actorUserId',actor,'profileId',personal,
    'itemId',item,'occurredAt',started,'kind','SET_RATING','rating',8,'predictionId',null,
    'discoveryMode','FOR_YOU','session',jsonb_build_object('sessionId',session,'startedAt',started,'context','{}'::jsonb));
  first_cmd := cmd;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  first_result := public.commit_item_action_v1(cmd);
  if public.commit_item_action_v1(cmd) is distinct from first_result then raise exception 'Retry result changed'; end if;
  if first_result->'interaction' is distinct from '{"interest":null,"saved":true,"consumed":true,"rating":8,"notInterested":false}'::jsonb then
    raise exception 'Rating changed unrelated state or failed consumption';
  end if;
  begin
    perform public.commit_item_action_v1(cmd || '{"rating":2}'::jsonb);
    raise exception 'Changed payload reused action ID';
  exception when data_exception then null; end;
  perform set_config('role','postgres',true);
  if (select count(*) from public.events where profile_id=personal)<>1
    or (select count(*) from private.item_action_receipts where profile_id=personal)<>1 then
    raise exception 'Duplicate action effects';
  end if;

  second_cmd := (cmd - 'rating') || jsonb_build_object('actionId',second_id,'kind','SET_NOT_INTERESTED','notInterested',true);
  perform set_config('role','authenticated',true);
  result := public.commit_item_action_v1(second_cmd);
  if result->'interaction' is distinct from '{"interest":null,"saved":true,"consumed":false,"rating":null,"notInterested":true}'::jsonb then
    raise exception 'Not-interest state is inconsistent';
  end if;
  undo_cmd := (cmd - 'rating') || jsonb_build_object('actionId',gen_random_uuid(),'kind','UNDO','reversesActionId',first_id);
  begin
    perform public.commit_item_action_v1(undo_cmd);
    raise exception 'Intervening action was overwritten by undo';
  exception when sqlstate 'KJ001' then null; end;
  undo_cmd := undo_cmd || jsonb_build_object('reversesActionId',second_id);
  result := public.commit_item_action_v1(undo_cmd);
  if result->'interaction' is distinct from first_result->'interaction'
    or public.commit_item_action_v1(undo_cmd) is distinct from result then raise exception 'Undo is not exact/idempotent'; end if;
  undo_cmd := undo_cmd || jsonb_build_object('actionId',gen_random_uuid(),'reversesActionId',first_id);
  result := public.commit_item_action_v1(undo_cmd);
  if result->'interaction' is distinct from '{"interest":null,"saved":true,"consumed":false,"rating":null,"notInterested":false}'::jsonb then
    raise exception 'Ordered undo did not restore original state';
  end if;

  -- Legacy writes, including a return to the same values, invalidate old undo.
  cmd := first_cmd || jsonb_build_object('actionId',gen_random_uuid());
  perform public.commit_item_action_v1(cmd);
  perform set_config('role','postgres',true);
  update public.item_interactions set rating=9 where profile_id=personal and item_id=item;
  update public.item_interactions set rating=8 where profile_id=personal and item_id=item;
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_item_action_v1((cmd - 'rating') || jsonb_build_object('actionId',gen_random_uuid(),
      'kind','UNDO','reversesActionId',cmd->>'actionId'));
    raise exception 'Legacy ABA update was erased by undo';
  exception when sqlstate 'KJ001' then null; end;

  -- The rejection occurs after the projection/session insert. Everything rolls back.
  perform set_config('role','postgres',true);
  select count(*) into before_rows from public.events where profile_id=personal;
  select to_jsonb(i) into state_before from public.item_interactions i where profile_id=personal and item_id=item;
  rejected := gen_random_uuid();
  perform set_config('kajo.reject_action',rejected::text,true);
  cmd := first_cmd || jsonb_build_object('actionId',rejected,'rating',3,'session',
    jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',started,'context','{}'::jsonb));
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_item_action_v1(cmd);
    raise exception 'Expected forced Event failure did not occur';
  exception when raise_exception then
    if sqlerrm <> 'Forced Event failure' then raise; end if;
  end;
  perform set_config('role','postgres',true);
  if (select count(*) from public.events where profile_id=personal)<>before_rows
    or exists(select 1 from private.item_action_receipts where id=rejected)
    or exists(select 1 from public.event_sessions where id=(cmd->'session'->>'sessionId')::uuid)
    or (select to_jsonb(i) from public.item_interactions i where profile_id=personal and item_id=item) is distinct from state_before then
    raise exception 'Failed command left partial state/session/evidence/receipt';
  end if;

  -- Same ID under another actor/profile, revoked membership and cached replies.
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_item_action_v1(first_cmd);
    raise exception 'Actor mismatch accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.commit_item_action_v1(first_cmd || jsonb_build_object('actorUserId',outsider));
    raise exception 'Outsider received cached reply';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  shared_cmd := first_cmd || jsonb_build_object('actionId',gen_random_uuid(),'profileId',shared,
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',started,'context','{}'::jsonb));
  result := public.commit_item_action_v1(shared_cmd);
  if result->'interaction'->>'saved'<>'false' then raise exception 'Shared rating bypassed consensus'; end if;
  perform set_config('role','postgres',true);
  delete from public.profile_members where profile_id=shared and user_id=actor;
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_item_action_v1(shared_cmd);
    raise exception 'Revoked member received cached reply';
  exception when insufficient_privilege then null; end;
  begin
    perform public.commit_item_action_v1(first_cmd || jsonb_build_object('actionId',gen_random_uuid(),
      'session',jsonb_build_object('sessionId',session,'startedAt',started,'context','{"locale":"fi"}'::jsonb)));
    raise exception 'Existing session payload was replaced';
  exception when data_exception then null; end;
  begin
    perform public.commit_item_action_v1(first_cmd || jsonb_build_object('actionId',gen_random_uuid(),'rating',11));
    raise exception 'Invalid rating accepted';
  exception when data_exception then null; end;

  -- Correlation requires same actor/Profile/session/mode, selected candidate and
  -- recorded exposure. Undo retains that original trace, never the current view.
  select * into strict ranked from public.rank_items_v1(personal,'FOR_YOU','MOVIE',20,
    jsonb_build_object('sessionId',session)) where item_id=trace_item;
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
    values(gen_random_uuid(),actor,personal,trace_item,'MOVIE','ITEM_IMPRESSION',clock_timestamp(),session,ranked.prediction_id);
  cmd := first_cmd || jsonb_build_object('actionId',gen_random_uuid(),'itemId',trace_item,
    'occurredAt',clock_timestamp(),'predictionId',ranked.prediction_id);
  trace_result := public.commit_item_action_v1(cmd);
  if trace_result->>'predictionId' is distinct from ranked.prediction_id::text then raise exception 'Valid trace was lost'; end if;
  result := public.commit_item_action_v1((cmd - 'rating') || jsonb_build_object('actionId',gen_random_uuid(),
    'kind','UNDO','reversesActionId',cmd->>'actionId','predictionId',gen_random_uuid(),'discoveryMode','RISK'));
  if result->>'predictionId' is distinct from ranked.prediction_id::text or result->>'discoveryMode'<>'FOR_YOU' then
    raise exception 'Undo inherited the current view trace';
  end if;
  result := public.commit_item_action_v1(first_cmd || jsonb_build_object('actionId',gen_random_uuid(),
    'predictionId',gen_random_uuid(),'occurredAt',clock_timestamp()));
  if result->>'predictionId' is not null then raise exception 'Fabricated trace was accepted'; end if;

  perform set_config('role','postgres',true);
  if has_table_privilege('authenticated','private.item_action_receipts','select')
    or has_table_privilege('authenticated','private.item_action_heads','update')
    or has_function_privilege('anon','public.commit_item_action_v1(jsonb)','execute')
    or has_function_privilege('service_role','public.commit_item_action_v1(jsonb)','execute') then
    raise exception 'Command receipt/function privileges are too broad';
  end if;
end;
$actions$;
select jsonb_build_object('itemActions','PASS: atomic state/Event/receipt, retry, rollback, ordered undo, legacy invalidation, scope and trace guards') as snapshot;
rollback;
