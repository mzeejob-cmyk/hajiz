import { randomUUID } from "node:crypto"
import {
  CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_PATH,
} from "../http/customerFlightBookingIntentHttpV1.js"
import { CUSTOMER_FLIGHT_CHECKOUT_HTTP_PATH } from "../http/customerFlightCheckoutHttpV1.js"
import { CUSTOMER_FLIGHT_PAYMENT_INITIATION_HTTP_PATH } from "../http/customerFlightPaymentInitiationHttpV1.js"
import { CUSTOMER_FLIGHT_REPRICE_HTTP_PATH } from "../http/customerFlightRepriceHttpV1.js"
import { CUSTOMER_FLIGHT_SEARCH_HTTP_PATH } from "../http/customerFlightSearchHttpV1.js"

export const FLIGHT_HTTP_HOST_VERSION = "flight-http-host/v1"
export const FLIGHT_HTTP_HOST_PATHS = Object.freeze([
  CUSTOMER_FLIGHT_SEARCH_HTTP_PATH,
  CUSTOMER_FLIGHT_REPRICE_HTTP_PATH,
  CUSTOMER_FLIGHT_CHECKOUT_HTTP_PATH,
  CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_PATH,
  CUSTOMER_FLIGHT_PAYMENT_INITIATION_HTTP_PATH,
])
export const FLIGHT_HTTP_MAX_BODY_BYTES = 32 * 1024

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/
const securityHeaders = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
})

const plain = (value) => value && typeof value === "object" && !Array.isArray(value)
const safeRequestId = (request, factory) => {
  const supplied = request.headers.get("x-request-id")
  if (supplied && REQUEST_ID.test(supplied)) return supplied
  const generated = factory()
  if (typeof generated !== "string" || !REQUEST_ID.test(generated)) throw new TypeError("trusted request ID factory is invalid")
  return generated
}
const generatedRequestId = () => `hreq_${randomUUID().replaceAll("-", "")}`
const errorBody = (code, message) => Object.freeze({
  contractVersion: "flight-http-host-error/v1",
  error: Object.freeze({ code, message }),
})

function response(status, body, { requestId, origin, headers = {}, retryAfterSeconds } = {}) {
  const output = new Headers(securityHeaders)
  for (const [name, value] of Object.entries(headers)) output.set(name, String(value))
  for (const [name, value] of Object.entries(securityHeaders)) output.set(name, value)
  output.set("x-request-id", requestId)
  if (origin) {
    output.set("access-control-allow-origin", origin)
    output.set("vary", "Origin")
  }
  if (retryAfterSeconds) output.set("retry-after", String(retryAfterSeconds))
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: output })
}

async function readBoundedJson(request, maximumBytes, signal) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase()
  if (contentType !== "application/json") return { error: "UNSUPPORTED_MEDIA_TYPE", status: 415 }
  const declared = request.headers.get("content-length")
  if (declared !== null) {
    const bytes = Number(declared)
    if (!Number.isSafeInteger(bytes) || bytes < 0) return { error: "VALIDATION_ERROR", status: 400 }
    if (bytes > maximumBytes) return { error: "PAYLOAD_TOO_LARGE", status: 413 }
  }

  const reader = request.body?.getReader()
  const cancel = () => { try { if (reader) void reader.cancel().catch(() => {}) } catch { /* best effort */ } }
  if (signal?.aborted) cancel()
  else signal?.addEventListener("abort", cancel, { once: true })
  const chunks = []
  let total = 0
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maximumBytes) {
          try { await reader.cancel() } catch { /* best effort */ }
          return { error: "PAYLOAD_TOO_LARGE", status: 413 }
        }
        chunks.push(value)
      }
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    if (!plain(body)) return { error: "VALIDATION_ERROR", status: 400 }
    return { body }
  } catch {
    return { error: "VALIDATION_ERROR", status: 400 }
  } finally {
    signal?.removeEventListener("abort", cancel)
    reader?.releaseLock()
  }
}

export function parseFlightAllowedOriginsV1(value) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("HAJIZ_ALLOWED_ORIGINS is required")
  const origins = value.split(",").map((origin) => origin.trim())
  if (origins.some((origin) => !origin || origin === "*") || new Set(origins).size !== origins.length) throw new TypeError("HAJIZ_ALLOWED_ORIGINS is invalid")
  for (const origin of origins) {
    const parsed = new URL(origin)
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.origin !== origin || (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname))) throw new TypeError("HAJIZ_ALLOWED_ORIGINS is invalid")
  }
  return Object.freeze(origins)
}

export function createBoundedInMemoryFlightAdmissionV1({ maximum = 60, windowMs = 60_000, clock = Date.now } = {}) {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 10_000 || !Number.isInteger(windowMs) || windowMs < 1_000 || typeof clock !== "function") throw new TypeError("bounded admission configuration is invalid")
  const buckets = new Map()
  return Object.freeze({
    implementation: "single-instance-bounded-memory",
    admit({ route }) {
      const now = clock()
      const existing = buckets.get(route)
      const bucket = !existing || now >= existing.resetAt ? { count: 0, resetAt: now + windowMs } : existing
      bucket.count += 1
      buckets.set(route, bucket)
      return Object.freeze({ allowed: bucket.count <= maximum, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)) })
    },
  })
}

const routeTable = (handlers) => {
  const entries = [
    [CUSTOMER_FLIGHT_SEARCH_HTTP_PATH, handlers.search, false],
    [CUSTOMER_FLIGHT_REPRICE_HTTP_PATH, handlers.reprice, false],
    [CUSTOMER_FLIGHT_CHECKOUT_HTTP_PATH, handlers.checkout, false],
    [CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_PATH, handlers.bookingIntent, true],
    [CUSTOMER_FLIGHT_PAYMENT_INITIATION_HTTP_PATH, handlers.paymentInitiation, true],
  ]
  if (entries.some(([, handler]) => typeof handler !== "function")) throw new TypeError("complete canonical Flight handlers are required")
  return new Map(entries.map(([path, handler, protectedRoute]) => [path, Object.freeze({ handler, protectedRoute })]))
}

export function createHajizFlightHttpHostV1({
  handlers,
  allowedOrigins,
  admission = createBoundedInMemoryFlightAdmissionV1(),
  logger = Object.freeze({ info() {} }),
  requestIdFactory = generatedRequestId,
  clock = Date.now,
  requestTimeoutMs = 15_000,
  maximumBodyBytes = FLIGHT_HTTP_MAX_BODY_BYTES,
} = {}) {
  const routes = routeTable(handlers ?? {})
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.length || typeof admission?.admit !== "function" || typeof logger?.info !== "function" || typeof clock !== "function" || typeof requestIdFactory !== "function") throw new TypeError("trusted Flight host dependencies are required")
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 120_000 || !Number.isInteger(maximumBodyBytes) || maximumBodyBytes < 1 || maximumBodyBytes > 1024 * 1024) throw new TypeError("trusted Flight host limits are invalid")
  const canonicalOrigins = parseFlightAllowedOriginsV1(allowedOrigins.join(","))
  const originSet = new Set(canonicalOrigins)

  return Object.freeze({
    contractVersion: FLIGHT_HTTP_HOST_VERSION,
    admission: admission.implementation ?? "injected",
    async fetch(request) {
      if (!(request instanceof Request)) throw new TypeError("Web Request is required")
      const started = clock()
      const route = new URL(request.url).pathname
      const origin = request.headers.get("origin")
      const requestId = safeRequestId(request, requestIdFactory)
      let status = 500
      let errorClass = null
      const finish = (result) => { status = result.status; return result }
      try {
        const selected = routes.get(route)
        if (!selected) return finish(response(404, errorBody("NOT_FOUND", "Flight API route was not found."), { requestId, origin: originSet.has(origin) ? origin : null }))
        if (origin && !originSet.has(origin)) return finish(response(403, errorBody("ORIGIN_NOT_ALLOWED", "Request origin is not allowed."), { requestId }))
        if (request.method === "OPTIONS") {
          if (!origin) return finish(response(400, errorBody("VALIDATION_ERROR", "CORS preflight is invalid."), { requestId }))
          const requestedMethod = request.headers.get("access-control-request-method")
          if (requestedMethod !== "POST") return finish(response(405, errorBody("METHOD_NOT_ALLOWED", "Method is not allowed."), { requestId, origin }))
          const allowedHeaders = selected.protectedRoute ? "authorization, content-type, x-request-id" : "content-type, x-request-id"
          const allowedHeaderSet = new Set(allowedHeaders.split(", "))
          const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean)
          if (requestedHeaders.some(name => !allowedHeaderSet.has(name))) return finish(response(400, errorBody("VALIDATION_ERROR", "CORS preflight is invalid."), { requestId, origin }))
          return finish(response(204, null, { requestId, origin, headers: { "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": allowedHeaders, "access-control-max-age": "600" } }))
        }
        if (request.method !== "POST") return finish(response(405, errorBody("METHOD_NOT_ALLOWED", "Method is not allowed."), { requestId, origin }))

        const controller = new AbortController()
        let disconnected = false
        const disconnect = () => { disconnected = true; controller.abort("client disconnected") }
        if (request.signal.aborted) disconnect()
        else request.signal.addEventListener("abort", disconnect, { once: true })
        let timedOut = false
        const timer = setTimeout(() => { timedOut = true; controller.abort("host request timeout") }, requestTimeoutMs)
        const hostAbort = Object.freeze({ hostAbort: true })
        const aborted = new Promise(resolve => {
          if (controller.signal.aborted) resolve(hostAbort)
          else controller.signal.addEventListener("abort", () => resolve(hostAbort), { once: true })
        })
        const raceAbort = pending => Promise.race([Promise.resolve(pending), aborted])
        const abortResponse = () => {
          const code = disconnected && !timedOut ? "REQUEST_ABORTED" : "REQUEST_TIMEOUT"
          return response(code === "REQUEST_ABORTED" ? 499 : 504, errorBody(code, code === "REQUEST_ABORTED" ? "Flight request was cancelled." : "Flight request timed out."), { requestId, origin })
        }
        try {
          const admitted = await raceAbort(admission.admit(Object.freeze({ route, method: request.method, requestId })))
          if (admitted?.hostAbort) return finish(abortResponse())
          if (!admitted || admitted.allowed !== true) return finish(response(429, errorBody("REQUEST_NOT_ADMITTED", "Request capacity is temporarily unavailable."), { requestId, origin, retryAfterSeconds: admitted?.retryAfterSeconds }))

          const parsed = await raceAbort(readBoundedJson(request, maximumBodyBytes, controller.signal))
          if (parsed?.hostAbort) return finish(abortResponse())
          if (parsed.error) {
            const message = parsed.error === "PAYLOAD_TOO_LARGE" ? "Flight request payload is too large." : parsed.error === "UNSUPPORTED_MEDIA_TYPE" ? "Content-Type must be application/json." : "Flight request JSON is invalid."
            return finish(response(parsed.status, errorBody(parsed.error, message), { requestId, origin }))
          }

          const value = await raceAbort(selected.handler(Object.freeze({
            method: request.method,
            body: parsed.body,
            signal: controller.signal,
            headers: Object.freeze({ authorization: request.headers.get("authorization") ?? undefined }),
          })))
          if (value?.hostAbort) return finish(abortResponse())
          if (!value || !Number.isInteger(value.status) || !plain(value.body)) throw new TypeError("canonical handler response is invalid")
          return finish(response(value.status, value.body, { requestId, origin, headers: value.headers }))
        } finally {
          clearTimeout(timer)
          request.signal.removeEventListener("abort", disconnect)
        }
      } catch (error) {
        errorClass = typeof error?.name === "string" ? error.name.slice(0, 80) : "Error"
        return finish(response(500, errorBody("INTERNAL_ERROR", "Flight request failed."), { requestId, origin: originSet.has(origin) ? origin : null }))
      } finally {
        const durationMs = Math.max(0, clock() - started)
        try { logger.info(Object.freeze({ requestId, route, method: request.method, status, durationMs, ...(errorClass ? { errorClass } : {}) })) } catch { /* diagnostics cannot affect responses */ }
      }
    },
  })
}
