import { Container } from "../../../design-system/primitives/Container.jsx"
import { createReviewBoundary } from "../contracts/hotelV2.js"
import { resolveHotel, resolveRoom } from "../data/hotelCanonicalFixtures.js"

export function HotelReview({ canonicalHotelId, canonicalRateId, onBack }) {
  const hotel = resolveHotel(canonicalHotelId)
  const rate = resolveRoom(canonicalRateId)
  const review = createReviewBoundary({ hotel, room: rate, rate, stay: hotel.stay })
  return <div className="hotels-page hotel-review-page" data-view="review" data-checkout-boundary="NOT_YET_WIRED" data-layout="responsive-desktop-mobile"><Container><button className="hotel-back" type="button" onClick={onBack}>← العودة إلى بيانات الضيف</button><header className="guest-heading"><h1>مراجعة الإقامة</h1><p>راجع التفاصيل النهائية قبل الانتقال إلى الدفع لاحقاً.</p></header><div className="guest-layout"><main><section className="guest-form"><h2>{review.hotelName}</h2><p>{review.roomName}</p><p>{review.board} · {review.cancellation.label}</p><p dir="ltr">{review.checkIn} → {review.checkOut}</p><p>{review.nights} ليالٍ · {review.guests.adults} بالغين · {review.guests.rooms} غرفة</p></section></main><aside className="stay-summary"><h2>المبلغ النهائي</h2><strong className="selected-price latin-text" dir="ltr">{review.finalAmount.toLocaleString("en-US")} {review.currency}</strong><p>العقد تجريبي ولا يمثل توافراً حياً.</p><button type="button" disabled aria-disabled="true">المتابعة للدفع — غير موصولة بعد</button></aside></div></Container></div>
}
