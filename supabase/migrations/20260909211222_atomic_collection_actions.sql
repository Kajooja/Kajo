-- One receipt/head lineage for Item and collection commands, including no-ops.
-- Account/Profile/Item deletion still cascades; List deletion keeps its receipt.
alter table private.item_action_receipts drop constraint item_action_receipts_id_fkey;
alter table private.item_action_receipts alter column item_id drop not null;
alter table private.item_action_receipts add column list_id uuid;
alter table private.item_action_receipts add column before_list_entry jsonb;

create function private.invalidate_list_item_action_head()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='item_lists' then
    delete from private.item_action_heads h using public.item_list_entries e
      where e.list_id=old.id and h.profile_id=old.profile_id and h.item_id=e.item_id;
    delete from private.item_action_heads h using private.item_action_receipts r
      where h.action_id=r.id and r.list_id=old.id;
    return old;
  end if;
  delete from private.item_action_heads h using public.item_lists l
    where l.id in (new.list_id,old.list_id) and h.profile_id=l.profile_id
      and h.item_id in (new.item_id,old.item_id);
  return coalesce(new,old);
end;
$$;
revoke all on function private.invalidate_list_item_action_head() from public,anon,authenticated,service_role;
create trigger item_list_entries_invalidate_action_head
after insert or update or delete on public.item_list_entries
for each row execute function private.invalidate_list_item_action_head();
create trigger item_lists_invalidate_action_head before delete on public.item_lists
for each row execute function private.invalidate_list_item_action_head();

create function private.commit_collection_action_v1(request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  action_id uuid;
  target_profile uuid;
  profile_kind text;
  target_item uuid;
  target_list uuid;
  kind text;
  source text;
  occurred timestamptz;
  session_started timestamptz;
  event_session_id uuid;
  session_context jsonb;
  prediction uuid;
  mode text;
  prior private.item_action_receipts%rowtype;
  reversed private.item_action_receipts%rowtype;
  previous_head uuid;
  reversed_id uuid;
  list_before public.item_lists%rowtype;
  entry_before jsonb;
  state_before jsonb;
  state_after jsonb;
  result jsonb;
  response jsonb;
  effects jsonb := '[]'::jsonb;
  effect jsonb;
  effect_id uuid;
  event_ids jsonb := '[]'::jsonb;
  present boolean;
  positive boolean;
  changed boolean := false;
  undoable boolean := false;
  cancelled record;
  correction record;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(request) is distinct from 'object' or octet_length(request::text)>16384
    or request->'version' is distinct from '1'::jsonb then
    raise exception 'Invalid collection action' using errcode='22023';
  end if;
  action_id := (request->>'actionId')::uuid;
  target_profile := (request->>'profileId')::uuid;
  target_item := (request->>'itemId')::uuid;
  target_list := (request->>'listId')::uuid;
  if (request->>'actorUserId')::uuid is distinct from actor then
    raise exception 'Actor mismatch' using errcode='42501';
  end if;
  if action_id is null or target_profile is null then
    raise exception 'Missing action identity' using errcode='22023';
  end if;
  if private.is_profile_member(target_profile) is distinct from true then
    raise exception 'Profile access denied' using errcode='42501';
  end if;
  select profile_type into profile_kind from public.profiles where id=target_profile for update;
  perform 1 from public.profile_members where profile_id=target_profile and user_id=actor for key share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select * into prior from private.item_action_receipts where id=action_id;
  if found then
    if prior.actor_user_id<>actor or prior.profile_id<>target_profile or prior.command<>request then
      raise exception 'Action ID payload mismatch' using errcode='22023';
    end if;
    return prior.result;
  end if;
  if exists(select 1 from public.events where id=action_id) then
    raise exception 'Action ID already used' using errcode='22023';
  end if;
  kind := request->>'kind';
  source := request->>'source';
  occurred := (request->>'occurredAt')::timestamptz;
  event_session_id := (request->'session'->>'sessionId')::uuid;
  session_started := (request->'session'->>'startedAt')::timestamptz;
  session_context := request->'session'->'context';
  mode := request->>'discoveryMode';
  if kind is null or kind not in ('CREATE_LIST','RENAME_LIST','DELETE_LIST','SET_LIST_ENTRY','UNDO_LIST_ENTRY','ENDORSE_SHARED_ITEM','REVERSE_ENDORSEMENT')
    or source is null or source not in ('LISTS','LIST_DETAIL','ITEM_DESTINATION_PICKER','SHARED_DISCOVERY')
    or occurred is null or not isfinite(occurred) or occurred>now()+interval '5 minutes'
    or event_session_id is null or session_started is null or not isfinite(session_started)
    or session_started>occurred or jsonb_typeof(session_context) is distinct from 'object'
    or (mode is not null and mode not in ('FOR_YOU','SURPRISE','RISK')) then
    raise exception 'Invalid action context' using errcode='22023';
  end if;
  if (kind in ('CREATE_LIST','RENAME_LIST','DELETE_LIST')) <> (target_item is null) then
    raise exception 'Invalid Item scope' using errcode='22023';
  end if;
  select jsonb_build_object('interest',interest,'saved',saved,'consumed',consumed,
    'rating',rating,'notInterested',not_interested) into state_before
    from public.item_interactions where profile_id=target_profile and item_id=target_item for update;
  state_before := coalesce(state_before,'{"interest":null,"saved":false,"consumed":false,"rating":null,"notInterested":false}'::jsonb);
  select h.action_id into previous_head from private.item_action_heads h
    where profile_id=target_profile and item_id=target_item;

  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
    values(event_session_id,actor,target_profile,session_started,session_context) on conflict(id) do nothing;
  if not exists(select 1 from public.event_sessions s where s.id=event_session_id
    and s.actor_user_id=actor and s.profile_id=target_profile and s.started_at=session_started and s.context=session_context) then
    raise exception 'Session identity payload mismatch' using errcode='22023';
  end if;

  -- Only domain rejection inside this subtransaction becomes discardable KJ002.
  -- Identity/authentication/receipt uncertainty stays outside that classification.
  begin
    if target_item is not null and not exists(select 1 from public.items where id=target_item) then
      raise exception 'Item no longer exists' using errcode='P0002';
    end if;
    if kind='UNDO_LIST_ENTRY' then
      reversed_id := (request->>'reversesActionId')::uuid;
      select * into reversed from private.item_action_receipts where id=reversed_id;
      if not found or reversed.actor_user_id<>actor or reversed.profile_id<>target_profile
        or reversed.item_id is distinct from target_item or reversed.command->>'kind'<>'SET_LIST_ENTRY'
        or reversed.result->>'undoable'<>'true' or previous_head is distinct from reversed_id then
        raise exception 'Undo target is no longer current' using errcode='KJ001';
      end if;
      target_list := reversed.list_id;
    end if;
    if kind in ('RENAME_LIST','DELETE_LIST','SET_LIST_ENTRY','UNDO_LIST_ENTRY') then
      select * into list_before from public.item_lists where id=target_list for update;
      if not found then raise exception 'List no longer exists' using errcode='P0002'; end if;
      if list_before.profile_id<>target_profile then
        raise exception 'List belongs to another Profile' using errcode='42501';
      end if;
      select to_jsonb(e) into entry_before from public.item_list_entries e
        where list_id=target_list and item_id=target_item for update;
    end if;
    if kind='CREATE_LIST' then
      select jsonb_agg(to_jsonb(r)) into result from private.create_custom_item_list(target_profile,request->>'name') r;
      target_list := (result->0->>'list_id')::uuid;
      effects := effects || jsonb_build_array(jsonb_build_object('type','LIST_CREATED','properties',
        jsonb_build_object('listId',target_list,'listName',result->0->>'name')));
    elsif kind='RENAME_LIST' then
      select jsonb_agg(to_jsonb(r)) into result from private.rename_custom_item_list(target_list,request->>'name') r;
      if list_before.name is distinct from result->0->>'name' then
        effects := effects || jsonb_build_array(jsonb_build_object('type','LIST_RENAMED','properties',
          jsonb_build_object('listId',target_list,'listName',result->0->>'name','previousName',list_before.name)));
      end if;
    elsif kind='DELETE_LIST' then
      -- Cancellation is an administrative correction with the real deleting actor,
      -- never a forged negative preference from the affected endorsing member.
      for cancelled in select e.item_id,e.actor_user_id from public.shared_item_endorsements e
        join public.shared_item_list_proposals p on p.profile_id=e.profile_id and p.item_id=e.item_id
        where p.list_id=target_list and p.completed_at is null order by e.item_id,e.actor_user_id loop
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_ENDORSEMENT_REVERSED','itemId',cancelled.item_id,
          'properties',jsonb_build_object('source','LIST_DELETED','listId',target_list,
            'endorsementActorUserId',cancelled.actor_user_id,'reason','LIST_DELETED')));
      end loop;
      result := to_jsonb(private.delete_custom_item_list(target_list));
      effects := jsonb_build_array(jsonb_build_object('type','LIST_DELETED','properties',
        jsonb_build_object('listId',target_list,'listName',list_before.name))) || effects;
    elsif kind='SET_LIST_ENTRY' then
      if jsonb_typeof(request->'present') is distinct from 'boolean'
        or jsonb_typeof(request->'positive') is distinct from 'boolean' then
        raise exception 'Invalid List action' using errcode='22023';
      end if;
      present := (request->>'present')::boolean;
      positive := (request->>'positive')::boolean;
      if positive and (not present or profile_kind<>'PERSONAL' or source<>'ITEM_DESTINATION_PICKER') then
        raise exception 'Invalid positive List action' using errcode='22023';
      end if;
      if present is distinct from (entry_before is not null)
        or (list_before.list_kind='SYSTEM_SAVED' and present is distinct from (state_before->>'saved')::boolean) then
        perform private.set_item_list_entry(target_list,target_item,present);
      end if;
      if positive and state_before->>'interest' is distinct from 'LIKED' then
        insert into public.item_interactions(profile_id,item_id,actor_user_id,interest)
          values(target_profile,target_item,actor,'LIKED')
          on conflict(profile_id,item_id) do update set actor_user_id=excluded.actor_user_id,interest='LIKED';
      end if;
      if list_before.list_kind='CUSTOM' and present is distinct from (entry_before is not null) then
        effects := effects || jsonb_build_array(jsonb_build_object('type',case when present then 'ITEM_ADDED_TO_LIST' else 'ITEM_REMOVED_FROM_LIST' end,
          'properties',jsonb_build_object('listId',target_list,'listName',list_before.name)));
      end if;
      if list_before.list_kind='SYSTEM_SAVED' and present is distinct from (state_before->>'saved')::boolean then
        effects := effects || jsonb_build_array(jsonb_build_object('type',case when present then 'ITEM_SAVED' else 'ITEM_UNSAVED' end,
          'properties',jsonb_build_object('listId',target_list,'listName',list_before.name)));
      elsif positive and state_before->>'interest' is distinct from 'LIKED' then
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_LIKED',
          'properties',jsonb_build_object('listId',target_list,'listName',list_before.name)));
      end if;
      result := to_jsonb(present);
      undoable := jsonb_array_length(effects)>0;
    elsif kind='UNDO_LIST_ENTRY' then
      if private.is_shared_saved_state_valid(target_profile,target_item,(reversed.before_state->>'saved')::boolean) is distinct from true then
        raise exception 'Shared Saved requires consensus' using errcode='42501';
      end if;
      if reversed.before_list_entry is null then
        delete from public.item_list_entries where list_id=target_list and item_id=target_item;
      else
        insert into public.item_list_entries(list_id,item_id,added_by_user_id,added_at,entry_source)
          values(target_list,target_item,(reversed.before_list_entry->>'added_by_user_id')::uuid,
            (reversed.before_list_entry->>'added_at')::timestamptz,reversed.before_list_entry->>'entry_source')
          on conflict(list_id,item_id) do update set added_by_user_id=excluded.added_by_user_id,
            added_at=excluded.added_at,entry_source=excluded.entry_source;
      end if;
      insert into public.item_interactions(profile_id,item_id,actor_user_id,interest,saved,consumed,rating,not_interested)
        values(target_profile,target_item,actor,reversed.before_state->>'interest',(reversed.before_state->>'saved')::boolean,
          (reversed.before_state->>'consumed')::boolean,(reversed.before_state->>'rating')::integer,(reversed.before_state->>'notInterested')::boolean)
        on conflict(profile_id,item_id) do update set actor_user_id=excluded.actor_user_id,interest=excluded.interest,
          saved=excluded.saved,consumed=excluded.consumed,rating=excluded.rating,not_interested=excluded.not_interested;
      -- Existing learners cancel by exact reversedEventId. Correct every Event
      -- from the target command so a List+Like pair cannot leave stale taste.
      select jsonb_agg(jsonb_build_object('type','ITEM_INTERACTION_UNDONE','properties',
        jsonb_build_object('reversedEventId',original.value,'reversesActionId',reversed_id,
          'listId',target_list,'restoredListEntry',reversed.before_list_entry is not null,
          'restoredInterest',reversed.before_state->'interest','restoredSaved',reversed.before_state->'saved',
          'restoredConsumed',reversed.before_state->'consumed','restoredRating',reversed.before_state->'rating',
          'restoredNotInterested',reversed.before_state->'notInterested')) order by original.ordinality)
        into effects from jsonb_array_elements_text(reversed.result->'eventIds') with ordinality original(value,ordinality);
      result := 'true'::jsonb;
    elsif kind='ENDORSE_SHARED_ITEM' then
      select jsonb_agg(to_jsonb(r)) into result from private.endorse_shared_list_item(target_profile,target_item,target_list) r;
      target_list := (result->0->>'proposal_list_id')::uuid;
      if (result->0->>'endorsement_created')::boolean then
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_ENDORSED','properties',jsonb_build_object(
          'listId',target_list,'listName',result->0->>'proposal_list_name','endorsementCount',result->0->'endorsement_count',
          'requiredMemberCount',result->0->'required_member_count')));
      end if;
      if (result->0->>'consensus_reached')::boolean then
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_SAVED','properties',
          jsonb_build_object('source','SHARED_CONSENSUS','endorsementCount',result->0->'endorsement_count',
            'requiredMemberCount',result->0->'required_member_count')));
      end if;
      if (result->0->>'list_entry_created')::boolean then
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_ADDED_TO_LIST','properties',jsonb_build_object(
          'source','SHARED_CONSENSUS','listId',target_list,'listName',result->0->>'proposal_list_name',
          'proposedByUserId',result->0->>'proposed_by_user_id')));
      end if;
    else
      select jsonb_agg(to_jsonb(r)) into result from private.reverse_shared_item_endorsement(target_profile,target_item) r;
      if (result->0->>'endorsement_reversed')::boolean then
        effects := jsonb_build_array(jsonb_build_object('type','ITEM_ENDORSEMENT_REVERSED','properties',
          jsonb_build_object('endorsementActorUserId',actor)));
      end if;
      if (result->0->>'endorsement_count')::integer=0 then
        delete from public.shared_item_list_proposals where profile_id=target_profile and item_id=target_item and completed_at is null;
      end if;
    end if;
  exception when data_exception or unique_violation or no_data_found or object_not_in_prerequisite_state then
    raise exception 'Collection action rejected: %',sqlerrm using errcode='KJ002';
  end;

  -- A withdrawal/cancelled proposal must also remove the original endorsement
  -- from outcome learning. Existing readers recognize exact Undo references.
  -- Corrections retain the actual withdrawing/deleting actor and no current-view trace.
  for effect in select value from jsonb_array_elements(effects) where value->>'type'='ITEM_ENDORSEMENT_REVERSED' loop
    for correction in select e.id from public.events e
      where e.profile_id=target_profile and e.item_id=coalesce((effect->>'itemId')::uuid,target_item)
        and e.actor_user_id=(effect->'properties'->>'endorsementActorUserId')::uuid and e.event_type='ITEM_ENDORSED'
        and not exists(select 1 from public.events u where u.profile_id=target_profile
          and u.event_type='ITEM_INTERACTION_UNDONE' and u.properties->>'reversedEventId'=e.id::text)
      order by e.created_at,e.id loop
      effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_INTERACTION_UNDONE',
        'itemId',coalesce((effect->>'itemId')::uuid,target_item),'uncorrelated',true,'properties',
        coalesce(effect->'properties','{}'::jsonb) || jsonb_build_object('reversedEventId',correction.id,'reversesEndorsement',true)));
    end loop;
  end loop;

  select jsonb_build_object('interest',interest,'saved',saved,'consumed',consumed,
    'rating',rating,'notInterested',not_interested) into state_after from public.item_interactions
    where profile_id=target_profile and item_id=target_item;
  if target_item is not null then state_after := coalesce(state_after,state_before); end if;
  if kind='UNDO_LIST_ENTRY' then
    prediction := (reversed.result->>'predictionId')::uuid;
    mode := reversed.result->>'discoveryMode';
  elsif target_item is not null and request->>'predictionId' is not null then
    select run.id into prediction from private.prediction_runs run
      join private.prediction_candidates c on c.prediction_id=run.id
      where run.id=(request->>'predictionId')::uuid and run.actor_user_id=actor and run.profile_id=target_profile
        and run.session_id=event_session_id and run.discovery_mode=mode and c.item_id=target_item and c.selected_for_delivery
        and run.requested_at<=occurred and exists(select 1 from public.events impression
          where impression.actor_user_id=actor and impression.profile_id=target_profile and impression.item_id=target_item
            and impression.session_id=event_session_id and impression.prediction_id=run.id and impression.event_type='ITEM_IMPRESSION'
            and impression.occurred_at between run.requested_at and occurred);
  end if;
  for effect in select value from jsonb_array_elements(effects) loop
    effect_id := case when jsonb_array_length(event_ids)=0 then action_id else gen_random_uuid() end;
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,context,properties)
      select effect_id,actor,target_profile,i.id,i.item_type,effect->>'type',occurred,event_session_id,
        case when i.id=target_item and effect->>'uncorrelated' is distinct from 'true' then prediction else null end,
        case when effect->>'uncorrelated'='true' then null else mode end,session_context,
        jsonb_build_object('source',source,'actionId',action_id,'evidenceVersion','collection-action-v1',
          'attributionStatus',case when i.id=target_item and prediction is not null and effect->>'uncorrelated' is distinct from 'true'
            then 'VALIDATED_TRACE' else 'UNATTRIBUTED' end)
          || coalesce(effect->'properties','{}'::jsonb)
      from (select coalesce((effect->>'itemId')::uuid,target_item) id) ref
      left join public.items i on i.id=ref.id;
    event_ids := event_ids || jsonb_build_array(effect_id);
  end loop;
  changed := jsonb_array_length(event_ids)>0;
  response := jsonb_build_object('version',1,'actionId',action_id,'profileId',target_profile,'kind',kind,
    'itemId',target_item,'listId',target_list,'result',result,'eventIds',event_ids,'changed',changed,'undoable',undoable,
    'interaction',state_after,'beforeInteraction',case when target_item is null then null else state_before end,
    'predictionId',prediction,'discoveryMode',mode);
  insert into private.item_action_receipts(id,actor_user_id,profile_id,item_id,command,before_state,
    previous_action_id,reverses_action_id,result,list_id,before_list_entry)
    values(action_id,actor,target_profile,target_item,request,state_before,previous_head,reversed_id,response,target_list,entry_before);
  if target_item is not null and changed then
    delete from private.item_action_heads where profile_id=target_profile and item_id=target_item;
    previous_head := case when kind='UNDO_LIST_ENTRY' then reversed.previous_action_id else action_id end;
    if previous_head is not null then
      insert into private.item_action_heads(profile_id,item_id,action_id) values(target_profile,target_item,previous_head);
    end if;
  end if;
  return response;
end;
$$;
revoke all on function private.commit_collection_action_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.commit_collection_action_v1(jsonb) to authenticated;
create function public.commit_collection_action_v1(request jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.commit_collection_action_v1(request);
$$;
revoke all on function public.commit_collection_action_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.commit_collection_action_v1(jsonb) to authenticated;

-- Keep Item undo inside its command family; List undo also restores membership.
create or replace function private.commit_item_action_v1(request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  action_id uuid;
  target_profile uuid;
  target_item uuid;
  item_kind text;
  kind text;
  event_kind text;
  occurred timestamptz;
  session_started timestamptz;
  event_session_id uuid;
  session_context jsonb;
  prediction uuid;
  mode text;
  previous_head uuid;
  next_head uuid;
  reversed_id uuid;
  prior private.item_action_receipts%rowtype;
  reversed private.item_action_receipts%rowtype;
  state_before jsonb;
  state_after jsonb;
  event_properties jsonb;
  response jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(request) is distinct from 'object' or octet_length(request::text) > 16384
    or request->'version' is distinct from '1'::jsonb then
    raise exception 'Invalid item action' using errcode='22023';
  end if;
  action_id := (request->>'actionId')::uuid;
  target_profile := (request->>'profileId')::uuid;
  target_item := (request->>'itemId')::uuid;
  if (request->>'actorUserId')::uuid is distinct from actor then
    raise exception 'Actor mismatch' using errcode='42501';
  end if;
  if action_id is null or target_profile is null or target_item is null then
    raise exception 'Missing action identity' using errcode='22023';
  end if;
  if private.is_profile_member(target_profile) is distinct from true then
    raise exception 'Profile access denied' using errcode='42501';
  end if;

  -- Serialize with existing Shared/List profile transitions; retain membership
  -- until commit so revocation cannot race a fresh call or cached result.
  perform 1 from public.profiles where id=target_profile for update;
  perform 1 from public.profile_members where profile_id=target_profile and user_id=actor for key share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select * into prior from private.item_action_receipts where id=action_id;
  if found then
    if prior.actor_user_id<>actor or prior.profile_id<>target_profile or prior.command<>request then
      raise exception 'Action ID payload mismatch' using errcode='22023';
    end if;
    return prior.result;
  end if;
  if exists(select 1 from public.events where id=action_id) then
    raise exception 'Action ID already used' using errcode='22023';
  end if;
  kind := request->>'kind';
  if kind is null or kind not in ('SET_RATING','SET_NOT_INTERESTED','UNDO') then
    raise exception 'Unsupported item action' using errcode='22023';
  end if;
  occurred := (request->>'occurredAt')::timestamptz;
  event_session_id := (request->'session'->>'sessionId')::uuid;
  session_started := (request->'session'->>'startedAt')::timestamptz;
  session_context := request->'session'->'context';
  mode := request->>'discoveryMode';
  if occurred is null or not isfinite(occurred) or occurred>now()+interval '5 minutes'
    or event_session_id is null or session_started is null or not isfinite(session_started)
    or session_started>occurred or jsonb_typeof(session_context) is distinct from 'object'
    or (mode is not null and mode not in ('FOR_YOU','SURPRISE','RISK')) then
    raise exception 'Invalid action context' using errcode='22023';
  end if;
  select item_type into item_kind from public.items where id=target_item;
  if not found then raise exception 'Unknown Item' using errcode='22023'; end if;

  -- Lock current state before reading the undo head. Commands patch only their
  -- owned taste fields; Saved and other unrelated state are never client copies.
  select jsonb_build_object('interest',interest,'saved',saved,'consumed',consumed,
    'rating',rating,'notInterested',not_interested)
    into state_before from public.item_interactions
    where profile_id=target_profile and item_id=target_item for update;
  state_before := coalesce(state_before,'{"interest":null,"saved":false,"consumed":false,"rating":null,"notInterested":false}'::jsonb);
  select heads.action_id into previous_head from private.item_action_heads heads
    where profile_id=target_profile and item_id=target_item;
  state_after := state_before;
  event_properties := jsonb_build_object('source','ITEM_DETAIL','actionId',action_id,'evidenceVersion','item-action-v1');
  if kind='SET_RATING' then
    if jsonb_typeof(request->'rating') is distinct from 'number'
      or (request->>'rating')::numeric not between 0 and 10
      or trunc((request->>'rating')::numeric)<>(request->>'rating')::numeric then
      raise exception 'Rating must be an integer from 0 to 10' using errcode='22023';
    end if;
    state_after := state_after || jsonb_build_object('interest',null,'consumed',true,
      'rating',(request->>'rating')::integer,'notInterested',false);
    event_kind := 'ITEM_RATED';
    event_properties := event_properties || jsonb_build_object('rating',(request->>'rating')::integer);
  elsif kind='SET_NOT_INTERESTED' then
    if jsonb_typeof(request->'notInterested') is distinct from 'boolean' then
      raise exception 'Not-interest must be boolean' using errcode='22023';
    end if;
    state_after := state_after || jsonb_build_object('notInterested',(request->>'notInterested')::boolean);
    if (request->>'notInterested')::boolean then
      state_after := state_after || '{"interest":null,"consumed":false,"rating":null}'::jsonb;
      event_kind := 'ITEM_NOT_INTERESTED';
    else event_kind := 'ITEM_INTEREST_CLEARED';
    end if;
  else
    reversed_id := (request->>'reversesActionId')::uuid;
    select * into reversed from private.item_action_receipts where id=reversed_id;
    if not found or reversed.actor_user_id<>actor or reversed.profile_id<>target_profile
      or reversed.item_id<>target_item or reversed.command->>'kind' not in ('SET_RATING','SET_NOT_INTERESTED')
      or previous_head is distinct from reversed_id then
      raise exception 'Undo target is no longer current' using errcode='KJ001';
    end if;
    state_after := reversed.before_state;
    event_kind := 'ITEM_INTERACTION_UNDONE';
    event_properties := event_properties || jsonb_build_object('reversedEventId',reversed_id,
      'restoredInterest',state_after->'interest','restoredSaved',state_after->'saved',
      'restoredConsumed',state_after->'consumed','restoredRating',state_after->'rating',
      'restoredNotInterested',state_after->'notInterested');
  end if;
  if private.is_shared_saved_state_valid(target_profile,target_item,(state_after->>'saved')::boolean) is distinct from true then
    raise exception 'Shared Saved requires consensus' using errcode='42501';
  end if;

  -- Unverified/fallback attribution must not prevent an otherwise valid action.
  -- Complete frozen delivered-slate provenance remains the next Phase 14.1 gate.
  prediction := null;
  if kind='UNDO' then
    prediction := (reversed.result->>'predictionId')::uuid;
    mode := reversed.result->>'discoveryMode';
  elsif request->>'predictionId' is not null then
    select run.id into prediction
    from private.prediction_runs run
    join private.prediction_candidates candidate on candidate.prediction_id=run.id
    where run.id=(request->>'predictionId')::uuid and run.actor_user_id=actor
      and run.profile_id=target_profile and run.session_id=event_session_id
      and run.discovery_mode=mode and candidate.item_id=target_item and candidate.selected_for_delivery
      and run.requested_at<=occurred
      and exists(select 1 from public.events impression
        where impression.profile_id=target_profile and impression.actor_user_id=actor
          and impression.session_id=event_session_id and impression.prediction_id=run.id
          and impression.item_id=target_item and impression.event_type='ITEM_IMPRESSION'
          and impression.occurred_at between run.requested_at and occurred);
  end if;
  event_properties := event_properties || jsonb_build_object('attributionStatus',
    case when prediction is null then 'UNATTRIBUTED' else 'VALIDATED_TRACE' end);

  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
    values(event_session_id,actor,target_profile,session_started,session_context) on conflict(id) do nothing;
  if not exists(select 1 from public.event_sessions existing
    where existing.id=event_session_id and existing.actor_user_id=actor and existing.profile_id=target_profile
      and existing.started_at=session_started and existing.context=session_context) then
    raise exception 'Session identity payload mismatch' using errcode='22023';
  end if;
  insert into public.item_interactions(profile_id,item_id,actor_user_id,interest,saved,consumed,rating,not_interested)
    values(target_profile,target_item,actor,state_after->>'interest',(state_after->>'saved')::boolean,
      (state_after->>'consumed')::boolean,(state_after->>'rating')::integer,(state_after->>'notInterested')::boolean)
    on conflict(profile_id,item_id) do update set actor_user_id=excluded.actor_user_id,
      interest=excluded.interest,saved=excluded.saved,consumed=excluded.consumed,
      rating=excluded.rating,not_interested=excluded.not_interested;
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
    session_id,prediction_id,discovery_mode,context,properties)
    values(action_id,actor,target_profile,target_item,item_kind,event_kind,occurred,
      event_session_id,prediction,mode,session_context,event_properties);
  response := jsonb_build_object('version',1,'actionId',action_id,'profileId',target_profile,
    'itemId',target_item,'interaction',state_after,'predictionId',prediction,'discoveryMode',mode);
  insert into private.item_action_receipts(id,actor_user_id,profile_id,item_id,command,before_state,
    previous_action_id,reverses_action_id,result)
    values(action_id,actor,target_profile,target_item,request,state_before,previous_head,reversed_id,response);
  next_head := case when kind='UNDO' then reversed.previous_action_id else action_id end;
  if next_head is not null then
    insert into private.item_action_heads(profile_id,item_id,action_id) values(target_profile,target_item,next_head);
  end if;
  return response;
end;
$$;
