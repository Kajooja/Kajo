// Proposed application installation for disposable test databases only.
// Reconstructs reviewed source; never imports a hosted dump or replays history.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createSourceRelationDatabase, loadRelationSource } from './relation-source.mjs';
import { buildBaselineFunctions, resolveBaselineDefinition } from './baseline-functions.mjs';
import { buildDeterministicSeedSql } from './system-seed-source.mjs';
import { loadApplicationTriggerSource } from './trigger-source.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export async function buildBaselineInstallation() {
  const [source, functions, triggers, seeds, compatibility] = await Promise.all([
    loadRelationSource(), buildBaselineFunctions(), loadApplicationTriggerSource(),
    buildDeterministicSeedSql(), readFile(new URL('baseline-compatibility-grants.sql', import.meta.url), 'utf8'),
  ]);
  const defaults = source.privileges.filter(row => row.sql.startsWith('alter default privileges'));
  assert.equal(defaults.length, 4);
  const tables = source.statements.filter(row => /^create table /i.test(row.sql))
    .map(row => row.sql.match(/^create table (?:if not exists )?((?:public|private)\.[a-z_][a-z0-9_]*)\s*\(/i)?.[1]).sort();
  assert.equal(tables.length, 30);
  assert.ok(tables.every(Boolean));
  assert.equal(triggers.triggerCount, 22);
  // Caller owns BEGIN/COMMIT. Guard runs before any application DDL. Native
  // platform namespaces, roles and event-trigger definitions are left intact.
  const sql = `do $application_install_guard$ begin
    if current_user <> 'postgres' then raise exception 'Application test install requires creator postgres'; end if;
    if exists(select 1 from auth.users)
      or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','S','f','c'))
      or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','private'))
      or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
        where n.nspname in ('public','private') and t.typrelid=0 and t.typelem=0) then
      raise exception 'Application test install requires empty application schemas and Auth';
    end if;
  end; $application_install_guard$;
  create schema if not exists private authorization postgres;
  -- Close Supabase's schema additions BEFORE creating application objects.
  ${defaults.map(row => row.sql).join('\n')}
  -- Signature scaffolding resolves CHECK/policy dependencies. All bodies are
  -- validated again after the canonical tables exist, before committing.
  set local check_function_bodies = off;
  ${source.functions.definitions.map(resolveBaselineDefinition).join('\n\n')}
  ${source.statements.map(row => row.sql).join('\n\n')}
  ${functions.sql}
  ${source.privileges.map(row => row.sql).join('\n')}
  ${compatibility}
  ${triggers.sql}
  ${seeds}
  `;
  const rowCounts = [...tables, 'auth.users'].map(name =>
    `select '${name}' as identity,(select count(*) from ${name}) as rows`).join('\nunion all\n');
  const inventorySql = `begin read only; set local search_path=pg_catalog;
    select jsonb_build_object(
      'rowCounts',(select jsonb_object_agg(identity,rows order by identity) from (${rowCounts}) counts),
      'tablesWithoutRls',(select coalesce(jsonb_agg(n.nspname || '.' || c.relname order by n.nspname,c.relname),'[]'::jsonb)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private') and c.relkind in ('r','p') and not c.relrowsecurity),
      'triggers',(select jsonb_agg(jsonb_build_array(n.nspname || '.' || c.relname,t.tgname,
        pg_get_triggerdef(t.oid),t.tgenabled) order by n.nspname,c.relname,t.tgname)
        from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
        where not t.tgisinternal and (n.nspname in ('public','private') or
          (n.nspname='auth' and c.relname='users' and t.tgname='provision_kajo_personal_profile'))),
      'seeds',jsonb_build_object(
        'genomes',(select jsonb_agg(to_jsonb(g) order by id) from private.predictor_genomes g),
        'promotions',(select jsonb_agg(to_jsonb(p) order by id) from private.promotion_decisions p),
        'assignments',(select jsonb_agg(to_jsonb(a) order by id) from private.policy_assignments a))) as snapshot;
    rollback;`;
  const metadata = { cutoff: source.cutoff, sourceCheckpoint: source.sourceCheckpoint,
    ddlSha256: source.ddlSha256, functionSha256: functions.sha256,
    triggerSha256: triggers.triggerSqlSha256, seedSha256: hash(seeds),
    compatibilitySha256: hash(compatibility), installationSha256: hash(sql) };
  return { sql, inventorySql, metadata, tables };
}

export async function snapshotApplication(execSnapshots, candidate) {
  const [relationsSql, functionsSql] = await Promise.all([
    readFile(new URL('relation-schema-snapshot.sql', import.meta.url), 'utf8'),
    readFile(new URL('function-schema-snapshot.sql', import.meta.url), 'utf8'),
  ]);
  const snapshots = await execSnapshots(relationsSql + '\n' + functionsSql + '\n' + candidate.inventorySql);
  assert.equal(snapshots.length, 3);
  const [relations, functions, inventory] = snapshots;
  assert.deepEqual(relations.relations.map(row => row.identity), candidate.tables);
  assert.equal(functions.functions.length, 122);
  assert.deepEqual(inventory.tablesWithoutRls, []);
  assert.equal(inventory.triggers.length, 22);
  return { relations, functions, inventory };
}

export function assertEmptyApplication(snapshot) {
  const expectedSeeds = { 'private.predictor_genomes': 4, 'private.promotion_decisions': 4,
    'private.policy_assignments': 1 };
  for (const [name, count] of Object.entries(snapshot.inventory.rowCounts)) {
    assert.equal(count, expectedSeeds[name] ?? 0, `Unexpected installation row count in ${name}`);
  }
}

// Independent source-only reference: plain PostgreSQL grants, literal source
// DDL and separately reviewed supplements, without the candidate's install path.
export async function sourceApplicationReference(candidate) {
  const { db } = await createSourceRelationDatabase();
  try {
    const [functions, triggers, seeds, compatibility] = await Promise.all([
      buildBaselineFunctions(), loadApplicationTriggerSource(), buildDeterministicSeedSql(),
      readFile(new URL('baseline-compatibility-grants.sql', import.meta.url), 'utf8'),
    ]);
    await db.exec(`begin; ${functions.sql} ${compatibility} ${triggers.sql} ${seeds} commit;`);
    return await snapshotApplication(async sql => (await db.exec(sql)).flatMap(result => result.rows
      .filter(row => Object.hasOwn(row, 'snapshot')).map(row => row.snapshot)), candidate);
  } finally { await db.close(); }
}

export async function applicationSmokeSql() {
  const [imports, shared, personal] = await Promise.all([
    readFile(new URL('baseline-function-smoke.sql', import.meta.url), 'utf8'),
    readFile(new URL('shared-install-smoke.sql', import.meta.url), 'utf8'),
    readFile(new URL('bootstrap-ranking.hosted-smoke.sql', import.meta.url), 'utf8'),
  ]);
  assert.equal((personal.match(/^begin;$/gm) ?? []).length, 1);
  assert.ok(personal.trimEnd().endsWith('rollback;'));
  const result = "select current_setting('kajo.bootstrap_smoke_result') as result;";
  assert.equal(personal.split(result).length, 2);
  return `begin;\n${imports}\n${shared}\n${personal.replace(/^begin;$/m, '')
    .replace(result, "select jsonb_build_object('smoke',current_setting('kajo.bootstrap_smoke_result')) as snapshot;")}`;
}
