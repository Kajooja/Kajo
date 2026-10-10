// Exact reviewed predecessor transformations. The populated verifier rejects
// every additional changed byte or function metadata change, including precision.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {personalNativeDecayFixtureSql} from './personal-native-decay.mjs';

export const personalWorkingCandidateFeaturePatches = [
  {
    "signature": "private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamp with time zone)",
    "sourceMd5": "9173d5e8223c82fd6abb6777074d2d9d",
    "replacements": [
      {
        "before": "'version','native-working-capture-v2'",
        "after": "'version','native-working-capture-v3'",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.personal_working_adjustment_v1(jsonb,text[],text)",
    "sourceMd5": "bfe5f76d9d8d2667fff6238c95aaf879",
    "replacements": [
      {
        "before": "'native-working-capture-v1','native-working-capture-v2'",
        "after": "'native-working-capture-v1','native-working-capture-v2','native-working-capture-v3'",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.personal_working_explanation_v1(jsonb,text[])",
    "sourceMd5": "094d3dbe5dc04f4cde430c748e711b93",
    "replacements": [
      {
        "before": "  select case",
        "after": "  -- Candidate tags belong to this ranking statement, which can observe a later\n  -- READ COMMITTED snapshot than the earlier state capture. asOf binds the input\n  -- cutoff; it does not certify candidate availability at that historical time.\n  with dimensions as (\n    select case when jsonb_typeof(capture#>'{featureSchema,dimensions}')='array'\n      then capture#>'{featureSchema,dimensions}' else '[]'::jsonb end values\n  ), candidate_feature_state as (\n    select values,case\n      when capture->>'status' is distinct from 'ACTIVE' then 'CAPTURE_INACTIVE'\n      when capture->'prefixComplete' is distinct from 'true'::jsonb then 'INCOMPLETE_CAPTURE'\n      when jsonb_typeof(capture#>'{featureSchema,dimensions}') is distinct from 'array'\n        or jsonb_array_length(values)>32 then 'INVALID_FEATURE_SCHEMA'\n      when jsonb_array_length(values)=0 then 'EMPTY_FEATURE_SCHEMA'\n      when exists(select 1 from jsonb_array_elements(values) d(value)\n        where jsonb_typeof(d.value) is distinct from 'string'\n          or length(d.value#>>'{}')=0 or length(d.value#>>'{}')+(\n            select count(*) from pg_catalog.regexp_split_to_table(d.value#>>'{}','') c(character)\n            where pg_catalog.ascii(c.character)>65535)>256 or (d.value#>>'{}')~'[[:cntrl:]]')\n        or (select count(distinct value) from jsonb_array_elements(values))<>jsonb_array_length(values)\n        then 'INVALID_FEATURE_SCHEMA'\n      else null end unavailable_reason\n    from dimensions\n  )\n  select case",
        "count": 1
      },
      {
        "before": "case when capture->>'version'='native-working-capture-v2'\n        then 'personal-working-features-v2'",
        "after": "case when capture->>'version'='native-working-capture-v3' then 'personal-working-features-v3'\n        when capture->>'version'='native-working-capture-v2' then 'personal-working-features-v2'",
        "count": 1
      },
      {
        "before": "case when capture->>'version'='native-working-capture-v2' then jsonb_build_object(",
        "after": "case when capture->>'version' in('native-working-capture-v2','native-working-capture-v3') then jsonb_build_object(",
        "count": 1
      },
      {
        "before": "        else '{}'::jsonb end) end;",
        "after": "        else '{}'::jsonb end\n      || case when capture->>'version'='native-working-capture-v3' then jsonb_build_object(\n        'candidateFeatures',jsonb_build_object('version','native-working-candidate-features-v1',\n          'status',case when unavailable_reason is null then 'AVAILABLE' else 'UNAVAILABLE' end,\n          'captureId',capture->'captureId','asOf',capture->'asOf',\n          'featureSchemaRef',jsonb_build_object('id',capture#>'{featureSchema,id}',\n            'version',capture#>'{featureSchema,version}','artifactId',capture#>'{featureSchema,artifact,id}',\n            'artifactVersion',capture#>'{featureSchema,artifact,version}',\n            'representationVersion',capture#>'{featureSchema,artifact,representationVersion}',\n            'dimensionCount',jsonb_array_length(values)),\n          'featureEncoding','CAPTURE_DIMENSION_ORDER_BINARY_V1',\n          'availabilityBasis','SOURCE_RANKING_STATEMENT_SNAPSHOT','availableAt',null,'commitAvailability','UNKNOWN',\n          'historicalFeatureEligible',false,'learnable',false,'nativeActivated',false,\n          'features',case when unavailable_reason is null then (\n            select jsonb_agg(case when coalesce(d.dimension=any(candidate_tags),false) then 1 else 0 end\n              order by d.ordinality) from jsonb_array_elements_text(values) with ordinality d(dimension,ordinality)) else null end,\n          'unavailableReason',unavailable_reason)) else '{}'::jsonb end) end\n  from candidate_feature_state;",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.open_prediction_window_v1(uuid)",
    "sourceMd5": "79dd4614da707a9e8ea196cb421c6130",
    "replacements": [
      {
        "before": "      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v2') then",
        "after": "      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v2'\n      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v3') then",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.prediction_candidate_score_working_v1(text,jsonb,double precision,jsonb,text)",
    "sourceMd5": "07e312f97f81ccac94a9546cd9fc8145",
    "replacements": [
      {
        "before": "'personal-working-features-v1','personal-working-features-v2'",
        "after": "'personal-working-features-v1','personal-working-features-v2','personal-working-features-v3'",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.record_personal_working_shadow_v1(uuid,text)",
    "sourceMd5": "0f13cc96568e3fc72d944c62ef27340e",
    "replacements": [
      {
        "before": "'native-working-capture-v1','native-working-capture-v2'",
        "after": "'native-working-capture-v1','native-working-capture-v2','native-working-capture-v3'",
        "count": 1
      },
      {
        "before": "case when capture->>'version'='native-working-capture-v2' then 'personal-working-off-v2'",
        "after": "case when capture->>'version'='native-working-capture-v3' then 'personal-working-off-v3'\n      when capture->>'version'='native-working-capture-v2' then 'personal-working-off-v2'",
        "count": 1
      },
      {
        "before": "when capture->>'version'='native-working-capture-v2' then 'personal-working-features-v2'",
        "after": "when capture->>'version'='native-working-capture-v3' then 'personal-working-features-v3'\n          when capture->>'version'='native-working-capture-v2' then 'personal-working-features-v2'",
        "count": 1
      },
      {
        "before": "  select g.config into strict config",
        "after": "  -- The compact projection references the exact source-owned capture/schema;\n  -- aligned binary values use its original dimension order. Never duplicate the\n  -- full schema/feature keys across the bounded 50-candidate continuation pool.\n  -- Comparisons reference this source instead of copying arrays into the receipt.\n  if capture->>'version'='native-working-capture-v3' and exists(\n    select 1 from private.prediction_candidates c where c.prediction_id=source.id and (\n      (c.explanation#>'{workingIntent,candidateFeatures}')-'features' is distinct from\n        (private.personal_working_explanation_v1(capture,'{}'::text[])#>'{workingIntent,candidateFeatures}')-'features'\n      or (c.explanation#>>'{workingIntent,candidateFeatures,status}'='AVAILABLE' and (\n        jsonb_typeof(c.explanation#>'{workingIntent,candidateFeatures,features}') is distinct from 'array'\n        or jsonb_array_length(case when jsonb_typeof(c.explanation#>'{workingIntent,candidateFeatures,features}')='array'\n          then c.explanation#>'{workingIntent,candidateFeatures,features}' else '[]'::jsonb end)\n          <>jsonb_array_length(capture#>'{featureSchema,dimensions}')\n        or exists(select 1 from jsonb_array_elements(case\n          when jsonb_typeof(c.explanation#>'{workingIntent,candidateFeatures,features}')='array'\n          then c.explanation#>'{workingIntent,candidateFeatures,features}' else '[]'::jsonb end) f(value)\n          where f.value not in('0'::jsonb,'1'::jsonb))))\n      or (c.explanation#>>'{workingIntent,candidateFeatures,status}'='UNAVAILABLE'\n        and c.explanation#>'{workingIntent,candidateFeatures,features}' is distinct from 'null'::jsonb))) then\n    raise exception 'Missing or inconsistent frozen Personal candidate features' using errcode='55000';\n  end if;\n  select g.config into strict config",
        "count": 1
      },
      {
        "before": "case when capture->>'version'='native-working-capture-v2'\n      then 'personal-working-shadow-v2'",
        "after": "case when capture->>'version'='native-working-capture-v3' then 'personal-working-shadow-v3'\n      when capture->>'version'='native-working-capture-v2' then 'personal-working-shadow-v2'",
        "count": 1
      },
      {
        "before": "  if capture->>'version'='native-working-capture-v2' then",
        "after": "  if capture->>'version' in('native-working-capture-v2','native-working-capture-v3') then",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "af378f6b3aab9c24073d18d75687977b",
    "replacements": [
      {
        "before": "'+personal-working-off-v2'",
        "after": "'+personal-working-off-v3'",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "c47e1ccb7ba9737e493a4553bb074e87",
    "replacements": [
      {
        "before": "'+personal-working-off-v2'",
        "after": "'+personal-working-off-v3'",
        "count": 1
      }
    ]
  }
];

async function activePredecessorSourceSql(namespace,version) {
  const fixture=await readFile(new URL('personal-working-bridge-fixture.sql',import.meta.url),'utf8');
  const boundary="  shadow_off := private.record_personal_working_shadow_v1(source_id,'OFF');";
  assert.equal(fixture.split(boundary).length,2,'Actual active source fixture boundary changed');
  return fixture.slice(0,fixture.indexOf(boundary))
    .replace('create function pg_temp.working_assert','create or replace function pg_temp.working_assert')
    .replaceAll('a9147000',`a9167${String(namespace).padStart(3,'0')}`)
    .replaceAll('working-native-candidate:',`candidate-predecessor-${namespace}:`)
    .replaceAll('Native Working fixture',`Candidate predecessor ${namespace}`)
    +`\n  perform pg_temp.working_assert(frozen_source#>>'{state_snapshot,workingState,version}'='${version}',
        'genuine active predecessor source generation');
      insert into pg_temp.candidate_upgrade_pages values(actor,page_request,page);
    end;$native_working$;`;
}

// Two genuine inputs with the maximum accepted 32 dimensions and 256 UTF-16
// units per tag. This already fits the historical V2 snapshot byte ceiling;
// empty-tag candidates isolate the new feature serialization overhead.
const longDimensionPredecessorSql=`
  create temp table candidate_long_fixture(actor uuid,profile uuid,session uuid,request jsonb,response jsonb,bytes bigint) on commit drop;
  do $long_predecessor$ declare
    actor uuid:='a9169001-0000-4000-8000-000000000001';profile uuid;
    session uuid:='a9169001-0000-4000-8000-000000000010';
    evidence_a uuid:='a9169001-0000-4000-8000-000000000020';evidence_b uuid:='a9169001-0000-4000-8000-000000000021';
    tags_a text[];tags_b text[];command jsonb;request jsonb;page jsonb;source_id uuid;size bigint;
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Candidate byte bounds'));
    select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
    select array_agg(repeat(chr(2048),253)||lpad(n::text,3,'0') order by n) into tags_a from generate_series(0,31) n where n%2=0;
    select array_agg(repeat(chr(2048),253)||lpad(n::text,3,'0') order by n) into tags_b from generate_series(0,31) n where n%2=1;
    update public.items set discoverable=false;
    insert into public.items(id,item_type,title,tags,discoverable) values
      (evidence_a,'BOOK','Byte-bound evidence A',tags_a,false),(evidence_b,'BOOK','Byte-bound evidence B',tags_b,false);
    insert into public.items(id,item_type,title,tags,discoverable)
      select md5('candidate-long-feature-pool:'||n)::uuid,'BOOK','Byte-bound candidate '||n,'{}'::text[],true from generate_series(1,50) n;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    command:=jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',profile,'itemId',evidence_a,
      'occurredAt',now()-interval '4 minutes','discoveryMode','FOR_YOU','predictionId',null,
      'session',jsonb_build_object('sessionId',session,'startedAt',now()-interval '5 minutes','context','{}'::jsonb),'kind','SET_RATING','rating',10);
    perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
    command:=command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_b,'occurredAt',now()-interval '3 minutes');
    perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
    request:=jsonb_build_object('version',2,'requestId',gen_random_uuid(),'profileId',profile,'sessionId',session,
      'discoveryMode','FOR_YOU','itemType','BOOK','limit',50,'context','{}'::jsonb);
    perform set_config('role','authenticated',true);page:=public.rank_items_page_v1(request);perform set_config('role','postgres',true);
    source_id:=(page->>'predictionId')::uuid;
    select octet_length(w.source_snapshot::text) into strict size from private.prediction_continuation_windows w where w.source_prediction_id=source_id;
    if not exists(select 1 from private.prediction_runs r where r.id=source_id and r.candidate_count=50
      and r.state_snapshot#>>'{workingState,version}'='native-working-capture-v2' and r.state_snapshot#>>'{workingState,status}'='ACTIVE'
      and r.state_snapshot#>>'{workingState,support,distinctItems}'='2'
      and jsonb_array_length(r.state_snapshot#>'{workingState,featureSchema,dimensions}')=32)
      or size>2097152 then raise exception 'Candidate long-dimension predecessor must be a real supported V2 source';end if;
    insert into pg_temp.candidate_upgrade_pages values(actor,request,page);
    insert into pg_temp.candidate_long_fixture values(actor,profile,session,request,page,size);
  end;$long_predecessor$;
`;

const longDimensionSuccessorSql=`
  do $long_successor$ declare fixture record;request jsonb;page jsonb;source_id uuid;size bigint;capture jsonb;
    shadow jsonb;encoding jsonb;
  begin
    select * into strict fixture from pg_temp.candidate_long_fixture;
    perform set_config('request.jwt.claim.sub',fixture.actor::text,true);
    perform set_config('extra_float_digits','0',true);
    request:=fixture.request||jsonb_build_object('requestId',gen_random_uuid());
    perform set_config('role','authenticated',true);page:=public.rank_items_page_v1(request);perform set_config('role','postgres',true);
    source_id:=(page->>'predictionId')::uuid;
    select octet_length(w.source_snapshot::text) into strict size from private.prediction_continuation_windows w where w.source_prediction_id=source_id;
    select state_snapshot->'workingState' into strict capture from private.prediction_runs where id=source_id;
    if capture->>'version'<>'native-working-capture-v3' or capture->>'status'<>'ACTIVE'
      or jsonb_array_length(capture#>'{featureSchema,dimensions}')<>32
      or size>2097152 or (select candidate_count from private.prediction_runs where id=source_id)<>50 then
      raise exception 'Candidate compact long-dimension V2 source must retain the existing snapshot byte bound';end if;
    select jsonb_agg(0 order by n) into encoding from generate_series(1,32) n;
    if exists(select 1 from private.prediction_candidates c where c.prediction_id=source_id and (
      c.explanation#>>'{workingIntent,candidateFeatures,status}'<>'AVAILABLE'
      or c.explanation#>>'{workingIntent,candidateFeatures,featureEncoding}'<>'CAPTURE_DIMENSION_ORDER_BINARY_V1'
      or c.explanation#>'{workingIntent,candidateFeatures,features}' is distinct from encoding
      or c.explanation#>>'{workingIntent,candidateFeatures,featureSchemaRef,dimensionCount}'<>'32'
      or c.explanation#>'{workingIntent,candidateFeatures}' ? 'featureSchema')) then
      raise exception 'Candidate compact long-dimension vectors must bind the complete source schema without duplicated names';end if;
    shadow:=private.record_personal_working_shadow_v1(source_id,'OFF');
    if exists(select 1 from (select * from private.prediction_candidates where prediction_id=source_id) p
      full join jsonb_array_elements(shadow->'candidates') s(value) on p.item_id=(s.value->>'itemId')::uuid
      where p.item_id is null or s.value is null
        or float8send(p.final_score) is distinct from float8send((s.value->>'score')::double precision)
        or p.final_rank is distinct from (s.value->>'rank')::integer
        or p.selected_for_delivery is distinct from (s.value->>'selected')::boolean
        or private.prediction_delivery_tier_v1(p.explanation->'resurfacingPolicy') is distinct from (s.value->>'tier')::integer
        or coalesce((p.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) is distinct from (s.value->>'eligible')::boolean
        or (s.value->>'adjustment')::double precision is distinct from 0::double precision) then
      raise exception 'Candidate compact long-dimension source must preserve exact OFF binary delivery parity';end if;
    perform set_config('role','authenticated',true);
    if public.rank_items_page_v1(fixture.request) is distinct from fixture.response or public.rank_items_page_v1(request) is distinct from page then
      raise exception 'Candidate long-dimension actual pre/post V2 receipts must retry exactly';end if;
    perform set_config('role','postgres',true);
    if current_setting('extra_float_digits')<>'0' then raise exception 'Candidate compact source must restore caller precision0';end if;
  end;$long_successor$;
`;

// Caller installs the actual pre-reset lineage. This disposable matrix first
// creates genuine v1 sources, then reset-aware v2 sources; precision72 applies
// before the feature-forward metadata snapshot and must remain exact afterwards.
export async function personalWorkingCandidateFeaturesUpgradeSql(resetMigration,precisionMigration,migration) {
  assert.ok(resetMigration.name.endsWith('_personal_working_reset.sql'));
  assert.ok(precisionMigration.name.endsWith('_personal_working_shadow_precision.sql'));
  assert.ok(migration.name.endsWith('_personal_working_candidate_features.sql'));
  assert.equal(personalWorkingCandidateFeaturePatches.length,8,'Only eight reviewed installed bodies may change');
  const literal=value=>`$candidate_upgrade_text$${value}$candidate_upgrade_text$`;
  const patches=personalWorkingCandidateFeaturePatches.flatMap(patch=>patch.replacements.map((replacement,ordinal)=>
    `(${literal(patch.signature)}::regprocedure::text,${ordinal},${literal(replacement.before)},${literal(replacement.after)},${replacement.count})`)).join(',\n');
  return `begin;set local extra_float_digits=3;
    ${await personalNativeDecayFixtureSql()}
    create temp table candidate_upgrade_pages(actor uuid,request jsonb,response jsonb) on commit drop;
    ${await activePredecessorSourceSql(1,'native-working-capture-v1')}
    ${resetMigration.sql}
    ${await activePredecessorSourceSql(2,'native-working-capture-v2')}
    do $v2_sources$ declare fixture record;domain text;protocol integer;begin
      select * into strict fixture from pg_temp.native_decay_fixture;
      foreach domain in array array['BOOK','MOVIE'] loop foreach protocol in array array[2,3] loop
        perform pg_temp.decay_page(fixture.actor,fixture.personal,domain,protocol);
      end loop;end loop;
    end;$v2_sources$;
    ${longDimensionPredecessorSql}
    ${precisionMigration.sql}
    do $old_controls$ declare r record;control text;begin
      for r in select p.* from private.prediction_runs p join public.profiles profile on profile.id=p.profile_id
        where profile.profile_type='PERSONAL' loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        foreach control in array array['OFF','STATIC','ORDERED'] loop
          perform private.record_personal_working_shadow_v1(r.id,control);
        end loop;
      end loop;
    end;$old_controls$;
    create temp table candidate_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.candidate_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table candidate_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.candidate_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table candidate_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,pg_get_constraintdef(k.oid) definition
      from pg_constraint k join pg_temp.candidate_upgrade_tables r on r.oid=k.conrelid;
    create temp table candidate_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.candidate_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table candidate_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table candidate_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.candidate_upgrade_tables r on r.oid=t.tgrelid;
    create temp table candidate_upgrade_patches(identity text,ordinal integer,before text,after text,expected_count integer) on commit drop;
    insert into pg_temp.candidate_upgrade_patches values ${patches};
    ${migration.sql}
    do $verify$ declare r record;patch_record record;expected text;digest text;page record;result jsonb;begin
      if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth'))<>(select count(*) from pg_temp.candidate_upgrade_tables) then
        raise exception 'Candidate feature forward changed the installed table set';end if;
      for r in select * from pg_temp.candidate_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Candidate feature forward changed old table identity/owner/ACL/RLS: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Candidate feature forward changed populated old row bytes: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.candidate_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Candidate feature forward changed old column/default bytes';end if;
      if exists(select 1 from pg_temp.candidate_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Candidate feature forward changed old constraint bytes';end if;
      if exists(select 1 from pg_temp.candidate_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition) then raise exception 'Candidate feature forward changed old index bytes';end if;
      if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in('public','private','auth') and p.prokind='f')<>(select count(*) from pg_temp.candidate_upgrade_functions) then
        raise exception 'Candidate feature forward changed the installed function set';end if;
      for r in select * from pg_temp.candidate_upgrade_functions loop
        if not exists(select 1 from pg_proc f where f.oid=r.oid and to_jsonb(f)-'prosrc' is not distinct from r.properties) then
          raise exception 'Candidate feature forward changed old function identity/owner/ACL/config: %',r.identity;end if;
        expected:=r.body;
        for patch_record in select * from pg_temp.candidate_upgrade_patches where identity=r.identity order by ordinal loop
          if cardinality(string_to_array(expected,patch_record.before))<>patch_record.expected_count+1 then
            raise exception 'Candidate feature approved source anchor unavailable: %',r.identity;end if;
          expected:=replace(expected,patch_record.before,patch_record.after);
        end loop;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Candidate feature forward changed old body beyond approved exact patches: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.candidate_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Candidate feature forward changed old trigger bytes';end if;
      for page in select * from pg_temp.native_decay_pages union all select * from pg_temp.candidate_upgrade_pages loop
        perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
        result:=public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
        if result is distinct from page.response then raise exception 'Candidate feature forward changed old V2/V3 page receipt';end if;
      end loop;
      for r in select c.*,source.actor_user_id from private.personal_working_shadow_comparisons c
        join private.prediction_runs source on source.id=c.source_prediction_id loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        result:=private.record_personal_working_shadow_v1(r.source_prediction_id,r.control);
        if result is distinct from r.result then raise exception 'Candidate feature forward changed old v1/v2 comparison receipt';end if;
      end loop;
      for r in select * from pg_temp.candidate_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Candidate feature receipt retry mutated populated old rows: %',r.identity;end if;
      end loop;
    end;$verify$;
    ${longDimensionSuccessorSql}
    select jsonb_build_object('personalWorkingCandidateFeaturesUpgrade',
      'PASS: genuine v1/v2 active/inert Personal and Shared BOOK/MOVIE V2/V3 artifacts; all populated old rows and installed metadata exact; only eight reviewed bodies change; precision72 and retries preserved; actual pre/post V2 maximum-long-dimension pool stays inside unchanged 2MiB snapshot ceiling') snapshot;
    rollback;`;
}

export async function personalWorkingCandidateFeaturesSmokeSql() {
  const fixture=await readFile(new URL('personal-working-candidate-features-fixture.sql',import.meta.url),'utf8');
  return `begin;set local extra_float_digits=0;${fixture}\nrollback;`;
}
