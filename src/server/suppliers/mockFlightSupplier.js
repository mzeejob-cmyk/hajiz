import { requireCapability, validateBookingRequest, validateSearchRequest } from "./flightSupplierContract.js"
import { createFlightOfferV1, FLIGHT_OFFER_CONTRACT_VERSION } from "./flightOfferV1.js"

const PROVIDER = "mock"
const EXPIRES_AT = "2026-09-15T06:20:00.000Z"
const freeze = (value) => Object.freeze(value)

export function createMockFlightSupplier({ env = process.env } = {}) {
  if (env?.NODE_ENV === "production") throw new Error("synthetic booking supplier is forbidden in production")
  const bookings = new Map()
  const statusReads = new Map()
  const capabilities = freeze({
    search_flights: true, reprice: true, create_booking: true, confirm_booking: false,
    get_booking_status: true, retrieve_ticket: true, cancel: true, change: false, hold: false,
  })

  const privateOffer = createFlightOfferV1({
    contractVersion: FLIGHT_OFFER_CONTRACT_VERSION,
    internalOfferId: "hfo_0000000000000001",
    provider: PROVIDER,
    providerOfferRef: "mock-offer-dxb-krt-ek735",
    providerStatusRaw: "MOCK_AVAILABLE",
    operationalOutcome: "available",
    itinerary: {
      origin: "DXB", destination: "KRT", departureAt: "2026-09-15T08:30:00+04:00",
      arrivalAt: "2026-09-15T10:50:00+02:00", durationMinutes: 225, stops: 0,
      marketingCarrierName: "طيران الإمارات",
      segments: [{ marketingCarrier: "EK", operatingCarrier: "EK", flightNumber: "735", origin: "DXB", destination: "KRT", departureAt: "2026-09-15T08:30:00+04:00", arrivalAt: "2026-09-15T10:50:00+02:00", cabin: "اقتصادية", aircraft: null }],
    },
    fare: { fareBrand: null, cabin: "اقتصادية", baggage: "أمتعة مشمولة · 23 كجم", changeability: "conditional", refundability: "conditional", privateMetadata: { fixtureFare: "economy-v1" } },
    economics: { supplierAmount: "1000.00", supplierCurrency: "AED" },
    validity: { expiresAt: EXPIRES_AT, repriceRequired: true },
    supportedOperations: ["search_flights", "reprice", "create_booking", "get_booking_status", "retrieve_ticket", "cancel", "hold"],
    privateMetadata: { fixture: "ek735-v1", synthetic: true },
  })

  const adapter = {
    providerName: PROVIDER,
    synthetic: true,
    productionAllowed: false,
    capabilities,
    async health() { return freeze({ providerName: PROVIDER, healthy: true, synthetic: true, network: false, productionAllowed: false, capabilities }) },
    async searchFlights(request) {
      requireCapability(adapter, "search_flights")
      const safe = validateSearchRequest(request)
      return safe.origin === "DXB" && safe.destination === "KRT" ? freeze([privateOffer]) : freeze([])
    },
    async repriceOffer(offerRef) {
      requireCapability(adapter, "reprice")
      if (offerRef !== privateOffer.providerOfferRef) return freeze({ providerName: PROVIDER, operationalOutcome: "unavailable", providerStatusRaw: "MOCK_NOT_FOUND" })
      return createFlightOfferV1({ ...privateOffer, operationalOutcome: "repriced", providerStatusRaw: "MOCK_REPRICED" })
    },
    async createBooking(request) {
      requireCapability(adapter, "create_booking")
      const safe = validateBookingRequest(request)
      if (safe.supplierOfferRef !== privateOffer.providerOfferRef) throw new Error("supplier offer is unavailable")
      if (!bookings.has(safe.idempotencyKey)) bookings.set(safe.idempotencyKey, freeze({ supplierBookingRef: `MOCK-EK735-${safe.idempotencyKey}`, providerName: PROVIDER, providerStatusRaw: "MOCK_PROCESSING", operationalOutcome: "processing", privateMetadata: freeze({ synthetic: true }) }))
      return bookings.get(safe.idempotencyKey)
    },
    async getBookingStatus(supplierBookingRef) {
      requireCapability(adapter, "get_booking_status")
      const known = [...bookings.values()].some((booking) => booking.supplierBookingRef === supplierBookingRef)
      if (!known) throw new Error("supplier booking is unknown")
      const read = (statusReads.get(supplierBookingRef) ?? 0) + 1
      statusReads.set(supplierBookingRef, read)
      if (read === 1) return freeze({ supplierBookingRef, providerName: PROVIDER, providerStatusRaw: "MOCK_CONFIRMED", operationalOutcome: "confirmed" })
      return freeze({ supplierBookingRef, providerName: PROVIDER, providerStatusRaw: "MOCK_TICKETED", operationalOutcome: "ticketed", ticketMetadata: freeze({ artifactRef: `ticket-${supplierBookingRef}`, mediaType: "application/pdf", available: true }) })
    },
    async issueTicket({ supplierBookingRef, idempotencyKey }) {
      requireCapability(adapter, "confirm_booking")
      if (!supplierBookingRef || !idempotencyKey) throw new TypeError("trusted ticketing identity is required")
      return freeze({ supplierBookingRef, providerName: PROVIDER, providerStatusRaw: "MOCK_TICKETED", operationalOutcome: "ticketed", ticketMetadata: freeze({ artifactRef: `ticket-${supplierBookingRef}`, mediaType: "application/pdf", available: true }) })
    },
    async retrieveTicket(supplierBookingRef) {
      requireCapability(adapter, "retrieve_ticket")
      const reads = statusReads.get(supplierBookingRef) ?? 0
      if (reads < 2) throw new Error("ticket metadata is unavailable before ticketed")
      return freeze({ artifactRef: `ticket-${supplierBookingRef}`, mediaType: "application/pdf", available: true })
    },
    async cancelBooking(supplierBookingRef) {
      requireCapability(adapter, "cancel")
      return freeze({ supplierBookingRef, providerName: PROVIDER, providerStatusRaw: "MOCK_CANCELLED", operationalOutcome: "cancelled" })
    },
  }
  return freeze(adapter)
}
