import assert from "node:assert/strict"
import { createFlightRankingPolicyV1, rankPricedGroupedFlightSearchV1 } from "../src/server/pricing/flightRankingV1.js"

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const NOW = "2026-09-15T02:00:00.000Z"
const policy = (changes = {}) => ({
  contractVersion: "flight-ranking-policy/v1", rankingPolicyVersion: "ranking-price-only-test-v1", mode: "price_only",
  validFrom: "2026-09-15T00:00:00.000Z", validUntil: "2026-09-15T05:00:00.000Z", ...changes,
})
const customerPrice = (internalOfferId, amount, currency = "AED", changes = {}) => ({
  contractVersion: "customer-price/v1", internalOfferId, amount, currency, canonicalUsdAmount: "27.25",
  fxSnapshotId: "hfx_ranking_test_0001", pricingPolicyVersion: "pricing-test-v1", fxPolicyVersion: "fx-test-v1",
  calculatedAt: "2026-09-15T01:00:00.000Z", validUntil: "2026-09-15T04:00:00.000Z", ...changes,
})
const alternative = (id, amount, currency = "AED", changes = {}) => ({
  offer: { internalOfferId: id, economics: changes.economics ?? { supplierAmount: "9999", supplierCurrency: "USD" } },
  pricedOffer: { contractVersion: "priced-flight-offer/v1", internalOfferId: id },
  customerPrice: Object.hasOwn(changes, "customerPrice") ? changes.customerPrice : customerPrice(id, amount, currency),
})
const pricedResult = (alternatives, status = "COMPLETE") => ({
  contractVersion: "priced-grouped-flight-search/v1", status,
  itineraryGroups: [{ itineraryFingerprint: "ifp_v1_test_unchanged", fareGroups: [{ fareFingerprint: "ffp_v1_test_unchanged", alternatives }] }],
  customerPriceByInternalOfferId: {},
})
const rank = (alternatives, options = {}) => rankPricedGroupedFlightSearchV1(
  pricedResult(alternatives, options.status), { rankingPolicy: options.rankingPolicy ?? policy(), now: options.now ?? NOW },
)
const fare = (result) => result.itineraryGroups[0].fareGroups[0]

test("A lower authoritative AED customer price is preferred", () => {
  const result = rank([alternative("hfo_rank_101", "101.00"), alternative("hfo_rank_100", "100.00")])
  assert.equal(fare(result).preferredInternalOfferId, "hfo_rank_100")
  assert.deepEqual(fare(result).alternatives.map(({ ranking }) => ranking.rank), [2, 1])
})

test("B D exact price tie uses deterministic first-seen order", () => {
  const result = rank([alternative("hfo_rank_first", "100.00"), alternative("hfo_rank_second", "100.00")])
  assert.equal(fare(result).preferredInternalOfferId, "hfo_rank_first")
  assert.deepEqual(fare(result).alternatives.map(({ ranking }) => ranking.rank), [1, 2])
})

test("C repeated identical input produces identical ranked output", () => {
  const alternatives = [alternative("hfo_rank_repeat_a", "100.01"), alternative("hfo_rank_repeat_b", "100.00")]
  assert.deepEqual(rank(alternatives), rank(alternatives))
})

test("E very large SDG whole-unit amounts compare exactly", () => {
  const result = rank([alternative("hfo_rank_sdg_high", "999999999999999999999999", "SDG"), alternative("hfo_rank_sdg_low", "999999999999999999999998", "SDG")])
  assert.equal(fare(result).preferredInternalOfferId, "hfo_rank_sdg_low")
})

test("F decimal edge values compare through exact fractions", () => {
  const result = rank([alternative("hfo_rank_edge_high", "1.006"), alternative("hfo_rank_edge_low", "1.005")])
  assert.equal(fare(result).preferredInternalOfferId, "hfo_rank_edge_low")
})

test("G invalid or unpriced alternative remains retained and cannot be preferred", () => {
  const invalid = alternative("hfo_rank_invalid", "100", "AED", { customerPrice: null })
  const valid = alternative("hfo_rank_valid", "101")
  const result = rank([invalid, valid])
  assert.equal(fare(result).alternatives.length, 2)
  assert.deepEqual(fare(result).alternatives[0].ranking, { rankable: false, rank: null, isPreferred: false })
  assert.equal(fare(result).preferredInternalOfferId, valid.offer.internalOfferId)
})

test("H PARTIAL search with valid alternatives still ranks", () => {
  const result = rank([alternative("hfo_rank_partial", "100")], { status: "PARTIAL" })
  assert.equal(result.searchStatus, "PARTIAL")
  assert.equal(result.rankingStatus, "RANKED")
})

test("I UNAVAILABLE search declares no preferred alternative", () => {
  const result = rank([], { status: "UNAVAILABLE" })
  assert.equal(result.rankingStatus, "UNRANKED")
  assert.equal(fare(result).preferredInternalOfferId, null)
})

test("J supplier net cannot override higher final customer price", () => {
  const cheapNetHighFinal = alternative("hfo_rank_cheap_net", "105", "AED", { economics: { supplierAmount: "1", supplierCurrency: "USD" } })
  const costlyNetLowFinal = alternative("hfo_rank_costly_net", "100", "AED", { economics: { supplierAmount: "1000", supplierCurrency: "USD" } })
  assert.equal(fare(rank([cheapNetHighFinal, costlyNetLowFinal])).preferredInternalOfferId, "hfo_rank_costly_net")
})

test("K grouping fingerprints remain unchanged after ranking", () => {
  const result = rank([alternative("hfo_rank_identity", "100")])
  assert.equal(result.itineraryGroups[0].itineraryFingerprint, "ifp_v1_test_unchanged")
  assert.equal(fare(result).fareFingerprint, "ffp_v1_test_unchanged")
})

test("L every supplier alternative remains in first-seen order", () => {
  const alternatives = [alternative("hfo_rank_all_a", "103"), alternative("hfo_rank_all_b", "101"), alternative("hfo_rank_all_c", "102")]
  const result = rank(alternatives)
  assert.deepEqual(fare(result).alternatives.map(({ offer }) => offer.internalOfferId), alternatives.map(({ offer }) => offer.internalOfferId))
})

test("mixed customer currencies isolate the fare group without comparing prices", () => {
  const alternatives = [alternative("hfo_rank_aed", "100", "AED"), alternative("hfo_rank_sdg", "1", "SDG")]
  const result = rank(alternatives)
  assert.equal(fare(result).rankingStatus, "UNRANKED")
  assert.equal(fare(result).preferredInternalOfferId, null)
  assert.equal(fare(result).cheapestInternalOfferId, null)
  assert.deepEqual(fare(result).alternatives.map(({ offer }) => offer.internalOfferId), alternatives.map(({ offer }) => offer.internalOfferId))
  assert.ok(fare(result).alternatives.every(({ ranking }) => !ranking.rankable && !ranking.isPreferred && ranking.rank === null))
})

test("valid mixed valid fare groups rank independently", () => {
  const fareGroup = (fingerprint, alternatives) => ({ fareFingerprint: fingerprint, alternatives })
  const input = {
    contractVersion: "priced-grouped-flight-search/v1", status: "COMPLETE", customerPriceByInternalOfferId: {},
    itineraryGroups: [{ itineraryFingerprint: "ifp_v1_isolation", fareGroups: [
      fareGroup("ffp_v1_valid_a", [alternative("hfo_rank_valid_a2", "102"), alternative("hfo_rank_valid_a1", "101")]),
      fareGroup("ffp_v1_mixed", [alternative("hfo_rank_mixed_aed", "2", "AED"), alternative("hfo_rank_mixed_sdg", "1", "SDG")]),
      fareGroup("ffp_v1_valid_c", [alternative("hfo_rank_valid_c2", "202"), alternative("hfo_rank_valid_c1", "201")]),
    ]}],
  }
  const result = rankPricedGroupedFlightSearchV1(input, { rankingPolicy: policy(), now: NOW })
  const [groupA, groupB, groupC] = result.itineraryGroups[0].fareGroups
  assert.equal(groupA.preferredInternalOfferId, "hfo_rank_valid_a1")
  assert.equal(groupA.rankingStatus, "RANKED")
  assert.equal(groupB.preferredInternalOfferId, null)
  assert.equal(groupB.rankingStatus, "UNRANKED")
  assert.equal(groupB.alternatives.length, 2)
  assert.equal(groupC.preferredInternalOfferId, "hfo_rank_valid_c1")
  assert.equal(groupC.rankingStatus, "RANKED")
  assert.equal(result.rankingStatus, "RANKED")
})

test("missing malformed or inactive ranking policy preserves offers as UNRANKED", () => {
  const alternatives = [alternative("hfo_rank_unranked", "100")]
  for (const rankingPolicy of [undefined, {}, policy({ mode: "quality_weighted" }), policy({ validUntil: "2026-09-15T01:00:00.000Z" }), { ...policy(), preferredSupplier: "mock" }]) {
    const result = rankPricedGroupedFlightSearchV1(pricedResult(alternatives), { rankingPolicy, now: NOW })
    assert.equal(result.rankingStatus, "UNRANKED")
    assert.equal(fare(result).preferredInternalOfferId, null)
    assert.equal(fare(result).alternatives.length, 1)
  }
})

test("price-only policy truthfully declares active and future dimensions", () => {
  const result = createFlightRankingPolicyV1(policy())
  assert.deepEqual(result.activeDimensions, ["authoritative_customer_price"])
  assert.deepEqual(result.futureDimensions, ["supplier_reliability", "ticketing_success", "operational_latency", "support_sla"])
  assert.equal(result.mode, "price_only")
})

test("cheapest and preferred are distinct fields but equal in current price-only mode", () => {
  const result = fare(rank([alternative("hfo_rank_expensive", "101"), alternative("hfo_rank_cheapest", "100")]))
  assert.equal(result.cheapestInternalOfferId, "hfo_rank_cheapest")
  assert.equal(result.preferredInternalOfferId, result.cheapestInternalOfferId)
})

let failures = 0
for (const { name, fn } of tests) {
  try { await fn(); console.log(`ok - ${name}`) }
  catch (error) { failures += 1; console.error(`not ok - ${name}`); console.error(error) }
}
console.log(`${tests.length - failures}/${tests.length} ranking and selection tests passed`)
if (failures) process.exitCode = 1
