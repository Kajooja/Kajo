// Independent populated-database upgrade verification. The probe applies only
// the unchanged forward migration; it never installs/reinstalls the candidate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadRelationSource } from './relation-source.mjs';
import { buildBaselineFunctions, resolveBaselineDefinition } from './baseline-functions.mjs';
import { buildDeterministicSeedSql } from './system-seed-source.mjs';
import { loadApplicationTriggerSource } from './trigger-source.mjs';
import { functionDigestSql } from './platform-default-probe.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const read = name => readFile(new URL(name, import.meta.url), 'utf8');

// CI fixture, not a deployment route or historical replay. Uses the independently
// reviewed source reference and compatibility contract, not the candidate builder.
// PostgreSQL's global PUBLIC function default remains OPEN, as before the upgrade.
export async function buildExistingApplicationFixture() {
  const [source, functions, triggers, seeds, compatibility, data] = await Promise.all([
    loadRelationSource(), buildBaselineFunctions(), loadApplicationTriggerSource(),
    buildDeterministicSeedSql(), read('baseline-compatibility-grants.sql'), read('existing-application-fixture.sql'),
  ]);
  const defaults = source.privileges.filter(row => row.sql.startsWith('alter default privileges'));
  const sql = `create schema private;
    ${defaults.map(row => row.sql).join('\n')}
    set local check_function_bodies=off;
    ${source.functions.definitions.map(resolveBaselineDefinition).join('\n')}
    ${source.statements.map(row => row.sql).join('\n')}
    ${functions.sql}
    ${source.privileges.map(row => row.sql).join('\n')}
    ${compatibility}
    ${triggers.sql}
    ${seeds}
    ${data}`;
  return { sql, metadata: { kind: 'populated-source-checkpoint', cutoff: source.cutoff,
    sourceCheckpoint: source.sourceCheckpoint, fixtureSha256: hash(sql), dataSha256: hash(data) } };
}

// Hash complete rows, including timestamps and nested trace/evidence payloads.
// No row content leaves the synthetic database. Also preserves any existing CLI
// migration tracking; no tracking row is ever inserted, removed or marked applied.
const rowsSql = `begin read only; set local search_path=pg_catalog;
  do $rows$ declare r record; value jsonb; result jsonb := '{}'::jsonb; begin
    for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind in ('r','p') and (n.nspname in ('public','private')
        or (n.nspname='auth' and c.relname='users')
        or (n.nspname='supabase_migrations' and c.relname='schema_migrations'))
      order by n.nspname,c.relname loop
      execute format('select jsonb_build_object(''count'',count(*),''sha256'',
        encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),
          ''[]''::jsonb)::text,''UTF8'')),''hex'')) from %I.%I t',r.nspname,r.relname) into value;
      result := result || jsonb_build_object(r.nspname || '.' || r.relname,value);
    end loop;
    perform set_config('kajo.upgrade_row_snapshot',result::text,true);
  end; $rows$;
  select current_setting('kajo.upgrade_row_snapshot')::jsonb as snapshot; rollback;`;

const triggersSql = `begin read only; set local search_path=pg_catalog;
  select coalesce(jsonb_agg(jsonb_build_array(n.nspname || '.' || c.relname,t.tgname,
    pg_get_triggerdef(t.oid),t.tgenabled) order by n.nspname,c.relname,t.tgname),'[]'::jsonb) as snapshot
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname !~ '^pg_' and n.nspname <> 'information_schema';
  rollback;`;

export async function snapshotExistingApplication(exec) {
  const [relations, functions, platform] = await Promise.all([
    read('relation-schema-snapshot.sql'), read('function-schema-snapshot.sql'), read('platform-schema-snapshot.sql'),
  ]);
  const snapshots = await exec(`${relations}\n${functions}\n${platform}\n${rowsSql}\n${triggersSql}
    begin read only; set local search_path=pg_catalog; ${functionDigestSql()} rollback;`);
  assert.equal(snapshots.length, 6);
  const [relationSnapshot, applicationFunctions, platformSnapshot, rows, triggers, allFunctions] = snapshots;
  return { relations: relationSnapshot, applicationFunctions, platform: platformSnapshot, rows, triggers, allFunctions };
}

export function assertUpgradePreserved(before, after) {
  for (const key of ['relations', 'applicationFunctions', 'rows', 'triggers', 'allFunctions']) {
    assert.deepEqual(after[key], before[key], `Upgrade changed existing ${key}`);
  }
  const { creatorDefaults: beforeDefaults, ...beforePlatform } = before.platform;
  const { creatorDefaults: afterDefaults, ...afterPlatform } = after.platform;
  assert.deepEqual(afterPlatform, beforePlatform, 'Upgrade changed native platform metadata');
  const unaffected = rows => (rows ?? []).filter(row => !(row.creator === 'postgres'
    && row.kind === 'f' && ['*', 'public', 'private'].includes(row.schema)));
  assert.deepEqual(unaffected(afterDefaults), unaffected(beforeDefaults), 'Upgrade changed unrelated defaults');
}

export async function probeExistingApplicationUpgrade(exec) {
  const [migration, defaultsSmoke, runtimeSmoke] = await Promise.all([
    read('../../supabase/migrations/20260909131913_close_postgres_function_defaults.sql'),
    read('function-defaults-smoke.sql'), read('existing-application-smoke.sql'),
  ]);
  const before = await snapshotExistingApplication(exec);
  assert.equal(before.relations.relations.length, 30, 'Expected the full existing application');
  for (const table of ['auth.users', 'public.profiles', 'public.profile_members', 'public.items',
    'public.events', 'public.item_interactions', 'private.profile_import_jobs',
    'private.profile_bootstrap_evidence', 'private.prediction_runs', 'private.prediction_candidates',
    'private.predictor_genomes', 'private.policy_assignments', 'private.promotion_decisions']) {
    assert.ok(before.rows[table]?.count > 0, `Existing fixture is missing rows in ${table}`);
  }
  // Prove this is a real transition from the old default, not an already-corrected
  // new installation. The temporary canary is rolled back before the migration.
  await exec(`begin;
    create function public.kajo_upgrade_before() returns integer language sql as $$select 1$$;
    set local role anon;
    do $$ begin
      if public.kajo_upgrade_before() <> 1 then raise exception 'Pre-upgrade default canary failed'; end if;
    end $$;
    rollback;`);
  await exec(`begin; ${runtimeSmoke} rollback;`);
  assert.deepEqual(await snapshotExistingApplication(exec), before, 'Pre-upgrade smoke changed existing state');
  await exec(`begin; ${migration} commit;`);
  const after = await snapshotExistingApplication(exec);
  assertUpgradePreserved(before, after);
  await exec(`begin; ${migration} commit;`);
  assert.deepEqual(await snapshotExistingApplication(exec), after, 'Repeated upgrade changed state');
  await exec(`begin; ${defaultsSmoke} ${runtimeSmoke} rollback;`);
  assert.deepEqual(await snapshotExistingApplication(exec), after, 'Post-upgrade smoke changed existing state');
  return { format: 'kajo-existing-application-upgrade-v1', status: 'PASS',
    migrationSha256: hash(migration), existingSnapshotSha256: hash(JSON.stringify(before)),
    correctedSnapshotSha256: hash(JSON.stringify(after)), before, after };
}
