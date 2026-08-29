export const FLIGHT_REPRICE_HTTP_VERSION = "customer-flight-reprice-http/v1"
const RESULT_KEYS = Object.freeze(["contractVersion", "alternativeId", "repriceStatus", "itinerary", "fare", "previousCustomerPrice", "currentCustomerPrice", "priceChanged", "pricedSelectionId", "revalidatedAt", "validUntil"])
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
const price = (value) => exact(value, ["amount", "currency", "validUntil"]) && typeof value.amount === "string" && /^(USD|AED|SDG)$/.test(value.currency) && typeof value.validUntil === "string"
const fare = (value) => exact(value, ["fareBrand", "cabin", "baggage", "changeability", "refundability"])
const segment = (value) => exact(value, ["marketingCarrier", "flightNumber", "origin", "destination", "departureAt", "arrivalAt", "cabin"])
const itinerary = (value) => exact(value, ["marketingCarrierName", "origin", "destination", "departureAt", "arrivalAt", "durationMinutes", "stops", "segments"]) && Array.isArray(value.segments) && value.segments.every(segment)
export class FlightRepriceClientError extends Error { constructor(kind) { super(kind); this.kind = kind; this.name = "FlightRepriceClientError" } }
const errors = Object.freeze({ 400: "validation_error", 404: "expired", 409: "expired", 410: "expired", 503: "unavailable", 504: "timeout" })

export function parseFlightRepriceHttpResponseV1(body) {
  if (!exact(body, ["contractVersion", "data"]) || body.contractVersion !== FLIGHT_REPRICE_HTTP_VERSION || !exact(body.data, RESULT_KEYS) || body.data.contractVersion !== "customer-flight-reprice/v1" || !["AVAILABLE", "PRICE_CHANGED", "UNAVAILABLE"].includes(body.data.repriceStatus)) throw new TypeError("invalid reprice response")
  const data = body.data
  if (typeof data.alternativeId !== "string" || typeof data.priceChanged !== "boolean") throw new TypeError("invalid reprice response")
  if (data.repriceStatus === "UNAVAILABLE") {
    if ([data.currentCustomerPrice, data.pricedSelectionId, data.validUntil].some((value) => value !== null)) throw new TypeError("invalid unavailable response")
  } else if (!price(data.currentCustomerPrice) || (data.previousCustomerPrice !== null && !price(data.previousCustomerPrice)) || !fare(data.fare) || !itinerary(data.itinerary) || typeof data.pricedSelectionId !== "string" || !/^hpr_v1_/.test(data.pricedSelectionId)) throw new TypeError("invalid available response")
  return Object.freeze({ ...data })
}

export function createFlightRepriceClientV1({ transport }) {
  if (typeof transport !== "function") throw new TypeError("injected reprice transport is required")
  return Object.freeze({ async reprice(request, { signal } = {}) {
    const response = await transport(request, { signal })
    if (response?.status === 200) { try { return parseFlightRepriceHttpResponseV1(response.body) } catch { throw new FlightRepriceClientError("internal_error") } }
    throw new FlightRepriceClientError(errors[response?.status] ?? "internal_error")
  } })
}
