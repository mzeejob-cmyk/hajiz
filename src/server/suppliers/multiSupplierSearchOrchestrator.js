import { assertFlightOfferV1 } from "./flightOfferV1.js"
import { validateSearchRequest } from "./flightSupplierContract.js"
import { createMultiSupplierSearchPolicy } from "./multiSupplierSearchPolicy.js"
import { NOOP_SEARCH_TELEMETRY, assertSearchTelemetrySink, safeEmitSearchTelemetry } from "./searchTelemetry.js"

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

export class FlightSearchTimeoutError extends Error {
  constructor() {
    super("flight search request timed out")
    this.name = "FlightSearchTimeoutError"
    this.code = "FLIGHT_SEARCH_TIMEOUT"
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

export function overallStatus(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) throw new FlightSearchUnavailableError()
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

async function executeSupplierAttempt({ adapter, searchInput, timeoutMs, traceId, telemetry, now, requestSignal }) {
  const startedAtMs = now()
  const deadlineAt = new Date(startedAtMs + timeoutMs).toISOString()
  const controller = new AbortController()
  safeEmitSearchTelemetry(telemetry, { event: "supplier_search.started", timestamp: new Date(startedAtMs).toISOString(), traceId, provider: adapter.providerName })

  let timer
  let supplierSettled = false
  const supplierPromise = Promise.resolve()
    .then(() => adapter.searchFlights(searchInput, Object.freeze({ signal: controller.signal, deadlineAt, traceId })))
    .then(
      (value) => ({ type: "resolved", value }),
      () => ({ type: "rejected" }),
    )
    .finally(() => { supplierSettled = true })
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort("supplier search timeout")
      resolve({ type: "timeout" })
    }, timeoutMs)
  })

  let removeRequestAbort = () => {}
  const requestAbortPromise = new Promise((resolve) => {
    if (!requestSignal) return
    const abort = () => {
      controller.abort("flight search request stopped")
      resolve({ type: "timeout" })
    }
    if (requestSignal.aborted) abort()
    else {
      requestSignal.addEventListener("abort", abort, { once: true })
      removeRequestAbort = () => requestSignal.removeEventListener("abort", abort)
    }
  })

  const settled = await Promise.race([supplierPromise, timeoutPromise, requestAbortPromise])
  clearTimeout(timer)
  removeRequestAbort()
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

  safeEmitSearchTelemetry(telemetry, {
    event: terminalEventName(outcome.status), timestamp: new Date(now()).toISOString(), traceId,
    provider: outcome.provider, outcome: outcome.status, durationMs: outcome.durationMs,
    offerCount: outcome.offerCount, errorCode: outcome.errorCode,
  })
  return { outcome, offers, settlement: supplierPromise.then(() => undefined), leasePending: !supplierSettled }
}

const waitForDeadlineOrAbort = (deadlineAtMs, signal, now) => new Promise((resolve) => {
  let timer
  const done = () => {
    if (timer) clearTimeout(timer)
    signal?.removeEventListener("abort", done)
    resolve()
  }
  if (signal?.aborted || now() >= deadlineAtMs) return done()
  signal?.addEventListener("abort", done, { once: true })
  timer = setTimeout(done, Math.max(1, deadlineAtMs - now()))
})

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
    async searchFlightsAcrossSuppliers(input, context = {}) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("search request must be an object")
      const forbidden = CLIENT_SUPPLIER_FIELDS.filter((field) => Object.hasOwn(input, field))
      if (forbidden.length) throw new TypeError("clients cannot select suppliers")
      const searchInput = validateSearchRequest(input)
      const suppliers = registry.getEnabledSuppliersForCapability("search_flights")
      if (!suppliers.length) throw new FlightSearchUnavailableError()
      const traceId = assertTraceId(traceIdFactory())
      const startedAtMs = now()
      if (!context || typeof context !== "object" || Array.isArray(context)) throw new TypeError("trusted search context is invalid")
      const unknownContext = Object.keys(context).filter((key) => !["signal", "deadlineAt"].includes(key))
      if (unknownContext.length) throw new TypeError("trusted search context contains unsupported fields")
      if (context.signal !== undefined && !(context.signal instanceof AbortSignal)) throw new TypeError("trusted request signal is invalid")
      const configuredDeadlineAtMs = context.deadlineAt === undefined ? startedAtMs + policy.requestTimeoutMs : Date.parse(context.deadlineAt)
      if (!Number.isFinite(configuredDeadlineAtMs) || configuredDeadlineAtMs <= startedAtMs || configuredDeadlineAtMs > startedAtMs + policy.requestTimeoutMs) throw new TypeError("trusted request deadline is invalid")
      safeEmitSearchTelemetry(telemetry, { event: "search.started", timestamp: new Date(startedAtMs).toISOString(), traceId, supplierCount: suppliers.length })

      const attempts = new Array(suppliers.length)
      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < suppliers.length) {
          if (context.signal?.aborted || now() >= configuredDeadlineAtMs) return
          const index = nextIndex
          nextIndex += 1
          const remainingMs = configuredDeadlineAtMs - now()
          if (remainingMs <= 0) return
          const attempt = await executeSupplierAttempt({
            adapter: suppliers[index], searchInput, timeoutMs: Math.min(policy.supplierTimeoutMs, remainingMs), traceId, telemetry, now,
            requestSignal: context.signal,
          })
          attempts[index] = attempt
          if (attempt.leasePending && nextIndex < suppliers.length) await Promise.race([
            attempt.settlement,
            waitForDeadlineOrAbort(configuredDeadlineAtMs, context.signal, now),
          ])
        }
      }
      const workers = new Array(Math.min(policy.maxConcurrency, suppliers.length)).fill(null).map(() => worker())
      await Promise.all(workers)

      const completedAttempts = attempts.filter(Boolean)
      const requestStopped = context.signal?.aborted || now() >= configuredDeadlineAtMs
      if (completedAttempts.length === 0) {
        if (requestStopped) throw new FlightSearchTimeoutError()
        throw new FlightSearchUnavailableError()
      }

      const supplierOutcomes = Object.freeze(completedAttempts.map(({ outcome }) => outcome))
      const offers = Object.freeze(completedAttempts.flatMap((attempt) => attempt.offers))
      const computedStatus = overallStatus(supplierOutcomes)
      if (requestStopped && computedStatus === "UNAVAILABLE") throw new FlightSearchTimeoutError()
      const status = completedAttempts.length < suppliers.length && computedStatus === "COMPLETE" ? "PARTIAL" : computedStatus
      const completedAtMs = now()
      safeEmitSearchTelemetry(telemetry, {
        event: "search.completed", timestamp: new Date(completedAtMs).toISOString(), traceId,
        status, durationMs: Math.max(0, completedAtMs - startedAtMs), offerCount: offers.length, supplierCount: suppliers.length,
      })
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
