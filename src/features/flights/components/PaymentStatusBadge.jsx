import circleCheck from "../../../assets/payment-status/circle-check.svg"
import clock from "../../../assets/payment-status/clock.svg"
import creditCard from "../../../assets/payment-status/credit-card.svg"
import eye from "../../../assets/payment-status/eye.svg"
import rotateCw from "../../../assets/payment-status/rotate-cw.svg"

const PAYMENT_BADGES = Object.freeze({
  under_review: { label: "قيد مراجعة الدفع", icon: eye, tone: "info" },
  confirmed: { label: "تم تأكيد الدفع", icon: circleCheck, tone: "info" },
})

const BOOKING_BADGES = Object.freeze({
  pending_payment: { label: "بانتظار الدفع", icon: clock, tone: "warning" },
  payment_confirmed: { label: "تم استلام الدفع", icon: creditCard, tone: "info" },
  processing: { label: "جاري تنفيذ الحجز", icon: rotateCw, tone: "info" },
  confirmed: { label: "الحجز مؤكد", icon: circleCheck, tone: "success" },
  ticketed: { label: "صدرت التذكرة", icon: circleCheck, tone: "success" },
  completed: { label: "مكتملة", icon: circleCheck, tone: "success" },
})

export function PaymentStatusBadge({ domain, status }) {
  const badge = domain === "payment" ? PAYMENT_BADGES[status] : BOOKING_BADGES[status]
  if (!badge) return null
  return <span className={`status-badge status-badge--${badge.tone}`} data-domain={domain} data-status={status}><span>{badge.label}</span><img src={badge.icon} width="16" height="16" alt=""/></span>
}
