import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { personalNativeDecayFixtureSql } from './personal-native-decay.mjs';

// Exact reviewed predecessor transformations; the populated verifier rejects
// every additional changed byte in an installed body.
export const personalWorkingResetPatches = [
  {
    "signature": "private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamp with time zone)",
    "sourceMd5": "a74fb57a11ba2d5478c093f67606027a",
    "replacements": [
      {
        "before": "  schema jsonb; artifact jsonb; config jsonb; refs jsonb; current_session jsonb;",
        "after": "  schema jsonb; artifact jsonb; config jsonb; refs jsonb; current_session jsonb;\n  reset_at double precision; reset_controls jsonb := '[]'; reset_sources jsonb := '[]';\n  reset_control_count integer := 0;",
        "count": 1
      },
      {
        "before": "  ), session_prefix as materialized (",
        "after": "  ), reset_controls as materialized (\n    select r.id as \"resetId\",r.reset_at as \"resetAt\",r.created_at as \"createdAt\",\n      jsonb_build_object('sourceId','kajo-personal-working-reset-v1','recordId',r.id) as \"sourceRef\"\n    from private.personal_working_resets r join selected_session s\n      on s.id=r.session_id and s.actor_user_id=r.actor_user_id and s.profile_id=r.profile_id\n    where r.actor_user_id=actor and r.profile_id=profile and r.session_id=session\n      and pg_catalog.isfinite(r.reset_at) and pg_catalog.isfinite(r.created_at)\n      and r.reset_at>='epoch'::timestamptz and r.created_at>='epoch'::timestamptz\n      and r.reset_at<=cutoff and r.created_at<=cutoff\n    order by r.reset_at,r.created_at,r.id limit 129\n  ), session_prefix as materialized (",
        "count": 1
      },
      {
        "before": "    'session',(select to_jsonb(s) from selected_session s),",
        "after": "    'session',(select to_jsonb(s) from selected_session s),\n    'resetControls',coalesce((select jsonb_agg(to_jsonb(r) order by r.\"resetAt\",r.\"createdAt\",r.\"resetId\")\n      from reset_controls r),'[]'::jsonb),",
        "count": 1
      },
      {
        "before": "  status := case when current_session is null then 'NO_SESSION' else 'EMPTY' end;",
        "after": "  status := case when current_session is null then 'NO_SESSION' else 'EMPTY' end;\n  reset_control_count := jsonb_array_length(snapshot->'resetControls');",
        "count": 1
      },
      {
        "before": "'version','native-working-capture-v1'",
        "after": "'version','native-working-capture-v2'",
        "count": 1
      },
      {
        "before": "    'config',config,'availabilityBasis','STORED_CREATED_TIME','commitAvailability','UNKNOWN',",
        "after": "    'config',config,'resetControlConfig',jsonb_build_object('maxRecords',128),\n    'resetControlCount',case when reset_control_count>128 then null else reset_control_count end,\n    'resetControlCountLowerBound',reset_control_count,'resetControlPrefixComplete',reset_control_count<=128,\n    'availabilityBasis','STORED_CREATED_TIME','commitAvailability','UNKNOWN',",
        "count": 1
      },
      {
        "before": "    or jsonb_array_length(snapshot->'itemSnapshots')>32 or jsonb_array_length(snapshot->'dimensions')>32 then",
        "after": "    or jsonb_array_length(snapshot->'itemSnapshots')>32 or jsonb_array_length(snapshot->'dimensions')>32\n    or reset_control_count>128 then",
        "count": 1
      },
      {
        "before": "      'items',jsonb_array_length(snapshot->'itemSnapshots')>32,'features',jsonb_array_length(snapshot->'dimensions')>32));",
        "after": "      'items',jsonb_array_length(snapshot->'itemSnapshots')>32,'features',jsonb_array_length(snapshot->'dimensions')>32,\n      'resetControls',reset_control_count>128),'resetControlPrefixComplete',false);",
        "count": 1
      },
      {
        "before": "snapshot := snapshot||jsonb_build_object('rawEvents','[]'::jsonb,'itemSnapshots','[]'::jsonb,'dimensions','[]'::jsonb);",
        "after": "snapshot := snapshot||jsonb_build_object('rawEvents','[]'::jsonb,'itemSnapshots','[]'::jsonb,'dimensions','[]'::jsonb,'resetControls','[]'::jsonb);",
        "count": 2
      },
      {
        "before": "    for source_time in select (current_session->>'started_at')::timestamptz",
        "after": "    if exists(select 1 from jsonb_array_elements(snapshot->'resetControls') r\n      where (r->>'resetAt')::timestamptz<(current_session->>'started_at')::timestamptz) then\n      unavailable_reason := 'UNSUPPORTED_RESET_BOUNDARY';\n    end if;\n    for source_time in select (current_session->>'started_at')::timestamptz",
        "count": 1
      },
      {
        "before": "      union all select (value->>'created_at')::timestamptz from jsonb_array_elements(snapshot->'rawEvents') loop",
        "after": "      union all select (value->>'created_at')::timestamptz from jsonb_array_elements(snapshot->'rawEvents')\n      union all select (value->>'resetAt')::timestamptz from jsonb_array_elements(snapshot->'resetControls')\n      union all select (value->>'createdAt')::timestamptz from jsonb_array_elements(snapshot->'resetControls') loop",
        "count": 1
      },
      {
        "before": "    result := result||jsonb_build_object('prefixComplete',false,'inputUnavailableReason',unavailable_reason);",
        "after": "    result := result||jsonb_build_object('prefixComplete',false,'resetControlPrefixComplete',false,'inputUnavailableReason',unavailable_reason);",
        "count": 1
      },
      {
        "before": "  -- Native inactive envelopes may have no dimensions.",
        "after": "  -- Freeze all visible controls, including tie lineage, without placing resets\n  -- among taste records or renewing Item-linked activity/the session start.\n  for event in select value from jsonb_array_elements(snapshot->'resetControls') loop\n    source_instants := '{}';\n    foreach source_time in array array[(event->>'resetAt')::timestamptz,(event->>'createdAt')::timestamptz] loop\n      source_base := floor(extract(epoch from source_time))*1000;\n      source_micros := (extract(epoch from source_time)-floor(extract(epoch from source_time)))*1000000;\n      source_instants := array_append(source_instants,source_base+source_micros/1000);\n    end loop;\n    reset_controls := reset_controls||jsonb_build_array(event||jsonb_build_object(\n      'resetAt',source_instants[1],'createdAt',source_instants[2]));\n    reset_at := greatest(reset_at,source_instants[1]);\n  end loop;\n  select coalesce(jsonb_agg(value->'sourceRef' order by value->>'resetId'),'[]'::jsonb)\n    into reset_sources from jsonb_array_elements(reset_controls)\n    where (value->>'resetAt')::double precision=reset_at;\n  -- Native inactive envelopes may have no dimensions.",
        "count": 1
      },
      {
        "before": "      if record->>'sessionRef'=refs->>'sessionRef' and (record->>'occurredAt')::double precision>=started_at then",
        "after": "      if record->>'sessionRef'=refs->>'sessionRef' and (record->>'occurredAt')::double precision>=started_at\n        and (reset_at is null or (record->>'occurredAt')::double precision>reset_at) then",
        "count": 1
      },
      {
        "before": "        when (record->>'occurredAt')::double precision<started_at then 'BEFORE_SESSION_OR_RESET' else null end;",
        "after": "        when (record->>'occurredAt')::double precision<started_at\n          or (reset_at is not null and (record->>'occurredAt')::double precision<=reset_at)\n          then 'BEFORE_SESSION_OR_RESET' else null end;",
        "count": 1
      },
      {
        "before": "and (value->>'occurredAt')::double precision>=started_at order by 1 loop",
        "after": "and (value->>'occurredAt')::double precision>=started_at\n        and (reset_at is null or (value->>'occurredAt')::double precision>reset_at) order by 1 loop",
        "count": 2
      },
      {
        "before": "      when jsonb_array_length(items)=0 then 'EMPTY'",
        "after": "      when jsonb_array_length(items)=0 then case when reset_at is null then 'EMPTY' else 'RESET_EMPTY' end",
        "count": 1
      },
      {
        "before": "  return result||jsonb_build_object('status',status,'featureSchema',schema,'rawEvents',raw_events,'itemFeatures',objects,",
        "after": "  return result||jsonb_build_object('status',status,'resetAt',reset_at,'resetControls',reset_controls,\n    'resetSourceRefs',reset_sources,'featureSchema',schema,'rawEvents',raw_events,'itemFeatures',objects,",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.personal_working_adjustment_v1(jsonb,text[],text)",
    "sourceMd5": "56574ae6f435e5096fc070a855912b38",
    "replacements": [
      {
        "before": "  if capture->>'version' is distinct from 'native-working-capture-v1' then",
        "after": "  if capture->>'version' is null or capture->>'version' not in('native-working-capture-v1','native-working-capture-v2') then",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.personal_working_explanation_v1(jsonb,text[])",
    "sourceMd5": "4954e549ad078c16371beee010d3531a",
    "replacements": [
      {
        "before": "'workingIntent',jsonb_build_object('version','personal-working-features-v1',",
        "after": "'workingIntent',jsonb_build_object('version',case when capture->>'version'='native-working-capture-v2'\n        then 'personal-working-features-v2' else 'personal-working-features-v1' end,",
        "count": 1
      },
      {
        "before": "      'learnable',false,'historicalFeatureEligible',false,'nativeActivated',false)) end;",
        "after": "      'learnable',false,'historicalFeatureEligible',false,'nativeActivated',false)\n      || case when capture->>'version'='native-working-capture-v2' then jsonb_build_object(\n        'captureVersion',capture->'version','resetAt',capture->'resetAt','resetSourceRefs',capture->'resetSourceRefs')\n        else '{}'::jsonb end) end;",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.open_prediction_window_v1(uuid)",
    "sourceMd5": "fd8a2811cd6fdebab68164f501583bea",
    "replacements": [
      {
        "before": "      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v1') then",
        "after": "      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v1'\n      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v2') then",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.prediction_candidate_score_working_v1(text,jsonb,double precision,jsonb,text)",
    "sourceMd5": "4e7012a8d735cc2109f411fb51670937",
    "replacements": [
      {
        "before": "  if intent->>'version' is distinct from 'personal-working-features-v1'",
        "after": "  if (intent->>'version' is null or intent->>'version' not in('personal-working-features-v1','personal-working-features-v2'))",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.record_personal_working_shadow_v1(uuid,text)",
    "sourceMd5": "89d3883eaa38875dfa9b2d22aab1c9ae",
    "replacements": [
      {
        "before": "  if capture->>'version' is distinct from 'native-working-capture-v1'\n    or not('personal-working-off-v1'=any(string_to_array(source.policy_version,'+')))",
        "after": "  if capture->>'version' is null or capture->>'version' not in('native-working-capture-v1','native-working-capture-v2')\n    or not(case when capture->>'version'='native-working-capture-v2' then 'personal-working-off-v2'\n      else 'personal-working-off-v1' end=any(string_to_array(source.policy_version,'+')))",
        "count": 1
      },
      {
        "before": "or c.explanation#>>'{workingIntent,version}' is distinct from 'personal-working-features-v1'",
        "after": "or c.explanation#>>'{workingIntent,version}' is distinct from case\n          when capture->>'version'='native-working-capture-v2' then 'personal-working-features-v2' else 'personal-working-features-v1' end",
        "count": 1
      },
      {
        "before": "  result := jsonb_build_object('version','personal-working-shadow-v1','sourcePredictionId',source.id,",
        "after": "  result := jsonb_build_object('version',case when capture->>'version'='native-working-capture-v2'\n      then 'personal-working-shadow-v2' else 'personal-working-shadow-v1' end,'sourcePredictionId',source.id,",
        "count": 1
      },
      {
        "before": "  insert into private.personal_working_shadow_comparisons(source_prediction_id,control,result)",
        "after": "  if capture->>'version'='native-working-capture-v2' then\n    result := result||jsonb_build_object('captureVersion',capture->'version',\n      'resetAt',capture->'resetAt','resetSourceRefs',capture->'resetSourceRefs');\n  end if;\n  insert into private.personal_working_shadow_comparisons(source_prediction_id,control,result)",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "ba0f54b3e35f66778dae442f298f3087",
    "replacements": [
      {
        "before": "'+personal-working-off-v1'",
        "after": "'+personal-working-off-v2'",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "2504838fb61fd793dd0dc40a3c37f0bf",
    "replacements": [
      {
        "before": "'+personal-working-off-v1'",
        "after": "'+personal-working-off-v2'",
        "count": 1
      }
    ]
  }
];

export async function personalWorkingResetSmokeSql() {
  const fixture = await readFile(new URL('personal-working-reset-fixture.sql', import.meta.url), 'utf8');
  return `begin;${fixture}\nrollback;`;
}

// Runs over the actual populated pre-reset source, including real Personal and
// Shared BOOK/MOVIE V2/V3 forecasts and their already recorded native shadows.
// The SQL receipt proves source preservation; it makes no concurrency claim.
export async function personalWorkingResetUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_personal_working_reset.sql'), 'Expected one new bounded Personal Working reset forward');
  assert.equal(personalWorkingResetPatches.length, 8, 'Only eight reviewed installed bodies may change');
  const literal = value => `$reset_upgrade_text$${value}$reset_upgrade_text$`;
  const patches = personalWorkingResetPatches.flatMap(patch => patch.replacements.map((replacement, ordinal) =>
    `(${literal(patch.signature)}::regprocedure::text,${ordinal},${literal(replacement.before)},${literal(replacement.after)},${replacement.count})`)).join(',\n');
  return `begin;
    ${await personalNativeDecayFixtureSql()}
    do $old_comparisons$ declare r record;control text;begin
      for r in select p.* from private.prediction_runs p join pg_temp.native_decay_sources s on s.id=p.id
        join public.profiles profile on profile.id=p.profile_id where profile.profile_type='PERSONAL' loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        foreach control in array array['OFF','STATIC','ORDERED'] loop
          perform private.record_personal_working_shadow_v1(r.id,control);
        end loop;
      end loop;
    end;$old_comparisons$;
    create temp table reset_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.reset_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table reset_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.reset_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table reset_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,
      pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_temp.reset_upgrade_tables r on r.oid=k.conrelid;
    create temp table reset_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.reset_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table reset_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body,pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table reset_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.reset_upgrade_tables r on r.oid=t.tgrelid;
    create temp table reset_upgrade_patches(identity text,ordinal integer,before text,after text,expected_count integer) on commit drop;
    insert into pg_temp.reset_upgrade_patches values ${patches};
    -- Challenge explicit new-object revokes under broad default permissions.
    alter default privileges for role postgres grant execute on functions to public;
    alter default privileges for role postgres grant select,insert,update,delete on tables to public;
    ${migration.sql}
    do $verify$ declare r record;p record;expected text;digest text;page record;result jsonb;role_name text;signature text;begin
      for r in select * from pg_temp.reset_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Personal working reset forward changed an old table identity/owner/ACL/RLS: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Personal working reset forward changed a populated old row: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.reset_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Personal working reset forward changed an old column/default identity or definition';end if;
      if exists(select 1 from pg_temp.reset_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Personal working reset forward changed an old constraint';end if;
      if exists(select 1 from pg_temp.reset_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition) then raise exception 'Personal working reset forward changed an old index';end if;
      for r in select * from pg_temp.reset_upgrade_functions loop
        if not exists(select 1 from pg_proc f where f.oid=r.oid and to_jsonb(f)-'prosrc' is not distinct from r.properties) then
          raise exception 'Personal working reset forward changed an old function identity/owner/ACL/config: %',r.identity;end if;
        expected := r.body;
        for p in select * from pg_temp.reset_upgrade_patches where identity=r.identity order by ordinal loop
          if cardinality(string_to_array(expected,p.before))<>p.expected_count+1 then
            raise exception 'Personal working reset approved source anchor unavailable: %',r.identity;end if;
          expected := replace(expected,p.before,p.after);
        end loop;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Personal working reset forward changed an old body beyond approved exact patches: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.reset_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Personal working reset forward changed an old trigger';end if;
      for page in select * from pg_temp.native_decay_pages loop
        perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
        result := public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
        if result is distinct from page.response then raise exception 'Personal working reset forward changed an exact old V2/V3 page receipt';end if;
      end loop;
      for r in select c.*,source_run.actor_user_id from private.personal_working_shadow_comparisons c
        join private.prediction_runs source_run on source_run.id=c.source_prediction_id loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        result := private.record_personal_working_shadow_v1(r.source_prediction_id,r.control);
        if result is distinct from r.result then raise exception 'Personal working reset changed an exact old v1 comparison receipt';end if;
      end loop;
      for r in select * from pg_temp.reset_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Personal working reset receipt retry mutated old rows: %',r.identity;end if;
      end loop;
      foreach role_name in array array['anon','authenticated','service_role'] loop
        foreach signature in array array[
          'private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamptz)',
          'private.personal_working_adjustment_v1(jsonb,text[],text)',
          'private.personal_working_explanation_v1(jsonb,text[])',
          'private.prediction_candidate_score_working_v1(text,jsonb,double precision,jsonb,text)',
          'private.guard_personal_working_comparison_v1()',
          'private.record_personal_working_shadow_v1(uuid,text)',
          'private.guard_personal_working_reset_v1()',
          'private.commit_personal_working_reset_v1(uuid,uuid,uuid,uuid)'] loop
          if has_function_privilege(role_name,signature,'EXECUTE') then
            raise exception 'Personal working reset helper retained broad default EXECUTE: %/%',role_name,signature;end if;
        end loop;
        if has_table_privilege(role_name,'private.personal_working_resets','SELECT,INSERT,UPDATE,DELETE')
          or has_table_privilege(role_name,'private.personal_working_shadow_comparisons','SELECT,INSERT,UPDATE,DELETE') then
          raise exception 'Personal working reset comparison retained broad default table permission: %',role_name;end if;
      end loop;
    end;$verify$;
    select jsonb_build_object('personalWorkingResetUpgrade',
      'PASS: every populated old application/Auth row and existing object preserved; only eight reviewed installed bodies change; old V2/V3 receipts and native shadows remain exact; new private ACL overrides broad defaults') snapshot;
    rollback;`;
}
