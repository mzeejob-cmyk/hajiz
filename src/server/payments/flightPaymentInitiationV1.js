import { createHash } from "node:crypto"
import { assertCustomerPriceV1, createCustomerPriceV1, priceFlightOfferV1 } from "../pricing/pricingFxV1.js"
import { requireCapability as requireSupplierCapability } from "../suppliers/flightSupplierContract.js"
import { assertCapability as assertPspCapability } from "../../services/payments/psp/adapter.js"
import { resolveServerConfiguredAdapter } from "../../services/payments/psp/registry.js"
import { FlightBookingIntentStoreError } from "../bookings/flightBookingIntentStoreV1.js"
import { FlightPaymentInitiationStoreError } from "./flightPaymentInitiationStoreV1.js"

export const FLIGHT_PAYMENT_INITIATION_VERSION = "flight-payment-initiation/v1"
export const FLIGHT_PAYMENT_INITIATION_METHODS = Object.freeze(["bankak", "card"])

export class FlightPaymentInitiationError extends Error {
  constructor(code) { super(code); this.name = "FlightPaymentInitiationError"; this.code = code }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const intentId = /^hbi_v1_[0-9a-f]{32}$/
const idempotency = /^hpi_req_[A-Za-z0-9_-]{16,80}$/
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const requiredText = (value, label, max = 512) => {
  const hasControlCharacter = typeof value === "string" && [...value].some((character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)
  if (typeof value !== "string" || !value.trim() || value.length > max || hasControlCharacter) throw new TypeError(`${label} is invalid`)
  return value
}
const positiveAmount = (value, label) => {
  const amount = requiredText(value, label, 64)
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount) || !/[1-9]/.test(amount)) throw new TypeError(`${label} is invalid`)
  return amount
}
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
const snapshot = (all, base, quote) => all?.[`${base}_${quote}`]

const normalizeIntent = (input) => Object.freeze({
  bookingIntentId: input.bookingIntentId ?? input.booking_intent_id,
  ownerId: input.ownerId ?? input.owner_id,
  status: input.status,
  internalOfferId: input.internalOfferId ?? input.internal_offer_id,
  provider: input.provider,
  providerOfferRef: input.providerOfferRef ?? input.provider_offer_ref,
  itinerary: input.itinerary ?? input.itinerary_snapshot,
  fare: input.fare ?? input.fare_snapshot,
  customerPrice: input.customerPrice ?? input.customer_price_snapshot,
  passengerComposition: input.passengerComposition ?? input.passenger_composition,
  travelers: input.travelers ?? input.traveler_snapshot,
  contact: input.contact ?? input.contact_snapshot,
  validUntil: input.validUntil ?? input.valid_until,
})

const assertOwner = (ownerContext) => {
  if (!ownerContext || !uuid.test(ownerContext.ownerId) || !["authenticated", "injected-test"].includes(ownerContext.source)) throw new FlightPaymentInitiationError("AUTH_REQUIRED")
  return Object.freeze({ ownerId: ownerContext.ownerId, source: ownerContext.source })
}

const assertIntent = (value, ownerId, now) => {
  const intent = normalizeIntent(value)
  if (!intentId.test(intent.bookingIntentId) || intent.ownerId !== ownerId) throw new FlightPaymentInitiationError("BOOKING_INTENT_NOT_FOUND")
  if (intent.status !== "READY_FOR_PAYMENT") throw new FlightPaymentInitiationError("BOOKING_INTENT_CONFLICT")
  if (!Number.isFinite(Date.parse(intent.validUntil)) || Date.parse(intent.validUntil) <= now) throw new FlightPaymentInitiationError("INTENT_EXPIRED")
  if (!Array.isArray(intent.travelers) || !intent.travelers.length || !intent.contact || typeof intent.contact !== "object" || Array.isArray(intent.contact)) throw new FlightPaymentInitiationError("BOOKING_INTENT_INCOMPLETE")
  try { assertCustomerPriceV1(intent.customerPrice, intent.internalOfferId) } catch { throw new FlightPaymentInitiationError("BOOKING_INTENT_INCOMPLETE") }
  if (Date.parse(intent.customerPrice.validUntil) <= now) throw new FlightPaymentInitiationError("INTENT_EXPIRED")
  requiredText(intent.provider, "intent provider", 64)
  requiredText(intent.providerOfferRef, "intent provider offer reference")
  return intent
}

export function createFlightPaymentCommercialRevalidatorV1({ supplierRegistry, pricingPolicy, fxSnapshotsByPair, clock = Date.now }) {
  if (!supplierRegistry?.getByServerProviderName || typeof clock !== "function") throw new TypeError("trusted payment commercial revalidation dependencies are required")
  return Object.freeze({
    async revalidate(intent, { signal } = {}) {
      let adapter
      try { adapter = supplierRegistry.getByServerProviderName(intent.provider); requireSupplierCapability(adapter, "reprice") } catch { throw new FlightPaymentInitiationError("REPRICE_UNAVAILABLE") }
      let offer
      try { offer = await adapter.repriceOffer(intent.providerOfferRef, { signal }) } catch (error) {
        if (error?.name === "AbortError" || error?.code === "REQUEST_TIMEOUT") throw new FlightPaymentInitiationError("REQUEST_TIMEOUT")
        throw new FlightPaymentInitiationError("REPRICE_UNAVAILABLE")
      }
      if (!offer || offer.operationalOutcome === "unavailable") throw new FlightPaymentInitiationError("OFFER_UNAVAILABLE")
      if (offer.internalOfferId !== intent.internalOfferId || offer.provider !== intent.provider || offer.providerOfferRef !== intent.providerOfferRef) throw new FlightPaymentInitiationError("REPRICE_UNAVAILABLE")
      const now = new Date(clock()).toISOString()
      let current
      try {
        const priced = priceFlightOfferV1(offer, { pricingPolicy, supplierFxSnapshot: snapshot(fxSnapshotsByPair, offer.economics.supplierCurrency, "USD"), now })
        current = createCustomerPriceV1(priced, { displayFxSnapshot: snapshot(fxSnapshotsByPair, "USD", intent.customerPrice.currency), customerCurrency: intent.customerPrice.currency, now })
      } catch { throw new FlightPaymentInitiationError("REPRICE_UNAVAILABLE") }
      if (current.amount !== intent.customerPrice.amount || current.currency !== intent.customerPrice.currency) throw new FlightPaymentInitiationError("REPRICE_REQUIRED")
      if (Date.parse(current.validUntil) <= clock()) throw new FlightPaymentInitiationError("INTENT_EXPIRED")
      return Object.freeze({ currentCustomerPrice: current, offer })
    },
  })
}

const validServerUrl = (value) => {
  const url = new URL(requiredText(value, "PSP return URL", 2048))
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new TypeError("PSP return URL is not allow-listed")
  return url.toString()
}

const validatePspSession = (value, redirectUrlHosts) => {
  const keys = ["providerPaymentId", "providerSession", "normalizedStatus", "expiresAt", "redirectUrl"]
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new FlightPaymentInitiationError("PSP_INITIATION_FAILED")
  if (value.normalizedStatus !== "awaiting") throw new FlightPaymentInitiationError("PSP_INITIATION_FAILED")
  const providerPaymentId = requiredText(value.providerPaymentId, "provider payment ID")
  const providerSession = requiredText(value.providerSession, "provider session", 4096)
  let redirectUrl = null
  if (value.redirectUrl !== undefined && value.redirectUrl !== null) {
    redirectUrl = validServerUrl(value.redirectUrl)
    const host = new URL(redirectUrl).hostname.toLowerCase()
    if (!redirectUrlHosts.includes(host)) throw new FlightPaymentInitiationError("PSP_INITIATION_FAILED")
  }
  return Object.freeze({ providerPaymentId, providerSession, redirectUrl, expiresAt: value.expiresAt ?? null })
}

const waitForPsp = (promise, { timeoutMs, signal }) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new FlightPaymentInitiationError("REQUEST_ABORTED")); return }
  let settled = false
  const finish = (callback, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); callback(value) }
  const abort = () => finish(reject, new FlightPaymentInitiationError("REQUEST_ABORTED"))
  const timer = setTimeout(() => finish(reject, new FlightPaymentInitiationError("PSP_TIMEOUT")), timeoutMs)
  signal?.addEventListener("abort", abort, { once: true })
  Promise.resolve(promise).then((value) => finish(resolve, value), (error) => finish(reject, error))
})

const publicResult = (result) => {
  const bankak = result.paymentMethod === "bankak"
  return Object.freeze({
    contractVersion: FLIGHT_PAYMENT_INITIATION_VERSION,
    initiationStatus: "PAYMENT_INITIATED",
    bookingRef: result.bookingRef,
    paymentId: result.paymentId,
    paymentMethod: result.paymentMethod,
    paymentStatus: result.paymentStatus,
    bookingStatus: result.bookingStatus,
    amount: result.amount,
    currency: result.currency,
    expiresAt: result.expiresAt,
    nextAction: bankak ? "COMPLETE_BANKAK_TRANSFER" : "CONTINUE_TO_SECURE_PAYMENT",
    handoff: bankak ? Object.freeze({
      type: "BANKAK_MANUAL",
      amount: result.amountSdg,
      currency: "SDG",
      paymentReference: result.paymentReference,
      bankAccountDisplayName: result.bankAccountDisplayName,
      maskedAccountNumber: result.maskedAccountNumber,
      receiptUploadAvailable: false,
    }) : Object.freeze({
      type: "PSP_SESSION",
      sessionToken: result.providerSession,
      redirectUrl: result.redirectUrl,
      live: result.pspLive === true,
    }),
  })
}

const mapStoreError = (failure) => {
  if (!(failure instanceof FlightPaymentInitiationStoreError)) return failure
  if (failure.code === "PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT") return new FlightPaymentInitiationError("PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT")
  if (failure.code === "PAYMENT_CONFIGURATION_UNAVAILABLE") return new FlightPaymentInitiationError(failure.code)
  return new FlightPaymentInitiationError("PAYMENT_INITIATION_PERSISTENCE_UNAVAILABLE")
}

export function createFlightPaymentInitiationServiceV1({ intentStore, paymentStore, commercialRevalidator, pspRegistry, pspConfig, bankakConfig, clock = Date.now }) {
  if (!intentStore?.resolveForOwner || !paymentStore?.prepare || !paymentStore?.materialize || !commercialRevalidator?.revalidate || typeof clock !== "function") throw new TypeError("trusted payment initiation dependencies are required")
  const active = new Map()
  const initiateOnce = async ({ owner, bookingIntentId, paymentMethod, idempotencyKey }, { signal } = {}) => {
    let rawIntent
    try { rawIntent = await intentStore.resolveForOwner({ ownerId: owner.ownerId, bookingIntentId }) } catch (failure) {
      if (failure instanceof FlightBookingIntentStoreError && failure.code === "BOOKING_INTENT_NOT_FOUND") throw new FlightPaymentInitiationError("BOOKING_INTENT_NOT_FOUND")
      throw new FlightPaymentInitiationError("BOOKING_INTENT_PERSISTENCE_UNAVAILABLE")
    }
    const intent = assertIntent(rawIntent, owner.ownerId, clock())
    await commercialRevalidator.revalidate(intent, { signal })
    const requestDigest = digest([owner.ownerId, bookingIntentId, paymentMethod, intent.internalOfferId, intent.provider, intent.providerOfferRef, intent.customerPrice, intent.validUntil])
    let reservation
    try { reservation = await paymentStore.prepare({ ownerId: owner.ownerId, bookingIntentId, paymentMethod, idempotencyKey, requestDigest }) } catch (failure) { throw mapStoreError(failure) }
    if (reservation.state === "MATERIALIZED") return publicResult(reservation)

    if (paymentMethod === "bankak") {
      if (!bankakConfig || !exact(bankakConfig, ["bankAccountDisplayName", "maskedAccountNumber", "amountSdgResolver"]) || typeof bankakConfig.amountSdgResolver !== "function") throw new FlightPaymentInitiationError("PAYMENT_CONFIGURATION_UNAVAILABLE")
      const safeBankak = Object.freeze({
        bankAccountDisplayName: requiredText(bankakConfig.bankAccountDisplayName, "Bankak display name", 120),
        maskedAccountNumber: requiredText(bankakConfig.maskedAccountNumber, "Bankak masked account", 64),
        amountSdg: positiveAmount(await bankakConfig.amountSdgResolver(intent.customerPrice), "Bankak SDG amount"),
      })
      const paymentExpiresAt = new Date(clock() + 24 * 60 * 60 * 1000).toISOString()
      const handoffDigest = digest(["bankak", safeBankak.bankAccountDisplayName, safeBankak.maskedAccountNumber, safeBankak.amountSdg])
      try { return publicResult(await paymentStore.materialize({ reservation, intent, providerHandoff: null, bankakConfig: safeBankak, paymentExpiresAt, handoffDigest })) } catch (failure) { throw mapStoreError(failure) }
    }

    if (!pspRegistry || !pspConfig || !exact(pspConfig, ["pspProvider", "returnUrl", "redirectUrlHosts", "timeoutMs", "paymentExpiryMs"]) || !Array.isArray(pspConfig.redirectUrlHosts) || pspConfig.redirectUrlHosts.some((host) => typeof host !== "string" || host !== host.toLowerCase() || !/^[a-z0-9.-]+$/.test(host))) throw new FlightPaymentInitiationError("PSP_CONFIGURATION_UNAVAILABLE")
    let adapter
    try { adapter = resolveServerConfiguredAdapter(pspRegistry, pspConfig); assertPspCapability(adapter, "paymentMethods", paymentMethod) } catch { throw new FlightPaymentInitiationError("PSP_CONFIGURATION_UNAVAILABLE") }
    const metadata = adapter.getMetadata()
    if (metadata.conformanceOnly === true || !Number.isInteger(pspConfig.timeoutMs) || pspConfig.timeoutMs < 1 || !Number.isInteger(pspConfig.paymentExpiryMs) || pspConfig.paymentExpiryMs < 60_000 || pspConfig.paymentExpiryMs > 86_400_000) throw new FlightPaymentInitiationError("PSP_CONFIGURATION_UNAVAILABLE")
    let rawSession
    try {
      rawSession = await waitForPsp(adapter.createPaymentSession({
        paymentId: reservation.paymentId,
        paymentReference: reservation.paymentReference,
        paymentMethod,
        amount: intent.customerPrice.amount,
        currency: intent.customerPrice.currency,
        idempotencyKey,
        returnUrl: validServerUrl(pspConfig.returnUrl),
      }), { timeoutMs: pspConfig.timeoutMs, signal })
    } catch (failure) {
      if (failure instanceof FlightPaymentInitiationError) throw failure
      throw new FlightPaymentInitiationError("PSP_INITIATION_FAILED")
    }
    const session = validatePspSession(rawSession, pspConfig.redirectUrlHosts)
    if (session.expiresAt !== null && !Number.isFinite(Date.parse(session.expiresAt))) throw new FlightPaymentInitiationError("PSP_INITIATION_FAILED")
    const paymentExpiresAt = session.expiresAt === null ? new Date(clock() + pspConfig.paymentExpiryMs).toISOString() : new Date(session.expiresAt).toISOString()
    if (Date.parse(paymentExpiresAt) <= clock()) throw new FlightPaymentInitiationError("PSP_INITIATION_FAILED")
    const providerHandoff = Object.freeze({ providerName: metadata.name, providerPaymentId: session.providerPaymentId, providerSession: session.providerSession, redirectUrl: session.redirectUrl, live: metadata.live === true && metadata.mock !== true })
    const handoffDigest = digest([providerHandoff, paymentExpiresAt])
    try { return publicResult(await paymentStore.materialize({ reservation, intent, providerHandoff, bankakConfig: null, paymentExpiresAt, handoffDigest })) } catch (failure) { throw mapStoreError(failure) }
  }

  return Object.freeze({
    initiate(input, options = {}) {
      const owner = assertOwner(input?.ownerContext)
      if (!intentId.test(input?.bookingIntentId) || !FLIGHT_PAYMENT_INITIATION_METHODS.includes(input?.paymentMethod) || !idempotency.test(input?.idempotencyKey)) throw new FlightPaymentInitiationError("VALIDATION_ERROR")
      const activeIdentity = `${owner.ownerId}:${input.idempotencyKey}`
      const fingerprint = `${input.bookingIntentId}:${input.paymentMethod}`
      const existing = active.get(activeIdentity)
      if (existing) {
        if (existing.fingerprint !== fingerprint) return Promise.reject(new FlightPaymentInitiationError("PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT"))
        return existing.promise
      }
      const promise = initiateOnce({ owner, bookingIntentId: input.bookingIntentId, paymentMethod: input.paymentMethod, idempotencyKey: input.idempotencyKey }, options).finally(() => {
        if (active.get(activeIdentity)?.promise === promise) active.delete(activeIdentity)
      })
      active.set(activeIdentity, Object.freeze({ fingerprint, promise }))
      return promise
    },
  })
}
