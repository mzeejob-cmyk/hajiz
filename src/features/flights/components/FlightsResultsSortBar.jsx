/**
 * Sort bar - Figma node 17:18.
 *
 * The canonical result order is decided by the server ranking and is the only
 * order this page can honestly present. "الأرخص" and "الأسرع" appear in the
 * mockup but no supported sort parameter exists, so they are rendered as
 * static text, never as controls: nothing here is focusable or clickable and
 * nothing can pretend to reorder results.
 */
export function FlightsResultsSortBar({ count }) {
  return (
    <div className="flight-sort-v2" data-flight-sort="canonical">
      <p className="flight-sort-v2__row">
        <span className="flight-sort-v2__active" aria-current="true">الأفضل</span>
        <span className="flight-sort-v2__inactive">الأرخص</span>
        <span className="flight-sort-v2__inactive">الأسرع</span>
      </p>
      {typeof count === "number" && <p className="flight-sort-v2__count">{count} نتيجة</p>}
      <p className="flight-sort-v2__note">الترتيب المعروض هو الترتيب المعتمد من الخادم. خيارات ترتيب أخرى غير متاحة بعد.</p>
    </div>
  )
}
