import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const read = (name) => readFile(new URL(name, migrations), 'utf8');
function definition(sql, name) {
  const start = sql.search(new RegExp(`create (?:or replace )?function ${name.replaceAll('.', '\\.')}\\(`));
  assert.notEqual(start, -1, `Missing canonical function ${name}`);
  const end = sql.indexOf('$$;', start);
  assert.notEqual(end, -1, `Missing function terminator for ${name}`);
  return sql.slice(start, end + 3);
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const profiles = { a: id(1), b: id(2), shared: id(3) };
const users = { a: id(11), b: id(12), outsider: id(13) };
const items = { liked: id(21), disliked: id(22), first: id(31), second: id(32), movie: id(33) };

test('bootstrap Personal ranking SQL regressions (isolated function fixtures)', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('bootstrap-ranking.fixture.sql', import.meta.url), 'utf8'));
    await db.exec(definition(await read('20260826203000_backend_foundation.sql'), 'private.is_profile_member'));
    const imports = await read('20260904203000_profile_bootstrap_import_foundation.sql');
    await db.exec(definition(imports, 'private.bootstrap_evidence_weight_v1'));
    await db.exec(definition(await read('20260902223000_prediction_nervous_system_v1.sql'), 'private.event_evidence_weight_v1'));
    // Historical baseline is loaded only for the explicit defect reproduction.
    // This fixture does NOT skip/patch migrations or claim complete replay.
    await db.exec(definition(await read('20260831164500_prediction_impression_cooldown.sql'), 'public.rank_items_v0')
      .replace('function public.rank_items_v0(', 'function private.rank_items_v0('));
    await db.exec(`
      insert into public.profiles values ('${profiles.a}','PERSONAL'),('${profiles.b}','PERSONAL'),('${profiles.shared}','SHARED');
      insert into public.profile_members values ('${profiles.a}','${users.a}'),('${profiles.b}','${users.b}'),('${profiles.shared}','${users.a}'),('${profiles.shared}','${users.b}');
      insert into public.items (id,item_type,title,tags,discoverable) values
        ('${items.liked}','BOOK','Evidence A',array['warm'],false),
        ('${items.disliked}','BOOK','Evidence B',array['dark'],false),
        ('${items.first}','BOOK','Unseen A',array['warm'],true),
        ('${items.second}','BOOK','Unseen B',array['dark'],true),
        ('${items.movie}','MOVIE','Unseen film',array['warm'],true);
    `);
    const actor = async (user) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
    const ranking = async (profile, mode = 'FOR_YOU', kind = 'BOOK') => (await db.query(
      'select * from private.rank_items_v0($1,$2,$3,50,$4)', [profile, mode, kind, '{}'])).rows;
    const bootstrap = async (profile, provider = 'KAJO_CSV', opposite = false) => {
      for (const [item, rating] of [[items.liked, opposite ? 0 : 10], [items.disliked, opposite ? 10 : 0]]) {
        await db.query(`insert into private.profile_bootstrap_evidence(profile_id,item_id,source_provider,evidence_kind,rating)
          values($1,$2,$3,'RATED',$4)`, [profile, item, provider, rating]);
      }
    };
    const run = async (name, fn) => t.test(name, async () => {
      await db.exec('begin');
      try { await actor(users.a); await fn(); } finally { await db.exec('rollback'); }
    });
    await run('reproduces historical defect: adding bootstrap does not change unseen base scores', async () => {
      const before = await ranking(profiles.a);
      await bootstrap(profiles.a);
      assert.deepEqual((await ranking(profiles.a)).map(r => r.score), before.map(r => r.score));
    });
    await db.exec('alter function private.rank_items_v0(uuid,text,text,integer,jsonb) rename to rank_items_v0_historical');
    // Reconstruct only the historical V1 function for a definition-preservation
    // regression. These are function fixtures, not migration replay acceptance.
    await db.exec(definition(await read('20260902223000_prediction_nervous_system_v1.sql'), 'private.rank_items_v1_internal'));
    for (const name of [
      '20260904120420_fix_prediction_v1_candidate_returning.sql',
      '20260904180000_sleep_layer_v1_serving_and_profile_canary.sql',
      '20260904183000_reacted_item_resurfacing_policy_v1.sql',
      '20260905113000_shared_common_fit_v1.sql',
      '20260905114500_harden_shared_common_fit_v1_1.sql',
      '20260905115500_fix_shared_common_fit_personal_policy.sql',
    ]) {
      for (const block of (await read(name)).matchAll(/^do \$\$[\s\S]*?^\$\$;/gm)) {
        if (block[0].includes("'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure")) {
          await db.exec(block[0]);
        }
      }
    }
    const v1Definition = async () => (await db.query(
      "select pg_get_functiondef('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure) as sql")).rows[0].sql;
    const historicalV1 = await v1Definition();
    const migration = await read('20260907155201_bootstrap_personal_ranking.sql');
    await db.exec(migration);
    await db.exec(migration); // CREATE OR REPLACE/ACL forward change can be reapplied.
    await t.test('V1 preserves the complete policy/trace function and records the new base version', async () => {
      assert.deepEqual(await v1Definition(), historicalV1.replaceAll("'prediction-v0.3'", "'prediction-v0.4-bootstrap'"));
    });
    for (const provider of ['KAJO_CSV', 'KAJO_CALIBRATION']) {
      await run(`${provider}: opposite bootstrap-only tastes reverse unseen ordering`, async () => {
        await bootstrap(profiles.a, provider);
        await bootstrap(profiles.b, provider, true);
        const a = await ranking(profiles.a);
        await actor(users.b);
        const b = await ranking(profiles.b);
        assert.deepEqual(a.map(r => r.item_id), [items.first, items.second]);
        assert.deepEqual(b.map(r => r.item_id), [items.second, items.first]);
        assert.ok(a[0].explanation.bootstrapLongTerm > 0);
        assert.ok(a[1].explanation.bootstrapLongTerm < 0);
        assert.equal(a[0].explanation.shortTerm, 0);
        assert.equal(a[0].confidence, 0); // bootstrap tag count is not native confidence.
        assert.equal((await db.query('select count(*)::int as n from public.events')).rows[0].n, 0);
      });
    }
    await run('removal restores empty control; corrected replacement reverses influence', async () => {
      const empty = await ranking(profiles.a);
      await bootstrap(profiles.a);
      await db.query('update private.profile_bootstrap_evidence set active=false where profile_id=$1', [profiles.a]);
      assert.deepEqual((await ranking(profiles.a)).map(r => r.score), empty.map(r => r.score));
      await bootstrap(profiles.a, 'KAJO_CSV', true);
      assert.equal((await ranking(profiles.a))[0].item_id, items.second);
    });
    await run('neutral, inactive and future imports have no effect', async () => {
      const empty = await ranking(profiles.a);
      await bootstrap(profiles.a);
      await db.exec('update private.profile_bootstrap_evidence set rating=5');
      assert.deepEqual((await ranking(profiles.a)).map(r => r.score), empty.map(r => r.score));
      await db.exec("update private.profile_bootstrap_evidence set rating=10, imported_at=now()+interval '1 day'");
      assert.deepEqual((await ranking(profiles.a)).map(r => r.score), empty.map(r => r.score));
    });
    await run('repeated sources count once, stronger rating beats saved evidence', async () => {
      await bootstrap(profiles.a);
      const one = await ranking(profiles.a);
      await bootstrap(profiles.a, 'IMDB');
      await db.query(`insert into private.profile_bootstrap_evidence(profile_id,item_id,source_provider,evidence_kind)
        values($1,$2,'LETTERBOXD','SAVED')`, [profiles.a, items.disliked]);
      assert.deepEqual((await ranking(profiles.a)).map(r => r.score), one.map(r => r.score));
    });
    await run('memory and serving share bootstrap selection, sign and long-only semantics', async () => {
      await bootstrap(profiles.a, 'KAJO_CALIBRATION');
      const state = (await db.query('select private.build_profile_memory_state_v1($1,now()) as state', [profiles.a])).rows[0].state;
      assert.deepEqual(state.longTermPositiveTags, ['warm']);
      assert.deepEqual(state.longTermNegativeTags, ['dark']);
      assert.deepEqual(state.shortTermPositiveTags, []);
      assert.deepEqual(state.shortTermNegativeTags, []);
      assert.equal(state.bootstrapEvidenceCount, 2);
      assert.equal(state.nativeEvidenceCount, 0);
      assert.equal((await ranking(profiles.a))[0].item_id, items.first);
    });
    await run('generic tags transfer BOOK bootstrap to MOVIE; discovery modes preserve signs', async () => {
      await bootstrap(profiles.a);
      assert.ok((await ranking(profiles.a, 'FOR_YOU', 'MOVIE'))[0].explanation.bootstrapLongTerm > 0);
      for (const mode of ['FOR_YOU','SURPRISE','RISK']) {
        const rows = await ranking(profiles.a, mode);
        assert.equal(rows[0].item_id, items.first);
        assert.equal(rows[0].explanation.bootstrapServingVersion, 'bootstrap-serving-v1');
      }
    });
    await run('empty/native controls preserve historical visible scores and confidence', async () => {
      for (const native of [false, true]) {
        if (native) await db.query(`insert into public.events(profile_id,item_id,event_type,properties)
          values($1,$2,'ITEM_RATED','{"rating":8}')`, [profiles.a, items.liked]);
        for (const mode of ['FOR_YOU','SURPRISE','RISK']) {
          const historical = (await db.query('select * from private.rank_items_v0_historical($1,$2,$3,50,$4)',
            [profiles.a, mode, 'BOOK', '{}'])).rows.filter(r => [items.first,items.second].includes(r.item_id));
          const current = await ranking(profiles.a, mode);
          const scalars = rows => rows.map(r => [r.item_id,r.score,r.confidence]);
          assert.deepEqual(scalars(current), scalars(historical));
        }
      }
    });
    await run('native feedback remains active; undo removes its contribution', async () => {
      await db.query(`insert into public.events(id,profile_id,item_id,event_type,properties)
        values($1,$2,$3,'ITEM_RATED','{"rating":10}')`, [id(101), profiles.a, items.disliked]);
      const native = await ranking(profiles.a);
      assert.equal(native[0].item_id, items.second);
      assert.ok(native[0].explanation.shortTerm > 0);
      assert.equal(native[0].explanation.bootstrapLongTerm, 0);
      await db.query(`insert into public.events(profile_id,event_type,properties)
        values($1,'ITEM_INTERACTION_UNDONE',$2)`, [profiles.a, JSON.stringify({reversedEventId:id(101)})]);
      assert.equal((await ranking(profiles.a))[0].explanation.shortTerm, 0);
    });
    await run('Shared base stays isolated from member Personal bootstrap', async () => {
      const before = await ranking(profiles.shared);
      await bootstrap(profiles.a);
      assert.deepEqual((await ranking(profiles.shared)).map(r => r.score), before.map(r => r.score));
      // Defense against malformed data: Shared bootstrap is never used directly.
      await bootstrap(profiles.shared);
      assert.deepEqual((await ranking(profiles.shared)).map(r => r.score), before.map(r => r.score));
    });
    await run('membership, former-member and anonymous checks reject unauthorized profiles', async () => {
      await actor(users.outsider);
      await db.exec('savepoint expected_denial');
      await assert.rejects(ranking(profiles.a), /Profile access denied/);
      await db.exec('rollback to savepoint expected_denial');
      await actor(users.a);
      await db.query('delete from public.profile_members where profile_id=$1 and user_id=$2', [profiles.shared,users.a]);
      await db.exec('savepoint former_member');
      await assert.rejects(ranking(profiles.shared), /Profile access denied/);
      await db.exec('rollback to savepoint former_member');
      await actor(null);
      await assert.rejects(ranking(profiles.a), /Authentication required/);
    });
    await run('private functions are not directly executable by API roles', async () => {
      for (const role of ['anon','authenticated','service_role']) {
        for (const signature of ['private.rank_items_v0(uuid,text,text,integer,jsonb)',
          'private.bootstrap_weighted_evidence_v1(uuid,timestamptz)',
          'private.bootstrap_decay_v1(timestamptz,timestamptz)',
          'private.build_profile_memory_state_v1(uuid,timestamptz)']) {
          assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed",[role,signature])).rows[0].allowed,false);
        }
      }
    });
    // Optional read-only diagnostic output from the existing canonical SQL fixtures.
    // This is explicitly a five-function scope, never a full replay/schema claim.
    if (process.env.KAJO_BOOTSTRAP_SCHEMA_SNAPSHOT) {
      const results = await db.exec(await readFile(new URL('function-schema-snapshot.sql', import.meta.url), 'utf8'));
      const snapshot = results.find(result => result.rows[0]?.snapshot).rows[0].snapshot;
      snapshot.functions = snapshot.functions.filter(row => /^private\.(bootstrap_decay_v1|bootstrap_weighted_evidence_v1|build_profile_memory_state_v1|rank_items_v0|rank_items_v1_internal)\(/.test(row.identity));
      assert.equal(snapshot.functions.length, 5);
      await writeFile(process.env.KAJO_BOOTSTRAP_SCHEMA_SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
    }
  } finally { await db.close(); }
});
