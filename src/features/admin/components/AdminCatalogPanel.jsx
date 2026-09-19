import { useEffect, useState } from "react"
import { Badge, Button, StatusBadge, Surface } from "../../../design-system/index.js"
import { adminCatalogP2DataSource } from "../../../services/adminCatalogP2DataSource.js"

const empty = Object.freeze({ type: "package", title: "", summary: "" })
const stateCopy = Object.freeze({ loading: "جارٍ تحميل المسودات والمنشور", saving: "جارٍ حفظ المسودة", publishing: "جارٍ نشر السجل", error: "تعذر تحميل الكتالوج. حاول مجددًا.", conflict: "تعذر الحفظ؛ ربما تغيرت النسخة. أعد التحميل ثم حاول مجددًا.", ready: "الكتالوج جاهز" })

function CatalogRows({ rows, kind, onEdit, onPublish }) {
  if (rows.length === 0) return <div className="admin-v2__catalog-empty"><span aria-hidden="true">—</span><p>{kind === "draft" ? "لا توجد مسودات." : "لا توجد سجلات منشورة."}</p></div>
  return <ul className="admin-v2__catalog-list">{rows.map(row => <li key={row.id}><div><strong>{row.title}</strong><p><Badge>{row.type === "package" ? "باقة" : "عرض"}</Badge><bdi dir="ltr">v{row.version}</bdi></p><small>{row.summary}</small></div>{kind === "draft" && <div className="admin-v2__catalog-actions"><Button variant="secondary" onClick={() => onEdit(row)}>تعديل</Button><Button onClick={() => onPublish(row)}>نشر</Button></div>}</li>)}</ul>
}

export function AdminCatalogPanel({ dataSource = adminCatalogP2DataSource }) {
  const [state, setState] = useState("loading")
  const [drafts, setDrafts] = useState([])
  const [published, setPublished] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => { let active = true; setState("loading"); Promise.all([dataSource.listDrafts(), dataSource.listPublished()]).then(([nextDrafts, nextPublished]) => { if (active) { setDrafts(nextDrafts); setPublished(nextPublished); setState("ready") } }).catch(() => { if (active) setState("error") }); return () => { active = false } }, [dataSource, revision])
  const reload = () => setRevision(value => value + 1)
  async function save(event) { event.preventDefault(); setState("saving"); try { if (editing) await dataSource.updateDraft({ id: editing.id, version: editing.version, ...form }); else await dataSource.createDraft(form); setEditing(null); setForm(empty); reload() } catch { setState("conflict") } }
  async function publish(row) { setState("publishing"); try { await dataSource.publishDraft({ id: row.id, version: row.version }); reload() } catch { setState("conflict") } }
  function edit(row) { setEditing(row); setForm({ type: row.type, title: row.title, summary: row.summary }); setState("ready") }
  const busy = ["loading", "saving", "publishing"].includes(state)

  return <section className="admin-v2__catalog" data-boundary="admin-authorized-catalog-writes" data-state={state} aria-labelledby="admin-catalog-title">
    <header className="admin-v2__section-heading"><div><span>Admin-authorized Catalog CMS</span><h2 id="admin-catalog-title">إدارة الباقات والعروض</h2><p>هذا النطاق وحده يسمح بالحفظ والنشر؛ سجلات الدفع والحجز أعلاه تبقى للقراءة فقط.</p></div><StatusBadge tone="warning" label="كتابة إدارية" /></header>
    <div className="admin-v2__catalog-status" role="status" aria-live="polite" data-operation-state={state}><span aria-hidden="true" />{stateCopy[state]}</div>
    {(state === "error" || state === "conflict") && <Button variant="secondary" onClick={reload}>إعادة التحميل</Button>}
    {!busy && <div className="admin-v2__catalog-grid"><Surface as="section" elevation="raised"><header><h3>المسودات</h3><Badge>{drafts.length}</Badge></header><CatalogRows rows={drafts} kind="draft" onEdit={edit} onPublish={publish} /></Surface><Surface as="section" elevation="raised"><header><h3>المنشور داخل Admin</h3><Badge>{published.length}</Badge></header><CatalogRows rows={published} kind="published" /></Surface></div>}
    <Surface as="form" elevation="raised" className="admin-v2__catalog-form" onSubmit={save}><header><div><span>محتوى منضبط</span><h3>{editing ? "تعديل المسودة" : "إنشاء مسودة"}</h3></div>{editing && <Badge><bdi dir="ltr">v{editing.version}</bdi></Badge>}</header><label>النوع<select value={form.type} disabled={busy} onChange={event => setForm(value => ({ ...value, type: event.target.value }))}><option value="package">باقة</option><option value="offer">عرض</option></select></label><label>العنوان<input required maxLength="120" value={form.title} disabled={busy} onChange={event => setForm(value => ({ ...value, title: event.target.value }))} /></label><label>الملخص<textarea required maxLength="1000" value={form.summary} disabled={busy} onChange={event => setForm(value => ({ ...value, summary: event.target.value }))} /></label><div className="admin-v2__catalog-form-actions"><Button type="submit" loading={state === "saving"} disabled={busy}>حفظ المسودة</Button>{editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm(empty) }}>إلغاء</Button>}</div></Surface>
  </section>
}
