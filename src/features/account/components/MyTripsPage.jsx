import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { PaymentStatusBadge } from "../../flights/components/PaymentStatusBadge.jsx"
import { buildTripDetailTarget, resolveTripFixtures } from "../data/tripFixtures.js"

function EmptyTrips() { return <section className="trips-empty" data-state="empty"><span aria-hidden="true">✈</span><h2>لا توجد حجوزات بعد</h2><p>ستظهر رحلاتك هنا بعد بدء حجز تجريبي.</p><Link to="/flights">استكشف الرحلات</Link></section> }
function InvalidTrips() { return <section className="trips-empty trips-invalid" role="status" data-state="invalid"><h2>تعذر عرض الحجوزات</h2><p>مفتاح العرض غير صالح. لم يتم تحميل أي بيانات خارجية.</p><Link to="/account/trips">العودة إلى حجوزاتي</Link></section> }

export function MyTripsPage({ fixtureKey = "default" }) {
  const trips = resolveTripFixtures(fixtureKey)
  return <div className="my-trips-page" dir="rtl" data-view="my-trips" data-layout="responsive-desktop-mobile" data-presentation-fixture="synthetic"><Container>
    <header className="trips-heading"><div><span>الحساب</span><h1>حجوزاتي</h1><p>تابع حالة الحجز والدفع كلٌ على حدة.</p></div><span className="presentation-fixture-label">حجوزات اصطناعية للعرض فقط</span></header>
    {trips === null ? <InvalidTrips /> : trips.length === 0 ? <EmptyTrips /> : <div className="trip-list" aria-label="قائمة حجوزات الرحلات">{trips.map(trip => <article className="trip-card" key={trip.key} data-booking-state={trip.bookingState} data-fixture-only="true"><div className="trip-card__top"><div className="payment-status-badges" aria-label="حالة الدفع وحالة الحجز"><PaymentStatusBadge domain="payment" status={trip.paymentState}/><PaymentStatusBadge domain="booking" status={trip.bookingState}/></div><span className="trip-reference latin-text" dir="ltr">{trip.reference}</span></div><div className="trip-card__body"><div><h2 className="latin-text" dir="ltr">{trip.route}</h2><p>{trip.airline} · <bdi className="latin-text">{trip.flight}</bdi> · {trip.date} · <bdi className="latin-text">{trip.time}</bdi></p><small><bdi className="latin-text">{trip.traveler}</bdi> · {trip.fare}</small></div><Link className="trip-card__link" to={buildTripDetailTarget(trip)} aria-label={`عرض تفاصيل الرحلة ${trip.route}`}>عرض التفاصيل <span aria-hidden="true">‹</span></Link></div></article>)}</div>}
  </Container></div>
}
