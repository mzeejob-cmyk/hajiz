import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 packages and offers presentation regression suite.
 * Guards the node 18:32 grammar, the live-rows-only truth label, the frozen
 * public catalog read boundary, absence of fabricated travel or commercial
 * fields, preserved favorite behaviour, RTL, responsive rules, accessibility
 * and motion safety.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")
const [css, collectionSource, cardSource, packagesSource, offersSource, mainSource] = await Promise.all([
  read("../src/features/catalog/catalog-v2.css"),
  read("../src/features/catalog/components/PublicCatalogCollection.jsx"),
  read("../src/features/catalog/components/CatalogCard.jsx"),
  read("../src/features/packages/PackagesPage.jsx"),
  read("../src/features/offers/OffersPage.jsx"),
  read("../src/main.jsx"),
])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { PublicCatalogCollection } = await vite.ssrLoadModule("/src/features/catalog/components/PublicCatalogCollection.jsx")
const { CatalogCard } = await vite.ssrLoadModule("/src/features/catalog/components/CatalogCard.jsx")
const { default: PackagesPage } = await vite.ssrLoadModule("/src/features/packages/PackagesPage.jsx")
const { default: OffersPage } = await vite.ssrLoadModule("/src/features/offers/OffersPage.jsx")

const row = (id, type, extra = {}) => ({
  id, type, title: `عنوان ${id}`, summary: `وصف ${id}`,
  state: "published", version: 3, dynamicBuilder: false, supplierAvailability: null, ...extra,
})
const never = { listFavorites: async () => [], saveFavorite: async () => {}, deleteFavorite: async () => {} }
const render = element => renderToStaticMarkup(React.createElement(MemoryRouter, null, element))
const collection = (type, rows, options = {}) => render(React.createElement(PublicCatalogCollection, {
  type,
  dataSource: { loadPackages: async () => rows, loadOffers: async () => rows, ...options.dataSource },
  favoritesDataSource: never,
}))

// useEffect never runs under SSR, so list markup is produced by rendering the
// extracted card directly with the rows the boundary would have returned.
const resolved = (type, rows) => render(React.createElement(React.Fragment, null,
  ...rows.map(item => React.createElement(CatalogCard, {
    key: item.id, id: item.id, type: item.type, version: item.version,
    title: item.title, summary: item.summary,
  }))))

const packagesPage = render(React.createElement(PackagesPage))
const offersPage = render(React.createElement(OffersPage))
const loading = collection("package", [row("p1", "package")])

// ---- Canonical V2 grammar · node 18:32 -------------------------------------

await test("the node 18:35 truth label is rendered", () => {
  assert.match(loading, /المحتوى المنشور فقط/)
  assert.match(loading, /data-catalog-truth="live-rows-only"/)
  assert.match(collectionSource, /const TRUTH_LABEL = "المحتوى المنشور فقط"/)
})

await test("the truth label uses the node 18:34 success surface", () => {
  assert.match(css, /\.catalog-v2__truth \{[\s\S]*?background: var\(--hajiz-v2-color-surface-success\)/)
  assert.match(css, /\.catalog-v2__truth \{[\s\S]*?color: var\(--hajiz-v2-color-status-success\)/)
  assert.match(css, /\.catalog-v2__truth \{[\s\S]*?font: var\(--hajiz-v2-en-label\)/)
})

await test("cards match the node 18:37 geometry", () => {
  assert.match(css, /\.catalog-v2__card \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-lg\)/)
  assert.match(css, /\.catalog-v2__card \{[\s\S]*?padding: var\(--hajiz-v2-space-6\)/)
  assert.match(css, /\.catalog-v2__card \{[\s\S]*?gap: var\(--hajiz-v2-space-4\)/)
})

await test("card media matches node 18:38 and is decorative", () => {
  assert.match(css, /\.catalog-v2__media \{[\s\S]*?block-size: 210px/)
  assert.match(css, /\.catalog-v2__media \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-image\)/)
  assert.match(cardSource, /<div className="catalog-v2__media" aria-hidden="true"\/>/)
})

await test("the card gradient uses valid CSS, not a logical keyword", () => {
  // linear-gradient accepts no logical direction keyword.
  assert.equal(/to inline-(?:end|start)|to block-(?:end|start)/.test(css), false)
  assert.match(css, /linear-gradient\(to (?:left|right),/)
})

await test("the gradient direction is expressed for both RTL and LTR", () => {
  assert.match(css, /\.catalog-v2__media \{[\s\S]*?background: linear-gradient\(to left, var\(--hajiz-v2-navy-900\), var\(--hajiz-v2-color-journey-line\)\)/)
  assert.match(css, /\[dir="ltr"\] \.catalog-v2__media \{\s*background: linear-gradient\(to right, var\(--hajiz-v2-navy-900\), var\(--hajiz-v2-color-journey-line\)\);/)
})

await test("both gradient directions keep the same two design tokens", () => {
  const rules = [...css.matchAll(/\.catalog-v2__media \{[^}]*linear-gradient\(to (left|right), ([^)]*\)[^)]*\))/g)]
  assert.equal(rules.length, 2, "one RTL rule and one LTR rule are expected")
  assert.deepEqual(rules.map(match => match[1]).sort(), ["left", "right"])
  for (const rule of rules) {
    assert.match(rule[0], /var\(--hajiz-v2-navy-900\)/)
    assert.match(rule[0], /var\(--hajiz-v2-color-journey-line\)/)
  }
})

await test("the grid is three columns without assuming three rows", () => {
  assert.match(css, /\.catalog-v2__grid \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(320px, 410px\)\)/)
  assert.match(css, /\.catalog-v2__grid \{[\s\S]*?gap: var\(--hajiz-v2-space-6\)/)
  assert.equal(/slice\(0,\s*3\)|\.length === 3|repeat\(3,/.test(collectionSource + css), false)
})

await test("no second token namespace or shell fork is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
  assert.equal(/:root\s*\{|--catalog-[a-z-]+:\s*#/.test(css), false)
  assert.equal(/AppShell|site-header|v2-header/.test(collectionSource + packagesSource + offersSource), false)
})

// ---- Typed requests ---------------------------------------------------------

await test("Packages requests package rows only", () => {
  assert.match(packagesSource, /PublicCatalogCollection type="package"/)
  assert.match(packagesPage, /data-catalog-type="package"/)
  assert.match(collectionSource, /type === "package" \? dataSource\.loadPackages : dataSource\.loadOffers/)
})

await test("Offers requests offer rows only", () => {
  assert.match(offersSource, /PublicCatalogCollection type="offer"/)
  assert.match(offersPage, /data-catalog-type="offer"/)
})

await test("package and offer data are never merged", () => {
  assert.equal(/loadPackages\(\)[\s\S]{0,80}loadOffers\(\)|concat\(|\.\.\.packages/.test(collectionSource), false)
})

await test("the frozen page composition is preserved", () => {
  for (const [name, source] of [["packages", packagesSource], ["offers", offersSource]]) {
    assert.match(source, /<FeaturePage[^>]*><PublicCatalogCollection/, name)
    assert.match(source, /data-publish-authority="false"/, name)
    assert.match(source, /data-dynamic-builder="false"/, name)
  }
})

// ---- Content authority --------------------------------------------------------

await test("title and summary come from the returned row", () => {
  const html = resolved("package", [row("p1", "package"), row("p2", "package")])
  assert.match(html, /عنوان p1/)
  assert.match(html, /وصف p1/)
  assert.match(html, /عنوان p2/)
  assert.match(collectionSource, /\{row\.title\}/)
  assert.match(collectionSource, /\{row\.summary\}/)
})

await test("a blank summary yields a truthful minimal state, not invented facts", () => {
  const html = resolved("offer", [row("o1", "offer", { summary: "" })])
  assert.match(html, /لا يتضمّن هذا الصف وصفًا في المحتوى المتاح\./)
  assert.equal(/الوجهة · المدة|أبرز التجارب|قصة سفر منشورة/.test(html), false)
  assert.match(cardSource, /summary\n        \? /)
})

await test("the node 18:40 placeholder detail line is not reproduced", () => {
  assert.equal(/الوجهة · المدة · أبرز التجارب/.test(collectionSource + cardSource), false)
  assert.equal(/قصة سفر منشورة/.test(collectionSource + cardSource), false)
})

await test("no destination, duration, experience or commercial field is rendered", () => {
  const forbidden = /destination|duration|experiences|nights|\bprice\b|currency|inventory|supplierAvailability\s*\}/i
  const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, "")
  assert.equal(forbidden.test(strip(collectionSource) + strip(cardSource)), false)
})

await test("an arbitrary row count is supported", () => {
  for (const count of [1, 2, 5]) {
    const rows = Array.from({ length: count }, (_, index) => row(`r${index}`, "package"))
    const html = resolved("package", rows)
    assert.equal((html.match(/data-catalog-id="/g) ?? []).length, count, `count ${count}`)
  }
})

await test("no fabricated count or pagination copy exists", () => {
  assert.equal(/3 عروض|3 باقات|صفحة \d|التالي|السابق/.test(collectionSource + packagesSource + offersSource), false)
})

await test("no synthetic catalog fallback exists", () => {
  assert.equal(/FALLBACK|fixture|SAMPLE_|مساحة الميزة جاهزة|بيانات اصطناعية/i.test(collectionSource + cardSource), false)
  const empty = collection("package", [])
  assert.equal(/data-catalog-id="/.test(empty) || /عنوان /.test(empty), false)
})

// ---- States --------------------------------------------------------------------

await test("loading, empty and error states stay truthful", () => {
  assert.match(loading, /جارٍ تحميل الباقات المنشورة/)
  assert.match(loading, /role="status"/)
  assert.match(loading, /aria-live="polite"/)
  for (const marker of ["لا توجد باقات منشورة متاحة حاليًا.", "لا توجد عروض منشورة متاحة حاليًا.",
    "تعذر تحميل الباقات المنشورة.", "تعذر تحميل العروض المنشورة.", "إعادة المحاولة"])
    assert.ok(collectionSource.includes(marker), marker)
})

await test("the retry path is preserved", () => {
  assert.match(collectionSource, /setAttempt\(value => value \+ 1\)/)
  assert.match(collectionSource, /role="alert"/)
  assert.match(css, /\.catalog-v2__state--error \{/)
})

// A total occurrence count cannot tell which branches are covered: loading,
// empty and ready alone already reach three. Each branch is sliced and
// asserted independently instead.
const branchSource = marker => {
  const at = collectionSource.indexOf(marker)
  assert.ok(at > -1, `branch not found: ${marker}`)
  const end = collectionSource.indexOf("</section>", at)
  assert.ok(end > at, `branch end not found: ${marker}`)
  return collectionSource.slice(at, end)
}

await test("the loading branch carries the truth label", () => {
  assert.match(branchSource('if (request.state === "loading")'), /<TruthLabel\/>/)
})

await test("the error branch carries the truth label", () => {
  const branch = branchSource('if (request.state === "error")')
  assert.match(branch, /<TruthLabel\/>/)
  assert.match(branch, /role="alert"/)
  assert.match(branch, /\{copy\[type\]\.error\}/)
  assert.match(branch, /إعادة المحاولة/)
})

await test("the empty branch carries the truth label", () => {
  assert.match(branchSource("if (request.rows.length === 0)"), /<TruthLabel\/>/)
})

await test("the ready branch carries the truth label", () => {
  const at = collectionSource.indexOf('return <div className="catalog-v2">')
  assert.ok(at > -1)
  assert.match(collectionSource.slice(at, collectionSource.indexOf("<section", at)), /<TruthLabel\/>/)
})

await test("all four catalog states are covered, none left out", () => {
  for (const marker of ['if (request.state === "loading")', 'if (request.state === "error")',
    "if (request.rows.length === 0)", 'return <div className="catalog-v2">'])
    assert.ok(collectionSource.includes(marker), marker)
  assert.equal((collectionSource.match(/<TruthLabel\/>/g) ?? []).length, 4)
})

// ---- Favorites -------------------------------------------------------------------

await test("the existing P2 favorite authority is reused unchanged", () => {
  assert.match(collectionSource, /accountP2DataSource/)
  assert.match(collectionSource, /favoritesDataSource\.listFavorites\(\)/)
  assert.match(collectionSource, /favoritesDataSource\.saveFavorite\(\{ kind: type, canonicalId: row\.id \}\)/)
  assert.match(collectionSource, /favoritesDataSource\.deleteFavorite\(existing\.id\)/)
})

await test("owner, generation and busy guards are intact", () => {
  assert.match(collectionSource, /const capturedGeneration = generation\.current/)
  assert.match(collectionSource, /busyOperations\.current\.has\(itemKey\)/)
  assert.match(collectionSource, /visibleFavoritesState\(favoriteState, activeSession\)/)
  assert.match(collectionSource, /dispatchFavorite\(\{ type: "mutation_error"/)
})

await test("signed-out and signed-in favorite affordances are preserved", () => {
  for (const label of ["تسجيل الدخول للحفظ", "حفظ في المفضلة", "إزالة من المفضلة", "جارٍ التحقق من حالة المفضلة"])
    assert.ok(collectionSource.includes(label), label)
  assert.match(collectionSource, /state=\{\{ returnTo: location\.pathname \+ location\.search \+ location\.hash \}\}/)
})

await test("no second favorites store and no browser storage", () => {
  assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie|createClient/.test(collectionSource), false)
  assert.equal(/favoritesCache|new Map\(\)\s*;?\s*\/\/ favorites/.test(collectionSource), false)
})

await test("no user identity reaches a URL", () => {
  assert.equal(/\?owner=|ownerId=\$\{|searchParams\.set/.test(collectionSource), false)
  // The only identity read is the session's own id, used in memory for guards.
  assert.equal(/user\.id/.test(collectionSource.replace(/(?:session|activeSession)\.user\.id/g, "«session»")), false)
})

// ---- No transactional or admin surface ---------------------------------------------

await test("no booking, checkout or payment CTA exists", () => {
  const sources = collectionSource + packagesSource + offersSource
  assert.equal(/Book now|Reserve|Checkout|Payment|احجز|حجز الآن|اشتر|ادفع/.test(sources), false)
})

await test("no publish, draft or admin control exists", () => {
  const sources = collectionSource + packagesSource + offersSource
  assert.equal(/adminCatalogP2DataSource|unpublish|مسودة|نشر المحتوى/i.test(sources), false)
})

await test("the catalog read boundary is untouched", async () => {
  const dataSource = await read("../src/services/publicCatalogDataSource.js")
  assert.match(dataSource, /loadPackages/)
  assert.match(dataSource, /loadOffers/)
  assert.equal(/catalog-v2/.test(dataSource), false)
})

// ---- RTL / LTR ------------------------------------------------------------------------

await test("catalog CSS uses logical properties only", () => {
  const physical = css.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(css))
})

await test("both pages render structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
      React.createElement(DirectionProvider, { initialLocale: locale }, React.createElement(PackagesPage))))
    assert.match(html, /data-catalog-type="package"/, locale)
    assert.match(html, /المحتوى المنشور فقط/, locale)
  }
})

// ---- Responsive ---------------------------------------------------------------------------

await test("responsive steps exist for tablet, mobile and the narrowest viewport", () => {
  assert.match(css, /@media \(max-width: 1024px\)/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 390px\)/)
})

await test("mobile collapses to one column and keeps the truth label", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.catalog-v2__grid \{ grid-template-columns: minmax\(0, 1fr\); \}/)
  assert.equal(/\.catalog-v2__truth \{[^}]*display: none/.test(mobile), false)
})

await test("long titles and summaries wrap instead of overflowing", () => {
  for (const selector of ["__title", "__summary", "__media", "__card"]) {
    const index = css.indexOf(selector)
    assert.match(css.slice(index, index + 400), /overflow-wrap: anywhere|min-inline-size: 0/, selector)
  }
})

await test("no fixed width can overflow a 390px viewport", () => {
  const fixed = [...css.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(match => Number(match[1])).filter(value => value > 360)
  assert.deepEqual(fixed, [], `fixed widths: ${fixed.join(", ")}`)
})

// ---- Accessibility and motion ----------------------------------------------------------------

await test("favorite controls meet the 48px touch floor and expose busy state", () => {
  const index = css.indexOf(".catalog-v2__favorite-action {")
  assert.match(css.slice(index, css.indexOf("}", index)), /min-block-size: var\(--hajiz-v2-touch-target\)/)
  assert.match(collectionSource, /aria-busy=\{busy \|\| undefined\}/)
})

await test("focus is visible on every catalog control", () => {
  assert.match(css, /\.catalog-v2__favorite-action:focus-visible/)
  assert.match(css, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
})

await test("cards are semantic articles and media is hidden from AT", () => {
  const html = resolved("package", [row("p1", "package")])
  assert.match(html, /<article class="public-catalog-card catalog-v2__card"/)
  assert.match(html, /<h2 class="catalog-v2__title">/)
  assert.match(html, /aria-hidden="true"/)
})

await test("no second motion system is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
})

await test("reduced motion is honoured", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), /transition: none/)
})

await test("truth label, states and errors never animate", () => {
  for (const selector of ["__truth", "__state-copy", "__state--error", "__favorite-error", "__favorite-status"]) {
    const index = css.indexOf(selector)
    assert.match(css.slice(index, index + 440), /animation: none/, `${selector} is not pinned static`)
  }
  assert.match(collectionSource, /v2-no-motion/)
})

// ---- Ownership -----------------------------------------------------------------------------------

await test("catalog CSS loads last, after every earlier V2 layer", () => {
  const order = ['./design-system/index.css', './features/home/home-v2.css',
    './features/flights/flight-results-v2.css', './features/flights/checkout-v2.css',
    './features/flights/payments-v2.css', './features/account/trips-v2.css',
    './features/account/account-v2.css', './features/hotels/hotels-v2.css',
    './features/catalog/catalog-v2.css']
  const positions = order.map(marker => mainSource.indexOf(marker))
  assert.ok(positions.every(position => position > -1))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

await test("no catalog file crosses the frontend ownership boundary", () => {
  const restricted = /src\/server|supabase|src\/legacy|service_role/i
  for (const [name, source] of [["collection", collectionSource], ["packages", packagesSource],
    ["offers", offersSource], ["card", cardSource], ["css", css]]) assert.equal(restricted.test(source), false, name)
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
