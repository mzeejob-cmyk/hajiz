import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { PaymentStatusBadge } from "../flights/components/PaymentStatusBadge.jsx"
import { myTripsDataSource } from "../../services/myTripsDataSource.js"
import { createTicketRequestGuard, hasAuthoritativeAmount } from "./data/ticketRequestGuard.js"

export default function BookingPage({ dataSource = myTripsDataSource }) {
  const { reference = "" } = useParams()
  const valid = /^HJZ-[A-Z0-9-]{4,40}$/.test(reference)
  const [attempt, setAttempt] = useState(0)
  const [request, setRequest] = useState({ status: valid ? "loading" : "invalid_reference", booking: null })
  const [tickets, setTickets] = useState({ reference, status: "idle", rows: [] })
  const ticketGuard = useRef(createTicketRequestGuard(reference))
  if (!ticketGuard.current.isActiveReference(reference)) ticketGuard.current.activate(reference)
  const visibleTickets = tickets.reference === reference ? tickets : { reference, status: "idle", rows: [] }
  useEffect(() => {
    ticketGuard.current.activate(reference)
    setTickets({ reference, status: "idle", rows: [] })
    if (!valid) { setRequest({ status: "invalid_reference", booking: null }); return }
    let active = true
    setRequest({ status: "loading", booking: null })
    dataSource.loadBooking(reference).then(booking => { if (active) setRequest({ status: booking ? "ready" : "not_found", booking }) }).catch(() => { if (active) setRequest({ status: "error", booking: null }) })
    return () => { active = false }
  }, [attempt, dataSource, reference, valid])
  if (request.status === "invalid_reference") return <section role="alert">مرجع الحجز غير صالح.</section>
  if (request.status === "loading") return <section role="status">جارٍ تحميل تفاصيل الحجز الآمنة…</section>
  if (request.status === "not_found") return <section role="status">تعذر العثور على هذا الحجز ضمن حجوزات حسابك.</section>
  if (request.status === "error") return <section role="alert"><p>تعذر تحميل تفاصيل الحجز.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></section>
  const booking = request.booking
  const loadTickets = () => {
    const request = ticketGuard.current.begin(reference)
    setTickets({ reference, status: "loading", rows: [] })
    dataSource.loadTicketDetails(reference)
      .then(rows => { if (ticketGuard.current.accepts(request)) setTickets({ reference, status: "success", rows }) })
      .catch(() => { if (ticketGuard.current.accepts(request)) setTickets({ reference, status: "error", rows: [] }) })
  }
  return <main data-booking-detail="owner-scoped-read">
    <h1>تفاصيل الحجز</h1><bdi dir="ltr">{booking.reference}</bdi>
    <div><PaymentStatusBadge domain="booking" status={booking.bookingState}/><PaymentStatusBadge domain="payment" status={booking.paymentState}/></div>
    <p>أُنشئ في <time dateTime={booking.createdAt}>{new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(booking.createdAt))}</time></p>
    {hasAuthoritativeAmount(booking.amount) && <p><bdi dir="ltr">{booking.amount} {booking.currency}</bdi></p>}<p>طريقة الدفع: <bdi>{booking.paymentMethod}</bdi></p><p>{booking.ticketingLabel}</p>
    {booking.reconciliationRequired && <p role="alert">حالة الحجز أو التذكرة تتطلب مراجعة.</p>}
    {booking.canDownloadTicket && <p>مستند التذكرة الموثوق متاح، وخدمة تنزيل الملف غير مهيأة.</p>}
    {booking.canViewTicketDetails && visibleTickets.status === "idle" && <button type="button" onClick={loadTickets}>عرض بيانات التذكرة</button>}
    {visibleTickets.status === "loading" && <p role="status">جارٍ تحميل بيانات التذكرة…</p>}{visibleTickets.status === "error" && <p role="alert">تعذر تحميل بيانات التذكرة.</p>}
    {visibleTickets.status === "success" && <ul>{visibleTickets.rows.map(ticket => <li key={ticket.ticketNumber}><bdi>{ticket.ticketNumber}</bdi> · {ticket.issuedAt} · {ticket.artifactAvailability}</li>)}</ul>}
  </main>
}
