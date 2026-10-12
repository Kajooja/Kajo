-- Personal-only current explicit-source ownership and bootstrap forgetting.
-- Old frozen features/rows/helpers retain bytes; structural feature-v2 stays compatible.
do $fusion_guard$ declare patch jsonb;p record;r jsonb;n integer;begin
for patch in select value from jsonb_array_elements($manifest$[
  {
    "signature": "private.build_profile_memory_state_v1(uuid,timestamp with time zone)",
    "sourceMd5": "81b9e0a4dfde19d8a960d3e40f6ee73f",
    "replacements": [
      {
        "before": "with reversed_events as (",
        "after": "with source_evidence as materialized (select * from private.personal_source_evidence_v1(target_profile_id,state_as_of)),\n  fusion_metadata as materialized (select private.personal_source_fusion_metadata_v1(coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb)) value from source_evidence e),\n  reversed_events as (",
        "count": 1
      },
      {
        "before": "      and private.event_evidence_weight_v1(event.event_type, event.properties) <> 0.0",
        "after": "      and not (exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL'))\n      and private.event_evidence_weight_v1(event.event_type, event.properties) <> 0.0",
        "count": 1
      },
      {
        "before": "  ),\n  bootstrap_weighted_events as (",
        "after": "    union all select e.item_id,e.occurred_at,e.event_weight,false,null::timestamptz\n      from source_evidence e where not e.is_bootstrap and e.event_weight<>0\n  ),\n  bootstrap_weighted_events as (",
        "count": 1
      },
      {
        "before": "    select evidence.item_id, evidence.occurred_at, evidence.event_weight,\n      true as is_bootstrap, evidence.imported_at as bootstrap_imported_at\n    from private.bootstrap_weighted_evidence_v1(target_profile_id, state_as_of) as evidence",
        "after": "    select e.item_id,e.occurred_at,e.event_weight,true,e.bootstrap_imported_at\n    from source_evidence e where e.is_bootstrap and e.event_weight<>0",
        "count": 1
      },
      {
        "before": "private.bootstrap_decay_v1(state_as_of, weighted_events.occurred_at)",
        "after": "private.bootstrap_decay_v2(state_as_of, weighted_events.occurred_at)",
        "count": 1
      },
      {
        "before": "'bootstrapServingVersion', 'bootstrap-serving-v1'",
        "after": "'bootstrapServingVersion', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-serving-v2-source-fusion' else 'bootstrap-serving-v1' end",
        "count": 1
      },
      {
        "before": "  ) from evidence_summary;",
        "after": "  ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end from evidence_summary;",
        "count": 1
      },
      {
        "before": "'bootstrapPolicyVersion', 'bootstrap-evidence-v1'",
        "after": "'bootstrapPolicyVersion',case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-evidence-v2-source-fusion' else 'bootstrap-evidence-v1' end",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.get_profile_bootstrap_status_v1(uuid)",
    "sourceMd5": "6c90cb4c6dad4a8dd689e0d7f9e8c2e7",
    "replacements": [
      {
        "before": "\ndeclare\n  strong_evidence_count integer;\n  imported_strong_count integer;\n  calibration_rating_count integer;\n  native_strong_count integer;\n  real_movie_count integer;\n  real_book_count integer;\nbegin\n  perform private.assert_personal_profile_owner_v1(target_profile_id);\n\n  select count(distinct evidence.item_id)::integer\n  into imported_strong_count\n  from private.profile_bootstrap_evidence as evidence\n  where evidence.profile_id = target_profile_id\n    and evidence.active\n    and evidence.source_provider <> 'KAJO_CALIBRATION'\n    and evidence.evidence_kind in ('RATED', 'CONSUMED');\n\n  select count(distinct evidence.item_id)::integer\n  into calibration_rating_count\n  from private.profile_bootstrap_evidence as evidence\n  where evidence.profile_id = target_profile_id\n    and evidence.active\n    and evidence.source_provider = 'KAJO_CALIBRATION'\n    and evidence.evidence_kind = 'RATED';\n\n  select count(distinct event.item_id)::integer\n  into native_strong_count\n  from public.events as event\n  where event.profile_id = target_profile_id\n    and event.item_id is not null\n    and event.event_type in (\n      'ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_CONSUMED',\n      'ITEM_ADDED_TO_LIST', 'ITEM_SAVED'\n    );\n\n  select count(*)::integer\n  into strong_evidence_count\n  from (\n    select evidence.item_id\n    from private.profile_bootstrap_evidence as evidence\n    where evidence.profile_id = target_profile_id\n      and evidence.active\n      and evidence.evidence_kind in ('RATED', 'CONSUMED')\n    union\n    select event.item_id\n    from public.events as event\n    where event.profile_id = target_profile_id\n      and event.item_id is not null\n      and event.event_type in (\n        'ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_CONSUMED',\n        'ITEM_ADDED_TO_LIST', 'ITEM_SAVED'\n      )\n  ) as strong_item;\n\n  select\n    count(distinct item.id) filter (where item.item_type = 'MOVIE')::integer,\n    count(distinct item.id) filter (where item.item_type = 'BOOK')::integer\n  into real_movie_count, real_book_count\n  from public.items as item\n  where item.discoverable\n    and exists (\n      select 1\n      from private.item_sources as source\n      where source.item_id = item.id\n        and source.provider_key <> 'kajo_mock'\n    );\n\n  return jsonb_build_object(\n    'profileId', target_profile_id,\n    'minimumStrongEvidence', 6,\n    'initialCandidateCount', 12,\n    'maximumCandidateCount', 24,\n    'strongEvidenceCount', coalesce(strong_evidence_count, 0),\n    'importedStrongCount', coalesce(imported_strong_count, 0),\n    'calibrationRatingCount', coalesce(calibration_rating_count, 0),\n    'nativeStrongCount', coalesce(native_strong_count, 0),\n    'needsCalibration', coalesce(strong_evidence_count, 0) < 6,\n    'realMovieCount', coalesce(real_movie_count, 0),\n    'realBookCount', coalesce(real_book_count, 0),\n    'calibrationAvailable',\n      coalesce(real_movie_count, 0) >= 4\n      and coalesce(real_book_count, 0) >= 4\n      and coalesce(real_movie_count, 0) + coalesce(real_book_count, 0) >= 12,\n    'priorVersion', 'cold-start-prior-v1',\n    'version', 'cold-start-v1'\n  );\nend;\n",
        "after": "declare\n  result jsonb;decision_time timestamptz:=now();\nbegin\n  perform private.assert_personal_profile_owner_v1(target_profile_id);\n  with evidence as materialized(select * from private.personal_source_evidence_v1(target_profile_id,decision_time)),\n  bootstrap as (\n    select b.* from evidence e join private.profile_bootstrap_evidence b on b.id=e.source_event_id\n    where e.is_bootstrap and b.evidence_kind in('RATED','CONSUMED')\n  ), controls as materialized (\n    select distinct on(e.id) e.*,admitted.receipt_depth from evidence admitted join public.events e on e.id=admitted.source_event_id\n    where not admitted.is_bootstrap and admitted.source_status not in('AMBIGUOUS_NATIVE','UNAVAILABLE_NATIVE_VALUE','UNAVAILABLE_CANONICAL_LINEAGE')\n      and not exists(select 1 from evidence unavailable where unavailable.item_id=e.item_id\n        and unavailable.source_status='UNAVAILABLE_CANONICAL_LINEAGE')\n    order by e.id,admitted.receipt_depth desc nulls last\n  ), weak_groups as (\n    select e.item_id,case when e.event_type in('ITEM_SAVED','ITEM_UNSAVED') then 'SAVED' else 'CONSUMED' end slot,\n      e.occurred_at,e.receipt_depth,bool_and(e.event_type in('ITEM_SAVED','ITEM_CONSUMED')) all_positive,\n      bool_or(e.event_type in('ITEM_SAVED','ITEM_CONSUMED')) any_positive\n    from controls e where e.item_id is not null and e.event_type in('ITEM_SAVED','ITEM_UNSAVED','ITEM_CONSUMED',\n      'ITEM_CONSUMPTION_REVERSED','ITEM_HISTORY_CLEARED','ITEM_NOT_INTERESTED') group by e.item_id,slot,e.occurred_at,e.receipt_depth\n  ), weak_latest as (\n    select distinct on(g.item_id,g.slot) g.* from (\n      select w.*,bool_and(receipt_depth is not null) over(partition by item_id,slot) canonical from weak_groups w\n    ) g order by g.item_id,g.slot,case when g.canonical then g.receipt_depth end desc,g.occurred_at desc\n  ), list_groups as (\n    select e.item_id,lower(e.properties->>'listId') list_id,e.occurred_at,e.receipt_depth,max(e.created_at) available_at,\n      bool_and(e.event_type='ITEM_ADDED_TO_LIST') all_positive,bool_or(e.event_type='ITEM_ADDED_TO_LIST') any_positive\n    from controls e where e.item_id is not null and e.event_type in('ITEM_ADDED_TO_LIST','ITEM_REMOVED_FROM_LIST')\n      and (exists(select 1 from public.item_lists l where l.id::text=lower(e.properties->>'listId') and l.profile_id=target_profile_id\n      and pg_catalog.isfinite(l.created_at) and l.created_at<=decision_time)\n      or exists(select 1 from private.item_action_receipts r where r.id::text=lower(e.properties->>'actionId')\n        and r.actor_user_id=e.actor_user_id and r.profile_id=e.profile_id and r.item_id=e.item_id\n        and r.command->>'kind' in('SET_LIST_ENTRY','UNDO_LIST_ENTRY')\n        and lower(r.result->>'listId')=lower(e.properties->>'listId')\n        and r.result->'eventIds' @> jsonb_build_array(e.id)))\n      and coalesce(e.properties->>'listId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'\n    group by e.item_id,lower(e.properties->>'listId'),e.occurred_at,e.receipt_depth\n  ), list_latest as (\n    select g.*,exists(select 1 from controls deleted where deleted.event_type='LIST_DELETED'\n      and lower(deleted.properties->>'listId')=g.list_id and case when g.canonical then deleted.created_at>g.available_at else deleted.occurred_at>g.occurred_at end) deleted,\n      exists(select 1 from controls deleted where deleted.event_type='LIST_DELETED'\n        and lower(deleted.properties->>'listId')=g.list_id and case when g.canonical then deleted.created_at=g.available_at else deleted.occurred_at=g.occurred_at end) delete_tied\n    from (select distinct on(item_id,list_id) * from (\n      select l.*,bool_and(receipt_depth is not null) over(partition by item_id,list_id) canonical from list_groups l\n    ) ordered order by item_id,list_id,case when canonical then receipt_depth end desc,occurred_at desc) g\n  ), native as (\n    select e.item_id from evidence e where not e.is_bootstrap and e.source_status in('NATIVE_RATING','NATIVE_NEGATIVE')\n    union select w.item_id from weak_latest w where w.all_positive and(w.slot='SAVED' or not exists(\n      select 1 from evidence a where a.item_id=w.item_id and a.occurred_at>=w.occurred_at\n        and a.source_status in('AMBIGUOUS_NATIVE','UNAVAILABLE_NATIVE_VALUE','UNAVAILABLE_CANONICAL_LINEAGE')))\n    union select item_id from list_latest where all_positive and not deleted and not delete_tied\n  ), unavailable as (\n    select item_id from evidence where source_status in('AMBIGUOUS_NATIVE','UNAVAILABLE_NATIVE_VALUE','UNAVAILABLE_CANONICAL_LINEAGE')\n    union select item_id from weak_latest where any_positive<>all_positive\n    union select item_id from list_latest where any_positive<>all_positive or delete_tied\n  ), strong as(select item_id from native union select item_id from bootstrap), catalog as (\n    select count(*) filter(where item.item_type='MOVIE') movies,count(*) filter(where item.item_type='BOOK') books\n    from public.items item where item.discoverable and exists(select 1 from private.item_sources source\n      where source.item_id=item.id and source.provider_key<>'kajo_mock')\n  )\n  select jsonb_build_object('profileId',target_profile_id,'minimumStrongEvidence',6,'initialCandidateCount',12,'maximumCandidateCount',24,\n    'strongEvidenceCount',(select count(*) from strong),'importedStrongCount',(select count(*) from bootstrap where source_provider<>'KAJO_CALIBRATION'),\n    'calibrationRatingCount',(select count(*) from bootstrap where source_provider='KAJO_CALIBRATION' and evidence_kind='RATED'),\n    'nativeStrongCount',(select count(*) from native),'needsCalibration',(select count(*) from strong)<6,\n    'realMovieCount',movies,'realBookCount',books,'calibrationAvailable',movies>=4 and books>=4 and movies+books>=12,\n    'priorVersion','cold-start-prior-v1','version','cold-start-v1','supportVersion','personal-effective-setup-support-v1',\n    'supportBasis','AVAILABLE_PREFIX_EFFECTIVE_STRONG_ITEMS_NOT_KNOWN_RATING_COUNT',\n    'setupSupportAvailability',case when exists(select 1 from unavailable) then 'PARTIAL_UNAVAILABLE' else 'AVAILABLE_PREFIX' end,\n    'setupUnavailableItems',(select count(*) from unavailable),'sourceFusion',\n      private.personal_source_fusion_metadata_v1((select coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb) from evidence e)))\n  into result from catalog;\n  return result;\nend;\n",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_v0(uuid,text,text,integer,jsonb)",
    "sourceMd5": "7bccca644db678c6c1f8c5020083fc31",
    "replacements": [
      {
        "before": "  reversed_events as (",
        "after": "  source_evidence as materialized (select * from private.personal_source_evidence_v1(target_profile_id,now())),\n  fusion_metadata as materialized (select private.personal_source_fusion_metadata_v1(coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb)) value from source_evidence e),\n  reversed_events as (",
        "count": 1
      },
      {
        "before": "  weighted_events as (",
        "after": "  legacy_weighted_events as (",
        "count": 1
      },
      {
        "before": "  native_tag_evidence as (",
        "after": "  weighted_events as (\n    select * from legacy_weighted_events where not (exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL'))\n    union all select e.item_id,e.occurred_at,e.event_weight from source_evidence e where not e.is_bootstrap and e.event_weight<>0\n  ),\n  native_tag_evidence as (",
        "count": 1
      },
      {
        "before": "    select * from private.bootstrap_weighted_evidence_v1(target_profile_id, now())",
        "after": "    select e.item_id,e.occurred_at,e.event_weight,e.bootstrap_imported_at as imported_at\n    from source_evidence e where e.is_bootstrap and e.event_weight<>0",
        "count": 1
      },
      {
        "before": "private.bootstrap_decay_v1(now(), evidence.occurred_at)",
        "after": "private.bootstrap_decay_v2(now(), evidence.occurred_at)",
        "count": 1
      },
      {
        "before": "'version', 'prediction-v0.5-native-decay'",
        "after": "'version', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 1
      },
      {
        "before": "'bootstrapServingVersion', 'bootstrap-serving-v1'",
        "after": "'bootstrapServingVersion', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-serving-v2-source-fusion' else 'bootstrap-serving-v1' end",
        "count": 1
      },
      {
        "before": "      ) as scoring_features",
        "after": "      ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end as scoring_features",
        "count": 1
      },
      {
        "before": "    )\n  from native_supported as ranked",
        "after": "    ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end\n  from native_supported as ranked",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "3c0ce376187f1371028f7689a903db19",
    "replacements": [
      {
        "before": "'prediction-v0.5-native-decay'",
        "after": "case when current_state ? 'sourceFusion' then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 2
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)",
    "sourceMd5": "fe922872ae0138bf18ebea926da39d15",
    "replacements": [
      {
        "before": "  reversed_events as (",
        "after": "  source_evidence as materialized (select * from private.personal_source_evidence_v1(target_profile_id,now())),\n  fusion_metadata as materialized (select private.personal_source_fusion_metadata_v1(coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb)) value from source_evidence e),\n  reversed_events as (",
        "count": 1
      },
      {
        "before": "  weighted_events as (",
        "after": "  legacy_weighted_events as (",
        "count": 1
      },
      {
        "before": "  native_tag_evidence as (",
        "after": "  weighted_events as (\n    select * from legacy_weighted_events where not (exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL'))\n    union all select e.item_id,e.occurred_at,e.event_weight from source_evidence e where not e.is_bootstrap and e.event_weight<>0\n  ),\n  native_tag_evidence as (",
        "count": 1
      },
      {
        "before": "    select * from private.bootstrap_weighted_evidence_v1(target_profile_id, now())",
        "after": "    select e.item_id,e.occurred_at,e.event_weight,e.bootstrap_imported_at as imported_at\n    from source_evidence e where e.is_bootstrap and e.event_weight<>0",
        "count": 1
      },
      {
        "before": "private.bootstrap_decay_v1(now(), evidence.occurred_at)",
        "after": "private.bootstrap_decay_v2(now(), evidence.occurred_at)",
        "count": 1
      },
      {
        "before": "'version', 'prediction-v0.5-native-decay'",
        "after": "'version', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 1
      },
      {
        "before": "'bootstrapServingVersion', 'bootstrap-serving-v1'",
        "after": "'bootstrapServingVersion', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-serving-v2-source-fusion' else 'bootstrap-serving-v1' end",
        "count": 1
      },
      {
        "before": "      ) as scoring_features",
        "after": "      ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end as scoring_features",
        "count": 1
      },
      {
        "before": "    )\n  from native_supported as ranked",
        "after": "    ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end\n  from native_supported as ranked",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "e7bda95346dca9e895feb0c5b52b6960",
    "replacements": [
      {
        "before": "'prediction-v0.5-native-decay'",
        "after": "case when current_state ? 'sourceFusion' then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 2
      }
    ]
  }
]$manifest$::jsonb) loop
select oid,prosrc into strict p from pg_proc where oid=(patch->>'signature')::regprocedure;
if md5(p.prosrc)<>patch->>'sourceMd5' then raise exception 'Personal source fusion forward: unexpected source %',patch->>'signature';end if;
for r in select value from jsonb_array_elements(patch->'replacements') loop n:=(length(p.prosrc)-length(replace(p.prosrc,r->>'before','')))/length(r->>'before');if n<>(r->>'count')::integer then raise exception 'Personal source fusion forward: fragment drift';end if;end loop;end loop;end;$fusion_guard$;
create function private.bootstrap_decay_v2(state_as_of timestamptz,evidence_at timestamptz)
returns double precision language sql immutable security invoker set search_path='' as $$
  select case when pg_catalog.isfinite(state_as_of) and pg_catalog.isfinite(evidence_at)
    and evidence_at<=state_as_of then exp(-extract(epoch from(state_as_of-evidence_at))/86400.0/1460.0)::double precision else 0.0 end;
$$;
revoke all on function private.bootstrap_decay_v2(timestamptz,timestamptz) from public,anon,authenticated,service_role;

-- One currently available own-Personal source resolution, not historical commit proof.
create function private.personal_source_evidence_v1(target_profile uuid,cutoff timestamptz)
returns table(item_id uuid,occurred_at timestamptz,event_weight double precision,is_bootstrap boolean,
  bootstrap_imported_at timestamptz,source_status text,source_event_id uuid,ordering_basis text,receipt_depth integer)
language sql stable security invoker set search_path='' as $$
  with recursive owner as materialized (
    select p.owner_user_id from public.profiles p where p.id=target_profile and p.profile_type='PERSONAL'
      and pg_catalog.isfinite(cutoff)
  ), prefix as materialized (
    select e.* from public.events e join owner o on e.actor_user_id=o.owner_user_id
    where e.profile_id=target_profile and pg_catalog.isfinite(e.occurred_at) and e.occurred_at<=cutoff
      and pg_catalog.isfinite(e.created_at) and e.created_at<=cutoff
  ), reversals as materialized (
    select original.id,
      bool_or(coalesce(u.properties->>'reason'='HISTORY_CLEARED',false) and exists(
        select 1 from private.item_action_receipts r where r.actor_user_id=u.actor_user_id
          and r.profile_id=u.profile_id and r.item_id=original.item_id and r.command->>'kind'='CLEAR_HISTORY'
          and r.id::text=u.properties->>'actionId' and r.result->'eventIds' @> jsonb_build_array(u.id)
      )) as history_erasure
    from prefix u join prefix original on lower(u.properties->>'reversedEventId')=original.id::text
      and original.event_type<>'ITEM_INTERACTION_UNDONE' and original.item_id is not null
      and u.item_id=original.item_id
    where u.event_type='ITEM_INTERACTION_UNDONE'
      and coalesce(u.properties->>'reversedEventId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    group by original.id
  ), surviving as materialized (
    select p.* from prefix p where not exists(select 1 from reversals r where r.id=p.id)
  ), replacements as (
    select p.item_id,p.occurred_at,p.id,
      case when r.history_erasure and p.event_type='ITEM_RATED' then 'ERASED_VALUE' else p.event_type end kind,
      p.properties->'rating' rating
    from prefix p left join reversals r on r.id=p.id
    where p.item_id is not null and p.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED')
      and (r.id is null or (r.history_erasure and p.event_type='ITEM_RATED'))
  ), groups as (
    select item_id,occurred_at,count(distinct jsonb_build_array(kind,case when kind='ITEM_RATED' then rating end)) signatures,
      min(kind) kind,min(rating::text) rating,min(id::text)::uuid source_event_id
    from replacements group by item_id,occurred_at
  ), latest as (
    select distinct on(g.item_id) g.* from groups g order by g.item_id,g.occurred_at desc
  ), authority as materialized (
    select g.item_id,g.occurred_at,g.source_event_id,g.rating,
      case when g.signatures>1 then 'AMBIGUOUS_NATIVE'
        when exists(select 1 from surviving c where c.item_id=g.item_id and c.occurred_at=g.occurred_at
          and ((g.kind='ITEM_NOT_INTERESTED' and c.event_type='ITEM_INTEREST_CLEARED')
            or(g.kind='ITEM_RATED' and c.event_type='ITEM_HISTORY_CLEARED'))) then 'AMBIGUOUS_NATIVE'
        when g.kind='ERASED_VALUE' then 'CLEARED_NATIVE_VALUE'
        when g.kind='ITEM_NOT_INTERESTED' and exists(select 1 from surviving c where c.item_id=g.item_id
          and c.event_type='ITEM_INTEREST_CLEARED' and c.occurred_at>g.occurred_at) then 'CLEARED_NATIVE_NEGATIVE'
        when g.kind='ITEM_RATED' and exists(select 1 from surviving c where c.item_id=g.item_id
          and c.event_type='ITEM_HISTORY_CLEARED' and c.occurred_at>g.occurred_at) then 'CLEARED_NATIVE_VALUE'
        when g.kind='ITEM_RATED' and coalesce(g.rating,'') !~ '^(10|[0-9])$' then 'UNAVAILABLE_NATIVE_VALUE'
        when g.kind='ITEM_RATED' then 'NATIVE_RATING' else 'NATIVE_NEGATIVE' end status
    from latest g
  ),  claimed_receipts as materialized (
    select r.*,p.id event_id,p.event_type,p.occurred_at event_occurred_at,p.created_at event_created_at,p.properties event_properties,
      p.item_id event_item_id
    from prefix p join private.item_action_receipts r on r.id=p.id
    where p.item_id is not null and r.command->>'kind' in('SET_RATING','SET_NOT_INTERESTED','CLEAR_HISTORY','UNDO',
      'SET_LIST_ENTRY','UNDO_LIST_ENTRY','CREATE_LIST','RENAME_LIST','DELETE_LIST','ENDORSE_SHARED_ITEM','REVERSE_ENDORSEMENT')
  ), valid_receipts as materialized (
    select r.* from claimed_receipts r join owner o on r.actor_user_id=o.owner_user_id
    where r.profile_id=target_profile and r.item_id=r.event_item_id
      and pg_catalog.isfinite(r.created_at) and r.created_at<=cutoff
      and r.command->'version'='1'::jsonb and r.result->'version'='1'::jsonb
      and lower(r.command->>'actorUserId')=r.actor_user_id::text
      and lower(r.command->>'profileId')=target_profile::text and lower(r.command->>'itemId')=r.item_id::text
      and lower(r.result->>'actionId')=r.id::text and lower(r.result->>'profileId')=target_profile::text
      and lower(r.event_properties->>'actionId')=r.id::text
      and (r.id=r.event_id or r.result->'eventIds' @> jsonb_build_array(r.event_id))
      and case r.command->>'kind'
        when 'SET_RATING' then r.event_type='ITEM_RATED'
          and jsonb_typeof(r.command->'rating')='number'
          and r.command->'rating'=r.event_properties->'rating' and r.result#>'{interaction,rating}'=r.command->'rating'
          and r.command->>'rating' ~ '^(10|[0-9])$'
        when 'SET_NOT_INTERESTED' then
          ((r.command->'notInterested'='true'::jsonb and r.event_type='ITEM_NOT_INTERESTED')
            or(r.command->'notInterested'='false'::jsonb and r.event_type='ITEM_INTEREST_CLEARED'))
          and r.result#>'{interaction,notInterested}'=r.command->'notInterested'
          and r.result->'interaction' ? 'rating'
        when 'CLEAR_HISTORY' then r.event_type='ITEM_HISTORY_CLEARED'
          and r.result->'eventIds' @> jsonb_build_array(r.event_id) and r.before_state ? 'notInterested'
        when 'UNDO' then r.event_type='ITEM_INTERACTION_UNDONE'
          and lower(r.event_properties->>'reversedEventId')=r.reverses_action_id::text
        else r.result->'eventIds' @> jsonb_build_array(r.event_id) and r.result->>'kind'=r.command->>'kind'
      end
  ), receipt_walk as (
    select r.id,r.item_id,0 depth,array[r.id] path from valid_receipts r where r.previous_action_id is null
    union all
    select child.id,child.item_id,parent.depth+1,parent.path||child.id
    from valid_receipts child join receipt_walk parent on parent.id=child.previous_action_id and parent.item_id=child.item_id
    where parent.depth<512 and not child.id=any(parent.path)
  ), active_authority_receipts as materialized (
    select r.*,w.depth,w.path from valid_receipts r join receipt_walk w on w.id=r.id
    left join reversals canceled on canceled.id=r.event_id
    where r.command->>'kind' in('SET_RATING','SET_NOT_INTERESTED','CLEAR_HISTORY')
      and (canceled.id is null or canceled.history_erasure)
  ), canonical_frontiers as materialized (
    select a.* from active_authority_receipts a where not exists(select 1 from active_authority_receipts child
      where child.item_id=a.item_id and child.id<>a.id and a.id=any(child.path))
  ), lineage_invalid as materialized (
    select c.event_item_id item_id from claimed_receipts c where not exists(select 1 from valid_receipts v where v.id=c.id)
    union select v.item_id from valid_receipts v where not exists(select 1 from receipt_walk w where w.id=v.id)
    union select item_id from canonical_frontiers group by item_id having count(*)>1
    union select a.item_id from canonical_frontiers a join prefix raw on raw.item_id=a.item_id
      and raw.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_INTEREST_CLEARED','ITEM_HISTORY_CLEARED')
      and (raw.created_at>a.created_at or(raw.created_at=a.created_at and raw.occurred_at>a.event_occurred_at)) and not exists(select 1 from valid_receipts r where r.event_id=raw.id)
  ), canonical_state as materialized (
    select a.*,
      case a.command->>'kind'
        when 'SET_RATING' then 'NATIVE_RATING'
        when 'SET_NOT_INTERESTED' then case when a.command->'notInterested'='true'::jsonb then 'NATIVE_NEGATIVE'
          when a.result#>'{interaction,rating}'='null'::jsonb then 'CLEARED_NATIVE_NEGATIVE'
          when a.result#>>'{interaction,rating}' ~ '^(10|[0-9])$' then 'NATIVE_RATING' else 'UNAVAILABLE_CANONICAL_LINEAGE' end
        when 'CLEAR_HISTORY' then case when a.before_state->'notInterested'='true'::jsonb then 'NATIVE_NEGATIVE'
          when a.before_state->'notInterested'='false'::jsonb then 'CLEARED_NATIVE_VALUE' else 'UNAVAILABLE_CANONICAL_LINEAGE' end
      end desired_status,
      case when a.command->>'kind'='SET_RATING' then a.command->>'rating'
        when a.command->>'kind'='SET_NOT_INTERESTED' and a.command->'notInterested'='false'::jsonb
          then a.result#>>'{interaction,rating}' end desired_rating
    from canonical_frontiers a where not exists(select 1 from lineage_invalid i where i.item_id=a.item_id)
  ), canonical_labels as (
    select a.*,label.id label_id,label.occurred_at label_occurred_at from canonical_state a
    left join lateral (
      select p.id,p.occurred_at,w.depth from valid_receipts r join receipt_walk w on w.id=r.id
      join surviving p on p.id=r.event_id where r.id=any(a.path)
        and ((a.desired_status='NATIVE_RATING' and p.event_type='ITEM_RATED' and p.properties->>'rating'=a.desired_rating)
          or(a.desired_status='NATIVE_NEGATIVE' and p.event_type='ITEM_NOT_INTERESTED'))
      order by w.depth desc limit 1
    ) label on true
  ), resolved_authority as materialized (
    select a.item_id,coalesce(a.label_occurred_at,a.event_occurred_at) occurred_at,
      case when a.desired_status in('NATIVE_RATING','NATIVE_NEGATIVE') then coalesce(a.label_id,legacy.source_event_id) else a.event_id end source_event_id,
      a.desired_rating rating,
      case when a.desired_status in('NATIVE_RATING','NATIVE_NEGATIVE') and a.label_id is null
        and (legacy.status is distinct from a.desired_status or (a.desired_status='NATIVE_RATING' and legacy.rating is distinct from a.desired_rating))
        then 'UNAVAILABLE_CANONICAL_LINEAGE' else a.desired_status end status,
      'CANONICAL_RECEIPT_LINEAGE'::text ordering_basis
    from canonical_labels a left join authority legacy on legacy.item_id=a.item_id
    union all select i.item_id,null::timestamptz,null::uuid,null::text,'UNAVAILABLE_CANONICAL_LINEAGE','CANONICAL_RECEIPT_LINEAGE'
      from lineage_invalid i
    union all select a.item_id,a.occurred_at,a.source_event_id,a.rating,a.status,'LATEST_ELIGIBLE_OCCURRENCE_TIME'
      from authority a where not exists(select 1 from canonical_labels c where c.item_id=a.item_id)
        and not exists(select 1 from lineage_invalid i where i.item_id=a.item_id)
  ),
 bootstrap as materialized (
    select distinct on(b.item_id) b.* from private.profile_bootstrap_evidence b join owner o on b.actor_user_id=o.owner_user_id
    where b.profile_id=target_profile and b.active and pg_catalog.isfinite(b.imported_at) and b.imported_at<=cutoff
      and pg_catalog.isfinite(coalesce(b.source_occurred_at,b.imported_at)) and coalesce(b.source_occurred_at,b.imported_at)<=cutoff
    order by b.item_id,case b.evidence_kind when 'RATED' then 3 when 'CONSUMED' then 2 else 1 end desc,
      b.source_occurred_at desc nulls last,b.imported_at desc,b.id
  )
  select a.item_id,a.occurred_at,
    case a.status when 'NATIVE_RATING' then private.event_evidence_weight_v1('ITEM_RATED',jsonb_build_object('rating',a.rating::integer))
      when 'NATIVE_NEGATIVE' then private.event_evidence_weight_v1('ITEM_NOT_INTERESTED','{}'::jsonb) else 0.0 end,false,null::timestamptz,a.status,a.source_event_id,a.ordering_basis,null::integer
    from resolved_authority a
  union all
  select e.item_id,e.occurred_at,case when e.event_type in('ITEM_INTEREST_CLEARED','ITEM_HISTORY_CLEARED') then 0.0
      else private.event_evidence_weight_v1(e.event_type,e.properties) end,false,null::timestamptz,'NATIVE_OTHER',e.id,
      case when exists(select 1 from valid_receipts r where r.id=e.id) then 'CANONICAL_RECEIPT_LINEAGE' else 'LATEST_ELIGIBLE_OCCURRENCE_TIME' end,
      (select w.depth from valid_receipts r join receipt_walk w on w.id=r.id
        where r.id::text=lower(e.properties->>'actionId') and (r.id=e.id or r.result->'eventIds' @> jsonb_build_array(e.id)))
    from surviving e where (e.item_id is not null or e.event_type='LIST_DELETED')
      and e.event_type not in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_INTERACTION_UNDONE')
  union all
  select e.item_id,e.occurred_at,0.0,false,null::timestamptz,'NATIVE_OTHER',e.id,
    case when exists(select 1 from valid_receipts r where r.id=e.id) then 'CANONICAL_RECEIPT_LINEAGE' else 'LATEST_ELIGIBLE_OCCURRENCE_TIME' end,
    (select w.depth from valid_receipts r join receipt_walk w on w.id=r.id where r.id=e.id)
    from surviving e where e.item_id is not null and e.event_type='ITEM_NOT_INTERESTED'
  union all
  select b.item_id,coalesce(b.source_occurred_at,b.imported_at),private.bootstrap_evidence_weight_v1(b.evidence_kind,b.rating),true,b.imported_at,
    case when a.status='AMBIGUOUS_NATIVE' then 'BOOTSTRAP_AMBIGUOUS_FALLBACK'
      when a.status='UNAVAILABLE_NATIVE_VALUE' then 'BOOTSTRAP_UNAVAILABLE_FALLBACK'
      when a.status='UNAVAILABLE_CANONICAL_LINEAGE' then 'BOOTSTRAP_LINEAGE_UNAVAILABLE_FALLBACK' else 'BOOTSTRAP_PRIOR' end,b.id,
      coalesce(a.ordering_basis,'LATEST_ELIGIBLE_OCCURRENCE_TIME'),null::integer
    from bootstrap b left join resolved_authority a on a.item_id=b.item_id
    where coalesce(a.status,'') not in('NATIVE_RATING','NATIVE_NEGATIVE');
$$;
revoke all on function private.personal_source_evidence_v1(uuid,timestamptz) from public,anon,authenticated,service_role;

create function private.personal_source_fusion_metadata_v1(evidence jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('version','personal-source-fusion-v1','availabilityBasis','STORED_CREATED_TIME',
    'commitAvailability','UNKNOWN','bootstrapDecayVersion','bootstrap-decay-v2',
    'orderingBasis','CANONICAL_RECEIPT_LINEAGE_ELSE_ELIGIBLE_OCCURRENCE_TIME','maxReceiptDepth',512,
    'canonicalItems',count(distinct value->>'item_id') filter(where value->>'ordering_basis'='CANONICAL_RECEIPT_LINEAGE'),
    'lineageUnavailableItems',count(distinct value->>'item_id') filter(where value->>'source_status'='UNAVAILABLE_CANONICAL_LINEAGE'),
    'nativeRatingItems',count(distinct value->>'item_id') filter(where value->>'source_status'='NATIVE_RATING'),
    'neutralRatingItems',count(distinct value->>'item_id') filter(where value->>'source_status'='NATIVE_RATING' and(value->>'event_weight')::double precision=0),
    'ambiguousNativeItems',count(distinct value->>'item_id') filter(where value->>'source_status'='AMBIGUOUS_NATIVE'),
    'unavailableNativeItems',count(distinct value->>'item_id') filter(where value->>'source_status'='UNAVAILABLE_NATIVE_VALUE'),
    'bootstrapAmbiguousFallbackItems',count(distinct value->>'item_id') filter(where value->>'source_status'='BOOTSTRAP_AMBIGUOUS_FALLBACK'),
    'bootstrapLineageUnavailableFallbackItems',count(distinct value->>'item_id') filter(where value->>'source_status'='BOOTSTRAP_LINEAGE_UNAVAILABLE_FALLBACK'),
    'bootstrapUnavailableFallbackItems',count(distinct value->>'item_id') filter(where value->>'source_status'='BOOTSTRAP_UNAVAILABLE_FALLBACK'))
  from jsonb_array_elements(coalesce(evidence,'[]'::jsonb));
$$;
revoke all on function private.personal_source_fusion_metadata_v1(jsonb) from public,anon,authenticated,service_role;
do $fusion_apply$ declare patch jsonb;p record;r jsonb;body text;begin
for patch in select value from jsonb_array_elements($manifest$[
  {
    "signature": "private.build_profile_memory_state_v1(uuid,timestamp with time zone)",
    "sourceMd5": "81b9e0a4dfde19d8a960d3e40f6ee73f",
    "replacements": [
      {
        "before": "with reversed_events as (",
        "after": "with source_evidence as materialized (select * from private.personal_source_evidence_v1(target_profile_id,state_as_of)),\n  fusion_metadata as materialized (select private.personal_source_fusion_metadata_v1(coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb)) value from source_evidence e),\n  reversed_events as (",
        "count": 1
      },
      {
        "before": "      and private.event_evidence_weight_v1(event.event_type, event.properties) <> 0.0",
        "after": "      and not (exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL'))\n      and private.event_evidence_weight_v1(event.event_type, event.properties) <> 0.0",
        "count": 1
      },
      {
        "before": "  ),\n  bootstrap_weighted_events as (",
        "after": "    union all select e.item_id,e.occurred_at,e.event_weight,false,null::timestamptz\n      from source_evidence e where not e.is_bootstrap and e.event_weight<>0\n  ),\n  bootstrap_weighted_events as (",
        "count": 1
      },
      {
        "before": "    select evidence.item_id, evidence.occurred_at, evidence.event_weight,\n      true as is_bootstrap, evidence.imported_at as bootstrap_imported_at\n    from private.bootstrap_weighted_evidence_v1(target_profile_id, state_as_of) as evidence",
        "after": "    select e.item_id,e.occurred_at,e.event_weight,true,e.bootstrap_imported_at\n    from source_evidence e where e.is_bootstrap and e.event_weight<>0",
        "count": 1
      },
      {
        "before": "private.bootstrap_decay_v1(state_as_of, weighted_events.occurred_at)",
        "after": "private.bootstrap_decay_v2(state_as_of, weighted_events.occurred_at)",
        "count": 1
      },
      {
        "before": "'bootstrapServingVersion', 'bootstrap-serving-v1'",
        "after": "'bootstrapServingVersion', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-serving-v2-source-fusion' else 'bootstrap-serving-v1' end",
        "count": 1
      },
      {
        "before": "  ) from evidence_summary;",
        "after": "  ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end from evidence_summary;",
        "count": 1
      },
      {
        "before": "'bootstrapPolicyVersion', 'bootstrap-evidence-v1'",
        "after": "'bootstrapPolicyVersion',case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-evidence-v2-source-fusion' else 'bootstrap-evidence-v1' end",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.get_profile_bootstrap_status_v1(uuid)",
    "sourceMd5": "6c90cb4c6dad4a8dd689e0d7f9e8c2e7",
    "replacements": [
      {
        "before": "\ndeclare\n  strong_evidence_count integer;\n  imported_strong_count integer;\n  calibration_rating_count integer;\n  native_strong_count integer;\n  real_movie_count integer;\n  real_book_count integer;\nbegin\n  perform private.assert_personal_profile_owner_v1(target_profile_id);\n\n  select count(distinct evidence.item_id)::integer\n  into imported_strong_count\n  from private.profile_bootstrap_evidence as evidence\n  where evidence.profile_id = target_profile_id\n    and evidence.active\n    and evidence.source_provider <> 'KAJO_CALIBRATION'\n    and evidence.evidence_kind in ('RATED', 'CONSUMED');\n\n  select count(distinct evidence.item_id)::integer\n  into calibration_rating_count\n  from private.profile_bootstrap_evidence as evidence\n  where evidence.profile_id = target_profile_id\n    and evidence.active\n    and evidence.source_provider = 'KAJO_CALIBRATION'\n    and evidence.evidence_kind = 'RATED';\n\n  select count(distinct event.item_id)::integer\n  into native_strong_count\n  from public.events as event\n  where event.profile_id = target_profile_id\n    and event.item_id is not null\n    and event.event_type in (\n      'ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_CONSUMED',\n      'ITEM_ADDED_TO_LIST', 'ITEM_SAVED'\n    );\n\n  select count(*)::integer\n  into strong_evidence_count\n  from (\n    select evidence.item_id\n    from private.profile_bootstrap_evidence as evidence\n    where evidence.profile_id = target_profile_id\n      and evidence.active\n      and evidence.evidence_kind in ('RATED', 'CONSUMED')\n    union\n    select event.item_id\n    from public.events as event\n    where event.profile_id = target_profile_id\n      and event.item_id is not null\n      and event.event_type in (\n        'ITEM_RATED', 'ITEM_NOT_INTERESTED', 'ITEM_CONSUMED',\n        'ITEM_ADDED_TO_LIST', 'ITEM_SAVED'\n      )\n  ) as strong_item;\n\n  select\n    count(distinct item.id) filter (where item.item_type = 'MOVIE')::integer,\n    count(distinct item.id) filter (where item.item_type = 'BOOK')::integer\n  into real_movie_count, real_book_count\n  from public.items as item\n  where item.discoverable\n    and exists (\n      select 1\n      from private.item_sources as source\n      where source.item_id = item.id\n        and source.provider_key <> 'kajo_mock'\n    );\n\n  return jsonb_build_object(\n    'profileId', target_profile_id,\n    'minimumStrongEvidence', 6,\n    'initialCandidateCount', 12,\n    'maximumCandidateCount', 24,\n    'strongEvidenceCount', coalesce(strong_evidence_count, 0),\n    'importedStrongCount', coalesce(imported_strong_count, 0),\n    'calibrationRatingCount', coalesce(calibration_rating_count, 0),\n    'nativeStrongCount', coalesce(native_strong_count, 0),\n    'needsCalibration', coalesce(strong_evidence_count, 0) < 6,\n    'realMovieCount', coalesce(real_movie_count, 0),\n    'realBookCount', coalesce(real_book_count, 0),\n    'calibrationAvailable',\n      coalesce(real_movie_count, 0) >= 4\n      and coalesce(real_book_count, 0) >= 4\n      and coalesce(real_movie_count, 0) + coalesce(real_book_count, 0) >= 12,\n    'priorVersion', 'cold-start-prior-v1',\n    'version', 'cold-start-v1'\n  );\nend;\n",
        "after": "declare\n  result jsonb;decision_time timestamptz:=now();\nbegin\n  perform private.assert_personal_profile_owner_v1(target_profile_id);\n  with evidence as materialized(select * from private.personal_source_evidence_v1(target_profile_id,decision_time)),\n  bootstrap as (\n    select b.* from evidence e join private.profile_bootstrap_evidence b on b.id=e.source_event_id\n    where e.is_bootstrap and b.evidence_kind in('RATED','CONSUMED')\n  ), controls as materialized (\n    select distinct on(e.id) e.*,admitted.receipt_depth from evidence admitted join public.events e on e.id=admitted.source_event_id\n    where not admitted.is_bootstrap and admitted.source_status not in('AMBIGUOUS_NATIVE','UNAVAILABLE_NATIVE_VALUE','UNAVAILABLE_CANONICAL_LINEAGE')\n      and not exists(select 1 from evidence unavailable where unavailable.item_id=e.item_id\n        and unavailable.source_status='UNAVAILABLE_CANONICAL_LINEAGE')\n    order by e.id,admitted.receipt_depth desc nulls last\n  ), weak_groups as (\n    select e.item_id,case when e.event_type in('ITEM_SAVED','ITEM_UNSAVED') then 'SAVED' else 'CONSUMED' end slot,\n      e.occurred_at,e.receipt_depth,bool_and(e.event_type in('ITEM_SAVED','ITEM_CONSUMED')) all_positive,\n      bool_or(e.event_type in('ITEM_SAVED','ITEM_CONSUMED')) any_positive\n    from controls e where e.item_id is not null and e.event_type in('ITEM_SAVED','ITEM_UNSAVED','ITEM_CONSUMED',\n      'ITEM_CONSUMPTION_REVERSED','ITEM_HISTORY_CLEARED','ITEM_NOT_INTERESTED') group by e.item_id,slot,e.occurred_at,e.receipt_depth\n  ), weak_latest as (\n    select distinct on(g.item_id,g.slot) g.* from (\n      select w.*,bool_and(receipt_depth is not null) over(partition by item_id,slot) canonical from weak_groups w\n    ) g order by g.item_id,g.slot,case when g.canonical then g.receipt_depth end desc,g.occurred_at desc\n  ), list_groups as (\n    select e.item_id,lower(e.properties->>'listId') list_id,e.occurred_at,e.receipt_depth,max(e.created_at) available_at,\n      bool_and(e.event_type='ITEM_ADDED_TO_LIST') all_positive,bool_or(e.event_type='ITEM_ADDED_TO_LIST') any_positive\n    from controls e where e.item_id is not null and e.event_type in('ITEM_ADDED_TO_LIST','ITEM_REMOVED_FROM_LIST')\n      and (exists(select 1 from public.item_lists l where l.id::text=lower(e.properties->>'listId') and l.profile_id=target_profile_id\n      and pg_catalog.isfinite(l.created_at) and l.created_at<=decision_time)\n      or exists(select 1 from private.item_action_receipts r where r.id::text=lower(e.properties->>'actionId')\n        and r.actor_user_id=e.actor_user_id and r.profile_id=e.profile_id and r.item_id=e.item_id\n        and r.command->>'kind' in('SET_LIST_ENTRY','UNDO_LIST_ENTRY')\n        and lower(r.result->>'listId')=lower(e.properties->>'listId')\n        and r.result->'eventIds' @> jsonb_build_array(e.id)))\n      and coalesce(e.properties->>'listId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'\n    group by e.item_id,lower(e.properties->>'listId'),e.occurred_at,e.receipt_depth\n  ), list_latest as (\n    select g.*,exists(select 1 from controls deleted where deleted.event_type='LIST_DELETED'\n      and lower(deleted.properties->>'listId')=g.list_id and case when g.canonical then deleted.created_at>g.available_at else deleted.occurred_at>g.occurred_at end) deleted,\n      exists(select 1 from controls deleted where deleted.event_type='LIST_DELETED'\n        and lower(deleted.properties->>'listId')=g.list_id and case when g.canonical then deleted.created_at=g.available_at else deleted.occurred_at=g.occurred_at end) delete_tied\n    from (select distinct on(item_id,list_id) * from (\n      select l.*,bool_and(receipt_depth is not null) over(partition by item_id,list_id) canonical from list_groups l\n    ) ordered order by item_id,list_id,case when canonical then receipt_depth end desc,occurred_at desc) g\n  ), native as (\n    select e.item_id from evidence e where not e.is_bootstrap and e.source_status in('NATIVE_RATING','NATIVE_NEGATIVE')\n    union select w.item_id from weak_latest w where w.all_positive and(w.slot='SAVED' or not exists(\n      select 1 from evidence a where a.item_id=w.item_id and a.occurred_at>=w.occurred_at\n        and a.source_status in('AMBIGUOUS_NATIVE','UNAVAILABLE_NATIVE_VALUE','UNAVAILABLE_CANONICAL_LINEAGE')))\n    union select item_id from list_latest where all_positive and not deleted and not delete_tied\n  ), unavailable as (\n    select item_id from evidence where source_status in('AMBIGUOUS_NATIVE','UNAVAILABLE_NATIVE_VALUE','UNAVAILABLE_CANONICAL_LINEAGE')\n    union select item_id from weak_latest where any_positive<>all_positive\n    union select item_id from list_latest where any_positive<>all_positive or delete_tied\n  ), strong as(select item_id from native union select item_id from bootstrap), catalog as (\n    select count(*) filter(where item.item_type='MOVIE') movies,count(*) filter(where item.item_type='BOOK') books\n    from public.items item where item.discoverable and exists(select 1 from private.item_sources source\n      where source.item_id=item.id and source.provider_key<>'kajo_mock')\n  )\n  select jsonb_build_object('profileId',target_profile_id,'minimumStrongEvidence',6,'initialCandidateCount',12,'maximumCandidateCount',24,\n    'strongEvidenceCount',(select count(*) from strong),'importedStrongCount',(select count(*) from bootstrap where source_provider<>'KAJO_CALIBRATION'),\n    'calibrationRatingCount',(select count(*) from bootstrap where source_provider='KAJO_CALIBRATION' and evidence_kind='RATED'),\n    'nativeStrongCount',(select count(*) from native),'needsCalibration',(select count(*) from strong)<6,\n    'realMovieCount',movies,'realBookCount',books,'calibrationAvailable',movies>=4 and books>=4 and movies+books>=12,\n    'priorVersion','cold-start-prior-v1','version','cold-start-v1','supportVersion','personal-effective-setup-support-v1',\n    'supportBasis','AVAILABLE_PREFIX_EFFECTIVE_STRONG_ITEMS_NOT_KNOWN_RATING_COUNT',\n    'setupSupportAvailability',case when exists(select 1 from unavailable) then 'PARTIAL_UNAVAILABLE' else 'AVAILABLE_PREFIX' end,\n    'setupUnavailableItems',(select count(*) from unavailable),'sourceFusion',\n      private.personal_source_fusion_metadata_v1((select coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb) from evidence e)))\n  into result from catalog;\n  return result;\nend;\n",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_v0(uuid,text,text,integer,jsonb)",
    "sourceMd5": "7bccca644db678c6c1f8c5020083fc31",
    "replacements": [
      {
        "before": "  reversed_events as (",
        "after": "  source_evidence as materialized (select * from private.personal_source_evidence_v1(target_profile_id,now())),\n  fusion_metadata as materialized (select private.personal_source_fusion_metadata_v1(coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb)) value from source_evidence e),\n  reversed_events as (",
        "count": 1
      },
      {
        "before": "  weighted_events as (",
        "after": "  legacy_weighted_events as (",
        "count": 1
      },
      {
        "before": "  native_tag_evidence as (",
        "after": "  weighted_events as (\n    select * from legacy_weighted_events where not (exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL'))\n    union all select e.item_id,e.occurred_at,e.event_weight from source_evidence e where not e.is_bootstrap and e.event_weight<>0\n  ),\n  native_tag_evidence as (",
        "count": 1
      },
      {
        "before": "    select * from private.bootstrap_weighted_evidence_v1(target_profile_id, now())",
        "after": "    select e.item_id,e.occurred_at,e.event_weight,e.bootstrap_imported_at as imported_at\n    from source_evidence e where e.is_bootstrap and e.event_weight<>0",
        "count": 1
      },
      {
        "before": "private.bootstrap_decay_v1(now(), evidence.occurred_at)",
        "after": "private.bootstrap_decay_v2(now(), evidence.occurred_at)",
        "count": 1
      },
      {
        "before": "'version', 'prediction-v0.5-native-decay'",
        "after": "'version', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 1
      },
      {
        "before": "'bootstrapServingVersion', 'bootstrap-serving-v1'",
        "after": "'bootstrapServingVersion', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-serving-v2-source-fusion' else 'bootstrap-serving-v1' end",
        "count": 1
      },
      {
        "before": "      ) as scoring_features",
        "after": "      ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end as scoring_features",
        "count": 1
      },
      {
        "before": "    )\n  from native_supported as ranked",
        "after": "    ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end\n  from native_supported as ranked",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "3c0ce376187f1371028f7689a903db19",
    "replacements": [
      {
        "before": "'prediction-v0.5-native-decay'",
        "after": "case when current_state ? 'sourceFusion' then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 2
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)",
    "sourceMd5": "fe922872ae0138bf18ebea926da39d15",
    "replacements": [
      {
        "before": "  reversed_events as (",
        "after": "  source_evidence as materialized (select * from private.personal_source_evidence_v1(target_profile_id,now())),\n  fusion_metadata as materialized (select private.personal_source_fusion_metadata_v1(coalesce(jsonb_agg(to_jsonb(e)) filter(where e.source_status<>'NATIVE_OTHER'),'[]'::jsonb)) value from source_evidence e),\n  reversed_events as (",
        "count": 1
      },
      {
        "before": "  weighted_events as (",
        "after": "  legacy_weighted_events as (",
        "count": 1
      },
      {
        "before": "  native_tag_evidence as (",
        "after": "  weighted_events as (\n    select * from legacy_weighted_events where not (exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL'))\n    union all select e.item_id,e.occurred_at,e.event_weight from source_evidence e where not e.is_bootstrap and e.event_weight<>0\n  ),\n  native_tag_evidence as (",
        "count": 1
      },
      {
        "before": "    select * from private.bootstrap_weighted_evidence_v1(target_profile_id, now())",
        "after": "    select e.item_id,e.occurred_at,e.event_weight,e.bootstrap_imported_at as imported_at\n    from source_evidence e where e.is_bootstrap and e.event_weight<>0",
        "count": 1
      },
      {
        "before": "private.bootstrap_decay_v1(now(), evidence.occurred_at)",
        "after": "private.bootstrap_decay_v2(now(), evidence.occurred_at)",
        "count": 1
      },
      {
        "before": "'version', 'prediction-v0.5-native-decay'",
        "after": "'version', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 1
      },
      {
        "before": "'bootstrapServingVersion', 'bootstrap-serving-v1'",
        "after": "'bootstrapServingVersion', case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then 'bootstrap-serving-v2-source-fusion' else 'bootstrap-serving-v1' end",
        "count": 1
      },
      {
        "before": "      ) as scoring_features",
        "after": "      ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end as scoring_features",
        "count": 1
      },
      {
        "before": "    )\n  from native_supported as ranked",
        "after": "    ) || case when exists(select 1 from public.profiles p where p.id=target_profile_id and p.profile_type='PERSONAL') then jsonb_build_object('sourceFusion',(select value from fusion_metadata)) else '{}'::jsonb end\n  from native_supported as ranked",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "e7bda95346dca9e895feb0c5b52b6960",
    "replacements": [
      {
        "before": "'prediction-v0.5-native-decay'",
        "after": "case when current_state ? 'sourceFusion' then 'prediction-v0.6-personal-source-fusion' else 'prediction-v0.5-native-decay' end",
        "count": 2
      }
    ]
  }
]$manifest$::jsonb) loop
select pg_get_functiondef(oid) definition,prosrc into strict p from pg_proc where oid=(patch->>'signature')::regprocedure;body:=p.prosrc;
for r in select value from jsonb_array_elements(patch->'replacements') loop body:=replace(body,r->>'before',r->>'after');end loop;
execute replace(p.definition,p.prosrc,body);end loop;end;$fusion_apply$;
