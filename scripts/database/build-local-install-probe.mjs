// Build an experimental, rollback-only SQL probe. Never an installation baseline.
// Requires the exact owner-supplied export; no database connection is opened here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { buildDeterministicSeedSql } from './system-seed-source.mjs';
import { buildBaselineFunctions } from './baseline-functions.mjs';

try {
  assert.equal(process.argv.length, 4,
    'Usage: node scripts/database/build-local-install-probe.mjs <kajo-schema.sql> <new-probe.sql>');
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '3f29a88a8937f38fd2014b3c8b8c4e2f9a46a0ee49b71bec680b5cdad7170c3e',
    'Unexpected schema export; review it before generating an executable probe');
  const seeds = await buildDeterministicSeedSql();
  const functions = await buildBaselineFunctions();
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  const auth = await readFile(new URL('20260827173000_auth_identifier_and_profile_fix.sql', migrations), 'utf8');
  const trigger = auth.match(/^create trigger provision_kajo_personal_profile\nafter insert on auth\.users\nfor each row execute function private\.provision_personal_profile_from_auth_user\(\);$/m)?.[0];
  assert.ok(trigger, 'Canonical Auth trigger not found');
  const smoke = await readFile(new URL('bootstrap-ranking.hosted-smoke.sql', import.meta.url), 'utf8');
  const sharedSmoke = await readFile(new URL('shared-install-smoke.sql', import.meta.url), 'utf8');
  const functionSmoke = await readFile(new URL('baseline-function-smoke.sql', import.meta.url), 'utf8');
  assert.equal((smoke.match(/^begin;$/gm) ?? []).length, 1);
  assert.ok(smoke.trimEnd().endsWith('rollback;'));
  // One outer transaction includes export, supplements and unchanged smoke body.
  const sql = `-- EXPERIMENTAL LOCAL PROBE: run only in a fresh local Supabase Docker database.
-- ON_ERROR_STOP must be enabled by psql. Everything is rolled back, even on success.
begin;
do $guard$
begin
  if exists(select 1 from auth.users)
     or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname in ('public','private') and c.relkind in ('r','p')) then
    raise exception 'Local probe requires an empty Auth/public/private database';
  end if;
end;
$guard$;
${bytes.toString('utf8')}
-- Use the reviewed repository function definitions, including both explicit
-- source-patch resolutions. No exported function body is accepted by default.
-- Function supplement SHA-256: ${functions.sha256}
${functions.sql}
-- The filtered export already contains application-table triggers. Its omitted
-- Auth trigger is reconstructed here from canonical source.
${trigger}
-- Proposed deterministic system seeds from hash-verified canonical source.
-- Empty-system-table guard; logical epoch is the schema cutoff. Not deployment.
${seeds}
-- Verify the copied trigger actually provisions a PersonalProfile on Auth insert.
do $auth_probe$
declare actor uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (actor,actor::text || '@example.invalid','{"kajo_nickname":"Local auth probe"}'::jsonb);
  if not exists(select 1 from public.profiles p join public.profile_members m on m.profile_id=p.id
    where p.owner_user_id=actor and p.profile_type='PERSONAL' and m.user_id=actor) then
    raise exception 'Auth trigger did not provision PersonalProfile and membership';
  end if;
end;
$auth_probe$;
${functionSmoke}
${sharedSmoke}
${smoke.replace(/^begin;$/m, '-- Outer transaction already active.')}
do $rollback_probe$
begin
  if to_regclass('public.profiles') is not null then
    raise exception 'Probe rollback did not restore the empty application schema';
  end if;
end;
$rollback_probe$;
select 'KAJO LOCAL INSTALL PROBE PASS - all probe changes rolled back' as result;
`;
  await writeFile(process.argv[3], sql, { flag: 'wx' });
  console.log('Local rollback-only probe created. This is not a deployment migration.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
