import { requireCapability, validateBookingRequest, validateSearchRequest } from "./flightSupplierContract.js"

const PROVIDER = "synthetic_mock_flights"
const EXPIRES_AT = "2026-09-15T06:20:00.000Z"
const freeze = (value) => Object.freeze(value)

export function createMockFlightSupplier() {
  const bookings = new Map()
  const statusReads = new Map()
  const capabilities = freeze({
    flights_search: true, reprice: true, create_booking: true, status: true,
    confirm_booking: false, cancel: true, explicit_ticketing: true,
    ticket_retrieval: true, hotels_search: false, internal_hold_confirm: true,
  })

  const privateOffer = freeze({
    supplierOfferRef: "mock-offer-dxb-krt-ek735",
    providerName: PROVIDER,
    providerStatusRaw: "MOCK_AVAILABLE",
    operationalOutcome: "available",
    expiresAt: EXPIRES_AT,
    supplierEconomics: freeze({ netAmount: "1000.00", currency: "AED", taxesIncluded: true }),
    privateMetadata: freeze({ fixture: "ek735-v1", synthetic: true }),
    itinerary: freeze({
      airline: "طيران الإمارات", airlineCode: "EK", flightNumber: "735",
      segments: freeze([{ origin: "DXB", destination: "KRT", departure: "2026-09-15T08:30:00+04:00", arrival: "2026-09-15T10:50:00+02:00", flightNumber: "735" }]),
      origin: "DXB", destination: "KRT", departure: "2026-09-15T08:30:00+04:00",
      arrival: "2026-09-15T10:50:00+02:00", durationMinutes: 225, stops: 0,
      cabin: "اقتصادية", baggage: "أمتعة مشمولة · 23 كجم",
    }),
  })

  const adapter = {
    providerName: PROVIDER,
    capabilities,
    async health() { return freeze({ providerName: PROVIDER, healthy: true, synthetic: true, network: false, capabilities }) },
    async searchFlights(request) {
      requireCapability(adapter, "flights_search")
      const safe = validateSearchRequest(request)
      return safe.origin === "DXB" && safe.destination === "KRT" ? freeze([privateOffer]) : freeze([])
    },
    async repriceOffer(offerRef) {
      requireCapability(adapter, "reprice")
      if (offerRef !== privateOffer.supplierOfferRef) return freeze({ providerName: PROVIDER, operationalOutcome: "unavailable", providerStatusRaw: "MOCK_NOT_FOUND" })
      return freeze({ ...privateOffer, operationalOutcome: "repriced", providerStatusRaw: "MOCK_REPRICED", supplierEconomics: freeze({ netAmount: "1000.00", currency: "AED", taxesIncluded: true }) })
    },
    async createBooking(request) {
      requireCapability(adapter, "create_booking")
      const safe = validateBookingRequest(request)
      if (safe.supplierOfferRef !== privateOffer.supplierOfferRef) throw new Error("supplier offer is unavailable")
      if (!bookings.has(safe.idempotencyKey)) bookings.set(safe.idempotencyKey, freeze({ supplierBookingRef: `MOCK-EK735-${safe.idempotencyKey}`, providerName: PROVIDER, providerStatusRaw: "MOCK_PROCESSING", operationalOutcome: "processing", privateMetadata: freeze({ synthetic: true }) }))
      return bookings.get(safe.idempotencyKey)
    },
    async getBookingStatus(supplierBookingRef) {
      requireCapability(adapter, "status")
      const known = [...bookings.values()].some((booking) => booking.supplierBookingRef === supplierBookingRef)
      if (!known) throw new Error("supplier booking is unknown")
      const read = (statusReads.get(supplierBookingRef) ?? 0) + 1
      statusReads.set(supplierBookingRef, read)
      if (read === 1) return freeze({ supplierBookingRef, providerName: PROVIDER, providerStatusRaw: "MOCK_CONFIRMED", operationalOutcome: "confirmed" })
      return freeze({ supplierBookingRef, providerName: PROVIDER, providerStatusRaw: "MOCK_TICKETED", operationalOutcome: "ticketed", ticketMetadata: freeze({ artifactRef: `ticket-${supplierBookingRef}`, mediaType: "application/pdf", available: true }) })
    },
    async issueTicket({ supplierBookingRef, idempotencyKey }) {
      requireCapability(adapter, "explicit_ticketing")
      if (!supplierBookingRef || !idempotencyKey) throw new TypeError("trusted ticketing identity is required")
      return freeze({ supplierBookingRef, providerName: PROVIDER, providerStatusRaw: "MOCK_TICKETED", operationalOutcome: "ticketed", ticketMetadata: freeze({ artifactRef: `ticket-${supplierBookingRef}`, mediaType: "application/pdf", available: true }) })
    },
    async retrieveTicket(supplierBookingRef) {
      requireCapability(adapter, "ticket_retrieval")
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
