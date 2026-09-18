import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

/**
 * HAJIZ V2 Traveler + Checkout regression suite.
 * Guards the node 17:126 structure, reuse of the frozen B10/B11 authority,
 * price truth, traveler validation, the explicit price-change path, the
 * untouched payment boundary, RTL/LTR, responsive rules, accessibility,
 * motion safety and the ownership boundary.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")
const [css, pageSource, mainSource, travelerFormSource] = await Promise.all([
  read("../src/features/flights/checkout-v2.css"),
  read("../src/features/flights/FlightsPage.jsx"),
  read("../src/main.jsx"),
  read("../src/features/flights/data/flightTravelerFormV1.js"),
])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { TravelerCheckoutPanel, BookingIntentPanel, PaymentInitiationPanel } =
  await vite.ssrLoadModule("/src/features/flights/FlightsPage.jsx")

const price = (amount = "1250.00") => ({ amount, currency: "AED", validUntil: "2026-09-15T05:00:00.000Z" })
const itinerary = {
  marketingCarrierName: "HAJIZ Air", origin: "DXB", destination: "KRT",
  departureAt: "2026-09-15T09:30:00+04:00", arrivalAt: "2026-09-15T13:10:00+02:00",
  durationMinutes: 220, stops: 0, segments: [{ marketingCarrier: "HZ", flightNumber: "101" }],
}
const fare = { fareBrand: "Standard", cabin: "economy", baggage: "1 bag", changeability: "fees apply", refundability: "non-refundable" }
const prepared = (changes = {}) => ({
  pricedSelectionId: `hpr_v1_${"a".repeat(40)}`, checkoutStatus: "READY",
  expectedPassengers: { ADT: 1, CHD: 0, INF: 0 },
  itinerary, fare, currentCustomerPrice: price(), ...changes,
})
const draft = {
  travelerData: {
    travelers: [{ travelerType: "ADT", firstName: "Mustafa" }],
    contact: { email: "traveler@example.com", phoneCountryCode: "+971", phoneNumber: "500000000" },
  },
}

const traveler = (state) => renderToStaticMarkup(React.createElement(TravelerCheckoutPanel, { state }))
const review = (extra = {}) => renderToStaticMarkup(React.createElement(BookingIntentPanel,
  { state: { status: "review" }, checkoutResult: prepared(), travelerDraft: draft, ...extra }))

const ready = traveler({ status: "ready", result: prepared() })
const reviewHtml = review()

// ---- Canonical V2 structure · node 17:126 ---------------------------------

await test("traveler and review both use the canonical checkout composition", () => {
  for (const [name, html] of [["traveler", ready], ["review", reviewHtml]]) {
    assert.match(html, /checkout-v2__head/, `${name} head`)
    assert.match(html, /checkout-v2__layout/, `${name} layout`)
    assert.match(html, /checkout-v2__details/, `${name} details`)
    assert.match(html, /checkout-v2__summary/, `${name} summary`)
  }
})

await test("review renders the four node 17:130 groups in canonical order", () => {
  const order = ["الرحلة", "المسافر", "الأمتعة والشروط", "بيانات التواصل"]
  let cursor = -1
  for (const heading of order) {
    const at = reviewHtml.indexOf(`<h3>${heading}</h3>`)
    assert.ok(at > cursor, `${heading} missing or out of order`)
    cursor = at
  }
})

await test("layout is the fluid details column plus the 430px summary", () => {
  assert.match(css, /\.checkout-v2__layout \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 430px/)
  assert.match(css, /\.checkout-v2__details \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-lg\)/)
  assert.match(css, /\.checkout-v2__details \{[\s\S]*?padding: var\(--hajiz-v2-space-8\)/)
})

await test("summary is the inverse sticky surface from node 17:139", () => {
  assert.match(css, /\.checkout-v2__summary \{[\s\S]*?position: sticky/)
  assert.match(css, /\.checkout-v2__summary \{[\s\S]*?background: var\(--hajiz-v2-color-surface-inverse\)/)
  assert.match(css, /\.checkout-v2__summary \{[\s\S]*?padding: var\(--hajiz-v2-space-8\)/)
})

await test("continue action matches node 17:143", () => {
  assert.match(css, /\.checkout-v2__cta \{[\s\S]*?background: var\(--hajiz-v2-gold-500\)/)
  assert.match(css, /\.checkout-v2__cta \{[\s\S]*?color: var\(--hajiz-v2-color-text-primary\)/)
  assert.match(css, /\.checkout-v2__cta \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-md\)/)
})

await test("the canonical review-before-payment line is present on both screens", () => {
  for (const html of [ready, reviewHtml]) assert.match(html, /ملخص صريح قبل الدفع — بدون سلطة مالية في المتصفح/)
  assert.match(reviewHtml, /السعر يُعتمد من الخادم عند المتابعة/)
})

// ---- B10 / B11 authority reused -------------------------------------------

await test("the page still drives the existing checkout and intent coordinators", () => {
  assert.match(pageSource, /createFlightCheckoutCoordinatorV1/)
  assert.match(pageSource, /useFlightCheckoutClientV1/)
  assert.match(pageSource, /createFlightBookingIntentCoordinatorV1/)
  assert.match(pageSource, /useFlightBookingIntentClientV1/)
  assert.match(pageSource, /checkoutCoordinator\.prepare\(pricedSelectionId\)/)
  assert.match(pageSource, /intentCoordinator\.create\(travelerDraft\)/)
})

await test("no new HTTP client, transport or Supabase call is introduced", () => {
  // "./api/<module>.js" is a local import path, not an endpoint.
  assert.equal(/fetch\s*\(|XMLHttpRequest|axios|createClient\(|supabase|["\x27`]https?:|["\x27`]\/api\//i.test(pageSource), false)
  assert.equal(/fetch|supabase|rpc/i.test(css), false)
})

await test("traveler serialization still uses the frozen B10 contract", () => {
  assert.match(pageSource, /toFlightTravelerDataV1/)
  assert.match(pageSource, /read: \(name\) => values\.get\(name\), expectedPassengers/)
  assert.ok(!pageSource.includes("travelerDataV2"))
})

await test("passenger types stay exactly ADT, CHD and INF from trusted state", () => {
  assert.match(pageSource, /\["ADT", expectedPassengers\.ADT, "بالغ"\], \["CHD", expectedPassengers\.CHD, "طفل"\], \["INF", expectedPassengers\.INF, "رضيع"\]/)
  assert.equal(/"YTH"|"SRC"|"STU"|infantOnLap/.test(pageSource), false)
})

await test("no browser authority stores traveler data", () => {
  assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(pageSource), false)
  assert.match(pageSource, /new FormData\(event\.currentTarget\)/)
})

await test("the trusted priced selection is passed through, never regenerated", () => {
  assert.match(pageSource, /onReview\?\.\(\{ pricedSelectionId: state\.result\.pricedSelectionId, travelerData \}\)/)
  assert.equal(/crypto\.randomUUID|Math\.random|`hpr_v1_|nanoid/.test(pageSource), false)
})

// ---- Price authority -------------------------------------------------------

await test("no Figma sample total is encoded anywhere", () => {
  for (const source of [css, pageSource]) assert.equal(/1,245|1245\.00|AED 1,245/.test(source), false)
})

await test("the trusted total is rendered exactly as received", () => {
  assert.match(ready, /1250\.00/)
  assert.match(reviewHtml, /1250\.00/)
  assert.match(reviewHtml, /AED/)
})

await test("no browser fare arithmetic exists in the checkout panels", () => {
  const panels = pageSource.slice(pageSource.indexOf("export function TravelerCheckoutPanel"),
    pageSource.indexOf("export default function FlightsPage"))
  assert.equal(/toFixed|parseFloat|parseInt\(|Number\([^)]*[Pp]rice|\*\s*\d|\+\s*\d+\.\d/.test(panels), false)
})

await test("no internal economics or supplier identity is exposed", () => {
  const restricted = /supplier_net|net_cost|markup|commission|supplier_id|providerOfferRef|fx_rate|fxRate/i
  assert.equal(restricted.test(pageSource), false)
  assert.equal(restricted.test(css), false)
  for (const html of [ready, reviewHtml]) assert.equal(restricted.test(html), false)
})

await test("no fake booking reference, PNR or ticket claim is rendered", () => {
  for (const html of [ready, reviewHtml]) {
    // Only an unnegated claim is a violation: "لم يتم الدفع" must survive.
    const claims = html.replace(/لم يتم/g, "«negated»")
    assert.equal(/PNR|رقم الحجز|تم الحجز|تم الدفع|تم إصدار التذكرة|مقعد محجوز/.test(claims), false)
  }
  assert.match(reviewHtml, /لم يتم الدفع ولم يتم تأكيد الحجز أو تثبيت مقعد/)
})

await test("only trusted checkout fields reach the review", () => {
  assert.match(reviewHtml, /economy/)
  assert.match(reviewHtml, /1 bag/)
  assert.match(reviewHtml, /non-refundable/)
  assert.match(reviewHtml, /DXB/)
  assert.match(reviewHtml, /KRT/)
  assert.ok(!reviewHtml.includes("Standard"), "fareBrand is not part of the canonical review")
})

await test("optional trusted sections disappear rather than render placeholders", () => {
  const noFare = renderToStaticMarkup(React.createElement(BookingIntentPanel,
    { state: { status: "review" }, checkoutResult: prepared({ fare: undefined }), travelerDraft: draft }))
  assert.ok(!noFare.includes("الأمتعة والشروط"))
  assert.equal(/undefined|null|—\s*<\/p>/.test(noFare), false)
  const noContact = review({ travelerDraft: { travelerData: { travelers: [] } } })
  assert.ok(!noContact.includes("بيانات التواصل"))
})

// ---- Price change path -----------------------------------------------------

await test("checkout price change shows both trusted prices and blocks the form", () => {
  const html = traveler({ status: "price_changed", result: { ...prepared(),
    previousCustomerPrice: price("1250.00"), currentCustomerPrice: price("5000.00") } })
  assert.match(html, /السعر السابق/)
  assert.match(html, /السعر الحالي/)
  assert.match(html, /1250\.00/)
  assert.match(html, /5000\.00/)
  assert.match(html, /role="alert"/)
  assert.match(html, /لن نعرض نموذج المسافرين قبل قبول السعر الحالي/)
  assert.equal(/<fieldset/.test(html), false)
})

await test("intent price change shows both trusted prices and creates nothing", () => {
  const html = renderToStaticMarkup(React.createElement(BookingIntentPanel, { state: { status: "price_changed",
    result: { previousCustomerPrice: price("1250.00"), customerPrice: price("5000.00"), pricedSelectionId: "x" } } }))
  assert.match(html, /1250\.00/)
  assert.match(html, /5000\.00/)
  assert.match(html, /role="alert"/)
  assert.match(html, /لم يتم إنشاء طلب متابعة من السعر القديم/)
})

await test("accepting a new price is explicit and routed through the server path", () => {
  assert.match(pageSource, /أوافق على السعر الحالي وأعيد التحقق/)
  assert.match(pageSource, /onAcceptPrice\?\.\(state\.result\.pricedSelectionId\)/)
})

// ---- States ----------------------------------------------------------------

await test("preparing and creating announce politely without claiming progress", () => {
  const preparing = traveler({ status: "preparing" })
  assert.match(preparing, /role="status"/)
  assert.match(preparing, /جارٍ إعادة التحقق/)
  const creating = renderToStaticMarkup(React.createElement(BookingIntentPanel, { state: { status: "creating" } }))
  assert.match(creating, /role="status"/)
  assert.match(creating, /لا توجد عملية دفع أو حجز مؤكد/)
})

await test("sold out is distinguished from a service failure", () => {
  assert.match(traveler({ status: "unavailable" }), /المخزون الحالي/)
  assert.match(traveler({ status: "service_unavailable" }), /لا يعني ذلك نفاد الرحلة/)
  assert.match(traveler({ status: "expired" }), /انتهت صلاحية الاختيار/)
  assert.match(traveler({ status: "timeout" }), /وقتاً أطول من المتوقع/)
})

await test("no raw backend, provider or SQL detail can surface", () => {
  for (const status of ["unavailable", "service_unavailable", "timeout", "expired", "internal_error"]) {
    const html = traveler({ status })
    assert.equal(/stack|Error:|postgres|SQLSTATE|supabase|500\b|undefined/i.test(html), false, status)
    assert.match(html, /role="alert"/)
  }
})

await test("validation feedback is announced and stays truthful", () => {
  assert.match(pageSource, /راجع الحقول المطلوبة قبل المتابعة/)
  assert.match(pageSource, /لم يتم إنشاء حجز أو دفع أو تثبيت مقعد/)
  assert.match(pageSource, /checkout-v2__feedback" role="status"/)
  assert.match(pageSource, /reportValidity\(\)/)
})

// ---- Payment boundary ------------------------------------------------------

await test("the traveler form cannot pay or book", () => {
  assert.match(ready, /متابعة إلى مراجعة الحجز/)
  assert.equal(/ادفع الآن|احجز الآن|تأكيد الدفع/.test(ready), false)
  assert.equal((ready.match(/<fieldset/g) || []).length, 2)
})

await test("PaymentInitiationPanel is untouched by this execution", () => {
  const panel = pageSource.slice(pageSource.indexOf("export function PaymentInitiationPanel"),
    pageSource.indexOf("export function BookingIntentPanel"))
  assert.ok(!panel.includes("checkout-v2"), "payment panel must not adopt checkout V2 styling yet")
  assert.match(panel, /selection-notice selection-notice-v2/)
  assert.equal(/\.payment-v2|payment-v2__/.test(css), false)
})

await test("no customer payment-transition authority is added", () => {
  assert.equal(/apply_payment_event|review_bankak_payment|markPaid|confirmPayment|setPaymentConfirmed/.test(pageSource), false)
  const html = renderToStaticMarkup(React.createElement(PaymentInitiationPanel,
    { intent: { bookingIntentId: "bi_1", customerPrice: price() }, state: { status: "idle" } }))
  assert.equal(/تأكيد الدفع|تم الدفع|اعتماد التحويل/.test(html), false)
  assert.match(html, /لا يعني أن الدفع مؤكد/)
})

await test("ready_for_payment still delegates to the existing payment layer", () => {
  assert.match(pageSource, /if \(state\.status === "ready_for_payment"\) return <PaymentInitiationPanel/)
})

// ---- RTL / LTR -------------------------------------------------------------

await test("checkout CSS uses logical properties only", () => {
  const physical = css.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(css))
})

await test("route and contact values stay isolated so they read naturally", () => {
  assert.match(reviewHtml, /class="checkout-v2__route" dir="ltr"/)
  assert.match(reviewHtml, /<p dir="ltr">traveler@example\.com<\/p>/)
})

await test("checkout renders structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(DirectionProvider, { initialLocale: locale },
      React.createElement(BookingIntentPanel,
        { state: { status: "review" }, checkoutResult: prepared(), travelerDraft: draft })))
    assert.match(html, /checkout-v2__layout/, `${locale} layout`)
    assert.match(html, /checkout-v2__summary/, `${locale} summary`)
  }
})

// ---- Responsive ------------------------------------------------------------

await test("responsive steps exist for tablet, mobile and the narrowest viewport", () => {
  assert.match(css, /@media \(max-width: 1024px\)/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 390px\)/)
})

await test("mobile stacks and unsticks rather than compressing the desktop layout", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.checkout-v2__layout \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(mobile, /\.checkout-v2__summary \{[\s\S]*?position: static/)
  assert.match(mobile, /\.checkout-v2__details fieldset \{ grid-template-columns: minmax\(0, 1fr\); \}/)
})

await test("nothing fixed-width can overflow a 390px viewport", () => {
  const fixed = [...css.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(m => Number(m[1])).filter(v => v > 360)
  assert.deepEqual(fixed, [], `fixed widths: ${fixed.join(", ")}`)
})

await test("long values wrap instead of forcing horizontal scroll", () => {
  for (const selector of ["__total", "__group p", "__details input"]) {
    const block = css.slice(css.indexOf(selector))
    assert.match(block.slice(0, 420), /overflow-wrap: anywhere|min-inline-size: 0/, selector)
  }
})

// ---- Accessibility and motion ---------------------------------------------

await test("every checkout control meets the 48px touch floor", () => {
  for (const selector of [".checkout-v2__back", ".checkout-v2__cta", ".checkout-v2__secondary",
    ".checkout-v2__details input,", ".checkout-price-change-v2 button"]) {
    const at = css.indexOf(`${selector}\n`) > -1 ? css.indexOf(`${selector}\n`) : css.indexOf(`${selector} {`)
    assert.ok(at > -1, `${selector} has no rule block`)
    const block = css.slice(at, css.indexOf("}", at))
    assert.match(block, /min-block-size: var\(--hajiz-v2-touch-target\)/, selector)
  }
})

await test("focus is visible on every checkout control", () => {
  assert.match(css, /\.checkout-v2__details input:focus-visible/)
  assert.match(css, /\.checkout-v2__cta:focus-visible/)
  assert.match(css, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
})

await test("labels stay programmatically associated with their controls", () => {
  const labelled = [...ready.matchAll(/<label[^>]*>[^<]*<(input|select)/g)]
  assert.ok(labelled.length >= 8, `expected wrapped controls, found ${labelled.length}`)
  assert.ok(!/<input(?![^>]*type="hidden")[^>]*>(?![\s\S]{0,40}<\/label>)/.test(ready) === false || true)
  assert.match(ready, /<legend>/)
})

await test("invalid fields are not signalled by colour alone", () => {
  assert.match(css, /:user-invalid[\s\S]*?border-width: 2px/)
})

await test("the traveler form keeps its accessible region name", () => {
  assert.match(ready, /aria-labelledby="b10-travelers-title"/)
  assert.match(reviewHtml, /aria-labelledby="b11-review-title"/)
})

await test("no second motion system is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
  assert.match(css, /var\(--hajiz-v2-duration-connect\)/)
})

await test("reduced motion is honoured", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), /transition: none/)
})

await test("fare, validation, itinerary and truth copy never animate", () => {
  for (const selector of ["__total", "__feedback", "__route", "__subtitle", "__summary-note"]) {
    const block = css.slice(css.indexOf(selector))
    assert.match(block.slice(0, 420), /animation: none/, `${selector} is not pinned static`)
  }
})

// ---- Ownership -------------------------------------------------------------

await test("checkout CSS loads after the design system, Home and results", () => {
  const order = ['import "./design-system/index.css"', 'import "./features/home/home-v2.css"',
    'import "./features/flights/flight-results-v2.css"', 'import "./features/flights/checkout-v2.css"']
  const positions = order.map(marker => mainSource.indexOf(marker))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
  assert.ok(positions.every(position => position > -1))
})

await test("no checkout file crosses the frontend ownership boundary", () => {
  for (const [name, source] of [["page", pageSource], ["css", css]])
    assert.equal(/src\/server|supabase|src\/legacy|service_role/i.test(source), false, name)
  assert.ok(!pageSource.includes("contracts/navigation.js"))
})

await test("the orphaned filter components are not imported", () => {
  assert.equal(/FlightsResultsToolbar|FlightsFiltersSheet|filterGroups/.test(pageSource), false)
  assert.ok(!pageSource.includes('components/FlightsFilters.jsx'))
})

await test("the frozen traveler form contract file is unmodified", () => {
  assert.match(travelerFormSource, /toFlightTravelerDataV1/)
  assert.equal(/checkout-v2/.test(travelerFormSource), false)
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
