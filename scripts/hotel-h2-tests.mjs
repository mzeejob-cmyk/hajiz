import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHotelMappingStore, loadHotelMappingStore } from "../src/server/hotels/hotelMappingStore.js"
import { createHotelReadBoundary, HOTEL_H2_CAPABILITIES } from "../src/server/hotels/hotelReadBoundary.js"
import { createHotelHttpBoundary } from "../src/server/hotels/hotelHttpBoundary.js"

let passed = 0
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`) }
const user = { userId: "synthetic_a" }
const stay = { destination: "DXB", checkIn: "2030-01-02", checkOut: "2030-01-05", adults: 2, children: 0 }
const baseTime = Date.parse("2030-01-01T00:00:00Z")
const property = { provider: "fixture_h2", propertyId: "p1", name: "Synthetic property", supplier_net: 1, privateMetadata: "not-public" }
const rawRate = { provider: "fixture_h2", propertyId: "p1", roomId: "r1", rateId: "price1", ...stay, currency: "AED", marketAmountMinor: 50000, available: true, expiresAt: "2030-01-01T00:02:00Z", board: "breakfast", refundable: true, cancellationCode: "flex", taxesIncluded: true, feesMinor: null, supplier_net: 35000 }
const mapping = { provider: "fixture_h2", supplierPropertyId: "p1", canonicalHotelId: "hjz_htl_one", status: "mapped", confidence: 1, provenance: "OFFLINE_SYNTHETIC_FIXTURE", createdAt: "2026-09-05T00:00:00Z", updatedAt: "2026-09-05T00:00:00Z" }
const snapshot = { version: 1, records: [mapping, { ...mapping, supplierRoomId: "r1", canonicalRoomId: "hjz_room_one" }] }
function setup({ records = snapshot, properties = [property], rates = [rawRate], repriced = rawRate, adapterFields = {}, config = {} } = {}) {
  const calls = []
  const adapter = { provider: "fixture_h2", mode: "synthetic", network: false, productionAllowed: false, capabilities: HOTEL_H2_CAPABILITIES,
    async search(args) { calls.push(["search", args]); return properties },
    async detail(args) { calls.push(["detail", args]); return properties[0] },
    async rates(args) { calls.push(["rates", args]); return rates },
    async reprice(args) { calls.push(["reprice", args]); return repriced }, ...adapterFields }
  const service = createHotelReadBoundary({ adapter, mappings: createHotelMappingStore(records), now: () => baseTime, ...config })
  return { service, calls }
}
async function select(s) {
  const [p] = await s.search(user, stay)
  const ref = { selectionId: p.selectionId, canonicalHotelId: p.canonicalHotelId }
  const [r] = await s.rates(user, ref)
  return { ...ref, canonicalRoomId: r.canonicalRoomId, canonicalRateId: r.canonicalRateId }
}
await test("mapping durable snapshot reload preserves IDs", () => {
  const dir = mkdtempSync(join(tmpdir(), "hajiz-h2-test-"))
  try { const path = join(dir, "mapping.json"); writeFileSync(path, JSON.stringify(snapshot)); const a = loadHotelMappingStore(path), b = loadHotelMappingStore(path); assert.equal(a.revision, b.revision); assert.equal(a.resolve("fixture_h2", "p1").canonicalHotelId, "hjz_htl_one") }
  finally { rmSync(dir, { recursive: true }) }
})
await test("same exact mapping duplicate idempotent", () => assert.equal(createHotelMappingStore({ ...snapshot, records: [...snapshot.records, mapping] }).resolve("fixture_h2", "p1").canonicalHotelId, "hjz_htl_one"))
await test("conflicting property maps fail closed", () => assert.throws(() => createHotelMappingStore({ ...snapshot, records: [...snapshot.records, { ...mapping, canonicalHotelId: "hjz_htl_two" }] }).resolve("fixture_h2", "p1"), /AMBIGUOUS/))
await test("conflicting room maps fail closed", () => assert.throws(() => createHotelMappingStore({ ...snapshot, records: [...snapshot.records, { ...snapshot.records[1], canonicalRoomId: "hjz_room_two" }] }).resolve("fixture_h2", "p1", "r1"), /AMBIGUOUS/))
await test("review mapping fails closed", () => assert.throws(() => createHotelMappingStore({ ...snapshot, records: [{ ...mapping, status: "review" }] }).resolve("fixture_h2", "p1"), /REVIEW/))
await test("provider cannot use another provider mapping", () => assert.throws(() => createHotelMappingStore(snapshot).resolve("other", "p1"), /MISSING/))
await test("missing supplier ID rejected", () => assert.throws(() => createHotelMappingStore({ version: 1, records: [{ ...mapping, supplierPropertyId: null }] })))
await test("mapping caller mutation cannot change authority", () => { const data = structuredClone(snapshot), store = createHotelMappingStore(data); data.records[0].canonicalHotelId = "hjz_htl_tampered"; const result = store.resolve("fixture_h2", "p1"); result.canonicalHotelId = "changed"; assert.equal(store.resolve("fixture_h2", "p1").canonicalHotelId, "hjz_htl_one") })
await test("renamed supplier property retains identity", async () => { const a = await setup().service.search(user, stay); const b = await setup({ properties: [{ ...property, name: "Renamed" }] }).service.search(user, stay); assert.equal(a[0].canonicalHotelId, b[0].canonicalHotelId) })
await test("duplicate supplier results dedupe", async () => assert.equal((await setup({ properties: [property, property] }).service.search(user, stay)).length, 1))
await test("name alone cannot map unknown property", async () => assert.rejects(setup({ properties: [{ ...property, propertyId: "unknown" }] }).service.search(user, stay)))
await test("malformed search response fails closed", async () => assert.rejects(setup({ properties: {} }).service.search(user, stay)))
await test("wrong provider payload rejected", async () => assert.rejects(setup({ properties: [{ ...property, provider: "other" }] }).service.search(user, stay)))
await test("detail unknown fields remain null", async () => { const s = setup().service; const [p] = await s.search(user, stay); const d = await s.detail(user, { selectionId: p.selectionId, canonicalHotelId: p.canonicalHotelId }); assert.equal(d.description, null); assert.equal(d.address, null); assert.equal(d.synthetic, true) })
await test("two distinct prices for same room remain separate rates", async () => { const s = setup({ rates: [rawRate, { ...rawRate, rateId: "price2" }] }).service; const [p] = await s.search(user, stay); const r = await s.rates(user, { selectionId: p.selectionId, canonicalHotelId: p.canonicalHotelId }); assert.equal(r.length, 2); assert.equal(r[0].canonicalRoomId, r[1].canonicalRoomId); assert.notEqual(r[0].canonicalRateId, r[1].canonicalRateId) })
await test("board and currency distinguish rate identities", async () => { const s = setup({ rates: [rawRate, { ...rawRate, board: "room_only" }, { ...rawRate, currency: "USD" }] }).service; const [p] = await s.search(user, stay); assert.equal((await s.rates(user, { selectionId: p.selectionId, canonicalHotelId: p.canonicalHotelId })).length, 3) })
await test("duplicate equal rates dedupe", async () => { const s = setup({ rates: [rawRate, rawRate] }).service; const [p] = await s.search(user, stay); assert.equal((await s.rates(user, { selectionId: p.selectionId, canonicalHotelId: p.canonicalHotelId })).length, 1) })
await test("duplicate inconsistent price rejected", async () => assert.rejects(select(setup({ rates: [rawRate, { ...rawRate, marketAmountMinor: 60000 }] }).service), /CONFLICT/))
await test("occupancy mismatch rejected", async () => assert.rejects(select(setup({ rates: [{ ...rawRate, adults: 3 }] }).service), /STAY_MISMATCH/))
await test("room mapping missing rejected", async () => assert.rejects(select(setup({ rates: [{ ...rawRate, roomId: "unknown" }] }).service), /MAPPING_MISSING/))
await test("reprice unchanged authoritative", async () => { const s = setup().service; const r = await s.reprice(user, await select(s)); assert.equal(r.priceChanged, false); assert.equal(r.finalAmountMinor, 50000) })
await test("reprice changed price explicitly surfaced", async () => { const s = setup({ repriced: { ...rawRate, marketAmountMinor: 51000 } }).service; const r = await s.reprice(user, await select(s)); assert.equal(r.priceChanged, true); assert.equal(r.previousAmountMinor, 50000); assert.equal(r.finalAmountMinor, 51000) })
await test("browser price and supplier fields never authoritative", async () => { const { service: s, calls } = setup(); const ref = await select(s); for (const key of ["amount", "supplier_net", "supplierRateId", "provider", "commission", "userId"]) await assert.rejects(s.reprice(user, { ...ref, [key]: "tamper" }), /CLIENT_AUTHORITY/); assert.equal(calls.filter(c => c[0] === "reprice").length, 0) })
await test("reprice resolves supplier IDs only on server", async () => { const { service: s, calls } = setup(); await s.reprice(user, await select(s)); assert.equal(calls.at(-1)[1].rateId, "price1"); assert.equal(calls.at(-1)[1].propertyId, "p1") })
for (const [name, change, error] of [["currency", { currency: "USD" }, /CURRENCY_MISMATCH/], ["supplier", { provider: "wrong" }, /SUPPLIER_MISMATCH/], ["stale", { expiresAt: "2029-01-01T00:00:00Z" }, /STALE/], ["unavailable", { available: false }, /UNAVAILABLE/], ["identity", { rateId: "different" }, /IDENTITY/], ["malformed price", { marketAmountMinor: -1 }, /PRICE_INVALID/]]) {
  await test(`reprice ${name} fails closed`, async () => { const s = setup({ repriced: { ...rawRate, ...change } }).service; await assert.rejects(s.reprice(user, await select(s)), error) })
}
await test("cross-user selections inaccessible", async () => { const s = setup().service; await assert.rejects(s.reprice({ userId: "synthetic_b" }, await select(s)), /SELECTION_NOT_FOUND/) })
await test("expired selection rejected", async () => { let time = baseTime; const s = setup({ config: { now: () => time } }).service; const ref = await select(s); time += 300001; await assert.rejects(s.reprice(user, ref), /SELECTION_STALE/) })
await test("no private supplier economics in responses", async () => { const s = setup().service; const ref = await select(s); const body = JSON.stringify(await s.reprice(user, ref)); for (const value of ["supplier_net", "35000", "price1", "fixture_h2", "privateMetadata"]) assert.equal(body.includes(value), false) })
await test("production environment forbidden", () => assert.throws(() => setup({ config: { environment: "production" } }), /PRODUCTION/))
await test("unapproved sandbox and live network forbidden", () => { for (const mode of ["sandbox", "production", "live"]) assert.throws(() => setup({ adapterFields: { mode, network: true, endpoint: "https://production.invalid" } }), /NOT_AUTHORIZED/) })
await test("hold booking payment voucher cancellation disabled", async () => { const s = setup().service; for (const op of ["hold_room", "create_booking", "payment", "retrieve_voucher", "cancel_booking"]) { assert.equal(s.capabilities[op], false); assert.equal(s[op], undefined) }; const r = await s.reprice(user, await select(s)); assert.equal(r.holdAllowed, false); assert.equal(r.bookingAllowed, false); assert.equal(r.continueToPayment, "NOT_YET_WIRED") })
await test("HTTP requires authenticated server session", async () => { const handler = createHotelHttpBoundary({ service: setup().service, authenticate: async () => null }); assert.equal((await handler({ method: "POST", operation: "search", body: { ...stay, userId: "forged" } })).status, 401) })
await test("HTTP no mutation operation or GET", async () => { const h = createHotelHttpBoundary({ service: setup().service, authenticate: async () => user }); assert.equal((await h({ method: "GET", operation: "search" })).status, 405); assert.equal((await h({ method: "POST", operation: "hold_room" })).status, 404) })
await test("HTTP exception details never leak", async () => { const h = createHotelHttpBoundary({ service: {}, authenticate: async () => { throw new Error("private auth details") } }); assert.deepEqual((await h({ method: "POST", operation: "search" })).body, { error: "HOTEL_REQUEST_REJECTED" }) })
await test("invalid calendar date and PII request rejected", async () => { const s = setup().service; await assert.rejects(s.search(user, { ...stay, checkIn: "2030-02-31" })); await assert.rejects(s.search(user, { ...stay, email: "synthetic@example.invalid" })) })
await test("reprice expiring while provider responds rejected", async () => { let time = baseTime; const s = setup({ config: { now: () => time }, adapterFields: { async reprice() { time += 121000; return { ...rawRate, expiresAt: "2030-01-01T00:04:00Z" } } } }).service; await assert.rejects(s.reprice(user, await select(s)), /RATE_STALE/) })
await test("rates expiring session during response rejected", async () => { let time = baseTime; const s = setup({ config: { now: () => time }, adapterFields: { async rates() { time += 300001; return [rawRate] } } }).service; await assert.rejects(select(s), /SELECTION_STALE/) })
await test("stale stay rejected before supplier call", async () => { const { service: s, calls } = setup(); await assert.rejects(s.search(user, { ...stay, checkIn: "2029-01-02", checkOut: "2029-01-05" }), /DATES_STALE/); assert.equal(calls.length, 0) })
await test("HTTP authenticated search reaches canonical boundary", async () => { const h = createHotelHttpBoundary({ service: setup().service, authenticate: async () => user }); const r = await h({ method: "POST", operation: "search", body: stay }); assert.equal(r.status, 200); assert.equal(r.body[0].canonicalHotelId, "hjz_htl_one"); assert.equal(r.headers["Cache-Control"], "no-store") })
await test("untrusted body owner cannot replace authenticated user", async () => { const s = setup().service, ref = await select(s); const h = createHotelHttpBoundary({ service: s, authenticate: async () => ({ userId: "synthetic_b" }) }); assert.equal((await h({ method: "POST", operation: "reprice", body: ref })).status, 422) })
console.log(`\n${passed}/${passed} Hotels H2 tests passed`)
