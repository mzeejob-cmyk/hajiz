const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)))
export const ADMIN_OPS_PRESENTATION = Object.freeze({
  navigation: Object.freeze(["نظرة عامة", "المدفوعات", "الحجوزات", "الشركاء", "الدفعات المستحقة", "التسعير والعملات", "الموردون", "الباقات والعروض", "المحتوى CMS", "النظام والتدقيق"]),
  metrics: freezeRows([{ label: "دفعات بانتظار المراجعة", value: 2, note: "Finance queue" }, { label: "استثناءات الحجوزات", value: 2, note: "بعد تأكيد الدفع" }, { label: "إخفاقات الموردين", value: 1, note: "Mock supplier only" }, { label: "استرداد/مطابقة", value: "—", note: "Contract pending" }]),
  bankakReview: freezeRows([{ key: "bankak-demo-1", reference: "PAY-DEMO-82K1", summary: "إيصال اصطناعي بانتظار Finance", paymentState: "under_review", bookingState: "pending_payment" }, { key: "bankak-demo-2", reference: "PAY-DEMO-18Q4", summary: "مراجعة يدوية دون صلاحية تنفيذ", paymentState: "under_review", bookingState: "pending_payment" }]),
  bookingExceptions: freezeRows([{ key: "booking-demo-1", reference: "HJZ-DEMO-H82P", summary: "متابعة مورد mock بعد تأكيد الدفع", paymentState: "confirmed", bookingState: "processing" }, { key: "booking-demo-2", reference: "HJZ-DEMO-M31R", summary: "تأكيد المورد لم يصل بعد", paymentState: "confirmed", bookingState: "processing" }]),
  supplierFailures: freezeRows([{ key: "supplier-demo-1", reference: "SUP-DEMO-03", summary: "فشل اصطناعي؛ لا إعادة حجز تلقائية", paymentState: "confirmed", bookingState: "processing" }]),
})
