import { rpc, assert, blocked } from '../lib/plan.mjs';
import { call, negative, connect } from '../lib/connection.mjs';
import { commit, budgetCheck } from '../lib/inventory.mjs';
import { fixture, paid, paymentEvent, state, accepted, issue, executionArgs, digest, tickets, first } from '../lib/fixtures.mjs';
import { compete } from '../lib/competition.mjs';
import { mustRpc, userRpc, http } from '../lib/auth.mjs';
import { toMyTripsPresentation } from '../../../src/features/account/data/myTripsContract.js';

async function transaction(ctx,c,fn) { await c.query('BEGIN'); try{const r=await fn();await commit(c,ctx);return r;}catch(e){await c.query('ROLLBACK');throw e;} }
async function rollbackCase(c,fn) { await c.query('BEGIN');try{return await fn();}finally{await c.query('ROLLBACK');} }
async function counts(c,f) { return first((await c.query(`SELECT
  (SELECT count(*)::int FROM app_private.flight_supplier_booking_executions WHERE booking_id=$1) AS b13,
  (SELECT count(*)::int FROM app_private.flight_supplier_ticketing_executions WHERE booking_id=$1) AS b14,
  (SELECT count(*)::int FROM app_private.supplier_operations WHERE booking_id=$1) AS operations,
  (SELECT count(*)::int FROM app_private.flight_ticket_records WHERE booking_id=$1) AS tickets,
  (SELECT count(*)::int FROM public.payment_audit WHERE aggregate_id=$1) AS audit`,[f.booking])).rows); }
export async function runtime(ctx,c) {
  const [A,B,F]=ctx.actors;
  const fixtures={};
  const section=async(name,objective,fn)=>{
    ctx.current=name; ctx.results[name]={status:'BLOCKED',objective,expected:objective,setup:'unique mock-provider fixtures; real Auth identities; normal existing RPCs',records:[],usedFixtures:ctx.journal.fixtures.map(f=>({label:f.label,booking:f.booking,payment:f.payment})),identities:[A.id,B.id],cleanup:'PENDING',invariant:objective};ctx.save();
    const start=ctx.journal.fixtures.length;
    try{await fn();ctx.results[name].status='PASS';}catch(e){ctx.results[name].status=e.gate??'BLOCKED';throw e;}finally{ctx.results[name].records=ctx.journal.fixtures.slice(start);ctx.save();}
  };
  await section('PAYMENT AUTHORITY','PAYMENT CONFIRMED != SUPPLIER BOOKING CONFIRMED; B11/B12 lineage and Model B',async()=>{
    for(const [label,owner] of [['crash13',A],['issued',A],['none',A],['metadata',A],['bankak',A],['ownerb',B]]) {
      fixtures[label]=await transaction(ctx,c,async()=>fixture(ctx,c,label,owner,label==='bankak'?'bankak':'card'));
      fixtures[label].committed=true;ctx.save();
    }
    for(const label of ['crash13','issued','none','metadata','ownerb']) await transaction(ctx,c,()=>paid(ctx,c,fixtures[label]));
    fixtures.payonly=fixtures.crash13; // Reuse before supplier execution; no convenience fixture.
    const f=fixtures.payonly;
    const own=await mustRpc(A,'get_my_bookings');
    assert(own.some(r=>r.booking_ref===f.ref&&r.status==='payment_confirmed'),'AUTH_PAYMENT_ONLY_PROJECTION');
    const rows=await mustRpc(A,'get_my_flight_ticketing_v1');assert(!rows.some(r=>r.booking_ref===f.ref),'PAYMENT_ONLY_NO_TICKET_AUTHORITY');
    await rollbackCase(c,async()=>{
      const denied=await call(c,rpc.getIntent,[B.id,f.intent]);assert(denied.length===0,'B11_CROSS_OWNER_DENIED');
      await negative(c,()=>call(c,rpc.preparePayment,[B.id,f.intent,'card','hpi_req_'+ctx.run+'_cross',digest('cross')]));
      await negative(c,()=>c.query('UPDATE public.bookings SET commission=commission+1 WHERE id=$1',[f.booking]),['P0001']);
      await negative(c,()=>c.query('UPDATE public.bookings SET sold_price=1 WHERE id=$1',[f.booking]),['P0001']);
      await c.query(`UPDATE app_private.flight_booking_intents SET customer_price_snapshot=jsonb_set(customer_price_snapshot,'{amount}','"1"'::jsonb) WHERE owner_id=$1 AND booking_intent_id=$2`,[A.id,f.intent]);
      await negative(c,()=>call(c,rpc.preparePayment,[A.id,f.intent,'card','hpi_req_'+ctx.run+'_floor',digest('floor')]));
    });
    ctx.evidence.push({test:'payment_separation',actual:await state(c,f)});
  });
  await section('PSP','Confirmed/rejected; same provider event cannot have duplicate financial effects',async()=>{
    await rollbackCase(c,async()=>{
      const f=await fixture(ctx,c,'rejected',A);
      await negative(c,()=>paymentEvent(ctx,c,f,'confirmed',{5:'1'}),['P0001']);
      await negative(c,()=>paymentEvent(ctx,c,f,'confirmed',{6:'USD'}),['P0001']);
      await negative(c,()=>paymentEvent(ctx,c,f,'confirmed',{7:false}),['P0001']);
      assert(!(await paymentEvent(ctx,c,f,'confirmed',{3:ctx.run+'_crash13_confirmed'})),'EVENT_REUSE_PREVENTED');
      assert(await paymentEvent(ctx,c,f,'rejected'),'PSP_REJECTED_ACCEPTED');
      assert(!(await paymentEvent(ctx,c,f,'rejected')),'PSP_REJECTED_REPLAY_NO_EFFECT');
      assert(!(await paymentEvent(ctx,c,f,'confirmed')),'PSP_REJECTED_TERMINAL');
      const paidFixture=fixtures.payonly;
      assert(!(await paymentEvent(ctx,c,paidFixture)),'CONFIRMED_REPLAY_NO_EFFECT');
      const observed=await state(c,f);assert(observed.payment_status==='rejected'&&observed.booking_status==='pending_payment','REJECTED_STATE_READBACK');
      const n=first((await c.query('SELECT count(*)::int AS n FROM public.payment_provider_events WHERE payment_id=$1',[f.payment])).rows);assert(n.n===1,'REJECTED_EVENT_COUNT');
      ctx.evidence.push({test:'psp',actual:observed,eventCount:n.n,cleanup:'ROLLBACK; no committed residue'});
    });
  });
  await section('B13 CONCURRENCY','Real lock competition across prepare/mark; no duplicate execution/operation/send',async()=>{
    const f=fixtures.crash13,args=executionArgs(f,'b13');
    await rollbackCase(c,async()=>{
      await call(c,rpc.b13prepare,args);
      const failed=first(await call(c,rpc.b13fail,[...args,'PRE_SEND_FAILURE',false,null]));
      assert(failed.execution_state==='FAILED'&&!failed.reconciliation_required,'B13_PRE_SEND_FAILURE');
      const mark=first(await call(c,rpc.b13mark,args));assert(!mark.should_send,'B13_FAILED_NO_SEND');
      const row=(await c.query('SELECT attempt_count FROM app_private.flight_supplier_booking_executions WHERE booking_id=$1',[f.booking])).rows[0];assert(row.attempt_count===0,'B13_PRE_SEND_ZERO_ATTEMPTS');
    });
    const prep=await compete(ctx,c,'B13 competing prepare',x=>call(x,rpc.b13prepare,args));
    assert(prep.a[0].execution_id===prep.b?.[0].execution_id&&prep.b[0].replayed,'B13_SINGLE_PREPARE');
    const mark=await compete(ctx,c,'B13 competing mark',x=>call(x,rpc.b13mark,args));
    assert(mark.a[0].should_send&&!mark.b?.[0].should_send,'B13_SINGLE_SEND');
    const n=await counts(c,f);assert(n.b13===1&&n.operations===1,'B13_NO_DUPLICATE_ROWS');
    ctx.evidence.push({test:'B13_counts',actual:n});
  });
  await section('B13 CRASH WINDOW','Committed REQUEST_SENT survives session loss; recovery never grants a blind second send',async()=>{
    const f=fixtures.crash13,args=executionArgs(f,'b13');
    // compete() closed both worker sessions after commit and before any completion.
    const recovery=await connect(ctx.config,'b13-recovery');
    try {
      const persisted=await state(recovery,f);assert(persisted.b13==='REQUEST_SENT'&&persisted.booking_status==='processing','B13_COMMITTED_CRASH_STATE');
      await rollbackCase(recovery,async()=>{
        const r=first(await call(recovery,rpc.b13mark,args));assert(!r.should_send&&r.replayed,'B13_NO_BLIND_RETRY');
      });
      const failure=await compete(ctx,c,'B13 competing failure recovery',x=>call(x,rpc.b13fail,[...args,'SUPPLIER_TIMEOUT',true,null]));
      assert(failure.a[0].execution_state==='UNKNOWN'&&failure.b?.[0].replayed,'B13_FAILURE_SINGLE_EFFECT');
      const row=first((await recovery.query('SELECT execution_state,reconciliation_required,attempt_count,request_sent_at FROM app_private.flight_supplier_booking_executions WHERE booking_id=$1',[f.booking])).rows);
      assert(row.execution_state==='UNKNOWN'&&row.reconciliation_required&&row.attempt_count===1&&row.request_sent_at,'B13_DURABLE_UNKNOWN');
      await rollbackCase(recovery,async()=>{const mark=first(await call(recovery,rpc.b13mark,args));assert(!mark.should_send&&mark.execution_state==='UNKNOWN','B13_UNKNOWN_NO_BLIND_RETRY');});
      await rollbackCase(recovery,()=>negative(recovery,()=>call(recovery,rpc.b13complete,[...args,'ACCEPTED','SYNTHETIC-NOT-RECONCILED',null,digest('unknown'),'{}'])));
      ctx.evidence.push({test:'B13_crash',beforeRecovery:persisted,afterRecovery:row,externalCalls:0});
    } finally {await recovery.end();}
  });
  await section('B14 CONCURRENCY','B13 completion and B14 prepare/mark use real competing sessions',async()=>{
    const f=fixtures.issued,a13=executionArgs(f,'b13'),a14=executionArgs(f,'b14');
    await transaction(ctx,c,async()=>{await call(c,rpc.b13prepare,a13);await call(c,rpc.b13mark,a13);});
    const completeArgs=[...a13,'ACCEPTED','SYNTHETIC-'+ctx.run,'SYNTHETIC-PNR',digest('accepted'),'{}'];
    const result=await compete(ctx,c,'B13 competing complete',x=>call(x,rpc.b13complete,completeArgs));
    assert(result.a[0].execution_state==='ACCEPTED'&&result.b?.[0].replayed,'B13_COMPLETION_SINGLE_EFFECT');
    await rollbackCase(c,async()=>{const late=first(await call(c,rpc.b13fail,[...a13,'SUPPLIER_TIMEOUT',true,null]));assert(late.execution_state==='ACCEPTED'&&late.replayed,'B13_TERMINAL_CANNOT_REGRESS');});
    const p=await compete(ctx,c,'B14 competing prepare',x=>call(x,rpc.b14prepare,a14));
    assert(p.a[0].execution_id===p.b?.[0].execution_id&&p.b[0].replayed,'B14_SINGLE_AUTHORITY');
    await rollbackCase(c,async()=>{
      const failed=first(await call(c,rpc.b14fail,[...a14,'PRE_SEND_FAILURE',false]));assert(failed.execution_state==='FAILED','B14_PRE_SEND_FAILURE');
      const mark=first(await call(c,rpc.b14mark,[...a14,'confirm_booking']));assert(!mark.should_send,'B14_FAILED_NO_SEND');
    });
    const m=await compete(ctx,c,'B14 competing mark',x=>call(x,rpc.b14mark,[...a14,'confirm_booking']));
    assert(m.a[0].should_send&&!m.b?.[0].should_send,'B14_SINGLE_SEND');
    const n=await counts(c,f);assert(n.b14===1&&n.operations===2&&n.tickets===0,'B14_PREISSUE_COUNTS');
    ctx.evidence.push({test:'B14_counts',actual:n});
  });
  await section('B14 CRASH WINDOW','Committed request -> closed sender -> UNKNOWN recovery -> durable issued evidence, no reissue',async()=>{
    const f=fixtures.issued,args=executionArgs(f,'b14');
    const recovery=await connect(ctx.config,'b14-recovery');
    try {
      const before=await state(recovery,f);assert(before.b14==='REQUEST_SENT'&&before.tickets===0,'B14_COMMITTED_CRASH_STATE');
      await rollbackCase(recovery,async()=>{const r=first(await call(recovery,rpc.b14mark,[...args,'confirm_booking']));assert(!r.should_send,'B14_NO_BLIND_REISSUE');});
      const fail=await compete(ctx,c,'B14 competing failure recovery',x=>call(x,rpc.b14fail,[...args,'SUPPLIER_TIMEOUT',true]));
      assert(fail.a[0].execution_state==='UNKNOWN'&&fail.b?.[0].replayed,'B14_DURABLE_FAILURE');
      const row=first((await recovery.query('SELECT execution_state,reconciliation_required,attempt_count FROM app_private.flight_supplier_ticketing_executions WHERE booking_id=$1',[f.booking])).rows);
      assert(row.execution_state==='UNKNOWN'&&row.reconciliation_required&&row.attempt_count===1,'B14_UNKNOWN_PERSISTENCE');
      await rollbackCase(recovery,async()=>{const mark=first(await call(recovery,rpc.b14mark,[...args,'confirm_booking']));assert(!mark.should_send&&mark.execution_state==='UNKNOWN','B14_UNKNOWN_NO_BLIND_REISSUE');});
      const t=tickets(ctx,f,'AVAILABLE'),completed=[...args,'ISSUED',JSON.stringify(t),digest('reconciled-issued'),'{}'];
      await rollbackCase(recovery,async()=>{
        await negative(recovery,()=>call(recovery,rpc.b14complete,[...args,'ISSUED','[]',digest('empty'),'{}']));
        await negative(recovery,()=>call(recovery,rpc.b14complete,[...args,'ISSUED',JSON.stringify(t.slice(0,1)),digest('partial'),'{}']));
        await negative(recovery,()=>call(recovery,rpc.b14complete,[...args,'ISSUED',JSON.stringify([t[0],t[0]]),digest('duplicate'),'{}']));
        const dup=[t[0],{...t[1],ticketNumber:t[0].ticketNumber}];await negative(recovery,()=>call(recovery,rpc.b14complete,[...args,'ISSUED',JSON.stringify(dup),digest('duplicate-number'),'{}']));
      });
      const result=await compete(ctx,c,'B14 competing trusted completion',x=>call(x,rpc.b14complete,completed));
      assert(result.a[0].execution_state==='ISSUED'&&result.b?.[0].replayed,'B14_SINGLE_COMPLETION');
      const persisted=await state(recovery,f),n=await counts(recovery,f);
      assert(persisted.b14==='ISSUED'&&persisted.booking_status==='ticketed'&&persisted.tickets===2&&n.operations===2,'B14_ISSUED_PERSISTENCE');
      await rollbackCase(recovery,async()=>{const late=first(await call(recovery,rpc.b14fail,[...args,'SUPPLIER_TIMEOUT',true]));assert(late.execution_state==='ISSUED'&&late.replayed,'B14_TERMINAL_CANNOT_REGRESS');});
      ctx.evidence.push({test:'B14_crash',beforeRecovery:before,afterUnknown:row,afterIssued:persisted,counts:n,externalCalls:0});
    }finally{await recovery.end();}
  });
  await section('TICKET ARTIFACT GATE','Only trusted AVAILABLE artifact grants download; payment/PNR/reference/NONE/METADATA_ONLY do not',async()=>{
    for(const [label,availability] of [['none','NONE'],['metadata','METADATA_ONLY']]) {
      const f=fixtures[label];await transaction(ctx,c,()=>accepted(c,f));
      const bookings=await mustRpc(A,'get_my_bookings');assert(bookings.some(r=>r.booking_ref===f.ref&&r.status==='confirmed'),'CONFIRMED_MY_TRIPS_BEFORE_TICKET');
      const pre=await mustRpc(A,'get_my_flight_ticketing_v1');assert(!pre.some(r=>r.booking_ref===f.ref),'PNR_REFERENCE_INSUFFICIENT');
      await transaction(ctx,c,()=>issue(ctx,c,f,availability));
    }
    const rows=await mustRpc(A,'get_my_flight_ticketing_v1');
    for(const label of ['issued','none','metadata']) {
      const r=rows.find(r=>r.booking_ref===fixtures[label].ref);
      assert(r?.ticketing_state==='ISSUED'&&Number(r.ticket_count)===2&&r.artifact_available===(label==='issued'),'AUTHENTICATED_ARTIFACT_PROJECTION');
    }
    ctx.evidence.push({test:'artifact_projection',rows});
  });
  await section('BANKAK','Receipt ownership, consumption/reuse/expiry; finance review cannot supplier-confirm',async()=>{
    const f=fixtures.bankak,path=`${A.id}/${f.payment}/${ctx.run}.png`;
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    ctx.journal.storage.push(path);ctx.save();
    const upload=async(actor,name)=>{
      const r=await fetch(`https://pdnuswmljownjzjzpoop.supabase.co/storage/v1/object/receipts/${name}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:process.env.HAJIZ_STAGING_PUBLISHABLE_KEY,Authorization:`Bearer ${actor.token}`,'Content-Type':'image/png','x-upsert':'false'},body:png});
      let body;try{body=await r.json();}catch{}return {status:r.status,denied:r.status===403||body?.statusCode==='403'};
    };
    const good=await upload(A,path);assert(good.status>=200&&good.status<300,'AUTHENTICATED_RECEIPT_UPLOAD');
    const wrongOwner=path.replace('.png','-wrongowner.png'),wrongMethod=`${A.id}/${fixtures.payonly.payment}/${ctx.run}-wrongmethod.png`,expiredPath=path.replace('.png','-expired.png');
    ctx.journal.storage.push(wrongOwner,wrongMethod,expiredPath);ctx.save();
    assert((await upload(B,wrongOwner)).denied,'RECEIPT_WRONG_OWNER_DENIED');
    assert((await upload(A,wrongMethod)).denied,'RECEIPT_WRONG_METHOD_DENIED');
    const duplicate=await upload(A,path);assert([400,409].includes(duplicate.status),'RECEIPT_OVERWRITE_DENIED');
    const originalExpiry=(await state(c,f)).expires_at;
    await transaction(ctx,c,()=>c.query("UPDATE public.payments SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.payment]));
    assert((await upload(A,expiredPath)).denied,'AUTHENTICATED_BANKAK_EXPIRY');
    await transaction(ctx,c,()=>c.query('UPDATE public.payments SET expires_at=$2 WHERE id=$1',[f.payment,originalExpiry]));
    const receiptArgs=[f.payment,path,png.length,'image/png',digest(png),JSON.stringify({s1bRun:ctx.run,synthetic:true})];
    await rollbackCase(c,async()=>{
      await negative(c,()=>call(c,rpc.receipt,[f.payment,`${B.id}/${f.payment}/wrong.png`,png.length,'image/png',digest(png),'{}']));
      await c.query("UPDATE public.payments SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.payment]);
      await negative(c,()=>call(c,rpc.receipt,receiptArgs));
    });
    const forbidden=await userRpc(A,rpc.review,{p_payment_id:f.payment,p_decision:'confirmed',p_reason:ctx.run});assert(!forbidden.ok&&forbidden.data?.code==='42501','CUSTOMER_CANNOT_REVIEW');
    await transaction(ctx,c,()=>call(c,rpc.receipt,receiptArgs));
    const under=await state(c,f);assert(under.payment_status==='under_review'&&under.booking_status==='pending_payment','RECEIPT_NOT_CONFIRMATION');
    await rollbackCase(c,async()=>{
      await negative(c,()=>call(c,rpc.receipt,receiptArgs));
      await negative(c,()=>c.query('DELETE FROM public.payment_receipts WHERE payment_id=$1',[f.payment]),['P0001']);
    });
    const preReview=await budgetCheck(c,ctx);assert(preReview['public.payment_audit'].length<28,'RESERVE_ONE_REVIEW_AUDIT_ROW');
    await mustRpc(F,rpc.review,{p_payment_id:f.payment,p_decision:'confirmed',p_reason:ctx.run});
    const reviewed=await state(c,f);assert(reviewed.payment_status==='confirmed'&&reviewed.booking_status==='payment_confirmed','BANKAK_PAYMENT_ONLY');
    await rollbackCase(c,()=>negative(c,()=>call(c,rpc.receipt,[fixtures.payonly.payment,path,png.length,'image/png',digest(png),'{}'])));
    ctx.evidence.push({test:'Bankak',underReview:under,reviewed,storageUploadStatus:good});
    fixtures.payonly=f; // Reuse confirmed Bankak for final payment-only My Trips projection.
  });
  await section('RLS / IDOR','Normal authenticated A/B and anonymous paths; never postgres as user evidence',async()=>{
    for(const actor of [A,B]) {
      const other=actor===A?B:A;
      const owned=ctx.journal.fixtures.filter(f=>f.owner===actor.id&&f.committed),foreign=ctx.journal.fixtures.filter(f=>f.owner===other.id&&f.committed);
      for(const name of ['get_my_bookings','get_my_payments','get_my_flight_ticketing_v1']) {
        const rows=await mustRpc(actor,name);assert(Array.isArray(rows),'AUTH_RPC_ARRAY');
        assert(rows.every(r=>owned.some(f=>f.ref===r.booking_ref)),'OWNER_ONLY_'+name);
        if(name!=='get_my_flight_ticketing_v1')assert(rows.length===owned.length,'POSITIVE_OWNER_VISIBILITY_'+name);
      }
      for(const f of foreign)assert((await mustRpc(actor,'get_my_flight_ticket_records_v1',{p_booking_ref:f.ref})).length===0,'CROSS_USER_TICKET_DENIED');
      for(const table of ['bookings','payments','payment_receipts','payment_provider_events','payment_audit']) {
        const r=await http(`/rest/v1/${table}?select=id&limit=1`,{method:'GET',token:actor.token});
        assert((r.status===401||r.status===403)&&r.data?.code==='42501','RPC_ONLY_DIRECT_DENIED_'+table);
      }
      for(const table of ['flight_booking_intents','flight_payment_initiations','flight_supplier_booking_executions','flight_supplier_ticketing_executions','flight_ticket_records','supplier_operations']) {
        const r=await http(`/rest/v1/${table}?select=id&limit=1`,{method:'GET',token:actor.token,headers:{'Accept-Profile':'app_private'}});
        assert(!r.ok&&['42501','PGRST106'].includes(r.data?.code),'PRIVATE_API_BOUNDARY_'+table);
      }
      const profile=await http('/rest/v1/profiles?select=id',{method:'GET',token:actor.token});assert(profile.ok&&profile.data.every(r=>r.id===actor.id),'PROFILE_SELF_ONLY');
      const protectedWrite=await http('/rest/v1/profiles?id=eq.'+actor.id,{method:'PATCH',token:actor.token,body:{commission_rate:0.5,finance_enabled:true},headers:{Prefer:'return=representation'}});
      assert(!protectedWrite.ok&&protectedWrite.data?.code==='42501','NO_CLIENT_FINANCIAL_AUTHORITY');
      const target=foreign[0];
      const internalCases=[
        [rpc.getIntent,{p_owner_id:other.id,p_booking_intent_id:target.intent}],
        [rpc.preparePayment,{p_owner_id:other.id,p_booking_intent_id:target.intent,p_payment_method:'card',p_idempotency_key:'hpi_req_'+ctx.run+'_browser',p_request_digest:digest('browser')}],
        [rpc.b13prepare,{p_owner_id:other.id,p_booking_id:target.booking,p_idempotency_key:target.b13,p_request_digest:target.digest}],
        [rpc.b14prepare,{p_owner_id:other.id,p_booking_id:target.booking,p_idempotency_key:target.b14,p_request_digest:target.digest}],
        [rpc.event,{p_payment_id:target.payment,p_target:'confirmed',p_provider:'mock_psp',p_provider_event_id:ctx.run+'_browser',p_provider_status:'confirmed',p_amount:2600,p_currency:'SDG',p_verified:true,p_payload_digest:digest('browser'),p_occurred_at:new Date().toISOString(),p_raw_payload:null}],
        [rpc.receipt,{p_payment_id:target.payment,p_object_name:'SYNTHETIC_INVALID',p_byte_size:1,p_detected_mime:'image/png',p_sha256:digest('browser'),p_request_context:{s1bRun:ctx.run}}]
      ];
      for(const [name,body] of internalCases){const r=await userRpc(actor,name,body);assert(!r.ok&&r.data?.code==='42501','INTERNAL_RPC_NOT_BROWSER_AUTHORITY_'+name);}
      const write=await http('/rest/v1/payments?id=eq.'+owned[0].payment,{method:'PATCH',token:actor.token,body:{amount:1,status:'confirmed'},headers:{Prefer:'return=representation'}});
      assert(!write.ok&&write.data?.code==='42501','NO_BROWSER_PAYMENT_AUTHORITY');
    }
    const anon=await userRpc(null,'get_my_bookings');assert(!anon.ok&&anon.data?.code==='42501','ANON_DENIED');
    ctx.evidence.push({test:'RLS',identityA:A.id,identityB:B.id,normalPasswordSignIn:true,ownerAndCrossOwnerAssertions:true});
  });
  await section('MY TRIPS','Owner-scoped real projections and no internal financial/storage/operation leakage',async()=>{
    const bookings=await mustRpc(A,'get_my_bookings'),payment=await mustRpc(A,'get_my_payments'),ticketing=await mustRpc(A,'get_my_flight_ticketing_v1');
    for(const [label,status] of [['payonly','payment_confirmed'],['crash13','processing'],['issued','ticketed'],['none','ticketed'],['metadata','ticketed']]) assert(bookings.some(r=>r.booking_ref===fixtures[label].ref&&r.status===status),'MY_TRIPS_'+status);
    for(const rows of [bookings,payment,ticketing])for(const r of rows)for(const key of ['net_cost','supplier_net','operation_id','artifact_ref','provider_session_token'])assert(!(key in r),'PROJECTION_LEAK_'+key);
    const presentation=toMyTripsPresentation(bookings,payment,ticketing);
    for(const label of ['issued','none','metadata','payonly','crash13'])assert(presentation.find(r=>r.reference===fixtures[label].ref)?.canDownloadTicket===(label==='issued'),'C1_PRESENTATION_DOWNLOAD_GATE');
    for(const label of ['issued','none','metadata']) {
      const records=await mustRpc(A,'get_my_flight_ticket_records_v1',{p_booking_ref:fixtures[label].ref});assert(records.length===2,'OWNER_TICKET_RECORDS');
      for(const r of records)assert(!('artifact_ref'in r)&&!('operation_id'in r),'TICKET_INTERNALS_NOT_EXPOSED');
    }
    ctx.evidence.push({test:'MyTrips',bookings,payments:payment,ticketing,presentation});
  });
  await section('EXPIRY','Server-time expiry cannot be bypassed by caller-supplied event time',async()=>{
    await rollbackCase(c,async()=>{
      const f=await fixture(ctx,c,'expired',A);
      await c.query("UPDATE public.payments SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.payment]);
      const timing=first((await c.query(`SELECT expires_at::text,
        transaction_timestamp()::text AS authoritative_time,
        clock_timestamp()::text AS observed_wall_time,
        expires_at<=transaction_timestamp() AS expired_by_function_clock
        FROM public.payments WHERE id=$1`,[f.payment])).rows);
      ctx.evidence.push({test:'Expiry setup',payment:f.payment,timing,callerOccurredAt:'2099-01-01T00:00:00Z',cleanup:'ROLLBACK; no committed residue'});ctx.save();
      assert(timing.expired_by_function_clock===true,'EXPIRED_FIXTURE_NOT_EXPIRED_BY_FUNCTION_CLOCK');
      const confirmationAccepted=await paymentEvent(ctx,c,f,'confirmed',{9:'2099-01-01T00:00:00Z'});
      ctx.evidence.push({test:'Expiry future caller time',payment:f.payment,confirmationAccepted,expected:false,cleanup:'ROLLBACK; no committed residue'});ctx.save();
      assert(!confirmationAccepted,'EXPIRED_CONFIRMATION_FAILS_CLOSED');
      assert(await paymentEvent(ctx,c,f,'expired'),'EXPIRY_TRANSITION');
      const actual=await state(c,f);assert(actual.payment_status==='expired','EXPIRED_STATE_READBACK');
      ctx.evidence.push({test:'Expiry',actual,cleanup:'ROLLBACK; no committed residue'});
    });
    await rollbackCase(c,async()=>{
      // Backdate only this run's intent/offer fixture to exercise the real time predicates.
      await c.query("UPDATE app_private.flight_booking_intents SET created_at=transaction_timestamp()-interval '2 hours',valid_until=transaction_timestamp()-interval '1 hour' WHERE owner_id=$1 AND booking_intent_id=$2",[A.id,fixtures.payonly.intent]);
      await negative(c,()=>call(c,rpc.preparePayment,[A.id,fixtures.payonly.intent,'card','hpi_req_'+ctx.run+'_expiredintent',digest('expiredintent')]));
      await c.query("UPDATE public.offers SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[ctx.journal.offer]);
      await negative(c,()=>call(c,rpc.preparePayment,[B.id,fixtures.ownerb.intent,'card','hpi_req_'+ctx.run+'_expiredoffer',digest('expiredoffer')]));
    });
  });
  const finalCounts=await budgetCheck(c,ctx);
  assert(finalCounts['public.payment_audit'].length===28&&finalCounts['public.payment_provider_events'].length===5&&finalCounts['public.payment_receipts'].length===1,'EXACT_SUCCESS_PATH_AUDIT_COUNTS');
  ctx.evidence.push({test:'Exact committed footprint',paymentAudit:28,providerEvents:5,receipts:1,bookings:6});ctx.save();
}
