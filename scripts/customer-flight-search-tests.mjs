import assert from "node:assert/strict"
import { rankPricedGroupedFlightSearchV1 } from "../src/server/pricing/flightRankingV1.js"
import { toCustomerFlightSearchV1 } from "../src/server/search/customerFlightSearchV1.js"
import { createFlightOfferV1 } from "../src/server/suppliers/flightOfferV1.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const NOW = "2026-09-15T02:00:00.000Z"
const [baseOffer] = await createMockFlightSupplier().searchFlights({ origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 })
let sequence = 0
const offer = (changes = {}) => {
  sequence += 1
  return createFlightOfferV1({
    ...baseOffer,
    internalOfferId: `hfo_customer_${String(sequence).padStart(8, "0")}`,
    providerOfferRef: `customer-private-ref-${sequence}`,
    ...changes,
  })
}
const price = (item, amount = "100.00", currency = "AED", changes = {}) => ({
  contractVersion: "customer-price/v1", internalOfferId: item.internalOfferId, amount, currency,
  canonicalUsdAmount: "27.25", fxSnapshotId: "hfx_customer_test_0001",
  pricingPolicyVersion: "pricing-private-v1", fxPolicyVersion: "fx-private-v1",
  calculatedAt: "2026-09-15T01:00:00.000Z", validUntil: "2026-09-15T04:00:00.000Z", ...changes,
})
const alternative = (item, amount = "100.00", currency = "AED", changes = {}) => ({
  offer: item,
  pricedOffer: changes.pricedOffer ?? { contractVersion: "priced-flight-offer/v1", internalOfferId: item.internalOfferId, margin: "LEAK_MARGIN" },
  customerPrice: Object.hasOwn(changes, "customerPrice") ? changes.customerPrice : price(item, amount, currency, changes.priceChanges),
  ranking: changes.ranking ?? { rankable: true, rank: 1, isPreferred: true },
})
const fareGroup = (alternatives, changes = {}) => ({
  fareFingerprint: changes.fareFingerprint ?? "ffp_v1_customer_test",
  rankingStatus: changes.rankingStatus ?? "RANKED",
  preferredInternalOfferId: Object.hasOwn(changes, "preferredInternalOfferId") ? changes.preferredInternalOfferId : alternatives[0]?.offer.internalOfferId ?? null,
  cheapestInternalOfferId: Object.hasOwn(changes, "cheapestInternalOfferId") ? changes.cheapestInternalOfferId : alternatives[0]?.offer.internalOfferId ?? null,
  alternatives,
})
const ranked = (fareGroups, searchStatus = "COMPLETE") => ({
  contractVersion: "ranked-grouped-flight-search/v1", searchStatus, rankingStatus: "RANKED",
  rankingPolicyVersion: "ranking-private-v1", rankedAt: NOW,
  itineraryGroups: [{ itineraryFingerprint: "ifp_v1_customer_test", fareGroups }],
})
const project = (input, options = {}) => toCustomerFlightSearchV1(input, { customerCurrency: options.customerCurrency ?? "AED", now: options.now ?? NOW })

test("A COMPLETE ranked search maps to customer-flight-search/v1", () => {
  const result = project(ranked([fareGroup([alternative(offer())])]))
  assert.equal(result.contractVersion, "customer-flight-search/v1")
  assert.equal(result.searchStatus, "COMPLETE")
  assert.equal(result.groups[0].status, "RANKED")
})

test("B PARTIAL remains customer-safe without supplier outcomes", () => {
  const result = project(ranked([fareGroup([alternative(offer())])], "PARTIAL"))
  assert.equal(result.searchStatus, "PARTIAL")
  assert.ok(!JSON.stringify(result).includes("supplierOutcomes"))
})

test("C no usable results maps to UNAVAILABLE", () => {
  const item = offer()
  const result = project(ranked([fareGroup([alternative(item, "100", "AED", { customerPrice: null })], { rankingStatus: "UNRANKED", preferredInternalOfferId: null, cheapestInternalOfferId: null })], "UNAVAILABLE"))
  assert.equal(result.searchStatus, "UNAVAILABLE")
  assert.equal(result.groups[0].status, "UNAVAILABLE")
})

test("D preferred alternative is exposed only as an opaque recommendation", () => {
  const first = offer(); const second = offer()
  const alternatives = [alternative(first, "101", "AED", { ranking: { rankable: true, rank: 2, isPreferred: false } }), alternative(second, "100")]
  const result = project(ranked([fareGroup(alternatives, { preferredInternalOfferId: second.internalOfferId, cheapestInternalOfferId: second.internalOfferId })]))
  assert.equal(result.groups[0].preferredAlternativeId, result.groups[0].alternatives[1].alternativeId)
  assert.deepEqual(result.groups[0].alternatives.map(({ recommended }) => recommended), [false, true])
})

test("E unranked group retains valid customer offers without recommendation", () => {
  const item = offer()
  const result = project(ranked([fareGroup([alternative(item, "100", "AED", { ranking: { rankable: false, rank: null, isPreferred: false } })], { rankingStatus: "UNRANKED", preferredInternalOfferId: null, cheapestInternalOfferId: null })]))
  assert.equal(result.groups[0].status, "UNRANKED")
  assert.equal(result.groups[0].alternatives.length, 1)
  assert.equal(result.groups[0].preferredAlternativeId, null)
})

test("F missing or invalid customer price is excluded fail-closed", () => {
  const missing = offer(); const invalid = offer()
  const result = project(ranked([fareGroup([
    alternative(missing, "100", "AED", { customerPrice: null, ranking: { rankable: false, rank: null, isPreferred: false } }),
    alternative(invalid, "100", "AED", { customerPrice: { amount: "100" }, ranking: { rankable: false, rank: null, isPreferred: false } }),
  ], { rankingStatus: "UNRANKED", preferredInternalOfferId: null, cheapestInternalOfferId: null })]))
  assert.equal(result.groups[0].alternatives.length, 0)
  assert.equal(result.groups[0].status, "UNAVAILABLE")
})

test("G expired price is excluded and cannot remain recommended", () => {
  const item = offer()
  const result = project(ranked([fareGroup([alternative(item, "100", "AED", { priceChanges: { validUntil: NOW } })])]))
  assert.equal(result.groups[0].alternatives.length, 0)
  assert.equal(result.groups[0].preferredAlternativeId, null)
})

test("H distinct customer prices retain multiple alternatives", () => {
  const result = project(ranked([fareGroup([alternative(offer(), "100"), alternative(offer(), "101", "AED", { ranking: { rankable: true, rank: 2, isPreferred: false } })])]))
  assert.deepEqual(result.groups[0].alternatives.map(({ price: value }) => value.amount), ["100", "101"])
})

test("identical public options are deduplicated without mutating private alternatives", () => {
  const first = offer(); const second = offer({ provider: "travelport", providerOfferRef: "tp-identical-private" })
  const input = ranked([fareGroup([alternative(first, "100"), alternative(second, "100", "AED", { ranking: { rankable: true, rank: 2, isPreferred: false } })])])
  const result = project(input)
  assert.equal(input.itineraryGroups[0].fareGroups[0].alternatives.length, 2)
  assert.equal(result.groups[0].alternatives.length, 1)
})

test("I J K customer serialization excludes supplier and ranking private data", () => {
  const leakValues = ["LEAK_PROVIDER_REF", "LEAK_SUPPLIER_AMOUNT", "LEAK_SUPPLIER_CURRENCY", "LEAK_MARGIN", "LEAK_UPLIFT", "LEAK_COMMISSION", "LEAK_RANKING_POLICY", "LEAK_QUALITY", "LEAK_DIAGNOSTICS"]
  const item = offer({
    internalOfferId: "hfo_mock_private_identity",
    providerOfferRef: leakValues[0],
    economics: { supplierAmount: "9876.54", supplierCurrency: "USD" },
    fare: { ...baseOffer.fare, privateMetadata: { margin: leakValues[3], uplift: leakValues[4], commission: leakValues[5] } },
    privateMetadata: { rankingPolicy: leakValues[6], qualitySignals: leakValues[7], diagnostics: leakValues[8], supplierAmountMarker: leakValues[1], supplierCurrencyMarker: leakValues[2] },
  })
  const serialized = JSON.stringify(project(ranked([fareGroup([alternative(item)])])))
  for (const value of leakValues) assert.ok(!serialized.includes(value), `leaked forbidden value ${value}`)
  for (const key of ["provider", "providerOfferRef", "economics", "pricedOffer", "canonicalUsdAmount", "rankingPolicyVersion", "rank", "rankable", "isPreferred"]) assert.ok(!serialized.includes(`"${key}"`), `leaked forbidden key ${key}`)
})

test("customer IDs are opaque and contain no provider or supplier reference text", () => {
  const item = offer({ internalOfferId: "hfo_travelport_mock_tbo_duffel", providerOfferRef: "supplier-ref-travelport" })
  const result = project(ranked([fareGroup([alternative(item)])]))
  const ids = [result.groups[0].groupId, result.groups[0].alternatives[0].alternativeId]
  assert.ok(ids.every((id) => /^hc[ag]_v1_[a-f0-9]{32}$/.test(id)))
  assert.ok(ids.every((id) => !/travelport|duffel|tbo|mock|supplier/i.test(id)))
})

test("L projection serialization and order are deterministic", () => {
  const input = ranked([fareGroup([alternative(offer(), "101"), alternative(offer(), "102", "AED", { ranking: { rankable: true, rank: 2, isPreferred: false } })])])
  assert.equal(JSON.stringify(project(input)), JSON.stringify(project(input)))
})

test("M N customer currency and amount come only from CustomerPriceV1", () => {
  const item = offer({ economics: { supplierAmount: "1.00", supplierCurrency: "USD" } })
  const result = project(ranked([fareGroup([alternative(item, "367.25")])]))
  assert.equal(result.currency, "AED")
  assert.deepEqual(result.groups[0].alternatives[0].price, { amount: "367.25", currency: "AED", validUntil: "2026-09-15T04:00:00.000Z" })
  assert.ok(!JSON.stringify(result).includes("1.00"))
})

test("O supplier price is never a fallback", () => {
  const item = offer({ economics: { supplierAmount: "7777.77", supplierCurrency: "USD" } })
  const result = project(ranked([fareGroup([alternative(item, "100", "AED", { customerPrice: null, ranking: { rankable: false, rank: null, isPreferred: false } })], { rankingStatus: "UNRANKED", preferredInternalOfferId: null, cheapestInternalOfferId: null })]))
  assert.equal(result.groups[0].alternatives.length, 0)
  assert.ok(!JSON.stringify(result).includes("7777.77"))
})

test("mixed-currency group projects safely while unaffected groups remain ranked", () => {
  const a = offer(); const mixedAed = offer(); const mixedSdg = offer(); const c = offer()
  const priced = {
    contractVersion: "priced-grouped-flight-search/v1", status: "COMPLETE", customerPriceByInternalOfferId: {},
    itineraryGroups: [{ itineraryFingerprint: "ifp_v1_mixed_projection", fareGroups: [
      { fareFingerprint: "ffp_v1_a", alternatives: [alternative(a, "100")] },
      { fareFingerprint: "ffp_v1_b", alternatives: [alternative(mixedAed, "200"), alternative(mixedSdg, "1", "SDG")] },
      { fareFingerprint: "ffp_v1_c", alternatives: [alternative(c, "300")] },
    ]}],
  }
  const rankingPolicy = { contractVersion: "flight-ranking-policy/v1", rankingPolicyVersion: "ranking-test-v1", mode: "price_only", validFrom: "2026-09-15T00:00:00.000Z", validUntil: "2026-09-15T05:00:00.000Z" }
  const result = project(rankPricedGroupedFlightSearchV1(priced, { rankingPolicy, now: NOW }))
  assert.deepEqual(result.groups.map(({ status }) => status), ["RANKED", "UNRANKED", "RANKED"])
  assert.deepEqual(result.groups.map(({ alternatives }) => alternatives.length), [1, 1, 1])
  assert.equal(result.searchStatus, "COMPLETE")
})

test("unexpected private shapes fail closed at the one mapper boundary", () => {
  assert.throws(() => project({ ...ranked([]), internalDiagnostics: { provider: "mock" } }), /unsupported fields/)
})

let failures = 0
for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok - ${name}`) }
  catch (error) { failures += 1; console.error(`not ok - ${name}`); console.error(error) }
}
console.log(`${tests.length - failures}/${tests.length} customer flight search tests passed`)
if (failures) process.exitCode = 1
