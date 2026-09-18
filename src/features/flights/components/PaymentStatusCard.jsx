/**
 * HAJIZ V2 payment status card — Figma nodes 17:102 to 17:125.
 *
 * PRESENTATION ONLY. This renders a status it is handed; it never reads,
 * derives or transitions payment state, and it exposes no control of any kind.
 * The canonical six statuses come from the server-owned payment state machine.
 *
 * Every card carries the status code as text alongside its tone, so a status
 * is never communicated by colour alone.
 *
 * Node 17:112/17:113 is the one that matters most: a confirmed payment says
 * the payment is confirmed and that supplier confirmation and ticketing are
 * still pending. It never implies a booking, a seat or a ticket.
 */
const PAYMENT_STATUS_CARDS = Object.freeze({
  awaiting: { code: "AWAITING", tone: "warning", title: "بانتظار الدفع", note: "الحالة محفوظة من الخادم" },
  under_review: { code: "UNDER REVIEW", tone: "info", title: "قيد المراجعة", note: "الحالة محفوظة من الخادم" },
  confirmed: { code: "CONFIRMED", tone: "success", title: "تم تأكيد الدفع", note: "بانتظار تأكيد المورد/التذكرة" },
  rejected: { code: "REJECTED", tone: "error", title: "تعذّر قبول الدفع", note: "الحالة محفوظة من الخادم" },
  expired: { code: "EXPIRED", tone: "error", title: "انتهت المهلة", note: "الحالة محفوظة من الخادم" },
  refunded: { code: "REFUNDED", tone: "info", title: "تم ردّ المبلغ", note: "الحالة محفوظة من الخادم" },
})


export function PaymentStatusCard({ status }) {
  const card = PAYMENT_STATUS_CARDS[status]
  if (!card) return null
  return (
    <div className={`payment-status-v2 payment-status-v2--${card.tone}`} data-payment-status={status}>
      <p className="payment-status-v2__code" dir="ltr">{card.code}</p>
      <p className="payment-status-v2__title">{card.title}</p>
      <p className="payment-status-v2__note">{card.note}</p>
    </div>
  )
}
