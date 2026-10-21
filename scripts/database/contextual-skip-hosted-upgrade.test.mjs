import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { contextualSkipHostedManifest, contextualSkipHostedUpgradeSql,
  contextualSkipImportBodies, loadContextualSkipHostedChain } from './contextual-skip-hosted-upgrade.mjs';

test('exact import-removal prerequisite, compact hosted chain and chronological fresh path', async t => {
  const db = new PGlite();
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const signature = 'private.remove_profile_import_job_v1(uuid)';
  const snapshot = () => one('select to_jsonb(p) metadata,pg_get_functiondef(oid) definition from pg_proc p where oid=$1::regprocedure', [signature]);
  const functions = async () => (await db.query(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,
    pg_get_userbyid(proowner) owner,proacl::text acl from pg_proc
    where pronamespace in('public'::regnamespace,'private'::regnamespace) and prokind='f' order by 1`)).rows;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const files = (await buildFreshInstallation()).files;
    const index = files.findIndex(f => f.name === contextualSkipHostedManifest.sourceCheckpoint);
    assert.ok(index > 0);
    for (const f of files.slice(0, index + 1)) await db.exec(`begin;${f.sql}commit;`);
    const [bridge, native, taste] = await loadContextualSkipHostedChain();
    const bodies = await contextualSkipImportBodies();
    const canonical = await snapshot();
    assert.equal(canonical.metadata.prosrc, bodies.canonical);
    const compactDefinition = canonical.definition.replace(bodies.canonical, () => bodies.compact) + ';\n';

    await t.test('known compact form repairs exactly; canonical form is a no-op', async () => {
      await db.exec(bridge.sql); assert.deepEqual(await snapshot(), canonical);
      await db.exec(compactDefinition);
      await db.exec(bridge.sql); assert.deepEqual(await snapshot(), canonical);
    });
    await t.test('unknown source and security metadata fail closed without changing the function', async () => {
      for (const mutation of [
        canonical.definition.replace(bodies.canonical, () => bodies.canonical + '\n-- unknown drift'),
        'grant execute on function private.remove_profile_import_job_v1(uuid) to anon;',
        'revoke execute on function private.remove_profile_import_job_v1(uuid) from authenticated;',
        "alter function private.remove_profile_import_job_v1(uuid) set search_path='public';",
        'alter function private.remove_profile_import_job_v1(uuid) security invoker;',
        'alter function private.remove_profile_import_job_v1(uuid) stable;',
        'alter function private.remove_profile_import_job_v1(uuid) owner to authenticated;',
      ]) {
        await db.exec('begin;' + mutation);
        await assert.rejects(db.exec(bridge.sql), /compatibility refused/);
        await db.exec('rollback;'); assert.deepEqual(await snapshot(), canonical);
      }
    });
    await t.test('compact and repaired removal retain actual owner/outsider/import semantics', async () => {
      const smoke = await readFile(new URL('baseline-function-smoke.sql', import.meta.url), 'utf8');
      for (const sql of [compactDefinition, compactDefinition + bridge.sql]) {
        await db.exec(`begin;${sql}${smoke}rollback;`);
        assert.deepEqual(await snapshot(), canonical);
      }
    });
    await t.test('populated v1/challenge/v2 chain preserves rows/receipts and detects corruption', async () => {
      const rehearsal = await contextualSkipHostedUpgradeSql();
      const results = (await db.exec(rehearsal)).flatMap(r => r.rows.map(row => row.snapshot));
      assert.match(results[0]?.contextualSkipHostedUpgrade, /^PASS: exact compact prerequisite/);
      assert.equal((await one('select count(*)::int n from auth.users')).n, 0);
      assert.equal((await one("select to_regclass('private.contextual_skip_commands') ledger")).ledger, null);
      for (const mutation of [
        ["update public.items set title=title||' changed';", /changed old rows/],
        ['grant execute on function private.remove_profile_import_job_v1(uuid) to anon;', /changed old function identity/],
        ['grant select on private.contextual_skip_commands to authenticated;', /exposed private storage/],
      ]) {
        await assert.rejects(db.exec(rehearsal.replace('do $preserve$', mutation[0] + '\ndo $preserve$')), mutation[1]);
        await db.exec('rollback;');
      }
      await db.exec("insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'existing@example.invalid','{\"kajo_nickname\":\"Existing\"}');");
      await assert.rejects(db.exec(rehearsal), /empty disposable state/); await db.exec('rollback;');
      await db.exec('delete from auth.users;');
    });
    await t.test('chronological and compact prerequisite orders produce identical final functions', async () => {
      await db.exec(`begin;${native.sql}${taste.sql}`);
      const final = await snapshot();
      await db.exec(bridge.sql); assert.deepEqual(await snapshot(), final);
      const expected = await functions(); await db.exec('rollback;');
      await db.exec(`begin;${compactDefinition}${bridge.sql}${native.sql}${taste.sql}`);
      assert.deepEqual(await functions(), expected);
      await db.exec('rollback;');
      // The unchanged Taste guard still refuses the compact function without its prerequisite.
      await db.exec(`begin;${compactDefinition}${native.sql}`);
      await assert.rejects(db.exec(taste.sql), /Neutral Taste source\/security drift/);
      await db.exec('rollback;');
      assert.equal((await one("select to_regclass('private.contextual_skip_commands') ledger")).ledger, null);
    });
  } catch (error) { delete error.query; throw error; } finally { await db.close(); }
});
