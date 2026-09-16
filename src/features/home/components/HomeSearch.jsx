import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { SEARCH_SERVICES } from "../data/homeData.js"
import { createCustomLocation, DEFAULT_FLIGHT_LOCATIONS, locationSearchValue } from "../data/locations.js"
import { buildSearchTarget, isSearchableService } from "../data/searchTarget.js"

/**
 * HAJIZ V2 Signature Search - Figma node 15:2 (desktop) / 16:49 (mobile).
 *
 * PRESENTATION ONLY. This is an entry point over the existing flight flow:
 * the service list, location model, target builder and route transition are
 * unchanged from V1, so no second search state model, HTTP client or flight
 * contract is introduced. Submitting still navigates to the canonical
 * /flights?from=..&to=.. query that FlightsPage already parses.
 */
export function HomeSearch() {
  const navigate = useNavigate()
  const [service, setService] = useState("flights")
  const [tripType, setTripType] = useState("round")
  const [fields, setFields] = useState({ ...DEFAULT_FLIGHT_LOCATIONS, departure: "", returnDate: "", travelers: "1" })
  const update = (key, value) => setFields(current => ({ ...current, [key]: value }))
  const swap = () => setFields(current => ({ ...current, from: current.to, to: current.from }))
  const submit = event => { event.preventDefault(); navigate(buildSearchTarget(service, { ...fields, from: locationSearchValue(fields.from), to: locationSearchValue(fields.to), tripType }), { state: { source: "home", synthetic: true } }) }
  const isFlight = service === "flights"
  const isHotel = service === "hotels"
  const returnDisabled = isFlight && tripType === "oneway"

  return <div className="home-search home-search-v2" aria-label="البحث عن خدمات السفر">
    <div className="search-tabs home-search-v2__tabs" role="tablist" aria-label="نوع الخدمة">
      {SEARCH_SERVICES.map(item => <button key={item.id} type="button" role="tab" data-service={item.id} aria-selected={service === item.id} className={`home-search-v2__tab${service === item.id ? " is-active" : ""}`} onClick={() => setService(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
    </div>
    <form className="search-form home-search-v2__form" onSubmit={submit}>
      <div className="search-form-heading home-search-v2__heading"><h2>{isHotel ? "بحث الفنادق" : isFlight ? "بحث الرحلات" : `استكشف ${SEARCH_SERVICES.find(item => item.id === service)?.label}`}</h2>{isFlight && <div className="trip-type home-search-v2__trip" role="group" aria-label="نوع الرحلة"><button type="button" className={tripType === "round" ? "is-active" : ""} onClick={() => setTripType("round")}>ذهاب وعودة</button><button type="button" className={tripType === "oneway" ? "is-active" : ""} onClick={() => setTripType("oneway")}>ذهاب فقط</button></div>}</div>
      {(isFlight || isHotel) ? <div className="search-fields home-search-v2__fields">
        <label className="field-origin home-search-v2__field"><span className="home-search-v2__label">{isHotel ? "الوجهة" : "من"}</span><input className="home-search-v2__value" value={fields.from.label} onChange={event => update("from", createCustomLocation(event.target.value))} aria-label={isHotel ? "وجهة الفندق" : "مدينة المغادرة"} /></label>
        <button className="swap-control home-search-v2__swap" type="button" onClick={swap} aria-label="تبديل نقطة المغادرة والوصول">⇄</button>
        <label className="field-destination home-search-v2__field"><span className="home-search-v2__label">{isHotel ? "المدينة أو الفندق" : "إلى"}</span><input className="home-search-v2__value" value={fields.to.label} onChange={event => update("to", createCustomLocation(event.target.value))} aria-label={isHotel ? "المدينة أو الفندق" : "مدينة الوصول"} /></label>
        <label className="home-search-v2__field"><span className="home-search-v2__label">{isHotel ? "الوصول" : "المغادرة"}</span><input className="home-search-v2__value" type="date" dir="ltr" value={fields.departure} onChange={event => update("departure", event.target.value)} /></label>
        <label className="home-search-v2__field" data-disabled={returnDisabled ? "true" : "false"}><span className="home-search-v2__label">{isHotel ? "المغادرة" : "العودة"}</span><input className="home-search-v2__value" type="date" dir="ltr" disabled={returnDisabled} value={fields.returnDate} onChange={event => update("returnDate", event.target.value)} /></label>
        <label className="home-search-v2__field"><span className="home-search-v2__label">{isHotel ? "الغرف والضيوف" : "المسافرون / الدرجة"}</span><select className="home-search-v2__value" value={fields.travelers} onChange={event => update("travelers", event.target.value)}><option value="1">{isHotel ? "غرفة · ضيفان" : "مسافر · اقتصادية"}</option><option value="2">{isHotel ? "غرفتان · 4 ضيوف" : "مسافران · اقتصادية"}</option></select></label>
      </div> : <div className="search-message home-search-v2__message"><span>انتقل إلى صفحة الخدمة لاستكشاف المحتوى المتاح.</span></div>}
      <button className="search-submit home-search-v2__submit" type="submit">{isSearchableService(service) ? "ابحث" : "استكشف الخدمة"}</button>
      <p className="home-search-v2__note">عرض مباشر للسعر النهائي قبل المتابعة — لا رسوم مخفية في الواجهة</p>
    </form>
  </div>
}
