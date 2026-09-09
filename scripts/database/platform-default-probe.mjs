// Transactional platform/default probe shared by CI's real PostgreSQL executor
// and deterministic SQL tests. No connection string or deployment operation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const functionsSql = `select jsonb_build_object('count',count(*),'sha256',
  encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(
    format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),
    pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),
    coalesce(p.proacl,acldefault('f',p.proowner))) order by n.nspname,p.proname,
      pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)::text,'UTF8')),'hex')) as snapshot
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and p.prokind in ('f','p');`;

export async function probePlatformDefaults(execSnapshots) {
  const [platformSql, correction, smoke] = await Promise.all([
    readFile(new URL('platform-schema-snapshot.sql', import.meta.url), 'utf8'),
    readFile(new URL('../../supabase/migrations/20260909131913_close_postgres_function_defaults.sql', import.meta.url), 'utf8'),
    readFile(new URL('function-defaults-smoke.sql', import.meta.url), 'utf8'),
  ]);
  assert.equal((platformSql.match(/^begin read only;$/gm) ?? []).length, 1);
  assert.equal((platformSql.match(/^rollback;$/gm) ?? []).length, 1);
  const platformBody = platformSql.replace(/^begin read only;$/m, '').replace(/^rollback;$/m, '');
  const [before] = await execSnapshots(platformSql);
  assert.equal(before?.format, 'kajo-platform-schema-v1');
  const [existingFunctions] = await execSnapshots(`begin read only; set local search_path=pg_catalog; ${functionsSql} rollback;`);
  assert.ok(existingFunctions.count > 0, 'Expected initialized platform functions');
  let corrected;
  try {
    const snapshots = await execSnapshots(`begin;
      do $guard$ begin
        if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname in ('public','private') and c.relkind in ('r','p'))
          or exists(select 1 from auth.users) then
          raise exception 'Platform probe requires an empty application/Auth database';
        end if;
      end; $guard$;
      create schema if not exists private authorization postgres;
      ${correction}
      ${platformBody}
      ${smoke}
      ${correction}
      ${platformBody}
      ${functionsSql}
      rollback;`);
    assert.equal(snapshots.length, 3, 'Unexpected probe snapshot count');
    const [first, repeated, functionsAfter] = snapshots;
    assert.deepEqual(repeated, first, 'Repeating the migration changed platform metadata');
    assert.deepEqual(functionsAfter, existingFunctions, 'Existing platform function definitions/owners/ACLs changed');
    for (const field of ['eventTriggers', 'roles', 'memberships']) {
      assert.deepEqual(first[field], before[field], `Migration changed platform ${field}`);
    }
    assert.deepEqual(first.schemas.filter(s => s.name !== 'private'),
      before.schemas.filter(s => s.name !== 'private'), 'Existing platform schema grants changed');
    const privateBefore = before.schemas.find(s => s.name === 'private');
    if (privateBefore) assert.deepEqual(first.schemas.find(s => s.name === 'private'), privateBefore);
    const unaffected = rows => (rows ?? []).filter(row => !(row.creator === 'postgres'
      && row.kind === 'f' && ['*', 'public', 'private'].includes(row.schema)));
    assert.deepEqual(unaffected(first.creatorDefaults), unaffected(before.creatorDefaults),
      'Defaults outside the reviewed creator/function/schema scope changed');
    corrected = first;
  } catch (error) {
    // A persistent test connection can remain in an aborted transaction; psql
    // disconnect already rolls it back. Neither executor may leave probe state.
    await execSnapshots('rollback;');
    throw error;
  }
  const [restored] = await execSnapshots(platformSql);
  assert.deepEqual(restored, before, 'Rollback did not restore the platform snapshot');
  return { format: 'kajo-platform-default-probe-v1', status: 'PASS',
    migration: '20260909131913_close_postgres_function_defaults.sql',
    migrationSha256: createHash('sha256').update(correction).digest('hex'),
    platformRestored: true, existingFunctions, before, corrected };
}
