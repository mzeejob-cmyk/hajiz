import { useState } from "react"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { DirectionText } from "../../../design-system/primitives/DirectionText.jsx"
import { resolveFare, resolveItinerary } from "../data/fareOptions.js"
import { BookingSteps } from "./BookingSteps.jsx"
import { Price } from "./Price.jsx"

const PASSENGER_FIELDS = Object.freeze([
  ["firstName", "الاسم الأول كما في الجواز", "MOHAMED", "text"],
  ["lastName", "اسم العائلة كما في الجواز", "AHMED", "text"],
  ["birthDate", "تاريخ الميلاد", "12 / 04 / 1992", "text"],
  ["gender", "الجنس", "ذكر", "select", ["ذكر", "أنثى"]],
  ["nationality", "الجنسية", "السودان", "select", ["السودان", "الإمارات العربية المتحدة"]],
  ["passportNumber", "رقم جواز السفر", "P1234567", "text"],
  ["passportCountry", "بلد إصدار الجواز", "السودان", "select", ["السودان", "الإمارات العربية المتحدة"]],
  ["passportExpiry", "تاريخ انتهاء الجواز", "18 / 11 / 2031", "text"],
])

const CONTACT_FIELDS = Object.freeze([
  ["phone", "رقم الهاتف", "+971 50 123 4567", "tel"],
  ["email", "البريد الإلكتروني", "name@example.com", "email"],
])

function Field({ name, label, value, type, options, onChange }) {
  return <label className="traveler-field"><span>{label} <b aria-hidden="true">*</b></span>{type === "select"
    ? <select name={name} value={value} onChange={onChange} required aria-required="true">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
    : <input name={name} type={type} value={value} onChange={onChange} required aria-required="true"/>}</label>
}

export function TravelerDetails({ itineraryKey, fareKey, onBack, onInvalid }) {
  const itinerary = resolveItinerary(itineraryKey)
  const fare = resolveFare(fareKey)
  const initialValues = Object.fromEntries([...PASSENGER_FIELDS, ...CONTACT_FIELDS].map(([name, , value]) => [name, value]))
  const [values, setValues] = useState(initialValues)
  const [saveIntent, setSaveIntent] = useState(false)
  const [feedback, setFeedback] = useState("")

  if (!itinerary || !fare) return <div className="fare-page fare-invalid" data-view="traveler-fallback"><Container><section role="alert"><h1>تعذر عرض بيانات المسافر</h1><p>بيانات الرحلة أو السعر غير صالحة. ارجع إلى النتائج واختر عرضًا متاحًا.</p><button type="button" onClick={onInvalid}>العودة إلى نتائج البحث</button></section></Container></div>

  const changeValue = ({ target }) => { setValues((current) => ({ ...current, [target.name]: target.value })); setFeedback("") }
  const review = (event) => {
    event.preventDefault()
    const missing = [...PASSENGER_FIELDS, ...CONTACT_FIELDS].some(([name]) => !values[name].trim())
    setFeedback(missing ? "يرجى إكمال جميع الحقول المطلوبة قبل المراجعة." : "تمت مراجعة البيانات محلياً. خطوة مراجعة الحجز هي التالية، ولم يتم إنشاء أي حجز أو حفظ بيانات.")
  }

  return <div className="traveler-page" data-view="traveler" data-itinerary={itinerary.key} data-fare={fare.key}><Container>
    <header className="traveler-heading"><button type="button" className="traveler-back" onClick={onBack}><span className="desktop-only">← العودة إلى اختيار العرض</span><span className="mobile-only">← العرض</span></button><div><h1>بيانات المسافر</h1><p className="desktop-only">أدخل البيانات كما تظهر في جواز السفر</p></div><BookingSteps activeStep={2}/></header>
    <form className="traveler-layout" onSubmit={review} noValidate><main className="traveler-content">
      <section className="saved-traveler" aria-labelledby="saved-traveler-title"><div><h2 id="saved-traveler-title">استخدم مسافرًا محفوظًا</h2><p><span className="desktop-only">اختر من بياناتك المحفوظة لتعبئة النموذج بسرعة</span><span className="mobile-only">يمكنك تعبئة النموذج من بياناتك المحفوظة</span></p></div><button type="button" onClick={() => setFeedback("هذه البطاقة للعرض المحلي فقط ولا تبحث في أي حساب.")}>اختيار مسافر محفوظ</button></section>
      <section className="traveler-card" aria-labelledby="passenger-title"><header><h2 id="passenger-title">المسافر 1 · بالغ</h2><p><span className="desktop-only">الاسم يجب أن يطابق الجواز</span><span className="mobile-only">أدخل البيانات كما تظهر في جواز السفر</span></p></header><div className="traveler-field-grid">{PASSENGER_FIELDS.map(([name, label, , type, options]) => <Field key={name} name={name} label={label} type={type} options={options} value={values[name]} onChange={changeValue}/>)}</div><label className="save-traveler"><input type="checkbox" checked={saveIntent} onChange={(event) => setSaveIntent(event.target.checked)}/><span className="desktop-only">احفظ بيانات هذا المسافر لحجوزاتك القادمة</span><span className="mobile-only">احفظ بيانات المسافر</span></label></section>
      <section className="traveler-card contact-card" aria-labelledby="contact-title"><header><h2 id="contact-title"><span className="desktop-only">بيانات التواصل للحجز</span><span className="mobile-only">بيانات التواصل</span></h2><p className="desktop-only">سنستخدمها لإرسال تحديثات الحجز والتذكرة عند إصدارها.</p></header><div className="traveler-field-grid">{CONTACT_FIELDS.map(([name, label, , type]) => <Field key={name} name={name} label={label} type={type} value={values[name]} onChange={changeValue}/>)}</div></section>
      <aside className="traveler-privacy desktop-only"><p>بيانات الجواز حساسة وتُعرض لك فقط ضمن حسابك.</p><strong>تأكد من مطابقة الاسم ورقم الجواز قبل المتابعة.</strong></aside>
      <p className="mobile-check-note mobile-only">تأكد من مطابقة البيانات مع الجواز قبل المتابعة.</p>
    </main>{feedback && <p className="traveler-feedback" role="status" aria-live="polite">{feedback}</p>}<aside className="traveler-summary" aria-label="ملخص الحجز"><div className="desktop-only"><h2>ملخص الحجز</h2><strong><DirectionText>{itinerary.origin} → {itinerary.destination}</DirectionText></strong><p>15 سبتمبر · EK 735 · مباشر</p><p>{fare.key === "checked" ? "اقتصادية · أمتعة 23 كجم" : "اقتصادية · حقيبة مقصورة"}</p></div><div className="traveler-price-lock desktop-only" aria-label="صلاحية العرض"><DirectionText>12:10</DirectionText><span>السعر محفوظ لمدة</span></div><Price amount={fare.amount} currency={fare.currency}/><p className="desktop-only">الخطوة التالية: مراجعة البيانات والسعر قبل الدفع.</p><button type="submit"><span className="desktop-only">مراجعة الحجز</span><span className="mobile-only">مراجعة</span></button></aside></form>
  </Container></div>
}
