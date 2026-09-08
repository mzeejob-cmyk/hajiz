import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createAdminCatalogP2DataSource } from "../src/services/adminCatalogP2DataSource.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`) }
const USER = "11111111-1111-4111-8111-111111111111", ID = "22222222-2222-4222-8222-222222222222"
const row = (type = "package", state = "draft") => ({ id: ID, type, title: "عنوان", summary: "ملخص", state, version: 1, dynamicBuilder: false, supplierAvailability: null })
function client(handler = command => ["drafts", "published"].includes(command.operation) ? [] : { state: command.operation === "publish" ? "published" : "draft", version: 1 }, user = { id: USER }) { const calls = []; return { calls, auth: { async getUser() { calls.push(["getUser"]); return { data: { user }, error: user ? null : {} } } }, functions: { async invoke(name, options) { calls.push(["invoke", name, options]); const result = await handler(options.body.body); return result?.edgeError ? { data: null, error: result.edgeError } : { data: structuredClone(result), error: null } } } } }
const source = (mock, createId = () => ID) => createAdminCatalogP2DataSource({ getClient: () => mock, createId })
const command = mock => mock.calls.find(call => call[0] === "invoke")?.[2].body

await test("auth required", async () => { const mock = client(undefined, null); await assert.rejects(source(mock).listDrafts(), /AUTH_REQUIRED/); assert.equal(command(mock), undefined) })
await test("exact drafts envelope", async () => { const mock = client(); await source(mock).listDrafts(); assert.deepEqual(command(mock), { operation: "catalog", body: { operation: "drafts" } }) })
await test("exact published envelope", async () => { const mock = client(); await source(mock).listPublished(); assert.deepEqual(command(mock), { operation: "catalog", body: { operation: "published" } }) })
await test("create uses expected version zero", async () => { const mock = client(); await source(mock).createDraft({ type: "package", title: "عنوان", summary: "ملخص" }); assert.equal(command(mock).body.expectedVersion, 0) })
await test("generated UUID is record identity only", async () => { const mock = client(); await source(mock).createDraft({ type: "offer", title: "عنوان", summary: "ملخص" }); assert.deepEqual(command(mock).body, { operation: "save", id: ID, expectedVersion: 0, type: "offer", title: "عنوان", summary: "ملخص" }) })
await test("update uses current version", async () => { const mock = client(command => ({ state: "draft", version: command.expectedVersion + 1 })); await source(mock).updateDraft({ id: ID, type: "package", title: "جديد", summary: "ملخص", version: 7 }); assert.equal(command(mock).body.expectedVersion, 7) })
await test("publish uses current version", async () => { const mock = client(); await source(mock).publishDraft({ id: ID, version: 3 }); assert.deepEqual(command(mock).body, { operation: "publish", id: ID, expectedVersion: 3 }) })
await test("valid package row", async () => { const rows = await source(client(() => [row("package")])).listDrafts(); assert.equal(rows[0].type, "package") })
await test("valid offer row", async () => { const rows = await source(client(() => [row("offer", "published")])).listPublished(); assert.equal(rows[0].type, "offer") })
await test("title validation", async () => { for (const title of ["", "x".repeat(121), "bad\nvalue"]) await assert.rejects(source(client()).createDraft({ type: "package", title, summary: "ok" }), /INPUT_INVALID/) })
await test("summary validation", async () => { for (const summary of ["", "x".repeat(1001), "bad\tvalue"]) await assert.rejects(source(client()).createDraft({ type: "package", title: "ok", summary }), /INPUT_INVALID/) })
await test("type validation", async () => { await assert.rejects(source(client()).createDraft({ type: "hotel", title: "ok", summary: "ok" }), /INPUT_INVALID/) })
await test("strict read response shape", async () => { const value = await source(client(() => [row()])).listDrafts(); assert.deepEqual(Object.keys(value[0]), ["id", "type", "title", "summary", "state", "version", "dynamicBuilder", "supplierAvailability"]); assert.equal(Object.isFrozen(value[0]), true) })
await test("extra sensitive fields rejected", async () => { for (const key of ["actorId", "createdBy", "supplier_net", "price", "inventory"]) { const value = row(); value[key] = "forbidden"; await assert.rejects(source(client(() => [value])).listDrafts(), /RESPONSE_INVALID/) } })
await test("malformed responses rejected", async () => { for (const value of [null, {}, [null]]) await assert.rejects(source(client(() => value)).listDrafts(), /RESPONSE_INVALID/) })
await test("raw server error redacted", async () => { const mock = client(() => ({ edgeError: new Error("private SQL token") })); await assert.rejects(source(mock).listDrafts(), error => error.message === "ADMIN_CATALOG_REQUEST_FAILED") })
await test("stale conflict fails safely", async () => { const mock = client(() => ({ edgeError: new Error("40001 stale row details") })); await assert.rejects(source(mock).updateDraft({ id: ID, type: "package", title: "ok", summary: "ok", version: 1 }), error => error.message === "ADMIN_CATALOG_SAVE_FAILED") })
await test("no direct table", async () => { const code = await readFile(new URL("../src/services/adminCatalogP2DataSource.js", import.meta.url), "utf8"); assert.equal(/\.from\s*\(/.test(code), false) })
await test("no privileged RPC", async () => { const code = await readFile(new URL("../src/services/adminCatalogP2DataSource.js", import.meta.url), "utf8"); assert.equal(/\.rpc\s*\(|p2_catalog_v1/.test(code), false) })
await test("no browser storage", async () => { const code = await readFile(new URL("../src/services/adminCatalogP2DataSource.js", import.meta.url), "utf8"); assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(code), false) })
await test("no client actor or Admin authority", async () => { const mock = client(); for (const extra of [{ actorId: USER }, { admin: true }, { role: "admin" }]) await assert.rejects(source(mock).createDraft({ type: "package", title: "ok", summary: "ok", ...extra }), /INPUT_INVALID/); assert.equal(command(mock), undefined) })
await test("no delete operation", async () => { const dataSource = source(client()); assert.equal(dataSource.delete, undefined); assert.equal(dataSource.deleteDraft, undefined) })
await test("no unpublish operation", async () => { assert.equal(source(client()).unpublish, undefined) })
await test("dynamic builder remains false", async () => { const data = row(); data.dynamicBuilder = true; await assert.rejects(source(client(() => [data])).listDrafts(), /RESPONSE_INVALID/) })
await test("supplier availability remains null", async () => { const data = row(); data.supplierAvailability = []; await assert.rejects(source(client(() => [data])).listDrafts(), /RESPONSE_INVALID/) })
await test("Customer Packages page unchanged", () => { execFileSync("git", ["diff", "--quiet", "0fc41534e75056fa7512d2e994a12e54a0193152", "--", "src/features/packages/PackagesPage.jsx"]) })
await test("Customer Offers page unchanged", () => { execFileSync("git", ["diff", "--quiet", "0fc41534e75056fa7512d2e994a12e54a0193152", "--", "src/features/offers/OffersPage.jsx"]) })
await test("payment booking section remains non-mutating", async () => { const code = await readFile(new URL("../src/features/admin/AdminPage.jsx", import.meta.url), "utf8"); assert.equal(/approvePayment|rejectPayment|updateBooking|\.insert\s*\(|\.update\s*\(/.test(code), false); assert.match(code, /سجلات دفع وحجز موثّقة للقراءة فقط/) })

console.log(`\n${passed}/${passed} Admin Catalog P2 frontend tests passed`)
