const duration = (minutes) => `${Math.floor(minutes / 60)}س ${minutes % 60 ? `${minutes % 60}د` : ""}`.trim()
const time = (value) => new Intl.DateTimeFormat("ar-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(value))
export function toFlightResultsViewModelV1(result) {
  return Object.freeze(result.groups.flatMap((group) => group.alternatives.map((alternative) => {
    const itinerary = group.itinerary
    if (!itinerary) return []
    const first = itinerary.segments[0]
    return Object.freeze({
      alternativeId: alternative.alternativeId,
      recommended: group.recommendationAvailable && alternative.recommended && alternative.alternativeId === group.preferredAlternativeId,
      airline: itinerary.marketingCarrierName, airlineCode: first.marketingCarrier, flightNumber: first.flightNumber,
      origin: itinerary.origin, destination: itinerary.destination, departure: time(itinerary.departureAt), arrival: time(itinerary.arrivalAt),
      duration: duration(itinerary.durationMinutes), stops: itinerary.stops, segmentCount: itinerary.segments.length,
      cabin: alternative.fare.cabin, baggage: alternative.fare.baggage, flexibility: `${alternative.fare.changeability} · ${alternative.fare.refundability}`,
      sellingAmount: alternative.price.amount, currency: alternative.price.currency, validUntil: alternative.price.validUntil,
    })
  }).flat()))
}
