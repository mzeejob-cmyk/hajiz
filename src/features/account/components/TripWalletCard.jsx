/**
 * Trip wallet card — Figma node 17:151 and descendants.
 *
 * Presentation only. Every value is handed in from the trusted owner-scoped
 * trips read; nothing here fetches, derives or transitions state.
 *
 * Payment and booking stay two independent indicators, never merged into one
 * outcome. Document availability follows canDownloadTicket and the trusted
 * artifact fields alone — a supplier reference or a confirmed payment can
 * never unlock a document.
 *
 * The canonical route and traveler-count line from node 17:153/17:154 is
 * deliberately not rendered: get_my_bookings returns neither, and inventing
 * them would fabricate trip facts.
 */
import { Link } from "react-router-dom"
import { PaymentStatusBadge } from "../../flights/components/PaymentStatusBadge.jsx"

export function TripWalletCard({ trip, detail, detailHref, onLoadTickets }) {
  return (
    <article className="trip-card trips-v2__card" data-booking-state={trip.bookingState} data-ticketing-state={trip.ticketingState}>
      <div className="trips-v2__journey">
        <h2 className="trips-v2__journey-title">حجز رحلة</h2>
        <p className="trips-v2__journey-meta">المرجع <bdi className="trip-reference trips-v2__reference" dir="ltr">{trip.reference}</bdi></p>
        <p className="trips-v2__journey-meta">أُنشئ في <time dateTime={trip.createdAt}>{new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(trip.createdAt))}</time></p>
        <p className="payment-status-badges trips-v2__statuses"><PaymentStatusBadge domain="payment" status={trip.paymentState}/><span className="trips-v2__status-separator" aria-hidden="true">·</span><PaymentStatusBadge domain="booking" status={trip.bookingState}/></p>
        <p className="trips-v2__journey-note">لن يظهر زر تنزيل التذكرة قبل توفر مستند موثوق وحالته AVAILABLE.</p>
        <p className="trips-v2__journey-meta"><bdi dir="ltr">{trip.amount ?? "—"} {trip.currency}</bdi> · طريقة الدفع: <bdi>{trip.paymentMethod}</bdi></p>
        <Link className="v2-button v2-button--ghost trips-v2__detail-link" to={detailHref}>تفاصيل الحجز</Link>
      </div>
      <aside className="trips-v2__documents">
        <h3 className="trips-v2__documents-title">المستندات</h3>
        <p className={trip.canDownloadTicket ? "trips-v2__documents-available" : "trips-v2__documents-pending"}>{trip.canDownloadTicket ? "المستند الموثوق متاح، وخدمة تنزيل الملف غير مهيأة" : "التذكرة غير متاحة بعد"}</p>
        <p className="trips-v2__documents-note">مرجع المورد أو رقم حجزه وحده غير كافٍ</p>
        <p className="trips-v2__documents-note">{trip.ticketingLabel}</p>
        {trip.canViewTicketDetails && <button className="v2-button v2-button--secondary trips-v2__tickets-button" type="button" aria-busy={detail?.status === "loading" || undefined} onClick={() => onLoadTickets?.(trip)}>عرض بيانات التذكرة</button>}
        {detail?.status === "loading" && <p className="trips-v2__documents-note" role="status">جارٍ تحميل بيانات التذكرة</p>}
        {detail?.status === "error" && <p className="trips-v2__documents-error v2-no-motion" role="alert">تعذر تحميل بيانات التذكرة</p>}
        {detail?.status === "success" && <ul className="trips-v2__ticket-list">{detail.rows.map(ticket => <li key={ticket.ticketNumber}><bdi dir="ltr">{ticket.ticketNumber}</bdi> · {ticket.artifactAvailability === "AVAILABLE" ? "المستند متاح عبر خدمة التنزيل الموثوقة" : "بيانات التذكرة متاحة، ولا يوجد مستند قابل للتنزيل"}</li>)}</ul>}
      </aside>
    </article>
  )
}
