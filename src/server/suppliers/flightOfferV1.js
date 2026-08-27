import { assertKnownProvider } from "./providerIdentity.js"
import { assertSupplierOperation } from "./supplierOperations.js"

export const FLIGHT_OFFER_CONTRACT_VERSION = "flight-offer/v1"
export const COMPARISON_SEMANTICS = Object.freeze(["unknown", "allowed", "not_allowed", "conditional"])

const TOP_LEVEL_FIELDS = Object.freeze([
  "contractVersion", "internalOfferId", "provider", "providerOfferRef", "providerStatusRaw",
  "operationalOutcome", "itinerary", "fare", "economics", "validity", "supportedOperations", "privateMetadata",
])
const ITINERARY_FIELDS = Object.freeze([
  "origin", "destination", "departureAt", "arrivalAt", "durationMinutes", "stops", "marketingCarrierName", "segments",
])
const SEGMENT_FIELDS = Object.freeze([
  "marketingCarrier", "operatingCarrier", "flightNumber", "origin", "destination", "departureAt", "arrivalAt", "cabin", "aircraft",
])
const FARE_FIELDS = Object.freeze(["fareBrand", "cabin", "baggage", "changeability", "refundability", "privateMetadata"])
const ECONOMICS_FIELDS = Object.freeze(["supplierAmount", "supplierCurrency"])
const VALIDITY_FIELDS = Object.freeze(["expiresAt", "repriceRequired"])
const PRIVATE_FORBIDDEN = /password|secret|credential|authorization|access.?token|refresh.?token|api.?key|private.?key|raw.?response/i

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value)
const requireObject = (value, field) => {
  if (!isObject(value)) throw new TypeError(`${field} must be an object`)
  return value
}
const requireText = (value, field) => {
  if (typeof value !== "string" || !value.trim() || value.length > 240) throw new TypeError(`${field} is required`)
  return value
}
const optionalText = (value, field) => value === null || value === undefined ? null : requireText(value, field)
const exactKeys = (value, allowed, field) => {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length) throw new TypeError(`${field} contains unsupported fields: ${unknown.join(", ")}`)
}
const requireDate = (value, field) => {
  requireText(value, field)
  if (!value.includes("T") || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be an ISO date-time`)
  return value
}
const requireAirport = (value, field) => {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) throw new TypeError(`${field} must be an IATA airport code`)
  return value
}
const requireCurrency = (value, field) => {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) throw new TypeError(`${field} must be an ISO currency`)
  return value
}
const requirePositiveAmount = (value) => {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(value) || Number(value) <= 0) throw new TypeError("supplierAmount must be a positive decimal string")
  return value
}
const requireComparison = (value, field) => {
  if (!COMPARISON_SEMANTICS.includes(value)) throw new TypeError(`${field} is invalid`)
  return value
}
const clonePrivateEnvelope = (value, field) => {
  const object = value === undefined ? {} : requireObject(value, field)
  const serialized = JSON.stringify(object)
  if (serialized.length > 16_384 || PRIVATE_FORBIDDEN.test(serialized)) throw new TypeError(`${field} contains unsafe provider data`)
  return structuredClone(object)
}
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) deepFreeze(nested)
  }
  return value
}

function normalizeSegment(segment, index) {
  requireObject(segment, `segments[${index}]`)
  exactKeys(segment, SEGMENT_FIELDS, `segments[${index}]`)
  const departureAt = requireDate(segment.departureAt, `segments[${index}].departureAt`)
  const arrivalAt = requireDate(segment.arrivalAt, `segments[${index}].arrivalAt`)
  if (Date.parse(arrivalAt) <= Date.parse(departureAt)) throw new TypeError(`segments[${index}] arrival must follow departure`)
  return {
    marketingCarrier: requireText(segment.marketingCarrier, `segments[${index}].marketingCarrier`),
    operatingCarrier: optionalText(segment.operatingCarrier, `segments[${index}].operatingCarrier`),
    flightNumber: requireText(segment.flightNumber, `segments[${index}].flightNumber`),
    origin: requireAirport(segment.origin, `segments[${index}].origin`),
    destination: requireAirport(segment.destination, `segments[${index}].destination`),
    departureAt,
    arrivalAt,
    cabin: requireText(segment.cabin, `segments[${index}].cabin`),
    aircraft: optionalText(segment.aircraft, `segments[${index}].aircraft`),
  }
}

export function createFlightOfferV1(input) {
  requireObject(input, "FlightOfferV1")
  exactKeys(input, TOP_LEVEL_FIELDS, "FlightOfferV1")
  if (input.contractVersion !== FLIGHT_OFFER_CONTRACT_VERSION) throw new TypeError(`unsupported FlightOffer contract version: ${input.contractVersion}`)
  if (typeof input.internalOfferId !== "string" || !/^hfo_[A-Za-z0-9_-]{8,}$/.test(input.internalOfferId)) throw new TypeError("internalOfferId must be an opaque HAJIZ offer ID")
  const provider = assertKnownProvider(input.provider)
  const itinerary = requireObject(input.itinerary, "itinerary")
  exactKeys(itinerary, ITINERARY_FIELDS, "itinerary")
  if (!Array.isArray(itinerary.segments) || itinerary.segments.length < 1) throw new TypeError("itinerary.segments is required")
  const segments = itinerary.segments.map(normalizeSegment)
  const origin = requireAirport(itinerary.origin, "itinerary.origin")
  const destination = requireAirport(itinerary.destination, "itinerary.destination")
  const departureAt = requireDate(itinerary.departureAt, "itinerary.departureAt")
  const arrivalAt = requireDate(itinerary.arrivalAt, "itinerary.arrivalAt")
  if (origin !== segments[0].origin || destination !== segments.at(-1).destination || departureAt !== segments[0].departureAt || arrivalAt !== segments.at(-1).arrivalAt) throw new TypeError("itinerary boundaries must match segments")
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index - 1].destination !== segments[index].origin || Date.parse(segments[index].departureAt) < Date.parse(segments[index - 1].arrivalAt)) throw new TypeError("segment continuity is invalid")
  }
  if (!Number.isInteger(itinerary.durationMinutes) || itinerary.durationMinutes <= 0) throw new TypeError("durationMinutes must be positive")
  if (!Number.isInteger(itinerary.stops) || itinerary.stops !== Math.max(0, segments.length - 1)) throw new TypeError("stops must match segment count")

  const fare = requireObject(input.fare, "fare")
  exactKeys(fare, FARE_FIELDS, "fare")
  const economics = requireObject(input.economics, "economics")
  exactKeys(economics, ECONOMICS_FIELDS, "economics")
  const validity = requireObject(input.validity, "validity")
  exactKeys(validity, VALIDITY_FIELDS, "validity")
  const expiresAt = validity.expiresAt === null || validity.expiresAt === undefined ? null : requireDate(validity.expiresAt, "validity.expiresAt")
  if (typeof validity.repriceRequired !== "boolean") throw new TypeError("validity.repriceRequired must be boolean")
  if (!Array.isArray(input.supportedOperations)) throw new TypeError("supportedOperations must be an array")
  const supportedOperations = [...new Set(input.supportedOperations.map(assertSupplierOperation))]

  return deepFreeze({
    contractVersion: FLIGHT_OFFER_CONTRACT_VERSION,
    internalOfferId: input.internalOfferId,
    provider,
    providerOfferRef: requireText(input.providerOfferRef, "providerOfferRef"),
    providerStatusRaw: optionalText(input.providerStatusRaw, "providerStatusRaw"),
    operationalOutcome: input.operationalOutcome === "repriced" ? "repriced" : "available",
    itinerary: {
      origin, destination, departureAt, arrivalAt,
      durationMinutes: itinerary.durationMinutes,
      stops: itinerary.stops,
      marketingCarrierName: optionalText(itinerary.marketingCarrierName, "itinerary.marketingCarrierName"),
      segments,
    },
    fare: {
      fareBrand: optionalText(fare.fareBrand, "fare.fareBrand"),
      cabin: requireText(fare.cabin, "fare.cabin"),
      baggage: requireText(fare.baggage, "fare.baggage"),
      changeability: requireComparison(fare.changeability, "fare.changeability"),
      refundability: requireComparison(fare.refundability, "fare.refundability"),
      privateMetadata: clonePrivateEnvelope(fare.privateMetadata, "fare.privateMetadata"),
    },
    economics: {
      supplierAmount: requirePositiveAmount(economics.supplierAmount),
      supplierCurrency: requireCurrency(economics.supplierCurrency, "supplierCurrency"),
    },
    validity: { expiresAt, repriceRequired: validity.repriceRequired },
    supportedOperations,
    privateMetadata: clonePrivateEnvelope(input.privateMetadata, "privateMetadata"),
  })
}

export const assertFlightOfferV1 = createFlightOfferV1
