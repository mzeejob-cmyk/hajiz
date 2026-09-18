import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
import { FlightOfferCard } from "./components/FlightOfferCard.jsx"
import { FlightsSearchSummary } from "./components/FlightsSearchSummary.jsx"
import { FlightsResultsSortBar } from "./components/FlightsResultsSortBar.jsx"
import { FlightsResultsFiltersPanel } from "./components/FlightsResultsFiltersPanel.jsx"
import { Skeleton } from "../../design-system/primitives/Skeleton.jsx"
import { parseFlightQuery } from "./data/flightQuery.js"
import { useFlightSearchClientV1 } from "./api/flightSearchClientContext.js"
import { mapFlightSearchRequestV1 } from "./data/flightSearchRequestV1.js"
import { createFlightSearchCoordinatorV1 } from "./data/flightSearchCoordinatorV1.js"
import { toFlightResultsViewModelV1 } from "./data/flightResultsViewModelV1.js"
import { useFlightRepriceClientV1 } from "./api/flightRepriceClientContext.js"
import { createFlightRepriceCoordinatorV1 } from "./data/flightRepriceCoordinatorV1.js"
import { Price } from "./components/Price.jsx"
import { useFlightCheckoutClientV1 } from "./api/flightCheckoutClientContext.js"
import { createFlightCheckoutCoordinatorV1 } from "./data/flightCheckoutCoordinatorV1.js"
import { useFlightBookingIntentClientV1 } from "./api/flightBookingIntentClientContext.js"
import { createFlightBookingIntentCoordinatorV1 } from "./data/flightBookingIntentCoordinatorV1.js"
import { useFlightPaymentInitiationClientV1 } from "./api/flightPaymentInitiationClientContext.js"
import { createFlightPaymentInitiationCoordinatorV1 } from "./data/flightPaymentInitiationCoordinatorV1.js"
import { toFlightTravelerDataV1 } from "./data/flightTravelerFormV1.js"
import { BankakReceiptUpload } from "./components/BankakReceiptUpload.jsx"
import { PaymentStatusCard } from "./components/PaymentStatusCard.jsx"

const COPY = Object.freeze({
  idle: ["ابدأ البحث", "اختر تفاصيل رحلتك لعرض الخيارات المتاحة."],
  loading: ["نبحث عن أفضل الخيارات المتاحة", "قد يستغرق البحث لحظات قليلة."],
  empty: ["ما لقينا رحلات مطابقة لبحثك", "جرّب تغيير التاريخ أو المطار."],
  partial_empty: ["لم نتمكن من عرض نتائج الرحلات كاملة حالياً", "جرّب إعادة البحث بعد قليل."],
  unavailable: ["تعذر إكمال البحث حالياً", "حاول مرة أخرى بعد قليل."],
  timeout: ["استغرق البحث وقتاً أطول من المتوقع", "أعد المحاولة."],
  validation_error: ["راجع تفاصيل البحث", "بعض بيانات الرحلة غير صالحة."],
  internal_error: ["حدث خطأ غير متوقع", "حاول مرة أخرى."],
})

export function ResultsState({ state, onRetry }) {
  if (state.status === "loading") return <div className="flight-loading flight-loading-v2" role="status" aria-live="polite"><h2>{COPY.loading[0]}</h2><p>{COPY.loading[1]}</p><Skeleton variant="block" className="flight-card-skeleton"/><Skeleton variant="block" className="flight-card-skeleton"/><Skeleton variant="block" className="flight-card-skeleton"/></div>
  const copy = COPY[state.status]
  if (!copy) return null
  return <section className="flight-results-state flight-results-state-v2" role={state.status === "idle" || state.status === "empty" ? "status" : "alert"}><h2>{copy[0]}</h2><p>{copy[1]}</p>{!["idle", "empty", "validation_error"].includes(state.status) && <button type="button" onClick={onRetry}>إعادة المحاولة</button>}</section>
}

export function RepricePanel({ state, onContinue }) {
  if (!state || state.status === "idle") return null
  if (state.status === "repricing") return <section className="selection-notice selection-notice-v2" role="status">جارٍ التحقق من السعر والتوفر الحاليين…</section>
  if (state.status === "price_changed") return <section className="selection-notice selection-notice-v2" role="alert"><h2>تغيّر السعر</h2><p>راجع السعر الحالي قبل المتابعة.</p><Price amount={state.result.currentCustomerPrice.amount} currency={state.result.currentCustomerPrice.currency}/><button type="button" onClick={() => onContinue?.(state.result.pricedSelectionId)}>أوافق على السعر الحالي</button></section>
  if (state.status === "available") return <section className="selection-notice selection-notice-v2" role="status"><h2>السعر والتوفر محدثان</h2><Price amount={state.result.currentCustomerPrice.amount} currency={state.result.currentCustomerPrice.currency}/><button type="button" onClick={() => onContinue?.(state.result.pricedSelectionId)}>جاهز للمتابعة إلى بيانات المسافر</button><p>لم يتم إنشاء حجز أو تثبيت مقعد.</p></section>
  const copy = { unavailable: "لم يعد هذا الخيار متاحاً", expired: "انتهت صلاحية هذا الاختيار", timeout: "استغرق التحقق وقتاً أطول من المتوقع", validation_error: "تعذر التحقق من الاختيار", internal_error: "تعذر التحقق من السعر حالياً" }[state.status] ?? "تعذر التحقق من السعر حالياً"
  return <section className="selection-notice selection-notice-v2" role="alert"><h2>{copy}</h2><p>أعد اختيار الرحلة أو حاول مرة أخرى.</p></section>
}

export function TravelerCheckoutPanel({ state, onBack, onAcceptPrice, onReview }) {
  const [feedback, setFeedback] = useState("")
  useEffect(() => setFeedback(""), [state?.result?.pricedSelectionId])
  if (!state || state.status === "idle") return null
  if (state.status === "preparing") return <section className="selection-notice selection-notice-v2" role="status">جارٍ إعادة التحقق من السعر قبل بيانات المسافرين…</section>
  if (state.status === "price_changed") return <section className="selection-notice selection-notice-v2 checkout-price-change-v2" role="alert"><h2>تغيّر السعر بعد إعادة التحقق</h2><p>السعر السابق:</p><Price amount={state.result.previousCustomerPrice.amount} currency={state.result.previousCustomerPrice.currency}/><p>السعر الحالي:</p><Price amount={state.result.currentCustomerPrice.amount} currency={state.result.currentCustomerPrice.currency}/><button type="button" onClick={() => onAcceptPrice?.(state.result.pricedSelectionId)}>أوافق على السعر الحالي وأعيد التحقق</button><button type="button" onClick={onBack}>العودة إلى النتائج</button><p>لن نعرض نموذج المسافرين قبل قبول السعر الحالي.</p></section>
  if (state.status !== "ready") { const copy = { unavailable: "لم يعد هذا الخيار متاحاً في المخزون الحالي.", service_unavailable: "تعذر الاتصال بخدمة إعادة التسعير حالياً، ولا يعني ذلك نفاد الرحلة.", expired: "انتهت صلاحية الاختيار.", timeout: "استغرق التحقق وقتاً أطول من المتوقع." }[state.status] ?? "تعذر تجهيز بيانات المسافرين حالياً."; return <section className="selection-notice selection-notice-v2" role="alert"><h2>{copy}</h2><button type="button" onClick={onBack}>العودة إلى النتائج</button></section> }
  const { expectedPassengers, itinerary, currentCustomerPrice } = state.result
  const types = [["ADT", expectedPassengers.ADT, "بالغ"], ["CHD", expectedPassengers.CHD, "طفل"], ["INF", expectedPassengers.INF, "رضيع"]]
  const submit = (event) => { event.preventDefault(); if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); setFeedback("راجع الحقول المطلوبة قبل المتابعة."); return } try { const values = new FormData(event.currentTarget); const travelerData = toFlightTravelerDataV1({ read: (name) => values.get(name), expectedPassengers }); setFeedback("تم تجهيز البيانات للمراجعة. لم يتم إنشاء حجز أو دفع أو تثبيت مقعد."); onReview?.({ pricedSelectionId: state.result.pricedSelectionId, travelerData }) } catch { setFeedback("راجع بيانات المسافرين والتواصل قبل المتابعة.") } }
  const fare = state.result.fare
  return <section className="traveler-card checkout-v2" aria-labelledby="b10-travelers-title"><header className="checkout-v2__head"><button className="checkout-v2__back" type="button" onClick={onBack}>العودة إلى النتائج</button><h2 id="b10-travelers-title">بيانات المسافرين</h2><p className="checkout-v2__subtitle">ملخص صريح قبل الدفع — بدون سلطة مالية في المتصفح</p></header><form className="checkout-v2__layout" onSubmit={submit}><div className="checkout-v2__details">{types.flatMap(([type, count, label]) => Array.from({ length: count }, (_, index) => { const prefix = `travelers-${type}-${index}`; const titles = type === "ADT" ? [["MR", "السيد"], ["MS", "الآنسة"], ["MRS", "السيدة"]] : [[type, label]]; return <fieldset key={prefix}><legend>{label} {index + 1}</legend><input type="hidden" name={`${prefix}-travelerKey`} value={`${type.toLowerCase()}-${index + 1}`}/><input type="hidden" name={`${prefix}-travelerType`} value={type}/><label>اللقب<select name={`${prefix}-title`} required>{titles.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label>الاسم الأول<input name={`${prefix}-firstName`} maxLength="70" required/></label><label>الاسم الأوسط (اختياري)<input name={`${prefix}-middleName`} maxLength="70"/></label><label>اسم العائلة<input name={`${prefix}-lastName`} maxLength="70" required/></label><label>تاريخ الميلاد<input name={`${prefix}-dateOfBirth`} type="date" required/></label><input type="hidden" name={`${prefix}-documentType`} value="PASSPORT"/><label>رقم جواز السفر<input name={`${prefix}-documentNumber`} maxLength="30" pattern="[A-Za-z0-9-]+" required/></label><label>بلد الإصدار<input name={`${prefix}-issuingCountry`} maxLength="2" pattern="[A-Z]{2}" required/></label><label>الجنسية<input name={`${prefix}-nationality`} maxLength="2" pattern="[A-Z]{2}" required/></label><label>انتهاء الجواز<input name={`${prefix}-expiryDate`} type="date" required/></label></fieldset> }))}<fieldset><legend>بيانات التواصل للحجز</legend><label>البريد الإلكتروني<input type="email" name="contact-email" maxLength="254" required/></label><label>رمز الدولة<input name="contact-phoneCountryCode" maxLength="5" pattern="\+[1-9][0-9]{0,3}" required/></label><label>رقم الهاتف<input type="tel" name="contact-phoneNumber" minLength="6" maxLength="15" pattern="[0-9]+" required/></label></fieldset></div><aside className="checkout-v2__summary"><h3 className="checkout-v2__summary-title">إجمالي الرحلة</h3><Price className="checkout-v2__total" amount={currentCustomerPrice.amount} currency={currentCustomerPrice.currency}/><p className="checkout-v2__summary-note">السعر يُعتمد من الخادم عند المتابعة</p><p className="checkout-v2__route" dir="ltr">{itinerary.origin} → {itinerary.destination}</p>{fare && <p className="checkout-v2__summary-note">{fare.cabin} · {fare.baggage}</p>}<p className="checkout-v2__summary-note">السعر والتوفر أُعيدا التحقق منهما قبل عرض هذه الحقول.</p><button className="checkout-v2__cta" type="submit">متابعة إلى مراجعة الحجز</button></aside></form>{feedback && <p className="checkout-v2__feedback" role="status">{feedback}</p>}</section>
}

export function PaymentInitiationPanel({ intent, state, onInitiate, onReturn, receiptDataSource }) {
  const [paymentMethod, setPaymentMethod] = useState("bankak")
  useEffect(() => setPaymentMethod("bankak"), [intent?.bookingIntentId])
  if (!intent) return null
  if (state?.status === "bankak_handoff") {
    const handoff = state.result.handoff
    // The AED/USD equivalent is the trusted top-level customer amount from the
    // same server response. It is displayed, never derived: no FX is computed.
    const equivalent = state.result.currency && state.result.currency !== "SDG" ? state.result : null
    return <section className="selection-notice selection-notice-v2 payments-v2" role="status" aria-labelledby="b12-bankak-title"><h2 id="b12-bankak-title" className="payments-v2__title">تم إنشاء طلب الدفع</h2><div className="payments-v2__bankak"><div className="payments-v2__instructions"><h3 className="payments-v2__instructions-title">الدفع عبر بنكك</h3><p className="payments-v2__instructions-body">حوّل المبلغ، ثم ارفع صورة الإيصال للمراجعة.</p><p className="payments-v2__expiry-headline">تنتهي صلاحية طلب الدفع بعد 24 ساعة</p><p className="payments-v2__muted">المهلة الفعلية يحددها الخادم — الصلاحية 24 ساعة من إنشاء طلب الدفع.</p><p className="payments-v2__muted">بانتظار إتمام التحويل ومراجعته من فريق المالية.</p><p className="payments-v2__muted">ينتهي طلب الدفع في <time className="payments-v2__value" dateTime={state.result.expiresAt}>{state.result.expiresAt}</time>.</p></div><div className="payments-v2__amount"><p className="payments-v2__amount-label">المبلغ المطلوب عبر بنكك</p><Price className="payments-v2__amount-value" amount={handoff.amount} currency="SDG"/>{equivalent && <p className="payments-v2__equivalent">يعادل <Price amount={equivalent.amount} currency={equivalent.currency}/></p>}{state.result.bookingRef && <p className="payments-v2__amount-note">مرجع الحجز <span className="payments-v2__value" dir="ltr">{state.result.bookingRef}</span></p>}<p className="payments-v2__amount-note">مرجع الدفع: <span className="payments-v2__value" dir="ltr">{handoff.paymentReference}</span></p><p className="payments-v2__amount-note">{handoff.bankAccountDisplayName} — <span className="payments-v2__value" dir="ltr">{handoff.maskedAccountNumber}</span></p></div></div><PaymentStatusCard status={state.result.paymentStatus}/>{handoff.receiptUploadAvailable === true ? <BankakReceiptUpload paymentId={state.result.paymentId} dataSource={receiptDataSource}/> : <p className="payments-v2__muted">رفع الإيصال غير متاح حاليًا. لم يتم تأكيد الدفع أو الحجز.</p>}</section>
  }
  if (state?.status === "psp_handoff") return <section className="selection-notice selection-notice-v2 payments-v2" role="status"><h2 className="payments-v2__title">تم إنشاء طلب الدفع</h2><p className="payments-v2__muted">بانتظار إتمام الدفع الآمن وتأكيده عبر المسار الموثوق.</p>{state.result.handoff.redirectUrl ? <a className="v2-button v2-button--secondary payments-v2__redirect" href={state.result.handoff.redirectUrl} rel="noreferrer">متابعة إلى الدفع الآمن</a> : <p className="payments-v2__muted">جلسة الدفع جاهزة، لكن لا يوجد رابط بوابة خارجي متاح في هذا التشغيل.</p>} {!state.result.handoff.live && <p className="payments-v2__sandbox v2-no-motion">هذه جلسة Sandbox/Mock وليست عملية دفع حية.</p>}<PaymentStatusCard status={state.result.paymentStatus}/><p className="payments-v2__muted">لم يتم تأكيد الدفع أو الحجز.</p></section>
  if (state?.status === "initiating") return <section className="selection-notice selection-notice-v2 payments-v2" role="status" aria-busy="true"><h2 className="payments-v2__title">جارٍ إنشاء طلب الدفع…</h2><p className="payments-v2__muted">لن تتغير حالة الدفع أو الحجز إلى مؤكدة من هذه الخطوة.</p><button className="v2-button v2-button--primary" type="button" aria-busy="true" disabled>جارٍ المتابعة</button></section>
  const failure = { reprice_required: "يلزم إعادة مراجعة السعر قبل الدفع.", intent_expired: "انتهت صلاحية طلب المتابعة.", unavailable: "لم يعد العرض متاحاً.", timeout: "استغرق التحقق أو إنشاء الجلسة وقتاً أطول من المتوقع.", configuration_unavailable: "طريقة الدفع غير مهيأة حالياً.", provider_failed: "تعذر إنشاء جلسة الدفع الآمن.", service_unavailable: "خدمة بدء الدفع غير متاحة مؤقتاً.", auth_required: "يلزم تسجيل الدخول.", conflict: "طلب الدفع مرتبط بمحاولة مختلفة.", validation_error: "طلب الدفع غير صالح.", intent_not_found: "تعذر العثور على طلب المتابعة.", internal_error: "تعذر بدء الدفع حالياً." }[state?.status]
  return <section className="selection-notice selection-notice-v2 payments-v2" aria-labelledby="b12-payment-title"><h2 id="b12-payment-title" className="payments-v2__title">اختر طريقة الدفع</h2><Price className="payments-v2__amount-value" amount={intent.customerPrice.amount} currency={intent.customerPrice.currency}/>{failure && <p className="payments-v2__error v2-no-motion" role="alert">{failure}</p>}<fieldset className="payments-v2__methods" disabled={state?.status === "initiating"}><legend className="payments-v2__methods-legend">طرق الدفع المتاحة</legend><label className="payments-v2__method"><input type="radio" name="flight-payment-method" value="bankak" checked={paymentMethod === "bankak"} onChange={() => setPaymentMethod("bankak")}/> بنكك — تحويل يدوي ومراجعة مالية</label><label className="payments-v2__method"><input type="radio" name="flight-payment-method" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")}/> بطاقة — عبر مزود الدفع الآمن</label></fieldset><div className="payments-v2__actions"><button className="v2-button v2-button--primary" type="button" onClick={() => onInitiate?.(paymentMethod)}>إنشاء طلب الدفع</button><button className="v2-button v2-button--ghost" type="button" onClick={onReturn}>العودة إلى النتائج</button></div><p className="payments-v2__muted">إنشاء طلب الدفع لا يعني أن الدفع مؤكد، ولا يعني أن الحجز مؤكد أو أن التذكرة صدرت.</p></section>
}

export function BookingIntentPanel({ state, checkoutResult, travelerDraft, paymentState, onCreate, onEdit, onAcceptPrice, onInitiatePayment, onReturn }) {
  if (!state || state.status === "idle") return null
  if (state.status === "review") {
    const count = travelerDraft?.travelerData?.travelers?.length ?? 0
    const contact = travelerDraft?.travelerData?.contact
    const fare = checkoutResult.fare
    const itinerary = checkoutResult.itinerary
    return <section className="traveler-card checkout-v2 checkout-review-v2" aria-labelledby="b11-review-title"><header className="checkout-v2__head"><h2 id="b11-review-title">مراجعة طلب المتابعة</h2><p className="checkout-v2__subtitle">ملخص صريح قبل الدفع — بدون سلطة مالية في المتصفح</p></header><div className="checkout-v2__layout"><div className="checkout-v2__details"><section className="checkout-v2__group"><h3>الرحلة</h3><p className="checkout-v2__route" dir="ltr">{itinerary.origin} {itinerary.departureAt?.slice(11, 16)} → {itinerary.destination} {itinerary.arrivalAt?.slice(11, 16)}</p></section><section className="checkout-v2__group"><h3>المسافر</h3><p>عدد المسافرين: {count}</p></section>{fare && <section className="checkout-v2__group"><h3>الأمتعة والشروط</h3><p>{fare.cabin} · {fare.baggage} · {fare.changeability} · {fare.refundability}</p><p className="checkout-v2__muted">تُعرض من العرض الموثوق</p></section>}{contact && <section className="checkout-v2__group"><h3>بيانات التواصل</h3><p dir="ltr">{contact.email}</p><p className="checkout-v2__muted">البريد والهاتف للتحديثات فقط</p></section>}</div><aside className="checkout-v2__summary"><h3 className="checkout-v2__summary-title">إجمالي الرحلة</h3><Price className="checkout-v2__total" amount={checkoutResult.currentCustomerPrice.amount} currency={checkoutResult.currentCustomerPrice.currency}/><p className="checkout-v2__summary-note">السعر يُعتمد من الخادم عند المتابعة</p><p className="checkout-v2__summary-note">سيتم التحقق من السعر والمسافرين مرة أخرى على الخادم قبل إنشاء الطلب.</p><button className="checkout-v2__cta" type="button" onClick={onCreate}>إنشاء طلب المتابعة للدفع</button><button className="checkout-v2__secondary" type="button" onClick={onEdit}>تعديل بيانات المسافرين</button><p className="checkout-v2__summary-note">لم يتم الدفع ولم يتم تأكيد الحجز أو تثبيت مقعد.</p></aside></div></section>
  }
  if (state.status === "creating") return <section className="selection-notice selection-notice-v2" role="status"><h2>جارٍ التحقق وإنشاء طلب المتابعة…</h2><p>لا توجد عملية دفع أو حجز مؤكد.</p><button type="button" onClick={onEdit}>إلغاء وتعديل البيانات</button></section>
  if (state.status === "ready_for_payment") return <PaymentInitiationPanel intent={state.result} state={paymentState} onInitiate={onInitiatePayment} onReturn={onReturn}/>
  if (state.status === "price_changed") return <section className="selection-notice selection-notice-v2 checkout-price-change-v2" role="alert"><h2>تغيّر السعر قبل إنشاء الطلب</h2><p>السعر السابق:</p><Price amount={state.result.previousCustomerPrice.amount} currency={state.result.previousCustomerPrice.currency}/><p>السعر الحالي:</p><Price amount={state.result.customerPrice.amount} currency={state.result.customerPrice.currency}/><button type="button" onClick={() => onAcceptPrice?.(state.result.pricedSelectionId)}>أوافق على السعر الحالي وأعيد إدخال البيانات</button><p>لم يتم إنشاء طلب متابعة من السعر القديم.</p></section>
  const copy = { unavailable: "لم يعد هذا الخيار متاحاً في المخزون الحالي.", service_unavailable: "تعذرت خدمة إعادة التحقق أو حفظ الطلب، ولا يعني ذلك نفاد الرحلة.", timeout: "استغرقت إعادة التحقق وقتاً أطول من المتوقع.", expired: "انتهت صلاحية الاختيار.", conflict: "مفتاح إعادة المحاولة مرتبط ببيانات مختلفة.", auth_required: "يلزم تسجيل الدخول قبل إنشاء طلب المتابعة.", validation_error: "راجع بيانات المسافرين والتواصل.", internal_error: "تعذر إنشاء طلب المتابعة حالياً." }[state.status] ?? "تعذر إنشاء طلب المتابعة حالياً."
  return <section className="selection-notice selection-notice-v2" role="alert"><h2>{copy}</h2><button type="button" onClick={onReturn}>العودة إلى النتائج</button></section>
}

export default function FlightsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = parseFlightQuery(params)
  const [searchState, setSearchState] = useState({ status: "idle" })
  const [repriceState, setRepriceState] = useState({ status: "idle" })
  const [checkoutState, setCheckoutState] = useState({ status: "idle" })
  const [intentState, setIntentState] = useState({ status: "idle" })
  const [paymentState, setPaymentState] = useState({ status: "idle" })
  const [travelerDraft, setTravelerDraft] = useState(null)
  const client = useFlightSearchClientV1()
  const repriceClient = useFlightRepriceClientV1()
  const checkoutClient = useFlightCheckoutClientV1()
  const intentClient = useFlightBookingIntentClientV1()
  const paymentClient = useFlightPaymentInitiationClientV1()
  const request = useMemo(() => { try { return mapFlightSearchRequestV1(parseFlightQuery(params)) } catch { return null } }, [params])
  const requestKey = request ? JSON.stringify(request) : "invalid"
  const coordinator = useMemo(() => client ? createFlightSearchCoordinatorV1({ client, onState: setSearchState }) : null, [client])
  const repriceCoordinator = useMemo(() => repriceClient ? createFlightRepriceCoordinatorV1({ client: repriceClient, onState: setRepriceState }) : null, [repriceClient])
  const checkoutCoordinator = useMemo(() => checkoutClient ? createFlightCheckoutCoordinatorV1({ client: checkoutClient, onState: setCheckoutState }) : null, [checkoutClient])
  const intentCoordinator = useMemo(() => intentClient ? createFlightBookingIntentCoordinatorV1({ client: intentClient, onState: (state) => { setIntentState(state); if (state.status === "ready_for_payment") setTravelerDraft(null) } }) : null, [intentClient])
  const paymentCoordinator = useMemo(() => paymentClient ? createFlightPaymentInitiationCoordinatorV1({ client: paymentClient, onState: setPaymentState }) : null, [paymentClient])
  useEffect(() => {
    if (!request) { setSearchState({ status: "validation_error" }); return }
    if (!coordinator) { setSearchState({ status: "internal_error", request }); return }
    coordinator.search(request)
    return () => coordinator.cancel()
  // requestKey is the immutable submitted query snapshot; coordinator owns cancellation and sequencing.
  }, [coordinator, request, requestKey])
  useEffect(() => { repriceCoordinator?.cancel(); setRepriceState({ status: "idle" }); return () => repriceCoordinator?.cancel() }, [repriceCoordinator, request?.customerCurrency])
  useEffect(() => { checkoutCoordinator?.cancel(); intentCoordinator?.cancel(); paymentCoordinator?.cancel(); setCheckoutState({ status: "idle" }); setIntentState({ status: "idle" }); setPaymentState({ status: "idle" }); setTravelerDraft(null); return () => { checkoutCoordinator?.cancel(); intentCoordinator?.cancel(); paymentCoordinator?.cancel() } }, [checkoutCoordinator, intentCoordinator, paymentCoordinator, requestKey])
  // The legacy fixture-driven customer checkout path is fully retired. The
  // ?view=fare, ?view=traveler and ?view=review query values render nothing of
  // their own and fall through to the canonical V2 results view below, so no
  // fixture fare or fixture traveler identity can reach a customer. The only
  // customer flight path is Search -> Reprice -> B10 Traveler/Checkout ->
  // B11 Booking Intent -> B12 Payment Initiation.
  const retry = () => request && coordinator?.search(request)
  const options = searchState.result ? toFlightResultsViewModelV1(searchState.result) : []
  const hasResults = searchState.status === "success" || searchState.status === "partial"
  const clearIntent = () => { intentCoordinator?.cancel(); paymentCoordinator?.cancel(); setIntentState({ status: "idle" }); setPaymentState({ status: "idle" }); setTravelerDraft(null) }
  const selectAlternative = (alternativeId) => { clearIntent(); return repriceCoordinator ? repriceCoordinator.select({ alternativeId, customerCurrency: request.customerCurrency }) : setRepriceState({ status: "internal_error" }) }
  const prepareCheckout = (pricedSelectionId) => { clearIntent(); return checkoutCoordinator ? checkoutCoordinator.prepare(pricedSelectionId) : setCheckoutState({ status: "internal_error" }) }
  const reviewTravelers = (draft) => { intentCoordinator?.cancel(); setTravelerDraft(draft); setIntentState({ status: "review" }) }
  const createIntent = () => travelerDraft && (intentCoordinator ? intentCoordinator.create(travelerDraft) : setIntentState({ status: "internal_error" }))
  const initiatePayment = (paymentMethod) => intentState.status === "ready_for_payment" && (paymentCoordinator ? paymentCoordinator.initiate({ bookingIntentId: intentState.result.bookingIntentId, paymentMethod }) : setPaymentState({ status: "internal_error" }))
  const returnToResults = () => { clearIntent(); checkoutCoordinator?.cancel(); setCheckoutState({ status: "idle" }) }
  return <div className="flights-page"><Container><FlightsSearchSummary query={searchState.request ?? request ?? query} onEdit={() => navigate("/", { state: { editSearch: true } })}/><header className="flights-title flights-result-header-v2"><h1>رحلات من {query.fromLabel} إلى {query.toLabel}</h1><p>الأسعار المعروضة هي السعر النهائي للعميل بالعملة المختارة</p></header><main className="flights-results flights-results-v2" aria-live="polite"><div className="flights-layout-v2"><FlightsResultsFiltersPanel/><div className="flights-results-v2__list">{["partial", "partial_empty"].includes(searchState.status) && <div className="flight-partial-notice" role="status">بعض النتائج قد لا تكون متاحة حالياً</div>}<ResultsState state={searchState} onRetry={retry}/>{hasResults && checkoutState.status === "idle" && <FlightsResultsSortBar count={options.length}/>}{hasResults && checkoutState.status === "idle" && <div className="flight-card-list flight-card-list-v2">{options.map((offer) => <FlightOfferCard key={offer.alternativeId} offer={offer} onSelect={selectAlternative}/>)}</div>}<RepricePanel state={checkoutState.status === "idle" ? repriceState : { status: "idle" }} onContinue={prepareCheckout}/>{intentState.status === "idle" && <TravelerCheckoutPanel state={checkoutState} onAcceptPrice={prepareCheckout} onReview={reviewTravelers} onBack={returnToResults}/>}<BookingIntentPanel state={intentState} checkoutResult={checkoutState.result} travelerDraft={travelerDraft} paymentState={paymentState} onCreate={createIntent} onEdit={clearIntent} onAcceptPrice={prepareCheckout} onInitiatePayment={initiatePayment} onReturn={returnToResults}/></div></div></main></Container></div>
}
