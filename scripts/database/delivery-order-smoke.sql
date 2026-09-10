-- Synthetic delivery-order matrix. No hosted/user data; every fixture rolls back.
begin;
do $delivery$
declare
  actor uuid := gen_random_uuid();
  profile uuid;
  item uuid;
  session uuid;
  other_session uuid;
  list_id uuid;
  prediction uuid;
  started timestamptz := now() - interval '3 days';
  exposed timestamptz := now() - interval '2 days';
  acted timestamptz := now() - interval '1 day';
  family text;
  scenario text;
  command jsonb;
  receipt jsonb;
  repeated jsonb;
  event_before jsonb;
  ranked record;
  case_count integer := 0;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    values(actor,actor::text||'@example.invalid','{"kajo_nickname":"Delivery order"}'::jsonb);
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  foreach family in array array['ITEM','COLLECTION'] loop
    foreach scenario in array array['DELAYED_VALID','MISSING','LATE_ARRIVAL','AFTER_ACTION','OTHER_SESSION','OTHER_MODE','NOT_SELECTED'] loop
      perform set_config('role','postgres',true);
      item := gen_random_uuid(); session := gen_random_uuid(); other_session := gen_random_uuid();
      insert into public.items(id,item_type,title,discoverable) values(item,'MOVIE',family||' '||scenario,true);
      insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
        values(session,actor,profile,started,'{}'),(other_session,actor,profile,started,'{}');
      perform set_config('role','authenticated',true);
      select * into strict ranked from public.rank_items_v1(profile,'FOR_YOU','MOVIE',20,
        jsonb_build_object('sessionId',session)) where item_id=item;
      prediction := ranked.prediction_id;
      -- Age only this synthetic run: replay must use occurrence time, not receipt time.
      perform set_config('role','postgres',true);
      update private.prediction_runs set requested_at=started where id=prediction;
      if scenario='NOT_SELECTED' then
        update private.prediction_candidates set selected_for_delivery=false where prediction_id=prediction and item_id=item;
      end if;
      if scenario not in ('MISSING','LATE_ARRIVAL') then
        insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
          values(gen_random_uuid(),actor,profile,item,'MOVIE','ITEM_IMPRESSION',
            case when scenario='AFTER_ACTION' then acted+interval '1 hour' else exposed end,
            case when scenario='OTHER_SESSION' then other_session else session end,prediction);
      end if;
      perform set_config('role','authenticated',true);
      -- A newer session/run must not steal the older delivered origin.
      if scenario='DELAYED_VALID' then
        perform public.rank_items_v1(profile,'RISK','MOVIE',20,jsonb_build_object('sessionId',other_session));
      end if;
      command := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,
        'profileId',profile,'itemId',item,'occurredAt',acted,'predictionId',prediction,
        'discoveryMode',case when scenario='OTHER_MODE' then 'RISK' else 'FOR_YOU' end,
        'session',jsonb_build_object('sessionId',session,'startedAt',started,'context','{}'::jsonb));
      if family='ITEM' then
        command := command || '{"kind":"SET_RATING","rating":8}'::jsonb;
        receipt := public.commit_item_action_v1(command);
      else
        repeated := public.commit_collection_action_v1((command - 'itemId' - 'predictionId') ||
          jsonb_build_object('actionId',gen_random_uuid(),'kind','CREATE_LIST','name',scenario,'source','LISTS'));
        list_id := (repeated->>'listId')::uuid;
        command := command || jsonb_build_object('kind','SET_LIST_ENTRY','listId',list_id,
          'present',true,'positive',true,'source','ITEM_DESTINATION_PICKER');
        receipt := public.commit_collection_action_v1(command);
      end if;
      if (receipt->>'predictionId' is not null) is distinct from (scenario='DELAYED_VALID') then
        raise exception '% / %: unexpected Prediction attribution %',family,scenario,receipt;
      end if;
      select to_jsonb(e) into strict event_before from public.events e where e.id=(command->>'actionId')::uuid;
      if event_before->>'session_id' is distinct from session::text
        or (event_before->>'occurred_at')::timestamptz<>acted
        or event_before->'properties'->>'attributionStatus' is distinct from
          (case when scenario='DELAYED_VALID' then 'VALIDATED_TRACE' else 'UNATTRIBUTED' end) then
        raise exception '% / %: Event lost original envelope or attribution status',family,scenario;
      end if;
      perform set_config('role','postgres',true);
      if scenario='LATE_ARRIVAL' then
        if exists(select 1 from private.prediction_outcome_events_v1(profile,clock_timestamp(),clock_timestamp()) e
          where e.id=(command->>'actionId')::uuid) then
          raise exception '%: missing exposure was invented',family;
        end if;
        -- Its occurrence precedes the action, but its INSERT follows the immutable receipt.
        insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
          values(gen_random_uuid(),actor,profile,item,'MOVIE','ITEM_IMPRESSION',exposed,session,prediction);
      end if;
      perform set_config('role','postgres',true);
      if (select count(*) from private.prediction_outcome_events_v1(profile,clock_timestamp(),clock_timestamp()) e
        where e.id=(command->>'actionId')::uuid and e.prediction_id=prediction) <>
          (case when scenario in ('DELAYED_VALID','LATE_ARRIVAL') then 1 else 0 end) then
        raise exception '% / %: effective Outcome failed exact origin proof',family,scenario;
      end if;
      if family='COLLECTION' and scenario='LATE_ARRIVAL' and
        (select count(*) from private.prediction_outcome_events_v1(profile,clock_timestamp(),clock_timestamp()) e
          where e.id in (select value::uuid from jsonb_array_elements_text(receipt->'eventIds'))
            and e.prediction_id=prediction and e.attribution_source='LATE_EXPOSURE_V1')<>2 then
        raise exception 'Late collection exposure did not recover both owned Outcome Events';
      end if;
      perform set_config('role','authenticated',true);
      repeated := case when family='ITEM' then public.commit_item_action_v1(command)
        else public.commit_collection_action_v1(command) end;
      if repeated is distinct from receipt or (select to_jsonb(e) from public.events e
        where e.id=(command->>'actionId')::uuid) is distinct from event_before then
        raise exception '% / %: retry or late exposure rewrote accepted history',family,scenario;
      end if;
      if family='COLLECTION' and exists(select 1 from public.events e
        where e.id in (select value::uuid from jsonb_array_elements_text(receipt->'eventIds'))
          and e.prediction_id is distinct from (receipt->>'predictionId')::uuid) then
        raise exception '%: secondary collection Event has different attribution',scenario;
      end if;
      -- Undo must retain accepted attribution, including permanently unattributed receipts.
      command := (command - 'rating') || jsonb_build_object('actionId',gen_random_uuid(),'kind',case when family='ITEM' then 'UNDO' else 'UNDO_LIST_ENTRY' end,
        'reversesActionId',command->>'actionId','occurredAt',clock_timestamp(),
        'predictionId',gen_random_uuid(),'discoveryMode','RISK');
      repeated := case when family='ITEM' then public.commit_item_action_v1(command)
        else public.commit_collection_action_v1(command) end;
      if repeated->>'predictionId' is distinct from receipt->>'predictionId' then
        raise exception '% / %: undo changed accepted attribution',family,scenario;
      end if;
      case_count := case_count+1;
    end loop;
  end loop;
  if case_count<>14 then raise exception 'Incomplete delivery matrix'; end if;
end;
$delivery$;
select jsonb_build_object('deliveryOrder','PASS: 14 Item/collection delayed, missing, late-arriving, temporal, session, mode and selection cases; immutable retry/undo') as snapshot;
rollback;
