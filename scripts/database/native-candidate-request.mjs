import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

// Synthetic fixtures for the shared native request boundary, never hosted data.
export async function nativeCandidateRequestFixtureSql() {
  return `${await personalTasteSessionFixtureSql()}
insert into public.profiles(id,profile_type,name)
  values('ab157000-0000-4000-8000-000000000900','SHARED','Native request Shared');
insert into public.profile_members(profile_id,user_id)
  values('ab157000-0000-4000-8000-000000000900','ab157000-0000-4000-8000-000000000001'),
    ('ab157000-0000-4000-8000-000000000900','ab157000-0000-4000-8000-000000000002');
insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
  select gen_random_uuid(),p.owner_user_id,p.id,'ab157000-0000-4000-8000-000000000101','MOVIE','ITEM_RATED',
    jsonb_build_object('rating',case when p.owner_user_id='ab157000-0000-4000-8000-000000000001' then 9 else 2 end),
    now()-interval '2 hours',now()-interval '2 hours'
  from public.profiles p where p.profile_type='PERSONAL'
    and p.owner_user_id::text like 'ab157000-%';
insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,saved)
  select p.id,i.id,'ab157000-0000-4000-8000-000000000001',i.id='ab157000-0000-4000-8000-000000000102',
    i.id in('ab157000-0000-4000-8000-000000000103','ab157000-0000-4000-8000-000000000104')
  from public.profiles p cross join public.items i
  where (p.id='ab157000-0000-4000-8000-000000000900' or p.owner_user_id='ab157000-0000-4000-8000-000000000001')
    and i.id in('ab157000-0000-4000-8000-000000000102','ab157000-0000-4000-8000-000000000103','ab157000-0000-4000-8000-000000000104');
update public.item_list_entries e set added_at=now()-interval '45 days'
  where e.item_id='ab157000-0000-4000-8000-000000000103';`;
}

// Independent native CLI smoke uses the same real entry points as the local
// regression. The entire fixture, forecasts and deliberate rejection roll back.
export async function nativeCandidateRequestSmokeSql() {
  return `begin;
${await nativeCandidateRequestFixtureSql()}
do $native_request$
declare actor uuid:='ab157000-0000-4000-8000-000000000001'; personal uuid; profile uuid;
  prediction uuid; mode text; acquisition text; expected jsonb; actual jsonb; before_runs bigint;
  ids uuid[]:=array['ab157000-0000-4000-8000-000000000101','ab157000-0000-4000-8000-000000000121']::uuid[];
  seen uuid[]:=array['ab157000-0000-4000-8000-000000000100']::uuid[]; captured jsonb;
begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  foreach profile in array array[personal,'ab157000-0000-4000-8000-000000000900'::uuid] loop
    foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
      foreach acquisition in array array['LEGACY_DISCOVERY','CATALOG_CHAIN'] loop
        prediction:=gen_random_uuid();
        expected:=jsonb_build_object('version','native-candidate-request-v1','acquisition',acquisition,
          'intent','DELIVERY','itemIds',null,'seenItemIds',case when acquisition='CATALOG_CHAIN' then to_jsonb(seen) else '[]'::jsonb end,
          'reminderSpent',acquisition='CATALOG_CHAIN','requiredAfter',null);
        if acquisition='CATALOG_CHAIN' then
          perform * from private.rank_items_catalog_with_identity_v1(seen,true,prediction,profile,mode,'MOVIE',5,'{}');
        else
          perform * from private.rank_items_with_identity_v1(prediction,profile,mode,'MOVIE',5,
            jsonb_build_object('candidateRequest',jsonb_build_object('intent','EVALUATION','itemIds',to_jsonb(ids))));
        end if;
        select state_snapshot->'candidateRequest' into strict actual from private.prediction_runs where id=prediction;
        if actual is distinct from expected or not exists(select 1 from private.prediction_candidates
          where prediction_id=prediction and selected_for_delivery) then
          raise exception 'Native request delivery branch or private envelope changed';
        end if;
        if acquisition='CATALOG_CHAIN' and exists(select 1 from private.prediction_candidates
          where prediction_id=prediction and item_id=any(seen)) then
          raise exception 'Native request lost catalogue seen exclusion';
        end if;
      end loop;
    end loop;
  end loop;
  prediction:=gen_random_uuid();
  captured:=private.capture_personal_evaluation_v1(prediction,personal,ids,now()-interval '1 second','{}');
  select state_snapshot->'candidateRequest' into strict actual from private.prediction_runs where id=prediction;
  if actual->>'acquisition'<>'EXPLICIT_CANONICAL' or actual->>'intent'<>'EVALUATION'
    or actual->'itemIds'<>to_jsonb(ids) or jsonb_array_length(captured->'items')<>2
    or exists(select 1 from private.prediction_candidates where prediction_id=prediction and selected_for_delivery)
    or (select result_count from private.prediction_runs where id=prediction)<>0 then
    raise exception 'Native request explicit evaluation became delivery or lost requested identities';
  end if;
  select count(*) into before_runs from private.prediction_runs;
  begin
    perform * from private.rank_items_candidate_with_identity_v1(now()+interval '1 day',ids,false,'{}',false,
      gen_random_uuid(),personal,'FOR_YOU',null,2,'{}');
    raise exception 'Native request accepted an uncommitted evaluation prefix';
  exception when serialization_failure then null;
  end;
  if (select count(*) from private.prediction_runs)<>before_runs then
    raise exception 'Rejected native request retained a forecast';
  end if;
end;$native_request$;
select jsonb_build_object('nativeCandidateRequest',
  'PASS: consumed legacy/catalogue/explicit requests, Personal/Shared and all modes, context isolation, non-delivery evaluation and prewrite prefix rejection') as snapshot;
rollback;`;
}
