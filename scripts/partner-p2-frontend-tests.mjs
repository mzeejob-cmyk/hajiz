import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createPartnerP2DataSource } from "../src/services/partnerP2DataSource.js"
import { PARTNER_SECTIONS } from "../src/features/partners/data/partnerPresentation.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`) }
const USER = "11111111-1111-4111-8111-111111111111", ROW = "22222222-2222-4222-8222-222222222222"
const valid = () => ({ kycState: "PENDING", commissions: [{ id: ROW, currency: "AED", amount: "7.00", state: "EARNED" }], payouts: [{ id: ROW, currency: "AED", amount: "5.00", state: "PENDING" }], payoutExecutionAllowed: false, availableCommission: null, walletBalance: null })
function client({ data = valid(), error = null, user = { id: USER } } = {}) { const calls = []; return { calls, auth: { async getUser() { calls.push(["getUser"]); return { data: { user }, error: user ? null : {} } } }, functions: { async invoke(name, options) { calls.push(["invoke", name, options]); return { data: structuredClone(data), error } } } } }
const source = mock => createPartnerP2DataSource({ getClient: () => mock })
const invoke = mock => mock.calls.find(call => call[0] === "invoke")

await test("authentication required", async () => { const mock = client({ user: null }); await assert.rejects(source(mock).load(), /AUTH_REQUIRED/); assert.equal(invoke(mock), undefined) })
await test("exact Partner Edge envelope", async () => { const mock = client(); await source(mock).load(); assert.deepEqual(invoke(mock), ["invoke", "product-p2", { body: { operation: "partner", body: {} } }]) })
await test("strict public response validation", async () => { const value = await source(client()).load(); assert.equal(value.kycState, "PENDING"); assert.equal(Object.isFrozen(value), true); assert.equal(Object.isFrozen(value.commissions), true) })
await test("KYC state validation", async () => { const data = valid(); data.kycState = "ADMIN_APPROVED"; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("commission rows are projected", async () => { assert.deepEqual((await source(client()).load()).commissions[0], { id: ROW, currency: "AED", amount: "7.00", state: "EARNED" }) })
await test("payout rows are projected", async () => { assert.deepEqual((await source(client()).load()).payouts[0], { id: ROW, currency: "AED", amount: "5.00", state: "PENDING" }) })
await test("wallet remains unavailable", async () => { assert.equal((await source(client()).load()).walletBalance, null) })
await test("available commission remains unavailable", async () => { assert.equal((await source(client()).load()).availableCommission, null) })
await test("payout execution remains false", async () => { const data = valid(); data.payoutExecutionAllowed = true; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("malformed responses fail safely", async () => { for (const data of [null, {}, { ...valid(), extra: true }, { ...valid(), commissions: [{}] }]) await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("raw server errors are redacted", async () => { await assert.rejects(source(client({ error: new Error("SQL token secret") })).load(), error => error.message === "PARTNER_P2_REQUEST_FAILED") })
await test("client authority input is forbidden", async () => { const mock = client(); for (const input of [{ ownerId: USER }, { userId: USER }, { role: "partner" }]) await assert.rejects(source(mock).load(input), /CLIENT_AUTHORITY_FORBIDDEN/); assert.equal(invoke(mock), undefined) })
await test("supplier net cannot enter response", async () => { const data = valid(); data.commissions[0].supplier_net = "100"; await assert.rejects(source(client({ data })).load(), /RESPONSE_INVALID/) })
await test("no direct tables or privileged RPC", async () => { const code = await readFile(new URL("../src/services/partnerP2DataSource.js", import.meta.url), "utf8"); assert.equal(/\.from\s*\(|\.rpc\s*\(|get_p2_partner_v1/.test(code), false) })
await test("no browser persistence", async () => { const code = await readFile(new URL("../src/services/partnerP2DataSource.js", import.meta.url), "utf8"); assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(code), false) })
await test("unsupported Partner sections remain pending", () => { for (const id of ["bookings", "clients", "referrals", "pricing-uplift"]) assert.notEqual(PARTNER_SECTIONS.find(item => item.id === id).state, "authenticated-p2-read") })
await test("only supported sections are marked wired", () => { for (const id of ["overview", "commission", "payouts", "kyc"]) assert.equal(PARTNER_SECTIONS.find(item => item.id === id).state, "authenticated-p2-read") })
await test("no payout execution UI or action", async () => { const code = await readFile(new URL("../src/features/partners/PartnersPage.jsx", import.meta.url), "utf8"); assert.equal(/executePayout|approvePayout|onClick=.*payout|تنفيذ الدفعة/.test(code), false); assert.match(code, /تنفيذ الدفعات غير مفعّل/) })
await test("UI contains loading empty error and retry states", async () => { const code = await readFile(new URL("../src/features/partners/PartnersPage.jsx", import.meta.url), "utf8"); for (const marker of ["loading", "error", "لا توجد قيود عمولة", "لا توجد دفعات مستحقة", "إعادة المحاولة"]) assert.ok(code.includes(marker), marker) })

console.log(`\n${passed}/${passed} Partner P2 frontend tests passed`)
