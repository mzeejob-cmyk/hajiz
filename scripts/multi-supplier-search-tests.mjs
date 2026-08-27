import assert from "node:assert/strict"
import { createFlightOfferV1 } from "../src/server/suppliers/flightOfferV1.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import { createMultiSupplierFlightSearchOrchestrator } from "../src/server/suppliers/multiSupplierSearchOrchestrator.js"
import { createMultiSupplierSearchPolicy } from "../src/server/suppliers/multiSupplierSearchPolicy.js"
import { SUPPLIER_OPERATIONS } from "../src/server/suppliers/supplierOperations.js"
import { createSupplierRegistry } from "../src/server/suppliers/supplierRegistry.js"

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const searchInput = Object.freeze({ origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 })
const [baseOffer] = await createMockFlightSupplier().searchFlights(searchInput)

const offerFor = (provider, suffix) => createFlightOfferV1({
  ...baseOffer,
  internalOfferId: `hfo_${provider}_${suffix}_00000000`,
  provider,
  providerOfferRef: `${provider}-${suffix}`,
  privateMetadata: { synthetic: true, fixture: suffix },
})
const capabilities = (searchEnabled = true) => Object.freeze(Object.fromEntries(SUPPLIER_OPERATIONS.map((operation) => [operation, operation === "search_flights" && searchEnabled])))
const fakeAdapter = (providerName, handler, searchEnabled = true) => Object.freeze({
  providerName,
  capabilities: capabilities(searchEnabled),
  async searchFlights(input, context) { return handler(input, context) },
  async health() { return Object.freeze({ providerName, healthy: true }) },
})
const registryFor = (adapters, enabledProviderNames = adapters.map(({ providerName }) => providerName)) => createSupplierRegistry({
  adapters,
  enabledProviderNames,
  defaultProviderName: enabledProviderNames[0],
})
const telemetryMemory = () => {
  const events = []
  return { events, sink: Object.freeze({ emit(event) { events.push(event) } }) }
}
const orchestratorFor = (adapters, options = {}) => {
  const memory = options.memory ?? telemetryMemory()
  return {
    memory,
    orchestrator: createMultiSupplierFlightSearchOrchestrator({
      registry: options.registry ?? registryFor(adapters, options.enabledProviderNames),
      policy: { maxConcurrency: options.maxConcurrency ?? 3, supplierTimeoutMs: options.supplierTimeoutMs ?? 100 },
      telemetry: memory.sink,
      traceIdFactory: () => "htr_test_trace_0001",
    }),
  }
}

test("A two suppliers succeed with COMPLETE and all offers", async () => {
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => [offerFor("mock", "a")]),
    fakeAdapter("travelport", async () => [offerFor("travelport", "a")]),
  ])
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.contractVersion, "multi-supplier-flight-search/v1")
  assert.equal(result.status, "COMPLETE")
  assert.equal(result.offers.length, 2)
  assert.deepEqual(result.supplierOutcomes.map(({ status }) => status), ["success", "success"])
})

test("B one success and one throw yields PARTIAL with successful offers", async () => {
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => [offerFor("mock", "b")]),
    fakeAdapter("travelport", async () => { throw new Error("private provider failure") }),
  ])
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "PARTIAL")
  assert.equal(result.offers.length, 1)
  assert.deepEqual(result.supplierOutcomes.map(({ status }) => status), ["success", "error"])
})

test("C one success and one timeout yields PARTIAL", async () => {
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => [offerFor("mock", "c")]),
    fakeAdapter("travelport", () => new Promise(() => {})),
  ], { supplierTimeoutMs: 15 })
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "PARTIAL")
  assert.deepEqual(result.supplierOutcomes.map(({ status }) => status), ["success", "timeout"])
})

test("D all timeout or fail yields UNAVAILABLE", async () => {
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => { throw new Error("fail") }),
    fakeAdapter("travelport", () => new Promise(() => {})),
  ], { supplierTimeoutMs: 15 })
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "UNAVAILABLE")
  assert.equal(result.offers.length, 0)
})

test("E all no-results suppliers yield COMPLETE with no offers", async () => {
  const { orchestrator } = orchestratorFor([fakeAdapter("mock", async () => []), fakeAdapter("travelport", async () => [])])
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "COMPLETE")
  assert.deepEqual(result.offers, [])
})

test("F no-results plus timeout yields PARTIAL with no offers", async () => {
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => []),
    fakeAdapter("travelport", () => new Promise(() => {})),
  ], { supplierTimeoutMs: 15 })
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "PARTIAL")
  assert.equal(result.offers.length, 0)
})

test("G any malformed offer invalidates that provider attempt", async () => {
  const malformed = { ...offerFor("travelport", "g-bad"), contractVersion: "flight-offer/v2" }
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => [offerFor("mock", "g")]),
    fakeAdapter("travelport", async () => [offerFor("travelport", "g-good"), malformed]),
  ])
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "PARTIAL")
  assert.equal(result.offers.length, 1)
  assert.equal(result.supplierOutcomes[1].status, "invalid_response")
})

test("H worker pool never exceeds configured concurrency", async () => {
  let active = 0
  let observedMax = 0
  const handler = async (_, { signal }) => {
    assert.equal(signal instanceof AbortSignal, true)
    active += 1
    observedMax = Math.max(observedMax, active)
    await sleep(12)
    active -= 1
    return []
  }
  const { orchestrator } = orchestratorFor([fakeAdapter("mock", handler), fakeAdapter("travelport", handler)], { maxConcurrency: 1 })
  await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(observedMax, 1)
})

test("I aggregation follows registry order instead of completion order", async () => {
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => { await sleep(20); return [offerFor("mock", "first")] }),
    fakeAdapter("travelport", async () => [offerFor("travelport", "second")]),
  ])
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.deepEqual(result.offers.map(({ provider }) => provider), ["mock", "travelport"])
  assert.deepEqual(result.supplierOutcomes.map(({ provider }) => provider), ["mock", "travelport"])
})

test("J supplier timeout bounds wall-clock execution", async () => {
  const { orchestrator } = orchestratorFor([fakeAdapter("mock", () => new Promise(() => {}))], { supplierTimeoutMs: 20 })
  const started = Date.now()
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "UNAVAILABLE")
  assert.ok(Date.now() - started < 150)
})

test("K late resolve is ignored with one timeout terminal event", async () => {
  const memory = telemetryMemory()
  const { orchestrator } = orchestratorFor([fakeAdapter("mock", async () => { await sleep(45); return [offerFor("mock", "late")] })], { supplierTimeoutMs: 10, memory })
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  const finalized = JSON.stringify(result)
  await sleep(60)
  assert.equal(JSON.stringify(result), finalized)
  assert.equal(memory.events.filter(({ event }) => event.startsWith("supplier_search.") && event !== "supplier_search.started").length, 1)
  assert.equal(result.supplierOutcomes[0].status, "timeout")
})

test("L late reject is handled without contradictory telemetry", async () => {
  const memory = telemetryMemory()
  let unhandled = 0
  const listener = () => { unhandled += 1 }
  process.on("unhandledRejection", listener)
  try {
    const { orchestrator } = orchestratorFor([fakeAdapter("mock", async () => { await sleep(45); throw new Error("late private failure") })], { supplierTimeoutMs: 10, memory })
    const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
    await sleep(60)
    assert.equal(result.supplierOutcomes[0].status, "timeout")
    assert.equal(unhandled, 0)
    assert.equal(memory.events.filter(({ event }) => event.startsWith("supplier_search.") && event !== "supplier_search.started").length, 1)
  } finally {
    process.off("unhandledRejection", listener)
  }
})

test("M disabled suppliers are never called", async () => {
  let disabledCalls = 0
  const mock = fakeAdapter("mock", async () => [])
  const travelport = fakeAdapter("travelport", async () => { disabledCalls += 1; return [] })
  const { orchestrator } = orchestratorFor([mock, travelport], { enabledProviderNames: ["mock"] })
  await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(disabledCalls, 0)
})

test("N incapable suppliers are never called", async () => {
  let incapableCalls = 0
  const mock = fakeAdapter("mock", async () => [])
  const travelport = fakeAdapter("travelport", async () => { incapableCalls += 1; return [] }, false)
  const { orchestrator } = orchestratorFor([mock, travelport])
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(incapableCalls, 0)
  assert.equal(result.supplierOutcomes.length, 1)
})

test("O zero capable enabled suppliers fails with canonical unavailable error", async () => {
  const registry = Object.freeze({ getEnabledSuppliersForCapability() { return Object.freeze([]) } })
  const { orchestrator } = orchestratorFor([], { registry })
  await assert.rejects(() => orchestrator.searchFlightsAcrossSuppliers(searchInput), (error) => error?.code === "FLIGHT_SEARCH_UNAVAILABLE")
})

test("P client input cannot select supplier or order", async () => {
  const { orchestrator } = orchestratorFor([fakeAdapter("mock", async () => [])])
  for (const field of ["provider", "providerName", "providerNames", "supplier", "suppliers", "supplierList", "supplierOrder"]) {
    await assert.rejects(() => orchestrator.searchFlightsAcrossSuppliers({ ...searchInput, [field]: "mock" }), /clients cannot select suppliers/)
  }
})

test("Q telemetry emits exactly one terminal outcome per attempt", async () => {
  const memory = telemetryMemory()
  const { orchestrator } = orchestratorFor([
    fakeAdapter("mock", async () => []),
    fakeAdapter("travelport", async () => { throw new Error("private") }),
  ], { memory })
  await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  const terminals = memory.events.filter(({ event }) => ["supplier_search.completed", "supplier_search.timeout", "supplier_search.failed"].includes(event))
  assert.equal(terminals.length, 2)
  assert.equal(new Set(terminals.map(({ provider }) => provider)).size, 2)
})

test("R telemetry excludes raw responses and private supplier data", async () => {
  const memory = telemetryMemory()
  const { orchestrator } = orchestratorFor([fakeAdapter("mock", async () => [offerFor("mock", "telemetry")])], { memory })
  await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  const serialized = JSON.stringify(memory.events)
  for (const forbidden of ["privateMetadata", "supplierAmount", "supplierCurrency", "providerOfferRef", "supplier_reference_payload", "fixture"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("telemetry sink failures never affect search and later events remain attempted", async () => {
  const attempted = []
  let supplierCalls = 0
  const telemetry = Object.freeze({
    emit(event) {
      attempted.push(event.event)
      throw new Error("telemetry backend down")
    },
  })
  const orchestrator = createMultiSupplierFlightSearchOrchestrator({
    registry: registryFor([fakeAdapter("mock", async () => {
      supplierCalls += 1
      return [offerFor("mock", "telemetry-down")]
    })]),
    policy: { maxConcurrency: 1, supplierTimeoutMs: 100 },
    telemetry,
    traceIdFactory: () => "htr_test_trace_failure",
  })

  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(supplierCalls, 1)
  assert.equal(result.status, "COMPLETE")
  assert.equal(result.offers.length, 1)
  assert.equal(result.offers[0].provider, "mock")
  assert.deepEqual(attempted, ["search.started", "supplier_search.started", "supplier_search.completed", "search.completed"])
  assert.equal(JSON.stringify(result).includes("telemetry backend down"), false)
})

test("S malformed non-array supplier response fails FlightOffer boundary", async () => {
  const { orchestrator } = orchestratorFor([fakeAdapter("mock", async () => ({ offers: [] }))])
  const result = await orchestrator.searchFlightsAcrossSuppliers(searchInput)
  assert.equal(result.status, "UNAVAILABLE")
  assert.equal(result.supplierOutcomes[0].status, "invalid_response")
})

test("server policy is bounded, centrally defaulted, and rejects malformed values", () => {
  assert.deepEqual(createMultiSupplierSearchPolicy(), { maxConcurrency: 3, supplierTimeoutMs: 5_000 })
  for (const policy of [{ maxConcurrency: 0 }, { maxConcurrency: 17 }, { maxConcurrency: 1.5 }, { supplierTimeoutMs: 0 }, { supplierTimeoutMs: "10" }, { clientDeadline: 10 }]) {
    assert.throws(() => createMultiSupplierSearchPolicy(policy))
  }
})

let failures = 0
for (const { name, fn } of tests) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    failures += 1
    console.error(`not ok - ${name}`)
    console.error(error)
  }
}

console.log(`${tests.length - failures}/${tests.length} multi-supplier search tests passed`)
if (failures) process.exitCode = 1
