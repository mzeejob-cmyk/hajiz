import { createCustomerPriceV1, priceFlightOfferV1 } from "../pricing/pricingFxV1.js"
import { requireCapability } from "../suppliers/flightSupplierContract.js"
import { FlightRepriceServiceError } from "../search/customerFlightRepriceV1.js"
import { validateFlightTravelersV1 } from "./flightTravelersV1.js"

export const CUSTOMER_FLIGHT_CHECKOUT_VERSION = "customer-flight-checkout/v1"
export class FlightCheckoutError extends Error { constructor(code) { super(code); this.name = "FlightCheckoutError"; this.code = code } }
const snapshot = (all, base, quote) => { const value = all?.[`${base}_${quote}`]; if (!value) throw new FlightCheckoutError("CHECKOUT_UNAVAILABLE"); return value }
const price = (value) => Object.freeze({ amount: value.amount, currency: value.currency, validUntil: value.validUntil })
const unavailable = (now) => Object.freeze({ contractVersion: CUSTOMER_FLIGHT_CHECKOUT_VERSION, checkoutStatus: "UNAVAILABLE", pricedSelectionId: null, itinerary: null, fare: null, previousCustomerPrice: null, currentCustomerPrice: null, expectedPassengers: null, revalidatedAt: now, validUntil: null })

export function createCustomerFlightCheckoutServiceV1({ repriceService, supplierRegistry, pricingPolicy, fxSnapshotsByPair, clock = Date.now }) {
  if (!repriceService?.resolvePricedSelection || !repriceService?.issueReplacementPricedSelection || !supplierRegistry?.getByServerProviderName || typeof clock !== "function") throw new TypeError("trusted checkout dependencies are required")
  const resolve = (token) => { try { return repriceService.resolvePricedSelection(token) } catch (error) { if (error instanceof FlightRepriceServiceError) throw new FlightCheckoutError("CHECKOUT_SELECTION_EXPIRED"); throw error } }
  return Object.freeze({
    async prepare({ pricedSelectionId }, { signal } = {}) {
      const selected = resolve(pricedSelectionId)
      let adapter
      try { adapter = supplierRegistry.getByServerProviderName(selected.provider); requireCapability(adapter, "reprice") } catch { throw new FlightCheckoutError("REPRICE_UNAVAILABLE") }
      let offer
      try { offer = await adapter.repriceOffer(selected.providerOfferRef, { signal }) } catch (error) { if (error?.code === "REQUEST_TIMEOUT" || error?.name === "AbortError") throw new FlightCheckoutError("REQUEST_TIMEOUT"); throw new FlightCheckoutError("REPRICE_UNAVAILABLE") }
      const now = new Date(clock()).toISOString()
      if (!offer || offer.operationalOutcome === "unavailable") return unavailable(now)
      if (offer.internalOfferId !== selected.internalOfferId || offer.provider !== selected.provider || offer.providerOfferRef !== selected.providerOfferRef) throw new FlightCheckoutError("REPRICE_UNAVAILABLE")
      let authoritativeCustomerPrice
      try { const priced = priceFlightOfferV1(offer, { pricingPolicy, supplierFxSnapshot: snapshot(fxSnapshotsByPair, offer.economics.supplierCurrency, "USD"), now }); authoritativeCustomerPrice = createCustomerPriceV1(priced, { displayFxSnapshot: snapshot(fxSnapshotsByPair, "USD", selected.customerPrice.currency), customerCurrency: selected.customerPrice.currency, now }) } catch { throw new FlightCheckoutError("REPRICE_UNAVAILABLE") }
      const current = price(authoritativeCustomerPrice)
      const changed = current.amount !== selected.customerPrice.amount
      let currentPricedSelectionId = pricedSelectionId
      if (changed) {
        try { currentPricedSelectionId = repriceService.issueReplacementPricedSelection({ pricedSelectionId, currentOffer: offer, currentCustomerPrice: authoritativeCustomerPrice }) } catch { throw new FlightCheckoutError("REPRICE_UNAVAILABLE") }
      }
      return Object.freeze({ contractVersion: CUSTOMER_FLIGHT_CHECKOUT_VERSION, checkoutStatus: changed ? "PRICE_CHANGED" : "READY", pricedSelectionId: currentPricedSelectionId, itinerary: selected.itinerary, fare: selected.fare, previousCustomerPrice: selected.customerPrice, currentCustomerPrice: current, expectedPassengers: selected.passengerComposition, revalidatedAt: now, validUntil: changed ? current.validUntil : [selected.expiresAt, current.validUntil].sort()[0] })
    },
    validateTravelers({ pricedSelectionId, travelerData }) {
      const selected = resolve(pricedSelectionId)
      validateFlightTravelersV1(travelerData, { expectedComposition: selected.passengerComposition, today: new Date(clock()).toISOString().slice(0, 10) })
      return Object.freeze({ contractVersion: "customer-flight-travelers-validation/v1", status: "VALID", travelerCount: selected.passengerComposition.ADT + selected.passengerComposition.CHD + selected.passengerComposition.INF })
    },
  })
}
