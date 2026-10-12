do $fusion_matrix$ declare f record;r record;c record;state jsonb;status jsonb;first jsonb;second jsonb;value double precision;begin
 select * into strict f from pg_temp.item_support_fixture;perform set_config('request.jwt.claim.sub',f.actor::text,true);
 update private.profile_bootstrap_evidence set active=true where profile_id=f.personal;
 -- Latest current rating owns one Item, including neutral 5 and negative zero.
 perform pg_temp.fusion_item_action('SET_RATING','{"rating":0}',-100);
 select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
 perform pg_temp.fusion_assert((r.explanation->>'bootstrapLongTerm')::double precision=0 and(r.explanation->>'longTerm')::double precision<0
   and r.confidence=0.125 and r.explanation->>'nativeItemSupportCount'='1','latest zero replaces old rating/import; one native Item support');
 perform pg_temp.fusion_item_action('SET_RATING','{"rating":5}',-90);
 select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
 perform pg_temp.fusion_assert((r.explanation->>'longTerm')::double precision=0 and(r.explanation->>'bootstrapLongTerm')::double precision=0
   and r.confidence=0,'neutral 5 suppresses older positive rating/import before weight filtering');
 state:=private.build_profile_memory_state_v1(f.personal,now());
 perform pg_temp.fusion_assert(state->'longTermPositiveTags'='[]' and state->'longTermNegativeTags'='[]'
   and state#>>'{sourceFusion,neutralRatingItems}'='1','neutral ownership in memory uses same resolver');
 status:=private.get_profile_bootstrap_status_v1(f.personal);
 perform pg_temp.fusion_assert(status->>'nativeStrongCount'='1' and status->>'calibrationRatingCount'='5'
   and status->>'strongEvidenceCount'='6','effective setup includes known neutral rating and five retained neutral bootstrap Items');
 -- Raw rows newer than the canonical chain make its ordering unavailable.
 insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
 values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()-interval '80 seconds','{"rating":0}'),
       (gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()-interval '80 seconds','{"rating":10}');
 select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
 perform pg_temp.fusion_assert(r.explanation#>>'{sourceFusion,lineageUnavailableItems}'='1'
   and exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e
     where e.item_id=f.evidence and e.source_status='BOOTSTRAP_LINEAGE_UNAVAILABLE_FALLBACK')
   and(r.explanation->>'bootstrapLongTerm')::double precision>0
   and r.confidence=0,'mixed authority has no UUID winner or native support; bootstrap fallback is explicit');
 -- Malformed latest value is an unavailable replacement barrier, never old-native resurrection.
 insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
 values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()-interval '70 seconds','{"rating":"invalid"}');
 state:=private.build_profile_memory_state_v1(f.personal,now());
 perform pg_temp.fusion_assert(state#>>'{sourceFusion,lineageUnavailableItems}'='1'
   and exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e
     where e.item_id=f.evidence and e.source_status='BOOTSTRAP_LINEAGE_UNAVAILABLE_FALLBACK'),
   'malformed mixed replacement retains labeled prior fallback');
 -- Real command semantics: clear-interest does not erase rating; rejection then clear does not resurrect rating.
 perform pg_temp.fusion_item_action('SET_RATING','{"rating":10}',-60);
 perform pg_temp.fusion_item_action('SET_NOT_INTERESTED','{"notInterested":false}',-50);
 perform pg_temp.fusion_assert(exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e where e.item_id=f.evidence
   and e.source_status='NATIVE_RATING' and e.event_weight=6),'selective interest clear preserves current rating and is neutral');
 perform pg_temp.fusion_item_action('SET_NOT_INTERESTED','{"notInterested":true}',-40);
 perform pg_temp.fusion_item_action('SET_NOT_INTERESTED','{"notInterested":false}',-30);
 perform pg_temp.fusion_assert(not exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e where e.item_id=f.evidence
   and e.source_status in('NATIVE_RATING','NATIVE_NEGATIVE')),'cleared rejection never resurrects replaced native rating');
 -- Genuine own Undo can be backdated before its target; it restores prior canonical state.
 first:=pg_temp.fusion_item_action('SET_RATING','{"rating":0}',-20);
 perform pg_temp.fusion_item_action('UNDO',jsonb_build_object('reversesActionId',first->>'actionId'),-25);
 perform pg_temp.fusion_assert(not exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e where e.item_id=f.evidence
   and e.source_status='NATIVE_RATING'),'exact backdated own Undo cancels visible target without invented chronology');
 -- History clear erases rating sources, but its replacement barrier must not resurrect an old negative.
 perform pg_temp.fusion_item_action('SET_NOT_INTERESTED','{"notInterested":true}',-15);
 perform pg_temp.fusion_item_action('SET_RATING','{"rating":10}',-10);
 second:=pg_temp.fusion_clear_history(-5);
 perform pg_temp.fusion_assert(not exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e where e.item_id=f.evidence
   and (e.source_status in('NATIVE_RATING','NATIVE_NEGATIVE') or e.is_bootstrap)),'actual history clear removes native/bootstrap history without resurrecting stale rejection');
 -- Current state may be changed by a future command; prefix-based support remains honest.
 first:=pg_temp.fusion_item_action('SET_RATING','{"rating":0}',-4);
 perform pg_temp.fusion_item_action('UNDO',jsonb_build_object('reversesActionId',first->>'actionId'),60);
 status:=private.get_profile_bootstrap_status_v1(f.personal);
 perform pg_temp.fusion_assert(status->>'nativeStrongCount'='1','future Undo cannot remove currently available explicit setup support');
 -- Non-Personal source resolver is inert; metadata/state/feature structural versions remain supported.
 perform pg_temp.fusion_assert(private.bootstrap_decay_v2(now(),now()-interval '14600 days')<0.001
   and private.bootstrap_decay_v1(now(),now()-interval '14600 days')=0.2
   and private.bootstrap_decay_v2(now(),'infinity')=0 and private.bootstrap_decay_v2(now(),now()+interval '1 day')=0,
   'new finite unclamped bootstrap decay; old floor helper retained');
 select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
 select * into strict c from private.rank_items_catalog_base_v1('{}',false,f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
 perform pg_temp.fusion_assert(r.score=c.score and r.confidence=c.confidence and r.explanation->'scoringFeatures'=c.explanation->'scoringFeatures'
   and r.explanation->>'version'='prediction-v0.6-personal-source-fusion'
   and r.explanation#>>'{scoringFeatures,version}'='prediction-features-v2','ordinary/catalog source-fusion score/features/support parity and explicit compatible version');
end;$fusion_matrix$;
select jsonb_build_object('personalSourceFusion','PASS: current own rating/prior fusion; neutral/zero/correction/clear/UNDO/ambiguity; finite no-floor decay; effective setup; ordinary/catalog parity') snapshot;
