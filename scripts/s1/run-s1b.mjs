import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PROJECT, budget, sections, blocked, assert } from './lib/plan.mjs';
import { configuration, connect } from './lib/connection.mjs';
import { createActor, preflightHttpProbes, authenticatedRestProbe } from './lib/auth.mjs';
import { createOffer } from './lib/fixtures.mjs';
import { cleanup, commit } from './lib/inventory.mjs';
import { runtime } from './tests/runtime.mjs';
import { render } from './lib/report.mjs';
import { fingerprint, cleanupPreconditions } from './lib/immutability.mjs';
import { diagnostic, stageSubsystem } from './lib/diagnostics.mjs';
const dir=fileURLToPath(new URL('.',import.meta.url));
const args=process.argv.slice(2);
const plan={project:PROJECT,mode:'LOCAL ONLY',sections,budget,credentials:'ENVIRONMENT ONLY',ca:'C:/Users/mzeep/Downloads/prod-ca-2021.crt',committedFixtures:6,rollbackOnlyFixtures:2,authIdentities:3,network:'Staging PostgreSQL + same-project Auth/REST/Storage only',execution:'Requires --execute-staging; --plan never loads credentials or connects'};
if(args.length===0||(args.length===1&&args[0]==='--plan')) { console.log(JSON.stringify(plan,null,2)); }
else if(args[0]==='--execute-staging'&&args.length===1 || args[0]==='--cleanup'&&args.length===2) {
  const recover=args[0]==='--cleanup';
  const run=recover?args[1]:`S1B_${new Date().toISOString().replace(/[-:.]/g,'')}_${randomBytes(4).toString('hex')}`;
  if(!/^S1B_[0-9TZ]+_[a-f0-9]{8}$/.test(run)) { console.log('BLOCKED: INVALID_RUN_ID'); process.exitCode=1; }
  else {
    const output=join(dir,'output',run);mkdirSync(output,{recursive:true});
    const ctx={run,stage:'FILESYSTEM_INITIALIZATION',networkConnected:false,results:{},evidence:[],actors:[],journal:recover?JSON.parse(readFileSync(join(output,'journal.json'),'utf8')):{run,project:PROJECT,offer:randomUUID(),emails:[],actors:[],fixtures:[],storage:[],cleanup:'NOT RUN'}};
    const markStage=stage=>{ctx.stage=stage;};
    ctx.save=()=>{
      writeFileSync(join(output,'journal.json'),JSON.stringify(ctx.journal,null,2));
      writeFileSync(join(output,'evidence.json'),JSON.stringify(ctx.evidence,null,2));
    };
    let c;
    try {
      assert(ctx.journal.run===run&&ctx.journal.project===PROJECT,'JOURNAL_SCOPE');
      ctx.config=configuration(markStage); // Values never serialized.
      markStage('LOCAL_ARTIFACT_VALIDATION');
      const repo=resolve(dir,'../..');
      const head=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
      assert(head==='61c1c760efc5b098334046166b383b5f3fa154dd','C1_CHECKOUT_HEAD');
      const status=execFileSync('git',['-C',repo,'status','--porcelain'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
      assert(!status,'C1_CHECKOUT_DIRTY');
      const adapter=await import(new URL('../../src/server/suppliers/mockFlightSupplier.js',import.meta.url));
      const health=await adapter.createMockFlightSupplier({env:{NODE_ENV:'test'}}).health();
      assert(health.providerName==='mock'&&health.synthetic&&health.network===false&&health.productionAllowed===false,'MOCK_HAS_NO_NETWORK');
      writeFileSync(join(output,'pre-execution-plan.json'),JSON.stringify(plan,null,2));
      ctx.save();console.log(`S1-B run ${run}; maximum residue budget saved before writes.`);
      markStage('POSTGRES_CONNECT');
      c=await connect(ctx.config,'control');ctx.networkConnected=true;
      markStage('POSTGRES_READ_PROBE');
      const probe=await c.query('SELECT 1 AS ok, pg_backend_pid() AS pid');
      assert(probe.rows.length===1&&probe.rows[0].ok===1&&Number.isInteger(probe.rows[0].pid),'POSTGRES_READ_PROBE_FAILED');
      ctx.evidence.push({stage:'REST_PUBLIC_PROBE',status:'NOT_APPLICABLE_BY_SCHEMA',target:'NONE',basis:'C1_REVOKES_ANON_TABLE_ACCESS_AND_GRANTS_NO_ANON_RPC'});ctx.save();
      await preflightHttpProbes(markStage);
      markStage('RUNTIME_PREFLIGHT');
      await cleanupPreconditions(c);
      ctx.before=await fingerprint(c);
      if(!recover){
        markStage('AUTH_IDENTITY_CREATION');
        for(const label of ['A','B','FINANCE'])ctx.actors.push(await createActor(ctx,label));
        await authenticatedRestProbe(ctx.actors.find(a=>a.label==='A'),markStage);
        markStage('FIXTURE_CREATION');
        await c.query('BEGIN');
        try {
          for(const a of ctx.actors)await c.query(`INSERT INTO public.profiles(id,display_name,role,finance_enabled) VALUES($1,$2,$3::public.staff_role,$4)
            ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,finance_enabled=EXCLUDED.finance_enabled`,[a.id,run,a.label==='FINANCE'?'finance':'customer',a.label==='FINANCE']);
          await createOffer(ctx,c);await commit(c,ctx);
        }catch(e){await c.query('ROLLBACK');throw e;}
        await runtime(ctx,c);
      }
      await cleanup(ctx,c);
      assert(ctx.before===await fingerprint(c),'POST_RUNTIME_AUTHORITY_IMMUTABILITY');
    }catch(e){ctx.error={gate:e.gate??'BLOCKED',label:e.safeLabel??'RUNTIME_OR_INFRASTRUCTURE_FAILURE',diagnostic:diagnostic(e,{stage:ctx.stage,subsystem:stageSubsystem(ctx.stage),networkConnected:ctx.networkConnected})};}
    finally{
      if(c&&ctx.journal.cleanup!=='PASS'){
        try{await c.query('ROLLBACK');await cleanup(ctx,c);}catch{ctx.journal.cleanup='FAIL';}
      }
      if(c)try{await c.end();}catch(e){if(!ctx.error)ctx.error={gate:'BLOCKED',label:'CONNECTION_CLOSE_FAILED',diagnostic:diagnostic(e,{stage:'POSTGRES_CLOSE',subsystem:'postgres',networkConnected:ctx.networkConnected})};}
      ctx.save();
      writeFileSync(join(output,'residue-ledger.json'),JSON.stringify(ctx.journal.ledger??[],null,2));
      const report=render(ctx);writeFileSync(join(output,'S1-B-REPORT.md'),report);
      writeFileSync(join(output,'result.json'),JSON.stringify({run,result:ctx.verdict,sections:ctx.results,cleanup:ctx.journal.cleanup,error:ctx.error??null},null,2));
      console.log(`S1-B RESULT: ${ctx.verdict}; reports in output/${run}`);process.exitCode=ctx.verdict==='PASS'?0:1;
    }
  }
}else{console.log('BLOCKED: use --plan, --execute-staging, or --cleanup RUN_ID');process.exitCode=1;}
