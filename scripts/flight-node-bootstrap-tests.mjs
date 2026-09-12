import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHajizFlightNodeApplicationV1, FLIGHT_NODE_HEALTH_PATH } from "../src/server/host/flightNodeApplicationV1.js"
import { closeHajizFlightNodeRuntimeV1, readFlightNodeBootstrapEnvironmentV1 } from "../src/server/host/flightNodeEntrypointV1.js"
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
test("bootstrap binds provider port and container host", () => assert.deepEqual(readFlightNodeBootstrapEnvironmentV1(validEnv()), { host: "0.0.0.0", port: 8080, supplierMode: "mock" }))
test("local port default is available outside production", () => assert.equal(readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "test", HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }).port, 3000))
test("runtime environment must be explicit", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }), /NODE_ENV_REQUIRED/))
test("production requires assigned port", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "production", HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }), /PORT_REQUIRED/))
test("production refuses synthetic supplier even with port", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "production", PORT: "8080", HAJIZ_FLIGHT_SUPPLIER_MODE: "mock" }), /PRODUCTION_SUPPLIER_CONFIGURATION_FORBIDDEN/))
test("supplier mode is explicit and fail closed", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "staging", PORT: "8080" }), /HAJIZ_FLIGHT_SUPPLIER_MODE_REQUIRED/))
test("unsupported supplier mode is rejected", () => assert.throws(() => readFlightNodeBootstrapEnvironmentV1({ NODE_ENV: "staging", PORT: "8080", HAJIZ_FLIGHT_SUPPLIER_MODE: "travelport" }), /HAJIZ_FLIGHT_SUPPLIER_MODE_REQUIRED/))
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
