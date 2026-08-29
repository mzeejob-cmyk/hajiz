export class FlightCheckoutClientError extends Error { constructor(kind) { super(kind); this.name = "FlightCheckoutClientError"; this.kind = kind } }
const RESULT_KEYS = Object.freeze(["contractVersion", "checkoutStatus", "pricedSelectionId", "itinerary", "fare", "previousCustomerPrice", "currentCustomerPrice", "expectedPassengers", "revalidatedAt", "validUntil"])
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
const price = (value) => exact(value, ["amount", "currency", "validUntil"]) && typeof value.amount === "string" && /^(USD|AED|SDG)$/.test(value.currency) && typeof value.validUntil === "string"
const fare = (value) => exact(value, ["fareBrand", "cabin", "baggage", "changeability", "refundability"])
const segment = (value) => exact(value, ["marketingCarrier", "flightNumber", "origin", "destination", "departureAt", "arrivalAt", "cabin"])
const itinerary = (value) => exact(value, ["marketingCarrierName", "origin", "destination", "departureAt", "arrivalAt", "durationMinutes", "stops", "segments"]) && Array.isArray(value.segments) && value.segments.every(segment)
const passengers = (value) => exact(value, ["ADT", "CHD", "INF"]) && [value.ADT, value.CHD, value.INF].every((count) => Number.isInteger(count) && count >= 0)

export function parseFlightCheckoutHttpResponseV1(body) {
  if (!exact(body, ["contractVersion", "data"]) || body.contractVersion !== "customer-flight-checkout-http/v1" || !exact(body.data, RESULT_KEYS) || body.data.contractVersion !== "customer-flight-checkout/v1" || !["READY", "PRICE_CHANGED", "UNAVAILABLE"].includes(body.data.checkoutStatus)) throw new TypeError("invalid checkout response")
  const data = body.data
  if (data.checkoutStatus === "UNAVAILABLE") {
    if ([data.pricedSelectionId, data.itinerary, data.fare, data.previousCustomerPrice, data.currentCustomerPrice, data.expectedPassengers, data.validUntil].some((value) => value !== null)) throw new TypeError("invalid unavailable checkout response")
  } else if (!/^hpr_v1_[a-f0-9]{40}$/.test(data.pricedSelectionId) || !itinerary(data.itinerary) || !fare(data.fare) || !price(data.previousCustomerPrice) || !price(data.currentCustomerPrice) || !passengers(data.expectedPassengers) || typeof data.validUntil !== "string") throw new TypeError("invalid prepared checkout response")
  if (typeof data.revalidatedAt !== "string") throw new TypeError("invalid checkout response")
  return Object.freeze({ ...data })
}

export function createFlightCheckoutClientV1({ transport }) {
  if (typeof transport !== "function") throw new TypeError("injected checkout transport is required")
  return Object.freeze({ async prepare(request, { signal } = {}) {
    const response = await transport(request, { signal })
    if (response?.status === 200) { try { return parseFlightCheckoutHttpResponseV1(response.body) } catch { throw new FlightCheckoutClientError("internal_error") } }
    const kind = response?.status === 410 ? "expired" : response?.status === 504 ? "timeout" : response?.status === 503 ? "service_unavailable" : "internal_error"
    throw new FlightCheckoutClientError(kind)
  } })
}
