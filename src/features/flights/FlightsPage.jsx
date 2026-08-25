import { useCallback, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
import { FareSelection } from "./components/FareSelection.jsx"
import { TravelerDetails } from "./components/TravelerDetails.jsx"
import { FlightReview } from "./components/FlightReview.jsx"
import { PaymentMethods } from "./components/PaymentMethods.jsx"
import { PaymentBookingStatus } from "./components/PaymentBookingStatus.jsx"
import { FlightBookingDetail } from "./components/FlightBookingDetail.jsx"
import { resolveBookingDetailState } from "./data/bookingDetailPresentation.js"
import { PAYMENT_STATUS_PRESENTATION_STATES } from "./data/paymentStatusPresentation.js"
import { V1_PAYMENT_METHODS } from "../../services/contracts/paymentContract.js"
import { FeedbackAlert } from "./components/FeedbackAlert.jsx"
import { FlightOfferCard } from "./components/FlightOfferCard.jsx"
import { FlightsFilters } from "./components/FlightsFilters.jsx"
import { FlightsFiltersSheet } from "./components/FlightsFiltersSheet.jsx"
import { FlightsResultsToolbar } from "./components/FlightsResultsToolbar.jsx"
import { FlightsSearchSummary } from "./components/FlightsSearchSummary.jsx"
import { SearchState } from "./components/SearchState.jsx"
import { FLIGHT_FIXTURES } from "./data/flightFixtures.js"
import { parseFlightQuery } from "./data/flightQuery.js"

export default function FlightsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = parseFlightQuery(params)
  const [filters, setFilters] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(null)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const itineraryKey = params.get("itinerary")
  const fareKey = params.get("fare")
  if (params.get("view") === "booking-detail") return <FlightBookingDetail state={resolveBookingDetailState(params.get("state"))}/>
  if (params.get("view") === "payment-status") { const requestedState = params.get("state"); const state = PAYMENT_STATUS_PRESENTATION_STATES.includes(requestedState) ? requestedState : "under_review"; return <PaymentBookingStatus state={state}/> }
  if (params.get("view") === "fare") return <FareSelection itineraryKey={itineraryKey} initialFareKey={fareKey} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}`)} onContinue={(selectedFare) => navigate(`/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(selectedFare)}`)}/>
  if (params.get("view") === "traveler") return <TravelerDetails itineraryKey={itineraryKey} fareKey={fareKey} onBack={() => navigate(`/flights?from=${query.from}&to=${query.to}&view=fare&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`)} onInvalid={() => navigate(`/flights?from=${query.from}&to=${query.to}`)} onReview={(values) => { setReviewDraft(values); navigate(`/flights?from=${query.from}&to=${query.to}&view=review&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`) }}/>
  const travelerTarget = `/flights?from=${query.from}&to=${query.to}&view=traveler&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`
  const reviewTarget = `/flights?from=${query.from}&to=${query.to}&view=review&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}`
  const paymentTarget = (method = "card") => `/flights?from=${query.from}&to=${query.to}&view=payment&itinerary=${encodeURIComponent(itineraryKey)}&fare=${encodeURIComponent(fareKey)}&method=${encodeURIComponent(method)}`
  if (params.get("view") === "review") return <FlightReview itineraryKey={itineraryKey} fareKey={fareKey} draft={reviewDraft} onBack={() => navigate(travelerTarget)} onMissingDraft={() => navigate(travelerTarget)} onPayment={() => navigate(paymentTarget())}/>
  if (params.get("view") === "payment") { const requestedMethod = params.get("method"); const method = V1_PAYMENT_METHODS.includes(requestedMethod) ? requestedMethod : "card"; return <PaymentMethods itineraryKey={itineraryKey} fareKey={fareKey} draft={reviewDraft} selectedMethod={method} onMethodChange={(nextMethod) => navigate(paymentTarget(nextMethod))} onBack={() => navigate(reviewTarget)} onMissingDraft={() => navigate(travelerTarget)}/> }
  const selectItinerary = (key) => navigate(`/flights?from=${query.from}&to=${query.to}&view=fare&itinerary=${encodeURIComponent(key)}`)
  return <div className="flights-page"><Container><FlightsSearchSummary query={query} onEdit={() => navigate("/", { state: { editSearch: true } })}/><header className="flights-title"><h1>رحلات من {query.fromLabel} إلى {query.toLabel}</h1><p>الثلاثاء، 15 سبتمبر · الأسعار المعروضة هي السعر النهائي للعميل بالعملة المختارة</p></header><div className="flights-layout"><aside className="filters-sidebar"><FlightsFilters selected={filters} onChange={setFilters} onClear={() => setFilters([])}/></aside><div className="flights-results"><FlightsResultsToolbar onFilters={() => setSheetOpen(true)}/><FeedbackAlert title="ما زلنا نبحث عن خيارات إضافية">ظهرت النتائج المتاحة الآن. قد نضيف خيارات أخرى تلقائياً أثناء البحث.</FeedbackAlert><div className="flight-card-list">{FLIGHT_FIXTURES.map(offer => <FlightOfferCard key={offer.key} offer={offer} onSelect={selectItinerary}/>)}</div></div></div><section className="state-gallery" aria-label="حالات نتائج البحث"><SearchState state="partial"/><SearchState state="expired"/><SearchState state="empty"/></section></Container><FlightsFiltersSheet open={sheetOpen} onClose={closeSheet} selected={filters} onChange={setFilters} onClear={() => setFilters([])}/></div>
}
