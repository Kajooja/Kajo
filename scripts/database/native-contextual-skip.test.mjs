import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {buildFreshInstallation} from './fresh-installation.mjs';
import {personalTasteSessionFixtureSql} from './personal-taste-session.mjs';
const owner='ab157000-0000-4000-8000-000000000001',other='ab157000-0000-4000-8000-000000000002';

test('native neutral Discovery commands / actual committed delivery and current full schema',async t=>{
 const db=new PGlite();const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
 const files=(await buildFreshInstallation()).files;
 const nativeIndex=files.findIndex(f=>f.name.endsWith('_native_contextual_skip.sql'));assert.ok(nativeIndex>0);
 for(const f of files.slice(0,nativeIndex))await db.exec(`begin;${f.sql}commit;`);
 await t.test('unknown old policy drift aborts the additive forward atomically',async()=>{
  await db.exec('begin');
  try{
   const source=await one("select prosrc,pg_get_functiondef(oid) definition from pg_proc where oid='private.resurfacing_policy_decision_v1(uuid,uuid,jsonb,timestamptz)'::regprocedure");
   await db.exec(source.definition.replace(source.prosrc,source.prosrc+'\n-- unknown source drift\n'));
   await assert.rejects(db.exec(files[nativeIndex].sql),/source drift/);
  }finally{await db.exec('rollback');}
  assert.equal((await one("select to_regclass('private.contextual_skip_commands') value")).value,null);
 });
 await t.test('populated forward preserves every old row and function identity/security metadata',async()=>{
  await db.exec(await personalTasteSessionFixtureSql());
  const tables=(await db.query("select format('%I.%I',n.nspname,c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('auth','public','private') order by 1")).rows;
  const rows=new Map();for(const {name} of tables)rows.set(name,(await db.query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`)).rows);
  const functions=(await db.query("select oid,to_jsonb(p)-'prosrc' metadata,prosrc from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace) order by oid")).rows;
  await db.exec(`begin;${files[nativeIndex].sql}commit;`);
  for(const {name} of tables)assert.deepEqual((await db.query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`)).rows,rows.get(name),name);
  const changed=['capture_personal_working_state_v1','withdraw_sequential_event_v2','resurfacing_policy_decision_v1','erase_prediction_sources_v1'];
  for(const f of functions){const after=await one("select to_jsonb(p)-'prosrc' metadata,prosrc from pg_proc p where oid=$1",[f.oid]);assert.deepEqual(after.metadata,f.metadata,f.metadata.proname);if(!changed.includes(f.metadata.proname))assert.equal(after.prosrc,f.prosrc,f.metadata.proname);}
  await db.exec("delete from auth.users where id::text like 'ab157000-%';delete from private.item_sources where item_id::text like 'ab157000-%';delete from public.items where id::text like 'ab157000-%';");
 });
 for(const f of files.slice(nativeIndex+1))await db.exec(`begin;${f.sql}commit;`);
 const rpc=async(name,request,{actor=owner,role='authenticated'}={})=>{
  await db.exec('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await db.exec(`set local role ${role}`);
   const result=(await one(`select public.${name}($1) value`,[request])).value;await db.exec('commit');return result;
  }catch(e){await db.exec('rollback');throw e;}
 };
 const commit=c=>rpc('commit_discovery_contextual_skip_v1',c);
 const sourceRead=c=>rpc('discovery_contextual_skip_source_v1',{actorUserId:c.actorUserId,profileId:c.profileId,itemId:c.itemId,origin:c.origin});
 const page=(profileId,sessionId=randomUUID(),extra={})=>rpc('rank_items_page_v1',{version:3,requestId:randomUUID(),profileId,sessionId,
   discoveryMode:'FOR_YOU',itemType:'BOOK',limit:5,context:{},cursor:null,...extra});
 const expose=async(profileId,{sessionId=randomUUID(),targetItem=null}={})=>{
  const p=await page(profileId,sessionId);const itemId=targetItem??p.items[0]?.item_id??p.items[0]?.itemId;
  assert.ok(itemId,JSON.stringify(p));const eventId=randomUUID();
  await db.query("insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context) values($1,$2,$3,clock_timestamp()-interval '1 minute','{}') on conflict do nothing",[sessionId,owner,profileId]);
  await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode)
    values($1,$2,$3,$4,'BOOK','ITEM_IMPRESSION',clock_timestamp(),$5,$6,'FOR_YOU')`,[eventId,owner,profileId,itemId,sessionId,p.predictionId]);
  return {page:p,command:{version:'kajo-contextual-skip-v1',kind:'CONTEXTUAL_SKIP',actionId:randomUUID(),actorUserId:owner,profileId,itemId,
    occurredAt:String(BigInt(Date.now())*1000n),contextRef:null,reversesActionId:null,
    origin:{surface:'DISCOVERY',sessionId,predictionId:p.predictionId,deliveryRequestId:p.requestId,impressionEventId:eventId}}};
 };
 const decision=(c,at='clock_timestamp()',hard=true)=>one(`select private.contextual_skip_decision_v1($1,$2,${at},$3) value`,[c.profileId,c.itemId,hard]).then(r=>r.value);
 const sub=(name,fn)=>t.test(name,async()=>{
  await db.exec(await personalTasteSessionFixtureSql());const profile=(await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'",[owner])).id;
  try{await fn(profile);}finally{await db.exec(`rollback;delete from public.item_interactions where actor_user_id::text like 'ab157000-%';delete from auth.users where id::text like 'ab157000-%';
    delete from private.item_sources where item_id::text like 'ab157000-%';delete from public.items where id::text like 'ab157000-%';`);}
 });
 try{
  await sub('actual page/impression source, exact retry and neutral cross-session admission',async profile=>{
   const {command:c,page:p}=await expose(profile);assert.equal((await sourceRead(c)).acceptsNewSkip,true);
   const receipt=await commit(c);assert.equal(receipt.semantic,'CONTEXTUAL_SKIP');assert.match(receipt.acceptedAt,/^[0-9]+$/);
   assert.deepEqual(await commit(c),receipt);assert.equal((await decision(c)).reason,'SKIP_COOLDOWN');
   const q=await page(profile);assert.ok(q.items.every(i=>(i.item_id??i.itemId)!==c.itemId));
   const frozen=await rpc('rank_items_page_v1',{version:3,requestId:p.requestId,profileId:profile,sessionId:c.origin.sessionId,
     discoveryMode:'FOR_YOU',itemType:'BOOK',limit:5,context:{},cursor:null});assert.deepEqual(frozen,p);
   assert.equal((await one('select count(*)::int count from public.item_interactions where profile_id=$1',[profile])).count,0);
   assert.equal((await one('select count(*)::int count from private.profile_bootstrap_evidence where profile_id=$1',[profile])).count,0);
   assert.equal((await one('select count(*)::int count from private.item_action_heads where profile_id=$1',[profile])).count,0);
   const e=await one('select event_type,private.event_evidence_weight_v1(event_type,properties) weight,private.outcome_priority_v1(event_type) priority,private.outcome_reward_v1(event_type,properties) reward from public.events where id=$1',[c.actionId]);
   assert.deepEqual(e,{event_type:'ITEM_CONTEXTUALLY_SKIPPED',weight:0,priority:0,reward:0});
  });
  await sub('strict commands, identity/origin conflicts and client clock never backdates cooldown',async profile=>{
   const {command:c}=await expose(profile);c.occurredAt='0';const r=await commit(c);assert.equal((await decision(c)).reason,'SKIP_COOLDOWN');
   await assert.rejects(commit({...c,occurredAt:'1'}),/IDENTITY_CONFLICT/);
   await assert.rejects(commit({...c,actionId:randomUUID()}),/ORIGIN_CONFLICT/);
   await assert.rejects(commit({...c,contextRef:randomUUID()}),/INVALID_COMMAND/);
   await assert.rejects(commit({...c,extra:true}),/INVALID_COMMAND/);
   await assert.rejects(commit({...c,actorUserId:other}),/ACCESS_DENIED/);
   assert.deepEqual(await commit({...c,origin:{...c.origin}}),r);
  });
  await sub('same-actor exact withdrawal, once, leaves ratings and earlier other opportunities independent',async profile=>{
   const {command:c}=await expose(profile);await commit(c);
   const undo={...c,kind:'WITHDRAW_CONTEXTUAL_SKIP',actionId:randomUUID(),reversesActionId:c.actionId};
   const r=await commit(undo);assert.deepEqual(await commit(undo),r);assert.equal((await decision(c)).reason,'NO_ACTIVE_SKIP');
   await assert.rejects(commit({...undo,actionId:randomUUID()}),/WITHDRAWAL_CONFLICT/);
   await assert.rejects(commit({...c,actionId:randomUUID()}),/ORIGIN_CONFLICT/);
  });
  await sub('receipt acceptance microseconds and exact 24-hour boundary',async profile=>{
   const {command:c}=await expose(profile);const r=await commit(c);
   const exact=`private.contextual_skip_instant_v1('${r.acceptedAt}')+interval '24 hours'`;
   assert.equal((await decision(c,exact+"-interval '1 microsecond'")).reason,'SKIP_COOLDOWN');
   assert.equal((await decision(c,exact)).reason,'SKIP_COOLDOWN_ELAPSED');
   assert.equal((await decision(c,exact,false)).reason,'OTHER_POLICY_SUPPRESSED');
   for(const micros of ['1','999999','1000001','253402300799999999']){
    assert.equal((await one("select (extract(epoch from private.contextual_skip_instant_v1($1))*1000000)::numeric(18,0)::text value",[micros])).value,micros);
   }
  });
  await sub('permanent auth and current membership are rechecked including cached replay',async profile=>{
   const {command:c}=await expose(profile);await commit(c);
   await db.query('update auth.users set is_anonymous=true where id=$1',[owner]);await assert.rejects(commit(c),/ACCESS_DENIED/);
   await db.query('update auth.users set is_anonymous=false where id=$1',[owner]);
   await assert.rejects(rpc('commit_discovery_contextual_skip_v1',c,{role:'anon'}),/permission denied/);
   await assert.rejects(rpc('commit_discovery_contextual_skip_v1',c,{role:'service_role'}),/permission denied/);
   await db.query('delete from public.profile_members where profile_id=$1 and user_id=$2',[profile,owner]);await assert.rejects(commit(c),/ACCESS_DENIED/);
  });
  await sub('wrong/improvised delivery or impression cannot become a native skip',async profile=>{
   const {command:c}=await expose(profile);
   await assert.rejects(commit({...c,origin:{...c.origin,impressionEventId:randomUUID()}}),/SOURCE_WITHDRAWN/);
   await assert.rejects(commit({...c,origin:{...c.origin,deliveryRequestId:randomUUID()}}),/SOURCE_WITHDRAWN/);
   await assert.rejects(commit({...c,origin:{...c.origin,predictionId:randomUUID()}}),/SOURCE_WITHDRAWN/);
  });
  await sub('acknowledged positive action closes origin while exact skip retry and withdrawal remain',async profile=>{
   const {command:c}=await expose(profile);const r=await commit(c);
   await db.query("insert into public.item_interactions(profile_id,item_id,actor_user_id,saved) values($1,$2,$3,true)",[profile,c.itemId,owner]);
   assert.deepEqual(await commit(c),r);assert.equal((await sourceRead(c)).acceptsNewSkip,false);
   assert.equal((await commit({...c,kind:'WITHDRAW_CONTEXTUAL_SKIP',actionId:randomUUID(),reversesActionId:c.actionId})).semantic,'WITHDRAW_CONTEXTUAL_SKIP');
  });
  await sub('source erasure tombstones full origin and destroys Events, receipt payload and future retry',async profile=>{
   const {command:c}=await expose(profile);await commit(c);const undo={...c,kind:'WITHDRAW_CONTEXTUAL_SKIP',actionId:randomUUID(),reversesActionId:c.actionId};await commit(undo);
   await db.query('delete from public.events where id=$1',[c.origin.impressionEventId]);
   const rows=(await db.query('select item_id,command,result,origin,source_prediction_id,source_impression_id,reverses_action_id,erased_at is not null erased from private.contextual_skip_commands where profile_id=$1',[profile])).rows;
   assert.equal(rows.length,2);for(const row of rows)assert.deepEqual(row,{item_id:null,command:null,result:null,origin:null,source_prediction_id:null,source_impression_id:null,reverses_action_id:null,erased:true});
   assert.equal((await one('select count(*)::int count from public.events where id=any($1::uuid[])',[[c.actionId,undo.actionId]])).count,0);
   await assert.rejects(commit(c),/SOURCE_WITHDRAWN/);await assert.rejects(commit(undo),/SOURCE_WITHDRAWN/);
   assert.equal((await decision(c)).reason,'NO_ACTIVE_SKIP');
  });
  await sub('neutral Events are excluded before Working prefix and feature budgets',async profile=>{
   const {command:c}=await expose(profile);
   await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id)
    select gen_random_uuid(),$1,$2,$3,'BOOK','ITEM_OPENED',clock_timestamp(),$4 from generate_series(1,127)`,[owner,profile,c.itemId,c.origin.sessionId]);
   const capture=async()=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    return (await one('select private.capture_personal_working_state_v1($1,$2,$3,clock_timestamp()) value',[owner,profile,c.origin.sessionId])).value;};
   const before=await capture();assert.equal(before.prefixComplete,true);assert.equal(before.rawEvents.length,128);
   await commit(c);const after=await capture();assert.equal(after.prefixComplete,true);assert.equal(after.rawEvents.length,128);
   assert.equal(after.status,before.status);assert.deepEqual(after.rawEvents,before.rawEvents);
   assert.ok(after.rawEvents.every(e=>!e.event_type.startsWith('ITEM_CONTEXTUAL')));
  });
  await sub('a backdated impression written in a released SAVEPOINT is not committed source',async profile=>{
   const {command:c}=await expose(profile);const impression=randomUUID();c.origin={...c.origin,impressionEventId:impression};
   await db.exec('begin;savepoint source_write;');
   await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,created_at)
    values($1,$2,$3,$4,'BOOK','ITEM_IMPRESSION',clock_timestamp(),$5,$6,'FOR_YOU','2000-01-01')`,
    [impression,owner,profile,c.itemId,c.origin.sessionId,c.origin.predictionId]);
   await db.exec(`release savepoint source_write;savepoint attempt;set local role authenticated;set local request.jwt.claim.sub='${owner}'`);
   await assert.rejects(db.query('select public.commit_discovery_contextual_skip_v1($1)',[c]),/SOURCE_NOT_COMMITTED/);
   await db.exec('rollback to savepoint attempt;commit;');
   assert.equal((await commit(c)).actionId,c.actionId);
  });
  await sub('canonical Event admission survives a real SQL subtransaction without leaving reusable permissions',async profile=>{
   const {command:c}=await expose(profile);
   await db.exec(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';
    do $probe$ begin begin perform public.commit_discovery_contextual_skip_v1('${JSON.stringify(c).replaceAll("'","''")}'::jsonb);
      exception when others then raise;end;end;$probe$;commit;`);
   assert.equal((await one('select count(*)::int count from private.contextual_skip_event_permissions')).count,0);
   assert.equal((await decision(c)).reason,'SKIP_COOLDOWN');assert.equal((await commit(c)).actionId,c.actionId);
   const undo={...c,kind:'WITHDRAW_CONTEXTUAL_SKIP',actionId:randomUUID(),reversesActionId:c.actionId};
   await db.exec(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';savepoint rolled_back_command;`);
   await db.query('select public.commit_discovery_contextual_skip_v1($1)',[undo]);
   await db.exec('rollback to savepoint rolled_back_command;commit;');
   assert.equal((await one('select count(*)::int count from private.contextual_skip_event_permissions')).count,0);
   assert.equal((await one('select count(*)::int count from private.contextual_skip_commands where action_id=$1',[undo.actionId])).count,0);
   assert.equal((await decision(c)).reason,'SKIP_COOLDOWN');
  });
  await sub('generic authenticated and BYPASSRLS Event insertion cannot impersonate the writer',async profile=>{
   const {command:c}=await expose(profile);
   const sql=`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode)
      values('${c.actionId}','${owner}','${profile}','${c.itemId}','BOOK','ITEM_CONTEXTUALLY_SKIPPED',clock_timestamp(),'${c.origin.sessionId}','${c.origin.predictionId}','FOR_YOU')`;
   for(const role of ['authenticated','service_role']){
    if(role==='service_role')await db.exec('grant insert on public.events to service_role');
    await db.exec(`begin;set local role ${role};set local request.jwt.claim.sub='${owner}'`);
    try{await assert.rejects(db.exec(sql),/requires canonical command|row-level security/);}finally{await db.exec('rollback');}
   }
   await commit(c);await assert.rejects(db.query("update public.events set context='{}' where id=$1",[c.actionId]),/immutable/);
  });
 }finally{await db.close();}
});
