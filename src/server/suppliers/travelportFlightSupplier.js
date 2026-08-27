import { randomUUID } from "node:crypto"
import { requireCapability, validateSearchRequest } from "./flightSupplierContract.js"
import { createTravelportClient, createTravelportConfig } from "./travelportClient.js"
import { normalizeTravelportOffers, normalizeTravelportReprice } from "./travelportResponseMapper.js"

const PROVIDER = "travelport"
const freeze = (value) => Object.freeze(value)

export function createTravelportFlightSupplier({ env = process.env, fetchImpl = globalThis.fetch, createId = randomUUID } = {}) {
  const config = createTravelportConfig(env)
  const client = config.configured ? createTravelportClient({ config, fetchImpl }) : undefined
  const references = new Map()
  const capabilities = freeze({
    search_flights: config.configured, reprice: config.configured, create_booking: false,
    confirm_booking: false, get_booking_status: false, retrieve_ticket: false,
    cancel: false, change: false, hold: false,
  })
  const createOfferIdentity = (details) => {
    const suffix = createId()
    const identity = freeze({ internalOfferId: `hfo_${suffix}`, providerOfferRef: `tp_${suffix}` })
    references.set(identity.providerOfferRef, freeze(details))
    return identity
  }
  const adapter = {
    providerName: PROVIDER,
    capabilities,
    async health() { return freeze({ providerName: PROVIDER, healthy: config.configured, configured: config.configured, networkChecked: false, capabilities }) },
    async searchFlights(request) {
      requireCapability(adapter, "search_flights")
      const safe = validateSearchRequest(request)
      const payload = {
        CatalogProductOfferingsQueryRequest: {
          CatalogProductOfferingsRequest: {
            "@type": "CatalogProductOfferingsRequestAir", offersPerPage: 20, contentSourceList: ["GDS"],
            PassengerCriteria: [{ "@type": "PassengerCriteria", number: safe.adults, passengerTypeCode: "ADT" }],
            SearchCriteriaFlight: [{ "@type": "SearchCriteriaFlight", departureDate: safe.departureDate, From: { value: safe.origin }, To: { value: safe.destination } }],
          },
        },
      }
      const response = await client.post("/catalog/search/catalogproductofferings", payload, createId())
      return freeze(normalizeTravelportOffers(response, { createOfferIdentity }))
    },
    async repriceOffer(supplierOfferRef) {
      requireCapability(adapter, "reprice")
      const reference = references.get(supplierOfferRef)
      if (!reference) return freeze({ providerName: PROVIDER, operationalOutcome: "unavailable", providerStatusRaw: "UNKNOWN_OFFER_REFERENCE" })
      const payload = { OfferQueryBuildFromCatalogProductOfferings: { BuildFromCatalogProductOfferingsRequest: {
        "@type": "BuildFromCatalogProductOfferingsRequestAir",
        CatalogProductOfferingsIdentifier: { Identifier: { value: reference.transactionId } },
        CatalogProductOfferingSelection: [{
          CatalogProductOfferingIdentifier: { Identifier: { value: reference.offeringId } },
          ...(reference.productIds?.length ? { ProductIdentifier: reference.productIds.map((value) => ({ Identifier: { value } })) } : {}),
        }],
      } } }
      const response = await client.post("/price/offers/buildfromcatalogproductofferings", payload, createId())
      return normalizeTravelportReprice(response, supplierOfferRef, createOfferIdentity)
    },
    async createBooking() { requireCapability(adapter, "create_booking") },
    async getBookingStatus() { requireCapability(adapter, "get_booking_status") },
  }
  return freeze(adapter)
}
