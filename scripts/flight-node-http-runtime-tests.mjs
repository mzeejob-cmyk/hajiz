import assert from "node:assert/strict"
import { request as nodeRequest } from "node:http"
import { readFile } from "node:fs/promises"
import { createHajizFlightHttpHostV1 } from "../src/server/host/flightHttpHostV1.js"
import { createHajizFlightNodeHttpServerV1, FLIGHT_NODE_HTTP_INTERNAL_ORIGIN, listenHajizFlightNodeHttpServerV1 } from "../src/server/host/flightNodeHttpRuntimeV1.js"

const tests = []
const test = (name, run) => tests.push({ name, run })
const ORIGIN = "https://app.hajiz.test"
const routes = Object.freeze({
  search: "/api/v1/flights/search",
  reprice: "/api/v1/flights/reprice",
  checkout: "/api/v1/flights/checkout/prepare",
  bookingIntent: "/api/v1/flights/booking-intents",
  paymentInitiation: "/api/v1/flights/payment-initiation",
})
const calls = []
const handlers = Object.freeze(Object.fromEntries(Object.entries(routes).map(([key, path]) => [key, async request => {
  calls.push({ key, request })
  if (["bookingIntent", "paymentInitiation"].includes(key) && !request.headers.authorization) return { status: 401, body: { error: { code: "AUTH_REQUIRED" } } }
  return { status: 200, body: { ok: true, route: path, body: request.body } }
}])) )
const host = createHajizFlightHttpHostV1({ handlers, allowedOrigins: [ORIGIN], requestIdFactory: () => "hreq_node_test_0001", requestTimeoutMs: 500 })

async function withServer(fetchHandler, run, options) {
  const server = createHajizFlightNodeHttpServerV1({ fetchHandler, nodeOptions: options })
  const bound = await listenHajizFlightNodeHttpServerV1({ server, host: "127.0.0.1", port: 0 })
  try { return await run({ server, bound, base: `http://127.0.0.1:${bound.port}` }) }
  finally { if (server.listening) await new Promise(resolve => server.close(resolve)) }
}

function raw({ port, path, method = "POST", headers = {}, chunks = [] }) {
  return new Promise((resolve, reject) => {
    const request = nodeRequest({ hostname: "127.0.0.1", port, path, method, headers }, response => {
      const body = []
      response.on("data", chunk => body.push(chunk))
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(body).toString("utf8") }))
    })
    request.on("error", reject)
    for (const chunk of chunks) request.write(chunk)
    request.end()
  })
}

test("factory rejects missing fetch handler", () => assert.throws(() => createHajizFlightNodeHttpServerV1()))
test("factory rejects invalid logger", () => assert.throws(() => createHajizFlightNodeHttpServerV1({ fetchHandler: async () => new Response(), logger: {} })))
test("factory returns an unbound Node server", () => { const server = createHajizFlightNodeHttpServerV1({ fetchHandler: host.fetch }); assert.equal(server.listening, false); server.close() })
test("explicit ephemeral listen and clean close", async () => withServer(host.fetch, async ({ server, bound }) => { assert.equal(server.listening, true); assert.ok(bound.port > 0); assert.equal(bound.address, "127.0.0.1") }))
test("listen rejects invalid host", async () => assert.rejects(() => listenHajizFlightNodeHttpServerV1({ server: {}, host: "", port: 0 })))
test("listen rejects invalid port", async () => assert.rejects(() => listenHajizFlightNodeHttpServerV1({ server: {}, host: "127.0.0.1", port: 65536 })))

for (const [key, path] of Object.entries(routes)) test(`${key} POST reaches canonical handler`, async () => withServer(host.fetch, async ({ base }) => {
  calls.length = 0
  const protectedRoute = ["bookingIntent", "paymentInitiation"].includes(key)
  const response = await fetch(base + path, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...(protectedRoute ? { authorization: "Bearer synthetic" } : {}) }, body: JSON.stringify({ marker: key }) })
  assert.equal(response.status, 200)
  assert.equal(calls[0].key, key)
  assert.deepEqual(calls[0].request.body, { marker: key })
}))

test("unknown path retains canonical 404", async () => withServer(host.fetch, async ({ base }) => { const response = await fetch(base + "/api/v1/flights/unknown", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" }); assert.equal(response.status, 404); assert.equal((await response.json()).error.code, "NOT_FOUND") }))
test("GET retains canonical 405", async () => withServer(host.fetch, async ({ base }) => { const response = await fetch(base + routes.search); assert.equal(response.status, 405) }))
test("OPTIONS retains canonical 204 without body", async () => withServer(host.fetch, async ({ base }) => { const response = await fetch(base + routes.search, { method: "OPTIONS", headers: { origin: ORIGIN, "access-control-request-method": "POST" } }); assert.equal(response.status, 204); assert.equal(await response.text(), "") }))
test("unsupported CORS request header remains rejected", async () => withServer(host.fetch, async ({ base }) => { const response = await fetch(base + routes.search, { method: "OPTIONS", headers: { origin: ORIGIN, "access-control-request-method": "POST", "access-control-request-headers": "content-type, x-unsafe" } }); assert.equal(response.status, 400) }))
test("origin, content type and request ID reach the host", async () => withServer(host.fetch, async ({ base }) => { const response = await fetch(base + routes.search, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", "x-request-id": "request_12345678" }, body: "{}" }); assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN); assert.equal(response.headers.get("x-request-id"), "request_12345678"); assert.match(response.headers.get("content-type"), /application\/json/) }))
test("Authorization is forwarded only when supplied", async () => withServer(host.fetch, async ({ base }) => { calls.length = 0; await fetch(base + routes.bookingIntent, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", authorization: "Bearer synthetic" }, body: "{}" }); assert.equal(calls[0].request.headers.authorization, "Bearer synthetic"); const missing = await fetch(base + routes.bookingIntent, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" }); assert.equal(missing.status, 401) }))
test("untrusted Host cannot alter internal URL authority", async () => withServer(async request => new Response(JSON.stringify({ origin: new URL(request.url).origin, host: request.headers.get("host") }), { headers: { "content-type": "application/json" } }), async ({ bound }) => { const response = await raw({ port: bound.port, path: routes.search, headers: { host: "attacker.invalid", "content-type": "application/json" }, chunks: ["{}"] }); const body = JSON.parse(response.text); assert.equal(body.origin, FLIGHT_NODE_HTTP_INTERNAL_ORIGIN); assert.equal(body.host, null) }))
test("forwarded proxy headers do not become authority", async () => withServer(async request => new Response(JSON.stringify({ origin: new URL(request.url).origin, forwardedHost: request.headers.get("x-forwarded-host"), forwardedProto: request.headers.get("x-forwarded-proto") })), async ({ bound }) => { const response = await raw({ port: bound.port, path: routes.search, headers: { host: "local.invalid", "x-forwarded-host": "attacker.invalid", "x-forwarded-proto": "https", "content-type": "application/json" }, chunks: ["{}"] }); assert.deepEqual(JSON.parse(response.text), { origin: FLIGHT_NODE_HTTP_INTERNAL_ORIGIN, forwardedHost: null, forwardedProto: null }) }))
test("absolute-form request target fails safely", async () => withServer(host.fetch, async ({ bound }) => { const response = await raw({ port: bound.port, path: "http://attacker.invalid/api/v1/flights/search", headers: { "content-type": "application/json" }, chunks: ["{}"] }); assert.equal(response.status, 500); assert.equal(JSON.parse(response.text).error.code, "INTERNAL_ERROR") }))

test("malformed JSON remains canonical 400", async () => withServer(host.fetch, async ({ base }) => { const response = await fetch(base + routes.search, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{" }); assert.equal(response.status, 400) }))
test("wrong content type remains canonical 415", async () => withServer(host.fetch, async ({ base }) => { const response = await fetch(base + routes.search, { method: "POST", headers: { origin: ORIGIN, "content-type": "text/plain" }, body: "{}" }); assert.equal(response.status, 415) }))
test("declared oversize remains canonical 413", async () => withServer(host.fetch, async ({ bound }) => { const response = await raw({ port: bound.port, path: routes.search, headers: { origin: ORIGIN, "content-type": "application/json", "content-length": String(33 * 1024) } }); assert.equal(response.status, 413) }))
test("chunked oversize remains canonical 413", async () => withServer(host.fetch, async ({ bound }) => { const response = await raw({ port: bound.port, path: routes.search, headers: { origin: ORIGIN, "content-type": "application/json" }, chunks: ["x".repeat(33 * 1024)] }); assert.equal(response.status, 413) }))
test("adapter streams body without pre-parsing JSON", async () => withServer(async request => new Response(await request.text()), async ({ bound }) => { const response = await raw({ port: bound.port, path: routes.search, headers: { "content-type": "application/json" }, chunks: ["{", "not-json"] }); assert.equal(response.text, "{not-json") }))

test("response status, headers, body and Retry-After are preserved", async () => withServer(async () => new Response(JSON.stringify({ safe: true }), { status: 429, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-request-id": "request_87654321", "retry-after": "7", "access-control-allow-origin": ORIGIN } }), async ({ base }) => { const response = await fetch(base + routes.search, { method: "POST", body: "{}" }); assert.equal(response.status, 429); assert.deepEqual(await response.json(), { safe: true }); assert.equal(response.headers.get("retry-after"), "7"); assert.equal(response.headers.get("x-request-id"), "request_87654321"); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN) }))
test("bridge failure is generic and redacted", async () => withServer(async () => { throw new Error("sb_secret_private Authorization traveler body stack") }, async ({ base }) => { const response = await fetch(base + routes.search, { method: "POST", headers: { authorization: "Bearer private" }, body: "PRIVATE_BODY" }); const text = await response.text(); assert.equal(response.status, 500); assert.equal(/sb_secret|Authorization|private|traveler|stack|PRIVATE_BODY/.test(text), false); assert.equal(JSON.parse(text).error.code, "INTERNAL_ERROR"); assert.equal(response.headers.get("x-frame-options"), "DENY") }))
test("malformed trusted response is generic 500", async () => withServer(async () => ({ status: 200 }), async ({ base }) => { const response = await fetch(base + routes.search, { method: "POST", body: "{}" }); assert.equal(response.status, 500) }))

test("client disconnect aborts Web Request signal", async () => {
  let observedResolve
  const observed = new Promise(resolve => { observedResolve = resolve })
  let reachedResolve
  const reached = new Promise(resolve => { reachedResolve = resolve })
  await withServer(request => new Promise(resolve => { reachedResolve(); request.signal.addEventListener("abort", () => { observedResolve(request.signal.aborted); resolve(new Response(null, { status: 499 })) }, { once: true }) }), async ({ bound }) => {
    const outgoing = nodeRequest({ hostname: "127.0.0.1", port: bound.port, path: routes.search, method: "POST", headers: { "content-type": "application/json" } })
    outgoing.on("error", () => {})
    outgoing.write("{")
    await reached
    outgoing.destroy()
    assert.equal(await Promise.race([observed, new Promise((_, reject) => setTimeout(() => reject(new Error("abort timeout")), 500))]), true)
  })
})
test("normal completed request is not marked aborted", async () => { let signal; await withServer(async request => { signal = request.signal; return new Response("ok") }, async ({ base }) => { assert.equal(await (await fetch(base + routes.search, { method: "POST", body: "{}" })).text(), "ok"); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(signal.aborted, false) }) })

for (const [key, value] of Object.entries({ headersTimeout: 999, requestTimeout: 120001, keepAliveTimeout: 99, maxHeaderSize: 1000 })) test(`rejects invalid ${key}`, () => assert.throws(() => createHajizFlightNodeHttpServerV1({ fetchHandler: host.fetch, nodeOptions: { [key]: value } })))
test("rejects unknown Node transport option", () => assert.throws(() => createHajizFlightNodeHttpServerV1({ fetchHandler: host.fetch, nodeOptions: { unknown: 1 } })))
test("accepted transport bounds are applied", () => { const server = createHajizFlightNodeHttpServerV1({ fetchHandler: host.fetch, nodeOptions: { headersTimeout: 2_000, requestTimeout: 3_000, keepAliveTimeout: 500, maxHeaderSize: 8_192 } }); assert.equal(server.headersTimeout, 2_000); assert.equal(server.requestTimeout, 3_000); assert.equal(server.keepAliveTimeout, 500); server.close() })

test("runtime source uses built-in Node modules and no framework", async () => { const source = await readFile(new URL("../src/server/host/flightNodeHttpRuntimeV1.js", import.meta.url), "utf8"); assert.match(source, /node:http/); assert.match(source, /Readable\.toWeb/); assert.match(source, /duplex: "half"/); assert.equal(/express|fastify|koa|hono|body-parser|VITE_.*(?:SECRET|SERVICE_ROLE)/i.test(source), false); assert.equal(/request\.text\(\)|JSON\.parse\([^)]*request/i.test(source), false) })
test("browser source contains no Node runtime import", async () => { const files = await Promise.all(["../src/app/App.jsx", "../src/features/flights/api/flightBrowserHttpTransportsV1.js"].map(path => readFile(new URL(path, import.meta.url), "utf8"))); assert.equal(files.some(source => /node:http|node:stream|flightNodeHttpRuntimeV1/.test(source)), false) })
test("package dependency set contains no added web framework", async () => { const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")); assert.equal(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some(name => /^(express|fastify|koa|hono|body-parser)$/.test(name)), false) })

let passed = 0
for (const { name, run } of tests) {
  try { await run(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
  catch (error) { process.stderr.write(`✗ ${name}\n`); throw error }
}
process.stdout.write(`\nFlight Node HTTP runtime tests: ${passed}/${tests.length} PASS\n`)
