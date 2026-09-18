import { useState } from "react"
import { BANKAK_RECEIPT_MIME_TYPES, MAX_BANKAK_RECEIPT_BYTES, bankakReceiptUploadDataSource } from "../../../services/bankakReceiptUploadDataSource.js"

/**
 * Bankak receipt upload — V2 presentation over the existing upload authority.
 *
 * The data source, accepted MIME types, size bound and server inspection are
 * unchanged. Acceptance means the receipt was received and the payment is now
 * under review; it never means the payment, the booking or a ticket.
 */
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
  if (state === "accepted") return <section className="bankak-receipt bankak-receipt-v2 bankak-receipt-v2--accepted v2-no-motion" role="status"><p className="bankak-receipt-v2__headline">تم استلام الإيصال وأصبح الدفع قيد المراجعة.</p><p className="bankak-receipt-v2__note">هذا لا يعني تأكيد الحجز أو إصدار التذكرة.</p></section>
  return <form className="bankak-receipt bankak-receipt-v2" onSubmit={submit}><label className="bankak-receipt-v2__field">إيصال التحويل<input className="bankak-receipt-v2__input" type="file" accept="image/jpeg,image/png,application/pdf" onChange={select} disabled={state === "uploading"}/></label><small className="bankak-receipt-v2__note">JPG أو PNG أو PDF، بحد أقصى 10 MB.</small>{file && <p className="bankak-receipt-v2__note">الملف المحدد: {file.name}</p>}{state === "uploading" && <p className="bankak-receipt-v2__note" role="status">جارٍ رفع الإيصال وفحصه…</p>}{state === "error" && <p className="bankak-receipt-v2__error v2-no-motion" role="alert">تعذر رفع الإيصال أو فحصه. تحقق من الملف ثم أعد المحاولة.</p>}<button className="v2-button v2-button--primary bankak-receipt-v2__submit" type="submit" aria-busy={state === "uploading" || undefined} disabled={!file || state === "uploading"}>{state === "error" ? "إعادة المحاولة" : "إرسال الإيصال للمراجعة"}</button><p className="bankak-receipt-v2__note">رفع الإيصال لا يؤكد الدفع أو الحجز.</p></form>
}
