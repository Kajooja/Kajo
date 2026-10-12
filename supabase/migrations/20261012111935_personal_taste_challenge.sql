-- Own-Personal challenge freezes canonical forecasts before accepting answers.
-- Evaluation only: no challenge answer becomes an Event or bootstrap input here.
create table private.taste_challenges (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references private.taste_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  prediction_id uuid references private.prediction_runs(id) on delete set null,
  status text not null check(status in('ACTIVE','COMPLETE','UNAVAILABLE','REMOVED')),
  revision integer not null default 0 check(revision between 0 and 6),
  frozen jsonb not null check(jsonb_typeof(frozen)='object'),
  items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=6),
  answers jsonb not null default '[]' check(jsonb_typeof(answers)='array' and jsonb_array_length(answers)<=6),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(isfinite(created_at) and isfinite(updated_at) and updated_at>=created_at)
);
create index taste_challenges_profile_idx on private.taste_challenges(profile_id);
create index taste_challenges_actor_idx on private.taste_challenges(actor_user_id);
create index taste_challenges_prediction_idx on private.taste_challenges(prediction_id);
create table private.taste_challenge_commands (
  challenge_id uuid not null references private.taste_challenges(id) on delete cascade,
  request_id uuid not null,
  command jsonb not null,
  result jsonb not null,
  primary key(challenge_id,request_id)
);
alter table private.taste_challenges enable row level security;
alter table private.taste_challenge_commands enable row level security;
revoke all on private.taste_challenges,private.taste_challenge_commands from public,anon,authenticated,service_role;

-- A source erasure cannot leave a detached forecast/answer/receipt copy. A
-- terminal row prevents a new START from resampling with already-seen answers.
create function private.guard_taste_challenge_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
  if (old.prediction_id is not null and new.prediction_id is null) or new.status='REMOVED' then
    new.status:='REMOVED';new.frozen:='{}';new.items:='[]';new.answers:='[]';
    delete from private.taste_challenge_commands where challenge_id=old.id;
  elsif old.status='REMOVED' or new.frozen<>old.frozen or new.items<>old.items
    or new.prediction_id is distinct from old.prediction_id or new.session_id<>old.session_id
    or new.actor_user_id<>old.actor_user_id or new.profile_id<>old.profile_id or new.created_at<>old.created_at then
    raise exception 'Taste challenge forecast is immutable' using errcode='55000';
  end if;
  return new;
end;$$;
revoke all on function private.guard_taste_challenge_v1() from public,anon,authenticated,service_role;
create trigger guard_taste_challenge_v1 before update on private.taste_challenges
for each row execute function private.guard_taste_challenge_v1();

create function private.withdraw_taste_challenge_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
  update private.taste_challenges set status='REMOVED',updated_at=greatest(updated_at,clock_timestamp())
    where session_id=new.id and status<>'REMOVED';
  return new;
end;$$;
revoke all on function private.withdraw_taste_challenge_v1() from public,anon,authenticated,service_role;
create trigger withdraw_taste_challenge_v1 after update of status on private.taste_sessions
for each row when(new.status='REMOVED') execute function private.withdraw_taste_challenge_v1();

-- Descriptive same-domain ordinal agreement; pairs sharing Items are dependent.
-- Scores are never mapped to 0..10 ratings, probabilities or confidence intervals.
create function private.taste_challenge_metric_v1(items jsonb,answers jsonb)
returns jsonb language sql immutable set search_path='' as $$
  with rated as (
    select i,(a->'answer'->>'value')::integer rating from jsonb_array_elements(items) i
    join lateral (select a from jsonb_array_elements(answers) a where a->>'itemId'=i->>'id'
      and a#>>'{answer,kind}'='RATING') actual on true
  ), pairs as (
    select a.i left_item,b.i right_item,a.rating left_rating,b.rating right_rating,
      case when a.i#>>'{forecast,status}'='AVAILABLE' and b.i#>>'{forecast,status}'='AVAILABLE'
        then (a.i#>>'{forecast,score}')::double precision-(b.i#>>'{forecast,score}')::double precision end delta
    from rated a join rated b on a.i->>'id'<b.i->>'id' and a.i->>'itemType'=b.i->>'itemType'
  ) select jsonb_build_object('version','taste-ordinal-agreement-v1','target','SAME_DOMAIN_RATING_ORDER',
    'reservedItems',jsonb_array_length(items),'answeredItems',jsonb_array_length(answers),
    'knownRatings',(select count(*) from rated),
    'unknown',(select count(*) from jsonb_array_elements(answers) a where a#>>'{answer,kind}'='UNKNOWN'),
    'notInterested',(select count(*) from jsonb_array_elements(answers) a where a#>>'{answer,kind}'='NOT_INTERESTED'),
    'ratedPairs',count(*),'missingForecastPairs',count(*) filter(where delta is null),
    'ratingTiePairs',count(*) filter(where delta is not null and left_rating=right_rating),
    'forecastTiePairs',count(*) filter(where delta is not null and left_rating<>right_rating and abs(delta)<=1e-9),
    'comparablePairs',count(*) filter(where left_rating<>right_rating and abs(delta)>1e-9),
    'concordantPairs',count(*) filter(where abs(delta)>1e-9 and sign(delta)=sign(left_rating-right_rating)),
    'discordantPairs',count(*) filter(where abs(delta)>1e-9 and sign(delta)=-sign(left_rating-right_rating)),
    'availability',case when count(*) filter(where left_rating<>right_rating and abs(delta)>1e-9)>0
      then 'DESCRIPTIVE_ONLY' else 'INSUFFICIENT_COMPARABLE_PAIRS' end,
    'scoreTieTolerance',1e-9,'uncertainty','UNAVAILABLE_SMALL_DEPENDENT_SAMPLE',
    'accuracyPercent',null,'ratingError',null,'qualityAdmitted',false) from pairs;
$$;
revoke all on function private.taste_challenge_metric_v1(jsonb,jsonb) from public,anon,authenticated,service_role;

create function private.taste_challenge_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  actor uuid; profile uuid; operation text; command_id uuid; keys text[];
  s private.taste_sessions; c private.taste_challenges; saved private.taste_challenge_commands;
  reserved jsonb; outputs jsonb; run private.prediction_runs; source_id uuid;
  at_time timestamptz; answer jsonb; chosen jsonb; result jsonb; visible_items jsonb;
begin
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>4096 then
    raise exception 'Invalid challenge request' using errcode='22023';end if;
  operation:=request->>'operation';
  if operation is null or operation not in('START','RESUME','ANSWER','REMOVE') then
    raise exception 'Invalid challenge operation' using errcode='22023';end if;
  keys:=case operation when 'START' then array['operation','profileId','sessionId','requestId']
    when 'RESUME' then array['operation','profileId','sessionId','challengeId']
    when 'ANSWER' then array['operation','profileId','sessionId','challengeId','requestId','expectedRevision','itemId','answer']
    else array['operation','profileId','sessionId','challengeId','requestId','expectedRevision'] end;
  if (select array_agg(k order by k) from jsonb_object_keys(request) k) is distinct from (select array_agg(k order by k) from unnest(keys) k)
    or jsonb_typeof(request->'profileId')<>'string' or jsonb_typeof(request->'sessionId')<>'string' then
    raise exception 'Invalid challenge fields' using errcode='22023';end if;
  -- Participate in the canonical lifecycle gate BEFORE taking Profile locks.
  perform pg_advisory_xact_lock_shared(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Challenge requires READ COMMITTED' using errcode='25001';end if;
  profile:=(request->>'profileId')::uuid;
  actor:=private.assert_personal_profile_owner_v1(profile);
  perform 1 from public.profiles where id=profile for update;
  actor:=private.assert_personal_profile_owner_v1(profile);
  if exists(select 1 from auth.users a where a.id=actor and to_jsonb(a)->>'is_anonymous'='true') then
    raise exception 'Anonymous challenge entry is not available' using errcode='42501';end if;
  select * into s from private.taste_sessions where profile_id=profile for update;
  if s.id is null or s.id is distinct from (request->>'sessionId')::uuid or s.actor_user_id<>actor then
    raise exception 'Taste session unavailable' using errcode='42501';end if;
  select * into c from private.taste_challenges where session_id=s.id for update;
  if c.id is not null and c.actor_user_id<>actor then raise exception 'Challenge owner access required' using errcode='42501';end if;
  if operation<>'START' and (c.id is null or jsonb_typeof(request->'challengeId')<>'string'
    or c.id is distinct from (request->>'challengeId')::uuid) then
    raise exception 'Challenge unavailable' using errcode='42501';end if;
  if operation<>'RESUME' then
    if jsonb_typeof(request->'requestId')<>'string' then raise exception 'Invalid challenge request identity' using errcode='22023';end if;
    command_id:=(request->>'requestId')::uuid;
  end if;
  at_time:=date_trunc('milliseconds',clock_timestamp());
  if s.status='REMOVED' or c.status='REMOVED' then
    return jsonb_build_object('version','personal-taste-challenge-v1','sessionId',s.id,'challengeId',c.id,'status','REMOVED');
  end if;
  if c.id is null then
    if s.status<>'STOPPED' then raise exception 'Finish Taste before challenge' using errcode='22023';end if;
    -- Reserve BEFORE scoring. Do not cherry-pick predicted successes. Even old,
    -- inactive or unavailable same-Item evidence excludes an Item conservatively.
    with eligible as (
      select item,row_number() over(partition by item->>'itemType' order by
        (item->>'recognitionPrior')::double precision desc nulls last,item->>'id' collate "C") n
      from jsonb_array_elements(s.catalog) item where
        not exists(select 1 from jsonb_array_elements(s.presentations) p where p->>'objectId'=item->>'id')
        and not exists(select 1 from public.events e where e.profile_id=profile and e.item_id=(item->>'id')::uuid)
        and not exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=(item->>'id')::uuid)
        and exists(select 1 from public.items i where i.id=(item->>'id')::uuid and i.discoverable
          and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))
    ) select coalesce(jsonb_agg(jsonb_build_object('id',item->'id','itemType',item->'itemType','title',item->'title')
      order by item->>'id' collate "C"),'[]') into reserved from eligible where n<=3;
    source_id:=gen_random_uuid();
    -- One canonical cross-domain run freezes state, model and the complete pool.
    -- Missing reserved candidates stay missing; never force them into the scorer.
    select coalesce(jsonb_agg(to_jsonb(r)),'[]') into outputs from private.rank_items_with_identity_v1(
      source_id,profile,'FOR_YOU',null,50,jsonb_build_object('sessionId',s.id)) r;
    select * into strict run from private.prediction_runs where id=source_id;
    -- Legacy writers need not take the Profile lock. Any newly visible label
    -- aborts the whole reservation/run instead of admitting a contaminated Item.
    if exists(select 1 from jsonb_array_elements(reserved) i where
      exists(select 1 from public.events e where e.profile_id=profile and e.item_id=(i->>'id')::uuid)
      or exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=(i->>'id')::uuid)) then
      raise exception 'Challenge holdout changed during freeze' using errcode='40001';end if;
    select coalesce(jsonb_agg(i||jsonb_build_object('forecast',case when r is not null then
      jsonb_build_object('status','AVAILABLE','score',r->'score','rank',r->'rank') else
      jsonb_build_object('status','UNAVAILABLE','reason','OUTSIDE_CANONICAL_DELIVERABLE_POOL') end) order by i->>'id' collate "C"),'[]')
      into reserved from jsonb_array_elements(reserved) i left join lateral
        (select r from jsonb_array_elements(outputs) r where r->>'item_id'=i->>'id') predicted on true;
    at_time:=date_trunc('milliseconds',clock_timestamp());
    insert into private.taste_challenges(session_id,profile_id,actor_user_id,prediction_id,status,frozen,items,created_at,updated_at)
    values(s.id,profile,actor,source_id,case when jsonb_array_length(reserved)>0 then 'ACTIVE' else 'UNAVAILABLE' end,
      jsonb_build_object('version','personal-taste-challenge-v1','holdoutPolicy','taste-unseen-recognition-3-per-domain-v1',
        'metricVersion','taste-ordinal-agreement-v1','tasteRevision',s.revision,'tastePolicyVersion',s.policy_version,
        'frozenAt',floor(extract(epoch from at_time)*1000)::bigint,'predictionId',source_id,
        'predictionAsOf',run.requested_at,'modelVersion',run.model_version,'baseModelVersion',run.base_model_version,
        'policyVersion',run.policy_version,'genomeId',run.genome_id,
        'stateDigest',encode(sha256(convert_to(run.state_snapshot::text,'UTF8')),'hex'),
        'traceDigest',encode(sha256(convert_to(jsonb_build_object('run',to_jsonb(run),
          'candidates',(select coalesce(jsonb_agg(to_jsonb(p) order by p.item_id),'[]')
            from private.prediction_candidates p where p.prediction_id=source_id),
          'genomeConfig',(select config from private.predictor_genomes where id=run.genome_id),
          'holdouts',reserved)::text,'UTF8')),'hex')),
      reserved,at_time,at_time) returning * into c;
  end if;
  at_time:=greatest(at_time,c.updated_at+interval '1 millisecond');
  if operation='REMOVE' then
    if jsonb_typeof(request->'expectedRevision')<>'number' or request->>'expectedRevision' !~ '^[0-6]$'
      or (request->>'expectedRevision')::integer<>c.revision then raise exception 'Challenge revision conflict' using errcode='40001';end if;
    update private.taste_challenges set status='REMOVED',updated_at=at_time where id=c.id;
    return jsonb_build_object('version','personal-taste-challenge-v1','sessionId',s.id,'challengeId',c.id,'status','REMOVED');
  end if;
  -- Live withdrawal wins over frozen request replay. REMOVE is always available.
  if exists(select 1 from jsonb_array_elements(c.items) item where not exists(
    select 1 from public.items i where i.id=(item->>'id')::uuid and i.discoverable
      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then
    return jsonb_build_object('version','personal-taste-challenge-v1','sessionId',s.id,'challengeId',c.id,
      'revision',c.revision,'status','CATALOG_UNAVAILABLE','reason','HOLDOUT_WITHDRAWN');
  end if;
  if operation<>'RESUME' then
    select * into saved from private.taste_challenge_commands where challenge_id=c.id and request_id=command_id;
    if saved.request_id is not null then
      if saved.command<>request then raise exception 'Challenge request identity conflict' using errcode='22023';end if;
      return saved.result;
    end if;
  end if;
  if operation='ANSWER' then
    if jsonb_typeof(request->'expectedRevision')<>'number' or request->>'expectedRevision' !~ '^[0-6]$'
      or (request->>'expectedRevision')::integer<>c.revision then raise exception 'Challenge revision conflict' using errcode='40001';end if;
    if c.status<>'ACTIVE' then raise exception 'Challenge is closed' using errcode='22023';end if;
    answer:=request->'answer';
    select i into chosen from jsonb_array_elements(c.items) i where i->'id'=request->'itemId';
    if chosen is null or jsonb_typeof(answer)<>'object' or answer->>'kind' is null
      or answer->>'kind' not in('RATING','UNKNOWN','NOT_INTERESTED')
      or (select count(*) from jsonb_object_keys(answer))<>(case when answer->>'kind'='RATING' then 2 else 1 end)
      or exists(select 1 from jsonb_array_elements(c.answers) a where a->'itemId'=request->'itemId') then
      raise exception 'Invalid or already accepted challenge answer' using errcode='22023';end if;
    if answer->>'kind'='RATING' and (jsonb_typeof(answer->'value') is distinct from 'number'
      or coalesce(answer->>'value','') !~ '^([0-9]|10)$') then raise exception 'Invalid challenge rating' using errcode='22023';end if;
    c.answers:=c.answers||jsonb_build_array(jsonb_build_object('itemId',request->'itemId','answer',answer,
      'receivedAt',floor(extract(epoch from at_time)*1000)::bigint));
    c.revision:=c.revision+1;
    c.status:=case when jsonb_array_length(c.answers)=jsonb_array_length(c.items) then 'COMPLETE' else 'ACTIVE' end;
    update private.taste_challenges set answers=c.answers,revision=c.revision,status=c.status,updated_at=at_time where id=c.id;
  end if;
  -- Withhold forecast order/score and partial metric until all answers are locked.
  select coalesce(jsonb_agg(i-'forecast' order by i->>'id' collate "C"),'[]') into visible_items from jsonb_array_elements(c.items) i;
  result:=jsonb_build_object('version','personal-taste-challenge-v1','profileId',profile,'sessionId',s.id,'challengeId',c.id,
    'revision',c.revision,'status',c.status,'frozen',c.frozen,'items',visible_items,'answers',c.answers,
    'forecasts',case when c.status='COMPLETE' then c.items else null end,
    'metric',case when c.status in('COMPLETE','UNAVAILABLE') then private.taste_challenge_metric_v1(c.items,c.answers) else null end,
    'reason',case when c.status='UNAVAILABLE' then 'NO_UNSEEN_HOLDOUTS' else null end,
    'learningAdmission','EVALUATION_ONLY','anonymousEntry',false);
  if operation='ANSWER' or (operation='START' and not exists(select 1 from private.taste_challenge_commands where challenge_id=c.id)) then
    insert into private.taste_challenge_commands(challenge_id,request_id,command,result) values(c.id,command_id,request,result);
  end if;
  return result;
end;$$;
revoke all on function private.taste_challenge_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.taste_challenge_v1(jsonb) to authenticated;
create function public.taste_challenge_v1(request jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.taste_challenge_v1(request);$$;
revoke all on function public.taste_challenge_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.taste_challenge_v1(jsonb) to authenticated;
