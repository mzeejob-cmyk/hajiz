export function resolveFlightFulfillmentPresentationV1({ bookingState, ticketingState = "NOT_STARTED", hasTicketData = false, hasDownloadableArtifact = false } = {}) {
  if (bookingState === "ticketed" && ticketingState === "ISSUED" && hasTicketData) return Object.freeze({ title: "تم إصدار التذكرة", canViewTicketDetails: true, canDownloadTicket: hasDownloadableArtifact === true, finalTravelCompleted: false })
  if (ticketingState === "UNKNOWN") return Object.freeze({ title: "جاري التحقق من حالة إصدار التذكرة", canViewTicketDetails: false, canDownloadTicket: false, finalTravelCompleted: false })
  if (["REQUEST_SENT", "PROCESSING"].includes(ticketingState)) return Object.freeze({ title: "جاري إصدار التذكرة", canViewTicketDetails: false, canDownloadTicket: false, finalTravelCompleted: false })
  if (bookingState === "confirmed") return Object.freeze({ title: "تم تأكيد الحجز مع شركة الطيران", canViewTicketDetails: false, canDownloadTicket: false, finalTravelCompleted: false })
  if (bookingState === "payment_confirmed") return Object.freeze({ title: "تم تأكيد الدفع", canViewTicketDetails: false, canDownloadTicket: false, finalTravelCompleted: false })
  return Object.freeze({ title: "لم تصدر التذكرة بعد", canViewTicketDetails: false, canDownloadTicket: false, finalTravelCompleted: false })
}
