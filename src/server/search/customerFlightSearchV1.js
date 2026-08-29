import { createHash } from "node:crypto"
import { RANKED_GROUPED_FLIGHT_SEARCH_VERSION } from "../pricing/flightRankingV1.js"
import { assertCustomerPriceV1 } from "../pricing/pricingFxV1.js"
import { assertFlightOfferV1 } from "../suppliers/flightOfferV1.js"

export const CUSTOMER_FLIGHT_SEARCH_VERSION = "customer-flight-search/v1"
export const CUSTOMER_SEARCH_STATUSES = Object.freeze(["COMPLETE", "PARTIAL", "UNAVAILABLE"])
export const CUSTOMER_GROUP_STATUSES = Object.freeze(["RANKED", "UNRANKED", "UNAVAILABLE"])

const RESULT_FIELDS = Object.freeze(["contractVersion", "searchStatus", "rankingStatus", "rankingPolicyVersion", "rankedAt", "itineraryGroups"])
const ITINERARY_GROUP_FIELDS = Object.freeze(["itineraryFingerprint", "fareGroups"])
const FARE_GROUP_FIELDS = Object.freeze(["fareFingerprint", "rankingStatus", "preferredInternalOfferId", "cheapestInternalOfferId", "alternatives"])
const ALTERNATIVE_FIELDS = Object.freeze(["offer", "pricedOffer", "customerPrice", "ranking"])
const RANKING_FIELDS = Object.freeze(["rankable", "rank", "isPreferred"])

const object = (value, field) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${field} must be an object`)
  return value
}
const exactKeys = (value, allowed, field) => {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unexpected.length) throw new TypeError(`${field} contains unsupported fields: ${unexpected.join(", ")}`)
}
const iso = (value, field) => {
  if (typeof value !== "string" || !value.includes("T") || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be an ISO date-time`)
  return new Date(value).toISOString()
}
const currency = (value) => {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) throw new TypeError("customerCurrency must be an ISO currency")
  return value
}
const canonicalObject = (value) => {
  if (Array.isArray(value)) return value.map(canonicalObject)
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalObject(value[key])]))
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value
  throw new TypeError("customer ID input must contain only JSON-safe values")
}
export const canonicalCustomerIdJsonV1 = (value) => JSON.stringify(canonicalObject(value))
export const customerOpaqueIdV1 = (domain, identity) => {
  if (!["hcg_v1", "hca_v1"].includes(domain)) throw new TypeError("customer ID domain is invalid")
  const hash = createHash("sha256")
  hash["update"](canonicalCustomerIdJsonV1([domain, identity]))
  return `${domain}_${hash.digest("hex").slice(0, 32)}`
}
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) deepFreeze(nested)
  }
  return value
}

const customerItinerary = (offer) => ({
  marketingCarrierName: offer.itinerary.marketingCarrierName,
  origin: offer.itinerary.origin,
  destination: offer.itinerary.destination,
  departureAt: offer.itinerary.departureAt,
  arrivalAt: offer.itinerary.arrivalAt,
  durationMinutes: offer.itinerary.durationMinutes,
  stops: offer.itinerary.stops,
  segments: offer.itinerary.segments.map((segment) => ({
    marketingCarrier: segment.marketingCarrier,
    flightNumber: segment.flightNumber,
    origin: segment.origin,
    destination: segment.destination,
    departureAt: segment.departureAt,
    arrivalAt: segment.arrivalAt,
    cabin: segment.cabin,
  })),
})

const customerFare = (offer) => ({
  fareBrand: offer.fare.fareBrand,
  cabin: offer.fare.cabin,
  baggage: offer.fare.baggage,
  changeability: offer.fare.changeability,
  refundability: offer.fare.refundability,
})

function assertRankedResult(input) {
  const result = object(input, "ranked search result")
  exactKeys(result, RESULT_FIELDS, "ranked search result")
  if (result.contractVersion !== RANKED_GROUPED_FLIGHT_SEARCH_VERSION) throw new TypeError("unsupported ranked search result version")
  if (!CUSTOMER_SEARCH_STATUSES.includes(result.searchStatus)) throw new TypeError("ranked search status is invalid")
  if (!CUSTOMER_GROUP_STATUSES.slice(0, 2).includes(result.rankingStatus)) throw new TypeError("overall ranking status is invalid")
  if (!Array.isArray(result.itineraryGroups)) throw new TypeError("ranked itinerary groups are required")
  iso(result.rankedAt, "rankedAt")
  return result
}

function projectAlternative(input, expectedCurrency, projectedAt, groupIdentity) {
  const alternative = object(input, "ranked alternative")
  exactKeys(alternative, ALTERNATIVE_FIELDS, "ranked alternative")
  const offer = assertFlightOfferV1(alternative.offer)
  const ranking = object(alternative.ranking, "alternative ranking")
  exactKeys(ranking, RANKING_FIELDS, "alternative ranking")
  if (typeof ranking.rankable !== "boolean" || typeof ranking.isPreferred !== "boolean" || (ranking.rank !== null && (!Number.isInteger(ranking.rank) || ranking.rank < 1))) throw new TypeError("alternative ranking is invalid")

  let price
  try {
    price = assertCustomerPriceV1(alternative.customerPrice, offer.internalOfferId)
  } catch {
    return null
  }
  if (price.currency !== expectedCurrency || Date.parse(projectedAt) < Date.parse(price.calculatedAt) || Date.parse(projectedAt) >= Date.parse(price.validUntil)) return null

  const fare = customerFare(offer)
  const publicPrice = { amount: price.amount, currency: price.currency, validUntil: price.validUntil }
  const identity = { fare, price: publicPrice }
  return {
    identity: canonicalCustomerIdJsonV1(identity),
    internalOfferId: offer.internalOfferId,
    offer,
    itinerary: customerItinerary(offer),
    customer: {
      alternativeId: customerOpaqueIdV1("hca_v1", { groupIdentity, customerIdentity: identity }),
      fare,
      price: publicPrice,
      recommended: false,
    },
  }
}

export function toCustomerFlightSearchV1(rankedInput, { customerCurrency, now, collectResolutionEntry }) {
  if (collectResolutionEntry !== undefined && typeof collectResolutionEntry !== "function") throw new TypeError("resolution collector must be a function")
  const ranked = assertRankedResult(rankedInput)
  const expectedCurrency = currency(customerCurrency)
  const projectedAt = iso(now, "projection time")
  const groups = []

  for (const itineraryGroupInput of ranked.itineraryGroups) {
    const itineraryGroup = object(itineraryGroupInput, "ranked itinerary group")
    exactKeys(itineraryGroup, ITINERARY_GROUP_FIELDS, "ranked itinerary group")
    if (typeof itineraryGroup.itineraryFingerprint !== "string" || !Array.isArray(itineraryGroup.fareGroups)) throw new TypeError("ranked itinerary group is invalid")

    for (const fareGroupInput of itineraryGroup.fareGroups) {
      const fareGroup = object(fareGroupInput, "ranked fare group")
      exactKeys(fareGroup, FARE_GROUP_FIELDS, "ranked fare group")
      if (typeof fareGroup.fareFingerprint !== "string" || !Array.isArray(fareGroup.alternatives) || !CUSTOMER_GROUP_STATUSES.slice(0, 2).includes(fareGroup.rankingStatus)) throw new TypeError("ranked fare group is invalid")

      const firstOffer = fareGroup.alternatives.length ? assertFlightOfferV1(fareGroup.alternatives[0]?.offer) : null
      const groupIdentity = [itineraryGroup.itineraryFingerprint, fareGroup.fareFingerprint]
      const unique = new Map()
      for (const input of fareGroup.alternatives) {
        const projected = ranked.searchStatus === "UNAVAILABLE" ? null : projectAlternative(input, expectedCurrency, projectedAt, groupIdentity)
        if (!projected) continue
        const existing = unique.get(projected.identity)
        if (existing) { existing.internalOfferIds.push(projected.internalOfferId); existing.offers.push(projected.offer) }
        else unique.set(projected.identity, { customer: projected.customer, itinerary: projected.itinerary, internalOfferIds: [projected.internalOfferId], offers: [projected.offer] })
      }

      const retained = [...unique.values()]
      const preferred = fareGroup.rankingStatus === "RANKED"
        ? retained.find(({ internalOfferIds }) => internalOfferIds.includes(fareGroup.preferredInternalOfferId))
        : null
      const alternatives = retained.map(({ customer }) => ({ ...customer, recommended: customer.alternativeId === preferred?.customer.alternativeId }))
      retained.forEach((entry, index) => collectResolutionEntry?.(Object.freeze({ alternativeId: alternatives[index].alternativeId, offer: entry.offers[0], previousCustomerPrice: entry.customer.price, itinerary: entry.itinerary, fare: entry.customer.fare })))
      const groupStatus = alternatives.length === 0 ? "UNAVAILABLE" : preferred ? "RANKED" : "UNRANKED"
      groups.push({
        groupId: customerOpaqueIdV1("hcg_v1", groupIdentity),
        status: groupStatus,
        recommendationAvailable: groupStatus === "RANKED",
        preferredAlternativeId: preferred?.customer.alternativeId ?? null,
        itinerary: retained[0]?.itinerary ?? (firstOffer && alternatives.length ? customerItinerary(firstOffer) : null),
        alternatives,
      })
    }
  }

  return deepFreeze({
    contractVersion: CUSTOMER_FLIGHT_SEARCH_VERSION,
    searchStatus: ranked.searchStatus,
    currency: expectedCurrency,
    groups,
  })
}
