// Disposable native fixtures for the function-local Working JSON serializer.
// All application rows and installed metadata remain inside BEGIN/ROLLBACK.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const writer = 'private.record_personal_working_shadow_v1(uuid,text)';
const settings = [-3, 0, 1];

async function sourceFixtureSql(namespace, digits) {
  const fixture = await readFile(new URL('personal-working-bridge-fixture.sql', import.meta.url), 'utf8');
  const boundary = "  shadow_off := private.record_personal_working_shadow_v1(source_id,'OFF');";
  assert.equal(fixture.split(boundary).length, 2, 'Actual source fixture boundary changed');
  assert.ok(Number.isInteger(namespace) && namespace > 0 && namespace < 100);
  const prefix = fixture.slice(0, fixture.indexOf(boundary))
    .replace('create function pg_temp.working_assert', 'create or replace function pg_temp.working_assert')
    .replaceAll('Native Working fixture', `Working precision ${namespace}`)
    .replaceAll('a9147000', `a9147${String(namespace).padStart(3, '0')}`)
    .replaceAll('working-native-candidate:', `working-precision-${namespace}:`)
    .replaceAll('native-working-warm', `native-working-${namespace}-warm`)
    .replaceAll('native-working-cold', `native-working-${namespace}-cold`);
  return `${prefix}
    insert into pg_temp.working_precision_sources(source_id,actor,capture_version,caller_digits)
      values(source_id,actor,frozen_source#>>'{state_snapshot,workingState,version}',${digits});
  end;$native_working$;`;
}

const setupSql = `
  create temp table working_precision_sources(source_id uuid primary key,actor uuid,
    capture_version text not null,caller_digits integer not null) on commit drop;
  create function pg_temp.precision_assert(ok boolean,label text) returns void language plpgsql as $$
    begin if ok is not true then raise exception 'Working precision assertion: %',label;end if;end;$$;
  create function pg_temp.precision_assert_off(source uuid,shadow jsonb) returns void language plpgsql as $$
    begin
      perform pg_temp.precision_assert(not exists(
        select 1 from (select * from private.prediction_candidates where prediction_id=source) p
        full join jsonb_array_elements(shadow->'candidates') s(value) on p.item_id=(s.value->>'itemId')::uuid
        where p.item_id is null or s.value is null
          or float8send(p.final_score) is distinct from float8send((s.value->>'score')::double precision)
          or p.final_rank is distinct from (s.value->>'rank')::integer
          or p.selected_for_delivery is distinct from (s.value->>'selected')::boolean
          or private.prediction_delivery_tier_v1(p.explanation->'resurfacingPolicy') is distinct from (s.value->>'tier')::integer
          or coalesce((p.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) is distinct from (s.value->>'eligible')::boolean
          or (s.value->>'adjustment')::double precision is distinct from 0::double precision),
        'exact OFF Items/float8 scores/ranks/tier/eligibility/selection/zero adjustment');
    end;$$;
`;

const exerciseSql = `
  do $precision_matrix$
  <<precision_matrix>>
  declare source record;control text;shadow jsonb;before_rows jsonb;after_rows jsonb;
    altered jsonb;field text;rejected boolean;
  begin
    for source in select * from pg_temp.working_precision_sources order by source_id loop
      perform set_config('request.jwt.claim.sub',source.actor::text,true);
      perform set_config('extra_float_digits',source.caller_digits::text,true);
      for control in select unnest(array['OFF','STATIC','ORDERED']) loop
        shadow := private.record_personal_working_shadow_v1(source.source_id,control);
        perform pg_temp.precision_assert(current_setting('extra_float_digits')=source.caller_digits::text,
          'writer restores each caller precision, including a cached control');
        perform pg_temp.precision_assert(shadow->>'version'=case source.capture_version
          when 'native-working-capture-v1' then 'personal-working-shadow-v1' else 'personal-working-shadow-v2' end,
          'real historical/current source generation remains matched');
        if control='OFF' then
          perform pg_temp.precision_assert_off(source.source_id,shadow);
          foreach field in array array['score','rank','selected'] loop
            altered := jsonb_set(shadow,array['candidates','0',field],case field
              when 'score' then to_jsonb((shadow#>>'{candidates,0,score}')::double precision+0.001)
              when 'rank' then to_jsonb((shadow#>>'{candidates,0,rank}')::integer+1)
              else to_jsonb(not (shadow#>>'{candidates,0,selected}')::boolean) end);
            rejected := false;
            begin perform pg_temp.precision_assert_off(source.source_id,altered);
            exception when raise_exception then rejected := true;end;
            perform pg_temp.precision_assert(rejected,'deliberately changed OFF '||field||' must fail exact parity');
          end loop;
        end if;
        select to_jsonb(c) into strict before_rows from private.personal_working_shadow_comparisons c
          where c.source_prediction_id=source.source_id and c.control=precision_matrix.control;
        perform pg_temp.precision_assert(private.record_personal_working_shadow_v1(source.source_id,control)=shadow,
          'cached actual control receipt is byte-identical');
        select to_jsonb(c) into strict after_rows from private.personal_working_shadow_comparisons c
          where c.source_prediction_id=source.source_id and c.control=precision_matrix.control;
        perform pg_temp.precision_assert(before_rows=after_rows,'cached actual stored control row is byte-identical');
        perform pg_temp.precision_assert(current_setting('extra_float_digits')=source.caller_digits::text,
          'cached control restores caller precision');
      end loop;
      rejected := false;
      begin perform private.record_personal_working_shadow_v1(source.source_id,'INVALID');
      exception when invalid_parameter_value then rejected := true;end;
      perform pg_temp.precision_assert(rejected and current_setting('extra_float_digits')=source.caller_digits::text,
        'invalid control restores caller precision on exception');
      perform set_config('request.jwt.claim.sub','',true);
      rejected := false;
      begin perform private.record_personal_working_shadow_v1(source.source_id,'STATIC');
      exception when insufficient_privilege then rejected := true;end;
      perform pg_temp.precision_assert(rejected and current_setting('extra_float_digits')=source.caller_digits::text,
        'cached retry reauthorizes and restores caller precision on denied access');
      perform set_config('request.jwt.claim.sub',source.actor::text,true);
    end loop;
  end;$precision_matrix$;
`;

const snapshotSql = `
  create temp table working_precision_functions on commit drop as
    select p.oid,to_jsonb(p) snapshot from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in('public','private');
  create temp table working_precision_tables(oid oid primary key,identity text,digest text) on commit drop;
  do $precision_snapshot$ declare r record;digest text;begin
    for r in select c.oid,format('%I.%I',n.nspname,c.relname) identity from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') loop
      execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text) from %s t',r.identity) into digest;
      insert into pg_temp.working_precision_tables values(r.oid,r.identity,digest);
    end loop;
  end;$precision_snapshot$;
`;

const preservationSql = `
  do $precision_preserved$ declare r record;digest text;begin
    perform pg_temp.precision_assert(not exists(
      select 1 from pg_temp.working_precision_functions f full join
        (select p.oid,to_jsonb(p) snapshot from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname in('public','private')) p using(oid)
      where f.oid is null or p.oid is null or p.snapshot is distinct from case
        when f.oid='${writer}'::regprocedure then f.snapshot||jsonb_build_object(
          'proconfig',(f.snapshot->'proconfig')||jsonb_build_array('extra_float_digits=3'))
        else f.snapshot end),
      'only writer proconfig changes; exact function body/OID/owner/ACL/security/volatility and other functions remain');
    for r in select * from pg_temp.working_precision_tables loop
      execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text) from %s t',r.identity) into digest;
      perform pg_temp.precision_assert(digest=r.digest,'populated row bytes remain: '||r.identity);
    end loop;
  end;$precision_preserved$;
`;

// Caller supplies the real pre-reset installed lineage. Freeze genuine v1
// sources, apply reset71, freeze genuine v2 sources, then apply precision72.
export async function personalWorkingPrecisionUpgradeSql(resetMigration, precisionMigration) {
  assert.ok(resetMigration.name.endsWith('_personal_working_reset.sql'));
  assert.ok(precisionMigration.name.endsWith('_personal_working_shadow_precision.sql'));
  const v1 = await Promise.all(settings.map((digits, i) => sourceFixtureSql(i+1,digits)));
  const v2 = await Promise.all(settings.map((digits, i) => sourceFixtureSql(i+4,digits)));
  return `begin;set local extra_float_digits=3;
    ${setupSql}
    ${v1.join('\n')}
    ${resetMigration.sql}
    ${v2.join('\n')}
    do $old_controls$ declare source record;begin
      for source in select * from pg_temp.working_precision_sources loop
        perform set_config('request.jwt.claim.sub',source.actor::text,true);
        perform private.record_personal_working_shadow_v1(source.source_id,'STATIC');
      end loop;
    end;$old_controls$;
    savepoint precision_defect;
    set local extra_float_digits=-3;
    do $old_defect$ declare source record;shadow jsonb;begin
      select * into strict source from pg_temp.working_precision_sources where caller_digits=-3
        and capture_version='native-working-capture-v1';
      perform set_config('request.jwt.claim.sub',source.actor::text,true);
      shadow := private.record_personal_working_shadow_v1(source.source_id,'OFF');
      perform pg_temp.precision_assert(exists(select 1 from private.prediction_candidates p
        join jsonb_array_elements(shadow->'candidates') s(value) on p.item_id=(s.value->>'itemId')::uuid
        where p.prediction_id=source.source_id
          and float8send(p.final_score) is distinct from float8send((s.value->>'score')::double precision)),
        'pre-fix supported caller precision exposes actual lost binary OFF score bytes');
    end;$old_defect$;
    rollback to savepoint precision_defect;release savepoint precision_defect;
    ${snapshotSql}
    ${precisionMigration.sql}
    ${preservationSql}
    ${exerciseSql}
    select jsonb_build_object('personalWorkingPrecisionUpgrade',
      'PASS: genuine v1/v2 sources; caller -3/0/1 exact OFF float8 and delivery parity; immutable retry/old rows; only function precision configuration changes') snapshot;
    rollback;`;
}

// The final native installation creates fresh controls at explicit caller0;
// the populated upgrade matrix covers negative/default precision separately.
// This invocation cannot inherit another psql session's GUC.
export async function personalWorkingPrecisionSmokeSql() {
  const fixture = await readFile(new URL('personal-working-bridge-fixture.sql', import.meta.url), 'utf8');
  return `begin;set local extra_float_digits=0;
    ${fixture}
    do $caller_restored$ begin
      if current_setting('extra_float_digits') is distinct from '0' then
        raise exception 'Working precision caller GUC was not restored';end if;
    end;$caller_restored$;
    rollback;`;
}
