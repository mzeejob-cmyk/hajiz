import { useState } from "react"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { HOTEL_FIXTURES } from "../data/hotelCanonicalFixtures.js"

const GROUPS = [
  ["التصنيف", ["5 نجوم", "4 نجوم", "3 نجوم"]],
  ["الإلغاء", ["إلغاء مرن", "تطبق الشروط"]],
  ["الوجبات", ["يشمل الإفطار", "غرفة فقط"]],
  ["السعر", ["أقل من 1,000 AED", "1,000–1,500 AED", "أكثر من 1,500 AED"]],
]

function Filters({ selected, onToggle, onClear }) {
  return <div className="hotel-filters"><div className="hotel-filter-heading"><h2>تصفية النتائج</h2><button type="button" onClick={onClear}>مسح الكل</button></div>{GROUPS.map(([title, labels]) => <fieldset key={title}><legend>{title}</legend>{labels.map(label => <label key={label}><input type="checkbox" checked={selected.includes(label)} onChange={() => onToggle(label)}/><span>{label}</span></label>)}</fieldset>)}</div>
}

function HotelCard({ hotel, onRooms }) {
  return <article className="hotel-card" data-hotel-key={hotel.key} data-canonical-hotel-id={hotel.canonicalHotelId} data-presentation-fixture="synthetic"><div className="hotel-image-placeholder" aria-hidden="true">▦</div><div className="hotel-card-copy"><div className="hotel-name-row"><h2>{hotel.name}</h2>{hotel.badge && <span className="hotel-badge">{hotel.badge}</span>}</div><div className="hotel-stars" aria-label={`${hotel.stars.length} نجوم`}>{hotel.stars}</div><p>{hotel.location}</p><p>{hotel.roomPreview}</p><div className="hotel-meta"><span>{hotel.meal}</span><span>{hotel.cancellation}</span></div></div><div className="hotel-price-block"><small>يبدأ من · 3 ليالٍ</small><strong className="latin-text" dir="ltr">{hotel.price} AED</strong><span>{hotel.tax}</span><button type="button" onClick={() => onRooms(hotel.canonicalHotelId)}>عرض الغرف</button><small>{hotel.roomsCount}</small></div></article>
}

export function HotelResults({ onRooms }) {
  const [selected, setSelected] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const toggle = label => setSelected(current => current.includes(label) ? current.filter(item => item !== label) : [...current, label])
  const filters = <Filters selected={selected} onToggle={toggle} onClear={() => setSelected([])}/>
  return <div className="hotels-page hotels-results-page" data-view="results" data-layout="responsive-desktop-mobile"><Container><section className="hotel-search-summary"><div><h1>دبي</h1><p>15–18 سبتمبر · 3 ليالٍ · 2 بالغين · غرفة واحدة</p></div><button type="button">تعديل البحث</button></section><header className="hotels-title"><h1>فنادق في دبي</h1><p>نعرض فندقًا واحدًا مع أفضل خيارات الغرف والأسعار المتاحة له.</p></header><div className="mobile-results-toolbar"><strong>32 فندقًا متاحًا</strong><button type="button" onClick={() => setSheetOpen(true)}>الفلاتر</button><span>موصى به</span></div><div className="hotels-grid"><aside>{filters}</aside><main className="hotel-results"><div className="hotel-toolbar"><strong>32 فندقًا</strong><div><button type="button" className="is-active">موصى به</button><button type="button">السعر الأقل</button><button type="button">التصنيف</button></div></div><div className="hotel-group-note"><strong>خيارات الغرف والأسعار مجمعة تحت الفندق نفسه</strong><span>اختر الفندق ثم قارن الغرف وشروط الإلغاء قبل المتابعة.</span></div>{HOTEL_FIXTURES.map(hotel => <HotelCard key={hotel.key} hotel={hotel} onRooms={onRooms}/>)}<p className="hotel-disclaimer">الأسعار قد تتغير حتى تثبيت العرض في الخطوة التالية.</p></main></div></Container>{sheetOpen && <div className="hotel-sheet-backdrop" role="presentation" onMouseDown={() => setSheetOpen(false)}><div className="hotel-filter-sheet" role="dialog" aria-modal="true" aria-label="تصفية الفنادق" onMouseDown={event => event.stopPropagation()}><div className="sheet-handle"/>{filters}<button type="button" className="hotel-sheet-apply" onClick={() => setSheetOpen(false)}>عرض 32 فندقًا</button></div></div>}</div>
}
