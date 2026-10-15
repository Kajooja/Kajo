// Read-only target preflight and empty disposable-database rehearsal only.
// Deliberately contains no network client, hosted executor or apply operation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteChallengeFixtureSql } from './personal-taste-challenge.mjs';

export const sequentialTasteHostedManifest = JSON.parse(await readFile(new URL('personal-sequential-taste-hosted-upgrade.json', import.meta.url), 'utf8'));
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const hash = value => createHash('sha256').update(value).digest('hex');
const md5 = value => createHash('md5').update(value).digest('hex');
const bootstrapSignature = 'private.bootstrap_evidence_weight_v1(text,integer)';
export const sequentialTasteBootstrapCompactBody = "\n select case evidence_kind when 'RATED' then case when evidence_rating between 0 and 10 then (evidence_rating::double precision-5.0)*0.75 else 0.0 end when 'CONSUMED' then 0.4 when 'SAVED' then 0.9 else 0.0 end;\n";

export async function loadSequentialTasteHostedPrerequisite() {
  const expected = sequentialTasteHostedManifest.prerequisite;
  const sql = await readFile(new URL('../../supabase/migrations/' + expected.filename, import.meta.url), 'utf8');
  assert.equal(hash(sql), expected.sha256, 'Reviewed sequential bootstrap prerequisite changed');
  return { name: expected.filename, sql };
}

export function validateSequentialTasteHostedForwards(files) {
  assert.equal(files.length, sequentialTasteHostedManifest.forwards.length, 'Expected the exact reviewed sequential forward chain');
  files.forEach((file, index) => {
    const expected = sequentialTasteHostedManifest.forwards[index];
    assert.equal(file.name, expected.filename, 'Sequential forward dependency order changed');
    assert.equal(hash(file.sql), expected.sha256, `Reviewed sequential SQL changed: ${file.name}`);
  });
  return files;
}

export async function loadSequentialTasteHostedForwards() {
  await loadSequentialTasteHostedPrerequisite();
  return validateSequentialTasteHostedForwards(await Promise.all(sequentialTasteHostedManifest.forwards.map(async file => ({
    name: file.filename, sql: await readFile(new URL('../../supabase/migrations/' + file.filename, import.meta.url), 'utf8'),
  }))));
}

// This declaration comes from a freshly reviewed private checkpoint, never from
// a timeout or an assumption that the previous operation committed. Bodies and
// exact history are independently checked by the generated read-only preflight.
export function remainingSequentialTasteHostedForwards(installedForwards) {
  assert.ok(Array.isArray(installedForwards), 'An explicit observed installed-forward prefix is required');
  assert.ok(installedForwards.length <= sequentialTasteHostedManifest.forwards.length, 'Unknown installed sequential forward');
  assert.deepEqual(installedForwards, sequentialTasteHostedManifest.forwards.slice(0, installedForwards.length),
    'Installed sequential forwards must be the exact reviewed contiguous prefix');
  return sequentialTasteHostedManifest.forwards.slice(installedForwards.length);
}

const signatures = [
  'private.reject_immutable_prediction_artifact_change_v1()',
  'private.build_profile_memory_state_v1(uuid,timestamptz)',
  'private.rank_items_v0(uuid,text,text,integer,jsonb)',
  'private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',
  'private.rank_items_scalar_v1(uuid,text,text,integer,jsonb,uuid)',
  'private.rank_items_catalog_scalar_v1(uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',
  'private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',
  'private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',
  'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)',
  'private.rank_items_first_page_v1(jsonb)',
  'private.rank_items_catalog_chain_v1(jsonb)',
  'private.bootstrap_evidence_weight_v1(text,integer)',
  'private.bootstrap_weighted_evidence_v1(uuid,timestamptz)',
  'private.personal_source_evidence_v1(uuid,timestamptz)',
  'private.get_profile_bootstrap_status_v1(uuid)',
  'public.get_profile_bootstrap_status_v1(uuid)',
  'private.taste_session_v1(jsonb)',
  'public.taste_session_v1(jsonb)',
  'private.taste_challenge_v1(jsonb)',
  'public.taste_challenge_v1(jsonb)',
  'private.capture_personal_evaluation_v1(uuid,uuid,uuid[],timestamptz,jsonb)',
  'private.taste_session_v2(jsonb)',
  'public.taste_session_v2(jsonb)',
  'private.rank_items_candidate_base_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb)',
  'private.rank_items_candidate_scalar_v1(uuid[],boolean,uuid[],boolean,uuid,text,text,integer,jsonb,uuid)',
  'private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',
  'private.sequential_taste_similarity_v2(jsonb,jsonb)',
  'private.sequential_taste_components_v2(jsonb,jsonb,text)',
  'private.select_sequential_taste_v2(jsonb,jsonb,jsonb,text)',
  'private.sequential_taste_evaluations_v2(uuid,jsonb)',
  'private.sequential_taste_snapshot_v2(uuid)',
  'private.project_sequential_taste_evidence_v2(uuid,jsonb,jsonb)',
  'private.guard_sequential_taste_panel_v2()',
  'private.invalidate_sequential_taste_v2(uuid,text,boolean)',
  'private.withdraw_sequential_panel_source_v2()',
  'private.remove_sequential_taste_v2(uuid)',
  'private.withdraw_sequential_import_v2()',
  'private.withdraw_sequential_event_v2()',
  'private.withdraw_sequential_bootstrap_v2()',
  'private.guard_sequential_taste_writer_v2()',
  'private.guard_sequential_taste_history_v2()',
];

export const sequentialTasteHostedFunctionSnapshotSql = `select jsonb_agg(jsonb_build_object(
  'signature',s.signature,'definitionMd5',case when p.oid is not null then md5(pg_get_functiondef(p.oid)) end,
  'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
  'configuration',p.proconfig,'acl',p.proacl::text) order by s.position) functions
  from unnest(array[${signatures.map(quote).join(',')}]::text[]) with ordinality s(signature,position)
  left join pg_proc p on p.oid=to_regprocedure(s.signature)`;

const triggerNames = ['guard_sequential_taste_panel_v2','withdraw_sequential_panel_source_v2',
  'withdraw_sequential_import_v2','withdraw_sequential_event_v2','withdraw_sequential_reversal_v2',
  'withdraw_sequential_bootstrap_delete_v2','withdraw_sequential_bootstrap_active_v2',
  'guard_sequential_taste_writer_v2','guard_sequential_taste_history_v2'];
export const sequentialTasteHostedTriggerSnapshotSql = `select coalesce(jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,
  'definition',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname),'[]'::jsonb) triggers
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in('public','private') and t.tgname=any(array[${triggerNames.map(quote).join(',')}]::text[])`;

const references = new Map();
async function reference(installedForwards) {
  remainingSequentialTasteHostedForwards(installedForwards);
  const count = installedForwards.length;
  if (!references.has(count)) references.set(count, (async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const { files } = await buildFreshInstallation();
      const index = files.findIndex(file => file.name === sequentialTasteHostedManifest.sourceCheckpoint);
      assert.ok(index >= 0, 'Sequential hosted source checkpoint missing');
      for (const file of files.slice(0, index + 1)) await db.exec(`begin;${file.sql}commit;`);
      const forwards = await loadSequentialTasteHostedForwards();
      for (const file of forwards.slice(0, count)) await db.exec(`begin;${file.sql}commit;`);
      return { functions: (await db.query(sequentialTasteHostedFunctionSnapshotSql)).rows[0].functions,
        triggers: (await db.query(sequentialTasteHostedTriggerSnapshotSql)).rows[0].triggers };
    } finally { await db.close(); }
  })());
  return structuredClone(await references.get(count));
}

export async function sequentialTasteHostedFunctionReference(installedForwards, { bootstrapVariant = 'CANONICAL' } = {}) {
  assert.ok(['CANONICAL','COMPACT_V1'].includes(bootstrapVariant), 'Unknown bootstrap compatibility variant');
  assert.ok(bootstrapVariant !== 'COMPACT_V1' || installedForwards.length === 0, 'Compact bootstrap cannot follow an installed sequential forward');
  const { functions } = await reference(installedForwards);
  if (bootstrapVariant === 'COMPACT_V1') functions.find(f => f.signature === bootstrapSignature).definitionMd5 = '463109736bd56089b5f9a408da389291';
  return functions;
}

async function validateHistoryReceipts(checkpoint) {
  const { installedForwards, appliedForwards = [], prerequisiteReceipt = null } = checkpoint;
  assert.ok(!prerequisiteReceipt || checkpoint.bootstrapVariant !== 'COMPACT_V1',
    'Installed bootstrap prerequisite with a compact body is drift; never replay the bridge');
  assert.equal(appliedForwards.length, installedForwards.length, 'Every installed forward needs its exact provider history receipt');
  const files = await loadSequentialTasteHostedForwards();
  const prerequisite = await loadSequentialTasteHostedPrerequisite();
  const checked = [];
  for (const [i, receipt] of appliedForwards.entries()) {
    assert.equal(receipt.filename, installedForwards[i].filename, 'Applied receipt is not the exact installed prefix');
    assert.equal(receipt.sha256, installedForwards[i].sha256, 'Applied receipt source hash changed');
    if (i > 0) assert.ok(appliedForwards[i - 1].providerVersion < receipt.providerVersion,
      'Provider sequential history must preserve forward dependency order');
    checked.push({ receipt, file: files[i] });
  }
  if (prerequisiteReceipt) {
    assert.equal(prerequisiteReceipt.filename, prerequisite.name, 'Unknown prerequisite receipt');
    assert.equal(prerequisiteReceipt.sha256, sequentialTasteHostedManifest.prerequisite.sha256, 'Prerequisite receipt hash changed');
    checked.push({ receipt: prerequisiteReceipt, file: prerequisite });
  }
  const versions = new Set();
  for (const { receipt, file } of checked) {
    assert.match(receipt.providerVersion, /^\d{14}$/);
    assert.ok(!versions.has(receipt.providerVersion), 'Duplicate provider migration receipt'); versions.add(receipt.providerVersion);
    const name = file.name.replace(/^\d+_/, '').replace(/\.sql$/, '');
    assert.equal(receipt.providerName, name, 'Provider migration name must identify the reviewed source');
    assert.equal(receipt.statementMd5, md5(file.sql), 'Provider statement receipt must match the exact complete reviewed SQL');
  }
  return checked.map(({ receipt }) => receipt);
}

export async function sequentialTasteHostedPreflightSql(checkpoint) {
  assert.ok(checkpoint?.target, 'A private sequential operator checkpoint is required');
  const { target, functions, installedForwards, bootstrapVariant = 'CANONICAL' } = checkpoint;
  const remaining = remainingSequentialTasteHostedForwards(installedForwards);
  const receipts = await validateHistoryReceipts(checkpoint);
  assert.match(target.projectRef, /^[a-z]{20}$/);
  assert.equal(target.postgresMajor, 17);
  assert.ok(Number.isSafeInteger(target.historyCount) && target.historyCount >= 0);
  assert.match(target.historyMd5, /^[a-f0-9]{32}$/);
  assert.deepEqual(functions, await sequentialTasteHostedFunctionReference(installedForwards, { bootstrapVariant }),
    'Observed sequential bodies/security must match the exact reviewed installed prefix');
  const expectedTriggers = (await reference(installedForwards)).triggers;
  const historyNames = [...sequentialTasteHostedManifest.forwards, sequentialTasteHostedManifest.prerequisite]
    .map(f => f.filename.replace(/^\d+_/, '').replace(/\.sql$/, ''));
  const state = bootstrapVariant === 'COMPACT_V1' ? 'BRIDGE_REQUIRED' : 'PASS';
  return `begin read only;
    set local statement_timeout='10s';set local search_path=pg_catalog;
    do $sequential_preflight$ declare digest text;total bigint;actual jsonb;r jsonb;
    begin
      if split_part(current_setting('server_version'),'.',1)::integer<>${target.postgresMajor} then
        raise exception 'Hosted sequential Taste PostgreSQL generation changed';end if;
      select md5(coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
        'statementMd5',md5(array_to_string(statements,E'\\n'))) order by version),'[]'::jsonb)::text),count(*)
        into digest,total from supabase_migrations.schema_migrations;
      if total<>${target.historyCount} or digest<>${quote(target.historyMd5)} then
        raise exception 'Hosted sequential Taste history changed; review actual successful prefix';end if;
      for r in select value from jsonb_array_elements(${quote(JSON.stringify(receipts))}::jsonb) loop
        if (select count(*) from supabase_migrations.schema_migrations m where m.version=r->>'providerVersion'
          and m.name=r->>'providerName' and md5(array_to_string(m.statements,E'\\n'))=r->>'statementMd5')<>1 then
          raise exception 'Hosted sequential Taste provider/source receipt mismatch';end if;
      end loop;
      if exists(select 1 from supabase_migrations.schema_migrations m
        where regexp_replace(m.name,'^[0-9]{14}_','')=any(array[${historyNames.map(quote).join(',')}]::text[])
          and not exists(select 1 from jsonb_array_elements(${quote(JSON.stringify(receipts))}::jsonb) receipt
            where m.version=receipt->>'providerVersion' and m.name=receipt->>'providerName')) then
        raise exception 'Hosted sequential Taste named history is missing from the observed prefix receipts';end if;
      select functions into actual from (${sequentialTasteHostedFunctionSnapshotSql}) snapshot;
      if actual is distinct from ${quote(JSON.stringify(functions))}::jsonb then
        raise exception 'Hosted sequential Taste source/security/prefix drift';end if;
      select triggers into actual from (${sequentialTasteHostedTriggerSnapshotSql}) snapshot;
      if actual is distinct from ${quote(JSON.stringify(expectedTriggers))}::jsonb then
        raise exception 'Hosted sequential Taste lifecycle trigger drift';end if;
      if exists(select 1 from unnest(array['private.taste_sessions','private.taste_session_commands',
          'private.taste_challenges','private.taste_challenge_commands']::text[]) required(name)
          where to_regclass(required.name) is null)
        or exists(select 1 from unnest(array['private.sequential_taste_sessions',
          'private.sequential_taste_panels','private.sequential_taste_commands']::text[]) required(name)
          where (to_regclass(required.name) is not null) is distinct from ${installedForwards.length === 2})
        or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='private' and c.relkind='r' and c.relname in(
            'taste_sessions','taste_session_commands','taste_challenges','taste_challenge_commands',
            'sequential_taste_sessions','sequential_taste_panels','sequential_taste_commands')
          and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
            or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
            or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) then
        raise exception 'Hosted sequential Taste private storage boundary drift';end if;
    end;$sequential_preflight$;
    select jsonb_build_object('sequentialTasteHostedPreflight',${quote(state + ': exact post-v1 history, source, security and installed prefix')},
      'expectedProjectRef',${quote(target.projectRef)},'installedForwards',${installedForwards.length},
      'remainingForwards',${remaining.length},'bootstrapVariant',${quote(bootstrapVariant)},
      'prerequisiteState',${quote(state === 'BRIDGE_REQUIRED' ? 'EXACT_COMPATIBILITY_BRIDGE_REQUIRED' : 'CANONICAL_BODY_PRESENT')},
      'deploymentState','PREPARED_ONLY') snapshot;
    rollback;`;
}

// A retained active v1 question, stopped v1 training and active frozen challenge
// all precede the forward chain. Exact old receipts must remain readable afterward.
export async function sequentialTasteHostedUpgradeSql(files, { bootstrapVariant = 'CANONICAL' } = {}) {
  validateSequentialTasteHostedForwards(files);
  assert.ok(['CANONICAL','COMPACT_V1'].includes(bootstrapVariant), 'Unknown bootstrap rehearsal variant');
  const finalFunctions = await sequentialTasteHostedFunctionReference(sequentialTasteHostedManifest.forwards);
  const prerequisite = await loadSequentialTasteHostedPrerequisite();
  return `begin;
    do $disposable_only$ begin
      if exists(select 1 from auth.users) or exists(select 1 from public.profiles)
        or exists(select 1 from public.items) or exists(select 1 from public.events) then
        raise exception 'Sequential Taste rehearsal requires empty disposable state; never hosted';end if;
    end;$disposable_only$;
    ${bootstrapVariant === 'COMPACT_V1' ? `do $compact_fixture$ declare f record;begin
      select pg_get_functiondef(oid) definition,prosrc into strict f from pg_proc where oid='${bootstrapSignature}'::regprocedure;
      execute replace(f.definition,f.prosrc,${quote(sequentialTasteBootstrapCompactBody)});
    end;$compact_fixture$;` : ''}
    ${await personalTasteChallengeFixtureSql()}
    create temp table sequential_upgrade_receipts(actor uuid,endpoint text,request jsonb,result jsonb) on commit drop;
    set local role postgres;
    do $retained_receipts$ declare actor uuid;profile uuid;request jsonb;response jsonb;session uuid;begin
      for actor in select id from public.users where id::text like 'ab157000-%' order by id loop
        perform set_config('request.jwt.claim.sub',actor::text,true);
        select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
        request:=jsonb_build_object('operation','START','profileId',profile,'requestId',gen_random_uuid());
        response:=public.taste_session_v1(request);session:=(response->>'sessionId')::uuid;
        insert into pg_temp.sequential_upgrade_receipts values(actor,'SESSION',request,response);
        if actor='ab157000-0000-4000-8000-000000000002' then
          request:=jsonb_build_object('operation','ANSWER','profileId',profile,'sessionId',session,'requestId',gen_random_uuid(),
            'expectedRevision',response->'revision','questionIndex',jsonb_array_length(response->'presentations')-1,
            'answer',jsonb_build_object('kind','RATING','value',0));
          response:=public.taste_session_v1(request);
          insert into pg_temp.sequential_upgrade_receipts values(actor,'SESSION',request,response);
        end if;
        if actor='ab157000-0000-4000-8000-000000000001' then
          request:=jsonb_build_object('operation','START','profileId',profile,'sessionId',session,'requestId',gen_random_uuid());
          response:=public.taste_challenge_v1(request);
          if response->>'status'<>'ACTIVE' or jsonb_array_length(response->'items')<>6 then
            raise exception 'Expected retained real frozen v1 challenge';end if;
          insert into pg_temp.sequential_upgrade_receipts values(actor,'CHALLENGE',request,response);
        end if;
      end loop;
    end;$retained_receipts$;
    insert into auth.users(id,email,raw_user_meta_data) values
      ('ab157000-0000-4000-8000-000000000003','completed-setup@example.invalid','{"kajo_nickname":"Completed setup"}');
    create temp table sequential_upgrade_existing_completion on commit drop as
      select id profile from public.profiles where owner_user_id='ab157000-0000-4000-8000-000000000003' and profile_type='PERSONAL';
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at)
      select gen_random_uuid(),'ab157000-0000-4000-8000-000000000003',p.profile,i.id,i.item_type,'ITEM_RATED','{"rating":8}',now()-interval '1 hour'
      from pg_temp.sequential_upgrade_existing_completion p cross join lateral(select * from public.items order by id limit 6) i;
    do $existing_setup$ begin
      perform set_config('request.jwt.claim.sub','ab157000-0000-4000-8000-000000000003',true);
      if (public.get_profile_bootstrap_status_v1((select profile from pg_temp.sequential_upgrade_existing_completion))->>'needsCalibration')::boolean then
        raise exception 'Expected existing completion without a v1 session';end if;
    end;$existing_setup$;
    create temp table sequential_upgrade_rows(identity text,columns text[],digest text) on commit drop;
    create temp table sequential_upgrade_functions on commit drop as
      select p.oid,pg_get_function_identity_arguments(p.oid) arguments,to_jsonb(p)-'prosrc' metadata,p.prosrc,
        p.proname,format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) signature
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private') and p.prokind='f';
    create temp table sequential_upgrade_history(digest text) on commit drop;
    do $snapshot$ declare r record;body text;begin
      for r in select c.oid,format('%I.%I',n.nspname,c.relname) identity,
        array(select a.attname::text from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped order by a.attnum) columns
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
        and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from %s x',r.identity) into body;
        insert into pg_temp.sequential_upgrade_rows values(r.identity,r.columns,body);
      end loop;
      if to_regclass('supabase_migrations.schema_migrations') is not null then
        execute 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from supabase_migrations.schema_migrations x' into body;
        insert into pg_temp.sequential_upgrade_history values(body);
      end if;
    end;$snapshot$;
    ${prerequisite.sql}
    ${files.map(file => file.sql).join('\n')}
    do $preserve$ declare r record;body text;actual record;expected text;response jsonb;begin
      for r in select * from pg_temp.sequential_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(j.body order by j.body::text),''[]''::jsonb)::text)
          from %s x cross join lateral(select jsonb_object_agg(key,value) body from jsonb_each(to_jsonb(x)) where key=any($1)) j',r.identity)
          into body using r.columns;
        if body is distinct from r.digest then raise exception 'Sequential upgrade changed old rows: %',r.identity;end if;
      end loop;
      for r in select * from pg_temp.sequential_upgrade_functions loop
        select to_jsonb(p)-'prosrc' metadata,p.prosrc into actual from pg_proc p where p.oid=r.oid;
        if not found or actual.metadata is distinct from r.metadata then
          raise exception 'Sequential upgrade changed old function identity/security: %',r.proname;end if;
        if actual.prosrc is distinct from r.prosrc then
          select value->>'definitionMd5' into expected from jsonb_array_elements(${quote(JSON.stringify(finalFunctions))}::jsonb)
            where to_regprocedure(value->>'signature')=r.oid;
          if expected is null or md5(pg_get_functiondef(r.oid))<>expected then
            raise exception 'Sequential upgrade changed an unreviewed old body: %',r.proname;end if;
        end if;
      end loop;
      if exists(select 1 from pg_temp.sequential_upgrade_history) then
        execute 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from supabase_migrations.schema_migrations x' into body;
        if body is distinct from(select digest from pg_temp.sequential_upgrade_history) then
          raise exception 'Sequential rehearsal changed CLI migration history';end if;
      end if;
      for r in select * from pg_temp.sequential_upgrade_receipts loop
        perform set_config('request.jwt.claim.sub',r.actor::text,true);
        response:=case r.endpoint when 'SESSION' then public.taste_session_v1(r.request) else public.taste_challenge_v1(r.request) end;
        if response is distinct from r.result then raise exception 'Retained v1 exact receipt changed';end if;
        response:=public.taste_session_v2(jsonb_build_object('operation','START','profileId',r.request->'profileId','requestId',gen_random_uuid()));
        if response->>'status'<>'LEGACY_V1_PRESERVED' then raise exception 'Sequential START did not preserve v1';end if;
      end loop;
      perform set_config('request.jwt.claim.sub','ab157000-0000-4000-8000-000000000003',true);
      response:=public.taste_session_v2(jsonb_build_object('operation','START',
        'profileId',(select profile from pg_temp.sequential_upgrade_existing_completion),'requestId',gen_random_uuid()));
      if response->>'status'<>'EXISTING_COMPLETION' then raise exception 'Sequential START lost existing completion';end if;
      if exists(select 1 from private.sequential_taste_sessions) then raise exception 'V1 resume allocated v2 state';end if;
      if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
        and c.relname in('sequential_taste_sessions','sequential_taste_panels','sequential_taste_commands')
        and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
          or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
          or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) then
        raise exception 'Sequential upgrade exposed private storage';end if;
      if has_function_privilege('anon','public.taste_session_v2(jsonb)','EXECUTE')
        or has_function_privilege('service_role','public.taste_session_v2(jsonb)','EXECUTE')
        or not has_function_privilege('authenticated','public.taste_session_v2(jsonb)','EXECUTE')
        or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
          and p.prokind='f' and p.oid not in(select oid from pg_temp.sequential_upgrade_functions)
          and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')
            or (p.proname<>'taste_session_v2' and has_function_privilege('authenticated',p.oid,'EXECUTE')))) then
        raise exception 'Sequential upgrade exposed an RPC/private helper';end if;
    end;$preserve$;
    select jsonb_build_object('sequentialTasteHostedUpgrade',
      'PASS: exact two-forward chain; retained v1 question, completion, frozen challenge and receipts; old rows, function security and history preserved') snapshot;
    rollback;`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await loadSequentialTasteHostedForwards();
    const checkpoint = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : null;
    console.log(JSON.stringify({ ...sequentialTasteHostedManifest,
      ...(checkpoint ? { remainingForwards: remainingSequentialTasteHostedForwards(checkpoint.installedForwards),
        preflightSql: await sequentialTasteHostedPreflightSql(checkpoint) } : { preflightState: 'PRIVATE_CHECKPOINT_REQUIRED' }),
      deploymentState: 'PREPARED_ONLY',
      procedure: 'Verify project selection against expectedProjectRef separately. Refresh exact history/bodies/security after each acknowledged operation or ambiguous reply. Never replay an installed forward. Apply is a separately authorized operator action.' }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
