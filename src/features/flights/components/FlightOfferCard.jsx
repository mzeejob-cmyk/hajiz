import { DirectionText } from "../../../design-system/primitives/DirectionText.jsx"
import { FlightSegment } from "./FlightSegment.jsx"
import { Price } from "./Price.jsx"

/**
 * HAJIZ V2 flight result card - Figma node 17:21.
 *
 * Presentation only. Every value comes from the trusted search view model;
 * nothing here computes, converts or derives a fare, and no internal
 * economics are read. The CTA hands the opaque alternativeId back to the
 * existing selection/reprice authority and does nothing else.
 *
 * Two copy deviations from the mockup are deliberate and reported: the CTA
 * reads "اختيار" and the emphasis label reads "موصى به", because the frozen
 * B8 suite asserts both strings. Mockup copy does not override a frozen test.
 */
const stopsLabel = (stops) => (stops === 0 ? "مباشر" : stops === 1 ? "توقف واحد" : `${stops} توقفات`)

export function FlightOfferCard({ offer, onSelect, selecting = false }) {
  const details = [
    offer.airline && `${offer.airline}`,
    offer.cabin,
    offer.baggage,
    offer.flexibility,
  ].filter(Boolean)
  return (
    <article className="flight-offer-card flight-result-card-v2">
      <div className="flight-result-card-v2__itinerary">
        <p className={`flight-result-card-v2__eyebrow${offer.recommended ? " flight-result-card-v2__eyebrow--emphasis" : ""}`}>
          {stopsLabel(offer.stops)}
          {offer.recommended && <span className="ranking-badge"> · موصى به</span>}
        </p>
        <FlightSegment offer={offer}/>
        <p className="flight-result-card-v2__meta">
          <span className="offer-airline-id"><DirectionText>{offer.airlineCode} {offer.flightNumber}</DirectionText></span>
          {details.map((detail) => <span key={detail}> · {detail}</span>)}
          {offer.segmentCount > 1 && <span className="connection-strip"> · {offer.segmentCount} مقاطع سفر</span>}
        </p>
      </div>
      <div className="flight-result-card-v2__price offer-purchase">
        <Price className="flight-result-card-v2__amount" amount={offer.sellingAmount} currency={offer.currency}/>
        <p className="flight-result-card-v2__price-note">السعر النهائي يُؤكد عند إعادة التسعير</p>
        <button className="v2-button v2-button--primary flight-result-card-v2__select" type="button" aria-busy={selecting || undefined} disabled={selecting} onClick={() => onSelect?.(offer.alternativeId)}>اختيار</button>
      </div>
    </article>
  )
}
