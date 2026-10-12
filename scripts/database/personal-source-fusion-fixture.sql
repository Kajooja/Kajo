create function pg_temp.fusion_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Personal source fusion assertion: %',label;end if;end;$$;
create function pg_temp.fusion_item_action(kind text,fields jsonb,offset_seconds integer)
returns jsonb language plpgsql as $$declare f record;request jsonb;result jsonb;begin
  select * into strict f from pg_temp.item_support_fixture;
  request:=jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',f.actor,'profileId',f.personal,
    'itemId',f.evidence,'kind',kind,'occurredAt',now()+offset_seconds*interval '1 second',
    'session',jsonb_build_object('sessionId','a181d000-0000-4000-8000-000000000201','startedAt',now()-interval '1 day','context','{}'::jsonb))||fields;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);perform set_config('role','authenticated',true);
  result:=public.commit_item_action_v1(request);perform set_config('role','postgres',true);return result;
exception when others then perform set_config('role','postgres',true);raise;end;$$;
create function pg_temp.fusion_clear_history(offset_seconds integer)
returns jsonb language plpgsql as $$declare f record;request jsonb;result jsonb;begin
  select * into strict f from pg_temp.item_support_fixture;
  request:=jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',f.actor,'profileId',f.personal,
    'itemId',f.evidence,'kind','CLEAR_HISTORY','source','LISTS','occurredAt',now()+offset_seconds*interval '1 second',
    'session',jsonb_build_object('sessionId','a181d000-0000-4000-8000-000000000201','startedAt',now()-interval '1 day','context','{}'::jsonb));
  perform set_config('request.jwt.claim.sub',f.actor::text,true);perform set_config('role','authenticated',true);
  result:=public.commit_collection_action_v1(request);perform set_config('role','postgres',true);return result;
exception when others then perform set_config('role','postgres',true);raise;end;$$;
create function pg_temp.fusion_collection_action(kind text,fields jsonb,offset_seconds integer)
returns jsonb language plpgsql as $$declare f record;request jsonb;result jsonb;begin
  select * into strict f from pg_temp.item_support_fixture;
  request:=jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',f.actor,'profileId',f.personal,
    'itemId',f.evidence,'kind',kind,'source','LISTS','occurredAt',now()+offset_seconds*interval '1 second',
    'session',jsonb_build_object('sessionId','a181d000-0000-4000-8000-000000000201','startedAt',now()-interval '1 day','context','{}'::jsonb))||fields;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);perform set_config('role','authenticated',true);
  result:=public.commit_collection_action_v1(request);perform set_config('role','postgres',true);return result;
exception when others then perform set_config('role','postgres',true);raise;end;$$;
