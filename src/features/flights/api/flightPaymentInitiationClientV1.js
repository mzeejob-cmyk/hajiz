export class FlightPaymentInitiationClientError extends Error {
  constructor(kind) { super(kind); this.name = "FlightPaymentInitiationClientError"; this.kind = kind }
}

const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
const commonKeys = Object.freeze(["contractVersion", "initiationStatus", "bookingRef", "paymentId", "paymentMethod", "paymentStatus", "bookingStatus", "amount", "currency", "expiresAt", "nextAction", "handoff"])
const decimal = (value) => typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && /[1-9]/.test(value)
const safeUrl = (value) => {
  if (value === null) return true
  try { const url = new URL(value); return url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname) } catch { return false }
}

export function parseFlightPaymentInitiationHttpResponseV1(body) {
  if (!exact(body, ["contractVersion", "data"]) || body.contractVersion !== "customer-flight-payment-initiation-http/v1" || !exact(body.data, commonKeys)) throw new TypeError("invalid payment initiation response")
  const data = body.data
  if (data.contractVersion !== "flight-payment-initiation/v1" || data.initiationStatus !== "PAYMENT_INITIATED" || !/^HJZ-[0-9A-F]{12}$/.test(data.bookingRef) || !/^[0-9a-f-]{36}$/i.test(data.paymentId) || !["bankak", "card"].includes(data.paymentMethod) || data.paymentStatus !== "awaiting" || data.bookingStatus !== "pending_payment" || !decimal(data.amount) || !/^(USD|AED|SDG)$/.test(data.currency) || !Number.isFinite(Date.parse(data.expiresAt))) throw new TypeError("invalid payment initiation authority")
  if (data.paymentMethod === "bankak") {
    const keys = ["type", "amount", "currency", "paymentReference", "bankAccountDisplayName", "maskedAccountNumber", "receiptUploadAvailable"]
    if (data.nextAction !== "COMPLETE_BANKAK_TRANSFER" || !exact(data.handoff, keys) || data.handoff.type !== "BANKAK_MANUAL" || !decimal(data.handoff.amount) || data.handoff.currency !== "SDG" || !/^PAY-[0-9A-F]{12}$/.test(data.handoff.paymentReference) || typeof data.handoff.bankAccountDisplayName !== "string" || !data.handoff.bankAccountDisplayName || typeof data.handoff.maskedAccountNumber !== "string" || !data.handoff.maskedAccountNumber || data.handoff.receiptUploadAvailable !== false) throw new TypeError("invalid Bankak handoff")
  } else {
    if (data.nextAction !== "CONTINUE_TO_SECURE_PAYMENT" || !exact(data.handoff, ["type", "sessionToken", "redirectUrl", "live"]) || data.handoff.type !== "PSP_SESSION" || typeof data.handoff.sessionToken !== "string" || !data.handoff.sessionToken || !safeUrl(data.handoff.redirectUrl) || typeof data.handoff.live !== "boolean") throw new TypeError("invalid PSP handoff")
  }
  return Object.freeze({ ...data, handoff: Object.freeze({ ...data.handoff }) })
}

const errorKind = (response) => {
  const code = response?.body?.error?.code
  const byCode = {
    AUTH_REQUIRED: "auth_required",
    BOOKING_INTENT_NOT_FOUND: "intent_not_found",
    INTENT_EXPIRED: "intent_expired",
    OFFER_UNAVAILABLE: "unavailable",
    REPRICE_REQUIRED: "reprice_required",
    BOOKING_INTENT_CONFLICT: "conflict",
    PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT: "conflict",
    REQUEST_TIMEOUT: "timeout",
    PSP_TIMEOUT: "timeout",
    REPRICE_UNAVAILABLE: "service_unavailable",
    PSP_CONFIGURATION_UNAVAILABLE: "configuration_unavailable",
    PAYMENT_CONFIGURATION_UNAVAILABLE: "configuration_unavailable",
    BOOKING_INTENT_PERSISTENCE_UNAVAILABLE: "service_unavailable",
    PAYMENT_INITIATION_PERSISTENCE_UNAVAILABLE: "service_unavailable",
    PSP_INITIATION_FAILED: "provider_failed",
    VALIDATION_ERROR: "validation_error",
  }
  return byCode[code] ?? ({ 400: "validation_error", 401: "auth_required", 404: "intent_not_found", 409: "conflict", 410: "intent_expired", 502: "provider_failed", 503: "service_unavailable", 504: "timeout" }[response?.status] ?? "internal_error")
}

export function createFlightPaymentInitiationClientV1({ transport }) {
  if (typeof transport !== "function") throw new TypeError("injected payment initiation transport is required")
  return Object.freeze({
    async initiate(request, { signal } = {}) {
      const response = await transport(request, { signal })
      if (response?.status === 200) {
        try { return parseFlightPaymentInitiationHttpResponseV1(response.body) } catch { throw new FlightPaymentInitiationClientError("internal_error") }
      }
      throw new FlightPaymentInitiationClientError(errorKind(response))
    },
  })
}
