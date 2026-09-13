import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { createMockFlightSupplier } from "../suppliers/mockFlightSupplier.js"
import { createFlightRankingPolicyV1 } from "../pricing/flightRankingV1.js"
import { createFxSnapshotV1, createPricingPolicyV1 } from "../pricing/pricingFxV1.js"
import { createHajizFlightServerCompositionV1 } from "./flightServerCompositionV1.js"
import { assertFlightNodeDistV1, createHajizFlightNodeApplicationV1 } from "./flightNodeApplicationV1.js"
import { createHajizFlightNodeHttpServerV1, listenHajizFlightNodeHttpServerV1 } from "./flightNodeHttpRuntimeV1.js"

export const FLIGHT_NODE_ENTRYPOINT_VERSION = "flight-node-entrypoint/v1"
const DEFAULT_PORT = 3000
const DEFAULT_HOST = "0.0.0.0"
const MOCK_AUTHORITY_EXPIRES_AT = "2026-09-15T06:20:00.000Z"
const MOCK_BANKAK_SDG_PER_AED = 1_000n

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

export function createMockFlightRuntimeAuthoritiesV1({ clock = Date.now } = {}) {
  const now = clock()
  required(Number.isFinite(now) && now < Date.parse(MOCK_AUTHORITY_EXPIRES_AT), "MOCK_FLIGHT_AUTHORITY_EXPIRED")
  const fetchedAt = new Date(now - 60_000).toISOString()
  const effectiveAt = new Date(now - 30_000).toISOString()
  const validFrom = new Date(now - 60_000).toISOString()
  const fx = (baseCurrency, quoteCurrency, referenceRate) => createFxSnapshotV1({
    contractVersion: "fx-snapshot/v1",
    snapshotId: `hfx_mock_${baseCurrency}_${quoteCurrency}_v1`,
    baseCurrency,
    quoteCurrency,
    referenceRate,
    source: "hajiz_mock_runtime",
    bufferPct: "0",
    volatilityGuardPct: "20",
    observedVolatilityPct: "0",
    fetchedAt,
    effectiveAt,
    expiresAt: MOCK_AUTHORITY_EXPIRES_AT,
    policyVersion: "mock-fx-runtime-v1",
  })
  return Object.freeze({
    pricingPolicy: createPricingPolicyV1({
      contractVersion: "pricing-policy/v1",
      pricingPolicyVersion: "mock-pricing-runtime-v1",
      marginPct: "10",
      maxMarginPct: "10",
      partnerCommissionRatePct: "0",
      agentUpliftAmountUsd: "0",
      maxAgentUpliftAmountUsd: "0",
      validFrom,
      validUntil: MOCK_AUTHORITY_EXPIRES_AT,
    }),
    fxSnapshotsByPair: Object.freeze({
      AED_USD: fx("AED", "USD", "0.272294"),
      USD_AED: fx("USD", "AED", "3.6725"),
    }),
    rankingPolicy: createFlightRankingPolicyV1({
      contractVersion: "flight-ranking-policy/v1",
      rankingPolicyVersion: "mock-ranking-runtime-v1",
      mode: "price_only",
      validFrom,
      validUntil: MOCK_AUTHORITY_EXPIRES_AT,
    }),
  })
}

export function createMockBankakRuntimeConfigV1() {
  return Object.freeze({
    bankAccountDisplayName: "HAJIZ Staging Bankak — TEST ONLY",
    maskedAccountNumber: "****0000",
    receiptUploadAvailable: true,
    async amountSdgResolver(customerPrice) {
      const match = typeof customerPrice?.amount === "string" && customerPrice.currency === "AED"
        ? customerPrice.amount.match(/^([1-9]\d*)\.(\d{2})$/)
        : null
      required(match, "MOCK_BANKAK_PRICE_UNSUPPORTED")
      const amountMinor = BigInt(match[1]) * 100n + BigInt(match[2])
      const sdgMinor = amountMinor * MOCK_BANKAK_SDG_PER_AED
      return `${sdgMinor / 100n}.${String(sdgMinor % 100n).padStart(2, "0")}`
    },
  })
}

export async function createHajizFlightNodeRuntimeV1({ env = process.env, distDirectory = resolve(process.cwd(), "dist"), logger } = {}) {
  const bootstrap = readFlightNodeBootstrapEnvironmentV1(env)
  const root = await assertFlightNodeDistV1(distDirectory)
  const authorities = createMockFlightRuntimeAuthoritiesV1()
  const bankakConfig = createMockBankakRuntimeConfigV1()
  const composition = createHajizFlightServerCompositionV1({
    env,
    supplierAdapters: [createMockFlightSupplier({ env })],
    enabledProviderNames: [bootstrap.supplierMode],
    defaultProviderName: bootstrap.supplierMode,
    supplierPolicy: { maxConcurrency: 1, supplierTimeoutMs: 5_000, requestTimeoutMs: 12_000 },
    pricingPolicy: authorities.pricingPolicy,
    fxSnapshotsByPair: authorities.fxSnapshotsByPair,
    rankingPolicy: authorities.rankingPolicy,
    bankakConfig,
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
