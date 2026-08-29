import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
import { FareSelection } from "./components/FareSelection.jsx"
import { TravelerDetails } from "./components/TravelerDetails.jsx"
import { FlightReview } from "./components/FlightReview.jsx"
import { FlightBookingDetail } from "./components/FlightBookingDetail.jsx"
import { resolveBookingDetailState } from "./data/bookingDetailPresentation.js"
import { FlightOfferCard } from "./components/FlightOfferCard.jsx"
import { FlightsSearchSummary } from "./components/FlightsSearchSummary.jsx"
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
  if (state.status === "loading") return <div className="flight-loading" role="status" aria-live="polite"><h2>{COPY.loading[0]}</h2><p>{COPY.loading[1]}</p><div className="flight-card-skeleton" aria-hidden="true"/><div className="flight-card-skeleton" aria-hidden="true"/></div>
  const copy = COPY[state.status]
  if (!copy) return null
  return <section className="flight-results-state" role={state.status === "idle" || state.status === "empty" ? "status" : "alert"}><h2>{copy[0]}</h2><p>{copy[1]}</p>{!["idle", "empty", "validation_error"].includes(state.status) && <button type="button" onClick={onRetry}>إعادة المحاولة</button>}</section>
}

export function RepricePanel({ state, onContinue }) {
  if (!state || state.status === "idle") return null
  if (state.status === "repricing") return <section className="selection-notice" role="status">جارٍ التحقق من السعر والتوفر الحاليين…</section>
  if (state.status === "price_changed") return <section className="selection-notice" role="alert"><h2>تغيّر السعر</h2><p>راجع السعر الحالي قبل المتابعة.</p><Price amount={state.result.currentCustomerPrice.amount} currency={state.result.currentCustomerPrice.currency}/><button type="button" onClick={() => onContinue?.(state.result.pricedSelectionId)}>أوافق على السعر الحالي</button></section>
  if (state.status === "available") return <section className="selection-notice" role="status"><h2>السعر والتوفر محدثان</h2><Price amount={state.result.currentCustomerPrice.amount} currency={state.result.currentCustomerPrice.currency}/><button type="button" onClick={() => onContinue?.(state.result.pricedSelectionId)}>جاهز للمتابعة إلى بيانات المسافر</button><p>لم يتم إنشاء حجز أو تثبيت مقعد.</p></section>
  const copy = { unavailable: "لم يعد هذا الخيار متاحاً", expired: "انتهت صلاحية هذا الاختيار", timeout: "استغرق التحقق وقتاً أطول من المتوقع", validation_error: "تعذر التحقق من الاختيار", internal_error: "تعذر التحقق من السعر حالياً" }[state.status] ?? "تعذر التحقق من السعر حالياً"
  return <section className="selection-notice" role="alert"><h2>{copy}</h2><p>أعد اختيار الرحلة أو حاول مرة أخرى.</p></section>
}

export function TravelerCheckoutPanel({ state, onBack, onAcceptPrice, onReview }) {
  const [feedback, setFeedback] = useState("")
  useEffect(() => setFeedback(""), [state?.result?.pricedSelectionId])
  if (!state || state.status === "idle") return null
  if (state.status === "preparing") return <section className="selection-notice" role="status">جارٍ إعادة التحقق من السعر قبل بيانات المسافرين…</section>
  if (state.status === "price_changed") return <section className="selection-notice" role="alert"><h2>تغيّر السعر بعد إعادة التحقق</h2><p>السعر السابق:</p><Price amount={state.result.previousCustomerPrice.amount} currency={state.result.previousCustomerPrice.currency}/><p>السعر الحالي:</p><Price amount={state.result.currentCustomerPrice.amount} currency={state.result.currentCustomerPrice.currency}/><button type="button" onClick={() => onAcceptPrice?.(state.result.pricedSelectionId)}>أوافق على السعر الحالي وأعيد التحقق</button><button type="button" onClick={onBack}>العودة إلى النتائج</button><p>لن نعرض نموذج المسافرين قبل قبول السعر الحالي.</p></section>
  if (state.status !== "ready") { const copy = { unavailable: "لم يعد هذا الخيار متاحاً في المخزون الحالي.", service_unavailable: "تعذر الاتصال بخدمة إعادة التسعير حالياً، ولا يعني ذلك نفاد الرحلة.", expired: "انتهت صلاحية الاختيار.", timeout: "استغرق التحقق وقتاً أطول من المتوقع." }[state.status] ?? "تعذر تجهيز بيانات المسافرين حالياً."; return <section className="selection-notice" role="alert"><h2>{copy}</h2><button type="button" onClick={onBack}>العودة إلى النتائج</button></section> }
  const { expectedPassengers, itinerary, currentCustomerPrice } = state.result
  const types = [["ADT", expectedPassengers.ADT, "بالغ"], ["CHD", expectedPassengers.CHD, "طفل"], ["INF", expectedPassengers.INF, "رضيع"]]
  const submit = (event) => { event.preventDefault(); if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); setFeedback("راجع الحقول المطلوبة قبل المتابعة."); return } try { const values = new FormData(event.currentTarget); const travelerData = toFlightTravelerDataV1({ read: (name) => values.get(name), expectedPassengers }); setFeedback("تم تجهيز البيانات للمراجعة. لم يتم إنشاء حجز أو دفع أو تثبيت مقعد."); onReview?.({ pricedSelectionId: state.result.pricedSelectionId, travelerData }) } catch { setFeedback("راجع بيانات المسافرين والتواصل قبل المتابعة.") } }
  return <section className="traveler-card" aria-labelledby="b10-travelers-title"><button type="button" onClick={onBack}>العودة إلى النتائج</button><h2 id="b10-travelers-title">بيانات المسافرين</h2><p dir="ltr">{itinerary.origin} → {itinerary.destination}</p><Price amount={currentCustomerPrice.amount} currency={currentCustomerPrice.currency}/><p>السعر والتوفر أُعيدا التحقق منهما قبل عرض هذه الحقول.</p><form onSubmit={submit}>{types.flatMap(([type, count, label]) => Array.from({ length: count }, (_, index) => { const prefix = `travelers-${type}-${index}`; const titles = type === "ADT" ? [["MR", "السيد"], ["MS", "الآنسة"], ["MRS", "السيدة"]] : [[type, label]]; return <fieldset key={prefix}><legend>{label} {index + 1}</legend><input type="hidden" name={`${prefix}-travelerKey`} value={`${type.toLowerCase()}-${index + 1}`}/><input type="hidden" name={`${prefix}-travelerType`} value={type}/><label>اللقب<select name={`${prefix}-title`} required>{titles.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label>الاسم الأول<input name={`${prefix}-firstName`} maxLength="70" required/></label><label>الاسم الأوسط (اختياري)<input name={`${prefix}-middleName`} maxLength="70"/></label><label>اسم العائلة<input name={`${prefix}-lastName`} maxLength="70" required/></label><label>تاريخ الميلاد<input name={`${prefix}-dateOfBirth`} type="date" required/></label><input type="hidden" name={`${prefix}-documentType`} value="PASSPORT"/><label>رقم جواز السفر<input name={`${prefix}-documentNumber`} maxLength="30" pattern="[A-Za-z0-9-]+" required/></label><label>بلد الإصدار<input name={`${prefix}-issuingCountry`} maxLength="2" pattern="[A-Z]{2}" required/></label><label>الجنسية<input name={`${prefix}-nationality`} maxLength="2" pattern="[A-Z]{2}" required/></label><label>انتهاء الجواز<input name={`${prefix}-expiryDate`} type="date" required/></label></fieldset> }))}<fieldset><legend>بيانات التواصل للحجز</legend><label>البريد الإلكتروني<input type="email" name="contact-email" maxLength="254" required/></label><label>رمز الدولة<input name="contact-phoneCountryCode" maxLength="5" pattern="\+[1-9][0-9]{0,3}" required/></label><label>رقم الهاتف<input type="tel" name="contact-phoneNumber" minLength="6" maxLength="15" pattern="[0-9]+" required/></label></fieldset><button type="submit">متابعة إلى مراجعة الحجز</button></form>{feedback && <p role="status">{feedback}</p>}</section>
}

export function PaymentInitiationPanel({ intent, state, onInitiate, onReturn }) {
  const [paymentMethod, setPaymentMethod] = useState("bankak")
  useEffect(() => setPaymentMethod("bankak"), [intent?.bookingIntentId])
  if (!intent) return null
  if (state?.status === "bankak_handoff") return <section className="selection-notice" role="status"><h2>تم إنشاء طلب الدفع</h2><p>بانتظار إتمام التحويل ومراجعته من فريق المالية.</p><Price amount={state.result.handoff.amount} currency="SDG"/><p>مرجع الدفع: <span dir="ltr">{state.result.handoff.paymentReference}</span></p><p>{state.result.handoff.bankAccountDisplayName} — <span dir="ltr">{state.result.handoff.maskedAccountNumber}</span></p><p>ينتهي طلب الدفع في <time dateTime={state.result.expiresAt}>{state.result.expiresAt}</time>.</p><p>رفع الإيصال غير موصول في هذه الشاشة بعد. لم يتم تأكيد الدفع أو الحجز.</p></section>
  if (state?.status === "psp_handoff") return <section className="selection-notice" role="status"><h2>تم إنشاء طلب الدفع</h2><p>بانتظار إتمام الدفع الآمن وتأكيده عبر المسار الموثوق.</p>{state.result.handoff.redirectUrl ? <a href={state.result.handoff.redirectUrl} rel="noreferrer">متابعة إلى الدفع الآمن</a> : <p>جلسة الدفع جاهزة، لكن لا يوجد رابط بوابة خارجي متاح في هذا التشغيل.</p>} {!state.result.handoff.live && <p>هذه جلسة Sandbox/Mock وليست عملية دفع حية.</p>}<p>لم يتم تأكيد الدفع أو الحجز.</p></section>
  if (state?.status === "initiating") return <section className="selection-notice" role="status"><h2>جارٍ إنشاء طلب الدفع…</h2><p>لن تتغير حالة الدفع أو الحجز إلى مؤكدة من هذه الخطوة.</p><button type="button" disabled>جارٍ المتابعة</button></section>
  const failure = { reprice_required: "يلزم إعادة مراجعة السعر قبل الدفع.", intent_expired: "انتهت صلاحية طلب المتابعة.", unavailable: "لم يعد العرض متاحاً.", timeout: "استغرق التحقق أو إنشاء الجلسة وقتاً أطول من المتوقع.", configuration_unavailable: "طريقة الدفع غير مهيأة حالياً.", provider_failed: "تعذر إنشاء جلسة الدفع الآمن.", service_unavailable: "خدمة بدء الدفع غير متاحة مؤقتاً.", auth_required: "يلزم تسجيل الدخول.", conflict: "طلب الدفع مرتبط بمحاولة مختلفة.", validation_error: "طلب الدفع غير صالح.", intent_not_found: "تعذر العثور على طلب المتابعة.", internal_error: "تعذر بدء الدفع حالياً." }[state?.status]
  return <section className="selection-notice" aria-labelledby="b12-payment-title"><h2 id="b12-payment-title">اختر طريقة الدفع</h2><Price amount={intent.customerPrice.amount} currency={intent.customerPrice.currency}/>{failure && <p role="alert">{failure}</p>}<fieldset disabled={state?.status === "initiating"}><legend>طرق الدفع المتاحة</legend><label><input type="radio" name="flight-payment-method" value="bankak" checked={paymentMethod === "bankak"} onChange={() => setPaymentMethod("bankak")}/> بنكك — تحويل يدوي ومراجعة مالية</label><label><input type="radio" name="flight-payment-method" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")}/> بطاقة — عبر مزود الدفع الآمن</label></fieldset><button type="button" onClick={() => onInitiate?.(paymentMethod)}>إنشاء طلب الدفع</button><button type="button" onClick={onReturn}>العودة إلى النتائج</button><p>إنشاء طلب الدفع لا يعني أن الدفع مؤكد، ولا يعني أن الحجز مؤكد أو أن التذكرة صدرت.</p></section>
}

export function BookingIntentPanel({ state, checkoutResult, travelerDraft, paymentState, onCreate, onEdit, onAcceptPrice, onInitiatePayment, onReturn }) {
  if (!state || state.status === "idle") return null
  if (state.status === "review") { const count = travelerDraft?.travelerData?.travelers?.length ?? 0; return <section className="traveler-card" aria-labelledby="b11-review-title"><h2 id="b11-review-title">مراجعة طلب المتابعة</h2><p dir="ltr">{checkoutResult.itinerary.origin} → {checkoutResult.itinerary.destination}</p><Price amount={checkoutResult.currentCustomerPrice.amount} currency={checkoutResult.currentCustomerPrice.currency}/><p>عدد المسافرين: {count}</p><p>سيتم التحقق من السعر والمسافرين مرة أخرى على الخادم قبل إنشاء الطلب.</p><button type="button" onClick={onCreate}>إنشاء طلب المتابعة للدفع</button><button type="button" onClick={onEdit}>تعديل بيانات المسافرين</button><p>لم يتم الدفع ولم يتم تأكيد الحجز أو تثبيت مقعد.</p></section> }
  if (state.status === "creating") return <section className="selection-notice" role="status"><h2>جارٍ التحقق وإنشاء طلب المتابعة…</h2><p>لا توجد عملية دفع أو حجز مؤكد.</p><button type="button" onClick={onEdit}>إلغاء وتعديل البيانات</button></section>
  if (state.status === "ready_for_payment") return <PaymentInitiationPanel intent={state.result} state={paymentState} onInitiate={onInitiatePayment} onReturn={onReturn}/>
  if (state.status === "price_changed") return <section className="selection-notice" role="alert"><h2>تغيّر السعر قبل إنشاء الطلب</h2><p>السعر السابق:</p><Price amount={state.result.previousCustomerPrice.amount} currency={state.result.previousCustomerPrice.currency}/><p>السعر الحالي:</p><Price amount={state.result.customerPrice.amount} currency={state.result.customerPrice.currency}/><button type="button" onClick={() => onAcceptPrice?.(state.result.pricedSelectionId)}>أوافق على السعر الحالي وأعيد إدخال البيانات</button><p>لم يتم إنشاء طلب متابعة من السعر القديم.</p></section>
  const copy = { unavailable: "لم يعد هذا الخيار متاحاً في المخزون الحالي.", service_unavailable: "تعذرت خدمة إعادة التحقق أو حفظ الطلب، ولا يعني ذلك نفاد الرحلة.", timeout: "استغرقت إعادة التحقق وقتاً أطول من المتوقع.", expired: "انتهت صلاحية الاختيار.", conflict: "مفتاح إعادة المحاولة مرتبط ببيانات مختلفة.", auth_required: "يلزم تسجيل الدخول قبل إنشاء طلب المتابعة.", validation_error: "راجع بيانات المسافرين والتواصل.", internal_error: "تعذر إنشاء طلب المتابعة حالياً." }[state.status] ?? "تعذر إنشاء طلب المتابعة حالياً."
  return <section className="selection-notice" role="alert"><h2>{copy}</h2><button type="button" onClick={onReturn}>العودة إلى النتائج</button></section>
}

export default function FlightsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = parseFlightQuery(params)
  const [reviewDraft, setReviewDraft] = useState(null)
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
  const itineraryKey = params.get("itinerary")
  const fareKey = params.get("fare")
  if (params.get("view") === "booking-detail") return <FlightBookingDetail state={resolveBookingDetailState(params.get("state"))}/>
  if (params.get("view") === "fare") return <FareSelection itineraryKey={itineraryKey} initialFareKey={fareKey} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}`)} onContinue={(selectedFare) => navigate(`/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(selectedFare)}`)}/>
  if (params.get("view") === "traveler") return <TravelerDetails itineraryKey={itineraryKey} fareKey={fareKey} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}&view=fare&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`)} onInvalid={() => navigate(`/flights?from=${query.from}&to=${query.to}`)} onReview={(values) => { setReviewDraft(values); navigate(`/flights?from=${query.from}&to=${query.to}&view=review&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`) }}/>
  if (params.get("view") === "review") return <FlightReview itineraryKey={itineraryKey} fareKey={fareKey} draft={reviewDraft} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`)} onMissingDraft={() => navigate(`/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`)}/>
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
  return <div className="flights-page"><Container><FlightsSearchSummary query={searchState.request ?? request ?? query} onEdit={() => navigate("/", { state: { editSearch: true } })}/><header className="flights-title"><h1>رحلات من {query.fromLabel} إلى {query.toLabel}</h1><p>الأسعار المعروضة هي السعر النهائي للعميل بالعملة المختارة</p></header><main className="flights-results" aria-live="polite">{["partial", "partial_empty"].includes(searchState.status) && <div className="flight-partial-notice" role="status">بعض النتائج قد لا تكون متاحة حالياً</div>}<ResultsState state={searchState} onRetry={retry}/>{hasResults && checkoutState.status === "idle" && <div className="flight-card-list">{options.map((offer) => <FlightOfferCard key={offer.alternativeId} offer={offer} onSelect={selectAlternative}/>)}</div>}<RepricePanel state={checkoutState.status === "idle" ? repriceState : { status: "idle" }} onContinue={prepareCheckout}/>{intentState.status === "idle" && <TravelerCheckoutPanel state={checkoutState} onAcceptPrice={prepareCheckout} onReview={reviewTravelers} onBack={returnToResults}/>}<BookingIntentPanel state={intentState} checkoutResult={checkoutState.result} travelerDraft={travelerDraft} paymentState={paymentState} onCreate={createIntent} onEdit={clearIntent} onAcceptPrice={prepareCheckout} onInitiatePayment={initiatePayment} onReturn={returnToResults}/></main></Container></div>
}
