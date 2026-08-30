import React from "react"

export function FlightSupplierBookingStateV1({ booking }) {
  if (booking?.status === "processing") return <section role="status"><h2>جاري تأكيد الحجز مع شركة الطيران</h2><p>تم تأكيد الدفع، لكن شركة الطيران لم تؤكد الحجز بعد.</p></section>
  if (booking?.status === "confirmed") return <section role="status"><h2>تم تأكيد الحجز مع شركة الطيران</h2><p>تأكيد الحجز لا يعني إصدار التذكرة.</p></section>
  return null
}
