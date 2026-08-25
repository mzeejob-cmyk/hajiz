export const V1_PAYMENT_METHODS = Object.freeze(["card", "apple_pay", "google_pay", "bankak"])
export const FUTURE_PAYMENT_METHODS = Object.freeze(["paypal", "samsung_pay", "tabby", "tamara"])

export const PAYMENT_STATUSES = Object.freeze(["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"])
export const BOOKING_STATUSES = Object.freeze(["pending_payment", "payment_confirmed", "processing", "confirmed", "ticketed", "completed"])

const CREATE_CHECKOUT_KEYS = Object.freeze(["offerId", "travelerToken", "paymentMethod", "idempotencyKey", "returnUrl"])
const FORBIDDEN_AUTHORITY_KEYS = Object.freeze([
  "amount", "amountSDG", "currency", "net_cost", "netCost", "sold_price", "soldPrice",
  "commission", "margin", "agent_profit", "status", "reference", "paymentReference",
  "fx_rate_sdg", "fxRateSdg", "provider", "providerMetadata",
])

export function validateCreateCheckoutRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("checkout request must be an object")
  const unknown = Object.keys(input).filter(key => !CREATE_CHECKOUT_KEYS.includes(key))
  if (unknown.length) throw new TypeError(`checkout request contains unsupported fields: ${unknown.join(", ")}`)
  if (!V1_PAYMENT_METHODS.includes(input.paymentMethod)) throw new TypeError("paymentMethod is not enabled in V1")
  for (const key of ["offerId", "travelerToken", "idempotencyKey"]) {
    if (typeof input[key] !== "string" || !input[key].trim()) throw new TypeError(`${key} is required`)
  }
  if (input.returnUrl !== undefined) {
    if (typeof input.returnUrl !== "string") throw new TypeError("returnUrl must be a string")
    const url = new URL(input.returnUrl)
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new TypeError("returnUrl must use HTTPS")
  }
  return Object.freeze(Object.fromEntries(CREATE_CHECKOUT_KEYS.filter(key => input[key] !== undefined).map(key => [key, input[key]])))
}

export function toSafeCheckoutResponse(intent) {
  if (!intent || typeof intent !== "object") throw new TypeError("payment intent is required")
  if (!V1_PAYMENT_METHODS.includes(intent.paymentMethod)) throw new TypeError("paymentMethod is not enabled in V1")
  const response = {
    bookingRef: intent.bookingRef,
    paymentId: intent.paymentId,
    paymentMethod: intent.paymentMethod,
    sourcePrice: {
      sellingAmount: intent.sourcePrice?.sellingAmount,
      currency: intent.sourcePrice?.currency,
    },
    status: intent.status,
    expiresAt: intent.expiresAt ?? null,
  }
  if (intent.paymentMethod === "bankak") Object.assign(response, {
    amountSDG: intent.amountSDG,
    currency: "SDG",
    paymentReference: intent.paymentReference,
    bankAccountDisplayName: intent.bankAccountDisplayName,
    maskedAccountNumber: intent.maskedAccountNumber,
  })
  else if (intent.providerSession !== undefined) response.providerSession = intent.providerSession
  return Object.freeze(response)
}

export function assertNoClientAuthority(input) {
  const supplied = FORBIDDEN_AUTHORITY_KEYS.filter(key => Object.hasOwn(input ?? {}, key))
  if (supplied.length) throw new TypeError(`client-authoritative fields are forbidden: ${supplied.join(", ")}`)
  return true
}
