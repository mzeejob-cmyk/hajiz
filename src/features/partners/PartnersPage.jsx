import { useEffect, useState } from "react"
import { Badge, Button, Container, NetworkMark, StatusBadge, Surface } from "../../design-system/index.js"
import { partnerP2DataSource } from "../../services/partnerP2DataSource.js"
import { PARTNER_MODEL, PARTNER_SECTIONS } from "./data/partnerPresentation.js"

const kycLabels = Object.freeze({ NOT_SUBMITTED: "لم يبدأ", PENDING: "قيد المراجعة", VERIFIED: "موثّق", REJECTED: "مرفوض" })
const kycTones = Object.freeze({ NOT_SUBMITTED: "neutral", PENDING: "warning", VERIFIED: "success", REJECTED: "danger" })
const rowLabels = Object.freeze({ PENDING: "قيد الانتظار", EARNED: "مستحقة", REVERSED: "معكوسة", PROCESSING: "قيد المعالجة", PAID: "مدفوعة", FAILED: "متعذرة", UNKNOWN: "غير معروفة" })
const pendingSections = PARTNER_SECTIONS.filter(item => item.state !== "authenticated-p2-read")

function AmountRows({ items, empty, kind }) {
  if (items.length === 0) return <div className="partner-v2__empty"><span aria-hidden="true">—</span><p>{empty}</p></div>
  return <ul className="partner-v2__rows" aria-label={kind}>{items.map(item => <li key={item.id}>
    <div><strong><bdi dir="ltr">{item.amount} {item.currency}</bdi></strong><small>مرجع <bdi dir="ltr">{item.id.slice(0, 8)}</bdi></small></div>
    <StatusBadge tone="neutral">{rowLabels[item.state] ?? "غير معروفة"}</StatusBadge>
  </li>)}</ul>
}

function LoadingState() {
  return <section className="partner-v2__loading" aria-live="polite" aria-busy="true"><span className="partner-v2__loading-mark" aria-hidden="true" /><div><strong>جارٍ تحميل بيانات الشريك</strong><p>نتحقق من الحالة الموثّقة عبر القناة الآمنة.</p></div></section>
}

export default function PartnersPage({ dataSource = partnerP2DataSource }) {
  const [state, setState] = useState("loading")
  const [data, setData] = useState(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => { let active = true; setState("loading"); setData(null); dataSource.load().then(value => { if (active) { setData(value); setState("ready") } }).catch(() => { if (active) setState("error") }); return () => { active = false } }, [dataSource, revision])

  return <div className="partner-v2" dir="rtl" data-partner-v2="trusted-presentation" data-model={PARTNER_MODEL} data-source="authenticated-p2-edge" data-state={state}>
    <header className="partner-v2__hero"><Container className="partner-v2__hero-grid"><div className="partner-v2__intro"><Badge accent>بوابة الشركاء</Badge><h1>تشغيل موثوق خلف كل رحلة</h1><p>رؤية واضحة لحالة الشريك وقيوده المالية الموثّقة، مع إبقاء القرار والتنفيذ في الخادم.</p><div className="partner-v2__authority" role="note"><span aria-hidden="true">✦</span><p><strong>Model B محفوظ.</strong> لا سلطة عمولة أو سعر أو مال في المتصفح، وبيانات المورد الداخلية لا تظهر هنا.</p></div></div><div className="partner-v2__network" aria-hidden="true"><span className="partner-v2__orb partner-v2__orb--one" /><NetworkMark /><span className="partner-v2__orb partner-v2__orb--two" /><small>HAJIZ PARTNER</small></div></Container></header>
    <Container as="main" className="partner-v2__main">
      <nav className="partner-v2__nav" aria-label="أقسام بوابة الشركاء">{PARTNER_SECTIONS.map(item => <span key={item.id} className={item.id === "overview" ? "is-active" : ""} data-contract-state={item.state}>{item.label}{item.state !== "authenticated-p2-read" && <small>قريبًا</small>}</span>)}</nav>
      {state === "loading" && <LoadingState />}
      {state === "error" && <section className="partner-v2__error" aria-live="polite"><span aria-hidden="true">!</span><div><h2>تعذر تحميل بيانات الشريك</h2><p>لم نعرض أي بيانات غير مؤكدة. حاول الاتصال بالقناة الموثّقة مجددًا.</p><Button type="button" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</Button></div></section>}
      {state === "ready" && data && <div className="partner-v2__content" data-boundary="authenticated-p2-read">
        <section className="partner-v2__heading" aria-labelledby="partner-overview-title"><div><span>ملخص موثّق</span><h2 id="partner-overview-title">نظرة عامة</h2><p>القيم المعروضة قادمة كما هي من عقد Partner P2، دون استنتاجات مالية في الواجهة.</p></div><StatusBadge tone={kycTones[data.kycState]}>KYC · {kycLabels[data.kycState]}</StatusBadge></section>
        <section className="partner-v2__overview" aria-label="حالة الشريك"><Surface as="article" elevation="raised" className="partner-v2__metric partner-v2__metric--kyc"><span>حالة التحقق KYC</span><strong>{kycLabels[data.kycState]}</strong><small>للقراءة فقط</small></Surface><Surface as="article" elevation="raised" className="partner-v2__metric"><span>قيود العمولات</span><strong>{data.commissions.length}</strong><small>سجلات موثّقة</small></Surface><Surface as="article" elevation="raised" className="partner-v2__metric"><span>قيود الدفعات</span><strong>{data.payouts.length}</strong><small>لا تنفيذ من المتصفح</small></Surface></section>
        <section className="partner-v2__financial-grid" aria-label="القيود المالية الموثّقة"><Surface as="article" elevation="raised" className="partner-v2__ledger"><header><div><span>سجل موثّق</span><h2>العمولات</h2></div><Badge>{data.commissions.length} قيد</Badge></header><AmountRows items={data.commissions} empty="لا توجد قيود عمولة موثّقة حاليًا." kind="قيود العمولات" /><footer>لا يُحسب إجمالي أو رصيد متاح في المتصفح.</footer></Surface><Surface as="article" elevation="raised" className="partner-v2__ledger"><header><div><span>سجل موثّق</span><h2>الدفعات المستحقة</h2></div><Badge>{data.payouts.length} قيد</Badge></header><AmountRows items={data.payouts} empty="لا توجد دفعات مستحقة موثّقة حاليًا." kind="قيود الدفعات" /><footer>تنفيذ الدفعات غير مفعّل.</footer></Surface></section>
        <section className="partner-v2__unavailable" aria-labelledby="partner-unavailable-title"><div className="partner-v2__unavailable-heading"><span>حدود المنتج الحالية</span><h2 id="partner-unavailable-title">جاهز بصريًا، بانتظار العقد الموثّق</h2><p>لا نعرض بيانات تجريبية أو نفعّل إجراءً غير موجود.</p></div><div className="partner-v2__pending-grid">{pendingSections.map(item => <article key={item.id}><span aria-hidden="true">↗</span><div><h3>{item.label}</h3><p>{item.state === "policy-owned" ? "تحكمه سياسة الخادم ولا يحدده الشريك من المتصفح." : "القسم معلّق حتى يتوفر عقد قراءة موثّق."}</p></div><small>{item.state === "policy-owned" ? "سلطة الخادم" : "قريبًا"}</small></article>)}</div></section>
        <aside className="partner-v2__guard" aria-label="حدود الصلاحية المالية"><NetworkMark /><div><strong>السلطة المالية تبقى في الخادم</strong><p>الرصيد المتاح والمحفظة غير متاحين، وصافي المورد داخلي، ولا يوجد تنفيذ دفعات أو تفعيل مورد حي.</p></div></aside>
      </div>}
    </Container>
  </div>
}
