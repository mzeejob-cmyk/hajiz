export const NOTIFICATION_EVENTS = Object.freeze(["payment_pending", "payment_confirmed", "supplier_confirmed", "ticket_issued", "failed_reconciliation", "hotel_confirmation_later", "hotel_voucher_later"])
export function validateNotification(input) {
  if (!NOTIFICATION_EVENTS.includes(input?.event)) throw new Error("NOTIFICATION_EVENT_INVALID")
  if (typeof input?.recipientRef !== "string" || !input.recipientRef) throw new Error("NOTIFICATION_RECIPIENT_REQUIRED")
  return Object.freeze({ event: input.event, recipientRef: input.recipientRef, bookingReference: typeof input.bookingReference === "string" ? input.bookingReference : null, channel: "provider-pending" })
}
