export const SUPPLIER_CAPABILITIES = Object.freeze([
  "flights_search", "reprice", "create_booking", "status", "confirm_booking",
  "cancel", "explicit_ticketing", "ticket_retrieval", "hotels_search", "internal_hold_confirm",
])

export const OPERATIONAL_OUTCOMES = Object.freeze([
  "available", "repriced", "processing", "confirmed", "ticketed", "cancelled", "unavailable",
])

export const PUBLIC_FLIGHT_OFFER_FIELDS = Object.freeze([
  "airline", "airlineCode", "flightNumber", "segments", "origin", "destination",
  "departure", "arrival", "durationMinutes", "stops", "cabin", "baggage",
  "sellingAmount", "currency", "expiresAt",
])

export const FROZEN_BOOKING_STATES = Object.freeze([
  "pending_payment", "payment_confirmed", "processing", "confirmed", "ticketed", "completed",
])

const requireString = (value, field) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} is required`)
}

export function validateSearchRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new TypeError("search request must be an object")
  requireString(request.origin, "origin")
  requireString(request.destination, "destination")
  requireString(request.departureDate, "departureDate")
  if (!Number.isInteger(request.adults) || request.adults < 1) throw new TypeError("adults must be a positive integer")
  return Object.freeze({ origin: request.origin, destination: request.destination, departureDate: request.departureDate, adults: request.adults })
}

export function validateBookingRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new TypeError("booking request must be an object")
  for (const field of ["supplierOfferRef", "idempotencyKey", "trustedTravelerToken"]) requireString(request[field], field)
  return Object.freeze({ supplierOfferRef: request.supplierOfferRef, idempotencyKey: request.idempotencyKey, trustedTravelerToken: request.trustedTravelerToken })
}

export function assertFlightSupplier(adapter) {
  if (!adapter || typeof adapter !== "object") throw new TypeError("supplier adapter is required")
  requireString(adapter.providerName, "providerName")
  if (!adapter.capabilities || typeof adapter.capabilities !== "object") throw new TypeError("supplier capabilities are required")
  for (const capability of Object.keys(adapter.capabilities)) {
    if (!SUPPLIER_CAPABILITIES.includes(capability)) throw new TypeError(`unknown supplier capability: ${capability}`)
    if (typeof adapter.capabilities[capability] !== "boolean") throw new TypeError(`capability ${capability} must be boolean`)
  }
  for (const method of ["health", "searchFlights", "repriceOffer", "createBooking", "getBookingStatus"]) {
    if (typeof adapter[method] !== "function") throw new TypeError(`supplier adapter must implement ${method}`)
  }
  return adapter
}

export function requireCapability(adapter, capability) {
  if (!SUPPLIER_CAPABILITIES.includes(capability) || adapter.capabilities[capability] !== true) {
    throw new Error(`supplier capability is not enabled: ${capability}`)
  }
}
