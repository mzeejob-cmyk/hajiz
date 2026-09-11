import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createFlightBookingIntentClientV1 } from "../src/features/flights/api/flightBookingIntentClientV1.js"
import {
  FLIGHT_BROWSER_HTTP_PATHS_V1,
  FlightBrowserHttpTransportError,
  createFlightBrowserHttpTransportsV1,
} from "../src/features/flights/api/flightBrowserHttpTransportsV1.js"
import { createFlightCheckoutClientV1 } from "../src/features/flights/api/flightCheckoutClientV1.js"
import { createFlightPaymentInitiationClientV1 } from "../src/features/flights/api/flightPaymentInitiationClientV1.js"
import { createFlightRepriceClientV1 } from "../src/features/flights/api/flightRepriceClientV1.js"
import { createFlightSearchClientV1 } from "../src/features/flights/api/flightSearchClientV1.js"

const tests = []
const test = (name, run) => tests.push({ name, run })
const TRANSPORT_KEYS = Object.freeze([
  "flightSearchTransport",
  "flightRepriceTransport",
  "flightCheckoutTransport",
  "flightBookingIntentTransport",
  "flightPaymentInitiationTransport",
])
const ROUTES = Object.freeze([
  ["flightSearchTransport", "/api/v1/flights/search", false],
  ["flightRepriceTransport", "/api/v1/flights/reprice", false],
  ["flightCheckoutTransport", "/api/v1/flights/checkout/prepare", false],
  ["flightBookingIntentTransport", "/api/v1/flights/booking-intents", true],
  ["flightPaymentInitiationTransport", "/api/v1/flights/payment-initiation", true],
])
const TOKEN = "synthetic-user-access-token"
const safeResponse = (status = 200, body = { ok: true }) => Object.freeze({ status, async json() { return body } })
const authenticatedClient = (counter) => Object.freeze({ auth: Object.freeze({ async getSession() { counter.getSession += 1; return { data: { session: { access_token: TOKEN } }, error: null } } }) })

test("factory returns exactly five frozen transports", () => {
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => safeResponse(), getSessionClient: () => authenticatedClient({ getSession: 0 }) })
  assert.deepEqual(Object.keys(transports), TRANSPORT_KEYS)
  assert.equal(Object.isFrozen(transports), true)
  assert.equal(Object.values(transports).every(value => typeof value === "function"), true)
})

test("factory rejects missing fetch dependency", () => assert.throws(() => createFlightBrowserHttpTransportsV1({ fetchImpl: null }), /trusted Flight browser transport dependencies/))
test("browser path constants are exact and relative", () => assert.deepEqual(Object.values(FLIGHT_BROWSER_HTTP_PATHS_V1), ROUTES.map(([, path]) => path)))

for (const [key, path, protectedRoute] of ROUTES) test(`${key} uses exact same-origin POST contract`, async () => {
  const calls = []
  const counter = { client: 0, getSession: 0, json: 0 }
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return { status: 207, async json() { counter.json += 1; return { route: path } } }
  }
  const transports = createFlightBrowserHttpTransportsV1({
    fetchImpl,
    getSessionClient: () => { counter.client += 1; return authenticatedClient(counter) },
  })
  const controller = new AbortController()
  const input = Object.freeze({ contractVersion: `test-${key}/v1`, nested: Object.freeze({ value: 1 }) })
  const result = await transports[key](input, { signal: controller.signal })
  assert.deepEqual(result, { status: 207, body: { route: path } })
  assert.equal(Object.isFrozen(result), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, path)
  assert.equal(/^\//.test(calls[0].url), true)
  assert.equal(calls[0].options.method, "POST")
  assert.equal(calls[0].options.headers["Content-Type"], "application/json")
  assert.equal(calls[0].options.body, JSON.stringify(input))
  assert.equal(calls[0].options.signal, controller.signal)
  assert.equal(calls[0].options.cache, "no-store")
  assert.equal(calls[0].options.credentials, "omit")
  assert.equal(Object.hasOwn(calls[0].options.headers, "Origin"), false)
  assert.equal(Object.hasOwn(calls[0].options.headers, "Host"), false)
  assert.equal(Object.hasOwn(calls[0].options.headers, "Content-Length"), false)
  assert.equal(counter.json, 1)
  assert.equal(counter.client, protectedRoute ? 1 : 0)
  assert.equal(counter.getSession, protectedRoute ? 1 : 0)
  assert.equal(calls[0].options.headers.Authorization, protectedRoute ? `Bearer ${TOKEN}` : undefined)
  assert.equal(calls[0].url.includes(TOKEN), false)
  assert.equal(calls[0].options.body.includes(TOKEN), false)
})

test("public Search Reprice and Checkout never touch auth", async () => {
  let authLookups = 0
  const transports = createFlightBrowserHttpTransportsV1({
    fetchImpl: async () => safeResponse(),
    getSessionClient: () => { authLookups += 1; throw new Error("must not run") },
  })
  await transports.flightSearchTransport({ value: "search" })
  await transports.flightRepriceTransport({ value: "reprice" })
  await transports.flightCheckoutTransport({ value: "checkout" })
  assert.equal(authLookups, 0)
})

for (const key of ["flightBookingIntentTransport", "flightPaymentInitiationTransport"]) test(`${key} delegates signed-out 401 without Authorization`, async () => {
  let options
  const body = { contractVersion: "canonical-error/v1", error: { code: "AUTH_REQUIRED" } }
  const transports = createFlightBrowserHttpTransportsV1({
    fetchImpl: async (_url, value) => { options = value; return safeResponse(401, body) },
    getSessionClient: () => ({ auth: { async getSession() { return { data: { session: null }, error: null } } } }),
  })
  const result = await transports[key]({ request: "signed-out" })
  assert.deepEqual(result, { status: 401, body })
  assert.equal(Object.hasOwn(options.headers, "Authorization"), false)
})

test("session result error fails locally without fetch or detail leakage", async () => {
  let fetches = 0
  const transports = createFlightBrowserHttpTransportsV1({
    fetchImpl: async () => { fetches += 1; return safeResponse() },
    getSessionClient: () => ({ auth: { async getSession() { return { data: { session: null }, error: new Error("Supabase SECRET detail") } } } }),
  })
  await assert.rejects(() => transports.flightBookingIntentTransport({ value: 1 }), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error" && !/Supabase|SECRET/.test(failure.message))
  assert.equal(fetches, 0)
})

test("thrown session failure fails locally without fetch or detail leakage", async () => {
  let fetches = 0
  const transports = createFlightBrowserHttpTransportsV1({
    fetchImpl: async () => { fetches += 1; return safeResponse() },
    getSessionClient: () => ({ auth: { async getSession() { throw new Error("raw auth token detail") } } }),
  })
  await assert.rejects(() => transports.flightPaymentInitiationTransport({ value: 1 }), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error" && !/auth|token|detail/.test(failure.message))
  assert.equal(fetches, 0)
})

test("malformed active session fails closed instead of pretending signed out", async () => {
  let fetches = 0
  const transports = createFlightBrowserHttpTransportsV1({
    fetchImpl: async () => { fetches += 1; return safeResponse() },
    getSessionClient: () => ({ auth: { async getSession() { return { data: { session: {} }, error: null } } } }),
  })
  await assert.rejects(() => transports.flightBookingIntentTransport({ value: 1 }), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error")
  assert.equal(fetches, 0)
})

test("request must be a plain JSON object", async () => {
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => safeResponse() })
  await assert.rejects(() => transports.flightSearchTransport([]), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error")
})

test("response JSON is parsed exactly once", async () => {
  let parses = 0
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => ({ status: 200, async json() { parses += 1; return { ok: true } } }) })
  assert.deepEqual(await transports.flightSearchTransport({ value: 1 }), { status: 200, body: { ok: true } })
  assert.equal(parses, 1)
})

test("invalid JSON response is internal error", async () => {
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => ({ status: 200, async json() { throw new SyntaxError("private response") } }) })
  await assert.rejects(() => transports.flightSearchTransport({ value: 1 }), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error" && !/private/.test(failure.message))
})

for (const body of [[], "scalar", 7, null]) test(`non-object JSON response is rejected: ${JSON.stringify(body)}`, async () => {
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => safeResponse(200, body) })
  await assert.rejects(() => transports.flightSearchTransport({ value: 1 }), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error")
})

test("malformed response object is rejected", async () => {
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => ({ status: "200", async json() { return { ok: true } } }) })
  await assert.rejects(() => transports.flightSearchTransport({ value: 1 }), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error")
})

test("non-abort fetch failure is sanitized internal error", async () => {
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => { throw new Error("network URL secret") } })
  await assert.rejects(() => transports.flightSearchTransport({ value: 1 }), failure => failure instanceof FlightBrowserHttpTransportError && failure.kind === "internal_error" && !/network|URL|secret/.test(failure.message))
})

test("caller cancellation preserves native abort failure", async () => {
  const controller = new AbortController()
  const nativeAbort = new DOMException("native cancellation", "AbortError")
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => { controller.abort(); throw nativeAbort } })
  await assert.rejects(() => transports.flightSearchTransport({ value: 1 }, { signal: controller.signal }), failure => failure === nativeAbort)
})

test("already-aborted request never fetches and remains AbortError", async () => {
  const controller = new AbortController()
  controller.abort()
  let fetches = 0
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => { fetches += 1; return safeResponse() } })
  await assert.rejects(() => transports.flightSearchTransport({ value: 1 }, { signal: controller.signal }), failure => failure?.name === "AbortError" && !(failure instanceof FlightBrowserHttpTransportError))
  assert.equal(fetches, 0)
})

test("response arriving after cancellation remains AbortError", async () => {
  const controller = new AbortController()
  const transports = createFlightBrowserHttpTransportsV1({ fetchImpl: async () => { controller.abort(); return safeResponse() } })
  await assert.rejects(() => transports.flightSearchTransport({ value: 1 }, { signal: controller.signal }), failure => failure?.name === "AbortError" && !(failure instanceof FlightBrowserHttpTransportError))
})

test("default App composition supplies all five transports", async () => {
  const [app, providers] = await Promise.all([
    readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/providers/AppProviders.jsx", import.meta.url), "utf8"),
  ])
  assert.match(app, /createFlightBrowserHttpTransportsV1\(\)/)
  for (const key of TRANSPORT_KEYS) {
    assert.match(app, new RegExp(`${key}=\\{flightTransports\\.${key}\\}`))
    assert.match(providers, new RegExp(`transport=\\{${key}\\}`))
  }
  assert.match(app, /<AppRouter\s*\/>/)
  assert.match(providers, /<AuthSessionProvider\s+dataSource=\{authDataSource\}>/)
  assert.match(providers, /<BrowserRouter>/)
})

test("browser transport source contains no server or secret authority", async () => {
  const source = await readFile(new URL("../src/features/flights/api/flightBrowserHttpTransportsV1.js", import.meta.url), "utf8")
  assert.equal(/createClient|src\/server|node:crypto|service_role|sb_secret_|SUPABASE_SERVICE_ROLE|localStorage|sessionStorage|document\.cookie|VITE_(?:FLIGHT_API_URL|API_URL)/i.test(source), false)
  assert.equal(/https?:\/\/(?:localhost|127\.0\.0\.1|[^"']*hajiztravel\.com|[^"']*supabase\.co)/i.test(source), false)
  assert.equal(/x-request-id/i.test(source), false)
  assert.equal((source.match(/JSON\.stringify\(/g) ?? []).length, 1)
  assert.match(source, /getAccountSessionClient/)
})

test("normalized transports remain compatible with all five canonical clients", async () => {
  const bodies = new Map([
    [FLIGHT_BROWSER_HTTP_PATHS_V1.search, [400, { contractVersion: "customer-flight-search-http-error/v1", error: { code: "VALIDATION_ERROR" } }]],
    [FLIGHT_BROWSER_HTTP_PATHS_V1.reprice, [503, { error: { code: "REPRICE_UNAVAILABLE" } }]],
    [FLIGHT_BROWSER_HTTP_PATHS_V1.checkout, [503, { error: { code: "CHECKOUT_UNAVAILABLE" } }]],
    [FLIGHT_BROWSER_HTTP_PATHS_V1.bookingIntent, [401, { error: { code: "AUTH_REQUIRED" } }]],
    [FLIGHT_BROWSER_HTTP_PATHS_V1.paymentInitiation, [401, { error: { code: "AUTH_REQUIRED" } }]],
  ])
  const transports = createFlightBrowserHttpTransportsV1({
    fetchImpl: async path => { const [status, body] = bodies.get(path); return safeResponse(status, body) },
    getSessionClient: () => ({ auth: { async getSession() { return { data: { session: null }, error: null } } } }),
  })
  const clients = [
    [createFlightSearchClientV1({ transport: transports.flightSearchTransport }).search({ value: 1 }), "validation_error"],
    [createFlightRepriceClientV1({ transport: transports.flightRepriceTransport }).reprice({ value: 1 }), "unavailable"],
    [createFlightCheckoutClientV1({ transport: transports.flightCheckoutTransport }).prepare({ value: 1 }), "service_unavailable"],
    [createFlightBookingIntentClientV1({ transport: transports.flightBookingIntentTransport }).create({ value: 1 }), "auth_required"],
    [createFlightPaymentInitiationClientV1({ transport: transports.flightPaymentInitiationTransport }).initiate({ value: 1 }), "auth_required"],
  ]
  for (const [pending, kind] of clients) await assert.rejects(pending, failure => failure?.kind === kind)
})

let passed = 0
for (const { name, run } of tests) {
  try { await run(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
  catch (failure) { process.stderr.write(`✗ ${name}\n`); throw failure }
}
process.stdout.write(`\nFlight Browser HTTP transport tests: ${passed}/${tests.length} PASS\n`)
