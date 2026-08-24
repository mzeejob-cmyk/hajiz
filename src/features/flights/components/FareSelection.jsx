import { useState } from "react"
import { DirectionText } from "../../../design-system/primitives/DirectionText.jsx"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { BookingSteps } from "./BookingSteps.jsx"
import { FlightSegment } from "./FlightSegment.jsx"
import { Price } from "./Price.jsx"
import { FARE_OPTIONS, resolveFare, resolveItinerary } from "../data/fareOptions.js"

const SAVED_FEEDBACK = "تم حفظ الاختيار مؤقتاً لهذه الجلسة. بيانات المسافر هي الخطوة التالية."

export function FareSelection({ itineraryKey, onBack }) {
  const itinerary = resolveItinerary(itineraryKey)
  const [fareKey, setFareKey] = useState("checked")
  const [feedback, setFeedback] = useState("")
  const selectedFare = resolveFare(fareKey)

  if (!itinerary) return <div className="fare-page fare-invalid" data-view="fare-fallback"><Container>
    <section role="alert"><h1>تعذر عرض تفاصيل الرحلة</h1><p>لم نتمكن من العثور على الرحلة المحددة. ارجع إلى نتائج البحث واختر رحلة متاحة.</p><button type="button" onClick={onBack}>العودة إلى نتائج البحث</button></section>
  </Container></div>

  return <div className="fare-page" data-view="fare" data-itinerary={itinerary.key}><Container>
    <header className="fare-heading">
      <button type="button" className="fare-back" onClick={onBack}><span className="desktop-only">← العودة إلى نتائج البحث</span><span className="mobile-only">← النتائج</span></button>
      <div><h1><span className="desktop-only">اختر العرض المناسب لرحلتك</span><span className="mobile-only">اختر العرض</span></h1><p className="fare-subheading desktop-only">دبي إلى الخرطوم · الثلاثاء، 15 سبتمبر · مسافر واحد</p></div>
      <BookingSteps />
    </header>
    <div className="fare-layout"><main className="fare-content">
      <section className="selected-itinerary" aria-labelledby="selected-flight-title">
        <div className="selected-itinerary-heading desktop-only"><h2 id="selected-flight-title">تفاصيل الرحلة</h2><span>مباشر</span></div>
        <div className="mobile-itinerary-title mobile-only"><strong><DirectionText>DXB → KRT</DirectionText></strong><span>مباشر</span></div>
        <div className="itinerary-airline desktop-only"><DirectionText>{itinerary.airlineCode} {itinerary.flightNumber}</DirectionText><span>{itinerary.airline}</span></div>
        <FlightSegment offer={itinerary}/>
        <p className="itinerary-footer desktop-only">EK 735 · الدرجة السياحية · مدة الرحلة 3س 45د</p>
        <p className="itinerary-footer mobile-only">الثلاثاء، 15 سبتمبر · EK 735</p>
      </section>
      <section className="fare-price-note desktop-only"><strong>سيُعاد التحقق من السعر قبل الانتقال إلى الدفع</strong><p>شروط التغيير والاسترداد تظهر فقط عندما تصل من العرض بشكل موثوق؛ إلى ذلك الحين نعرض &quot;تطبق الشروط&quot;.</p></section>
      <div className="fare-price-lock mobile-only" aria-label="صلاحية العرض"><DirectionText>14:38</DirectionText><span>السعر محفوظ لمدة</span></div>
      <section className="fare-options" aria-labelledby="fare-options-title">
        <h2 id="fare-options-title"><span className="desktop-only">خيارات السعر</span><span className="mobile-only">اختر خيار السعر</span></h2>
        <p className="fare-options-support"><span className="desktop-only">نفس الرحلة قد تتوفر بأكثر من خيار عميل. حاجز لا يعرض اسم المورّد.</span><span className="mobile-only">الشروط التفصيلية تظهر عند توفرها من العرض</span></p>
        <div className="fare-option-grid">{FARE_OPTIONS.map((fare) => { const selected = fare.key === fareKey; return <label key={fare.key} className={`fare-option${selected ? " is-selected" : ""}`}>
          <input className="visually-hidden" type="radio" name="fare" value={fare.key} checked={selected} onChange={() => { setFareKey(fare.key); setFeedback("") }}/>
          <div className="fare-option-copy"><strong>{fare.title}</strong><small>{fare.subtitle}</small><div className="fare-meta"><span>{fare.baggage}</span><span>{fare.flexibility}</span></div></div>
          <div className="fare-option-action"><Price amount={fare.amount} currency={fare.currency}/><span className="fare-select-label">{selected ? "محدد" : "اختيار"}</span></div>
        </label> })}</div>
      </section>
      <section className="fare-rules"><h2><span className="desktop-only">ما يشمله العرض المحدد</span><span className="mobile-only">العرض المحدد</span></h2>{fareKey === "checked" ? <>
        <p className="desktop-only">• أمتعة مسجلة: 23 كجم</p><p className="desktop-only">• حقيبة مقصورة حسب شروط شركة الطيران</p><p className="desktop-only">• شروط التغيير والاسترداد: تطبق شروط التذكرة</p>
        <p className="mobile-only">أمتعة مسجلة: 23 كجم</p><p className="mobile-only">التغيير والاسترداد: تطبق شروط التذكرة</p>
      </> : <><p>حقيبة مقصورة</p><p>التغيير والاسترداد: تطبق شروط التذكرة</p></>}</section>
      <p className="mobile-prebooking-note mobile-only">لا يتم تنفيذ الحجز قبل الخطوات التالية.</p>
    </main><aside className="fare-summary" aria-label="ملخص السعر">
      <h2 className="desktop-only">ملخص السعر</h2><div className="fare-price-lock desktop-only" aria-label="صلاحية العرض"><DirectionText>14:38</DirectionText><span>السعر محفوظ لمدة</span></div>
      <Price amount={selectedFare.amount} currency={selectedFare.currency} className="fare-summary-price"/>
      <p className="desktop-only">السعر المعروض هو سعر العميل للعرض المحدد.</p><strong className="desktop-only">لن يتم تنفيذ الحجز في هذه الخطوة.</strong>
      <button type="button" onClick={() => setFeedback(SAVED_FEEDBACK)}><span className="desktop-only">متابعة لبيانات المسافر</span><span className="mobile-only">متابعة</span></button>
      {feedback && <p className="fare-feedback visually-hidden" role="status" aria-live="polite">{feedback}</p>}
      <small className="desktop-only">يمكنك الرجوع وتغيير العرض قبل إدخال بيانات الدفع.</small>
    </aside></div>
  </Container></div>
}
