import { assertFlightOfferV1 } from "./flightOfferV1.js"
import { validateSearchRequest } from "./flightSupplierContract.js"
import { createMultiSupplierSearchPolicy } from "./multiSupplierSearchPolicy.js"
import { NOOP_SEARCH_TELEMETRY, assertSearchTelemetrySink, createSafeTelemetryEvent } from "./searchTelemetry.js"

export const MULTI_SUPPLIER_SEARCH_CONTRACT_VERSION = "multi-supplier-flight-search/v1"
export const MULTI_SUPPLIER_SEARCH_STATUSES = Object.freeze(["COMPLETE", "PARTIAL", "UNAVAILABLE"])
export const SUPPLIER_SEARCH_OUTCOMES = Object.freeze(["success", "no_results", "timeout", "error", "invalid_response"])

const CLIENT_SUPPLIER_FIELDS = Object.freeze([
  "provider", "providerName", "providerNames", "supplier", "suppliers", "supplierList", "supplierOrder",
])

export class FlightSearchUnavailableError extends Error {
  constructor() {
    super("flight search is unavailable")
    this.name = "FlightSearchUnavailableError"
    this.code = "FLIGHT_SEARCH_UNAVAILABLE"
  }
}

const defaultTraceIdFactory = () => `htr_${globalThis.crypto.randomUUID().replaceAll("-", "")}`
const assertTraceId = (value) => {
  if (typeof value !== "string" || !/^htr_[A-Za-z0-9_-]{12,100}$/.test(value)) throw new TypeError("trusted trace ID is invalid")
  return value
}
const freezeOutcome = (provider, status, durationMs, offerCount, errorCode) => Object.freeze({
  provider, status, durationMs, offerCount, ...(errorCode ? { errorCode } : {}),
})

function overallStatus(outcomes) {
  const completed = outcomes.filter(({ status }) => status === "success" || status === "no_results").length
  if (completed === outcomes.length) return "COMPLETE"
  if (completed > 0) return "PARTIAL"
  return "UNAVAILABLE"
}

function terminalEventName(status) {
  if (status === "timeout") return "supplier_search.timeout"
  if (status === "error" || status === "invalid_response") return "supplier_search.failed"
  return "supplier_search.completed"
}

async function executeSupplierAttempt({ adapter, searchInput, timeoutMs, traceId, telemetry, now }) {
  const startedAtMs = now()
  const deadlineAt = new Date(startedAtMs + timeoutMs).toISOString()
  const controller = new AbortController()
  telemetry.emit(createSafeTelemetryEvent({ event: "supplier_search.started", timestamp: new Date(startedAtMs).toISOString(), traceId, provider: adapter.providerName }))

  let timer
  const supplierPromise = Promise.resolve()
    .then(() => adapter.searchFlights(searchInput, Object.freeze({ signal: controller.signal, deadlineAt, traceId })))
    .then(
      (value) => ({ type: "resolved", value }),
      () => ({ type: "rejected" }),
    )
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort("supplier search timeout")
      resolve({ type: "timeout" })
    }, timeoutMs)
  })

  const settled = await Promise.race([supplierPromise, timeoutPromise])
  clearTimeout(timer)
  const durationMs = Math.max(0, now() - startedAtMs)
  let outcome
  let offers = []
  if (settled.type === "timeout") {
    outcome = freezeOutcome(adapter.providerName, "timeout", durationMs, 0, "SUPPLIER_SEARCH_TIMEOUT")
  } else if (settled.type === "rejected") {
    outcome = freezeOutcome(adapter.providerName, "error", durationMs, 0, "SUPPLIER_SEARCH_FAILED")
  } else if (!Array.isArray(settled.value)) {
    outcome = freezeOutcome(adapter.providerName, "invalid_response", durationMs, 0, "SUPPLIER_INVALID_RESPONSE")
  } else {
    try {
      offers = settled.value.map(assertFlightOfferV1)
      outcome = freezeOutcome(adapter.providerName, offers.length ? "success" : "no_results", durationMs, offers.length)
    } catch {
      offers = []
      outcome = freezeOutcome(adapter.providerName, "invalid_response", durationMs, 0, "SUPPLIER_INVALID_RESPONSE")
    }
  }

  telemetry.emit(createSafeTelemetryEvent({
    event: terminalEventName(outcome.status), timestamp: new Date(now()).toISOString(), traceId,
    provider: outcome.provider, outcome: outcome.status, durationMs: outcome.durationMs,
    offerCount: outcome.offerCount, errorCode: outcome.errorCode,
  }))
  return { outcome, offers }
}

export function createMultiSupplierFlightSearchOrchestrator({
  registry,
  policy: policyInput,
  telemetry: telemetryInput = NOOP_SEARCH_TELEMETRY,
  traceIdFactory = defaultTraceIdFactory,
  now = Date.now,
} = {}) {
  if (!registry || typeof registry.getEnabledSuppliersForCapability !== "function") throw new TypeError("supplier registry is required")
  const policy = createMultiSupplierSearchPolicy(policyInput)
  const telemetry = assertSearchTelemetrySink(telemetryInput)
  if (typeof traceIdFactory !== "function" || typeof now !== "function") throw new TypeError("trusted execution dependencies are invalid")

  return Object.freeze({
    policy,
    async searchFlightsAcrossSuppliers(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("search request must be an object")
      const forbidden = CLIENT_SUPPLIER_FIELDS.filter((field) => Object.hasOwn(input, field))
      if (forbidden.length) throw new TypeError("clients cannot select suppliers")
      const searchInput = validateSearchRequest(input)
      const suppliers = registry.getEnabledSuppliersForCapability("search_flights")
      if (!suppliers.length) throw new FlightSearchUnavailableError()
      const traceId = assertTraceId(traceIdFactory())
      const startedAtMs = now()
      telemetry.emit(createSafeTelemetryEvent({ event: "search.started", timestamp: new Date(startedAtMs).toISOString(), traceId, supplierCount: suppliers.length }))

      const attempts = new Array(suppliers.length)
      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < suppliers.length) {
          const index = nextIndex
          nextIndex += 1
          attempts[index] = await executeSupplierAttempt({
            adapter: suppliers[index], searchInput, timeoutMs: policy.supplierTimeoutMs, traceId, telemetry, now,
          })
        }
      }
      await Promise.all(Array.from({ length: Math.min(policy.maxConcurrency, suppliers.length) }, worker))

      const supplierOutcomes = Object.freeze(attempts.map(({ outcome }) => outcome))
      const offers = Object.freeze(attempts.flatMap((attempt) => attempt.offers))
      const status = overallStatus(supplierOutcomes)
      const completedAtMs = now()
      telemetry.emit(createSafeTelemetryEvent({
        event: "search.completed", timestamp: new Date(completedAtMs).toISOString(), traceId,
        status, durationMs: Math.max(0, completedAtMs - startedAtMs), offerCount: offers.length, supplierCount: suppliers.length,
      }))
      return Object.freeze({
        contractVersion: MULTI_SUPPLIER_SEARCH_CONTRACT_VERSION,
        traceId,
        status,
        offers,
        supplierOutcomes,
        startedAt: new Date(startedAtMs).toISOString(),
        completedAt: new Date(completedAtMs).toISOString(),
        durationMs: Math.max(0, completedAtMs - startedAtMs),
      })
    },
  })
}
