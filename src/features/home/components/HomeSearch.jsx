import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { SEARCH_SERVICES } from "../data/homeData.js"
import { buildSearchTarget, isSearchableService } from "../data/searchTarget.js"

export function HomeSearch() {
  const navigate = useNavigate()
  const [service, setService] = useState("flights")
  const [tripType, setTripType] = useState("round")
  const [fields, setFields] = useState({ from: "الخرطوم", to: "دبي", departure: "", returnDate: "", travelers: "1" })
  const update = (key, value) => setFields(current => ({ ...current, [key]: value }))
  const swap = () => setFields(current => ({ ...current, from: current.to, to: current.from }))
  const submit = event => { event.preventDefault(); navigate(buildSearchTarget(service, { ...fields, tripType }), { state: { source: "home", synthetic: true } }) }
  const isFlight = service === "flights"
  const isHotel = service === "hotels"
  return <div className="home-search" aria-label="البحث عن خدمات السفر">
    <div className="search-tabs" role="tablist" aria-label="نوع الخدمة">
      {SEARCH_SERVICES.map(item => <button key={item.id} type="button" role="tab" data-service={item.id} aria-selected={service === item.id} className={service === item.id ? "is-active" : ""} onClick={() => setService(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
    </div>
    <form className="search-form" onSubmit={submit}>
      <div className="search-form-heading"><h2>{isHotel ? "بحث الفنادق" : isFlight ? "بحث الرحلات" : `استكشف ${SEARCH_SERVICES.find(item => item.id === service)?.label}`}</h2>{isFlight && <div className="trip-type" role="group" aria-label="نوع الرحلة"><button type="button" className={tripType === "round" ? "is-active" : ""} onClick={() => setTripType("round")}>ذهاب وعودة</button><button type="button" className={tripType === "oneway" ? "is-active" : ""} onClick={() => setTripType("oneway")}>ذهاب فقط</button></div>}</div>
      {(isFlight || isHotel) ? <div className="search-fields">
        <label className="field-origin"><span>{isHotel ? "الوجهة" : "من"}</span><input value={fields.from} onChange={event => update("from", event.target.value)} aria-label={isHotel ? "وجهة الفندق" : "مدينة المغادرة"} /></label>
        <button className="swap-control" type="button" onClick={swap} aria-label="تبديل نقطة المغادرة والوصول">⇄</button>
        <label className="field-destination"><span>{isHotel ? "المدينة أو الفندق" : "إلى"}</span><input value={fields.to} onChange={event => update("to", event.target.value)} aria-label={isHotel ? "المدينة أو الفندق" : "مدينة الوصول"} /></label>
        <label><span>{isHotel ? "الوصول" : "المغادرة"}</span><input type="date" dir="ltr" value={fields.departure} onChange={event => update("departure", event.target.value)} /></label>
        <label><span>{isHotel ? "المغادرة" : "العودة"}</span><input type="date" dir="ltr" disabled={isFlight && tripType === "oneway"} value={fields.returnDate} onChange={event => update("returnDate", event.target.value)} /></label>
        <label><span>{isHotel ? "الغرف والضيوف" : "المسافرون / الدرجة"}</span><select value={fields.travelers} onChange={event => update("travelers", event.target.value)}><option value="1">{isHotel ? "غرفة · ضيفان" : "مسافر · اقتصادية"}</option><option value="2">{isHotel ? "غرفتان · 4 ضيوف" : "مسافران · اقتصادية"}</option></select></label>
      </div> : <div className="search-message"><span>انتقل إلى صفحة الخدمة لاستكشاف المحتوى المتاح.</span></div>}
      <button className="search-submit" type="submit">{isSearchableService(service) ? "ابحث" : "استكشف الخدمة"}</button>
    </form>
  </div>
}
