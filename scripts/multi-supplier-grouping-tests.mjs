import assert from "node:assert/strict"
import { createFlightOfferV1 } from "../src/server/suppliers/flightOfferV1.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import {
  fareFingerprintV1, groupFlightSearchResultV1, itineraryFingerprintV1,
  toPublicGroupedFlightSearchV1,
} from "../src/server/suppliers/flightOfferGrouping.js"
import { overallStatus } from "../src/server/suppliers/multiSupplierSearchOrchestrator.js"

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const [baseOffer] = await createMockFlightSupplier().searchFlights({ origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 })
let sequence = 0
const offer = (overrides = {}) => {
  sequence += 1
  return createFlightOfferV1({
    ...baseOffer,
    internalOfferId: `hfo_group_${String(sequence).padStart(8, "0")}`,
    providerOfferRef: `group-${sequence}`,
    ...overrides,
  })
}
const withOffer = (source, changes) => createFlightOfferV1({ ...source, ...changes })
const fareOf = (source, changes) => withOffer(source, { fare: { ...source.fare, ...changes } })
const itineraryOf = (source, segmentChanges, itineraryChanges = {}) => {
  const segments = source.itinerary.segments.map((segment, index) => ({ ...segment, ...(segmentChanges[index] ?? {}) }))
  return withOffer(source, { itinerary: {
    ...source.itinerary, ...itineraryChanges, segments,
    origin: segments[0].origin, destination: segments.at(-1).destination,
    departureAt: segments[0].departureAt, arrivalAt: segments.at(-1).arrivalAt,
    stops: segments.length - 1,
  } })
}
const searchResult = (offers, status = "COMPLETE") => Object.freeze({
  contractVersion: "multi-supplier-flight-search/v1", traceId: "htr_grouping_test_0001", status,
  offers: Object.freeze(offers), supplierOutcomes: Object.freeze([]),
  startedAt: "2026-09-15T00:00:00.000Z", completedAt: "2026-09-15T00:00:01.000Z", durationMs: 1000,
})
const grouped = (offers, status) => groupFlightSearchResultV1(searchResult(offers, status))
const completeFare = (source, extra = {}) => fareOf(source, { fareBrand: "ECONOMY-SAVER", ...extra })
const priceMap = (offers) => Object.fromEntries(offers.map((item, index) => [item.internalOfferId, { sellingAmount: `${1200 + index}.00`, currency: "AED" }]))

test("A same itinerary and fare preserves two provider alternatives", () => {
  const a = completeFare(offer())
  const b = withOffer(a, { internalOfferId: "hfo_group_provider_b", provider: "travelport", providerOfferRef: "tp-same-fare" })
  const result = grouped([a, b])
  assert.equal(result.itineraryGroups.length, 1)
  assert.equal(result.itineraryGroups[0].fareGroups.length, 1)
  assert.deepEqual(result.itineraryGroups[0].fareGroups[0].alternatives.map(({ provider }) => provider), ["mock", "travelport"])
})

test("B same itinerary with different cabin creates separate fare groups", () => {
  const a = completeFare(offer())
  const b = fareOf(withOffer(a, { internalOfferId: "hfo_group_cabin_b", providerOfferRef: "cabin-b" }), { cabin: "Business" })
  assert.equal(grouped([a, b]).itineraryGroups[0].fareGroups.length, 2)
})

test("C different baggage creates separate fare groups", () => {
  const a = completeFare(offer())
  const b = fareOf(withOffer(a, { internalOfferId: "hfo_group_bag_b", providerOfferRef: "bag-b" }), { baggage: "Cabin bag only" })
  assert.equal(grouped([a, b]).itineraryGroups[0].fareGroups.length, 2)
})

test("D refundability and changeability create separate fare groups", () => {
  const a = completeFare(offer(), { refundability: "allowed", changeability: "allowed" })
  const refund = fareOf(withOffer(a, { internalOfferId: "hfo_group_refund_b", providerOfferRef: "refund-b" }), { refundability: "not_allowed" })
  const change = fareOf(withOffer(a, { internalOfferId: "hfo_group_change_b", providerOfferRef: "change-b" }), { changeability: "conditional" })
  assert.equal(grouped([a, refund, change]).itineraryGroups[0].fareGroups.length, 3)
})

test("E supplier price does not affect fare grouping", () => {
  const a = completeFare(offer())
  const b = withOffer(a, { internalOfferId: "hfo_group_price_b", provider: "travelport", providerOfferRef: "price-b", economics: { supplierAmount: "9999.99", supplierCurrency: "USD" } })
  const result = grouped([a, b])
  assert.equal(result.itineraryGroups[0].fareGroups.length, 1)
  assert.equal(result.itineraryGroups[0].fareGroups[0].alternatives.length, 2)
  assert.equal(fareFingerprintV1(a).fingerprint, fareFingerprintV1(b).fingerprint)
})

test("F provider-neutral itinerary has identical fingerprint", () => {
  const a = offer()
  const b = withOffer(a, { internalOfferId: "hfo_group_ifp_b", provider: "travelport", providerOfferRef: "ifp-b" })
  assert.equal(itineraryFingerprintV1(a), itineraryFingerprintV1(b))
})

test("G provider ref and internal ID do not affect itinerary fingerprint", () => {
  const a = offer()
  const b = withOffer(a, { internalOfferId: "hfo_group_ifp_ids", providerOfferRef: "different-ref" })
  assert.equal(itineraryFingerprintV1(a), itineraryFingerprintV1(b))
})

test("H equivalent timestamp offsets have identical fingerprint", () => {
  const a = offer()
  const b = itineraryOf(a, [{ departureAt: "2026-09-15T04:30:00Z", arrivalAt: "2026-09-15T08:50:00Z" }])
  assert.equal(itineraryFingerprintV1(a), itineraryFingerprintV1(b))
})

test("I different flight number changes itinerary fingerprint", () => {
  const a = offer()
  assert.notEqual(itineraryFingerprintV1(a), itineraryFingerprintV1(itineraryOf(a, [{ flightNumber: "736" }])))
})

test("J different airport or time changes itinerary fingerprint", () => {
  const a = offer()
  const airport = itineraryOf(a, [{ destination: "ADD" }])
  const time = itineraryOf(a, [{ departureAt: "2026-09-15T09:30:00+04:00", arrivalAt: "2026-09-15T11:50:00+02:00" }])
  assert.notEqual(itineraryFingerprintV1(a), itineraryFingerprintV1(airport))
  assert.notEqual(itineraryFingerprintV1(a), itineraryFingerprintV1(time))
})

test("K segment order changes itinerary fingerprint", () => {
  const a = offer()
  const first = { ...a.itinerary.segments[0], destination: "ADD", arrivalAt: "2026-09-15T09:30:00+02:00" }
  const second = { ...a.itinerary.segments[0], origin: "ADD", departureAt: "2026-09-15T10:30:00+02:00", marketingCarrier: "ET", flightNumber: "801" }
  const forward = withOffer(a, { itinerary: { ...a.itinerary, destination: second.destination, arrivalAt: second.arrivalAt, durationMinutes: 380, stops: 1, segments: [first, second] } })
  const reverseFirst = { ...second, origin: "DXB", destination: "ADD", departureAt: first.departureAt, arrivalAt: first.arrivalAt }
  const reverseSecond = { ...first, origin: "ADD", destination: "KRT", departureAt: second.departureAt, arrivalAt: second.arrivalAt }
  const reversed = withOffer(a, { itinerary: { ...a.itinerary, durationMinutes: 380, stops: 1, segments: [reverseFirst, reverseSecond] } })
  assert.notEqual(itineraryFingerprintV1(forward), itineraryFingerprintV1(reversed))
})

test("L codeshares with different marketed identity are not merged", () => {
  const a = completeFare(offer())
  const b = itineraryOf(withOffer(a, { internalOfferId: "hfo_group_codeshare", providerOfferRef: "codeshare" }), [{ marketingCarrier: "FZ", flightNumber: "9001" }])
  assert.equal(grouped([a, b]).itineraryGroups.length, 2)
})

test("M unknown or missing critical fare semantics never merge", () => {
  const a = offer()
  const b = withOffer(a, { internalOfferId: "hfo_group_unknown_b", provider: "travelport", providerOfferRef: "unknown-b" })
  assert.equal(grouped([a, b]).itineraryGroups[0].fareGroups.length, 2)
})

test("N exact duplicate provider offer identity keeps first", () => {
  const a = completeFare(offer())
  const duplicate = withOffer(a, { internalOfferId: "hfo_group_duplicate" })
  const alternatives = grouped([a, duplicate]).itineraryGroups[0].fareGroups[0].alternatives
  assert.equal(alternatives.length, 1)
  assert.equal(alternatives[0].internalOfferId, a.internalOfferId)
})

test("O conflicting duplicate provider offer identity fails closed", () => {
  const a = completeFare(offer())
  const conflict = withOffer(a, { internalOfferId: "hfo_group_conflict", economics: { ...a.economics, supplierAmount: "999.00" } })
  assert.throws(() => grouped([a, conflict]), /conflicting duplicate/)
})

test("P Q R group, fare, and alternative order remain first-seen", () => {
  const a = completeFare(offer(), { fareBrand: "FIRST" })
  const aAlt = withOffer(a, { internalOfferId: "hfo_group_order_alt", provider: "travelport", providerOfferRef: "order-alt" })
  const fareSecond = fareOf(withOffer(a, { internalOfferId: "hfo_group_order_fare", providerOfferRef: "order-fare" }), { fareBrand: "SECOND" })
  const itinerarySecond = itineraryOf(withOffer(a, { internalOfferId: "hfo_group_order_itin", providerOfferRef: "order-itin" }), [{ flightNumber: "999" }])
  const result = grouped([fareSecond, a, aAlt, itinerarySecond])
  assert.equal(result.itineraryGroups.length, 2)
  assert.deepEqual(result.itineraryGroups[0].fareGroups.map(({ alternatives }) => alternatives[0].fare.fareBrand), ["SECOND", "FIRST"])
  assert.deepEqual(result.itineraryGroups[0].fareGroups[1].alternatives.map(({ internalOfferId }) => internalOfferId), [a.internalOfferId, aAlt.internalOfferId])
})

test("S overallStatus rejects an impossible empty attempt set", () => {
  assert.throws(() => overallStatus([]), (error) => error?.code === "FLIGHT_SEARCH_UNAVAILABLE")
})

test("T public alternatives use canonical public mapper contract", () => {
  const offers = [completeFare(offer())]
  const result = toPublicGroupedFlightSearchV1(grouped(offers), priceMap(offers))
  assert.equal(result.contractVersion, "public-grouped-flight-search/v1")
  assert.equal(result.itineraryGroups[0].fareGroups[0].alternatives[0].contractVersion, "search-offer/v1")
})

test("U public projection fails closed without every authoritative price", () => {
  assert.throws(() => toPublicGroupedFlightSearchV1(grouped([completeFare(offer())]), {}), /price is missing/)
})

test("V W public result excludes supplier identity, economics, metadata, and outcomes", () => {
  const privateOffer = completeFare(offer({
    provider: "travelport", providerOfferRef: "SENTINEL_PROVIDER_REF_B3",
    economics: { supplierAmount: "9876.54", supplierCurrency: "BHD" },
    privateMetadata: { sentinelPrivate: "SENTINEL_PRIVATE_B3" },
  }))
  const serialized = JSON.stringify(toPublicGroupedFlightSearchV1(grouped([privateOffer]), priceMap([privateOffer])))
  for (const forbidden of ["travelport", "SENTINEL_PROVIDER_REF_B3", "9876.54", "BHD", "SENTINEL_PRIVATE_B3", "supplierOutcomes", "providerOfferRef", "supplierAmount", "supplierCurrency", "privateMetadata"]) assert.equal(serialized.includes(forbidden), false, forbidden)
})

test("X partial empty public result preserves degraded status without supplier detail", () => {
  const result = toPublicGroupedFlightSearchV1(grouped([], "PARTIAL"), {})
  assert.deepEqual(result, { contractVersion: "public-grouped-flight-search/v1", status: "PARTIAL", itineraryGroups: [] })
  assert.equal(JSON.stringify(result).includes("supplier"), false)
})

test("grouping rejects malformed direct input and freezes without mutating offers", () => {
  const original = completeFare(offer())
  const before = JSON.stringify(original)
  assert.throws(() => grouped([{ ...original, contractVersion: "flight-offer/v2" }]))
  const result = grouped([original])
  assert.equal(JSON.stringify(original), before)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.itineraryGroups[0].fareGroups[0].alternatives), true)
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
console.log(`${tests.length - failures}/${tests.length} multi-supplier grouping tests passed`)
if (failures) process.exitCode = 1
