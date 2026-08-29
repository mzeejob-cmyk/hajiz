import { createHmac } from "node:crypto"
import { createCustomerPriceV1, priceFlightOfferV1 } from "../pricing/pricingFxV1.js"
import { requireCapability } from "../suppliers/flightSupplierContract.js"

export const CUSTOMER_FLIGHT_REPRICE_VERSION = "customer-flight-reprice/v1"
export const CUSTOMER_FLIGHT_REPRICE_STATUSES = Object.freeze(["AVAILABLE", "PRICE_CHANGED", "UNAVAILABLE"])

export class FlightRepriceServiceError extends Error {
  constructor(code) { super(code); this.name = "FlightRepriceServiceError"; this.code = code }
}

const snapshotFor = (snapshots, base, quote) => {
  const key = `${base}_${quote}`
  if (!snapshots || !Object.hasOwn(snapshots, key)) throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE")
  return snapshots[key]
}
const publicPrice = (price) => Object.freeze({ amount: price.amount, currency: price.currency, validUntil: price.validUntil })
const unavailable = (alternativeId, now) => Object.freeze({
  contractVersion: CUSTOMER_FLIGHT_REPRICE_VERSION, alternativeId, repriceStatus: "UNAVAILABLE",
  itinerary: null, fare: null, previousCustomerPrice: null, currentCustomerPrice: null,
  priceChanged: false, pricedSelectionId: null, revalidatedAt: now, validUntil: null,
})

export function createCustomerFlightRepriceServiceV1({ resolver, supplierRegistry, pricingPolicy, fxSnapshotsByPair, tokenSecret, clock = Date.now }) {
  if (!resolver || typeof resolver.resolve !== "function" || !supplierRegistry || typeof supplierRegistry.getByServerProviderName !== "function") throw new TypeError("trusted reprice dependencies are required")
  if (typeof tokenSecret !== "string" || tokenSecret.length < 32 || typeof clock !== "function") throw new TypeError("trusted reprice token configuration is required")
  const pricedSelections = new Map()
  const mint = (entry, price) => `hpr_v1_${createHmac("sha256", tokenSecret).update(JSON.stringify([entry.alternativeId, entry.offer.internalOfferId, price.currency, price.amount, price.validUntil])).digest("hex").slice(0, 40)}`
  return Object.freeze({
    async reprice({ alternativeId, customerCurrency }, { signal } = {}) {
      const entry = resolver.resolve(alternativeId)
      const adapter = supplierRegistry.getByServerProviderName(entry.offer.provider)
      requireCapability(adapter, "reprice")
      let offer
      try { offer = await adapter.repriceOffer(entry.offer.providerOfferRef, { signal }) } catch (error) {
        if (error?.code === "REQUEST_TIMEOUT" || error?.name === "AbortError") throw new FlightRepriceServiceError("REQUEST_TIMEOUT")
        throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE")
      }
      const now = new Date(clock()).toISOString()
      if (!offer || offer.operationalOutcome === "unavailable") return unavailable(alternativeId, now)
      if (offer.internalOfferId !== entry.offer.internalOfferId || offer.provider !== entry.offer.provider || offer.providerOfferRef !== entry.offer.providerOfferRef) throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE")
      let customerPrice
      try {
        const priced = priceFlightOfferV1(offer, { pricingPolicy, supplierFxSnapshot: snapshotFor(fxSnapshotsByPair, offer.economics.supplierCurrency, "USD"), now })
        customerPrice = createCustomerPriceV1(priced, { displayFxSnapshot: snapshotFor(fxSnapshotsByPair, "USD", customerCurrency), customerCurrency, now })
      } catch { throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE") }
      const current = publicPrice(customerPrice)
      const previous = entry.previousCustomerPrice.currency === customerCurrency ? entry.previousCustomerPrice : null
      const priceChanged = Boolean(previous && previous.amount !== current.amount)
      const pricedSelectionId = mint(entry, current)
      if (!pricedSelections.has(pricedSelectionId)) pricedSelections.set(pricedSelectionId, Object.freeze({ alternativeId, internalOfferId: offer.internalOfferId, provider: offer.provider, providerOfferRef: offer.providerOfferRef, customerPrice: current, expiresAt: current.validUntil }))
      return Object.freeze({
        contractVersion: CUSTOMER_FLIGHT_REPRICE_VERSION, alternativeId, repriceStatus: priceChanged ? "PRICE_CHANGED" : "AVAILABLE",
        itinerary: entry.itinerary, fare: entry.fare, previousCustomerPrice: previous, currentCustomerPrice: current,
        priceChanged, pricedSelectionId, revalidatedAt: now, validUntil: current.validUntil,
      })
    },
    resolvePricedSelection(pricedSelectionId) {
      const selection = pricedSelections.get(pricedSelectionId)
      if (!selection || Date.parse(selection.expiresAt) <= clock()) throw new FlightRepriceServiceError("PRICED_SELECTION_EXPIRED")
      return selection
    },
  })
}
