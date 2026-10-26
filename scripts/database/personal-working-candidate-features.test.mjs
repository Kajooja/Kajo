import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalWorkingBridgeSmokeSql } from './personal-working-bridge.mjs';
import { personalWorkingResetSmokeSql } from './personal-working-reset.mjs';
import { personalWorkingCandidateFeaturePatches, personalWorkingCandidateFeaturesSmokeSql,
  personalWorkingCandidateFeaturesUpgradeSql } from './personal-working-candidate-features.mjs';

test('native candidate feature forward preserves genuine v1/v2 sources and freezes complete bounded v3 candidates with exact OFF',
  {timeout:180_000},async t=>{
    const db=new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;
        create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const {files}=await buildFreshInstallation();
      const reset=files.findIndex(file=>file.name.endsWith('_personal_working_reset.sql'));
      const precision=files.findIndex(file=>file.name.endsWith('_personal_working_shadow_precision.sql'));
      const feature=files.findIndex(file=>file.name.endsWith('_personal_working_candidate_features.sql'));
      assert.equal(precision,reset+1);assert.equal(feature,precision+1,'Feature freeze is one new forward after immutable precision72');
      for(const file of files.slice(0,reset)) await db.exec(`begin;${file.sql}commit;`);
      const upgrade=async candidate=>personalWorkingCandidateFeaturesUpgradeSql(files[reset],files[precision],candidate);
      const results=(await db.exec(await upgrade(files[feature]))).flatMap(row=>row.rows.map(item=>item.snapshot));
      assert.match(results[0]?.personalWorkingCandidateFeaturesUpgrade,/^PASS: genuine v1\/v2/);
      // Same-count row changes, extra approved-body bytes, loss of function-local
      // precision, and an exposed private helper must all fail the reusable verifier.
      for(const [label,mutation] of [
        ['populated Item row bytes',"update public.items set title=title||' unapproved feature mutation';"],
        ['unreviewed old-body bytes',`do $$ declare p record;begin
          select pg_get_functiondef(oid) definition,prosrc into strict p from pg_proc
            where oid='private.record_personal_working_shadow_v1(uuid,text)'::regprocedure;
          execute replace(p.definition,p.prosrc,p.prosrc||E'\n-- unapproved candidate feature body');end;$$;`],
        ['writer precision loss','alter function private.record_personal_working_shadow_v1(uuid,text) reset extra_float_digits;'],
        ['private helper broad ACL','grant execute on function private.personal_working_explanation_v1(jsonb,text[]) to authenticated;'],
      ]) await t.test(`populated feature verifier rejects ${label}`,async()=>{
        try {await assert.rejects(db.exec(await upgrade({...files[feature],sql:files[feature].sql+'\n'+mutation})),
          /changed|approved|preserv|permission|EXECUTE/i);}
        finally {await db.exec('rollback;');}
      });
      await db.exec(`begin;${files[reset].sql}${files[precision].sql}${files[feature].sql}commit;`);
      assert.ok(personalWorkingCandidateFeaturePatches.some(patch=>patch.signature==='private.record_personal_working_shadow_v1(uuid,text)'),
        'New generation changes an explicitly reviewed old writer body while preserving its exact precision metadata');
      const serializer=(await db.query(`select proconfig from pg_proc
        where oid='private.record_personal_working_shadow_v1(uuid,text)'::regprocedure`)).rows[0];
      assert.deepEqual(serializer.proconfig,['search_path=""','extra_float_digits=3']);
      await db.exec('set extra_float_digits=-3;');
      const smoke=(await db.exec(await personalWorkingCandidateFeaturesSmokeSql())).flatMap(row=>row.rows.map(item=>item.snapshot));
      assert.match(smoke[0]?.personalWorkingCandidateFeatures,/^PASS: actual BOOK\/MOVIE/);
      assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits,'-3',
        'Disposable explicit-caller0 smoke restores the actual outer caller after rollback');
      // Existing native capture/reset smoke remains valid in the fresh latest
      // installation instead of silently bypassing older lifecycle acceptance.
      // These older direct-capture numeric oracles use unrounded vector JSON;
      // the new source/comparison fixture above independently challenges caller0.
      await db.exec('set extra_float_digits=3;');
      await db.exec(await personalWorkingBridgeSmokeSql());
      await db.exec(await personalWorkingResetSmokeSql());
      // Native CLI also runs this same fixture after all later forwards. Exercise
      // that generation locally as well, including fresh/reused FINAL bindings.
      for(const file of files.slice(feature+1)) await db.exec(`begin;${file.sql}commit;`);
      await db.exec('set extra_float_digits=-3;');
      const latestSmoke=(await db.exec(await personalWorkingCandidateFeaturesSmokeSql()))
        .flatMap(row=>row.rows.map(item=>item.snapshot));
      assert.match(latestSmoke[0]?.personalWorkingCandidateFeatures,/^PASS: actual BOOK\/MOVIE/);
      assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits,'-3');
    } finally {await db.close();}
  });
