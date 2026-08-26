import { PUBLIC_FLIGHT_OFFER_FIELDS } from "./flightSupplierContract.js"

export function toPublicFlightOffer(privateOffer, price) {
  if (!privateOffer || !price) throw new TypeError("private offer and server price are required")
  const candidate = {
    airline: privateOffer.itinerary.airline,
    airlineCode: privateOffer.itinerary.airlineCode,
    flightNumber: privateOffer.itinerary.flightNumber,
    segments: privateOffer.itinerary.segments,
    origin: privateOffer.itinerary.origin,
    destination: privateOffer.itinerary.destination,
    departure: privateOffer.itinerary.departure,
    arrival: privateOffer.itinerary.arrival,
    durationMinutes: privateOffer.itinerary.durationMinutes,
    stops: privateOffer.itinerary.stops,
    cabin: privateOffer.itinerary.cabin,
    baggage: privateOffer.itinerary.baggage,
    sellingAmount: price.sellingAmount,
    currency: price.currency,
    expiresAt: privateOffer.expiresAt,
  }
  if (Object.keys(candidate).some((field) => !PUBLIC_FLIGHT_OFFER_FIELDS.includes(field))) throw new Error("public offer contract violation")
  return Object.freeze(candidate)
}
