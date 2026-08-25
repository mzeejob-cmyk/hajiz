import { useState } from "react"

export function CardPaymentPresentation() {
  const [feedback, setFeedback] = useState("")
  return <section className="payment-panel method-presentation" aria-labelledby="card-payment-title">
    <h2 id="card-payment-title">الدفع بالبطاقة</h2>
    <p>سيظهر إدخال البطاقة الآمن من مزود الدفع المعتمد عند تفعيل التكامل.</p>
    <div className="provider-placeholder" aria-label="موضع مزود الدفع الآمن">Visa / Mastercard · Secure provider</div>
    <button type="button" onClick={() => setFeedback("هذا عرض تجريبي فقط. لم يتم إنشاء عملية دفع.")}>متابعة تجريبية</button>
    {feedback && <p className="payment-feedback" role="status" aria-live="polite">{feedback}</p>}
  </section>
}
