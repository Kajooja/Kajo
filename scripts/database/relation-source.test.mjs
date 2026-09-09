import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createSourceRelationDatabase } from './relation-source.mjs';
import { compareRelationSchemas } from './relation-schema-parity.mjs';

const snapshotSql = await readFile(new URL('relation-schema-snapshot.sql', import.meta.url), 'utf8');
const snapshot = async db => (await db.exec(snapshotSql)).find(r => r.rows[0]?.snapshot).rows[0].snapshot;

test('source-only tables enforce membership RLS, unique/FK/check constraints and explicit grants', async () => {
  const { db } = await createSourceRelationDatabase();
  try {
    const baseline = await snapshot(db);
    assert.equal(baseline.relations.length, 30);
    // Auth signatures and explicit memberships only: no Auth lifecycle claim.
    await db.exec(`
      grant usage on schema auth to authenticated;
      insert into auth.users(id) values
        ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
      insert into public.users(id,nickname) values
        ('00000000-0000-0000-0000-000000000001','SourceOwner'),
        ('00000000-0000-0000-0000-000000000002','SourceOther');
      insert into public.profiles(profile_type,name,owner_user_id)
        select 'PERSONAL',nickname,id from public.users;
      insert into public.profile_members(profile_id,user_id)
        select id,owner_user_id from public.profiles;`);
    await assert.rejects(db.exec(`insert into public.profiles(profile_type,name,owner_user_id)
      select 'PERSONAL','Duplicate',id from public.users limit 1`), { code: '23505' });
    await assert.rejects(db.exec(`insert into public.profile_members(profile_id,user_id)
      select id,'00000000-0000-0000-0000-000000000099' from public.profiles limit 1`), { code: '23503' });
    await assert.rejects(db.exec(`insert into public.items(item_type,title) values('BOOK',' ')`), { code: '23514' });
    await db.exec(`set role authenticated;
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
    assert.deepEqual((await db.query('select name from public.profiles')).rows, [{ name: 'SourceOwner' }]);
    await assert.rejects(db.query('select * from private.profile_bootstrap_evidence'), { code: '42501' });
    await assert.rejects(db.exec(`update public.users set nickname='Changed'`), { code: '42501' });
    await db.exec('reset role; alter policy profiles_select_for_member on public.profiles using(true);');
    const report = compareRelationSchemas(baseline, await snapshot(db), { fingerprint: 'structureSha256' });
    assert.deepEqual(report.changed, ['public.profiles']);
    await db.exec('set role authenticated;');
    assert.equal((await db.query('select * from public.profiles')).rows.length, 2,
      'The altered policy really exposes the other Profile; the fingerprint must detect it');
  } finally { await db.close(); }
});

test('source per-schema default revokes do not close future PUBLIC function execution', async () => {
  const { db } = await createSourceRelationDatabase();
  try {
    // Reproduces an unresolved source-default gap. Existing functions have their
    // own explicit revokes; this test does not claim a hosted exposure or fix.
    for (const schema of ['public', 'private']) {
      await db.exec(`create function ${schema}.source_default_probe() returns integer language sql as $$select 1$$;`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const result = await db.query('select has_function_privilege($1,$2,\'execute\') as allowed',
          [role, `${schema}.source_default_probe()`]);
        assert.equal(result.rows[0].allowed, true);
      }
    }
    // PostgreSQL's documented global-default control is demonstrated ONLY in
    // this disposable reference. Platform impact needs review before adoption.
    await db.exec(`alter default privileges for role postgres revoke execute on functions from public;
      create function public.closed_default_probe() returns integer language sql as $$select 1$$;
      grant execute on function public.closed_default_probe() to authenticated;`);
    const result = await db.query(`select has_function_privilege('anon','public.closed_default_probe()','execute') as anon,
      has_function_privilege('authenticated','public.closed_default_probe()','execute') as authenticated,
      has_function_privilege('service_role','public.closed_default_probe()','execute') as service_role`);
    assert.deepEqual(result.rows[0], { anon: false, authenticated: true, service_role: false });
  } finally { await db.close(); }
});
