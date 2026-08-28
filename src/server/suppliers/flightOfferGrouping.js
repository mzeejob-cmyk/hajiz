import { createHash } from "node:crypto"
import { assertFlightOfferV1 } from "./flightOfferV1.js"
import { toPublicFlightOffer } from "./publicOfferMapper.js"
import { MULTI_SUPPLIER_SEARCH_CONTRACT_VERSION, MULTI_SUPPLIER_SEARCH_STATUSES } from "./multiSupplierSearchOrchestrator.js"
import { assertCustomerPriceV1 } from "../pricing/pricingFxV1.js"

export const ITINERARY_FINGERPRINT_VERSION = "itinerary-fingerprint/v1"
export const FARE_FINGERPRINT_VERSION = "fare-fingerprint/v1"
export const GROUPED_FLIGHT_SEARCH_VERSION = "grouped-flight-search/v1"
export const PUBLIC_GROUPED_FLIGHT_SEARCH_VERSION = "public-grouped-flight-search/v1"
export const INCOMPLETE_FARE_TEXT_MARKERS = Object.freeze({
  fareBrand: Object.freeze(["unknown"]),
  baggage: Object.freeze(["subject to fare terms", "unknown"]),
  cabin: Object.freeze(["unspecified", "unknown"]),
})

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) deepFreeze(nested)
  }
  return value
}
const digest = (value) => {
  const hash = createHash("sha256")
  hash["update"](JSON.stringify(value))
  return hash.digest("hex")
}
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

const isIncompleteFareText = (value, field) => typeof value !== "string"
  || INCOMPLETE_FARE_TEXT_MARKERS[field].includes(value.trim().toLowerCase())

const hasCompleteFareSemantics = (offer) => !isIncompleteFareText(offer.fare.fareBrand, "fareBrand")
  && offer.fare.refundability !== "unknown"
  && offer.fare.changeability !== "unknown"
  && !isIncompleteFareText(offer.fare.cabin, "cabin")
  && !isIncompleteFareText(offer.fare.baggage, "baggage")
  && offer.itinerary.segments.every(({ cabin }) => !isIncompleteFareText(cabin, "cabin"))

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
  const conflictingIdentities = new Set()
  const conflictingProviders = new Set()
  for (const offer of offers) {
    const exactIdentity = `${offer.provider}\u0000${offer.providerOfferRef}`
    const content = duplicateContent(offer)
    if (exactIdentities.has(exactIdentity) && exactIdentities.get(exactIdentity) !== content) {
      conflictingIdentities.add(exactIdentity)
      conflictingProviders.add(offer.provider)
    } else if (!exactIdentities.has(exactIdentity)) {
      exactIdentities.set(exactIdentity, content)
    }
  }
  const retainedIdentities = new Set()
  const itineraryGroups = []
  const itineraryByFingerprint = new Map()

  for (const offer of offers) {
    const exactIdentity = `${offer.provider}\u0000${offer.providerOfferRef}`
    if (conflictingIdentities.has(exactIdentity) || retainedIdentities.has(exactIdentity)) continue
    retainedIdentities.add(exactIdentity)

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

  const retainedOffers = itineraryGroups.flatMap(({ fareGroups }) => fareGroups.flatMap(({ alternatives }) => alternatives))
  const supplierOutcomes = result.supplierOutcomes.map((outcome) => conflictingProviders.has(outcome.provider) ? {
    ...outcome,
    status: "invalid_response",
    offerCount: retainedOffers.filter(({ provider }) => provider === outcome.provider).length,
    errorCode: "SUPPLIER_DUPLICATE_CONFLICT",
  } : outcome)
  const unaffectedCompleted = result.supplierOutcomes.some(({ provider, status: outcomeStatus }) => !conflictingProviders.has(provider) && (outcomeStatus === "success" || outcomeStatus === "no_results"))
  const status = conflictingIdentities.size ? (retainedOffers.length || unaffectedCompleted ? "PARTIAL" : "UNAVAILABLE") : result.status

  return deepFreeze({
    contractVersion: GROUPED_FLIGHT_SEARCH_VERSION,
    traceId: result.traceId,
    status,
    itineraryGroups: itineraryGroups.map(({ itineraryFingerprint, fareGroups }) => ({ itineraryFingerprint, fareGroups })),
    supplierOutcomes,
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
        if (!Object.hasOwn(customerPriceByInternalOfferId, offer.internalOfferId)) throw new TypeError("authoritative customer price is missing")
        const price = assertCustomerPriceV1(customerPriceByInternalOfferId[offer.internalOfferId], offer.internalOfferId)
        return toPublicFlightOffer(offer, { sellingAmount: price.amount, currency: price.currency })
      }),
    })),
  }))
  return deepFreeze({ contractVersion: PUBLIC_GROUPED_FLIGHT_SEARCH_VERSION, status: result.status, itineraryGroups })
}
