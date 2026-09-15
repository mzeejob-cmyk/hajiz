import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHajizFlightNodeApplicationV1, FLIGHT_NODE_HEALTH_PATH } from "../src/server/host/flightNodeApplicationV1.js"
import { closeHajizFlightNodeRuntimeV1, createHajizFlightNodeRuntimeV1, createMockBankakRuntimeConfigV1, createMockFlightRuntimeAuthoritiesV1, readFlightNodeBootstrapEnvironmentV1 } from "../src/server/host/flightNodeEntrypointV1.js"
import { createHajizFlightNodeHttpServerV1, listenHajizFlightNodeHttpServerV1 } from "../src/server/host/flightNodeHttpRuntimeV1.js"

const tests = []
const test = (name, run) => tests.push({ name, run })
let root

async function fixture() {
  root = await mkdtemp(join(tmpdir(), "hajiz-node-bootstrap-"))
  await mkdir(join(root, "assets"))
  await writeFile(join(root, "index.html"), "<!doctype html><main>HAJIZ SPA</main>")
  await writeFile(join(root, "assets", "app.js"), "globalThis.__HAJIZ_ASSET__=true")
  return root
}

function application(dist, calls = []) {
  return createHajizFlightNodeApplicationV1({
    distDirectory: dist,
    flightFetch: async request => {
      calls.push({ url: request.url, method: request.method, body: request.method === "POST" ? await request.text() : "" })
      return new Response(JSON.stringify({ api: true }), { status: 418, headers: { "content-type": "application/json", "x-request-id": "request_bootstrap_1" } })
    },
  })
}

async function withHttp(app, run) {
  const server = createHajizFlightNodeHttpServerV1({ fetchHandler: app.fetch })
  const bound = await listenHajizFlightNodeHttpServerV1({ server, host: "127.0.0.1", port: 0 })
  try { return await run(`http://127.0.0.1:${bound.port}`, server) }
  finally { await closeHajizFlightNodeRuntimeV1(server) }
}

test("health endpoint is non-sensitive liveness only", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request(`http://local${FLIGHT_NODE_HEALTH_PATH}`)); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: "ok" }); assert.equal(response.headers.get("cache-control"), "no-store") })
test("health endpoint rejects unsupported methods", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request(`http://local${FLIGHT_NODE_HEALTH_PATH}`, { method: "POST" })); assert.equal(response.status, 405) })
test("SPA root serves built index", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request("http://local/")); assert.match(await response.text(), /HAJIZ SPA/) })
test("SPA deep link falls back to built index", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request("http://local/flights")); assert.equal(response.status, 200); assert.match(await response.text(), /HAJIZ SPA/) })
test("static asset is served with immutable caching", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request("http://local/assets/app.js")); assert.equal(response.status, 200); assert.match(await response.text(), /HAJIZ_ASSET/); assert.match(response.headers.get("cache-control"), /immutable/) })
test("missing asset does not use SPA fallback", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request("http://local/assets/missing.js")); assert.equal(response.status, 404); assert.doesNotMatch(await response.text(), /HAJIZ SPA/) })
test("API routing always precedes SPA fallback", async () => { const dist = await fixture(); const calls = []; const response = await application(dist, calls).fetch(new Request("http://local/api/v1/flights/search", { method: "POST", body: "streamed" })); assert.equal(response.status, 418); assert.equal(calls[0].body, "streamed"); assert.equal(response.headers.get("x-request-id"), "request_bootstrap_1") })
test("unknown API path remains an API response", async () => { const dist = await fixture(); const calls = []; const response = await application(dist, calls).fetch(new Request("http://local/api/v1/flights/unknown", { method: "POST", body: "{}" })); assert.equal(response.status, 418); assert.equal(calls.length, 1); assert.doesNotMatch(await response.text(), /HAJIZ SPA/) })
test("API root without trailing slash never falls back to SPA", async () => { const dist = await fixture(); const calls = []; const response = await application(dist, calls).fetch(new Request("http://local/api/v1/flights")); assert.equal(response.status, 418); assert.equal(calls.length, 1); assert.doesNotMatch(await response.text(), /HAJIZ SPA/) })
test("unsupported browser-route method fails without API or SPA", async () => { const dist = await fixture(); const calls = []; const response = await application(dist, calls).fetch(new Request("http://local/flights", { method: "POST" })); assert.equal(response.status, 405); assert.equal(calls.length, 0) })
test("HEAD static request has no body", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request("http://local/assets/app.js", { method: "HEAD" })); assert.equal(response.status, 200); assert.equal(await response.text(), "") })
test("encoded traversal cannot escape dist", async () => { const dist = await fixture(); const response = await application(dist).fetch(new Request("http://local/%2e%2e/package.json")); assert.equal(response.status, 404) })
test("secret-safe static failure reveals no filesystem path", async () => { const dist = await fixture(); await rm(join(dist, "index.html")); const response = await application(dist).fetch(new Request("http://local/deep")); const body = await response.text(); assert.equal(response.status, 503); assert.equal(body.includes(dist), false) })
test("Node HTTP process serves health, SPA, asset and API on one origin", async () => { const dist = await fixture(); const calls = []; await withHttp(application(dist, calls), async base => { assert.equal((await fetch(`${base}/healthz`)).status, 200); assert.match(await (await fetch(`${base}/flights`)).text(), /HAJIZ SPA/); assert.match(await (await fetch(`${base}/assets/app.js`)).text(), /HAJIZ_ASSET/); assert.equal((await fetch(`${base}/api/v1/flights/search`, { method: "POST", body: "{}" })).status, 418) }) })
test("graceful close stops accepting new connections", async () => { const dist = await fixture(); const app = application(dist); const server = createHajizFlightNodeHttpServerV1({ fetchHandler: app.fetch }); const bound = await listenHajizFlightNodeHttpServerV1({ server, host: "127.0.0.1", port: 0 }); await closeHajizFlightNodeRuntimeV1(server); assert.equal(server.listening, false); await assert.rejects(() => fetch(`http://127.0.0.1:${bound.port}/healthz`)) })

const validEnv = () => ({ NODE_ENV: "staging", PORT: "8080", HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" })
test("bootstrap binds provider port, container host and restart-safe authority TTL", () => assert.deepEqual(readFlightNodeBootstrapEnvironmentV1(validEnv()), { host: "0.0.0.0", port: 8080, supplierMode: "mock", mockAuthorityTtlSeconds: 21_600 }))
test("local port default is available outside production", () => assert.equal(readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "test", HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }).port, 3000))
test("runtime environment must be explicit", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }), /NODE_ENV_REQUIRED/))
test("production requires assigned port", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "production", HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }), /PORT_REQUIRED/))
test("production refuses synthetic supplier even with port", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "production", PORT: "8080", HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }), /PRODUCTION_SUPPLIER_CONFIGURATION_FORBIDDEN/))
test("supplier mode is explicit and fail closed", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "staging", PORT: "8080" }), /HAJIZ_FLIGHT_SUPPLIER_MODE_REQUIRED/))
test("unsupported supplier mode is rejected", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "staging", PORT: "8080", HAJIZ_FLIGHT_SUPPLIER_MODE: "travelport" }), /HAJIZ_FLIGHT_SUPPLIER_MODE_REQUIRED/))
test("mock runtime remains valid after the removed fixed calendar expiry", () => {
  const now = Date.parse("2030-01-01T00:00:00.000Z")
  const authorities = createMockFlightRuntimeAuthoritiesV1({ clock: () => now })
  assert.equal(authorities.pricingPolicy.contractVersion, "pricing-policy/v1")
  assert.deepEqual(Object.keys(authorities.fxSnapshotsByPair).sort(), ["AED_USD", "USD_AED"])
  assert.equal(authorities.rankingPolicy.contractVersion, "flight-ranking-policy/v1")
  assert.equal(authorities.pricingPolicy.validUntil, "2030-01-01T06:00:00.000Z")
})
test("configured TTL creates internally consistent pricing, FX and ranking windows", () => {
  const now = Date.parse("2031-02-03T04:05:06.000Z")
  const authorities = createMockFlightRuntimeAuthoritiesV1({ clock: () => now, ttlSeconds: 3_600 })
  const expected = "2031-02-03T05:05:06.000Z"
  assert.equal(authorities.pricingPolicy.validUntil, expected)
  assert.equal(authorities.rankingPolicy.validUntil, expected)
  assert.equal(authorities.fxSnapshotsByPair.AED_USD.expiresAt, expected)
  assert.equal(authorities.fxSnapshotsByPair.USD_AED.expiresAt, expected)
})
test("staging Node runtime composes after the retired fixed expiry using an injected clock", async () => {
  const dist = await fixture()
  const runtime = await createHajizFlightNodeRuntimeV1({
    distDirectory: dist,
    clock: () => Date.parse("2032-03-04T05:06:07.000Z"),
    env: {
      ...validEnv(),
      HAJIZ_FLIGHT_HOST_ENABLED: "true",
      HAJIZ_SUPABASE_URL: "https://runtime-test.invalid",
      HAJIZ_SUPABASE_SECRET_KEY: "synthetic_server_key_for_tests_only",
      HAJIZ_FLIGHT_TOKEN_SECRET: "synthetic-flight-token-secret-0000000000000000",
      HAJIZ_ALLOWED_ORIGINS: "http://localhost:5173",
    },
  })
  assert.equal(runtime.bootstrap.mockAuthorityTtlSeconds, 21_600)
  assert.equal(runtime.server.listening, false)
})
for (const value of ["0", "-1", "NaN", "300.5", " 3600", "86401", "999999999999999999999"]) {
  test(`invalid mock authority TTL fails closed: ${JSON.stringify(value)}`, () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ ...validEnv(), HAJIZ_MOCK_AUTHORITY_TTL_SECONDS: value }), /HAJIZ_MOCK_AUTHORITY_TTL_SECONDS_INVALID/))
}
test("minimum and maximum mock authority TTL bounds are accepted", () => {
  assert.equal(readFlightNodeBootstrapEnvironmentV1({ ...validEnv(), HAJIZ_MOCK_AUTHORITY_TTL_SECONDS: "300" }).mockAuthorityTtlSeconds, 300)
  assert.equal(readFlightNodeBootstrapEnvironmentV1({ ...validEnv(), HAJIZ_MOCK_AUTHORITY_TTL_SECONDS: "86400" }).mockAuthorityTtlSeconds, 86_400)
})
test("authority factory rejects invalid TTL and clock values", () => {
  assert.throws(() => createMockFlightRuntimeAuthoritiesV1({ ttlSeconds: 0 }), /HAJIZ_MOCK_AUTHORITY_TTL_SECONDS_INVALID/)
  assert.throws(() => createMockFlightRuntimeAuthoritiesV1({ clock: () => Number.NaN }), /MOCK_FLIGHT_AUTHORITY_CLOCK_INVALID/)
})
test("mock Bankak runtime is visibly staging-only and masked", () => {
  const config = createMockBankakRuntimeConfigV1()
  assert.match(config.bankAccountDisplayName, /Staging.*TEST ONLY/)
  assert.equal(config.maskedAccountNumber, "****0000")
  assert.equal(config.receiptUploadAvailable, true)
})
test("mock Bankak conversion is deterministic AED to synthetic SDG", async () => {
  const config = createMockBankakRuntimeConfigV1()
  assert.equal(await config.amountSdgResolver({ amount: "1100.00", currency: "AED" }), "1100000.00")
})
test("mock Bankak conversion fails closed for unsupported currency", async () => {
  await assert.rejects(() => createMockBankakRuntimeConfigV1().amountSdgResolver({ amount: "1100.00", currency: "USD" }), /MOCK_BANKAK_PRICE_UNSUPPORTED/)
})
test("mock Bankak conversion fails closed for non-canonical amount", async () => {
  await assert.rejects(() => createMockBankakRuntimeConfigV1().amountSdgResolver({ amount: "1100", currency: "AED" }), /MOCK_BANKAK_PRICE_UNSUPPORTED/)
})
test("server runtime source contains no VITE credential use", async () => { const sources = await Promise.all(["../src/server/host/flightNodeApplicationV1.js", "../src/server/host/flightNodeEntrypointV1.js"].map(path => import("node:fs/promises").then(({ readFile }) => readFile(new URL(path, import.meta.url), "utf8")))); assert.equal(/VITE_.*(?:SECRET|TOKEN|KEY)/i.test(sources.join("\n")), false) })
test("startup errors and logs cannot serialize environment or request data", async () => { const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/server/host/flightNodeEntrypointV1.js", import.meta.url), "utf8")); assert.equal(/JSON\.stringify\((?:process\.env|error)\)|authorization|request\.body/i.test(source), false) })

let passed = 0
try {
  for (const { name, run } of tests) {
    try { await run(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
    catch (error) { process.stderr.write(`✗ ${name}\n`); throw error }
    finally { if (root) { await rm(root, { recursive: true, force: true }); root = undefined } }
  }
} finally { if (root) await rm(root, { recursive: true, force: true }) }
process.stdout.write(`\nFlight Node bootstrap tests: ${passed}/${tests.length} PASS\n`)
