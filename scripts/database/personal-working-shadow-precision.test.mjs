import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalWorkingPrecisionSmokeSql, personalWorkingPrecisionUpgradeSql } from './personal-working-shadow-precision.mjs';

test('Working shadow precision forward preserves real v1/v2 artifacts and exact OFF binary scores across caller GUCs', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const reset = files.findIndex(file => file.name.endsWith('_personal_working_reset.sql'));
    const precision = files.findIndex(file => file.name.endsWith('_personal_working_shadow_precision.sql'));
    assert.equal(precision,reset+1,'Precision is the sole forward after immutable reset lineage');
    for (const file of files.slice(0,reset)) await db.exec(`begin;${file.sql}commit;`);
    const upgradeSql = await personalWorkingPrecisionUpgradeSql(files[reset],files[precision]);
    const result = (await db.exec(upgradeSql)).flatMap(item => item.rows.map(row => row.snapshot));
    assert.match(result[0]?.personalWorkingPrecisionUpgrade,/^PASS: genuine v1\/v2/);
    // Independently challenge the populated verifier: an unchanged row count
    // must not hide a row mutation, or an extra body/ACL change in the writer.
    for (const [label,mutation] of [
      ['populated Item bytes', "update public.items set title=title||' unapproved precision mutation';"],
      ['writer ACL', 'grant execute on function private.record_personal_working_shadow_v1(uuid,text) to authenticated;'],
      ['writer body', `do $$ declare f record;begin
        select pg_get_functiondef(oid) definition,prosrc into strict f from pg_proc
          where oid='private.record_personal_working_shadow_v1(uuid,text)'::regprocedure;
        execute replace(f.definition,f.prosrc,f.prosrc||E'\n-- unapproved precision body mutation');end;$$;`],
    ]) await t.test(`populated precision verifier rejects ${label}`, async () => {
      try {
        await assert.rejects(db.exec(await personalWorkingPrecisionUpgradeSql(files[reset],
          {...files[precision],sql:files[precision].sql+'\n'+mutation})),/Working precision assertion/);
      } finally {await db.exec('rollback;');}
    });
    await db.exec(`begin;${files[reset].sql}${files[precision].sql}commit;`);
    const installed=(await db.query(`select md5(prosrc) body_md5,proconfig from pg_proc
      where oid='private.record_personal_working_shadow_v1(uuid,text)'::regprocedure`)).rows[0];
    assert.equal(installed.body_md5,'0f13cc96568e3fc72d944c62ef27340e');
    assert.deepEqual(installed.proconfig,['search_path=""','extra_float_digits=3']);
    await db.exec('set extra_float_digits=-3;');
    const smoke=(await db.exec(await personalWorkingPrecisionSmokeSql())).flatMap(item=>item.rows.map(row=>row.snapshot));
    assert.match(smoke[0]?.personalWorkingBridge,/^PASS: actual canonical native Personal capture/);
    assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits,'-3',
      'Rollback also restores the outer caller after the explicit0 native smoke');
  } finally {await db.close();}
});
