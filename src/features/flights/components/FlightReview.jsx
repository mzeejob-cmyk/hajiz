import { useState } from "react"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { DirectionText } from "../../../design-system/primitives/DirectionText.jsx"
import { resolveFare, resolveItinerary } from "../data/fareOptions.js"
import { maskPassport } from "../data/maskPassport.js"
import { BookingSteps } from "./BookingSteps.jsx"
import { Price } from "./Price.jsx"

export function FlightReview({ itineraryKey, fareKey, draft, onBack, onMissingDraft }) {
  const [feedback, setFeedback] = useState("")
  const itinerary = resolveItinerary(itineraryKey)
  const fare = resolveFare(fareKey)

  if (!itinerary || !fare || !draft) return <div className="review-page fare-invalid" data-view="review-fallback"><Container><section role="alert"><h1>تعذر عرض مراجعة الحجز</h1><p>لم تعد بيانات المسافر متاحة في هذه الجلسة. ارجع إلى بيانات المسافر للمتابعة.</p><button type="button" onClick={onMissingDraft}>العودة إلى بيانات المسافر</button></section></Container></div>

  const maskedPassport = maskPassport(draft.passportNumber)
  const baggage = fare.key === "checked" ? "اقتصادية · أمتعة مسجلة 23 كجم" : "اقتصادية · حقيبة مقصورة"
  const mobileBaggage = fare.key === "checked" ? "اقتصادية · أمتعة 23 كجم" : "اقتصادية · حقيبة مقصورة"
  const fullName = `${draft.firstName} ${draft.lastName}`.trim()
  const showBoundaryFeedback = () => setFeedback("خطوة الدفع هي التالية. لم يتم إنشاء عملية دفع أو حجز حتى الآن.")

  return <div className="review-page" data-view="review" data-itinerary={itinerary.key} data-fare={fare.key}><Container>
    <header className="review-heading"><button type="button" className="review-back" onClick={onBack}><span className="desktop-only">← العودة إلى بيانات المسافر</span><span className="mobile-only">← البيانات</span></button><div><h1><span className="desktop-only">راجع حجزك قبل الدفع</span><span className="mobile-only">راجع حجزك</span></h1><p className="desktop-only">تأكد من الرحلة وبيانات المسافر والسعر</p></div><BookingSteps activeStep={3}/></header>
    <div className="review-layout"><main className="review-content">
      <section className="review-card review-flight" aria-labelledby="review-flight-title"><h2 id="review-flight-title">الرحلة</h2><strong><DirectionText>{itinerary.origin} → {itinerary.destination}</DirectionText></strong><p><span className="desktop-only">{itinerary.airline} · </span><DirectionText>{itinerary.airlineCode} {itinerary.flightNumber} · {itinerary.departure} → {itinerary.arrival}</DirectionText> · مباشر</p><p><span className="desktop-only">{baggage}</span><span className="mobile-only">{mobileBaggage}</span></p></section>
      <section className="review-card review-traveler" aria-labelledby="review-traveler-title"><header><h2 id="review-traveler-title"><span className="desktop-only">المسافر 1 · بالغ</span><span className="mobile-only">المسافر</span></h2><button type="button" className="desktop-only" onClick={onBack}>تعديل</button></header><strong dir="ltr">{fullName}</strong><p className="desktop-only">{draft.nationality} · {draft.birthDate} · جواز <bdi>{maskedPassport}</bdi> · ينتهي {draft.passportExpiry}</p><p className="mobile-only">{draft.nationality} · جواز <bdi>{maskedPassport}</bdi></p><p className="mobile-only">ينتهي {draft.passportExpiry}</p></section>
      <section className="review-card review-contact" aria-labelledby="review-contact-title"><h2 id="review-contact-title">التواصل</h2><p className="desktop-only" dir="ltr">{draft.phone} · {draft.email}</p><p className="mobile-only" dir="ltr">{draft.phone}</p><p className="mobile-only" dir="ltr">{draft.email}</p></section>
      <aside className="review-note"><p className="desktop-only"><strong>بعد الدفع يبدأ تنفيذ الحجز لدى المورّد.</strong></p><p className="desktop-only">تأكيد الدفع لا يعني أن التذكرة صدرت بعد؛ ستتابع حالة الحجز من حسابك.</p><p className="mobile-only"><strong>الدفع المؤكد لا يعني صدور التذكرة.</strong></p><p className="mobile-only">سننفذ الحجز بعد استلام الدفع.</p></aside>
    </main>
    <aside className="review-summary" aria-label="السعر النهائي"><h2 className="desktop-only">السعر النهائي</h2><Price amount={fare.amount} currency={fare.currency}/><hr className="desktop-only"/><p className="desktop-only">العرض المحدد · مسافر واحد</p><p className="desktop-only">سيتم عرض مبلغ بنكك بالجنيه قبل التحويل.</p><button type="button" onClick={showBoundaryFeedback}><span className="desktop-only">الانتقال إلى الدفع</span><span className="mobile-only">الدفع</span></button></aside>
    {feedback && <p className="review-feedback" role="status" aria-live="polite">{feedback}</p>}
    </div>
  </Container></div>
}
