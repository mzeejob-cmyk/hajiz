import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"
import { createProcessLocalFlightBookingIntentStoreV1 } from "../src/server/bookings/flightBookingIntentStoreV1.js"
import {
  createProcessLocalFlightPaymentInitiationStoreV1,
  createSupabaseFlightPaymentInitiationStoreV1,
  FlightPaymentInitiationStoreError,
} from "../src/server/payments/flightPaymentInitiationStoreV1.js"
import {
  createFlightPaymentInitiationServiceV1,
  FlightPaymentInitiationError,
} from "../src/server/payments/flightPaymentInitiationV1.js"
import {
  createCustomerFlightPaymentInitiationHttpHandlerV1,
  validateCustomerFlightPaymentInitiationRequestV1,
} from "../src/server/http/customerFlightPaymentInitiationHttpV1.js"
import { MockPspAdapter } from "../src/services/payments/psp/mockPspAdapter.js"
import { CheckoutComSandboxAdapterSkeleton } from "../src/services/payments/psp/checkoutComSandboxAdapter.js"
import { PspAdapterRegistry } from "../src/services/payments/psp/registry.js"
import {
  createFlightPaymentInitiationClientV1,
  parseFlightPaymentInitiationHttpResponseV1,
} from "../src/features/flights/api/flightPaymentInitiationClientV1.js"
import { createFlightPaymentInitiationCoordinatorV1 } from "../src/features/flights/data/flightPaymentInitiationCoordinatorV1.js"

const NOW = Date.parse("2026-09-15T04:00:00.000Z")
const OWNER = "11111111-1111-4111-8111-111111111111"
const OTHER_OWNER = "22222222-2222-4222-8222-222222222222"
const customerPrice = Object.freeze({
  contractVersion: "customer-price/v1",
  internalOfferId: "hfo_b12_exact_offer",
  amount: "999.00",
  currency: "AED",
  canonicalUsdAmount: "272.01",
  fxSnapshotId: "hfx_b12display01",
  pricingPolicyVersion: "policy-b12-v1",
  fxPolicyVersion: "fx-b12-v1",
  calculatedAt: "2026-09-15T03:59:00.000Z",
  validUntil: "2026-09-15T05:30:00.000Z",
})
const intentRecord = (overrides = {}) => ({
  ownerId: OWNER,
  idempotencyKey: "hbi_req_b12authoritysource01",
  payloadDigest: "a".repeat(64),
  pricedSelectionDigest: "b".repeat(64),
  internalOfferId: customerPrice.internalOfferId,
  provider: "mock",
  providerOfferRef: "mock_offer_b12_exact",
  itinerary: { origin: "DXB", destination: "KRT" },
  fare: { cabin: "ECONOMY" },
  customerPrice,
  passengerComposition: { ADT: 1, CHD: 0, INF: 0 },
  travelers: [{ travelerKey: "adt-1", firstName: "PRIVATE-ALI", document: { documentNumber: "PRIVATE-P123" } }],
  contact: { email: "private@example.com", phoneNumber: "500000000" },
  validUntil: "2026-09-15T05:30:00.000Z",
  ...overrides,
})
const paymentKey = (value) => `hpi_req_${value.replaceAll(/[^A-Za-z0-9_-]/g, "").padEnd(16, "0")}`
const ownerContext = Object.freeze({ ownerId: OWNER, source: "injected-test" })
const pspConfig = Object.freeze({ pspProvider: "mock_psp", returnUrl: "https://staging.hajiz.example/payments/return", redirectUrlHosts: Object.freeze([]), timeoutMs: 100, paymentExpiryMs: 30 * 60 * 1000 })
const bankakConfig = Object.freeze({ bankAccountDisplayName: "HAJIZ Bankak configured account", maskedAccountNumber: "****2468", amountSdgResolver: async () => "180000.00" })
const currentCommercial = Object.freeze({ async revalidate(intent) { return Object.freeze({ currentCustomerPrice: intent.customerPrice }) } })

const seedIntent = async ({ store = createProcessLocalFlightBookingIntentStoreV1({ clock: () => NOW }), record = intentRecord() } = {}) => {
  const created = await store.createOrGet(record)
  return { store, bookingIntentId: created.bookingIntentId }
}
const registryWith = (adapter) => new PspAdapterRegistry().register({ name: adapter.getMetadata().name, adapter, enabled: true })
const mockAdapter = () => new MockPspAdapter({ enabled: true, environment: "test", clock: () => new Date(NOW).toISOString() })
const serviceFor = ({ intentStore, paymentStore = createProcessLocalFlightPaymentInitiationStoreV1({ clock: () => NOW }), commercialRevalidator = currentCommercial, adapter = mockAdapter(), config = pspConfig, bankConfig = bankakConfig } = {}) => ({
  paymentStore,
  service: createFlightPaymentInitiationServiceV1({ intentStore, paymentStore, commercialRevalidator, pspRegistry: registryWith(adapter), pspConfig: config, bankakConfig: bankConfig, clock: () => NOW }),
})
const request = (bookingIntentId, suffix, paymentMethod = "bankak", overrides = {}) => ({ ownerContext, bookingIntentId, paymentMethod, idempotencyKey: paymentKey(suffix), ...overrides })
const httpBody = (bookingIntentId, suffix, paymentMethod = "bankak", overrides = {}) => ({ contractVersion: "flight-payment-initiation-request/v1", bookingIntentId, paymentMethod, idempotencyKey: paymentKey(suffix), ...overrides })
const adapterWithCreate = (createPaymentSession, metadata = {}) => {
  const base = mockAdapter()
  return Object.freeze({
    createPaymentSession,
    verifyWebhookEvent: (...args) => base.verifyWebhookEvent(...args),
    getPaymentStatus: (...args) => base.getPaymentStatus(...args),
    capture: (...args) => base.capture(...args),
    voidAuthorization: (...args) => base.voidAuthorization(...args),
    refund: (...args) => base.refund(...args),
    getMetadata: () => Object.freeze({ ...base.getMetadata(), ...metadata }),
  })
}

let passed = 0
const test = async (name, work) => { await work(); passed += 1; process.stdout.write(`✓ ${name}\n`) }

const seeded = await seedIntent()
const base = serviceFor({ intentStore: seeded.store })
const bankak = await base.service.initiate(request(seeded.bookingIntentId, "bankak-first"))

await test("P1 strict request accepts only the versioned customer fields", () => assert.equal(validateCustomerFlightPaymentInitiationRequestV1(httpBody(seeded.bookingIntentId, "strict")).bookingIntentId, seeded.bookingIntentId))
await test("P2 browser price currency and supplier authority are rejected", () => { for (const field of ["amount", "currency", "provider", "supplier", "internalOfferId", "providerOfferRef", "fxRate", "paymentStatus", "bookingStatus"]) assert.throws(() => validateCustomerFlightPaymentInitiationRequestV1(httpBody(seeded.bookingIntentId, field, "bankak", { [field]: "forbidden" }))) })
await test("P3 traveler PII and client userId are rejected", () => { for (const field of ["travelers", "bookingContact", "passport", "userId"]) assert.throws(() => validateCustomerFlightPaymentInitiationRequestV1(httpBody(seeded.bookingIntentId, field, "bankak", { [field]: "PRIVATE" }))) })
await test("P4 fabricated booking intent fails without materialization", async () => { const isolated = serviceFor({ intentStore: seeded.store }); await assert.rejects(isolated.service.initiate(request(`hbi_v1_${"0".repeat(32)}`, "fabricated")), /BOOKING_INTENT_NOT_FOUND/); assert.deepEqual(isolated.paymentStore.counts(), { reservations: 0, bookings: 0, payments: 0 }) })
await test("P5 wrong owner fails closed", async () => await assert.rejects(base.service.initiate({ ...request(seeded.bookingIntentId, "wrong-owner"), ownerContext: { ownerId: OTHER_OWNER, source: "injected-test" } }), /BOOKING_INTENT_NOT_FOUND/))
await test("P6 missing trusted owner is rejected", () => assert.throws(() => base.service.initiate({ ...request(seeded.bookingIntentId, "missing-owner"), ownerContext: null }), /AUTH_REQUIRED/))
await test("P7 expired commercial authority creates no reservation", async () => { const expired = await seedIntent({ record: intentRecord({ idempotencyKey: "hbi_req_expiredauthority01", validUntil: "2026-09-15T03:00:00.000Z", customerPrice: { ...customerPrice, validUntil: "2026-09-15T03:00:00.000Z" } }) }); const isolated = serviceFor({ intentStore: expired.store }); await assert.rejects(isolated.service.initiate(request(expired.bookingIntentId, "expired")), /INTENT_EXPIRED/); assert.equal(isolated.paymentStore.counts().reservations, 0) })
await test("P8 changed current price requires explicit repricing", async () => { const isolated = serviceFor({ intentStore: seeded.store, commercialRevalidator: { async revalidate() { throw new FlightPaymentInitiationError("REPRICE_REQUIRED") } } }); await assert.rejects(isolated.service.initiate(request(seeded.bookingIntentId, "stale-price")), /REPRICE_REQUIRED/); assert.equal(isolated.paymentStore.counts().payments, 0) })
await test("P9 unavailable supplier offer creates no payment", async () => { const isolated = serviceFor({ intentStore: seeded.store, commercialRevalidator: { async revalidate() { throw new FlightPaymentInitiationError("OFFER_UNAVAILABLE") } } }); await assert.rejects(isolated.service.initiate(request(seeded.bookingIntentId, "unavailable")), /OFFER_UNAVAILABLE/); assert.equal(isolated.paymentStore.counts().bookings, 0) })
await test("P10 commercial authority is revalidated at initiation", async () => { let calls = 0; const isolated = serviceFor({ intentStore: seeded.store, commercialRevalidator: { async revalidate(intent) { calls += 1; return { currentCustomerPrice: intent.customerPrice } } } }); await isolated.service.initiate(request(seeded.bookingIntentId, "revalidation")); assert.equal(calls, 1) })
await test("P11 non-ready intent status fails closed", async () => { const intentStore = { async resolveForOwner() { return { ...intentRecord(), bookingIntentId: seeded.bookingIntentId, status: "CONFLICTED" } } }; const isolated = serviceFor({ intentStore }); await assert.rejects(isolated.service.initiate(request(seeded.bookingIntentId, "conflicted")), /BOOKING_INTENT_CONFLICT/) })
await test("P12 Bankak materializes exactly one booking and payment", () => assert.deepEqual(base.paymentStore.counts(), { reservations: 1, bookings: 1, payments: 1 }))
await test("P13 booking begins only at pending_payment", () => assert.equal(bankak.bookingStatus, "pending_payment"))
await test("P14 payment begins only at awaiting", () => assert.equal(bankak.paymentStatus, "awaiting"))
await test("P15 booking and payment are linked atomically", () => { const payment = base.paymentStore.getPayment(bankak.paymentId); const booking = base.paymentStore.getBooking(payment.bookingId); assert.equal(booking.bookingRef, bankak.bookingRef) })
await test("P16 public result excludes private traveler and supplier identity", () => { const value = JSON.stringify(bankak); for (const sentinel of ["PRIVATE-ALI", "PRIVATE-P123", "private@example.com", "mock_offer_b12_exact", "hfo_b12_exact_offer", "supplier", "net_cost", "margin", "commission"]) assert.equal(value.includes(sentinel), false, sentinel) })
await test("P17 materialization failure leaves no partial booking or payment", async () => { const paymentStore = createProcessLocalFlightPaymentInitiationStoreV1({ clock: () => NOW }); const failingStore = { ...paymentStore, async materialize() { throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_MATERIALIZATION_FAILED") } }; const isolated = serviceFor({ intentStore: seeded.store, paymentStore: failingStore }); await assert.rejects(isolated.service.initiate(request(seeded.bookingIntentId, "rollback")), /PAYMENT_INITIATION_PERSISTENCE_UNAVAILABLE/); assert.deepEqual(paymentStore.counts(), { reservations: 1, bookings: 0, payments: 0 }) })
const bankakReplay = await base.service.initiate(request(seeded.bookingIntentId, "bankak-first"))
await test("P18 identical retry returns the same booking and payment", () => assert.deepEqual([bankakReplay.bookingRef, bankakReplay.paymentId], [bankak.bookingRef, bankak.paymentId]))
await test("P19 identical retry creates no duplicate records", () => assert.deepEqual(base.paymentStore.counts(), { reservations: 1, bookings: 1, payments: 1 }))
await test("P20 same key with a different method conflicts", async () => await assert.rejects(base.service.initiate(request(seeded.bookingIntentId, "bankak-first", "card")), /PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT/))
await test("P21 same intent with a different key conflicts", async () => await assert.rejects(base.service.initiate(request(seeded.bookingIntentId, "different-key")), /PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT/))
await test("P22 same key with a different intent conflicts", async () => { const second = await seedIntent({ store: seeded.store, record: intentRecord({ idempotencyKey: "hbi_req_secondauthority001", payloadDigest: "c".repeat(64), providerOfferRef: "mock_offer_b12_second" }) }); await assert.rejects(base.service.initiate(request(second.bookingIntentId, "bankak-first")), /PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT/) })
await test("P23 concurrent double click shares one server promise", async () => { let release; const pending = new Promise((resolve) => { release = resolve }); const isolatedStore = createProcessLocalFlightPaymentInitiationStoreV1({ clock: () => NOW }); const isolated = serviceFor({ intentStore: seeded.store, paymentStore: isolatedStore, commercialRevalidator: { async revalidate(intent) { await pending; return { currentCustomerPrice: intent.customerPrice } } } }); const value = request(seeded.bookingIntentId, "server-double"); const left = isolated.service.initiate(value); const right = isolated.service.initiate(value); assert.equal(left, right); release(); await Promise.all([left, right]); assert.equal(isolatedStore.counts().payments, 1) })
await test("P24 Bankak expiry is exactly 24 hours from trusted initiation time", () => assert.equal(Date.parse(bankak.expiresAt) - NOW, 24 * 60 * 60 * 1000))
await test("P25 Bankak handoff uses configured masked instructions", () => assert.deepEqual([bankak.handoff.bankAccountDisplayName, bankak.handoff.maskedAccountNumber], [bankakConfig.bankAccountDisplayName, bankakConfig.maskedAccountNumber]))
await test("P26 Bankak handoff exposes only server-resolved SDG amount", () => assert.deepEqual([bankak.handoff.amount, bankak.handoff.currency], ["180000.00", "SDG"]))
await test("P27 Bankak does not claim receipt upload wiring", () => assert.equal(bankak.handoff.receiptUploadAvailable, false))
await test("P28 Bankak initiation performs no Finance confirmation", () => assert.equal(/under_review|confirmed/.test(JSON.stringify(bankak)), false))
await test("P29 Bankak initiation performs no AI OCR or supplier booking", async () => { const source = await fs.readFile(new URL("../src/server/payments/flightPaymentInitiationV1.js", import.meta.url), "utf8"); assert.equal(/ocr|createBooking|holdOffer|issueTicket|travelport|review_bankak|confirmPayment|apply_payment_event/i.test(source), false) })

let pspCalls = 0
const countedBase = mockAdapter()
const countedAdapter = adapterWithCreate(async (value) => { pspCalls += 1; return countedBase.createPaymentSession(value) })
const pspSeed = await seedIntent({ record: intentRecord({ idempotencyKey: "hbi_req_pspauthoritysource01" }) })
const psp = serviceFor({ intentStore: pspSeed.store, adapter: countedAdapter })
const card = await psp.service.initiate(request(pspSeed.bookingIntentId, "card-first", "card"))
await test("P30 card initiation uses the server-selected PSP adapter", () => assert.equal(pspCalls, 1))
await test("P31 card initiation remains awaiting and pending_payment", () => assert.deepEqual([card.paymentStatus, card.bookingStatus], ["awaiting", "pending_payment"]))
await test("P32 card initiation returns an opaque PSP session without provider identity", () => { assert.equal(card.handoff.type, "PSP_SESSION"); assert.match(card.handoff.sessionToken, /^mock_session_/); assert.equal(Object.hasOwn(card.handoff, "provider"), false) })
await test("P33 mock PSP is truthfully non-live", () => assert.equal(card.handoff.live, false))
await test("P34 PSP initiation response cannot confirm payment", () => assert.equal(/confirmed|payment_confirmed|processing|ticketed/.test(JSON.stringify(card)), false))
await test("P35 identical PSP retry reuses the session and records", async () => { const again = await psp.service.initiate(request(pspSeed.bookingIntentId, "card-first", "card")); assert.equal(again.handoff.sessionToken, card.handoff.sessionToken); assert.equal(pspCalls, 1); assert.deepEqual(psp.paymentStore.counts(), { reservations: 1, bookings: 1, payments: 1 }) })
await test("P36 PSP adapter failure creates no booking or payment", async () => { const failing = serviceFor({ intentStore: pspSeed.store, adapter: adapterWithCreate(async () => { throw new Error("PRIVATE PROVIDER FAILURE") }) }); await assert.rejects(failing.service.initiate(request(pspSeed.bookingIntentId, "psp-failure", "card")), /PSP_INITIATION_FAILED/); assert.deepEqual(failing.paymentStore.counts(), { reservations: 1, bookings: 0, payments: 0 }) })
await test("P37 PSP timeout creates no booking or payment", async () => { const timing = serviceFor({ intentStore: pspSeed.store, adapter: adapterWithCreate(() => new Promise(() => {})), config: { ...pspConfig, timeoutMs: 5 } }); await assert.rejects(timing.service.initiate(request(pspSeed.bookingIntentId, "psp-timeout", "card")), /PSP_TIMEOUT/); assert.deepEqual(timing.paymentStore.counts(), { reservations: 1, bookings: 0, payments: 0 }) })
await test("P38 malformed PSP response cannot leak secrets", async () => { const unsafe = serviceFor({ intentStore: pspSeed.store, adapter: adapterWithCreate(async () => ({ providerPaymentId: "safe", providerSession: "safe", normalizedStatus: "awaiting", expiresAt: null, privateSecret: "SECRET" })) }); await assert.rejects(unsafe.service.initiate(request(pspSeed.bookingIntentId, "psp-secret", "card")), /PSP_INITIATION_FAILED/); assert.equal(unsafe.paymentStore.counts().payments, 0) })
await test("P39 conformance-only PSP fails as configuration unavailable", async () => { const isolated = serviceFor({ intentStore: pspSeed.store, adapter: new CheckoutComSandboxAdapterSkeleton(), config: { ...pspConfig, pspProvider: "checkout_com" } }); await assert.rejects(isolated.service.initiate(request(pspSeed.bookingIntentId, "psp-skeleton", "card")), /PSP_CONFIGURATION_UNAVAILABLE/); assert.equal(isolated.paymentStore.counts().payments, 0) })
await test("P40 wallet is explicitly outside the accepted B12 method contract", () => assert.throws(() => validateCustomerFlightPaymentInitiationRequestV1(httpBody(seeded.bookingIntentId, "wallet", "wallet"))))

const handler = createCustomerFlightPaymentInitiationHttpHandlerV1({ service: base.service, resolveOwnerContext: async () => ownerContext })
await test("P41 HTTP boundary never accepts request.body user ownership", async () => assert.equal((await handler({ method: "POST", body: httpBody(seeded.bookingIntentId, "http-user", "bankak", { userId: OTHER_OWNER }) })).status, 400))
await test("P42 HTTP missing authentication fails before initiation", async () => { const unauthenticated = createCustomerFlightPaymentInitiationHttpHandlerV1({ service: base.service, resolveOwnerContext: async () => null }); assert.equal((await unauthenticated({ method: "POST", body: httpBody(seeded.bookingIntentId, "http-auth") })).status, 401) })
await test("P43 generic HTTP errors never echo PII or provider details", async () => { const unsafe = createCustomerFlightPaymentInitiationHttpHandlerV1({ service: { async initiate() { throw new Error("PRIVATE-ALI mock_offer SECRET") } }, resolveOwnerContext: async () => ownerContext }); const value = await unsafe({ method: "POST", body: httpBody(seeded.bookingIntentId, "http-private") }); assert.equal(value.status, 500); assert.equal(/PRIVATE-ALI|mock_offer|SECRET/.test(JSON.stringify(value.body)), false) })

const bankakBody = { contractVersion: "customer-flight-payment-initiation-http/v1", data: bankak }
const cardBody = { contractVersion: "customer-flight-payment-initiation-http/v1", data: card }
await test("P44 frontend parser accepts the exact Bankak handoff", () => assert.equal(parseFlightPaymentInitiationHttpResponseV1(bankakBody).paymentMethod, "bankak"))
await test("P45 frontend parser accepts the exact PSP handoff", () => assert.equal(parseFlightPaymentInitiationHttpResponseV1(cardBody).paymentMethod, "card"))
await test("P46 frontend parser rejects supplier or economics contamination", () => { for (const field of ["provider", "supplier", "netCost", "margin", "travelerName"]) assert.throws(() => parseFlightPaymentInitiationHttpResponseV1({ ...bankakBody, data: { ...bankak, [field]: "PRIVATE" } })) })
await test("P47 frontend client preserves explicit repricing failure", async () => { const client = createFlightPaymentInitiationClientV1({ transport: async () => ({ status: 409, body: { error: { code: "REPRICE_REQUIRED" } } }) }); await assert.rejects(client.initiate({}), (error) => error.kind === "reprice_required") })
await test("P48 frontend double click shares one request", async () => { let calls = 0; let release; const client = { initiate: () => { calls += 1; return new Promise((resolve) => { release = () => resolve(bankak) }) } }; const coordinator = createFlightPaymentInitiationCoordinatorV1({ client, onState: () => {}, createIdempotencyKey: () => paymentKey("frontend-double") }); const input = { bookingIntentId: seeded.bookingIntentId, paymentMethod: "bankak" }; const left = coordinator.initiate(input); const right = coordinator.initiate(input); assert.equal(left, right); assert.equal(calls, 1); release(); await Promise.all([left, right]) })
await test("P49 late previous method response cannot overwrite the newer method", async () => { let releaseBankak; const states = []; const client = { initiate: (value) => value.paymentMethod === "bankak" ? new Promise((resolve) => { releaseBankak = () => resolve(bankak) }) : Promise.resolve(card) }; const coordinator = createFlightPaymentInitiationCoordinatorV1({ client, onState: (state) => states.push(state), createIdempotencyKey: () => paymentKey(`race-${states.length}`) }); const old = coordinator.initiate({ bookingIntentId: seeded.bookingIntentId, paymentMethod: "bankak" }); await coordinator.initiate({ bookingIntentId: seeded.bookingIntentId, paymentMethod: "card" }); releaseBankak(); await old; assert.equal(states.at(-1).status, "psp_handoff") })

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" })
const { PaymentInitiationPanel } = await vite.ssrLoadModule("/src/features/flights/FlightsPage.jsx")
await test("P50 frontend renders only Bankak and card method categories", () => { const html = renderToStaticMarkup(React.createElement(PaymentInitiationPanel, { intent: { bookingIntentId: seeded.bookingIntentId, customerPrice }, state: { status: "idle" } })); assert.match(html, /بنكك/); assert.match(html, /بطاقة/); assert.doesNotMatch(html, /Checkout\.com|wallet|WALLET|apple_pay|google_pay/) })
await test("P51 Bankak UI states initiated and awaiting without false success", () => { const html = renderToStaticMarkup(React.createElement(PaymentInitiationPanel, { intent: { bookingIntentId: seeded.bookingIntentId, customerPrice }, state: { status: "bankak_handoff", result: bankak } })); assert.match(html, /تم إنشاء طلب الدفع/); assert.match(html, /بانتظار/); assert.doesNotMatch(html, /تم الدفع|تم الحجز|تم تأكيد الرحلة|تم إصدار التذكرة/) })
await test("P52 PSP UI is honest when only mock or sandbox is active", () => { const html = renderToStaticMarkup(React.createElement(PaymentInitiationPanel, { intent: { bookingIntentId: pspSeed.bookingIntentId, customerPrice }, state: { status: "psp_handoff", result: card } })); assert.match(html, /Sandbox\/Mock/); assert.doesNotMatch(html, /تم الدفع|تم الحجز|تم إصدار التذكرة/) })
await vite.close()

const migration = await fs.readFile(new URL("../supabase/migrations/20260829183000_flight_payment_initiation_v1.sql", import.meta.url), "utf8")
await test("P53 migration creates a private forced-RLS initiation ledger", () => { assert.match(migration, /create table app_private\.flight_payment_initiations/); assert.match(migration, /enable row level security/); assert.match(migration, /force row level security/); assert.match(migration, /to anon, authenticated\s+using \(false\)\s+with check \(false\)/) })
await test("P54 migration RPCs pin search_path and execute only as service_role", () => { assert.equal((migration.match(/security definer/g) || []).length, 2); assert.equal((migration.match(/set search_path = ''/g) || []).length, 2); assert.equal((migration.match(/to service_role/g) || []).length, 2); assert.equal(/grant execute[\s\S]*to authenticated/.test(migration), false) })
await test("P55 migration atomically inserts booking before its one payment", () => { assert.match(migration, /insert into public\.bookings[\s\S]*insert into public\.payments/); assert.match(migration, /booking_id uuid not null unique/); assert.match(migration, /booking_intent_id uuid not null unique/) })
await test("P56 migration freezes initiation statuses and Bankak 24-hour expiry", () => { assert.match(migration, /'pending_payment'/); assert.match(migration, /'awaiting'/); assert.match(migration, /now\(\) \+ interval '24 hours'/); assert.doesNotMatch(migration, /interval '15 minutes'/) })
await test("P57 B12 source contains no payment-confirmation or supplier-execution authority", async () => { const files = ["../src/server/payments/flightPaymentInitiationV1.js", "../src/server/payments/flightPaymentInitiationStoreV1.js", "../src/server/http/customerFlightPaymentInitiationHttpV1.js", "../src/features/flights/FlightsPage.jsx"]; const source = (await Promise.all(files.map((file) => fs.readFile(new URL(file, import.meta.url), "utf8")))).join("\n"); assert.equal(/apply_payment_event|review_bankak_payment|apply_booking_transition|createBooking|holdOffer|issueTicket|supplierReference|\.capture\(|\.refund\(|console\./i.test(source), false) })

const rpcCalls = []
const durableStore = createSupabaseFlightPaymentInitiationStoreV1({ client: { async rpc(name, args) { rpcCalls.push({ name, args }); if (name === "prepare_flight_payment_initiation_v1") return { data: [{ booking_id: "33333333-3333-4333-8333-333333333333", booking_ref: "HJZ-ABCDEF123456", payment_id: "44444444-4444-4444-8444-444444444444", payment_reference: "PAY-ABCDEF123456", initiation_state: "PREPARED", payment_method: "card", replayed: false }] }; return { data: [{ booking_id: "33333333-3333-4333-8333-333333333333", booking_ref: "HJZ-ABCDEF123456", payment_id: "44444444-4444-4444-8444-444444444444", payment_reference: "PAY-ABCDEF123456", initiation_state: "MATERIALIZED", payment_method: "card", booking_status: "pending_payment", payment_status: "awaiting", amount: "999.00", currency: "AED", expires_at: "2026-09-15T04:30:00.000Z", provider_session_token: "safe-session", provider_redirect_url: null, psp_live: false, replayed: false }] } } } })
const durableReservation = await durableStore.prepare({ ownerId: OWNER, bookingIntentId: seeded.bookingIntentId, paymentMethod: "card", idempotencyKey: paymentKey("durable"), requestDigest: "d".repeat(64) })
await test("P58 durable prepare uses only the service-role RPC authority fields", () => { assert.equal(rpcCalls[0].name, "prepare_flight_payment_initiation_v1"); assert.deepEqual(Object.keys(rpcCalls[0].args).sort(), ["p_booking_intent_id", "p_idempotency_key", "p_owner_id", "p_payment_method", "p_request_digest"]); assert.equal(/traveler|contact|amount|currency|provider/.test(JSON.stringify(rpcCalls[0].args)), false) })
const durableResult = await durableStore.materialize({ reservation: durableReservation, providerHandoff: { providerName: "mock_psp", providerPaymentId: "mock-pay", providerSession: "safe-session", redirectUrl: null, live: false }, bankakConfig: null, paymentExpiresAt: "2026-09-15T04:30:00.000Z", handoffDigest: "e".repeat(64) })
await test("P59 durable materialization maps only the safe customer handoff", () => { assert.deepEqual([durableResult.bookingStatus, durableResult.paymentStatus, durableResult.providerSession], ["pending_payment", "awaiting", "safe-session"]); assert.equal(Object.hasOwn(durableResult, "providerName"), false) })
await test("P60 durable RPC adapter never carries traveler PII or client economics", () => { const serialized = JSON.stringify(rpcCalls); assert.equal(/PRIVATE-ALI|PRIVATE-P123|private@example\.com|traveler_snapshot|contact_snapshot|net_cost|commission|margin/.test(serialized), false) })

assert.equal(passed, 60)
process.stdout.write(`Flight payment initiation B12 tests: ${passed}/60 passed\n`)
