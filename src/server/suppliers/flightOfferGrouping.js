import { createHash } from "node:crypto"
import { assertFlightOfferV1 } from "./flightOfferV1.js"
import { toPublicFlightOffer } from "./publicOfferMapper.js"
import { MULTI_SUPPLIER_SEARCH_CONTRACT_VERSION, MULTI_SUPPLIER_SEARCH_STATUSES } from "./multiSupplierSearchOrchestrator.js"

export const ITINERARY_FINGERPRINT_VERSION = "itinerary-fingerprint/v1"
export const FARE_FINGERPRINT_VERSION = "fare-fingerprint/v1"
export const GROUPED_FLIGHT_SEARCH_VERSION = "grouped-flight-search/v1"
export const PUBLIC_GROUPED_FLIGHT_SEARCH_VERSION = "public-grouped-flight-search/v1"

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) deepFreeze(nested)
  }
  return value
}
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const instant = (value) => new Date(value).toISOString()
const requireFingerprint = (value, prefix, field) => {
  if (typeof value !== "string" || !new RegExp(`^${prefix}_[a-f0-9]{64}(?:_isolated_[1-9]\\d*)?$`).test(value)) throw new TypeError(`${field} is invalid`)
  return value
}

const itineraryIdentity = (offer) => offer.itinerary.segments.map((segment) => [
  segment.marketingCarrier,
  segment.flightNumber,
  segment.origin,
  segment.destination,
  instant(segment.departureAt),
  instant(segment.arrivalAt),
])

const fareIdentity = (offer) => [
  offer.fare.cabin,
  offer.itinerary.segments.map(({ cabin }) => cabin),
  offer.fare.fareBrand,
  offer.fare.baggage,
  offer.fare.refundability,
  offer.fare.changeability,
]

const hasCompleteFareSemantics = (offer) => offer.fare.fareBrand !== null
  && offer.fare.refundability !== "unknown"
  && offer.fare.changeability !== "unknown"

export function itineraryFingerprintV1(privateOffer) {
  const offer = assertFlightOfferV1(privateOffer)
  return `ifp_v1_${digest([ITINERARY_FINGERPRINT_VERSION, itineraryIdentity(offer)])}`
}

export function fareFingerprintV1(privateOffer) {
  const offer = assertFlightOfferV1(privateOffer)
  return Object.freeze({
    fingerprint: `ffp_v1_${digest([FARE_FINGERPRINT_VERSION, fareIdentity(offer)])}`,
    comparisonComplete: hasCompleteFareSemantics(offer),
  })
}

const canonicalObject = (value) => {
  if (Array.isArray(value)) return value.map(canonicalObject)
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalObject(value[key])]))
  return value
}
const duplicateContent = ({ internalOfferId: _ignored, ...offer }) => JSON.stringify(canonicalObject(offer))

function assertPrivateSearchResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new TypeError("private search result is required")
  if (result.contractVersion !== MULTI_SUPPLIER_SEARCH_CONTRACT_VERSION) throw new TypeError("unsupported private search result version")
  if (!MULTI_SUPPLIER_SEARCH_STATUSES.includes(result.status)) throw new TypeError("private search status is invalid")
  if (!Array.isArray(result.offers) || !Array.isArray(result.supplierOutcomes)) throw new TypeError("private search result arrays are required")
  for (const field of ["traceId", "startedAt", "completedAt"]) if (typeof result[field] !== "string" || !result[field]) throw new TypeError(`private search ${field} is required`)
  if (!Number.isFinite(result.durationMs) || result.durationMs < 0) throw new TypeError("private search duration is invalid")
  return result
}

export function groupFlightSearchResultV1(privateSearchResult) {
  const result = assertPrivateSearchResult(privateSearchResult)
  const offers = result.offers.map(assertFlightOfferV1)
  const exactIdentities = new Map()
  const itineraryGroups = []
  const itineraryByFingerprint = new Map()

  for (const offer of offers) {
    const exactIdentity = `${offer.provider}\u0000${offer.providerOfferRef}`
    const content = duplicateContent(offer)
    if (exactIdentities.has(exactIdentity)) {
      if (exactIdentities.get(exactIdentity) !== content) throw new TypeError("conflicting duplicate supplier offer identity")
      continue
    }
    exactIdentities.set(exactIdentity, content)

    const itineraryFingerprint = itineraryFingerprintV1(offer)
    let itineraryGroup = itineraryByFingerprint.get(itineraryFingerprint)
    if (!itineraryGroup) {
      itineraryGroup = { itineraryFingerprint, fareGroups: [], fareByFingerprint: new Map(), isolatedCount: 0 }
      itineraryByFingerprint.set(itineraryFingerprint, itineraryGroup)
      itineraryGroups.push(itineraryGroup)
    }

    const fare = fareFingerprintV1(offer)
    let fareFingerprint = fare.fingerprint
    if (!fare.comparisonComplete) {
      itineraryGroup.isolatedCount += 1
      fareFingerprint = `${fareFingerprint}_isolated_${itineraryGroup.isolatedCount}`
    }
    let fareGroup = itineraryGroup.fareByFingerprint.get(fareFingerprint)
    if (!fareGroup) {
      fareGroup = { fareFingerprint, alternatives: [] }
      itineraryGroup.fareByFingerprint.set(fareFingerprint, fareGroup)
      itineraryGroup.fareGroups.push(fareGroup)
    }
    fareGroup.alternatives.push(offer)
  }

  return deepFreeze({
    contractVersion: GROUPED_FLIGHT_SEARCH_VERSION,
    traceId: result.traceId,
    status: result.status,
    itineraryGroups: itineraryGroups.map(({ itineraryFingerprint, fareGroups }) => ({ itineraryFingerprint, fareGroups })),
    supplierOutcomes: [...result.supplierOutcomes],
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.durationMs,
  })
}

function assertGroupedResult(result) {
  if (!result || typeof result !== "object" || result.contractVersion !== GROUPED_FLIGHT_SEARCH_VERSION) throw new TypeError("unsupported grouped search result version")
  if (!MULTI_SUPPLIER_SEARCH_STATUSES.includes(result.status) || !Array.isArray(result.itineraryGroups) || !Array.isArray(result.supplierOutcomes)) throw new TypeError("grouped search result is invalid")
  for (const group of result.itineraryGroups) {
    requireFingerprint(group?.itineraryFingerprint, "ifp_v1", "itinerary fingerprint")
    if (!Array.isArray(group.fareGroups)) throw new TypeError("fare groups are required")
    for (const fareGroup of group.fareGroups) {
      requireFingerprint(fareGroup?.fareFingerprint, "ffp_v1", "fare fingerprint")
      if (!Array.isArray(fareGroup.alternatives) || fareGroup.alternatives.length === 0) throw new TypeError("fare alternatives are required")
      fareGroup.alternatives.forEach(assertFlightOfferV1)
    }
  }
  return result
}

const publicKey = (prefix, ...identity) => `${prefix}_${digest(identity).slice(0, 32)}`

export function toPublicGroupedFlightSearchV1(groupedResult, customerPriceByInternalOfferId) {
  const result = assertGroupedResult(groupedResult)
  if (!customerPriceByInternalOfferId || typeof customerPriceByInternalOfferId !== "object" || Array.isArray(customerPriceByInternalOfferId)) throw new TypeError("authoritative customer prices are required")
  const itineraryGroups = result.itineraryGroups.map((itineraryGroup) => ({
    groupKey: publicKey("hig", itineraryGroup.itineraryFingerprint),
    fareGroups: itineraryGroup.fareGroups.map((fareGroup) => ({
      fareKey: publicKey("hfg", itineraryGroup.itineraryFingerprint, fareGroup.fareFingerprint),
      alternatives: fareGroup.alternatives.map((offer) => {
        const price = customerPriceByInternalOfferId[offer.internalOfferId]
        if (!price) throw new TypeError("authoritative customer price is missing")
        return toPublicFlightOffer(offer, price)
      }),
    })),
  }))
  return deepFreeze({ contractVersion: PUBLIC_GROUPED_FLIGHT_SEARCH_VERSION, status: result.status, itineraryGroups })
}
