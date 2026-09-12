import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Isolated rollback-only rehearsal of the six pending prediction forwards.
// The fixture contains only two reviewed function bodies, never hosted data.
export async function predictionHostedUpgradeSql(files) {
  const suffixes = ['late_outcome_attribution', 'frozen_prediction_replay',
    'eligibility_first_candidate_pool', 'identified_prediction_page',
    'prediction_continuation_windows', 'atomic_prediction_pages'];
  assert.equal(files.length, suffixes.length);
  files.forEach((file, i) => assert.ok(file.name.endsWith(`_${suffixes[i]}.sql`)));
  const read = name => readFile(new URL(name, import.meta.url), 'utf8');
  const [compact, fixture, pool, smoke] = await Promise.all([
    read('prediction-hosted-source-fixture.sql'), read('existing-application-fixture.sql'),
    read('candidate-pool-fixture.sql'), read('atomic-prediction-pages-smoke.sql'),
  ]);
  assert.equal(createHash('sha256').update(compact).digest('hex'),
    'da1c3474e357591ca55b6a94899a162cce1bffcf01201401bc3fc876060d0490', 'Reviewed hosted compatibility fixture changed');
  const forwards = files.map(file => file.sql).join('\n');
  const guard = `do $guard$ begin
    if exists(select 1 from auth.users) or exists(select 1 from public.items) then
      raise exception 'Hosted compatibility probe requires empty synthetic state';
    end if;
  end; $guard$;`;
  const functions = `select p.oid,p.proowner,p.proacl,
    case when p.oid in ('private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure,
      'private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)'::regprocedure,
      'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure,
      'private.process_shadow_prediction_jobs_v1(integer)'::regprocedure,
      'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure)
      then null else pg_get_functiondef(p.oid) end definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'`;
  return `begin;
    ${guard}
    ${compact}
    ${fixture}
    -- Rehearse the hosted open factory default as well as the closed CI lineage.
    alter default privileges for role postgres grant execute on functions to public;
    create temp table hosted_upgrade_functions on commit drop as ${functions};
    create temp table hosted_upgrade_constraints on commit drop as
      select c.oid,c.conrelid,c.conname,pg_get_constraintdef(c.oid) definition
      from pg_constraint c join pg_namespace n on n.oid=c.connamespace
      where n.nspname in ('public','private') and not
        (c.conrelid='private.shadow_prediction_runs'::regclass and c.conname='shadow_prediction_runs_counts_check');
    create temp table hosted_upgrade_rows(identity text primary key,digest text) on commit drop;
    do $snapshot$ declare relation record; digest text;
    begin
      for relation in select format('%I.%I',n.nspname,c.relname) identity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.hosted_upgrade_rows values(relation.identity,digest);
      end loop;
    end; $snapshot$;
    ${forwards}
    do $verify$ declare relation record; digest text; helper regprocedure;
    begin
      for relation in select * from pg_temp.hosted_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest<>relation.digest then raise exception 'Hosted compatibility forward changed populated %',relation.identity; end if;
      end loop;
      if exists(select * from pg_temp.hosted_upgrade_functions except (${functions})) then
        raise exception 'Hosted compatibility changed old function identities/ACLs or unrelated definitions';
      end if;
      if (select count(*) from (${functions}) f)<>(select count(*)+12 from pg_temp.hosted_upgrade_functions) then
        raise exception 'Unexpected hosted compatibility function inventory';
      end if;
      if exists(select * from pg_temp.hosted_upgrade_constraints except
        select c.oid,c.conrelid,c.conname,pg_get_constraintdef(c.oid) from pg_constraint c) then
        raise exception 'Hosted compatibility changed unrelated constraints';
      end if;
      for relation in select c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='private' and c.relname in ('prediction_page_receipts',
          'prediction_continuation_windows','prediction_page_contexts','prediction_page_cursors') loop
        if not relation.relrowsecurity or has_table_privilege('anon',relation.oid,'select')
          or has_table_privilege('authenticated',relation.oid,'select') or has_table_privilege('service_role',relation.oid,'select') then
          raise exception 'Hosted compatibility leaked private page storage';
        end if;
      end loop;
      foreach helper in array array[
        'private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)'::regprocedure,
        'private.prediction_candidate_score_v2(text,jsonb,double precision,jsonb)'::regprocedure,
        'private.rank_items_first_page_v1(jsonb)'::regprocedure
      ] loop
        if has_function_privilege('anon',helper,'execute') or has_function_privilege('authenticated',helper,'execute')
          or has_function_privilege('service_role',helper,'execute') then
          raise exception 'Hosted compatibility leaked a private helper through open defaults';
        end if;
      end loop;
    end; $verify$;
    select jsonb_build_object('hostedPredictionUpgrade',
      'PASS: reviewed compact bodies; six forwards; populated rows, identities, ACLs and unrelated constraints preserved') as snapshot;
    rollback;
    begin;
    ${guard}
    ${compact}
    ${forwards}
    ${pool}
    ${smoke}
    rollback;`;
}
