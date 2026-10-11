do $support_matrix$
declare
  f record;r record;c record;matched_tags text[];domain text;mode text;next_item uuid;expected integer;
begin
  select * into strict f from pg_temp.item_support_fixture;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  select i.tags into strict matched_tags from public.items i where i.id=f.evidence;
  perform pg_temp.item_support_assert(private.native_item_support_count_v1(null)=0
    and private.native_item_support_count_v1('{}')=0
    and private.native_item_support_count_v1(array[f.evidence,f.evidence,null])=1,'pure helper counts distinct nonnull Item IDs');
  foreach domain in array array['BOOK','MOVIE'] loop
    foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
      select * into strict r from private.rank_items_v0(f.personal,mode,domain,50,'{}')
        where item_id=case when domain='BOOK' then f.book else f.movie end;
      select * into strict c from private.rank_items_catalog_base_v1('{}',false,f.personal,mode,domain,50,'{}') where item_id=r.item_id;
      perform pg_temp.item_support_assert(r.confidence=0.125 and r.explanation->>'nativeItemSupportCount'='1'
        and r.explanation->>'evidenceCount'='8','one native Item/eight tags supplies one support unit');
      -- The clone has four declared catalog-chain trace fields. All remaining
      -- legacy fields and features must match for the empty chain.
      perform pg_temp.item_support_assert(r.score=c.score and r.confidence=c.confidence
        and pg_temp.item_support_comparable(to_jsonb(r))=
          pg_temp.item_support_comparable(to_jsonb(c)) #-'{explanation,candidatePool,catalogChainVersion}'
          #-'{explanation,candidatePool,seenCount}' #-'{explanation,candidatePool,seenPrefixHash}'
          #-'{explanation,candidatePool,reminderPreviouslyDelivered}',
        'ordinary/catalogue base score and support parity');
      perform pg_temp.item_support_assert(r.explanation->>'nativeSupportVersion'='native-item-support-v1'
        and r.explanation->>'nativeSupportBasis'='DISTINCT_MATCHING_NATIVE_ITEMS'
        and r.explanation->>'nativeSupportCalibration'='uncalibrated'
        and r.explanation->>'version'='prediction-v0.5-native-decay'
        and r.explanation#>>'{scoringFeatures,version}'='prediction-features-v2','support is explicitly versioned uncalibrated; score versions retained');
    end loop;
  end loop;
  select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.unmatched;
  perform pg_temp.item_support_assert(r.confidence=0 and r.explanation->>'nativeItemSupportCount'='0','nonmatching candidate receives no native support');
  update public.items set tags='{}' where id=f.unmatched;
  select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.unmatched;
  perform pg_temp.item_support_assert(r.confidence=0,'missing tags remain unsupported');
  -- Same-Item native repeats, duplicated evidence tags and duplicated candidate
  -- tags do not multiply the distinct Item unit. Score semantics are preserved.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()-interval '1 hour','{"rating":0}'),
      (gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_OPENED',now(),'{}');
  update public.items set tags=matched_tags||matched_tags where id in(f.evidence,f.book);
  select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  perform pg_temp.item_support_assert(r.confidence=0.125 and r.explanation->>'nativeItemSupportCount'='1'
    and (r.explanation->>'evidenceCount')::integer>8,'repeated Item actions and tag multiplication retain one support unit, including rating zero');
  update public.items set tags=matched_tags where id in(f.evidence,f.book);
  -- Undo removes only its named admitted Event. Older remaining evidence on the
  -- same Item still supplies one unit; a future UNDO cannot remove it early.
  insert into public.events(id,actor_user_id,profile_id,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,'ITEM_INTERACTION_UNDONE',now()+interval '1 day',
      jsonb_build_object('reversedEventId','a181d000-0000-4000-8000-000000000100'));
  select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  perform pg_temp.item_support_assert(r.explanation->>'nativeItemSupportCount'='1','future UNDO does not withdraw current support');
  insert into public.events(id,actor_user_id,profile_id,event_type,occurred_at,properties)
    select gen_random_uuid(),f.actor,f.personal,'ITEM_INTERACTION_UNDONE',now(),jsonb_build_object('reversedEventId',e.id)
    from public.events e where e.profile_id=f.personal and e.item_id=f.evidence;
  -- Unavailable/future native, foreign Profile and zero-weight rating five are
  -- not part of the current kernel's admitted nonzero native support.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()+interval '1 day','{"rating":10}'),
      (gen_random_uuid(),f.foreign_actor,f.foreign_personal,f.evidence,'BOOK','ITEM_RATED',now(),' {"rating":10}'),
      (gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now(),' {"rating":5}');
  select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  perform pg_temp.item_support_assert(r.confidence=0 and r.explanation->>'nativeItemSupportCount'='0','UNDO/temporal/foreign/neutral evidence cannot inflate support');
  -- Bootstrap alone remains ranking signal, never native support. A native
  -- source for that same Item adds exactly one native unit, not another prior.
  update private.profile_bootstrap_evidence set active=true where profile_id=f.personal;
  select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  perform pg_temp.item_support_assert(r.confidence=0 and r.explanation->>'nativeItemSupportCount'='0'
    and (r.explanation->>'bootstrapLongTerm')::double precision>0,'bootstrap-only ranking has zero native support');
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now(),' {"rating":0}');
  select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
  perform pg_temp.item_support_assert(r.confidence=0.125 and r.explanation->>'nativeItemSupportCount'='1'
    and (r.explanation->>'bootstrapLongTerm')::double precision>0,'same-Item bootstrap/native overlap counts one native unit; fusion scoring remains unchanged');
  -- Eight distinct matching native Items saturate the unchanged /8 heuristic.
  for expected in 2..8 loop
    next_item := gen_random_uuid();
    insert into public.items(id,item_type,title,tags,discoverable) values(next_item,'BOOK','Distinct native evidence '||expected,matched_tags,false);
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
      values(gen_random_uuid(),f.actor,f.personal,next_item,'BOOK','ITEM_RATED',now(),' {"rating":10}');
    select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
    select * into strict c from private.rank_items_catalog_base_v1('{}',false,f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
    perform pg_temp.item_support_assert((r.explanation->>'nativeItemSupportCount')::integer=expected
      and r.confidence=least(1.0,expected::double precision/8) and c.confidence=r.confidence,
      'distinct matching native Items increase support once each in both kernels');
  end loop;
end;$support_matrix$;
select jsonb_build_object('nativeItemSupport',
  'PASS: distinct native Item support; tags/repeats/zero/UNDO/time/Profile/missing/bootstrap; ordinary/catalogue parity; uncalibrated /8 heuristic only') snapshot;
