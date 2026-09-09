import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createPublicCatalogEdgeHandler, createPublicCatalogRead, MAX_PUBLIC_CATALOG_REQUEST_BYTES } from "../src/server/product/publicCatalogRead.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`) }
const ID = "22222222-2222-4222-8222-222222222222", now = "2026-09-08T00:00:00.000Z"
const raw = (type = "package", state = "published") => ({ id: ID, type, title: "عنوان", summary: "ملخص", state, version: 2, created_at: now, updated_at: now, published_at: state === "published" ? now : null })
function service(rows = [raw()]) { const calls = []; return { calls, api: createPublicCatalogRead({ rpc: async (name, parameters) => { calls.push([name, parameters]); if (rows instanceof Error) throw rows; return structuredClone(rows) } }) } }
const request = (body, { method = "POST", headers = {} } = {}) => new Request("https://example.invalid/catalog-public", { method, headers: { "content-type": "application/json", ...headers }, ...(method === "POST" ? { body } : {}) })
const handler = api => createPublicCatalogEdgeHandler({ service: api, corsHeaders: { "Access-Control-Allow-Origin": "*" } })

await test("package request accepted", async () => { assert.equal((await service().api.read({ type: "package" }))[0].type, "package") })
await test("offer request accepted", async () => { assert.equal((await service([raw("offer")]).api.read({ type: "offer" }))[0].type, "offer") })
await test("exact RPC call and request shape", async () => { const value = service(); await value.api.read({ type: "package" }); assert.deepEqual(value.calls, [["p2_catalog_v1", { p_actor_id: null, p_operation: "published", p_record_id: null, p_type: null, p_title: null, p_summary: null, p_expected_version: null }]]) })
await test("missing type rejected", async () => { await assert.rejects(service().api.read({}), /INVALID_REQUEST/) })
await test("unsupported type rejected", async () => { await assert.rejects(service().api.read({ type: "hotel" }), /INVALID_REQUEST/) })
await test("extra input fields rejected", async () => { for (const key of ["actorId", "userId", "admin", "operation"]) await assert.rejects(service().api.read({ type: "package", [key]: "x" }), /INVALID_REQUEST/) })
await test("malformed JSON rejected", async () => { const response = await handler(service().api)(request("{")); assert.deepEqual([response.status, await response.json()], [400, { error: "INVALID_REQUEST" }]) })
await test("oversized body rejected", async () => { const response = await handler(service().api)(request("x", { headers: { "content-length": String(MAX_PUBLIC_CATALOG_REQUEST_BYTES + 1) } })); assert.equal(response.status, 413); assert.deepEqual(await response.json(), { error: "INPUT_TOO_LARGE" }) })
await test("non POST rejected", async () => { const response = await handler(service().api)(request(undefined, { method: "GET" })); assert.equal(response.status, 405); assert.deepEqual(await response.json(), { error: "METHOD_NOT_ALLOWED" }) })
await test("OPTIONS supported", async () => { const response = await handler(service().api)(request(undefined, { method: "OPTIONS" })); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "*") })
await test("only published rows reach output", async () => { const rows = await service([raw("package", "draft"), raw("package")]).api.read({ type: "package" }); assert.equal(rows.length, 1); assert.equal(rows[0].state, "published") })
await test("draft rows are filtered", async () => { assert.deepEqual(await service([raw("package", "draft")]).api.read({ type: "package" }), []) })
await test("requested type filters output", async () => { const rows = await service([raw("offer"), raw("package")]).api.read({ type: "offer" }); assert.deepEqual(rows.map(row => row.type), ["offer"]) })
await test("exact public output projection", async () => { const value = (await service().api.read({ type: "package" }))[0]; assert.deepEqual(Object.keys(value), ["id", "type", "title", "summary", "state", "version", "dynamicBuilder", "supplierAvailability"]); assert.equal(Object.isFrozen(value), true) })
await test("identity fields never exposed", async () => { for (const key of ["created_by", "updated_by", "published_by"]) { const value = raw(); value[key] = ID; await assert.rejects(service([value]).api.read({ type: "package" }), /UNAVAILABLE/) } })
await test("supplier fields rejected", async () => { for (const key of ["supplier_net", "supplierId", "availability"]) { const value = raw(); value[key] = "x"; await assert.rejects(service([value]).api.read({ type: "package" }), /UNAVAILABLE/) } })
await test("pricing fields rejected", async () => { for (const key of ["price", "currency", "inventory"]) { const value = raw(); value[key] = 1; await assert.rejects(service([value]).api.read({ type: "package" }), /UNAVAILABLE/) } })
await test("malformed RPC result rejected", async () => { for (const value of [null, {}, [null]]) await assert.rejects(service(value).api.read({ type: "package" }), /UNAVAILABLE/) })
await test("raw RPC error redacted", async () => { await assert.rejects(service(new Error("SQL token secret")).api.read({ type: "package" }), error => error.message === "PUBLIC_CATALOG_UNAVAILABLE") })
await test("no direct private table access", async () => { const files = ["../src/server/product/publicCatalogRead.js", "../supabase/functions/catalog-public/index.ts"]; for (const file of files) assert.equal(/app_private|\.from\s*\(/.test(await readFile(new URL(file, import.meta.url), "utf8")), false) })
await test("no public RPC grant introduced", async () => { const changes = execFileSync("git", ["diff", "ee468d55bdead5f950ed720c1a58d79cf08aef7a", "--", "supabase/migrations"], { encoding: "utf8" }); assert.equal(/grant\s+execute/i.test(changes), false) })
await test("no arbitrary RPC dispatcher", async () => { const code = await readFile(new URL("../src/server/product/publicCatalogRead.js", import.meta.url), "utf8"); assert.equal(/input\.(?:rpc|operation)|request\.(?:rpc|operation)/.test(code), false); assert.equal((code.match(/"p2_catalog_v1"/g) ?? []).length, 1) })
await test("product p2 source and JWT setting unchanged", async () => { for (const file of ["src/server/product/productP2Service.js", "src/server/product/productP2Http.js", "supabase/functions/product-p2/index.ts"]) execFileSync("git", ["diff", "--quiet", "ee468d55bdead5f950ed720c1a58d79cf08aef7a", "--", file]); const config = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"); assert.match(config, /\[functions\.product-p2\]\s*verify_jwt = true/); assert.match(config, /\[functions\.catalog-public\]\s*verify_jwt = false/) })
await test("Customer Packages uses only the public catalog boundary", async () => { const code = await readFile(new URL("../src/features/packages/PackagesPage.jsx", import.meta.url), "utf8"); assert.match(code, /PublicCatalogCollection type="package"/); assert.equal(/product-p2|AdminCatalog/.test(code), false) })
await test("Customer Offers uses only the public catalog boundary", async () => { const code = await readFile(new URL("../src/features/offers/OffersPage.jsx", import.meta.url), "utf8"); assert.match(code, /PublicCatalogCollection type="offer"/); assert.equal(/product-p2|AdminCatalog/.test(code), false) })
await test("Admin Catalog behavior unchanged", () => { for (const file of ["src/features/admin/AdminPage.jsx", "src/features/admin/components/AdminCatalogPanel.jsx", "src/services/adminCatalogP2DataSource.js"]) execFileSync("git", ["diff", "--quiet", "ee468d55bdead5f950ed720c1a58d79cf08aef7a", "--", file]) })

console.log(`\n${passed}/${passed} Public Catalog read tests passed`)
