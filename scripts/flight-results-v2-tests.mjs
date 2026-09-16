import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 Flight Results regression suite.
 * Guards the canonical V2 structure, reuse of the frozen search/reprice
 * authority, price and product truth, states, RTL/LTR, responsive behaviour,
 * motion safety, the accessibility floor and the ownership boundary.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")

const [css, pageSource, cardSource, sortSource, filtersSource, segmentSource, mainSource] =
  await Promise.all([
    read("../src/features/flights/flight-results-v2.css"),
    read("../src/features/flights/FlightsPage.jsx"),
    read("../src/features/flights/components/FlightOfferCard.jsx"),
    read("../src/features/flights/components/FlightsResultsSortBar.jsx"),
    read("../src/features/flights/components/FlightsResultsFiltersPanel.jsx"),
    read("../src/features/flights/components/FlightSegment.jsx"),
    read("../src/main.jsx"),
  ])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { default: FlightsPage, ResultsState, RepricePanel } =
  await vite.ssrLoadModule("/src/features/flights/FlightsPage.jsx")
const { FlightOfferCard } = await vite.ssrLoadModule("/src/features/flights/components/FlightOfferCard.jsx")
const { toFlightResultsViewModelV1 } =
  await vite.ssrLoadModule("/src/features/flights/data/flightResultsViewModelV1.js")

const itinerary = {
  marketingCarrierName: "HAJIZ Air", origin: "DXB", destination: "KRT",
  departureAt: "2026-09-15T09:30:00+04:00", arrivalAt: "2026-09-15T13:10:00+02:00",
  durationMinutes: 220, stops: 0,
  segments: [{ marketingCarrier: "HZ", flightNumber: "101", origin: "DXB", destination: "KRT", cabin: "economy" }],
}
const result = (changes = {}) => ({
  groups: [{
    groupId: "g1", recommendationAvailable: true, preferredAlternativeId: "opaque-one", itinerary,
    alternatives: [{
      alternativeId: "opaque-one",
      fare: { cabin: "economy", baggage: "1 bag", changeability: "fees apply", refundability: "non-refundable" },
      price: { amount: "1250.00", currency: "AED", validUntil: "2026-09-15T03:00:00.000Z" },
      recommended: true,
    }],
    ...changes,
  }],
})
const offer = toFlightResultsViewModelV1(result())[0]
const card = props => renderToStaticMarkup(React.createElement(FlightOfferCard, { offer, ...props }))
const page = renderToStaticMarkup(React.createElement(MemoryRouter,
  { initialEntries: ["/flights?from=DXB&to=KRT"] }, React.createElement(FlightsPage)))

// ---- Canonical V2 structure · node 17:2 -----------------------------------

await test("results page renders the canonical V2 layout", () => {
  assert.match(page, /flights-result-header-v2/)
  assert.match(page, /flights-layout-v2/)
  assert.match(page, /flight-filters-v2/)
  assert.match(page, /flights-results-v2__list/)
})

await test("layout is the 300px rail plus fluid result column from node 17:9", () => {
  assert.match(css, /\.flights-layout-v2 \{[\s\S]*?grid-template-columns: 300px minmax\(0, 1fr\)/)
  assert.match(css, /\.flights-layout-v2 \{[\s\S]*?gap: var\(--hajiz-v2-space-6\)/)
})

await test("result card matches the node 17:21 geometry", () => {
  assert.match(css, /\.flight-result-card-v2 \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-lg\)/)
  assert.match(css, /\.flight-result-card-v2 \{[\s\S]*?padding: var\(--hajiz-v2-space-6\)/)
  assert.match(css, /--flight-card-shadow: 0 4px 16px 0 rgb\(10 29 47 \/ 6%\)/)
})

await test("price block matches node 17:26", () => {
  assert.match(css, /\.flight-result-card-v2__price \{[\s\S]*?inline-size: 260px/)
  assert.match(css, /\.flight-result-card-v2__price \{[\s\S]*?background: var\(--hajiz-v2-color-surface-subtle\)/)
  assert.match(css, /\.flight-result-card-v2__price \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-md\)/)
})

await test("the global header is not reimplemented on this page", () => {
  assert.ok(!/17:3|Compact Header|site-header|v2-header/.test(pageSource))
  assert.ok(!/\.v2-header|\.site-header/.test(css))
})

// ---- Price authority ------------------------------------------------------

await test("no Figma sample fare is encoded anywhere", () => {
  for (const source of [css, pageSource, cardSource, sortSource, filtersSource]) {
    assert.equal(/1,245|1245\.00|AED 980|\b980\.00\b/.test(source), false)
  }
})

await test("the card renders only the trusted fare it was handed", () => {
  const html = card()
  assert.match(html, /1250\.00/)
  assert.match(html, /AED/)
})

await test("no browser-side fare arithmetic exists in the card", () => {
  assert.equal(/Number\(|parseFloat|parseInt|toFixed|\*\s*\d|\/\s*\d|\+\s*offer\./.test(cardSource), false)
})

await test("no internal economics or supplier identity is exposed", () => {
  const restricted = /supplier_net|net_cost|markup|commission|supplier_id|providerOfferRef|fx_rate|rawPrice/i
  for (const source of [cardSource, sortSource, filtersSource, css]) assert.equal(restricted.test(source), false)
  assert.equal(restricted.test(card()), false)
})

await test("no fake PNR or fabricated trip facts are rendered", () => {
  const fabricated = /PNR|رقم الحجز|aircraft|terminal|البوابة|مقعد متاح|المقاعد المتبقية/i
  assert.equal(fabricated.test(card()), false)
  assert.equal(/PNR|aircraft|terminal/i.test(cardSource), false)
  // Refundability IS trusted data from the fare, so it must survive.
  assert.match(card(), /non-refundable/)
})

await test("the card invents no field the view model does not carry", () => {
  const model = Object.keys(offer)
  for (const key of ["alternativeId", "sellingAmount", "currency", "stops", "duration", "baggage", "cabin"])
    assert.ok(model.includes(key), `view model lost ${key}`)
  assert.ok(!cardSource.includes("fareBrand"))
})

// ---- Search and reprice authority reused ----------------------------------

await test("the page still uses the existing search coordinator and client", () => {
  assert.match(pageSource, /createFlightSearchCoordinatorV1/)
  assert.match(pageSource, /useFlightSearchClientV1/)
  assert.match(pageSource, /mapFlightSearchRequestV1/)
  assert.match(pageSource, /toFlightResultsViewModelV1/)
})

await test("the page still uses the existing reprice coordinator and client", () => {
  assert.match(pageSource, /createFlightRepriceCoordinatorV1/)
  assert.match(pageSource, /useFlightRepriceClientV1/)
  assert.match(pageSource, /repriceCoordinator\.select\(\{ alternativeId/)
})

await test("no second HTTP client or transport is introduced", () => {
  for (const [name, source] of [["card", cardSource], ["sort", sortSource], ["filters", filtersSource]]) {
    assert.equal(/fetch\(|XMLHttpRequest|axios|createClient|new WebSocket|\/api\//.test(source), false,
      `${name} owns transport`)
  }
  assert.equal(/fetch\(|axios|createClient/.test(pageSource), false)
})

await test("selection hands back the opaque alternativeId untouched", () => {
  assert.match(cardSource, /onSelect\?\.\(offer\.alternativeId\)/)
  assert.equal(/crypto\.randomUUID|Math\.random|Date\.now\(\)|`hca_|nanoid/.test(cardSource), false)
})

await test("selection routes through reprice, never straight to checkout", () => {
  assert.match(pageSource, /onSelect=\{selectAlternative\}/)
  assert.match(pageSource, /const selectAlternative = \(alternativeId\) => \{ clearIntent\(\); return repriceCoordinator/)
  assert.ok(!/onSelect=\{prepareCheckout\}/.test(pageSource))
})

await test("the frozen B8 CTA and emphasis contracts still hold", () => {
  assert.match(card(), /<button[^>]*>اختيار<\/button>/)
  assert.match(card(), /موصى به/)
  const plain = renderToStaticMarkup(React.createElement(FlightOfferCard,
    { offer: { ...offer, recommended: false } }))
  assert.doesNotMatch(plain, /موصى به/)
})

await test("segment order origin, connector, destination is preserved", () => {
  const html = card()
  const origin = html.indexOf("segment-origin")
  const line = html.indexOf("segment-line", origin)
  const destination = html.indexOf("segment-destination", line)
  assert.ok(origin > -1 && origin < line && line < destination)
})

await test("the route line keeps its carried wall clocks", () => {
  const html = card()
  assert.match(html, /09:30/)
  assert.match(html, /13:10/)
  assert.match(html, /DXB/)
  assert.match(html, /KRT/)
})

// ---- Sorting and filters --------------------------------------------------

await test("no sort control is rendered, because no supported sort exists", () => {
  assert.equal(/<button|<select|<input|onClick|onChange/.test(sortSource), false)
  assert.match(page, /flight-sort-v2|flights-results-v2__list/)
})

await test("no filter control is rendered, because filtering is unavailable", () => {
  assert.equal(/<button|<select|<input|onClick|onChange|checkbox|range/.test(filtersSource), false)
})

await test("both unavailable affordances say so in plain language", () => {
  assert.match(sortSource, /غير متاحة بعد/)
  assert.match(filtersSource, /غير متاحة بعد/)
  assert.match(page, /التصفية غير متاحة بعد/)
})

await test("canonical server order is presented as the active order", () => {
  assert.match(sortSource, /الترتيب المعتمد من الخادم/)
  assert.match(sortSource, /aria-current="true"/)
})

await test("server ranking is never reordered in the browser", () => {
  assert.equal(/\.sort\(|\.reverse\(|localeCompare/.test(pageSource), false)
  assert.equal(/\.sort\(|\.reverse\(/.test(cardSource + sortSource + filtersSource), false)
})

// ---- States ---------------------------------------------------------------

await test("loading uses V2 skeletons sized to the real card", () => {
  const html = renderToStaticMarkup(React.createElement(ResultsState, { state: { status: "loading" } }))
  assert.match(html, /v2-skeleton/)
  assert.match(html, /role="status"/)
  assert.match(html, /aria-hidden="true"/)
  assert.match(css, /\.flight-loading-v2 \.flight-card-skeleton \{[\s\S]*?block-size: 148px/)
})

await test("empty state is truthful and offers no synthetic alternative", () => {
  const html = renderToStaticMarkup(React.createElement(ResultsState, { state: { status: "empty" } }))
  assert.match(html, /ما لقينا رحلات مطابقة لبحثك/)
  assert.match(html, /role="status"/)
  assert.equal(/رحلات مقترحة|بدلاً من ذلك|قد يعجبك/.test(html), false)
})

await test("the customer can always revise the search from the results page", () => {
  assert.match(page, /تعديل/)
  assert.match(pageSource, /onEdit=\{\(\) => navigate\("\/"/)
})

await test("error state is sanitized and retryable", () => {
  const html = renderToStaticMarkup(React.createElement(ResultsState,
    { state: { status: "internal_error" }, onRetry() {} }))
  assert.match(html, /role="alert"/)
  assert.match(html, /إعادة المحاولة/)
  assert.equal(/stack|Error:|supabase|postgres|500|SQLSTATE/i.test(html), false)
})

await test("reprice in progress is announced and the CTA cannot double fire", () => {
  const html = renderToStaticMarkup(React.createElement(RepricePanel, { state: { status: "repricing" } }))
  assert.match(html, /role="status"/)
  assert.match(html, /جارٍ التحقق/)
  const busy = card({ selecting: true })
  assert.match(busy, /aria-busy="true"/)
  assert.match(busy, /disabled=""/)
})

await test("unavailable and expired offers fail honestly with no substitution", () => {
  for (const [status, copy] of [["unavailable", /لم يعد هذا الخيار متاحاً/], ["expired", /انتهت صلاحية هذا الاختيار/]]) {
    const html = renderToStaticMarkup(React.createElement(RepricePanel, { state: { status } }))
    assert.match(html, copy)
    assert.match(html, /role="alert"/)
    assert.match(html, /أعد اختيار الرحلة/)
  }
})

await test("a stale fare is never carried past a reprice failure", () => {
  const html = renderToStaticMarkup(React.createElement(RepricePanel, { state: { status: "unavailable" } }))
  assert.equal(/1250\.00|AED/.test(html), false)
})

// ---- RTL / LTR ------------------------------------------------------------

await test("flight results CSS uses logical properties only", () => {
  const physical = css.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(css))
})

await test("codes, times and fares stay isolated so they read naturally in both directions", () => {
  assert.match(segmentSource, /dir="ltr"/)
  assert.match(card(), /class="latin-text" dir="ltr"/)
  assert.match(card(), /<b dir="ltr">/)
})

await test("results render structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter,
      { initialEntries: ["/flights?from=DXB&to=KRT"] },
      React.createElement(DirectionProvider, { initialLocale: locale }, React.createElement(FlightsPage))))
    assert.match(html, /flights-layout-v2/, `${locale} layout missing`)
    assert.match(html, /flight-filters-v2/, `${locale} rail missing`)
  }
})

// ---- Responsive -----------------------------------------------------------

await test("responsive steps exist for tablet, mobile and the narrowest viewport", () => {
  assert.match(css, /@media \(max-width: 1024px\)/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 390px\)/)
})

await test("mobile stacks rather than compressing the desktop card", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.flights-layout-v2 \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(mobile, /\.flight-result-card-v2 \{[\s\S]*?flex-direction: column/)
  assert.match(mobile, /\.flight-result-card-v2__price \{[\s\S]*?inline-size: 100%/)
})

await test("result column can shrink, so long routes cannot force overflow", () => {
  assert.match(css, /\.flights-results-v2__list \{[\s\S]*?min-inline-size: 0/)
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\)/)
  assert.match(css, /\.flight-result-card-v2__itinerary \{[\s\S]*?min-inline-size: 0/)
})

await test("no fixed width can overflow a 390px viewport", () => {
  const fixed = [...css.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(m => Number(m[1])).filter(v => v > 360)
  assert.deepEqual(fixed, [], `fixed widths: ${fixed.join(", ")}`)
})

// ---- Motion and accessibility ---------------------------------------------

await test("no second motion system is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
  assert.match(css, /var\(--hajiz-v2-duration-move\)/)
})

await test("reduced motion is honoured", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), /transition: none/)
})

await test("fare, route emphasis and error copy never animate", () => {
  for (const selector of ["__amount", "__price-note", "__eyebrow", "flight-sort-v2__note", "flight-filters-v2__note"]) {
    const block = css.slice(css.indexOf(selector))
    assert.match(block.slice(0, 340), /animation: none/, `${selector} is not pinned static`)
  }
  assert.match(css, /\.selection-notice-v2\[role="alert"\] \{[\s\S]*?animation: none/)
})

await test("every results control meets the 48px touch floor", () => {
  assert.match(css, /\.flight-result-card-v2__select/)
  assert.match(cardSource, /v2-button v2-button--primary/)
  for (const selector of [".flights-page .flights-summary button", ".flight-results-state-v2 button"]) {
    const block = css.slice(css.indexOf(selector))
    assert.match(block.slice(0, 320), /min-block-size: var\(--hajiz-v2-touch-target\)/, `${selector}`)
  }
})

await test("focus is visible on every results control", () => {
  assert.match(css, /\.flight-result-card-v2__select:focus-visible/)
  assert.match(css, /\.flight-results-state-v2 button:focus-visible/)
  assert.match(css, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
})

await test("the canonical order is not signalled by colour alone", () => {
  assert.match(css, /\.flight-sort-v2__active::after/)
  assert.match(sortSource, /aria-current/)
})

await test("headings are semantic and the rail is a labelled region", () => {
  assert.match(page, /<h1>/)
  assert.match(page, /<aside[^>]*aria-labelledby="flight-filters-v2-title"/)
  assert.match(page, /<h2 class="flight-filters-v2__title" id="flight-filters-v2-title">/)
})

await test("results region announces updates politely", () => {
  assert.match(page, /<main class="flights-results flights-results-v2" aria-live="polite">/)
})

// ---- Ownership ------------------------------------------------------------

await test("flight results CSS loads after the design system and Home", () => {
  const ds = mainSource.indexOf('import "./design-system/index.css"')
  const home = mainSource.indexOf('import "./features/home/home-v2.css"')
  const flights = mainSource.indexOf('import "./features/flights/flight-results-v2.css"')
  assert.ok(ds < home && home < flights)
})

await test("no flight presentation file crosses the frontend ownership boundary", () => {
  for (const [name, source] of [["page", pageSource], ["card", cardSource],
    ["sort", sortSource], ["filters", filtersSource], ["css", css]]) {
    assert.equal(/src\/server|supabase|src\/legacy|service_role/i.test(source), false, name)
  }
})

await test("the navigation contract is untouched by this page", () => {
  assert.ok(!pageSource.includes("contracts/navigation.js"))
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
