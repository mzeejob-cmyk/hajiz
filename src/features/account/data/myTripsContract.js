export const MY_TRIPS_BOOKING_STATES = Object.freeze(["pending_payment", "payment_confirmed", "processing", "confirmed", "ticketed", "completed"])
export const MY_TRIPS_PAYMENT_STATES = Object.freeze(["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"])
export const MY_TRIPS_TICKETING_STATES = Object.freeze(["NOT_STARTED", "PREPARED", "REQUEST_SENT", "PROCESSING", "ISSUED", "UNKNOWN", "REJECTED", "FAILED"])

const safeEnum = (value, allowed, fallback) => allowed.includes(value) ? value : fallback
const safeText = (value, fallback = "") => typeof value === "string" && value.length <= 80 ? value : fallback

const ticketingPresentation = (bookingState, record) => {
  const rawState = safeEnum(record?.ticketing_state, MY_TRIPS_TICKETING_STATES, "NOT_STARTED")
  const ticketCount = Number.isInteger(Number(record?.ticket_count)) && Number(record.ticket_count) >= 0 ? Number(record.ticket_count) : 0
  const issued = bookingState === "ticketed" && rawState === "ISSUED" && ticketCount > 0
  if (issued) return Object.freeze({ ticketingState: "ISSUED", ticketingLabel: "تم إصدار التذكرة", ticketCount, canViewTicketDetails: true, canDownloadTicket: record?.artifact_available === true, reconciliationRequired: false })
  if (bookingState === "ticketed") return Object.freeze({ ticketingState: "UNKNOWN", ticketingLabel: "حالة التذكرة تحتاج إلى مراجعة", ticketCount: 0, canViewTicketDetails: false, canDownloadTicket: false, reconciliationRequired: true })
  if (["REQUEST_SENT", "PROCESSING"].includes(rawState)) return Object.freeze({ ticketingState: "PROCESSING", ticketingLabel: "جاري إصدار التذكرة", ticketCount: 0, canViewTicketDetails: false, canDownloadTicket: false, reconciliationRequired: false })
  if (rawState === "UNKNOWN") return Object.freeze({ ticketingState: "UNKNOWN", ticketingLabel: "جاري التحقق من حالة إصدار التذكرة", ticketCount: 0, canViewTicketDetails: false, canDownloadTicket: false, reconciliationRequired: true })
  if (["REJECTED", "FAILED"].includes(rawState)) return Object.freeze({ ticketingState: rawState, ticketingLabel: "تعذر إكمال إصدار التذكرة — نحتاج إلى مراجعة الحجز", ticketCount: 0, canViewTicketDetails: false, canDownloadTicket: false, reconciliationRequired: false })
  if (bookingState === "confirmed") return Object.freeze({ ticketingState: rawState, ticketingLabel: "تم تأكيد الحجز مع شركة الطيران", ticketCount: 0, canViewTicketDetails: false, canDownloadTicket: false, reconciliationRequired: false })
  return Object.freeze({ ticketingState: rawState, ticketingLabel: "لم تصدر التذكرة بعد", ticketCount: 0, canViewTicketDetails: false, canDownloadTicket: false, reconciliationRequired: false })
}

export function toMyTripsPresentation(bookings, payments, ticketing = []) {
  if (!Array.isArray(bookings) || !Array.isArray(payments) || !Array.isArray(ticketing)) throw new Error("MY_TRIPS_INVALID_RESPONSE")
  const paymentByBooking = new Map(payments.map(payment => [safeText(payment?.booking_ref), payment]))
  const ticketingByBooking = new Map(ticketing.map(record => [safeText(record?.booking_ref), record]))
  return bookings.map((booking, index) => {
    const reference = safeText(booking?.booking_ref)
    const payment = paymentByBooking.get(reference)
    const createdAt = new Date(booking?.created_at)
    if (!reference || Number.isNaN(createdAt.valueOf())) throw new Error("MY_TRIPS_INVALID_RESPONSE")
    const amount = booking?.sold_price === null || booking?.sold_price === undefined ? null : Number(booking.sold_price)
    const bookingState = safeEnum(booking?.status, MY_TRIPS_BOOKING_STATES, "unknown")
    return Object.freeze({ key: `account-booking-${index}`, bookingState, paymentState: safeEnum(payment?.status, MY_TRIPS_PAYMENT_STATES, "unknown"), reference, createdAt: createdAt.toISOString(), amount: Number.isFinite(amount) ? amount : null, currency: safeText(booking?.currency, "—"), paymentMethod: safeText(booking?.pay_method, "—"), ...ticketingPresentation(bookingState, ticketingByBooking.get(reference)) })
  })
}

export function toMyTicketDetails(rows) {
  if (!Array.isArray(rows)) throw new Error("MY_TRIPS_INVALID_TICKET_RESPONSE")
  return Object.freeze(rows.map((row) => {
    const ticketNumber = safeText(row?.ticket_number)
    const travelerKey = safeText(row?.traveler_key)
    const issuedAt = new Date(row?.issued_at)
    if (!ticketNumber || !travelerKey || Number.isNaN(issuedAt.valueOf())) throw new Error("MY_TRIPS_INVALID_TICKET_RESPONSE")
    return Object.freeze({ travelerKey, ticketNumber, issuedAt: issuedAt.toISOString(), artifactAvailability: safeEnum(row?.artifact_availability, ["NONE", "METADATA_ONLY", "AVAILABLE"], "NONE") })
  }))
}
