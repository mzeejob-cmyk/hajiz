import assert from "node:assert/strict"
import { createFlightOfferV1 } from "../src/server/suppliers/flightOfferV1.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import { groupFlightSearchResultV1, toPublicGroupedFlightSearchV1 } from "../src/server/suppliers/flightOfferGrouping.js"
import {
  assertPricedFlightOfferV1, createCustomerPriceV1, createFxSnapshotV1, createPricingPolicyV1, priceFlightOfferV1,
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
  marginPct: "10", maxMarginPct: "25", partnerCommissionRatePct: "20",
  agentUpliftAmountUsd: "5", maxAgentUpliftAmountUsd: "20",
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

test("F-03 margin below or exactly at trusted maximum is accepted", () => {
  assert.equal(policy({ marginPct: "24.99", maxMarginPct: "25" }).marginPct, "24.99")
  assert.equal(policy({ marginPct: "25", maxMarginPct: "25" }).marginPct, "25")
})

test("F-03 margin above trusted maximum is rejected", () => {
  assert.throws(() => policy({ marginPct: "25.01", maxMarginPct: "25" }), /exceeds trusted policy maximum/)
})

test("F-03 uplift below or exactly at trusted maximum is accepted", () => {
  assert.equal(policy({ agentUpliftAmountUsd: "19.99", maxAgentUpliftAmountUsd: "20" }).agentUpliftAmountUsd, "19.99")
  assert.equal(policy({ agentUpliftAmountUsd: "20", maxAgentUpliftAmountUsd: "20" }).agentUpliftAmountUsd, "20")
})

test("F-03 uplift above trusted maximum is rejected", () => {
  assert.throws(() => policy({ agentUpliftAmountUsd: "20.01", maxAgentUpliftAmountUsd: "20" }), /exceeds trusted policy maximum/)
})

test("F-03 missing, negative, or malformed maxima fail closed", () => {
  assert.throws(() => policy({ maxMarginPct: undefined }), /maxMarginPct/)
  assert.throws(() => policy({ maxAgentUpliftAmountUsd: undefined }), /maxAgentUpliftAmountUsd/)
  assert.throws(() => policy({ maxMarginPct: "-1" }), /positive/)
  assert.throws(() => policy({ maxAgentUpliftAmountUsd: "-1" }), /cannot be negative/)
  assert.throws(() => policy({ maxMarginPct: "not-a-decimal" }), /decimal/)
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
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: snapshot, customerCurrency: "AED", now: NOW })
  assert.equal(snapshot.referenceRate, "3.6")
  assert.equal(snapshot.effectiveRate, "3.672")
  assert.equal(customer.amount, "422.28")
  assert.equal(customer.currency, "AED")
})

test("J trusted SDG snapshot may carry finance-override provenance", () => {
  const snapshot = fx("USD", "SDG", { referenceRate: "600", bufferPct: "5", source: "finance_override", effectiveRate: "630" })
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: snapshot, customerCurrency: "SDG", now: NOW })
  assert.equal(snapshot.roundingPolicy, "SDG-0dp-half-up-once")
  assert.equal(customer.amount, "72450")
})

test("K USD identity conversion is explicit", () => {
  const snapshot = fx("USD", "USD")
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: snapshot, customerCurrency: "USD", now: NOW })
  assert.equal(snapshot.effectiveRate, "1")
  assert.equal(customer.amount, "115.00")
})

test("L stale or expired FX snapshot fails closed", () => {
  const stale = fx("USD", "AED", { referenceRate: "3.67", expiresAt: "2026-09-15T00:30:00.000Z" })
  assert.throws(() => createCustomerPriceV1(priced(), { displayFxSnapshot: stale, customerCurrency: "AED", now: NOW }), /not active/)
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
  const customer = createCustomerPriceV1(exact, { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.5" }), customerCurrency: "AED", now: NOW })
  assert.equal(customer.amount, "0.19")
})

test("R CustomerPrice validUntil is the earliest dependency expiry", () => {
  const customer = createCustomerPriceV1(priced(), { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.67", expiresAt: "2026-09-15T05:00:00.000Z" }), customerCurrency: "AED", now: NOW })
  assert.equal(customer.validUntil, "2026-09-15T05:00:00.000Z")
})

test("F-01 real and canonical exact-priced offers pass the trust boundary", () => {
  const real = priced()
  assert.equal(assertPricedFlightOfferV1(real), real)
  const repeating = { ...real, finalSellingAmount: "0.33333333", finalSellingAmountExact: { numerator: "1", denominator: "3" } }
  assert.equal(assertPricedFlightOfferV1(repeating), repeating)
})

test("F-01 forged exact/display mismatch fails closed", () => {
  const forged = { ...priced(), finalSellingAmount: "112", finalSellingAmountExact: { numerator: "1", denominator: "1" } }
  assert.throws(() => assertPricedFlightOfferV1(forged), /does not match/)
})

test("F-01 non-canonical trailing display format fails closed", () => {
  const forged = { ...priced(), finalSellingAmount: "115.0" }
  assert.throws(() => assertPricedFlightOfferV1(forged), /does not match/)
})

test("F-01 forged priced offer cannot produce CustomerPriceV1", () => {
  const forged = { ...priced(), finalSellingAmount: "112", finalSellingAmountExact: { numerator: "1", denominator: "1" } }
  assert.throws(() => createCustomerPriceV1(forged, { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.67" }), customerCurrency: "AED", now: NOW }), /does not match/)
})

test("F-02 requested AED and SDG reject opposite display snapshots", () => {
  assert.throws(() => createCustomerPriceV1(priced(), { displayFxSnapshot: fx("USD", "SDG", { referenceRate: "600" }), customerCurrency: "AED", now: NOW }), /requested customer currency/)
  assert.throws(() => createCustomerPriceV1(priced(), { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.67" }), customerCurrency: "SDG", now: NOW }), /requested customer currency/)
})

test("F-02 requested USD rejects non-identity quote", () => {
  assert.throws(() => createCustomerPriceV1(priced(), { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.67" }), customerCurrency: "USD", now: NOW }), /requested customer currency/)
})

test("F-02 wrong snapshot under correct lookup key fails by snapshot content", () => {
  const privateOffer = offer()
  const grouped = groupFlightSearchResultV1(searchResult([privateOffer]))
  assert.throws(() => priceGroupedFlightSearchV1(grouped, {
    pricingPolicy: policy(),
    fxSnapshotsByPair: { USD_USD: fx("USD", "USD"), USD_AED: fx("USD", "SDG", { referenceRate: "600" }) },
    customerCurrency: "AED", now: NOW,
  }), /requested customer currency/)
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
  const customer = createCustomerPriceV1(priced(privateOffer), { displayFxSnapshot: fx("USD", "AED", { referenceRate: "3.67" }), customerCurrency: "AED", now: NOW })
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
  const customer = createCustomerPriceV1(priced(good), { displayFxSnapshot: fx("USD", "USD"), customerCurrency: "USD", now: NOW })
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

test("P1 expired offer is isolated while a valid alternative remains priced", () => {
  const expired = offer({ internalOfferId: "hfo_pricing_expired_01", providerOfferRef: "expired-1", validity: { expiresAt: NOW, repriceRequired: true } })
  const valid = offer({ internalOfferId: "hfo_pricing_valid_0001", providerOfferRef: "valid-1" })
  const result = priceGroupedFlightSearchV1(groupFlightSearchResultV1(searchResult([expired, valid])), {
    pricingPolicy: policy(), fxSnapshotsByPair: { USD_USD: fx("USD", "USD") }, customerCurrency: "USD", now: NOW,
  })
  assert.deepEqual(result.itineraryGroups[0].fareGroups[0].alternatives.map(({ offer: item }) => item.internalOfferId), [valid.internalOfferId])
  assert.equal(Object.hasOwn(result.customerPriceByInternalOfferId, expired.internalOfferId), false)
})

test("P3 expired itinerary group does not destroy a separate valid itinerary group", () => {
  const expired = offer({ internalOfferId: "hfo_pricing_expired_02", providerOfferRef: "expired-2", validity: { expiresAt: NOW, repriceRequired: true } })
  const valid = createFlightOfferV1({
    ...offer({ internalOfferId: "hfo_pricing_valid_0002", providerOfferRef: "valid-2" }),
    itinerary: { ...mockOffer.itinerary, destination: "CAI", arrivalAt: "2026-09-15T11:50:00+02:00", segments: [{ ...mockOffer.itinerary.segments[0], destination: "CAI", arrivalAt: "2026-09-15T11:50:00+02:00" }] },
  })
  const result = priceGroupedFlightSearchV1(groupFlightSearchResultV1(searchResult([expired, valid])), {
    pricingPolicy: policy(), fxSnapshotsByPair: { USD_USD: fx("USD", "USD") }, customerCurrency: "USD", now: NOW,
  })
  assert.equal(result.itineraryGroups.length, 1)
  assert.equal(result.itineraryGroups[0].fareGroups[0].alternatives[0].offer.internalOfferId, valid.internalOfferId)
})

test("P4 trusted pricing and FX failures remain hard failures", () => {
  const groupedResult = groupFlightSearchResultV1(searchResult([offer()]))
  assert.throws(() => priceGroupedFlightSearchV1(groupedResult, { pricingPolicy: { ...policy(), marginPct: "999" }, fxSnapshotsByPair: { USD_USD: fx("USD", "USD") }, customerCurrency: "USD", now: NOW }))
  assert.throws(() => priceGroupedFlightSearchV1(groupedResult, { pricingPolicy: policy(), fxSnapshotsByPair: {}, customerCurrency: "USD", now: NOW }))
})

test("E5 all naturally expired offers preserve COMPLETE with no priced groups", () => {
  const expired = offer({ internalOfferId: "hfo_pricing_expired_all", providerOfferRef: "expired-all", validity: { expiresAt: NOW, repriceRequired: true } })
  const result = priceGroupedFlightSearchV1(groupFlightSearchResultV1(searchResult([expired])), {
    pricingPolicy: policy(), fxSnapshotsByPair: { USD_USD: fx("USD", "USD") }, customerCurrency: "USD", now: NOW,
  })
  assert.equal(result.status, "COMPLETE")
  assert.deepEqual(result.itineraryGroups, [])
})

let failures = 0
for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok - ${name}`) }
  catch (error) { failures += 1; console.error(`not ok - ${name}`); console.error(error) }
}
console.log(`${tests.length - failures}/${tests.length} pricing and FX tests passed`)
if (failures) process.exitCode = 1
