export const FLIGHT_SEARCH_HTTP_VERSION = "customer-flight-search-http/v1"
export const FLIGHT_SEARCH_VERSION = "customer-flight-search/v1"
export const FLIGHT_SEARCH_ERROR_VERSION = "customer-flight-search-http-error/v1"

const exact = (value, keys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} is invalid`)
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) throw new TypeError(`${label} has unexpected fields`)
  return value
}
const string = (value, label, pattern) => {
  if (typeof value !== "string" || (pattern && !pattern.test(value))) throw new TypeError(`${label} is invalid`)
  return value
}
const integer = (value, label, minimum = 0) => {
  if (!Number.isInteger(value) || value < minimum) throw new TypeError(`${label} is invalid`)
  return value
}
const iso = (value, label) => string(value, label) && Number.isFinite(Date.parse(value)) ? value : (() => { throw new TypeError(`${label} is invalid`) })()

function parseSegment(value) {
  const segment = exact(value, ["marketingCarrier", "flightNumber", "origin", "destination", "departureAt", "arrivalAt", "cabin"], "segment")
  return Object.freeze({
    marketingCarrier: string(segment.marketingCarrier, "marketingCarrier"), flightNumber: string(segment.flightNumber, "flightNumber"),
    origin: string(segment.origin, "origin", /^[A-Z]{3}$/), destination: string(segment.destination, "destination", /^[A-Z]{3}$/),
    departureAt: iso(segment.departureAt, "departureAt"), arrivalAt: iso(segment.arrivalAt, "arrivalAt"), cabin: string(segment.cabin, "cabin"),
  })
}

function parseItinerary(value) {
  const itinerary = exact(value, ["marketingCarrierName", "origin", "destination", "departureAt", "arrivalAt", "durationMinutes", "stops", "segments"], "itinerary")
  if (!Array.isArray(itinerary.segments) || itinerary.segments.length < 1) throw new TypeError("segments are invalid")
  return Object.freeze({
    marketingCarrierName: string(itinerary.marketingCarrierName, "marketingCarrierName"),
    origin: string(itinerary.origin, "origin", /^[A-Z]{3}$/), destination: string(itinerary.destination, "destination", /^[A-Z]{3}$/),
    departureAt: iso(itinerary.departureAt, "departureAt"), arrivalAt: iso(itinerary.arrivalAt, "arrivalAt"),
    durationMinutes: integer(itinerary.durationMinutes, "durationMinutes", 1), stops: integer(itinerary.stops, "stops"),
    segments: Object.freeze(itinerary.segments.map(parseSegment)),
  })
}

function parseAlternative(value, currency) {
  const alternative = exact(value, ["alternativeId", "fare", "price", "recommended"], "alternative")
  const fare = exact(alternative.fare, ["fareBrand", "cabin", "baggage", "changeability", "refundability"], "fare")
  const price = exact(alternative.price, ["amount", "currency", "validUntil"], "price")
  if (typeof alternative.recommended !== "boolean" || price.currency !== currency) throw new TypeError("alternative is invalid")
  return Object.freeze({
    alternativeId: string(alternative.alternativeId, "alternativeId"), recommended: alternative.recommended,
    fare: Object.freeze({ fareBrand: fare.fareBrand === null ? null : string(fare.fareBrand, "fareBrand"), cabin: string(fare.cabin, "cabin"), baggage: string(fare.baggage, "baggage"), changeability: string(fare.changeability, "changeability"), refundability: string(fare.refundability, "refundability") }),
    price: Object.freeze({ amount: string(price.amount, "amount", /^\d+(?:\.\d+)?$/), currency: string(price.currency, "currency", /^(USD|AED|SDG)$/), validUntil: iso(price.validUntil, "validUntil") }),
  })
}

function parseGroup(value, currency) {
  const group = exact(value, ["groupId", "status", "recommendationAvailable", "preferredAlternativeId", "itinerary", "alternatives"], "group")
  if (!["RANKED", "UNRANKED", "UNAVAILABLE"].includes(group.status) || typeof group.recommendationAvailable !== "boolean" || !Array.isArray(group.alternatives)) throw new TypeError("group is invalid")
  const alternatives = Object.freeze(group.alternatives.map((item) => parseAlternative(item, currency)))
  if (group.preferredAlternativeId !== null && typeof group.preferredAlternativeId !== "string") throw new TypeError("preferredAlternativeId is invalid")
  if (group.recommendationAvailable !== (group.status === "RANKED") || alternatives.some((item) => item.recommended !== (group.recommendationAvailable && item.alternativeId === group.preferredAlternativeId))) throw new TypeError("recommendation is inconsistent")
  return Object.freeze({ groupId: string(group.groupId, "groupId"), status: group.status, recommendationAvailable: group.recommendationAvailable, preferredAlternativeId: group.preferredAlternativeId, itinerary: group.itinerary === null ? null : parseItinerary(group.itinerary), alternatives })
}

export function parseFlightSearchHttpResponseV1(input) {
  const envelope = exact(input, ["contractVersion", "data"], "HTTP response")
  if (envelope.contractVersion !== FLIGHT_SEARCH_HTTP_VERSION) throw new TypeError("unsupported HTTP contract")
  const data = exact(envelope.data, ["contractVersion", "searchStatus", "currency", "groups"], "search result")
  if (data.contractVersion !== FLIGHT_SEARCH_VERSION || !["COMPLETE", "PARTIAL"].includes(data.searchStatus) || !/^(USD|AED|SDG)$/.test(data.currency) || !Array.isArray(data.groups)) throw new TypeError("search result is invalid")
  return Object.freeze({ contractVersion: data.contractVersion, searchStatus: data.searchStatus, currency: data.currency, groups: Object.freeze(data.groups.map((group) => parseGroup(group, data.currency))) })
}

export class FlightSearchClientError extends Error {
  constructor(kind) { super(kind); this.name = "FlightSearchClientError"; this.kind = kind }
}

const ERROR_BY_STATUS = Object.freeze({ 400: "validation_error", 503: "unavailable", 504: "timeout" })
export function createFlightSearchClientV1({ transport }) {
  if (typeof transport !== "function") throw new TypeError("injected flight search transport is required")
  return Object.freeze({
    async search(request, { signal } = {}) {
      const response = await transport(request, { signal })
      if (!response || typeof response !== "object" || !Number.isInteger(response.status)) throw new FlightSearchClientError("internal_error")
      if (response.status === 200) {
        try { return parseFlightSearchHttpResponseV1(response.body) } catch { throw new FlightSearchClientError("internal_error") }
      }
      const kind = ERROR_BY_STATUS[response.status] ?? "internal_error"
      const body = response.body
      if (!body || body.contractVersion !== FLIGHT_SEARCH_ERROR_VERSION || body.error?.code !== ({ validation_error: "VALIDATION_ERROR", unavailable: "SEARCH_UNAVAILABLE", timeout: "REQUEST_TIMEOUT", internal_error: "INTERNAL_ERROR" }[kind])) throw new FlightSearchClientError("internal_error")
      throw new FlightSearchClientError(kind)
    },
  })
}
