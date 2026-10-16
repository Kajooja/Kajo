import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const actor='ab157000-0000-4000-8000-000000000001',other='ab157000-0000-4000-8000-000000000002';
const version='kajo-contextual-skip-v1',policyVersion='contextual-skip-cooldown-v1';

test('native Taste contextual skip / preserved history and current schema',async t=>{
  const db=new PGlite(),query=async(sql,args=[])=>(await db.query(sql,args)).rows;
  const one=async(sql,args=[])=>(await query(sql,args))[0];
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const files=(await buildFreshInstallation()).files,index=files.findIndex(f=>f.name.endsWith('_taste_contextual_skip.sql'));
  assert.ok(index>0);
  for(const f of files.slice(0,index))await db.exec(`begin;${f.sql}commit;`);
  const rpc=async(name,request,{user=actor,role='authenticated'}={})=>{
    await db.exec('begin;');
    try{
      await query("select set_config('request.jwt.claim.sub',$1,true)",[user??'']);
      await db.exec(`set local role ${role};`);
      const result=(await one(`select public.${name}($1) value`,[request])).value;
      await db.exec('commit;');return result;
    }catch(error){await db.exec('rollback;');throw error;}
  };
  const taste=(r,options)=>rpc('taste_session_v2',r,options);
  const commit=(r,options)=>rpc('commit_taste_contextual_skip_v1',r,options);
  const cmd=(s,operation,extra={})=>({operation,profileId:s.profileId,sessionId:s.sessionId,
    requestId:randomUUID(),expectedRevision:s.revision,...extra});
  const resume=s=>taste({operation:'RESUME',profileId:s.profileId,sessionId:s.sessionId});
  const next=async s=>taste(cmd(await resume(s),'NEXT'));
  const skip=q=>({version,kind:'CONTEXTUAL_SKIP',actionId:randomUUID(),actorUserId:actor,
    profileId:q.profileId,itemId:q.currentItem.id,occurredAt:String(BigInt(Date.now())*1000n),
    origin:q.contextualSkip.origin,contextRef:null,reversesActionId:null});
  const withdraw=original=>({...original,kind:'WITHDRAW_CONTEXTUAL_SKIP',actionId:randomUUID(),
    occurredAt:String(BigInt(Date.now())*1000n),reversesActionId:original.actionId});
  const state=id=>one('select * from private.sequential_taste_sessions where id=$1',[id]);
  const cleanup=()=>db.exec(`delete from public.item_interactions where actor_user_id::text like 'ab157000-%';
    delete from public.events where actor_user_id::text like 'ab157000-%';
    delete from auth.users where id::text like 'ab157000-%';
    delete from private.item_sources where item_id::text like 'ab157000-%';delete from public.items where id::text like 'ab157000-%';`);
  const fixture=async()=>{
    await db.exec(await personalTasteSessionFixtureSql());
    const profileId=(await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'",[actor])).id;
    return taste({operation:'START',profileId,requestId:randomUUID()});
  };
  const sub=(name,fn)=>t.test(name,async()=>{
    const s=await fixture();try{await fn(s);}finally{await db.exec('rollback;');await cleanup();}
  });
  try{
    await t.test('additive forward preserves populated v1/v2 rows, first measurements, replies and function metadata',async()=>{
      const s=await fixture(),offer=cmd(s,'NEXT'),q=await taste(offer);
      const answer=cmd(q,'ANSWER',{questionId:q.questionId,answer:{kind:'RATING',value:10}}),accepted=await taste(answer);
      const legacyProfile=(await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'",[other])).id;
      const legacyStart={operation:'START',profileId:legacyProfile,requestId:randomUUID()};
      const legacy=await rpc('taste_session_v1',legacyStart,{user:other});
      const legacyAnswer={operation:'ANSWER',profileId:legacyProfile,sessionId:legacy.sessionId,requestId:randomUUID(),
        expectedRevision:legacy.revision,questionIndex:0,answer:{kind:'RATING',value:0}};
      const legacyAccepted=await rpc('taste_session_v1',legacyAnswer,{user:other});
      const tables=await query("select format('%I.%I',n.nspname,c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('auth','public','private') order by 1");
      const snapshots=await Promise.all(tables.map(async({name})=>[name,await query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`)]));
      const functions=await query("select oid,to_jsonb(p) body from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace) order by oid");
      const patches=JSON.parse(files[index].sql.match(/\$patches\$([\s\S]*?)\$patches\$/)[1]);
      await db.exec(`begin;${files[index].sql}commit;`);
      for(const [name,rows] of snapshots)assert.deepEqual(await query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`),rows,name);
      for(const f of functions){
        const patch=patches.find(p=>f.body.proname===p.signature.split('.')[1].split('(')[0]);
        const expected={...f.body};if(patch)for(const [before,after] of patch.replacements)expected.prosrc=expected.prosrc.replace(before,after);
        assert.deepEqual((await one('select to_jsonb(p) body from pg_proc p where oid=$1',[f.oid])).body,expected,f.body.proname);
      }
      assert.deepEqual(await taste(offer),q);assert.deepEqual(await taste(answer),accepted);
      assert.deepEqual(await rpc('taste_session_v1',legacyStart,{user:other}),legacy);
      assert.deepEqual(await rpc('taste_session_v1',legacyAnswer,{user:other}),legacyAccepted);
      assert.equal(Object.hasOwn(q,'contextualSkip'),false);
      const fresh=await next(accepted);assert.equal(fresh.contextualSkip.version,version);
      await cleanup();
    });
    for(const f of files.slice(index+1))await db.exec(`begin;${f.sql}commit;`);
    await sub('exact native command is neutral, advances through a separately committed NEXT and survives pause/restart',async s=>{
      let q=await next(s);const command=skip(q),receipt=await commit(command);
      assert.deepEqual(receipt,{version,actionId:command.actionId,actorUserId:actor,profileId:q.profileId,
        itemId:q.currentItem.id,acceptedAt:receipt.acceptedAt,policyVersion,evidence:'PRIVATE_TASTE_RESPONSE',
        semantic:'CONTEXTUAL_SKIP',reversesActionId:null});
      assert.match(receipt.acceptedAt,/^[1-9][0-9]+$/);
      assert.deepEqual(await commit(command),receipt);
      const decisions=await query(`select boundary,private.contextual_skip_decision_v1(profile_id,item_id,
        accepted_at+offset_time,true) decision from private.contextual_skip_commands,
        (values('before',interval '24 hours'-interval '1 microsecond'),('at',interval '24 hours')) b(boundary,offset_time)
        where action_id=$1 order by boundary`,[command.actionId]);
      assert.equal(decisions.find(d=>d.boundary==='before').decision.reason,'SKIP_COOLDOWN');
      assert.equal(decisions.find(d=>d.boundary==='before').decision.eligible,false);
      assert.equal(decisions.find(d=>d.boundary==='at').decision.reason,'SKIP_COOLDOWN_ELAPSED');
      assert.equal(decisions.find(d=>d.boundary==='at').decision.eligible,true);
      await assert.rejects(commit({...command,occurredAt:'1'}),{code:'22023'});
      const row=await state(s.sessionId),response=row.presentations[0].responses[0];
      assert.deepEqual(response.answer,{kind:'CONTEXTUAL_SKIP'});assert.equal(Object.hasOwn(response,'measurement'),false);
      assert.equal((await one('select count(*)::int n from public.events where profile_id=$1',[s.profileId])).n,0);
      assert.equal((await one('select count(*)::int n from public.item_interactions where profile_id=$1',[s.profileId])).n,0);
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence where profile_id=$1',[s.profileId])).n,0);
      let current=await resume(s);assert.equal(current.status,'NEEDS_NEXT');assert.equal(current.contextualSkip,null);
      assert.equal(current.readiness.status,'INSUFFICIENT');assert.equal(current.evaluation.accuracyPercent,null);
      current=await taste(cmd(current,'PAUSE'));assert.equal((await resume(s)).status,'PAUSED');
      assert.deepEqual(await commit(command),receipt);
      current=await taste(cmd(current,'CONTINUE'));q=await next(current);
      assert.notEqual(q.currentItem.id,command.itemId);
      const panel=await one('select prefix from private.sequential_taste_panels where id=$1',[q.contextualSkip.origin.panelId]);
      assert.deepEqual(panel.prefix.map(p=>p.responseId),[command.actionId]);
    });
    await sub('withdrawal changes only its neutral source; legacy corrections cannot manufacture labels',async s=>{
      const q=await next(s),command=skip(q);await commit(command);
      for(const kind of ['RATING','UNKNOWN','NOT_INTERESTED','WITHDRAWN']){
        const current=await resume(s),answer=kind==='RATING'?{kind,value:10}:{kind};
        await assert.rejects(taste(cmd(current,'CORRECT',{questionId:q.questionId,answer})),{code:'22023'});
      }
      const withdrawal=withdraw(command),receipt=await commit(withdrawal);assert.deepEqual(await commit(withdrawal),receipt);
      assert.equal((await one('select private.contextual_skip_decision_v1($1,$2,clock_timestamp(),true) decision',
        [command.profileId,command.itemId])).decision.reason,'NO_ACTIVE_SKIP');
      await assert.rejects(commit(withdraw(command)),{code:'KJ003'});
      await assert.rejects(commit({...command,actionId:randomUUID()}),{code:'KJ002'});
      const row=await state(s.sessionId);assert.deepEqual(row.presentations[0].responses.map(r=>r.answer.kind),['CONTEXTUAL_SKIP','WITHDRAW_CONTEXTUAL_SKIP']);
      const fresh=await next(s),panel=await one('select prefix from private.sequential_taste_panels where id=$1',[fresh.contextualSkip.origin.panelId]);
      assert.deepEqual(panel.prefix,[]);assert.notEqual(fresh.currentItem.id,command.itemId);
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence where profile_id=$1',[s.profileId])).n,0);
    });
    await sub('source erasure redacts neutral copies and tombstones beat both cached and fresh identities',async s=>{
      const q=await next(s),command=skip(q);await commit(command);
      const later=await next(s),laterCommand=skip(later);await commit(laterCommand);
      await commit(withdraw(command));
      const tombstone=await one('select * from private.contextual_skip_commands where action_id=$1',[laterCommand.actionId]);
      assert.ok(tombstone.erased_at);for(const field of ['command','result','origin','item_id','source_prediction_id','source_impression_id'])assert.equal(tombstone[field],null,field);
      await assert.rejects(commit(laterCommand),{code:'KJ002'});
      await query("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1)",[q.contextualSkip.origin.panelId]);
      await assert.rejects(commit(command),{code:'KJ002'});
      const current=await resume(s);assert.equal((await taste(cmd(current,'REMOVE'))).status,'REMOVED');
      assert.equal((await one('select count(*)::int n from private.contextual_skip_commands where profile_id=$1 and erased_at is null',[s.profileId])).n,0);
      await assert.rejects(commit({...command,actionId:randomUUID()}),{code:'KJ002'});
      assert.deepEqual((await state(s.sessionId)).presentations,[]);
    });
    await sub('panel source redaction uses the panel identity independently from its Prediction identity',async s=>{
      const q=await next(s),panelId=randomUUID(),questionId=randomUUID();
      const row=await state(s.sessionId),question={...row.presentations[0],id:questionId,index:1,poolId:panelId};
      // Trusted internal fixture: the schema permits a separately identified
      // panel pointing to a canonical Prediction. Never equate these UUIDs.
      await query(`insert into private.sequential_taste_panels(id,session_id,prediction_id,prefix_revision,prefix,frozen,captured_at,captured_transaction)
        select $1,session_id,prediction_id,prefix_revision,prefix,frozen,captured_at,captured_transaction
        from private.sequential_taste_panels where id=$2`,[panelId,q.contextualSkip.origin.panelId]);
      await query('update private.sequential_taste_sessions set presentations=presentations||jsonb_build_array($1::jsonb) where id=$2',[question,s.sessionId]);
      const fresh=await resume(s),command=skip(fresh);await commit(command);
      const record=await one('select source_prediction_id from private.contextual_skip_commands where action_id=$1',[command.actionId]);
      assert.notEqual(record.source_prediction_id,panelId);
      await query('update private.sequential_taste_panels set invalidated=true where id=$1',[panelId]);
      const erased=await one('select erased_at,command,result from private.contextual_skip_commands where action_id=$1',[command.actionId]);
      assert.ok(erased.erased_at);assert.equal(erased.command,null);assert.equal(erased.result,null);
      await assert.rejects(commit(command),{code:'KJ002'});
    });
    await sub('native rating Undo preserves its receipt and state while withdrawing dependent Taste skip sources',async s=>{
      const q=await next(s),command=skip(q);await commit(command);
      const occurredAt=new Date().toISOString(),rating={version:1,kind:'SET_RATING',actionId:randomUUID(),
        actorUserId:actor,profileId:s.profileId,itemId:command.itemId,occurredAt,rating:10,
        session:{sessionId:randomUUID(),startedAt:occurredAt,context:{}},discoveryMode:null,predictionId:null};
      assert.equal((await rpc('commit_item_action_v1',rating)).interaction.rating,10);
      const undo={...rating,kind:'UNDO',actionId:randomUUID(),reversesActionId:rating.actionId};delete undo.rating;
      const receipt=await rpc('commit_item_action_v1',undo);
      assert.deepEqual(receipt.interaction,{interest:null,saved:false,consumed:false,rating:null,notInterested:false});
      assert.deepEqual(await rpc('commit_item_action_v1',undo),receipt);
      assert.equal((await one("select count(*)::int n from public.events where profile_id=$1 and event_type='ITEM_INTERACTION_UNDONE'",[s.profileId])).n,1);
      assert.ok((await one('select erased_at from private.contextual_skip_commands where action_id=$1',[command.actionId])).erased_at);
      await assert.rejects(commit(command),{code:'KJ002'});
    });
    await sub('own Personal authority and exact committed question/panel/prefix are mandatory',async s=>{
      const q=await next(s),command=skip(q);
      for(const role of ['anon','service_role'])await assert.rejects(commit(command,{role}),{code:'42501'});
      await assert.rejects(commit(command,{user:other}),{code:'42501'});
      await assert.rejects(commit(command,{user:null}),{code:'42501'});
      await query('update auth.users set is_anonymous=true where id=$1',[actor]);
      await assert.rejects(commit(command),{code:'42501'});
      await query('update auth.users set is_anonymous=false where id=$1',[actor]);
      for(const changed of [{questionId:randomUUID()},{panelId:randomUUID()},{prefixRevision:255}])
        await assert.rejects(commit({...command,origin:{...command.origin,...changed}}),{code:'22023'});
      await assert.rejects(commit({...command,contextRef:randomUUID()}),{code:'22023'});
      await assert.rejects(commit({...command,occurredAt:'253402300799999999'}),{code:'22023'});
      await db.exec('begin;');
      try{
        await query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await db.exec('set local role authenticated;');
        await one('select public.commit_taste_contextual_skip_v1($1)',[command]);
        await assert.rejects(one('select public.taste_session_v2($1)',[cmd({...q,revision:q.revision+1},'NEXT')]),{code:'40001'});
      }finally{await db.exec('rollback;');}
      const accepted=await commit(command);assert.equal(accepted.semantic,'CONTEXTUAL_SKIP');
      await query('update public.items set discoverable=false where id=$1',[command.itemId]);
      await assert.rejects(commit(command),{code:'KJ002'});
    });
  }finally{await db.close();}
});
