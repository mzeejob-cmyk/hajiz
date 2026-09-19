export function createHotelReviewPresentation({ hotel, room, rate, stay }) {
  return Object.freeze({
    canonicalHotelId: hotel.canonicalHotelId,
    canonicalRateId: rate.canonicalRateId,
    hotelName: hotel.name,
    roomName: room.name,
    board: rate.board,
    cancellation: rate.cancellation,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: stay.nights,
    guests: Object.freeze({ ...stay.guests }),
    finalAmount: rate.finalAmount,
    currency: rate.currency,
    continueToPayment: "NOT_YET_WIRED",
  })
}
