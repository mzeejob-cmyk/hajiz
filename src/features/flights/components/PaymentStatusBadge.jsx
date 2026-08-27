import circleCheck from "../../../assets/payment-status/circle-check.svg"
import clock from "../../../assets/payment-status/clock.svg"
import creditCard from "../../../assets/payment-status/credit-card.svg"
import eye from "../../../assets/payment-status/eye.svg"
import rotateCw from "../../../assets/payment-status/rotate-cw.svg"

const PAYMENT_BADGES = Object.freeze({
  awaiting: { label: "بانتظار الدفع", icon: clock, tone: "warning" },
  under_review: { label: "قيد مراجعة الدفع", icon: eye, tone: "info" },
  confirmed: { label: "تم تأكيد الدفع", icon: circleCheck, tone: "success" },
  rejected: { label: "تم رفض الدفع", icon: clock, tone: "neutral" },
  expired: { label: "انتهت مهلة الدفع", icon: clock, tone: "neutral" },
  refunded: { label: "تم رد المبلغ", icon: rotateCw, tone: "info" },
  unknown: { label: "جاري تحديث الحالة", icon: rotateCw, tone: "neutral" },
})

const BOOKING_BADGES = Object.freeze({
  pending_payment: { label: "بانتظار الدفع", icon: clock, tone: "warning" },
  payment_confirmed: { label: "تم استلام الدفع", icon: creditCard, tone: "info" },
  processing: { label: "جاري تنفيذ الحجز", icon: rotateCw, tone: "info" },
  confirmed: { label: "الحجز مؤكد", icon: circleCheck, tone: "success" },
  ticketed: { label: "صدرت التذكرة", icon: circleCheck, tone: "success" },
  completed: { label: "مكتملة", icon: circleCheck, tone: "success" },
  unknown: { label: "جاري تحديث الحالة", icon: rotateCw, tone: "neutral" },
})

export function PaymentStatusBadge({ domain, status }) {
  const badges = domain === "payment" ? PAYMENT_BADGES : BOOKING_BADGES
  const badge = badges[status] ?? badges.unknown
  const visibleStatus = badges[status] ? status : "unknown"
  return <span className={`status-badge status-badge--${badge.tone}`} data-domain={domain} data-status={visibleStatus}><span>{badge.label}</span><img src={badge.icon} width="16" height="16" alt=""/></span>
}
