import { createHmac } from "node:crypto"
import { assertCustomerPriceV1, createCustomerPriceV1, priceFlightOfferV1 } from "../pricing/pricingFxV1.js"
import { requireCapability } from "../suppliers/flightSupplierContract.js"
import { FlightPricedSelectionStoreError } from "./flightPricedSelectionStoreV1.js"

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

export function createCustomerFlightRepriceServiceV1({ resolver, pricedSelectionStore, supplierRegistry, pricingPolicy, fxSnapshotsByPair, tokenSecret, clock = Date.now }) {
  if (!resolver || typeof resolver.resolve !== "function" || !pricedSelectionStore?.createOrGet || !pricedSelectionStore?.resolve || !supplierRegistry || typeof supplierRegistry.getByServerProviderName !== "function") throw new TypeError("trusted reprice dependencies are required")
  if (typeof tokenSecret !== "string" || tokenSecret.length < 32 || typeof clock !== "function") throw new TypeError("trusted reprice token configuration is required")
  const mint = (entry, price) => `hpr_v1_${createHmac("sha256", tokenSecret).update(JSON.stringify([entry.alternativeId, entry.offer.internalOfferId, price.currency, price.amount, price.validUntil])).digest("hex").slice(0, 40)}`
  const rememberPricedSelection = async (entry, offer, current) => {
    if (!entry.passengerComposition || !["ADT", "CHD", "INF"].every((type) => Number.isInteger(entry.passengerComposition[type]) && entry.passengerComposition[type] >= 0)) throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE")
    const pricedSelectionId = mint(entry, current)
    try { await pricedSelectionStore.createOrGet(Object.freeze({ pricedSelectionId, alternativeId: entry.alternativeId, internalOfferId: offer.internalOfferId, provider: offer.provider, providerOfferRef: offer.providerOfferRef, customerPrice: current, itinerary: entry.itinerary, fare: entry.fare, passengerComposition: entry.passengerComposition, expiresAt: current.validUntil })) } catch { throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE") }
    return pricedSelectionId
  }
  const resolvePricedSelection = async (pricedSelectionId) => {
    try { return await pricedSelectionStore.resolve(pricedSelectionId) } catch (error) {
      if (error instanceof FlightPricedSelectionStoreError && ["NOT_FOUND", "EXPIRED"].includes(error.code)) throw new FlightRepriceServiceError("PRICED_SELECTION_EXPIRED")
      throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE")
    }
  }
  return Object.freeze({
    async reprice({ alternativeId, customerCurrency }, { signal } = {}) {
      const entry = await resolver.resolve(alternativeId)
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
      const pricedSelectionId = await rememberPricedSelection(entry, offer, current)
      return Object.freeze({
        contractVersion: CUSTOMER_FLIGHT_REPRICE_VERSION, alternativeId, repriceStatus: priceChanged ? "PRICE_CHANGED" : "AVAILABLE",
        itinerary: entry.itinerary, fare: entry.fare, previousCustomerPrice: previous, currentCustomerPrice: current,
        priceChanged, pricedSelectionId, revalidatedAt: now, validUntil: current.validUntil,
      })
    },
    resolvePricedSelection,
    async issueReplacementPricedSelection({ pricedSelectionId, currentOffer, currentCustomerPrice }) {
      const selected = await resolvePricedSelection(pricedSelectionId)
      if (!currentOffer || currentOffer.internalOfferId !== selected.internalOfferId || currentOffer.provider !== selected.provider || currentOffer.providerOfferRef !== selected.providerOfferRef) throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE")
      const authoritativePrice = assertCustomerPriceV1(currentCustomerPrice, currentOffer.internalOfferId)
      if (authoritativePrice.currency !== selected.customerPrice.currency) throw new FlightRepriceServiceError("REPRICE_UNAVAILABLE")
      const entry = Object.freeze({ alternativeId: selected.alternativeId, offer: currentOffer, itinerary: selected.itinerary, fare: selected.fare, passengerComposition: selected.passengerComposition })
      return await rememberPricedSelection(entry, currentOffer, publicPrice(authoritativePrice))
    },
  })
}
