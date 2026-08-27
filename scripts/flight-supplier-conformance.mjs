import assert from "node:assert/strict"

export async function runFlightSupplierConformanceTests({ test, label, adapter, searchRequest, assertFlightOfferV1, toPublicFlightOffer, expectedProvider }) {
  let offer
  await test(`${label} conforms to canonical FlightOfferV1`, async () => {
    ;[offer] = await adapter.searchFlights(searchRequest)
    assert.ok(offer)
    assert.equal(assertFlightOfferV1(offer).contractVersion, "flight-offer/v1")
  })
  await test(`${label} emits canonical provider identity and provider offer reference`, () => {
    assert.equal(offer.provider, expectedProvider)
    assert.ok(offer.providerOfferRef)
    assert.match(offer.internalOfferId, /^hfo_/)
  })
  await test(`${label} private offer contains no supplier credentials`, () => {
    const serialized = JSON.stringify(offer)
    for (const forbidden of ["password", "clientSecret", "access_token", "authorization", "test-secret", "test-password"]) assert.equal(serialized.includes(forbidden), false)
  })
  await test(`${label} supplier economics and metadata cannot cross the public projection`, () => {
    const publicOffer = toPublicFlightOffer(offer, { sellingAmount: "1205.00", currency: "AED" })
    const serialized = JSON.stringify(publicOffer)
    assert.equal(publicOffer.contractVersion, "search-offer/v1")
    assert.equal(publicOffer.selectionKey, offer.internalOfferId)
    for (const forbidden of [offer.provider, offer.providerOfferRef, offer.economics.supplierAmount, "privateMetadata", "supplierAmount", "supplierCurrency"]) assert.equal(serialized.includes(forbidden), false, forbidden)
  })
  await test(`${label} unsupported operation fails with the canonical capability error`, async () => {
    const unsupported = Object.entries(adapter.capabilities).find(([, enabled]) => enabled === false)?.[0]
    assert.ok(unsupported)
    const { invokeSupplierOperation } = await import("../src/server/suppliers/flightSupplierContract.js")
    await assert.rejects(() => invokeSupplierOperation(adapter, unsupported), (error) => error?.code === "SUPPLIER_CAPABILITY_UNAVAILABLE" && error?.provider === expectedProvider && error?.operation === unsupported)
  })
}
