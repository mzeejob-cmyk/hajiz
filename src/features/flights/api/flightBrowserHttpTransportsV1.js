import { getAccountSessionClient } from "../../../services/myTripsDataSource.js"

export const FLIGHT_BROWSER_HTTP_PATHS_V1 = Object.freeze({
  search: "/api/v1/flights/search",
  reprice: "/api/v1/flights/reprice",
  checkout: "/api/v1/flights/checkout/prepare",
  bookingIntent: "/api/v1/flights/booking-intents",
  paymentInitiation: "/api/v1/flights/payment-initiation",
})

const plain = value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch { return false }
}

export class FlightBrowserHttpTransportError extends Error {
  constructor(kind = "internal_error") {
    super(kind)
    this.name = "FlightBrowserHttpTransportError"
    this.kind = kind
  }
}

const internalError = () => new FlightBrowserHttpTransportError("internal_error")
const abortError = () => new DOMException("The Flight request was cancelled.", "AbortError")

export function createFlightBrowserHttpTransportsV1({ fetchImpl = globalThis.fetch, getSessionClient = getAccountSessionClient } = {}) {
  if (typeof fetchImpl !== "function" || typeof getSessionClient !== "function") throw new TypeError("trusted Flight browser transport dependencies are required")

  const accessToken = async () => {
    let result
    try {
      const client = getSessionClient()
      if (!client?.auth || typeof client.auth.getSession !== "function") throw internalError()
      result = await client.auth.getSession()
    } catch {
      throw internalError()
    }
    if (!plain(result) || !plain(result.data) || result.error) throw internalError()
    const session = result.data.session
    if (session === null) return null
    if (!plain(session) || typeof session.access_token !== "string" || !session.access_token) throw internalError()
    return session.access_token
  }

  const transport = (path, protectedRoute) => async (request, { signal } = {}) => {
    if (!plain(request)) throw internalError()
    let serialized
    try { serialized = JSON.stringify(request) } catch { throw internalError() }
    if (signal?.aborted) throw abortError()

    const headers = { "Content-Type": "application/json" }
    if (protectedRoute) {
      let token
      try { token = await accessToken() } catch (failure) {
        if (signal?.aborted) throw abortError()
        throw failure
      }
      if (signal?.aborted) throw abortError()
      if (token) headers.Authorization = `Bearer ${token}`
    }

    let response
    try {
      response = await fetchImpl(path, {
        method: "POST",
        headers,
        body: serialized,
        signal,
        cache: "no-store",
        credentials: "omit",
      })
    } catch (failure) {
      if (signal?.aborted) throw failure
      throw internalError()
    }
    if (signal?.aborted) throw abortError()
    if (!response || !Number.isInteger(response.status) || response.status < 100 || response.status > 599 || typeof response.json !== "function") throw internalError()

    let body
    try { body = await response.json() } catch {
      if (signal?.aborted) throw abortError()
      throw internalError()
    }
    if (signal?.aborted) throw abortError()
    if (!plain(body)) throw internalError()
    return Object.freeze({ status: response.status, body })
  }

  return Object.freeze({
    flightSearchTransport: transport(FLIGHT_BROWSER_HTTP_PATHS_V1.search, false),
    flightRepriceTransport: transport(FLIGHT_BROWSER_HTTP_PATHS_V1.reprice, false),
    flightCheckoutTransport: transport(FLIGHT_BROWSER_HTTP_PATHS_V1.checkout, false),
    flightBookingIntentTransport: transport(FLIGHT_BROWSER_HTTP_PATHS_V1.bookingIntent, true),
    flightPaymentInitiationTransport: transport(FLIGHT_BROWSER_HTTP_PATHS_V1.paymentInitiation, true),
  })
}
