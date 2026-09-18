import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

/**
 * Execution 05 closeout: the legacy fixture-driven customer checkout views are
 * retired. This suite proves they are unreachable through the Flights page and
 * that no fixture fare or traveler can surface on a customer screen, while the
 * canonical Search -> Reprice -> B10 -> B11 -> B12 flow stays intact.
 *
 * Reachability only. The legacy components and their fixtures remain on disk as
 * dead code for a later cleanup, so their frozen CSS assertions stay untouched.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")
const pageSource = await read("../src/features/flights/FlightsPage.jsx")

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { default: FlightsPage } = await vite.ssrLoadModule("/src/features/flights/FlightsPage.jsx")

const render = search => renderToStaticMarkup(React.createElement(MemoryRouter,
  { initialEntries: [`/flights?from=DXB&to=KRT${search}`] }, React.createElement(FlightsPage)))

const travelerView = render("&view=traveler&itinerary=fixture-best&fare=checked")
const reviewView = render("&view=review&itinerary=fixture-best&fare=checked")
const canonical = render("")

// ---- Unreachable ----------------------------------------------------------

await test("?view=traveler no longer renders the legacy traveler view", () => {
  assert.equal(travelerView.includes('data-view="traveler"'), false)
  assert.equal(/بيانات المسافر<|أدخل البيانات كما تظهر في جواز السفر/.test(travelerView), false)
  assert.equal(travelerView.includes("traveler-field"), false)
})

await test("?view=review no longer renders the legacy review view", () => {
  assert.equal(reviewView.includes('data-view="review"'), false)
  assert.equal(/راجع حجزك قبل الدفع|تعذر عرض مراجعة الحجز/.test(reviewView), false)
  assert.equal(reviewView.includes("review-summary"), false)
})

await test("both retired values fall through to the canonical results view", () => {
  for (const [name, html] of [["traveler", travelerView], ["review", reviewView]]) {
    assert.match(html, /flight-results-state/, `${name} should land on canonical results`)
    assert.match(html, /flights-layout-v2/, `${name} should keep the V2 results layout`)
  }
})

await test("falling through is not a redirect loop", () => {
  assert.equal(/<meta[^>]*http-equiv="refresh"/i.test(travelerView + reviewView), false)
  // useNavigate is the ordinary user-initiated hook; a loop would need a
  // render-time redirect, so look for that specifically.
  assert.equal(/<Navigate|window\.location|history\.replace|<Redirect/.test(pageSource), false)
})

// ---- No fixture data can reach a customer ---------------------------------

await test("no fixture traveler identity surfaces on either retired path", () => {
  for (const value of ["MOHAMED", "AHMED", "P1234567", "P••••567",
    "+971 50 123 4567", "name@example.com", "12 / 04 / 1992"]) {
    assert.equal(travelerView.includes(value), false, value)
    assert.equal(reviewView.includes(value), false, value)
  }
})

await test("no synthetic fixture fare surfaces on either retired path", () => {
  for (const value of ["1,120", "1,205", "EK 735", "أمتعة مسجلة: 23 كجم"]) {
    assert.equal(travelerView.includes(value), false, value)
    assert.equal(reviewView.includes(value), false, value)
  }
})

// ---- FlightsPage no longer mounts the legacy components -------------------

await test("FlightsPage does not import or mount TravelerDetails", () => {
  assert.equal(pageSource.includes("TravelerDetails"), false)
  assert.equal(/components\/TravelerDetails\.jsx/.test(pageSource), false)
})

await test("FlightsPage does not import or mount FlightReview", () => {
  assert.equal(pageSource.includes("FlightReview"), false)
  assert.equal(/components\/FlightReview\.jsx/.test(pageSource), false)
})

await test("no retired view branch remains in the page", () => {
  assert.equal(/params\.get\("view"\) === "traveler"/.test(pageSource), false)
  assert.equal(/params\.get\("view"\) === "review"/.test(pageSource), false)
})

await test("no in-memory draft is held or carried in a URL for a retired view", () => {
  assert.equal(/setReviewDraft|reviewDraft/.test(pageSource), false)
  assert.deepEqual(pageSource.match(/navigate\(`[^`]*view=(?:traveler|review)[^`]*`\)/g) ?? [], [])
})

// ---- Canonical flow intact ------------------------------------------------

await test("the canonical results view is unchanged", () => {
  assert.match(canonical, /flight-results-state/)
  assert.match(canonical, /flights-layout-v2/)
  assert.match(canonical, /flight-filters-v2/)
})

await test("the canonical B10/B11/B12 coordinators are still wired", () => {
  for (const marker of ["createFlightSearchCoordinatorV1", "createFlightRepriceCoordinatorV1",
    "createFlightCheckoutCoordinatorV1", "createFlightBookingIntentCoordinatorV1",
    "createFlightPaymentInitiationCoordinatorV1"])
    assert.match(pageSource, new RegExp(marker), marker)
})

await test("the canonical panels are all still exported", async () => {
  const module = await vite.ssrLoadModule("/src/features/flights/FlightsPage.jsx")
  for (const name of ["ResultsState", "RepricePanel", "TravelerCheckoutPanel",
    "BookingIntentPanel", "PaymentInitiationPanel"])
    assert.equal(typeof module[name], "function", `missing ${name}`)
})

await test("the trusted traveler contract is untouched by this remediation", () => {
  assert.match(pageSource, /toFlightTravelerDataV1/)
  assert.match(pageSource, /expectedPassengers/)
  assert.match(pageSource, /intentCoordinator\.create\(travelerDraft\)/)
})

await test("no fake booking or payment state was introduced", () => {
  assert.equal(/createBooking|confirmPayment|markPaid|apply_payment_event|PNR/i.test(pageSource), false)
})

// ---- Dead code is left in place, not deleted ------------------------------

await test("the legacy components and fixtures remain on disk as dead code", async () => {
  for (const path of ["../src/features/flights/components/TravelerDetails.jsx",
    "../src/features/flights/components/FlightReview.jsx",
    "../src/features/flights/data/flightFixtures.js",
    "../src/features/flights/data/fareOptions.js"]) {
    const source = await read(path)
    assert.ok(source.length > 0, `${path} must not be deleted`)
  }
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
