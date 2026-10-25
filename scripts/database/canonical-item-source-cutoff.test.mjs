import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';
const id = n => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const helper = 'private.canonical_item_source_available_v1(uuid,timestamp with time zone)';
const patched = new Set(['taste_candidate_catalog_v4', 'rank_items_candidate_base_v1']);

test('canonical source cutoff parity / complete current schema and populated forward', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const command = (s, operation, extra = {}) => ({ operation, profileId: s.profileId,
    sessionId: s.sessionId, requestId: randomUUID(), expectedRevision: s.revision, ...extra });
  const rpc = async request => {
    await db.exec('begin;');
    try {
      await query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
      await db.exec('set local role authenticated;');
      const result = (await one('select public.taste_session_v2($1) value', [request])).value;
      await db.exec('commit;'); return result;
    } catch (error) { await db.exec('rollback;'); throw error; }
  };
  const rowsSnapshot = async () => {
    const tables = await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
      and n.nspname in('public','private','auth') order by 1`);
    return Promise.all(tables.map(async ({ name }) => [name,
      await query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)]));
  };
  const normalize = value => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['prediction_id', 'eligibilityAt'].includes(key))
      .map(([key, child]) => [key, normalize(child)]));
    return value;
  };
  const rejects = async (fn, pattern) => {
    await db.exec('savepoint rejected;');
    let caught;
    try { await fn(); } catch (error) { caught = error; }
    await db.exec('rollback to rejected;release rejected;');
    assert.ok(caught, 'Expected rejection'); assert.match(caught.message, pattern);
  };
  const sub = async (name, fn) => t.test(name, async () => {
    await db.exec('begin;');
    try { await fn(); } finally { await db.exec('rollback;'); }
  });
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_canonical_item_source_cutoff_parity.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_versioned_taste_candidate_pools.sql')));
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    await db.exec(await personalTasteSessionFixtureSql());
    await query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    const profile = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [owner])).id;
    const started = await rpc({ operation: 'START', profileId: profile, requestId: randomUUID() });
    const nextRequest = command(started, 'NEXT');
    const question = await rpc(nextRequest);
    const answerRequest = command(question, 'ANSWER', { questionId: question.questionId,
      answer: { kind: 'RATING', value: 4 } });
    const answered = await rpc(answerRequest);
    const functions = await query(`select oid,proname,to_jsonb(p) value from pg_proc p
      where pronamespace in('public'::regnamespace,'private'::regnamespace) order by oid`);

    await sub('unknown source or security drift rolls back the complete forward', async () => {
      for (const name of patched) {
        const original = await one(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,prosrc
          from pg_proc where pronamespace='private'::regnamespace and proname=$1`, [name]);
        for (const mutation of [original.definition.replace(original.prosrc, () => `${original.prosrc}\n-- unreviewed drift`),
          `grant execute on function ${original.signature} to authenticated;`,
          `alter function ${original.signature} set search_path='public';`,
          `alter function ${original.signature} security definer;`]) {
          await db.exec('savepoint source_variant;');
          await db.exec(mutation);
          await rejects(() => db.exec(files[index].sql), /source\/security drift/);
          assert.equal((await one('select to_regprocedure($1) value', [helper])).value, null);
          await db.exec('rollback to source_variant;release source_variant;');
        }
      }
    });

    await t.test('normal/catalog scoring, V4 acquisition and every retained row survive exactly', async () => {
      await db.exec('begin;');
      const read = async (name, mode) => normalize(await query(`select * from private.${name}(
        ${name.includes('catalog') ? "'{}',false," : ''}$1,$2,null,50,'{}')`, [profile, mode]));
      const expected = [];
      for (const name of ['rank_items_v0', 'rank_items_scalar_v1', 'rank_items_catalog_base_v1', 'rank_items_catalog_scalar_v1']) {
        for (const mode of ['FOR_YOU', 'SURPRISE', 'RISK']) expected.push({ name, mode, rows: await read(name, mode) });
      }
      const catalog = (await one('select private.taste_candidate_catalog_v4($1,now()) value', [started.sessionId])).value;
      const rows = await rowsSnapshot();
      await db.exec(files[index].sql);
      assert.deepEqual(await rowsSnapshot(), rows);
      for (const previous of functions) {
        const actual = (await one('select to_jsonb(p) value from pg_proc p where oid=$1', [previous.oid])).value;
        const expectedMetadata = structuredClone(previous.value);
        if (patched.has(previous.proname)) { delete actual.prosrc; delete expectedMetadata.prosrc; }
        assert.deepEqual(actual, expectedMetadata, previous.proname);
      }
      for (const result of expected) assert.deepEqual(await read(result.name, result.mode), result.rows, `${result.name}/${result.mode}`);
      assert.deepEqual((await one('select private.taste_candidate_catalog_v4($1,now()) value', [started.sessionId])).value, catalog);
      await db.exec('commit;');
      assert.deepEqual(await rpc(nextRequest), question, 'Exact frozen NEXT acknowledgement');
      assert.deepEqual(await rpc(answerRequest), answered, 'Exact accepted ANSWER acknowledgement');
      const retained = await one('select policy from private.sequential_taste_sessions where id=$1', [started.sessionId]);
      assert.equal(retained.policy, 'CANONICAL_FORECAST_POOL_V4');
    });
    for (const file of files.slice(index + 1)) await db.exec(`begin;${file.sql}commit;`);

    await sub('finite exact-cutoff availability is shared by V4 acquisition and explicit scoring', async () => {
      // These are synthetic provider-shaped records in the disposable test DB.
      await query(`insert into public.items(id,item_type,title,tags,metadata,created_at)
        select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'BOOK','Cutoff fixture '||n,
          array['cutoff-feature','shared-feature'],'{"coldStartRecognition":1}',
          case n when 2002 then now()+interval '1 day' when 2004 then 'infinity'::timestamptz
            when 2011 then '-infinity'::timestamptz else now() end from generate_series(2001,2011) n`);
      await query(`insert into private.item_sources(item_id,provider_key,provider_item_id,created_at)
        select id,case when title='Cutoff fixture 2006' then 'kajo_mock' else 'kajo_curated' end,id::text,
          case title when 'Cutoff fixture 2003' then now()+interval '1 day'
            when 'Cutoff fixture 2005' then 'infinity'::timestamptz
            when 'Cutoff fixture 2010' then '-infinity'::timestamptz else now() end
        from public.items where title like 'Cutoff fixture %' and title<>'Cutoff fixture 2007'`);
      await query('update public.items set discoverable=false where id=$1', [id(2008)]);
      // A future additional source must not invalidate a genuinely available one.
      await query(`insert into private.item_sources(item_id,provider_key,provider_item_id,created_at)
        values($1,'kajo_curated','additional-future-source',now()+interval '1 day')`, [id(2009)]);
      const itemIds = Array.from({ length: 11 }, (_, n) => id(2001 + n));
      const availability = await query(`select item_id,private.canonical_item_source_available_v1(item_id,now()) available
        from unnest($1::uuid[]) item_id`, [itemIds]);
      assert.deepEqual(availability.filter(row => row.available).map(row => row.item_id), [id(2001), id(2008), id(2009)],
        'Source availability deliberately leaves discoverability to the caller');
      const catalog = (await one('select private.taste_candidate_catalog_v4($1,now()) value', [started.sessionId])).value;
      const acquired = catalog.filter(item => itemIds.includes(item.id)).map(item => item.id).sort();
      assert.deepEqual(acquired, [id(2001), id(2009)]);
      const captured = (await one(`select private.capture_personal_evaluation_v1($1,$2,$3,
        '2000-01-01'::timestamptz,'{}') value`, [randomUUID(), profile, itemIds])).value;
      assert.deepEqual(captured.items.filter(item => item.status === 'AVAILABLE').map(item => item.itemId).sort(), acquired);
      for (const item of captured.items.filter(item => item.status === 'UNAVAILABLE')) {
        assert.equal(item.score, null); assert.equal(item.rank, null); assert.equal(item.reason, 'MISSING_OR_INELIGIBLE_ITEM');
      }
      const ordinary = await query("select * from private.rank_items_v0($1,'FOR_YOU','BOOK',50,'{}')", [profile]);
      for (const n of [2002, 2003, 2004, 2005, 2006, 2007, 2010, 2011]) {
        assert.ok(ordinary.some(item => item.item_id === id(n)), `Legacy null-ID Discovery eligibility unchanged for ${n}`);
      }
      for (const item of captured.items.filter(item => item.status === 'AVAILABLE')) {
        const scalar = await query("select * from private.rank_items_scalar_v1($1,'FOR_YOU','BOOK',50,'{}')", [profile]);
        assert.equal(item.score, scalar.find(row => row.item_id === item.itemId).score);
      }
      await query('delete from private.item_sources where item_id=$1', [id(2001)]);
      const afterWithdrawal = (await one(`select private.capture_personal_evaluation_v1($1,$2,$3,
        '2000-01-01'::timestamptz,'{}') value`, [randomUUID(), profile, [id(2001)]])).value;
      assert.equal(afterWithdrawal.items[0].status, 'UNAVAILABLE');
      assert.equal(afterWithdrawal.items[0].score, null);
      const refreshedCatalog = (await one('select private.taste_candidate_catalog_v4($1,now()) value', [started.sessionId])).value;
      assert.ok(!refreshedCatalog.some(item => item.id === id(2001)), 'Source withdrawal affects both fresh consumers');
    });

    await sub('missing and nonfinite cutoffs fail closed; private ACLs remain closed', async () => {
      for (const cutoff of [null, 'infinity', '-infinity']) {
        assert.equal((await one('select private.canonical_item_source_available_v1($1,$2) value', [id(121), cutoff])).value, false);
        assert.deepEqual((await one('select private.taste_candidate_catalog_v4($1,$2) value', [started.sessionId, cutoff])).value, []);
      }
      assert.equal((await one('select private.canonical_item_source_available_v1($1,now()) value', [randomUUID()])).value, false);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, helper])).allowed, false);
        await rejects(async () => {
          await db.exec(`set local role ${role};`);
          await query('select private.canonical_item_source_available_v1($1,now())', [id(121)]);
        }, /permission denied/);
      }
      const metadata = await one(`select prosecdef,provolatile,proconfig from pg_proc where oid=$1::regprocedure`, [helper]);
      assert.equal(metadata.prosecdef, false); assert.equal(metadata.provolatile, 's');
      assert.deepEqual(metadata.proconfig, ['search_path=""']);
      assert.equal((await one("select to_regprocedure('public.canonical_item_source_available_v1(uuid,timestamptz)') value")).value, null);
    });
  } finally { await db.close(); }
});
