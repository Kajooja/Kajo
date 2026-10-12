do $matrix$
declare
  f record;state jsonb;ranked record;catalog record;expected double precision;age double precision;
  baseline uuid := md5('kajo:predictor-genome:prediction-v1-baseline')::uuid;
  event_id uuid;negative_id uuid;page record;response jsonb;source uuid;domain text;mode text;
  role_name text;worker jsonb;profile uuid;shared_before jsonb;personal_before jsonb;
  native_session uuid := gen_random_uuid();
begin
  select * into strict f from pg_temp.native_decay_fixture;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  -- A numeric oracle independent of the helper/source implementation. The 365
  -- boundary must remain smooth; the old clamp retained too much old evidence.
  foreach age in array array[0.0,364.0,365.0,366.0,730.0,10000.0,1000000.0] loop
    expected := case when age>100000 then 0.0 else exp(-age/180.0) end;
    perform pg_temp.decay_assert(abs(private.native_long_term_decay_v2(now(),now()-age*interval '1 day')-expected)<1e-14,
      'native elapsed decay boundary '||age);
  end loop;
  perform pg_temp.decay_assert(private.native_long_term_decay_v2(now(),now()+interval '1 day')=1.0,
    'future timestamp math has bounded zero elapsed age (selection independently rejects future Events)');
  perform pg_temp.decay_assert(private.native_long_term_decay_v2(null,now()) is null
    and private.native_long_term_decay_v2(now(),null) is null,'helper strict null semantics');
  begin perform private.native_long_term_decay_v2('infinity',now());
    raise exception 'Nonfinite decay instant accepted';exception when invalid_parameter_value then null;end;
  begin perform private.native_long_term_decay_v2(now(),'-infinity');
    raise exception 'Nonfinite evidence instant accepted';exception when invalid_parameter_value then null;end;
  perform pg_temp.decay_assert(private.bootstrap_decay_v1(now(),now()-interval '100 years')=0.2,
    'imported bootstrap retains its separate 20 percent floor');

  expected := 6.0*exp(-730.0/180.0)-0.5*exp(-20.0/180.0);
  state := private.build_profile_memory_state_v1(f.personal,now());
  perform pg_temp.decay_assert(state->>'nativeDecayVersion'='native-long-term-decay-v2'
    and (state->>'nativeEvidenceAsOf')::timestamptz=now()
    and state->>'nativeEvidenceCount'='2' and state->>'bootstrapEvidenceCount'='0'
    and state->'longTermNegativeTags' @> '["decay-warm"]'::jsonb,'new state keeps truthful negative native taste/counts');
  foreach domain in array array['BOOK','MOVIE'] loop
    foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
      select * into strict ranked from private.rank_items_v0(f.personal,mode,domain,50,'{}')
        where item_id=case when domain='BOOK' then f.book else f.movie end;
      select * into strict catalog from private.rank_items_catalog_base_v1('{}',false,f.personal,mode,domain,50,'{}')
        where item_id=ranked.item_id;
      perform pg_temp.decay_assert(abs((ranked.explanation->>'longTerm')::double precision-expected)<0.000051
        and ranked.explanation->>'nativeDecayVersion'='native-long-term-decay-v2'
        and (ranked.explanation->>'nativeEvidenceAsOf')::timestamptz=now()
        and ranked.explanation->>'version'='prediction-v0.5-native-decay'
        and ranked.score=catalog.score and ranked.confidence=catalog.confidence
        and ranked.explanation->'longTerm'=catalog.explanation->'longTerm'
        and ranked.explanation->'shortTerm'='0'::jsonb,'Personal same native kernel in V0/catalogue '||domain||'/'||mode);
    end loop;
    response := pg_temp.decay_page(f.actor,f.personal,domain);
    source := (response->>'predictionId')::uuid;
    perform pg_temp.decay_assert((select state_snapshot->>'nativeEvidenceCount'='2'
      and state_snapshot->>'nativeDecayVersion'='native-long-term-decay-v2'
      from private.prediction_runs where id=source), 'new serving freezes the corrected nonzero native state');
    perform pg_temp.decay_assert((select count(*)=1 from private.prediction_candidates where prediction_id=source
      and item_id=case when domain='BOOK' then f.book else f.movie end)
      and not exists(select 1 from private.prediction_candidates where prediction_id=source
      and item_id=case when domain='BOOK' then f.book else f.movie end
      and abs((explanation#>>'{scoringFeatures,longTerm}')::double precision-expected)>1e-12),
      'new actual serving freezes corrected full-precision native features');
  end loop;
  state := private.build_profile_memory_state_v1(f.personal,now()-interval '365 days');
  perform pg_temp.decay_assert(state->>'nativeEvidenceCount'='1'
    and state->'longTermPositiveTags' @> '["decay-warm"]'::jsonb
    and (state->>'nativeEvidenceAsOf')::timestamptz=now()-interval '365 days',
    'memory selects and declares its explicit prior clock rather than borrowing the live base clock');
  -- Age boundaries are also exercised through actual selected Events/base
  -- scoring, not just by invoking the same helper twice.
  delete from public.events where profile_id=f.personal;
  foreach age in array array[0.0,364.0,365.0,366.0,730.0,10000.0] loop
    delete from public.events where profile_id=f.personal;
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
      values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()-age*interval '1 day','{"rating":10}');
    state := private.build_profile_memory_state_v1(f.personal,now());
    expected := 6.0*exp(-age/180.0);
    foreach domain in array array['BOOK','MOVIE'] loop
      select * into strict ranked from private.rank_items_scalar_v1(f.personal,'FOR_YOU',domain,50,'{}',baseline)
        where item_id=case when domain='BOOK' then f.book else f.movie end;
      select * into strict catalog from private.rank_items_catalog_scalar_v1('{}',false,f.personal,'FOR_YOU',domain,50,'{}',baseline)
        where item_id=ranked.item_id;
      perform pg_temp.decay_assert(state->>'nativeEvidenceCount'='1'
        and state->'longTermPositiveTags' @> '["decay-warm"]'::jsonb
        and abs((ranked.explanation#>>'{scoringFeatures,longTerm}')::double precision-expected)<1e-12
        and ranked.score=catalog.score and ranked.confidence=0.125,'actual native evidence boundary '||age||'/'||domain);
    end loop;
  end loop;

  -- A single contrary current session is ShortTerm evidence, not destruction
  -- of the durable taste. Refresh preserves the same unequal scalar scores.
  delete from public.events where profile_id=f.personal;
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
    values(native_session,f.actor,f.personal,now(),'{}');
  event_id := gen_random_uuid();negative_id := gen_random_uuid();
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties,session_id)
    values(event_id,f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()-interval '180 days','{"rating":10}',null),
      (negative_id,f.actor,f.personal,f.evidence,'BOOK','ITEM_CONSUMPTION_REVERSED',now(),'{}',native_session);
  state := private.build_profile_memory_state_v1(f.personal,now());
  perform pg_temp.decay_assert(state->'longTermPositiveTags' @> '["decay-warm"]'::jsonb
    and state->'shortTermNegativeTags' @> '["decay-warm"]'::jsonb,'one session does not erase durable native taste');
  select jsonb_agg(jsonb_build_array(item_id,score) order by item_id) into personal_before
    from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}');
  perform pg_temp.decay_assert(personal_before=(select jsonb_agg(jsonb_build_array(item_id,score) order by item_id)
    from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}')),'refresh without evidence preserves scores');
  -- Undo/correction preserves existing source selection, including real zero.
  insert into public.events(id,actor_user_id,profile_id,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,'ITEM_INTERACTION_UNDONE',now(),jsonb_build_object('reversedEventId',negative_id));
  state := private.build_profile_memory_state_v1(f.personal,now());
  perform pg_temp.decay_assert(state->>'nativeEvidenceCount'='1' and state->'shortTermNegativeTags'='[]'::jsonb,
    'undo removes the selected negative response without resetting durable evidence');
  negative_id := gen_random_uuid();
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(negative_id,f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now(),' {"rating":0}');
  state := private.build_profile_memory_state_v1(f.personal,now());
  perform pg_temp.decay_assert(state->>'nativeEvidenceCount'='2' and state->'longTermNegativeTags' @> '["decay-warm"]'::jsonb,
    'zero is valid native negative evidence');
  insert into public.events(id,actor_user_id,profile_id,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,'ITEM_INTERACTION_UNDONE',now(),jsonb_build_object('reversedEventId',negative_id));
  state := private.build_profile_memory_state_v1(f.personal,now());
  perform pg_temp.decay_assert(state->>'nativeEvidenceCount'='1' and state->'longTermPositiveTags' @> '["decay-warm"]'::jsonb,
    'undo of correction restores prior native taste');
  -- Future raw evidence and a future undo must be outside the same live input
  -- boundary in memory, V0 and the protocol3 clone.
  select * into strict ranked from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  expected := (ranked.explanation->>'longTerm')::double precision;
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()+interval '1 day','{"rating":0}');
  insert into public.events(id,actor_user_id,profile_id,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,'ITEM_INTERACTION_UNDONE',now()+interval '1 day',jsonb_build_object('reversedEventId',event_id));
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED','-infinity','{"rating":10}');
  insert into public.events(id,actor_user_id,profile_id,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,'ITEM_INTERACTION_UNDONE','-infinity',jsonb_build_object('reversedEventId',event_id));
  state := private.build_profile_memory_state_v1(f.personal,now());
  select * into strict ranked from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  select * into strict catalog from private.rank_items_catalog_base_v1('{}',false,f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  perform pg_temp.decay_assert(state->>'nativeEvidenceCount'='1' and state->'longTermPositiveTags' @> '["decay-warm"]'::jsonb
    and (ranked.explanation->>'longTerm')::double precision=expected and ranked.score=catalog.score
    and ranked.explanation->>'evidenceCount'='1','future/nonfinite Events/UNDO do not leak into current state or base score/count');

  -- Bootstrap remains a distinct, long-only, removable source. Opposite
  -- private imports must not become direct Shared base history.
  delete from public.events where profile_id=f.personal;
  select jsonb_agg(jsonb_build_array(item_id,score) order by item_id) into shared_before
    from private.rank_items_v0(f.shared,'FOR_YOU','BOOK',50,'{}');
  update private.profile_bootstrap_evidence set active=true;
  foreach domain in array array['BOOK','MOVIE'] loop
    perform set_config('request.jwt.claim.sub',f.actor::text,true);
    select * into strict ranked from private.rank_items_v0(f.personal,'FOR_YOU',domain,50,'{}') order by rank limit 1;
    perform pg_temp.decay_assert(ranked.item_id=case when domain='BOOK' then f.book else f.movie end
      and (ranked.explanation->>'bootstrapLongTerm')::double precision>0 and ranked.explanation->'shortTerm'='0'::jsonb,
      'positive bootstrap transfer keeps long-only BOOK/MOVIE preference');
    perform set_config('request.jwt.claim.sub',f.partner::text,true);
    select * into strict ranked from private.rank_items_v0(f.other_personal,'FOR_YOU',domain,50,'{}') order by rank limit 1;
    perform pg_temp.decay_assert(ranked.item_id=case when domain='BOOK' then f.other_book else f.other_movie end,
      'opposite bootstrap-only private taste reverses unseen ordering');
  end loop;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  perform pg_temp.decay_assert(shared_before=(select jsonb_agg(jsonb_build_array(item_id,score) order by item_id)
    from private.rank_items_v0(f.shared,'FOR_YOU','BOOK',50,'{}')),'Personal bootstrap does not become Shared base evidence');
  update private.profile_bootstrap_evidence set rating=10-rating where profile_id=f.personal;
  select * into strict ranked from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') order by rank limit 1;
  perform pg_temp.decay_assert(ranked.item_id=f.other_book,'bootstrap correction reverses serving taste');
  update private.profile_bootstrap_evidence set active=false;
  state := private.build_profile_memory_state_v1(f.personal,now());
  perform pg_temp.decay_assert(state->>'bootstrapEvidenceCount'='0' and state->>'nativeEvidenceCount'='0',
    'bootstrap removal restores empty Personal evidence');

  -- New real V2/V3 Personal/Shared BOOK/MOVIE traces carry the new provenance;
  -- structural features and baseline genome weights are deliberately unchanged.
  foreach profile in array array[f.personal,f.shared] loop
    foreach domain in array array['BOOK','MOVIE'] loop
      response := pg_temp.decay_page(f.actor,profile,domain);
      source := (response->>'predictionId')::uuid;
      perform pg_temp.decay_assert((select base_model_version='prediction-v0.5-native-decay'
        and state_snapshot->>'nativeDecayVersion'='native-long-term-decay-v2'
        from private.prediction_runs where id=source),'new V3 run carries native decay provenance');
      perform pg_temp.decay_assert(not exists(select 1 from private.prediction_candidates where prediction_id=source
        and explanation#>>'{scoringFeatures,version}' is distinct from 'prediction-features-v2'),
        'new native decay leaves the frozen raw-feature schema intact');
    end loop;
  end loop;
  response := pg_temp.decay_page(f.actor,f.personal,'BOOK',2);
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    select id,baseline from pg_temp.native_decay_sources on conflict do nothing;
  -- Replay is tested AFTER live taste, membership-independent catalog values
  -- and discovery eligibility have changed, not just immediately after rank.
  update public.items set tags=array['future-unrelated'],discoverable=false;
  worker := private.process_shadow_prediction_jobs_v1(250);
  perform pg_temp.decay_assert(worker->>'failed'='0' and (worker->>'processed')::integer>0,
    'new frozen shadow replay actually runs after future live catalog changes');
  perform pg_temp.decay_assert((select count(*) from private.shadow_prediction_runs r
    join pg_temp.native_decay_sources s on s.id=r.source_prediction_id where r.genome_id=baseline)
    =(select count(*) from pg_temp.native_decay_sources)
    and not exists(select 1 from private.shadow_prediction_runs r join pg_temp.native_decay_sources s on s.id=r.source_prediction_id
      where r.genome_id=baseline and (r.candidate_count<>(select count(*) from private.prediction_candidates p where p.prediction_id=r.source_prediction_id)
        or r.candidate_count<>(select count(*) from private.shadow_prediction_candidates c where c.shadow_prediction_id=r.id)))
    and not exists(select 1 from private.shadow_prediction_runs r join pg_temp.native_decay_sources s on s.id=r.source_prediction_id
      join private.prediction_candidates p on p.prediction_id=r.source_prediction_id where r.genome_id=baseline
      and not exists(select 1 from private.shadow_prediction_candidates c where c.shadow_prediction_id=r.id and c.item_id=p.item_id))
    and not exists(select 1 from private.shadow_prediction_runs r join pg_temp.native_decay_sources s on s.id=r.source_prediction_id
      join private.shadow_prediction_candidates c on c.shadow_prediction_id=r.id where r.genome_id=baseline
      and not exists(select 1 from private.prediction_candidates p where p.prediction_id=r.source_prediction_id and p.item_id=c.item_id)),
    'every old/new source has a baseline shadow and its complete candidate pool');
  perform pg_temp.decay_assert(not exists(select 1 from private.shadow_prediction_runs r
    join pg_temp.native_decay_sources s on s.id=r.source_prediction_id
    join private.shadow_prediction_candidates shadow on shadow.shadow_prediction_id=r.id
    join private.prediction_candidates production on production.prediction_id=r.source_prediction_id and production.item_id=shadow.item_id
    where r.genome_id=baseline and (shadow.shadow_score is distinct from production.final_score
      or shadow.shadow_rank is distinct from production.final_rank
      or shadow.hypothetical_selected is distinct from production.selected_for_delivery)),
    'real old/new baseline shadow has exact frozen score/rank/selection parity');
  for page in select * from pg_temp.native_decay_pages loop
    perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
    response := public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
    perform pg_temp.decay_assert(response=page.response,'old/new exact V2/V3 receipt retry ignores later catalog/taste');
  end loop;
  perform pg_temp.decay_assert(not exists(select 1 from pg_temp.native_decay_frozen fz left join (
    select 'production' relation,r.id::text id,to_jsonb(r) body from private.prediction_runs r
    union all select 'candidate',c.prediction_id||':'||c.item_id,to_jsonb(c) from private.prediction_candidates c
    union all select 'shadow',r.id::text,to_jsonb(r) from private.shadow_prediction_runs r
    union all select 'shadow_candidate',c.shadow_prediction_id||':'||c.item_id,to_jsonb(c) from private.shadow_prediction_candidates c
  ) current on current.relation=fz.relation and current.id=fz.id where current.body is distinct from fz.body),
    'old immutable production/shadow traces are byte-exact after all live changes');
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.decay_assert(not has_function_privilege(role_name,
      'private.native_long_term_decay_v2(timestamptz,timestamptz)','EXECUTE'),'helper is API denied for '||role_name);
  end loop;
  perform pg_temp.decay_assert((select provolatile='i' and proisstrict and not prosecdef
    and proconfig=array['search_path=""'] from pg_proc where oid='private.native_long_term_decay_v2(timestamptz,timestamptz)'::regprocedure),
    'new helper is immutable strict invoker with closed search_path');
end;$matrix$;
select jsonb_build_object('personalNativeDecay',
  'PASS: shared native LT math and actual memory/scoring signs at 0/364/365/366/730/very-old days; current-session/zero/undo/future controls; Personal BOOK/MOVIE/bootstrap isolation; versioned real V2/V3 serving and frozen baseline parity') snapshot;
