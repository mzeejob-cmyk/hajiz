import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

const root = new URL("../", import.meta.url)
const read = path => readFile(new URL(path, root), "utf8")
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
let passed = 0
const test = async (name, fn) => { try { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) } catch (error) { process.stderr.write(`✗ ${name}\n${error.stack}\n`); process.exitCode = 1 } }
const ROW_A = "11111111-1111-4111-8111-111111111111"
const ROW_B = "22222222-2222-4222-8222-222222222222"
const ready = { load: async () => ({ kycState: "PENDING", commissions: [{ id: ROW_A, amount: "17.50", currency: "AED", state: "EARNED" }], payouts: [{ id: ROW_B, amount: "11.00", currency: "SDG", state: "PENDING" }], payoutExecutionAllowed: false, availableCommission: null, walletBalance: null }) }
const empty = { load: async () => ({ kycState: "NOT_SUBMITTED", commissions: [], payouts: [], payoutExecutionAllowed: false, availableCommission: null, walletBalance: null }) }

try {
  const { default: PartnersPage } = await vite.ssrLoadModule("/src/features/partners/PartnersPage.jsx")
  const initial = renderToStaticMarkup(React.createElement(PartnersPage, { dataSource: ready }))
  const source = await read("src/features/partners/PartnersPage.jsx")
  const presentation = await read("src/features/partners/data/partnerPresentation.js")
  const dataSource = await read("src/services/partnerP2DataSource.js")
  const css = await read("src/features/partners/partner-v2.css")
  const main = await read("src/main.jsx")
  const pkg = JSON.parse(await read("package.json"))

  await test("Partner renders HAJIZ V2 trusted presentation marker", () => assert.match(initial, /data-partner-v2="trusted-presentation"/))
  await test("Partner remains RTL", () => assert.match(initial, /class="partner-v2" dir="rtl"/))
  await test("Partner preserves Model B marker", () => assert.match(initial, /data-model="model-b"/))
  await test("Partner keeps authenticated P2 Edge source", () => assert.match(initial, /data-source="authenticated-p2-edge"/))
  await test("Partner uses V2 design-system primitives", () => assert.match(source, /Badge, Button, Container, NetworkMark, StatusBadge, Surface/))
  await test("Partner hero matches canonical operational language", () => assert.match(initial, /تشغيل موثوق خلف كل رحلة/))
  await test("Partner states browser has no financial authority", () => assert.match(initial, /لا سلطة عمولة أو سعر أو مال في المتصفح/))
  await test("Partner keeps supplier net internal without exposing its field", () => assert.match(source, /صافي المورد داخلي/))
  await test("Partner does not compute commission totals", () => assert.equal(/\.reduce\s*\(|availableCommission\s*\?\?|walletBalance\s*\?\?|إجمالي العمولات/.test(source), false))
  await test("Partner does not combine currencies", () => assert.equal(/currencyConversion|exchangeRate|convertCurrency|totalAmount/.test(source), false))
  await test("KYC is explicitly read-only", () => assert.match(source, /للقراءة فقط/))
  await test("KYC mutation controls do not exist", () => assert.equal(/submitKyc|updateKyc|رفع مستند|توثيق الآن/.test(source), false))
  await test("Payout execution remains unavailable", () => assert.match(source, /تنفيذ الدفعات غير مفعّل/))
  await test("Payout mutation controls do not exist", () => assert.equal(/executePayout|approvePayout|requestPayout|سحب الرصيد|تنفيذ الدفعة/.test(source), false))
  await test("Wallet and available commission are not presented as values", () => assert.equal(/data\.walletBalance|data\.availableCommission/.test(source), false))
  await test("Rows render exact trusted amount and currency", () => assert.match(source, /item\.amount\} \{item\.currency/))
  await test("Commission and payout share the trusted row presenter", () => assert.equal((source.match(/<AmountRows/g) || []).length, 2))
  await test("Record identifiers are safely abbreviated", () => assert.match(source, /item\.id\.slice\(0, 8\)/))
  await test("Unsupported Partner sections remain truthful", () => { for (const id of ["bookings", "clients", "referrals", "pricing-uplift"]) assert.match(presentation, new RegExp(`id: "${id}"`)) })
  await test("Pending sections are not marked as wired", () => { for (const state of ["read-contract-pending", "contract-pending", "policy-owned"]) assert.match(presentation, new RegExp(state)) })
  await test("Pricing uplift remains policy-owned", () => assert.match(source, /تحكمه سياسة الخادم/))
  await test("Empty commission and payout states are explicit", () => { assert.match(source, /لا توجد قيود عمولة موثّقة/); assert.match(source, /لا توجد دفعات مستحقة موثّقة/) })
  await test("Loading state is accessible", () => { assert.match(initial, /aria-live="polite"/); assert.match(source, /aria-busy="true"/) })
  await test("Error state redacts raw errors and offers retry", () => { assert.match(source, /لم نعرض أي بيانات غير مؤكدة/); assert.match(source, /إعادة المحاولة/); assert.equal(/error\.message|String\(error\)/.test(source), false) })
  await test("No client financial or owner authority is introduced", () => assert.equal(/ownerId|userId|agentCommission|supplierNet|sellingPrice|marketFloor/.test(source), false))
  await test("Existing strict Partner data source retains its authority shape", () => { assert.match(dataSource, /operation: "partner", body: \{\}/); assert.match(dataSource, /payoutExecutionAllowed === false/); assert.match(dataSource, /availableCommission === null/); assert.match(dataSource, /walletBalance === null/) })
  await test("Partner presentation adds no direct database or privileged RPC", () => assert.equal(/\.from\s*\(|\.rpc\s*\(|service_role|createClient/.test(source), false))
  await test("Partner presentation adds no browser persistence", () => assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source), false))
  await test("Partner CSS is responsive", () => { assert.match(css, /@media \(max-width: 900px\)/); assert.match(css, /@media \(max-width: 600px\)/) })
  await test("Partner CSS is direction-aware", () => { assert.match(css, /inset-inline|border-inline/); assert.equal(/margin-left|margin-right|padding-left|padding-right/.test(css), false) })
  await test("Partner CSS honors reduced motion", () => assert.match(css, /@media \(prefers-reduced-motion: reduce\)/))
  await test("Partner stylesheet is loaded once after the shared foundation and remains feature-scoped", () => {
    const partnerImport = 'import "./features/partners/partner-v2.css"'
    const adminImport = 'import "./features/admin/admin-v2.css"'
    assert.equal(main.split(partnerImport).length - 1, 1)
    assert.ok(main.indexOf('import "./design-system/index.css"') < main.indexOf(partnerImport))
    assert.doesNotMatch(css, /(?:^|[},]\s*)(?:button|section|article|h1|h2|input|form|a)(?:\b|[:.#[])/gm)
    assert.match(css, /\.partner-v2(?:\s|\{|__)/)
    assert.ok(main.indexOf(partnerImport) < main.indexOf(adminImport))
    assert.notEqual(partnerImport, adminImport)
  })
  await test("Partner suite is registered exactly once", () => { assert.equal((pkg.scripts.test.match(/partner-v2-presentation-tests\.mjs/g) || []).length, 1); assert.equal(pkg.scripts["test:partner-v2"], "node scripts/partner-v2-presentation-tests.mjs") })
  await test("Empty fixture preserves safe server contract", async () => { const value = await empty.load(); assert.equal(value.commissions.length, 0); assert.equal(value.payouts.length, 0); assert.equal(value.availableCommission, null); assert.equal(value.walletBalance, null) })

  process.stdout.write(`\n${passed}/34 Partner V2 presentation tests passed\n`)
} finally { await vite.close() }
