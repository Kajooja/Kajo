import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { loadTasteHostedForwards, tasteHostedUpgradeSql, tasteImmutableGuardCanonicalBody, tasteImmutableGuardCompactBody } from './personal-taste-hosted-upgrade.mjs';

const signature='private.reject_immutable_prediction_artifact_change_v1()';
const snapshotSql=`select pg_get_functiondef(p.oid) definition,p.prosrc,
  to_jsonb(p)-'prosrc' metadata from pg_proc p where p.oid='${signature}'::regprocedure`;
const bridge=await readFile(new URL('../../supabase/migrations/20261013080259_taste_immutable_guard_compatibility.sql',import.meta.url),'utf8');

async function catalogDatabase() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const {files}=await buildFreshInstallation();
  const start=files.findIndex(f=>f.name.endsWith('_shared_rating_round_evidence.sql'));
  for(const file of files.slice(0,start))await db.exec(`begin;${file.sql}commit;`);
  return db;
}

test('exact compact guard bridge preserves metadata and enables unchanged populated Taste chain',async()=>{
  const db=await catalogDatabase();
  try {
    const original=(await db.query(snapshotSql)).rows[0];
    await db.exec(original.definition.replace(original.prosrc,()=>tasteImmutableGuardCompactBody));
    const compact=(await db.query(snapshotSql)).rows[0];
    const forwards=await loadTasteHostedForwards();
    const compound=await tasteHostedUpgradeSql(forwards);
    await assert.rejects(db.exec(compound),/Unknown immutable Prediction artifact guard/);
    await db.exec('rollback;');
    assert.deepEqual((await db.query(snapshotSql)).rows[0],compact,'Refused chain changed guard');
    assert.equal((await db.query("select to_regclass('private.prediction_source_erasure_permissions') relation")).rows[0].relation,null);
    assert.equal((await db.query('select count(*)::integer n from auth.users')).rows[0].n,0,'Failed chain retained fixture rows');

    await db.exec('begin;'+bridge);
    const canonical=(await db.query(snapshotSql)).rows[0];
    assert.equal(canonical.prosrc,tasteImmutableGuardCanonicalBody);
    assert.deepEqual(canonical.metadata,compact.metadata,'Bridge changed identity/ACL/configuration');
    await assert.rejects(db.query("update private.predictor_genomes set config=config where id=(select id from private.predictor_genomes limit 1)"),error=>error.code==='55000');
    await db.exec('rollback;');

    const repaired=compound.replace(forwards[4].sql,()=>bridge+'\n'+forwards[4].sql);
    const results=(await db.exec(repaired)).flatMap(r=>r.rows.map(row=>row.snapshot));
    assert.match(results[0]?.hostedTasteUpgrade,/^PASS: complete reviewed chain/);
    assert.match(results[1]?.personalTasteChallenge,/^PASS: canonical pre-answer freeze/);
    assert.deepEqual((await db.query(snapshotSql)).rows[0],compact,'Rollback changed compact starting state');
    assert.equal((await db.query('select count(*)::integer n from auth.users')).rows[0].n,0);
  }catch(error){delete error.query;throw error;}finally{await db.close();}
});

test('canonical and exact final-erasure bridge states are no-ops; unknown body and metadata drift reject',async()=>{
  const db=await catalogDatabase();
  try {
    const original=(await db.query(snapshotSql)).rows[0];
    await db.exec('begin;'+bridge+'commit;');
    assert.deepEqual((await db.query(snapshotSql)).rows[0],original);
    const erasure=(await loadTasteHostedForwards())[4].sql;
    const finalBody=erasure.match(/create or replace function private\.reject_immutable_prediction_artifact_change_v1\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i)?.[1];
    assert.ok(finalBody);
    assert.match(bridge,new RegExp(createHash('sha256').update(finalBody).digest('hex')),'Final body identity drifted');

    for(const mutate of [
      original.definition.replace(original.prosrc,()=>tasteImmutableGuardCompactBody+'\n'),
      original.definition.replace(original.prosrc,()=>original.prosrc.replace('55000','42501')),
      `grant execute on function ${signature} to authenticated;`,
      `alter function ${signature} security definer;`,
      `alter function ${signature} set search_path=public;`,
      `create role unreviewed_guard_owner;alter function ${signature} owner to unreviewed_guard_owner;`,
    ]) {
      await db.exec('begin;'+mutate);
      await assert.rejects(db.exec(bridge),/compatibility refused/);
      await db.exec('rollback;');
      assert.deepEqual((await db.query(snapshotSql)).rows[0],original);
    }

    // Normal chronological installation applies this appended bridge AFTER all
    // unchanged forwards. Its exact final erasure-body identity must be a no-op.
    const {files}=await buildFreshInstallation();
    const start=files.findIndex(f=>f.name.endsWith('_shared_rating_round_evidence.sql'));
    const bridgeIndex=files.findIndex(f=>f.name.endsWith('_taste_immutable_guard_compatibility.sql'));
    assert.ok(bridgeIndex>start);
    for(const file of files.slice(start,bridgeIndex))await db.exec(`begin;${file.sql}commit;`);
    const final=(await db.query(snapshotSql)).rows[0];
    assert.equal(final.prosrc,finalBody);
    await db.exec('begin;'+files[bridgeIndex].sql+'commit;');
    assert.deepEqual((await db.query(snapshotSql)).rows[0],final);
  }catch(error){delete error.query;throw error;}finally{await db.close();}
});
