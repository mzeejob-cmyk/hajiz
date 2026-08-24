import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { HOTEL_DESTINATIONS } from "../data/homeData.js"
import { SectionHeading } from "./SectionHeading.jsx"
export function HotelDestinationsSection() { return <section className="home-section home-section--soft"><Container><SectionHeading title="استكشف الإقامة" text="ابحث عن فنادق حسب الوجهة ثم قارن الغرف والأسعار."/><div className="utility-card-grid">{HOTEL_DESTINATIONS.map(place => <Link className="hotel-card" to={`/hotels?destination=${place.code}`} state={{ source: "home", synthetic: true }} key={place.code}><div className="neutral-placeholder" aria-hidden="true"/><div><h3>{place.city}</h3><b>عرض الفنادق</b></div></Link>)}</div></Container></section> }
