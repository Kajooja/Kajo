import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyNativeSharedPreparedCases } from './native-prediction-adapter.mjs';

export const literal = value => `'${String(value).replaceAll("'", "''")}'`;
export const json = value => `${literal(JSON.stringify(value))}::jsonb`;
export const consume = (prediction, input) => `private.consume_shared_round_prediction_input_v1(${literal(prediction)},${literal(input)})`;
export const auth = actor => `set local request.jwt.claim.sub=${literal(actor)};`;
export const roundCommand = (f, roundSql, kind, revision, extra = {}) => `public.commit_shared_rating_round_v1(
  jsonb_build_object('version',1,'commandId',gen_random_uuid(),'actorUserId',${literal(f.actor)},
    'profileId',${literal(f.pair)},'roundId',${roundSql},'kind',${literal(kind)},'expectedRevision',${revision})||${json(extra)})`;
const md5 = text => createHash('md5').update(text).digest('hex');
const changedBodies = {
  rank_items_request_with_identity_v1: 'c823b2ad3f6a75fa05b5667e7a277601',
  native_final_run_input_v1: '08c7dc83443679e603b71b277692f276',
  validate_native_final_source_v1: '1165e742173dd4255cecb7f0144bedc5',
  shared_common_fit_candidate_v1_1: '8bf580e8051a2e205d101939f1239961',
  erase_prediction_sources_v1: 'f69c58702752ee797d92c5f649489363',
};
const owners = ['shared_prepared_feature_input_v1', 'prepare_shared_consumption_v1', 'validate_shared_consumption_v1',
  'consume_shared_round_prediction_input_v1', 'deny_detached_shared_consumption_v1',
  'deny_retained_shared_forecasts_v1', 'erase_shared_prepared_evidence_v1'];

// Reproduce only the reviewed comment/format variant from canonical source.
// No hosted rows, environment configuration or arbitrary body normalization.
export const sharedPreparedHostedVariantSql = `do $variant$
declare original text; definition text; body text;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.shared_common_fit_candidate_v1_1(jsonb,uuid,timestamp with time zone)'::regprocedure;
  if md5(original)<>'73c6709dbf19527c67a121fd2c83bfaf' then raise exception 'Unexpected variant fixture source';end if;
  body:=replace(original,E'\\n    -- Sparse Personal evidence shrinks toward the same neutral catalog prior.\\n','');
  body:=replace(body,E'  -- Only the neutral prior decays with Shared joint evidence. Accepted-member\\n  -- Personal fit remains useful even for a mature SharedProfile.\\n','');
  body:=replace(body,E'prior_component\\n      + member_component\\n      + consensus_component\\n      - disagreement_penalty',
    'prior_component + member_component + consensus_component - disagreement_penalty');
  if md5(body)<>'9e1777a5034f482b781db3b1eb6008dc' then raise exception 'Unexpected reviewed variant';end if;
  execute replace(definition,original,body);
end;$variant$;`;

export async function verifySharedPreparedHostedVariant(execSql, migration) {
  const rows = await execSql(`begin;
    create temp table shared_variant_before on commit drop as select p.* from pg_proc p
      where oid='private.shared_common_fit_candidate_v1_1(jsonb,uuid,timestamp with time zone)'::regprocedure;
    ${sharedPreparedHostedVariantSql}
    ${migration.sql}
    select jsonb_build_object('body',md5(p.prosrc),'metadataPreserved',
      (to_jsonb(p)-'prosrc')=(select to_jsonb(b)-'prosrc' from shared_variant_before b))
      from pg_proc p where oid='private.shared_common_fit_candidate_v1_1(jsonb,uuid,timestamp with time zone)'::regprocedure;
    rollback;
    select jsonb_build_object('body',md5(prosrc),'tableAbsent',to_regclass('private.shared_round_prediction_consumptions') is null)
      from pg_proc where oid='private.shared_common_fit_candidate_v1_1(jsonb,uuid,timestamp with time zone)'::regprocedure;`,
  { stage: 'shared-prepared-reviewed-format-variant', timeoutMs: 180_000 });
  assert.deepEqual(rows, [
    { body: 'd85f9a17165793a33421e1eb4b6434ae', metadataPreserved: true },
    { body: '73c6709dbf19527c67a121fd2c83bfaf', tableAbsent: true },
  ]);
  return { status: 'PASS', predecessor: '9e1777a5034f482b781db3b1eb6008dc',
    patched: rows[0].body, metadata: 'UNCHANGED', cleanup: 'ROLLBACK_RESTORED' };
}

// Disposable database only. Fixtures deliberately start from an empty account/
// catalog state, use real commands, commit preparation, then consume in a new TX.
export async function withSharedPreparedFixture(execSql, run) {
  const exec = (sql, stage) => execSql(sql, { stage: 'shared-prepared-' + stage.replaceAll('_', '-'), timeoutMs: 180_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in('public','private','auth');`, 'tables');
  const snapshotSql = 'begin read only;set local extra_float_digits=3;select jsonb_object_agg(name,value) from ('
    + tables.map(name => `select ${literal(name)} name,encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value from ${name} r`)
      .join(' union all ') + ') s;rollback;';
  const snapshot = () => one(snapshotSql, 'snapshot');
  const original = await snapshot();
  let setup = false, failure;
  try {
    assert.deepEqual(await one(`select jsonb_build_object('users',(select count(*) from auth.users),
      'items',(select count(*) from public.items));`, 'empty-state'), { users: 0, items: 0 });
    const fixture = (await Promise.all(['shared-round-outcomes-fixture.sql', 'shared-prepared-consumption-fixture.sql']
      .map(file => readFile(new URL(file, import.meta.url), 'utf8')))).join('\n')
      .replaceAll('create function pg_temp.', 'create or replace function pg_temp.');
    setup = true;
    const f = await one(`begin;${fixture}\nselect pg_temp.prepared_fixture();commit;`, 'fixture');
    const call = (prediction, input, actor = f.actor) => one(`begin;set local extra_float_digits=3;${auth(actor)}
      select ${consume(prediction, input)};commit;`, 'consume');
    const source = id => one(`begin read only;set local extra_float_digits=3;
      select jsonb_build_object('run',to_jsonb(r),'binding',to_jsonb(b),
        'candidates',(select jsonb_agg(to_jsonb(c) order by c.item_id) from private.prediction_candidates c where c.prediction_id=r.id))
      from private.prediction_runs r left join private.shared_round_prediction_consumptions b on b.prediction_id=r.id
      where r.id=${literal(id)};rollback;`, 'source');
    return await run({ f, exec, one, snapshot, call, source });
  } catch (e) { failure = e; throw e; }
  finally {
    if (setup) {
      try {
        // Erase new evaluation roots before their input sources.
        await exec(`begin;
          do $cleanup$ declare p uuid;begin
            if to_regclass('private.shared_round_prediction_consumptions') is not null then
              for p in execute 'select prediction_id from private.shared_round_prediction_consumptions order by prediction_id' loop
                if exists(select 1 from private.prediction_runs where id=p) then
                  perform private.erase_prediction_sources_v1('PREDICTION_RUN',p);end if;
              end loop;
            end if;
            for p in select id from public.users where id::text like 'a232b000-%' loop
              perform private.erase_prediction_sources_v1('ACTOR',p);end loop;
          end;$cleanup$;
          delete from public.profiles where id::text like 'a232b000-%' or id::text like 'a232f900-%';
          delete from auth.users where id::text like 'a232b000-%';
          delete from private.item_sources where item_id::text like 'a232b000-%' or item_id::text like 'a232f900-%';
          delete from public.items where id::text like 'a232b000-%' or id::text like 'a232f900-%';commit;`, 'cleanup');
        assert.deepEqual(await snapshot(), original, 'Shared prepared fixture changed original canonical rows');
      } catch (e) { throw new AggregateError(failure ? [failure, e] : [e], 'Shared prepared proof/cleanup failures'); }
    }
  }
}

export async function verifySharedPreparedUpgrade(execSql, migration) {
  return withSharedPreparedFixture(execSql, async ({ exec, one, snapshot, f }) => {
    const before = await snapshot();
    const inventory = `select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object(
      'oid',p.oid,'name',p.proname,'body',p.prosrc,'metadata',to_jsonb(p)-'prosrc') order by p.oid)
      from pg_proc p where p.pronamespace in('public'::regnamespace,'private'::regnamespace) and p.prokind='f'),
      'defaults',(select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d),
      'objects',(with tables as(select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where c.relkind='r' and n.nspname in('public','private','auth'))
        select jsonb_object_agg(identity,value) from (
          select 'table/'||c.oid identity,jsonb_build_object('namespace',c.relnamespace,'name',c.relname,
            'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
            'options',c.reloptions,'replicaIdentity',c.relreplident) value from tables c
          union all select 'column/'||a.attrelid||'/'||a.attnum,jsonb_build_object('column',to_jsonb(a),
            'default',to_jsonb(d),'expression',pg_get_expr(d.adbin,d.adrelid))
            from pg_attribute a join tables t on t.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
            where a.attnum>0 and not a.attisdropped
          union all select 'constraint/'||k.oid,jsonb_build_object('metadata',to_jsonb(k),'definition',pg_get_constraintdef(k.oid))
            from pg_constraint k join tables t on t.oid=k.conrelid
          union all select 'index/'||i.indexrelid,jsonb_build_object('metadata',to_jsonb(i),'definition',pg_get_indexdef(i.indexrelid))
            from pg_index i join tables t on t.oid=i.indrelid
          union all select 'trigger/'||g.oid,jsonb_build_object('metadata',to_jsonb(g),'definition',pg_get_triggerdef(g.oid))
            from pg_trigger g join tables t on t.oid=g.tgrelid
        ) objects));`;
    const old = await one(inventory, 'old-functions');
    await exec(`begin;${migration.sql}commit;`, 'forward');
    assert.deepEqual(await snapshot(), before, 'Shared consumption forward changed retained rows');
    const current = await one(inventory, 'current-functions');
    assert.deepEqual(current.defaults, old.defaults);
    for (const [key, value] of Object.entries(old.objects)) assert.deepEqual(current.objects[key], value,
      'Shared consumption forward changed existing schema object: ' + key);
    for (const previous of old.functions) {
      const next = current.functions.find(x => x.oid === previous.oid);
      assert.ok(next);assert.deepEqual(next.metadata, previous.metadata);
      if (changedBodies[previous.name]) assert.equal(md5(next.body), changedBodies[previous.name], 'Undeclared owner body change');
      else assert.equal(next.body, previous.body, 'Unrelated function body changed');
    }
    assert.deepEqual(current.functions.filter(x => !old.functions.some(y => y.oid === x.oid)).map(x => x.name).sort(), owners.toSorted());
    const preserved = await one(`select jsonb_build_object('usage',result->'usage','consumption',result->'predictorConsumption')
      from private.shared_round_prediction_inputs where id=${literal(f.consensus)};`, 'old-input');
    assert.deepEqual(preserved, { usage: 'INPUT_CAPTURE_ONLY', consumption: 'NOT_RECORDED' });
    return { status: 'PASS', rows: 'UNCHANGED', defaults: 'UNCHANGED', existingSchemaObjects: Object.keys(old.objects).length,
      existingFunctions: old.functions.length,
      changedBodies: Object.keys(changedBodies).length, newPrivateOwners: owners.length, cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
}

export async function verifySharedPreparedConsumption(execSql) {
  return withSharedPreparedFixture(execSql, async ({ f, exec, one, call, source }) => {
    const forecasts = Object.fromEntries(['cold', 'mixed', 'consensus', 'flat'].map(key => [key, randomUUID()]));
    // One transaction gives these four forecasts the same native baseline
    // clocks/features. Only their actual prepared Shared feature inputs differ.
    const results = await exec(`begin;set local extra_float_digits=3;${auth(f.actor)}
      ${Object.entries(forecasts).map(([key, id]) => `select ${consume(id, f[key])};`).join('\n')}commit;`, 'forecasts');
    assert.equal(results.length, 4);
    for (const [n, key] of Object.keys(forecasts).entries()) {
      assert.equal(results[n].items.length, 1);
      assert.equal(results[n].input.predictorConsumption, 'RECORDED');
      assert.equal(results[n].input.inputCaptureId, f[key]);
      assert.equal(results[n].items[0].itemId, f.movie);
      assert.equal(results[n].items[0].eligible, true);
      assert.deepEqual(await call(forecasts[key], f[key]), results[n], 'Exact retry changed consumed forecast');
    }
    const [cold, mixed, consensus, flat] = results;
    assert.equal(cold.input.fallback, 'NEUTRAL_COLD_START');
    assert.equal(flat.input.fallback, 'NEUTRAL_COLD_START');
    assert.equal(mixed.input.fallback, 'SUPPORTED_ORDINAL_TAGS');
    assert.equal(consensus.input.fallback, 'SUPPORTED_ORDINAL_TAGS');
    assert.ok(consensus.items[0].score > cold.items[0].score, 'Supported prepared preferences did not affect the forecast');
    assert.ok(mixed.items[0].score < consensus.items[0].score, 'Disagreement was lost');
    assert.ok(mixed.items[0].score < cold.items[0].score, 'Relative disagreement did not lower neutral fit');
    assert.ok(mixed.items[0].finalScoringInput.explanation.sharedCommonFit.disagreement.penalty > 0);
    assert.equal(flat.items[0].score, cold.items[0].score, 'Constant within-person responses invented direction');
    for (const result of results) assert.deepEqual(result.items[0].finalScoringInput.explanation.scoringFeatures,
      cold.items[0].finalScoringInput.explanation.scoringFeatures, 'Comparison changed baseline features');

    const conformance = await verifyNativeSharedPreparedCases(execSql, Object.entries(forecasts).map(([name, id]) =>
      `select ${literal(name)} name,${literal(id)}::uuid prediction_id,null::jsonb evaluation_receipt`).join(' union all '));
    const personalPrediction = randomUUID();
    await exec(`begin;${auth(f.actor)}select private.capture_personal_evaluation_v1(${literal(personalPrediction)},
      ${literal(f.personal)},array[${literal(f.movie)}]::uuid[],'2000-01-01','{}');commit;`, 'personal-isolation');
    const personalBefore = await source(personalPrediction);
    const retained = await source(forecasts.consensus);
    const prepared = await one(`select result from private.shared_round_prediction_inputs where id=${literal(f.consensus)};`, 'frozen-input');
    const ordinal = [];
    for (const rating of [0, 5, 10]) {
      // Pure counterfactual copies test this declared ordinal feature contract;
      // they are never persisted as native outcomes or consumed-run receipts.
      const input = structuredClone(prepared);
      for (const s of input.sources) for (const response of s.outcome.responses) response.rating = s.captureId === f.low ? 5 : rating;
      const features = await one(`select private.shared_prepared_feature_input_v1(${json(input)},
        ${json(retained.binding.feature_input.sourceItems)});`, 'ordinal-features');
      ordinal.push(await one(`select private.shared_common_fit_candidate_v1_1(${json(features.commonContext)},${literal(f.movie)},now());`, 'ordinal-fit'));
      if (rating === 5) assert.equal(features.fallback, 'NEUTRAL_COLD_START');
      for (const s of input.sources) for (const response of s.outcome.responses) response.rating = 2 + response.rating / 2;
      assert.deepEqual(await one(`select private.shared_prepared_feature_input_v1(${json(input)},
        ${json(retained.binding.feature_input.sourceItems)});`, 'response-scale'), features,
      'Positive affine within-person scale changed ordinal features');
    }
    assert.ok(ordinal[0].contribution < ordinal[1].contribution && ordinal[1].contribution < ordinal[2].contribution);
    assert.equal(ordinal[1].contribution, 0, 'Missing direction is not a negative satisfaction label');
    const rejects = async (sql, codes) => {
      const [result] = await exec(`begin;${auth(f.actor)}
        do $reject$ begin begin ${sql}
          raise exception 'Missing Shared consumption rejection' using errcode='ZX999';
        exception when others then
          if not(SQLSTATE=any(${literal('{' + codes.join(',') + '}')}::text[])) then raise;end if;
        end;end;$reject$;select to_jsonb(true);rollback;`, 'rejection');
      assert.equal(result, true);
    };
    const reject = (sql, ...codes) => rejects(sql, codes);
    await reject(`perform set_config('request.jwt.claim.sub',${literal(f.partner)},true);
      perform ${consume(randomUUID(), f.stale)};`, '42501');
    await reject(`perform ${consume(forecasts.cold, f.stale)};`, '22023');
    await reject(`perform ${consume(randomUUID(), f.cold)};`, '23505');
    await reject(`delete from private.shared_round_prediction_consumptions where prediction_id=${literal(forecasts.consensus)};`, '55000');
    await reject(`delete from private.shared_round_prediction_inputs where id=${literal(f.consensus)};`, '55000');
    await reject(`update private.shared_round_prediction_consumptions set marker=marker;`, '55000');
    await reject(`update public.items set discoverable=false where id=${literal(f.movie)};
      perform ${consume(randomUUID(), f.stale)};`, '22023');
    await reject(`update private.prediction_runs set state_snapshot=
      jsonb_set(jsonb_set(state_snapshot,'{sharedPreparedInput,inputDigest}',to_jsonb(repeat('0',32))),
        '{finalScoringInput,sharedPreparedInput,inputDigest}',to_jsonb(repeat('0',32))) where id=${literal(forecasts.consensus)};
      perform private.validate_native_final_source_v1(${literal(forecasts.consensus)});`, '22023');
    // Same actor and overlapping users do not authorize another joint target.
    for (const profile of [f.abz, f.personal]) await reject(`perform * from private.rank_items_request_with_identity_v1(
      jsonb_build_object('version','native-candidate-request-v1','acquisition','EXPLICIT_CANONICAL','intent','EVALUATION',
        'itemIds',jsonb_build_array(${literal(f.movie)}),'seenItemIds','[]'::jsonb,'reminderSpent',false,
        'requiredAfter',(select observed_at from private.shared_round_prediction_inputs where id=${literal(f.abcInput)})),
      gen_random_uuid(),${literal(profile)},'FOR_YOU',null,1,jsonb_build_object('sharedPreparedInputId',${literal(f.abcInput)}));`, '42501');
    await reject(`perform private.capture_shared_round_prediction_input_v1(gen_random_uuid(),${literal(f.abz)},
      ${literal(f.abzRound)},1,array[${literal(f.abcSource)}]::uuid[]);`, '55000');
    await reject(`delete from public.profile_members where profile_id=${literal(f.multi)} and user_id=${literal(f.third)};
      insert into public.profile_members(profile_id,user_id) values(${literal(f.multi)},${literal(f.outsider)});
      perform ${consume(randomUUID(), f.abcInput)};`, '42501');
    await reject(`perform ${roundCommand(f, literal(f.targetRound), 'SET_RESPONSE', 1, { rating: null })};
      perform ${consume(randomUUID(), f.stale)};`, '40001');
    const lowRound = `(select round_id from private.shared_round_outcome_captures where id=${literal(f.low)})`;
    await reject(`perform ${roundCommand(f, lowRound, 'CLEAR_RESPONSE', 3, {})};
      perform ${consume(randomUUID(), f.stale)};`, '40001');
    // Corrections retain the already consumed forecast, but a new forecast may
    // not consume the earlier head even though the old input capture still exists.
    await exec(`begin;${auth(f.actor)}select ${roundCommand(f, lowRound, 'SET_RESPONSE', 3, { rating: 10 })};commit;`, 'correction');
    await reject(`perform ${consume(randomUUID(), f.stale)};`, '40001');
    assert.deepEqual(await source(forecasts.consensus), retained);
    assert.deepEqual(await call(forecasts.consensus, f.consensus), consensus);
    for (const isolation of ['repeatable read', 'serializable']) {
      assert.equal(await one(`begin isolation level ${isolation};${auth(f.actor)}
        do $isolation$ begin begin perform ${consume(forecasts.consensus, f.consensus)};
          raise exception 'Stale-snapshot consumption retry was accepted' using errcode='ZX999';
        exception when sqlstate '25001' then null;end;end;$isolation$;select to_jsonb(true);rollback;`, 'isolation'), true);
    }
    const access = await one(`select jsonb_build_object('functions',not exists(select 1 from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.pronamespace='private'::regnamespace and p.proname=any(${literal('{' + owners.join(',') + '}')}::text[])
        and (a.grantee<>p.proowner or p.prosecdef)),
      'table',not exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
        where c.oid='private.shared_round_prediction_consumptions'::regclass and a.grantee<>c.relowner));`, 'closed-access');
    assert.deepEqual(access, { functions: true, table: true });
    {
      await exec(`begin;select private.erase_shared_prepared_evidence_v1('OUTCOME_CAPTURE',${literal(f.high)});commit;`, 'source-withdrawal');
      const remaining = await one(`select jsonb_build_object('run',exists(select 1 from private.prediction_runs where id=${literal(forecasts.consensus)}),
        'binding',exists(select 1 from private.shared_round_prediction_consumptions where prediction_id=${literal(forecasts.consensus)}),
        'input',exists(select 1 from private.shared_round_prediction_inputs where id=${literal(f.consensus)}),
        'unrelated',exists(select 1 from private.prediction_runs where id=${literal(forecasts.mixed)}));`, 'erasure-closure');
      assert.deepEqual(remaining, { run: false, binding: false, input: false, unrelated: true });
    }
    assert.deepEqual(await source(personalPrediction), personalBefore);
    await exec(`begin;select private.erase_prediction_sources_v1('ACTOR',${literal(f.partner)});commit;`, 'copied-actor-erasure');
    assert.equal(await one(`select to_jsonb(count(*)) from private.prediction_runs where id in(
      ${Object.values(forecasts).map(literal).join(',')});`, 'foreign-actor-forecasts'), 0);
    assert.deepEqual(await source(personalPrediction), personalBefore, 'Copied Shared actor erasure changed an unrelated Personal forecast');
    return { status: 'PASS', genuineFeatureSensitivity: true, disagreement: true, constantAndEmptyFallback: true,
      exactRetry: true, corrections: 'FROZEN_OLD_NEW_STALE_REJECTED', scope: 'FULL_ENROLLMENT_PERSONAL_AND_OVERLAPPING_SET_ISOLATION',
      conformance, ordinalRatings: [0, 5, 10], responseScale: 'POSITIVE_AFFINE_INVARIANT',
      closedAccess: access, erasure: 'DEPENDENT_RUN_BINDING_INPUT_REMOVED_UNRELATED_PRESERVED',
      copiedActorErasure: 'OTHER_ACTOR_FORECASTS_REMOVED_PERSONAL_PRESERVED',
      cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
}
