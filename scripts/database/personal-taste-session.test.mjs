import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql, personalTasteSessionSmokeSql } from './personal-taste-session.mjs';
import { personalSourceFusionFixtureSql } from './personal-source-fusion.mjs';

const owner='ab157000-0000-4000-8000-000000000001', other='ab157000-0000-4000-8000-000000000002';
const root=new URL('../../',import.meta.url);
const source=await readFile(new URL('packages/prediction-engine/src/taste-selection.ts',root),'utf8');
const {selectTasteOpportunity}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));

async function database() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const {files}=await buildFreshInstallation();
  for(const file of files.slice(0,-1)) await db.exec(`begin;${file.sql}commit;`);
  assert.match(files.at(-1).name,/_personal_taste_session.sql$/);
  return {db,migration:files.at(-1)};
}
const snapshotRows=async db=>(await db.query(`select n.nspname||'.'||c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and n.nspname in('public','private','auth') order by 1`)).rows;
const snapshotFunctions=async db=>(await db.query(`select p.oid,to_jsonb(p) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in('public','private','auth') order by p.oid`)).rows;

test('own Personal durable Taste session / full current schema',async t=>{
  const {db,migration}=await database();
  const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
  const rpc=async(request,actor=owner,role='authenticated')=>{
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);
    await db.exec(`set local role ${role};`);
    const result=(await query('select public.taste_session_v1($1) value',[request]))[0].value;
    await db.exec('set local role postgres;');return result;
  };
  // SQL errors abort a transaction. Always isolate expected rejections, then
  // re-check unchanged state so rejected commands cannot hide partial mutations.
  const rejects=async(fn,pattern)=>{
    await db.exec('savepoint rejection;');let error;
    try{await fn();}catch(caught){error=caught;}
    await db.exec('rollback to rejection;release rejection;');
    assert.ok(error,'expected rejection');assert.match(error.message,pattern);
  };
  const sub=async(name,fn)=>t.test(name,async()=>{
    await db.exec('begin;');
    try{
      await db.exec(await personalTasteSessionFixtureSql());
      const profile=(await query('select id from public.profiles where owner_user_id=$1 and profile_type=\'PERSONAL\'',[owner]))[0].id;
      const start=()=>rpc({operation:'START',profileId:profile,requestId:randomUUID()});
      const command=(s,operation,extra={})=>({operation,profileId:profile,sessionId:s.sessionId,requestId:randomUUID(),expectedRevision:s.revision,...extra});
      const answer=(s,kind='UNKNOWN',value,index=s.presentations.length-1)=>rpc(command(s,'ANSWER',{
        questionIndex:index,answer:kind==='RATING'?{kind,value}:{kind}}));
      await fn({profile,start,command,answer});
    }finally{await db.exec('rollback;');}
  });
  try{
    await t.test('additive populated forward preserves every existing table row and function identity/body/ACL',async()=>{
      await db.exec('begin;');
      try{
        await db.exec(await personalSourceFusionFixtureSql());
        const tables=await snapshotRows(db);
        const snapshots=await Promise.all(tables.map(async({name})=>[name,await query(`select to_jsonb(r) row from ${name} r order by to_jsonb(r)::text`)]));
        const functions=await snapshotFunctions(db);
        await db.exec(migration.sql);
        for(const [name,rows] of snapshots)assert.deepEqual(await query(`select to_jsonb(r) row from ${name} r order by to_jsonb(r)::text`),rows,name);
        const after=new Map((await snapshotFunctions(db)).map(f=>[f.oid,f.body]));
        for(const f of functions)assert.deepEqual(after.get(f.oid),f.body,'existing function changed');
        for(const table of ['taste_sessions','taste_session_commands'])assert.equal((await query(`select count(*)::int n from private.${table}`))[0].n,0);
      }finally{await db.exec('rollback;');}
    });
    await db.exec(migration.sql);
    await t.test('native-CLI smoke executes authenticated public commands and rolls back',async()=>{
      try{const rows=(await db.exec(await personalTasteSessionSmokeSql())).flatMap(r=>r.rows);assert.match(rows[0].snapshot.personalTasteSession,/^PASS:/);}
      finally{await db.exec('rollback;');}
      assert.equal((await query('select count(*)::int n from auth.users'))[0].n,0);
    });
    await sub('private rows/helpers denied; owner scope rechecked before every replay',async({profile,start,command})=>{
      for(const role of ['anon','authenticated','service_role']){
        for(const table of ['taste_sessions','taste_session_commands'])assert.equal((await query('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') allowed',[role,`private.${table}`]))[0].allowed,false);
        for(const helper of ['select_taste_opportunity_v1(jsonb,jsonb,boolean,boolean,text)','taste_catalog_snapshot_v1(uuid,timestamptz)','project_taste_rating_v1(uuid,jsonb,jsonb)'])
          assert.equal((await query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,`private.${helper}`]))[0].allowed,false);
      }
      const s=await start(),req=command(s,'ANSWER',{questionIndex:0,answer:{kind:'RATING',value:0}});
      await rejects(()=>rpc(req,other),/owner access/);
      await rejects(()=>rpc(req,null),/Authentication/);
      await rejects(()=>rpc(req,null,'anon'),/permission denied/);
      const shared=(await query("insert into public.profiles(profile_type,name) values('SHARED','Shared Taste test') returning id"))[0].id;
      await rejects(()=>rpc({operation:'START',profileId:shared,requestId:randomUUID()}),/owner access/);
      await rpc(req);
      await rejects(()=>rpc(req,other),/owner access/);
      assert.equal((await query('select count(*)::int n from private.taste_session_commands'))[0].n,2);
    });
    await sub('frozen request replay, durable resume and compare-and-swap reject stale/conflicting commands',async({profile,start,command})=>{
      const s=await start();
      const req=command(s,'ANSWER',{questionIndex:0,answer:{kind:'RATING',value:0}});
      const next=await rpc(req);
      assert.deepEqual(await rpc(req),next);
      assert.deepEqual(await rpc({operation:'RESUME',profileId:profile,sessionId:s.sessionId}),next);
      await rejects(()=>rpc({...req,answer:{kind:'UNKNOWN'}}),/identity conflict/);
      await rejects(()=>rpc({...req,requestId:randomUUID()}),/revision conflict/);
      for(const expectedRevision of [null,'1',1.5,-1,9999])await rejects(()=>rpc({...req,requestId:randomUUID(),expectedRevision}),/revision/i);
      await rejects(()=>rpc({...req,requestId:randomUUID(),expectedRevision:next.revision,questionIndex:23}),/answer/i);
      await rejects(()=>rpc({...req,requestId:randomUUID(),expectedRevision:next.revision,policy:'PRIOR_ONLY'}),/fields/);
      assert.equal((await query('select count(*)::int n from private.profile_bootstrap_evidence'))[0].n,1);
      // New START identities resume without adding commands or resetting source.
      for(let i=0;i<5;i++)assert.deepEqual(await start(),next);
      assert.equal((await query('select count(*)::int n from private.taste_session_commands'))[0].n,2);
    });
    await sub('zero, neutral, correction, unknown and withdrawal are distinct and do not invent native history',async({profile,start,answer,command})=>{
      let s=await start();const item=s.currentItem.id;
      s=await answer(s,'RATING',0);
      let evidence=(await query('select * from private.profile_bootstrap_evidence'))[0];
      assert.equal(evidence.rating,0);assert.equal(evidence.source_metadata.source,'TASTE_TEST');
      assert.equal(evidence.source_metadata.questionIndex,0);assert.equal(evidence.dataset_kind,'TASTE_SESSION_V1');
      assert.equal((await query('select count(*)::int n from private.personal_source_evidence_v1($1,clock_timestamp()) where is_bootstrap and item_id=$2',[profile,item]))[0].n,1);
      s=await answer(s,'RATING',5,0);
      evidence=(await query('select * from private.profile_bootstrap_evidence'))[0];assert.equal(evidence.rating,5);
      s=await answer(s,'UNKNOWN',undefined,0);
      assert.equal((await query('select active from private.profile_bootstrap_evidence'))[0].active,false);
      s=await answer(s,'NOT_INTERESTED',undefined,0);
      assert.equal(s.selection.counts.notInterested,1);assert.equal(s.selection.counts.knownRatings,0);
      assert.equal((await query('select active from private.profile_bootstrap_evidence'))[0].active,false);
      s=await answer(s,'WITHDRAWN',undefined,0);
      assert.equal(s.selection.counts.withdrawn,1);
      for(let i=0;i<3;i++)s=await answer(s,'RATING',i,0);
      await rejects(()=>answer(s,'RATING',10,0),/revision limit/);
      for(const value of [null,'0',-1,11,0.5])await rejects(()=>rpc(command(s,'ANSWER',{questionIndex:1,answer:{kind:'RATING',value}})),/rating/);
      for(const body of [{kind:'UNKNOWN',value:0},{kind:'RATING',wrong:0},{kind:'RATING',value:0,extra:true}])
        await rejects(()=>rpc(command(s,'ANSWER',{questionIndex:1,answer:body})),/answer|rating/);
      assert.equal((await query('select count(*)::int n from public.events'))[0].n,0);
      assert.equal((await query('select count(*)::int n from public.item_interactions'))[0].n,0);
    });
    await sub('snapshot freezes catalog/features/order; transition requires acknowledgement; all-unknown reaches 24 then fails open',async({profile,start,answer,command})=>{
      let s=await start();const first=s.currentItem;
      await query("update public.items set title='changed',tags=array['changed-feature'] where id=$1",[first.id]);
      assert.deepEqual((await rpc({operation:'RESUME',profileId:profile,sessionId:s.sessionId})).currentItem,first);
      await rejects(()=>rpc(command(s,'ACK_TRANSITION')),/transition unavailable/);
      for(let i=0;i<10;i++)s=await answer(s);
      assert.equal(s.selection.decision.kind,'TRANSITION');assert.equal(s.presentations.length,10);
      assert.ok(s.presentations.every(p=>p.stageId==='movies'));
      s=await rpc(command(s,'ACK_TRANSITION'));assert.equal(s.currentItem.itemType,'BOOK');
      for(let i=10;i<24;i++)s=await answer(s);
      assert.equal(s.selection.decision.reason,'OPPORTUNITY_LIMIT');assert.equal(s.selection.decision.failOpen,true);
      assert.equal(s.selection.counts.knownRatings,0);assert.equal(new Set(s.presentations.map(p=>p.objectId)).size,24);
      assert.equal((await query('select count(*)::int n from private.profile_bootstrap_evidence'))[0].n,0);
    });
    await sub('source removal suppresses old responses/receipts; different Item cannot resurrect a withdrawn rating',async({profile,start,answer,command})=>{
      let s=await start();
      const req=command(s,'ANSWER',{questionIndex:0,answer:{kind:'RATING',value:10}});s=await rpc(req);
      const e=(await query('select * from private.profile_bootstrap_evidence'))[0];
      await query('update private.profile_bootstrap_evidence set active=false where id=$1',[e.id]);
      s=await answer(s,'RATING',5);
      assert.equal((await query('select active from private.profile_bootstrap_evidence where id=$1',[e.id]))[0].active,false);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
      await query('select public.remove_profile_import_job_v1($1)',[e.source_job_id]);
      assert.equal((await rpc(req)).status,'REMOVED');
      assert.equal((await rpc({operation:'RESUME',profileId:profile,sessionId:s.sessionId})).status,'REMOVED');
      assert.equal((await query('select count(*)::int n from private.taste_session_commands'))[0].n,0);
      assert.deepEqual((await query('select catalog,presentations from private.taste_sessions'))[0],{catalog:[],presentations:[]});
      assert.equal((await start()).status,'REMOVED');
    });
    await sub('existing completed setup is preserved and never forced through another session',async({profile,start,command})=>{
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
      const ratings=(await query('select id from public.items order by id limit 6')).map(({id})=>({itemId:id,rating:5}));
      await query('select public.commit_profile_calibration_v1($1,$2)',[profile,ratings]);
      const before=await query('select to_jsonb(e) body from private.profile_bootstrap_evidence e order by id');
      const s=await start();assert.equal(s.selection.decision.reason,'EXISTING_COMPLETION');assert.equal(s.presentations.length,0);
      await rejects(()=>rpc(command(s,'ANSWER',{questionIndex:0,answer:{kind:'RATING',value:0}})),/closed/);
      assert.deepEqual(await query('select to_jsonb(e) body from private.profile_bootstrap_evidence e order by id'),before);
    });
    await sub('anonymous identity is explicitly refused even with the authenticated Postgres role',async({start})=>{
      await db.exec('alter table auth.users add column is_anonymous boolean not null default false;');
      await query('update auth.users set is_anonymous=true where id=$1',[owner]);
      await rejects(start,/Anonymous Taste/);
      assert.equal((await query('select count(*)::int n from private.taste_sessions'))[0].n,0);
    });
    await sub('live catalog withdrawal blocks resume/replay/answers while removal remains available',async({profile,start,answer,command})=>{
      let s=await start();const item=s.currentItem.id;
      const req=command(s,'ANSWER',{questionIndex:0,answer:{kind:'RATING',value:0}});s=await rpc(req);
      await query('update public.items set discoverable=false where id=$1',[item]);
      const before=await query('select to_jsonb(s) body from private.taste_sessions s');
      for(const result of [await rpc(req),await answer(s),await rpc({operation:'RESUME',profileId:profile,sessionId:s.sessionId})]){
        assert.equal(result.status,'CATALOG_UNAVAILABLE');assert.equal(result.presentations,undefined);assert.equal(result.currentItem,undefined);
      }
      assert.deepEqual(await query('select to_jsonb(s) body from private.taste_sessions s'),before);
      assert.equal((await rpc(command(s,'REMOVE'))).status,'REMOVED');
    });
    await sub('account deletion cascades session/command/bootstrap copies',async({start,answer})=>{
      const s=await answer(await start(),'RATING',0);
      await query('delete from auth.users where id=$1',[owner]);
      assert.equal((await query('select count(*)::int n from private.taste_sessions where id=$1',[s.sessionId]))[0].n,0);
      assert.equal((await query('select count(*)::int n from private.taste_session_commands where session_id=$1',[s.sessionId]))[0].n,0);
      assert.equal((await query('select count(*)::int n from private.profile_bootstrap_evidence where actor_user_id=$1',[owner]))[0].n,0);
    });
    await sub('frozen candidate and feature budgets bound large canonical catalogs with stable real provenance',async({start})=>{
      await db.exec(`insert into public.items(id,item_type,title,tags,metadata)
        select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
          case when n<500 then 'MOVIE' else 'BOOK' end,'Budget fixture '||n,array['budget-'||n,'shared-feature'],
          '{"coldStartRecognition":0.1}' from generate_series(300,699) n;
        insert into private.item_sources(item_id,provider_key,provider_item_id)
          select id,'kajo_curated',id::text from public.items where title like 'Budget fixture %';`);
      await start();const row=(await query('select catalog,feature_policy_version from private.taste_sessions'))[0];
      assert.equal(row.catalog.length,256);assert.equal(row.catalog.filter(c=>c.itemType==='MOVIE').length,128);
      assert.equal(new Set(row.catalog.flatMap(c=>c.tags)).size,64);
      assert.ok(row.catalog.every(c=>c.providerKeys.length>0&&!c.providerKeys.includes('kajo_mock')));
      assert.equal(row.feature_policy_version,'taste-tags-frequency-64-v1');
    });
    await sub('missing real catalogue fails open without using mocks or manufacturing known responses',async({start,command})=>{
      await db.exec("delete from private.item_sources;insert into private.item_sources(item_id,provider_key,provider_item_id) select id,'kajo_mock',id::text from public.items;");
      let s=await start();assert.equal(s.selection.decision.kind,'TRANSITION');assert.equal(s.presentations.length,0);
      s=await rpc(command(s,'ACK_TRANSITION'));assert.equal(s.selection.decision.reason,'CATALOG_EXHAUSTED');
      assert.equal(s.selection.decision.failOpen,true);assert.equal(s.selection.counts.knownRatings,0);
    });
    await sub('SQL selection agrees with portable policy across adaptive/control, ratings/skips/corrections and domain transition',async({start,answer,command})=>{
      for(const policy of ['ADAPTIVE','PRIOR_ONLY']){
        await db.exec('savepoint parity;');
        let s=await start();await query('update private.taste_sessions set policy=$1',[policy]);
        for(let step=0;step<26;step++){
          const row=(await query('select * from private.taste_sessions'))[0];
          // Verify current replay and also remove its pending presentation to
          // compare the genuine new-question ranking/components independently.
          for(const ledger of [row.presentations,...(row.presentations.at(-1)?.responses.length===0?[row.presentations.slice(0,-1)]:[])]){
            const asOf=Math.max(new Date(row.catalog_as_of).getTime(),...ledger.flatMap(p=>[p.presentedAt,...p.responses.map(r=>r.availableAt)]));
            const artifact={id:'native-taste-catalog',version:'v1',representationVersion:'native-binary-tags-v1',availableAt:new Date(row.catalog_as_of).getTime(),trainedThrough:null,sourceRefs:[],use:'fixture-only'};
            const expected=selectTasteOpportunity({scope:{subject:{id:row.profile_id,kind:'individual'},actingIdentityRef:owner,sessionRef:row.id,evidence:{sourceIds:[],cohortIds:[],synthetic:'fixture-only'}},
              asOf,catalogAsOf:artifact.availableAt,ratingScale:{min:0,max:10},candidates:row.catalog.map(c=>({object:{id:c.id,features:Object.fromEntries(c.tags.map(t=>[t,1])),availableAt:c.availableAt,artifact},domain:c.itemType,eligible:true,recognitionPrior:c.recognitionPrior,priorBasis:c.priorBasis})),
              stages:[{id:'movies',domains:['MOVIE'],targetOpportunities:10},{id:'books',domains:['BOOK'],targetOpportunities:10}],presentations:ledger,
              acknowledgedTransitions:row.books_acknowledged?['books']:[],existingCompleted:row.existing_completed,policy});
            const actual=(await query('select private.select_taste_opportunity_v1($1,$2,$3,$4,$5) value',[row.catalog,ledger,row.books_acknowledged,row.existing_completed,policy]))[0].value;
            assert.deepEqual(actual.counts,expected.counts);assert.equal(actual.decision.kind,expected.decision.kind);
            if(expected.decision.kind==='QUESTION'){
              assert.equal(actual.decision.itemId,expected.decision.candidate.object.id);assert.equal(actual.decision.replay,expected.decision.replay);
              if(expected.decision.components)for(const key of Object.keys(expected.decision.components))assert.ok(Math.abs(actual.decision.components[key]-expected.decision.components[key])<1e-12,`${policy} ${key}: ${actual.decision.components[key]} versus ${expected.decision.components[key]}`);
            }else assert.deepEqual(actual.decision,expected.decision);
          }
          if(s.selection.decision.kind==='STOP')break;
          if(s.selection.decision.kind==='TRANSITION')s=await rpc(command(s,'ACK_TRANSITION'));
          else s=await answer(s,step%3===0?'UNKNOWN':step%5===0?'NOT_INTERESTED':'RATING',step%11);
          if(step===4)s=await answer(s,'WITHDRAWN',undefined,0);
        }
        await db.exec('rollback to parity;release parity;');
      }
    });
  }finally{await db.close();}
});
