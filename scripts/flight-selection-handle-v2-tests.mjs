import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { canonicalCustomerIdJsonV1, createFlightSelectionContextV2, customerAlternativeIdV2, customerOpaqueIdV1, toCustomerFlightSearchV1 } from "../src/server/search/customerFlightSearchV1.js"
import { validateCustomerFlightRepriceRequestV1 } from "../src/server/http/customerFlightRepriceHttpV1.js"
import { createProcessLocalFlightSelectionResolverV1 } from "../src/server/search/flightSelectionResolverV1.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`) }
const context = Object.freeze({ tripType: "one_way", origin: "DXB", destination: "KRT", departureDate: "2026-09-15", returnDate: null, adults: 1, children: 0, infants: 0, cabinClass: "economy", customerCurrency: "AED" })
const visible = Object.freeze({ fare: { cabin: "economy", baggage: "23kg" }, price: { amount: "100.00", currency: "AED", validUntil: "2026-09-15T04:00:00.000Z" } })
const groupIdentity = Object.freeze(["ifp_v1_test", "ffp_v1_test"])
const representative = Object.freeze({ internalOfferId: "hfo_private_00000001", provider: "mock", providerOfferRef: "private-ref-1" })
const id = (contextChanges = {}, representativeChanges = {}, identity = visible) => customerAlternativeIdV2({ groupIdentity, customerIdentity: identity, selectionContext: { ...context, ...contextChanges }, representative: { ...representative, ...representativeChanges } })
const BASE_ID = id()

await test("new alternative domain is hca_v2", () => assert.match(BASE_ID, /^hca_v2_[a-f0-9]{32}$/))
await test("new alternative is never hca_v1", () => assert.equal(BASE_ID.startsWith("hca_v1_"), false))
await test("same context and representative deterministic", () => assert.equal(id(), BASE_ID))
await test("canonical context insertion order stable", () => { const reversed = Object.fromEntries(Object.entries(context).reverse()); assert.equal(customerAlternativeIdV2({ groupIdentity, customerIdentity: visible, selectionContext: reversed, representative }), BASE_ID) })
await test("canonical nested identity insertion order stable", () => { const reordered = { price: { validUntil: visible.price.validUntil, currency: "AED", amount: "100.00" }, fare: { baggage: "23kg", cabin: "economy" } }; assert.equal(id({}, {}, reordered), BASE_ID) })
for (const [name, changes] of [
  ["adults", { adults: 2 }], ["children", { children: 1 }], ["infants", { infants: 1 }],
  ["trip type", { tripType: "round_trip", returnDate: "2026-09-20" }], ["origin", { origin: "AUH" }],
  ["destination", { destination: "CAI" }], ["departure date", { departureDate: "2026-09-16" }],
  ["return date", { tripType: "round_trip", returnDate: "2026-09-21" }], ["cabin class", { cabinClass: "business" }],
  ["customer currency", { customerCurrency: "USD" }],
]) await test(`${name} changes handle`, () => assert.notEqual(id(changes), BASE_ID))
for (const [name, changes] of [
  ["internalOfferId", { internalOfferId: "hfo_private_00000002" }], ["provider", { provider: "travelport" }],
  ["providerOfferRef", { providerOfferRef: "private-ref-2" }],
]) await test(`${name} changes handle`, () => assert.notEqual(id({}, changes), BASE_ID))
await test("visible fare changes handle", () => assert.notEqual(id({}, {}, { ...visible, fare: { ...visible.fare, cabin: "business" } }), BASE_ID))
await test("visible price changes handle", () => assert.notEqual(id({}, {}, { ...visible, price: { ...visible.price, amount: "101.00" } }), BASE_ID))
await test("selection context exact shape", () => assert.deepEqual(Object.keys(createFlightSelectionContextV2(context)), ["tripType", "origin", "destination", "departureDate", "returnDate", "adults", "children", "infants", "cabinClass", "customerCurrency"]))
await test("selection context rejects extra browser authority", () => assert.throws(() => createFlightSelectionContextV2({ ...context, provider: "mock" })))
await test("selection context rejects missing field", () => { const { adults: _removed, ...missing } = context; assert.throws(() => createFlightSelectionContextV2(missing)) })
await test("representative rejects extra field", () => assert.throws(() => customerAlternativeIdV2({ groupIdentity, customerIdentity: visible, selectionContext: context, representative: { ...representative, supplierNet: "1" } })))
await test("representative rejects missing identity", () => assert.throws(() => customerAlternativeIdV2({ groupIdentity, customerIdentity: visible, selectionContext: context, representative: { provider: "mock", providerOfferRef: "x" } })))
await test("hcg_v1 remains stable", () => assert.match(customerOpaqueIdV1("hcg_v1", groupIdentity), /^hcg_v1_[a-f0-9]{32}$/))
await test("hca_v1 domain can no longer be minted", () => assert.throws(() => customerOpaqueIdV1("hca_v1", visible)))
await test("canonical sorted JSON retained", () => assert.equal(canonicalCustomerIdJsonV1({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}'))
await test("Reprice accepts exact hca_v2", () => assert.equal(validateCustomerFlightRepriceRequestV1({ alternativeId: BASE_ID, customerCurrency: "AED" }).alternativeId, BASE_ID))
await test("Reprice rejects hca_v1", () => assert.throws(() => validateCustomerFlightRepriceRequestV1({ alternativeId: `hca_v1_${"a".repeat(32)}`, customerCurrency: "AED" })))
for (const malformed of ["hca_v2_short", `hca_v2_${"G".repeat(32)}`, `hca_v2_${"a".repeat(33)}`, BASE_ID + ".x", "opaque"]) await test("Reprice rejects malformed handle", () => assert.throws(() => validateCustomerFlightRepriceRequestV1({ alternativeId: malformed, customerCurrency: "AED" })))

const mock = createMockFlightSupplier()
const [offer] = await mock.searchFlights(context)
const ranked = { contractVersion: "ranked-grouped-flight-search/v1", searchStatus: "COMPLETE", rankingStatus: "RANKED", rankingPolicyVersion: "ranking-v2-test", rankedAt: "2026-09-15T02:00:00.000Z", itineraryGroups: [{ itineraryFingerprint: "ifp_v1_projection", fareGroups: [{ fareFingerprint: "ffp_v1_projection", rankingStatus: "RANKED", preferredInternalOfferId: offer.internalOfferId, cheapestInternalOfferId: offer.internalOfferId, alternatives: [{ offer, pricedOffer: {}, customerPrice: { contractVersion: "customer-price/v1", internalOfferId: offer.internalOfferId, amount: "100.00", currency: "AED", canonicalUsdAmount: "27.25", fxSnapshotId: "hfx_v2_test1", pricingPolicyVersion: "pricing-v2-test", fxPolicyVersion: "fx-v2-test", calculatedAt: "2026-09-15T01:00:00.000Z", validUntil: "2026-09-15T04:00:00.000Z" }, ranking: { rankable: true, rank: 1, isPreferred: true } }] }] }] }
const entries = []
const projected = toCustomerFlightSearchV1(ranked, { customerCurrency: "AED", now: "2026-09-15T02:00:00.000Z", selectionContext: context, collectResolutionEntry: entry => entries.push(entry) })
const publicAlternative = projected.groups[0].alternatives[0]
await test("projection emits hca_v2", () => assert.match(publicAlternative.alternativeId, /^hca_v2_[a-f0-9]{32}$/))
await test("resolution entry uses emitted handle", () => assert.equal(entries[0].alternativeId, publicAlternative.alternativeId))
await test("resolution entry retains exact representative", () => assert.deepEqual(entries[0].offer, offer))
await test("resolution passenger composition matches context", () => assert.deepEqual(entries[0].passengerComposition, { ADT: 1, CHD: 0, INF: 0 }))
await test("preferred handle is emitted handle", () => assert.equal(projected.groups[0].preferredAlternativeId, publicAlternative.alternativeId))
await test("public output excludes internalOfferId", () => assert.equal(JSON.stringify(projected).includes(offer.internalOfferId), false))
await test("public output excludes provider", () => assert.equal(JSON.stringify(projected).includes('"provider"'), false))
await test("public output excludes providerOfferRef", () => assert.equal(JSON.stringify(projected).includes("providerOfferRef"), false))
await test("public output excludes raw search context", () => assert.equal(JSON.stringify(projected).includes("departureDate"), false))
await test("process-local resolver resolves emitted handle", () => { const resolver = createProcessLocalFlightSelectionResolverV1({ clock: () => Date.parse("2026-09-15T02:00:00Z") }); resolver.rememberSearch(entries); assert.deepEqual(resolver.resolve(publicAlternative.alternativeId).offer, offer) })

const [serverSource, httpSource, frontendSource, repriceSource] = await Promise.all([
  readFile(new URL("../src/server/search/customerFlightSearchV1.js", import.meta.url), "utf8"),
  readFile(new URL("../src/server/http/customerFlightSearchHttpV1.js", import.meta.url), "utf8"),
  readFile(new URL("../src/features/flights/api/flightSearchClientV1.js", import.meta.url), "utf8"),
  readFile(new URL("../src/server/search/customerFlightRepriceV1.js", import.meta.url), "utf8"),
])
await test("generator contains no active hca_v1", () => assert.equal(serverSource.includes("hca_v1"), false))
await test("HTTP passes validated request as selection context", () => assert.match(httpSource, /selectionContext: publicRequest/))
await test("HTTP no longer appends passenger composition", () => assert.equal(/passengerComposition.*publicRequest/.test(httpSource), false))
await test("frontend treats alternative ID as opaque string", () => assert.match(frontendSource, /alternativeId: string\(alternative\.alternativeId/))
await test("frontend does not parse hca version", () => assert.equal(/hca_v[12]/.test(frontendSource), false))
await test("hpr_v1 remains unchanged", () => assert.match(repriceSource, /`hpr_v1_/))
await test("pricing policy untouched by handle generator", () => assert.equal(/marginPct|commission|supplier_net/.test(serverSource), false))

assert.ok(passed >= 35)
console.log(`\n${passed}/${passed} Flight Selection Handle Context V2 tests passed`)
