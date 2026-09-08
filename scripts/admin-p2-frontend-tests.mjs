import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createAdminP2DataSource } from "../src/services/adminP2DataSource.js"
import { ADMIN_OPS_PRESENTATION } from "../src/features/admin/data/adminOpsPresentation.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`) }
const USER = "11111111-1111-4111-8111-111111111111"
const valid = () => [{ bookingReference: "HJZ-TEST-0001", bookingState: "pending_payment", paymentState: "awaiting", method: "bankak", amount: "100.00", currency: "AED" }]
function client({ data = valid(), error = null, user = { id: USER } } = {}) { const calls = []; return { calls, auth: { async getUser() { calls.push(["getUser"]); return { data: { user }, error: user ? null : {} } } }, functions: { async invoke(name, options) { calls.push(["invoke", name, options]); return { data: structuredClone(data), error } } } } }
const source = mock => createAdminP2DataSource({ getClient: () => mock })
const invoke = mock => mock.calls.find(call => call[0] === "invoke")

await test("authentication required", async () => { const mock = client({ user: null }); await assert.rejects(source(mock).load(), /AUTH_REQUIRED/); assert.equal(invoke(mock), undefined) })
await test("exact Admin Edge envelope", async () => { const mock = client(); await source(mock).load(); assert.deepEqual(invoke(mock), ["invoke", "product-p2", { body: { operation: "adminReads", body: {} } }]) })
await test("strict response shape", async () => { assert.deepEqual(Object.keys((await source(client()).load())[0]), ["bookingReference", "bookingState", "paymentState", "method", "amount", "currency"]) })
await test("valid rows accepted and frozen", async () => { const rows = await source(client()).load(); assert.equal(rows.length, 1); assert.equal(Object.isFrozen(rows), true); assert.equal(Object.isFrozen(rows[0]), true) })
await test("booking reference validated", async () => { for (const bookingReference of ["PAY-1", "HJZ-DEMO-1", "bad"]) { const data = valid(); data[0].bookingReference = bookingReference; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) } })
await test("booking state uses canonical contract", async () => { const data = valid(); data[0].bookingState = "supplier_failed"; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("payment state uses canonical contract", async () => { const data = valid(); data[0].paymentState = "approved"; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("method uses canonical contract", async () => { const data = valid(); data[0].method = "manual"; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("amount and currency validated", async () => { for (const patch of [{ amount: -1 }, { amount: "1.234" }, { currency: "usd" }]) { const data = valid(); Object.assign(data[0], patch); await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) } })
await test("malformed response rejected", async () => { for (const data of [null, {}, [null]]) await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("extra sensitive fields rejected", async () => { for (const key of ["supplier_net", "ownerId", "userId", "role", "providerMetadata"]) { const data = valid(); data[0][key] = "forbidden"; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) } })
await test("raw server errors redacted", async () => { await assert.rejects(source(client({ error: new Error("SQL token secret") })).load(), error => error.message === "ADMIN_P2_REQUEST_FAILED") })
await test("client authority forbidden", async () => { const mock = client(); for (const input of [{ actorId: USER }, { userId: USER }, { role: "admin" }, { admin: true }]) await assert.rejects(source(mock).load(input), /CLIENT_AUTHORITY_FORBIDDEN/); assert.equal(invoke(mock), undefined) })
await test("no direct table access", async () => { const code = await readFile(new URL("../src/services/adminP2DataSource.js", import.meta.url), "utf8"); assert.equal(/\.from\s*\(/.test(code), false) })
await test("no privileged RPC", async () => { const code = await readFile(new URL("../src/services/adminP2DataSource.js", import.meta.url), "utf8"); assert.equal(/\.rpc\s*\(|get_p2_admin_payments_v1/.test(code), false) })
await test("no browser storage", async () => { const code = await readFile(new URL("../src/services/adminP2DataSource.js", import.meta.url), "utf8"); assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(code), false) })
await test("no synthetic or demo fallback", async () => { const files = ["../src/features/admin/AdminPage.jsx", "../src/features/admin/data/adminOpsPresentation.js"]; for (const file of files) assert.equal(/PAY-DEMO|HJZ-DEMO|SUP-DEMO|synthetic-contract-fixture/.test(await readFile(new URL(file, import.meta.url), "utf8")), false) })
await test("no Admin write actions", async () => { const code = await readFile(new URL("../src/features/admin/AdminPage.jsx", import.meta.url), "utf8"); assert.equal(/approve|reject|refund|reconcile|\.insert\s*\(|\.update\s*\(|onClick=.*(?:pay|booking)/i.test(code), false) })
await test("UI has loading empty error and retry", async () => { const code = await readFile(new URL("../src/features/admin/AdminPage.jsx", import.meta.url), "utf8"); for (const value of ["loading", "لا توجد سجلات متاحة", "error", "إعادة المحاولة"]) assert.ok(code.includes(value), value) })
await test("unsupported domains remain pending read only", () => { assert.deepEqual(ADMIN_OPS_PRESENTATION.deferred, ["supplier-failures", "refunds-reconciliation", "partners", "payouts", "pricing-currency", "suppliers", "cms", "system-audit"]) })
await test("stale Staging runtime warning removed", async () => { const code = await readFile(new URL("../src/features/admin/AdminPage.jsx", import.meta.url), "utf8"); assert.equal(code.includes("Staging runtime validation ما زال بوابة إطلاق أساسية"), false); assert.match(code, /ليس جاهزًا للإنتاج/) })

console.log(`\n${passed}/${passed} Admin P2 frontend tests passed`)
