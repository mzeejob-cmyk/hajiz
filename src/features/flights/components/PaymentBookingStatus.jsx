import { Container } from "../../../design-system/primitives/Container.jsx"
import { resolvePaymentStatusPresentation } from "../data/paymentStatusPresentation.js"
import { PaymentStatusBadge } from "./PaymentStatusBadge.jsx"

export function PaymentBookingStatus({ state }) {
  const fixture = resolvePaymentStatusPresentation(state)
  return <div className="payment-status-page" data-view="payment-status" data-state={state} data-presentation-fixture="synthetic">
    <Container><p className="presentation-fixture-label">حالة تجريبية للعرض فقط</p><h1>حالات ما بعد إرسال الدفع</h1>
      <article className="payment-status-card">
        <div className="payment-status-badges" aria-label="حالتا الدفع والحجز"><PaymentStatusBadge domain="payment" status={fixture.paymentStatus}/><PaymentStatusBadge domain="booking" status={fixture.bookingStatus}/></div>
        <h2>{fixture.title}</h2><p>{fixture.copy}</p>{fixture.note && <p className="payment-status-note">{fixture.note}</p>}
      </article>
    </Container>
  </div>
}
