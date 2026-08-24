export function Price({ amount, currency, className = "" }) {
  return <span className={`price ${className}`.trim()} aria-label={`${amount} ${currency === "SDG" ? "جنيه سوداني" : currency}`}><b dir="ltr">{amount}</b>{currency === "SDG" ? <span>ج.س</span> : <b dir="ltr">AED</b>}</span>
}
