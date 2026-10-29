-- Isolated native fixture only. Caller owns BEGIN/ROLLBACK; never run on hosted data.
create temp table numeric_fixture(actor uuid,other_actor uuid,personal uuid,other_personal uuid,
  target uuid,book_candidate uuid,movie_candidate uuid) on commit drop;
create temp table numeric_captures(sequence integer generated always as identity,name text,capture jsonb,
  oracle jsonb) on commit drop;
create function pg_temp.numeric_capture(chosen_domain text,cutoff timestamptz)
returns jsonb language plpgsql stable security invoker as $$
declare f record;result jsonb;digest text;
begin
  select * into strict f from pg_temp.numeric_fixture;
  if not isfinite(cutoff) or cutoff<='epoch'::timestamptz or chosen_domain not in('BOOK','MOVIE') then
    raise exception 'Invalid numeric fixture cutoff/domain';end if;
  if auth.uid() is distinct from f.actor then raise exception 'Numeric fixture owner mismatch';end if;
  -- One statement snapshot: canonical complete resolved prefix, raw labels and
  -- explicitly declared fixture candidate pool. No Working history truncation,
  -- tag expansion, rank-score inversion or recreated receipt resolver.
  with resolved as materialized (
    select e.* from private.personal_source_evidence_v1(f.personal,cutoff) e
    where e.source_status='NATIVE_RATING' and not e.is_bootstrap
  ), labels as (
    select jsonb_build_object('itemId',r.item_id,'sourceEventId',r.source_event_id,
      'sourceStatus',r.source_status,'orderingBasis',r.ordering_basis,
      'event',jsonb_build_object('id',e.id,'actorUserId',e.actor_user_id,'profileId',e.profile_id,
        'itemId',e.item_id,'itemType',e.item_type,'eventType',e.event_type,'rating',e.properties->'rating',
        'occurredAtMicros',(extract(epoch from e.occurred_at)*1000000)::bigint::text,
        'availableAtMicros',(extract(epoch from e.created_at)*1000000)::bigint::text)) value
    from resolved r join public.events e on e.id=r.source_event_id
    where e.profile_id=f.personal and e.actor_user_id=f.actor and e.item_id=r.item_id
      and e.item_type=chosen_domain and e.event_type='ITEM_RATED'
      and jsonb_typeof(e.properties->'rating')='number' and e.properties->>'rating' ~ '^(10|[0-9])$'
      and isfinite(e.created_at) and e.created_at<=cutoff
      and isfinite(e.occurred_at) and e.occurred_at<=cutoff
  ), pool as (
    select jsonb_build_object('id',i.id,'itemType',i.item_type,'discoverable',i.discoverable,
      'availableAtMicros',(extract(epoch from i.created_at)*1000000)::bigint::text) value
    from public.items i where i.id in(f.book_candidate,f.movie_candidate)
      and i.item_type=chosen_domain and i.discoverable and isfinite(i.created_at) and i.created_at<=cutoff
  ) select jsonb_build_object('version','kajo-personal-rating-prefix-v1',
    'captureScope','ISOLATED_NATIVE_FIXTURE','complete',true,
    'profile',jsonb_build_object('id',p.id,'type',p.profile_type,'ownerUserId',p.owner_user_id),
    'actorUserId',f.actor,'itemType',chosen_domain,'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
    'source',jsonb_build_object('signature','private.personal_source_evidence_v1(uuid,timestamp with time zone)',
      'bodyMd5',(select md5(prosrc) from pg_proc where oid='private.personal_source_evidence_v1(uuid,timestamptz)'::regprocedure)),
    'labels',(select coalesce(jsonb_agg(value order by value->>'itemId'),'[]') from labels),
    'candidatePool',jsonb_build_object('kind','DECLARED_CANONICAL_ITEM_SNAPSHOT',
      'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
      'items',(select coalesce(jsonb_agg(value order by value->>'id'),'[]') from pool))) into result
    from public.profiles p where p.id=f.personal and p.profile_type='PERSONAL' and p.owner_user_id=f.actor;
  if result is null then raise exception 'Numeric fixture Profile unavailable';end if;
  digest:='native-numeric:'||md5(result::text);
  return result||jsonb_build_object('snapshotId',digest,'candidatePool',
    result->'candidatePool'||jsonb_build_object('snapshotId',digest));
end;$$;
create function pg_temp.numeric_freeze(label text,chosen_domain text default 'BOOK',chosen_cutoff timestamptz default null)
returns void language plpgsql as $$
declare captured jsonb;n integer;total double precision;begin
  captured:=pg_temp.numeric_capture(chosen_domain,coalesce(chosen_cutoff,clock_timestamp()));
  select count(*)::integer,coalesce(sum((value#>>'{event,rating}')::double precision),0)
    into n,total from jsonb_array_elements(captured->'labels');
  -- Independent numeric oracle frozen here BEFORE the next action. This is
  -- fixture arithmetic, not a second production scorer or quality experiment.
  insert into pg_temp.numeric_captures(name,capture,oracle) values(label,captured,
    jsonb_build_object('support',n,'mean',case when n>0 then total/n else null end,
      'domainPrior',7,'shrinkage',2,'shrunk',7+(total-7*n)/(n+2)));
end;$$;
create function pg_temp.numeric_action(kind text,fields jsonb,offset_seconds integer,action_id uuid default null)
returns jsonb language plpgsql as $$
declare f record;request jsonb;result jsonb;begin
  select * into strict f from pg_temp.numeric_fixture;
  request:=jsonb_build_object('version',1,'actionId',coalesce(action_id,gen_random_uuid()),
    'actorUserId',f.actor,'profileId',f.personal,'itemId',f.target,'kind',kind,
    'occurredAt',now()+offset_seconds*interval '1 second',
    'session',jsonb_build_object('sessionId','a3980000-0000-4000-8000-000000000090',
      'startedAt',now()-interval '1 day','context','{}'::jsonb))||fields;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);perform set_config('role','authenticated',true);
  if kind='CLEAR_HISTORY' then result:=public.commit_collection_action_v1(request||'{"source":"LISTS"}');
  else result:=public.commit_item_action_v1(request);end if;
  perform set_config('role','postgres',true);return result;
exception when others then perform set_config('role','postgres',true);raise;end;$$;
do $fixture$
declare a uuid:='a3980000-0000-4000-8000-000000000001';b uuid:='a3980000-0000-4000-8000-000000000002';
  personal uuid;other_personal uuid;target uuid:='a3980000-0000-4000-8000-000000000012';
  book uuid:='a3980000-0000-4000-8000-000000000020';movie uuid:='a3980000-0000-4000-8000-000000000021';
  zero_action uuid:=gen_random_uuid();receipt jsonb;ten jsonb;withdrawn jsonb;cutoff timestamptz;before_read jsonb;after_read jsonb;
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Personal numeric fixture requires empty disposable state';end if;
  insert into auth.users(id,email,raw_user_meta_data) values
    (a,'numeric-a@example.invalid','{"kajo_nickname":"Numeric A"}'),
    (b,'numeric-b@example.invalid','{"kajo_nickname":"Numeric B"}');
  select id into strict personal from public.profiles where owner_user_id=a and profile_type='PERSONAL';
  select id into strict other_personal from public.profiles where owner_user_id=b and profile_type='PERSONAL';
  insert into numeric_fixture values(a,b,personal,other_personal,target,book,movie);
  insert into public.items(id,item_type,title,tags,discoverable,created_at)
    select ('a3980000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
      case when n in(13,14,21) then 'MOVIE' else 'BOOK' end,'Numeric fixture '||n,
      array['one','two','three','four','five','six','seven','eight'],n in(20,21),now()-interval '1 day'
    from generate_series(10,31) n;
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform pg_temp.numeric_freeze('empty');
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
    select gen_random_uuid(),a,personal,('a3980000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
      case when n in(13,14) then 'MOVIE' else 'BOOK' end,'ITEM_RATED',jsonb_build_object('rating',rating),
      now()-interval '2 hours',now()-interval '1 hour'
      from (values(10,8),(11,6),(13,4),(14,8)) v(n,rating);
  perform pg_temp.numeric_freeze('base');
  receipt:=pg_temp.numeric_action('SET_RATING','{"rating":0}',-100,zero_action);
  perform pg_temp.numeric_freeze('zero');
  if pg_temp.numeric_action('SET_RATING','{"rating":0}',-100,zero_action) is distinct from receipt then
    raise exception 'Numeric fixture retry changed command receipt';end if;
  perform pg_temp.numeric_freeze('zero_retry');
  perform pg_temp.numeric_action('SET_RATING','{"rating":5}',-90);
  perform pg_temp.numeric_freeze('five');
  ten:=pg_temp.numeric_action('SET_RATING','{"rating":10}',-80);
  perform pg_temp.numeric_freeze('ten');
  perform pg_temp.numeric_action('UNDO',jsonb_build_object('reversesActionId',ten->>'actionId'),-85);
  perform pg_temp.numeric_freeze('undo_ten');
  perform pg_temp.numeric_action('CLEAR_HISTORY','{}',-70);
  perform pg_temp.numeric_freeze('clear');
  withdrawn:=pg_temp.numeric_action('SET_RATING','{"rating":0}',-60);
  perform pg_temp.numeric_freeze('before_withdrawal');
  delete from public.events where id=(withdrawn->>'actionId')::uuid;
  perform pg_temp.numeric_freeze('withdrawal');
  perform pg_temp.numeric_freeze('movie','MOVIE');
  -- Foreign/future/malformed/ambiguous labels must not become numeric support.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
    values(gen_random_uuid(),b,personal,'a3980000-0000-4000-8000-000000000015','BOOK','ITEM_RATED','{"rating":10}',now(),now()),
      (gen_random_uuid(),b,other_personal,'a3980000-0000-4000-8000-000000000016','BOOK','ITEM_RATED','{"rating":10}',now(),now()),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000017','BOOK','ITEM_RATED','{"rating":10}',now()+interval '1 day',now()),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000018','BOOK','ITEM_RATED','{"rating":10}',now(),now()+interval '1 day'),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000019','BOOK','ITEM_RATED','{"rating":"invalid"}',now(),now()),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000022','BOOK','ITEM_RATED','{"rating":0}',now(),now()),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000022','BOOK','ITEM_RATED','{"rating":10}',now(),now()),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000023','BOOK','ITEM_SAVED','{}',now(),now()),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000024','BOOK','ITEM_NOT_INTERESTED','{}',now(),now());
  perform pg_temp.numeric_freeze('excluded');
  cutoff:=date_trunc('second',clock_timestamp()+interval '2 seconds')+interval '0.123456 second';
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
    values(gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000025','BOOK','ITEM_RATED','{"rating":0}',cutoff,cutoff),
      (gen_random_uuid(),a,personal,'a3980000-0000-4000-8000-000000000026','BOOK','ITEM_RATED','{"rating":10}',cutoff,cutoff+interval '0.000001 second');
  perform pg_temp.numeric_freeze('microsecond_exact','BOOK',cutoff);
  perform pg_temp.numeric_freeze('microsecond_later','BOOK',cutoff+interval '0.000001 second');
  -- Repeated reads are pure and source tags do not multiply support.
  select jsonb_agg(to_jsonb(e) order by id) into before_read from public.events e;
  perform pg_temp.numeric_freeze('microsecond_repeat','BOOK',cutoff);
  select jsonb_agg(to_jsonb(e) order by id) into after_read from public.events e;
  if before_read is distinct from after_read then raise exception 'Numeric capture mutated original Events';end if;
end;$fixture$;
select jsonb_build_object('version','native-personal-rating-baseline-fixture-v1','cases',
  (select jsonb_agg(jsonb_build_object('name',name,'capture',capture,'oracle',oracle) order by sequence) from numeric_captures),
  'frozenInputs','CAPTURED_BEFORE_NEXT_ACTION','scope','ISOLATED_NATIVE_FIXTURE') snapshot;
