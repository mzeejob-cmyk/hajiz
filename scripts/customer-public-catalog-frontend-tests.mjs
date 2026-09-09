import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createPublicCatalogDataSource } from "../src/services/publicCatalogDataSource.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`) }
const BASE_URL = "https://pdnuswmljownjzjzpoop.supabase.co"
const ID = "22222222-2222-4222-8222-222222222222"
const row = (type = "package") => ({ id: ID, type, title: "عنوان منشور", summary: "ملخص منشور", state: "published", version: 1, dynamicBuilder: false, supplierAvailability: null })
function mockFetch(data = [row()], { ok = true, jsonError = false } = {}) { const calls = []; const fetchImpl = async (...args) => { calls.push(args); return { ok, async json() { if (jsonError) throw new Error("raw parser detail"); return structuredClone(data) } } }; return { calls, fetchImpl } }
const source = mock => createPublicCatalogDataSource({ fetchImpl: mock.fetchImpl, supabaseUrl: BASE_URL })

await test("Packages sends exact public request", async () => { const mock = mockFetch(); await source(mock).loadPackages(); assert.deepEqual(mock.calls, [[`${BASE_URL}/functions/v1/catalog-public`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"type":"package"}' }]]) })
await test("Offers sends exact public request", async () => { const mock = mockFetch([row("offer")]); await source(mock).loadOffers(); assert.equal(mock.calls[0][1].body, '{"type":"offer"}') })
await test("endpoint derives from exact Staging URL", async () => { const mock = mockFetch(); await source(mock).loadPackages(); assert.equal(mock.calls[0][0], `${BASE_URL}/functions/v1/catalog-public`) })
await test("invalid environment fails closed", () => { for (const value of [undefined, "http://pdnuswmljownjzjzpoop.supabase.co", "https://other.supabase.co", `${BASE_URL}/rest`, `${BASE_URL}?x=1`]) assert.throws(() => createPublicCatalogDataSource({ fetchImpl: () => {}, supabaseUrl: value }), /NOT_CONFIGURED/) })
await test("no Authorization header", async () => { const mock = mockFetch(); await source(mock).loadPackages(); assert.equal(Object.keys(mock.calls[0][1].headers).some(key => key.toLowerCase() === "authorization"), false) })
await test("package response accepted", async () => { assert.equal((await source(mockFetch()).loadPackages())[0].type, "package") })
await test("offer response accepted", async () => { assert.equal((await source(mockFetch([row("offer")])).loadOffers())[0].type, "offer") })
await test("package rejects offer row", async () => { await assert.rejects(source(mockFetch([row("offer")])).loadPackages(), /RESPONSE_INVALID/) })
await test("offer rejects package row", async () => { await assert.rejects(source(mockFetch()).loadOffers(), /RESPONSE_INVALID/) })
await test("non-published state rejected", async () => { const value = row(); value.state = "draft"; await assert.rejects(source(mockFetch([value])).loadPackages(), /RESPONSE_INVALID/) })
await test("dynamicBuilder must be false", async () => { const value = row(); value.dynamicBuilder = true; await assert.rejects(source(mockFetch([value])).loadPackages(), /RESPONSE_INVALID/) })
await test("supplierAvailability must be null", async () => { const value = row(); value.supplierAvailability = []; await assert.rejects(source(mockFetch([value])).loadPackages(), /RESPONSE_INVALID/) })
await test("strict exact response fields", async () => { assert.deepEqual(Object.keys((await source(mockFetch()).loadPackages())[0]), ["id", "type", "title", "summary", "state", "version", "dynamicBuilder", "supplierAvailability"]) })
await test("extra identity fields rejected", async () => { for (const key of ["created_by", "updated_by", "published_by"]) { const value = row(); value[key] = ID; await assert.rejects(source(mockFetch([value])).loadPackages(), /RESPONSE_INVALID/) } })
await test("supplier fields rejected", async () => { for (const key of ["supplier", "supplier_net", "supplierData"]) { const value = row(); value[key] = "hidden"; await assert.rejects(source(mockFetch([value])).loadPackages(), /RESPONSE_INVALID/) } })
await test("price currency inventory rejected", async () => { for (const key of ["price", "currency", "inventory"]) { const value = row(); value[key] = 1; await assert.rejects(source(mockFetch([value])).loadPackages(), /RESPONSE_INVALID/) } })
await test("malformed response rejected", async () => { for (const value of [null, {}, [null]]) await assert.rejects(source(mockFetch(value)).loadPackages(), /RESPONSE_INVALID/) })
await test("non-2xx safely rejected", async () => { await assert.rejects(source(mockFetch([], { ok: false })).loadPackages(), error => error.message === "PUBLIC_CATALOG_REQUEST_FAILED") })
await test("network failure safely rejected", async () => { const mock = { fetchImpl: async () => { throw new Error("https://secret.invalid/token") } }; await assert.rejects(source(mock).loadPackages(), error => error.message === "PUBLIC_CATALOG_REQUEST_FAILED") })
await test("raw parser response not leaked", async () => { await assert.rejects(source(mockFetch([], { jsonError: true })).loadPackages(), error => error.message === "PUBLIC_CATALOG_RESPONSE_INVALID") })
await test("empty response accepted", async () => { assert.deepEqual(await source(mockFetch([])).loadPackages(), []) })
await test("returned collection and rows frozen", async () => { const rows = await source(mockFetch()).loadPackages(); assert.equal(Object.isFrozen(rows), true); assert.equal(Object.isFrozen(rows[0]), true) })

const dataCode = await readFile(new URL("../src/services/publicCatalogDataSource.js", import.meta.url), "utf8")
const componentCode = await readFile(new URL("../src/features/catalog/components/PublicCatalogCollection.jsx", import.meta.url), "utf8")
const packagesCode = await readFile(new URL("../src/features/packages/PackagesPage.jsx", import.meta.url), "utf8")
const offersCode = await readFile(new URL("../src/features/offers/OffersPage.jsx", import.meta.url), "utf8")
const uiCode = dataCode + componentCode + packagesCode + offersCode

await test("no browser storage", () => assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(uiCode), false))
await test("no Supabase browser client", () => assert.equal(/createClient|getAccountSessionClient|@supabase\/supabase-js/.test(uiCode), false))
await test("no direct table access", () => assert.equal(/\.from\s*\(/.test(uiCode), false))
await test("no direct RPC", () => assert.equal(/\.rpc\s*\(|p2_catalog_v1/.test(uiCode), false))
await test("loading empty error retry states", () => { for (const marker of ["loading", "لا توجد باقات منشورة", "لا توجد عروض منشورة", "error", "إعادة المحاولة"]) assert.ok(componentCode.includes(marker), marker) })
await test("Packages renders public collection", () => { assert.match(packagesCode, /PublicCatalogCollection type="package"/); assert.match(componentCode, /row\.title/); assert.match(componentCode, /row\.summary/) })
await test("Offers renders public collection", () => assert.match(offersCode, /PublicCatalogCollection type="offer"/))
await test("no synthetic fallback", () => { assert.equal(/مساحة الميزة جاهزة|بيانات اصطناعية/.test(packagesCode + offersCode), false); assert.match(packagesCode, /<FeaturePage[^>]*><PublicCatalogCollection/); assert.match(offersCode, /<FeaturePage[^>]*><PublicCatalogCollection/) })
await test("no booking CTA", () => assert.equal(/Book now|Checkout|Payment|Reserve|Continue|احجز|الدفع|حجز الآن/.test(uiCode), false))
await test("favorite wiring does not alter the public catalog data source", () => assert.equal(/favorite|مفضلة|accountP2/i.test(dataCode), false))
await test("no publish or admin controls", () => { assert.equal(/publish|unpublish|admin|نشر|مسودة/i.test(componentCode), false); assert.match(packagesCode + offersCode, /data-publish-authority="false"/) })

console.log(`\n${passed}/${passed} Customer Public Catalog frontend tests passed`)
