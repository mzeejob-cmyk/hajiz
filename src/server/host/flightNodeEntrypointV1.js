import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { createMockFlightSupplier } from "../suppliers/mockFlightSupplier.js"
import { createHajizFlightServerCompositionV1 } from "./flightServerCompositionV1.js"
import { assertFlightNodeDistV1, createHajizFlightNodeApplicationV1 } from "./flightNodeApplicationV1.js"
import { createHajizFlightNodeHttpServerV1, listenHajizFlightNodeHttpServerV1 } from "./flightNodeHttpRuntimeV1.js"

export const FLIGHT_NODE_ENTRYPOINT_VERSION = "flight-node-entrypoint/v1"
const DEFAULT_PORT = 3000
const DEFAULT_HOST = "0.0.0.0"

const required = (condition, code) => { if (!condition) throw new Error(code) }

export function readFlightNodeBootstrapEnvironmentV1(env = process.env) {
  required(["development", "test", "staging", "production"].includes(env.NODE_ENV), "NODE_ENV_REQUIRED")
  const production = env.NODE_ENV === "production"
  const port = env.PORT === undefined && !production ? DEFAULT_PORT : Number(env.PORT)
  required(Number.isInteger(port) && port > 0 && port <= 65_535, "PORT_REQUIRED")
  const host = env.HOST ?? DEFAULT_HOST
  required(typeof host === "string" && host.length > 0 && !/[/\\\s]/.test(host), "HOST_INVALID")
  required(env.HAJIZ_FLIGHT_SUPPLIER_MODE === "mock", "HAJIZ_FLIGHT_SUPPLIER_MODE_REQUIRED")
  required(!production, "PRODUCTION_SUPPLIER_CONFIGURATION_FORBIDDEN")
  return Object.freeze({ host, port, supplierMode: "mock" })
}

export async function createHajizFlightNodeRuntimeV1({ env = process.env, distDirectory = resolve(process.cwd(), "dist"), logger } = {}) {
  const bootstrap = readFlightNodeBootstrapEnvironmentV1(env)
  const root = await assertFlightNodeDistV1(distDirectory)
  const composition = createHajizFlightServerCompositionV1({
    env,
    supplierAdapters: [createMockFlightSupplier({ env })],
    enabledProviderNames: [bootstrap.supplierMode],
    defaultProviderName: bootstrap.supplierMode,
    supplierPolicy: { maxConcurrency: 1, supplierTimeoutMs: 5_000, requestTimeoutMs: 12_000 },
    pricingPolicy: {},
    fxSnapshotsByPair: {},
    rankingPolicy: {},
    logger,
  })
  const application = createHajizFlightNodeApplicationV1({ flightFetch: composition.fetch, distDirectory: root })
  const server = createHajizFlightNodeHttpServerV1({ fetchHandler: application.fetch, logger })
  return Object.freeze({ server, application, composition, bootstrap })
}

export async function startHajizFlightNodeRuntimeV1(options = {}) {
  const runtime = await createHajizFlightNodeRuntimeV1(options)
  const bound = await listenHajizFlightNodeHttpServerV1({ server: runtime.server, host: runtime.bootstrap.host, port: runtime.bootstrap.port })
  return Object.freeze({ ...runtime, bound })
}

export async function closeHajizFlightNodeRuntimeV1(server) {
  if (!server?.listening) return
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
}

async function main() {
  const safeLogger = Object.freeze({
    info(event) { process.stdout.write(`${JSON.stringify(event)}\n`) },
    error(event) { process.stderr.write(`${JSON.stringify(event)}\n`) },
  })
  const runtime = await startHajizFlightNodeRuntimeV1({ logger: safeLogger })
  safeLogger.info({ event: "flight_node_runtime_listening", host: runtime.bound.address, port: runtime.bound.port })
  let stopping = false
  const shutdown = async signal => {
    if (stopping) return
    stopping = true
    safeLogger.info({ event: "flight_node_runtime_stopping", signal })
    try { await closeHajizFlightNodeRuntimeV1(runtime.server); process.exitCode = 0 }
    catch { process.exitCode = 1 }
  }
  process.once("SIGTERM", () => void shutdown("SIGTERM"))
  process.once("SIGINT", () => void shutdown("SIGINT"))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${JSON.stringify({ event: "flight_node_runtime_start_failed", errorClass: typeof error?.name === "string" ? error.name.slice(0, 80) : "Error" })}\n`)
    process.exitCode = 1
  })
}
