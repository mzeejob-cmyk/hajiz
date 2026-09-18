/**
 * Trip tabs — Figma node 17:147.
 *
 * In the canonical design these are plain labels. The trusted trips authority
 * (get_my_bookings) returns booking_ref, status, sold_price, currency,
 * pay_method and created_at — there is no departure date, so "القادمة" and
 * "السابقة" cannot be classified without inventing status authority.
 *
 * They are therefore rendered as static text with an explicit note. Nothing
 * here is focusable or clickable, so no control can appear to filter trips
 * while doing nothing.
 */
const TRIP_TAB_LABELS = Object.freeze(["القادمة", "قيد المعالجة", "السابقة"])

export function TripTabs() {
  return (
    <div className="trips-v2__tabs" data-trip-tabs="preview">
      <p className="trips-v2__tab-row">
        {TRIP_TAB_LABELS.map((label, index) => (
          <span className={index === 0 ? "trips-v2__tab trips-v2__tab--active" : "trips-v2__tab"} key={label}>{label}</span>
        ))}
      </p>
      <p className="trips-v2__tab-note">تصفية الرحلات غير متاحة بعد. تُعرض كل حجوزاتك بالترتيب المعتمد من الخادم.</p>
    </div>
  )
}
