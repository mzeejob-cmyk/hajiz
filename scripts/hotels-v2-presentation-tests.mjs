import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 Hotels presentation regression suite.
 * Guards the node 18:2 grammar, visible sandbox truth, the frozen H1/H2
 * boundary, canonical identity, absence of browser pricing authority and of
 * private supplier data, RTL, responsive rules, accessibility and motion.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")
const [css, pageSource, resultsSource, noticeSource, searchSource,
  roomsSource, guestSource, reviewSource, mainSource] = await Promise.all([
  read("../src/features/hotels/hotels-v2.css"),
  read("../src/features/hotels/HotelsPage.jsx"),
  read("../src/features/hotels/components/HotelResults.jsx"),
  read("../src/features/hotels/components/HotelSandboxNotice.jsx"),
  read("../src/features/hotels/components/HotelSearchPanel.jsx"),
  read("../src/features/hotels/components/RoomSelection.jsx"),
  read("../src/features/hotels/components/GuestDetails.jsx"),
  read("../src/features/hotels/components/HotelReview.jsx"),
  read("../src/main.jsx"),
])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { default: HotelsPage } = await vite.ssrLoadModule("/src/features/hotels/HotelsPage.jsx")
const { HOTEL_FIXTURES, PALM_ROOMS } = await vite.ssrLoadModule("/src/features/hotels/data/hotelCanonicalFixtures.js")

const at = entry => renderToStaticMarkup(React.createElement(MemoryRouter,
  { initialEntries: [entry] }, React.createElement(HotelsPage)))

const results = at("/hotels")
const rooms = at("/hotels?view=rooms&hotel=hjz_htl_palm_dubai&rate=hjz_rate_palm_deluxe_breakfast_flex")
const guest = at("/hotels?view=guest&hotel=hjz_htl_palm_dubai&rate=hjz_rate_palm_deluxe_breakfast_flex")
const review = at("/hotels?view=review&hotel=hjz_htl_palm_dubai&rate=hjz_rate_palm_deluxe_breakfast_flex")
const legacyAlias = at("/hotels?view=guest&hotel=palm-dubai&room=deluxe")
const screens = [["results", results], ["rooms", rooms], ["guest", guest], ["review", review]]

// ---- Canonical V2 grammar · node 18:2 -------------------------------------

await test("results render the canonical node 18:3 heading", () => {
  assert.match(results, /إقامة تشبه رحلتك/)
  assert.match(results, /hotels-v2__title/)
  assert.match(results, /فنادق في دبي/)
})

await test("the node 18:7 search panel is present with canonical fields", () => {
  for (const [field, label, value] of [["destination", "الوجهة", "دبي"],
    ["dates", "الوصول والمغادرة", "15–18 سبتمبر"], ["guests", "النزلاء والغرف", "2 بالغ · غرفة"]]) {
    assert.match(results, new RegExp(`data-search-field="${field}"`), field)
    assert.match(results, new RegExp(label), label)
    assert.match(results, new RegExp(value.replace(/[·]/g, "·")), value)
  }
  assert.match(results, /عرض النموذج/)
})

await test("hotel cards use the node 18:20 geometry and gradient media", () => {
  assert.match(css, /\.hotels-v2__card \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-lg\)/)
  assert.match(css, /\.hotels-v2__card \{[\s\S]*?padding: var\(--hajiz-v2-space-6\)/)
  assert.match(css, /\.hotels-v2__card-media \{[\s\S]*?block-size: 170px/)
  assert.match(css, /linear-gradient\(to inline-end, #254257, rgb\(212 162 58 \/ 70%\)\)/)
  assert.match(css, /\.hotels-v2__card-media \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-image\)/)
})

await test("the capability note uses the warning surface from node 18:4", () => {
  assert.match(css, /\.hotels-v2__capability \{[\s\S]*?background: var\(--hajiz-v2-color-surface-warning\)/)
  assert.match(css, /\.hotels-v2__capability \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-md\)/)
})

await test("no second token system or hotel shell is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
  assert.equal(/--hotel-[a-z-]+:\s*#|:root\s*\{/.test(css), false, "hotels must not define its own tokens")
  assert.equal(/AppShell|site-header|v2-header/.test(resultsSource + pageSource), false)
})

// ---- Sandbox truth · node 18:4 ---------------------------------------------

await test("the canonical sandbox note appears on every hotel screen", () => {
  for (const [name, html] of screens) {
    assert.match(html, /نموذج واجهة احترافي — الفنادق ما زالت ضمن Fixture \/ Offline \/ Sandbox boundary/, name)
    assert.match(html, /الحجز الحي، حجز الغرفة، والدفع للمورد غير مفعّلة في H2 حاليًا\./, name)
    assert.match(html, /data-hotel-sandbox="true"/, name)
  }
})

await test("every hotel card carries the node 18:23 sandbox line", () => {
  const lines = (results.match(/بيانات تجريبية واضحة · لا توفر حي/g) ?? []).length
  assert.equal(lines, HOTEL_FIXTURES.length)
})

await test("no live-availability or inventory claim is made", () => {
  for (const [name, html] of screens)
    assert.equal(/متاح الآن|live availability|توفر حي(?! )|inventory|متاح للحجز الفوري/i.test(
      html.replace(/لا توفر حي/g, "«negated»")), false, name)
})

await test("no hold, booking, payment or confirmation claim is made", () => {
  for (const [name, html] of screens) {
    const claims = html.replace(/لم يتم|غير موصولة|غير مفعّلة|لا يمثل/g, "«negated»")
    assert.equal(/room hold|غرفة محجوزة مؤقت|تم حجز الغرفة|تم تأكيد الحجز|تم الدفع|قسيمة/i.test(claims), false, name)
  }
})

await test("the review CTA stays truthfully unwired", () => {
  assert.match(review, /data-checkout-boundary="NOT_YET_WIRED"/)
  assert.match(review, /المتابعة للدفع — غير موصولة بعد/)
  assert.match(review, /disabled=""/)
  assert.match(review, /aria-disabled="true"/)
})

await test("the guest boundary copy is preserved", () => {
  assert.match(guestSource, /لم يتم إنشاء حجز أو عملية دفع أو حجز غرفة مؤقت/)
  assert.match(guestSource, /role="status" aria-live="polite"/)
  assert.match(guest, /data-checkout-boundary="presentation-only"/)
})

await test("no hold, booking or voucher capability is wired anywhere", () => {
  for (const [name, source] of [["page", pageSource], ["results", resultsSource], ["rooms", roomsSource],
    ["guest", guestSource], ["review", reviewSource], ["notice", noticeSource], ["search", searchSource]])
    assert.equal(/hold_room|create_booking|hotel_payment|voucher|cancelBooking|holdAvailable\s*=/.test(source), false, name)
})

// ---- Canonical identity and routing ----------------------------------------

await test("canonical hotel and rate ids are preserved", () => {
  assert.match(results, /data-canonical-hotel-id="hjz_htl_palm_dubai"/)
  assert.match(rooms, /data-canonical-hotel-id="hjz_htl_palm_dubai"/)
  for (const room of PALM_ROOMS) assert.match(rooms, new RegExp(`data-canonical-rate-id="${room.canonicalRateId}"`))
  assert.equal((rooms.match(/data-room-key=/g) ?? []).length, PALM_ROOMS.length)
})

await test("the legacy alias remains an input alias only", () => {
  assert.match(legacyAlias, /data-view="guest"/)
  assert.match(pageSource, /rawHotelKey === "palm-dubai" \? "hjz_htl_palm_dubai"/)
  // Canonical output URLs always carry the canonical id.
  assert.equal(/navigate\(`\/hotels\?view=[a-z]+&hotel=palm-dubai/.test(pageSource), false)
  assert.match(pageSource, /view=guest&hotel=hjz_htl_palm_dubai&rate=/)
})

await test("the hotels route is unchanged and no new hotel route is added", () => {
  for (const forbidden of ["/hotel-booking", "/hotel-payment", "/hotel-confirmation", "/visas"])
    assert.equal(pageSource.includes(forbidden), false, forbidden)
  assert.equal(/navigate\("\/(?!hotels)/.test(pageSource), false)
})

await test("HotelsPage routing was not modified by this execution", () => {
  assert.match(pageSource, /resolveHotel, resolveRoom/)
  for (const pii of ["MOHAMED", "AHMED", "phone", "email", "firstName", "lastName"])
    assert.equal(pageSource.includes(pii), false, pii)
})

// ---- Fixtures and pricing authority ------------------------------------------

await test("the frozen synthetic inventory is unchanged", () => {
  assert.equal(HOTEL_FIXTURES.length, 3)
  assert.equal(PALM_ROOMS.length, 3)
  assert.deepEqual(HOTEL_FIXTURES.map(hotel => hotel.key), ["palm-dubai", "marina-sky", "rawda-apartments"])
  for (const hotel of HOTEL_FIXTURES) assert.match(results, new RegExp(hotel.name), hotel.name)
})

await test("the result count reports the fixtures actually rendered", () => {
  assert.match(results, new RegExp(`${HOTEL_FIXTURES.length} فنادق تجريبية`))
  assert.equal(/32 فندق/.test(results), false, "a fabricated inventory count must not ship")
})

await test("every fixture renders exactly one card", () => {
  assert.equal((results.match(/data-presentation-fixture="synthetic"/g) ?? []).length, HOTEL_FIXTURES.length)
  assert.equal((results.match(/data-canonical-hotel-id="/g) ?? []).length, HOTEL_FIXTURES.length)
})

await test("exactly one actionable room CTA exists", () => {
  assert.equal((results.match(/عرض الغرف/g) ?? []).length, 1)
  assert.equal((results.match(/hotels-v2__rooms-button/g) ?? []).length, 1)
})

await test("the actionable room flow belongs to the supported fixture", () => {
  assert.match(resultsSource, /const ROOM_DETAIL_HOTEL_ID = "hjz_htl_palm_dubai"/)
  assert.match(resultsSource, /hotel\.canonicalHotelId === ROOM_DETAIL_HOTEL_ID/)
  assert.equal((results.match(/data-room-detail-available="true"/g) ?? []).length, 1)
  const supported = results.slice(results.indexOf('data-canonical-hotel-id="hjz_htl_palm_dubai"'))
  assert.match(supported.slice(0, supported.indexOf("</article>")), /عرض الغرف/)
})

await test("unsupported room-detail cards expose non-interactive truthful copy", () => {
  const unavailable = (results.match(/تفاصيل الغرف غير متاحة لهذا النموذج التجريبي\./g) ?? []).length
  assert.equal(unavailable, HOTEL_FIXTURES.length - 1)
  assert.equal((results.match(/data-room-detail-available="false"/g) ?? []).length, HOTEL_FIXTURES.length - 1)
})

await test("no control is created for an unsupported room-detail card", () => {
  for (const marker of ['data-room-detail="unavailable"']) {
    const at = results.indexOf(marker)
    assert.ok(at > -1, marker)
    const element = results.slice(results.lastIndexOf("<", at), results.indexOf(">", at) + 1)
    assert.match(element, /^<p /, "unavailable copy must be plain text")
    assert.equal(/<button|<a |href=|onclick/i.test(element), false)
  }
  assert.equal(/onClick=\{\(\) => onRooms/.test(resultsSource.replace(/roomDetailAvailable[\s\S]*?: /, "")), true)
})

await test("the obsolete single-hotel claim is gone", () => {
  assert.equal(/نعرض فندقًا واحدًا/.test(results), false)
  assert.equal(/نعرض فندقًا واحدًا/.test(resultsSource), false)
  assert.match(results, new RegExp(`${HOTEL_FIXTURES.length} فنادق تجريبية معروضة`))
  assert.match(results, /مسار تفاصيل الغرف متاح لنموذج فندق واحد فقط/)
})

await test("result copy stays derived from the fixture inventory", () => {
  assert.match(resultsSource, /\{HOTEL_FIXTURES\.length\} فنادق تجريبية معروضة/)
  assert.match(resultsSource, /\{HOTEL_FIXTURES\.length\} فنادق تجريبية</)
  assert.equal(/>3 فنادق|"3 فنادق/.test(resultsSource), false, "the count must not be hardcoded")
})

await test("no browser pricing, FX, tax or discount arithmetic exists", () => {
  // Strip comments first: a JSDoc line like " * 18:20" is prose, not arithmetic.
  const code = source => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  for (const [name, source] of [["results", resultsSource], ["rooms", roomsSource],
    ["guest", guestSource], ["review", reviewSource]])
    assert.equal(/toFixed|parseFloat|parseInt\(|[a-zA-Z)]\s*[*/]\s*\d|exchangeRate|discount\s*[+*/-]/.test(code(source)), false, name)
  assert.equal(/calc\(\s*\d+\s*[*/]/.test(css), false)
})

await test("no private supplier field reaches the rendered output", () => {
  const restricted = /supplier_net|supplierRateId|supplierRoomId|supplierHotelId|privateMetadata|identityKey|"provider"|internal-1\d\d/
  for (const [name, html] of screens) assert.equal(restricted.test(html), false, name)
  for (const [name, source] of [["results", resultsSource], ["rooms", roomsSource],
    ["guest", guestSource], ["review", reviewSource], ["search", searchSource], ["notice", noticeSource]])
    assert.equal(restricted.test(source), false, name)
})

await test("fixture amounts are rendered verbatim, never as provider truth", () => {
  assert.match(results, /1,430 AED|1,180 AED|1,620 AED|\d,\d{3} AED/)
  assert.match(results, /data-presentation-fixture="synthetic"/)
})

// ---- Filters and sort are presentation only ------------------------------------

await test("no filter or sort control is rendered, because none is supported", () => {
  assert.equal(/<input|<select|checkbox|onChange|useState/.test(resultsSource), false)
  assert.equal(/type="checkbox"/.test(results), false)
})

await test("both unavailable affordances say so in plain language", () => {
  assert.match(results, /التصفية غير متاحة بعد ضمن حدود Sandbox\./)
  assert.match(results, /الترتيب غير متاح بعد/)
})

await test("the default order is not signalled by colour alone", () => {
  assert.match(css, /\.hotels-v2__sort--active::after/)
})

// ---- Guest data ------------------------------------------------------------------

await test("no PII is written to storage, URL or analytics", () => {
  for (const [name, source] of [["page", pageSource], ["guest", guestSource], ["rooms", roomsSource],
    ["review", reviewSource], ["results", resultsSource]])
    assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie|navigator\.sendBeacon|supabase|fetch\s*\(/.test(source), false, name)
  assert.equal(/searchParams\.set|\?email=|\?phone=/.test(guestSource), false)
})

await test("guest collection was not expanded", () => {
  const fields = [...guest.matchAll(/<label[^>]*>([^<]*)</g)].map(match => match[1].trim()).filter(Boolean)
  assert.deepEqual(fields, ["الاسم الأول", "اسم العائلة", "رقم الهاتف", "البريد الإلكتروني"])
  assert.equal(/passport|جواز السفر<|nationality|تاريخ الميلاد/i.test(guest), false)
})

// ---- RTL / LTR ---------------------------------------------------------------------

await test("hotels CSS uses logical properties only", () => {
  const physical = css.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(css))
})

await test("amounts stay isolated and read naturally in both directions", () => {
  assert.match(results, /class="latin-text hotels-v2__price-value" dir="ltr"/)
  assert.match(rooms, /dir="ltr"/)
})

await test("hotels render structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/hotels"] },
      React.createElement(DirectionProvider, { initialLocale: locale }, React.createElement(HotelsPage))))
    assert.match(html, /hotels-v2__card/, locale)
    assert.match(html, /data-hotel-sandbox="true"/, locale)
  }
})

// ---- Responsive -----------------------------------------------------------------------

await test("responsive steps exist for tablet, mobile and the narrowest viewport", () => {
  assert.match(css, /@media \(max-width: 1024px\)/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 390px\)/)
  for (const [name, html] of screens) assert.match(html, /data-layout="responsive-desktop-mobile"/, name)
})

await test("mobile stacks the card and keeps sandbox truth visible", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.hotels-v2__card \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(mobile, /\.hotels-v2__layout \{ grid-template-columns: minmax\(0, 1fr\)/)
  assert.equal(/\.hotels-v2__capability \{[^}]*display: none/.test(mobile), false)
})

await test("long names and amounts wrap instead of overflowing", () => {
  for (const selector of ["__card-title", "__card-meta", "__price-value", "__search-value", "__capability-title"]) {
    const index = css.indexOf(selector)
    assert.match(css.slice(index, index + 420), /overflow-wrap: anywhere/, selector)
  }
  assert.match(css, /\.hotels-v2__card-copy \{[\s\S]*?min-inline-size: 0/)
})

await test("no fixed width can overflow a 390px viewport", () => {
  const fixed = [...css.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(match => Number(match[1])).filter(value => value > 360)
  assert.deepEqual(fixed, [], `fixed widths: ${fixed.join(", ")}`)
})

// ---- Accessibility and motion -------------------------------------------------------------

await test("every hotels control meets the 48px touch floor", () => {
  for (const selector of [".hotels-v2__back", ".hotels-v2__room-action,", ".hotels-v2__fields input"]) {
    const index = css.indexOf(`${selector}\n`) > -1 ? css.indexOf(`${selector}\n`) : css.indexOf(`${selector} {`)
    assert.ok(index > -1, selector)
    assert.match(css.slice(index, css.indexOf("}", index)), /min-block-size: var\(--hajiz-v2-touch-target\)/, selector)
  }
  assert.match(resultsSource, /v2-button v2-button--primary/)
})

await test("focus is visible on every hotels control", () => {
  assert.match(css, /\.hotels-v2__back:focus-visible/)
  assert.match(css, /\.hotels-v2__rooms-button:focus-visible/)
  assert.match(css, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
})

await test("headings and regions are semantic and labelled", () => {
  assert.match(results, /<h1 class="hotels-v2__title">/)
  assert.match(results, /aria-labelledby="hotels-v2-filters-title"/)
  assert.match(results, /aria-label="حدود القدرة الحالية"/)
  assert.match(results, /aria-label="معايير الإقامة المعروضة"/)
})

await test("reduced motion is honoured", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), /transition: none/)
})

await test("sandbox truth, prices and boundary copy never animate", () => {
  for (const selector of ["__capability", "__capability-title", "__capability-note", "__card-sandbox",
    "__price-value", "__unavailable", "__privacy"]) {
    const index = css.indexOf(selector)
    assert.match(css.slice(index, index + 460), /animation: none/, `${selector} is not pinned static`)
  }
  assert.match(noticeSource, /v2-no-motion/)
})

// ---- Ownership ---------------------------------------------------------------------------------

await test("hotels CSS loads last, after every earlier V2 layer", () => {
  const order = ['./design-system/index.css', './features/home/home-v2.css',
    './features/flights/flight-results-v2.css', './features/flights/checkout-v2.css',
    './features/flights/payments-v2.css', './features/account/trips-v2.css',
    './features/account/account-v2.css', './features/hotels/hotels-v2.css']
  const positions = order.map(marker => mainSource.indexOf(marker))
  assert.ok(positions.every(position => position > -1))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

await test("no hotels file crosses the frontend ownership boundary", () => {
  const restricted = /src\/server|supabase|src\/legacy|service_role/i
  for (const [name, source] of [["page", pageSource], ["results", resultsSource], ["rooms", roomsSource],
    ["guest", guestSource], ["review", reviewSource], ["notice", noticeSource],
    ["search", searchSource], ["css", css]]) assert.equal(restricted.test(source), false, name)
})

await test("the frozen touch-target rule in index.css is untouched", async () => {
  const legacy = await read("../src/index.css")
  assert.match(legacy, /\.hotels-page button \{ min-height: var\(--touch-target\)/)
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
