import assert from "node:assert/strict"
import fs from "node:fs/promises"

export async function runSupplierAdapterTests(vite, test) {
  const contract = await vite.ssrLoadModule("/src/server/suppliers/flightSupplierContract.js")
  const { createMockFlightSupplier } = await vite.ssrLoadModule("/src/server/suppliers/mockFlightSupplier.js")
  const { createSupplierRegistry, selectSupplierForClientRequest } = await vite.ssrLoadModule("/src/server/suppliers/supplierRegistry.js")
  const { toPublicFlightOffer } = await vite.ssrLoadModule("/src/server/suppliers/publicOfferMapper.js")
  const orchestration = await vite.ssrLoadModule("/src/server/suppliers/bookingOrchestration.js")
  const mock = createMockFlightSupplier()
  const registry = createSupplierRegistry({ adapters: [mock], enabledProviderNames: [mock.providerName], defaultProviderName: mock.providerName })
  const search = { origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 }

  await test("supplier registry fails closed for unknown and disabled providers", () => {
    assert.throws(() => registry.getByServerProviderName("unknown"))
    assert.throws(() => createSupplierRegistry({ adapters: [mock], enabledProviderNames: [], defaultProviderName: mock.providerName }))
  })
  await test("client input cannot select an arbitrary supplier", () => {
    assert.equal(selectSupplierForClientRequest(registry, {}).providerName, mock.providerName)
    for (const field of ["provider", "supplier", "providerName"]) assert.throws(() => selectSupplierForClientRequest(registry, { [field]: mock.providerName }))
  })
  await test("mock search is deterministic and matches the synthetic EK 735 route", async () => {
    assert.deepEqual(await mock.searchFlights(search), await mock.searchFlights(search))
    const [offer] = await mock.searchFlights(search)
    assert.equal(offer.itinerary.airlineCode, "EK")
    assert.equal(offer.itinerary.flightNumber, "735")
    assert.equal((await mock.searchFlights({ ...search, origin: "AUH" })).length, 0)
  })
  await test("public mapper emits exactly the frozen customer offer fields", async () => {
    const [privateOffer] = await mock.searchFlights(search)
    const publicOffer = toPublicFlightOffer(privateOffer, { sellingAmount: "1205.00", currency: "AED" })
    assert.deepEqual(Object.keys(publicOffer), contract.PUBLIC_FLIGHT_OFFER_FIELDS)
    assert.equal(publicOffer.airlineCode, "EK")
  })
  await test("supplier raw data and economics never enter the public offer", async () => {
    const [privateOffer] = await mock.searchFlights(search)
    const publicOffer = toPublicFlightOffer(privateOffer, { sellingAmount: "1205.00", currency: "AED" })
    const serialized = JSON.stringify(publicOffer)
    for (const forbidden of ["supplierOfferRef", "providerName", "providerStatusRaw", "supplierEconomics", "netAmount", "privateMetadata", "MOCK_AVAILABLE"]) assert.equal(serialized.includes(forbidden), false)
  })
  await test("repricing is deterministic and keeps economics server-private", async () => {
    const [offer] = await mock.searchFlights(search)
    const first = await mock.repriceOffer(offer.supplierOfferRef)
    const second = await mock.repriceOffer(offer.supplierOfferRef)
    assert.deepEqual(first, second)
    assert.equal(first.expiresAt, "2026-09-15T06:20:00.000Z")
    assert.equal(first.supplierEconomics.netAmount, "1000.00")
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
  await test("mock health declares synthetic no-network operation", async () => {
    assert.deepEqual(await mock.health(), { providerName: mock.providerName, healthy: true, synthetic: true, network: false, capabilities: mock.capabilities })
  })
  await test("supplier layer has no network or direct persistence authority", async () => {
    const files = await fs.readdir(new URL("../src/server/suppliers", import.meta.url))
    const restricted = /fetch\s*\(|axios|XMLHttpRequest|WebSocket|supabase|service_role|\.from\s*\(|\.insert\s*\(|\.update\s*\(/i
    for (const file of files.filter((name) => name.endsWith(".js"))) {
      const source = await fs.readFile(new URL(`../src/server/suppliers/${file}`, import.meta.url), "utf8")
      assert.equal(restricted.test(source), false, file)
    }
  })
  await test("public fixture and documentation use no traveler PII or credentials", async () => {
    const source = await fs.readFile(new URL("../src/server/suppliers/mockFlightSupplier.js", import.meta.url), "utf8")
    assert.equal(/passport|dateOfBirth|givenName|familyName|email|phone|secret|api[_-]?key/i.test(source), false)
  })
}
