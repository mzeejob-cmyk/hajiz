export class FlightBookingIntentClientError extends Error { constructor(kind) { super(kind); this.name = "FlightBookingIntentClientError"; this.kind = kind } }

const COMMON_KEYS = Object.freeze(["contractVersion", "bookingIntentId", "intentStatus", "customerPrice", "previousCustomerPrice", "itinerary", "passengerSummary", "validUntil", "nextAction"])
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
const price = (value) => exact(value, ["amount", "currency", "validUntil"]) && typeof value.amount === "string" && /^(USD|AED|SDG)$/.test(value.currency) && typeof value.validUntil === "string"
const passengerSummary = (value) => exact(value, ["adults", "children", "infants", "total"]) && [value.adults, value.children, value.infants, value.total].every((count) => Number.isInteger(count) && count >= 0) && value.total === value.adults + value.children + value.infants
const segment = (value) => exact(value, ["marketingCarrier", "flightNumber", "origin", "destination", "departureAt", "arrivalAt", "cabin"])
const itinerary = (value) => exact(value, ["marketingCarrierName", "origin", "destination", "departureAt", "arrivalAt", "durationMinutes", "stops", "segments"]) && Array.isArray(value.segments) && value.segments.every(segment)

export function parseFlightBookingIntentHttpResponseV1(body) {
  if (!exact(body, ["contractVersion", "data"]) || body.contractVersion !== "customer-flight-booking-intent-http/v1" || !body.data || body.data.contractVersion !== "flight-booking-intent/v1") throw new TypeError("invalid booking intent response")
  const data = body.data
  if (data.intentStatus === "PRICE_CHANGED") {
    if (!exact(data, [...COMMON_KEYS, "pricedSelectionId"]) || !/^hpr_v1_[a-f0-9]{40}$/.test(data.pricedSelectionId) || data.bookingIntentId !== null || !price(data.previousCustomerPrice) || !price(data.customerPrice) || !itinerary(data.itinerary) || !passengerSummary(data.passengerSummary) || data.nextAction !== "ACCEPT_CURRENT_PRICE") throw new TypeError("invalid price-changed intent response")
  } else if (data.intentStatus === "READY_FOR_PAYMENT") {
    if (!exact(data, COMMON_KEYS) || !/^hbi_v1_[0-9a-f]{32}$/.test(data.bookingIntentId) || data.previousCustomerPrice !== null || !price(data.customerPrice) || !itinerary(data.itinerary) || !passengerSummary(data.passengerSummary) || data.nextAction !== "SELECT_PAYMENT_METHOD") throw new TypeError("invalid ready intent response")
  } else if (data.intentStatus === "UNAVAILABLE") {
    if (!exact(data, COMMON_KEYS) || [data.bookingIntentId, data.customerPrice, data.previousCustomerPrice, data.itinerary, data.passengerSummary, data.validUntil].some((value) => value !== null) || data.nextAction !== "RETURN_TO_RESULTS") throw new TypeError("invalid unavailable intent response")
  } else throw new TypeError("invalid booking intent response")
  return Object.freeze({ ...data })
}

const errors = Object.freeze({ 400: "validation_error", 401: "auth_required", 409: "conflict", 410: "expired", 503: "service_unavailable", 504: "timeout" })

export function createFlightBookingIntentClientV1({ transport }) {
  if (typeof transport !== "function") throw new TypeError("injected booking intent transport is required")
  return Object.freeze({ async create(request, { signal } = {}) {
    const response = await transport(request, { signal })
    if (response?.status === 200) { try { return parseFlightBookingIntentHttpResponseV1(response.body) } catch { throw new FlightBookingIntentClientError("internal_error") } }
    throw new FlightBookingIntentClientError(errors[response?.status] ?? "internal_error")
  } })
}
