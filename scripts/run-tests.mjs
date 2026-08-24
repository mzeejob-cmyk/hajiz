import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createServer } from "vite"
import { renderToStaticMarkup } from "react-dom/server"
import React from "react"
import { MemoryRouter } from "react-router-dom"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" })
try {
  const { ROUTE_MANIFEST } = await vite.ssrLoadModule("/src/app/router/routeManifest.js")
  const { V1_SERVICE_IDS } = await vite.ssrLoadModule("/src/services/contracts/navigation.js")
  const { AppShell } = await vite.ssrLoadModule("/src/app/layouts/AppShell.jsx")
  const { default: HomePage } = await vite.ssrLoadModule("/src/features/home/HomePage.jsx")
  const { buildSearchTarget } = await vite.ssrLoadModule("/src/features/home/data/searchTarget.js")
  const { createCustomLocation, DEFAULT_FLIGHT_LOCATIONS, locationSearchValue } = await vite.ssrLoadModule("/src/features/home/data/locations.js")
  const { default: FlightsPage } = await vite.ssrLoadModule("/src/features/flights/FlightsPage.jsx")
  const { parseFlightQuery } = await vite.ssrLoadModule("/src/features/flights/data/flightQuery.js")
  const { FLIGHT_FIXTURES } = await vite.ssrLoadModule("/src/features/flights/data/flightFixtures.js")
  const { Price } = await vite.ssrLoadModule("/src/features/flights/components/Price.jsx")
  const { FlightsFiltersSheet } = await vite.ssrLoadModule("/src/features/flights/components/FlightsFiltersSheet.jsx")
  const { SEARCH_STATES } = await vite.ssrLoadModule("/src/features/flights/data/searchStates.js")
  await test("route manifest contains every required V1 route", () => assert.deepEqual(ROUTE_MANIFEST.map(route => route.path), ["/", "/flights", "/hotels", "/insurance", "/packages", "/offers", "/checkout/*", "/bookings/:reference", "/account/*", "/partners/*", "/admin/*"]))
  await test("V1 scope excludes Visa and Ferries", () => { const scope = [...V1_SERVICE_IDS, ...ROUTE_MANIFEST.map(route => route.path)].join(" ").toLowerCase(); assert.equal(scope.includes("visa"), false); assert.equal(scope.includes("ferr"), false) })
  const shell = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AppShell, null, React.createElement("p", null, "shell-test"))))
  await test("shell renders global landmarks", () => { assert.match(shell, /<header/); assert.match(shell, /<main/); assert.match(shell, /<footer/); assert.match(shell, /shell-test/) })
  await test("mobile navigation is accessible and collapsible", () => { assert.match(shell, /aria-controls="mobile-navigation"/); assert.match(shell, /aria-expanded="false"/); assert.match(shell, /id="mobile-navigation"/) })
  const home = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(HomePage)))
  await test("Home search has exactly the four approved service tabs", () => { const tabs = [...home.matchAll(/data-service="([^"]+)"/g)].map(match => match[1]); assert.deepEqual(tabs, ["flights", "hotels", "insurance", "packages"]); assert.equal(tabs.includes("offers"), false) })
  await test("Offers is a section rather than a search tab", () => { assert.match(home, /عروض مختارة/); assert.match(home, /عرض رحلة مختار/); assert.equal(/data-service="offers"/.test(home), false) })
  await test("Home excludes Visa and Ferries", () => assert.equal(/تأشير|عبّار|بواخر|ferr|visa/i.test(home), false))
  await test("Home renders approved discovery and CTA sections", () => { for (const content of ["وجهات ورحلات شائعة", "دبي ← الخرطوم", "استكشف الإقامة", "عرض الفنادق", "باقات جاهزة", "أيام القاهرة", "تأمين السفر", "قارن التأمين", "حاجز للشركاء", "اكتشف الشراكة"]) assert.match(home, new RegExp(content)) })
  await test("unapproved trust and support narrative is absent", () => { assert.equal(/لماذا حاجز|رفيقك في كل خطوة|هل تحتاج مساعدة/.test(home), false) })
  await test("Home search creates safe synthetic navigation targets", () => { assert.equal(buildSearchTarget("flights", { from: "KRT", to: "JED", departure: "" }), "/flights?from=KRT&to=JED"); assert.equal(buildSearchTarget("insurance", {}), "/insurance") })
  await test("default flight locations are Dubai to Khartoum with separate codes", () => { assert.deepEqual(DEFAULT_FLIGHT_LOCATIONS.from, { label: "دبي", code: "DXB" }); assert.deepEqual(DEFAULT_FLIGHT_LOCATIONS.to, { label: "الخرطوم", code: "KRT" }) })
  await test("default flight target uses DXB to KRT", () => { const { from, to } = DEFAULT_FLIGHT_LOCATIONS; assert.equal(buildSearchTarget("flights", { from: locationSearchValue(from), to: locationSearchValue(to) }), "/flights?from=DXB&to=KRT") })
  await test("swapping locations preserves their label and code identities", () => { const swapped = { from: DEFAULT_FLIGHT_LOCATIONS.to, to: DEFAULT_FLIGHT_LOCATIONS.from }; assert.equal(buildSearchTarget("flights", { from: locationSearchValue(swapped.from), to: locationSearchValue(swapped.to) }), "/flights?from=KRT&to=DXB"); assert.equal(swapped.from.label, "الخرطوم"); assert.equal(swapped.to.label, "دبي") })
  await test("unknown manual locations do not invent IATA codes", () => { const custom = createCustomLocation("مدينة جديدة"); assert.deepEqual(custom, { label: "مدينة جديدة", code: "" }); assert.equal(locationSearchValue(custom), "مدينة جديدة") })
  await test("Home mobile form markup has labels and touch controls", () => { assert.match(home, /aria-label="البحث عن خدمات السفر"/); assert.match(home, /role="tablist"/); assert.match(home, /aria-label="تبديل نقطة المغادرة والوصول"/); assert.match(home, /type="submit"/) })
  await test("active Home implementation has no legacy or Supabase imports", async () => { const files = ["HomePage.jsx", "components/HeroSection.jsx", "components/HomeSearch.jsx", "components/OffersSection.jsx", "components/PopularRoutesSection.jsx", "components/HotelDestinationsSection.jsx", "components/PackagesSection.jsx", "components/HomeCTA.jsx"]; for (const file of files) { const source = await fs.readFile(new URL(`../src/features/home/${file}`, import.meta.url), "utf8"); assert.equal(/src\/legacy|supabase/i.test(source), false) } })
  const flights = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/flights?from=DXB&to=KRT"] }, React.createElement(FlightsPage)))
  await test("Flights renders approved search-results structure", () => { for (const text of ["رحلات من دبي إلى الخرطوم", "تصفية النتائج", "48 نتيجة", "ما زلنا نبحث عن خيارات إضافية"]) assert.match(flights, new RegExp(text)) })
  await test("Flights query defaults and explicit route resolve DXB to KRT", () => { assert.deepEqual(parseFlightQuery(""), { from: "DXB", to: "KRT", fromLabel: "دبي", toLabel: "الخرطوم", departure: "2026-09-15", returnDate: "", travelers: "1", tripType: "round" }); assert.match(flights, /DXB/); assert.match(flights, /KRT/) })
  await test("flight segment physical order remains origin line destination", () => { const origin = flights.indexOf("segment-origin"); const line = flights.indexOf("segment-line", origin); const destination = flights.indexOf("segment-destination", line); assert.ok(origin > -1 && origin < line && line < destination); assert.match(flights, /flight-segment[^>]*dir="ltr"/) })
  await test("three normalized synthetic itineraries render", () => { assert.equal(FLIGHT_FIXTURES.length, 3); assert.equal((flights.match(/data-itinerary=/g) || []).length, 3); for (const airline of ["طيران الإمارات", "فلاي دبي", "الخطوط الإثيوبية"]) assert.match(flights, new RegExp(airline)) })
  await test("active result fixtures use one AED display currency", () => { assert.deepEqual(FLIGHT_FIXTURES.map(({ currency }) => currency), ["AED", "AED", "AED"]); const ethiopian = FLIGHT_FIXTURES.find(({ airlineCode }) => airlineCode === "ET"); assert.deepEqual({ amount: ethiopian.sellingAmount, currency: ethiopian.currency }, { amount: "1,340", currency: "AED" }); assert.equal("mobileMoney" in ethiopian, false); assert.equal(flights.includes("1,842,500"), false); assert.equal(flights.includes("ج.س"), false) })
  await test("Price isolates AED and SDG currency runs", () => { const aed = renderToStaticMarkup(React.createElement(Price, { amount: "1,205", currency: "AED" })); const sdg = renderToStaticMarkup(React.createElement(Price, { amount: "1,842,500", currency: "SDG" })); assert.match(aed, /dir="ltr">1,205/); assert.match(aed, /dir="ltr">AED/); assert.match(sdg, /dir="ltr">1,842,500/); assert.match(sdg, /<span>ج.س<\/span>/) })
  await test("partial expired and empty result states exist", () => { assert.deepEqual(Object.keys(SEARCH_STATES), ["partial", "expired", "empty"]); for (const title of ["نتائج جزئية", "الأسعار تحتاج تحديث", "ما لقينا نتائج مطابقة"]) assert.match(flights, new RegExp(title)) })
  await test("mobile filter trigger and accessible modal sheet exist", () => { assert.match(flights, /mobile-filter-trigger/); const sheet = renderToStaticMarkup(React.createElement(FlightsFiltersSheet, { open: true, onClose() {}, selected: [], onChange() {}, onClear() {} })); assert.match(sheet, /role="dialog"/); assert.match(sheet, /aria-modal="true"/); assert.match(sheet, /aria-label="إغلاق الفلاتر"/); assert.match(sheet, /عرض 48 نتيجة/); assert.ok((sheet.match(/class="filter-check"/g) || []).length >= 9) })
  await test("selection remains local presentation feedback only", () => { assert.match(flights, />اختيار<\/button>/); assert.equal(/checkout|createBooking|createPayment/i.test(flights), false) })
  await test("Flights source excludes restricted authority and legacy imports", async () => { const files = ["FlightsPage.jsx", "data/flightFixtures.js", "data/flightQuery.js", "components/FlightOfferCard.jsx", "components/FlightSegment.jsx", "components/Price.jsx", "components/FlightsFilters.jsx", "components/FlightsFiltersSheet.jsx"]; const restricted = /src\/legacy|supabase|supplier_net|net_cost|supplierId|supplier_id|commission|bankak|service_role/i; for (const file of files) { const source = await fs.readFile(new URL(`../src/features/flights/${file}`, import.meta.url), "utf8"); assert.equal(restricted.test(source), false) } })
  await test("document is Arabic-first RTL", async () => { const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8"); assert.match(html, /<html lang="ar" dir="rtl">/) })
  process.stdout.write(`\n${passed} tests passed\n`)
} finally { await vite.close() }
