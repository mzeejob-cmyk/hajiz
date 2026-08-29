import { FlightBookingIntentError } from "../bookings/flightBookingIntentV1.js"
import { FlightCheckoutError } from "../checkout/customerFlightCheckoutV1.js"
import { FlightRepriceServiceError } from "../search/customerFlightRepriceV1.js"

export const CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_VERSION = "customer-flight-booking-intent-http/v1"
export const CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_ERROR_VERSION = "customer-flight-booking-intent-http-error/v1"
export const CUSTOMER_FLIGHT_BOOKING_INTENT_REQUEST_VERSION = "flight-booking-intent-request/v1"
export const CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_PATH = "/api/v1/flights/booking-intents"

const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))

export function validateCustomerFlightBookingIntentRequestV1(input) {
  const keys = ["contractVersion", "pricedSelectionId", "idempotencyKey", "travelers", "bookingContact"]
  if (!exact(input, keys) || input.contractVersion !== CUSTOMER_FLIGHT_BOOKING_INTENT_REQUEST_VERSION || typeof input.pricedSelectionId !== "string" || !/^hpr_v1_[a-f0-9]{40}$/.test(input.pricedSelectionId) || typeof input.idempotencyKey !== "string" || !/^hbi_req_[A-Za-z0-9_-]{16,80}$/.test(input.idempotencyKey) || !Array.isArray(input.travelers) || !input.bookingContact || typeof input.bookingContact !== "object" || Array.isArray(input.bookingContact)) throw new TypeError("invalid booking intent request")
  return Object.freeze({
    pricedSelectionId: input.pricedSelectionId,
    idempotencyKey: input.idempotencyKey,
    travelerData: Object.freeze({ contractVersion: "flight-travelers/v1", travelers: input.travelers, contact: input.bookingContact }),
  })
}

const response = (status, body) => Object.freeze({ status, headers: Object.freeze({ "content-type": "application/json; charset=utf-8" }), body: Object.freeze(body) })
const error = (status, code, message) => response(status, { contractVersion: CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_ERROR_VERSION, error: Object.freeze({ code, message }) })

export function createCustomerFlightBookingIntentHttpHandlerV1({ service, resolveOwnerContext }) {
  if (!service?.create || typeof resolveOwnerContext !== "function") throw new TypeError("trusted booking intent HTTP dependencies are required")
  return async function handleCustomerFlightBookingIntentV1(request) {
    if (!request || request.method !== "POST") return error(400, "VALIDATION_ERROR", "Invalid booking intent request.")
    let input
    try { input = validateCustomerFlightBookingIntentRequestV1(request.body) } catch { return error(400, "VALIDATION_ERROR", "Invalid booking intent request.") }
    let ownerContext
    try { ownerContext = await resolveOwnerContext(request) } catch { return error(401, "AUTH_REQUIRED", "Authentication is required.") }
    if (!ownerContext) return error(401, "AUTH_REQUIRED", "Authentication is required.")
    try {
      const data = await service.create({ ...input, ownerContext }, { signal: request.signal })
      return response(200, { contractVersion: CUSTOMER_FLIGHT_BOOKING_INTENT_HTTP_VERSION, data })
    } catch (failure) {
      if (failure instanceof FlightBookingIntentError && failure.code === "AUTH_REQUIRED") return error(401, "AUTH_REQUIRED", "Authentication is required.")
      if (failure instanceof FlightBookingIntentError && failure.code === "BOOKING_INTENT_IDEMPOTENCY_CONFLICT") return error(409, "IDEMPOTENCY_CONFLICT", "The idempotency key is already bound to different booking intent data.")
      if (failure instanceof FlightCheckoutError && failure.code === "CHECKOUT_SELECTION_EXPIRED") return error(410, "CHECKOUT_SELECTION_EXPIRED", "The priced selection has expired.")
      if (failure instanceof FlightCheckoutError && failure.code === "REQUEST_TIMEOUT") return error(504, "REQUEST_TIMEOUT", "Booking intent revalidation timed out.")
      if (failure instanceof FlightCheckoutError && failure.code === "REPRICE_UNAVAILABLE") return error(503, "REPRICE_UNAVAILABLE", "Flight repricing is temporarily unavailable.")
      if (failure instanceof FlightRepriceServiceError) return error(410, "CHECKOUT_SELECTION_EXPIRED", "The priced selection has expired.")
      if (failure instanceof FlightBookingIntentError && failure.code === "BOOKING_INTENT_PERSISTENCE_UNAVAILABLE") return error(503, "BOOKING_INTENT_UNAVAILABLE", "Booking intent persistence is temporarily unavailable.")
      if (failure instanceof FlightBookingIntentError && failure.code === "REVALIDATION_REQUIRED") return error(409, "REVALIDATION_REQUIRED", "The priced selection must be revalidated.")
      if ((failure instanceof FlightBookingIntentError && failure.code === "VALIDATION_ERROR") || failure instanceof TypeError) return error(400, "VALIDATION_ERROR", "Invalid booking intent data.")
      return error(500, "INTERNAL_ERROR", "Booking intent creation failed.")
    }
  }
}
