import { compareDecimal, parseDecimal } from "./decimal.js"
import { PRICED_GROUPED_FLIGHT_SEARCH_VERSION } from "./pricedGroupedSearchV1.js"
import { assertCustomerPriceV1 } from "./pricingFxV1.js"

export const FLIGHT_RANKING_POLICY_VERSION = "flight-ranking-policy/v1"
export const RANKED_GROUPED_FLIGHT_SEARCH_VERSION = "ranked-grouped-flight-search/v1"
export const RANKING_STATUSES = Object.freeze(["RANKED", "UNRANKED"])
export const ACTIVE_RANKING_DIMENSIONS = Object.freeze(["authoritative_customer_price"])
export const FUTURE_RANKING_DIMENSIONS = Object.freeze(["supplier_reliability", "ticketing_success", "operational_latency", "support_sla"])

const POLICY_FIELDS = Object.freeze(["contractVersion", "rankingPolicyVersion", "mode", "validFrom", "validUntil"])
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) deepFreeze(nested)
  }
  return value
}
const iso = (value, field) => {
  if (typeof value !== "string" || !value.includes("T") || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be an ISO date-time`)
  return new Date(value).toISOString()
}
const version = (value, field) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(value)) throw new TypeError(`${field} is invalid`)
  return value
}

export function createFlightRankingPolicyV1(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("trusted ranking policy is required")
  const unknown = Object.keys(input).filter((field) => !POLICY_FIELDS.includes(field))
  if (unknown.length) throw new TypeError(`ranking policy contains unsupported fields: ${unknown.join(", ")}`)
  if (input.contractVersion !== FLIGHT_RANKING_POLICY_VERSION || input.mode !== "price_only") throw new TypeError("unsupported ranking policy")
  const validFrom = iso(input.validFrom, "ranking policy validFrom")
  const validUntil = iso(input.validUntil, "ranking policy validUntil")
  if (Date.parse(validUntil) <= Date.parse(validFrom)) throw new TypeError("ranking policy validity is invalid")
  return deepFreeze({
    contractVersion: FLIGHT_RANKING_POLICY_VERSION,
    rankingPolicyVersion: version(input.rankingPolicyVersion, "rankingPolicyVersion"),
    mode: "price_only",
    activeDimensions: ACTIVE_RANKING_DIMENSIONS,
    futureDimensions: FUTURE_RANKING_DIMENSIONS,
    tieBreak: Object.freeze(["authoritative_customer_price", "first_seen", "internal_offer_id_if_required"]),
    validFrom,
    validUntil,
  })
}

const policyAt = (input, rankedAt) => {
  const policy = createFlightRankingPolicyV1(input)
  const instant = Date.parse(rankedAt)
  if (instant < Date.parse(policy.validFrom) || instant >= Date.parse(policy.validUntil)) throw new TypeError("ranking policy is not active")
  return policy
}

const preserveUnranked = (pricedResult, rankedAt, policyVersion = null) => deepFreeze({
  contractVersion: RANKED_GROUPED_FLIGHT_SEARCH_VERSION,
  searchStatus: pricedResult.status,
  rankingStatus: "UNRANKED",
  rankingPolicyVersion: policyVersion,
  rankedAt,
  itineraryGroups: pricedResult.itineraryGroups.map((itineraryGroup) => ({
    itineraryFingerprint: itineraryGroup.itineraryFingerprint,
    fareGroups: itineraryGroup.fareGroups.map((fareGroup) => ({
      fareFingerprint: fareGroup.fareFingerprint,
      rankingStatus: "UNRANKED",
      preferredInternalOfferId: null,
      cheapestInternalOfferId: null,
      alternatives: fareGroup.alternatives.map((alternative) => ({ ...alternative, ranking: { rankable: false, rank: null, isPreferred: false } })),
    })),
  })),
})

export function rankPricedGroupedFlightSearchV1(pricedResult, { rankingPolicy, now }) {
  if (!pricedResult || pricedResult.contractVersion !== PRICED_GROUPED_FLIGHT_SEARCH_VERSION || !Array.isArray(pricedResult.itineraryGroups)) throw new TypeError("valid priced grouped flight search is required")
  const rankedAt = iso(now, "rankedAt")
  let policy
  try {
    policy = policyAt(rankingPolicy, rankedAt)
  } catch {
    return preserveUnranked(pricedResult, rankedAt)
  }
  if (pricedResult.status === "UNAVAILABLE") return preserveUnranked(pricedResult, rankedAt, policy.rankingPolicyVersion)

  let anyRanked = false
  const itineraryGroups = pricedResult.itineraryGroups.map((itineraryGroup) => ({
    itineraryFingerprint: itineraryGroup.itineraryFingerprint,
    fareGroups: itineraryGroup.fareGroups.map((fareGroup) => {
      const rankable = []
      const currencies = new Set()
      fareGroup.alternatives.forEach((alternative, firstSeen) => {
        try {
          const price = assertCustomerPriceV1(alternative.customerPrice, alternative.offer?.internalOfferId)
          if (Date.parse(rankedAt) < Date.parse(price.calculatedAt) || Date.parse(rankedAt) >= Date.parse(price.validUntil)) throw new TypeError("customer price is not active")
          const exactAmount = parseDecimal(price.amount, "authoritative customer price")
          currencies.add(price.currency)
          rankable.push({ alternative, firstSeen, exactAmount })
        } catch {
          // Invalid or stale prices remain retained but cannot become preferred.
        }
      })
      if (currencies.size > 1) return {
        fareFingerprint: fareGroup.fareFingerprint,
        rankingStatus: "UNRANKED",
        preferredInternalOfferId: null,
        cheapestInternalOfferId: null,
        alternatives: fareGroup.alternatives.map((alternative) => ({ ...alternative, ranking: { rankable: false, rank: null, isPreferred: false } })),
      }
      const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0
      rankable.sort((left, right) => compareDecimal(left.exactAmount, right.exactAmount) || left.firstSeen - right.firstSeen || lexical(left.alternative.offer.internalOfferId, right.alternative.offer.internalOfferId))
      const ranks = new Map(rankable.map((entry, index) => [entry.alternative.offer.internalOfferId, index + 1]))
      const preferredInternalOfferId = rankable[0]?.alternative.offer.internalOfferId ?? null
      if (preferredInternalOfferId) anyRanked = true
      const retainedIds = new Set(fareGroup.alternatives.map(({ offer }) => offer?.internalOfferId))
      if (preferredInternalOfferId && !retainedIds.has(preferredInternalOfferId)) throw new Error("preferred alternative invariant violated")
      return {
        fareFingerprint: fareGroup.fareFingerprint,
        rankingStatus: preferredInternalOfferId ? "RANKED" : "UNRANKED",
        preferredInternalOfferId,
        cheapestInternalOfferId: preferredInternalOfferId,
        alternatives: fareGroup.alternatives.map((alternative) => {
          const rank = ranks.get(alternative.offer?.internalOfferId) ?? null
          return { ...alternative, ranking: { rankable: rank !== null, rank, isPreferred: alternative.offer?.internalOfferId === preferredInternalOfferId } }
        }),
      }
    }),
  }))

  return deepFreeze({
    contractVersion: RANKED_GROUPED_FLIGHT_SEARCH_VERSION,
    searchStatus: pricedResult.status,
    rankingStatus: anyRanked ? "RANKED" : "UNRANKED",
    rankingPolicyVersion: policy.rankingPolicyVersion,
    rankedAt,
    itineraryGroups,
  })
}
