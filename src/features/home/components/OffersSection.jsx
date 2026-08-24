import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { SELECTED_OFFERS } from "../data/homeData.js"
import { SectionHeading } from "./SectionHeading.jsx"
export function OffersSection() { return <section className="home-section home-offers-section"><Container><SectionHeading title="عروض مختارة" text="محتوى تجاري يديره حاجز ويقود إلى الخدمة المرتبطة." mobileText="اكتشف أحدث المحتوى والعروض من حاجز."/><div className="home-offers-grid">{SELECTED_OFFERS.map(offer => <Link to={offer.to} key={offer.id} className={`offer-card${offer.desktopOnly ? " desktop-only" : ""}`}><div className="offer-placeholder" aria-hidden="true"/><div><h3>{offer.title}</h3><p className="desktop-copy">{offer.text}</p><p className="mobile-copy">{offer.mobileText || offer.text}</p></div></Link>)}</div></Container></section> }
