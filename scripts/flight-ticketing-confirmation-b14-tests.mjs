import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createSupplierRegistry } from "../src/server/suppliers/supplierRegistry.js"
import { SUPPLIER_OPERATIONS } from "../src/server/suppliers/supplierOperations.js"
import { createMockFlightTicketingSupplierV1 } from "../src/server/suppliers/mockFlightTicketingSupplierV1.js"
import { createFlightSupplierTicketingServiceV1, FlightSupplierTicketingError, SupplierTicketingAttemptError } from "../src/server/suppliers/flightSupplierTicketingV1.js"
import { createFlightSupplierTicketingTestStateV1, createProcessLocalFlightSupplierTicketingStoreV1, createSupabaseFlightSupplierTicketingStoreV1 } from "../src/server/suppliers/flightSupplierTicketingStoreV1.js"
import { createInternalFlightSupplierTicketingHandlerV1, INTERNAL_FLIGHT_TICKETING_REQUEST_VERSION, validateInternalFlightSupplierTicketingRequestV1 } from "../src/server/http/internalFlightSupplierTicketingV1.js"
import { toMyTicketDetails, toMyTripsPresentation } from "../src/features/account/data/myTripsContract.js"
import { createMyTripsDataSource } from "../src/services/myTripsDataSource.js"
import { resolveFlightFulfillmentPresentationV1 } from "../src/features/flights/data/flightFulfillmentPresentationV1.js"

let passed = 0
const test = async (name, fn) => { try { await fn(); passed += 1; console.log(`✓ ${name}`) } catch (error) { console.error(`✗ ${name}`); throw error } }
const OWNER = "11111111-1111-4111-8111-111111111111"
const OTHER_OWNER = "11111111-1111-4111-9111-111111111112"
const BOOKING = "22222222-2222-4222-8222-222222222222"
const B13 = "33333333-3333-4333-8333-333333333333"
const KEY = "hst_req_1234567890abcdef"
const SUPPLIER_REF = "MOCK-BOOKING-B13-123"
const NOW = "2026-08-30T09:00:00.000Z"
const baseRequest = Object.freeze({ bookingId: BOOKING, idempotencyKey: KEY, ownerContext: Object.freeze({ ownerId: OWNER, source: "injected-test" }) })
const artifact = (availability = "METADATA_ONLY") => Object.freeze(availability === "AVAILABLE" ? { availability, artifactRef: "artifact_b14_001", mediaType: "application/pdf", digest: "a".repeat(64) } : { availability, artifactRef: null, mediaType: null, digest: null })
const tickets = (availability = "METADATA_ONLY") => Object.freeze([
  Object.freeze({ travelerKey: "adt-1", ticketNumber: "MOCK-176-0000000001", supplierTicketRef: "TKT-ADT-1", issuedAt: NOW, artifact: artifact(availability) }),
  Object.freeze({ travelerKey: "chd-1", ticketNumber: "MOCK-176-0000000002", supplierTicketRef: "TKT-CHD-1", issuedAt: NOW, artifact: artifact(availability) }),
])
const issued = (availability) => Object.freeze({ providerName: "mock", supplierBookingRef: SUPPLIER_REF, providerStatusRaw: "MOCK_TICKETS_ISSUED", operationalOutcome: "ticketed", tickets: tickets(availability) })
const processing = Object.freeze({ providerName: "mock", supplierBookingRef: SUPPLIER_REF, providerStatusRaw: "MOCK_TICKETING_PENDING", operationalOutcome: "processing", tickets: Object.freeze([]) })

const seed = ({ bookingStatus = "confirmed", executionState = "ACCEPTED", ownerId = OWNER, mutate = () => {} } = {}) => {
  const value = {
    bookings: [{ id: BOOKING, bookingRef: "HJZ-B14TEST0001", ownerId, status: bookingStatus, supplierProvider: "mock", supplierReference: SUPPLIER_REF }],
    supplierExecutions: [{ id: B13, bookingId: BOOKING, ownerId, provider: "mock", supplierBookingRef: SUPPLIER_REF, supplierLocator: "MOCK-PNR-ONLY", executionState, travelerKeys: ["adt-1", "chd-1"], supplierAcceptedAt: NOW }],
  }
  mutate(value); return value
}

const customAdapter = ({ confirmBooking, retrieveTicket, confirmEnabled = true, retrieveEnabled = true } = {}) => {
  const base = createMockFlightTicketingSupplierV1({ env: { NODE_ENV: "test" }, clock: () => Date.parse(NOW) })
  return Object.freeze({
    ...base,
    capabilities: Object.freeze(Object.fromEntries(SUPPLIER_OPERATIONS.map((operation) => [operation, operation === "confirm_booking" ? confirmEnabled : operation === "retrieve_ticket" ? retrieveEnabled : false]))),
    ...(confirmBooking ? { confirmBooking } : {}),
    ...(retrieveTicket ? { retrieveTicket } : {}),
  })
}

const harness = ({ seedValue = seed(), state, adapter = customAdapter({ confirmBooking: async () => issued() }), timeoutMs = 100 } = {}) => {
  const shared = state ?? createFlightSupplierTicketingTestStateV1(seedValue)
  const store = createProcessLocalFlightSupplierTicketingStoreV1({ state: shared, clock: () => Date.parse(NOW) })
  const registry = createSupplierRegistry({ adapters: [adapter], enabledProviderNames: ["mock"], defaultProviderName: "mock" })
  return { state: shared, store, service: createFlightSupplierTicketingServiceV1({ store, supplierRegistry: registry, timeoutMs }) }
}

await test("B14-01 exact internal request accepts booking and idempotency only", () => assert.deepEqual(validateInternalFlightSupplierTicketingRequestV1({ contractVersion: INTERNAL_FLIGHT_TICKETING_REQUEST_VERSION, bookingId: BOOKING, idempotencyKey: KEY }), { bookingId: BOOKING, idempotencyKey: KEY }))
for (const [number, field, value] of [["02","provider","mock"],["03","supplierBookingRef",SUPPLIER_REF],["04","pnr","FAKEPNR"],["05","ticketNumber","FAKE-TICKET"],["06","userId",OWNER],["07","ticketStatus","issued"],["08","price","1.00"]]) await test(`B14-${number} client ${field} authority is rejected`, () => assert.throws(() => validateInternalFlightSupplierTicketingRequestV1({ contractVersion: INTERNAL_FLIGHT_TICKETING_REQUEST_VERSION, bookingId: BOOKING, idempotencyKey: KEY, [field]: value }), /invalid/))

await test("B14-09 booking payment_confirmed rejects ticketing", async () => { const { service } = harness({ seedValue: seed({ bookingStatus: "payment_confirmed" }) }); await assert.rejects(service.execute(baseRequest), (error) => error instanceof FlightSupplierTicketingError && error.code === "BOOKING_NOT_CONFIRMED") })
await test("B14-10 confirmed booking without B13 ACCEPTED rejects", async () => { const { service } = harness({ seedValue: seed({ executionState: "SUBMITTED" }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "B13_ACCEPTED_EXECUTION_REQUIRED") })
await test("B14-11 confirmed booking and exact B13 ACCEPTED is eligible", async () => { assert.equal((await harness().service.execute(baseRequest)).ticketingStatus, "ISSUED") })
await test("B14-12 wrong owner is indistinguishable from missing booking", async () => { const { service } = harness({ seedValue: seed({ ownerId: OTHER_OWNER }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "BOOKING_NOT_FOUND") })
await test("B14-13 mismatched B13 supplier reference rejects", async () => { const { service } = harness({ seedValue: seed({ mutate: (value) => { value.supplierExecutions[0].supplierBookingRef = "DIFFERENT" } }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "B13_SUPPLIER_IDENTITY_MISMATCH") })
await test("B14-14 mismatched B13 provider rejects", async () => { const { service } = harness({ seedValue: seed({ mutate: (value) => { value.supplierExecutions[0].provider = "travelport" } }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "B13_SUPPLIER_IDENTITY_MISMATCH") })
await test("B14-15 missing authoritative traveler keys rejects", async () => { const { service } = harness({ seedValue: seed({ mutate: (value) => { value.supplierExecutions[0].travelerKeys = [] } }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "B13_TRAVELER_LINEAGE_INVALID") })
await test("B14-16 PNR alone is not accepted B13 authority", async () => { const { service } = harness({ seedValue: seed({ executionState: "PROCESSING" }) }); await assert.rejects(service.execute(baseRequest), (error) => error.code === "B13_ACCEPTED_EXECUTION_REQUIRED") })

await test("B14-17 explicit ticketing capability uses confirm_booking", async () => { let calls=0;const {service}=harness({adapter:customAdapter({confirmBooking:async()=>{calls+=1;return issued()}})});await service.execute(baseRequest);assert.equal(calls,1) })
await test("B14-18 auto-ticket provider can use retrieve_ticket without issuance", async () => { let reads=0;const {service}=harness({adapter:customAdapter({confirmEnabled:false,retrieveTicket:async()=>{reads+=1;return issued()}})});assert.equal((await service.execute(baseRequest)).ticketingStatus,"ISSUED");assert.equal(reads,1) })
await test("B14-19 synthetic ticketing adapter is forbidden in production", () => assert.throws(() => createMockFlightTicketingSupplierV1({ env: { NODE_ENV: "production" } }), /forbidden/))
await test("B14-20 synthetic adapter declares non-live health", async () => { const health=await createMockFlightTicketingSupplierV1({env:{NODE_ENV:"test"}}).health();assert.equal(health.synthetic,true);assert.equal(health.network,false);assert.equal(health.productionAllowed,false) })

await test("B14-21 ticketing request does not move confirmed booking", async () => { let release;const h=harness({adapter:customAdapter({confirmBooking:()=>new Promise((resolve)=>{release=()=>resolve(processing)})})});const pending=h.service.execute(baseRequest);await new Promise((resolve)=>setImmediate(resolve));assert.equal(h.store.getBooking(BOOKING).status,"confirmed");release();await pending })
await test("B14-22 processing ticketing is not ticketed", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>processing})});const result=await h.service.execute(baseRequest);assert.equal(result.ticketingStatus,"PROCESSING");assert.equal(h.store.getBooking(BOOKING).status,"confirmed") })
await test("B14-23 supplier booking reference and PNR do not imply ticket", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>processing})});await h.service.execute(baseRequest);assert.equal(h.store.getTickets(BOOKING).length,0);assert.equal(h.store.getBooking(BOOKING).status,"confirmed") })
await test("B14-24 complete trusted issuance moves only to ticketed", async () => { const h=harness();const result=await h.service.execute(baseRequest);assert.equal(result.bookingStatus,"ticketed");assert.equal(result.ticketCount,2) })
await test("B14-25 B14 never invents completed", async () => { const h=harness();await h.service.execute(baseRequest);assert.notEqual(h.store.getBooking(BOOKING).status,"completed") })
await test("B14-26 incomplete passenger evidence becomes unknown", async () => { const partial={...issued(),tickets:[tickets()[0]]};const h=harness({adapter:customAdapter({confirmBooking:async()=>partial})});assert.equal((await h.service.execute(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED");assert.equal(h.store.getBooking(BOOKING).status,"confirmed") })
await test("B14-27 malformed ticket number becomes unknown", async () => { const malformed={...issued(),tickets:[{...tickets()[0],ticketNumber:""},tickets()[1]]};assert.equal((await harness({adapter:customAdapter({confirmBooking:async()=>malformed})}).service.execute(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED") })
await test("B14-28 multiple passengers persist separate ticket records", async () => { const h=harness();await h.service.execute(baseRequest);assert.deepEqual(h.store.getTickets(BOOKING).map((row)=>row.travelerKey).sort(),["adt-1","chd-1"]) })

await test("B14-29 same-key replay sends once", async () => { let calls=0;const h=harness({adapter:customAdapter({confirmBooking:async()=>{calls+=1;return issued()}})});const first=await h.service.execute(baseRequest);const second=await h.service.execute(baseRequest);assert.deepEqual(second,first);assert.equal(calls,1) })
await test("B14-30 concurrent request shares one supplier call", async () => { let release,calls=0;const h=harness({adapter:customAdapter({confirmBooking:()=>{calls+=1;return new Promise((resolve)=>{release=()=>resolve(issued())})}})});const a=h.service.execute(baseRequest);const b=h.service.execute(baseRequest);assert.equal(a,b);await new Promise((resolve)=>setImmediate(resolve));release();await Promise.all([a,b]);assert.equal(calls,1) })
await test("B14-31 restart uses shared durable execution", async () => { let calls=0;const adapter=customAdapter({confirmBooking:async()=>{calls+=1;return issued()}});const first=harness({adapter});await first.service.execute(baseRequest);const second=harness({state:first.state,adapter});assert.equal((await second.service.execute(baseRequest)).ticketingStatus,"ISSUED");assert.equal(calls,1) })
await test("B14-32 event replay cannot duplicate ticket rows", async () => { const h=harness();await h.service.execute(baseRequest);await h.service.execute(baseRequest);assert.equal(h.store.getTickets(BOOKING).length,2) })
await test("B14-33 post-success replay returns persisted issuance", async () => { const h=harness();await h.service.execute(baseRequest);assert.equal((await h.service.execute(baseRequest)).ticketCount,2) })
await test("B14-34 changed key for same booking conflicts", async () => { const h=harness();await h.service.execute(baseRequest);await assert.rejects(h.service.execute({...baseRequest,idempotencyKey:"hst_req_fedcba0987654321"}),(error)=>error.code==="TICKETING_IDEMPOTENCY_CONFLICT") })

await test("B14-35 definite supplier rejection is distinct", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>{throw new SupplierTicketingAttemptError("SUPPLIER_TICKETING_REJECTED",{mayHaveReachedSupplier:false})}})});assert.equal((await h.service.execute(baseRequest)).ticketingStatus,"REJECTED") })
await test("B14-36 missing capabilities fail before supplier send", async () => { const h=harness({adapter:customAdapter({confirmEnabled:false,retrieveEnabled:false})});assert.equal((await h.service.execute(baseRequest)).ticketingStatus,"FAILED");assert.equal(h.store.getExecution(BOOKING).attemptCount,0) })
await test("B14-37 pre-aborted request does not claim or call supplier", async () => { let calls=0;const controller=new AbortController();controller.abort();const h=harness({adapter:customAdapter({confirmBooking:async()=>{calls+=1;return issued()}})});assert.equal((await h.service.execute(baseRequest,{signal:controller.signal})).ticketingStatus,"FAILED");assert.equal(calls,0);assert.equal(h.store.getExecution(BOOKING).attemptCount,0) })
await test("B14-38 post-send timeout becomes unknown", async () => { const h=harness({adapter:customAdapter({confirmBooking:()=>new Promise(()=>{})}),timeoutMs:5});assert.equal((await h.service.execute(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED") })
await test("B14-39 unknown outcome persists reconciliation state", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>{throw new Error("opaque")}})});const result=await h.service.execute(baseRequest);assert.equal(result.reconciliationRequired,true);assert.equal(h.store.getExecution(BOOKING).executionState,"UNKNOWN") })
await test("B14-40 unknown replay never blindly reissues", async () => { let calls=0;const h=harness({adapter:customAdapter({confirmBooking:async()=>{calls+=1;throw new Error("opaque")}})});await h.service.execute(baseRequest);await h.service.execute(baseRequest);assert.equal(calls,1) })
await test("B14-41 reconciliation succeeds through retrieval only", async () => { let issues=0,reads=0;const h=harness({adapter:customAdapter({confirmBooking:async()=>{issues+=1;throw new Error("opaque")},retrieveTicket:async()=>{reads+=1;return issued()}})});await h.service.execute(baseRequest);assert.equal((await h.service.reconcile(baseRequest)).ticketingStatus,"ISSUED");assert.equal(issues,1);assert.equal(reads,1) })
await test("B14-42 unresolved reconciliation remains honest unknown", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>{throw new Error("opaque")},retrieveTicket:async()=>{throw new Error("still unknown")}})});await h.service.execute(baseRequest);assert.equal((await h.service.reconcile(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED") })
await test("B14-43 malformed supplier response becomes unknown", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>({ok:true})})});assert.equal((await h.service.execute(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED") })
await test("B14-44 internal post-send failure becomes unknown", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>{throw new TypeError("private failure")}})});assert.equal((await h.service.execute(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED") })

await test("B14-45 actual returned ticket numbers are persisted", async () => { const h=harness();await h.service.execute(baseRequest);assert.deepEqual(h.store.getTickets(BOOKING).map((row)=>row.ticketNumber),["MOCK-176-0000000001","MOCK-176-0000000002"]) })
await test("B14-46 processing result invents no ticket number", async () => { const h=harness({adapter:customAdapter({confirmBooking:async()=>processing})});await h.service.execute(baseRequest);assert.equal(h.store.getTickets(BOOKING).length,0) })
await test("B14-47 downloadable state requires every trusted artifact", async () => { assert.equal((await harness({adapter:customAdapter({confirmBooking:async()=>issued("AVAILABLE")})}).service.execute(baseRequest)).canDownloadTicket,true) })
await test("B14-48 malformed artifact metadata fails closed", async () => { const malformed={...issued(),tickets:[{...tickets()[0],artifact:{availability:"AVAILABLE",artifactRef:"x",mediaType:"application/pdf",digest:null}},tickets()[1]]};assert.equal((await harness({adapter:customAdapter({confirmBooking:async()=>malformed})}).service.execute(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED") })
await test("B14-49 traveler-to-ticket association must be exact", async () => { const wrong={...issued(),tickets:[{...tickets()[0],travelerKey:"other"},tickets()[1]]};assert.equal((await harness({adapter:customAdapter({confirmBooking:async()=>wrong})}).service.execute(baseRequest)).ticketingStatus,"RECONCILIATION_REQUIRED") })

await test("B14-50 public result excludes ticket and supplier secrets", async () => { const text=JSON.stringify(await harness().service.execute(baseRequest));for(const forbidden of ["ticketNumber","supplierBookingRef","providerName","artifactRef","MOCK-176","passport","dateOfBirth"])assert.equal(text.includes(forbidden),false,forbidden) })
await test("B14-51 generic internal error does not echo private details", async () => { const handler=createInternalFlightSupplierTicketingHandlerV1({service:{execute:async()=>{throw new Error("PASSPORT-PII-SENTINEL")}},authorizeInternalRequest:async()=>true,resolveTrustedOwnerContext:async()=>baseRequest.ownerContext});assert.equal(JSON.stringify(await handler({method:"POST",body:{contractVersion:INTERNAL_FLIGHT_TICKETING_REQUEST_VERSION,bookingId:BOOKING,idempotencyKey:KEY}})).includes("SENTINEL"),false) })
await test("B14-52 internal handler rejects non-internal caller", async () => { const handler=createInternalFlightSupplierTicketingHandlerV1({service:{execute:async()=>({})},authorizeInternalRequest:async()=>false,resolveTrustedOwnerContext:async()=>baseRequest.ownerContext});assert.equal((await handler({method:"POST",body:{}})).status,403) })
await test("B14-53 internal handler resolves owner outside body", async () => { let received;const handler=createInternalFlightSupplierTicketingHandlerV1({service:{execute:async(value)=>{received=value;return{}}},authorizeInternalRequest:async()=>true,resolveTrustedOwnerContext:async()=>baseRequest.ownerContext});await handler({method:"POST",body:{contractVersion:INTERNAL_FLIGHT_TICKETING_REQUEST_VERSION,bookingId:BOOKING,idempotencyKey:KEY}});assert.equal(received.ownerContext.ownerId,OWNER) })
await test("B14-54 production store sends only service authority fields", async () => { let call;const client={rpc:async(name,parameters)=>{call={name,parameters};return{data:[{execution_id:B13,operation_id:null,booking_id:BOOKING,booking_ref:"HJZ-B14TEST0001",booking_status:"confirmed",supplier_execution_id:B13,owner_id:OWNER,provider:"mock",supplier_booking_ref:SUPPLIER_REF,traveler_keys:["adt-1"],idempotency_key:KEY,request_digest:"a".repeat(64),execution_state:"PREPARED",ticket_count:0,can_download_ticket:false,reconciliation_required:false}],error:null}}};await createSupabaseFlightSupplierTicketingStoreV1({client}).prepare({ownerId:OWNER,bookingId:BOOKING,idempotencyKey:KEY,requestDigest:"a".repeat(64)});assert.equal(call.name,"prepare_flight_supplier_ticketing_v1");assert.deepEqual(Object.keys(call.parameters).sort(),["p_booking_id","p_idempotency_key","p_owner_id","p_request_digest"]) })

const serviceSource=await fs.readFile(new URL("../src/server/suppliers/flightSupplierTicketingV1.js",import.meta.url),"utf8")
const storeSource=await fs.readFile(new URL("../src/server/suppliers/flightSupplierTicketingStoreV1.js",import.meta.url),"utf8")
await test("B14-55 source preserves payment commercial booking and logging firewalls", () => { const source=serviceSource+storeSource;assert.doesNotMatch(source,/createBooking|create_booking|apply_payment_event|review_bankak|walletDebit|reprice|supplierAmount|sellingAmount|commission|console\.|logger\./i) })

const bookingRow={booking_ref:"HJZ-B14TEST0001",status:"confirmed",sold_price:"1205",currency:"AED",pay_method:"card",created_at:NOW}
const paymentRow={booking_ref:"HJZ-B14TEST0001",status:"confirmed"}
await test("B14-56 My Trips confirmed does not claim ticket", () => { const row=toMyTripsPresentation([bookingRow],[paymentRow],[])[0];assert.equal(row.ticketingLabel,"تم تأكيد الحجز مع شركة الطيران");assert.equal(row.canDownloadTicket,false) })
await test("B14-57 My Trips processing is honest", () => { const row=toMyTripsPresentation([bookingRow],[paymentRow],[{booking_ref:bookingRow.booking_ref,ticketing_state:"PROCESSING",ticket_count:0}])[0];assert.equal(row.ticketingLabel,"جاري إصدار التذكرة");assert.equal(row.bookingState,"confirmed") })
await test("B14-58 My Trips ticketed requires issued evidence", () => { const row=toMyTripsPresentation([{...bookingRow,status:"ticketed"}],[paymentRow],[{booking_ref:bookingRow.booking_ref,ticketing_state:"ISSUED",ticket_count:2,artifact_available:false}])[0];assert.equal(row.ticketingLabel,"تم إصدار التذكرة");assert.equal(row.canViewTicketDetails,true) })
await test("B14-59 My Trips metadata-only ticket cannot download", () => { const row=toMyTripsPresentation([{...bookingRow,status:"ticketed"}],[paymentRow],[{booking_ref:bookingRow.booking_ref,ticketing_state:"ISSUED",ticket_count:2,artifact_available:false}])[0];assert.equal(row.canDownloadTicket,false) })
await test("B14-60 My Trips download requires trusted available artifact", () => { const row=toMyTripsPresentation([{...bookingRow,status:"ticketed"}],[paymentRow],[{booking_ref:bookingRow.booking_ref,ticketing_state:"ISSUED",ticket_count:2,artifact_available:true}])[0];assert.equal(row.canDownloadTicket,true) })
await test("B14-61 stale ticketed booking without B14 evidence fails closed", () => { const row=toMyTripsPresentation([{...bookingRow,status:"ticketed"}],[paymentRow],[])[0];assert.equal(row.ticketingState,"UNKNOWN");assert.equal(row.canDownloadTicket,false) })
await test("B14-62 ticket detail contract returns minimum owner-facing fields", () => { assert.deepEqual(toMyTicketDetails([{traveler_key:"adt-1",ticket_number:"176-1",issued_at:NOW,artifact_availability:"METADATA_ONLY"}])[0],{travelerKey:"adt-1",ticketNumber:"176-1",issuedAt:NOW,artifactAvailability:"METADATA_ONLY"}) })
await test("B14-63 My Trips data source uses only authenticated read RPCs", async () => { const calls=[];const client={auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},rpc:async(name)=>{calls.push(name);return{data:name==="get_my_bookings"?[bookingRow]:name==="get_my_payments"?[paymentRow]:[],error:null}}};await createMyTripsDataSource({client}).load();assert.deepEqual(calls.sort(),["get_my_bookings","get_my_flight_ticketing_v1","get_my_payments"]) })
await test("B14-64 final confirmation keeps payment booking and ticket separate", () => { assert.equal(resolveFlightFulfillmentPresentationV1({bookingState:"payment_confirmed"}).title,"تم تأكيد الدفع");assert.equal(resolveFlightFulfillmentPresentationV1({bookingState:"confirmed"}).title,"تم تأكيد الحجز مع شركة الطيران");assert.equal(resolveFlightFulfillmentPresentationV1({bookingState:"ticketed",ticketingState:"ISSUED",hasTicketData:true}).title,"تم إصدار التذكرة") })

const migration=await fs.readFile(new URL("../supabase/migrations/20260830090000_flight_ticketing_confirmation_v1.sql",import.meta.url),"utf8")
await test("B14-65 migration creates private execution and per-traveler records", () => { assert.match(migration,/create table app_private\.flight_supplier_ticketing_executions/);assert.match(migration,/create table app_private\.flight_ticket_records/);assert.match(migration,/execution_traveler_unique/) })
await test("B14-66 migration entry requires confirmed and B13 ACCEPTED", () => { assert.match(migration,/booking\.status<>'confirmed'/);assert.match(migration,/supplier\.execution_state<>'ACCEPTED'/);assert.match(migration,/supplier_booking_ref is distinct from booking\.supplier_reference/) })
await test("B14-67 migration never creates supplier booking or completed state", () => { assert.doesNotMatch(migration,/operation,'create_booking'|set status='completed'|p_outcome='COMPLETED'/) })
await test("B14-68 migration transitions only after complete ticket evidence", () => { assert.match(migration,/complete traveler ticket evidence is required/);assert.match(migration,/set status='ticketed'/);assert.match(migration,/execution_state=p_outcome/) })
await test("B14-69 migration bounds one attempt and unknown retry", () => { assert.match(migration,/attempt_count between 0 and 1/);assert.match(migration,/unknown ticketing outcome requires a sent request/);assert.match(migration,/execution_state='REQUEST_SENT',attempt_count=1/) })
await test("B14-70 migration enables non-forced RLS and direct denial", () => { assert.equal((migration.match(/enable row level security/g)||[]).length,2);assert.equal((migration.match(/no force row level security/g)||[]).length,2);assert.match(migration,/flight_ticketing_direct_access_denied/);assert.match(migration,/flight_ticket_records_direct_access_denied/);assert.match(migration,/for all to anon,authenticated using \(false\) with check \(false\)/) })
await test("B14-71 service RPCs pin empty search_path and least privilege", () => { assert.equal((migration.match(/language plpgsql security definer set search_path=''/g)||[]).length,4);assert.equal((migration.match(/grant execute on function public\.(prepare|mark|complete|record)/g)||[]).length,4);assert.doesNotMatch(migration,/grant (select|insert|update|delete).*flight_ticket/i) })
await test("B14-72 customer RPCs enforce auth uid and owner joins", () => { assert.equal((migration.match(/\(select auth\.uid\(\)\) is not null/g)||[]).length,2);assert.match(migration,/booking\.user_id=\(select auth\.uid\(\)\)/);assert.match(migration,/booking\.status='ticketed'/) })
await test("B14-73 artifact RPC never exposes artifact ref or storage path", () => { const body=migration.split("create or replace function public.get_my_flight_ticket_records_v1")[1].split("$function$;")[0];assert.doesNotMatch(body,/artifact_ref|storage|bucket|url/i) })
await test("B14-74 migration uses consistent lock order and indexed FKs", () => { assert.match(migration,/Canonical lock order: booking -> B13 supplier execution -> B14 ticketing execution/);assert.match(migration,/flight_ticket_records_booking_idx/);assert.match(migration,/flight_ticket_records_owner_booking_idx/) })
await test("B14-75 migration has drift signatures and no BYPASSRLS dependency", () => { assert.match(migration,/non-canonical ownership or signature/);assert.match(migration,/non-canonical signature/);assert.doesNotMatch(migration,/bypassrls/i) })

const travelport=await fs.readFile(new URL("../src/server/suppliers/travelportFlightSupplier.js",import.meta.url),"utf8")
await test("B14-76 Travelport ticketing remains fail closed", () => { assert.match(travelport,/confirm_booking:\s*false/);assert.match(travelport,/retrieve_ticket:\s*false/) })
const docs=await fs.readFile(new URL("../docs/FLIGHT_TICKETING_CONFIRMATION_B14.md",import.meta.url),"utf8")
await test("B14-77 docs state non-live and code-only truth", () => { assert.match(docs,/no enabled live ticketing adapter/i);assert.match(docs,/not applied to Staging or Production/) })
await test("B14-78 docs preserve PNR ticket and completed distinctions", () => { assert.match(docs,/PNR proves only that a booking exists/);assert.match(docs,/never marks `completed`/) })

console.log(`Flight ticketing confirmation B14 tests: ${passed}/${passed} passed`)
