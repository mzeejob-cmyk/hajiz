import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Container } from "../../../design-system/primitives/Container.jsx"
import { publicCatalogDataSource } from "../../../services/publicCatalogDataSource.js"
import { SectionHeading } from "./SectionHeading.jsx"

const limitHomeCatalogRows = rows => Object.freeze(rows.slice(0, 3))

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
  return <section className={`home-section${type === "offer" ? " home-offers-section" : ""}`} data-home-public-catalog={type}>
    <Container>
      <SectionHeading title={heading} text={description}/>
      {state.status === "loading" && <p role="status">جارٍ تحميل المحتوى المنشور…</p>}
      {state.status === "error" && <div role="alert"><p>تعذر تحميل المحتوى المنشور حاليًا.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></div>}
      {state.status === "ready" && state.rows.length === 0 && <p>{empty}</p>}
      {state.status === "ready" && state.rows.length > 0 && <div className={gridClass}>{state.rows.map(row => <Link to={destination} key={row.id} className={cardClass}><div className={type === "package" ? "neutral-placeholder neutral-placeholder--small" : "offer-placeholder"} aria-hidden="true"/><div><h3>{row.title}</h3><p>{row.summary}</p></div></Link>)}</div>}
    </Container>
  </section>
}
