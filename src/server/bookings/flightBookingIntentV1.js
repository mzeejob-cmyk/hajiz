import { createHash } from "node:crypto"
import { validateFlightTravelersV1 } from "../checkout/flightTravelersV1.js"
import { FlightBookingIntentStoreError } from "./flightBookingIntentStoreV1.js"

export const FLIGHT_BOOKING_INTENT_VERSION = "flight-booking-intent/v1"
export const FLIGHT_BOOKING_INTENT_STATUS = "READY_FOR_PAYMENT"

export class FlightBookingIntentError extends Error {
  constructor(code) { super(code); this.name = "FlightBookingIntentError"; this.code = code }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const idempotency = /^hbi_req_[A-Za-z0-9_-]{16,80}$/
const digest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")
const passengerSummary = (composition) => Object.freeze({ adults: composition.ADT, children: composition.CHD, infants: composition.INF, total: composition.ADT + composition.CHD + composition.INF })
const baseResult = (status, prepared, overrides = {}) => Object.freeze({
  contractVersion: FLIGHT_BOOKING_INTENT_VERSION,
  bookingIntentId: null,
  intentStatus: status,
  customerPrice: prepared?.currentCustomerPrice ?? null,
  previousCustomerPrice: prepared?.previousCustomerPrice ?? null,
  itinerary: prepared?.itinerary ?? null,
  passengerSummary: prepared?.expectedPassengers ? passengerSummary(prepared.expectedPassengers) : null,
  validUntil: prepared?.validUntil ?? null,
  nextAction: status === "PRICE_CHANGED" ? "ACCEPT_CURRENT_PRICE" : "RETURN_TO_RESULTS",
  ...overrides,
})

const assertOwner = (ownerContext) => {
  if (!ownerContext || !uuid.test(ownerContext.ownerId) || !["authenticated", "injected-test"].includes(ownerContext.source)) throw new FlightBookingIntentError("AUTH_REQUIRED")
  return Object.freeze({ ownerId: ownerContext.ownerId, source: ownerContext.source })
}

export function createFlightBookingIntentServiceV1({ checkoutService, repriceService, intentStore, clock = Date.now }) {
  if (!checkoutService?.prepare || !repriceService?.resolvePricedSelection || !intentStore?.createOrGet || typeof clock !== "function") throw new TypeError("trusted booking intent dependencies are required")
  return Object.freeze({
    async create({ ownerContext, pricedSelectionId, idempotencyKey, travelerData }, { signal } = {}) {
      const owner = assertOwner(ownerContext)
      if (typeof pricedSelectionId !== "string" || !/^hpr_v1_[a-f0-9]{40}$/.test(pricedSelectionId) || typeof idempotencyKey !== "string" || !idempotency.test(idempotencyKey)) throw new FlightBookingIntentError("VALIDATION_ERROR")
      const prepared = await checkoutService.prepare({ pricedSelectionId }, { signal })
      if (prepared.checkoutStatus === "PRICE_CHANGED") return baseResult("PRICE_CHANGED", prepared, { pricedSelectionId: prepared.pricedSelectionId })
      if (prepared.checkoutStatus === "UNAVAILABLE") return baseResult("UNAVAILABLE", prepared)
      if (prepared.checkoutStatus !== "READY") throw new FlightBookingIntentError("BOOKING_INTENT_UNAVAILABLE")

      const selected = repriceService.resolvePricedSelection(prepared.pricedSelectionId)
      if (selected.customerPrice.amount !== prepared.currentCustomerPrice.amount || selected.customerPrice.currency !== prepared.currentCustomerPrice.currency || selected.customerPrice.validUntil !== prepared.currentCustomerPrice.validUntil) throw new FlightBookingIntentError("REVALIDATION_REQUIRED")
      const normalized = validateFlightTravelersV1(travelerData, { expectedComposition: selected.passengerComposition, today: new Date(clock()).toISOString().slice(0, 10) })
      const pricedSelectionDigest = digest(prepared.pricedSelectionId)
      const payloadDigest = digest([
        selected.internalOfferId,
        selected.provider,
        selected.providerOfferRef,
        selected.customerPrice,
        selected.passengerComposition,
        normalized.travelers,
        normalized.contact,
      ])
      const record = Object.freeze({
        ownerId: owner.ownerId,
        idempotencyKey,
        payloadDigest,
        pricedSelectionDigest,
        internalOfferId: selected.internalOfferId,
        provider: selected.provider,
        providerOfferRef: selected.providerOfferRef,
        itinerary: selected.itinerary,
        fare: selected.fare,
        customerPrice: selected.customerPrice,
        passengerComposition: selected.passengerComposition,
        travelers: normalized.travelers,
        contact: normalized.contact,
        validUntil: prepared.validUntil,
      })
      let stored
      try { stored = await intentStore.createOrGet(record) } catch (error) {
        if (error instanceof FlightBookingIntentStoreError && error.code === "BOOKING_INTENT_IDEMPOTENCY_CONFLICT") throw new FlightBookingIntentError(error.code)
        throw new FlightBookingIntentError("BOOKING_INTENT_PERSISTENCE_UNAVAILABLE")
      }
      return baseResult(FLIGHT_BOOKING_INTENT_STATUS, prepared, { bookingIntentId: stored.bookingIntentId, previousCustomerPrice: null, nextAction: "SELECT_PAYMENT_METHOD" })
    },
  })
}
