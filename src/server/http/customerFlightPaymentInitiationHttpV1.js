import { FlightPaymentInitiationError } from "../payments/flightPaymentInitiationV1.js"

export const CUSTOMER_FLIGHT_PAYMENT_INITIATION_HTTP_VERSION = "customer-flight-payment-initiation-http/v1"
export const CUSTOMER_FLIGHT_PAYMENT_INITIATION_REQUEST_VERSION = "flight-payment-initiation-request/v1"
export const CUSTOMER_FLIGHT_PAYMENT_INITIATION_ERROR_VERSION = "customer-flight-payment-initiation-http-error/v1"
export const CUSTOMER_FLIGHT_PAYMENT_INITIATION_HTTP_PATH = "/api/v1/flights/payment-initiation"

const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))

export function validateCustomerFlightPaymentInitiationRequestV1(input) {
  const keys = ["contractVersion", "bookingIntentId", "paymentMethod", "idempotencyKey"]
  if (!exact(input, keys) || input.contractVersion !== CUSTOMER_FLIGHT_PAYMENT_INITIATION_REQUEST_VERSION || !/^hbi_v1_[0-9a-f]{32}$/.test(input.bookingIntentId) || !["bankak", "card"].includes(input.paymentMethod) || !/^hpi_req_[A-Za-z0-9_-]{16,80}$/.test(input.idempotencyKey)) throw new TypeError("invalid payment initiation request")
  return Object.freeze({ bookingIntentId: input.bookingIntentId, paymentMethod: input.paymentMethod, idempotencyKey: input.idempotencyKey })
}

const response = (status, body) => Object.freeze({ status, headers: Object.freeze({ "content-type": "application/json; charset=utf-8" }), body: Object.freeze(body) })
const error = (status, code, message) => response(status, { contractVersion: CUSTOMER_FLIGHT_PAYMENT_INITIATION_ERROR_VERSION, error: Object.freeze({ code, message }) })

export function createCustomerFlightPaymentInitiationHttpHandlerV1({ service, resolveOwnerContext }) {
  if (!service?.initiate || typeof resolveOwnerContext !== "function") throw new TypeError("trusted payment initiation HTTP dependencies are required")
  return async function handleCustomerFlightPaymentInitiationV1(request) {
    if (!request || request.method !== "POST") return error(400, "VALIDATION_ERROR", "Invalid payment initiation request.")
    let input
    try { input = validateCustomerFlightPaymentInitiationRequestV1(request.body) } catch { return error(400, "VALIDATION_ERROR", "Invalid payment initiation request.") }
    let ownerContext
    try { ownerContext = await resolveOwnerContext(request) } catch { return error(401, "AUTH_REQUIRED", "Authentication is required.") }
    if (!ownerContext) return error(401, "AUTH_REQUIRED", "Authentication is required.")
    try {
      const data = await service.initiate({ ...input, ownerContext }, { signal: request.signal })
      return response(200, { contractVersion: CUSTOMER_FLIGHT_PAYMENT_INITIATION_HTTP_VERSION, data })
    } catch (failure) {
      if (!(failure instanceof FlightPaymentInitiationError)) return error(500, "INTERNAL_ERROR", "Payment initiation failed.")
      const mapped = {
        AUTH_REQUIRED: [401, "Authentication is required."],
        BOOKING_INTENT_NOT_FOUND: [404, "Booking intent was not found."],
        INTENT_EXPIRED: [410, "Booking intent has expired."],
        OFFER_UNAVAILABLE: [409, "The flight offer is no longer available."],
        REPRICE_REQUIRED: [409, "The flight price must be reviewed again."],
        BOOKING_INTENT_CONFLICT: [409, "Booking intent cannot initiate another payment."],
        PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT: [409, "The idempotency key is bound to different payment data."],
        REQUEST_ABORTED: [499, "Payment initiation was cancelled."],
        REQUEST_TIMEOUT: [504, "Commercial revalidation timed out."],
        PSP_TIMEOUT: [504, "Payment provider initiation timed out."],
        REPRICE_UNAVAILABLE: [503, "Commercial revalidation is temporarily unavailable."],
        PSP_CONFIGURATION_UNAVAILABLE: [503, "Card payment is not configured."],
        PAYMENT_CONFIGURATION_UNAVAILABLE: [503, "Payment configuration is unavailable."],
        BOOKING_INTENT_PERSISTENCE_UNAVAILABLE: [503, "Booking intent persistence is unavailable."],
        PAYMENT_INITIATION_PERSISTENCE_UNAVAILABLE: [503, "Payment initiation persistence is unavailable."],
        PSP_INITIATION_FAILED: [502, "Payment provider initiation failed."],
      }[failure.code]
      if (mapped) return error(mapped[0], failure.code, mapped[1])
      if (failure.code === "VALIDATION_ERROR" || failure.code === "BOOKING_INTENT_INCOMPLETE") return error(400, "VALIDATION_ERROR", "Invalid payment initiation data.")
      return error(500, "INTERNAL_ERROR", "Payment initiation failed.")
    }
  }
}
