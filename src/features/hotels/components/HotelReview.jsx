import { Container } from "../../../design-system/primitives/Container.jsx"
import { createHotelReviewPresentation } from "../presentation/hotelReviewPresentation.js"
import { resolveHotel, resolveRoom } from "../data/hotelCanonicalFixtures.js"
import { HotelSandboxNotice } from "./HotelSandboxNotice.jsx"

export function HotelReview({ canonicalHotelId, canonicalRateId, onBack }) {
  const hotel = resolveHotel(canonicalHotelId)
  const rate = resolveRoom(canonicalRateId)
  const review = createHotelReviewPresentation({ hotel, room: rate, rate, stay: hotel.stay })
  return <div className="hotels-page hotel-review-page hotels-v2" data-view="review" data-checkout-boundary="NOT_YET_WIRED" data-layout="responsive-desktop-mobile"><Container><button className="hotel-back hotels-v2__back" type="button" onClick={onBack}>← العودة إلى بيانات الضيف</button><HotelSandboxNotice/><header className="guest-heading hotels-v2__heading"><h1>مراجعة الإقامة</h1><p>راجع التفاصيل النهائية قبل الانتقال إلى الدفع لاحقاً.</p></header><div className="guest-layout hotels-v2__layout"><main><section className="guest-form hotels-v2__panel"><h2>{review.hotelName}</h2><p>{review.roomName}</p><p>{review.board} · {review.cancellation.label}</p><p dir="ltr">{review.checkIn} → {review.checkOut}</p><p>{review.nights} ليالٍ · {review.guests.adults} بالغين · {review.guests.rooms} غرفة</p></section></main><aside className="stay-summary hotels-v2__summary"><h2>المبلغ النهائي</h2><strong className="selected-price latin-text hotels-v2__summary-price" dir="ltr">{review.finalAmount.toLocaleString("en-US")} {review.currency}</strong><p className="hotels-v2__unavailable">العقد تجريبي ولا يمثل توافراً حياً.</p><button className="v2-button v2-button--primary hotels-v2__cta" type="button" disabled aria-disabled="true">المتابعة للدفع — غير موصولة بعد</button></aside></div></Container></div>
}
