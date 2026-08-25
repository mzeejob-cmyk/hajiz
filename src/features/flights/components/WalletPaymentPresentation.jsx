import { useState } from "react"

export function WalletPaymentPresentation({ method }) {
  const [feedback, setFeedback] = useState("")
  const label = method === "apple_pay" ? "Apple Pay" : "Google Pay"
  return <section className="payment-panel method-presentation" aria-labelledby="wallet-payment-title">
    <h2 id="wallet-payment-title">الدفع عبر <bdi dir="ltr">{label}</bdi></h2>
    <p>سيتم فتح نافذة {label} الآمنة هنا عند تفعيل مزود الدفع المعتمد.</p>
    <button type="button" className="wallet-demo-button" onClick={() => setFeedback(`عرض ${label} محلي فقط. لم يتم استدعاء نافذة دفع.`)}><bdi dir="ltr">{label}</bdi></button>
    {feedback && <p className="payment-feedback" role="status" aria-live="polite">{feedback}</p>}
  </section>
}
