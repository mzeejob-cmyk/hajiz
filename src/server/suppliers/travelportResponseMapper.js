const freeze = (value) => Object.freeze(value)
const list = (value) => Array.isArray(value) ? value : value ? [value] : []
const scalar = (value) => value && typeof value === "object" && "value" in value ? value.value : value

function durationMinutes(value, segments) {
  const match = typeof value === "string" && value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  if (match) return Number(match[1] || 0) * 60 + Number(match[2] || 0)
  const start = Date.parse(segments[0]?.departureAt)
  const end = Date.parse(segments.at(-1)?.arrivalAt)
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 60_000) : 0
}

function segmentFrom(product, cabin) {
  const flight = product?.Flight ?? product?.FlightSegment ?? product
  const departure = flight?.Departure
  const arrival = flight?.Arrival
  const dateTime = (point) => point?.dateTime ?? (point?.date && point?.time ? `${point.date}T${point.time}` : undefined)
  return freeze({
    origin: scalar(flight?.From) ?? departure?.location ?? flight?.departureAirport,
    destination: scalar(flight?.To) ?? arrival?.location ?? flight?.arrivalAirport,
    departureAt: flight?.departureDateTime ?? dateTime(departure),
    arrivalAt: flight?.arrivalDateTime ?? dateTime(arrival),
    flightNumber: String(flight?.flightNumber ?? flight?.number ?? ""),
    marketingCarrier: flight?.carrier,
    operatingCarrier: flight?.operatingCarrier ?? flight?.carrier ?? null,
    cabin: cabin ?? "Unspecified",
    aircraft: flight?.equipment ?? flight?.aircraft ?? null,
  })
}

export function normalizeTravelportOffers(payload, { createOfferIdentity }) {
  const response = payload?.CatalogProductOfferingsResponse ?? payload
  const transactionId = response?.transactionId ?? response?.Identifier?.value
  const offerings = list(response?.CatalogProductOfferings?.CatalogProductOffering ?? response?.CatalogProductOffering)
  return offerings.map((offering) => {
    const products = list(offering?.Product ?? offering?.Products?.Product)
    const cabin = offering?.cabin ?? "Unspecified"
    const segments = products.flatMap((product) => list(product?.FlightSegment ?? product?.Flight).map((segment) => segmentFrom(segment, cabin)))
    const first = segments[0]
    const last = segments.at(-1)
    const price = offering?.Price ?? offering?.BestCombinablePrice
    const carrier = offering?.ValidatingAirline ?? segments[0]?.marketingCarrier ?? products[0]?.carrier
    const productIds = products.map((product) => product?.id).filter(Boolean)
    const identity = createOfferIdentity({ transactionId, offeringId: offering?.id, productIds })
    if (!transactionId || !offering?.id || !first?.origin || !last?.destination || !price?.TotalPrice || !price?.CurrencyCode?.value) {
      throw new Error("Travelport response is missing required offer fields")
    }
    return createFlightOfferV1({
      contractVersion: FLIGHT_OFFER_CONTRACT_VERSION,
      internalOfferId: identity.internalOfferId,
      provider: "travelport",
      providerOfferRef: identity.providerOfferRef,
      providerStatusRaw: "CATALOG_OFFER_AVAILABLE",
      operationalOutcome: "available",
      itinerary: {
        marketingCarrierName: carrier,
        segments, origin: first.origin, destination: last.destination,
        departureAt: first.departureAt, arrivalAt: last.arrivalAt,
        durationMinutes: durationMinutes(offering?.duration, segments), stops: Math.max(0, segments.length - 1),
      },
      fare: { fareBrand: offering?.fareBrand ?? null, cabin, baggage: offering?.baggage ?? "Subject to fare terms", changeability: "unknown", refundability: "unknown", privateMetadata: {} },
      economics: { supplierAmount: String(price.TotalPrice), supplierCurrency: price.CurrencyCode.value },
      validity: { expiresAt: offering?.expiresAt ?? null, repriceRequired: true },
      supportedOperations: ["search_flights", "reprice"],
      privateMetadata: { transactionId, offeringId: offering.id, productIds },
    })
  })
}

export function normalizeTravelportReprice(payload, reference, createOfferIdentity) {
  const offers = normalizeTravelportOffers(payload?.OfferListResponse ? {
    transactionId: payload.OfferListResponse.transactionId,
    CatalogProductOffering: payload.OfferListResponse.OfferID,
  } : payload, { createOfferIdentity })
  if (offers.length !== 1) throw new Error("Travelport repricing did not return exactly one offer")
  return createFlightOfferV1({ ...offers[0], providerOfferRef: reference, operationalOutcome: "repriced", providerStatusRaw: "AIR_PRICE_CONFIRMED" })
}
import { createFlightOfferV1, FLIGHT_OFFER_CONTRACT_VERSION } from "./flightOfferV1.js"
