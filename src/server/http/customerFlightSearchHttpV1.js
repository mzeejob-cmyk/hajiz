import { groupFlightSearchResultV1 } from "../suppliers/flightOfferGrouping.js"
import { FlightSearchTimeoutError, FlightSearchUnavailableError } from "../suppliers/multiSupplierSearchOrchestrator.js"
import { priceGroupedFlightSearchV1 } from "../pricing/pricedGroupedSearchV1.js"
import { rankPricedGroupedFlightSearchV1 } from "../pricing/flightRankingV1.js"
import { SUPPORTED_PRICING_CURRENCIES } from "../pricing/pricingFxV1.js"
import { toCustomerFlightSearchV1 } from "../search/customerFlightSearchV1.js"

export const CUSTOMER_FLIGHT_SEARCH_HTTP_VERSION = "customer-flight-search-http/v1"
export const CUSTOMER_FLIGHT_SEARCH_HTTP_ERROR_VERSION = "customer-flight-search-http-error/v1"
export const CUSTOMER_FLIGHT_SEARCH_HTTP_PATH = "/api/v1/flights/search"

const REQUEST_FIELDS = Object.freeze([
  "tripType", "origin", "destination", "departureDate", "returnDate",
  "adults", "children", "infants", "cabinClass", "customerCurrency",
])
const CABINS = Object.freeze(["economy", "premium_economy", "business", "first"])
const jsonHeaders = Object.freeze({ "content-type": "application/json; charset=utf-8" })

export class PublicFlightSearchValidationError extends Error {
  constructor() {
    super("flight search request is invalid")
    this.name = "PublicFlightSearchValidationError"
    this.code = "VALIDATION_ERROR"
  }
}

const invalid = () => { throw new PublicFlightSearchValidationError() }
const calendarDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid()
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid()
  return value
}
const plainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid()
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) invalid()
  return value
}

export function validatePublicFlightSearchRequestV1(input, { requestNow }) {
  const body = plainObject(input)
  let serialized
  try { serialized = JSON.stringify(body) } catch { invalid() }
  if (typeof serialized !== "string" || serialized.length > 4_096) invalid()
  const keys = Object.keys(body)
  if (keys.length !== REQUEST_FIELDS.length || keys.some((key) => !REQUEST_FIELDS.includes(key)) || REQUEST_FIELDS.some((key) => !Object.hasOwn(body, key))) invalid()
  if (!["one_way", "round_trip"].includes(body.tripType)) invalid()
  if (typeof body.origin !== "string" || !/^[A-Z]{3}$/.test(body.origin) || typeof body.destination !== "string" || !/^[A-Z]{3}$/.test(body.destination) || body.origin === body.destination) invalid()
  const departureDate = calendarDate(body.departureDate)
  const today = new Date(requestNow).toISOString().slice(0, 10)
  if (departureDate < today) invalid()
  if (body.tripType === "one_way" && body.returnDate !== null) invalid()
  if (body.tripType === "round_trip" && (calendarDate(body.returnDate) < departureDate)) invalid()
  for (const field of ["adults", "children", "infants"]) if (!Number.isInteger(body[field]) || body[field] < (field === "adults" ? 1 : 0)) invalid()
  if (!CABINS.includes(body.cabinClass) || !SUPPORTED_PRICING_CURRENCIES.includes(body.customerCurrency)) invalid()
  return Object.freeze(Object.fromEntries(REQUEST_FIELDS.map((field) => [field, body[field]])))
}

const response = (status, body) => Object.freeze({ status, headers: jsonHeaders, body: Object.freeze(body) })
const errorResponse = (status, code, message) => response(status, {
  contractVersion: CUSTOMER_FLIGHT_SEARCH_HTTP_ERROR_VERSION,
  error: Object.freeze({ code, message }),
})

export function createCustomerFlightSearchHttpHandlerV1({
  orchestrator, pricingPolicy, fxSnapshotsByPair, rankingPolicy,
  requestTimeoutMs = 10_000, clock = Date.now,
}) {
  if (!orchestrator || typeof orchestrator.searchFlightsAcrossSuppliers !== "function" || !orchestrator.policy) throw new TypeError("trusted search orchestrator is required")
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 120_000 || requestTimeoutMs > orchestrator.policy.requestTimeoutMs) throw new TypeError("trusted HTTP request budget is invalid")
  if (typeof clock !== "function") throw new TypeError("trusted server clock is required")

  return async function handleCustomerFlightSearchHttpV1(request) {
    if (!request || typeof request !== "object" || request.method !== "POST") return errorResponse(400, "VALIDATION_ERROR", "Invalid flight search request.")
    const requestNowMs = clock()
    if (!Number.isFinite(requestNowMs)) return errorResponse(500, "INTERNAL_ERROR", "Flight search could not be completed.")
    const requestNow = new Date(requestNowMs).toISOString()
    let publicRequest
    try {
      publicRequest = validatePublicFlightSearchRequestV1(request.body, { requestNow: requestNowMs })
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid flight search request.")
    }

    try {
      const privateSearch = await orchestrator.searchFlightsAcrossSuppliers(publicRequest, {
        signal: request.signal,
        deadlineAt: new Date(requestNowMs + requestTimeoutMs).toISOString(),
      })
      const grouped = groupFlightSearchResultV1(privateSearch)
      const priced = priceGroupedFlightSearchV1(grouped, { pricingPolicy, fxSnapshotsByPair, customerCurrency: publicRequest.customerCurrency, now: requestNow })
      const ranked = rankPricedGroupedFlightSearchV1(priced, { rankingPolicy, now: requestNow })
      const customer = toCustomerFlightSearchV1(ranked, { customerCurrency: publicRequest.customerCurrency, now: requestNow })
      if (customer.searchStatus === "UNAVAILABLE") return errorResponse(503, "SEARCH_UNAVAILABLE", "Flight search is temporarily unavailable.")
      return response(200, { contractVersion: CUSTOMER_FLIGHT_SEARCH_HTTP_VERSION, data: customer })
    } catch (error) {
      if (error instanceof FlightSearchTimeoutError || error?.code === "FLIGHT_SEARCH_TIMEOUT") return errorResponse(504, "REQUEST_TIMEOUT", "Flight search timed out.")
      if (error instanceof FlightSearchUnavailableError || error?.code === "FLIGHT_SEARCH_UNAVAILABLE") return errorResponse(503, "SEARCH_UNAVAILABLE", "Flight search is temporarily unavailable.")
      return errorResponse(500, "INTERNAL_ERROR", "Flight search could not be completed.")
    }
  }
}
