export const PAYMENT_STATUS_PRESENTATION_STATES = Object.freeze(["under_review", "payment_confirmed", "processing"])

const PRESENTATION_FIXTURES = Object.freeze({
  under_review: Object.freeze({ paymentStatus: "under_review", bookingStatus: "pending_payment", title: "تم استلام إيصالك", copy: "يقوم فريق المالية بمراجعة التحويل. لا تحتاج لإعادة رفع الإيصال." }),
  payment_confirmed: Object.freeze({ paymentStatus: "confirmed", bookingStatus: "payment_confirmed", title: "تم تأكيد الدفع", copy: "استلمنا المبلغ، والآن نبدأ تنفيذ الحجز لدى المورّد.", note: "هذا لا يعني أن المقعد أو التذكرة مؤكدان بعد." }),
  processing: Object.freeze({ paymentStatus: "confirmed", bookingStatus: "processing", title: "جاري تنفيذ الحجز", copy: "سنحدّث الحالة إلى \"الحجز مؤكد\" ثم \"صدرت التذكرة\" فقط بعد استجابة المورّد." }),
})

// Synthetic presentation fixtures only: no production, payment, booking, or supplier data.
export function resolvePaymentStatusPresentation(value) {
  return PRESENTATION_FIXTURES[value] ?? PRESENTATION_FIXTURES.under_review
}
