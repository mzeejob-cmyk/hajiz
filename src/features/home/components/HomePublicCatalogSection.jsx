import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { Badge } from "../../../design-system/primitives/Badge.jsx"
import { Spinner } from "../../../design-system/primitives/Spinner.jsx"
import { Button } from "../../../design-system/primitives/Button.jsx"
import { publicCatalogDataSource } from "../../../services/publicCatalogDataSource.js"
import { SectionHeading } from "./SectionHeading.jsx"

/**
 * Home discovery - Figma nodes 16:15 (section) and 16:19 (editorial card).
 *
 * Presentation upgrade only. The catalog read boundary is untouched: rows
 * still arrive through publicCatalogDataSource via loadPackages / loadOffers,
 * and only the title and summary those rows carry are rendered. The card
 * media is the canonical navy-to-gold gradient placeholder from node 16:20,
 * not a fabricated photograph.
 */
const limitHomeCatalogRows = rows => Object.freeze(rows.slice(0, 3))

const EYEBROW = Object.freeze({ package: "باقة منشورة", offer: "عرض منشور" })

export function HomePublicCatalogSection({ type, heading, description, destination, dataSource = publicCatalogDataSource }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: "loading", rows: [] })
  useEffect(() => {
    let current = true
    setState({ status: "loading", rows: [] })
    const load = type === "package" ? dataSource.loadPackages : dataSource.loadOffers
    Promise.resolve().then(() => load.call(dataSource)).then(rows => {
      if (current) setState({ status: "ready", rows: limitHomeCatalogRows(rows) })
    }).catch(() => { if (current) setState({ status: "error", rows: [] }) })
    return () => { current = false }
  }, [attempt, dataSource, type])

  const empty = type === "package" ? "لا توجد باقات منشورة متاحة حاليًا." : "لا توجد عروض منشورة متاحة حاليًا."
  const gridClass = type === "package" ? "utility-card-grid" : "home-offers-grid"
  const cardClass = type === "package" ? "package-card" : "offer-card"
  return <section className={`home-section home-discovery-v2${type === "offer" ? " home-offers-section" : ""}`} data-home-public-catalog={type}>
    <Container>
      <SectionHeading title={heading} text={description}/>
      <p className="home-discovery-v2__truth">محتوى منشور فعليًا فقط — بدون أسعار أو توفر مُختلق</p>
      {state.status === "loading" && <p className="home-discovery-v2__status" role="status"><Spinner/>جارٍ تحميل المحتوى المنشور…</p>}
      {state.status === "error" && <div className="home-discovery-v2__error v2-no-motion" role="alert"><p>تعذر تحميل المحتوى المنشور حاليًا.</p><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</Button></div>}
      {state.status === "ready" && state.rows.length === 0 && <p className="home-discovery-v2__empty">{empty}</p>}
      {state.status === "ready" && state.rows.length > 0 && <div className={`${gridClass} home-discovery-v2__grid`}>{state.rows.map(row => <Link to={destination} key={row.id} className={`${cardClass} home-discovery-v2__card`}><div className="home-discovery-v2__media" aria-hidden="true"/><Badge accent>{EYEBROW[type]}</Badge><div><h3>{row.title}</h3><p>{row.summary}</p></div></Link>)}</div>}
    </Container>
  </section>
}
