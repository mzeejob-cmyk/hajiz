export const MULTI_SUPPLIER_SEARCH_EVENTS = Object.freeze([
  "search.started",
  "supplier_search.started",
  "supplier_search.completed",
  "supplier_search.timeout",
  "supplier_search.failed",
  "search.completed",
])

const EVENT_FIELDS = Object.freeze([
  "event", "timestamp", "traceId", "provider", "outcome", "durationMs", "offerCount", "errorCode", "status", "supplierCount",
])

export const NOOP_SEARCH_TELEMETRY = Object.freeze({ emit() {} })

export function assertSearchTelemetrySink(sink) {
  if (!sink || typeof sink.emit !== "function") throw new TypeError("telemetry sink must implement emit")
  return sink
}

export function createSafeTelemetryEvent(fields) {
  if (!MULTI_SUPPLIER_SEARCH_EVENTS.includes(fields?.event)) throw new TypeError("unknown search telemetry event")
  const event = {}
  for (const field of EVENT_FIELDS) if (fields[field] !== undefined) event[field] = fields[field]
  return Object.freeze(event)
}
