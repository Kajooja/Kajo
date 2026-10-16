-- Native own-Personal neutral Taste response; additive to preserved v2 history.
-- The new command never enters the legacy ANSWER/CORRECT or bootstrap writers.
create index contextual_skip_taste_panel_source on private.contextual_skip_commands ((origin->>'panelId'))
where surface='TASTE' and erased_at is null;

create trigger lock_taste_contextual_skip_panel_source_v1 before update or delete on private.sequential_taste_panels
for each statement execute function private.lock_contextual_skip_source_erasure_v1();

create function private.taste_contextual_skip_capability_v1(target_session uuid)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('version','kajo-contextual-skip-v1','policyVersion','contextual-skip-cooldown-v1',
    'contextRef',null,'origin',jsonb_build_object('surface','TASTE','sessionId',s.id,
      'questionId',q->>'id','panelId',p.id,'prefixRevision',p.prefix_revision))
  from private.sequential_taste_sessions s cross join lateral(select s.presentations->-1 q) last_question
  join private.sequential_taste_panels p on p.id=(q->>'poolId')::uuid and p.session_id=s.id
  where s.id=target_session and s.status='ACTIVE' and jsonb_array_length(q->'responses')=0
    and not (q->>'invalidated')::boolean and not p.invalidated and p.prediction_id is not null;
$$;

create function private.commit_taste_contextual_skip_v1(command jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  actor uuid;profile uuid;action uuid;item uuid;target uuid;origin jsonb;at_time timestamptz;native_origin_hash text;
  s private.sequential_taste_sessions;panel private.sequential_taste_panels;
  prior private.contextual_skip_commands;original private.contextual_skip_commands;
  q jsonb;question_index integer;response jsonb;result jsonb;tx text:=pg_current_xact_id()::text;
begin
  perform private.validate_contextual_skip_command_v1(command,'TASTE');
  perform private.lock_contextual_skip_scope_v1(command);
  actor:=(command->>'actorUserId')::uuid;profile:=(command->>'profileId')::uuid;
  action:=(command->>'actionId')::uuid;item:=(command->>'itemId')::uuid;origin:=command->'origin';
  native_origin_hash:=private.contextual_skip_origin_hash_v1(command);
  if private.assert_personal_profile_owner_v1(profile)<>actor then
    raise exception 'ACCESS_DENIED' using errcode='42501';end if;
  select * into s from private.sequential_taste_sessions where id=(origin->>'sessionId')::uuid
    and profile_id=profile and actor_user_id=actor for update;
  if s.id is null then raise exception 'ORIGIN_CONFLICT' using errcode='22023';end if;
  select * into prior from private.contextual_skip_commands where action_id=action;
  if prior.action_id is not null then
    if prior.actor_user_id<>actor or prior.profile_id<>profile then
      raise exception 'IDENTITY_CONFLICT' using errcode='22023';end if;
    if prior.erased_at is not null then raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
    if prior.command is distinct from command then raise exception 'IDENTITY_CONFLICT' using errcode='22023';end if;
  end if;
  if s.status='REMOVED' then raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
  select p,(n-1)::integer into q,question_index from jsonb_array_elements(s.presentations) with ordinality l(p,n)
    where p->>'id'=origin->>'questionId';
  if q is null or q->>'objectId'<>item::text or q->>'poolId'<>origin->>'panelId' then
    raise exception 'ORIGIN_CONFLICT' using errcode='22023';end if;
  select * into panel from private.sequential_taste_panels where id=(origin->>'panelId')::uuid and session_id=s.id;
  if panel.id is null or panel.invalidated or panel.prediction_id is null or (q->>'invalidated')::boolean then
    raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
  if panel.prefix_revision<>(origin->>'prefixRevision')::integer then
    raise exception 'ORIGIN_CONFLICT' using errcode='22023';end if;
  -- The same live bounded catalog guard as v2 wins over a cached neutral reply.
  perform 1 from public.items where id in(select (c->>'id')::uuid from jsonb_array_elements(s.catalog) c) order by id for share;
  if exists(select 1 from jsonb_array_elements(s.catalog) c where not exists(select 1 from public.items i
    where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'
      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then
    raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
  if prior.action_id is not null then return prior.result;end if;
  if panel.captured_transaction=tx or panel.captured_at>=now() then
    raise exception 'SOURCE_NOT_COMMITTED' using errcode='40001';end if;
  at_time:=greatest(clock_timestamp(),s.receipt_at+interval '1 microsecond',
    (select max(accepted_at)+interval '1 microsecond' from private.contextual_skip_commands where profile_id=profile));
  if (command->>'occurredAt')::numeric>extract(epoch from at_time)*1000000+300000000 then
    raise exception 'INVALID_COMMAND' using errcode='22023';end if;
  if command->>'kind'='CONTEXTUAL_SKIP' then
    if s.status<>'ACTIVE' or q<>s.presentations->-1 or jsonb_array_length(q->'responses')<>0
      or exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=item)
      or exists(select 1 from public.item_interactions a where a.profile_id=profile and a.item_id=item)
      or exists(select 1 from public.events e where e.profile_id=profile and e.item_id=item
        and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_SAVED')) then
      raise exception 'SOURCE_CLOSED' using errcode='KJ002';end if;
    if exists(select 1 from private.contextual_skip_commands c where c.actor_user_id=actor and c.profile_id=profile
      and c.kind='CONTEXTUAL_SKIP' and c.origin_hash=native_origin_hash) then
      raise exception 'ORIGIN_CONFLICT' using errcode='22023';end if;
    if s.revision>=255 then raise exception 'SOURCE_CLOSED' using errcode='KJ002';end if;
  else
    target:=(command->>'reversesActionId')::uuid;
    select * into original from private.contextual_skip_commands where action_id=target;
    if original.action_id is null or original.erased_at is not null or original.kind<>'CONTEXTUAL_SKIP'
      or original.actor_user_id<>actor or original.profile_id<>profile or original.item_id<>item
      or original.origin is distinct from origin or original.command->'contextRef' is distinct from command->'contextRef'
      or exists(select 1 from private.contextual_skip_commands c where c.reverses_action_id=target)
      or q#>>'{responses,-1,id}'<>target::text or q#>>'{responses,-1,answer,kind}'<>'CONTEXTUAL_SKIP' then
      raise exception 'WITHDRAWAL_CONFLICT' using errcode='KJ003';end if;
  end if;
  result:=private.contextual_skip_receipt_v1(command,at_time);
  insert into private.contextual_skip_commands(action_id,actor_user_id,profile_id,item_id,surface,kind,origin_hash,origin,
    command,result,accepted_at,reverses_action_id,source_prediction_id,source_impression_id)
  values(action,actor,profile,item,'TASTE',command->>'kind',native_origin_hash,origin,
    command,result,at_time,target,panel.prediction_id,null);
  response:=jsonb_build_object('id',action,'revision',jsonb_array_length(q->'responses')+1,'acceptedAt',at_time,
    'answer',jsonb_build_object('kind',command->>'kind'),'protocolVersion','kajo-contextual-skip-v1');
  q:=jsonb_set(q,'{responses}',q->'responses'||jsonb_build_array(response));
  update private.sequential_taste_sessions set presentations=jsonb_set(presentations,array[question_index::text],q),
    revision=least(revision+1,256),receipt_at=at_time,receipt_transaction=tx where id=s.id;
  if target is not null then perform private.invalidate_sequential_taste_v2(s.id,q->>'id');end if;
  return result;
end;$$;
create function public.commit_taste_contextual_skip_v1(command jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.commit_taste_contextual_skip_v1(command);$$;

-- Invalidated source panels and removed sessions redact exact-command copies.
-- Minimal tombstones retain the consumed action/opportunity identities.
create function private.erase_taste_contextual_skip_sources_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare actions uuid[];
begin
  if tg_table_name='sequential_taste_sessions' then
    select array_agg(c.action_id) into actions from private.contextual_skip_commands c
      where c.profile_id=new.profile_id and c.surface='TASTE' and c.erased_at is null
        and c.origin->>'sessionId'=new.id::text;
  else
    select array_agg(c.action_id) into actions from private.contextual_skip_commands c
      where c.surface='TASTE' and c.erased_at is null and c.origin->>'panelId'=old.id::text;
  end if;
  if actions is not null then perform private.erase_contextual_skip_commands_v1(actions);end if;
  if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger erase_taste_contextual_skip_panel_v1 after update on private.sequential_taste_panels
for each row when((not old.invalidated and new.invalidated) or (old.prediction_id is not null and new.prediction_id is null))
execute function private.erase_taste_contextual_skip_sources_v1();
create trigger erase_taste_contextual_skip_panel_delete_v1 before delete on private.sequential_taste_panels
for each row execute function private.erase_taste_contextual_skip_sources_v1();
create trigger erase_taste_contextual_skip_session_v1 after update of status on private.sequential_taste_sessions
for each row when(old.status<>'REMOVED' and new.status='REMOVED') execute function private.erase_taste_contextual_skip_sources_v1();

revoke all on function private.taste_contextual_skip_capability_v1(uuid),private.commit_taste_contextual_skip_v1(jsonb),
  public.commit_taste_contextual_skip_v1(jsonb),private.erase_taste_contextual_skip_sources_v1()
  from public,anon,authenticated,service_role;
grant execute on function private.commit_taste_contextual_skip_v1(jsonb),public.commit_taste_contextual_skip_v1(jsonb) to authenticated;

-- Existing exact replies remain byte-for-byte stored. Only a newly read snapshot
-- advertises the separate writer; old ANSWER/CORRECT meanings never expand.
-- The bounded Taste path takes the lifecycle gate first, including REMOVE and
-- withdrawal callbacks, avoiding Profile-to-lifecycle lock inversion. This is a
-- correctness-first serialization point, not a throughput claim.
do $taste_skip_adapter$
declare patch jsonb;p record;body text;before_text text;after_text text;
begin
  for patch in select value from jsonb_array_elements($patches$[
    {"signature":"private.sequential_taste_snapshot_v2(uuid)","md5":"45ee15938df40a67748f11222c4284ab","definer":false,"volatility":"s","replacements":[
      ["'negativeProjection','DISTINCT_TASTE_PRIOR_V2','anonymousEntry',false);",
       "'negativeProjection','DISTINCT_TASTE_PRIOR_V2','anonymousEntry',false,\n    'contextualSkip',private.taste_contextual_skip_capability_v1(s.id));"]
    ]},
    {"signature":"private.remove_profile_import_job_v1(uuid)","md5":"68c64d6f73f7ffb00390cf64b2ece3db","definer":true,"volatility":"v","replacements":[
      ["begin\n  if actor_id is null", "begin\n  perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then\n    raise exception 'Taste source removal requires READ COMMITTED' using errcode='25001';end if;\n  if actor_id is null"]
    ]},
    {"signature":"private.commit_item_action_v1(jsonb)","md5":"542d4cefc6a6912b6084d1bacf9ef57d","definer":true,"volatility":"v","replacements":[
      ["  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);",
       "  -- Undo and explicit interest clearing can erase dependent Taste sources.\n  -- Acquire that exclusive gate before the Profile lock, never upgrade later.\n  if request->>'kind'='UNDO' or (request->>'kind'='SET_NOT_INTERESTED' and request->'notInterested'='false'::jsonb) then\n    perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);\n  else\n    perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  end if;"]
    ]},
    {"signature":"private.commit_collection_action_v1(jsonb)","md5":"3bfd63dd6b3e7ef283790a56d7836212","definer":true,"volatility":"v","replacements":[
      ["  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);",
       "  -- History clearing withdraws source evidence and dependent Taste panels.\n  if request->>'kind'='CLEAR_HISTORY' then\n    perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);\n  else\n    perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  end if;"]
    ]},
    {"signature":"private.taste_session_v1(jsonb)","md5":"3841ae57ceecc972a737574a304b0a99","definer":true,"volatility":"v","replacements":[
      ["begin\n  if request is null", "begin\n  -- Preserved v1 removal reaches the same fenced import-source owner.\n  if request->>'operation'='REMOVE' then\n    perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);\n  else\n    perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  end if;\n  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then\n    raise exception 'Taste lifecycle requires READ COMMITTED' using errcode='25001';end if;\n  if request is null"]
    ]},
    {"signature":"private.taste_session_v2(jsonb)","md5":"424ea9820a8f7096392e5a8c142a1ea2","definer":true,"volatility":"v","replacements":[
      ["begin\n  if request is null", "begin\n  perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then\n    raise exception 'Taste lifecycle requires READ COMMITTED' using errcode='25001';end if;\n  if request is null"],
      ["    answer:=request->'answer';", "    answer:=request->'answer';\n    if operation='CORRECT' and q#>>'{responses,0,answer,kind}' in('CONTEXTUAL_SKIP','WITHDRAW_CONTEXTUAL_SKIP') then\n      raise exception 'Neutral Taste responses require their own withdrawal command' using errcode='22023';end if;"],
      ["and p#>>'{responses,-1,answer,kind}'<>'WITHDRAWN';", "and p#>>'{responses,-1,answer,kind}' not in('WITHDRAWN','WITHDRAW_CONTEXTUAL_SKIP');"]
    ]}
  ]$patches$::jsonb) loop
    select proc.*,pg_get_functiondef(proc.oid) definition into strict p from pg_proc proc where proc.oid=(patch->>'signature')::regprocedure;
    if md5(p.prosrc)<>patch->>'md5' or p.proowner<>'postgres'::regrole
      or p.prosecdef is distinct from (patch->>'definer')::boolean or p.provolatile<>patch->>'volatility'
      or p.prolang<>(select oid from pg_language where lanname='plpgsql') or p.proleakproof or p.proisstrict or p.proparallel<>'u'
      or p.proconfig is distinct from array['search_path=""']::text[]
      or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from (patch->>'definer')::boolean
      or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        where acl.grantor<>p.proowner or acl.grantee not in(p.proowner,
          case when (patch->>'definer')::boolean then 'authenticated'::regrole else p.proowner end)
          or (acl.grantee<>p.proowner and acl.is_grantable)) then
      raise exception 'Neutral Taste source/security drift: %',patch->>'signature';
    end if;
    body:=p.prosrc;
    for before_text,after_text in select value->>0,value->>1 from jsonb_array_elements(patch->'replacements') loop
      if (length(body)-length(replace(body,before_text,'')))/length(before_text)<>1 then
        raise exception 'Neutral Taste replacement drift: %',patch->>'signature';end if;
      body:=replace(body,before_text,after_text);
    end loop;
    execute replace(p.definition,p.prosrc,body);
  end loop;
end;$taste_skip_adapter$;
