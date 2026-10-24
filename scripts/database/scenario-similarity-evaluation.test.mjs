import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';
const scorer = 'private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb)';
const similarity = 'private.scenario_similarity_v1(jsonb,jsonb,jsonb,jsonb,text,text,text,text,text[],text[])';
// Each scratch run creates a distinct Working capture even at the same cutoff.
// Only that generated reference is normalized; every score byte and other field
// must match, including the captured feature and evidence-prefix contents.
const normalizeCaptureId = value => Array.isArray(value) ? value.map(normalizeCaptureId)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
    .map(([key, field]) => [key, key === 'captureId' ? 'fresh-capture-id' : normalizeCaptureId(field)])) : value;

test('scenario retrieval evaluates each pair once while preserving full ranking and frozen evidence', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const definition = async signature => one('select pg_get_functiondef($1::regprocedure) definition,prosrc from pg_proc where oid=$1::regprocedure', [signature]);
  const functions = async () => query(`select p.oid,p.oid::regprocedure::text signature,p.prosrc,to_jsonb(p)-'prosrc' metadata
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in('public','private','auth') and p.prokind='f' order by p.oid`);
  const rows = async () => {
    const tables = await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') order by 1`);
    return Promise.all(tables.map(async ({ name }) => [name, (await one(`select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]') value from ${name} r`)).value]));
  };
  const rejects = async (sql, pattern) => {
    await db.exec('savepoint rejected_forward');
    try { await assert.rejects(db.exec(sql), pattern); }
    finally { await db.exec('rollback to rejected_forward; release rejected_forward'); }
  };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_scenario_similarity_evaluation.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const forward = files[index].sql;

    for (const tied of [false, true]) await t.test(tied ? 'more than 30 equal-time/equal-similarity outcomes retain exact tie behavior' : 'full history, reversals and priority retain exact results', async () => {
      await db.exec('begin');
      try {
        await db.exec(await personalTasteSessionFixtureSql());
        await query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
        const profile = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [owner])).id;
        const request = { version: 3, requestId: randomUUID(), profileId: profile, sessionId: randomUUID(),
          discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 50, context: {}, cursor: null, replacesChainId: null };
        const oldPage = (await one('select public.rank_items_feed_v1($1) value', [request])).value;
        assert.equal(oldPage.items.length, 20);
        // Synthetic retained delivery/outcome history, never hosted state. Some
        // episodes have a weaker later outcome or an exact reversal; none may
        // silently disappear merely to make the retrieval faster.
        await db.query(`create temp table similarity_history on commit drop as
          select gen_random_uuid() prediction_id,gen_random_uuid() event_id,n,
            (array(select item_id from private.prediction_candidates where prediction_id=$1 order by final_rank))[1+((n-1)%20)] item_id
          from generate_series(1,100) n`, [oldPage.predictionId]);
        await db.query(`insert into private.prediction_runs
          select (jsonb_populate_record(null::private.prediction_runs,to_jsonb(r)||jsonb_build_object(
            'id',h.prediction_id,'requested_at',now()-interval '3 hours','created_at',now()-interval '3 hours'))).*
          from private.prediction_runs r cross join similarity_history h where r.id=$1`, [oldPage.predictionId]);
        await db.query(`insert into private.prediction_candidates
          select (jsonb_populate_record(null::private.prediction_candidates,to_jsonb(c)||jsonb_build_object(
            'prediction_id',h.prediction_id,'created_at',now()-interval '3 hours'))).*
          from private.prediction_candidates c join similarity_history h on h.item_id=c.item_id where c.prediction_id=$1`, [oldPage.predictionId]);
        await query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,created_at,prediction_id,properties)
          select h.event_id,$1,$2,h.item_id,'MOVIE','ITEM_RATED',
            now()-interval '2 hours'-case when $3 then interval '0' else h.n*interval '1 second' end,
            now()-interval '1 hour',h.prediction_id,jsonb_build_object('rating',h.n%11) from similarity_history h`, [owner, profile, tied]);
        if (!tied) {
          await query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,created_at,prediction_id,properties)
            select gen_random_uuid(),$1,$2,h.item_id,'MOVIE','ITEM_LIKED',now()-interval '90 minutes',now()-interval '1 hour',h.prediction_id,'{}'
            from similarity_history h where n%5=0`, [owner, profile]);
          await query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,created_at,properties)
            select gen_random_uuid(),$1,$2,h.item_id,'MOVIE','ITEM_INTERACTION_UNDONE',now()-interval '30 minutes',now()-interval '30 minutes',
              jsonb_build_object('reversedEventId',h.event_id) from similarity_history h where n%7=0`, [owner, profile]);
        }
        // Scratch-only counter keeps the immutable volatility contract. It is
        // never in the migration or used against a hosted database.
        await db.exec('create sequence private.scenario_similarity_calls');
        const helper = await definition(similarity);
        assert.equal(helper.prosrc.split('begin\n').length - 1, 1);
        await db.exec(helper.definition.replace(helper.prosrc, () => helper.prosrc.replace('begin\n',
          "begin\n  perform nextval('private.scenario_similarity_calls');\n")));
        const predictionId = randomUUID();
        const run = async () => {
          await db.exec('savepoint fixed_cutoff');
          try {
            // Production serving deliberately captures clock_timestamp(). A
            // fixed cutoff is essential for byte parity of decay and traces.
            // This fixture-only substitution is rolled back before the forward.
            for (const signature of [scorer,
              'private.rank_items_candidate_base_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb)',
              'private.rank_items_candidate_scalar_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb,uuid)']) {
              const current = await definition(signature);
              assert.equal(current.prosrc.split('clock_timestamp()').length - 1, 1);
              await db.exec(current.definition.replace(current.prosrc, () =>
                current.prosrc.replace('clock_timestamp()', 'transaction_timestamp()')));
            }
            await db.exec('alter sequence private.scenario_similarity_calls restart with 1');
            const result = await query(`select r.*,encode(float8send(r.score),'hex') score_bits,
              encode(float8send(r.confidence),'hex') confidence_bits
              from private.rank_items_candidate_with_identity_v1(null,null,false,'{}',false,$1,$2,'FOR_YOU','MOVIE',50,'{}') r order by r.rank`, [predictionId, profile]);
            const candidates = await query(`select to_jsonb(c) value,encode(float8send(final_score),'hex') final_score_bits,
              encode(float8send(scenario_score),'hex') scenario_score_bits,encode(float8send(scenario_max_similarity),'hex') max_bits
              from private.prediction_candidates c where prediction_id=$1 order by final_rank`, [predictionId]);
            const calls = Number((await one('select last_value from private.scenario_similarity_calls')).last_value);
            return { result, candidates, calls };
          } finally { await db.exec('rollback to fixed_cutoff; release fixed_cutoff'); }
        };
        const before = await run();
        assert.ok(before.result.length > 0);
        assert.ok(before.candidates.some(row => row.value.scenario_support === 30), 'fixture must challenge the top-30 boundary');
        const previousFunctions = await functions();
        const previousRows = await rows();
        await db.exec(forward);
        assert.deepEqual(await rows(), previousRows, 'forward changed existing user/frozen evidence rows');
        const nextFunctions = await functions();
        assert.equal(nextFunctions.length, previousFunctions.length);
        for (let n = 0; n < previousFunctions.length; n++) {
          const old = previousFunctions[n], current = nextFunctions[n];
          assert.equal(current.oid, old.oid);
          assert.deepEqual(current.metadata, old.metadata, `function identity/ACL/config changed: ${old.signature}`);
          const expected = old.signature.startsWith('private.rank_items_candidate_with_identity_v1(')
            ? old.prosrc.replace('  historical_outcomes as (', '  historical_outcomes as materialized (')
              .replace('          ) as value\n        ) as similarity', '          ) as value\n          offset 0\n        ) as similarity')
            : old.prosrc;
          assert.equal(current.prosrc, expected, `unapproved function source change: ${old.signature}`);
        }
        const after = await run();
        assert.deepEqual(normalizeCaptureId(after.result), normalizeCaptureId(before.result), 'returned ranks, explanations or exact float8 bytes changed');
        assert.deepEqual(normalizeCaptureId(after.candidates), normalizeCaptureId(before.candidates), 'stored candidate scores/metadata or exact float8 bytes changed');
        assert.ok(after.calls < before.calls, `similarity calls did not fall: ${before.calls} -> ${after.calls}`);
        const historyCount = tied ? 100 : 88; // Two reversed ratings retain their lower-priority surviving outcome.
        assert.equal(after.calls, after.candidates.length * historyCount, 'must evaluate each eligible candidate/outcome pair exactly once');
        assert.deepEqual((await one('select public.rank_items_feed_v1($1) value', [request])).value, oldPage,
          'an old exact page retry changed after the forward');
        console.log(JSON.stringify({ fixture: tied ? 'tied' : 'distinct', pairs: after.calls,
          similarityCallsBefore: before.calls, similarityCallsAfter: after.calls, exactFloat8Parity: true }));
      } finally { await db.exec('rollback'); }
    });

    await t.test('unknown source, ACL and configuration drift fail closed', async () => {
      await db.exec('begin');
      try {
        const original = await definition(scorer);
        await rejects(original.definition.replace(original.prosrc, () => original.prosrc + '\n-- unknown source\n') + '\n;\n' + forward,
          /source\/security\/configuration drift/);
        await rejects(`grant execute on function ${scorer} to authenticated;${forward}`, /source\/security\/configuration drift/);
        await rejects(`alter function ${scorer} set extra_float_digits=3;${forward}`, /source\/security\/configuration drift/);
      } finally { await db.exec('rollback'); }
    });
  } finally { await db.close(); }
});
