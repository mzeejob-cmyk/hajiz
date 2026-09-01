const forbiddenClientFields = new Set(["provider", "providerId", "supplierHotelId", "supplierRoomId", "supplierRateId", "price", "net", "netCost"])

export const HOTEL_SUPPLIER_CAPABILITIES = Object.freeze([
  "search_hotels", "get_hotel_details", "get_room_rates", "reprice_rate", "hold_room",
  "create_booking", "get_booking_status", "cancel_booking", "retrieve_voucher",
])

export const PROPERTY_MAPPING_STATES = Object.freeze(["mapped", "unmapped", "ambiguous"])
export const HOLD_TYPES = Object.freeze(["none", "soft", "supplier"])

export function assertSafeHotelClientReference(value) {
  if (!value || typeof value !== "object") throw new TypeError("hotel client reference is required")
  for (const key of Object.keys(value)) if (forbiddenClientFields.has(key)) throw new Error(`client hotel authority is forbidden: ${key}`)
  if (!/^hjz_htl_[a-z0-9_]+$/.test(value.canonicalHotelId ?? "")) throw new Error("invalid canonicalHotelId")
  if (value.canonicalRateId != null && !/^hjz_rate_[a-z0-9_]+$/.test(value.canonicalRateId)) throw new Error("invalid canonicalRateId")
  return Object.freeze({ canonicalHotelId: value.canonicalHotelId, ...(value.canonicalRateId ? { canonicalRateId: value.canonicalRateId } : {}) })
}

export function createGuestDetailsDraft({ firstName, lastName, phone, email }) {
  return Object.freeze({ firstName, lastName, phone, email })
}

export function toSafeGuestAnalytics() {
  return Object.freeze({ event: "hotel_guest_details_completed", containsPii: false })
}

export function createReviewBoundary({ hotel, room, rate, stay }) {
  assertSafeHotelClientReference({ canonicalHotelId: hotel.canonicalHotelId, canonicalRateId: rate.canonicalRateId })
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
