import { useEffect, useRef, useState } from "react"
import { accountDataSource } from "../../../services/accountDataSource.js"
import { PROFILE_FIELDS, ACCOUNT_PRIVACY_CONTRACT } from "../data/accountPresentation.js"

function PendingCard({ title, copy, contract }) { return <section className="foundation-card" data-state="contract-pending" data-contract={contract}><span>قريباً</span><h2>{title}</h2><p>{copy}</p></section> }

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
  return <div className="foundation-grid" data-boundary="profile-rpc-ready">
    <section className="foundation-card"><h1>الملف الشخصي</h1>
      <p aria-live="polite">{({ loading: "جارٍ تحميل الحساب", saving: "جارٍ الحفظ", saved: "تم الحفظ", error: "تعذر تحميل الحساب أو حفظه. تحقق من تسجيل الدخول.", "signed-out": "تم تسجيل الخروج" })[state]}</p>
      <form onSubmit={save}>{PROFILE_FIELDS.map(field => <label key={field.id}>{field.label}<input value={profile[field.id]} disabled={!field.editable || !editable} maxLength={field.id === "phone" ? 32 : 80} onChange={event => setProfile(p => ({ ...p, [field.id]: event.target.value }))} /></label>)}<button disabled={!editable}>حفظ</button></form>
      {state === "error" && <button onClick={() => setRevision(v => v + 1)}>إعادة المحاولة</button>}
    </section>
    <section className="foundation-card" data-boundary="session-provider"><h2>الجلسة</h2><button onClick={logout} disabled={!editable}>تسجيل الخروج</button></section>
    <aside className="foundation-note">البيانات الشخصية في الذاكرة فقط. سياسة التخزين: {ACCOUNT_PRIVACY_CONTRACT.browserStorage ? "storage" : "memory only"}.</aside>
  </div>
}

export function TravelersFoundation() { return <div className="foundation-grid"><PendingCard title="المسافرون المحفوظون" copy="يوجد intent في رحلة الحجز، لكن لا توجد خدمة قراءة/حفظ حساب معتمدة بعد. لن نخزن جوازاً محلياً." contract="saved-travelers" /></div> }
export function FavoritesFoundation() { return <div className="foundation-grid"><PendingCard title="المفضلة والتفضيلات" copy="حد عرض فقط إلى أن يعتمد backend ملكية السجلات وسياسة الخصوصية." contract="favorites-preferences" /></div> }
