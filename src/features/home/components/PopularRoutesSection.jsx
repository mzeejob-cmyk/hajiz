import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { DirectionText } from "../../../design-system/primitives/DirectionText.jsx"
import { POPULAR_ROUTES } from "../data/homeData.js"
import { SectionHeading } from "./SectionHeading.jsx"
export function PopularRoutesSection() { return <section className="home-section home-discovery-v2"><Container><SectionHeading title="وجهات ورحلات شائعة" text="ابدأ بحثك بسرعة — السعر يظهر من نتائج البحث الفعلية."/><div className="utility-card-grid home-discovery-v2__grid">{POPULAR_ROUTES.map(route => <Link key={`${route.fromCode}-${route.toCode}`} className="utility-card route-card home-discovery-v2__card home-route-card-v2" to={`/flights?from=${route.fromCode}&to=${route.toCode}`} state={{ source: "home", synthetic: true }}><div><span className="route-codes"><DirectionText>{route.fromCode}</DirectionText><i>←</i><DirectionText>{route.toCode}</DirectionText></span><h3>{route.from} ← {route.to}</h3><p>{route.caption}</p></div><b>ابحث عن السعر</b></Link>)}</div></Container></section> }
