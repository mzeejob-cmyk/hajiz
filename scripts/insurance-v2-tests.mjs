import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

const root = new URL("../", import.meta.url)
const read = path => readFile(new URL(path, root), "utf8")
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
let passed = 0
const test = async (name, fn) => { try { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) } catch (error) { process.stderr.write(`✗ ${name}\n${error.stack}\n`); process.exitCode = 1 } }

try {
  const { default: InsurancePage } = await vite.ssrLoadModule("/src/features/insurance/InsurancePage.jsx")
  const markup = renderToStaticMarkup(React.createElement(InsurancePage))
  const source = await read("src/features/insurance/InsurancePage.jsx")
  const css = await read("src/features/insurance/insurance-v2.css")
  const main = await read("src/main.jsx")
  const routes = await read("src/app/router/routeManifest.js")
  const pkg = JSON.parse(await read("package.json"))
  const insuranceFiles = (await readdir(new URL("src/features/insurance/", root), { recursive: true })).filter(file => /\.(js|jsx)$/.test(file))

  await test("Insurance renders the HAJIZ V2 truthful presentation marker", () => assert.match(markup, /data-insurance-v2="truthful-presentation"/))
  await test("Insurance explicitly declares the service is not live", () => { assert.match(markup, /data-live-service="false"/); assert.match(markup, /خدمة التأمين غير مفعّلة للحجز أو الشراء حاليًا/) })
  await test("Insurance states that the surface is a demo", () => { assert.match(markup, /واجهة تجريبية/); assert.match(markup, /المحتوى المعروض للتقديم البصري فقط/) })
  await test("Insurance states there is no live quote", () => assert.match(markup, /لا يوجد عرض سعر حي/))
  await test("Insurance states no payment occurs", () => assert.match(markup, /لا يتم تحصيل مبلغ أو فتح مسار دفع/))
  await test("Insurance states no policy is issued", () => assert.match(markup, /لا ينشئ العرض الحالي وثيقة أو رقم بوليصة/))
  await test("Insurance fabricates no provider or plan name", () => assert.equal(/allianz|axa|metlife|takaful|provider|شركة التأمين|الخطة الذهبية|الخطة الفضية/i.test(markup), false))
  await test("Insurance exposes no premium price or currency", () => assert.equal(/\b(?:AED|SDG|USD|EUR)\b|\d[\d,]*(?:\.\d{2})?\s*(?:درهم|جنيه|دولار)/i.test(markup), false))
  await test("Insurance exposes no policy or quote identifier", () => assert.equal(/\b(?:POL|QUOTE)[-_A-Z0-9]{4,}\b|data-(?:policy|quote)-id/i.test(markup), false))
  await test("Insurance has no quote authority or purchase CTA", () => assert.equal(/احصل على عرض|قارن الأسعار|اشترِ الآن|أصدر وثيقتك|متاح الآن/.test(markup), false))
  await test("Insurance has no checkout or payment CTA", () => assert.equal(/>\s*(?:احجز|ادفع|الدفع|الشراء)\s*</.test(markup), false))
  await test("Insurance has no fake interactive quote form", () => { assert.equal(/<(?:form|input|select|textarea)\b/.test(markup), false); assert.equal(/destination|traveler ages|coverage selector|quote button/i.test(source), false) })
  await test("Insurance source has no provider network integration", () => assert.equal(/fetch\s*\(|axios|provider sdk|quote api/i.test(source), false))
  await test("Insurance source has no browser persistence or elevated authority", () => assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie|service_role/i.test(source), false))
  await test("Insurance source has no Supabase browser authority", () => assert.equal(/supabase|createClient|\.from\s*\(|\.rpc\s*\(/i.test(source), false))
  await test("Insurance uses the existing V2 primitives", () => assert.match(source, /Badge, Container, NetworkMark, Surface/))
  await test("Insurance truth is exposed as an accessible live status", () => { assert.match(markup, /role="status"/); assert.match(markup, /aria-live="polite"/) })
  await test("Insurance headings are semantic", () => { assert.match(markup, /<h1[^>]*>/); assert.ok((markup.match(/<h2/g) || []).length >= 2); assert.ok((markup.match(/<h3/g) || []).length >= 3) })
  await test("Insurance decorative media is hidden", () => { assert.match(markup, /insurance-v2__visual" aria-hidden="true"/); assert.match(markup, /focusable="false"/) })
  await test("Insurance CSS is direction-aware for RTL and LTR", () => { assert.match(css, /\[dir="ltr"\] \.insurance-v2__hero/); assert.match(css, /inset-inline|border-inline-start/); assert.equal(/margin-left|margin-right|padding-left|padding-right/.test(css), false) })
  await test("Insurance CSS has responsive mobile and tablet layouts", () => { assert.match(css, /@media \(max-width: 900px\)/); assert.match(css, /@media \(max-width: 600px\)/) })
  await test("Insurance CSS honors reduced motion", () => assert.match(css, /@media \(prefers-reduced-motion: reduce\)/))
  await test("Insurance stylesheet is loaded once after the shared foundation and remains feature-scoped", () => {
    const insuranceImport = 'import "./features/insurance/insurance-v2.css"'
    assert.equal(main.split(insuranceImport).length - 1, 1)
    assert.ok(main.indexOf('import "./design-system/index.css"') < main.indexOf(insuranceImport))
    assert.doesNotMatch(css, /(?:^|[},]\s*)(?:button|section|article|h1|h2|input|form|a)(?:\b|[:.#\[])/gm)
    assert.match(css, /\.insurance-v2(?:\s|\{|__)/)
    assert.ok(main.indexOf(insuranceImport) < main.indexOf('import "./features/partners/partner-v2.css"'))
    assert.ok(main.indexOf(insuranceImport) < main.indexOf('import "./features/admin/admin-v2.css"'))
  })
  await test("Only the canonical Insurance route exists and Visas remains absent", () => { const routePaths = [...routes.matchAll(/path: "([^"]+)"/g)].map(match => match[1]); assert.equal(routePaths.filter(path => path.startsWith("/insurance")).join(), "/insurance"); assert.equal(routePaths.some(path => path.startsWith("/visas")), false) })
  await test("Insurance registers exactly one focused suite in the package chain", () => { assert.equal((pkg.scripts.test.match(/insurance-v2-tests\.mjs/g) || []).length, 1); assert.equal(pkg.scripts["test:insurance-v2"], "node scripts/insurance-v2-tests.mjs") })
  await test("All Insurance JavaScript files remain presentation-only", async () => { const forbidden = /fetch\s*\(|axios|supabase|localStorage|sessionStorage|indexedDB|document\.cookie|createCheckout|payment-initiation|Bankak|Apple Pay|Google Pay|policy issuance/i; for (const file of insuranceFiles) assert.equal(forbidden.test(await read(`src/features/insurance/${file}`)), false, file) })

  process.stdout.write(`\n${passed}/26 Insurance V2 tests passed\n`)
} finally { await vite.close() }
