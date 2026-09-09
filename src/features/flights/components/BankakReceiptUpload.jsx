import { useState } from "react"
import { BANKAK_RECEIPT_MIME_TYPES, MAX_BANKAK_RECEIPT_BYTES, bankakReceiptUploadDataSource } from "../../../services/bankakReceiptUploadDataSource.js"

export function BankakReceiptUpload({ paymentId, dataSource = bankakReceiptUploadDataSource }) {
  const [file, setFile] = useState(null)
  const [state, setState] = useState("idle")
  const select = (event) => { const next = event.target.files?.[0] ?? null; setFile(next); setState(next ? "selected" : "idle") }
  const submit = async (event) => {
    event.preventDefault()
    if (!file || !BANKAK_RECEIPT_MIME_TYPES.includes(file.type) || file.size < 1 || file.size > MAX_BANKAK_RECEIPT_BYTES) { setState("error"); return }
    setState("uploading")
    try { await dataSource.upload({ paymentId, file }); setState("accepted") }
    catch { setState("error") }
  }
  if (state === "accepted") return <section className="bankak-receipt" role="status"><p>تم استلام الإيصال وأصبح الدفع قيد المراجعة.</p><p>هذا لا يعني تأكيد الحجز أو إصدار التذكرة.</p></section>
  return <form className="bankak-receipt" onSubmit={submit}><label>إيصال التحويل<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={select} disabled={state === "uploading"}/></label><small>JPG أو PNG أو PDF، بحد أقصى 10 MB.</small>{file && <p>الملف المحدد: {file.name}</p>}{state === "uploading" && <p role="status">جارٍ رفع الإيصال وفحصه…</p>}{state === "error" && <p role="alert">تعذر رفع الإيصال أو فحصه. تحقق من الملف ثم أعد المحاولة.</p>}<button type="submit" disabled={!file || state === "uploading"}>{state === "error" ? "إعادة المحاولة" : "إرسال الإيصال للمراجعة"}</button><p>رفع الإيصال لا يؤكد الدفع أو الحجز.</p></form>
}
