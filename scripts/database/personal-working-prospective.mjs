import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { personalNativeDecayFixtureSql } from './personal-native-decay.mjs';

// Separate from migration text: the verifier permits only this reviewed eraser
// body replacement and preserves its OID, ACL, configuration and every attribute.
export const personalWorkingProspectiveEraserPatch = {
  signature: 'private.erase_prediction_sources_v1(text,uuid)',
  sourceMd5: '2eac4bba2e3486e3a78404dad3c0ffb7',
  before: `
    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)
    limit 250001) bounded;`,
  after: `
    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_working_enrollments e where e.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_working_outcome_allocations a where a.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_working_outcome_captures c where c.source_prediction_id=any(source_ids) or c.origin_prediction_ids && source_ids
    union all select 1 from private.personal_working_outcome_event_refs e join private.personal_working_outcome_captures c on c.id=e.capture_id
      where c.source_prediction_id=any(source_ids) or c.origin_prediction_ids && source_ids
    limit 250001) bounded;`,
};

// This acceptance owns committed setup, enrollment, observations and cleanup.
// An outer transaction would destroy the intended prospective clock boundary.
export async function personalWorkingProspectiveSmokeSql() {
  return readFile(new URL('personal-working-prospective-fixture.sql', import.meta.url), 'utf8');
}

// Caller installs the complete real candidate-features predecessor. The
// disposable verifier freezes actual Personal/Shared BOOK/MOVIE V2/V3 sources,
// including active v3 candidate features and immutable comparison receipts.
export async function personalWorkingProspectiveUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_personal_working_prospective.sql'), 'Expected one private prospective forward');
  const literal = value => `$prospective_upgrade_text$${value}$prospective_upgrade_text$`;
  const patch = personalWorkingProspectiveEraserPatch;
  return `begin;set local extra_float_digits=3;
    ${await personalNativeDecayFixtureSql()}
    create temp table prospective_upgrade_pages(actor uuid,request jsonb,response jsonb) on commit drop;
    do $active_v3_predecessor$
    declare f record;session uuid:=gen_random_uuid();domain text;protocol integer;request jsonb;page jsonb;source_id uuid;
    begin
      select * into strict f from pg_temp.native_decay_fixture;
      insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
        values(session,f.actor,f.personal,now()-interval '5 minutes','{}');
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,discovery_mode,properties)
        values(gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now()-interval '4 minutes',session,'FOR_YOU','{"rating":0}'),
          (gen_random_uuid(),f.actor,f.personal,f.opposite_evidence,'BOOK','ITEM_RATED',now()-interval '3 minutes',session,'FOR_YOU','{"rating":10}');
      perform set_config('request.jwt.claim.sub',f.actor::text,true);
      foreach domain in array array['BOOK','MOVIE'] loop foreach protocol in array array[2,3] loop
        request:=jsonb_build_object('version',protocol,'requestId',gen_random_uuid(),'profileId',f.personal,
          'sessionId',session,'discoveryMode','FOR_YOU','itemType',domain,'limit',2,'context','{}'::jsonb);
        perform set_config('role','authenticated',true);page:=public.rank_items_page_v1(request);perform set_config('role','postgres',true);
        source_id:=(page->>'predictionId')::uuid;
        if not exists(select 1 from private.prediction_runs r where r.id=source_id
          and r.state_snapshot#>>'{workingState,version}'='native-working-capture-v3'
          and r.state_snapshot#>>'{workingState,status}'='ACTIVE'
          and r.state_snapshot#>>'{workingState,support,distinctItems}'='2' and r.candidate_count>0)
          or exists(select 1 from private.prediction_candidates c where c.prediction_id=source_id
            and c.explanation#>>'{workingIntent,candidateFeatures,status}' is distinct from 'AVAILABLE') then
          raise exception 'Prospective upgrade requires actual active v3 candidate-feature predecessors';end if;
        insert into pg_temp.prospective_upgrade_pages values(f.actor,request,page);
      end loop;end loop;
    end;$active_v3_predecessor$;
    do $old_comparisons$ declare r record;control text;begin
      for r in select p.* from private.prediction_runs p join public.profiles profile on profile.id=p.profile_id
        where profile.profile_type='PERSONAL' loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        foreach control in array array['OFF','STATIC','ORDERED'] loop
          perform private.record_personal_working_shadow_v1(r.id,control);
        end loop;
      end loop;
    end;$old_comparisons$;
    create temp table prospective_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.prospective_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table prospective_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.prospective_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table prospective_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,pg_get_constraintdef(k.oid) definition
      from pg_constraint k join pg_temp.prospective_upgrade_tables r on r.oid=k.conrelid;
    create temp table prospective_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.prospective_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table prospective_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table prospective_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.prospective_upgrade_tables r on r.oid=t.tgrelid;
    do $approved_predecessor$ begin
      if (select md5(body) from pg_temp.prospective_upgrade_functions where oid=${literal(patch.signature)}::regprocedure)
        is distinct from ${literal(patch.sourceMd5)} then
        raise exception 'Prospective eraser approved exact predecessor body is unavailable';end if;
    end;$approved_predecessor$;
    alter default privileges for role postgres grant execute on functions to public;
    alter default privileges for role postgres grant select,insert,update,delete on tables to public;
    ${migration.sql}
    do $verify$ declare r record;expected text;digest text;page record;result jsonb;role_name text;signature text;relation_name text;begin
      if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth'))<>(select count(*)+4 from pg_temp.prospective_upgrade_tables) then
        raise exception 'Prospective forward changed the installed table set beyond four reviewed relations';end if;
      for r in select * from pg_temp.prospective_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Prospective forward changed old table identity/owner/ACL/RLS: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Prospective forward changed populated old row bytes: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.prospective_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Prospective forward changed old column/default bytes';end if;
      if exists(select 1 from pg_temp.prospective_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Prospective forward changed old constraint bytes';end if;
      if exists(select 1 from pg_temp.prospective_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition) then raise exception 'Prospective forward changed old index bytes';end if;
      if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in('public','private','auth') and p.prokind='f')<>(select count(*)+5 from pg_temp.prospective_upgrade_functions) then
        raise exception 'Prospective forward changed the installed function set beyond five reviewed helpers';end if;
      for r in select * from pg_temp.prospective_upgrade_functions loop
        if not exists(select 1 from pg_proc f where f.oid=r.oid and to_jsonb(f)-'prosrc' is not distinct from r.properties) then
          raise exception 'Prospective forward changed old function identity/owner/ACL/config: %',r.identity;end if;
        expected:=r.body;
        if r.oid=${literal(patch.signature)}::regprocedure then
          if cardinality(string_to_array(expected,${literal(patch.before)}))<>2 then
            raise exception 'Prospective eraser approved source anchor is unavailable';end if;
          expected:=replace(expected,${literal(patch.before)},${literal(patch.after)});
        end if;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Prospective forward changed old body beyond the approved exact eraser patch: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.prospective_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Prospective forward changed old trigger bytes';end if;
      for page in select * from pg_temp.native_decay_pages union all select * from pg_temp.prospective_upgrade_pages loop
        perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
        result:=public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
        if result is distinct from page.response then raise exception 'Prospective forward changed old V2/V3 page receipt';end if;
      end loop;
      for r in select c.*,source.actor_user_id from private.personal_working_shadow_comparisons c
        join private.prediction_runs source on source.id=c.source_prediction_id loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        result:=private.record_personal_working_shadow_v1(r.source_prediction_id,r.control);
        if result is distinct from r.result then raise exception 'Prospective forward changed old v3 comparison receipt';end if;
      end loop;
      for r in select * from pg_temp.prospective_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Prospective receipt retry mutated populated old rows: %',r.identity;end if;
      end loop;
      foreach role_name in array array['anon','authenticated','service_role'] loop
        foreach signature in array array[
          'private.guard_personal_working_prospective_v1()',
          'private.check_personal_working_enrollment_commit_v1()',
          'private.withdraw_personal_working_outcomes_v1()',
          'private.enroll_personal_working_evaluation_v1(uuid,uuid,jsonb,integer,integer)',
          'private.capture_personal_working_outcomes_v1(uuid,uuid)'] loop
          if has_function_privilege(role_name,signature,'EXECUTE') then
            raise exception 'Prospective helper retained broad default EXECUTE: %/%',role_name,signature;end if;
        end loop;
        foreach relation_name in array array['private.personal_working_enrollments',
          'private.personal_working_outcome_allocations','private.personal_working_outcome_captures','private.personal_working_outcome_event_refs'] loop
          if has_table_privilege(role_name,relation_name,'SELECT,INSERT,UPDATE,DELETE') then
            raise exception 'Prospective relation retained broad default table permission: %/%',role_name,relation_name;end if;
          if not exists(select 1 from pg_class c where c.oid=relation_name::regclass and c.relrowsecurity) then
            raise exception 'Prospective relation lacks private RLS: %',relation_name;end if;
        end loop;
      end loop;
    end;$verify$;
    select jsonb_build_object('personalWorkingProspectiveUpgrade',
      'PASS: actual active v3 and Personal/Shared BOOK/MOVIE V2/V3 predecessors; every populated old row and installed object metadata exact; sole approved eraser body patch; frozen page/comparison retries preserved; private RLS/ACL override broad defaults') snapshot;
    rollback;`;
}
