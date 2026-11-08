import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyWikidataStatementIds, verifyWikidataStatementIdUpgrade } from './wikidata-statement-id-verification.mjs';

for (const upgrade of [false, true]) test(`statement-ID successor ${upgrade ? 'populated preservation and rollback' : 'independent old/new extraction'}`, { timeout: 240_000 }, async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation(), index = files.findIndex(f => f.name.endsWith('_wikidata_statement_id_compatibility.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, upgrade ? index : index + 1)) await db.exec(`begin;${file.sql}commit;`);
    const exec = async (sql, requireJson = false) => {
      try {
        return (await db.exec(sql)).flatMap(result => result.rows.map(row => {
          if (requireJson === true) {
            assert.equal(result.fields.length, 1);
            assert.ok([114, 3802].includes(result.fields[0].dataTypeID), 'Native psql proof requires JSON, not t/f');
          }
          return JSON.parse(JSON.stringify(Object.values(row)[0]));
        }));
      } catch (error) { await db.exec('rollback;');throw error; }
    };
    if (!upgrade) {
      const report = await verifyWikidataStatementIds(exec);assert.equal(report.status, 'PASS');t.diagnostic(JSON.stringify(report));
    } else {
      const withSession = callback => callback(sql => exec(sql, true));
      for (const digits of [-3, 0, 3]) {
        await db.exec(`set extra_float_digits=${digits};`);
        const report = await verifyWikidataStatementIdUpgrade(exec, withSession, files[index]);
        assert.equal(report.status, 'PASS');t.diagnostic(JSON.stringify({ digits, ...report }));
        assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits, String(digits));
      }
      for (const mutation of [
        'grant execute on function private.prepare_personal_rating_forecast_v5(uuid,uuid,uuid,integer,text,jsonb) to authenticated;',
        "alter function private.finalize_personal_rating_forecast_v4(uuid,jsonb) set statement_timeout='10s';",
        'alter table private.personal_rating_catalog_item_refs disable row level security;',
        "update public.items set title=title||' unwanted rewrite';",
      ]) await assert.rejects(verifyWikidataStatementIdUpgrade(exec, withSession,
        { ...files[index], sql: files[index].sql + '\n' + mutation }), /changed|closed/);
    }
  } finally { await db.close(); }
});
