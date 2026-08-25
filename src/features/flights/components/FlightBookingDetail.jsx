import { useState } from "react"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { PaymentStatusBadge } from "./PaymentStatusBadge.jsx"
import { SYNTHETIC_BOOKING_DETAIL, resolveBookingDetailPresentation } from "../data/bookingDetailPresentation.js"

const TIMELINE = Object.freeze([
  ["تم تأكيد الدفع", "استلمنا المبلغ"],
  ["جاري تنفيذ الحجز", "نتواصل مع المورّد"],
  ["الحجز مؤكد", "المورّد أكد الحجز"],
  ["صدرت التذكرة", "التذكرة جاهزة للتحميل"],
])

export function FlightBookingDetail({ state: requestedState }) {
  const view = resolveBookingDetailPresentation(requestedState)
  const fixture = SYNTHETIC_BOOKING_DETAIL
  const [feedback, setFeedback] = useState("")
  const bookingStatus = view.state
  const showTicketFeedback = () => setFeedback("التذكرة التجريبية غير متاحة للتنزيل الفعلي في هذه المرحلة.")
  const showHelpFeedback = () => setFeedback("المساعدة هنا للعرض فقط، ولم يتم إرسال أي طلب دعم.")

  return <div className="booking-detail-page" data-view="booking-detail" data-state={view.state} data-presentation-fixture="synthetic">
    <Container>
      <header className="booking-detail-heading">
        <div><h1>رحلتي</h1><p className="booking-reference latin-text" dir="ltr">مرجع حاجز {fixture.bookingReference}</p></div>
        <span className="presentation-fixture-label">حجز اصطناعي للعرض فقط — لا يمثل حجزاً فعلياً</span>
      </header>
      <div className="booking-detail-layout" data-layout="responsive-desktop-mobile">
        <div className="booking-detail-content">
          <section className="booking-detail-card booking-status-summary" aria-labelledby="booking-status-title">
            <div className="payment-status-badges">
              <PaymentStatusBadge domain="payment" status="confirmed" />
              <PaymentStatusBadge domain="booking" status={bookingStatus} />
            </div>
            <h2 id="booking-status-title">{view.title}</h2>
            <p>{view.copy}</p>
            {!view.ticketAvailable && <div className="booking-ticket-note"><strong>{view.note}</strong><span>{view.detail}</span></div>}
            {view.ticketAvailable && <p className="synthetic-pnr latin-text" dir="ltr">PNR تجريبي · {fixture.pnr}</p>}
          </section>
          <section className="booking-detail-card booking-flight" aria-label="تفاصيل الرحلة التجريبية">
            <h2 className="latin-text" dir="ltr">{fixture.route}</h2>
            <p>{fixture.airline} · <bdi className="latin-text">{fixture.flight}</bdi> · {fixture.date} · المغادرة <bdi className="latin-text">{fixture.departure}</bdi> · الوصول <bdi className="latin-text">{fixture.arrival}</bdi></p>
            <p>المسافر: <bdi className="latin-text">{fixture.traveler}</bdi> · {fixture.fare} · {fixture.baggage}</p>
          </section>
          <section className="booking-detail-card booking-timeline" aria-labelledby="timeline-title">
            <h2 id="timeline-title">تقدم الحجز</h2>
            <ol>{TIMELINE.map(([label, description], index) => <li key={label} className={index <= view.step ? "is-complete" : "is-pending"} data-timeline-step={index}><span aria-hidden="true"/><div><strong>{label}</strong><small>{description}</small></div></li>)}</ol>
          </section>
        </div>
        <aside className="booking-detail-card booking-actions" aria-label="إجراءات الحجز">
          <h2>إجراءات الحجز</h2>
          <button type="button" disabled={!view.ticketAvailable} aria-disabled={!view.ticketAvailable} onClick={showTicketFeedback}>تحميل التذكرة</button>
          <small>{view.ticketAvailable ? "عرض تجريبي فقط — لن يتم تنزيل ملف حقيقي." : "يتاح بعد إصدار التذكرة فقط."}</small>
          <button className="booking-help" type="button" onClick={showHelpFeedback}>مساعدة</button>
        </aside>
      </div>
      {feedback && <p className="booking-local-feedback" role="status" aria-live="polite">{feedback}</p>}
    </Container>
  </div>
}
