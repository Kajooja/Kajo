-- Synthetic native commands and exposures; no quality or hosted-data claim.
create function pg_temp.input_capture(actor uuid,capture uuid,profile uuid,round uuid,
  revision integer,sources uuid[] default '{}') returns jsonb language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  return private.capture_shared_round_prediction_input_v1(capture,profile,round,revision,sources);
end;$$;
create function pg_temp.input_open(actor uuid,profile uuid,item uuid,round uuid default gen_random_uuid())
returns uuid language plpgsql as $$ begin
  perform pg_temp.outcome_commit(actor,pg_temp.outcome_command(actor,profile,round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  return round;
end;$$;
create function pg_temp.prepared_source(profile uuid,item uuid,actors uuid[],ratings numeric[])
returns uuid language plpgsql as $source$
declare round uuid:=gen_random_uuid();capture uuid:=gen_random_uuid();session uuid;actor uuid;
  origins jsonb[]:='{}';delivery jsonb;result jsonb;n integer:=0;cutoff timestamptz;domain text;
begin
  select item_type into strict domain from public.items where id=item;
  foreach actor in array actors loop
    session:=gen_random_uuid();
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('role','authenticated',true);
    delivery:=public.rank_items_page_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
      'profileId',profile,'sessionId',session,'discoveryMode','FOR_YOU','itemType',domain,'limit',50,'context','{}'::jsonb));
    perform set_config('role','postgres',true);
    if not exists(select 1 from jsonb_array_elements(delivery->'items') x where x->>'item_id'=item::text) then
      raise exception 'Prepared consumption fixture requires actual source delivery';end if;
    origins:=array_append(origins,jsonb_build_object('predictionId',delivery->'predictionId','sessionId',session,'discoveryMode','FOR_YOU'));
    insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      values(session,actor,profile,(delivery#>>'{source,featureAt}')::timestamptz,'{}');
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,created_at)
      values(gen_random_uuid(),actor,profile,item,domain,'ITEM_IMPRESSION',clock_timestamp(),session,
        (delivery->>'predictionId')::uuid,'FOR_YOU',clock_timestamp());
  end loop;
  result:=pg_temp.outcome_commit(actors[1],pg_temp.outcome_command(actors[1],profile,round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  for n in 1..cardinality(actors) loop
    result:=pg_temp.outcome_commit(actors[n],pg_temp.outcome_command(actors[n],profile,round,'SET_RESPONSE',n,
      jsonb_build_object('rating',ratings[n],'origin',origins[n])));
  end loop;
  cutoff:=clock_timestamp();
  perform private.capture_shared_rating_round_outcome_v1(capture,profile,round,cutoff,cutoff,interval '0 seconds');
  if (select c.result#>>'{outcome,coverage,eligibleVectorResponseCount}' from private.shared_round_outcome_captures c where c.id=capture)
    is distinct from cardinality(actors)::text then raise exception 'Prepared fixture lacks full attributed vector';end if;
  return capture;
end;$source$;

-- Return all identities as one JSON value before the inherited temp tables
-- disappear at commit. A later transaction really consumes the retained input.
create function pg_temp.prepared_fixture() returns jsonb language plpgsql as $fixture$
declare f record;original_source uuid;target_round uuid;discord uuid;low uuid;high uuid;flat1 uuid;flat2 uuid;abc_source uuid;
  cold uuid:=gen_random_uuid();mixed uuid:=gen_random_uuid();consensus uuid:=gen_random_uuid();flat uuid:=gen_random_uuid();
  stale uuid:=gen_random_uuid();abc_input uuid:=gen_random_uuid();abz uuid:='a232f900-0000-4000-8000-000000000010';
  abc_round uuid;abz_round uuid;source_items uuid[];i integer;race_rounds uuid[]:='{}';race_inputs uuid[]:='{}';
begin
  select * into strict f from pg_temp.outcome_fixture;
  update public.items set tags=array['warm'] where id in(f.book,f.movie);
  for i in 1..6 loop
    source_items:=array_append(source_items,('a232f900-0000-4000-8000-'||lpad((100+i)::text,12,'0'))::uuid);
    insert into public.items(id,item_type,title,tags,discoverable)
      values(source_items[i],'BOOK','Prepared source '||i,array[case when i in(3,5) then 'warm' else 'cool' end],true);
  end loop;
  insert into private.item_sources(item_id,provider_key,provider_item_id)
    select id,'kajo_curated',id::text from public.items;
  original_source:=pg_temp.prepared_source(f.pair,f.book,array[f.actor,f.partner],array[0,10]);
  discord:=pg_temp.prepared_source(f.pair,source_items[1],array[f.actor,f.partner],array[10,0]);
  low:=pg_temp.prepared_source(f.pair,source_items[2],array[f.actor,f.partner],array[2,4]);
  high:=pg_temp.prepared_source(f.pair,source_items[3],array[f.actor,f.partner],array[8,9]);
  flat1:=pg_temp.prepared_source(f.pair,source_items[4],array[f.actor,f.partner],array[5,7]);
  flat2:=pg_temp.prepared_source(f.pair,source_items[5],array[f.actor,f.partner],array[5,7]);
  abc_source:=pg_temp.prepared_source(f.multi,source_items[6],array[f.actor,f.partner,f.third],array[1,5,9]);
  target_round:=pg_temp.input_open(f.actor,f.pair,f.movie);
  perform pg_temp.input_capture(f.actor,cold,f.pair,target_round,1,'{}');
  perform pg_temp.input_capture(f.actor,mixed,f.pair,target_round,1,array[original_source,discord]);
  perform pg_temp.input_capture(f.actor,consensus,f.pair,target_round,1,array[low,high]);
  perform pg_temp.input_capture(f.actor,flat,f.pair,target_round,1,array[flat1,flat2]);
  perform pg_temp.input_capture(f.actor,stale,f.pair,target_round,1,array[low,high]);
  abc_round:=pg_temp.input_open(f.actor,f.multi,f.movie);
  perform pg_temp.input_capture(f.actor,abc_input,f.multi,abc_round,1,array[abc_source]);
  insert into public.profiles(id,profile_type,name) values(abz,'SHARED','Overlapping A B Z');
  insert into public.profile_members(profile_id,user_id) values(abz,f.actor),(abz,f.partner),(abz,f.outsider);
  abz_round:=pg_temp.input_open(f.actor,abz,f.movie);
  for i in 1..4 loop
    race_rounds:=array_append(race_rounds,pg_temp.input_open(f.actor,f.pair,f.movie));
    race_inputs:=array_append(race_inputs,gen_random_uuid());
    perform pg_temp.input_capture(f.actor,race_inputs[i],f.pair,race_rounds[i],1,'{}');
  end loop;
  return to_jsonb(f)||jsonb_build_object('targetRound',target_round,'cold',cold,'mixed',mixed,'consensus',consensus,
    'flat',flat,'stale',stale,'discord',discord,'low',low,'high',high,'flatSource',flat1,'abcInput',abc_input,'abcRound',abc_round,
    'abcSource',abc_source,'abz',abz,'abzRound',abz_round,'originalSource',original_source,
    'originalSourceRound',(select round_id from private.shared_round_outcome_captures where id=original_source),
    'sourceItems',source_items,'raceInputs',race_inputs,'raceRounds',race_rounds);
end;$fixture$;
