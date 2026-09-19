/**
 * HAJIZ V2 editorial journey card — Figma nodes 18:37 to 18:40.
 *
 * Pure presentation: it renders the title and summary it is handed and
 * nothing else. Figma's placeholder detail line on node 18:40 is deliberately
 * not reproduced, because the trusted read boundary carries no such
 * structured travel or commercial fields.
 *
 * The gradient media from node 18:38 is decorative and aria-hidden — it
 * stands in for imagery the boundary does not return and must never be read
 * as catalog content. A row with no summary states that plainly.
 */
const MISSING_SUMMARY = "لا يتضمّن هذا الصف وصفًا في المحتوى المتاح."

export function CatalogCard({ id, type, version, title, summary, children }) {
  return (
    <article className="public-catalog-card catalog-v2__card" data-catalog-id={id} data-catalog-type={type} data-catalog-version={version}>
      <div className="catalog-v2__media" aria-hidden="true"/>
      <h2 className="catalog-v2__title">{title}</h2>
      {summary
        ? <p className="catalog-v2__summary">{summary}</p>
        : <p className="catalog-v2__summary catalog-v2__summary--missing" data-summary="absent">{MISSING_SUMMARY}</p>}
      {children}
    </article>
  )
}
