import { useEffect, useState } from "react"
import { Badge, Button, Container, NetworkMark, StatusBadge, Surface } from "../../design-system/index.js"
import { adminP2DataSource } from "../../services/adminP2DataSource.js"
import { ADMIN_OPS_PRESENTATION } from "./data/adminOpsPresentation.js"
import { AdminCatalogPanel } from "./components/AdminCatalogPanel.jsx"

const domainLabels = Object.freeze({ payment: "الدفع", booking: "الحجز" })
const navigationStates = Object.freeze({ "نظرة عامة": "active", المدفوعات: "read-only", الحجوزات: "read-only", "الباقات والعروض": "admin-write" })

function countBy(rows, field) {
  const counts = new Map()
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1)
  return [...counts.entries()]
}

function Metrics({ rows }) {
  const groups = [["سجلات موثّقة", rows.length, "صفوف تشغيلية"], ["حالات الدفع", countBy(rows, "paymentState").length, "حالات منفصلة"], ["حالات الحجز", countBy(rows, "bookingState").length, "حالات منفصلة"], ["طرق الدفع", countBy(rows, "method").length, "طرق مرصودة"]]
  return <section className="admin-v2__metrics" aria-label="مؤشرات تشغيلية للقراءة فقط">{groups.map(([label, value, detail]) => <Surface as="article" elevation="raised" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></Surface>)}</section>
}

function DomainState({ domain, status }) {
  return <div className="admin-v2__domain"><span>{domainLabels[domain]}</span><StatusBadge tone="neutral" label={status} data-domain={domain} data-status={status} /></div>
}

function Deferred() {
  return <section className="admin-v2__deferred" aria-labelledby="admin-deferred-title"><header><div><span>قدرات محفوظة</span><h2 id="admin-deferred-title">مساحات بانتظار عقود موثّقة</h2><p>لا توجد بيانات تجريبية أو إجراءات تنفيذ لهذه المجالات.</p></div><Badge>غير موصّلة</Badge></header><div className="admin-v2__deferred-grid">{ADMIN_OPS_PRESENTATION.deferred.map((item, index) => <article key={item} data-contract-state="pending-read-only"><span aria-hidden="true">↗</span><div><h3>{ADMIN_OPS_PRESENTATION.deferredLabels[index]}</h3><p>{item === "cms" ? "Catalog CMS الموثّق أدناه يعمل؛ هذا الإدخال القديم لا يمنحه أو يسحب منه صلاحية." : "غير متاح تشغيليًا في الواجهة الحالية."}</p></div><small>معلّق</small></article>)}</div></section>
}

function BankakBoundary() {
  return <Surface as="aside" className="admin-v2__bankak" aria-labelledby="admin-bankak-title"><div className="admin-v2__bankak-mark" aria-hidden="true">ب</div><div><span>مراجعة بنكك</span><h2 id="admin-bankak-title">قدرة محفوظة، وليست إجراءً موصولًا</h2><p>الإسقاط الحالي لا يوفّر هوية دفع موثوقة لمسار المراجعة؛ لذلك لا تظهر أزرار قبول أو رفض أو تأكيد.</p></div><StatusBadge tone="warning" label="مؤجّل بأمان" /></Surface>
}

export default function AdminPage({ dataSource = adminP2DataSource, catalogDataSource }) {
  const [state, setState] = useState("loading")
  const [rows, setRows] = useState([])
  const [revision, setRevision] = useState(0)
  useEffect(() => { let active = true; setState("loading"); setRows([]); dataSource.load().then(value => { if (active) { setRows(value); setState("ready") } }).catch(() => { if (active) setState("error") }); return () => { active = false } }, [dataSource, revision])

  return <div className="admin-v2" dir="rtl" data-admin-v2="operations-console" data-boundary="authenticated-p2-read" data-source="authenticated-p2-edge" data-state={state}>
    <header className="admin-v2__hero"><Container className="admin-v2__hero-grid"><div><Badge accent>الإدارة · Operations</Badge><h1>تشغيل موثوق خلف التجربة</h1><p>مساحة تشغيلية تعرض الحقيقة القادمة من الخادم، وتفصل بوضوح بين القراءة التشغيلية وكتابات المحتوى المعتمدة.</p><div className="admin-v2__scope"><span>العمليات</span><strong>قراءة فقط</strong><i aria-hidden="true" /><span>Catalog CMS</span><strong>كتابة إدارية معتمدة</strong></div></div><div className="admin-v2__network" aria-hidden="true"><NetworkMark /><span>HAJIZ OPS</span></div></Container></header>
    <Container as="main" className="admin-v2__main">
      <nav className="admin-v2__nav" aria-label="تنقل مساحة العمليات">{ADMIN_OPS_PRESENTATION.navigation.map(item => <span className={item === "نظرة عامة" ? "is-active" : ""} key={item} data-authority={navigationStates[item] ?? "pending"}>{item}{item === "الباقات والعروض" && <small>CMS</small>}</span>)}</nav>
      {state === "loading" && <section className="admin-v2__loading" aria-live="polite" aria-busy="true"><span aria-hidden="true" /><div><strong>جارٍ تحميل السجلات الإدارية</strong><p>يتم التحقق من قناة القراءة الموثّقة.</p></div></section>}
      {state === "error" && <section className="admin-v2__error" aria-live="polite"><span aria-hidden="true">!</span><div><h2>تعذر تحميل بيانات الإدارة</h2><p>لم نعرض بيانات بديلة أو قديمة. تحقق من الصلاحية وحاول مجددًا.</p><Button onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</Button></div></section>}
      {state === "ready" && <section className="admin-v2__operations" aria-labelledby="admin-operations-title"><header className="admin-v2__section-heading"><div><span>Authenticated · Read only</span><h2 id="admin-operations-title">نظرة عامة تشغيلية</h2><p>سجلات دفع وحجز موثّقة للقراءة فقط، دون أي صلاحية تعديل من المتصفح.</p></div><StatusBadge tone="info" label="قراءة موثّقة" /></header><Metrics rows={rows} /><Surface as="section" elevation="raised" className="admin-v2__records" aria-labelledby="admin-queue-title"><header><div><span>صفوف موثّقة</span><h2 id="admin-queue-title">سجل الدفع والحجز</h2></div><Badge>{rows.length} سجل</Badge></header>{rows.length === 0 ? <div className="admin-v2__empty"><span aria-hidden="true">—</span><p>لا توجد سجلات متاحة.</p></div> : <ul>{rows.map(row => <li key={`${row.bookingReference}-${row.method}`}><div className="admin-v2__record-primary"><bdi dir="ltr">{row.bookingReference}</bdi><p><bdi dir="ltr">{row.amount} {row.currency}</bdi><span>{row.method}</span></p></div><div className="admin-v2__domains"><DomainState domain="payment" status={row.paymentState} /><DomainState domain="booking" status={row.bookingState} /></div></li>)}</ul>}</Surface><BankakBoundary /><Deferred /></section>}
      <AdminCatalogPanel {...(catalogDataSource ? { dataSource: catalogDataSource } : {})} />
      <aside className="admin-v2__guard" role="note"><NetworkMark /><div><strong>حدود السلطة واضحة</strong><p>السجلات التشغيلية للقراءة فقط؛ صلاحية الكتابة محصورة في Catalog CMS. لا سعر أو مال أو صافي مورد في المتصفح، ولا تفعيل لمورد حي.</p></div></aside>
      <p className="admin-v2__production-note">HAJIZ ليس جاهزًا للإنتاج حتى اكتمال تمكين الموردين وبوابات تقوية Production المتبقية.</p>
    </Container>
  </div>
}
