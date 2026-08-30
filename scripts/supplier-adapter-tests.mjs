import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { runFlightSupplierConformanceTests } from "./flight-supplier-conformance.mjs"

export async function runSupplierAdapterTests(vite, test) {
  const contract = await vite.ssrLoadModule("/src/server/suppliers/flightSupplierContract.js")
  const { createMockFlightSupplier } = await vite.ssrLoadModule("/src/server/suppliers/mockFlightSupplier.js")
  const { createSupplierRegistry, selectSupplierForClientRequest } = await vite.ssrLoadModule("/src/server/suppliers/supplierRegistry.js")
  const { toPublicFlightOffer } = await vite.ssrLoadModule("/src/server/suppliers/publicOfferMapper.js")
  const publicContract = await vite.ssrLoadModule("/src/server/suppliers/publicOfferMapper.js")
  const offerContract = await vite.ssrLoadModule("/src/server/suppliers/flightOfferV1.js")
  const providerIdentity = await vite.ssrLoadModule("/src/server/suppliers/providerIdentity.js")
  const orchestration = await vite.ssrLoadModule("/src/server/suppliers/bookingOrchestration.js")
  const mock = createMockFlightSupplier()
  const registry = createSupplierRegistry({ adapters: [mock], enabledProviderNames: [mock.providerName], defaultProviderName: mock.providerName })
  const search = { origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 }

  await test("supplier registry fails closed for unknown and disabled providers", () => {
    assert.throws(() => registry.getByServerProviderName("unknown"))
    assert.throws(() => createSupplierRegistry({ adapters: [mock], enabledProviderNames: [], defaultProviderName: mock.providerName }))
  })
  await test("provider identity separates known, implemented, enabled, and capable", () => {
    assert.ok(providerIdentity.KNOWN_SUPPLIER_PROVIDERS.includes("duffel"))
    assert.equal(providerIdentity.IMPLEMENTED_SUPPLIER_PROVIDERS.includes("duffel"), false)
    assert.throws(() => contract.assertFlightSupplier({ providerName: "duffel", capabilities: {}, health() {} }), /not implemented/)
    assert.deepEqual(registry.getEnabledSuppliersForCapability("search_flights").map(({ providerName }) => providerName), ["mock"])
    assert.deepEqual(registry.getEnabledSuppliersForCapability("confirm_booking"), [])
    assert.throws(() => registry.getEnabledSuppliersForCapability("not_real"), /unknown supplier operation/)
  })
  await test("client input cannot select an arbitrary supplier", () => {
    assert.equal(selectSupplierForClientRequest(registry, {}).providerName, mock.providerName)
    for (const field of ["provider", "supplier", "providerName"]) assert.throws(() => selectSupplierForClientRequest(registry, { [field]: mock.providerName }))
  })
  await test("mock search is deterministic and matches the synthetic EK 735 route", async () => {
    assert.deepEqual(await mock.searchFlights(search), await mock.searchFlights(search))
    const [offer] = await mock.searchFlights(search)
    assert.equal(offer.itinerary.segments[0].marketingCarrier, "EK")
    assert.equal(offer.itinerary.segments[0].flightNumber, "735")
    assert.equal((await mock.searchFlights({ ...search, origin: "AUH" })).length, 0)
  })
  await test("public mapper emits exactly the frozen customer offer fields", async () => {
    const [privateOffer] = await mock.searchFlights(search)
    const publicOffer = toPublicFlightOffer(privateOffer, { sellingAmount: "1205.00", currency: "AED" })
    assert.deepEqual(Object.keys(publicOffer), publicContract.PUBLIC_FLIGHT_OFFER_FIELDS)
    assert.equal(publicOffer.airlineCode, "EK")
  })
  await test("supplier raw data and economics never enter the public offer", async () => {
    const [privateOffer] = await mock.searchFlights(search)
    const publicOffer = toPublicFlightOffer(privateOffer, { sellingAmount: "1205.00", currency: "AED" })
    const serialized = JSON.stringify(publicOffer)
    for (const forbidden of ["providerOfferRef", "providerStatusRaw", "economics", "supplierAmount", "privateMetadata", "MOCK_AVAILABLE"]) assert.equal(serialized.includes(forbidden), false)
  })
  await test("repricing is deterministic and keeps economics server-private", async () => {
    const [offer] = await mock.searchFlights(search)
    const first = await mock.repriceOffer(offer.providerOfferRef)
    const second = await mock.repriceOffer(offer.providerOfferRef)
    assert.deepEqual(first, second)
    assert.equal(first.validity.expiresAt, "2026-09-15T06:20:00.000Z")
    assert.equal(first.economics.supplierAmount, "1000.00")
    assert.equal("sellingAmount" in first, false)
  })
  await test("createBooking is idempotent for a trusted key", async () => {
    const request = { supplierOfferRef: "mock-offer-dxb-krt-ek735", idempotencyKey: "trusted-001", trustedTravelerToken: "traveler-token-001" }
    assert.deepEqual(await mock.createBooking(request), await mock.createBooking(request))
  })
  await test("supplier execution enforces payment-confirmed precondition", () => {
    assert.equal(orchestration.assertSupplierExecutionPrecondition({ status: "payment_confirmed" }), true)
    for (const status of ["pending_payment", "processing", "confirmed", "ticketed"]) assert.throws(() => orchestration.assertSupplierExecutionPrecondition({ status }))
  })
  await test("supplier outcomes map only through allowed frozen transitions", () => {
    assert.equal(orchestration.nextBookingTransition("payment_confirmed", { operationalOutcome: "processing" }), "processing")
    assert.equal(orchestration.nextBookingTransition("processing", { operationalOutcome: "confirmed" }), "confirmed")
    assert.equal(orchestration.nextBookingTransition("confirmed", { operationalOutcome: "ticketed", ticketMetadata: { available: true } }), "ticketed")
    for (const status of ["held", "reserved", "issued", "successful"]) assert.throws(() => orchestration.nextBookingTransition(status, { operationalOutcome: "confirmed" }))
  })
  await test("confirmed never implies ticket availability", () => {
    assert.throws(() => orchestration.nextBookingTransition("confirmed", { operationalOutcome: "confirmed" }))
    assert.throws(() => orchestration.nextBookingTransition("confirmed", { operationalOutcome: "ticketed" }))
  })
  await test("ticket metadata is exposed only after ticketed supplier evidence", async () => {
    const booking = await mock.createBooking({ supplierOfferRef: "mock-offer-dxb-krt-ek735", idempotencyKey: "trusted-002", trustedTravelerToken: "traveler-token-002" })
    await assert.rejects(() => mock.retrieveTicket(booking.supplierBookingRef))
    const confirmed = await mock.getBookingStatus(booking.supplierBookingRef)
    assert.equal(confirmed.operationalOutcome, "confirmed")
    assert.equal("ticketMetadata" in confirmed, false)
    const ticketed = await mock.getBookingStatus(booking.supplierBookingRef)
    assert.equal(ticketed.operationalOutcome, "ticketed")
    assert.equal((await mock.retrieveTicket(booking.supplierBookingRef)).available, true)
  })
  await test("cancellation is guarded by the declared capability", async () => {
    assert.equal((await mock.cancelBooking("MOCK-EK735-trusted-002")).operationalOutcome, "cancelled")
    const disabled = { ...mock, capabilities: { ...mock.capabilities, cancel: false } }
    assert.throws(() => contract.requireCapability(disabled, "cancel"))
  })
  await test("mock health declares synthetic non-production no-network operation", async () => {
    assert.deepEqual(await mock.health(), { providerName: mock.providerName, healthy: true, synthetic: true, network: false, productionAllowed: false, capabilities: mock.capabilities })
  })
  await test("supplier layer has no network or direct persistence authority", async () => {
    const files = await fs.readdir(new URL("../src/server/suppliers", import.meta.url))
    const restricted = /axios|XMLHttpRequest|WebSocket|supabase|service_role|\.from\s*\(|\.insert\s*\(|\.update\s*\(/i
    const durableBoundaries = new Map([
      ["flightSupplierBookingExecutionStoreV1.js", "supabase-private-persistence"],
      ["flightSupplierTicketingStoreV1.js", "supabase-private-ticketing-persistence"],
    ])
    for (const file of files.filter((name) => name.endsWith(".js") && !durableBoundaries.has(name))) {
      const source = await fs.readFile(new URL(`../src/server/suppliers/${file}`, import.meta.url), "utf8")
      assert.equal(restricted.test(source), false, file)
    }
    for (const [durableBoundary, durability] of durableBoundaries) {
      const durableSource = await fs.readFile(new URL(`../src/server/suppliers/${durableBoundary}`, import.meta.url), "utf8")
      assert.match(durableSource, new RegExp(`durability: "${durability}"`))
      assert.match(durableSource, /client\.rpc\(name, parameters\)/)
      assert.doesNotMatch(durableSource, /axios|XMLHttpRequest|WebSocket|fetch\s*\(|fetchImpl\s*\(|\.from\s*\(|\.insert\s*\(|\.update\s*\(|service[_-]?role.{0,24}(key|secret)/i)
    }
    const networkCallers = files.filter((name) => name.endsWith(".js") && name !== "travelportClient.js")
    for (const file of networkCallers) {
      const source = await fs.readFile(new URL(`../src/server/suppliers/${file}`, import.meta.url), "utf8")
      assert.equal(/(?:fetch|fetchImpl)\s*\(/i.test(source), false, file)
    }
  })
  await test("public fixture and documentation use no traveler PII or credentials", async () => {
    const source = await fs.readFile(new URL("../src/server/suppliers/mockFlightSupplier.js", import.meta.url), "utf8")
    assert.equal(/passport|dateOfBirth|givenName|familyName|email|phone|secret|api[_-]?key/i.test(source), false)
  })

  const validOffer = (await mock.searchFlights(search))[0]
  await test("FlightOfferV1 rejects unknown or missing contract versions", () => {
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, contractVersion: undefined }), /unsupported FlightOffer contract version/)
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, contractVersion: "flight-offer/v2" }), /unsupported FlightOffer contract version/)
  })
  await test("FlightOfferV1 preserves supported operational outcomes and rejects unknown values", () => {
    for (const operationalOutcome of contract.OPERATIONAL_OUTCOMES) {
      assert.equal(offerContract.assertFlightOfferV1({ ...validOffer, operationalOutcome }).operationalOutcome, operationalOutcome)
    }
    for (const operationalOutcome of ["expired", "successful", "", null]) {
      assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, operationalOutcome }), /operationalOutcome is invalid/)
    }
  })
  await test("FlightOfferV1 rejects malformed dates, amounts, and currencies", () => {
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, itinerary: { ...validOffer.itinerary, departureAt: "not-a-date" } }), /ISO date-time/)
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, economics: { ...validOffer.economics, supplierAmount: "-1" } }), /positive decimal/)
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, economics: { ...validOffer.economics, supplierCurrency: "aed" } }), /ISO currency/)
  })
  await test("FlightOfferV1 validates segment continuity and itinerary boundaries", () => {
    const first = validOffer.itinerary.segments[0]
    const disconnected = { ...first, origin: "AUH", departureAt: "2026-09-15T12:00:00+04:00", arrivalAt: "2026-09-15T13:00:00+04:00" }
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, itinerary: { ...validOffer.itinerary, destination: disconnected.destination, arrivalAt: disconnected.arrivalAt, stops: 1, segments: [first, disconnected] } }), /segment continuity/)
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, itinerary: { ...validOffer.itinerary, origin: "AUH" } }), /boundaries/)
  })
  await test("FlightOfferV1 isolates provider metadata and rejects credential-shaped data", () => {
    assert.throws(() => offerContract.assertFlightOfferV1({ ...validOffer, privateMetadata: { accessToken: "forbidden" } }), /unsafe provider data/)
  })

  await runFlightSupplierConformanceTests({ test, label: "mock supplier", adapter: mock, searchRequest: search, assertFlightOfferV1: offerContract.assertFlightOfferV1, toPublicFlightOffer, expectedProvider: "mock" })
}
