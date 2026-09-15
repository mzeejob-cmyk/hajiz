import { requireCapability, validateBookingRequest, validateSearchRequest } from "./flightSupplierContract.js"
import { createFlightOfferV1, FLIGHT_OFFER_CONTRACT_VERSION } from "./flightOfferV1.js"

const PROVIDER = "mock"
const DEFAULT_OFFER_TTL_SECONDS = 21_600
const MIN_OFFER_TTL_SECONDS = 300
const MAX_OFFER_TTL_SECONDS = 86_400
const LEGACY_PROVIDER_OFFER_REF = "mock-offer-dxb-krt-ek735"
const freeze = (value) => Object.freeze(value)

export function createMockFlightSupplier({ env = process.env, clock = Date.now, offerTtlSeconds = DEFAULT_OFFER_TTL_SECONDS } = {}) {
  if (env?.NODE_ENV === "production") throw new Error("synthetic booking supplier is forbidden in production")
  if (typeof clock !== "function") throw new TypeError("trusted mock supplier clock is required")
  if (!Number.isSafeInteger(offerTtlSeconds) || offerTtlSeconds < MIN_OFFER_TTL_SECONDS || offerTtlSeconds > MAX_OFFER_TTL_SECONDS) throw new TypeError("mock offer TTL is invalid")
  if (!Number.isFinite(clock())) throw new TypeError("trusted mock supplier clock is invalid")
  const bookings = new Map()
  const statusReads = new Map()
  const offersByRef = new Map()
  const capabilities = freeze({
    search_flights: true, reprice: true, create_booking: true, confirm_booking: false,
    get_booking_status: true, retrieve_ticket: true, cancel: true, change: false, hold: false,
  })

  const buildOffer = (departureDate) => {
    const now = clock()
    if (!Number.isFinite(now)) throw new TypeError("trusted mock supplier clock is invalid")
    const dateKey = departureDate.replaceAll("-", "")
    const providerOfferRef = `${LEGACY_PROVIDER_OFFER_REF}-${dateKey}`
    const existing = offersByRef.get(providerOfferRef)
    if (existing) return existing
    const departureAt = `${departureDate}T08:30:00+04:00`
    const arrivalAt = `${departureDate}T10:50:00+02:00`
    const expiresAt = new Date(now + offerTtlSeconds * 1_000).toISOString()
    const offer = createFlightOfferV1({
      contractVersion: FLIGHT_OFFER_CONTRACT_VERSION,
      internalOfferId: `hfo_${dateKey}_00000001`,
      provider: PROVIDER,
      providerOfferRef,
      providerStatusRaw: "MOCK_AVAILABLE",
      operationalOutcome: "available",
      itinerary: {
        origin: "DXB", destination: "KRT", departureAt,
        arrivalAt, durationMinutes: 260, stops: 0,
        marketingCarrierName: "طيران الإمارات",
        segments: [{ marketingCarrier: "EK", operatingCarrier: "EK", flightNumber: "735", origin: "DXB", destination: "KRT", departureAt, arrivalAt, cabin: "اقتصادية", aircraft: null }],
      },
      fare: { fareBrand: null, cabin: "اقتصادية", baggage: "أمتعة مشمولة · 23 كجم", changeability: "conditional", refundability: "conditional", privateMetadata: { fixtureFare: "economy-v1" } },
      economics: { supplierAmount: "1000.00", supplierCurrency: "AED" },
      validity: { expiresAt, repriceRequired: true },
      supportedOperations: ["search_flights", "reprice", "create_booking", "get_booking_status", "retrieve_ticket", "cancel", "hold"],
      privateMetadata: { fixture: "ek735-v1", synthetic: true },
    })
    offersByRef.set(providerOfferRef, offer)
    return offer
  }

  const adapter = {
    providerName: PROVIDER,
    synthetic: true,
    productionAllowed: false,
    capabilities,
    async health() { return freeze({ providerName: PROVIDER, healthy: true, synthetic: true, network: false, productionAllowed: false, capabilities }) },
    async searchFlights(request) {
      requireCapability(adapter, "search_flights")
      const safe = validateSearchRequest(request)
      return safe.origin === "DXB" && safe.destination === "KRT" ? freeze([buildOffer(safe.departureDate)]) : freeze([])
    },
    async repriceOffer(offerRef) {
      requireCapability(adapter, "reprice")
      const offer = offersByRef.get(offerRef)
      const now = clock()
      if (!Number.isFinite(now)) throw new TypeError("trusted mock supplier clock is invalid")
      if (!offer || Date.parse(offer.validity.expiresAt) <= now) return freeze({ providerName: PROVIDER, operationalOutcome: "unavailable", providerStatusRaw: "MOCK_NOT_FOUND" })
      return createFlightOfferV1({ ...offer, operationalOutcome: "repriced", providerStatusRaw: "MOCK_REPRICED" })
    },
    async createBooking(request) {
      requireCapability(adapter, "create_booking")
      const safe = validateBookingRequest(request)
      if (safe.supplierOfferRef !== LEGACY_PROVIDER_OFFER_REF && !offersByRef.has(safe.supplierOfferRef)) throw new Error("supplier offer is unavailable")
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
