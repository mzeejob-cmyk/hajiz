import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { PaymentStatusBadge } from "../../flights/components/PaymentStatusBadge.jsx"
import { myTripsDataSource } from "../../../services/myTripsDataSource.js"

export function MyTripsPage({ dataSource = myTripsDataSource }) {
  const [request,setRequest]=useState({status:"loading",trips:[]}),[ticketDetails,setTicketDetails]=useState({}),[attempt,setAttempt]=useState(0)
  useEffect(()=>{let active=true;setRequest({status:"loading",trips:[]});dataSource.load().then(trips=>active&&setRequest({status:"success",trips})).catch(()=>active&&setRequest({status:"error",trips:[]}));return()=>{active=false}},[dataSource,attempt])
  const tickets = trip => {
    setTicketDetails(current => ({ ...current, [trip.reference]: { status: "loading", rows: [] } }))
    dataSource.loadTicketDetails(trip.reference)
      .then(rows => setTicketDetails(current => ({ ...current, [trip.reference]: { status: "success", rows } })))
      .catch(() => setTicketDetails(current => ({ ...current, [trip.reference]: { status: "error", rows: [] } })))
  }
  return <div className="my-trips-page" dir="rtl" data-view="my-trips" data-authority="authenticated-rpc"><Container><header className="trips-heading"><div><span>الحساب</span><h1>حجوزاتي</h1><p>تابع حالة الحجز والدفع كلٌ على حدة.</p></div><span className="presentation-fixture-label">بيانات حسابك المحمية</span></header>
    {request.status==="loading"?<section role="status" data-state="loading"><h2>جارٍ تحميل حجوزاتك</h2></section>:request.status==="error"?<section role="alert" data-state="error"><h2>تعذر عرض الحجوزات</h2><button onClick={()=>setAttempt(v=>v+1)}>إعادة المحاولة</button></section>:request.trips.length===0?<section data-state="empty"><h2>لا توجد حجوزات بعد</h2><Link to="/flights">استكشف الرحلات</Link></section>:<div className="trip-list">{request.trips.map(trip=><article className="trip-card" key={trip.key} data-booking-state={trip.bookingState} data-ticketing-state={trip.ticketingState}><div className="trip-card__top"><div className="payment-status-badges"><PaymentStatusBadge domain="payment" status={trip.paymentState}/><PaymentStatusBadge domain="booking" status={trip.bookingState}/></div><span className="trip-reference" dir="ltr">{trip.reference}</span></div><div className="trip-card__body"><div><h2>حجز رحلة</h2><p>أُنشئ في {new Intl.DateTimeFormat("ar",{dateStyle:"medium"}).format(new Date(trip.createdAt))}</p><p>{trip.ticketingLabel}</p><small>{trip.amount??"—"} {trip.currency} · طريقة الدفع: {trip.paymentMethod}</small><Link to={`/bookings/${encodeURIComponent(trip.reference)}`}>تفاصيل الحجز</Link>{trip.canViewTicketDetails&&<button onClick={()=>tickets(trip)}>عرض بيانات التذكرة</button>}{ticketDetails[trip.reference]?.status==="loading"&&<small role="status">جارٍ تحميل بيانات التذكرة</small>}{ticketDetails[trip.reference]?.status==="error"&&<small role="alert">تعذر تحميل بيانات التذكرة</small>}{ticketDetails[trip.reference]?.status==="success"&&<ul>{ticketDetails[trip.reference].rows.map(ticket=><li key={ticket.ticketNumber}>{ticket.ticketNumber} · {ticket.artifactAvailability==="AVAILABLE"?"المستند متاح عبر خدمة التنزيل الموثوقة":"بيانات التذكرة متاحة، ولا يوجد مستند قابل للتنزيل"}</li>)}</ul>}</div><span aria-disabled="true">{trip.canDownloadTicket?"التنزيل يتطلب خدمة المستندات الموثوقة":"تحميل التذكرة غير متاح"}</span></div></article>)}</div>}
  </Container></div>
}
