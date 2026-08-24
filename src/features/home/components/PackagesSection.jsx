import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { DirectionText } from "../../../design-system/primitives/DirectionText.jsx"
import { CURATED_PACKAGES } from "../data/homeData.js"
import { SectionHeading } from "./SectionHeading.jsx"
export function PackagesSection() { return <section className="home-section"><Container><SectionHeading title="باقات جاهزة" text="برامج مختارة مع مشمولات واضحة قبل الحجز."/><div className="utility-card-grid">{CURATED_PACKAGES.map(item => <Link className={`package-card${item.desktopOnly ? " desktop-only" : ""}`} to="/packages" key={item.title}><div className="neutral-placeholder neutral-placeholder--small" aria-hidden="true"/><div><h3>{item.title}</h3><DirectionText className="package-detail">{item.duration}</DirectionText><DirectionText className="package-price">{item.displayPrice}</DirectionText></div></Link>)}</div></Container></section> }
