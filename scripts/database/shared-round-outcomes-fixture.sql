-- Small synthetic committed receipt lineage for additive upgrade and replay.
create function pg_temp.outcome_command(actor uuid, profile uuid, round uuid, kind text, revision integer, extra jsonb default '{}')
returns jsonb language sql as $$ select jsonb_build_object('version',1,'commandId',gen_random_uuid(),
  'actorUserId',actor,'profileId',profile,'roundId',round,'kind',kind,'expectedRevision',revision)||extra $$;
create function pg_temp.outcome_commit(actor uuid, request jsonb) returns jsonb
language plpgsql as $$ declare response jsonb; begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  response := public.commit_shared_rating_round_v1(request);
  perform set_config('role','postgres',true);
  return response;
exception when others then perform set_config('role','postgres',true); raise;
end; $$;
create temp table outcome_fixture(actor uuid,partner uuid,third uuid,outsider uuid,pair uuid,multi uuid,
  personal uuid,book uuid,movie uuid,legacy_item uuid,round uuid) on commit drop;
create temp table outcome_receipts(revision integer primary key,command jsonb,result jsonb,accepted_at timestamptz) on commit drop;
do $fixture$
declare
  a uuid := 'a232b000-0000-4000-8000-000000000001';
  b uuid := 'a232b000-0000-4000-8000-000000000002';
  c uuid := 'a232b000-0000-4000-8000-000000000003';
  outsider uuid := 'a232b000-0000-4000-8000-000000000004';
  pair uuid := 'a232b000-0000-4000-8000-000000000010';
  multi uuid := 'a232b000-0000-4000-8000-000000000011';
  book uuid := 'a232b000-0000-4000-8000-000000000020';
  movie uuid := 'a232b000-0000-4000-8000-000000000021';
  legacy_item uuid := 'a232b000-0000-4000-8000-000000000022';
  round uuid := 'a232b000-0000-4000-8000-000000000030';
  personal uuid; request jsonb; response jsonb; started timestamptz := clock_timestamp();
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Joint outcome fixture requires empty synthetic state'; end if;
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Outcome '||right(id::text,4))
    from unnest(array[a,b,c,outsider]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=a and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(pair,'SHARED','Pair outcome'),(multi,'SHARED','N outcome');
  insert into public.profile_members(profile_id,user_id) values(pair,a),(pair,b),(multi,a),(multi,b),(multi,c);
  insert into public.items(id,item_type,title,tags,discoverable) values(book,'BOOK','Outcome book',array['outcome'],true),
    (movie,'MOVIE','Outcome movie',array['outcome'],true),(legacy_item,'BOOK','Legacy rating',array['outcome'],true);
  insert into pg_temp.outcome_fixture values(a,b,c,outsider,pair,multi,personal,book,movie,legacy_item,round);
  request := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',a,'profileId',pair,
    'itemId',legacy_item,'kind','SET_RATING','rating',10,'occurredAt',started,'predictionId',null,
    'discoveryMode','FOR_YOU','session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',started,'context','{}'::jsonb));
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('role','authenticated',true);
  perform public.commit_item_action_v1(request);
  perform set_config('role','postgres',true);
  request := pg_temp.outcome_command(a,pair,round,'OPEN_ROUND',0,jsonb_build_object('itemId',book,'experienceId',gen_random_uuid()));
  response := pg_temp.outcome_commit(a,request);
  insert into pg_temp.outcome_receipts select 1,request,response,created_at from private.shared_rating_round_receipts
    where command_id=(request->>'commandId')::uuid;
  request := pg_temp.outcome_command(a,pair,round,'SET_RESPONSE',1,'{"rating":0}');
  response := pg_temp.outcome_commit(a,request);
  insert into pg_temp.outcome_receipts select 2,request,response,created_at from private.shared_rating_round_receipts
    where command_id=(request->>'commandId')::uuid;
  request := pg_temp.outcome_command(b,pair,round,'SET_RESPONSE',2,'{"rating":10}');
  response := pg_temp.outcome_commit(b,request);
  insert into pg_temp.outcome_receipts select 3,request,response,created_at from private.shared_rating_round_receipts
    where command_id=(request->>'commandId')::uuid;
  request := pg_temp.outcome_command(a,pair,round,'CLEAR_RESPONSE',3);
  response := pg_temp.outcome_commit(a,request);
  insert into pg_temp.outcome_receipts select 4,request,response,created_at from private.shared_rating_round_receipts
    where command_id=(request->>'commandId')::uuid;
end; $fixture$;
