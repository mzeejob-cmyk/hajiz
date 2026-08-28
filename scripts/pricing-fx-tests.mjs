import assert from "node:assert/strict"
import { createFlightOfferV1 } from "../src/server/suppliers/flightOfferV1.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import { groupFlightSearchResultV1, toPublicGroupedFlightSearchV1 } from "../src/server/suppliers/flightOfferGrouping.js"
import {
  createCustomerPriceV1, createFxSnapshotV1, createPricingPolicyV1, priceFlightOfferV1,
} from "../src/server/pricing/pricingFxV1.js"
import { priceGroupedFlightSearchV1, toPublicPricedGroupedFlightSearchV1 } from "../src/server/pricing/pricedGroupedSearchV1.js"

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const NOW = "2026-09-15T01:00:00.000Z"
const [mockOffer] = await createMockFlightSupplier().searchFlights({ origin: "DXB", destination: "KRT", departureDate: "2026-09-15", adults: 1 })

const offer = (changes = {}) => createFlightOfferV1({
  ...mockOffer,
  internalOfferId: changes.internalOfferId ?? "hfo_pricing_00000001",
  providerOfferRef: changes.providerOfferRef ?? "pricing-offer-1",
  fare: { ...mockOffer.fare, fareBrand: "ECONOMY-SAVER" },
  economics: changes.economics ?? { supplierAmount: "100.00", supplierCurrency: "USD" },
  validity: changes.validity ?? { expiresAt: "2026-09-15T06:20:00.000Z", repriceRequired: true },
  provider: changes.provider ?? "mock",
})
const policy = (changes = {}) => createPricingPolicyV1({
  contractVersion: "pricing-policy/v1", pricingPolicyVersion: "pricing-test-v1",
  marginPct: "10", partnerCommissionRatePct: "20", agentUpliftAmountUsd: "5",
  validFrom: "2026-09-15T00:00:00.000Z", validUntil: "2026-09-15T07:00:00.000Z",
  ...changes,
})
const fx = (baseCurrency, quoteCurrency, changes = {}) => createFxSnapshotV1({
  contractVersion: "fx-snapshot/v1", snapshotId: `hfx_${baseCurrency}_${quoteCurrency}_00000001`,
  baseCurrency, quoteCurrency, referenceRate: baseCurrency === quoteCurrency ? "1" : "1",
  source: "trusted_test_fixture", bufferPct: "0", volatilityGuardPct: "20", observedVolatilityPct: "1",
  fetchedAt: "2026-09-15T00:00:00.000Z", effectiveAt: "2026-09-15T00:05:00.000Z",
  expiresAt: "2026-09-15T08:00:00.000Z", policyVersion: "fx-test-v1", ...changes,
})
const priced = (privateOffer = offer(), changes = {}) => priceFlightOfferV1(privateOffer, {
  pricingPolicy: changes.pricingPolicy ?? policy(),
  supplierFxSnapshot: changes.supplierFxSnapshot ?? fx(privateOffer.economics.supplierCurrency, "USD", { referenceRate: privateOffer.economics.supplierCurrency === "USD" ? "1" : "0.25" }),
  now: changes.now ?? NOW,
})
const searchResult = (offers, supplierOutcomes = []) => ({
  contractVersion: "multi-supplier-flight-search/v1", traceId: "htr_pricing_test_0001", status: "COMPLETE",
  offers, supplierOutcomes, startedAt: "2026-09-15T00:59:00.000Z", completedAt: NOW, durationMs: 1000,
})

test("A-E Model B canonical USD economics are exact", () => {
  const result = priced()
  assert.equal(result.supplierNetAmount, "100")
  assert.equal(result.marketSellingAmount, "110")
  assert.equal(result.baseMargin, "10")
  assert.equal(result.finalSellingAmount, "115")
  assert.equal(result.basePartnerCommission, "2")
  assert.equal(result.partnerCommission, "7")
  assert.equal(result.hajizNetMargin, "8")
  assert.equal(result.grossMargin, "15")
})

test("F invalid zero or negative margin policy fails closed", () => {
  assert.throws(() => policy({ marginPct: "0" }), /positive/)
  assert.throws(() => policy({ marginPct: "-1" }), /positive/)
})

test("G missing pricing policy fails closed", () => {
  assert.throws(() => priceFlightOfferV1(offer(), { supplierFxSnapshot: fx("USD", "USD"), now: NOW }), /pricing policy/)
})

test("H non-USD supplier amount converts to canonical USD before pricing", () => {
  const privateOffer = offer({ economics: { supplierAmount: "200.00", supplierCurrency: "AED" } })
  const result = priced(privateOffer, { supplierFxSnapshot: fx("AED", "USD", { referenceRate: "0.25" }) })
  assert.equal(result.supplierNativeAmount, "200.00")
  assert.equal(result.supplierNativeCurrency, "AED")
  assert.equal(result.supplierNetAmount, "50")
  assert.equal(result.marketSellingAmount, "55")
})

test("I USD to AED applies explicit buffer once", () => {
  const snapshot = fx("USD", "AED", { referenceRate: "3.6", bufferPct: "2", effectiveRate: "3.672" })
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: snapshot, now: NOW })
  assert.equal(snapshot.referenceRate, "3.6")
  assert.equal(snapshot.effectiveRate, "3.672")
  assert.equal(customer.amount, "422.28")
  assert.equal(customer.currency, "AED")
})

test("J USD to SDG supports trusted finance override, buffer, and whole-unit rounding", () => {
  const snapshot = fx("USD", "SDG", { referenceRate: "600", bufferPct: "5", source: "finance_override", effectiveRate: "630" })
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: snapshot, now: NOW })
  assert.equal(snapshot.roundingPolicy, "SDG-0dp-half-up-once")
  assert.equal(customer.amount, "72450")
})

test("K USD identity conversion is explicit", () => {
  const snapshot = fx("USD", "USD")
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: snapshot, now: NOW })
  assert.equal(snapshot.effectiveRate, "1")
  assert.equal(customer.amount, "115.00")
})

test("L stale or expired FX snapshot fails closed", () => {
  const stale = fx("USD", "AED", { referenceRate: "3.67", expiresAt: "2026-09-15T00:30:00.000Z" })
  assert.throws(() => createCustomerPriceV1(priced(), { displayFxSnapshot: stale, now: NOW }), /not active/)
})

test("M zero FX rate fails closed", () => {
  assert.throws(() => fx("USD", "AED", { referenceRate: "0" }), /positive/)
})

test("N unsupported currency and wrong conversion direction fail closed", () => {
  assert.throws(() => fx("USD", "EUR"), /unsupported/)
  assert.throws(() => priced(offer(), { supplierFxSnapshot: fx("USD", "AED", { referenceRate: "3.67" }) }), /direction/)
})

test("FX volatility guard fails closed", () => {
  assert.throws(() => fx("USD", "SDG", { referenceRate: "600", volatilityGuardPct: "10", observedVolatilityPct: "11" }), /volatility/)
})

test("P Q deterministic final rounding occurs once without intermediate money rounding", () => {
  const tiny = offer({ economics: { supplierAmount: "0.05", supplierCurrency: "USD" } })
  const noUplift = policy({ agentUpliftAmountUsd: "0" })
  const exact = priced(tiny, { pricingPolicy: noUplift })
  assert.equal(exact.marketSellingAmount, "0.055")
  const customer = createCustomerPriceV1(exact, { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.5" }), now: NOW })
  assert.equal(customer.amount, "0.19")
})

test("R CustomerPrice validUntil is the earliest dependency expiry", () => {
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.67", expiresAt: "2026-09-15T05:00:00.000Z" }), now: NOW })
  assert.equal(customer.validUntil, "2026-09-15T05:00:00.000Z")
})

test("S inherited and prototype-related price properties cannot satisfy public lookup", () => {
  const privateOffer = offer({ internalOfferId: "hfo_inherited_price" })
  const grouped = groupFlightSearchResultV1(searchResult([privateOffer]))
  const inherited = Object.create({ [privateOffer.internalOfferId]: { contractVersion: "customer-price/v1" } })
  assert.throws(() => toPublicGroupedFlightSearchV1(grouped, inherited), /price is missing/)
  const prototypeName = offer({ internalOfferId: "hfo_constructor" })
  assert.throws(() => toPublicGroupedFlightSearchV1(groupFlightSearchResultV1(searchResult([prototypeName])), {}), /price is missing/)
})

test("T valid own CustomerPriceV1 property succeeds", () => {
  const privateOffer = offer()
  const customer = createCustomerPriceV1(priced(privateOffer), { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.67" }), now: NOW })
  const publicResult = toPublicGroupedFlightSearchV1(groupFlightSearchResultV1(searchResult([privateOffer])), { [privateOffer.internalOfferId]: customer })
  assert.equal(publicResult.itineraryGroups[0].fareGroups[0].alternatives[0].sellingAmount, customer.amount)
})

test("U V conflicting provider duplicate is isolated while good provider survives without public detail", () => {
  const bad = offer({ internalOfferId: "hfo_conflict_first", providerOfferRef: "conflict-ref" })
  const conflict = createFlightOfferV1({ ...bad, internalOfferId: "hfo_conflict_second", economics: { supplierAmount: "101", supplierCurrency: "USD" } })
  const good = createFlightOfferV1({ ...bad, internalOfferId: "hfo_good_provider", provider: "travelport", providerOfferRef: "good-ref" })
  const grouped = groupFlightSearchResultV1(searchResult([bad, conflict, good], [
    { provider: "mock", status: "success", durationMs: 1, offerCount: 2 },
    { provider: "travelport", status: "success", durationMs: 1, offerCount: 1 },
  ]))
  assert.equal(grouped.status, "PARTIAL")
  assert.deepEqual(grouped.itineraryGroups[0].fareGroups[0].alternatives.map(({ provider }) => provider), ["travelport"])
  assert.equal(grouped.supplierOutcomes[0].status, "invalid_response")
  const customer = createCustomerPriceV1(priced(good), { displayFxSnapshot: fx("USD", "USD"), now: NOW })
  const serialized = JSON.stringify(toPublicGroupedFlightSearchV1(grouped, { [good.internalOfferId]: customer }))
  assert.equal(serialized.includes("SUPPLIER_DUPLICATE_CONFLICT"), false)
  assert.equal(serialized.includes("mock"), false)
  assert.equal(JSON.parse(serialized).status, "PARTIAL")
})

test("B3-02 unaffected no-results provider preserves PARTIAL empty semantics", () => {
  const bad = offer({ internalOfferId: "hfo_conflict_empty_a", providerOfferRef: "conflict-empty" })
  const conflict = createFlightOfferV1({ ...bad, internalOfferId: "hfo_conflict_empty_b", economics: { supplierAmount: "102", supplierCurrency: "USD" } })
  const grouped = groupFlightSearchResultV1(searchResult([bad, conflict], [
    { provider: "mock", status: "success", durationMs: 1, offerCount: 2 },
    { provider: "travelport", status: "no_results", durationMs: 1, offerCount: 0 },
  ]))
  assert.equal(grouped.status, "PARTIAL")
  assert.deepEqual(grouped.itineraryGroups, [])
  assert.deepEqual(toPublicGroupedFlightSearchV1(grouped, {}), { contractVersion: "public-grouped-flight-search/v1", status: "PARTIAL", itineraryGroups: [] })
})

test("W grouped alternatives are independently priced without selection or sorting", () => {
  const a = offer({ internalOfferId: "hfo_price_alt_a", providerOfferRef: "alt-a", economics: { supplierAmount: "100", supplierCurrency: "USD" } })
  const b = createFlightOfferV1({ ...a, internalOfferId: "hfo_price_alt_b", provider: "travelport", providerOfferRef: "alt-b", economics: { supplierAmount: "90", supplierCurrency: "USD" } })
  const grouped = groupFlightSearchResultV1(searchResult([a, b]))
  const result = priceGroupedFlightSearchV1(grouped, {
    pricingPolicy: policy(), fxSnapshotsByPair: { USD_USD: fx("USD", "USD") }, customerCurrency: "USD", now: NOW,
  })
  const alternatives = result.itineraryGroups[0].fareGroups[0].alternatives
  assert.deepEqual(alternatives.map(({ offer: item }) => item.internalOfferId), [a.internalOfferId, b.internalOfferId])
  assert.deepEqual(alternatives.map(({ customerPrice }) => customerPrice.amount), ["115.00", "104.00"])
  const publicResult = toPublicPricedGroupedFlightSearchV1(grouped, result)
  assert.deepEqual(publicResult.itineraryGroups[0].fareGroups[0].alternatives.map(({ selectionKey }) => selectionKey), [a.internalOfferId, b.internalOfferId])
})

test("X supplier price does not affect fare grouping identity", () => {
  const a = offer({ internalOfferId: "hfo_group_price_a", providerOfferRef: "group-price-a" })
  const b = createFlightOfferV1({ ...a, internalOfferId: "hfo_group_price_b", provider: "travelport", providerOfferRef: "group-price-b", economics: { supplierAmount: "999", supplierCurrency: "SDG" } })
  assert.equal(groupFlightSearchResultV1(searchResult([a, b])).itineraryGroups[0].fareGroups.length, 1)
})

test("Y public serialization excludes supplier economics and private pricing internals", () => {
  const privateOffer = offer()
  const grouped = groupFlightSearchResultV1(searchResult([privateOffer]))
  const pricedGroup = priceGroupedFlightSearchV1(grouped, { pricingPolicy: policy(), fxSnapshotsByPair: { USD_AED: fx("USD", "AED", { referenceRate: "3.67" }), USD_USD: fx("USD", "USD") }, customerCurrency: "AED", now: NOW })
  const serialized = JSON.stringify(toPublicPricedGroupedFlightSearchV1(grouped, pricedGroup))
  for (const forbidden of ["supplierNet", "marketSelling", "partnerCommission", "hajizNetMargin", "supplierAmount", "supplierCurrency", "providerOfferRef", "pricingPolicyVersion", "fxSnapshotId"]) assert.equal(serialized.includes(forbidden), false, forbidden)
})

let failures = 0
for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok - ${name}`) }
  catch (error) { failures += 1; console.error(`not ok - ${name}`); console.error(error) }
}
console.log(`${tests.length - failures}/${tests.length} pricing and FX tests passed`)
if (failures) process.exitCode = 1
