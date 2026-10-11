-- Disposable actual native/bootstrap inputs. Every caller owns BEGIN/ROLLBACK.
create temp table item_support_fixture(actor uuid,foreign_actor uuid,personal uuid,foreign_personal uuid,
  evidence uuid,book uuid,movie uuid,unmatched uuid) on commit drop;
create temp table item_support_pages(actor uuid,request jsonb,response jsonb) on commit drop;
create temp table item_support_sources(id uuid primary key) on commit drop;
create temp table item_support_live(kernel text,profile uuid,domain text,body jsonb) on commit drop;
create function pg_temp.item_support_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Native Item support assertion: %',label;end if;end;$$;
-- Fresh live calls legitimately record a later clock_timestamp eligibilityAt.
-- Keep every score feature/policy/version and every other legacy trace field.
create function pg_temp.item_support_comparable(row_body jsonb) returns jsonb language sql immutable as $$
  select row_body-array['prediction_id','confidence','explanation']||jsonb_build_object('explanation',
    ((row_body->'explanation')-array['nativeItemSupportCount','nativeSupportVersion','nativeSupportBasis','nativeSupportCalibration'])
      #-'{candidatePool,eligibilityAt}');
$$;
create function pg_temp.item_support_page(actor uuid,profile uuid,domain text,protocol integer)
returns jsonb language plpgsql as $$ declare request jsonb;response jsonb;begin
  request := jsonb_build_object('version',protocol,'requestId',gen_random_uuid(),'profileId',profile,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType',domain,'limit',10,'context','{}'::jsonb);
  perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('role','authenticated',true);
  response := public.rank_items_page_v1(request);perform set_config('role','postgres',true);
  perform pg_temp.item_support_assert(jsonb_array_length(response->'items')>0,'actual public page nonempty');
  insert into pg_temp.item_support_pages values(actor,request,response);
  insert into pg_temp.item_support_sources values((response->>'predictionId')::uuid);
  return response;
exception when others then perform set_config('role','postgres',true);raise;end;$$;
do $fixture$
declare
  a uuid := 'a181d000-0000-4000-8000-000000000001';b uuid := 'a181d000-0000-4000-8000-000000000002';
  evidence uuid := 'a181d000-0000-4000-8000-000000000020';
  book uuid := 'a181d000-0000-4000-8000-000000000021';
  movie uuid := 'a181d000-0000-4000-8000-000000000022';
  unmatched uuid := 'a181d000-0000-4000-8000-000000000023';
  personal uuid;foreign_personal uuid;response jsonb;worker jsonb;calibration jsonb;domain text;
  tags text[] := array['support-a','support-b','support-c','support-d','support-e','support-f','support-g','support-h'];
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Native Item support fixture requires empty disposable state';end if;
  insert into auth.users(id,email,raw_user_meta_data) select id,id::text||'@example.invalid',
    jsonb_build_object('kajo_nickname','Item support '||right(id::text,4)) from unnest(array[a,b]) ids(id);
  select id into strict personal from public.profiles where owner_user_id=a and profile_type='PERSONAL';
  select id into strict foreign_personal from public.profiles where owner_user_id=b and profile_type='PERSONAL';
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence,'BOOK','Support evidence',tags,true),(book,'BOOK','Support book',tags,true),
    (movie,'MOVIE','Support movie',tags,true),(unmatched,'BOOK','Unmatched book',array['other-tag'],true);
  insert into public.items(id,item_type,title,tags,discoverable)
    select gen_random_uuid(),'BOOK','Support neutral calibration '||n,array['support-neutral-'||n],true
    from generate_series(1,5) n;
  insert into private.item_sources(item_id,provider_key,provider_item_id)
    select id,'kajo_curated',id::text from public.items where id=evidence or title like 'Support neutral calibration %';
  -- Bootstrap remains a real, separately removable calibration source.
  perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('role','authenticated',true);
  select jsonb_agg(jsonb_build_object('itemId',id,'rating',5)) into calibration
    from public.items where title like 'Support neutral calibration %';
  perform public.commit_profile_calibration_v1(personal,calibration||jsonb_build_array(jsonb_build_object('itemId',evidence,'rating',10)));
  perform set_config('role','postgres',true);
  update private.profile_bootstrap_evidence set active=false;
  update public.items set discoverable=false where id=evidence or title like 'Support neutral calibration %';
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values('a181d000-0000-4000-8000-000000000100',a,personal,evidence,'BOOK','ITEM_RATED',now()-interval '1 day','{"rating":10}');
  insert into pg_temp.item_support_fixture values(a,b,personal,foreign_personal,evidence,book,movie,unmatched);
  foreach domain in array array['BOOK','MOVIE'] loop
    insert into pg_temp.item_support_live
      select 'v0',personal,domain,jsonb_agg(pg_temp.item_support_comparable(to_jsonb(k)) order by k.rank)
      from private.rank_items_v0(personal,'FOR_YOU',domain,50,'{}') k;
    insert into pg_temp.item_support_live
      select 'catalogue',personal,domain,jsonb_agg(pg_temp.item_support_comparable(to_jsonb(k)) order by k.rank)
      from private.rank_items_catalog_base_v1('{}',false,personal,'FOR_YOU',domain,50,'{}') k;
    response := pg_temp.item_support_page(a,personal,domain,3);
  end loop;
  response := pg_temp.item_support_page(a,personal,'BOOK',2);
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    select id,md5('kajo:predictor-genome:prediction-v1-baseline')::uuid from pg_temp.item_support_sources
    on conflict do nothing;
  worker := private.process_shadow_prediction_jobs_v1(250);
  perform pg_temp.item_support_assert(worker->>'failed'='0','actual pre-forward frozen baseline shadow succeeds');
end;$fixture$;
