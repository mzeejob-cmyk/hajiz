import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { configuration, connect } from './lib/connection.mjs';
import { createOffer, fixture, paymentEvent, state, first } from './lib/fixtures.mjs';
import { assert } from './lib/plan.mjs';
import { diagnostic, stageSubsystem } from './lib/diagnostics.mjs';

const dir=fileURLToPath(new URL('.',import.meta.url));
const sourceRun='S1B_20260904T193653536Z_795dfb89';
const run=`S1B_EXPIRY_${new Date().toISOString().replace(/[-:.]/g,'')}_${randomBytes(4).toString('hex')}`;
const output=join(dir,'output',run);mkdirSync(output,{recursive:true});
const evidence=[];
const persist=()=>writeFileSync(join(output,'expiry-evidence.json'),JSON.stringify({run,result,classification,evidence,error},null,2));
let result='BLOCKED',classification='ENVIRONMENT_BLOCKER',error=null,c=null,inTransaction=false,f=null;
const ctx={run,evidence,journal:{run,project:'pdnuswmljownjzjzpoop',offer:randomUUID(),emails:[],actors:[],fixtures:[],storage:[],cleanup:'ROLLBACK PENDING'},save:persist};
let stage='ENVIRONMENT_VALIDATION',networkConnected=false;
const markStage=value=>{stage=value;};
const residue=async()=>{
  if(!f)return null;
  const q=async(sql,args)=>Number((await c.query(sql,args)).rows[0].n);
  return {
    bookings:await q('SELECT count(*)::int AS n FROM public.bookings WHERE id=$1',[f.booking]),
    payments:await q('SELECT count(*)::int AS n FROM public.payments WHERE id=$1',[f.payment]),
    flightBookingIntents:await q('SELECT count(*)::int AS n FROM app_private.flight_booking_intents WHERE booking_intent_id=$1',[f.intent]),
    flightPaymentInitiations:await q('SELECT count(*)::int AS n FROM app_private.flight_payment_initiations WHERE booking_intent_id=$1::uuid OR payment_id=$2',[f.internalIntentId,f.payment]),
    providerEvents:await q('SELECT count(*)::int AS n FROM public.payment_provider_events WHERE payment_id=$1',[f.payment]),
    paymentAudit:await q('SELECT count(*)::int AS n FROM public.payment_audit WHERE aggregate_id=ANY($1::uuid[])',[[f.payment,f.booking]]),
    paymentReceipts:await q('SELECT count(*)::int AS n FROM public.payment_receipts WHERE payment_id=$1',[f.payment]),
    storageObjects:await q("SELECT count(*)::int AS n FROM storage.objects WHERE name LIKE '%'||$1||'%'",[run])
  };
};

try{
  const config=configuration(markStage);
  stage='LOCAL_ARTIFACT_VALIDATION';
  const repo=resolve(dir,'../..');
  const head=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  assert(head==='61c1c760efc5b098334046166b383b5f3fa154dd','C1_CHECKOUT_HEAD');
  assert(!execFileSync('git',['-C',repo,'status','--porcelain'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(),'C1_CHECKOUT_DIRTY');
  const source=JSON.parse(readFileSync(join(dir,'../../docs/evidence/s1/historical-fail',sourceRun,'journal.json'),'utf8'));
  const owner=source.actors.find(a=>a.label==='A')?.id;assert(typeof owner==='string','SYNTHETIC_OWNER_UNAVAILABLE');
  stage='POSTGRES_CONNECT';c=await connect(config,'expiry-only');networkConnected=true;
  stage='POSTGRES_READ_PROBE';assert((await c.query('SELECT 1 AS ok')).rows[0].ok===1,'POSTGRES_READ_PROBE_FAILED');
  stage='EXPIRY_TRANSACTION';await c.query('BEGIN');inTransaction=true;
  evidence.push({step:'TRANSACTION_BEGIN',status:'PASS',target:'HAJIZ STAGING',synthetic:true,realPII:false,liveSupplierEligible:false});persist();
  await createOffer(ctx,c);
  f=await fixture(ctx,c,'expired_targeted',{id:owner});
  f.internalIntentId=first((await c.query('SELECT id FROM app_private.flight_booking_intents WHERE booking_intent_id=$1',[f.intent])).rows).id;
  evidence.push({step:'FIXTURE_CREATED_IN_TRANSACTION',booking:f.booking,payment:f.payment,publicIntentToken:f.intent,internalIntentId:f.internalIntentId,provider:'mock',committed:false});persist();
  await c.query("UPDATE public.payments SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.payment]);
  const timing=first((await c.query(`SELECT transaction_timestamp()::text AS transaction_timestamp,
    clock_timestamp()::text AS clock_timestamp,expires_at::text AS expires_at,
    expires_at<=transaction_timestamp() AS expired_predicate
    FROM public.payments WHERE id=$1`,[f.payment])).rows);
  evidence.push({step:'PRE_CONFIRMATION_TIMING',...timing});persist();
  assert(timing.expired_predicate===true,'EXPIRED_FIXTURE_NOT_EXPIRED_BY_FUNCTION_CLOCK');
  const confirmationReturn=await paymentEvent(ctx,c,f,'confirmed',{9:'2099-01-01T00:00:00Z'});
  evidence.push({step:'FUTURE_CALLER_TIME_CONFIRMATION',callerOccurredAt:'2099-01-01T00:00:00Z',confirmationReturn});persist();
  assert(confirmationReturn===false,'EXPIRED_CONFIRMATION_FAILS_CLOSED');
  const afterConfirmation=await state(c,f);
  const progression=first((await c.query(`SELECT
    (SELECT count(*)::int FROM app_private.flight_supplier_booking_executions WHERE booking_id=$1) AS b13,
    (SELECT count(*)::int FROM app_private.flight_supplier_ticketing_executions WHERE booking_id=$1) AS b14,
    (SELECT count(*)::int FROM app_private.supplier_operations WHERE booking_id=$1) AS operations`,[f.booking])).rows);
  evidence.push({step:'STATE_AFTER_REJECTED_CONFIRMATION',paymentStatus:afterConfirmation.payment_status,bookingStatus:afterConfirmation.booking_status,supplierProgression:progression});persist();
  assert(afterConfirmation.payment_status==='awaiting'&&afterConfirmation.booking_status==='pending_payment','EXPIRED_CONFIRMATION_STATE_CHANGED');
  assert(progression.b13===0&&progression.b14===0&&progression.operations===0,'SUPPLIER_PROGRESSION_OCCURRED');
  const expiryReturn=await paymentEvent(ctx,c,f,'expired');
  evidence.push({step:'LEGITIMATE_EXPIRY_TRANSITION',expiryReturn});persist();assert(expiryReturn===true,'EXPIRY_TRANSITION_FAILED');
  const finalState=await state(c,f);
  evidence.push({step:'FINAL_STATE_BEFORE_ROLLBACK',paymentStatus:finalState.payment_status,bookingStatus:finalState.booking_status});persist();
  assert(finalState.payment_status==='expired'&&finalState.booking_status==='pending_payment','EXPIRY_FINAL_STATE_INVALID');
  await c.query('ROLLBACK');inTransaction=false;ctx.journal.cleanup='ROLLBACK PASS';
  evidence.push({step:'ROLLBACK',status:'PASS'});persist();
  const counts=await residue();evidence.push({step:'POST_ROLLBACK_RESIDUE',counts});persist();
  assert(Object.values(counts).every(n=>n===0),'POST_ROLLBACK_RESIDUE');
  result='PASS';classification=null;persist();
}catch(e){
  if(['EXPIRED_CONFIRMATION_FAILS_CLOSED','EXPIRED_CONFIRMATION_STATE_CHANGED','EXPIRY_TRANSITION_FAILED','EXPIRY_FINAL_STATE_INVALID'].includes(e.safeLabel))classification='PRODUCT_DEFECT';
  else if(e.safeLabel==='EXPIRED_FIXTURE_NOT_EXPIRED_BY_FUNCTION_CLOCK')classification='HARNESS_DEFECT';
  error={label:e.safeLabel??'TARGETED_EXPIRY_RUNTIME_FAILURE',diagnostic:diagnostic(e,{stage,subsystem:stageSubsystem(stage),networkConnected})};
  result=e.gate==='FAIL'?'FAIL':'BLOCKED';persist();
}finally{
  if(c&&inTransaction){try{await c.query('ROLLBACK');inTransaction=false;ctx.journal.cleanup='ROLLBACK PASS';evidence.push({step:'ROLLBACK_AFTER_FAILURE',status:'PASS'});}catch{ctx.journal.cleanup='ROLLBACK FAIL';}}
  if(c&&f){try{const counts=await residue();evidence.push({step:'POST_ROLLBACK_RESIDUE_FINAL',counts});}catch{}}
  if(c)try{await c.end();}catch{}
  persist();
  console.log(`TARGETED EXPIRY RESULT: ${result}`);
  console.log(`Evidence: output/${run}/expiry-evidence.json`);
  if(result==='PASS')console.log('SAFE TO RERUN FULL S1-B: YES');else console.log(`CLASSIFICATION: ${classification}`);
  process.exitCode=result==='PASS'?0:1;
}
