import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
import { PaymentStatusBadge } from "../flights/components/PaymentStatusBadge.jsx"
import { myTripsDataSource } from "../../services/myTripsDataSource.js"
import { makeBookingRequestState, selectVisibleBookingRequest } from "./data/bookingRequestState.js"
import { createTicketRequestGuard, hasAuthoritativeAmount } from "./data/ticketRequestGuard.js"

/**
 * HAJIZ V2 Booking Detail — the node 17:145 wallet grammar applied to the
 * existing owner-scoped booking read.
 *
 * Presentation migration only. The reference validation, stale-request
 * protection, ticket-request guard and authoritative-amount gate are all
 * unchanged, and the page still reads through myTripsDataSource. Payment and
 * booking stay two independent indicators, and ticket access still requires
 * the trusted canViewTicketDetails / canDownloadTicket fields.
 *
 * Figma has no dedicated Booking Detail frame, so no product semantics were
 * invented to fill one: this reuses 17:151/17:157 and nothing more.
 */
export default function BookingPage({ dataSource = myTripsDataSource }) {
  const { reference = "" } = useParams()
  const valid = /^HJZ-[A-Z0-9-]{4,40}$/.test(reference)
  const [attempt, setAttempt] = useState(0)
  const [request, setRequest] = useState(makeBookingRequestState(reference, valid ? "loading" : "invalid_reference"))
  const [tickets, setTickets] = useState({ reference, status: "idle", rows: [] })
  const ticketGuard = useRef(createTicketRequestGuard(reference))
  const visibleRequest = selectVisibleBookingRequest(request, reference, valid)
  const visibleTickets = tickets.reference === reference ? tickets : { reference, status: "idle", rows: [] }
  useEffect(() => {
    ticketGuard.current.activate(reference)
    setTickets({ reference, status: "idle", rows: [] })
    if (!valid) { setRequest(makeBookingRequestState(reference, "invalid_reference")); return }
    let active = true
    setRequest(makeBookingRequestState(reference, "loading"))
    dataSource.loadBooking(reference).then(booking => { if (active) setRequest(makeBookingRequestState(reference, booking ? "ready" : "not_found", booking)) }).catch(() => { if (active) setRequest(makeBookingRequestState(reference, "error")) })
    return () => { active = false }
  }, [attempt, dataSource, reference, valid])
  if (visibleRequest.status === "invalid_reference") return <section className="booking-v2__state booking-v2__state--error v2-no-motion" role="alert">مرجع الحجز غير صالح.</section>
  if (visibleRequest.status === "loading") return <section className="booking-v2__state" role="status">جارٍ تحميل تفاصيل الحجز الآمنة…</section>
  if (visibleRequest.status === "not_found") return <section className="booking-v2__state" role="status">تعذر العثور على هذا الحجز ضمن حجوزات حسابك.</section>
  if (visibleRequest.status === "error") return <section className="booking-v2__state booking-v2__state--error v2-no-motion" role="alert"><p>تعذر تحميل تفاصيل الحجز.</p><button className="v2-button v2-button--primary" type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></section>
  const booking = visibleRequest.booking
  const loadTickets = () => {
    const request = ticketGuard.current.begin(reference)
    setTickets({ reference, status: "loading", rows: [] })
    dataSource.loadTicketDetails(reference)
      .then(rows => { if (ticketGuard.current.accepts(request)) setTickets({ reference, status: "success", rows }) })
      .catch(() => { if (ticketGuard.current.accepts(request)) setTickets({ reference, status: "error", rows: [] }) })
  }
  return <main className="booking-v2 trips-v2" data-booking-detail="owner-scoped-read"><Container>
    <header className="trips-v2__heading"><h1 className="trips-v2__title">تفاصيل الحجز</h1><p className="trips-v2__subtitle">المرجع <bdi className="trips-v2__reference" dir="ltr">{booking.reference}</bdi></p></header>
    <article className="trip-card trips-v2__card">
      <div className="trips-v2__journey">
        <p className="payment-status-badges trips-v2__statuses"><PaymentStatusBadge domain="booking" status={booking.bookingState}/><span className="trips-v2__status-separator" aria-hidden="true">·</span><PaymentStatusBadge domain="payment" status={booking.paymentState}/></p>
        <p className="trips-v2__journey-meta">أُنشئ في <time dateTime={booking.createdAt}>{new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(booking.createdAt))}</time></p>
        {hasAuthoritativeAmount(booking.amount) && <p className="trips-v2__journey-meta"><bdi dir="ltr">{booking.amount} {booking.currency}</bdi></p>}
        <p className="trips-v2__journey-meta">طريقة الدفع: <bdi>{booking.paymentMethod}</bdi></p>
        <p className="trips-v2__journey-note">لن يظهر زر تنزيل التذكرة قبل توفر مستند موثوق وحالته AVAILABLE.</p>
        {booking.reconciliationRequired && <p className="booking-v2__reconciliation v2-no-motion" role="alert">حالة الحجز أو التذكرة تتطلب مراجعة.</p>}
      </div>
      <aside className="trips-v2__documents">
        <h2 className="trips-v2__documents-title">المستندات</h2>
        <p className={booking.canDownloadTicket ? "trips-v2__documents-available" : "trips-v2__documents-pending"}>{booking.canDownloadTicket ? "مستند التذكرة الموثوق متاح، وخدمة تنزيل الملف غير مهيأة." : "التذكرة غير متاحة بعد"}</p>
        <p className="trips-v2__documents-note">مرجع المورد أو رقم حجزه وحده غير كافٍ</p>
        <p className="trips-v2__documents-note">{booking.ticketingLabel}</p>
        {booking.canViewTicketDetails && visibleTickets.status === "idle" && <button className="v2-button v2-button--secondary trips-v2__tickets-button" type="button" onClick={loadTickets}>عرض بيانات التذكرة</button>}
        {visibleTickets.status === "loading" && <p className="trips-v2__documents-note" role="status">جارٍ تحميل بيانات التذكرة…</p>}
        {visibleTickets.status === "error" && <p className="trips-v2__documents-error v2-no-motion" role="alert">تعذر تحميل بيانات التذكرة.</p>}
        {visibleTickets.status === "success" && <ul className="trips-v2__ticket-list">{visibleTickets.rows.map(ticket => <li key={ticket.ticketNumber}><bdi dir="ltr">{ticket.ticketNumber}</bdi> · <time dateTime={ticket.issuedAt}>{ticket.issuedAt}</time> · {ticket.artifactAvailability}</li>)}</ul>}
      </aside>
    </article>
  </Container></main>
}
