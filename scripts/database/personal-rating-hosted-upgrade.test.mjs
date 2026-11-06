import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { withPersonalRatingProspectiveFixture, verifyPersonalRatingProspective }
  from './personal-rating-prospective.mjs';
import { verifyPersonalRatingBaseline } from './personal-rating-baseline.mjs';
import { verifyPersonalContentRating } from './personal-content-rating.mjs';
import {
  personalRatingHostedManifest, validatePersonalRatingHostedSources, loadPersonalRatingHostedSources, loadPersonalRatingHostedLineage,
  personalRatingHostedMetadataSql, personalRatingHostedRowsSql, personalRatingHostedPreflightSql,
  personalRatingHostedGuardedMigrationSql, personalRatingHostedPostflightSql,
} from './personal-rating-hosted-upgrade.mjs';

const projectRef = 'aaaaaaaaaaaaaaaaaaaa';
const first = results => results.flatMap(result => result.rows)[0]?.snapshot;
const hash = value => createHash('md5').update(value).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const eraser = 'private.erase_prediction_sources_v1(text,uuid)';
const acquisition = 'private.acquire_native_candidates_v1(jsonb)';
const newFinalize = 'private.finalize_personal_rating_forecast_v2(uuid,jsonb)';
async function checkpoint(db) {
  const metadata = first(await db.exec(personalRatingHostedMetadataSql));
  const rows = first(await db.exec(personalRatingHostedRowsSql(metadata)));
  return { target: { projectRef, postgresMajor: 17 }, metadata, rows };
}
async function predecessor() {
  const db = new PGlite();
  await db.exec(`create role numeric_test_admin superuser;set session authorization numeric_test_admin;
    alter role postgres rename to numeric_original_bootstrap;create role postgres superuser;set session authorization postgres;
    create role anon;create role authenticated;create role service_role bypassrls;grant authenticated,service_role to postgres;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);
    create role supabase_auth_admin;create table auth.schema_migrations(version text);
    alter table auth.schema_migrations owner to supabase_auth_admin;grant select on auth.schema_migrations to postgres;
    insert into auth.schema_migrations values('retained-provider-history');`);
  const files = await loadPersonalRatingHostedLineage();
  assert.equal(files.length, 56);assert.equal(files[53].name, personalRatingHostedManifest.omitted);
  for (const file of files.slice(0, 53)) {
    await db.exec(`begin;${file.sql}commit;`);
    await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',
      [file.name.slice(0, 14), file.name.slice(15, -4), [file.sql]]);
  }
  // New private objects must remain closed even with hostile public defaults.
  await db.exec(`alter default privileges for role postgres grant execute on functions to public;
    alter default privileges for role postgres grant select,insert,update,delete on tables to public;
    alter role postgres nosuperuser;`);
  return db;
}
function replacementBodySql(signature) {
  return `do $mutate$ declare source text;definition text;begin
    select prosrc,pg_get_functiondef(oid) into source,definition from pg_proc where oid=${quote(signature)}::regprocedure;
    execute replace(definition,source,source||E'\n-- injected drift');end;$mutate$;`;
}

test('numeric hosted preparation pins two exact ordered sources and never includes optional 54', async () => {
  const files = await loadPersonalRatingHostedSources();
  const lineage = await loadPersonalRatingHostedLineage();
  assert.equal(lineage.length, 56);
  assert.equal(lineage.at(-1).name, personalRatingHostedManifest.sources.at(-1).filename);
  const current = await buildFreshInstallation();
  assert.ok(current.files.length > lineage.length, 'Current Taste forward remains outside the historical numeric package');
  assert.deepEqual(current.files.slice(0, lineage.length), lineage);
  assert.equal(validatePersonalRatingHostedSources(files), files);
  assert.throws(() => validatePersonalRatingHostedSources([...files].reverse()), /Exact ordered/);
  assert.throws(() => validatePersonalRatingHostedSources([files[0]]), /Exactly two/);
  assert.throws(() => validatePersonalRatingHostedSources([{ ...files[0], sql: files[0].sql + '\n' }, files[1]]), /source bytes/);
  assert.throws(() => validatePersonalRatingHostedSources([files[0], { ...files[1], name: personalRatingHostedManifest.omitted }]), /Exact ordered/);
  await assert.rejects(personalRatingHostedPreflightSql(), /Explicit expected project ref/);
  assert.match(personalRatingHostedMetadataSql, /repeatable read read only/);
  assert.doesNotMatch(personalRatingHostedMetadataSql, /from public\.(items|events|profiles)/);
});

test('exact numeric guarded forward preserves populated pre-54 state, rejects drift, and retains provider boundary', async t => {
  const db = await predecessor();
  let before, after, wrapper, receipt;
  const exec = async sql => {
    try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
    catch (error) { await db.exec('rollback;');throw error; }
  };
  const withSqlSession = callback => callback(exec);
  try {
    const privilege = (await db.query(`select current_user actor,(select rolsuper from pg_roles where rolname=current_user) superuser,
      has_table_privilege(current_user,'auth.schema_migrations','SELECT') readable,
      has_table_privilege(current_user,'auth.schema_migrations','UPDATE,DELETE,TRUNCATE') writable`)).rows[0];
    assert.deepEqual(privilege, { actor: 'postgres', superuser: false, readable: true, writable: false });
    await assert.rejects(db.exec('begin;lock table auth.schema_migrations in share mode;commit;'), /permission denied/);
    await db.exec('rollback;');

    await withPersonalRatingProspectiveFixture(exec, null, async ({ f }) => {
      before = await checkpoint(db);
      assert.ok(before.rows['public.events'].count >= 2 && before.rows['private.prediction_page_receipts'].count >= 3);
      wrapper = await personalRatingHostedGuardedMigrationSql(before, projectRef);
      for (const file of await loadPersonalRatingHostedSources()) assert.ok(wrapper.includes(file.sql));
      assert.ok(wrapper.indexOf((await loadPersonalRatingHostedSources())[0].sql)
        < wrapper.indexOf((await loadPersonalRatingHostedSources())[1].sql));
      assert.ok(!wrapper.includes(personalRatingHostedManifest.omitted));
      assert.match(first(await db.exec(await personalRatingHostedPreflightSql(before, projectRef))), /^PASS/);

      const malformed = [
        ['wrong target', value => { value.target.projectRef = 'b'.repeat(20); }, /Wrong target/],
        ['wrong major', value => { value.target.postgresMajor = 18; }, /PostgreSQL 17/],
        ['source predecessor', value => { value.metadata.functions[eraser].bodyMd5 = '0'.repeat(32); }, /source drift/],
        ['optional54 body', value => { value.metadata.functions[acquisition].bodyMd5 = '0'.repeat(32); }, /source drift/],
        ['source ACL', value => { value.metadata.functions[eraser].normal.acl = null; }, /security drift/],
        ['source argument contract', value => { value.metadata.functionAttributes[eraser].arguments = 'drift'; }, /contract drift/],
        ['partial object', value => { value.metadata.tables['private.personal_rating_allocations'] = {}; }, /row checkpoint|partial/],
        ['optional54 receipt', value => { value.metadata.history.push({ version: '20261028081350', name: 'native_skip_acquisition_prefilter', statementMd5: 'a'.repeat(32) }); }, /already recorded/],
        ['renamed optional54 receipt', value => { value.metadata.history.push({ version: '20261028081350', name: 'renamed_optional_forward', statementMd5: 'a'.repeat(32) }); }, /already recorded/],
        ['partial55 receipt', value => { value.metadata.history.push({ version: '20261029095452', name: 'personal_rating_prospective', statementMd5: 'a'.repeat(32) }); }, /already recorded/],
        ['missing schema ACL', value => { delete value.metadata.schemas; }, /security metadata/],
        ['unversioned digest', value => { value.rows['public.items'].algorithm = 'UNREVIEWED'; }, /digest algorithm/],
      ];
      for (const [name, mutate, match] of malformed) await t.test('rejects checkpoint: ' + name, async () => {
        const value = structuredClone(before);mutate(value);
        await assert.rejects(personalRatingHostedGuardedMigrationSql(value, projectRef), match);
      });

      const preDrifts = [
        ['row bytes', `update public.items set title=title||' drift' where id=${quote(f.items[0])};`, /retained rows changed/],
        ['history bytes', "update supabase_migrations.schema_migrations set statements=array['drift'] where version=(select min(version) from supabase_migrations.schema_migrations);", /metadata\/history drift/],
        ['old ACL', `grant execute on function ${eraser} to service_role;`, /metadata\/history drift/],
        ['old body', replacementBodySql(eraser), /metadata\/history drift/],
        ['default ACL', 'alter default privileges for role postgres grant truncate on tables to public;', /metadata\/history drift/],
        ['schema ACL', 'grant usage on schema private to anon;', /metadata\/history drift/],
      ];
      for (const [name, mutation, match] of preDrifts) await t.test('rejects preflight drift and rolls back: ' + name, async () => {
        try { await assert.rejects(db.exec(`begin;${mutation}${wrapper}`), match); }
        finally { await db.exec('rollback;'); }
        assert.deepEqual(await checkpoint(db), before);
      });

      const postDrifts = [
        ['new table grant', 'grant select on private.personal_rating_inputs to service_role;'],
        ['new column grant', 'grant select(target_item_id) on private.personal_rating_inputs to service_role;'],
        ['old column grant', 'grant select(title) on public.items to service_role;'],
        ['new table RLS', 'alter table private.personal_rating_inputs disable row level security;'],
        ['new function grant', `grant execute on function ${newFinalize} to service_role;`],
        ['new function definer', `alter function ${newFinalize} security definer;`],
        ['new function search path', `alter function ${newFinalize} set search_path=public;`],
        ['new function cost', `alter function ${newFinalize} cost 999;`],
        ['new function default', `do $mutate$ declare definition text;begin
          select pg_get_functiondef('private.prepare_personal_rating_forecast_v2(uuid,uuid,uuid,integer,text,jsonb)'::regprocedure) into definition;
          if position($before$DEFAULT 'observed'::text$before$ in definition)=0 then raise exception 'Expected default mutation target missing';end if;
          execute replace(definition,$before$DEFAULT 'observed'::text$before$,$after$DEFAULT 'synthetic'::text$after$);end;$mutate$;`],
        ['old eraser body', replacementBodySql(eraser)],
        ['optional acquisition body', replacementBodySql(acquisition)],
        ['trigger disabled', 'alter table private.personal_rating_inputs disable trigger personal_rating_input_immutable;'],
        ['schema ACL', 'grant usage on schema private to anon;'],
        ['default ACL', 'alter default privileges for role postgres grant truncate on tables to public;'],
        ['auth function body', replacementBodySql('auth.uid()')],
        ['retained row', `update public.items set title=title||' drift' where id=${quote(f.items[0])};`],
        ['history', "update supabase_migrations.schema_migrations set statements=array['drift'] where version=(select min(version) from supabase_migrations.schema_migrations);"],
      ];
      for (const [name, mutation] of postDrifts) await t.test('rejects postflight mutation and atomically removes both forwards: ' + name, async () => {
        const altered = wrapper.replace('/* numeric-forward:postcheck */', mutation + '\n/* numeric-forward:postcheck */');
        try { await assert.rejects(db.exec(`begin;${altered}`), /post-install metadata\/security drift|installation changed retained rows/); }
        finally { await db.exec('rollback;'); }
        assert.deepEqual(await checkpoint(db), before);
      });

      await t.test('failure inside the second forward rolls back the complete first forward and partial second', async () => {
        const contentSql = (await loadPersonalRatingHostedSources())[1].sql;
        const interrupted = contentSql.replace('create function private.guard_personal_rating_content_artifact_v1()',
          'select 1/0;\ncreate function private.guard_personal_rating_content_artifact_v1()');
        assert.notEqual(interrupted, contentSql);
        try { await assert.rejects(db.exec(`begin;${wrapper.replace(contentSql, () => interrupted)}`), /division by zero/); }
        finally { await db.exec('rollback;'); }
        assert.deepEqual(await checkpoint(db), before);
      });

      receipt = { version: '20261102000100', name: personalRatingHostedManifest.providerName, statementMd5: hash(wrapper) };
      const historyInsert = `insert into supabase_migrations.schema_migrations values(${quote(receipt.version)},${quote(receipt.name)},array[${quote(wrapper)}]);`;
      // Receipt failure occurs after both forwards, proving their shared rollback.
      await assert.rejects(db.exec(`begin;${wrapper}${historyInsert}select 1/0;commit;`), /division by zero/);
      await db.exec('rollback;');assert.deepEqual(await checkpoint(db), before);
      await db.exec("set timezone='Europe/Helsinki';");
      await db.exec(`begin;${wrapper}${historyInsert}commit;`);
      const postflight = await personalRatingHostedPostflightSql(before, projectRef, receipt);
      assert.match(first(await db.exec(postflight)), /^PASS/);
      after = await checkpoint(db);
      assert.deepEqual(after.metadata.history, [...before.metadata.history, receipt]);
      assert.deepEqual(after.metadata.functions[acquisition], before.metadata.functions[acquisition]);
      assert.deepEqual(after.metadata.schemas, before.metadata.schemas);
      assert.deepEqual(after.metadata.defaultAcls, before.metadata.defaultAcls);
      assert.deepEqual(after.metadata.roles, before.metadata.roles);
      assert.deepEqual(after.metadata.memberships, before.metadata.memberships);
      for (const [name, row] of Object.entries(before.rows)) assert.deepEqual(after.rows[name], row);
      const newRelations = Object.keys(after.rows).filter(name => !before.rows[name]);
      assert.equal(newRelations.length, 8);newRelations.forEach(name => assert.equal(after.rows[name].count, 0));
      for (const [name, entry] of Object.entries(before.metadata.functions))
        assert.deepEqual(after.metadata.functions[name], name === eraser ? { ...entry, bodyMd5: '0301656179b0b91106ac427daed62705' } : entry);
      await assert.rejects(personalRatingHostedGuardedMigrationSql(after, projectRef), /already recorded|partial/);
      await assert.rejects(db.exec(`begin;${wrapper}commit;`), /metadata\/history drift/);await db.exec('rollback;');
      await assert.rejects(personalRatingHostedPostflightSql(before, projectRef, { ...receipt, statementMd5: '0'.repeat(32) }), /exact numeric guarded wrapper/);
      await assert.rejects(db.exec(`begin;update supabase_migrations.schema_migrations set statements=array['altered receipt'] where version=${quote(receipt.version)};
        ${postflight.replace(/^.*?begin isolation level repeatable read read only;/s, '').replace(/rollback;\s*$/, '')}commit;`), /receipt\/history mismatch/);
      await db.exec('rollback;');assert.deepEqual(await checkpoint(db), after);
      // The existing fixture hashes timestamptz JSON without setting timezone.
      // Restore its initial UTC serialization context before its cleanup check.
      await db.exec("set timezone='UTC';");
    });

    // The guard's installed result also runs the existing numerical mechanisms.
    const clean = await checkpoint(db);
    const baseline = await verifyPersonalRatingBaseline(exec);
    assert.equal(baseline.cases.length, 15);assert.deepEqual(await checkpoint(db), clean);
    const prospective = await verifyPersonalRatingProspective(exec, withSqlSession);
    assert.equal(prospective.cases.length, 24);assert.deepEqual(await checkpoint(db), clean);
    const content = await verifyPersonalContentRating(exec, withSqlSession);
    assert.equal(content.cases.length, 39);assert.deepEqual(await checkpoint(db), clean);
    t.diagnostic(JSON.stringify({ scope: 'DISPOSABLE_PGLITE_ONLY', optional54: 'NOT_INSTALLED', newTables: 8,
      newFunctions: 20, newTriggers: 18, baselineCases: baseline.cases.length, prospectiveCases: prospective.cases.length,
      contentCases: content.cases.length, preservedOldTables: Object.keys(before.rows).length,
      providerRole: 'NON_SUPERUSER_SELECT_ONLY_AUTH_HISTORY', qualityAdmission: 'NONE', servingActivation: 'NONE' }));
  } catch (error) {
    if (error instanceof AggregateError) t.diagnostic(JSON.stringify(error.errors.map(item => ({
      name: item.name, message: item.message, code: item.code,
    }))));
    delete error.query;throw error;
  }
  finally { await db.close(); }
});
