import { CUSTOMER_FLIGHT_REPRICE_VERSION, FlightRepriceServiceError } from "../search/customerFlightRepriceV1.js"
import { SelectionResolutionError } from "../search/flightSelectionResolverV1.js"

export const CUSTOMER_FLIGHT_REPRICE_HTTP_VERSION = "customer-flight-reprice-http/v1"
export const CUSTOMER_FLIGHT_REPRICE_HTTP_ERROR_VERSION = "customer-flight-reprice-http-error/v1"
export const CUSTOMER_FLIGHT_REPRICE_HTTP_PATH = "/api/v1/flights/reprice"
const CURRENCIES = Object.freeze(["USD", "AED", "SDG"])

export function validateCustomerFlightRepriceRequestV1(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 2 || !Object.hasOwn(input, "alternativeId") || !Object.hasOwn(input, "customerCurrency")) throw new TypeError("invalid reprice request")
  if (typeof input.alternativeId !== "string" || !/^hca_v1_[A-Za-z0-9._-]+$/.test(input.alternativeId) || !CURRENCIES.includes(input.customerCurrency)) throw new TypeError("invalid reprice request")
  return Object.freeze({ alternativeId: input.alternativeId, customerCurrency: input.customerCurrency })
}
const response = (status, body) => Object.freeze({ status, headers: Object.freeze({ "content-type": "application/json; charset=utf-8" }), body: Object.freeze(body) })
const error = (status, code, message) => response(status, { contractVersion: CUSTOMER_FLIGHT_REPRICE_HTTP_ERROR_VERSION, error: Object.freeze({ code, message }) })

export function createCustomerFlightRepriceHttpHandlerV1({ service }) {
  if (!service || typeof service.reprice !== "function") throw new TypeError("trusted reprice service is required")
  return async function handleCustomerFlightRepriceHttpV1(request) {
    if (!request || request.method !== "POST") return error(400, "VALIDATION_ERROR", "Invalid flight reprice request.")
    let body
    try { body = validateCustomerFlightRepriceRequestV1(request.body) } catch { return error(400, "VALIDATION_ERROR", "Invalid flight reprice request.") }
    try {
      const data = await service.reprice(body, { signal: request.signal })
      if (data.contractVersion !== CUSTOMER_FLIGHT_REPRICE_VERSION) throw new Error("invalid internal response")
      return response(200, { contractVersion: CUSTOMER_FLIGHT_REPRICE_HTTP_VERSION, data })
    } catch (failure) {
      if (failure instanceof SelectionResolutionError) {
        if (failure.code === "SELECTION_EXPIRED") return error(410, "SELECTION_EXPIRED", "The selected flight option has expired.")
        return error(failure.code === "SELECTION_AMBIGUOUS" ? 409 : 404, "SELECTION_NOT_FOUND", "The selected flight option could not be resolved.")
      }
      if (failure instanceof FlightRepriceServiceError && failure.code === "REQUEST_TIMEOUT") return error(504, "REQUEST_TIMEOUT", "Flight repricing timed out.")
      return error(503, "REPRICE_UNAVAILABLE", "Flight repricing is temporarily unavailable.")
    }
  }
}
