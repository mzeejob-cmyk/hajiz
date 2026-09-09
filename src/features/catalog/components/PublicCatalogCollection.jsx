import { useEffect, useReducer, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { publicCatalogDataSource } from "../../../services/publicCatalogDataSource.js"
import { accountP2DataSource } from "../../../services/accountP2DataSource.js"
import { useAuthSession } from "../../auth/authSessionContext.js"
import { catalogFavoritesReducer, EMPTY_FAVORITES_STATE, favoriteItemKey, findCatalogFavorite, visibleFavoritesState } from "../data/catalogFavoritesState.js"

const copy = {
  package: { loading: "جارٍ تحميل الباقات المنشورة", empty: "لا توجد باقات منشورة متاحة حاليًا.", error: "تعذر تحميل الباقات المنشورة." },
  offer: { loading: "جارٍ تحميل العروض المنشورة", empty: "لا توجد عروض منشورة متاحة حاليًا.", error: "تعذر تحميل العروض المنشورة." },
}

export function PublicCatalogCollection({ type, dataSource = publicCatalogDataSource, favoritesDataSource = accountP2DataSource }) {
  const session = useAuthSession()
  const location = useLocation()
  const [request, setRequest] = useState({ state: "loading", rows: [] })
  const [attempt, setAttempt] = useState(0)
  const [favoritesAttempt, setFavoritesAttempt] = useState(0)
  const [favoriteState, dispatchFavorite] = useReducer(catalogFavoritesReducer, EMPTY_FAVORITES_STATE)
  const generation = useRef(0)
  const operationSequence = useRef(0)
  const busyOperations = useRef(new Map())
  const sessionRef = useRef(session)
  sessionRef.current = session
  useEffect(() => {
    let active = true
    setRequest({ state: "loading", rows: [] })
    const operation = type === "package" ? dataSource.loadPackages : dataSource.loadOffers
    operation().then(rows => { if (active) setRequest({ state: "ready", rows }) }).catch(() => { if (active) setRequest({ state: "error", rows: [] }) })
    return () => { active = false }
  }, [type, dataSource, attempt])

  const ownerId = session.status === "signed_in" ? session.user.id : null
  useEffect(() => {
    const requestGeneration = ++generation.current
    busyOperations.current.clear()
    dispatchFavorite({ type: "owner", ownerId, generation: requestGeneration })
    if (!ownerId) return
    let active = true
    favoritesDataSource.listFavorites()
      .then(rows => { if (active) dispatchFavorite({ type: "load_success", ownerId, generation: requestGeneration, rows }) })
      .catch(() => { if (active) dispatchFavorite({ type: "load_error", ownerId, generation: requestGeneration }) })
    return () => { active = false }
  }, [ownerId, favoritesDataSource, favoritesAttempt])

  useEffect(() => () => { generation.current += 1; busyOperations.current.clear() }, [])

  const visibleFavorites = visibleFavoritesState(favoriteState, session)
  async function toggleFavorite(row) {
    const activeSession = sessionRef.current
    const capturedOwnerId = activeSession.status === "signed_in" ? activeSession.user.id : null
    const currentState = visibleFavoritesState(favoriteState, activeSession)
    if (!capturedOwnerId || !currentState || currentState.status !== "ready") return
    const itemKey = favoriteItemKey(type, row.id)
    if (busyOperations.current.has(itemKey)) return
    const operationId = `${generation.current}:${++operationSequence.current}`
    const capturedGeneration = generation.current
    busyOperations.current.set(itemKey, operationId)
    dispatchFavorite({ type: "mutation_start", ownerId: capturedOwnerId, generation: capturedGeneration, itemKey, operationId })
    const existing = findCatalogFavorite(currentState.rows, type, row.id)
    try {
      if (existing) {
        await favoritesDataSource.deleteFavorite(existing.id)
        dispatchFavorite({ type: "delete_success", ownerId: capturedOwnerId, generation: capturedGeneration, itemKey, operationId, favoriteId: existing.id })
      } else {
        const saved = await favoritesDataSource.saveFavorite({ kind: type, canonicalId: row.id })
        dispatchFavorite({ type: "save_success", ownerId: capturedOwnerId, generation: capturedGeneration, itemKey, operationId, row: saved })
      }
    } catch {
      dispatchFavorite({ type: "mutation_error", ownerId: capturedOwnerId, generation: capturedGeneration, itemKey, operationId })
    } finally {
      if (busyOperations.current.get(itemKey) === operationId) busyOperations.current.delete(itemKey)
    }
  }

  if (request.state === "loading") return <section className="public-catalog-state" role="status" aria-live="polite">{copy[type].loading}</section>
  if (request.state === "error") return <section className="public-catalog-state" role="alert"><p>{copy[type].error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></section>
  if (request.rows.length === 0) return <section className="public-catalog-state" role="status">{copy[type].empty}</section>
  return <><section className="public-catalog-grid" aria-live="polite">{request.rows.map(row => {
    const itemKey = favoriteItemKey(type, row.id)
    const existing = visibleFavorites?.status === "ready" ? findCatalogFavorite(visibleFavorites.rows, type, row.id) : null
    const busy = Boolean(visibleFavorites?.busy[itemKey])
    return <article className="public-catalog-card" key={row.id} data-catalog-id={row.id} data-catalog-type={row.type} data-catalog-version={row.version}>
      <h2>{row.title}</h2><p>{row.summary}</p>
      <div className="public-catalog-favorite">
        {session.status === "signed_out" ? <Link to="/login" state={{ returnTo: location.pathname + location.search + location.hash }}>تسجيل الدخول للحفظ</Link> : null}
        {session.status === "signed_in" && visibleFavorites?.status === "ready" ? <button type="button" disabled={busy} onClick={() => toggleFavorite(row)}>{busy ? (existing ? "جارٍ الإزالة" : "جارٍ الحفظ") : (existing ? "إزالة من المفضلة" : "حفظ في المفضلة")}</button> : null}
        {(session.status === "checking" || session.status === "error" || (session.status === "signed_in" && visibleFavorites?.status === "loading")) ? <span className="public-catalog-favorite-status">جارٍ التحقق من حالة المفضلة</span> : null}
      </div>
    </article>
  })}</section>
  {session.status === "signed_in" && visibleFavorites?.status === "error" ? <section className="public-catalog-favorite-error" role="alert"><p>{visibleFavorites.error}</p><button type="button" onClick={() => setFavoritesAttempt(value => value + 1)}>إعادة المحاولة</button></section> : null}
  {session.status === "signed_in" && visibleFavorites?.error && visibleFavorites.status === "ready" ? <p className="public-catalog-favorite-error" role="alert">{visibleFavorites.error}</p> : null}</>
}
