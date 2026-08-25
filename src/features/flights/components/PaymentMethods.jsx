import { Container } from "../../../design-system/primitives/Container.jsx"
import { V1_PAYMENT_METHODS } from "../../../services/contracts/paymentContract.js"
import { resolveFare, resolveItinerary } from "../data/fareOptions.js"
import { PAYMENT_PRESENTATION_METHODS } from "../data/paymentPresentationFixtures.js"
import { BankakPaymentPresentation } from "./BankakPaymentPresentation.jsx"
import { BookingSteps } from "./BookingSteps.jsx"
import { CardPaymentPresentation } from "./CardPaymentPresentation.jsx"
import { WalletPaymentPresentation } from "./WalletPaymentPresentation.jsx"

export function PaymentMethods({ itineraryKey, fareKey, draft, selectedMethod, onMethodChange, onBack, onMissingDraft }) {
  const itinerary = resolveItinerary(itineraryKey)
  const fare = resolveFare(fareKey)
  if (!itinerary || !fare || !draft) return <div className="payment-page fare-invalid" data-view="payment-fallback"><Container><section role="alert"><h1>تعذر عرض خيارات الدفع</h1><p>لم تعد بيانات المراجعة متاحة في هذه الجلسة. ارجع إلى بيانات المسافر ثم راجع الحجز من جديد.</p><button type="button" onClick={onMissingDraft}>العودة إلى بيانات المسافر</button></section></Container></div>
  const method = V1_PAYMENT_METHODS.includes(selectedMethod) ? selectedMethod : "card"
  return <div className="payment-page" data-view="payment" data-method={method}><Container>
    <header className="payment-heading"><button type="button" className="payment-back" onClick={onBack}>← العودة إلى مراجعة الحجز</button><div><h1>{method === "bankak" ? "الدفع عبر بنكك" : "اختر طريقة الدفع"}</h1><p>{method === "bankak" ? "حوّل المبلغ المحدد ثم ارفع إيصال التحويل" : "اختر الوسيلة المناسبة لإكمال عرض الدفع"}</p></div><BookingSteps activeStep={3}/></header>
    <fieldset className="payment-methods" aria-label="طرق الدفع المتاحة"><legend>طريقة الدفع</legend>{PAYMENT_PRESENTATION_METHODS.map((option) => <label key={option.key} className={method === option.key ? "is-selected" : ""}><input type="radio" name="payment-method" value={option.key} checked={method === option.key} onChange={() => onMethodChange(option.key)}/><span><strong dir={option.key.includes("pay") ? "ltr" : undefined}>{option.label}</strong><small dir={option.key === "card" ? "ltr" : undefined}>{option.detail}</small></span></label>)}</fieldset>
    {method === "card" && <CardPaymentPresentation/>}
    {(method === "apple_pay" || method === "google_pay") && <WalletPaymentPresentation method={method}/>}
    {method === "bankak" && <BankakPaymentPresentation sourcePrice={fare}/>}
  </Container></div>
}
