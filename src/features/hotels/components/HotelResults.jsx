import { Container } from "../../../design-system/primitives/Container.jsx"
import { HOTEL_FIXTURES } from "../data/hotelCanonicalFixtures.js"
import { HotelSandboxNotice } from "./HotelSandboxNotice.jsx"
import { HotelSearchPanel } from "./HotelSearchPanel.jsx"

/**
 * HAJIZ V2 hotel results — Figma node 18:2 and descendants.
 *
 * Presentation migration only. Cards are still rendered from the frozen
 * synthetic HOTEL_FIXTURES with their existing names, prices and canonical
 * ids; no fixture economics or inventory semantics were changed, and no
 * supplier field is read.
 *
 * The room-detail CTA is rendered only for the one fixture the frozen routing
 * can actually open; the others state their unavailability as plain text.
 *
 * Two honest corrections were required by node 18:4's own sandbox truth:
 * the result count now reports the fixtures actually rendered instead of a
 * fabricated figure, and the filter and sort affordances are static text
 * rather than controls, because no hotel filtering or sorting authority
 * exists. Nothing here may look like live inventory.
 *
 * Figma's card titles (nodes 18:22/18:26/18:30) are generic placeholders;
 * the real fixture names are used instead, and node 18:23's sandbox line is
 * carried on every card.
 */
const FILTER_GROUPS = Object.freeze(["التصنيف", "الإلغاء", "الوجبات", "السعر"])
const SORT_LABELS = Object.freeze(["موصى به", "السعر الأقل", "التصنيف"])

// Frozen HotelsPage routing provides a room/detail flow for this fixture only.
// Every other card must state that plainly instead of offering a control that
// would bounce the customer back to the results page.
const ROOM_DETAIL_HOTEL_ID = "hjz_htl_palm_dubai"

function HotelCard({ hotel, onRooms }) {
  const roomDetailAvailable = hotel.canonicalHotelId === ROOM_DETAIL_HOTEL_ID
  return <article className="hotel-card hotels-v2__card" data-hotel-key={hotel.key} data-canonical-hotel-id={hotel.canonicalHotelId} data-presentation-fixture="synthetic" data-room-detail-available={roomDetailAvailable ? "true" : "false"}>
    <div className="hotels-v2__card-media" aria-hidden="true"/>
    <div className="hotel-card-copy hotels-v2__card-copy">
      <h2 className="hotels-v2__card-title">{hotel.name}</h2>
      <p className="hotels-v2__card-sandbox">بيانات تجريبية واضحة · لا توفر حي</p>
      <div className="hotel-stars hotels-v2__stars" aria-label={`${hotel.stars.length} نجوم`}>{hotel.stars}</div>
      <p className="hotels-v2__card-meta">{hotel.location}</p>
      <p className="hotels-v2__card-meta">{hotel.roomPreview}</p>
      <div className="hotel-meta hotels-v2__card-meta"><span>{hotel.meal}</span><span> · </span><span>{hotel.cancellation}</span></div>
    </div>
    <div className="hotel-price-block hotels-v2__price">
      <small className="hotels-v2__price-label">يبدأ من · 3 ليالٍ</small>
      <strong className="latin-text hotels-v2__price-value" dir="ltr">{hotel.price} AED</strong>
      <span className="hotels-v2__card-meta">{hotel.tax}</span>
      {roomDetailAvailable
        ? <button className="v2-button v2-button--primary hotels-v2__rooms-button" type="button" onClick={() => onRooms(hotel.canonicalHotelId)}>عرض الغرف</button>
        : <p className="hotels-v2__unavailable" data-room-detail="unavailable">تفاصيل الغرف غير متاحة لهذا النموذج التجريبي.</p>}
      <small className="hotels-v2__card-meta">{hotel.roomsCount}</small>
    </div>
  </article>
}

export function HotelResults({ onRooms }) {
  return <div className="hotels-page hotels-results-page hotels-v2" data-view="results" data-layout="responsive-desktop-mobile"><Container>
    <header className="hotels-title hotels-v2__heading">
      <p className="hotels-v2__eyebrow">فنادق في دبي</p>
      <h1 className="hotels-v2__title">إقامة تشبه رحلتك</h1>
      <p className="hotels-v2__subtitle">{HOTEL_FIXTURES.length} فنادق تجريبية معروضة؛ مسار تفاصيل الغرف متاح لنموذج فندق واحد فقط.</p>
    </header>
    <HotelSandboxNotice/>
    <HotelSearchPanel/>
    <div className="hotels-grid hotels-v2__layout">
      <aside className="hotel-filters hotels-v2__filters" data-hotel-filters="preview" aria-labelledby="hotels-v2-filters-title">
        <h2 className="hotels-v2__filters-title" id="hotels-v2-filters-title">تصفية النتائج</h2>
        <ul className="hotels-v2__filters-list">{FILTER_GROUPS.map(label => <li className="hotels-v2__filters-item" key={label}>{label}</li>)}</ul>
        <p className="hotels-v2__unavailable">التصفية غير متاحة بعد ضمن حدود Sandbox.</p>
      </aside>
      <main className="hotel-results hotels-v2__list">
        <div className="hotel-toolbar hotels-v2__toolbar">
          <strong className="hotels-v2__count">{HOTEL_FIXTURES.length} فنادق تجريبية</strong>
          <p className="hotels-v2__sort-row">{SORT_LABELS.map((label, index) => <span className={index === 0 ? "hotels-v2__sort hotels-v2__sort--active" : "hotels-v2__sort"} key={label}>{label}</span>)}</p>
          <p className="hotels-v2__unavailable">الترتيب غير متاح بعد؛ النتائج معروضة بترتيب العينة الثابت.</p>
        </div>
        <div className="hotel-group-note hotels-v2__group-note">
          <strong>خيارات الغرف والأسعار مجمعة تحت الفندق نفسه</strong>
          <span>اختر الفندق ثم قارن الغرف وشروط الإلغاء قبل المتابعة.</span>
        </div>
        {HOTEL_FIXTURES.map(hotel => <HotelCard key={hotel.key} hotel={hotel} onRooms={onRooms}/>)}
        <p className="hotel-disclaimer hotels-v2__unavailable">الأسعار قد تتغير حتى تثبيت العرض في الخطوة التالية.</p>
      </main>
    </div>
  </Container></div>
}
