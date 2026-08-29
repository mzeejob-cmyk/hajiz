import { FlightCheckoutError } from "../checkout/customerFlightCheckoutV1.js"

export const CUSTOMER_FLIGHT_CHECKOUT_HTTP_VERSION = "customer-flight-checkout-http/v1"
export const CUSTOMER_FLIGHT_CHECKOUT_HTTP_ERROR_VERSION = "customer-flight-checkout-http-error/v1"
export const CUSTOMER_FLIGHT_CHECKOUT_HTTP_PATH = "/api/v1/flights/checkout/prepare"
export function validateCustomerFlightCheckoutRequestV1(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 || !Object.hasOwn(input, "pricedSelectionId") || typeof input.pricedSelectionId !== "string" || !/^hpr_v1_[a-f0-9]{40}$/.test(input.pricedSelectionId)) throw new TypeError("invalid checkout request")
  return Object.freeze({ pricedSelectionId: input.pricedSelectionId })
}
const response = (status, body) => Object.freeze({ status, headers: Object.freeze({ "content-type": "application/json; charset=utf-8" }), body: Object.freeze(body) })
const error = (status, code, message) => response(status, { contractVersion: CUSTOMER_FLIGHT_CHECKOUT_HTTP_ERROR_VERSION, error: Object.freeze({ code, message }) })
export function createCustomerFlightCheckoutHttpHandlerV1({ service }) {
  if (!service?.prepare) throw new TypeError("trusted checkout service is required")
  return async function handleCustomerFlightCheckoutV1(request) {
    if (!request || request.method !== "POST") return error(400, "VALIDATION_ERROR", "Invalid flight checkout request.")
    let body; try { body = validateCustomerFlightCheckoutRequestV1(request.body) } catch { return error(400, "VALIDATION_ERROR", "Invalid flight checkout request.") }
    try { return response(200, { contractVersion: CUSTOMER_FLIGHT_CHECKOUT_HTTP_VERSION, data: await service.prepare(body, { signal: request.signal }) }) } catch (failure) {
      if (failure instanceof FlightCheckoutError && failure.code === "CHECKOUT_SELECTION_EXPIRED") return error(410, "CHECKOUT_SELECTION_EXPIRED", "The repriced selection has expired.")
      if (failure instanceof FlightCheckoutError && failure.code === "REQUEST_TIMEOUT") return error(504, "REQUEST_TIMEOUT", "Checkout preparation timed out.")
      if (failure instanceof FlightCheckoutError && failure.code === "REPRICE_UNAVAILABLE") return error(503, "REPRICE_UNAVAILABLE", "Flight repricing is temporarily unavailable.")
      return error(500, "INTERNAL_ERROR", "Checkout preparation failed.")
    }
  }
}
