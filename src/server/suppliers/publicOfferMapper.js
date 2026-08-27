import { assertFlightOfferV1 } from "./flightOfferV1.js"

export const PUBLIC_SEARCH_OFFER_VERSION = "search-offer/v1"
export const PUBLIC_FLIGHT_OFFER_FIELDS = Object.freeze([
  "contractVersion", "selectionKey", "airline", "airlineCode", "flightNumber", "segments",
  "origin", "destination", "departure", "arrival", "durationMinutes", "stops", "cabin",
  "baggage", "sellingAmount", "currency", "expiresAt",
])

export function toPublicFlightOffer(privateOffer, price) {
  const offer = assertFlightOfferV1(privateOffer)
  if (!price || typeof price !== "object" || typeof price.sellingAmount !== "string" || Number(price.sellingAmount) <= 0 || !/^[A-Z]{3}$/.test(price.currency)) throw new TypeError("valid authoritative server price is required")
  const firstSegment = offer.itinerary.segments[0]
  const candidate = {
    contractVersion: PUBLIC_SEARCH_OFFER_VERSION,
    selectionKey: offer.internalOfferId,
    airline: offer.itinerary.marketingCarrierName ?? firstSegment.marketingCarrier,
    airlineCode: firstSegment.marketingCarrier,
    flightNumber: firstSegment.flightNumber,
    segments: offer.itinerary.segments,
    origin: offer.itinerary.origin,
    destination: offer.itinerary.destination,
    departure: offer.itinerary.departureAt,
    arrival: offer.itinerary.arrivalAt,
    durationMinutes: offer.itinerary.durationMinutes,
    stops: offer.itinerary.stops,
    cabin: offer.fare.cabin,
    baggage: offer.fare.baggage,
    sellingAmount: price.sellingAmount,
    currency: price.currency,
    expiresAt: offer.validity.expiresAt,
  }
  if (Object.keys(candidate).some((field) => !PUBLIC_FLIGHT_OFFER_FIELDS.includes(field))) throw new Error("public offer contract violation")
  return Object.freeze(candidate)
}
