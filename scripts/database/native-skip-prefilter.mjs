import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { nativeCandidateRequestFixtureSql } from './native-candidate-request.mjs';

const actor = 'ab157000-0000-4000-8000-000000000001';
const json = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";

// Shared by PGlite and real PostgreSQL. This compares the actual populated
// predecessor with the forward, including all acquisition output fields.
export async function verifyNativeSkipPrefilter(execSql, migration) {
  assert.match(migration.name, /_native_skip_acquisition_prefilter\.sql$/);
  const exec = (sql, stage) => execSql(sql, { stage: 'skip-prefilter-' + stage, timeoutMs: 180_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by 1)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in('public','private','auth');`, 'tables');
  const snapshot = 'begin read only;set local extra_float_digits=3;select jsonb_object_agg(name,value) from ('
    + tables.map(name => `select '${name}' name,encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value from ${name} r`).join(' union all ')
    + ') s;rollback;';
  const original = await one(snapshot, 'original');
  assert.equal(await one(`select to_jsonb(count(*)) from auth.users where id::text like 'ab157000-%';`, 'reserved'), 0);
  let fixture = false, failure;
  try {
    fixture = true;
    await exec('begin;' + await nativeCandidateRequestFixtureSql() + 'commit;', 'fixture');
    const profileId = await one(`select to_jsonb(id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`, 'profile');
    const call = (name, request) => one(`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;
      select public.${name}(${json(request)});commit;`, 'command');
    const start = await call('taste_session_v2', { operation: 'START', profileId, requestId: randomUUID() });
    const next = { operation: 'NEXT', profileId, sessionId: start.sessionId,
      requestId: randomUUID(), expectedRevision: start.revision };
    const question = await call('taste_session_v2', next);
    assert.equal(question.status, 'QUESTION');
    const feedRequest = { version: 3, requestId: randomUUID(), profileId, sessionId: randomUUID(),
      discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {}, cursor: null, replacesChainId: null };
    const page = await call('rank_items_feed_v1', feedRequest);
    assert.equal(page.items.length, 5);
    const populated = await one(snapshot, 'populated');
    const report = await one(`begin;set local extra_float_digits=3;set local request.jwt.claim.sub='${actor}';
      create temp table skip_functions as select oid,proname,prosrc,pg_get_functiondef(oid) definition,to_jsonb(p)-'prosrc' metadata from pg_proc p
        where pronamespace in('public'::regnamespace,'private'::regnamespace) and prokind='f';
      create temp table skip_defaults as select to_jsonb(d) value from pg_default_acl d;
      -- A closed test-only reference retains the actual predecessor, not a
      -- handwritten reimplementation of its decisions or policy.
      do $reference$ declare body text;begin
        select pg_get_functiondef('private.acquire_native_candidates_v1(jsonb)'::regprocedure) into body;
        execute replace(body,'FUNCTION private.acquire_native_candidates_v1(', 'FUNCTION pg_temp.skip_reference(');
        revoke all on function pg_temp.skip_reference(jsonb) from public,anon,authenticated,service_role;
      end;$reference$;
      ${migration.sql}
      do $preservation$ declare old record;actual record;begin
        if (select count(*) from skip_functions)<>(select count(*) from pg_proc
          where pronamespace in('public'::regnamespace,'private'::regnamespace) and prokind='f') then
          raise exception 'Skip prefilter added or removed a function';end if;
        for old in select * from skip_functions loop
          select prosrc,to_jsonb(p)-'prosrc' metadata into strict actual from pg_proc p where oid=old.oid;
          if actual.metadata is distinct from old.metadata or
            (old.proname<>'acquire_native_candidates_v1' and actual.prosrc<>old.prosrc) then
            raise exception 'Skip prefilter changed unrelated function or metadata: %',old.proname;end if;
        end loop;
        if (select jsonb_agg(value order by value::text) from skip_defaults) is distinct from
          (select jsonb_agg(to_jsonb(d) order by to_jsonb(d)::text) from pg_default_acl d) then
          raise exception 'Skip prefilter changed defaults';end if;
      end;$preservation$;
      create function pg_temp.seed_skip(n integer,p uuid,i integer,at_time timestamptz,
        reverses integer default null,erased boolean default false) returns void language sql as $seed$
        insert into private.contextual_skip_commands(action_id,actor_user_id,profile_id,item_id,surface,kind,
          origin_hash,origin,command,result,accepted_at,reverses_action_id,erased_at)
        values(('ab157777-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${actor}',p,
          case when not erased then ('ab157000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid end,'DISCOVERY',
          case when reverses is null then 'CONTEXTUAL_SKIP' else 'WITHDRAW_CONTEXTUAL_SKIP' end,n::text,
          case when not erased then '{}'::jsonb end,case when not erased then '{}'::jsonb end,
          case when not erased then '{}'::jsonb end,at_time,
          case when reverses is not null and not erased then ('ab157777-0000-4000-8000-'||lpad(reverses::text,12,'0'))::uuid end,
          case when erased then now() end);
      $seed$;
      do $seeds$ declare p uuid;n integer:=0;begin
        foreach p in array array['${profileId}'::uuid,'ab157000-0000-4000-8000-000000000900'::uuid] loop
          perform pg_temp.seed_skip(n+1,p,110,now()-interval '1 hour');
          perform pg_temp.seed_skip(n+2,p,110,now()-interval '1 hour'); -- tied source set
          perform pg_temp.seed_skip(n+3,p,111,now()-interval '24 hours'); -- exact expiry
          perform pg_temp.seed_skip(n+4,p,112,now()-interval '1 hour');
          perform pg_temp.seed_skip(n+5,p,112,now(),n+4); -- reversal boundary
          perform pg_temp.seed_skip(n+6,p,113,now()+interval '1 microsecond'); -- future
          perform pg_temp.seed_skip(n+7,p,114,now()-interval '1 hour',null,true); -- tombstone
          perform pg_temp.seed_skip(n+8,p,115,now()-interval '30 hours'); -- expired source retained
          perform pg_temp.seed_skip(n+9,p,116,now()-interval '2 hours');
          perform pg_temp.seed_skip(n+10,p,116,now()-interval '1 hour');
          perform pg_temp.seed_skip(n+11,p,116,now(),n+10); -- expose older source
          perform pg_temp.seed_skip(n+12,p,102,now()-interval '1 hour'); -- other policy suppressed
          n:=100;
        end loop;
        select id into p from public.profiles where owner_user_id='ab157000-0000-4000-8000-000000000002' and profile_type='PERSONAL';
        perform pg_temp.seed_skip(201,p,117,now()-interval '1 hour'); -- unrelated Profile
      end;$seeds$;
      create temp table skip_cases(value jsonb);
      do $parity$ declare p uuid;m text;d text;acq text;delta interval;request jsonb;before_rows jsonb;after_rows jsonb;
        native_request jsonb;cutoff timestamptz;cases integer:=0;catalog_before jsonb;catalog_after jsonb;errors integer:=0;
      begin
        foreach p in array array['${profileId}'::uuid,'ab157000-0000-4000-8000-000000000900'::uuid] loop
          foreach m in array array['FOR_YOU','SURPRISE','RISK'] loop
            foreach d in array array[null,'BOOK','MOVIE'] loop
              foreach acq in array array['LEGACY_DISCOVERY','CATALOG_CHAIN','EXPLICIT_CANONICAL'] loop
                foreach delta in array array[interval '-1 microsecond',interval '0',interval '1 microsecond'] loop
                  if acq='EXPLICIT_CANONICAL' and delta<>interval '0' then continue;end if;
                  cutoff:=now()+delta;
                  native_request:=jsonb_build_object('version','native-candidate-request-v1','acquisition',acq,
                    'intent',case when acq='EXPLICIT_CANONICAL' then 'EVALUATION' else 'DELIVERY' end,
                    'itemIds',case when acq='EXPLICIT_CANONICAL' then
                      (select jsonb_agg(id order by id) from public.items where id::text like 'ab157000-%') end,
                    'seenItemIds',case when acq='CATALOG_CHAIN' then '["ab157000-0000-4000-8000-000000000100"]'::jsonb else '[]'::jsonb end,
                    'reminderSpent',acq='CATALOG_CHAIN','requiredAfter',case when acq='EXPLICIT_CANONICAL' then '2000-01-01T00:00:00Z' end);
                  request:=jsonb_build_object('version','native-candidate-acquisition-v1',
                    'scope',jsonb_build_object('profileId',p,'actorUserId','${actor}','sessionId',null),
                    'mode',m,'itemType',d,'nativeEvidenceAsOf',now(),'eligibilityAt',cutoff,
                    'eligibilityClock',case when acq='EXPLICIT_CANONICAL' then 'TRANSACTION_START' else 'CURRENT_WALL_TIME' end,
                    'sourcePolicy',case when acq='EXPLICIT_CANONICAL' then 'CANONICAL_AVAILABLE_AT_CUTOFF' else 'LEGACY_DISCOVERABLE_ROWS' end,
                    'candidateRequest',native_request,'tastePool',null);
                  select jsonb_agg(to_jsonb(r) order by id) into before_rows from pg_temp.skip_reference(request) r;
                  select jsonb_agg(to_jsonb(r) order by id) into after_rows from private.acquire_native_candidates_v1(request) r;
                  if before_rows is null or after_rows is distinct from before_rows then raise exception 'Skip prefilter acquisition parity mismatch';end if;
                  cases:=cases+1;
                  if acq='LEGACY_DISCOVERY' and d='MOVIE' and delta=interval '0' then
                    if (select r.resurfacing_input#>>'{contextualSkip,reason}' from private.acquire_native_candidates_v1(request) r
                      where id='ab157000-0000-4000-8000-000000000111')<>'SKIP_COOLDOWN_ELAPSED'
                      or (select jsonb_array_length(r.resurfacing_input#>'{contextualSkip,sourceIds}') from private.acquire_native_candidates_v1(request) r
                      where id='ab157000-0000-4000-8000-000000000110')<>2 then raise exception 'Missing expiry/tied-source coverage';end if;
                  end if;
                end loop;
              end loop;
            end loop;
          end loop;
        end loop;
        -- Invalid old clock inputs must still reach the original rejection,
        -- even when the statement-local superset contains no possible source.
        request:=request||jsonb_build_object('eligibilityAt','1969-12-31T23:59:59Z',
          'eligibilityClock','CURRENT_WALL_TIME','sourcePolicy','LEGACY_DISCOVERABLE_ROWS',
          'candidateRequest',jsonb_build_object('version','native-candidate-request-v1','acquisition','LEGACY_DISCOVERY',
            'intent','DELIVERY','itemIds',null,'seenItemIds','[]'::jsonb,'reminderSpent',false,'requiredAfter',null));
        begin perform * from pg_temp.skip_reference(request);
        exception when invalid_parameter_value then errors:=errors+1;end;
        begin perform * from private.acquire_native_candidates_v1(request);
        exception when invalid_parameter_value then errors:=errors+1;end;
        if errors<>2 then raise exception 'Skip prefilter changed invalid-clock rejection';end if;
        -- V4 keeps the same branch and recognition rows. Swap only the private
        -- owner within a rolled-back subtransaction to compare its real caller.
        catalog_after:=private.taste_candidate_catalog_v4('${start.sessionId}',now());
        begin
          execute (select definition from skip_functions where proname='acquire_native_candidates_v1');
          catalog_before:=private.taste_candidate_catalog_v4('${start.sessionId}',now());
          raise exception using errcode='KJ009';
        exception when sqlstate 'KJ009' then null;end;
        if catalog_after is distinct from catalog_before then raise exception 'Skip prefilter changed Taste catalogue';end if;
        insert into skip_cases values(jsonb_build_object('status','PASS','acquisitionCases',cases,'tasteCatalogues',1,'invalidClockRejections',errors,
          'unchangedFunctions',(select count(*)-1 from skip_functions),'preservedFunctionMetadata',true));
      end;$parity$;
      select value from skip_cases;rollback;`, 'populated-parity');
    assert.equal(report.status, 'PASS');
    assert.equal(report.acquisitionCases, 126);
    // The large parity rehearsal rolled back. Install exactly the same forward
    // against the still-populated predecessor and prove immutable retries.
    await exec('begin;' + migration.sql + 'commit;', 'install');
    assert.deepEqual(await one(snapshot, 'preserved'), populated, 'Migration changed retained rows');
    assert.deepEqual(await call('taste_session_v2', next), question);
    assert.deepEqual(await call('rank_items_feed_v1', feedRequest), page);
    assert.deepEqual(await one(snapshot, 'retry-preserved'), populated, 'Exact retry changed retained rows');
    return { ...report, exactRetries: 2, canonicalTablesVerified: tables.length, cleanup: 'ALL_CANONICAL_ROWS_RESTORED' };
  } catch (error) { failure = error; throw error; }
  finally {
    if (fixture) {
      try {
      await exec(`rollback;begin;delete from public.profiles where id='ab157000-0000-4000-8000-000000000900'
          or owner_user_id::text like 'ab157000-%';
        delete from auth.users where id::text like 'ab157000-%';
        delete from private.item_sources where item_id::text like 'ab157000-%';
        delete from public.items where id::text like 'ab157000-%';commit;`, 'cleanup');
      assert.deepEqual(await one(snapshot, 'restored'), original, 'Skip prefilter fixture cleanup failed');
      } catch (error) { throw new AggregateError(failure ? [failure, error] : [error], 'Skip prefilter proof/cleanup failed'); }
    }
  }
}
