import { useCallback, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
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
  const [selection, setSelection] = useState("")
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  return <div className="flights-page"><Container><FlightsSearchSummary query={query} onEdit={() => navigate("/", { state: { editSearch: true } })}/><header className="flights-title"><h1>رحلات من {query.fromLabel} إلى {query.toLabel}</h1><p>الثلاثاء، 15 سبتمبر · الأسعار المعروضة هي السعر النهائي للعميل بالعملة المختارة</p></header><div className="flights-layout"><aside className="filters-sidebar"><FlightsFilters selected={filters} onChange={setFilters} onClear={() => setFilters([])}/></aside><div className="flights-results"><FlightsResultsToolbar onFilters={() => setSheetOpen(true)}/><FeedbackAlert title="ما زلنا نبحث عن خيارات إضافية">ظهرت النتائج المتاحة الآن. قد نضيف خيارات أخرى تلقائياً أثناء البحث.</FeedbackAlert><div className="flight-card-list">{FLIGHT_FIXTURES.map(offer => <FlightOfferCard key={offer.key} offer={offer} onSelect={setSelection}/>)}</div>{selection && <p className="selection-feedback" role="status">تم اختيار الخيار التجريبي للمتابعة في المهمة القادمة.</p>}</div></div><section className="state-gallery" aria-label="حالات نتائج البحث"><SearchState state="partial"/><SearchState state="expired"/><SearchState state="empty"/></section></Container><FlightsFiltersSheet open={sheetOpen} onClose={closeSheet} selected={filters} onChange={setFilters} onClear={() => setFilters([])}/></div>
}
