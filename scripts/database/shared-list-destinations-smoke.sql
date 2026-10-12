-- Isolated/rollback-only acceptance of the actual authorized command boundary.
begin;
create function pg_temp.reject_multi_destination_event() returns trigger language plpgsql as $$
begin
  if new.event_type='ITEM_ADDED_TO_LIST' and new.properties->>'listId'=current_setting('kajo.reject_multi_list',true) then
    raise exception 'Forced destination Event failure';
  end if;
  return new;
end;
$$;
create trigger reject_multi_destination_event before insert on public.events
for each row execute function pg_temp.reject_multi_destination_event();
do $multi$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  shared uuid:=gen_random_uuid(); personal uuid; item uuid:=gen_random_uuid(); pending_item uuid:=gen_random_uuid();
  l1 uuid; l2 uuid; foreign_list uuid; base jsonb; other_base jsonb; proposal jsonb; approval jsonb; result jsonb; first_receipt jsonb;
  row jsonb; deleted jsonb; before_count bigint;
begin
  insert into auth.users(id,email,raw_user_meta_data) select id,id::text||'@example.invalid',
    jsonb_build_object('kajo_nickname','Multi '||left(id::text,12)) from unnest(array[a,b,outsider]) t(id);
  select id into strict personal from public.profiles where owner_user_id=a and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Multi acceptance');
  insert into public.profile_members(profile_id,user_id) values(shared,a),(shared,b);
  insert into public.items(id,item_type,title,discoverable) values(item,'MOVIE','Multi movie',true),(pending_item,'BOOK','Multi book',true);
  base:=jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',a,'profileId',shared,
    'itemId',null,'listId',null,'occurredAt',now(),'kind','CREATE_LIST','name','First','source','LISTS',
    'predictionId',null,'discoveryMode','FOR_YOU','session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  other_base:=base||jsonb_build_object('actorUserId',b,'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  perform set_config('request.jwt.claim.sub',a::text,true); perform set_config('role','authenticated',true);
  result:=public.commit_collection_action_v1(base); l1:=(result->>'listId')::uuid;
  result:=public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),'name','Second')); l2:=(result->>'listId')::uuid;
  result:=public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),'profileId',personal,'name','Personal',
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb))); foreign_list:=(result->>'listId')::uuid;
  proposal:=base||jsonb_build_object('actionId',gen_random_uuid(),'itemId',item,'kind','ENDORSE_SHARED_ITEM','listId',l1,
    'listIds',jsonb_build_array(l1,l2),'source','ITEM_DESTINATION_PICKER');
  begin
    perform public.commit_collection_action_v1(proposal||jsonb_build_object('listIds',jsonb_build_array(l1,foreign_list)));
    raise exception 'Cross-Profile destination accepted';
  exception when no_data_found then null; when sqlstate 'KJ002' then null; end;
  begin
    perform public.commit_collection_action_v1(proposal||jsonb_build_object('listIds',jsonb_build_array(l1,l1)));
    raise exception 'Duplicate destinations accepted';
  exception when sqlstate 'KJ002' then null; end;
  first_receipt:=public.commit_collection_action_v1(proposal);
  if first_receipt->'result'->0->>'consensus_saved'<>'false' or jsonb_array_length(first_receipt->'result'->0->'proposal_lists')<>2 then
    raise exception 'First response did not preserve a pending destination set';
  end if;
  select d into row from jsonb_array_elements(public.get_shared_discovery_overlay_v2(shared,null)) d where d->>'item_id'=item::text;
  if jsonb_array_length(row->'proposal_lists')<>2 then raise exception 'Overlay omitted a selected List'; end if;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.item_list_entries where item_id=item) then raise exception 'Proposal saved before consensus'; end if;
  if not exists(select 1 from public.events where id=(proposal->>'actionId')::uuid and jsonb_array_length(properties->'destinations')=2) then
    raise exception 'Endorsement lost exact target provenance';
  end if;
  perform set_config('request.jwt.claim.sub',b::text,true); perform set_config('role','authenticated',true);
  approval:=other_base||jsonb_build_object('actionId',gen_random_uuid(),'itemId',item,'kind','ENDORSE_SHARED_ITEM',
    'listIds',jsonb_build_array(l2,l1),'source','SHARED_DISCOVERY');
  begin
    perform public.commit_collection_action_v1(approval-'listIds');
    raise exception 'Legacy command silently approved hidden destinations';
  exception when sqlstate 'KJ002' then null; end;
  begin
    perform public.endorse_shared_item(shared,item);
    raise exception 'Legacy bare endorsement bypassed destination review';
  exception when data_exception then null; end;
  begin
    perform public.endorse_shared_list_item(shared,item,null);
    raise exception 'Legacy public RPC bypassed destination review';
  exception when data_exception then null; end;
  begin
    perform public.commit_collection_action_v1(approval||jsonb_build_object('listIds',jsonb_build_array(l1)));
    raise exception 'Subset approval accepted';
  exception when sqlstate 'KJ002' then null; end;
  perform set_config('kajo.reject_multi_list',l2::text,true);
  begin
    perform public.commit_collection_action_v1(approval);
    raise exception 'Second destination Event failure did not abort';
  exception when raise_exception then
    if sqlerrm<>'Forced destination Event failure' then raise; end if;
  end;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.item_list_entries where item_id=item)
    or exists(select 1 from public.item_interactions where profile_id=shared and item_id=item and saved)
    or exists(select 1 from public.shared_item_endorsements where profile_id=shared and item_id=item and actor_user_id=b)
    or exists(select 1 from private.item_action_receipts where id=(approval->>'actionId')::uuid) then
    raise exception 'Partial consensus/receipt survived failure';
  end if;
  perform set_config('kajo.reject_multi_list','',true); perform set_config('role','authenticated',true);
  result:=public.commit_collection_action_v1(approval);
  if result->'result'->0->>'consensus_saved'<>'true' or jsonb_array_length(result->'eventIds')<>4
    or public.commit_collection_action_v1(approval) is distinct from result then raise exception 'Consensus or exact retry failed'; end if;
  perform set_config('role','postgres',true);
  if (select count(*) from public.item_list_entries where item_id=item and list_id in(l1,l2)
    and added_by_user_id=a and entry_source='SHARED_CONSENSUS')<>2 then raise exception 'Missing membership or false provenance'; end if;
  if exists(select 1 from public.item_interactions where profile_id=personal and item_id=item) then raise exception 'Personal state changed'; end if;
  select count(*) into before_count from public.events;
  perform set_config('request.jwt.claim.sub',a::text,true); perform set_config('role','authenticated',true);
  if public.commit_collection_action_v1(proposal) is distinct from first_receipt then raise exception 'Old receipt was rewritten at consensus'; end if;
  perform set_config('role','postgres',true);
  if (select count(*) from public.events)<>before_count then raise exception 'Retry duplicated evidence'; end if;
  perform set_config('role','authenticated',true);
  proposal:=proposal||jsonb_build_object('actionId',gen_random_uuid(),'itemId',pending_item);
  perform public.commit_collection_action_v1(proposal);
  deleted:=base||jsonb_build_object('actionId',gen_random_uuid(),'kind','DELETE_LIST','listId',l2);
  result:=public.commit_collection_action_v1(deleted);
  perform set_config('role','postgres',true);
  if exists(select 1 from public.shared_item_list_proposals where profile_id=shared and item_id=pending_item)
    or exists(select 1 from public.shared_item_endorsements where profile_id=shared and item_id=pending_item)
    or exists(select 1 from private.shared_list_proposal_destinations where profile_id=shared and item_id=pending_item) then
    raise exception 'Deleting secondary target left an unreviewed pending proposal';
  end if;
  if not exists(select 1 from public.events where event_type='ITEM_INTERACTION_UNDONE'
    and properties->>'reversedEventId'=proposal->>'actionId') then raise exception 'Cancellation left old outcome evidence'; end if;
  if not exists(select 1 from public.item_list_entries where item_id=item and list_id=l1)
    or not exists(select 1 from public.item_interactions where profile_id=shared and item_id=item and saved) then
    raise exception 'Deletion erased another completed List or consensus Saved';
  end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true); perform set_config('role','authenticated',true);
  begin perform public.get_shared_discovery_overlay_v2(shared,null); raise exception 'Outsider read proposal targets';
  exception when insufficient_privilege then null; end;
  begin perform private.endorse_shared_list_item_core_v1(shared,item,l1); raise exception 'Internal core exposed';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
end;
$multi$;
select jsonb_build_object('sharedListDestinations','PASS: exact target consent, atomic multi-List consensus, replay, cancellation and authorization') as snapshot;
rollback;
