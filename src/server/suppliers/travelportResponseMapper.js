const freeze = (value) => Object.freeze(value)
const list = (value) => Array.isArray(value) ? value : value ? [value] : []
const scalar = (value) => value && typeof value === "object" && "value" in value ? value.value : value

function durationMinutes(value, segments) {
  const match = typeof value === "string" && value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  if (match) return Number(match[1] || 0) * 60 + Number(match[2] || 0)
  const start = Date.parse(segments[0]?.departure)
  const end = Date.parse(segments.at(-1)?.arrival)
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 60_000) : 0
}

function segmentFrom(product) {
  const flight = product?.Flight ?? product?.FlightSegment ?? product
  const departure = flight?.Departure
  const arrival = flight?.Arrival
  const dateTime = (point) => point?.dateTime ?? (point?.date && point?.time ? `${point.date}T${point.time}` : undefined)
  return freeze({
    origin: scalar(flight?.From) ?? departure?.location ?? flight?.departureAirport,
    destination: scalar(flight?.To) ?? arrival?.location ?? flight?.arrivalAirport,
    departure: flight?.departureDateTime ?? dateTime(departure),
    arrival: flight?.arrivalDateTime ?? dateTime(arrival),
    flightNumber: String(flight?.flightNumber ?? flight?.number ?? ""),
    carrier: flight?.carrier,
  })
}

export function normalizeTravelportOffers(payload, { createOfferRef }) {
  const response = payload?.CatalogProductOfferingsResponse ?? payload
  const transactionId = response?.transactionId ?? response?.Identifier?.value
  const offerings = list(response?.CatalogProductOfferings?.CatalogProductOffering ?? response?.CatalogProductOffering)
  return offerings.map((offering) => {
    const products = list(offering?.Product ?? offering?.Products?.Product)
    const segments = products.flatMap((product) => list(product?.FlightSegment ?? product?.Flight).map(segmentFrom))
    const first = segments[0]
    const last = segments.at(-1)
    const price = offering?.Price ?? offering?.BestCombinablePrice
    const carrier = offering?.ValidatingAirline ?? segments[0]?.carrier ?? products[0]?.carrier
    const productIds = products.map((product) => product?.id).filter(Boolean)
    const supplierOfferRef = createOfferRef({ transactionId, offeringId: offering?.id, productIds })
    if (!transactionId || !offering?.id || !first?.origin || !last?.destination || !price?.TotalPrice || !price?.CurrencyCode?.value) {
      throw new Error("Travelport response is missing required offer fields")
    }
    return freeze({
      supplierOfferRef,
      providerName: "travelport_tripservices_v11",
      providerStatusRaw: "CATALOG_OFFER_AVAILABLE",
      operationalOutcome: "available",
      expiresAt: offering?.expiresAt,
      supplierEconomics: freeze({ netAmount: String(price.TotalPrice), currency: price.CurrencyCode.value, taxesIncluded: true }),
      privateMetadata: freeze({ transactionId, offeringId: offering.id, productIds: freeze(productIds) }),
      itinerary: freeze({
        airline: carrier,
        airlineCode: carrier,
        flightNumber: segments[0]?.flightNumber,
        segments: freeze(segments), origin: first.origin, destination: last.destination,
        departure: first.departure, arrival: last.arrival,
        durationMinutes: durationMinutes(offering?.duration, segments), stops: Math.max(0, segments.length - 1),
        cabin: offering?.cabin ?? "Unspecified", baggage: offering?.baggage ?? "Subject to fare terms",
      }),
    })
  })
}

export function normalizeTravelportReprice(payload, reference, createOfferRef) {
  const offers = normalizeTravelportOffers(payload?.OfferListResponse ? {
    transactionId: payload.OfferListResponse.transactionId,
    CatalogProductOffering: payload.OfferListResponse.OfferID,
  } : payload, { createOfferRef })
  if (offers.length !== 1) throw new Error("Travelport repricing did not return exactly one offer")
  return freeze({ ...offers[0], supplierOfferRef: reference, operationalOutcome: "repriced", providerStatusRaw: "AIR_PRICE_CONFIRMED" })
}
