-- One-time owner-authorized device reset, 2026-09-10 / #228.
-- Default is a rehearsal: retain ROLLBACK. Execute COMMIT only after reviewing
-- the rehearsal and exact current scope. Never include in migrations or CI reset.
-- New PersonalProfile IDs invalidate old Profile-bound queues without a new API.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.users, public.profiles in share row exclusive mode;
do $reset$
declare
  personal jsonb; personal_lists jsonb; old_ids uuid[]; saved_users jsonb; catalog_hash text;
  row jsonb; replacement uuid; actor uuid; item uuid; cmd jsonb; old_cmd jsonb;
  result jsonb; old_profile uuid;
begin
  if (select count(*) from public.users)<>2
    or (select count(*) from public.profiles where profile_type='PERSONAL')<>2
    or (select count(*) from public.profiles where profile_type='SHARED')<>1 then
    raise exception 'Reset scope changed or reset already executed; review before proceeding';
  end if;
  if exists(select 1 from private.policy_assignments where scope_type='PROFILE')
    or exists(select 1 from private.genome_evaluations) then
    raise exception 'Learned policy/evaluation state requires a separate reset review';
  end if;
  select jsonb_agg(to_jsonb(u) order by id) into saved_users from public.users u;
  select md5(string_agg(md5(to_jsonb(i)::text),'' order by id)) into catalog_hash from public.items i;
  select array_agg(id) into old_ids from public.profiles;
  select jsonb_agg(jsonb_build_object('owner',owner_user_id,'name',name)) into personal
    from public.profiles where profile_type='PERSONAL';
  select coalesce(jsonb_agg(jsonb_build_object('owner',p.owner_user_id,'name',l.name)),'[]'::jsonb)
    into personal_lists from public.item_lists l join public.profiles p on p.id=l.profile_id
    where p.profile_type='PERSONAL' and l.list_kind='CUSTOM';
  if exists(select 1 from public.users u where not exists(select 1 from public.profiles p
    where p.profile_type='PERSONAL' and p.owner_user_id=u.id)) then raise exception 'Missing Personal owner'; end if;
  select command into old_cmd from private.item_action_receipts
    where command->>'kind'='SET_RATING' order by created_at desc limit 1;
  if old_cmd is null then raise exception 'Expected persisted old rating for replay verification'; end if;
  -- Explicit ordering avoids RESTRICT edges; Profile cascades own remaining state.
  delete from private.shadow_prediction_runs where profile_id=any(old_ids);
  delete from private.profile_bootstrap_evidence where profile_id=any(old_ids);
  delete from public.events where profile_id=any(old_ids);
  delete from public.profiles where id=any(old_ids);
  for row in select value from jsonb_array_elements(personal) loop
    insert into public.profiles(profile_type,name,owner_user_id)
      values('PERSONAL',row->>'name',(row->>'owner')::uuid) returning id into replacement;
    insert into public.profile_members(profile_id,user_id) values(replacement,(row->>'owner')::uuid);
  end loop;
  for row in select value from jsonb_array_elements(personal_lists) loop
    select id into strict replacement from public.profiles where owner_user_id=(row->>'owner')::uuid and profile_type='PERSONAL';
    insert into public.item_lists(profile_id,list_kind,name,created_by_user_id)
      values(replacement,'CUSTOM',row->>'name',(row->>'owner')::uuid);
  end loop;
  if exists(select 1 from public.profiles where id=any(old_ids) or profile_type='SHARED')
    or (select count(*) from public.profiles)<>2
    or exists(select 1 from public.item_interactions)
    or exists(select 1 from public.events)
    or exists(select 1 from public.event_sessions)
    or exists(select 1 from private.item_action_receipts)
    or exists(select 1 from private.item_action_heads)
    or exists(select 1 from private.prediction_runs)
    or exists(select 1 from private.prediction_candidates)
    or exists(select 1 from private.shadow_prediction_jobs)
    or exists(select 1 from private.shadow_prediction_runs)
    or exists(select 1 from private.shadow_prediction_candidates)
    or exists(select 1 from private.profile_bootstrap_evidence)
    or exists(select 1 from private.profile_import_jobs)
    or exists(select 1 from private.profile_import_rows)
    or exists(select 1 from public.item_list_entries)
    or exists(select 1 from public.profile_invitations)
    or exists(select 1 from public.profile_messages)
    or exists(select 1 from public.shared_item_endorsements)
    or exists(select 1 from public.shared_item_consensus)
    or exists(select 1 from public.shared_item_list_proposals) then
    raise exception 'Reset left old identity/evidence/collection/group state';
  end if;
  if jsonb_array_length(personal_lists)<>(select count(*) from public.item_lists where list_kind='CUSTOM') then
    raise exception 'Personal List names were not preserved'; end if;
  if saved_users is distinct from (select jsonb_agg(to_jsonb(u) order by id) from public.users u)
    or catalog_hash is distinct from (select md5(string_agg(md5(to_jsonb(i)::text),'' order by id)) from public.items i) then
    raise exception 'Reset changed accounts or catalog'; end if;
  -- Prove that a real previously stored envelope cannot replay into a new Profile.
  actor:=(old_cmd->>'actorUserId')::uuid; old_profile:=(old_cmd->>'profileId')::uuid;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_item_action_v1(old_cmd);
    raise exception 'Old rating replay was accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.commit_collection_action_v1(old_cmd||jsonb_build_object('actionId',gen_random_uuid(),
      'kind','CLEAR_HISTORY','source','LIST_DETAIL','predictionId',null,'discoveryMode',null));
    raise exception 'Old collection replay was accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      values(gen_random_uuid(),actor,old_profile,now(),'{}');
    raise exception 'Old Event session was accepted';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  perform set_config('role','postgres',true);
  -- New Profile can write through the real API. Roll back only this probe.
  select id into strict replacement from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  select id into item from public.items order by id limit 1;
  begin
    perform set_config('role','authenticated',true);
    cmd:=jsonb_build_object('version',1,'actorUserId',actor,'profileId',replacement,'itemId',item,
      'actionId',gen_random_uuid(),'kind','SET_RATING','rating',8,'occurredAt',now(),
      'predictionId',null,'discoveryMode',null,'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
    result:=public.commit_item_action_v1(cmd);
    if result->'interaction'->>'rating'<>'8' then raise exception 'New Profile cannot rate'; end if;
    raise exception 'rollback probe' using errcode='Z0001';
  exception when sqlstate 'Z0001' then null; end;
  perform set_config('role','postgres',true);
end;
$reset$;
select jsonb_build_object('reset','PASS: new Personal IDs, empty choices/groups, old replay denied, new writes accepted',
  'users',(select count(*) from public.users),'personal',(select count(*) from public.profiles where profile_type='PERSONAL'),
  'shared',(select count(*) from public.profiles where profile_type='SHARED'),'events',(select count(*) from public.events),
  'interactions',(select count(*) from public.item_interactions)) as result;
rollback;
