import { useState } from "react"
import { Price } from "./Price.jsx"
import { DEMO_BANKAK_ACCOUNT_NAME, DEMO_BANKAK_AMOUNT_SDG, DEMO_BANKAK_EXPIRY, DEMO_BANKAK_MASKED_ACCOUNT, DEMO_BANKAK_PAYMENT_REFERENCE, RECEIPT_PRESENTATION_RULES } from "../data/paymentPresentationFixtures.js"

export function BankakPaymentPresentation({ sourcePrice }) {
  const [fileName, setFileName] = useState("")
  const [feedback, setFeedback] = useState("")
  const validateReceipt = (event) => {
    const file = event.target.files?.[0]
    setFileName("")
    if (!file) return setFeedback("")
    if (!RECEIPT_PRESENTATION_RULES.allowedTypes.includes(file.type)) return setFeedback("نوع الملف غير مدعوم. اختر JPG أو PNG أو PDF.")
    if (file.size > RECEIPT_PRESENTATION_RULES.maxBytes) return setFeedback("حجم الملف أكبر من 10MB.")
    setFileName(file.name)
    setFeedback("تم اختيار الملف محليًا للمعاينة فقط؛ لم يتم رفعه أو حفظه.")
  }

  return <div className="bankak-presentation">
    <section className="payment-panel bankak-amount" aria-labelledby="bankak-amount-title">
      <h2 id="bankak-amount-title">حوّل هذا المبلغ بالضبط</h2>
      <Price amount={DEMO_BANKAK_AMOUNT_SDG} currency="SDG" />
      <p className="demo-disclaimer">قيمة تجريبية للعرض فقط — ليست مبلغ دفع معتمدًا.</p>
      <div className="payment-expiry" aria-label="مهلة الدفع التجريبية">
        <div><bdi dir="ltr">{DEMO_BANKAK_EXPIRY}</bdi><strong>الوقت المتبقي لإكمال الدفع</strong></div>
        <p>هذه مهلة الدفع، وليست مهلة حجز المقعد.</p>
      </div>
    </section>
    <section className="payment-panel bankak-account" aria-labelledby="bankak-account-title">
      <h2 id="bankak-account-title">بيانات حساب بنكك</h2>
      <dl><div><dt>اسم الحساب</dt><dd>{DEMO_BANKAK_ACCOUNT_NAME}</dd></div><div><dt>رقم الحساب</dt><dd dir="ltr">{DEMO_BANKAK_MASKED_ACCOUNT}</dd></div><div><dt>مرجع الدفع</dt><dd dir="ltr">{DEMO_BANKAK_PAYMENT_REFERENCE}</dd></div></dl>
      <p className="demo-disclaimer">بيانات اصطناعية للعرض؛ لا تستخدمها للتحويل.</p>
    </section>
    <section className="payment-panel bankak-receipt" aria-labelledby="bankak-receipt-title">
      <h2 id="bankak-receipt-title">ارفع إيصال التحويل</h2>
      <p>JPG أو PNG أو PDF · الحد الأقصى 10MB</p>
      <label className="receipt-picker"><strong>اسحب الإيصال هنا أو اختر ملفًا</strong><span>تأكد من وضوح المبلغ والمرجع</span><input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={validateReceipt}/></label>
      {fileName && <p className="receipt-file" dir="auto">الملف المختار: {fileName}</p>}
      <button type="button" disabled>رفع الإيصال وإرساله للمراجعة</button>
      <p className="demo-disclaimer">الرفع غير مفعّل في هذا العرض. لا يُرسل الملف ولا يُحفظ.</p>
      {feedback && <p className="payment-feedback" role="status" aria-live="polite">{feedback}</p>}
    </section>
    <aside className="payment-panel payment-summary" aria-label="ملخص الدفع">
      <h2>ملخص الدفع</h2>
      <p>رحلة دبي إلى الخرطوم</p>
      <Price amount={sourcePrice.amount} currency={sourcePrice.currency}/>
      <p>السعر المرجعي للعرض المحدد · مسافر واحد</p>
      <p>مبلغ بنكك أعلاه fixture تجريبي مستقل ولا يُشتق من AED.</p>
    </aside>
  </div>
}
