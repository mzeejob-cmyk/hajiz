import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { Skeleton } from "../../../design-system/primitives/Skeleton.jsx"
import { myTripsDataSource } from "../../../services/myTripsDataSource.js"
import { TripTabs } from "./TripTabs.jsx"
import { TripWalletCard } from "./TripWalletCard.jsx"

/**
 * HAJIZ V2 My Trips — Figma node 17:145 and descendants.
 *
 * Presentation migration only. Every value comes from the existing trusted
 * myTripsDataSource, which reads the authenticated owner-scoped RPCs. Nothing
 * here polls, subscribes, caches a status or derives one.
 *
 * Payment and booking remain two independent indicators: a confirmed payment
 * never renders as a confirmed supplier booking. Ticket and document
 * availability come only from the trusted ticketing fields, so a supplier
 * reference or a confirmed payment can never enable a download.
 *
 * The canonical route and traveler-count line from node 17:154 is deliberately
 * not rendered: get_my_bookings does not return either, and inventing them
 * would fabricate trip facts.
 */
export function MyTripsPage({ dataSource = myTripsDataSource }) {
  const [request,setRequest]=useState({status:"loading",trips:[]}),[ticketDetails,setTicketDetails]=useState({}),[attempt,setAttempt]=useState(0)
  useEffect(()=>{let active=true;setRequest({status:"loading",trips:[]});dataSource.load().then(trips=>active&&setRequest({status:"success",trips})).catch(()=>active&&setRequest({status:"error",trips:[]}));return()=>{active=false}},[dataSource,attempt])
  const tickets = trip => {
    setTicketDetails(current => ({ ...current, [trip.reference]: { status: "loading", rows: [] } }))
    dataSource.loadTicketDetails(trip.reference)
      .then(rows => setTicketDetails(current => ({ ...current, [trip.reference]: { status: "success", rows } })))
      .catch(() => setTicketDetails(current => ({ ...current, [trip.reference]: { status: "error", rows: [] } })))
  }
  return <div className="my-trips-page trips-v2" dir="rtl" data-view="my-trips" data-authority="authenticated-rpc"><Container>
    <header className="trips-heading trips-v2__heading"><p className="trips-v2__eyebrow">الحساب</p><h1 className="trips-v2__title">رحلاتي</h1><p className="trips-v2__subtitle">تابع حالة الحجز والدفع كلٌ على حدة.</p><p className="trips-v2__subtitle">بيانات حسابك المحمية</p></header>
    <TripTabs/>
    {request.status==="loading"?<section className="trips-v2__state" role="status" data-state="loading"><h2 className="trips-v2__state-title">جارٍ تحميل حجوزاتك</h2><Skeleton variant="block" className="trips-v2__skeleton"/><Skeleton variant="block" className="trips-v2__skeleton"/></section>
    :request.status==="error"?<section className="trips-v2__state trips-v2__state--error v2-no-motion" role="alert" data-state="error"><h2 className="trips-v2__state-title">تعذر عرض الحجوزات</h2><button className="v2-button v2-button--primary" type="button" onClick={()=>setAttempt(v=>v+1)}>إعادة المحاولة</button></section>
    :request.trips.length===0?<section className="trips-v2__state" data-state="empty"><h2 className="trips-v2__state-title">لا توجد حجوزات بعد</h2><Link className="v2-button v2-button--secondary" to="/flights">استكشف الرحلات</Link></section>
    :<div className="trip-list trips-v2__list">{request.trips.map(trip=><TripWalletCard key={trip.key} trip={trip} detail={ticketDetails[trip.reference]} detailHref={`/bookings/${encodeURIComponent(trip.reference)}`} onLoadTickets={tickets}/>)}</div>}
  </Container></div>
}
