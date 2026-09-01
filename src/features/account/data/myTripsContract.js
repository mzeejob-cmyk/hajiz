export const MY_TRIPS_BOOKING_STATES = Object.freeze(["pending_payment", "payment_confirmed", "processing", "confirmed", "ticketed", "completed", "cancelled", "failed"])
export const MY_TRIPS_PAYMENT_STATES = Object.freeze(["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"])

const safeEnum = (value, allowed, fallback) => allowed.includes(value) ? value : fallback
const safeText = (value, fallback = "") => typeof value === "string" && value.length <= 80 ? value : fallback

export function toMyTripsPresentation(bookings, payments) {
  if (!Array.isArray(bookings) || !Array.isArray(payments)) throw new Error("MY_TRIPS_INVALID_RESPONSE")
  const paymentByBooking = new Map(payments.map(payment => [safeText(payment?.booking_ref), payment]))
  return bookings.map((booking, index) => {
    const reference = safeText(booking?.booking_ref)
    const payment = paymentByBooking.get(reference)
    const createdAt = new Date(booking?.created_at)
    if (!reference || Number.isNaN(createdAt.valueOf())) throw new Error("MY_TRIPS_INVALID_RESPONSE")
    const amount = booking?.sold_price === null || booking?.sold_price === undefined ? null : Number(booking.sold_price)
    return Object.freeze({ key: `account-booking-${index}`, bookingState: safeEnum(booking?.status, MY_TRIPS_BOOKING_STATES, "failed"), paymentState: safeEnum(payment?.status, MY_TRIPS_PAYMENT_STATES, "awaiting"), reference, createdAt: createdAt.toISOString(), amount: Number.isFinite(amount) ? amount : null, currency: safeText(booking?.currency, "—"), paymentMethod: safeText(booking?.pay_method, "—"), canDownloadTicket: false })
  })
}
