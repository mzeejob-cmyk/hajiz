import { FlightSupplierTicketingError } from "../suppliers/flightSupplierTicketingV1.js"

export const INTERNAL_FLIGHT_TICKETING_REQUEST_VERSION = "flight-supplier-ticketing-request/v1"
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))

export function validateInternalFlightSupplierTicketingRequestV1(value) {
  const keys = ["contractVersion", "bookingId", "idempotencyKey"]
  if (!exact(value, keys) || value.contractVersion !== INTERNAL_FLIGHT_TICKETING_REQUEST_VERSION || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.bookingId) || !/^hst_req_[A-Za-z0-9_-]{16,80}$/.test(value.idempotencyKey)) throw new TypeError("invalid internal ticketing request")
  return Object.freeze({ bookingId: value.bookingId, idempotencyKey: value.idempotencyKey })
}

const response = (status, body) => Object.freeze({ status, headers: Object.freeze({ "content-type": "application/json; charset=utf-8" }), body: Object.freeze(body) })

export function createInternalFlightSupplierTicketingHandlerV1({ service, authorizeInternalRequest, resolveTrustedOwnerContext }) {
  if (!service?.execute || typeof authorizeInternalRequest !== "function" || typeof resolveTrustedOwnerContext !== "function") throw new TypeError("trusted internal ticketing dependencies are required")
  return async (incoming) => {
    if (!incoming || incoming.method !== "POST" || await authorizeInternalRequest(incoming) !== true) return response(403, { error: Object.freeze({ code: "FORBIDDEN", message: "Ticketing is internal only." }) })
    let input
    try { input = validateInternalFlightSupplierTicketingRequestV1(incoming.body) } catch { return response(400, { error: Object.freeze({ code: "VALIDATION_ERROR", message: "Invalid ticketing request." }) }) }
    let ownerContext
    try { ownerContext = await resolveTrustedOwnerContext(incoming) } catch { return response(401, { error: Object.freeze({ code: "AUTH_REQUIRED", message: "Trusted ownership is required." }) }) }
    try { return response(200, { data: await service.execute({ ...input, ownerContext }, { signal: incoming.signal }) }) } catch (failure) {
      if (!(failure instanceof FlightSupplierTicketingError)) return response(500, { error: Object.freeze({ code: "INTERNAL_ERROR", message: "Ticketing failed." }) })
      const status = failure.code === "AUTH_REQUIRED" ? 401 : failure.code === "BOOKING_NOT_FOUND" ? 404 : failure.code === "VALIDATION_ERROR" ? 400 : failure.code.includes("PERSISTENCE") ? 503 : 409
      return response(status, { error: Object.freeze({ code: failure.code, message: "Ticketing is not applicable." }) })
    }
  }
}
