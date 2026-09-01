import assert from "node:assert/strict"
import { mapProperty, roomIdentity, rateIdentity, dedupeHotelOffers, rankPublicOffers } from "../src/features/hotels/services/hotelCanonical.js"
import { assertSafeHotelClientReference, createReviewBoundary, HOTEL_SUPPLIER_CAPABILITIES, toSafeGuestAnalytics } from "../src/features/hotels/contracts/hotelV2.js"
import { createSyntheticHotelAdapter } from "../src/features/hotels/services/syntheticHotelAdapter.js"
import { HOTEL_FIXTURES, PALM_ROOMS, PROPERTY_MAPPINGS, resolveHotelDetail, isHotelDetailExpired } from "../src/features/hotels/data/hotelCanonicalFixtures.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; process.stdout.write(`✓ ${name}\n`) }

await test("property mapping uses provider identity and deterministic fixture map", () => assert.deepEqual(mapProperty({ provider: "fixture-a", supplierHotelId: "internal-101" }, PROPERTY_MAPPINGS), { state: "mapped", canonicalHotelId: "hjz_htl_palm_dubai" }))
await test("same property name alone cannot map", () => assert.deepEqual(mapProperty({ provider: "fixture-x", supplierHotelId: "x", name: "فندق النخلة دبي" }, PROPERTY_MAPPINGS), { state: "unmapped", canonicalHotelId: null }))
await test("duplicate mappings fail closed as ambiguous", () => assert.equal(mapProperty({ provider: "x", supplierHotelId: "1" }, [{ provider: "x", supplierHotelId: "1", canonicalHotelId: "a" }, { provider: "x", supplierHotelId: "1", canonicalHotelId: "b" }]).state, "ambiguous"))
await test("room identity covers category bed occupancy size and view", () => assert.notEqual(roomIdentity(PALM_ROOMS[0]), roomIdentity({ ...PALM_ROOMS[0], view: "sea" })))
await test("rate identity covers board cancellation refundability occupancy dates and taxes", () => { const a = { ...PALM_ROOMS[0], checkIn: "2026-09-15", checkOut: "2026-09-18" }; assert.notEqual(rateIdentity(a), rateIdentity({ ...a, board: "room_only" })) })
await test("mapped property and identical rates dedupe deterministically", () => { const a = HOTEL_FIXTURES[0]; const out = dedupeHotelOffers([a, { ...a, opaqueOfferId: "hjz_offer_palm_b" }]); assert.equal(out.length, 1); assert.equal(out[0].rates.length, 3) })
await test("ambiguous offers remain isolated", () => { const a = { ...HOTEL_FIXTURES[0], mappingState: "ambiguous" }; assert.equal(dedupeHotelOffers([a, { ...a, opaqueOfferId: "other" }]).length, 2) })
await test("public ranking uses display totals and ignores raw supplier net", () => assert.equal(rankPublicOffers([{ displayTotal: { amount: 2 }, net: 1 }, { displayTotal: { amount: 1 }, net: 99 }])[0].displayTotal.amount, 1))
await test("browser authority accepts canonical opaque ids", () => assert.deepEqual(assertSafeHotelClientReference({ canonicalHotelId: "hjz_htl_palm_dubai", canonicalRateId: PALM_ROOMS[0].canonicalRateId }), { canonicalHotelId: "hjz_htl_palm_dubai", canonicalRateId: PALM_ROOMS[0].canonicalRateId }))
await test("browser authority rejects provider refs and price", () => { for (const key of ["provider", "supplierHotelId", "supplierRoomId", "supplierRateId", "price", "net"]) assert.throws(() => assertSafeHotelClientReference({ canonicalHotelId: "hjz_htl_palm_dubai", [key]: "tampered" })) })
await test("Hotel Detail is canonical and fixture backed", () => { const detail = resolveHotelDetail("hjz_htl_palm_dubai"); assert.equal(detail.synthetic, true); assert.equal(detail.rooms.length, 3) })
await test("Hotel Detail expiry fails closed", () => assert.equal(isHotelDetailExpired(resolveHotelDetail("hjz_htl_palm_dubai"), new Date("2026-09-16T00:00:00Z")), true))
await test("guest analytics contains no PII", () => assert.deepEqual(toSafeGuestAnalytics({ email: "ignored@example.com" }), { event: "hotel_guest_details_completed", containsPii: false }))
await test("review boundary exposes final display contract only", () => { const hotel = HOTEL_FIXTURES[0], rate = PALM_ROOMS[0]; const out = createReviewBoundary({ hotel, room: rate, rate, stay: hotel.stay }); assert.equal(out.continueToPayment, "NOT_YET_WIRED"); assert.equal(JSON.stringify(out).includes("supplier"), false) })
await test("synthetic adapter declares all future capabilities", () => assert.deepEqual(createSyntheticHotelAdapter({ env: { NODE_ENV: "test" } }).capabilities, HOTEL_SUPPLIER_CAPABILITIES))
await test("synthetic adapter is non-network and production forbidden", () => { const adapter = createSyntheticHotelAdapter({ env: { NODE_ENV: "test" } }); assert.deepEqual([adapter.synthetic, adapter.network, adapter.productionAllowed], [true, false, false]); assert.throws(() => createSyntheticHotelAdapter({ env: { NODE_ENV: "production" } })) })
await test("no H1 fake hold is claimed", () => { for (const room of PALM_ROOMS) assert.deepEqual([room.holdAvailable, room.holdType, room.holdUntil, room.priceGuaranteedUntil, room.supplierHoldCost], [false, "none", null, null, null]) })

process.stdout.write(`\n${passed} Hotel V2 tests passed\n`)
