import { invokeSupplierOperation, requireCapability } from "./flightSupplierContract.js"
import { FlightSupplierBookingExecutionStoreError } from "./flightSupplierBookingExecutionStoreV1.js"
import { createServerDigestV1 } from "../security/serverDigestV1.js"

export const FLIGHT_SUPPLIER_BOOKING_EXECUTION_VERSION = "flight-supplier-booking-execution/v1"

export class FlightSupplierBookingExecutionError extends Error {
  constructor(code) { super(code); this.name = "FlightSupplierBookingExecutionError"; this.code = code }
}

export class SupplierBookingAttemptError extends Error {
  constructor(code, { mayHaveReachedSupplier = false, supplierBookingRef = null } = {}) {
    super(code); this.name = "SupplierBookingAttemptError"; this.code = code; this.mayHaveReachedSupplier = mayHaveReachedSupplier; this.supplierBookingRef = supplierBookingRef
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const idempotency = /^hsb_req_[A-Za-z0-9_-]{16,80}$/
const safeReference = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/
const safeStatus = /^[A-Z0-9][A-Z0-9_-]{0,79}$/
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
const digest = createServerDigestV1

const owner = (value) => {
  if (!value || !uuid.test(value.ownerId) || !["authenticated", "internal-service", "injected-test"].includes(value.source)) throw new FlightSupplierBookingExecutionError("AUTH_REQUIRED")
  return Object.freeze({ ownerId: value.ownerId, source: value.source })
}

const request = (input) => {
  if (!exact(input, ["bookingId", "idempotencyKey", "ownerContext"]) || !uuid.test(input.bookingId) || !idempotency.test(input.idempotencyKey)) throw new FlightSupplierBookingExecutionError("VALIDATION_ERROR")
  const trustedOwner = owner(input.ownerContext)
  return Object.freeze({ ownerId: trustedOwner.ownerId, bookingId: input.bookingId, idempotencyKey: input.idempotencyKey, requestDigest: digest([FLIGHT_SUPPLIER_BOOKING_EXECUTION_VERSION, trustedOwner.ownerId, input.bookingId, input.idempotencyKey]) })
}

const publicResult = (record) => Object.freeze({
  contractVersion: FLIGHT_SUPPLIER_BOOKING_EXECUTION_VERSION,
  executionStatus: ({ PREPARED: "READY", REQUEST_SENT: "PROCESSING", SUBMITTED: "PROCESSING", ACCEPTED: "CONFIRMED", UNKNOWN: "RECONCILIATION_REQUIRED", REJECTED: "REJECTED", FAILED: "FAILED" })[record.executionState] ?? "FAILED",
  bookingId: record.bookingId,
  bookingRef: record.bookingRef,
  bookingStatus: record.bookingStatus,
  reconciliationRequired: record.reconciliationRequired === true,
  supplierAcceptedAt: record.supplierAcceptedAt ?? null,
})

const storeFailure = (failure) => {
  if (!(failure instanceof FlightSupplierBookingExecutionStoreError)) return failure
  const allowed = ["BOOKING_NOT_FOUND", "PAYMENT_NOT_CONFIRMED", "BOOKING_NOT_PAYMENT_CONFIRMED", "PAYMENT_BOOKING_MISMATCH", "BOOKING_LINEAGE_INVALID", "SUPPLIER_IDENTITY_MISMATCH", "SUPPLIER_BOOKING_ALREADY_EXISTS", "SUPPLIER_EXECUTION_IDEMPOTENCY_CONFLICT", "SUPPLIER_EXECUTION_CONFLICT"]
  return new FlightSupplierBookingExecutionError(allowed.includes(failure.code) ? failure.code : "SUPPLIER_EXECUTION_PERSISTENCE_UNAVAILABLE")
}

const travelerToken = (record) => `hst_v1_${digest([record.bookingId, record.bookingIntentId, record.travelerSnapshot, record.contactSnapshot])}`

const validateSupplierResult = (value, expected, acceptedOutcomes) => {
  const keys = ["supplierBookingRef", "providerName", "providerStatusRaw", "operationalOutcome", "privateMetadata", "supplierLocator", "ticketMetadata"]
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new SupplierBookingAttemptError("MALFORMED_SUPPLIER_RESPONSE", { mayHaveReachedSupplier: true })
  if (value.providerName !== expected.provider || !acceptedOutcomes.includes(value.operationalOutcome) || !safeReference.test(value.supplierBookingRef) || !safeStatus.test(value.providerStatusRaw)) throw new SupplierBookingAttemptError("MALFORMED_SUPPLIER_RESPONSE", { mayHaveReachedSupplier: true, supplierBookingRef: safeReference.test(value.supplierBookingRef ?? "") ? value.supplierBookingRef : null })
  if (value.supplierLocator !== undefined && value.supplierLocator !== null && !safeReference.test(value.supplierLocator)) throw new SupplierBookingAttemptError("MALFORMED_SUPPLIER_RESPONSE", { mayHaveReachedSupplier: true, supplierBookingRef: value.supplierBookingRef })
  if (value.ticketMetadata !== undefined) throw new SupplierBookingAttemptError("TICKETING_RESULT_FORBIDDEN", { mayHaveReachedSupplier: true, supplierBookingRef: value.supplierBookingRef })
  return Object.freeze({
    supplierBookingRef: value.supplierBookingRef,
    supplierLocator: value.supplierLocator ?? null,
    operationalOutcome: value.operationalOutcome,
    providerStatusRaw: value.providerStatusRaw,
    responseDigest: digest([value.providerName, value.supplierBookingRef, value.supplierLocator ?? null, value.operationalOutcome, value.providerStatusRaw]),
    safeMetadata: Object.freeze({ contractVersion: FLIGHT_SUPPLIER_BOOKING_EXECUTION_VERSION, operationalOutcome: value.operationalOutcome, providerStatusRaw: value.providerStatusRaw }),
  })
}

const waitForSupplier = (start, timeoutMs, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new SupplierBookingAttemptError("REQUEST_ABORTED", { mayHaveReachedSupplier: false })); return }
  let settled = false
  const finish = (callback, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); callback(value) }
  const abort = () => finish(reject, new SupplierBookingAttemptError("UNKNOWN_OUTCOME", { mayHaveReachedSupplier: true }))
  const timer = setTimeout(() => finish(reject, new SupplierBookingAttemptError("TIMEOUT_AFTER_SEND", { mayHaveReachedSupplier: true })), timeoutMs)
  signal?.addEventListener("abort", abort, { once: true })
  Promise.resolve().then(start).then((value) => finish(resolve, value), (failure) => finish(reject, failure))
})

export function createFlightSupplierBookingExecutionServiceV1({ store, supplierRegistry, timeoutMs = 10_000 }) {
  if (!store?.prepare || !store?.markRequestSent || !store?.complete || !store?.recordFailure || !supplierRegistry?.getByServerProviderName || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new TypeError("trusted supplier booking execution dependencies are required")
  const active = new Map()

  const fail = async (trusted, failure) => {
    const structured = failure instanceof SupplierBookingAttemptError ? failure : new SupplierBookingAttemptError("INTERNAL_FAILURE", { mayHaveReachedSupplier: true })
    const unknown = structured.mayHaveReachedSupplier === true && !["SUPPLIER_REJECTED"].includes(structured.code)
    let record
    try { record = await store.recordFailure({ request: trusted, failureCode: structured.code, unknown, supplierBookingRef: structured.supplierBookingRef }) } catch (storeError) { throw storeFailure(storeError) }
    return publicResult(record)
  }

  const executeOnce = async (trusted, options) => {
    let prepared
    try { prepared = await store.prepare(trusted) } catch (failure) { throw storeFailure(failure) }
    if (prepared.executionState !== "PREPARED") return publicResult(prepared)
    let adapter
    try { adapter = supplierRegistry.getByServerProviderName(prepared.provider); requireCapability(adapter, "create_booking") } catch { return fail(trusted, new SupplierBookingAttemptError("SUPPLIER_CONFIGURATION_UNAVAILABLE", { mayHaveReachedSupplier: false })) }
    if (options.signal?.aborted) return fail(trusted, new SupplierBookingAttemptError("REQUEST_ABORTED", { mayHaveReachedSupplier: false }))
    let claimed
    try { claimed = await store.markRequestSent(trusted) } catch (failure) { throw storeFailure(failure) }
    if (!claimed.shouldSend) return publicResult(claimed)
    let result
    try {
      const raw = await waitForSupplier(() => invokeSupplierOperation(adapter, "create_booking", {
        supplierOfferRef: claimed.providerOfferRef,
        idempotencyKey: claimed.idempotencyKey,
        trustedTravelerToken: travelerToken(claimed),
      }, { signal: options.signal }), timeoutMs, options.signal)
      result = validateSupplierResult(raw, claimed, ["processing", "confirmed"])
    } catch (failure) { return fail(trusted, failure) }
    try {
      const completed = await store.complete({ request: trusted, outcome: result.operationalOutcome === "confirmed" ? "ACCEPTED" : "SUBMITTED", ...result })
      return publicResult(completed)
    } catch (failure) { throw storeFailure(failure) }
  }

  const reconcileOnce = async (trusted, options) => {
    let record
    try { record = await store.prepare(trusted) } catch (failure) { throw storeFailure(failure) }
    if (!["SUBMITTED", "UNKNOWN"].includes(record.executionState) || !record.supplierBookingRef) return publicResult(record)
    let adapter
    try { adapter = supplierRegistry.getByServerProviderName(record.provider); requireCapability(adapter, "get_booking_status") } catch { return publicResult(record) }
    try {
      const raw = await waitForSupplier(() => invokeSupplierOperation(adapter, "get_booking_status", record.supplierBookingRef, { signal: options.signal }), timeoutMs, options.signal)
      const result = validateSupplierResult(raw, record, ["processing", "confirmed"])
      const completed = await store.complete({ request: trusted, outcome: result.operationalOutcome === "confirmed" ? "ACCEPTED" : "SUBMITTED", ...result })
      return publicResult(completed)
    } catch (failure) { return fail(trusted, failure) }
  }

  const once = (mode, input, options = {}) => {
    const trusted = request(input)
    const key = `${mode}:${trusted.ownerId}:${trusted.bookingId}:${trusted.idempotencyKey}`
    const current = active.get(key)
    if (current) return current
    const promise = (mode === "execute" ? executeOnce(trusted, options) : reconcileOnce(trusted, options)).finally(() => { if (active.get(key) === promise) active.delete(key) })
    active.set(key, promise)
    return promise
  }

  return Object.freeze({
    execute: (input, options) => once("execute", input, options),
    reconcile: (input, options) => once("reconcile", input, options),
  })
}
