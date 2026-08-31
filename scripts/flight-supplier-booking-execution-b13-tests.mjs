import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import { createSupplierRegistry } from "../src/server/suppliers/supplierRegistry.js"
import {
  createFlightSupplierBookingExecutionServiceV1,
  FlightSupplierBookingExecutionError,
  SupplierBookingAttemptError,
} from "../src/server/suppliers/flightSupplierBookingExecutionV1.js"
import {
  createFlightSupplierBookingExecutionTestStateV1,
  createProcessLocalFlightSupplierBookingExecutionStoreV1,
  createSupabaseFlightSupplierBookingExecutionStoreV1,
} from "../src/server/suppliers/flightSupplierBookingExecutionStoreV1.js"
import {
  createInternalFlightSupplierBookingExecutionHandlerV1,
  INTERNAL_FLIGHT_SUPPLIER_BOOKING_REQUEST_VERSION,
  validateInternalFlightSupplierBookingRequestV1,
} from "../src/server/http/internalFlightSupplierBookingExecutionV1.js"

let passed = 0
const test = async (name, fn) => { try { await fn(); passed += 1; console.log(`✓ ${name}`) } catch (error) { console.error(`✗ ${name}`); throw error } }
const OWNER = "11111111-1111-4111-8111-111111111111"
const OTHER_OWNER = "11111111-1111-4111-9111-111111111112"
const BOOKING = "22222222-2222-4222-8222-222222222222"
const PAYMENT = "33333333-3333-4333-8333-333333333333"
const INTENT = "44444444-4444-4444-8444-444444444444"
const OFFER = "55555555-5555-4555-8555-555555555555"
const KEY = "hsb_req_1234567890abcdef"
const baseRequest = Object.freeze({ bookingId: BOOKING, idempotencyKey: KEY, ownerContext: Object.freeze({ ownerId: OWNER, source: "injected-test" }) })
const processing = Object.freeze({ supplierBookingRef: "MOCK-BOOKING-123", providerName: "mock", providerStatusRaw: "MOCK_PROCESSING", operationalOutcome: "processing", privateMetadata: Object.freeze({ synthetic: true }) })
const confirmed = Object.freeze({ supplierBookingRef: "MOCK-BOOKING-123", providerName: "mock", providerStatusRaw: "MOCK_CONFIRMED", operationalOutcome: "confirmed" })

const seed = ({ paymentStatus = "confirmed", bookingStatus = "payment_confirmed", ownerId = OWNER, mutate = () => {} } = {}) => {
  const value = {
    bookings: [{ id: BOOKING, bookingRef: "HJZ-B13TEST0001", ownerId, offerId: OFFER, status: bookingStatus, supplierProvider: "mock", supplierContractVersion: "flight-offer/v1", supplierReference: null }],
    payments: [{ id: PAYMENT, bookingId: BOOKING, ownerId, status: paymentStatus }],
    initiations: [{ id: "66666666-6666-4666-8666-666666666666", bookingId: BOOKING, paymentId: PAYMENT, bookingIntentId: INTENT, ownerId, state: "MATERIALIZED" }],
    intents: [{ id: INTENT, bookingIntentId: "hbi_v1_0123456789abcdef0123456789abcdef", ownerId, internalOfferId: "hfo_0000000000000001", provider: "mock", providerOfferRef: "mock-offer-dxb-krt-ek735", travelers: [{ travelerKey: "adt-1", firstName: "PII_SENTINEL_AMAL" }], contact: { email: "pii-sentinel@example.invalid" } }],
    offers: [{ id: OFFER, internalOfferId: "hfo_0000000000000001", provider: "mock", providerOfferRef: "mock-offer-dxb-krt-ek735" }],
  }
  mutate(value)
  return value
}

const customAdapter = ({ createBooking, getBookingStatus, createEnabled = true, statusEnabled = true } = {}) => {
  const base = createMockFlightSupplier()
  return Object.freeze({
    ...base,
    capabilities: Object.freeze({ ...base.capabilities, create_booking: createEnabled, get_booking_status: statusEnabled }),
    ...(createBooking ? { createBooking } : {}),
    ...(getBookingStatus ? { getBookingStatus } : {}),
  })
}

const harness = ({ seedValue = seed(), adapter = customAdapter({ createBooking: async () => processing, getBookingStatus: async () => confirmed }), state, timeoutMs = 100 } = {}) => {
  const shared = state ?? createFlightSupplierBookingExecutionTestStateV1(seedValue)
  const store = createProcessLocalFlightSupplierBookingExecutionStoreV1({ state: shared, clock: () => Date.parse("2026-08-29T12:00:00.000Z") })
  const registry = createSupplierRegistry({ adapters: [adapter], enabledProviderNames: ["mock"], defaultProviderName: "mock" })
  return { state: shared, store, service: createFlightSupplierBookingExecutionServiceV1({ store, supplierRegistry: registry, timeoutMs }) }
}

await test("B13-01 exact internal request accepts booking and idempotency only", () => assert.deepEqual(validateInternalFlightSupplierBookingRequestV1({ contractVersion: INTERNAL_FLIGHT_SUPPLIER_BOOKING_REQUEST_VERSION, bookingId: BOOKING, idempotencyKey: KEY }), { bookingId: BOOKING, idempotencyKey: KEY }))
for (const [name, field, value] of [["B13-02 browser provider is rejected","provider","mock"],["B13-03 browser price is rejected","price","1.00"],["B13-04 browser userId is rejected","userId",OWNER],["B13-05 browser PNR is rejected","pnr","FAKEPNR"]]) await test(name, () => assert.throws(() => validateInternalFlightSupplierBookingRequestV1({ contractVersion: INTERNAL_FLIGHT_SUPPLIER_BOOKING_REQUEST_VERSION, bookingId: BOOKING, idempotencyKey: KEY, [field]: value }), /invalid/))
await test("B13-06 payment awaiting rejects supplier execution", async () => { const { service } = harness({ seedValue: seed({ paymentStatus: "awaiting" }) }); await assert.rejects(service.execute(baseRequest), (error) => error instanceof FlightSupplierBookingExecutionError && error.code === "PAYMENT_NOT_CONFIRMED") })
await test("B13-07 confirmed payment with pending_payment booking rejects", async () => { const { service } = harness({ seedValue: seed({ bookingStatus: "pending_payment" }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "BOOKING_NOT_PAYMENT_CONFIRMED") })
await test("B13-08 confirmed payment plus payment_confirmed booking allows", async () => { const { service } = harness(); assert.equal((await service.execute(baseRequest)).executionStatus, "PROCESSING") })
await test("B13-09 exact payment-booking relationship is mandatory", async () => { const { service } = harness({ seedValue: seed({ mutate: (value) => { value.payments[0].bookingId = "77777777-7777-4777-8777-777777777777" } }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "PAYMENT_BOOKING_MISMATCH") })
await test("B13-10 B11 and B12 lineage is mandatory", async () => { const { service } = harness({ seedValue: seed({ mutate: (value) => { value.initiations[0].state = "PREPARED" } }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "BOOKING_LINEAGE_INVALID") })
await test("B13-11 cross-owner booking is indistinguishable from not found", async () => { const { service } = harness({ seedValue: seed({ ownerId: OTHER_OWNER }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "BOOKING_NOT_FOUND") })

await test("B13-12 exact internalOfferId is resolved server-side", async () => { let token; const { service } = harness({ adapter: customAdapter({ createBooking: async (request) => { token = request; return processing } }) }); await service.execute(baseRequest); assert.match(token.trustedTravelerToken, /^hst_v1_[a-f0-9]{64}$/) })
await test("B13-13 exact provider is resolved server-side", async () => { let called = 0; const { service } = harness({ adapter: customAdapter({ createBooking: async () => { called += 1; return processing } }) }); await service.execute(baseRequest); assert.equal(called, 1) })
await test("B13-14 exact providerOfferRef reaches the adapter", async () => { let request; const { service } = harness({ adapter: customAdapter({ createBooking: async (value) => { request = value; return processing } }) }); await service.execute(baseRequest); assert.equal(request.supplierOfferRef, "mock-offer-dxb-krt-ek735") })
await test("B13-15 persisted supplier identity mismatch fails before adapter", async () => { let calls=0; const { service } = harness({ seedValue: seed({ mutate: (value) => { value.offers[0].providerOfferRef="substitute" } }), adapter: customAdapter({ createBooking: async () => { calls+=1; return processing } }) }); await assert.rejects(service.execute(baseRequest), (error)=>error.code==="SUPPLIER_IDENTITY_MISMATCH"); assert.equal(calls,0) })
await test("B13-16 adapter provider substitution becomes unknown outcome", async () => { const { service } = harness({ adapter: customAdapter({ createBooking: async () => ({ ...processing, providerName: "travelport" }) }) }); const result=await service.execute(baseRequest); assert.equal(result.executionStatus,"RECONCILIATION_REQUIRED") })

await test("B13-17 identical replay returns the same execution", async () => { let calls=0; const { service }=harness({adapter:customAdapter({createBooking:async()=>{calls+=1;return processing}})}); const a=await service.execute(baseRequest); const b=await service.execute(baseRequest); assert.deepEqual(b,a); assert.equal(calls,1) })
await test("B13-18 replay creates one durable operation", async () => { const { service,store }=harness(); await service.execute(baseRequest); await service.execute(baseRequest); assert.equal(store.counts().operations,1) })
await test("B13-19 concurrent double execution sends once", async () => { let release,calls=0; const adapter=customAdapter({createBooking:()=>{calls+=1;return new Promise((resolve)=>{release=()=>resolve(processing)})}}); const {service}=harness({adapter}); const a=service.execute(baseRequest); const b=service.execute(baseRequest); assert.equal(a,b); await new Promise((resolve)=>setImmediate(resolve)); release(); await Promise.all([a,b]); assert.equal(calls,1) })
await test("B13-20 restart uses shared durable semantics", async () => { let calls=0; const adapter=customAdapter({createBooking:async()=>{calls+=1;return processing}}); const first=harness({adapter}); await first.service.execute(baseRequest); const second=harness({state:first.state,adapter}); assert.equal((await second.service.execute(baseRequest)).executionStatus,"PROCESSING"); assert.equal(calls,1) })
await test("B13-21 post-success replay returns confirmed without create", async () => { let creates=0; const adapter=customAdapter({createBooking:async()=>{creates+=1;return processing},getBookingStatus:async()=>confirmed}); const {service}=harness({adapter}); await service.execute(baseRequest); await service.reconcile(baseRequest); const replay=await service.execute(baseRequest); assert.equal(replay.executionStatus,"CONFIRMED"); assert.equal(creates,1) })
await test("B13-22 changed key for one booking conflicts", async () => { const {service}=harness(); await service.execute(baseRequest); await assert.rejects(service.execute({...baseRequest,idempotencyKey:"hsb_req_fedcba0987654321"}),(error)=>error.code==="SUPPLIER_EXECUTION_IDEMPOTENCY_CONFLICT") })

await test("B13-23 booking moves to processing before supplier settles", async () => { let release; const h=harness({adapter:customAdapter({createBooking:()=>new Promise((resolve)=>{release=()=>resolve(processing)})})}); const pending=h.service.execute(baseRequest); await new Promise((resolve)=>setImmediate(resolve)); assert.equal(h.store.getBooking(BOOKING).status,"processing"); release(); await pending })
await test("B13-24 supplier processing does not claim confirmation", async () => { const {service}=harness(); const result=await service.execute(baseRequest); assert.equal(result.bookingStatus,"processing"); assert.equal(result.executionStatus,"PROCESSING") })
await test("B13-25 actual supplier acceptance moves only to confirmed", async () => { const {service}=harness({adapter:customAdapter({createBooking:async()=>confirmed})}); const result=await service.execute(baseRequest); assert.equal(result.bookingStatus,"confirmed"); assert.equal(result.executionStatus,"CONFIRMED") })
await test("B13-26 B13 never marks ticketed", async () => { const h=harness({adapter:customAdapter({createBooking:async()=>confirmed})}); await h.service.execute(baseRequest); assert.notEqual(h.store.getBooking(BOOKING).status,"ticketed") })
await test("B13-27 B13 never marks completed", async () => { const h=harness({adapter:customAdapter({createBooking:async()=>confirmed})}); await h.service.execute(baseRequest); assert.notEqual(h.store.getBooking(BOOKING).status,"completed") })
await test("B13-28 reconciliation polls status without recreating", async () => { let creates=0,reads=0; const {service}=harness({adapter:customAdapter({createBooking:async()=>{creates+=1;return processing},getBookingStatus:async()=>{reads+=1;return confirmed}})}); await service.execute(baseRequest); const result=await service.reconcile(baseRequest); assert.equal(result.executionStatus,"CONFIRMED"); assert.equal(creates,1); assert.equal(reads,1) })

await test("B13-29 definite supplier rejection is distinct", async () => { const {service}=harness({adapter:customAdapter({createBooking:async()=>{throw new SupplierBookingAttemptError("SUPPLIER_REJECTED",{mayHaveReachedSupplier:false})}})}); assert.equal((await service.execute(baseRequest)).executionStatus,"REJECTED") })
await test("B13-30 pre-send capability failure is not unknown", async () => { const {service,store}=harness({adapter:customAdapter({createEnabled:false})}); const result=await service.execute(baseRequest); assert.equal(result.executionStatus,"FAILED"); assert.equal(store.getBooking(BOOKING).status,"payment_confirmed") })
await test("B13-30A pre-aborted request never invokes the adapter or claims processing", async () => { let calls=0; const controller=new AbortController();controller.abort();const {service,store}=harness({adapter:customAdapter({createBooking:async()=>{calls+=1;return processing}})});assert.equal((await service.execute(baseRequest,{signal:controller.signal})).executionStatus,"FAILED");assert.equal(calls,0);assert.equal(store.getBooking(BOOKING).status,"payment_confirmed") })
await test("B13-31 post-send timeout becomes unknown", async () => { const {service}=harness({adapter:customAdapter({createBooking:()=>new Promise(()=>{})}),timeoutMs:5}); const result=await service.execute(baseRequest); assert.equal(result.executionStatus,"RECONCILIATION_REQUIRED"); assert.equal(result.reconciliationRequired,true) })
await test("B13-32 unknown outcome is never blindly retried", async () => { let calls=0; const {service}=harness({adapter:customAdapter({createBooking:async()=>{calls+=1;throw new Error("opaque")}})}); await service.execute(baseRequest); await service.execute(baseRequest); assert.equal(calls,1) })
await test("B13-33 malformed supplier response becomes unknown", async () => { const {service}=harness({adapter:customAdapter({createBooking:async()=>({ok:true})})}); assert.equal((await service.execute(baseRequest)).executionStatus,"RECONCILIATION_REQUIRED") })
await test("B13-34 unclassified internal post-send failure becomes unknown", async () => { const {service}=harness({adapter:customAdapter({createBooking:async()=>{throw new Error("private supplier failure")}})}); assert.equal((await service.execute(baseRequest)).executionStatus,"RECONCILIATION_REQUIRED") })
await test("B13-35 unknown without supplier ref cannot poll or create", async () => { let creates=0,reads=0; const {service}=harness({adapter:customAdapter({createBooking:async()=>{creates+=1;throw new Error("opaque")},getBookingStatus:async()=>{reads+=1;return confirmed}})}); await service.execute(baseRequest); const result=await service.reconcile(baseRequest); assert.equal(result.executionStatus,"RECONCILIATION_REQUIRED"); assert.equal(creates,1); assert.equal(reads,0) })
await test("B13-36 unknown with trusted ref may reconcile by status only", async () => { let creates=0,reads=0; const {service}=harness({adapter:customAdapter({createBooking:async()=>{creates+=1;throw new SupplierBookingAttemptError("UNKNOWN_OUTCOME",{mayHaveReachedSupplier:true,supplierBookingRef:"MOCK-BOOKING-123"})},getBookingStatus:async()=>{reads+=1;return confirmed}})}); await service.execute(baseRequest); const result=await service.reconcile(baseRequest); assert.equal(result.executionStatus,"CONFIRMED"); assert.equal(creates,1); assert.equal(reads,1) })
await test("B13-37 ticket-like supplier result is not accepted by B13", async () => { const {service}=harness({adapter:customAdapter({createBooking:async()=>({...confirmed,operationalOutcome:"ticketed",ticketMetadata:{available:true}})})}); assert.equal((await service.execute(baseRequest)).executionStatus,"RECONCILIATION_REQUIRED") })

await test("B13-38 public result contains no PII or supplier identity", async () => { const {service}=harness(); const text=JSON.stringify(await service.execute(baseRequest)); for(const sentinel of ["PII_SENTINEL","example.invalid","mock-offer","supplierBookingRef","provider","supplierLocator"]) assert.equal(text.includes(sentinel),false) })
await test("B13-39 generic internal HTTP errors contain no PII", async () => { const handler=createInternalFlightSupplierBookingExecutionHandlerV1({service:{execute:async()=>{throw new Error("PII_SENTINEL_AMAL")}},authorizeInternalRequest:async()=>true,resolveTrustedOwnerContext:async()=>baseRequest.ownerContext}); const result=await handler({method:"POST",body:{contractVersion:INTERNAL_FLIGHT_SUPPLIER_BOOKING_REQUEST_VERSION,bookingId:BOOKING,idempotencyKey:KEY}}); assert.equal(JSON.stringify(result).includes("PII_SENTINEL"),false) })
await test("B13-40 internal handler rejects non-internal callers", async () => { const handler=createInternalFlightSupplierBookingExecutionHandlerV1({service:{execute:async()=>({})},authorizeInternalRequest:async()=>false,resolveTrustedOwnerContext:async()=>baseRequest.ownerContext}); assert.equal((await handler({method:"POST",body:{}})).status,403) })
await test("B13-41 internal handler resolves owner outside the body", async () => { let received; const handler=createInternalFlightSupplierBookingExecutionHandlerV1({service:{execute:async(value)=>{received=value;return {ok:true}}},authorizeInternalRequest:async()=>true,resolveTrustedOwnerContext:async()=>baseRequest.ownerContext}); await handler({method:"POST",body:{contractVersion:INTERNAL_FLIGHT_SUPPLIER_BOOKING_REQUEST_VERSION,bookingId:BOOKING,idempotencyKey:KEY}}); assert.equal(received.ownerContext.ownerId,OWNER) })

const serviceSource=await fs.readFile(new URL("../src/server/suppliers/flightSupplierBookingExecutionV1.js",import.meta.url),"utf8")
const storeSource=await fs.readFile(new URL("../src/server/suppliers/flightSupplierBookingExecutionStoreV1.js",import.meta.url),"utf8")
await test("B13-42 source logs no PII or supplier request",()=>assert.doesNotMatch(serviceSource+storeSource,/console\.|logger\.|JSON\.stringify\(.*traveler/i))
await test("B13-43 payment firewall contains no confirmation authority",()=>assert.doesNotMatch(serviceSource+storeSource,/apply_payment_event|review_bankak_payment|register_inspected_receipt|confirmPayment|walletDebit|create_booking_from_wallet/i))
await test("B13-44 ticketing firewall contains no execution authority",()=>assert.doesNotMatch(serviceSource+storeSource,/issueTicket|retrieveTicket|apply_booking_transition[^\n]*ticketed|status\s*[:=]\s*["']ticketed["']/i))
await test("B13-45 production store delegates only to service RPCs",()=>{assert.match(storeSource,/client\.rpc\(name, parameters\)/);assert.match(storeSource,/"prepare_flight_supplier_booking_execution_v1"/);assert.match(storeSource,/"mark_flight_supplier_booking_request_sent_v1"/);assert.match(storeSource,/"complete_flight_supplier_booking_execution_v1"/);assert.match(storeSource,/"record_flight_supplier_booking_failure_v1"/);assert.doesNotMatch(storeSource,/\.from\(|\.insert\(|\.update\(|service[_-]?role.{0,20}(key|secret)/i)})
await test("B13-45A Supabase store sends only server authority fields",async()=>{let call;const client={rpc:async(name,parameters)=>{call={name,parameters};return{data:[{execution_id:INTENT,operation_id:OFFER,booking_id:BOOKING,booking_ref:"HJZ-B13TEST0001",payment_id:PAYMENT,booking_intent_id:INTENT,owner_id:OWNER,provider:"mock",internal_offer_id:"hfo_0000000000000001",provider_offer_ref:"mock-offer-dxb-krt-ek735",traveler_snapshot:[],contact_snapshot:{},idempotency_key:KEY,request_digest:"a".repeat(64),execution_state:"PREPARED",booking_status:"payment_confirmed",payment_status:"confirmed",reconciliation_required:false,replayed:false}],error:null}}};const durable=createSupabaseFlightSupplierBookingExecutionStoreV1({client});await durable.prepare({ownerId:OWNER,bookingId:BOOKING,idempotencyKey:KEY,requestDigest:"a".repeat(64)});assert.equal(call.name,"prepare_flight_supplier_booking_execution_v1");assert.deepEqual(Object.keys(call.parameters).sort(),["p_booking_id","p_idempotency_key","p_owner_id","p_request_digest"])})

const vite=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"})
const {FlightSupplierBookingStateV1}=await vite.ssrLoadModule("/src/features/flights/FlightSupplierBookingStateV1.jsx")
await test("B13-46 frontend renders honest processing copy",()=>assert.match(renderToStaticMarkup(React.createElement(FlightSupplierBookingStateV1,{booking:{status:"processing"}})),/جاري تأكيد الحجز مع شركة الطيران/))
await test("B13-47 frontend renders supplier-confirmed copy",()=>assert.match(renderToStaticMarkup(React.createElement(FlightSupplierBookingStateV1,{booking:{status:"confirmed"}})),/تم تأكيد الحجز مع شركة الطيران/))
await test("B13-48 frontend makes no ticket-issued claim",()=>assert.doesNotMatch(renderToStaticMarkup(React.createElement(FlightSupplierBookingStateV1,{booking:{status:"confirmed"}})),/تم إصدار التذكرة/))
await vite.close()

const migration=await fs.readFile(new URL("../supabase/migrations/20260829213000_flight_supplier_booking_execution_v1.sql",import.meta.url),"utf8")
const rt01Migration=await fs.readFile(new URL("../supabase/migrations/20260831183000_fix_flight_supplier_booking_execution_accepted_persistence.sql",import.meta.url),"utf8")
const rt01Runtime=await fs.readFile(new URL("./flight-runtime-rt01-staging-test.sql",import.meta.url),"utf8")
const rt03Migration=await fs.readFile(new URL("../supabase/migrations/20260831190000_fix_flight_supplier_booking_failure_unknown_persistence.sql",import.meta.url),"utf8")
const rt03Runtime=await fs.readFile(new URL("./flight-runtime-rt03-staging-test.sql",import.meta.url),"utf8")
await test("B13-49 migration creates a private one-execution-per-booking record",()=>{assert.match(migration,/create table app_private\.flight_supplier_booking_executions/);assert.match(migration,/booking_id uuid not null unique/);assert.match(migration,/owner_idempotency_unique/)})
await test("B13-50 migration persists attempt acceptance and reconciliation timestamps",()=>{for(const field of ["request_sent_at","response_received_at","supplier_accepted_at","unknown_outcome_at","reconciled_at","reconciliation_required"])assert.match(migration,new RegExp(field))})
await test("B13-51 migration verifies payment and booking authority",()=>{assert.match(migration,/payment\.status <> 'confirmed'/);assert.match(migration,/booking\.status <> 'payment_confirmed'/);assert.match(migration,/payment_row\.booking_id=booking\.id/)})
await test("B13-52 migration verifies exact B11 B12 and offer identity",()=>{for(const pattern of [/flight_payment_initiations/,/flight_booking_intents/,/offer\.internal_offer_key is distinct from intent\.internal_offer_id/,/offer\.supplier_offer_ref is distinct from intent\.provider_offer_ref/])assert.match(migration,pattern)})
await test("B13-53 migration permits only processing then confirmed",()=>{assert.match(migration,/set status='processing'/);assert.match(migration,/set status='confirmed'/);assert.doesNotMatch(migration,/set status='ticketed'|set status='completed'/)})
await test("B13-54 migration blocks unknown blind retry with one attempt",()=>{assert.match(migration,/attempt_count integer not null default 0/);assert.match(migration,/attempt_count between 0 and 1/);assert.match(migration,/unknown supplier outcome requires external reconciliation/)})
await test("B13-55 migration enables non-forced RLS with browser deny",()=>{assert.match(migration,/enable row level security/);assert.match(migration,/no force row level security/);assert.match(migration,/for all to anon, authenticated using \(false\) with check \(false\)/)})
await test("B13-56 migration RPCs pin empty search_path and grant service only",()=>{assert.equal((migration.match(/language plpgsql security definer set search_path = ''/g)||[]).length,4);assert.equal((migration.match(/grant execute on function public\./g)||[]).length,4);assert.doesNotMatch(migration,/grant execute[\s\S]{0,200}to authenticated/)})
await test("B13-57 migration has no undocumented BYPASSRLS dependency",()=>{assert.doesNotMatch(migration,/bypassrls/i);assert.match(migration,/B11\/B12\/B13 private tables must share one owner/)})
await test("B13-58 migration registers drift signatures and safe metadata bounds",()=>{assert.match(migration,/non-canonical signature/);assert.match(migration,/pg_column_size\(safe_metadata\) <= 4096/);assert.match(migration,/flight_supplier_executions_provider_ref_idx:v1/)})
await test("B13-58A migration indexes the non-unique booking-intent foreign key",()=>assert.match(migration,/create index flight_supplier_executions_booking_intent_idx[\s\S]*booking_intent_id/))
await test("B13-58B RT-01 preserves the original migration and qualifies the accepted timestamp",()=>{assert.match(rt01Migration,/update app_private\.flight_supplier_booking_executions as target/);assert.match(rt01Migration,/else target\.supplier_accepted_at end/);assert.doesNotMatch(rt01Migration,/else supplier_accepted_at end/);assert.match(rt01Migration,/language plpgsql security definer set search_path = ''/);assert.match(rt01Migration,/grant execute[\s\S]*to service_role/);assert.match(rt01Migration,/revoke all[\s\S]*from public, anon, authenticated/)})
await test("B13-58C RT-01 runtime regression executes the full accepted path with rollback",()=>{for(const pattern of [/mark_flight_supplier_booking_request_sent_v1/,/complete_flight_supplier_booking_execution_v1/,/'ACCEPTED'/,/execution\.supplier_accepted_at is not null/,/booking_status <> 'confirmed'/,/payment_status <> 'confirmed'/,/rollback;/])assert.match(rt01Runtime,pattern)})
await test("B13-58D RT-03 qualifies only the proven UNKNOWN supplier-reference ambiguity",()=>{assert.match(rt03Migration,/create or replace function public\.record_flight_supplier_booking_failure_v1/);assert.doesNotMatch(rt03Migration,/create or replace function public\.complete_flight_supplier_booking_execution_v1/);assert.match(rt03Migration,/update app_private\.flight_supplier_booking_executions as target/);assert.match(rt03Migration,/coalesce\(p_supplier_booking_ref,target\.supplier_booking_ref\)/);assert.doesNotMatch(rt03Migration,/coalesce\(p_supplier_booking_ref,supplier_booking_ref\)/);assert.match(rt03Migration,/language plpgsql security definer set search_path = ''/);assert.match(rt03Migration,/grant execute[\s\S]*to service_role/);assert.match(rt03Migration,/revoke all[\s\S]*from public, anon, authenticated/)})
await test("B13-58E RT-03 runtime regression proves both UNKNOWN paths and no blind resend",()=>{for(const pattern of [/'MOCK-RT03-UNKNOWN-REF'/,/SUPPLIER_TIMEOUT',true,null/,/execution_state <> 'UNKNOWN'/,/reconciliation_required/,/should_send or not replayed/,/unknown supplier outcome requires external reconciliation/,/booking_status <> 'processing'/,/payment_status <> 'confirmed'/,/rollback;/])assert.match(rt03Runtime,pattern)})

const travelport=await fs.readFile(new URL("../src/server/suppliers/travelportFlightSupplier.js",import.meta.url),"utf8")
await test("B13-59 Travelport booking remains fail-closed",()=>{assert.match(travelport,/create_booking:\s*false/);assert.match(travelport,/async createBooking\(\) \{ requireCapability\(adapter, "create_booking"\) \}/);assert.match(travelport,/get_booking_status:\s*false/)})
await test("B13-60 deterministic mock remains explicitly non-live and non-network",async()=>{const adapter=createMockFlightSupplier();const health=await adapter.health();assert.equal(adapter.synthetic,true);assert.equal(adapter.productionAllowed,false);assert.equal(health.synthetic,true);assert.equal(health.network,false);assert.equal(health.productionAllowed,false)})
await test("B13-60A synthetic booking adapter is forbidden in production",()=>assert.throws(()=>createMockFlightSupplier({env:{NODE_ENV:"production"}}),/synthetic booking supplier is forbidden in production/))
await test("B13-60B production registry rejects a declared non-production supplier",()=>{const adapter=createMockFlightSupplier({env:{NODE_ENV:"test"}});assert.throws(()=>createSupplierRegistry({adapters:[adapter],enabledProviderNames:["mock"],defaultProviderName:"mock",env:{NODE_ENV:"production"}}),/non-production supplier is forbidden in production/)})
await test("B13-60C non-production registry behavior remains available",()=>{const adapter=createMockFlightSupplier({env:{NODE_ENV:"test"}});const registry=createSupplierRegistry({adapters:[adapter],enabledProviderNames:["mock"],defaultProviderName:"mock",env:{NODE_ENV:"test"}});assert.equal(registry.getConfiguredFlightSupplier(),adapter)})

const docs=await fs.readFile(new URL("../docs/FLIGHT_SUPPLIER_BOOKING_EXECUTION_B13.md",import.meta.url),"utf8")
await test("B13-61 docs preserve payment supplier and ticketing separation",()=>{assert.match(docs,/Payment initiation[\s\S]*never supplier-booking authority/);assert.match(docs,/B13 success never means a ticket was issued/)})
await test("B13-62 docs state code-only runtime limitations",()=>{assert.match(docs,/not applied to Staging or Production/);assert.match(docs,/Travelport booking remains disabled/)})

console.log(`Flight supplier booking execution B13 tests: ${passed}/${passed} passed`)
