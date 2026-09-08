import { useEffect, useState } from "react"
import { partnerP2DataSource } from "../../services/partnerP2DataSource.js"
import { PARTNER_MODEL, PARTNER_SECTIONS } from "./data/partnerPresentation.js"

const labels = Object.freeze({ NOT_SUBMITTED: "لم يبدأ", PENDING: "قيد المراجعة", VERIFIED: "موثّق", REJECTED: "مرفوض" })

export default function PartnersPage({ dataSource = partnerP2DataSource }) {
  const [state, setState] = useState("loading"), [data, setData] = useState(null), [revision, setRevision] = useState(0)
  useEffect(() => { let active = true; setState("loading"); setData(null); dataSource.load().then(value => { if (active) { setData(value); setState("ready") } }).catch(() => { if (active) setState("error") }); return () => { active = false } }, [dataSource, revision])
  return <div className="portal-foundation" dir="rtl" data-model={PARTNER_MODEL} data-source="authenticated-p2-edge" data-state={state}><aside><bdi dir="ltr">HAJIZ Partner</bdi>{PARTNER_SECTIONS.map((item, index) => <span key={item.id} className={index === 0 ? "is-active" : ""} data-contract-state={item.state}>{item.label}</span>)}</aside><main><header><span>بوابة الشركاء</span><h1>لوحة الشريك</h1><p>قراءة موثّقة وفق Model B؛ دون صلاحية مالية أو تنفيذ دفعات.</p></header>
    {state === "loading" && <section className="foundation-card" aria-live="polite">جارٍ تحميل بيانات الشريك</section>}
    {state === "error" && <section className="foundation-card" aria-live="polite"><p>تعذر تحميل بيانات الشريك. حاول مجددًا.</p><button type="button" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button></section>}
    {state === "ready" && data && <section className="foundation-grid" data-boundary="authenticated-p2-read"><article className="foundation-card"><span>حالة الشريك الموثّقة</span><h2>نظرة عامة</h2><dl><dt>حالة KYC</dt><dd>{labels[data.kycState]}</dd><dt>قيود العمولات</dt><dd>{data.commissions.length}</dd><dt>قيود الدفعات</dt><dd>{data.payouts.length}</dd></dl><p>الرصيد المتاح: غير متاح</p><p>المحفظة: غير متاحة</p></article><article className="foundation-card"><h2>العمولات</h2>{data.commissions.length === 0 ? <p>لا توجد قيود عمولة.</p> : <ul className="partner-p2-list">{data.commissions.map(item => <li key={item.id}><bdi dir="ltr">{item.amount} {item.currency}</bdi><span>{item.state}</span></li>)}</ul>}</article><article className="foundation-card"><h2>الدفعات المستحقة</h2>{data.payouts.length === 0 ? <p>لا توجد دفعات مستحقة.</p> : <ul className="partner-p2-list">{data.payouts.map(item => <li key={item.id}><bdi dir="ltr">{item.amount} {item.currency}</bdi><span>{item.state}</span></li>)}</ul>}<p>تنفيذ الدفعات غير مفعّل.</p></article><article className="foundation-card"><h2>التحقق KYC</h2><p>الحالة للقراءة فقط: {labels[data.kycState]}</p></article></section>}
  </main></div>
}
