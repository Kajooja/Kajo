-- Frozen pre-optimization V4 acquisition for differential tests only.
-- This reference deliberately retains unconditional canonical skip checks and
-- provider projection before the recognition bound; do not update with serving SQL.
create function pg_temp.taste_candidate_catalog_v4_reference(target_session uuid,cutoff timestamptz)
returns jsonb language sql stable set search_path='' as $$
  with session as materialized (
    select * from private.sequential_taste_sessions where id=target_session and policy='CANONICAL_FORECAST_POOL_V4'
      and status='ACTIVE' and actor_user_id=auth.uid()
  ), eligible as materialized (
    select i.id,i.item_type,i.title,i.tags,
      private.catalog_cold_start_prior_v1(i.id,cutoff) prior,
      (coalesce(i.metadata->>'coldStartRecognition','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
        or coalesce(i.metadata->>'voteCount','') ~ '^[0-9]+$') has_recognition,
      array(select distinct src.provider_key from private.item_sources src where src.item_id=i.id
        and src.provider_key<>'kajo_mock' and isfinite(src.created_at) and src.created_at<=cutoff
        order by src.provider_key limit 16) providers
    from session s cross join public.items i
    where i.item_type in('BOOK','MOVIE') and i.discoverable and isfinite(i.created_at) and i.created_at<=cutoff
      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'
        and isfinite(src.created_at) and src.created_at<=cutoff)
      and not exists(select 1 from jsonb_array_elements(s.presentations) q where q->>'objectId'=i.id::text)
      and not exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=s.profile_id and b.item_id=i.id)
      and not exists(select 1 from public.events e where e.profile_id=s.profile_id and e.item_id=i.id
        and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_SAVED'))
      and not exists(select 1 from public.item_interactions a where a.profile_id=s.profile_id and a.item_id=i.id)
      and (private.contextual_skip_decision_v1(s.profile_id,i.id,cutoff,true)->>'eligible')::boolean
  ), bounded as materialized (
    select * from (select e.*,row_number() over(partition by item_type
      order by (prior->>'recognition')::double precision desc,id) n from eligible e) ranked where n<=128
  ), dimensions as (
    select tag from (select distinct id,tag from bounded b,lateral unnest(b.tags) tag
      where length(tag) between 1 and 256 and tag !~ '[[:cntrl:]]') tags
    group by tag order by count(*) desc,tag collate "C" limit 64
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'itemType',item_type,'title',left(title,512),
    'providerKeys',providers,'availableAt',floor(extract(epoch from cutoff)*1000)::bigint,
    'tags',array(select distinct tag from unnest(b.tags) tag where tag in(select tag from dimensions) order by tag),
    'rawTags',to_jsonb(b.tags),
    'recognitionPrior',case when has_recognition then (prior->>'recognition')::double precision else null end,
    'priorBasis',case when not has_recognition then 'UNAVAILABLE'
      when prior->>'source'='KAJO_CURATED_RECOGNITION' then 'CURATED_RECOGNITION' else 'PROVIDER_CATALOG' end)
    order by id),'[]') from bounded b where n<=25;
$$;
