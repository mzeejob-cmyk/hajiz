import { createServer } from "node:http"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

export const FLIGHT_NODE_HTTP_RUNTIME_VERSION = "flight-node-http-runtime/v1"
export const FLIGHT_NODE_HTTP_INTERNAL_ORIGIN = "http://hajiz-flight-runtime.internal"

const DEFAULTS = Object.freeze({
  headersTimeout: 10_000,
  requestTimeout: 30_000,
  keepAliveTimeout: 5_000,
  maxHeaderSize: 16 * 1024,
})
const BOUNDS = Object.freeze({
  headersTimeout: [1_000, 60_000],
  requestTimeout: [1_000, 120_000],
  keepAliveTimeout: [100, 30_000],
  maxHeaderSize: [1_024, 64 * 1024],
})
const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host"])
const SINGLE_VALUE = new Set(["authorization", "content-length", "content-type", "origin", "x-request-id", "access-control-request-method", "access-control-request-headers"])
const FORWARDED = new Set(SINGLE_VALUE)
const SAFE_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
})

const plain = value => value && typeof value === "object" && !Array.isArray(value)

function transportOptions(input = {}) {
  if (!plain(input)) throw new TypeError("Node HTTP transport options are invalid")
  const options = { ...DEFAULTS, ...input }
  if (Object.keys(options).some(key => !Object.hasOwn(DEFAULTS, key))) throw new TypeError("Node HTTP transport options are invalid")
  for (const [key, [minimum, maximum]] of Object.entries(BOUNDS)) {
    if (!Number.isInteger(options[key]) || options[key] < minimum || options[key] > maximum) throw new TypeError("Node HTTP transport options are invalid")
  }
  if (options.headersTimeout > options.requestTimeout) throw new TypeError("Node HTTP transport options are invalid")
  return Object.freeze(options)
}

function requestUrl(target) {
  const unsafeCharacter = typeof target === "string" && [...target].some(character => character === "#" || character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//") || target.includes("\\") || unsafeCharacter) throw new TypeError("Node HTTP request target is invalid")
  const url = new URL(target, FLIGHT_NODE_HTTP_INTERNAL_ORIGIN)
  if (url.origin !== FLIGHT_NODE_HTTP_INTERNAL_ORIGIN) throw new TypeError("Node HTTP request target is invalid")
  return url.href
}

function requestHeaders(request) {
  const counts = new Map()
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index].toLowerCase()
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  if ([...SINGLE_VALUE].some(name => (counts.get(name) ?? 0) > 1)) throw new TypeError("ambiguous Node HTTP headers")
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    const normalized = name.toLowerCase()
    if (HOP_BY_HOP.has(normalized) || !FORWARDED.has(normalized) || value === undefined) continue
    if (Array.isArray(value)) {
      if (SINGLE_VALUE.has(normalized)) throw new TypeError("ambiguous Node HTTP headers")
      for (const entry of value) headers.append(normalized, entry)
    } else headers.set(normalized, value)
  }
  return headers
}

function requestBody(request, markHostCancellation) {
  const reader = Readable.toWeb(request).getReader()
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) controller.close()
        else controller.enqueue(value)
      } catch (error) { controller.error(error) }
    },
    async cancel(reason) {
      markHostCancellation()
      try { await reader.cancel(reason) } catch { /* best effort */ }
    },
  })
}

function safeJson(response, status, code, message) {
  if (response.headersSent) { response.destroy(); return }
  response.statusCode = status
  for (const [name, value] of Object.entries(SAFE_HEADERS)) response.setHeader(name, value)
  response.end(JSON.stringify({ contractVersion: "flight-node-http-error/v1", error: { code, message } }))
}

async function writeResponse(webResponse, response, method) {
  response.statusCode = webResponse.status
  for (const [name, value] of webResponse.headers) response.setHeader(name, value)
  if (webResponse.status === 204 || method === "HEAD" || webResponse.body === null) {
    try { await webResponse.body?.cancel() } catch { /* best effort */ }
    response.end()
    return
  }
  await pipeline(Readable.fromWeb(webResponse.body), response)
}

export function createHajizFlightNodeHttpServerV1({ fetchHandler, logger = Object.freeze({ error() {} }), nodeOptions } = {}) {
  if (typeof fetchHandler !== "function" || !logger || typeof logger.error !== "function") throw new TypeError("trusted Node runtime dependencies are required")
  const options = transportOptions(nodeOptions)
  const server = createServer({ maxHeaderSize: options.maxHeaderSize }, async (request, response) => {
    const controller = new AbortController()
    let hostCancelledBody = false
    const disconnect = () => { if (!response.writableFinished) controller.abort("client disconnected") }
    const prematureRequestClose = () => { if (!request.complete && !hostCancelledBody) disconnect() }
    request.once("aborted", prematureRequestClose)
    request.once("close", prematureRequestClose)
    response.once("close", disconnect)
    try {
      const method = request.method ?? "GET"
      const body = method === "POST" ? requestBody(request, () => { hostCancelledBody = true }) : undefined
      const webRequest = new Request(requestUrl(request.url), {
        method,
        headers: requestHeaders(request),
        ...(body ? { body, duplex: "half" } : {}),
        signal: controller.signal,
      })
      const webResponse = await fetchHandler(webRequest)
      if (!(webResponse instanceof Response)) throw new TypeError("trusted fetch result is invalid")
      await writeResponse(webResponse, response, method)
    } catch (error) {
      try { logger.error(Object.freeze({ event: "flight_node_http_bridge_failure", errorClass: typeof error?.name === "string" ? error.name.slice(0, 80) : "Error" })) } catch { /* diagnostics cannot affect response */ }
      if (!response.headersSent) safeJson(response, 500, "INTERNAL_ERROR", "Flight request failed.")
      else if (!response.writableFinished) response.destroy()
    } finally {
      request.removeListener("aborted", prematureRequestClose)
      request.removeListener("close", prematureRequestClose)
      response.removeListener("close", disconnect)
    }
  })
  server.headersTimeout = options.headersTimeout
  server.requestTimeout = options.requestTimeout
  server.keepAliveTimeout = options.keepAliveTimeout
  return server
}

export async function listenHajizFlightNodeHttpServerV1({ server, host, port }) {
  if (!server || typeof server.listen !== "function" || typeof host !== "string" || !host || !Number.isInteger(port) || port < 0 || port > 65_535) throw new TypeError("Node listen configuration is invalid")
  await new Promise((resolve, reject) => {
    const failed = error => { server.removeListener("listening", ready); reject(error) }
    const ready = () => { server.removeListener("error", failed); resolve() }
    server.once("error", failed)
    server.once("listening", ready)
    server.listen(port, host)
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Node server address is unavailable")
  return Object.freeze({ address: address.address, family: address.family, port: address.port })
}
