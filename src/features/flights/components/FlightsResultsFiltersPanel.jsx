/**
 * Filters rail - Figma node 17:10.
 *
 * In the canonical design these are plain labels, and the running application
 * has no result filtering. They are therefore presented as static text with an
 * explicit unavailability note. Nothing focusable or clickable is rendered
 * here, so nothing can appear to filter while doing nothing. The suite in
 * scripts/flight-results-v2-tests.mjs fails this file if that ever changes.
 */
const FILTER_LABELS = Object.freeze([
  "عدد التوقفات",
  "وقت المغادرة",
  "مدة الرحلة",
  "شركات الطيران",
  "نطاق السعر",
])

export function FlightsResultsFiltersPanel() {
  return (
    <aside className="flight-filters-v2" data-flight-filters="preview" aria-labelledby="flight-filters-v2-title">
      <h2 className="flight-filters-v2__title" id="flight-filters-v2-title">صفِّ النتائج</h2>
      <ul className="flight-filters-v2__list">
        {FILTER_LABELS.map((label) => <li className="flight-filters-v2__item" key={label}>{label}</li>)}
      </ul>
      <p className="flight-filters-v2__note">التصفية غير متاحة بعد. النتائج معروضة كاملة بترتيب الخادم المعتمد.</p>
    </aside>
  )
}
