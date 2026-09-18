import { useEffect, useRef, useState } from "react"
import { accountDataSource } from "../../../services/accountDataSource.js"
import { accountP2DataSource } from "../../../services/accountP2DataSource.js"
import { publicCatalogDataSource } from "../../../services/publicCatalogDataSource.js"
import { PROFILE_FIELDS, ACCOUNT_PRIVACY_CONTRACT } from "../data/accountPresentation.js"
import { joinFavoriteCatalogPresentation, requiredFavoriteCatalogTypes } from "../data/favoriteCatalogPresentation.js"

export function ProfileFoundation({ dataSource = accountDataSource }) {
  const [state, setState] = useState("loading")
  const [profile, setProfile] = useState({ displayName: "", phone: "", email: "" })
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    let active = true
    const version = ++generation.current
    setState("loading")
    setProfile({ displayName: "", phone: "", email: "" })
    dataSource.load().then(value => { if (active && version === generation.current) { setProfile(value); setState("ready") } }).catch(() => { if (active && version === generation.current) setState("error") })
    let unsubscribe = () => {}
    try { unsubscribe = dataSource.subscribe(() => { ++generation.current; setProfile({ displayName: "", phone: "", email: "" }); setState("loading"); setRevision(v => v + 1) }) } catch { setState("error") }
    return () => { active = false; unsubscribe() }
  }, [dataSource, revision])
  async function save(event) {
    event.preventDefault()
    const version = generation.current
    setState("saving")
    try { await dataSource.saveProfile({ displayName: profile.displayName, phone: profile.phone }); if (version === generation.current) setState("saved") }
    catch { if (version === generation.current) setState("error") }
  }
  async function logout() {
    ++generation.current
    setProfile({ displayName: "", phone: "", email: "" })
    setState("loading")
    try { await dataSource.logout(); setState("signed-out") } catch { setState("error") }
  }
  const editable = state === "ready" || state === "saved"
  return <div className="foundation-grid account-v2__grid" data-boundary="profile-rpc-ready">
    <section className="foundation-card account-v2__card"><h1 className="account-v2__card-title">الملف الشخصي</h1><p className="account-v2__card-note">الاسم وبيانات التواصل</p>
      <p className="account-v2__status v2-no-motion" aria-live="polite">{({ loading: "جارٍ تحميل الحساب", saving: "جارٍ الحفظ", saved: "تم الحفظ", error: "تعذر تحميل الحساب أو حفظه. تحقق من تسجيل الدخول.", "signed-out": "تم تسجيل الخروج" })[state]}</p>
      <form className="account-v2__form" onSubmit={save} aria-busy={state === "saving" || undefined}>{PROFILE_FIELDS.map(field => <label className="account-v2__field" key={field.id}><span className="account-v2__label">{field.label}{!field.editable && <span className="account-v2__readonly"> · للقراءة فقط</span>}</span><input className="account-v2__input" value={profile[field.id]} readOnly={!field.editable} aria-readonly={!field.editable || undefined} dir={field.id === "email" ? "ltr" : undefined} disabled={!field.editable || !editable} maxLength={field.id === "phone" ? 32 : 80} onChange={event => setProfile(p => ({ ...p, [field.id]: event.target.value }))} /></label>)}<button className="v2-button v2-button--primary account-v2__submit" disabled={!editable}>حفظ</button></form>
      {state === "error" && <button className="v2-button v2-button--secondary" onClick={() => setRevision(v => v + 1)}>إعادة المحاولة</button>}
    </section>
    <section className="foundation-card account-v2__card" data-boundary="session-provider"><h2 className="account-v2__card-title">الجلسة</h2><button className="v2-button v2-button--secondary account-v2__submit" onClick={logout} disabled={!editable}>تسجيل الخروج</button></section>
    <aside className="foundation-note account-v2__privacy v2-no-motion">البيانات الشخصية في الذاكرة فقط. سياسة التخزين: {ACCOUNT_PRIVACY_CONTRACT.browserStorage ? "storage" : "memory only"}.</aside>
  </div>
}

export function TravelersFoundation({ dataSource = accountP2DataSource }) {
  const [state, setState] = useState("loading"), [travelers, setTravelers] = useState([]), [editingId, setEditingId] = useState(null)
  const [values, setValues] = useState({ firstName: "", lastName: "" }), [revision, setRevision] = useState(0)
  useEffect(() => { let active = true; setState("loading"); dataSource.listTravelers().then(rows => { if (active) { setTravelers(rows); setState("ready") } }).catch(() => { if (active) setState("error") }); return () => { active = false } }, [dataSource, revision])
  async function save(event) { event.preventDefault(); setState("saving"); try { const saved = await dataSource.saveTraveler({ ...(editingId ? { id: editingId } : {}), firstName: values.firstName, lastName: values.lastName }); setTravelers(rows => [...rows.filter(row => row.id !== saved.id), saved]); setValues({ firstName: "", lastName: "" }); setEditingId(null); setState("saved") } catch { setState("validation-error") } }
  async function remove(id) { setState("saving"); try { await dataSource.deleteTraveler(id); setTravelers(rows => rows.filter(row => row.id !== id)); if (editingId === id) { setEditingId(null); setValues({ firstName: "", lastName: "" }) } setState("saved") } catch { setState("error") } }
  function edit(row) { setEditingId(row.id); setValues({ firstName: row.firstName, lastName: row.lastName }); setState("ready") }
  const busy = state === "loading" || state === "saving"
  return <div className="foundation-grid account-v2__grid" data-boundary="authenticated-p2-edge" data-state={state}>
    <section className="foundation-card account-p2-card account-v2__card"><span className="account-v2__chip">حساب موثّق</span><h1 className="account-v2__card-title">المسافرون المحفوظون</h1><p className="account-v2__status v2-no-motion" aria-live="polite">{{ loading: "جارٍ تحميل المسافرين", saving: "جارٍ الحفظ", saved: "تم حفظ التغيير", error: "تعذر تحميل المسافرين. حاول مجددًا.", "validation-error": "تحقق من الاسم الأول واسم العائلة." }[state]}</p>
      {state === "error" && <button className="v2-button v2-button--secondary" type="button" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button>}
      {!busy && travelers.length === 0 && <p className="account-p2-empty account-v2__empty">لا يوجد مسافرون محفوظون.</p>}
      <ul className="account-p2-list account-v2__list">{travelers.map(row => <li className="account-v2__row" key={row.id}><span className="account-v2__row-name">{row.firstName} {row.lastName}</span><div className="account-v2__row-actions"><button className="v2-button v2-button--ghost account-v2__row-action" type="button" onClick={() => edit(row)}>تعديل</button><button className="v2-button v2-button--ghost account-v2__row-action" type="button" onClick={() => remove(row.id)}>حذف</button></div></li>)}</ul>
    </section>
    <section className="foundation-card account-p2-card account-v2__card"><h2 className="account-v2__card-title">{editingId ? "تعديل المسافر" : "إضافة مسافر"}</h2><form className="account-v2__form" onSubmit={save} aria-busy={busy || undefined}><label className="account-v2__field"><span className="account-v2__label">الاسم الأول</span><input className="account-v2__input" name="firstName" required maxLength="80" value={values.firstName} disabled={busy} onChange={event => setValues(current => ({ ...current, firstName: event.target.value }))} /></label><label className="account-v2__field"><span className="account-v2__label">اسم العائلة</span><input className="account-v2__input" name="lastName" required maxLength="80" value={values.lastName} disabled={busy} onChange={event => setValues(current => ({ ...current, lastName: event.target.value }))} /></label><button className="v2-button v2-button--primary account-v2__submit" disabled={busy}>حفظ</button>{editingId && <button className="v2-button v2-button--ghost account-v2__submit" type="button" onClick={() => { setEditingId(null); setValues({ firstName: "", lastName: "" }) }}>إلغاء</button>}</form><p className="account-v2__privacy v2-no-motion">نحفظ الاسم الأول واسم العائلة فقط. لا تُحفظ بيانات الجواز هنا.</p></section>
  </div>
}

const emptyCatalogState = () => ({ package: { status: "idle", rows: [] }, offer: { status: "idle", rows: [] } })
export function FavoritesFoundation({ dataSource = accountP2DataSource, catalogDataSource = publicCatalogDataSource }) {
  const [favoriteState, setFavoriteState] = useState("loading"), [favoritesKnown, setFavoritesKnown] = useState(false), [favorites, setFavorites] = useState([])
  const [preferenceState, setPreferenceState] = useState("loading"), [locale, setLocale] = useState("ar"), [revision, setRevision] = useState(0)
  const [catalogState, setCatalogState] = useState(emptyCatalogState), catalogGeneration = useRef(0)
  useEffect(() => {
    let active = true
    setFavoriteState("loading"); setFavoritesKnown(false); setFavorites([])
    setPreferenceState("loading")
    dataSource.listFavorites().then(rows => { if (active) { setFavorites(rows); setFavoritesKnown(true); setFavoriteState("ready") } }).catch(() => { if (active) setFavoriteState("error") })
    dataSource.loadPreference().then(preference => { if (active) { setLocale(preference?.locale ?? "ar"); setPreferenceState("ready") } }).catch(() => { if (active) setPreferenceState("error") })
    return () => { active = false }
  }, [dataSource, revision])
  useEffect(() => {
    const version = ++catalogGeneration.current
    if (!favoritesKnown) { setCatalogState(emptyCatalogState()); return }
    const required = requiredFavoriteCatalogTypes(favorites)
    setCatalogState({
      package: { status: required.package ? "loading" : "idle", rows: [] },
      offer: { status: required.offer ? "loading" : "idle", rows: [] },
    })
    let active = true
    const load = (kind, operation) => operation().then(rows => {
      if (active && version === catalogGeneration.current) setCatalogState(current => ({ ...current, [kind]: { status: "ready", rows } }))
    }).catch(() => {
      if (active && version === catalogGeneration.current) setCatalogState(current => ({ ...current, [kind]: { status: "error", rows: [] } }))
    })
    if (required.package) load("package", catalogDataSource.loadPackages)
    if (required.offer) load("offer", catalogDataSource.loadOffers)
    return () => { active = false }
  }, [favoritesKnown, favorites, catalogDataSource])
  async function remove(favorite) { setFavoriteState("saving"); try { await dataSource.deleteFavorite(favorite.id); setFavorites(rows => rows.filter(row => row.id !== favorite.id)); setFavoriteState("saved") } catch { setFavoriteState("error") } }
  async function saveLocale(next) { setLocale(next); setPreferenceState("saving"); try { await dataSource.savePreference(next); setPreferenceState("saved") } catch { setPreferenceState("error") } }
  const favoriteBusy = favoriteState === "loading" || favoriteState === "saving"
  const preferenceBusy = preferenceState === "loading" || preferenceState === "saving"
  const catalogError = catalogState.package.status === "error" || catalogState.offer.status === "error"
  const presentedFavorites = joinFavoriteCatalogPresentation({ favorites, packages: catalogState.package.rows, offers: catalogState.offer.rows, packageStatus: catalogState.package.status, offerStatus: catalogState.offer.status })
  return <div className="foundation-grid account-v2__grid" data-boundary="authenticated-p2-edge" data-state={favoriteState} data-catalog-enrichment={catalogError ? "partial" : "available"}>
    <section className="foundation-card account-p2-card account-v2__card"><span className="account-v2__chip">حساب موثّق</span><h1 className="account-v2__card-title">المفضلة</h1><p className="account-v2__status v2-no-motion" aria-live="polite">{{ loading: "جارٍ تحميل المفضلة", saving: "جارٍ حفظ التغيير", saved: "تم حفظ التغيير", ready: "المفضلة جاهزة", error: "تعذر تحميل المفضلة أو تحديثها. حاول مجددًا." }[favoriteState]}</p>{favoriteState === "error" && <button className="v2-button v2-button--secondary" type="button" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button>}{catalogError && <p className="account-catalog-enrichment-error account-v2__partial v2-no-motion" role="status">تعذر تحميل تفاصيل بعض العناصر المحفوظة.</p>}{!favoriteBusy && favoritesKnown && favorites.length === 0 && <p className="account-p2-empty account-v2__empty">لا توجد عناصر مفضلة بعد.</p>}<ul className="account-p2-list account-favorites-list account-v2__list">{presentedFavorites.map(({ favorite, presentation }) => <li className="account-v2__row" key={favorite.id}><div className="account-v2__row-body"><span className="account-v2__chip">{presentation.label}</span><strong className="account-v2__row-name">{presentation.title}</strong><p className="account-v2__row-summary">{presentation.summary}</p>{!presentation.published && <bdi className="account-v2__canonical" dir="ltr">{favorite.canonicalId}</bdi>}</div><button className="v2-button v2-button--ghost account-v2__row-action" type="button" disabled={favoriteBusy} onClick={() => remove(favorite)}>حذف</button></li>)}</ul></section>
    <section className="foundation-card account-p2-card account-v2__card"><h2 className="account-v2__card-title">تفضيل اللغة</h2><p className="account-v2__card-note">يُحفظ الاختيار للحساب دون تغيير لغة التطبيق في هذه المرحلة.</p>{preferenceState === "error" && <p className="account-v2__error v2-no-motion" role="alert">تعذر تحميل تفضيل اللغة أو حفظه.</p>}<fieldset className="account-v2__locale" disabled={preferenceBusy} aria-busy={preferenceBusy || undefined}><legend className="account-v2__label">اللغة المفضلة</legend><label className="account-v2__locale-option"><input type="radio" name="locale" value="ar" checked={locale === "ar"} onChange={() => saveLocale("ar")} /> العربية</label><label className="account-v2__locale-option"><input type="radio" name="locale" value="en" checked={locale === "en"} onChange={() => saveLocale("en")} /> English</label></fieldset></section>
  </div>
}
