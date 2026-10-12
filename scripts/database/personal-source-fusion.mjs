import { readFile } from 'node:fs/promises';
export const personalSourceFusionPatches = [
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
];
export async function personalSourceFusionFixtureSql(){return await readFile(new URL('native-item-support-fixture.sql',import.meta.url),'utf8')+'\n'+await readFile(new URL('personal-source-fusion-fixture.sql',import.meta.url),'utf8');}
export async function personalSourceFusionSmokeSql(){return 'begin;\n'+await personalSourceFusionFixtureSql()+'\n'+await readFile(new URL('personal-source-fusion-smoke.sql',import.meta.url),'utf8')+'\nrollback;';}

// Native CLI verifier: preserve populated source/frozen rows and every old
// function's OID, owner, grants and configuration across the exact forward.
export async function personalSourceFusionUpgradeSql(migration) {
  if (!migration.name.endsWith('_personal_source_fusion.sql')) throw new Error('Expected Personal source fusion forward');
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  const patches = personalSourceFusionPatches.flatMap(fn => fn.replacements.map((patch, ordinal) =>
    `(${literal(fn.signature)}::regprocedure,${ordinal},${literal(patch.before)},${literal(patch.after)},${patch.count})`)).join(',\n');
  return `begin;
    ${await personalSourceFusionFixtureSql()}
    update private.profile_bootstrap_evidence set active=true;
    do $defect$ declare f record;r record;begin
      select * into f from pg_temp.item_support_fixture;
      select * into r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
      perform pg_temp.fusion_assert((r.explanation->>'bootstrapLongTerm')::double precision>0
        and(r.explanation->>'longTerm')::double precision>(r.explanation->>'bootstrapLongTerm')::double precision,
        'predecessor duplicates same-Item native/bootstrap contribution');
    end;$defect$;
    create temp table fusion_upgrade_tables(identity text,oid oid,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('auth','public','private') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.fusion_upgrade_tables values(r.identity,r.oid,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table fusion_upgrade_functions on commit drop as select p.oid,p.prosrc,to_jsonb(p)-'prosrc' properties
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('auth','public','private') and p.prokind='f';
    create temp table fusion_upgrade_patches(oid oid,ordinal integer,before text,after text,expected_count integer) on commit drop;
    insert into pg_temp.fusion_upgrade_patches values ${patches};
    alter default privileges for role postgres grant execute on functions to public;
    ${migration.sql}
    do $verify$ declare r record;p record;expected text;digest text;response jsonb;helper text;api_role text;begin
      for r in select * from pg_temp.fusion_upgrade_tables loop
        perform pg_temp.fusion_assert(exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']=r.properties),
          'old table identity/owner/ACL/RLS changed: '||r.identity);
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        perform pg_temp.fusion_assert(digest=r.digest,'old source/frozen rows changed: '||r.identity);
      end loop;
      for r in select * from pg_temp.fusion_upgrade_functions loop
        expected:=r.prosrc;
        for p in select * from pg_temp.fusion_upgrade_patches where oid=r.oid order by ordinal loop
          perform pg_temp.fusion_assert(cardinality(string_to_array(expected,p.before))=p.expected_count+1,'approved fragment unavailable');
          expected:=replace(expected,p.before,p.after);
        end loop;
        perform pg_temp.fusion_assert(exists(select 1 from pg_proc f where f.oid=r.oid
          and to_jsonb(f)-'prosrc'=r.properties and f.prosrc=expected),'old function changed beyond approved patches: '||r.oid::regprocedure::text);
      end loop;
      foreach helper in array array['private.bootstrap_decay_v2(timestamptz,timestamptz)',
        'private.personal_source_evidence_v1(uuid,timestamptz)','private.personal_source_fusion_metadata_v1(jsonb)'] loop
        foreach api_role in array array['anon','authenticated','service_role'] loop
          perform pg_temp.fusion_assert(not has_function_privilege(api_role,helper,'EXECUTE'),'new helper exposed to API roles');
        end loop;
      end loop;
      for r in select * from pg_temp.item_support_pages loop
        perform set_config('request.jwt.claim.sub',r.actor::text,true);perform set_config('role','authenticated',true);
        response:=public.rank_items_page_v1(r.request);perform set_config('role','postgres',true);
        perform pg_temp.fusion_assert(response=r.response,'old frozen page retry changed');
      end loop;
    end;$verify$;
    select jsonb_build_object('personalSourceFusionUpgrade',
      'PASS: old duplicate contribution reproduced; populated rows, frozen pages and exact function metadata retained') snapshot;
    rollback;`;
}
