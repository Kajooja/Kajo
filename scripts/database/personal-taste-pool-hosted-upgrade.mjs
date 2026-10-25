// Target-bound SQL preparation only. No network client or hosted executor.
// The operator verifies the connected project separately, saves the private
// checkpoint, and applies the returned wrapper in ONE provider transaction.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

const quote = value => "'" + value.replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + '::jsonb';
const sha256 = value => createHash('sha256').update(value).digest('hex');
export const tastePoolHostedForward = Object.freeze({
  filename: '20261024125357_versioned_taste_candidate_pools.sql',
  sha256: 'a02f205193864154ba0b17bcc5a92c873d4b53ae9d9c345e24d4a1224ac69040',
  providerName: 'versioned_taste_candidate_pools',
});
const sessionTable = 'private.sequential_taste_sessions';
const poolTable = 'private.sequential_taste_candidate_pools_v4';
const providerHistoryTable = 'auth.schema_migrations';
const policyConstraint = 'sequential_taste_sessions_policy_check';
const changedFunctions = [
  'private.sequential_taste_snapshot_v2(uuid)',
  'private.project_sequential_taste_evidence_v2(uuid,jsonb,jsonb)',
  'private.taste_session_v2(jsonb)',
  'private.commit_taste_contextual_skip_v1(jsonb)',
];
const newFunctions = [
  'private.taste_candidate_catalog_v4(uuid,timestamp with time zone)',
  'private.sequential_taste_question_catalog_v4(uuid,uuid)',
  'private.assert_sequential_taste_pool_live_v4(uuid,uuid)',
  'private.guard_sequential_taste_candidate_pool_v4()',
  'private.redact_sequential_taste_candidate_pool_v4()',
];
const newTriggers = [
  poolTable + '.guard_sequential_taste_candidate_pool_v4',
  'private.sequential_taste_panels.redact_sequential_taste_candidate_pool_v4',
];

export function validateTastePoolHostedForward(file) {
  assert.equal(file?.name, tastePoolHostedForward.filename, 'Expected the single reviewed Taste pool forward');
  assert.equal(sha256(file.sql), tastePoolHostedForward.sha256, 'Reviewed Taste pool SQL changed');
  return file;
}
export async function loadTastePoolHostedForward() {
  return validateTastePoolHostedForward({ name: tastePoolHostedForward.filename,
    sql: await readFile(new URL('../../supabase/migrations/' + tastePoolHostedForward.filename, import.meta.url), 'utf8') });
}

// Metadata and aggregate hashes only: no rows, function bodies or migration SQL
// leave the target. Full pg_proc metadata hashes protect existing identities.
export const tastePoolHostedMetadataQuery = `select jsonb_build_object(
  'serverMajor',current_setting('server_version_num')::integer/10000,
  'history',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
    'statementMd5',md5(array_to_string(statements,E'\\n'))) order by version),'[]') from supabase_migrations.schema_migrations),
  'functions',(select coalesce(jsonb_object_agg(signature,entry),'{}') from (
    select format('%I.%I(%s)',n.nspname,p.proname,replace(oidvectortypes(p.proargtypes),', ',',')) signature,
      jsonb_build_object('oid',p.oid::text,'metadataMd5',md5((to_jsonb(p)-'prosrc')::text),'bodyMd5',md5(p.prosrc),
        'normal',jsonb_build_object('owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
          'definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'leakproof',p.proleakproof,
          'parallel',p.proparallel,'language',l.lanname,'result',pg_get_function_result(p.oid))) entry
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname in('public','private') and p.prokind='f') f),
  'tables',(select coalesce(jsonb_object_agg(identity,entry),'{}') from (
    select format('%I.%I',n.nspname,c.relname) identity,jsonb_build_object('oid',c.oid::text,
      'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
      'columns',(select coalesce(jsonb_object_agg(a.attname,jsonb_build_object('position',a.attnum,
        'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,
        'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))),'{}')
        from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints',(select coalesce(jsonb_object_agg(x.conname,jsonb_build_object('definition',pg_get_constraintdef(x.oid),
        'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred)),'{}') from pg_constraint x where x.conrelid=c.oid),
      'indexes',(select coalesce(jsonb_object_agg(i.relname,pg_get_indexdef(x.indexrelid)),'{}') from pg_index x join pg_class i on i.oid=x.indexrelid where x.indrelid=c.oid),
      'policies',(select coalesce(jsonb_object_agg(p.polname,to_jsonb(p)-'oid'-'polrelid'),'{}') from pg_policy p where p.polrelid=c.oid)) entry
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth')) t),
  'triggers',(select coalesce(jsonb_object_agg(format('%I.%I.%I',n.nspname,c.relname,t.tgname),
    jsonb_build_object('oid',t.oid::text,'definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)),'{}')
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in('public','private','auth') and not t.tgisinternal)) snapshot`;
export const tastePoolHostedMetadataSql = `begin read only;set local search_path=pg_catalog;set local timezone='UTC';
  set local statement_timeout='30s';${tastePoolHostedMetadataQuery};rollback;`;

function tableNames(metadata) {
  const names = Object.keys(metadata?.tables ?? {}).sort();
  assert.ok(names.length > 0 && names.includes(sessionTable), 'Complete canonical table metadata required');
  names.forEach(name => assert.match(name, /^(public|private|auth)\.[a-z][a-z0-9_]*$/, 'Unsupported table identity'));
  return names;
}
// Supabase owns this one auth-system relation. The application forward never
// writes it, and the deployment role may have SELECT only. ACCESS SHARE blocks
// DDL, not provider DML: its unchanged rows are observed before/after, whereas
// every application table and application migration history remain write-locked.
// Never choose weaker locks automatically from failed privilege checks.
export function tastePoolHostedLockSql(metadata) {
  const names = tableNames(metadata);
  const providerHistory = names.includes(providerHistoryTable);
  if (providerHistory) assert.equal(metadata.tables[providerHistoryTable].owner,
    'supabase_auth_admin', 'Unexpected owner of observed provider history');
  return `${providerHistory ? `do $taste_pool_provider_history$ begin
      if (select pg_get_userbyid(relowner) from pg_class where oid='auth.schema_migrations'::regclass)
        is distinct from 'supabase_auth_admin' or not has_table_privilege(current_user,'auth.schema_migrations','SELECT') then
        raise exception 'Taste pool provider history owner/read boundary drift';end if;
    end;$taste_pool_provider_history$;
    lock table auth.schema_migrations in access share mode;` : ''}
    lock table ${[...names.filter(name => name !== providerHistoryTable),'supabase_migrations.schema_migrations'].join(',')} in share mode;`;
}
function rowsQuery(names) {
  // Hash each complete row once before ordering. Large prediction traces must
  // never be accumulated/sorted as one giant jsonb array while SHARE locks hold.
  // Fixed-width hashes preserve the multiset, including duplicate multiplicity.
  return `select jsonb_object_agg(identity,value) snapshot from (${names.map(name =>
    `select ${quote(name)} identity,jsonb_build_object('count',count(*),'algorithm','MD5_SORTED_ROW_MD5_V1',
      'md5',md5(coalesce(string_agg(digest,'' order by digest),''))) value
      from (select md5(to_jsonb(r)::text) digest from ${name} r offset 0) hashed`).join(' union all ')}) rows`;
}
export function tastePoolHostedRowsSql(metadata) {
  return `begin read only;set local search_path=pg_catalog;set local timezone='UTC';set local statement_timeout='30s';${rowsQuery(tableNames(metadata))};rollback;`;
}

let referencePromise;
async function reference() {
  if (!referencePromise) referencePromise = (async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;
        create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);`);
      const { files } = await buildFreshInstallation();
      const index = files.findIndex(file => file.name === tastePoolHostedForward.filename);
      assert.ok(index > 0, 'Taste pool source checkpoint missing');
      for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
      const snapshot = async () => (await db.exec(tastePoolHostedMetadataSql)).flatMap(r => r.rows)[0].snapshot;
      const before = await snapshot();
      await db.exec(`begin;${(await loadTastePoolHostedForward()).sql}commit;`);
      return { before, after: await snapshot() };
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
  assert.deepEqual(Object.keys(rows ?? {}).sort(), tableNames(metadata), 'Every canonical table needs a row checkpoint');
  for (const row of Object.values(rows)) {
    assert.ok(Number.isSafeInteger(row.count) && row.count >= 0, 'Invalid row count');
    assert.equal(row.algorithm, 'MD5_SORTED_ROW_MD5_V1', 'Unreviewed row digest algorithm');
    assert.match(row.md5, /^[a-f0-9]{32}$/, 'Invalid row digest');
  }
  assert.ok(Array.isArray(metadata.history), 'Exact migration history required');
  const versions = new Set();
  for (const receipt of metadata.history) {
    assert.match(receipt.version, /^\d{14}$/);assert.match(receipt.statementMd5, /^[a-f0-9]{32}$/);
    assert.ok(!versions.has(receipt.version), 'Duplicate provider history version');versions.add(receipt.version);
    assert.ok(!receipt.name?.includes(tastePoolHostedForward.providerName), 'Taste pool forward already recorded; never replay');
  }
  assert.ok(!metadata.tables[poolTable] && newFunctions.every(key => !metadata.functions[key])
    && newTriggers.every(key => !metadata.triggers[key]), 'Taste pool objects already exist; never replay');
  const refs = await reference();
  for (const key of changedFunctions) {
    assert.equal(metadata.functions[key]?.bodyMd5, refs.before.functions[key].bodyMd5, `Taste pool source drift: ${key}`);
    assert.deepEqual(metadata.functions[key]?.normal, refs.before.functions[key].normal, `Taste pool security drift: ${key}`);
  }
  assert.deepEqual(metadata.tables[sessionTable].columns.policy, refs.before.tables[sessionTable].columns.policy, 'Retained policy default drift');
  assert.deepEqual(metadata.tables[sessionTable].constraints[policyConstraint], refs.before.tables[sessionTable].constraints[policyConstraint], 'Retained policy constraint drift');
  return refs;
}

function assertSnapshotSql(checkpoint) {
  return `do $taste_pool_preflight$ declare actual jsonb;begin
    select snapshot into actual from (${tastePoolHostedMetadataQuery}) m;
    if actual is distinct from ${json(checkpoint.metadata)} then raise exception 'Taste pool target metadata/history drift';end if;
    select snapshot into actual from (${rowsQuery(tableNames(checkpoint.metadata))}) r;
    if actual is distinct from ${json(checkpoint.rows)} then raise exception 'Taste pool retained rows changed';end if;
  end;$taste_pool_preflight$;`;
}

function postcheckSql(checkpoint, refs, receipt = null) {
  const expected = structuredClone(checkpoint.metadata);
  for (const key of changedFunctions) expected.functions[key].bodyMd5 = refs.after.functions[key].bodyMd5;
  for (const key of newFunctions) {
    const { bodyMd5, normal } = refs.after.functions[key];expected.functions[key] = { bodyMd5, normal };
  }
  const { oid: _poolOid, ...newTable } = refs.after.tables[poolTable];
  expected.tables[poolTable] = newTable;
  expected.tables[sessionTable].columns.policy = refs.after.tables[sessionTable].columns.policy;
  expected.tables[sessionTable].constraints[policyConstraint] = refs.after.tables[sessionTable].constraints[policyConstraint];
  for (const key of newTriggers) { const { oid: _oid, ...value } = refs.after.triggers[key];expected.triggers[key] = value; }
  return `do $taste_pool_postcheck$ declare actual jsonb;k text;begin
    select snapshot into actual from (${tastePoolHostedMetadataQuery}) m;
    ${receipt ? `if actual->'history' is distinct from (${json(checkpoint.metadata.history)}||jsonb_build_array(${json(receipt)})) then
      raise exception 'Taste pool provider receipt/history mismatch';end if;
      actual:=jsonb_set(actual,'{history}',${json(checkpoint.metadata.history)});` : ''}
    foreach k in array array[${newFunctions.map(quote).join(',')}] loop
      actual:=jsonb_set(actual,array['functions',k],(actual#>array['functions',k])-'oid'-'metadataMd5');
    end loop;
    actual:=jsonb_set(actual,array['tables',${quote(poolTable)}],(actual#>array['tables',${quote(poolTable)}])-'oid');
    foreach k in array array[${newTriggers.map(quote).join(',')}] loop
      actual:=jsonb_set(actual,array['triggers',k],(actual#>array['triggers',k])-'oid');
    end loop;
    if actual is distinct from ${json(expected)} then raise exception 'Taste pool post-install metadata/security drift';end if;
    select snapshot into actual from (${rowsQuery(tableNames(checkpoint.metadata))}) r;
    if actual is distinct from ${json(checkpoint.rows)} then raise exception 'Taste pool installation changed retained rows';end if;
    if exists(select 1 from private.sequential_taste_candidate_pools_v4) then raise exception 'Unexpected retroactive Taste pools';end if;
  end;$taste_pool_postcheck$;`;
}

export async function tastePoolHostedPreflightSql(checkpoint, expectedProjectRef) {
  await validateCheckpoint(checkpoint, expectedProjectRef);
  return `-- Operator must independently verify connected project: ${expectedProjectRef}
    begin read only;set local search_path=pg_catalog;set local timezone='UTC';set local statement_timeout='30s';
    ${assertSnapshotSql(checkpoint)}select 'PASS: exact Taste pool target checkpoint' snapshot;rollback;`;
}

// This is a single migration payload, WITHOUT transaction delimiters/history
// writes. The provider must execute all statements and its receipt atomically.
// Bounded SHARE locks prevent application writes between checkpoints. Only the
// explicit provider-owned auth history exception above is observation-only.
// Fail instead of waiting indefinitely. Embedded migration bytes remain intact.
export async function tastePoolHostedGuardedMigrationSql(checkpoint, expectedProjectRef) {
  const refs = await validateCheckpoint(checkpoint, expectedProjectRef);
  const file = await loadTastePoolHostedForward();
  return `-- Target ${expectedProjectRef}; embedded source SHA-256 ${tastePoolHostedForward.sha256}
    set local search_path=pg_catalog;set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='30s';
    ${tastePoolHostedLockSql(checkpoint.metadata)}
    ${assertSnapshotSql(checkpoint)}
${file.sql}
    ${postcheckSql(checkpoint, refs)}
    select 'PASS: Taste pool exact forward and retained state verified atomically' snapshot;`;
}

export async function tastePoolHostedPostflightSql(checkpoint, expectedProjectRef, receipt) {
  const refs = await validateCheckpoint(checkpoint, expectedProjectRef);
  assert.match(receipt?.version ?? '', /^\d{14}$/, 'Exact acknowledged provider version required');
  assert.ok(checkpoint.metadata.history.every(r => r.version < receipt.version), 'Provider receipt must append history');
  assert.equal(receipt.name, tastePoolHostedForward.providerName, 'Unexpected provider migration name');
  const wrapper = await tastePoolHostedGuardedMigrationSql(checkpoint, expectedProjectRef);
  assert.equal(receipt.statementMd5, createHash('md5').update(wrapper).digest('hex'), 'Provider must acknowledge exact guarded wrapper');
  return `-- Operator must independently verify connected project: ${expectedProjectRef}
    begin read only;set local search_path=pg_catalog;set local timezone='UTC';set local statement_timeout='30s';
    ${postcheckSql(checkpoint, refs, receipt)}select 'PASS: Taste pool provider receipt and preservation' snapshot;rollback;`;
}
