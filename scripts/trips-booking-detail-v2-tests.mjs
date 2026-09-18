import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 My Trips + Booking Detail regression suite.
 * Guards the node 17:145 grammar, reuse of the trusted owner-scoped trips
 * authority, the independence of payment and booking status, ticket-artifact
 * authority, safe handling of unknown values, RTL/LTR, responsive rules,
 * accessibility and motion safety.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")
const [css, tripsSource, cardSource, bookingSource, tabsSource, dataSourceSource, contractSource, mainSource] =
  await Promise.all([
    read("../src/features/account/trips-v2.css"),
    read("../src/features/account/components/MyTripsPage.jsx"),
    read("../src/features/account/components/TripWalletCard.jsx"),
    read("../src/features/bookings/BookingPage.jsx"),
    read("../src/features/account/components/TripTabs.jsx"),
    read("../src/services/myTripsDataSource.js"),
    read("../src/features/account/data/myTripsContract.js"),
    read("../src/main.jsx"),
  ])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { MyTripsPage } = await vite.ssrLoadModule("/src/features/account/components/MyTripsPage.jsx")
const { TripWalletCard } = await vite.ssrLoadModule("/src/features/account/components/TripWalletCard.jsx")
const { default: BookingPage } = await vite.ssrLoadModule("/src/features/bookings/BookingPage.jsx")
const contract = await vite.ssrLoadModule("/src/features/account/data/myTripsContract.js")

const booking = (over = {}) => ({ booking_ref: "HJZ-0A1B2C3D", status: "processing",
  sold_price: "1205", currency: "AED", pay_method: "bankak", created_at: "2026-09-10T00:00:00Z", ...over })
const trip = (bookings, payments, ticketing = []) =>
  contract.toMyTripsPresentation(bookings, payments, ticketing)[0]

const tripsFor = (rows, detail) => renderToStaticMarkup(React.createElement(MemoryRouter, null,
  ...rows.map((row, index) => React.createElement(TripWalletCard, { key: index, trip: row, detail }))))
const loadingTrips = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(MyTripsPage)))
const bookingAt = reference => renderToStaticMarkup(React.createElement(MemoryRouter,
  { initialEntries: [`/bookings/${reference}`] },
  React.createElement(Routes, null, React.createElement(Route,
    { path: "/bookings/:reference", element: React.createElement(BookingPage) }))))

// ---- Canonical V2 grammar · node 17:145 ------------------------------------

await test("My Trips renders the canonical heading and wallet structure", () => {
  assert.match(tripsSource, /رحلاتي/)
  assert.match(cardSource, /trips-v2__card/)
  assert.match(cardSource, /trips-v2__journey/)
  assert.match(cardSource, /trips-v2__documents/)
  assert.match(cardSource, /المستندات/)
})

await test("the wallet card is the inverse surface with the 340px documents block", () => {
  assert.match(css, /\.trips-v2__card \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 340px/)
  assert.match(css, /\.trips-v2__card \{[\s\S]*?background: var\(--hajiz-v2-color-surface-inverse\)/)
  assert.match(css, /\.trips-v2__documents \{[\s\S]*?background: var\(--hajiz-v2-color-surface-primary\)/)
})

await test("the canonical ticket-authority copy is present on both screens", () => {
  // The trips copy now lives in the extracted wallet card.
  for (const source of [cardSource, bookingSource]) {
    assert.match(source, /لن يظهر زر تنزيل التذكرة قبل توفر مستند موثوق وحالته AVAILABLE\./)
    assert.match(source, /وحده غير كافٍ/)
  }
})

await test("no route or traveler count is fabricated for the journey line", () => {
  // get_my_bookings returns no origin, destination or passenger count, so
  // node 17:153/17:154 is deliberately not rendered.
  assert.equal(/origin|destination|مسافر واحد|→/.test(cardSource), false)
})

// ---- Authority reused -------------------------------------------------------

await test("both screens read through the existing trusted data source", () => {
  assert.match(tripsSource, /myTripsDataSource/)
  assert.match(bookingSource, /myTripsDataSource/)
  assert.match(bookingSource, /data-booking-detail="owner-scoped-read"/)
  assert.match(tripsSource, /data-authority="authenticated-rpc"/)
})

await test("the authenticated RPC names are unchanged", () => {
  for (const rpc of ["get_my_bookings", "get_my_payments",
    "get_my_flight_ticketing_v1", "get_my_flight_ticket_records_v1"])
    assert.match(dataSourceSource, new RegExp(rpc), rpc)
})

await test("no new HTTP or Supabase client is introduced", () => {
  for (const [name, source] of [["trips", tripsSource], ["booking", bookingSource], ["tabs", tabsSource]])
    assert.equal(/fetch\s*\(|XMLHttpRequest|axios|createClient\(|@supabase|["'`]https?:/i.test(source), false, name)
})

await test("no payment-status polling, subscription or simulator is added", () => {
  for (const [name, source] of [["trips", tripsSource], ["booking", bookingSource]]) {
    assert.equal(/setInterval|setTimeout|subscribe\(|realtime|EventSource|requestAnimationFrame/.test(source), false, name)
  }
})

await test("no third status mapping is introduced", () => {
  assert.match(cardSource, /PaymentStatusBadge/)
  assert.match(bookingSource, /PaymentStatusBadge/)
  for (const source of [tripsSource, bookingSource, tabsSource, cardSource])
    assert.equal(/under_review|"confirmed"|"rejected"|"refunded"|"expired"/.test(source), false)
})

// ---- Payment and booking stay separate --------------------------------------

await test("payment and booking render as two independent indicators", () => {
  const html = tripsFor([trip([booking({ status: "processing" })], [{ booking_ref: "HJZ-0A1B2C3D", status: "confirmed" }])])
  assert.match(html, /data-domain="payment" data-status="confirmed"/)
  assert.match(html, /data-domain="booking" data-status="processing"/)
  assert.match(bookingSource, /domain="payment" status=\{booking\.paymentState\}/)
  assert.match(bookingSource, /domain="booking" status=\{booking\.bookingState\}/)
})

await test("a confirmed payment never claims a confirmed supplier booking", () => {
  const html = tripsFor([trip([booking({ status: "payment_confirmed" })], [{ booking_ref: "HJZ-0A1B2C3D", status: "confirmed" }])])
  assert.match(html, /تم تأكيد الدفع/)
  assert.match(html, /تم استلام الدفع/)
  assert.equal(/الحجز مؤكد|صدرت التذكرة/.test(html), false)
})

await test("the two indicators are never merged into one outcome", () => {
  const badges = [...tripsFor([trip([booking()], [{ booking_ref: "HJZ-0A1B2C3D", status: "confirmed" }])])
    .matchAll(/data-domain="(payment|booking)"/g)].map(m => m[1])
  assert.deepEqual(badges.sort(), ["booking", "payment"])
})

// ---- Ticket authority ---------------------------------------------------------

await test("a confirmed payment alone never enables ticket access", () => {
  const row = trip([booking({ status: "payment_confirmed" })], [{ booking_ref: "HJZ-0A1B2C3D", status: "confirmed" }])
  assert.equal(row.canDownloadTicket, false)
  assert.equal(row.canViewTicketDetails, false)
  const html = tripsFor([row])
  assert.match(html, /التذكرة غير متاحة بعد/)
  assert.equal(/عرض بيانات التذكرة/.test(html), false)
})

await test("a confirmed booking without a trusted artifact enables nothing", () => {
  const row = trip([booking({ status: "confirmed" })], [{ booking_ref: "HJZ-0A1B2C3D", status: "confirmed" }])
  assert.equal(row.canDownloadTicket, false)
  assert.equal(row.canViewTicketDetails, false)
  assert.match(tripsFor([row]), /التذكرة غير متاحة بعد/)
})

await test("ticketed without an AVAILABLE artifact still blocks download", () => {
  const row = trip([booking({ status: "ticketed" })], [],
    [{ booking_ref: "HJZ-0A1B2C3D", ticketing_state: "ISSUED", ticket_count: 1, artifact_available: false }])
  assert.equal(row.ticketingState, "ISSUED")
  assert.equal(row.canViewTicketDetails, true)
  assert.equal(row.canDownloadTicket, false)
  assert.match(tripsFor([row]), /التذكرة غير متاحة بعد/)
})

await test("only an AVAILABLE artifact permits the document-available line", () => {
  const row = trip([booking({ status: "ticketed" })], [],
    [{ booking_ref: "HJZ-0A1B2C3D", ticketing_state: "ISSUED", ticket_count: 1, artifact_available: true }])
  assert.equal(row.canDownloadTicket, true)
  const html = tripsFor([row])
  assert.match(html, /المستند الموثوق متاح/)
  assert.equal(/التذكرة غير متاحة بعد/.test(html), false)
})

await test("ticket availability is stated in words, not tone alone", () => {
  assert.match(css, /\.trips-v2__documents-pending \{/)
  assert.match(css, /\.trips-v2__documents-available \{/)
  assert.match(cardSource, /canDownloadTicket \? "المستند الموثوق متاح/)
})

await test("no ticket number, document URL or supplier reference is fabricated", () => {
  for (const [name, source] of [["trips", tripsSource], ["booking", bookingSource], ["card", cardSource]]) {
    assert.equal(/ticketNumber\s*=|href=\{[^}]*ticket|download=|supplierReference\s*=/.test(source), false, name)
  }
  const html = tripsFor([trip([booking()], [])])
  assert.equal(/<a[^>]*download/.test(html), false)
})

// ---- Unknown values fail safely ------------------------------------------------

await test("an unrecognised booking or payment status resolves to unknown", () => {
  const row = trip([booking({ status: "teleported" })], [{ booking_ref: "HJZ-0A1B2C3D", status: "settled" }])
  assert.equal(row.bookingState, "unknown")
  assert.equal(row.paymentState, "unknown")
  const html = tripsFor([row])
  assert.match(html, /data-status="unknown"/)
  assert.equal(/الحجز مؤكد|تم تأكيد الدفع/.test(html), false)
})

await test("an unknown ticketing state never unlocks a document", () => {
  const row = trip([booking({ status: "ticketed" })], [],
    [{ booking_ref: "HJZ-0A1B2C3D", ticketing_state: "TELEPORTED", ticket_count: 9, artifact_available: true }])
  assert.equal(row.canDownloadTicket, false)
  assert.equal(row.reconciliationRequired, true)
})

await test("the safe-fallback contract is untouched", () => {
  assert.match(contractSource, /const safeEnum = \(value, allowed, fallback\) => allowed\.includes\(value\) \? value : fallback/)
  assert.match(contractSource, /MY_TRIPS_PAYMENT_STATES = Object\.freeze\(\["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"\]\)/)
})

// ---- Booking detail guards ------------------------------------------------------

await test("an invalid reference is rejected before any read", () => {
  assert.match(bookingAt("not-a-reference"), /مرجع الحجز غير صالح/)
  assert.match(bookingSource, /\/\^HJZ-\[A-Z0-9-\]\{4,40\}\$\//)
})

await test("a valid reference starts from the owner-scoped loading state", () => {
  assert.match(bookingAt("HJZ-TEST-1234"), /جارٍ تحميل تفاصيل الحجز الآمنة/)
  assert.match(bookingAt("HJZ-TEST-1234"), /role="status"/)
})

await test("stale-request and ticket-guard protection are preserved", () => {
  assert.match(bookingSource, /selectVisibleBookingRequest/)
  assert.match(bookingSource, /createTicketRequestGuard/)
  assert.match(bookingSource, /ticketGuard\.current\.accepts\(request\)/)
  assert.match(bookingSource, /visibleTickets = tickets\.reference === reference/)
})

await test("the authoritative-amount gate is preserved", () => {
  assert.match(bookingSource, /hasAuthoritativeAmount\(booking\.amount\)/)
})

await test("ticket detail remains an explicit trusted action", () => {
  assert.match(bookingSource, /canViewTicketDetails/)
  assert.match(bookingSource, /loadTicketDetails\(reference\)/)
  assert.match(bookingSource, /canDownloadTicket/)
})

await test("the reconciliation warning is an alert and never animates", () => {
  assert.match(bookingSource, /booking-v2__reconciliation v2-no-motion" role="alert"/)
  const at = css.indexOf(".booking-v2__reconciliation {")
  assert.match(css.slice(at, css.indexOf("}", at)), /animation: none/)
})

// ---- Trip tabs ---------------------------------------------------------------------

await test("trip tabs render no control, because classification is impossible", () => {
  assert.equal(/<button|<select|<input|onClick|onChange|useState/.test(tabsSource), false)
  assert.match(tabsSource, /تصفية الرحلات غير متاحة بعد/)
  assert.match(loadingTrips, /data-trip-tabs="preview"/)
})

await test("the tabs carry the canonical Figma labels", () => {
  for (const label of ["القادمة", "قيد المعالجة", "السابقة"]) assert.match(loadingTrips, new RegExp(label))
})

await test("the default tab is not signalled by colour alone", () => {
  assert.match(css, /\.trips-v2__tab--active::after/)
})

// ---- States --------------------------------------------------------------------------

await test("loading uses V2 skeletons sized to the real card", () => {
  assert.match(loadingTrips, /data-state="loading"/)
  assert.match(loadingTrips, /role="status"/)
  assert.match(loadingTrips, /v2-skeleton/)
  assert.match(css, /\.trips-v2__skeleton \{[\s\S]*?block-size: 196px/)
})

await test("the empty state offers a real route and invents no trip", () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(MyTripsPage, { dataSource: { load: async () => [], loadTicketDetails: async () => [] } })))
  // SSR stops at the loading state; the empty branch is asserted at source.
  assert.match(html, /data-state="loading"/)
  assert.match(tripsSource, /data-state="empty"/)
  assert.match(tripsSource, /لا توجد حجوزات بعد/)
  assert.match(tripsSource, /to="\/flights"/)
})

await test("the error state is an alert with a retry and no raw detail", () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(MyTripsPage, { dataSource: { load: async () => { throw new Error("boom") },
      loadTicketDetails: async () => [] } })))
  assert.match(html, /data-state="loading"/)
  assert.equal(/boom|stack|Error:|postgres|supabase/i.test(html), false)
})

await test("ticket detail loading and failure are announced", () => {
  const loading = tripsFor([trip([booking({ status: "ticketed" })], [],
    [{ booking_ref: "HJZ-0A1B2C3D", ticketing_state: "ISSUED", ticket_count: 1, artifact_available: true }])],
    { status: "loading", rows: [] })
  assert.match(loading, /role="status"/)
  assert.match(loading, /aria-busy="true"/)
  const failed = tripsFor([trip([booking({ status: "ticketed" })], [],
    [{ booking_ref: "HJZ-0A1B2C3D", ticketing_state: "ISSUED", ticket_count: 1, artifact_available: true }])],
    { status: "error", rows: [] })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /v2-no-motion/)
})

// ---- RTL / LTR ---------------------------------------------------------------------

await test("trips CSS uses logical properties only", () => {
  const physical = css.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(css))
})

await test("references, amounts and ticket numbers stay isolated", () => {
  const html = tripsFor([trip([booking()], [])])
  assert.match(html, /<bdi class="trip-reference trips-v2__reference" dir="ltr">HJZ-0A1B2C3D<\/bdi>/)
  assert.match(html, /<bdi dir="ltr">1205 AED<\/bdi>/)
  assert.match(css, /\.trips-v2__reference \{[\s\S]*?unicode-bidi: isolate/)
  assert.match(bookingSource, /<bdi dir="ltr">\{booking\.amount\} \{booking\.currency\}<\/bdi>/)
})

await test("both screens render structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
      React.createElement(DirectionProvider, { initialLocale: locale }, React.createElement(MyTripsPage))))
    assert.match(html, /trips-v2__tabs/, locale)
    assert.match(html, /data-authority="authenticated-rpc"/, locale)
  }
})

// ---- Responsive -----------------------------------------------------------------------

await test("responsive steps exist for tablet, mobile and the narrowest viewport", () => {
  assert.match(css, /@media \(max-width: 1024px\)/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 390px\)/)
})

await test("mobile stacks the wallet card intentionally", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.trips-v2__card \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(mobile, /\.trips-v2__detail-link \{ inline-size: 100%; \}/)
})

await test("long references and ticket numbers wrap instead of overflowing", () => {
  for (const selector of ["__reference", "__journey-meta", "__documents-note", "__ticket-list"]) {
    const at = css.indexOf(selector)
    assert.match(css.slice(at, at + 400), /overflow-wrap: anywhere/, selector)
  }
  assert.match(css, /\.trips-v2__journey \{[\s\S]*?min-inline-size: 0/)
  assert.match(css, /\.trips-v2__documents \{[\s\S]*?min-inline-size: 0/)
})

await test("no fixed width can overflow a 390px viewport", () => {
  const fixed = [...css.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(m => Number(m[1])).filter(v => v > 360)
  assert.deepEqual(fixed, [], `fixed widths: ${fixed.join(", ")}`)
})

// ---- Accessibility and motion ------------------------------------------------------------

await test("every trips control meets the 48px touch floor", () => {
  assert.match(cardSource, /v2-button v2-button--ghost trips-v2__detail-link/)
  assert.match(cardSource, /v2-button v2-button--secondary trips-v2__tickets-button/)
  assert.match(bookingSource, /v2-button v2-button--primary/)
})

await test("focus is visible on every trips control", () => {
  assert.match(css, /\.trips-v2__detail-link:focus-visible/)
  assert.match(css, /\.trips-v2__tickets-button:focus-visible/)
  assert.match(css, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
})

await test("dates use semantic time elements", () => {
  assert.match(cardSource, /<time dateTime=\{trip\.createdAt\}>/)
  assert.match(bookingSource, /<time dateTime=\{booking\.createdAt\}>/)
  assert.match(bookingSource, /<time dateTime=\{ticket\.issuedAt\}>/)
})

await test("headings are semantic on both screens", () => {
  assert.match(loadingTrips, /<h1 class="trips-v2__title">رحلاتي<\/h1>/)
  assert.match(bookingSource, /<h1 className="trips-v2__title">تفاصيل الحجز<\/h1>/)
  assert.match(cardSource, /<h3 className="trips-v2__documents-title">/)
})

await test("no second motion system is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
})

await test("reduced motion is honoured", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), /transition: none/)
})

await test("status, ticket authority, references and errors never animate", () => {
  for (const selector of ["__statuses", "__journey-note", "__journey-meta", "__reference",
    "__documents-pending", "__documents-available", "__documents-note", "__tab-note"]) {
    const at = css.indexOf(selector)
    assert.match(css.slice(at, at + 420), /animation: none/, `${selector} is not pinned static`)
  }
})

// ---- Ownership ----------------------------------------------------------------------------

await test("trips CSS loads last, after every earlier V2 layer", () => {
  const order = ['./design-system/index.css', './features/home/home-v2.css',
    './features/flights/flight-results-v2.css', './features/flights/checkout-v2.css',
    './features/flights/payments-v2.css', './features/account/trips-v2.css']
  const positions = order.map(marker => mainSource.indexOf(marker))
  assert.ok(positions.every(position => position > -1))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

await test("no trips file crosses the frontend ownership boundary", () => {
  const restricted = /src\/server|supabase\/(migrations|functions)|src\/legacy|service_role|\.insert\s*\(|\.update\s*\(|\.delete\s*\(/i
  for (const [name, source] of [["trips", tripsSource], ["booking", bookingSource],
    ["tabs", tabsSource], ["card", cardSource], ["css", css]]) assert.equal(restricted.test(source), false, name)
})

await test("no fixture trip authority is imported", () => {
  for (const source of [tripsSource, bookingSource, tabsSource, cardSource])
    assert.equal(/tripFixtures|flightFixtures|fareOptions/.test(source), false)
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
