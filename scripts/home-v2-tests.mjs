import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 Home regression suite.
 * Guards the canonical Figma structure, reuse of the existing flight search
 * contract, the public catalog boundary, product truth, RTL/LTR, responsive
 * behaviour, motion safety and the accessibility floor.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")

const [homeCss, pageSource, heroSource, searchSource, trustSource, catalogSource, mainSource] =
  await Promise.all([
    read("../src/features/home/home-v2.css"),
    read("../src/features/home/HomePage.jsx"),
    read("../src/features/home/components/HomeHero.jsx"),
    read("../src/features/home/components/HomeSearch.jsx"),
    read("../src/features/home/components/TrustStrip.jsx"),
    read("../src/features/home/components/HomePublicCatalogSection.jsx"),
    read("../src/main.jsx"),
  ])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { default: HomePage } = await vite.ssrLoadModule("/src/features/home/HomePage.jsx")
const home = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(HomePage)))

// ---- Canonical structure --------------------------------------------------

await test("Home renders the canonical section order from node 14:24", () => {
  const order = ["home-hero-v2", "home-search-v2", "home-trust-strip", "home-discovery-v2"]
  let cursor = -1
  for (const marker of order) {
    const at = home.indexOf(marker)
    assert.ok(at > cursor, `${marker} is out of canonical order`)
    cursor = at
  }
})

await test("hero, search, trust and discovery all carry V2 markers", () => {
  assert.match(home, /data-home-hero="v2"/)
  assert.match(home, /home-search-v2/)
  assert.match(home, /data-home-trust="v2"/)
  assert.match(home, /data-home-public-catalog="offer"/)
  assert.match(home, /data-home-public-catalog="package"/)
})

// ---- Hero · nodes 14:38 / 16:39 -------------------------------------------

await test("hero carries the canonical desktop and mobile copy", () => {
  assert.match(home, /من هنا تبدأ الحكاية\./)
  assert.match(home, /رحلات وفنادق وتجارب، موصولة في مكان واحد\./)
  assert.match(home, /اكتشف العالم بثقة، واترك التفاصيل لحاجز\./)
  assert.match(home, /العالم أقرب\./)
  assert.match(home, /رحلتك تبدأ من حاجز\./)
})

await test("hero ships no substitute stock photography", () => {
  assert.ok(!/\.(jpg|jpeg|png|webp|avif)/i.test(heroSource), "hero must not reference a raster asset")
  assert.match(homeCss, /--home-hero-image, none/)
})

await test("hero overlay is the canonical navy atmosphere", () => {
  assert.match(homeCss, /rgb\(10 29 47 \/ 92%\)/)
  const mobile = homeCss.slice(homeCss.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /rgb\(10 29 47 \/ 96%\)/)
})

await test("hero image and overlay stay out of the accessibility tree", () => {
  assert.match(home, /home-hero-v2__image" aria-hidden="true"/)
  assert.match(home, /home-hero-v2__overlay" aria-hidden="true"/)
})

await test("hero uses the shared Network Mark, not a new one", () => {
  assert.match(heroSource, /design-system\/primitives\/NetworkMark\.jsx/)
  assert.ok(!heroSource.includes("<svg"), "hero must not hand-author brand geometry")
  assert.match(home, /v2-network-mark/)
})

// ---- Signature Search · node 15:2 -----------------------------------------

await test("Signature Search reuses the existing flight target builder", () => {
  assert.match(searchSource, /buildSearchTarget/)
  assert.match(searchSource, /from "\.\.\/data\/searchTarget\.js"/)
  assert.match(searchSource, /from "\.\.\/data\/locations\.js"/)
  assert.match(searchSource, /from "\.\.\/data\/homeData\.js"/)
})

await test("no second search architecture is introduced", () => {
  assert.ok(!/fetch\(|axios|createClient|supabase/i.test(searchSource), "Home search must not own transport")
  assert.ok(!/useFlightSearchClient|flightSearchTransport/.test(searchSource), "Home must not bind a flight client")
  assert.ok(!/\/api\//.test(searchSource))
})

await test("Home search still navigates through the canonical route transition", () => {
  assert.match(searchSource, /useNavigate/)
  assert.match(searchSource, /navigate\(buildSearchTarget\(/)
  assert.match(searchSource, /state: \{ source: "home", synthetic: true \}/)
})

await test("passenger, cabin, date and location models are unchanged", () => {
  assert.match(searchSource, /DEFAULT_FLIGHT_LOCATIONS/)
  assert.match(searchSource, /locationSearchValue/)
  assert.match(searchSource, /createCustomLocation/)
  assert.match(searchSource, /travelers: "1"/)
  assert.match(searchSource, /tripType/)
  assert.match(home, /type="date"/)
})

await test("service tabs remain exactly the four live services", () => {
  const tabs = [...home.matchAll(/data-service="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(tabs, ["flights", "hotels", "insurance", "packages"])
})

await test("Signature Search geometry matches node 15:2", () => {
  assert.match(homeCss, /\.home-search-v2 \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-lg\)/)
  assert.match(homeCss, /\.home-search-v2 \{[\s\S]*?box-shadow: var\(--hajiz-v2-shadow-lg\)/)
  assert.match(homeCss, /\.home-search-v2 \{[\s\S]*?padding: var\(--hajiz-v2-space-8\)/)
  assert.match(homeCss, /\.home-search-v2__fields \{[\s\S]*?gap: var\(--hajiz-v2-space-3\)/)
  assert.match(homeCss, /\.home-search-v2__field \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-md\)/)
})

await test("search carries the canonical price-transparency note from node 15:23", () => {
  assert.match(home, /عرض مباشر للسعر النهائي قبل المتابعة/)
  assert.match(homeCss, /\.home-search-v2__note \{[\s\S]*?animation: none/)
})

await test("disabled return date cannot reflow the field row", () => {
  assert.match(searchSource, /data-disabled=\{returnDisabled/)
  assert.match(homeCss, /\.home-search-v2__field\[data-disabled="true"\] \{ opacity/)
  assert.ok(!/\[data-disabled="true"\] \{[^}]*display: none/.test(homeCss))
})

// ---- Trust strip · node 16:2 ----------------------------------------------

await test("trust strip uses the exact Figma wording", () => {
  for (const copy of ["متصل بالعالم", "رحلة واحدة، كل التفاصيل", "موثوق بأمان",
    "صلاحيات واضحة وبيانات محمية", "سريع وسهل", "خطوات أقل وقرارات أوضح",
    "كل خدمات السفر", "رحلات وفنادق وتجارب"]) assert.match(home, new RegExp(copy))
})

await test("trust strip makes no unsupported capability claim", () => {
  assert.equal(
    /ضمان|مضمون|تذكرة مؤكدة|مخزون مباشر|guaranteed|live inventory|PSP|production/i.test(trustSource),
    false)
})

await test("trust strip uses the inverse surface treatment", () => {
  assert.match(homeCss, /\.home-trust-strip \{[\s\S]*?background: var\(--hajiz-v2-color-surface-inverse\)/)
})

// ---- Discovery · nodes 16:15 / 16:19 --------------------------------------

await test("discovery keeps the public catalog as the only content authority", () => {
  assert.match(catalogSource, /publicCatalogDataSource/)
  assert.match(catalogSource, /dataSource\.loadPackages/)
  assert.match(catalogSource, /dataSource\.loadOffers/)
  assert.ok(!/p2|admin|service_role/i.test(catalogSource), "Home must not read private data")
})

await test("discovery renders loading, empty and error states truthfully", () => {
  assert.match(catalogSource, /جارٍ تحميل المحتوى المنشور/)
  assert.match(catalogSource, /لا توجد باقات منشورة متاحة حاليًا/)
  assert.match(catalogSource, /لا توجد عروض منشورة متاحة حاليًا/)
  assert.match(catalogSource, /تعذر تحميل المحتوى المنشور حاليًا/)
  assert.match(home, /role="status"/)
})

await test("discovery states never animate", () => {
  assert.match(catalogSource, /home-discovery-v2__error v2-no-motion/)
})

await test("discovery card media is the canonical gradient, not a fake photo", () => {
  assert.match(homeCss, /\.home-discovery-v2__media \{[\s\S]*?linear-gradient/)
  assert.match(homeCss, /var\(--hajiz-v2-navy-900\), var\(--hajiz-v2-gold-500\)/)
})

await test("discovery uses shared V2 primitives rather than new raw controls", () => {
  assert.match(catalogSource, /design-system\/primitives\/Badge\.jsx/)
  assert.match(catalogSource, /design-system\/primitives\/Spinner\.jsx/)
  assert.match(catalogSource, /design-system\/primitives\/Button\.jsx/)
})

await test("no fabricated availability or inventory reaches Home", () => {
  assert.match(home, /محتوى منشور فعليًا فقط/)
  assert.equal(/\d[\d,]*\s*(AED|SDG|USD)/.test(home), false)
})

// ---- Product truth --------------------------------------------------------

await test("Visas is not exposed anywhere on Home", () => {
  assert.equal(/تأشير|visa/i.test(home), false)
  assert.equal(/\/visas/.test(home), false)
})

await test("Insurance remains a live route on Home", () => {
  assert.match(home, /href="\/insurance"/)
  assert.match(home, /data-service="insurance"/)
})

await test("Home links only to routes the router already serves", () => {
  const targets = [...home.matchAll(/href="(\/[^"?]*)/g)].map(m => m[1])
  const allowed = new Set(["/", "/flights", "/hotels", "/insurance", "/packages", "/offers", "/partners"])
  for (const target of new Set(targets))
    assert.ok(allowed.has(target), `unexpected Home link target ${target}`)
})

await test("the navigation contract file is untouched by Home", () => {
  assert.ok(!pageSource.includes("contracts/navigation.js"))
  assert.ok(!searchSource.includes("contracts/navigation.js"))
})

// ---- Responsive · 1440 / 1024 / 768 / 390 ---------------------------------

await test("responsive rules exist for the tablet and mobile steps", () => {
  assert.match(homeCss, /@media \(max-width: 1024px\)/)
  assert.match(homeCss, /@media \(max-width: 900px\)/)
})

await test("mobile collapses the search to a single column and full-width action", () => {
  const mobile = homeCss.slice(homeCss.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.home-search-v2__fields \{ grid-template-columns: 1fr; \}/)
  assert.match(mobile, /\.home-search-v2__submit \{[\s\S]*?inline-size: 100%/)
  assert.match(mobile, /\.home-discovery-v2__grid \{ grid-template-columns: 1fr; \}/)
})

await test("mobile swaps to the canonical mobile hero copy", () => {
  assert.match(homeCss, /\.home-hero-v2 \.mobile-copy \{ display: none; \}/)
  const mobile = homeCss.slice(homeCss.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.home-hero-v2 \.desktop-copy \{ display: none; \}/)
  assert.match(mobile, /\.home-hero-v2 \.mobile-copy \{ display: block; \}/)
})

await test("no fixed width can overflow a 390px viewport", () => {
  const fixed = [...homeCss.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(m => Number(m[1]))
    .filter(value => value > 360)
  assert.deepEqual(fixed, [], `fixed widths found: ${fixed.join(", ")}`)
})

await test("grids are fluid rather than fixed-column", () => {
  for (const selector of ["home-search-v2__fields", "home-discovery-v2__grid", "home-trust-strip__inner"]) {
    const block = homeCss.slice(homeCss.indexOf(`.${selector} {`))
    assert.match(block.slice(0, 260), /repeat\(auto-fit, minmax\(|1fr/)
  }
})

await test("hero and search stack without overlap collapsing the search card", () => {
  assert.match(homeCss, /\.home-masthead-v2__search \{[\s\S]*?margin-block-start: calc\(-1 \* var\(--hajiz-v2-space-16\)\)/)
  assert.match(homeCss, /\.home-masthead-v2__search \{[\s\S]*?position: relative/)
})

// ---- RTL / LTR ------------------------------------------------------------

await test("Home CSS uses logical properties only", () => {
  const physical = homeCss.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(homeCss))
})

await test("Home renders structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
      React.createElement(DirectionProvider, { initialLocale: locale },
        React.createElement(HomePage))))
    assert.match(html, /home-hero-v2/, `${locale} hero missing`)
    assert.match(html, /home-search-v2/, `${locale} search missing`)
    assert.match(html, /home-trust-strip/, `${locale} trust strip missing`)
    assert.equal([...html.matchAll(/data-service="([^"]+)"/g)].length, 4)
  }
})

// ---- Motion ---------------------------------------------------------------

await test("Home reuses the Execution 02 motion foundation", () => {
  assert.ok(!/@keyframes/.test(homeCss), "Home must not define a second motion system")
  assert.match(homeCss, /var\(--hajiz-v2-duration-connect\)/)
  assert.match(homeCss, /var\(--hajiz-v2-duration-move\)/)
})

await test("Home honours reduced motion", () => {
  assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)/)
  const block = homeCss.slice(homeCss.indexOf("@media (prefers-reduced-motion: reduce)"))
  assert.match(block, /transform: none/)
  assert.match(block, /transition: none/)
})

await test("search labels and critical copy carry no animation", () => {
  assert.ok(!/\.home-search-v2__label[^}]*animation:/.test(homeCss))
  assert.ok(!/\.home-search-v2__value[^}]*animation:/.test(homeCss))
})

// ---- Accessibility --------------------------------------------------------

await test("search keeps its landmarks and labels", () => {
  assert.match(home, /aria-label="البحث عن خدمات السفر"/)
  assert.match(home, /role="tablist"/)
  assert.match(home, /aria-label="تبديل نقطة المغادرة والوصول"/)
  assert.match(home, /type="submit"/)
  assert.match(home, /aria-label="مدينة المغادرة"/)
  assert.match(home, /aria-label="مدينة الوصول"/)
})

await test("active service tab is not signalled by colour alone", () => {
  assert.match(home, /aria-selected="true"/)
  assert.match(homeCss, /\.home-search-v2__tab\.is-active::after/)
})

await test("every Home control meets the 48px touch floor", () => {
  for (const selector of ["home-search-v2__tab", "home-search-v2__value",
    "home-search-v2__swap", "home-search-v2__submit", "home-search-v2__trip button"]) {
    const block = homeCss.slice(homeCss.indexOf(`.${selector} {`))
    assert.match(block.slice(0, 420), /(?:min-)?block-size: var\(--hajiz-v2-touch-target\)/,
      `${selector} has no touch floor`)
  }
})

await test("focus is visible on every Home control", () => {
  assert.match(homeCss, /\.home-search-v2__value:focus-visible/)
  assert.match(homeCss, /\.home-search-v2__submit:focus-visible/)
  assert.match(homeCss, /\.home-discovery-v2__card:focus-visible/)
})

await test("trust strip is a labelled region with real headings", () => {
  assert.match(home, /aria-label="قيم حاجز"/)
  assert.match(home, /home-trust-strip__title/)
})

// ---- Ownership ------------------------------------------------------------

await test("Home CSS loads after the design system so V2 wins by order", () => {
  assert.ok(mainSource.indexOf('import "./design-system/index.css"') <
    mainSource.indexOf('import "./features/home/home-v2.css"'))
})

await test("no Home file crosses the frontend ownership boundary", async () => {
  const path = await import("node:path")
  const { fileURLToPath } = await import("node:url")
  const root = fileURLToPath(new URL("../src/features/home", import.meta.url))
  const files = []
  const walk = async dir => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (/\.(jsx?|css)$/.test(entry.name)) files.push(full)
    }
  }
  await walk(root)
  for (const file of files) {
    const source = await fs.readFile(file, "utf8")
    assert.equal(/src\/server|supabase|src\/legacy|service_role/i.test(source), false,
      `${path.basename(file)} crosses the frontend ownership boundary`)
  }
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
