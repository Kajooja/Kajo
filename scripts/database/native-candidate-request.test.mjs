import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { nativeCandidateRequestFixtureSql, nativeCandidateRequestSmokeSql } from './native-candidate-request.mjs';

const actor = 'ab157000-0000-4000-8000-000000000001';
const other = 'ab157000-0000-4000-8000-000000000002';
const shared = 'ab157000-0000-4000-8000-000000000900';
const id = n => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const oldNames = ['rank_items_candidate_base_v1', 'rank_items_candidate_scalar_v1', 'rank_items_candidate_with_identity_v1'];
const changedNames = [...oldNames, 'rank_items_v1_internal', 'rank_items_first_page_v1',
  'rank_items_catalog_chain_v1', 'capture_personal_evaluation_v1'];
const newNames = ['rank_items_request_base_v1', 'rank_items_request_scalar_v1', 'rank_items_request_with_identity_v1',
  'validate_native_candidate_request_v1'];
const request = (acquisition = 'LEGACY_DISCOVERY', extra = {}) => ({ version: 'native-candidate-request-v1',
  acquisition, intent: acquisition === 'EXPLICIT_CANONICAL' ? 'EVALUATION' : 'DELIVERY',
  itemIds: acquisition === 'EXPLICIT_CANONICAL' ? [id(101), id(121)] : null,
  seenItemIds: [], reminderSpent: false, requiredAfter: acquisition === 'EXPLICIT_CANONICAL' ? '2000-01-01T00:00:00Z' : null,
  ...extra });
// A fresh Working capture legitimately has a new UUID and scoped references.
// Normalize only refs derived from that actual UUID. Clocks are fixed in the
// scratch calls below; no numeric score, source identity or feature is omitted.
const comparable = value => {
  const captureIds = new Set();
  const collect = item => {
    if (!item || typeof item !== 'object') return;
    if (typeof item.captureId === 'string') captureIds.add(item.captureId);
    for (const child of Object.values(item)) collect(child);
  };
  collect(value);
  const visit = item => {
    if (typeof item === 'string') {
      for (const captureId of captureIds) {
        const scope = `native-working:${captureId}`;
        if (item === scope || item.startsWith(scope + ':')) return item.replace(scope, 'native-working:fresh-capture');
      }
      return item;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item)
      .filter(([key]) => key !== 'candidateRequest').sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, key === 'captureId' ? 'fresh-working-capture' : visit(child)]));
    return item;
  };
  return visit(value);
};
const contentDigest = value => createHash('sha256').update(JSON.stringify(comparable(value))).digest('hex');

test('versioned native candidate request / populated forward and current consumers', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const functions = () => query(`select oid,proname,oid::regprocedure::text signature,
    pg_get_functiondef(oid) definition,prosrc,to_jsonb(p)-'prosrc' metadata from pg_proc p
    where pronamespace in('public'::regnamespace,'private'::regnamespace) and prokind='f' order by oid`);
  const rows = async () => {
    const tables = await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
      and n.nspname in('public','private','auth') order by 1`);
    return Promise.all(tables.map(async ({ name }) => [name,
      await query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)]));
  };
  const fixture = async () => {
    await db.exec(await nativeCandidateRequestFixtureSql());
    await query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    return (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).id;
  };
  const sub = (name, run) => t.test(name, async () => {
    await db.exec('begin;');
    try { await run(); } finally { await db.exec('rollback;'); }
  });
  const reject = async (run, code) => {
    await db.exec('savepoint rejected_request;');
    try { await assert.rejects(run, error => error.code === code); }
    finally { await db.exec('rollback to rejected_request;release rejected_request;'); }
  };
  const core = (input, profile, prediction = randomUUID(), context = {}) => query(
    "select * from private.rank_items_request_with_identity_v1($1,$2,$3,'FOR_YOU',null,20,$4)",
    [JSON.stringify(input), prediction, profile, context]);
  const oldCore = (profile, { ids = [id(101)], after = '2000-01-01', catalog = false,
    seen = [], reminder = false, prediction = randomUUID() } = {}) => query(
    "select * from private.rank_items_candidate_with_identity_v1($1,$2,$3,$4,$5,$6,$7,'FOR_YOU',null,20,'{}')",
    [after, ids, catalog, seen, reminder, prediction, profile]);
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_native_candidate_request_contract.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const forward = files[index].sql;

    await sub('predecessor actually captures invalid explicit prefixes and contradictory acquisition controls', async () => {
      const profile = await fixture();
      for (const controls of [{ after: null }, { after: '2999-01-01' },
        { ids: [id(101), id(101)] }, { catalog: true }]) {
        const prediction = randomUUID();
        await oldCore(profile, { ...controls, prediction });
        const retained = await one('select result_count,state_snapshot,policy_version from private.prediction_runs where id=$1', [prediction]);
        assert.equal(retained.result_count, 0);
        assert.ok(retained.state_snapshot.evaluationInput, 'The predecessor must really retain the malformed forecast');
        if (controls.catalog) assert.match(retained.policy_version, /catalog-chain-v1\+evaluation-candidates-v1/);
        if (controls.after === '2999-01-01') assert.equal((await one(`select
          (state_snapshot#>>'{evaluationInput,requiredAfter}')::timestamptz>=requested_at invalid
          from private.prediction_runs where id=$1`, [prediction])).invalid, true);
      }
    });

    await sub('valid old Personal/Shared mode/domain/acquisition outputs preserve score bytes, rows, metadata and exact retries', async () => {
      const personal = await fixture();
      const pageRequest = { version: 2, requestId: randomUUID(), profileId: personal, sessionId: randomUUID(),
        discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {} };
      const frozenPage = (await one('select public.rank_items_page_v1($1) value', [pageRequest])).value;
      assert.ok(frozenPage.nextCursor);
      const cases = [];
      for (const profile of [personal, shared]) for (const mode of ['FOR_YOU', 'SURPRISE', 'RISK']) {
        for (const domain of [null, 'BOOK', 'MOVIE']) for (const branch of ['LEGACY', 'CATALOG_EMPTY', 'CATALOG_SEEN']) {
          cases.push({ profile, mode, domain, branch, prediction: randomUUID() });
        }
      }
      const explicitId = randomUUID();
      const run = async () => {
        await db.exec('savepoint deterministic_request;');
        try {
          // Fix only the three server wall-clock reads, as the existing Scenario
          // parity rehearsal does. Restore original bodies before the migration
          // guard; real lifecycle clocks remain covered by native concurrency.
          const all = await functions();
          const active = all.some(f => f.proname === newNames[0]) ? newNames.slice(0, 3) : oldNames;
          for (const name of active) {
            const f = all.find(row => row.proname === name);
            assert.equal(f.prosrc.split('clock_timestamp()').length - 1, 1, name);
            await db.exec(f.definition.replace(f.prosrc, () => f.prosrc.replace('clock_timestamp()', 'transaction_timestamp()')));
          }
          const results = [];
          for (const c of cases) {
            await db.exec('savepoint parity_case;');
            try {
            const catalog = c.branch !== 'LEGACY', seen = c.branch === 'CATALOG_SEEN' ? [id(100), id(120)] : [];
            const args = catalog ? [seen, c.branch === 'CATALOG_SEEN', c.profile, c.mode, c.domain]
              : [c.profile, c.mode, c.domain];
            const lower = [];
            for (const name of catalog ? ['rank_items_catalog_base_v1', 'rank_items_catalog_scalar_v1'] : ['rank_items_v0', 'rank_items_scalar_v1']) {
              const scored = await query(`select r.*,encode(float8send(r.score),'hex') score_bits,
                encode(float8send(r.confidence),'hex') confidence_bits from private.${name}(
                ${args.map((_, n) => `$${n + 1}`).join(',')},20,'{}') r order by r.rank`, args);
              assert.equal(new Set(scored.map(row => row.prediction_id)).size, 1);
              // These score-only compatibility APIs generate an unpersisted ID;
              // the identity-layer supplied UUID remains compared exactly.
              lower.push(scored.map(row => ({ ...row, prediction_id: 'generated-score-only-id' })));
            }
            const identityArgs = catalog ? [seen, c.branch === 'CATALOG_SEEN', c.prediction, c.profile, c.mode, c.domain]
              : [c.prediction, c.profile, c.mode, c.domain];
            const output = await query(`select r.*,encode(float8send(r.score),'hex') score_bits,
              encode(float8send(r.confidence),'hex') confidence_bits from private.${catalog ? 'rank_items_catalog_with_identity_v1' : 'rank_items_with_identity_v1'}(
              ${identityArgs.map((_, n) => `$${n + 1}`).join(',')},20,'{}') r order by r.rank`, identityArgs);
            const runRow = await one('select to_jsonb(r) value from private.prediction_runs r where id=$1', [c.prediction]);
            const candidates = await query(`select to_jsonb(c) value,encode(float8send(final_score),'hex') score_bits,
              encode(float8send(scenario_score),'hex') scenario_bits from private.prediction_candidates c
              where prediction_id=$1 order by final_rank`, [c.prediction]);
            assert.ok(candidates.length > 0);
            if (c.branch === 'CATALOG_SEEN') {
              assert.ok(candidates.every(row => ![id(100), id(120), id(103)].includes(row.value.item_id)),
                'Seen IDs and spent saved reminder must remain outside catalogue admission');
            }
              results.push({ profile: c.profile, mode: c.mode, domain: c.domain, branch: c.branch,
                contentSha256: contentDigest({ lower, output, runRow, candidates }),
                scores: candidates.map(row => [row.value.item_id, row.score_bits, row.scenario_bits]) });
            } finally { await db.exec('rollback to parity_case;release parity_case;'); }
          }
          const evaluation = (await one('select private.capture_personal_evaluation_v1($1,$2,$3,$4,$5) value',
            [explicitId, personal, [id(101), id(121), id(102), id(999)], '2000-01-01', {}])).value;
          const explicitRun = await one('select to_jsonb(r) value from private.prediction_runs r where id=$1', [explicitId]);
          const explicitCandidates = await query(`select to_jsonb(c) value,encode(float8send(final_score),'hex') score_bits
            from private.prediction_candidates c where prediction_id=$1 order by item_id`, [explicitId]);
          return { results, explicitSha256: contentDigest({ evaluation, explicitRun, explicitCandidates }) };
        } finally { await db.exec('rollback to deterministic_request;release deterministic_request;'); }
      };
      const before = await run(), previousRows = await rows(), previousFunctions = await functions();
      await db.exec(forward);
      assert.deepEqual(await rows(), previousRows, 'No retained row may be rewritten');
      const installedFunctions = await functions();
      assert.deepEqual(installedFunctions.filter(f => !previousFunctions.some(old => old.oid === f.oid))
        .map(f => f.proname).sort(), [...newNames].sort());
      for (const old of previousFunctions) {
        const current = installedFunctions.find(f => f.oid === old.oid);
        assert.deepEqual(current.metadata, old.metadata, old.signature);
        if (!changedNames.includes(old.proname)) assert.equal(current.prosrc, old.prosrc, old.signature);
      }
      const after = await run();
      for (let n = 0; n < before.results.length; n++) {
        assert.deepEqual(after.results[n], before.results[n], `Actual output/float8 parity case ${n}`);
      }
      assert.equal(after.explicitSha256, before.explicitSha256, 'Explicit evaluation changed actual output or score bytes');
      assert.deepEqual((await one('select public.rank_items_page_v1($1) value', [pageRequest])).value, frozenPage);
      assert.deepEqual(await rows(), previousRows, 'Frozen retry must neither rewrite nor mint a forecast');
      assert.equal((await one("select state_snapshot?'candidateRequest' present from private.prediction_runs where id=$1",
        [frozenPage.predictionId])).present, false, 'Historical forecasts must not acquire a new declaration');
    });

    await sub('every predecessor body/security guard fails atomically without leaving request helpers', async () => {
      for (const f of (await functions()).filter(row => changedNames.includes(row.proname))) {
        for (const mutation of [f.definition.replace(f.prosrc, () => `${f.prosrc}\n-- unreviewed drift`),
          `grant execute on function ${f.signature} to service_role;`,
          `alter function ${f.signature} set search_path='public';`]) {
          await db.exec('savepoint drift;');
          await db.exec(mutation);
          const before = await functions();
          await reject(() => db.exec(forward), 'P0001');
          assert.deepEqual(await functions(), before);
          assert.equal((await query("select proname from pg_proc where pronamespace='private'::regnamespace and proname=any($1)", [newNames])).length, 0);
          await db.exec('rollback to drift;release drift;');
        }
      }
    });

    await sub('a late inherited-grant rejection rolls back all extracted bodies and a target collision fails closed', async () => {
      await db.exec(`create role native_request_unexpected_reader;
        alter default privileges for role postgres in schema private
          grant execute on functions to native_request_unexpected_reader;`);
      const before = await functions();
      await db.exec('savepoint late_rejection;');
      try {
        await assert.rejects(() => db.exec(forward), /Native candidate request new-function access drift/);
      } finally { await db.exec('rollback to late_rejection;release late_rejection;'); }
      assert.deepEqual(await functions(), before, 'Late rejection must restore all original function bodies and identities');
      assert.equal((await query("select proname from pg_proc where pronamespace='private'::regnamespace and proname=any($1)", [newNames])).length, 0);
      await db.exec(`create function private.validate_native_candidate_request_v1(integer) returns integer
        language sql as $$select $1$$;`);
      const collision = await functions();
      await db.exec('savepoint collision;');
      try { await assert.rejects(() => db.exec(forward), /Native candidate request target collision/); }
      finally { await db.exec('rollback to collision;release collision;'); }
      assert.deepEqual(await functions(), collision, 'Target collision must not overwrite the existing function or old cores');
    });

    for (const file of files.slice(index)) await db.exec(`begin;${file.sql}commit;`);

    await sub('strict shapes, unavailable combinations and invalid prefixes fail before a forecast insert', async () => {
      const profile = await fixture();
      await db.exec(`create sequence private.native_request_write_probe;
        create function private.native_request_probe() returns trigger language plpgsql as $$begin
          perform nextval('private.native_request_write_probe');return new;end;$$;
        create trigger native_request_probe before insert on private.prediction_runs
          for each row execute function private.native_request_probe();`);
      const before = await rows();
      const clock = (await one('select to_jsonb(now()) value')).value;
      const explicit = request('EXPLICIT_CANONICAL');
      const malformed = [null, [], 'request', {}, { ...request(), futureControl: true },
        { ...request(), version: 'native-candidate-request-v2' }, { ...request(), acquisition: 'UNKNOWN' },
        { ...request(), intent: 'EVALUATION' }, { ...explicit, intent: 'DELIVERY' },
        { ...request(), itemIds: [id(101)] }, { ...request(), seenItemIds: [id(101)] },
        { ...request(), reminderSpent: true }, { ...request(), reminderSpent: 'false' },
        { ...request(), requiredAfter: '2000-01-01' }, { ...request(), seenItemIds: null },
        { ...explicit, itemIds: [] }, { ...explicit, itemIds: null }, { ...explicit, itemIds: [null] },
        { ...explicit, itemIds: [id(101), id(101)] }, { ...explicit, itemIds: [id(101), id(101).toUpperCase()] },
        { ...explicit, itemIds: [[id(101)]] },
        { ...explicit, itemIds: ['not-a-uuid'] }, { ...explicit, itemIds: Array.from({ length: 51 }, () => randomUUID()) },
        { ...explicit, seenItemIds: [id(100)] }, { ...explicit, reminderSpent: true },
        { ...explicit, requiredAfter: 'not-a-timestamp' },
        request('CATALOG_CHAIN', { seenItemIds: [id(101), id(101)] }),
        request('CATALOG_CHAIN', { seenItemIds: [id(101), id(101).toUpperCase()] }),
        request('CATALOG_CHAIN', { seenItemIds: [null] }),
        request('CATALOG_CHAIN', { seenItemIds: Array.from({ length: 1001 }, () => randomUUID()) })];
      for (const key of Object.keys(request())) {
        const missing = request(); delete missing[key]; malformed.push(missing);
      }
      for (const field of ['version', 'acquisition', 'intent']) {
        for (const value of [null, false, 1, [], {}]) malformed.push({ ...request(), [field]: value });
      }
      for (const [field, values] of [['itemIds', [null, false, 1, '[]', {}]],
        ['seenItemIds', [null, false, 1, '[]', {}]], ['reminderSpent', [null, 1, 'false', [], {}]],
        ['requiredAfter', [false, 1, [], {}]]]) {
        for (const value of values) malformed.push({ ...explicit, [field]: value });
      }
      for (const input of malformed) await reject(() => core(input, profile), '22023');
      for (const requiredAfter of [null, clock, '2999-01-01T00:00:00Z', 'infinity', '-infinity']) {
        await reject(() => core({ ...explicit, requiredAfter }, profile), '40001');
      }
      for (const controls of [{ after: null }, { after: '2999-01-01' }]) await reject(() => oldCore(profile, controls), '40001');
      for (const controls of [{ ids: [id(101), id(101)] }, { catalog: true }]) await reject(() => oldCore(profile, controls), '22023');
      assert.deepEqual(await rows(), before);
      assert.equal((await one('select is_called from private.native_request_write_probe')).is_called, false,
        'A rejected request must not reach the nontransactional insert probe');
    });

    await sub('offset timestamps have stable meaning under DateStyle/TimeZone and request bounds retain order', async () => {
      await fixture();
      const expected = (await one("select extract(epoch from timestamptz '2020-01-02T01:04:05.123456Z')::text value")).value;
      for (const dateStyle of ['ISO, MDY', 'SQL, DMY']) for (const timeZone of ['UTC', 'Europe/Helsinki']) {
        await query("select set_config('DateStyle',$1,true),set_config('TimeZone',$2,true)", [dateStyle, timeZone]);
        for (const requiredAfter of ['2020-01-02T03:04:05.123456+02:00', '2020-01-02T01:04:05.123456Z']) {
          const input = request('EXPLICIT_CANONICAL', { requiredAfter });
          const instant = (await one(`select extract(epoch from
            (private.validate_native_candidate_request_v1($1,true)->>'requiredAfter')::timestamptz)::text value`, [input])).value;
          assert.equal(instant, expected, `${dateStyle}/${timeZone}/${requiredAfter}`);
        }
        for (const requiredAfter of ['yesterday', 'today', '01/02/2020', '2020-01-02',
          '2020-01-02T03:04:05', '2020-01-02T03:04:05.1234567Z']) {
          await reject(() => query('select private.validate_native_candidate_request_v1($1,true)',
            [request('EXPLICIT_CANONICAL', { requiredAfter })]), '22023');
        }
      }
      const seen = Array.from({ length: 1000 }, () => randomUUID());
      const maximum = (await one('select private.validate_native_candidate_request_v1($1,true) value',
        [request('CATALOG_CHAIN', { seenItemIds: seen, reminderSpent: true })])).value;
      assert.deepEqual(maximum.seenItemIds, seen);
      const items = Array.from({ length: 50 }, () => randomUUID());
      const explicit = (await one('select private.validate_native_candidate_request_v1($1,true) value',
        [request('EXPLICIT_CANONICAL', { itemIds: items })])).value;
      assert.deepEqual(explicit.itemIds, items);
    });

    await sub('all private layers consume the validated request and caller context cannot replace it', async () => {
      const profile = await fixture();
      for (const input of [request(), request('CATALOG_CHAIN', { seenItemIds: [id(100)], reminderSpent: true }), request('EXPLICIT_CANONICAL')]) {
        const prediction = randomUUID();
        await core(input, profile, prediction, { candidateRequest: request('EXPLICIT_CANONICAL', { itemIds: [id(999)] }),
          candidateIds: [id(999)], intent: 'EVALUATION', requiredAfter: '2999-01-01' });
        const stored = await one('select state_snapshot,result_count from private.prediction_runs where id=$1', [prediction]);
        const normalized = (await one('select private.validate_native_candidate_request_v1($1,true) value', [input])).value;
        assert.deepEqual(stored.state_snapshot.candidateRequest, normalized);
        assert.equal(stored.result_count > 0, input.intent === 'DELIVERY');
        assert.equal(stored.state_snapshot.predictionInput.candidateAcquisition, input.acquisition);
      }
      const scoreOnly = request('EXPLICIT_CANONICAL', { requiredAfter: null });
      for (const name of ['rank_items_request_base_v1', 'rank_items_request_scalar_v1']) {
        const result = await query(`select * from private.${name}($1,$2,'FOR_YOU',null,50,'{}')`, [scoreOnly, profile]);
        assert.deepEqual(result.map(row => row.item_id).sort(), scoreOnly.itemIds.toSorted());
        await reject(() => query(`select * from private.${name}($1,$2,'FOR_YOU',null,50,'{}')`,
          [{ ...scoreOnly, itemIds: [id(101), id(101)] }, profile]), '22023');
      }
      await reject(() => core(scoreOnly, profile), '40001');
      const before = await rows();
      await reject(() => core(request('EXPLICIT_CANONICAL'), shared), '42501');
      await query("select set_config('request.jwt.claim.sub',$1,true)", [other]);
      await reject(() => core(request('EXPLICIT_CANONICAL'), profile), '42501');
      await query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      await reject(() => core(request(), profile, null), '22023');
      assert.deepEqual(await rows(), before);
      for (const f of (await functions()).filter(row => [...newNames, ...oldNames].includes(row.proname))) {
        for (const role of ['anon', 'authenticated', 'service_role']) {
          assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, f.oid])).allowed, false,
            `${role}/${f.signature}`);
        }
      }
    });

    await t.test('native rollback smoke exercises actual wrappers without retaining fixtures', async () => {
      const before = await rows();
      const result = (await db.exec(await nativeCandidateRequestSmokeSql())).flatMap(value => value.rows);
      assert.match(result[0].snapshot.nativeCandidateRequest, /^PASS:/);
      assert.deepEqual(await rows(), before);
    });
  } finally { await db.close(); }
});

test('shared native acquisition preserves the populated V4/Discovery predecessor and exact scores', async t => {
  const { verifyNativeAcquisitionUpgrade } = await import('./native-candidate-request.mjs');
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(f => f.name.endsWith('_shared_native_candidate_acquisition.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const exec = async sql => {
      try { return (await db.exec(sql)).flatMap(r => r.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;'); t.diagnostic(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where })); throw error; }
    };
    const previous = (await db.query(`select oid::regprocedure::text signature,prosrc,pg_get_functiondef(oid) definition
      from pg_proc where pronamespace='private'::regnamespace and proname in(
        'rank_items_request_base_v1','rank_items_request_with_identity_v1','taste_candidate_catalog_v4')`)).rows;
    for (const f of previous) for (const mutation of [f.definition.replace(f.prosrc, () => f.prosrc+'\n-- drift'),
      `grant execute on function ${f.signature} to service_role;`, `alter function ${f.signature} set search_path='public';`]) {
      await db.exec('begin;'+mutation);
      await assert.rejects(db.exec(files[index].sql), /Native acquisition source\/security drift/);
      await db.exec('rollback;');
      assert.equal((await db.query("select to_regprocedure('private.acquire_native_candidates_v1(jsonb)') helper")).rows[0].helper, null);
    }
    await db.exec(`begin;create role acquisition_unexpected_reader;
      alter default privileges for role postgres in schema private grant execute on functions to acquisition_unexpected_reader;`);
    await assert.rejects(db.exec(files[index].sql), /Native acquisition new-function access drift/);
    await db.exec('rollback;');
    await db.exec('begin;create function private.acquire_native_candidates_v1(integer) returns integer language sql as $$select $1$$;');
    await assert.rejects(db.exec(files[index].sql), /Native acquisition owner or target collision/);
    await db.exec('rollback;');
    const report = await verifyNativeAcquisitionUpgrade(exec, files[index]);
    assert.equal(report.status, 'PASS');
    t.diagnostic(JSON.stringify(report));
    const { nativeAcquisitionSmokeSql } = await import('./native-candidate-request.mjs');
    const [smoke] = await exec(await nativeAcquisitionSmokeSql());
    assert.equal(smoke.nativeAcquisition.status, 'PASS');
    t.diagnostic(JSON.stringify(smoke));
  } finally { await db.close(); }
});
