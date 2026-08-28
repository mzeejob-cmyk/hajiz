import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"
import { mapFlightSearchRequestV1 } from "../src/features/flights/data/flightSearchRequestV1.js"
import { createFlightSearchClientV1, FlightSearchClientError, parseFlightSearchHttpResponseV1 } from "../src/features/flights/api/flightSearchClientV1.js"
import { toFlightResultsViewModelV1 } from "../src/features/flights/data/flightResultsViewModelV1.js"
import { createFlightSearchCoordinatorV1 } from "../src/features/flights/data/flightSearchCoordinatorV1.js"

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" })
const { FlightOfferCard } = await vite.ssrLoadModule("/src/features/flights/components/FlightOfferCard.jsx")

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
const form = (changes = {}) => ({ from: "dxb", to: "krt", departure: "2026-09-15", returnDate: "", travelers: "1", tripType: "oneway", cabinClass: "economy", currency: "AED", ...changes })
const itinerary = { marketingCarrierName: "HAJIZ Air", origin: "DXB", destination: "KRT", departureAt: "2026-09-15T06:00:00.000Z", arrivalAt: "2026-09-15T10:30:00.000Z", durationMinutes: 270, stops: 0, segments: [{ marketingCarrier: "HZ", flightNumber: "101", origin: "DXB", destination: "KRT", departureAt: "2026-09-15T06:00:00.000Z", arrivalAt: "2026-09-15T10:30:00.000Z", cabin: "economy" }] }
const alternative = (changes = {}) => ({ alternativeId: "hca_v1_opaque-value.without-format", fare: { fareBrand: "Standard", cabin: "economy", baggage: "1 bag", changeability: "fees apply", refundability: "non-refundable" }, price: { amount: "1250.00", currency: "AED", validUntil: "2026-09-15T03:00:00.000Z" }, recommended: true, ...changes })
const body = (changes = {}) => ({ contractVersion: "customer-flight-search-http/v1", data: { contractVersion: "customer-flight-search/v1", searchStatus: "COMPLETE", currency: "AED", groups: [{ groupId: "hcg_v1_group", status: "RANKED", recommendationAvailable: true, preferredAlternativeId: "hca_v1_opaque-value.without-format", itinerary, alternatives: [alternative()] }], ...changes } })
const errorBody = (code) => ({ contractVersion: "customer-flight-search-http-error/v1", error: { code, message: "safe" } })

await test("F1 valid request mapping", () => assert.equal(mapFlightSearchRequestV1(form()).origin, "DXB"))
await test("F2 one-way returnDate null", () => assert.equal(mapFlightSearchRequestV1(form()).returnDate, null))
await test("F3 round-trip request", () => assert.equal(mapFlightSearchRequestV1(form({ tripType: "round", returnDate: "2026-09-20" })).tripType, "round_trip"))
await test("F4 obvious invalid input rejected", () => assert.throws(() => mapFlightSearchRequestV1(form({ to: "DXB" }))))
await test("F5 request has exact public fields", () => assert.deepEqual(Object.keys(mapFlightSearchRequestV1(form())), ["tripType", "origin", "destination", "departureDate", "returnDate", "adults", "children", "infants", "cabinClass", "customerCurrency"]))
await test("F6 COMPLETE parses and renders", () => assert.equal(toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(body())).length, 1))
await test("F7 PARTIAL parses", () => assert.equal(parseFlightSearchHttpResponseV1(body({ searchStatus: "PARTIAL" })).searchStatus, "PARTIAL"))
await test("F8 COMPLETE empty remains success empty", () => assert.equal(parseFlightSearchHttpResponseV1(body({ groups: [] })).groups.length, 0))
for (const [name, status, code, kind] of [["F9 unavailable",503,"SEARCH_UNAVAILABLE","unavailable"],["F10 timeout",504,"REQUEST_TIMEOUT","timeout"],["F11 validation",400,"VALIDATION_ERROR","validation_error"],["F12 internal",500,"INTERNAL_ERROR","internal_error"]]) await test(name, async () => { const client = createFlightSearchClientV1({ transport: async () => ({ status, body: errorBody(code) }) }); await assert.rejects(client.search({}), (error) => error instanceof FlightSearchClientError && error.kind === kind) })
await test("F13 recommendation badge", () => assert.match(renderToStaticMarkup(React.createElement(FlightOfferCard, { offer: toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(body()))[0] })), /موصى به/))
await test("F14 no recommendation badge", () => { const no = body({ groups: [{ groupId: "hcg_v1_group", status: "UNRANKED", recommendationAvailable: false, preferredAlternativeId: null, itinerary, alternatives: [alternative({ recommended: false })] }] }); assert.doesNotMatch(renderToStaticMarkup(React.createElement(FlightOfferCard, { offer: toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(no))[0] })), /موصى به/) })
await test("F15 price remains exact string and currency", () => { const { sellingAmount, currency } = toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(body()))[0]; assert.deepEqual({ sellingAmount, currency }, { sellingAmount: "1250.00", currency: "AED" }) })
await test("F16 no client FX conversion", () => assert.equal(toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(body()))[0].sellingAmount, "1250.00"))
await test("F17 alternativeId is opaque", () => assert.equal(toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(body()))[0].alternativeId, "hca_v1_opaque-value.without-format"))
await test("F18 stale response cannot overwrite latest", async () => { let resolveFirst; const states = []; const client = { search: (request) => request.origin === "DXB" ? new Promise((resolve) => { resolveFirst = resolve }) : Promise.resolve(parseFlightSearchHttpResponseV1(body())) }; const coordinator = createFlightSearchCoordinatorV1({ client, onState: (state) => states.push(state) }); const first = coordinator.search({ origin: "DXB" }); await coordinator.search({ origin: "KRT" }); resolveFirst(parseFlightSearchHttpResponseV1(body({ groups: [] }))); await first; assert.equal(states.at(-1).request.origin, "KRT") })
await test("F19 second search aborts first", async () => { let firstSignal; const client = { search: (_request, { signal }) => { firstSignal ??= signal; return Promise.resolve(parseFlightSearchHttpResponseV1(body())) } }; const coordinator = createFlightSearchCoordinatorV1({ client, onState() {} }); coordinator.search({ id: 1 }); await coordinator.search({ id: 2 }); assert.equal(firstSignal.aborted, true) })
await test("F20 currency change creates new request", () => assert.equal(mapFlightSearchRequestV1(form({ currency: "USD" })).customerCurrency, "USD"))
await test("F21 private contamination fails closed", () => assert.throws(() => parseFlightSearchHttpResponseV1({ ...body(), providerOfferRef: "travelport" })))
await test("F22 provider cannot enter request", () => assert.equal("provider" in mapFlightSearchRequestV1(form({ provider: "travelport" })), false))
await test("F23 backend order and recommendation preserved", () => { const second = alternative({ alternativeId: "opaque-second", recommended: false, price: { amount: "900.00", currency: "AED", validUntil: "2026-09-15T03:00:00.000Z" } }); const result = body({ groups: [{ groupId: "hcg_v1_group", status: "RANKED", recommendationAvailable: true, preferredAlternativeId: "hca_v1_opaque-value.without-format", itinerary, alternatives: [alternative(), second] }] }); assert.deepEqual(toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(result)).map((item) => item.alternativeId), ["hca_v1_opaque-value.without-format", "opaque-second"]) })
await test("F24 card uses semantic CTA and route details", () => { const html = renderToStaticMarkup(React.createElement(FlightOfferCard, { offer: toFlightResultsViewModelV1(parseFlightSearchHttpResponseV1(body()))[0] })); assert.match(html, /<button[^>]*>اختيار<\/button>/); assert.match(html, /DXB/); assert.match(html, /KRT/) })
assert.equal(passed, 24)
process.stdout.write(`Flight results frontend tests: ${passed}/24 passed\n`)
await vite.close()
