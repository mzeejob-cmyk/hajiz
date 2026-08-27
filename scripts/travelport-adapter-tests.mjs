import assert from "node:assert/strict"
import { runFlightSupplierConformanceTests } from "./flight-supplier-conformance.mjs"

const responseFixture = (total = "1000.00") => ({
  CatalogProductOfferingsResponse: {
    transactionId: "transaction-test-1",
    CatalogProductOfferings: { CatalogProductOffering: [{
      id: "offering-1", ValidatingAirline: "EK", duration: "PT3H45M", cabin: "Economy",
      Price: { TotalPrice: total, CurrencyCode: { value: "AED" } },
      Product: [{ id: "product-1", FlightSegment: [{ Flight: { Departure: { location: "DXB", date: "2026-09-15", time: "08:30:00+04:00" }, Arrival: { location: "KRT", date: "2026-09-15", time: "10:50:00+02:00" }, number: "735", carrier: "EK" } }] }],
    }] },
  },
})

const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, async json() { return body } })

export async function runTravelportAdapterTests(vite, test) {
  const { createTravelportFlightSupplier } = await vite.ssrLoadModule("/src/server/suppliers/travelportFlightSupplier.js")
  const { toPublicFlightOffer } = await vite.ssrLoadModule("/src/server/suppliers/publicOfferMapper.js")
  const { assertFlightOfferV1 } = await vite.ssrLoadModule("/src/server/suppliers/flightOfferV1.js")
  const env = { TRAVELPORT_USERNAME: "test-user", TRAVELPORT_PASSWORD: "test-password", TRAVELPORT_CLIENT_ID: "test-client", TRAVELPORT_CLIENT_SECRET: "test-secret", TRAVELPORT_ACCESS_GROUP: "test-group" }

  await test("Travelport adapter fails closed without complete server credentials", async () => {
    const adapter = createTravelportFlightSupplier({ env: {}, fetchImpl() { throw new Error("network must not run") } })
    assert.equal(adapter.capabilities.search_flights, false)
    assert.deepEqual(await adapter.health(), { providerName: adapter.providerName, healthy: false, configured: false, networkChecked: false, capabilities: adapter.capabilities })
    await assert.rejects(() => adapter.searchFlights({ origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 }), /not enabled/)
  })

  await test("Travelport OAuth and search use only pre-production endpoints and server headers", async () => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      return calls.length === 1 ? jsonResponse({ access_token: "opaque-test-token", expires_in: 86400 }) : jsonResponse(responseFixture())
    }
    const ids = ["offer-local-1"]
    const controller = new AbortController()
    const adapter = createTravelportFlightSupplier({ env, fetchImpl, createId: () => ids.shift() })
    const [offer] = await adapter.searchFlights(
      { origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 },
      { signal: controller.signal, traceId: "htr_server_search_trace" },
    )
    assert.equal(calls[0].url, "https://auth.pp.travelport.net/oauth/token")
    assert.equal(calls[1].url, "https://api.pp.travelport.net/11/air/catalog/search/catalogproductofferings")
    assert.equal(calls[1].init.headers.authorization, "Bearer opaque-test-token")
    assert.equal(calls[1].init.headers.XAUTH_TRAVELPORT_ACCESSGROUP, "test-group")
    assert.equal(calls[1].init.headers["Accept-Version"], "11")
    assert.equal(calls[0].init.signal, controller.signal)
    assert.equal(calls[1].init.signal, controller.signal)
    assert.equal(calls[1].init.headers.traceId, "htr_server_search_trace")
    assert.equal(offer.providerOfferRef, "tp_offer-local-1")
    assert.equal(offer.itinerary.segments[0].marketingCarrier, "EK")
    assert.equal(offer.itinerary.durationMinutes, 225)
    assert.equal(offer.economics.supplierAmount, "1000.00")
    const sent = JSON.parse(calls[1].init.body)
    assert.equal(sent.CatalogProductOfferingsQueryRequest.CatalogProductOfferingsRequest.offersPerPage, 20)
    assert.deepEqual(sent.CatalogProductOfferingsQueryRequest.CatalogProductOfferingsRequest.PassengerCriteria, [{ "@type": "PassengerCriteria", number: 1, passengerTypeCode: "ADT" }])
  })

  await test("Travelport repricing uses a private cached reference and reuses OAuth token", async () => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      if (calls.length === 1) return jsonResponse({ access_token: "token", expires_in: 86400 })
      return jsonResponse(calls.length === 2 ? responseFixture() : responseFixture("1015.00"))
    }
    const ids = ["trace-search", "offer-0001", "trace-price", "repriced-internal"]
    const adapter = createTravelportFlightSupplier({ env, fetchImpl, createId: () => ids.shift() })
    const [offer] = await adapter.searchFlights({ origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 })
    const repriced = await adapter.repriceOffer(offer.providerOfferRef)
    assert.equal(calls.length, 3)
    assert.equal(calls[2].url, "https://api.pp.travelport.net/11/air/price/offers/buildfromcatalogproductofferings")
    assert.equal(repriced.providerOfferRef, offer.providerOfferRef)
    assert.equal(repriced.operationalOutcome, "repriced")
    assert.equal(repriced.economics.supplierAmount, "1015.00")
    const sent = JSON.parse(calls[2].init.body)
    assert.equal(sent.OfferQueryBuildFromCatalogProductOfferings.BuildFromCatalogProductOfferingsRequest.CatalogProductOfferingsIdentifier.Identifier.value, "transaction-test-1")
    assert.equal(sent.OfferQueryBuildFromCatalogProductOfferings.BuildFromCatalogProductOfferingsRequest.CatalogProductOfferingSelection[0].ProductIdentifier[0].Identifier.value, "product-1")
    assert.equal(JSON.stringify(sent).includes("tp_offer-0001"), false)
  })

  await test("Travelport private fields never enter the public offer", async () => {
    const fetchImpl = async (url) => url.includes("oauth") ? jsonResponse({ access_token: "token" }) : jsonResponse(responseFixture())
    const ids = ["trace-private", "offer-private"]
    const adapter = createTravelportFlightSupplier({ env, fetchImpl, createId: () => ids.shift() })
    const [privateOffer] = await adapter.searchFlights({ origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 })
    const serialized = JSON.stringify(toPublicFlightOffer(privateOffer, { sellingAmount: "1205.00", currency: "AED" }))
    for (const forbidden of ["travelport", "providerOfferRef", "economics", "transaction-test-1", "offering-1", "1000.00"]) assert.equal(serialized.includes(forbidden), false)
  })

  await test("Travelport booking status and ticketing remain explicitly disabled", async () => {
    const adapter = createTravelportFlightSupplier({ env, fetchImpl: async () => jsonResponse({}) })
    for (const capability of ["create_booking", "get_booking_status", "confirm_booking", "retrieve_ticket", "cancel", "change", "hold"]) assert.equal(adapter.capabilities[capability], false)
    await assert.rejects(() => adapter.createBooking({}), /not enabled/)
    await assert.rejects(() => adapter.getBookingStatus("unknown"), /not enabled/)
  })

  const conformanceFetch = async (url) => url.includes("oauth") ? jsonResponse({ access_token: "opaque-conformance-token" }) : jsonResponse(responseFixture())
  const conformanceIds = ["trace-conformance", "offer-conformance"]
  const conformanceAdapter = createTravelportFlightSupplier({ env, fetchImpl: conformanceFetch, createId: () => conformanceIds.shift() })
  await runFlightSupplierConformanceTests({
    test, label: "Travelport sandbox adapter", adapter: conformanceAdapter,
    searchRequest: { origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 },
    assertFlightOfferV1, toPublicFlightOffer, expectedProvider: "travelport",
  })
}
