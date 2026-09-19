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
const adminSource = { load: async () => [] }
const catalogSource = { listDrafts: async () => [], listPublished: async () => [], createDraft: async () => ({}), updateDraft: async () => ({}), publishDraft: async () => ({}) }

try {
  const { default: AdminPage } = await vite.ssrLoadModule("/src/features/admin/AdminPage.jsx")
  const markup = renderToStaticMarkup(React.createElement(AdminPage, { dataSource: adminSource, catalogDataSource: catalogSource }))
  const admin = await read("src/features/admin/AdminPage.jsx")
  const catalog = await read("src/features/admin/components/AdminCatalogPanel.jsx")
  const presentation = await read("src/features/admin/data/adminOpsPresentation.js")
  const adminData = await read("src/services/adminP2DataSource.js")
  const catalogData = await read("src/services/adminCatalogP2DataSource.js")
  const css = await read("src/features/admin/admin-v2.css")
  const main = await read("src/main.jsx")
  const pkg = JSON.parse(await read("package.json"))

  await test("Admin renders the Figma 19:66 V2 grammar", () => { assert.match(markup, /data-admin-v2="operations-console"/); assert.match(markup, /تشغيل موثوق خلف التجربة/) })
  await test("Authenticated P2 read boundary is preserved", () => { assert.match(markup, /data-boundary="authenticated-p2-read"/); assert.match(markup, /data-source="authenticated-p2-edge"/) })
  await test("Operational rows are explicitly read only", () => assert.match(admin, /سجلات دفع وحجز موثّقة للقراءة فقط/))
  await test("Booking and payment states render as separate domains", () => { assert.match(admin, /domain="payment" status=\{row\.paymentState\}/); assert.match(admin, /domain="booking" status=\{row\.bookingState\}/) })
  await test("Admin read datasource retains exact trusted fields", () => assert.match(adminData, /\["bookingReference", "bookingState", "paymentState", "method", "amount", "currency"\]/))
  await test("No supplier net is exposed by Admin UI", () => assert.equal(/supplier[_ ]?net|net_cost/i.test(admin), false))
  await test("No margin or commission authority is introduced", () => assert.equal(/margin|commission|هامش|عمولة/i.test(admin), false))
  await test("No browser financial sum is calculated", () => assert.equal(/amount\s*\+|\.reduce\s*\([^)]*(?:amount|currency)|revenue|profit|settlement/i.test(admin), false))
  await test("No cross-currency total is presented", () => assert.equal(/totalAmount|currencyTotal|إجمالي مالي|إجمالي الإيرادات/.test(admin), false))
  await test("Bankak review is truthful and not operationally wired", () => { assert.match(admin, /قدرة محفوظة، وليست إجراءً موصولًا/); assert.match(admin, /لا تظهر أزرار قبول أو رفض أو تأكيد/); assert.equal(/review_bankak_payment|paymentId|inspect-payment-receipt/.test(admin), false) })
  await test("Deferred operational domains remain truthful", () => { for (const id of ["supplier-failures", "refunds-reconciliation", "partners", "payouts", "pricing-currency", "suppliers", "system-audit"]) assert.match(presentation, new RegExp(id)); assert.match(admin, /pending-read-only/) })
  await test("Legacy CMS metadata does not downgrade wired Catalog", () => { assert.match(presentation, /"cms"/); assert.match(admin, /Catalog CMS الموثّق أدناه يعمل/) })
  await test("Catalog CMS write boundary is preserved", () => assert.match(catalog, /data-boundary="admin-authorized-catalog-writes"/))
  await test("Catalog draft list is preserved", () => assert.match(catalog, /dataSource\.listDrafts\(\)/))
  await test("Catalog published list is preserved", () => assert.match(catalog, /dataSource\.listPublished\(\)/))
  await test("Catalog create draft is preserved", () => assert.match(catalog, /dataSource\.createDraft\(form\)/))
  await test("Catalog update draft is preserved", () => assert.match(catalog, /dataSource\.updateDraft\(\{ id: editing\.id, version: editing\.version, \.\.\.form \}\)/))
  await test("Catalog publish draft is preserved", () => assert.match(catalog, /dataSource\.publishDraft\(\{ id: row\.id, version: row\.version \}\)/))
  await test("Expected version concurrency remains authoritative", () => { assert.match(catalogData, /expectedVersion: version\(input\.version\)/); assert.match(catalogData, /expectedVersion: 0/); assert.match(catalog, /v\{editing\.version\}/) })
  await test("Catalog remains package and offer only", () => { assert.match(catalogData, /new Set\(\["package", "offer"\]\)/); assert.match(catalog, /value="package"/); assert.match(catalog, /value="offer"/) })
  await test("Dynamic builder remains false", () => assert.match(catalogData, /dynamicBuilder === false/))
  await test("Supplier availability remains null", () => assert.match(catalogData, /supplierAvailability === null/))
  await test("Admin loading state is accessible", () => { assert.match(markup, /aria-live="polite"/); assert.match(admin, /aria-busy="true"/) })
  await test("Operational empty state is explicit", () => assert.match(admin, /لا توجد سجلات متاحة/))
  await test("Operational error and retry are explicit", () => { assert.match(admin, /تعذر تحميل بيانات الإدارة/); assert.match(admin, /إعادة المحاولة/) })
  await test("Catalog saving state is preserved", () => { assert.match(catalog, /setState\("saving"\)/); assert.match(catalog, /جارٍ حفظ المسودة/) })
  await test("Catalog publishing state is preserved", () => { assert.match(catalog, /setState\("publishing"\)/); assert.match(catalog, /جارٍ نشر السجل/) })
  await test("Catalog conflict state is preserved", () => { assert.match(catalog, /setState\("conflict"\)/); assert.match(catalog, /ربما تغيرت النسخة/) })
  await test("Catalog actions retain required labels", () => { for (const label of ["إعادة التحميل", "إنشاء مسودة", "تعديل المسودة", "حفظ المسودة", "نشر", "إلغاء"]) assert.match(catalog, new RegExp(label)) })
  await test("Admin UI adds no direct database access", () => assert.equal(/\.from\s*\(|\.rpc\s*\(|direct sql/i.test(admin + catalog), false))
  await test("Admin UI adds no service role authority", () => assert.equal(/service_role|serviceRole|SUPABASE_SECRET/i.test(admin + catalog), false))
  await test("Admin UI adds no browser storage", () => assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(admin + catalog), false))
  await test("Admin UI adds no role or owner injection", () => assert.equal(/ownerId|userId|actorId|role:\s*["']admin|admin:\s*true/.test(admin + catalog), false))
  await test("Admin uses HAJIZ V2 primitives", () => { assert.match(admin, /Badge, Button, Container, NetworkMark, StatusBadge, Surface/); assert.match(catalog, /Badge, Button, StatusBadge, Surface/) })
  await test("Admin remains Arabic-first RTL", () => assert.match(markup, /class="admin-v2" dir="rtl"/))
  await test("Admin CSS supports logical LTR structure", () => { assert.match(css, /inset-inline|border-inline|padding-inline/); assert.equal(/margin-left|margin-right|padding-left|padding-right/.test(css), false) })
  await test("Admin CSS is responsive", () => { assert.match(css, /@media \(max-width: 900px\)/); assert.match(css, /@media \(max-width: 600px\)/) })
  await test("Admin CSS honors reduced motion", () => assert.match(css, /@media \(prefers-reduced-motion: reduce\)/))
  await test("Admin navigation remains visible and horizontally usable on mobile", () => { assert.match(css, /\.admin-v2__nav \{[^}]*overflow-x: auto/s); assert.equal(/\.admin-v2__nav\s*\{[^}]*display:\s*none/s.test(css), false) })
  await test("Admin forms retain semantic labels and visible focus", () => { assert.match(catalog, /<label>النوع/); assert.match(catalog, /<label>العنوان/); assert.match(catalog, /<label>الملخص/); assert.match(css, /:focus-visible/) })
  await test("Status meaning is not color-only", () => { assert.match(admin, /domainLabels\[domain\]/); assert.match(admin, /label=\{status\}/) })
  await test("Admin stylesheet is last in V2 feature cascade", () => assert.equal(main.trim().split("\n").filter(line => line.startsWith("import \"./features/")).at(-1), 'import "./features/admin/admin-v2.css"'))
  await test("Admin V2 suite is registered exactly once", () => { assert.equal((pkg.scripts.test.match(/admin-v2-presentation-tests\.mjs/g) || []).length, 1); assert.equal(pkg.scripts["test:admin-v2"], "node scripts/admin-v2-presentation-tests.mjs") })

  process.stdout.write(`\n${passed}/43 Admin V2 presentation tests passed\n`)
} finally { await vite.close() }
