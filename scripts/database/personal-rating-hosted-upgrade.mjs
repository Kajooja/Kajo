// Target-bound SQL preparation only; no connection, executor, credentials or collection.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { tastePoolHostedMetadataQuery, tastePoolHostedLockSql }
  from './personal-taste-pool-hosted-upgrade.mjs';

const quote = value => "'" + value.replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + '::jsonb';
const hash = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
const first = results => results.flatMap(result => result.rows)[0]?.snapshot;
const eraser = 'private.erase_prediction_sources_v1(text,uuid)';
const acquisition = 'private.acquire_native_candidates_v1(jsonb)';
const resolver = 'private.personal_source_evidence_v1(uuid,timestamp with time zone)';
export const personalRatingHostedManifest = Object.freeze({
  version: 'personal-rating-private-hosted-forward-v1',
  providerName: 'personal_rating_private_evaluation',
  omitted: '20261028081350_native_skip_acquisition_prefilter.sql',
  sources: Object.freeze([
    Object.freeze({ filename: '20261029095452_personal_rating_prospective.sql',
      sha256: '9a0b5fa0896c7f205775184b1937a2caf902419ca78b7f946426cc6c6b6aeb64' }),
    Object.freeze({ filename: '20261101221942_personal_content_rating.sql',
      sha256: '80ec7f7a2d07b9b7853c079bbcdbbcdf1e590892a589d886063718160252ef7f' }),
  ]),
});
const newTables = [
  'personal_rating_allocations', 'personal_rating_inputs', 'personal_rating_forecasts',
  'personal_rating_event_refs', 'personal_rating_answers', 'personal_rating_content_source_refs',
  'personal_rating_content_alias_refs', 'personal_rating_content_review_revocations',
].map(name => 'private.' + name).sort();
const newFunctions = [
  'guard_personal_rating_artifact_v1()', 'withdraw_personal_rating_event_v1()',
  'lock_personal_rating_transaction_v1()', 'check_personal_rating_commit_v1()',
  'personal_rating_target_has_report_v1(uuid,uuid)', 'invalidate_pending_personal_rating_v1()',
  'prepare_personal_rating_forecast_v1(uuid,uuid,uuid,integer,text)',
  'finalize_personal_rating_forecast_v1(uuid,jsonb)', 'commit_personal_rating_answer_v1(uuid,jsonb)',
  'inspect_personal_rating_forecast_v1(uuid)', 'guard_personal_rating_content_artifact_v1()',
  'withdraw_personal_rating_content_source_v1()', 'retire_personal_rating_content_review_v1()',
  'withdraw_personal_rating_content_review_v1(text)', 'check_personal_rating_content_withdrawal_budget_v1(uuid[])',
  'validate_personal_rating_feature_use_v1(jsonb,text,text,text)', 'personal_rating_content_mapping_v1()',
  'capture_personal_rating_content_v1(jsonb,jsonb)',
  'prepare_personal_rating_forecast_v2(uuid,uuid,uuid,integer,text,jsonb)',
  'finalize_personal_rating_forecast_v2(uuid,jsonb)',
].map(name => 'private.' + name).sort();
const newTriggers = [
  'private.personal_rating_allocations.personal_rating_allocation_immutable',
  'private.personal_rating_inputs.personal_rating_input_immutable',
  'private.personal_rating_forecasts.personal_rating_forecast_immutable',
  'private.personal_rating_answers.personal_rating_answer_immutable',
  'private.personal_rating_event_refs.personal_rating_event_ref_immutable',
  'public.events.invalidate_pending_personal_rating_for_event',
  'private.taste_challenges.invalidate_pending_personal_rating_for_challenge',
  'private.taste_sessions.invalidate_pending_personal_rating_for_taste',
  'private.sequential_taste_sessions.invalidate_pending_personal_rating_for_sequential',
  'private.profile_bootstrap_evidence.invalidate_pending_personal_rating_for_bootstrap',
  'public.events.withdraw_personal_rating_event',
  'private.personal_rating_inputs.personal_rating_commit_guard',
  'private.personal_rating_content_source_refs.personal_rating_content_source_immutable',
  'private.personal_rating_content_alias_refs.personal_rating_content_alias_immutable',
  'private.personal_rating_content_review_revocations.personal_rating_content_review_immutable',
  'private.item_sources.personal_rating_content_source_withdrawal',
  'private.item_external_ids.personal_rating_content_alias_withdrawal',
  'private.personal_rating_content_review_revocations.personal_rating_content_review_withdrawal',
].sort();

export function validatePersonalRatingHostedSources(files) {
  assert.equal(files?.length, 2, 'Exactly two reviewed numeric forwards required');
  files.forEach((file, index) => {
    const source = personalRatingHostedManifest.sources[index];
    assert.equal(file.name, source.filename, 'Exact ordered numeric source required');
    assert.equal(hash(file.sql), source.sha256, 'Reviewed numeric source bytes changed');
  });
  return files;
}
export async function loadPersonalRatingHostedSources() {
  return validatePersonalRatingHostedSources(await Promise.all(personalRatingHostedManifest.sources.map(async source => ({
    name: source.filename, sql: await readFile(new URL('../../supabase/migrations/' + source.filename, import.meta.url), 'utf8'),
  }))));
}

// Metadata only; no user rows, migration SQL, pg_proc source bodies or credentials.
// Extend the existing reviewed query with schema/default ACLs and auth functions.
export const personalRatingHostedMetadataQuery = `select base.snapshot || jsonb_build_object(
  'schemas',(select coalesce(jsonb_object_agg(nspname,to_jsonb(n)),'{}') from pg_namespace n where nspname in('public','private','auth')),
  'defaultAcls',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d),
  'columnAcls',(select coalesce(jsonb_object_agg(format('%I.%I.%I',n.nspname,c.relname,a.attname),a.attacl::text),'{}')
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in('public','private','auth') and c.relkind='r' and a.attnum>0 and not a.attisdropped),
  'authFunctions',(select coalesce(jsonb_object_agg(p.oid::text,jsonb_build_object('metadataMd5',md5((to_jsonb(p)-'prosrc')::text),
    'bodyMd5',md5(p.prosrc))),'{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.prokind='f'),
  'functionAttributes',(select coalesce(jsonb_object_agg(format('%I.%I(%s)',n.nspname,p.proname,replace(oidvectortypes(p.proargtypes),', ',',')),
    jsonb_build_object('arguments',pg_get_function_arguments(p.oid),'cost',p.procost,'rows',p.prorows,
      'support',p.prosupport::regproc::text,'variadicType',format_type(p.provariadic,null),'transformTypes',p.protrftypes::text,
      'returnsSet',p.proretset,'sqlBodyMd5',md5(coalesce(p.prosqlbody::text,'')))),'{}')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.prokind='f'),
  'roles',(select coalesce(jsonb_object_agg(rolname,jsonb_build_object('superuser',rolsuper,'inherit',rolinherit,
    'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls)),'{}')
    from pg_roles where rolname in('postgres','anon','authenticated','service_role','supabase_auth_admin')),
  'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor),'[]') from pg_auth_members m)
  ) snapshot from (${tastePoolHostedMetadataQuery}) base`;
export const personalRatingHostedMetadataSql = `begin isolation level repeatable read read only;
  set local search_path=pg_catalog;set local timezone='UTC';set local statement_timeout='30s';
  ${personalRatingHostedMetadataQuery};rollback;`;

function tableNames(metadata) {
  const names = Object.keys(metadata?.tables ?? {}).sort();
  assert.ok(names.length > 0 && names.includes('private.sequential_taste_sessions'), 'Complete canonical table metadata required');
  names.forEach(name => assert.match(name, /^(public|private|auth)\.[a-z][a-z0-9_]*$/, 'Unsupported table identity'));
  return names;
}
function rowsQuery(names) {
  // Bound memory to fixed-width row hashes, retaining duplicate multiplicity.
  return `select jsonb_object_agg(identity,value) snapshot from (${names.map(name =>
    `select ${quote(name)} identity,jsonb_build_object('count',count(*),'algorithm','MD5_SORTED_ROW_MD5_V1',
      'md5',md5(coalesce(string_agg(digest,'' order by digest),''))) value
      from (select md5(to_jsonb(r)::text) digest from ${name} r offset 0) hashed`).join(' union all ')}) rows`;
}
// This reads personal rows only inside the database to return aggregate hashes.
// It is not part of the metadata-only inventory and needs an authorized target.
export function personalRatingHostedRowsSql(metadata) {
  return `begin isolation level repeatable read read only;set local search_path=pg_catalog;
    set local timezone='UTC';set local statement_timeout='30s';${rowsQuery(tableNames(metadata))};rollback;`;
}

let referencePromise;
async function reference() {
  referencePromise ??= (async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;
        create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);`);
      const { files } = await buildFreshInstallation();
      assert.equal(files.length, 56, 'Unreviewed canonical lineage length');
      assert.equal(files[53].name, personalRatingHostedManifest.omitted, 'Exact omitted optional forward required');
      validatePersonalRatingHostedSources(files.slice(54));
      for (const file of files.slice(0, 53)) await db.exec(`begin;${file.sql}commit;`);
      const before = first(await db.exec(personalRatingHostedMetadataSql));
      for (const file of await loadPersonalRatingHostedSources()) await db.exec(`begin;${file.sql}commit;`);
      const after = first(await db.exec(personalRatingHostedMetadataSql));
      for (const [kind, expected] of [['tables', newTables], ['functions', newFunctions], ['triggers', newTriggers]]) {
        assert.deepEqual(Object.keys(after[kind]).filter(key => !before[kind][key]).sort(), expected, 'Exact added ' + kind);
      }
      assert.equal(before.functions[eraser].bodyMd5, 'f69c58702752ee797d92c5f649489363');
      assert.equal(after.functions[eraser].bodyMd5, '0301656179b0b91106ac427daed62705');
      for (const [signature, bodyMd5] of [[acquisition, '6e0aba591a90c194c5bae49f0361084f'],
        [resolver, 'fc23518ea578c1db99498c958178aaf5']]) {
        assert.equal(before.functions[signature].bodyMd5, bodyMd5);
        assert.deepEqual(after.functions[signature], before.functions[signature]);
      }
      return { before, after };
    } finally { await db.close(); }
  })();
  return referencePromise;
}

async function validateCheckpoint(checkpoint, expectedProjectRef) {
  assert.match(expectedProjectRef ?? '', /^[a-z]{20}$/, 'Explicit expected project ref required');
  assert.equal(checkpoint?.target?.projectRef, expectedProjectRef, 'Wrong target project');
  assert.equal(checkpoint?.target?.postgresMajor, 17, 'Expected PostgreSQL 17 target');
  const { metadata, rows } = checkpoint;
  assert.equal(metadata?.serverMajor, 17, 'Observed PostgreSQL generation changed');
  tastePoolHostedLockSql(metadata);
  for (const key of ['schemas', 'defaultAcls', 'columnAcls', 'authFunctions', 'functionAttributes', 'roles', 'memberships'])
    assert.ok(Object.hasOwn(metadata, key), 'Complete numeric security metadata required: ' + key);
  assert.deepEqual(Object.keys(metadata.schemas).sort(), ['auth', 'private', 'public']);
  assert.deepEqual(Object.keys(rows ?? {}).sort(), tableNames(metadata), 'Every canonical table needs a row checkpoint');
  for (const row of Object.values(rows)) {
    assert.ok(Number.isSafeInteger(row.count) && row.count >= 0, 'Invalid row count');
    assert.equal(row.algorithm, 'MD5_SORTED_ROW_MD5_V1', 'Unreviewed row digest algorithm');
    assert.match(row.md5, /^[a-f0-9]{32}$/, 'Invalid row digest');
  }
  assert.ok(Array.isArray(metadata.history) && metadata.history.length > 0, 'Exact nonempty migration history required');
  let previous = '';
  const forbidden = ['personal_rating_prospective', 'personal_content_rating', 'native_skip_acquisition_prefilter',
    personalRatingHostedManifest.providerName];
  const forbiddenVersions = [personalRatingHostedManifest.omitted,
    ...personalRatingHostedManifest.sources.map(source => source.filename)].map(filename => filename.slice(0, 14));
  for (const receipt of metadata.history) {
    assert.match(receipt.version, /^\d{14}$/);assert.match(receipt.statementMd5, /^[a-f0-9]{32}$/);
    assert.ok(receipt.version > previous, 'Migration history must be exact ordered unique receipts');previous = receipt.version;
    assert.ok(typeof receipt.name === 'string' && !forbidden.some(name => receipt.name.includes(name))
      && !forbiddenVersions.includes(receipt.version),
      'Numeric or optional forward already recorded; never replay');
  }
  for (const [kind, names] of [['tables', newTables], ['functions', newFunctions], ['triggers', newTriggers]])
    assert.ok(names.every(key => !metadata[kind]?.[key]), 'Numeric objects already exist; partial installation is not supported');
  const refs = await reference();
  for (const signature of [eraser, acquisition, resolver]) {
    assert.equal(metadata.functions[signature]?.bodyMd5, refs.before.functions[signature].bodyMd5, 'Numeric predecessor source drift: ' + signature);
    assert.deepEqual(metadata.functions[signature]?.normal, refs.before.functions[signature].normal, 'Numeric predecessor security drift: ' + signature);
    assert.deepEqual(metadata.functionAttributes[signature], refs.before.functionAttributes[signature],
      'Numeric predecessor contract drift: ' + signature);
  }
  return refs;
}

function assertSnapshotSql(checkpoint) {
  return `do $numeric_hosted_preflight$ declare actual jsonb;begin
    select snapshot into actual from (${personalRatingHostedMetadataQuery}) m;
    if actual is distinct from ${json(checkpoint.metadata)} then raise exception 'Numeric target metadata/history drift';end if;
    select snapshot into actual from (${rowsQuery(tableNames(checkpoint.metadata))}) r;
    if actual is distinct from ${json(checkpoint.rows)} then raise exception 'Numeric retained rows changed';end if;
  end;$numeric_hosted_preflight$;`;
}
function postcheckSql(checkpoint, refs, receipt = null) {
  const expected = structuredClone(checkpoint.metadata);
  expected.functions[eraser].bodyMd5 = refs.after.functions[eraser].bodyMd5;
  for (const key of newFunctions) {
    const { bodyMd5, normal } = refs.after.functions[key];expected.functions[key] = { bodyMd5, normal };
    expected.functionAttributes[key] = refs.after.functionAttributes[key];
  }
  for (const key of newTables) { const { oid: _oid, ...value } = refs.after.tables[key];expected.tables[key] = value; }
  for (const [key, value] of Object.entries(refs.after.columnAcls))
    if (newTables.some(table => key.startsWith(table + '.'))) expected.columnAcls[key] = value;
  for (const key of newTriggers) { const { oid: _oid, ...value } = refs.after.triggers[key];expected.triggers[key] = value; }
  return `/* numeric-forward:postcheck */
    do $numeric_hosted_postcheck$ declare actual jsonb;k text;begin
      select snapshot into actual from (${personalRatingHostedMetadataQuery}) m;
      ${receipt ? `if actual->'history' is distinct from (${json(checkpoint.metadata.history)}||jsonb_build_array(${json(receipt)})) then
        raise exception 'Numeric provider receipt/history mismatch';end if;
        actual:=jsonb_set(actual,'{history}',${json(checkpoint.metadata.history)});` : ''}
      foreach k in array array[${newFunctions.map(quote).join(',')}] loop
        actual:=jsonb_set(actual,array['functions',k],(actual#>array['functions',k])-'oid'-'metadataMd5');
      end loop;
      foreach k in array array[${newTables.map(quote).join(',')}] loop
        actual:=jsonb_set(actual,array['tables',k],(actual#>array['tables',k])-'oid');
      end loop;
      foreach k in array array[${newTriggers.map(quote).join(',')}] loop
        actual:=jsonb_set(actual,array['triggers',k],(actual#>array['triggers',k])-'oid');
      end loop;
      if actual is distinct from ${json(expected)} then raise exception 'Numeric post-install metadata/security drift';end if;
      select snapshot into actual from (${rowsQuery(tableNames(checkpoint.metadata))}) r;
      if actual is distinct from ${json(checkpoint.rows)} then raise exception 'Numeric installation changed retained rows';end if;
      ${newTables.map(name => `if exists(select 1 from ${name}) then raise exception 'Unexpected retroactive numeric data';end if;`).join('\n')}
    end;$numeric_hosted_postcheck$;`;
}
export async function personalRatingHostedPreflightSql(checkpoint, expectedProjectRef) {
  await validateCheckpoint(checkpoint, expectedProjectRef);
  return `-- Independently verify the actual connected project: ${expectedProjectRef}
    begin isolation level repeatable read read only;set local search_path=pg_catalog;set local timezone='UTC';
    set local statement_timeout='30s';${assertSnapshotSql(checkpoint)}
    select to_jsonb('PASS: exact numeric target checkpoint'::text) snapshot;rollback;`;
}
export async function personalRatingHostedGuardedMigrationSql(checkpoint, expectedProjectRef) {
  const refs = await validateCheckpoint(checkpoint, expectedProjectRef);
  const files = await loadPersonalRatingHostedSources();
  // No BEGIN/COMMIT or history writes. The provider executes this entire payload
  // and its one receipt atomically. Reject all partial or already-installed state.
  return `-- Independently verified target required: ${expectedProjectRef}
    -- Exact ordered sources: ${personalRatingHostedManifest.sources.map(source => source.filename + ':' + source.sha256).join(', ')}
    set local search_path=pg_catalog;set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='30s';
    ${tastePoolHostedLockSql(checkpoint.metadata)}
    ${assertSnapshotSql(checkpoint)}
${files.map(file => file.sql).join('\n')}
    ${postcheckSql(checkpoint, refs)}
    select to_jsonb('PASS: exact private numeric forwards and retained state verified atomically'::text) snapshot;`;
}
// Assertion-only body supports an isolated BEGIN/.../ROLLBACK rehearsal without
// nesting transaction envelopes. It validates the exact wrapper/receipt binding.
export async function personalRatingHostedPostflightAssertionSql(checkpoint, expectedProjectRef, receipt) {
  const refs = await validateCheckpoint(checkpoint, expectedProjectRef);
  assert.match(receipt?.version ?? '', /^\d{14}$/, 'Exact acknowledged provider version required');
  assert.ok(checkpoint.metadata.history.every(row => row.version < receipt.version), 'Provider receipt must append history');
  assert.equal(receipt.name, personalRatingHostedManifest.providerName, 'Unexpected numeric provider migration name');
  const wrapper = await personalRatingHostedGuardedMigrationSql(checkpoint, expectedProjectRef);
  assert.equal(receipt.statementMd5, hash(wrapper, 'md5'), 'Provider must acknowledge exact numeric guarded wrapper');
  return postcheckSql(checkpoint, refs, receipt);
}
export async function personalRatingHostedPostflightSql(checkpoint, expectedProjectRef, receipt) {
  const assertion = await personalRatingHostedPostflightAssertionSql(checkpoint, expectedProjectRef, receipt);
  return `-- Independently verify the actual connected project: ${expectedProjectRef}
    begin isolation level repeatable read read only;set local search_path=pg_catalog;set local timezone='UTC';
    set local statement_timeout='30s';${assertion}
    select to_jsonb('PASS: numeric provider receipt and preservation'::text) snapshot;rollback;`;
}
