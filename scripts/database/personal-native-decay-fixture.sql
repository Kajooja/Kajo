-- Disposable real Personal/Shared serving inputs. No mutation reaches a hosted database.
create temp table native_decay_fixture(actor uuid,partner uuid,personal uuid,other_personal uuid,
  shared uuid,evidence uuid,opposite_evidence uuid,book uuid,other_book uuid,movie uuid,other_movie uuid)
  on commit drop;
create temp table native_decay_pages(actor uuid,request jsonb,response jsonb) on commit drop;
create temp table native_decay_sources(id uuid primary key) on commit drop;
create temp table native_decay_frozen(relation text,id text,body jsonb) on commit drop;
create function pg_temp.decay_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Native decay assertion: %',label;end if;end;$$;
create function pg_temp.decay_page(actor uuid,profile uuid,domain text,protocol integer default 3)
returns jsonb language plpgsql as $$ declare request jsonb;response jsonb;begin
  request := jsonb_build_object('version',protocol,'requestId',gen_random_uuid(),'profileId',profile,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType',domain,'limit',10,'context','{}'::jsonb);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  response := public.rank_items_page_v1(request);
  perform set_config('role','postgres',true);
  perform pg_temp.decay_assert(jsonb_array_length(response->'items')>0,'actual serving page is nonempty');
  insert into pg_temp.native_decay_pages values(actor,request,response);
  insert into pg_temp.native_decay_sources values((response->>'predictionId')::uuid);
  return response;
exception when others then perform set_config('role','postgres',true);raise;end;$$;
do $fixture$
declare
  a uuid := 'a180d000-0000-4000-8000-000000000001';b uuid := 'a180d000-0000-4000-8000-000000000002';
  shared uuid := 'a180d000-0000-4000-8000-000000000010';personal uuid;other_personal uuid;
  evidence uuid := 'a180d000-0000-4000-8000-000000000020';
  opposite uuid := 'a180d000-0000-4000-8000-000000000021';
  book uuid := 'a180d000-0000-4000-8000-000000000022';
  other_book uuid := 'a180d000-0000-4000-8000-000000000023';
  movie uuid := 'a180d000-0000-4000-8000-000000000024';
  other_movie uuid := 'a180d000-0000-4000-8000-000000000025';
  profile uuid;domain text;response jsonb;worker jsonb;calibration jsonb;
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Native decay fixture requires empty disposable state';end if;
  insert into auth.users(id,email,raw_user_meta_data) select id,id::text||'@example.invalid',
    jsonb_build_object('kajo_nickname','Native decay '||right(id::text,4)) from unnest(array[a,b]) ids(id);
  select id into strict personal from public.profiles where owner_user_id=a and profile_type='PERSONAL';
  select id into strict other_personal from public.profiles where owner_user_id=b and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Native decay control');
  insert into public.profile_members(profile_id,user_id) values(shared,a),(shared,b);
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence,'BOOK','Historical warm',array['decay-warm'],true),
    (opposite,'BOOK','Historical dark',array['decay-dark'],true),
    (book,'BOOK','Unseen warm book',array['decay-warm'],true),
    (other_book,'BOOK','Unseen dark book',array['decay-dark'],true),
    (movie,'MOVIE','Unseen warm movie',array['decay-warm'],true),
    (other_movie,'MOVIE','Unseen dark movie',array['decay-dark'],true);
  insert into public.items(id,item_type,title,tags,discoverable)
    select gen_random_uuid(),'BOOK','Neutral calibration '||n,array['decay-neutral-'||n],true
    from generate_series(1,4) n;
  insert into private.item_sources(item_id,provider_key,provider_item_id)
    select id,'kajo_curated',id::text from public.items where id in(evidence,opposite) or title like 'Neutral calibration %';
  -- Use actual calibration APIs; imported evidence remains distinct from native Events.
  foreach profile in array array[personal,other_personal] loop
    perform set_config('request.jwt.claim.sub',case when profile=personal then a else b end::text,true);
    perform set_config('role','authenticated',true);
    select jsonb_agg(jsonb_build_object('itemId',id,'rating',5)) into calibration
      from public.items where title like 'Neutral calibration %';
    perform public.commit_profile_calibration_v1(profile,calibration||jsonb_build_array(
      jsonb_build_object('itemId',evidence,'rating',case when profile=personal then 10 else 0 end),
      jsonb_build_object('itemId',opposite,'rating',case when profile=personal then 0 else 10 end)));
    perform set_config('role','postgres',true);
  end loop;
  update private.profile_bootstrap_evidence set active=false;
  update public.items set discoverable=false where id in(evidence,opposite) or title like 'Neutral calibration %';
  -- This genuine accepted-weight combination flips LT sign only under the old 365-day cap.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(gen_random_uuid(),a,personal,evidence,'BOOK','ITEM_RATED',now()-interval '730 days','{"rating":10}'),
      (gen_random_uuid(),a,personal,evidence,'BOOK','ITEM_CONSUMPTION_REVERSED',now()-interval '20 days','{}');
  insert into pg_temp.native_decay_fixture values(a,b,personal,other_personal,shared,evidence,opposite,
    book,other_book,movie,other_movie);
  foreach profile in array array[personal,shared] loop
    foreach domain in array array['BOOK','MOVIE'] loop response := pg_temp.decay_page(a,profile,domain);end loop;
  end loop;
  response := pg_temp.decay_page(a,personal,'BOOK',2);
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    select id,md5('kajo:predictor-genome:prediction-v1-baseline')::uuid from pg_temp.native_decay_sources
    on conflict do nothing;
  worker := private.process_shadow_prediction_jobs_v1(250);
  perform pg_temp.decay_assert(worker->>'failed'='0','real pre-forward baseline shadow jobs succeed');
  insert into pg_temp.native_decay_frozen select 'production',r.id::text,to_jsonb(r)
    from private.prediction_runs r join pg_temp.native_decay_sources s on s.id=r.id;
  insert into pg_temp.native_decay_frozen select 'candidate',c.prediction_id||':'||c.item_id,to_jsonb(c)
    from private.prediction_candidates c join pg_temp.native_decay_sources s on s.id=c.prediction_id;
  insert into pg_temp.native_decay_frozen select 'shadow',r.id::text,to_jsonb(r)
    from private.shadow_prediction_runs r join pg_temp.native_decay_sources s on s.id=r.source_prediction_id;
  insert into pg_temp.native_decay_frozen select 'shadow_candidate',c.shadow_prediction_id||':'||c.item_id,to_jsonb(c)
    from private.shadow_prediction_candidates c join private.shadow_prediction_runs r on r.id=c.shadow_prediction_id
    join pg_temp.native_decay_sources s on s.id=r.source_prediction_id;
end;$fixture$;
