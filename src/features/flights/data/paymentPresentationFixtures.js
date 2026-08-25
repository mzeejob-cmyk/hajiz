export const PAYMENT_PRESENTATION_METHODS = Object.freeze([
  { key: "card", label: "بطاقة بنكية", detail: "Visa / Mastercard" },
  { key: "apple_pay", label: "Apple Pay", detail: "Apple Pay" },
  { key: "google_pay", label: "Google Pay", detail: "Google Pay" },
  { key: "bankak", label: "بنكك", detail: "تحويل بنكي يدوي" },
])

// Presentation fixtures only. These values are synthetic, non-authoritative, and never persisted.
export const DEMO_BANKAK_AMOUNT_SDG = "742,500"
export const DEMO_BANKAK_ACCOUNT_NAME = "حساب تجريبي للعرض فقط"
export const DEMO_BANKAK_MASKED_ACCOUNT = "•••• ••••"
export const DEMO_BANKAK_PAYMENT_REFERENCE = "DEMO-HJZ-9K4M2"
export const DEMO_BANKAK_EXPIRY = "14:59"

export const RECEIPT_PRESENTATION_RULES = Object.freeze({
  maxBytes: 10 * 1024 * 1024,
  allowedTypes: Object.freeze(["image/jpeg", "image/png", "application/pdf"]),
})
