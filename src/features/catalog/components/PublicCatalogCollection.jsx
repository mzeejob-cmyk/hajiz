import { useEffect, useState } from "react"
import { publicCatalogDataSource } from "../../../services/publicCatalogDataSource.js"

const copy = {
  package: { loading: "جارٍ تحميل الباقات المنشورة", empty: "لا توجد باقات منشورة متاحة حاليًا.", error: "تعذر تحميل الباقات المنشورة." },
  offer: { loading: "جارٍ تحميل العروض المنشورة", empty: "لا توجد عروض منشورة متاحة حاليًا.", error: "تعذر تحميل العروض المنشورة." },
}

export function PublicCatalogCollection({ type, dataSource = publicCatalogDataSource }) {
  const [request, setRequest] = useState({ state: "loading", rows: [] })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setRequest({ state: "loading", rows: [] })
    const operation = type === "package" ? dataSource.loadPackages : dataSource.loadOffers
    operation().then(rows => { if (active) setRequest({ state: "ready", rows }) }).catch(() => { if (active) setRequest({ state: "error", rows: [] }) })
    return () => { active = false }
  }, [type, dataSource, attempt])

  if (request.state === "loading") return <section className="public-catalog-state" role="status" aria-live="polite">{copy[type].loading}</section>
  if (request.state === "error") return <section className="public-catalog-state" role="alert"><p>{copy[type].error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></section>
  if (request.rows.length === 0) return <section className="public-catalog-state" role="status">{copy[type].empty}</section>
  return <section className="public-catalog-grid" aria-live="polite">{request.rows.map(row => <article className="public-catalog-card" key={row.id} data-catalog-id={row.id} data-catalog-type={row.type} data-catalog-version={row.version}><h2>{row.title}</h2><p>{row.summary}</p></article>)}</section>
}
