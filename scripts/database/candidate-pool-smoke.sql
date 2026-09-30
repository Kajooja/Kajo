-- Caller has installed candidate-pool-fixture.sql and owns BEGIN/ROLLBACK.
create temp table pool_runs(id uuid primary key,page_size integer,expected_count integer) on commit drop;
do $pool$
declare
  actor uuid := 'a22a0000-0000-4000-8000-000000000001';
  outsider uuid := 'a22a0000-0000-4000-8000-000000000003';
  baseline uuid := md5('kajo:predictor-genome:prediction-v1-baseline')::uuid;
  profile record; domain text; mode text; page_size integer; ranked record;
  run_id uuid; delivered integer; result jsonb; frozen jsonb; event_count integer; before_runs integer;
begin
  for profile in select * from pg_temp.pool_profiles loop
    foreach domain in array array['BOOK','MOVIE'] loop
      foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
        foreach page_size in array array[6,20,50] loop
          delivered := 0; run_id := null;
          perform set_config('role','authenticated',true);
          for ranked in select * from public.rank_items_v1(profile.profile_id,mode,domain,page_size,'{}') loop
            delivered := delivered+1; run_id := ranked.prediction_id;
            if ranked.item_type<>domain then raise exception 'ItemType escaped candidate scope'; end if;
            if ranked.explanation#>>'{candidatePool,version}' is distinct from 'eligibility-first-v1'
              or (ranked.explanation#>>'{candidatePool,consideredCount}')::integer<>98
              or (ranked.explanation#>>'{candidatePool,ordinaryCount}')::integer<>24
              or (ranked.explanation#>>'{candidatePool,suppressedCount}')::integer<>72
              or (ranked.explanation#>>'{candidatePool,retainedCount}')::integer<>50 then
              raise exception 'Incomplete admission provenance: %',ranked.explanation->'candidatePool';
            end if;
          end loop;
          perform set_config('role','postgres',true);
          if delivered<>least(page_size,25) or run_id is null then
            raise exception '% % % limit % returned %, expected % despite 24 ordinary cards',
              profile.profile_type,domain,mode,page_size,delivered,least(page_size,25);
          end if;
          insert into pg_temp.pool_runs values(run_id,page_size,delivered);
        end loop;
      end loop;
    end loop;
    -- The generic mixed-domain path has 48 ordinary Items plus one reminder.
    perform set_config('role','authenticated',true);
    select count(*),min(prediction_id::text)::uuid into delivered,run_id
      from public.rank_items_v1(profile.profile_id,'FOR_YOU',null,50,'{}');
    perform set_config('role','postgres',true);
    if delivered<>49 then raise exception 'Mixed-domain candidate admission lost available Items'; end if;
    insert into pg_temp.pool_runs values(run_id,50,49);
  end loop;
  if (select count(*) from pg_temp.pool_runs)<>38 then raise exception 'Incomplete pool matrix'; end if;
  if exists(select 1 from private.prediction_runs r join pg_temp.pool_runs p on p.id=r.id
    where r.result_count<>p.expected_count or r.candidate_count>least(50,p.page_size*3)) then
    raise exception 'Refill changed the retained trace budget or result count';
  end if;
  if not exists(select 1 from private.prediction_candidates c join pg_temp.pool_runs p on p.id=c.prediction_id
    where c.selected_for_delivery and (c.explanation#>>'{candidatePool,baselineScoreRank}')::integer>50) then
    raise exception 'Fixture did not exercise alternatives below the old top-50';
  end if;
  if exists(select 1 from private.prediction_candidates c join pg_temp.pool_runs p on p.id=c.prediction_id
    join pg_temp.pool_items i on i.item_id=c.item_id where c.selected_for_delivery and i.kind not in ('ORDINARY','REMINDER')) then
    raise exception 'Consumed or recently saved Item was delivered';
  end if;
  if exists(select c.prediction_id from private.prediction_candidates c join pg_temp.pool_runs p on p.id=c.prediction_id
    where c.selected_for_delivery and c.explanation#>>'{resurfacingPolicy,classification}'='SAVED_REMINDER'
    group by c.prediction_id having count(*)>1) then raise exception 'Admission exceeded the reminder cap'; end if;
  select jsonb_agg(to_jsonb(c) order by c.prediction_id,c.item_id) into frozen
    from private.prediction_candidates c join pg_temp.pool_runs p on p.id=c.prediction_id;
  select count(*) into event_count from public.events;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id) select id,baseline from pg_temp.pool_runs;

  -- Every candidate is now terminal. A real empty result is a complete trace;
  -- its frozen comparison has zero selected Items rather than a failed job.
  for profile in select * from pg_temp.pool_profiles loop
    insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating)
      select profile.profile_id,item_id,actor,true,8 from pg_temp.pool_items where kind='ORDINARY';
    update public.item_interactions set consumed=true where profile_id=profile.profile_id;
    foreach domain in array array['BOOK','MOVIE'] loop
      perform set_config('role','authenticated',true);
      select count(*) into delivered from public.rank_items_v1(profile.profile_id,'RISK',domain,20,'{}');
      perform set_config('role','postgres',true);
      if delivered<>0 then raise exception 'Exhausted eligible set produced a fake card'; end if;
      select id into strict run_id from private.prediction_runs where profile_id=profile.profile_id
        order by requested_at desc,id desc limit 1;
      if (select candidate_count from private.prediction_runs where id=run_id)<>50 then
        raise exception 'All-suppressed trace lost its bounded considered candidates';
      end if;
      insert into pg_temp.pool_runs values(run_id,20,0);
      insert into private.shadow_prediction_jobs(source_prediction_id,genome_id) values(run_id,baseline);
    end loop;
  end loop;
  update public.items set discoverable=false;
  for profile in select * from pg_temp.pool_profiles loop
    foreach domain in array array['BOOK','MOVIE'] loop
      perform set_config('role','authenticated',true);
      select count(*) into delivered from public.rank_items_v1(profile.profile_id,'SURPRISE',domain,20,'{}');
      perform set_config('role','postgres',true);
      select id into strict run_id from private.prediction_runs where profile_id=profile.profile_id
        order by requested_at desc,id desc limit 1;
      if delivered<>0 or (select candidate_count from private.prediction_runs where id=run_id)<>0 then
        raise exception 'Empty catalog returned candidates';
      end if;
      insert into pg_temp.pool_runs values(run_id,20,0);
      -- Auto-queue intentionally omits an empty pool; the worker still accepts an
      -- explicit baseline control for that complete, versioned source.
      insert into private.shadow_prediction_jobs(source_prediction_id,genome_id) values(run_id,baseline);
    end loop;
  end loop;
  result := private.process_shadow_prediction_jobs_v1(250);
  if (result->>'failed')::integer<>0 then raise exception 'Refilled/empty shadow failed: %',result; end if;
  if (select count(*) from private.shadow_prediction_runs r join pg_temp.pool_runs p on p.id=r.source_prediction_id
    where r.genome_id=baseline)<>46 then raise exception 'Missing baseline control including empty pools'; end if;
  if exists(select 1 from private.shadow_prediction_runs r join pg_temp.pool_runs p on p.id=r.source_prediction_id
    where r.hypothetical_result_count<>p.expected_count) then raise exception 'Incorrect hypothetical result count'; end if;
  if exists(select 1 from private.shadow_prediction_runs r join pg_temp.pool_runs p on p.id=r.source_prediction_id
    join private.shadow_prediction_candidates s on s.shadow_prediction_id=r.id
    join private.prediction_candidates c on c.prediction_id=r.source_prediction_id and c.item_id=s.item_id
    where r.genome_id=baseline and (s.shadow_score<>c.final_score or s.shadow_rank<>c.final_rank
      or s.hypothetical_selected<>c.selected_for_delivery)) then
    raise exception 'Baseline replay lost score/rank/selection parity after admission or later-state changes';
  end if;
  if exists(select 1 from jsonb_array_elements(frozen) old join private.prediction_candidates c
    on c.prediction_id=(old->>'prediction_id')::uuid and c.item_id=(old->>'item_id')::uuid where to_jsonb(c)<>old)
    or (select count(*) from public.events)<>event_count then
    raise exception 'Admission/replay rewrote historical evidence or created synthetic Events';
  end if;
  -- The new pre-cutoff lookup retains membership/auth checks.
  select count(*) into before_runs from private.prediction_runs;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.rank_items_v1('a22a0000-0000-4000-8000-000000000004','FOR_YOU','BOOK',20,'{}');
    raise exception 'Outsider ranked Shared Profile';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.rank_items_v1('a22a0000-0000-4000-8000-000000000004','FOR_YOU','BOOK',20,'{}');
    raise exception 'Missing actor ranked Shared Profile';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  if (select count(*) from private.prediction_runs)<>before_runs then raise exception 'Denied call wrote a trace'; end if;
end;
$pool$;
select jsonb_build_object('candidatePool',
  'PASS: 36 mode/domain/Profile/limit controls, mixed pools, beyond-top-50 availability, bounded traces, reminders, empty/exhausted replay and authorization') as snapshot;
