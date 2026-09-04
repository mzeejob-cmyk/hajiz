import { randomUUID, createHash } from 'node:crypto';
import { rpc, assert } from './plan.mjs';
import { call } from './connection.mjs';
export const digest = value => createHash('sha256').update(value).digest('hex');
export const first = rows => { assert(rows.length === 1, 'ONE_AUTHORITY_ROW'); return rows[0]; };
export async function fixture(ctx, c, label, actor, method = 'card') {
  const suffix = ctx.run + '_' + label;
  const intentKey = 'hbi_req_' + suffix, key = 'hpi_req_' + suffix;
  const intentArgs = [actor.id,intentKey,digest(suffix),digest(suffix+'priced'),'hfo_'+ctx.run,'mock',ctx.run,
    JSON.stringify({s1bRun:ctx.run}), '{}', null, '{}', '[{"travelerKey":"s1b-adt-1"},{"travelerKey":"s1b-adt-2"}]', '{}', null];
  const server = first((await c.query("SELECT (clock_timestamp()+interval '2 hours')::text AS until")).rows).until;
  intentArgs[9]=JSON.stringify({amount:'2600',currency:'SDG',validUntil:server}); intentArgs[13]=server;
  const intent = first(await call(c,rpc.intent,intentArgs));
  const again = first(await call(c,rpc.intent,intentArgs));
  assert(again.replayed && again.booking_intent_id===intent.booking_intent_id,'B11_REPLAY');
  const args = [actor.id,intent.booking_intent_id,method,key,digest(suffix+'payment')];
  const prepared = first(await call(c,rpc.preparePayment,args));
  const payExpiry=first((await c.query("SELECT (clock_timestamp()+interval '30 minutes')::text AS expiry")).rows).expiry;
  const materialArgs=[actor.id,intent.booking_intent_id,key,digest(suffix+'payment'),method==='bankak'?'manual_transfer':'mock_psp',
    method==='bankak'?null:ctx.run+'_'+label,method==='bankak'?null:'SYNTHETIC_SESSION_'+label,null,false,payExpiry,
    method==='bankak'?'S1B SYNTHETIC NO ACCOUNT':null,method==='bankak'?'NOT-A-REAL-ACCOUNT':null,digest(suffix+'handoff')];
  const payment = first(await call(c,rpc.materialize,materialArgs));
  const replay=first(await call(c,rpc.materialize,materialArgs));
  assert(payment.booking_id===prepared.booking_id && replay.payment_id===payment.payment_id && replay.replayed,'B12_SINGLE_MATERIALIZATION');
  const f={label,owner:actor.id,booking:payment.booking_id,payment:payment.payment_id,ref:payment.booking_ref,
    intent:intent.booking_intent_id,method,b13:'hsb_req_'+suffix,b14:'hst_req_'+suffix,digest:digest(suffix+'execution')};
  ctx.journal.fixtures.push(f); ctx.save();
  const row=await state(c,f);
  assert(Number(row.net_cost)===2300&&Number(row.sold_price)===2600&&Number(row.commission)===0&&Number(row.agent_profit)===300,'MODEL_B_SERVER_ECONOMICS');
  return f;
}
export async function state(c,f) {
  return first((await c.query(`SELECT b.id,b.status AS booking_status,p.status AS payment_status,b.net_cost,b.sold_price,b.commission,b.agent_profit,
    b.currency,b.supplier_provider,p.amount,p.expires_at,b.supplier_reference,
    (SELECT execution_state FROM app_private.flight_supplier_booking_executions WHERE booking_id=b.id) AS b13,
    (SELECT execution_state FROM app_private.flight_supplier_ticketing_executions WHERE booking_id=b.id) AS b14,
    (SELECT count(*)::int FROM app_private.flight_ticket_records WHERE booking_id=b.id) AS tickets
    FROM public.bookings b JOIN public.payments p ON p.booking_id=b.id WHERE b.id=$1 AND b.user_id=$2`,[f.booking,f.owner])).rows);
}
export function executionArgs(f, kind) { return [f.owner,f.booking,f[kind],f.digest]; }
export async function paymentEvent(ctx,c,f,target='confirmed',overrides={}) {
  const row=await state(c,f);
  const a=[f.payment,target,'mock_psp',ctx.run+'_'+f.label+'_'+target,target,row.amount,'SDG',true,digest(f.label+target),
    first((await c.query('SELECT clock_timestamp()::text AS now')).rows).now,null];
  for(const [i,v] of Object.entries(overrides)) a[Number(i)]=v;
  return first(await call(c,rpc.event,a)).apply_payment_event;
}
export async function paid(ctx,c,f) {
  assert(await paymentEvent(ctx,c,f),'PAYMENT_CONFIRMED');
  const row=await state(c,f);
  assert(row.payment_status==='confirmed'&&row.booking_status==='payment_confirmed'&&row.b13===null&&row.tickets===0,'PAYMENT_NOT_SUPPLIER_CONFIRMATION');
}
export async function accepted(c,f) {
  const args=executionArgs(f,'b13');
  await call(c,rpc.b13prepare,args); await call(c,rpc.b13mark,args);
  await call(c,rpc.b13complete,[...args,'ACCEPTED','SYNTHETIC-'+f.label,'SYNTHETIC-PNR',digest(f.label+'accepted'),JSON.stringify({synthetic:true})]);
  const row=await state(c,f); assert(row.booking_status==='confirmed'&&row.b13==='ACCEPTED'&&row.tickets===0,'B13_ACCEPTED_PERSISTENCE');
}
export function tickets(ctx,f,availability) {
  return ['s1b-adt-1','s1b-adt-2'].map((travelerKey,i)=>({travelerKey,ticketNumber:`SYNTHETIC-${ctx.run}-${f.label}-${i}`,supplierTicketRef:'SYNTHETIC-NOT-VALID',issuedAt:new Date().toISOString(),
    artifact:{availability,artifactRef:availability==='AVAILABLE'?`synthetic://${ctx.run}/${f.label}/${i}`:null,
      mediaType:availability==='AVAILABLE'?'application/pdf':null,digest:availability==='AVAILABLE'?digest(ctx.run+i):null}}));
}
export async function issue(ctx,c,f,availability='AVAILABLE') {
  const args=executionArgs(f,'b14'); await call(c,rpc.b14prepare,args); await call(c,rpc.b14mark,[...args,'confirm_booking']);
  const a=[...args,'ISSUED',JSON.stringify(tickets(ctx,f,availability)),digest(f.label+'issued'),'{}'];
  const r=first(await call(c,rpc.b14complete,a)); const replay=first(await call(c,rpc.b14complete,a));
  const row=await state(c,f);
  assert(row.b14==='ISSUED'&&row.booking_status==='ticketed'&&row.tickets===2&&replay.replayed,'TICKET_PERSISTENCE_REPLAY');
  assert(r.can_download_ticket===(availability==='AVAILABLE'),'TRUSTED_ARTIFACT_ONLY');
}
export async function createOffer(ctx,c) {
  await c.query(`INSERT INTO public.offers(id,supplier_offer_ref,selling_amount,net_cost,currency,enabled,expires_at,supplier_metadata,
    internal_offer_key,supplier_provider,contract_version,supplier_amount,supplier_currency,supplier_reference_payload)
    VALUES($1,$2,2600,2300,'SDG',true,clock_timestamp()+interval '2 hours',$3::jsonb,$4,'mock','flight-offer/v1',2300,'SDG',$3::jsonb)`,
    [ctx.journal.offer,ctx.run,JSON.stringify({s1bRun:ctx.run,synthetic:true,network:false,productionAllowed:false}),'hfo_'+ctx.run]);
}
