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

const COPY = Object.freeze({
  idle: ["ابدأ البحث", "اختر تفاصيل رحلتك لعرض الخيارات المتاحة."],
  loading: ["نبحث عن أفضل الخيارات المتاحة", "قد يستغرق البحث لحظات قليلة."],
  empty: ["ما لقينا رحلات مطابقة لبحثك", "جرّب تغيير التاريخ أو المطار."],
  unavailable: ["تعذر إكمال البحث حالياً", "حاول مرة أخرى بعد قليل."],
  timeout: ["استغرق البحث وقتاً أطول من المتوقع", "أعد المحاولة."],
  validation_error: ["راجع تفاصيل البحث", "بعض بيانات الرحلة غير صالحة."],
  internal_error: ["حدث خطأ غير متوقع", "حاول مرة أخرى."],
})

function ResultsState({ state, onRetry }) {
  if (state.status === "loading") return <div className="flight-loading" role="status" aria-live="polite"><h2>{COPY.loading[0]}</h2><p>{COPY.loading[1]}</p><div className="flight-card-skeleton" aria-hidden="true"/><div className="flight-card-skeleton" aria-hidden="true"/></div>
  const copy = COPY[state.status]
  if (!copy) return null
  return <section className="flight-results-state" role={state.status === "idle" || state.status === "empty" ? "status" : "alert"}><h2>{copy[0]}</h2><p>{copy[1]}</p>{!["idle", "empty", "validation_error"].includes(state.status) && <button type="button" onClick={onRetry}>إعادة المحاولة</button>}</section>
}

export default function FlightsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = parseFlightQuery(params)
  const [reviewDraft, setReviewDraft] = useState(null)
  const [searchState, setSearchState] = useState({ status: "idle" })
  const [selectedAlternativeId, setSelectedAlternativeId] = useState(null)
  const client = useFlightSearchClientV1()
  const request = useMemo(() => { try { return mapFlightSearchRequestV1(parseFlightQuery(params)) } catch { return null } }, [params])
  const requestKey = request ? JSON.stringify(request) : "invalid"
  const coordinator = useMemo(() => client ? createFlightSearchCoordinatorV1({ client, onState: setSearchState }) : null, [client])
  useEffect(() => {
    if (!request) { setSearchState({ status: "validation_error" }); return }
    if (!coordinator) { setSearchState({ status: "internal_error", request }); return }
    coordinator.search(request)
    return () => coordinator.cancel()
  // requestKey is the immutable submitted query snapshot; coordinator owns cancellation and sequencing.
  }, [coordinator, request, requestKey])
  const itineraryKey = params.get("itinerary")
  const fareKey = params.get("fare")
  if (params.get("view") === "booking-detail") return <FlightBookingDetail state={resolveBookingDetailState(params.get("state"))}/>
  if (params.get("view") === "fare") return <FareSelection itineraryKey={itineraryKey} initialFareKey={fareKey} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}`)} onContinue={(selectedFare) => navigate(`/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(selectedFare)}`)}/>
  if (params.get("view") === "traveler") return <TravelerDetails itineraryKey={itineraryKey} fareKey={fareKey} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}&view=fare&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`)} onInvalid={() => navigate(`/flights?from=${query.from}&to=${query.to}`)} onReview={(values) => { setReviewDraft(values); navigate(`/flights?from=${query.from}&to=${query.to}&view=review&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`) }}/>
  if (params.get("view") === "review") return <FlightReview itineraryKey={itineraryKey} fareKey={fareKey} draft={reviewDraft} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`)} onMissingDraft={() => navigate(`/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`)}/>
  const retry = () => request && coordinator?.search(request)
  const options = searchState.result ? toFlightResultsViewModelV1(searchState.result) : []
  const hasResults = searchState.status === "success" || searchState.status === "partial"
  return <div className="flights-page"><Container><FlightsSearchSummary query={searchState.request ?? request ?? query} onEdit={() => navigate("/", { state: { editSearch: true } })}/><header className="flights-title"><h1>رحلات من {query.fromLabel} إلى {query.toLabel}</h1><p>الأسعار المعروضة هي السعر النهائي للعميل بالعملة المختارة</p></header><main className="flights-results" aria-live="polite">{searchState.status === "partial" && <div className="flight-partial-notice" role="status">بعض النتائج قد لا تكون متاحة حالياً</div>}<ResultsState state={searchState} onRetry={retry}/>{hasResults && <div className="flight-card-list">{options.map((offer) => <FlightOfferCard key={offer.alternativeId} offer={offer} onSelect={setSelectedAlternativeId}/>)}</div>}{selectedAlternativeId && <div className="selection-notice" role="status">تم اختيار الخيار مبدئياً. يلزم التحقق من السعر والتوفر في خطوة إعادة التسعير التالية.</div>}</main></Container></div>
}
