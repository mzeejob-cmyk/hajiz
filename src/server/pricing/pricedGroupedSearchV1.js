import { GROUPED_FLIGHT_SEARCH_VERSION, toPublicGroupedFlightSearchV1 } from "../suppliers/flightOfferGrouping.js"
import { createCustomerPriceV1, priceFlightOfferV1 } from "./pricingFxV1.js"

export const PRICED_GROUPED_FLIGHT_SEARCH_VERSION = "priced-grouped-flight-search/v1"

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) deepFreeze(nested)
  }
  return value
}

const snapshotFor = (snapshots, base, quote) => {
  const key = `${base}_${quote}`
  if (!snapshots || typeof snapshots !== "object" || !Object.hasOwn(snapshots, key)) throw new TypeError(`trusted ${base} to ${quote} FX snapshot is required`)
  return snapshots[key]
}

export function priceGroupedFlightSearchV1(groupedResult, { pricingPolicy, fxSnapshotsByPair, customerCurrency, now }) {
  if (!groupedResult || groupedResult.contractVersion !== GROUPED_FLIGHT_SEARCH_VERSION || !Array.isArray(groupedResult.itineraryGroups)) throw new TypeError("valid grouped flight search is required")
  const customerPriceByInternalOfferId = Object.create(null)
  const itineraryGroups = groupedResult.itineraryGroups.map((itineraryGroup) => ({
    itineraryFingerprint: itineraryGroup.itineraryFingerprint,
    fareGroups: itineraryGroup.fareGroups.map((fareGroup) => ({
      fareFingerprint: fareGroup.fareFingerprint,
      alternatives: fareGroup.alternatives.map((offer) => {
        const pricedOffer = priceFlightOfferV1(offer, {
          pricingPolicy,
          supplierFxSnapshot: snapshotFor(fxSnapshotsByPair, offer.economics.supplierCurrency, "USD"),
          now,
        })
        const customerPrice = createCustomerPriceV1(pricedOffer, {
          displayFxSnapshot: snapshotFor(fxSnapshotsByPair, "USD", customerCurrency),
          customerCurrency,
          now,
        })
        customerPriceByInternalOfferId[offer.internalOfferId] = customerPrice
        return { offer, pricedOffer, customerPrice }
      }),
    })),
  }))
  return deepFreeze({
    contractVersion: PRICED_GROUPED_FLIGHT_SEARCH_VERSION,
    status: groupedResult.status,
    itineraryGroups,
    customerPriceByInternalOfferId,
  })
}

export function toPublicPricedGroupedFlightSearchV1(groupedResult, pricedGroupedResult) {
  if (!pricedGroupedResult || pricedGroupedResult.contractVersion !== PRICED_GROUPED_FLIGHT_SEARCH_VERSION) throw new TypeError("valid priced grouped search is required")
  return toPublicGroupedFlightSearchV1(groupedResult, pricedGroupedResult.customerPriceByInternalOfferId)
}
