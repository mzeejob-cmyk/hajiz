/**
 * Hotel search panel — Figma node 18:7.
 *
 * Static presentation of the stay the synthetic fixture describes. There is
 * no hotel search input authority behind this screen, so nothing here is an
 * editable control: the three field cards are read-only text and the action
 * carries the canonical node 18:18 label "عرض النموذج", which is deliberately
 * not a transactional search verb.
 */
const SEARCH_FIELDS = Object.freeze([
  { id: "destination", label: "الوجهة", value: "دبي" },
  { id: "dates", label: "الوصول والمغادرة", value: "15–18 سبتمبر" },
  { id: "guests", label: "النزلاء والغرف", value: "2 بالغ · غرفة" },
])

export function HotelSearchPanel() {
  return (
    <section className="hotels-v2__search" data-hotel-search="preview" aria-label="معايير الإقامة المعروضة">
      {SEARCH_FIELDS.map(field => (
        <div className="hotels-v2__search-field" key={field.id} data-search-field={field.id}>
          <p className="hotels-v2__search-label">{field.label}</p>
          <p className="hotels-v2__search-value">{field.value}</p>
        </div>
      ))}
      <p className="hotels-v2__search-action" data-hotel-search-action="static">عرض النموذج</p>
    </section>
  )
}
