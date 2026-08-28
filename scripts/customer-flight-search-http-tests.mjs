import assert from "node:assert/strict"
import { createCustomerFlightSearchHttpHandlerV1, validatePublicFlightSearchRequestV1 } from "../src/server/http/customerFlightSearchHttpV1.js"
import { createFlightOfferV1 } from "../src/server/suppliers/flightOfferV1.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import { createMultiSupplierFlightSearchOrchestrator, FlightSearchTimeoutError } from "../src/server/suppliers/multiSupplierSearchOrchestrator.js"
import { createSupplierRegistry } from "../src/server/suppliers/supplierRegistry.js"
import { SUPPLIER_OPERATIONS } from "../src/server/suppliers/supplierOperations.js"
import { createFxSnapshotV1, createPricingPolicyV1 } from "../src/server/pricing/pricingFxV1.js"

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const NOW = "2026-09-15T02:00:00.000Z"
const NOW_MS = Date.parse(NOW)
const request = (changes = {}) => ({
  tripType: "one_way", origin: "DXB", destination: "KRT", departureDate: "2026-09-15", returnDate: null,
  adults: 1, children: 0, infants: 0, cabinClass: "economy", customerCurrency: "AED", ...changes,
})
const capabilities = Object.freeze(Object.fromEntries(SUPPLIER_OPERATIONS.map((operation) => [operation, operation === "search_flights"])))
const adapter = (providerName, searchFlights) => Object.freeze({ providerName, capabilities, searchFlights, async health() { return { providerName, healthy: true } } })
const registry = (adapters) => createSupplierRegistry({ adapters, enabledProviderNames: adapters.map(({ providerName }) => providerName), defaultProviderName: adapters[0].providerName })
const pricingPolicy = createPricingPolicyV1({
  contractVersion: "pricing-policy/v1", pricingPolicyVersion: "pricing-http-test-v1", marginPct: "10", maxMarginPct: "25",
  partnerCommissionRatePct: "20", agentUpliftAmountUsd: "5", maxAgentUpliftAmountUsd: "20",
  validFrom: "2026-09-15T00:00:00.000Z", validUntil: "2026-09-15T05:00:00.000Z",
})
const fx = (baseCurrency, quoteCurrency, referenceRate) => createFxSnapshotV1({
  contractVersion: "fx-snapshot/v1", snapshotId: `hfx_http_${baseCurrency}_${quoteCurrency}_0001`, baseCurrency, quoteCurrency,
  referenceRate, source: "trusted_http_test", bufferPct: "0", volatilityGuardPct: "20", observedVolatilityPct: "1",
  fetchedAt: "2026-09-15T00:00:00.000Z", effectiveAt: "2026-09-15T00:05:00.000Z", expiresAt: "2026-09-15T05:30:00.000Z", policyVersion: "fx-http-test-v1",
})
const fxSnapshotsByPair = Object.freeze({
  AED_USD: fx("AED", "USD", "0.25"), USD_AED: fx("USD", "AED", "4"),
  USD_USD: fx("USD", "USD", "1"), USD_SDG: fx("USD", "SDG", "600"),
})
const rankingPolicy = Object.freeze({ contractVersion: "flight-ranking-policy/v1", rankingPolicyVersion: "ranking-http-test-v1", mode: "price_only", validFrom: "2026-09-15T00:00:00.000Z", validUntil: "2026-09-15T05:00:00.000Z" })
const handlerFor = (adapters, changes = {}) => {
  const orchestrator = changes.orchestrator ?? createMultiSupplierFlightSearchOrchestrator({
    registry: registry(adapters), policy: { maxConcurrency: 2, supplierTimeoutMs: 100, requestTimeoutMs: 1_000 },
    traceIdFactory: () => "htr_http_test_0001", now: () => NOW_MS,
  })
  return createCustomerFlightSearchHttpHandlerV1({ orchestrator, pricingPolicy, fxSnapshotsByPair, rankingPolicy, requestTimeoutMs: changes.requestTimeoutMs ?? 500, clock: changes.clock ?? (() => NOW_MS) })
}
const mock = createMockFlightSupplier()
const invoke = (handler, body = request(), extra = {}) => handler({ method: "POST", body, ...extra })

test("A valid one-way request returns versioned customer HTTP success", async () => {
  const result = await invoke(handlerFor([mock]))
  assert.equal(result.status, 200)
  assert.equal(result.body.contractVersion, "customer-flight-search-http/v1")
  assert.equal(result.body.data.contractVersion, "customer-flight-search/v1")
  assert.equal(result.headers["content-type"], "application/json; charset=utf-8")
})

test("B valid round-trip request preserves the provider-neutral request", async () => {
  let seen
  const capturing = adapter("mock", async (input) => { seen = input; return mock.searchFlights(input) })
  const body = request({ tripType: "round_trip", returnDate: "2026-09-20", children: 2, infants: 1, cabinClass: "business" })
  assert.equal((await invoke(handlerFor([capturing]), body)).status, 200)
  assert.deepEqual({ tripType: seen.tripType, returnDate: seen.returnDate, children: seen.children, infants: seen.infants, cabinClass: seen.cabinClass }, { tripType: "round_trip", returnDate: "2026-09-20", children: 2, infants: 1, cabinClass: "business" })
})

test("C-G strict request validation rejects invalid trip IATA dates passengers and currency", () => {
  const invalid = [
    request({ tripType: "multi_city" }), request({ origin: "dxb" }), request({ destination: "DXB" }),
    request({ departureDate: "2026-02-30" }), request({ departureDate: "2026-09-14" }), request({ returnDate: "2026-09-20" }),
    request({ tripType: "round_trip", returnDate: null }), request({ tripType: "round_trip", returnDate: "2026-09-14" }),
    request({ adults: 0 }), request({ children: -1 }), request({ infants: 0.5 }), request({ customerCurrency: "EUR" }),
  ]
  for (const body of invalid) assert.throws(() => validatePublicFlightSearchRequestV1(body, { requestNow: NOW_MS }))
})

test("H-K public override and provider injection fields are rejected rather than ignored", async () => {
  const handler = handlerFor([mock])
  for (const [field, value] of Object.entries({ provider: "travelport", preferredProvider: "mock", supplierIds: ["mock"], marginPct: "0", maxMarginPct: "999", fxRate: "1", rankingMode: "supplier_net", timeoutMs: 999999, maxConcurrency: 99, now: NOW, traceId: "private", adapterOptions: {} })) {
    const result = await invoke(handler, { ...request(), [field]: value })
    assert.equal(result.status, 400, field)
    assert.equal(result.body.error.code, "VALIDATION_ERROR")
  }
})

test("dangerous prototypes malformed bodies and oversized values fail validation", async () => {
  const handler = handlerFor([mock])
  const polluted = JSON.parse(`{"tripType":"one_way","origin":"DXB","destination":"KRT","departureDate":"2026-09-15","returnDate":null,"adults":1,"children":0,"infants":0,"cabinClass":"economy","customerCurrency":"AED","__proto__":{"polluted":true}}`)
  for (const body of [null, [], true, { ...request(), adults: [1] }, { ...request(), cabinClass: {} }, { ...request(), origin: "D".repeat(5_000) }, polluted]) assert.equal((await invoke(handler, body)).status, 400)
  assert.equal({}.polluted, undefined)
})

test("L COMPLETE and M PARTIAL are HTTP 200 without supplier cause", async () => {
  const complete = await invoke(handlerFor([mock]))
  const failing = adapter("travelport", async () => { throw new Error("RAW_PROVIDER_FAILURE_SENTINEL") })
  const partial = await invoke(handlerFor([mock, failing]))
  assert.equal(complete.body.data.searchStatus, "COMPLETE")
  assert.equal(partial.status, 200)
  assert.equal(partial.body.data.searchStatus, "PARTIAL")
  assert.ok(!JSON.stringify(partial.body).includes("RAW_PROVIDER_FAILURE_SENTINEL"))
  assert.ok(!JSON.stringify(partial.body).includes("travelport"))
})

test("E1 successful empty search is HTTP 200 COMPLETE with no groups", async () => {
  const empty = adapter("mock", async () => [])
  const result = await invoke(handlerFor([empty]))
  assert.equal(result.status, 200)
  assert.equal(result.body.data.searchStatus, "COMPLETE")
  assert.deepEqual(result.body.data.groups, [])
})

test("E2 multiple successful no-result suppliers remain HTTP 200 COMPLETE", async () => {
  const result = await invoke(handlerFor([adapter("mock", async () => []), adapter("travelport", async () => [])]))
  assert.equal(result.status, 200)
  assert.equal(result.body.data.searchStatus, "COMPLETE")
  assert.deepEqual(result.body.data.groups, [])
})

test("E3 genuine upstream search unavailability remains customer-safe 503", async () => {
  const unavailable = Object.freeze({
    policy: { requestTimeoutMs: 1_000 },
    async searchFlightsAcrossSuppliers() { return { contractVersion: "multi-supplier-flight-search/v1", traceId: "htr_unavailable_test_01", status: "UNAVAILABLE", offers: [], supplierOutcomes: [{ provider: "mock", status: "error", durationMs: 1, offerCount: 0, errorCode: "PRIVATE" }], startedAt: NOW, completedAt: NOW, durationMs: 1 } },
  })
  const result = await invoke(handlerFor([], { orchestrator: unavailable }))
  assert.equal(result.status, 503)
  assert.equal(result.body.error.code, "SEARCH_UNAVAILABLE")
})

test("P1 expired supplier offer is isolated while valid provider result survives", async () => {
  const [base] = await mock.searchFlights(request())
  const expired = createFlightOfferV1({ ...base, internalOfferId: "hfo_http_expired_offer", providerOfferRef: "EXPIRED_SUPPLIER_REF", validity: { expiresAt: NOW, repriceRequired: true }, economics: { supplierAmount: "9999.99", supplierCurrency: "AED" } })
  const valid = createFlightOfferV1({ ...base, internalOfferId: "hfo_http_valid_offer_01", provider: "travelport", providerOfferRef: "VALID_PRIVATE_REF" })
  const result = await invoke(handlerFor([adapter("mock", async () => [expired]), adapter("travelport", async () => [valid])]))
  assert.equal(result.status, 200)
  assert.equal(result.body.data.searchStatus, "COMPLETE")
  assert.equal(result.body.data.groups[0].alternatives.length, 1)
  const serialized = JSON.stringify(result.body)
  for (const forbidden of ["EXPIRED_SUPPLIER_REF", "VALID_PRIVATE_REF", "9999.99", "travelport", "providerOfferRef", "supplierAmount"]) assert.ok(!serialized.includes(forbidden), forbidden)
})

test("E5 COMPLETE search with only expired offers is successful empty result", async () => {
  const [base] = await mock.searchFlights(request())
  const expired = createFlightOfferV1({ ...base, internalOfferId: "hfo_http_all_expired_1", providerOfferRef: "expired-only", validity: { expiresAt: NOW, repriceRequired: true } })
  const result = await invoke(handlerFor([adapter("mock", async () => [expired])]))
  assert.equal(result.status, 200)
  assert.equal(result.body.data.searchStatus, "COMPLETE")
  assert.deepEqual(result.body.data.groups, [])
})

test("O endpoint maps global deadline to safe 504", async () => {
  const timedOut = Object.freeze({ policy: { requestTimeoutMs: 1_000 }, async searchFlightsAcrossSuppliers() { throw new FlightSearchTimeoutError() } })
  const result = await invoke(handlerFor([], { orchestrator: timedOut }))
  assert.equal(result.status, 504)
  assert.deepEqual(result.body.error, { code: "REQUEST_TIMEOUT", message: "Flight search timed out." })
})

test("unexpected private failures map to generic 500 without stack or internals", async () => {
  const broken = Object.freeze({ policy: { requestTimeoutMs: 1_000 }, async searchFlightsAcrossSuppliers() { throw new Error("PRIVATE_STACK_SENTINEL") } })
  const result = await invoke(handlerFor([], { orchestrator: broken }))
  assert.equal(result.status, 500)
  assert.equal(result.body.error.code, "INTERNAL_ERROR")
  assert.ok(!JSON.stringify(result.body).includes("PRIVATE_STACK_SENTINEL"))
  assert.ok(!Object.hasOwn(result.body.error, "stack"))
})

test("V-W-X stable public IDs are deterministic and domain separated through HTTP", async () => {
  const handler = handlerFor([mock])
  const left = await invoke(handler)
  const right = await invoke(handler)
  const group = left.body.data.groups[0]
  assert.equal(group.groupId, right.body.data.groups[0].groupId)
  assert.equal(group.alternatives[0].alternativeId, right.body.data.groups[0].alternatives[0].alternativeId)
  assert.notEqual(group.groupId.slice("hcg_v1_".length), group.alternatives[0].alternativeId.slice("hca_v1_".length))
})

test("Y-AA adversarial full endpoint output contains no supplier economics or ranking internals", async () => {
  const [base] = await mock.searchFlights(request())
  const privateOffer = createFlightOfferV1({
    ...base, internalOfferId: "hfo_travelport_private_sentinel", provider: "travelport", providerOfferRef: "LEAK_PROVIDER_REF",
    economics: { supplierAmount: "9876.54", supplierCurrency: "AED" },
    privateMetadata: { diagnostics: "LEAK_DIAGNOSTICS", quality: "LEAK_QUALITY", operationId: "LEAK_OPERATION" },
    fare: { ...base.fare, privateMetadata: { margin: "LEAK_MARGIN", commission: "LEAK_COMMISSION" } },
  })
  const privateResult = Object.freeze({
    contractVersion: "multi-supplier-flight-search/v1", traceId: "htr_private_trace_sentinel", status: "COMPLETE", offers: [privateOffer],
    supplierOutcomes: [{ provider: "travelport", status: "success", durationMs: 1, offerCount: 1 }], startedAt: NOW, completedAt: NOW, durationMs: 1,
  })
  const source = Object.freeze({ policy: { requestTimeoutMs: 1_000 }, async searchFlightsAcrossSuppliers() { return privateResult } })
  const result = await invoke(handlerFor([], { orchestrator: source }))
  assert.equal(result.status, 200)
  const serialized = JSON.stringify(result.body)
  for (const value of ["travelport", "LEAK_PROVIDER_REF", "9876.54", "LEAK_DIAGNOSTICS", "LEAK_QUALITY", "LEAK_OPERATION", "LEAK_MARGIN", "LEAK_COMMISSION", "htr_private_trace_sentinel"]) assert.ok(!serialized.includes(value), value)
  for (const key of ["provider", "providerOfferRef", "supplierAmount", "supplierCurrency", "rankingPolicyVersion", "rankable", "rank", "pricedOffer", "canonicalUsdAmount"]) assert.ok(!serialized.includes(`"${key}"`), key)
  assert.doesNotThrow(() => JSON.stringify(result.body))
})

test("AB server clock is read once and stale recommendations cannot arise from layer clock drift", async () => {
  let clockReads = 0
  const handler = handlerFor([mock], { clock: () => { clockReads += 1; return NOW_MS } })
  const result = await invoke(handler)
  assert.equal(result.status, 200)
  assert.equal(clockReads, 1)
  assert.equal(result.body.data.groups[0].recommendationAvailable, true)
})

test("HTTP request signal is composed into trusted orchestration context", async () => {
  const controller = new AbortController()
  let observed
  const source = Object.freeze({ policy: { requestTimeoutMs: 1_000 }, async searchFlightsAcrossSuppliers(_, context) { observed = context.signal; throw new FlightSearchTimeoutError() } })
  await invoke(handlerFor([], { orchestrator: source }), request(), { signal: controller.signal })
  assert.equal(observed, controller.signal)
})

let failures = 0
for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok - ${name}`) }
  catch (error) { failures += 1; console.error(`not ok - ${name}`); console.error(error) }
}
console.log(`${tests.length - failures}/${tests.length} customer flight search HTTP tests passed`)
if (failures) process.exitCode = 1
