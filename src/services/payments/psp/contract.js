import { PAYMENT_STATUSES, V1_PAYMENT_METHODS } from "../../contracts/paymentContract.js"

export const PSP_PAYMENT_METHODS = Object.freeze(["card", "apple_pay", "google_pay"])
export const FROZEN_PAYMENT_STATUSES = PAYMENT_STATUSES

const REQUEST_KEYS = Object.freeze([
  "paymentId", "paymentReference", "paymentMethod", "amount", "currency", "idempotencyKey", "returnUrl",
])
const EVENT_KEYS = Object.freeze([
  "verified", "providerEventId", "providerPaymentId", "normalizedStatus", "amount", "currency", "occurredAt", "rawDigest",
])

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be a plain object`)
}

function assertExactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key))
  if (unknown.length) throw new TypeError(`${label} contains unsupported fields: ${unknown.join(", ")}`)
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} is required`)
  return value
}

function normalizedAmount(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new TypeError("amount must be a positive server-owned value")
  }
  const text = String(value)
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) || !/[1-9]/.test(text)) {
    throw new TypeError("amount must be a positive server-owned decimal value")
  }
  const [whole, fraction = ""] = text.split(".")
  const trimmedFraction = fraction.replace(/0+$/, "")
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

export function validatePaymentSessionRequest(input) {
  assertPlainObject(input, "payment session request")
  assertExactKeys(input, REQUEST_KEYS, "payment session request")
  if (!PSP_PAYMENT_METHODS.includes(input.paymentMethod)) throw new TypeError("paymentMethod is not supported by PSP adapters")
  if (!V1_PAYMENT_METHODS.includes(input.paymentMethod)) throw new TypeError("paymentMethod is not enabled in V1")
  const currency = requiredString(input.currency, "currency")
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("currency must be a three-letter uppercase code")
  const returnUrl = requiredString(input.returnUrl, "returnUrl")
  const url = new URL(returnUrl)
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new TypeError("returnUrl must already be server-allowlisted")
  }
  return Object.freeze({
    paymentId: requiredString(input.paymentId, "paymentId"),
    paymentReference: requiredString(input.paymentReference, "paymentReference"),
    paymentMethod: input.paymentMethod,
    amount: normalizedAmount(input.amount),
    currency,
    idempotencyKey: requiredString(input.idempotencyKey, "idempotencyKey"),
    returnUrl,
  })
}

export function validateNormalizedPaymentEvent(input) {
  assertPlainObject(input, "normalized payment event")
  assertExactKeys(input, EVENT_KEYS, "normalized payment event")
  if (typeof input.verified !== "boolean") throw new TypeError("verified must be boolean")
  if (!FROZEN_PAYMENT_STATUSES.includes(input.normalizedStatus)) throw new TypeError("normalizedStatus is not a frozen HAJIZ payment state")
  const occurredAt = requiredString(input.occurredAt, "occurredAt")
  if (!Number.isFinite(Date.parse(occurredAt))) throw new TypeError("occurredAt must be an ISO timestamp")
  const rawDigest = requiredString(input.rawDigest, "rawDigest")
  if (!/^[a-f0-9]{64}$/.test(rawDigest)) throw new TypeError("rawDigest must be a lowercase SHA-256 digest")
  const currency = requiredString(input.currency, "currency")
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("currency must be a three-letter uppercase code")
  return Object.freeze({
    verified: input.verified,
    providerEventId: requiredString(input.providerEventId, "providerEventId"),
    providerPaymentId: requiredString(input.providerPaymentId, "providerPaymentId"),
    normalizedStatus: input.normalizedStatus,
    amount: normalizedAmount(input.amount),
    currency,
    occurredAt: new Date(occurredAt).toISOString(),
    rawDigest,
  })
}

export function normalizeTrustedProviderEvent(input, trustedPayment, expectedProviderPaymentId) {
  const event = validateNormalizedPaymentEvent(input)
  const trusted = validatePaymentSessionRequest(trustedPayment)
  if (!event.verified) throw new Error("unverified provider event cannot cross the domain handoff")
  if (event.providerPaymentId !== requiredString(expectedProviderPaymentId, "expectedProviderPaymentId")) {
    throw new Error("provider payment identity does not match the trusted payment")
  }
  if (event.amount !== trusted.amount || event.currency !== trusted.currency) {
    throw new Error("provider event economics do not match the trusted payment")
  }
  return event
}

export function toApplyPaymentEventArgs(providerName, event, trustedPayment, expectedProviderPaymentId) {
  const normalized = normalizeTrustedProviderEvent(event, trustedPayment, expectedProviderPaymentId)
  return Object.freeze({
    p_payment_id: trustedPayment.paymentId,
    p_target: normalized.normalizedStatus,
    p_provider: requiredString(providerName, "providerName"),
    p_provider_event_id: normalized.providerEventId,
    p_provider_status: normalized.normalizedStatus,
    p_amount: normalized.amount,
    p_currency: normalized.currency,
    p_verified: true,
    p_payload_digest: normalized.rawDigest,
    p_occurred_at: normalized.occurredAt,
    p_raw_payload: null,
  })
}
