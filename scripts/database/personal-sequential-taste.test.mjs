import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';
import { verifyPersonalSequentialTaste } from './personal-sequential-taste.mjs';
import { runIsolatedSqlProbe } from './ci-supabase-stack.mjs';

const owner='ab157000-0000-4000-8000-000000000001',other='ab157000-0000-4000-8000-000000000002';
const source=await readFile(new URL('../../packages/prediction-engine/src/adaptive-taste.ts',import.meta.url),'utf8');
const reference=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));

test('sequential concurrency reaches the native executor and cleans its fixture on connection failure',async()=>{
  const stages=[];let reached=false;
  await assert.rejects(verifyPersonalSequentialTaste((sql,options)=>runIsolatedSqlProbe(()=>{
    stages.push(options.stage);
    if(sql.includes("set local application_name='kajo_seq_start_holder'")){reached=true;throw new Error('simulated native connection failure');}
    const values={
      'sequential-taste-reserved-scope':{users:0,items:0,backends:0},
      'sequential-taste-canonical-tables':['public.profiles'],
      'sequential-taste-canonical-before':{'public.profiles':'retained'},
      'sequential-taste-canonical-after':{'public.profiles':'retained'},
      'sequential-taste-profile':owner,
      'sequential-taste-observe-owned-lock':null,
    };
    if(options.stage in values)return JSON.stringify(values[options.stage]);
    assert.ok(['sequential-taste-fixture','sequential-taste-cleanup'].includes(options.stage));return '';
  },'disposable-test-container',sql,options)),/simulated native connection failure/);
  assert.equal(reached,true);assert.ok(stages.includes('sequential-taste-cleanup'));
  assert.equal(stages.at(-1),'sequential-taste-canonical-after');
});

test('owned sequential Taste v2 / full current schema',async t=>{
  const db=new PGlite();
  const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
  const one=async(sql,args=[])=>(await query(sql,args))[0];
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const files=(await buildFreshInstallation()).files,index=files.findIndex(f=>f.name.endsWith('_durable_sequential_taste.sql'));
  assert.ok(index>0);
  for(const f of files.slice(0,index))await db.exec(`begin;${f.sql}commit;`);
  const actorSql=actor=>`set local request.jwt.claim.sub='${actor??''}';set local role authenticated;`;
  const rpc=async(request,{actor=owner,role='authenticated'}={})=>{
    await db.exec('begin;');
    try{
      await query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);await db.exec(`set local role ${role};`);
      const result=(await one('select public.taste_session_v2($1) value',[request])).value;
      await db.exec('commit;');return result;
    }catch(e){await db.exec('rollback;');throw e;}
  };
  const cmd=(s,operation,extra={})=>({operation,profileId:s.profileId,sessionId:s.sessionId,requestId:randomUUID(),expectedRevision:s.revision,...extra});
  const next=s=>rpc(cmd(s,'NEXT'));
  const answer=(s,value=10)=>rpc(cmd(s,'ANSWER',{questionId:s.questionId,answer:typeof value==='number'?{kind:'RATING',value}:{kind:value}}));
  const state=id=>one('select * from private.sequential_taste_sessions where id=$1',[id]);
  const cleanup=()=>db.exec(`delete from auth.users where id::text like 'ab157000-%';
    delete from private.item_sources where item_id::text like 'ab157000-%';delete from public.items where id::text like 'ab157000-%';`);
  const sub=(name,fn)=>t.test(name,async()=>{
    await db.exec(await personalTasteSessionFixtureSql());
    const profile=(await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'",[owner])).id;
    const start=()=>rpc({operation:'START',profileId:profile,requestId:randomUUID()});
    try{await fn({profile,start});}finally{await db.exec('rollback;');await cleanup();}
  });
  try{
    await t.test('additive populated migration preserves all existing rows and function definitions/ACLs',async()=>{
      await db.exec('begin;');await db.exec(await personalTasteSessionFixtureSql());
      const tables=await query("select format('%I.%I',n.nspname,c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('auth','public','private') order by 1");
      const snapshots=await Promise.all(tables.map(async({name})=>[name,await query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`)]));
      const functions=await query("select oid,to_jsonb(p) body from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace) order by oid");
      await db.exec(files[index].sql);
      for(const [name,rows] of snapshots)assert.deepEqual(await query(`select to_jsonb(r) body from ${name} r order by to_jsonb(r)::text`),rows,name);
      const patches=JSON.parse(files[index].sql.match(/\$patches\$([\s\S]*?)\$patches\$/)[1]);
      for(const f of functions){
        const patch=patches.find(p=>f.body.proname===p.signature.split('.')[1].split('(')[0]);
        const expected=patch?{...f.body,prosrc:f.body.prosrc.replace(patch.before,patch.after)}:f.body;
        assert.deepEqual((await one('select to_jsonb(p) body from pg_proc p where oid=$1',[f.oid])).body,expected);
      }
      assert.deepEqual((await one("select array(select private.bootstrap_evidence_weight_v1('RATED',r) from generate_series(0,10) r) rated,private.bootstrap_evidence_weight_v1('CONSUMED',null) consumed,private.bootstrap_evidence_weight_v1('SAVED',null) saved")).rated,
        Array.from({length:11},(_,i)=>(i-5)*.75));
      await db.exec('rollback;');
    });
    for(const f of files.slice(index))await db.exec(`begin;${f.sql}commit;`);
    await sub('native question policy matches the portable numeric reference over actual canonical panels',async({start})=>{
      let s=await start();const catalog=(await state(s.sessionId)).catalog;
      const scope={subject:{id:s.profileId,kind:'individual'},actingIdentityRef:owner,sessionRef:s.sessionId,
        evidence:{sourceIds:['catalog'],cohortIds:[],synthetic:'fixture-only'}};
      const domains=['MOVIE','BOOK'].map(domain=>({domain,minimumRatedItems:4,minimumFeaturePatterns:2,
        minimumForecastCoverage:.75,minimumComparablePairs:1,minimumConcordantFraction:.6,minimumStableComparisons:1,maximumOrderChangeRatio:0}));
      let ref=reference.createAdaptiveTaste({scope,at:100,ratingScale:{min:0,max:10},domains,policy:reference.adaptiveTasteCanonicalDefaults});
      for(const value of [10,0,5,'UNKNOWN','NOT_INTERESTED',2,9,1,'WITHDRAW_FIRST',7]){
        if(value==='WITHDRAW_FIRST'){
          const questionId=ref.questions[0].id,requestId=randomUUID();
          s=await rpc({...cmd(s,'CORRECT',{questionId,answer:{kind:'WITHDRAWN'}}),requestId});
          ref=reference.advanceAdaptiveTaste(ref,{kind:'CORRECT',requestId,responseId:requestId,questionId,answer:{kind:'WITHDRAWN'},
            expectedRevision:ref.revision,at:ref.updatedAt+2,occurredAt:ref.updatedAt+1}).state;
          continue;
        }
        s=await next(s);assert.equal(s.status,'QUESTION');
        const panel=await one('select * from private.sequential_taste_panels order by prefix_revision desc limit 1');
        const pools=domains.map(({domain})=>({id:panel.id+domain,scope,domain,asOf:ref.updatedAt+1,catalogAsOf:10,prefix:ref.prefix,
          provenance:{predictionId:panel.id,modelVersion:panel.frozen.modelVersion,baseModelVersion:'canonical',policyVersion:panel.frozen.policyVersion,
            genomeRef:panel.frozen.genomeId,genomeConfigRef:'canonical',featureSchemaRef:'taste-tags-frequency-64-v2',stateRef:panel.id,traceRef:panel.id,sourceRefs:['catalog']},
          coverage:'BOUNDED_CANONICAL_POOL',consideredCount:catalog.filter(c=>c.itemType===domain).length,
          rows:catalog.filter(c=>c.itemType===domain).map(c=>{
            const f=panel.frozen.items.find(i=>i.itemId===c.id);
            return {candidate:{domain,eligible:true,recognitionPrior:c.recognitionPrior,priorBasis:c.priorBasis,
              object:{id:c.id,availableAt:10,features:Object.fromEntries(c.tags.map(tag=>[tag,1])),
                artifact:{id:'catalog',version:'1',representationVersion:'binary-tags',availableAt:10,trainedThrough:null,sourceRefs:['catalog'],use:'fixture-only'}}},
              labelSeen:f.labelSeen,forecast:f.status==='AVAILABLE'?{status:'AVAILABLE',score:f.score}:{status:'UNAVAILABLE',reason:f.reason}};
          })}));
        ref=reference.advanceAdaptiveTaste(ref,{kind:'OFFER',requestId:s.questionId,expectedRevision:ref.revision,at:ref.updatedAt+2,pools}).state;
        const expected=ref.questions.at(-1),actual=(await state(s.sessionId)).presentations.at(-1);
        assert.equal(actual.objectId,expected.objectId);
        for(const key of Object.keys(expected.components))assert.ok(Math.abs(actual.selectionComponents[key]-expected.components[key])<1e-12,key);
        // Recognition-only control uses the same pool and ledger, not another scorer.
        const control=(await one('select private.select_sequential_taste_v2($1,$2,$3,$4) v',
          [catalog,(await state(s.sessionId)).presentations.slice(0,-1),panel.frozen,'PRIOR_ONLY'])).v;
        assert.ok(control===null||control.components.utility===control.item.recognitionPrior);
        const req=cmd(s,'ANSWER',{questionId:s.questionId,answer:typeof value==='number'?{kind:'RATING',value}:{kind:value}});
        s=await rpc(req);
        ref=reference.advanceAdaptiveTaste(ref,{kind:'ANSWER',requestId:req.requestId,responseId:req.requestId,questionId:req.questionId,
          answer:req.answer,expectedRevision:ref.revision,occurredAt:ref.updatedAt+1,at:ref.updatedAt+2}).state;
      }
      assert.equal(reference.inspectAdaptiveTaste(ref).domains.every(d=>!d.ready),true);
    });
    await sub('owner/anonymous/Shared scope and all private tables/helpers are inaccessible',async({profile,start})=>{
      for(const role of ['anon','authenticated','service_role']){
        for(const table of ['sequential_taste_sessions','sequential_taste_panels','sequential_taste_commands'])
          assert.equal((await one("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') v",[role,`private.${table}`])).v,false);
        const functions=await query("select oid,proname from pg_proc where pronamespace='private'::regnamespace and proname like '%sequential%v2' and proname<>'taste_session_v2'");
        assert.ok(functions.length>=12);
        for(const f of functions)assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') v",[role,f.oid])).v,false,f.proname);
      }
      const s=await start();
      for(const actor of [other,null])await assert.rejects(rpc(cmd(s,'NEXT'),{actor}),/owner|Authentication/);
      await assert.rejects(rpc(cmd(s,'NEXT'),{role:'anon'}),/permission denied/);
      const shared=(await one("insert into public.profiles(profile_type,name) values('SHARED','Sequential fixture') returning id")).id;
      await assert.rejects(rpc({operation:'START',profileId:shared,requestId:randomUUID()}),/owner/);
      await query('update auth.users set is_anonymous=true where id=$1',[owner]);
      await assert.rejects(next(s),/Anonymous/);
      await query('update auth.users set is_anonymous=false where id=$1',[owner]);
      for(const extra of [{policy:'PRIOR_ONLY'},{asOf:'2000-01-01'},{candidates:[]}])await assert.rejects(rpc({...cmd(s,'NEXT'),...extra}),/fields/);
    });
    await sub('separate commits, exact retries, durable resume and hidden forecasts',async({start})=>{
      let s=await start();assert.equal(s.status,'NEEDS_NEXT');assert.equal(s.readiness.status,'INSUFFICIENT');
      const offer=cmd(s,'NEXT');s=await rpc(offer);assert.equal(s.status,'QUESTION');assert.deepEqual(await rpc(offer),s);
      assert.equal((await one('select count(*)::int n from private.sequential_taste_panels')).n,1);
      assert.deepEqual(await rpc({operation:'RESUME',profileId:s.profileId,sessionId:s.sessionId}),s);
      const req=cmd(s,'ANSWER',{questionId:s.questionId,answer:{kind:'RATING',value:0}});
      const accepted=await rpc(req);assert.equal(accepted.status,'NEEDS_NEXT');assert.deepEqual(await rpc(req),accepted);
      await assert.rejects(rpc({...req,answer:{kind:'RATING',value:10}}),/identity conflict/);
      await assert.rejects(rpc({...req,requestId:randomUUID()}),/revision conflict/);
      assert.doesNotMatch(JSON.stringify(s),/"score"|"frozen"|"selectionComponents"|"rawTags"|"recognitionPrior"/);
      assert.deepEqual(Object.keys(s.currentItem).sort(),['id','itemType','title']);
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence where active')).n,1);
      assert.deepEqual(await start(),accepted);
      const retained=(await state(s.sessionId)).presentations[0].responses[0];
      assert.equal(retained.answer.value,0);assert.equal(retained.measurement.firstMeasurement,true);
      assert.equal(retained.measurement.pendingComparison,true);
      // Explicit SQL transaction identities close even sub-millisecond receipt races.
      await db.exec('begin;'+actorSql(owner));
      const offered=(await one('select public.taste_session_v2($1) v',[cmd(accepted,'NEXT')])).v;
      await assert.rejects(one('select public.taste_session_v2($1)',[cmd(offered,'ANSWER',{questionId:offered.questionId,answer:{kind:'RATING',value:5}})]),/Commit the question/);
      await db.exec('rollback;');
      const q=await next(accepted);
      await db.exec('begin;'+actorSql(owner));
      const a=(await one('select public.taste_session_v2($1) v',[cmd(q,'ANSWER',{questionId:q.questionId,answer:{kind:'RATING',value:5}})])).v;
      await assert.rejects(one('select public.taste_session_v2($1)',[cmd(a,'NEXT')]),/Commit the accepted/);
      await db.exec('rollback;');
      assert.equal((await state(q.sessionId)).revision,q.revision);
    });
    await sub('ratings 10/0/5 change the next canonical forecast without rewriting the first measurement',async({start})=>{
      let s=await next(await start());const firstQuestion=s.questionId;
      const firstPanel=(await one('select * from private.sequential_taste_panels')).frozen;
      const firstItem=s.currentItem.id;
      s=await answer(s,10);const scores=[];
      for(const value of [10,0,5]){
        if(value!==10)s=await rpc(cmd(s,'CORRECT',{questionId:firstQuestion,answer:{kind:'RATING',value}}));
        // The previous offered question is answered before a fresh pool is requested.
        s=await next(s);
        const panel=await one('select * from private.sequential_taste_panels order by prefix_revision desc limit 1');
        const trace=await one(`select c.explanation from private.prediction_candidates c join public.items i on i.id=c.item_id
          join public.items original on original.id=$2 where c.prediction_id=$1 and i.id<>original.id
            and i.tags&&original.tags order by c.item_id limit 1`,[panel.prediction_id,firstItem]);
        scores.push(trace.explanation.bootstrapLongTerm);
        assert.equal(panel.frozen.requiredReceiptRevision,s.revision-1);
        s=await answer(s,'UNKNOWN');
      }
      assert.ok(scores[0]>0);assert.ok(scores[1]<0);assert.equal(scores[2],0);
      const retained=await state(s.sessionId);assert.equal(retained.presentations[0].responses[0].answer.value,10);
      assert.deepEqual((await one('select frozen from private.sequential_taste_panels order by prefix_revision limit 1')).frozen,firstPanel);
      assert.equal((await one('select count(*)::int n from public.events')).n,0);
      assert.equal((await one('select count(*)::int n from private.prediction_candidates where selected_for_delivery')).n,0);
    });
    await sub('not-interest changes canonical forecasts as a separate negative prior; unknown removes no invented rating',async({start})=>{
      let s=await next(await start());const first=s.questionId,item=s.currentItem.id;
      const original=(await one('select frozen from private.sequential_taste_panels')).frozen;
      s=await answer(s,'NOT_INTERESTED');
      assert.deepEqual(await one('select evidence_kind,rating,active from private.profile_bootstrap_evidence where item_id=$1',[item]),
        {evidence_kind:'NOT_INTERESTED',rating:null,active:true});
      assert.equal((await one('select event_weight from private.personal_source_evidence_v1($1,now()) where item_id=$2',[s.profileId,item])).event_weight,-3.4375);
      s=await next(s);
      assert.ok((await one("select count(*)::int n from private.prediction_candidates c join private.sequential_taste_panels p on p.prediction_id=c.prediction_id where p.prefix_revision>1 and (c.explanation->>'bootstrapLongTerm')::double precision<0")).n>0);
      assert.deepEqual((await one('select frozen from private.sequential_taste_panels order by prefix_revision limit 1')).frozen,original);
      s=await answer(s,'UNKNOWN');
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence')).n,1);
      s=await rpc(cmd(s,'CORRECT',{questionId:first,answer:{kind:'RATING',value:5}}));
      assert.deepEqual(await one('select evidence_kind,rating,active from private.profile_bootstrap_evidence where item_id=$1',[item]),
        {evidence_kind:'RATED',rating:5,active:true});
      s=await rpc(cmd(s,'CORRECT',{questionId:first,answer:{kind:'UNKNOWN'}}));
      assert.equal((await one('select count(*)::int n from private.personal_source_evidence_v1($1,now())',[s.profileId])).n,0);
      assert.equal((await one('select count(*)::int n from public.events where profile_id=$1',[s.profileId])).n,0);
    });
    await sub('selectively withdrawn external bootstrap invalidates copied panels and old replies',async({start})=>{
      let s=await start();
      const job=(await one("insert into private.profile_import_jobs(actor_user_id,profile_id,source_provider,dataset_kind,file_fingerprint,status,committed_at) values($1,$2,'KAJO_CSV','TEST_SEQUENTIAL',md5('test-sequential'),'COMMITTED',now()) returning id",[owner,s.profileId])).id;
      const item=(await state(s.sessionId)).catalog[0];
      await query("insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,source_provider,dataset_kind,source_job_id,source_row_key,evidence_kind,rating) values($1,$2,$3,$4,'KAJO_CSV','TEST_SEQUENTIAL',$5,'external','RATED',10)",[owner,s.profileId,item.id,item.itemType,job]);
      const req=cmd(s,'NEXT');s=await rpc(req);assert.equal(s.status,'QUESTION');
      await query('update private.profile_bootstrap_evidence set active=false where source_job_id=$1',[job]);
      assert.equal((await rpc(req)).status,'SOURCE_WITHDRAWN');
      assert.ok((await query('select invalidated,frozen from private.sequential_taste_panels')).every(p=>p.invalidated&&JSON.stringify(p.frozen)==='{}'));
      s=await rpc({operation:'RESUME',profileId:s.profileId,sessionId:s.sessionId});
      assert.equal((await next(s)).status,'QUESTION');
    });
    await sub('ordinal pairs use one earlier unseen pool and corrections invalidate evaluation',async({start})=>{
      let s=await next(await start());const left=s.questionId,leftItem=s.currentItem.id;
      const firstPanel=await one('select * from private.sequential_taste_panels');
      s=await next(await answer(s,10));s=await next(await answer(s,5));
      assert.equal(s.currentItem.itemType,'MOVIE');const rightItem=s.currentItem.id;
      s=await answer(s,0);
      const pair=s.evaluation.pairs.find(p=>p.leftObjectId===leftItem&&p.rightObjectId===rightItem);
      assert.equal(pair.poolId,firstPanel.id);
      const a=firstPanel.frozen.items.find(i=>i.itemId===leftItem),b=firstPanel.frozen.items.find(i=>i.itemId===rightItem);
      assert.equal(a.labelSeen,false);assert.equal(b.labelSeen,false);
      assert.equal(pair.status,Math.abs(a.score-b.score)<=1e-9?'FORECAST_TIE':'COMPARABLE');
      s=await rpc(cmd(s,'CORRECT',{questionId:left,answer:{kind:'RATING',value:2}}));
      assert.equal(s.evaluation.pairs[0].status,'INVALIDATED');
      assert.equal((await state(s.sessionId)).presentations[0].responses[0].answer.value,10);
    });
    await sub('pause allows Discovery with the same Profile and committed evidence; continuation resumes the question',async({start})=>{
      let s=await next(await start());s=await next(await answer(s,10));const question=s.questionId;
      s=await rpc(cmd(s,'PAUSE'));assert.equal(s.status,'PAUSED');assert.equal(s.canContinueDiscovery,true);assert.equal(s.currentItem,null);
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence where active')).n,1);
      await assert.rejects(next(s),/Resume/);s=await rpc(cmd(s,'CONTINUE'));assert.equal(s.questionId,question);
      const seen=[];for(let i=0;i<55&&s.status==='QUESTION';i++){seen.push(s.currentItem.id);s=await next(await answer(s,'UNKNOWN'));}
      assert.equal(new Set(seen).size,seen.length);assert.equal(s.status,'STOPPED');assert.equal(s.readiness.status,'INSUFFICIENT');assert.equal(s.canContinueDiscovery,true);
    });
    await sub('v1 ownership and completed setup are preserved instead of reset',async({profile,start})=>{
      await db.exec('begin;'+actorSql(owner));
      const v1=(await one('select public.taste_session_v1($1) v',[{operation:'START',profileId:profile,requestId:randomUUID()}])).v;await db.exec('commit;');
      assert.equal((await start()).status,'LEGACY_V1_PRESERVED');
      assert.equal((await one('select count(*)::int n from private.sequential_taste_sessions')).n,0);
      assert.equal((await one('select id from private.taste_sessions')).id,v1.sessionId);
    });
    await sub('v2 prevents a competing v1 writer; catalog changes fail with an honest stop',async({profile,start})=>{
      let s=await start();await db.exec('begin;'+actorSql(owner));
      await assert.rejects(one('select public.taste_session_v1($1)',[{operation:'START',profileId:profile,requestId:randomUUID()}]),/v2 already owns/);await db.exec('rollback;');
      await db.exec("update public.items set tags=array['changed'] where id::text like 'ab157000-%';");
      s=await next(s);assert.equal(s.status,'STOPPED');assert.equal(s.stopReason,'CATALOG_CHANGED_INSUFFICIENT');
    });
    await sub('first measurements and panels are immutable; live withdrawal beats cached replies',async({start})=>{
      let s=await start();const req=cmd(s,'NEXT');s=await rpc(req);s=await answer(s,0);
      await assert.rejects(query("update private.sequential_taste_sessions set presentations=jsonb_set(presentations,'{0,responses,0,answer,value}','10') where id=$1",[s.sessionId]),/first measurement is immutable/);
      await assert.rejects(query("update private.sequential_taste_panels set frozen=frozen||'{\"changed\":true}'"),/forecast is immutable/);
      await db.exec("update public.items set discoverable=false where id::text like 'ab157000-%';");
      assert.equal((await rpc(req)).status,'STOPPED');
      assert.equal((await rpc({operation:'RESUME',profileId:s.profileId,sessionId:s.sessionId})).currentItem,null);
      assert.equal((await rpc(cmd(s,'REMOVE'))).status,'REMOVED');
    });
    await sub('an external label after the forecast cannot become a first held-out measurement',async({start})=>{
      let s=await next(await start());const item=s.currentItem.id;
      await query("insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at) values(gen_random_uuid(),$1,$2,$3,$4,'ITEM_RATED','{\"rating\":9}',now())",
        [owner,s.profileId,item,s.currentItem.itemType]);
      await assert.rejects(answer(s,9),/another label/);
      s=await next(s);assert.notEqual(s.currentItem.id,item);
      assert.equal((await state(s.sessionId)).presentations[0].responses.length,0);
    });
    await sub('terminal withdrawal invalidates dependent panels and cannot resurrect evidence via retries',async({start})=>{
      let s=await next(await start());const first=s.questionId;
      const req=cmd(s,'ANSWER',{questionId:first,answer:{kind:'RATING',value:10}});s=await rpc(req);
      s=await next(s);s=await answer(s,8);
      s=await rpc(cmd(s,'CORRECT',{questionId:first,answer:{kind:'WITHDRAWN'}}));
      assert.equal((await one('select count(*)::int n from private.profile_bootstrap_evidence where active')).n,0);
      assert.equal((await rpc(req)).status,'SOURCE_WITHDRAWN');
      const questions=(await state(s.sessionId)).presentations;
      assert.equal(questions[0].responses.at(-1).answer.kind,'WITHDRAWN');
      assert.ok(questions.slice(1).every(p=>p.invalidated));
      await assert.rejects(rpc(cmd(s,'CORRECT',{questionId:first,answer:{kind:'RATING',value:10}})),/order conflict/);
      s=await next(s);assert.equal(s.status,'QUESTION');
    });
    await sub('prediction and import source erasure remove copied forecasts; tombstone wins over retries',async({start})=>{
      let s=await next(await start());const req=cmd(s,'ANSWER',{questionId:s.questionId,answer:{kind:'RATING',value:10}});s=await rpc(req);
      const first=await one('select prediction_id from private.sequential_taste_panels');
      await query("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1)",[first.prediction_id]);
      assert.deepEqual((await one('select frozen from private.sequential_taste_panels')).frozen,{});
      assert.equal((await rpc(req)).status,'SOURCE_WITHDRAWN');
      s=await rpc({operation:'RESUME',profileId:s.profileId,sessionId:s.sessionId});s=await next(s);s=await answer(s,5);
      const job=(await state(s.sessionId)).source_job_id;
      await db.exec('begin;'+actorSql(owner));await query('select public.remove_profile_import_job_v1($1)',[job]);await db.exec('commit;');
      assert.equal((await rpc(req)).status,'REMOVED');assert.equal((await start()).status,'REMOVED');
      const row=await state(s.sessionId);assert.deepEqual(row.catalog,[]);assert.deepEqual(row.presentations,[]);
      assert.equal((await one('select count(*)::int n from private.sequential_taste_panels')).n,0);
      assert.equal((await one('select count(*)::int n from private.sequential_taste_commands')).n,0);
    });
  }finally{await db.close();}
});
