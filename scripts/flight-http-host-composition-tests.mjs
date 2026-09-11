import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import { createCustomerFlightBookingIntentHttpHandlerV1 } from "../src/server/http/customerFlightBookingIntentHttpV1.js"
import { createCustomerFlightPaymentInitiationHttpHandlerV1 } from "../src/server/http/customerFlightPaymentInitiationHttpV1.js"
import {
  FLIGHT_HTTP_HOST_PATHS,
  FLIGHT_HTTP_MAX_BODY_BYTES,
  createBoundedInMemoryFlightAdmissionV1,
  createHajizFlightHttpHostV1,
  parseFlightAllowedOriginsV1,
} from "../src/server/host/flightHttpHostV1.js"
import {
  createFlightDurabilityAdapterPairV1,
  createHajizFlightServerCompositionV1,
  createSupabaseFlightOwnerContextResolverV1,
  FlightOwnerContextResolverError,
  readFlightServerEnvironmentV1,
} from "../src/server/host/flightServerCompositionV1.js"

const tests = []
const test = (name, run) => tests.push({ name, run })
const ORIGIN = "https://app.hajiz.test"
const OTHER = "https://evil.invalid"
const fixedId = () => "hreq_host_test_0001"
const logs = []
const logger = { info(value) { logs.push(value) } }
const pathKey = Object.freeze({
  "/api/v1/flights/search": "search",
  "/api/v1/flights/reprice": "reprice",
  "/api/v1/flights/checkout/prepare": "checkout",
  "/api/v1/flights/booking-intents": "bookingIntent",
  "/api/v1/flights/payment-initiation": "paymentInitiation",
})
const calls = []
const handlers = Object.freeze(Object.fromEntries(Object.entries(pathKey).map(([path, key]) => [key, async request => {
  calls.push({ path, request })
  if (["bookingIntent", "paymentInitiation"].includes(key) && !request.headers.authorization) return { status: 401, body: { error: { code: "AUTH_REQUIRED" } } }
  return { status: 200, headers: { "content-type": "application/json" }, body: { route: path, ok: true } }
}])))
const hostOptions = (overrides = {}) => ({
  handlers,
  allowedOrigins: [ORIGIN],
  admission: createBoundedInMemoryFlightAdmissionV1({ maximum: 1_000, windowMs: 60_000 }),
  logger,
  requestIdFactory: fixedId,
  requestTimeoutMs: 200,
  ...overrides,
})
const createHost = (overrides = {}) => createHajizFlightHttpHostV1(hostOptions(overrides))
const request = (path, { method = "POST", origin = ORIGIN, body = {}, headers = {}, signal } = {}) => new Request(`https://api.hajiz.test${path}`, {
  method,
  headers: {
    ...(origin ? { origin } : {}),
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
    ...(method === "OPTIONS" ? { "access-control-request-method": "POST" } : {}),
    ...headers,
  },
  ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  signal,
})
const json = response => response.json()

for (const route of FLIGHT_HTTP_HOST_PATHS) test(`route dispatch exact ${route}`, async () => {
  calls.length = 0
  const protectedRoute = ["/api/v1/flights/booking-intents", "/api/v1/flights/payment-initiation"].includes(route)
  const response = await createHost().fetch(request(route, protectedRoute ? { headers: { authorization: "Bearer synthetic" } } : undefined))
  assert.equal(response.status, 200)
  assert.equal(calls[0].path, route)
  assert.deepEqual(calls[0].request.body, {})
})

test("unknown route is 404", async () => { const r = await createHost().fetch(request("/api/v1/flights/unknown")); assert.equal(r.status, 404); assert.equal((await json(r)).error.code, "NOT_FOUND") })
test("unsupported method is 405", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { method: "GET" })); assert.equal(r.status, 405) })
test("allowed-origin OPTIONS is exact", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { method: "OPTIONS" })); assert.equal(r.status, 204); assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN); assert.equal(r.headers.get("access-control-allow-methods"), "POST, OPTIONS"); assert.equal(r.headers.get("access-control-allow-headers"), "content-type, x-request-id") })
test("protected OPTIONS advertises Authorization", async () => { const r = await createHost().fetch(request("/api/v1/flights/booking-intents", { method: "OPTIONS" })); assert.match(r.headers.get("access-control-allow-headers"), /authorization/) })
test("OPTIONS rejects unsupported requested headers", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { method: "OPTIONS", headers: { "access-control-request-headers": "content-type, x-unsafe" } })); assert.equal(r.status, 400) })
test("disallowed-origin OPTIONS fails closed", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { method: "OPTIONS", origin: OTHER })); assert.equal(r.status, 403); assert.equal(r.headers.get("access-control-allow-origin"), null) })
test("disallowed-origin POST fails closed", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { origin: OTHER })); assert.equal(r.status, 403) })
test("wildcard origin configuration rejected", () => assert.throws(() => parseFlightAllowedOriginsV1("*")))
test("duplicate origin configuration rejected", () => assert.throws(() => parseFlightAllowedOriginsV1(`${ORIGIN},${ORIGIN}`)))
test("non-local HTTP origin rejected", () => assert.throws(() => parseFlightAllowedOriginsV1("http://example.com")))
test("local HTTP origin allowed", () => assert.deepEqual(parseFlightAllowedOriginsV1("http://localhost:5173"), ["http://localhost:5173"]))

test("malformed JSON is generic validation error", async () => { const r = await createHost().fetch(new Request(`https://api.hajiz.test${FLIGHT_HTTP_HOST_PATHS[0]}`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{" })); assert.equal(r.status, 400); const body = await json(r); assert.equal(body.error.code, "VALIDATION_ERROR"); assert.equal(JSON.stringify(body).includes("SyntaxError"), false) })
test("unsupported content type is rejected", async () => { const r = await createHost().fetch(new Request(`https://api.hajiz.test${FLIGHT_HTTP_HOST_PATHS[0]}`, { method: "POST", headers: { origin: ORIGIN, "content-type": "text/plain" }, body: "{}" })); assert.equal(r.status, 415); assert.equal((await json(r)).error.code, "UNSUPPORTED_MEDIA_TYPE") })
test("declared oversize body is rejected before handler", async () => { calls.length = 0; const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { headers: { "content-length": String(FLIGHT_HTTP_MAX_BODY_BYTES + 1) } })); assert.equal(r.status, 413); assert.equal(calls.length, 0) })
test("streamed oversize body is rejected", async () => { const r = await createHost({ maximumBodyBytes: 8 }).fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { body: { value: "0123456789" } })); assert.equal(r.status, 413) })

test("security headers present on success", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0])); assert.equal(r.headers.get("x-content-type-options"), "nosniff"); assert.equal(r.headers.get("referrer-policy"), "no-referrer"); assert.equal(r.headers.get("x-frame-options"), "DENY") })
test("no-store overrides handler headers", async () => { const custom = { ...handlers, search: async () => ({ status: 200, headers: { "cache-control": "public" }, body: { ok: true } }) }; const r = await createHost({ handlers: custom }).fetch(request(FLIGHT_HTTP_HOST_PATHS[0])); assert.equal(r.headers.get("cache-control"), "no-store") })
test("security headers cannot be weakened by a handler", async () => { const custom = { ...handlers, search: async () => ({ status: 200, headers: { "x-content-type-options": "off", "referrer-policy": "unsafe-url" }, body: { ok: true } }) }; const r = await createHost({ handlers: custom }).fetch(request(FLIGHT_HTTP_HOST_PATHS[0])); assert.equal(r.headers.get("x-content-type-options"), "nosniff"); assert.equal(r.headers.get("referrer-policy"), "no-referrer") })
test("safe inbound request ID retained", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { headers: { "x-request-id": "request_12345678" } })); assert.equal(r.headers.get("x-request-id"), "request_12345678") })
test("unsafe inbound request ID replaced", async () => { const r = await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { headers: { "x-request-id": "x".repeat(500) } })); assert.equal(r.headers.get("x-request-id"), fixedId()) })

test("Search handler composition receives AbortSignal", async () => { calls.length = 0; await createHost().fetch(request("/api/v1/flights/search")); assert.equal(calls[0].request.signal instanceof AbortSignal, true) })
test("Reprice handler composition exact", async () => { const r = await createHost().fetch(request("/api/v1/flights/reprice")); assert.equal((await json(r)).route, "/api/v1/flights/reprice") })
test("Checkout handler composition exact", async () => { const r = await createHost().fetch(request("/api/v1/flights/checkout/prepare")); assert.equal((await json(r)).route, "/api/v1/flights/checkout/prepare") })
test("Booking Intent handler composition exact", async () => { const r = await createHost().fetch(request("/api/v1/flights/booking-intents", { headers: { authorization: "Bearer synthetic" } })); assert.equal((await json(r)).route, "/api/v1/flights/booking-intents") })
test("Payment Initiation canonical path exact", async () => { const r = await createHost().fetch(request("/api/v1/flights/payment-initiation", { headers: { authorization: "Bearer synthetic" } })); assert.equal((await json(r)).route, "/api/v1/flights/payment-initiation") })
test("auth-required path refuses unauthenticated request", async () => { const r = await createHost().fetch(request("/api/v1/flights/booking-intents")); assert.equal(r.status, 401); assert.equal((await json(r)).error.code, "AUTH_REQUIRED") })

test("host timeout aborts dependency and remains 504", async () => { let observed; const slow = { ...handlers, search: request => new Promise(resolve => { observed = request.signal; request.signal.addEventListener("abort", () => resolve({ status: 504, body: { error: { code: "REQUEST_TIMEOUT" } } }), { once: true }) }) }; const r = await createHost({ handlers: slow, requestTimeoutMs: 5 }).fetch(request(FLIGHT_HTTP_HOST_PATHS[0])); assert.equal(observed.aborted, true); assert.equal(r.status, 504); assert.equal((await json(r)).error.code, "REQUEST_TIMEOUT") })
test("host timeout bounds raw body reading", async () => { const body = new ReadableStream({ start() {} }); const slowRequest = new Request(`https://api.hajiz.test${FLIGHT_HTTP_HOST_PATHS[0]}`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body, duplex: "half" }); const r = await createHost({ requestTimeoutMs: 5 }).fetch(slowRequest); assert.equal(r.status, 504); assert.equal((await json(r)).error.code, "REQUEST_TIMEOUT") })
test("client abort propagates", async () => { const controller = new AbortController(); let observed; const slow = { ...handlers, search: request => new Promise(() => { observed = request.signal }) }; const pending = createHost({ handlers: slow }).fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { signal: controller.signal })); setTimeout(() => controller.abort(), 5); const r = await pending; assert.equal(observed.aborted, true); assert.equal(r.status, 499) })
test("admission rejection returns 429 before handler", async () => { calls.length = 0; const admission = { implementation: "test-deny", admit: () => ({ allowed: false, retryAfterSeconds: 9 }) }; const r = await createHost({ admission }).fetch(request(FLIGHT_HTTP_HOST_PATHS[0])); assert.equal(r.status, 429); assert.equal(r.headers.get("retry-after"), "9"); assert.equal(calls.length, 0) })
test("bounded admission is not unbounded always-allow", () => { const admission = createBoundedInMemoryFlightAdmissionV1({ maximum: 1 }); assert.equal(admission.admit({ route: "a" }).allowed, true); assert.equal(admission.admit({ route: "a" }).allowed, false); assert.equal(admission.implementation, "single-instance-bounded-memory") })

test("logs contain only safe diagnostics", async () => { logs.length = 0; await createHost().fetch(request(FLIGHT_HTTP_HOST_PATHS[0], { headers: { authorization: "Bearer TOP_SECRET" }, body: { traveler: "PRIVATE" } })); assert.deepEqual(Object.keys(logs[0]), ["requestId", "route", "method", "status", "durationMs"]); assert.equal(/TOP_SECRET|PRIVATE|authorization|body/i.test(JSON.stringify(logs)), false) })
test("secret never appears in public failure", async () => { const custom = { ...handlers, search: async () => { throw new Error("sb_secret_private") } }; const r = await createHost({ handlers: custom }).fetch(request(FLIGHT_HTTP_HOST_PATHS[0])); assert.equal(JSON.stringify(await json(r)).includes("sb_secret_private"), false) })

test("owner resolver verifies bearer through Supabase Auth", async () => { let token; const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser(value) { token = value; return { data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null } } } } }); assert.deepEqual(await resolve({ headers: { authorization: "Bearer verified-user-token" } }), { ownerId: "11111111-1111-4111-8111-111111111111", source: "authenticated" }); assert.equal(token, "verified-user-token") })
test("owner resolver rejects missing token", async () => { const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser() { assert.fail("must not run") } } } }); assert.equal(await resolve({ headers: {} }), null) })
test("owner resolver rejects malformed bearer without Auth call", async () => { const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser() { assert.fail("must not run") } } } }); assert.equal(await resolve({ headers: { authorization: "Basic rejected" } }), null) })
test("owner resolver maps Auth 401 to invalid token", async () => { const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser() { return { data: { user: null }, error: { status: 401 } } } } } }); assert.equal(await resolve({ headers: { authorization: "Bearer rejected" } }), null) })
test("owner resolver maps Auth 403 to invalid token", async () => { const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser() { return { data: { user: null }, error: { status: 403 } } } } } }); assert.equal(await resolve({ headers: { authorization: "Bearer forbidden" } }), null) })
test("owner resolver classifies Auth network exception as unavailable", async () => { const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser() { throw new TypeError("fetch failed with token") } } } }); await assert.rejects(() => resolve({ headers: { authorization: "Bearer private-token" } }), failure => failure instanceof FlightOwnerContextResolverError && failure.code === "AUTH_VERIFICATION_UNAVAILABLE") })
test("owner resolver classifies Auth 5xx as unavailable", async () => { const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser() { return { data: { user: null }, error: { status: 503 } } } } } }); await assert.rejects(() => resolve({ headers: { authorization: "Bearer private-token" } }), failure => failure instanceof FlightOwnerContextResolverError && failure.code === "AUTH_VERIFICATION_UNAVAILABLE") })
test("owner resolver classifies malformed success as unavailable", async () => { const resolve = createSupabaseFlightOwnerContextResolverV1({ client: { auth: { async getUser() { return { data: { user: { id: "not-a-uuid" } }, error: null } } } } }); await assert.rejects(() => resolve({ headers: { authorization: "Bearer private-token" } }), failure => failure instanceof FlightOwnerContextResolverError && failure.code === "AUTH_VERIFICATION_UNAVAILABLE") })

const bookingAuthRequest = Object.freeze({
  method: "POST",
  body: Object.freeze({ contractVersion: "flight-booking-intent-request/v1", pricedSelectionId: `hpr_v1_${"a".repeat(40)}`, idempotencyKey: "hbi_req_auth_test_000001", travelers: Object.freeze([]), bookingContact: Object.freeze({}) }),
})
const paymentAuthRequest = Object.freeze({
  method: "POST",
  body: Object.freeze({ contractVersion: "flight-payment-initiation-request/v1", bookingIntentId: `hbi_v1_${"b".repeat(32)}`, paymentMethod: "bankak", idempotencyKey: "hpi_req_auth_test_000001" }),
})
const neverBookingService = Object.freeze({ async create() { assert.fail("booking service must not run") } })
const neverPaymentService = Object.freeze({ async initiate() { assert.fail("payment service must not run") } })
const publicAuthFailureIsSafe = value => !/AUTH_VERIFICATION_UNAVAILABLE|Supabase|private-token|stack/i.test(JSON.stringify(value))

test("Booking Intent maps null owner to 401 AUTH_REQUIRED", async () => { const handler = createCustomerFlightBookingIntentHttpHandlerV1({ service: neverBookingService, resolveOwnerContext: async () => null }); const value = await handler(bookingAuthRequest); assert.equal(value.status, 401); assert.equal(value.body.error.code, "AUTH_REQUIRED") })
test("Booking Intent maps Auth verifier unavailable to safe 503", async () => { const handler = createCustomerFlightBookingIntentHttpHandlerV1({ service: neverBookingService, resolveOwnerContext: async () => { throw new FlightOwnerContextResolverError() } }); const value = await handler(bookingAuthRequest); assert.equal(value.status, 503); assert.equal(value.body.error.code, "INTERNAL_ERROR"); assert.equal(value.body.error.message, "Authentication service is temporarily unavailable."); assert.equal(publicAuthFailureIsSafe(value), true) })
test("Booking Intent maps unknown resolver exception to safe 500", async () => { const handler = createCustomerFlightBookingIntentHttpHandlerV1({ service: neverBookingService, resolveOwnerContext: async () => { throw new Error("Supabase private-token stack") } }); const value = await handler(bookingAuthRequest); assert.equal(value.status, 500); assert.equal(value.body.error.code, "INTERNAL_ERROR"); assert.equal(publicAuthFailureIsSafe(value), true) })
test("Payment Initiation maps null owner to 401 AUTH_REQUIRED", async () => { const handler = createCustomerFlightPaymentInitiationHttpHandlerV1({ service: neverPaymentService, resolveOwnerContext: async () => null }); const value = await handler(paymentAuthRequest); assert.equal(value.status, 401); assert.equal(value.body.error.code, "AUTH_REQUIRED") })
test("Payment Initiation maps Auth verifier unavailable to safe 503", async () => { const handler = createCustomerFlightPaymentInitiationHttpHandlerV1({ service: neverPaymentService, resolveOwnerContext: async () => { throw new FlightOwnerContextResolverError() } }); const value = await handler(paymentAuthRequest); assert.equal(value.status, 503); assert.equal(value.body.error.code, "INTERNAL_ERROR"); assert.equal(value.body.error.message, "Authentication service is temporarily unavailable."); assert.equal(publicAuthFailureIsSafe(value), true) })
test("Payment Initiation maps unknown resolver exception to safe 500", async () => { const handler = createCustomerFlightPaymentInitiationHttpHandlerV1({ service: neverPaymentService, resolveOwnerContext: async () => { throw new Error("Supabase private-token stack") } }); const value = await handler(paymentAuthRequest); assert.equal(value.status, 500); assert.equal(value.body.error.code, "INTERNAL_ERROR"); assert.equal(publicAuthFailureIsSafe(value), true) })

const validEnv = () => ({
  NODE_ENV: "test",
  HAJIZ_FLIGHT_HOST_ENABLED: "true",
  HAJIZ_SUPABASE_URL: "https://project-ref.supabase.co",
  HAJIZ_SUPABASE_SECRET_KEY: "sb_secret_synthetic_host_test_only",
  HAJIZ_FLIGHT_TOKEN_SECRET: "flight-host-token-secret-at-least-32-characters",
  HAJIZ_ALLOWED_ORIGINS: ORIGIN,
})
test("server environment is fail-closed when disabled", () => assert.throws(() => readFlightServerEnvironmentV1({ ...validEnv(), HAJIZ_FLIGHT_HOST_ENABLED: "false" }), /FLIGHT_HOST_NOT_ENABLED/))
test("server environment requires secret", () => { const env = validEnv(); delete env.HAJIZ_SUPABASE_SECRET_KEY; assert.throws(() => readFlightServerEnvironmentV1(env), /HAJIZ_SUPABASE_SECRET_KEY_REQUIRED/) })
test("legacy server secret fallback supported", () => { const env = validEnv(); delete env.HAJIZ_SUPABASE_SECRET_KEY; env.HAJIZ_SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-synthetic-key"; assert.equal(readFlightServerEnvironmentV1(env).supabaseSecret, env.HAJIZ_SUPABASE_SERVICE_ROLE_KEY) })
test("server environment never uses VITE secret", () => { const env = validEnv(); delete env.HAJIZ_SUPABASE_SECRET_KEY; env.VITE_SUPABASE_SERVICE_ROLE_KEY = "forbidden"; assert.throws(() => readFlightServerEnvironmentV1(env), /HAJIZ_SUPABASE_SECRET_KEY_REQUIRED/) })

test("durability helper creates distinct server clients and adapters", () => { const configs = []; const factory = (_url, _key, options) => { const client = { auth: { getUser() {} }, async rpc() {} }; configs.push({ client, options }); return client }; const pair = createFlightDurabilityAdapterPairV1({ createClientImpl: factory, supabaseUrl: "https://project-ref.supabase.co", supabaseSecret: "synthetic-secret" }); assert.notEqual(pair.clientA, pair.clientB); assert.notEqual(pair.resolverA, pair.resolverB); assert.notEqual(pair.pricedStoreA, pair.pricedStoreB); assert.equal(pair.resolverA.durability, "supabase-private-persistence"); assert.equal(pair.pricedStoreA.durability, "supabase-private-persistence"); assert.deepEqual(configs[0].options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }) })

test("full composition builds canonical server host without process-local fallback", () => {
  const client = { rpc: async () => ({ data: null, error: null }), auth: { async getUser() { return { data: {}, error: {} } } } }
  const composition = createHajizFlightServerCompositionV1({
    env: validEnv(), createClientImpl: () => client,
    supplierAdapters: [createMockFlightSupplier({ env: { NODE_ENV: "test" } })], enabledProviderNames: ["mock"], defaultProviderName: "mock",
    supplierPolicy: { maxConcurrency: 1, supplierTimeoutMs: 100, requestTimeoutMs: 1_000 },
    pricingPolicy: {}, fxSnapshotsByPair: {}, rankingPolicy: {}, requestTimeoutMs: 500,
  })
  assert.equal(composition.contractVersion, "flight-server-composition/v1")
  assert.equal(typeof composition.fetch, "function")
  assert.equal(composition.safeConfiguration.admission, "single-instance-bounded-memory")
  assert.deepEqual(composition.safeConfiguration.supplierProviders, ["mock"])
  assert.equal(Object.hasOwn(composition, "client"), false)
})
test("production composition cannot enable synthetic supplier", () => { const env = { ...validEnv(), NODE_ENV: "production" }; assert.throws(() => createHajizFlightServerCompositionV1({ env, createClientImpl: () => ({ rpc() {}, auth: { getUser() {} } }), supplierAdapters: [createMockFlightSupplier({ env: { NODE_ENV: "test" } })], enabledProviderNames: ["mock"], defaultProviderName: "mock", supplierPolicy: {}, pricingPolicy: {}, fxSnapshotsByPair: {}, rankingPolicy: {} }), /non-production supplier is forbidden/) })
test("credential presence alone cannot enable supplier", () => assert.throws(() => createHajizFlightServerCompositionV1({ env: validEnv(), createClientImpl: () => ({ rpc() {}, auth: { getUser() {} } }), supplierAdapters: [], enabledProviderNames: [], supplierPolicy: {}, pricingPolicy: {}, fxSnapshotsByPair: {}, rankingPolicy: {} }), /explicit server supplier configuration/))

test("static server security boundaries", async () => {
  const files = await Promise.all(["../src/server/host/flightHttpHostV1.js", "../src/server/host/flightServerCompositionV1.js"].map(path => readFile(new URL(path, import.meta.url), "utf8")))
  const source = files.join("\n")
  assert.equal(/VITE_.*(?:SECRET|SERVICE)/.test(source), false)
  assert.equal(/sb_secret_[A-Za-z0-9]{20,}/.test(source), false)
  assert.equal(/\.from\(["']flight_(?:search|priced)_selections/.test(source), false)
  assert.equal(/createProcessLocalFlight/.test(source), false)
  assert.equal(/access-control-allow-origin["']\s*[:,]\s*["']\*/i.test(source), false)
  assert.equal(/logger\.info\([^)]*(?:authorization|request\.body)/i.test(source), false)
})
test("host modules are absent from browser imports", async () => { const files = await Promise.all(["../src/app/providers/AppProviders.jsx", "../src/app/router/AppRouter.jsx"].map(path => readFile(new URL(path, import.meta.url), "utf8"))); assert.equal(files.some(source => /flightServerComposition|flightHttpHost/.test(source)), false) })

let passed = 0
for (const { name, run } of tests) {
  try { await run(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
  catch (error) { process.stderr.write(`✗ ${name}\n`); throw error }
}
process.stdout.write(`\nFlight HTTP Host composition tests: ${passed}/${tests.length} PASS\n`)
