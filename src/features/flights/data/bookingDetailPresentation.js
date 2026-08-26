export const BOOKING_DETAIL_STATES = Object.freeze(["processing", "confirmed", "ticketed", "completed"])

// Synthetic presentation fixtures only. These values are never booking authority or production data.
export const SYNTHETIC_BOOKING_DETAIL = Object.freeze({
  bookingReference: "HJZ-9K4M2-DEMO",
  pnr: "DEMO-EK7X2P",
  route: "DXB → KRT",
  airline: "طيران الإمارات",
  flight: "EK 735",
  date: "15 سبتمبر",
  departure: "08:30",
  arrival: "10:50",
  traveler: "MOHAMED AHMED",
  fare: "اقتصادية",
  baggage: "أمتعة 23 كجم",
})

const STATE_COPY = Object.freeze({
  processing: Object.freeze({ title: "جاري تنفيذ الحجز", copy: "تم استلام دفعتك، ونعمل الآن على تأكيد الحجز مع المورّد.", note: "لا توجد تذكرة قابلة للتحميل بعد.", detail: "سنفعّل التحميل فقط بعد انتقال الحجز إلى \"صدرت التذكرة\".", step: 1 }),
  confirmed: Object.freeze({ title: "الحجز مؤكد", copy: "أكد المورّد الحجز، لكن التذكرة لم تصدر بعد.", note: "لا توجد تذكرة قابلة للتحميل بعد.", detail: "تأكيد الحجز لا يعني صدور التذكرة. سنفعّل التحميل بعد انتقال الحجز إلى \"صدرت التذكرة\".", step: 2 }),
  ticketed: Object.freeze({ title: "صدرت التذكرة", copy: "تم تأكيد الحجز وإصدار التذكرة بنجاح.", step: 3 }),
  completed: Object.freeze({ title: "الرحلة مكتملة", copy: "اكتملت الرحلة، وتبقى التذكرة متاحة ضمن هذا العرض التجريبي.", step: 3 }),
})

export function resolveBookingDetailState(value) {
  return BOOKING_DETAIL_STATES.includes(value) ? value : "processing"
}

export function resolveBookingDetailPresentation(value) {
  const state = resolveBookingDetailState(value)
  return { state, ...STATE_COPY[state], ticketAvailable: state === "ticketed" || state === "completed" }
}
