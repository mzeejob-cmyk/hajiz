import { invokeSupplierOperation, requireCapability } from "./flightSupplierContract.js"
import { FlightSupplierTicketingStoreError } from "./flightSupplierTicketingStoreV1.js"
import { createServerDigestV1 } from "../security/serverDigestV1.js"

export const FLIGHT_SUPPLIER_TICKETING_VERSION = "flight-supplier-ticketing/v1"

export class FlightSupplierTicketingError extends Error {
  constructor(code) { super(code); this.name = "FlightSupplierTicketingError"; this.code = code }
}

export class SupplierTicketingAttemptError extends Error {
  constructor(code, { mayHaveReachedSupplier = false } = {}) { super(code); this.name = "SupplierTicketingAttemptError"; this.code = code; this.mayHaveReachedSupplier = mayHaveReachedSupplier }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const keyPattern = /^hst_req_[A-Za-z0-9_-]{16,80}$/
const safeReference = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/
const safeStatus = /^[A-Z0-9][A-Z0-9_-]{0,79}$/
const safeTravelerKey = /^[A-Za-z0-9_-]{1,40}$/
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))

const trustedRequest = (input) => {
  if (!exact(input, ["bookingId", "idempotencyKey", "ownerContext"]) || !uuid.test(input.bookingId) || !keyPattern.test(input.idempotencyKey)) throw new FlightSupplierTicketingError("VALIDATION_ERROR")
  const owner = input.ownerContext
  if (!owner || !uuid.test(owner.ownerId) || !["authenticated", "internal-service", "injected-test"].includes(owner.source)) throw new FlightSupplierTicketingError("AUTH_REQUIRED")
  return Object.freeze({ ownerId: owner.ownerId, bookingId: input.bookingId, idempotencyKey: input.idempotencyKey, requestDigest: createServerDigestV1([FLIGHT_SUPPLIER_TICKETING_VERSION, owner.ownerId, input.bookingId, input.idempotencyKey]) })
}

const publicResult = (record) => Object.freeze({
  contractVersion: FLIGHT_SUPPLIER_TICKETING_VERSION,
  bookingId: record.bookingId,
  bookingRef: record.bookingRef,
  bookingStatus: record.bookingStatus,
  ticketingStatus: ({ PREPARED: "READY", REQUEST_SENT: "PROCESSING", PROCESSING: "PROCESSING", ISSUED: "ISSUED", UNKNOWN: "RECONCILIATION_REQUIRED", REJECTED: "REJECTED", FAILED: "FAILED" })[record.executionState] ?? "FAILED",
  ticketCount: record.ticketCount ?? 0,
  canDownloadTicket: record.canDownloadTicket === true,
  reconciliationRequired: record.reconciliationRequired === true,
  issuedAt: record.issuedAt ?? null,
})

const storeFailure = (failure) => {
  if (!(failure instanceof FlightSupplierTicketingStoreError)) return failure
  const allowed = ["BOOKING_NOT_FOUND", "BOOKING_NOT_CONFIRMED", "B13_ACCEPTED_EXECUTION_REQUIRED", "B13_SUPPLIER_IDENTITY_MISMATCH", "B13_TRAVELER_LINEAGE_INVALID", "TICKETING_IDEMPOTENCY_CONFLICT", "TICKETING_EXECUTION_CONFLICT", "TICKETING_AUTHORITY_CHANGED", "TICKET_EVIDENCE_REQUIRED", "TICKET_EVIDENCE_INVALID"]
  return new FlightSupplierTicketingError(allowed.includes(failure.code) ? failure.code : "TICKETING_PERSISTENCE_UNAVAILABLE")
}

const validateArtifact = (value) => {
  if (!exact(value, ["availability", "artifactRef", "mediaType", "digest"]) || !["NONE", "METADATA_ONLY", "AVAILABLE"].includes(value.availability)) throw new SupplierTicketingAttemptError("MALFORMED_TICKET_RESPONSE", { mayHaveReachedSupplier: true })
  const artifact = value
  if (artifact.availability === "AVAILABLE" && (!safeReference.test(artifact.artifactRef ?? "") || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(artifact.mediaType ?? "") || !/^[a-f0-9]{64}$/.test(artifact.digest ?? ""))) throw new SupplierTicketingAttemptError("MALFORMED_TICKET_RESPONSE", { mayHaveReachedSupplier: true })
  if (artifact.availability !== "AVAILABLE" && (artifact.artifactRef !== null || artifact.mediaType !== null || artifact.digest !== null)) throw new SupplierTicketingAttemptError("MALFORMED_TICKET_RESPONSE", { mayHaveReachedSupplier: true })
  return Object.freeze({ ...artifact })
}

const validateTicketResult = (value, expected) => {
  if (!exact(value, ["providerName", "supplierBookingRef", "providerStatusRaw", "operationalOutcome", "tickets"]) || value.providerName !== expected.provider || value.supplierBookingRef !== expected.supplierBookingRef || !safeReference.test(value.supplierBookingRef) || !safeStatus.test(value.providerStatusRaw) || !["processing", "ticketed"].includes(value.operationalOutcome) || !Array.isArray(value.tickets)) throw new SupplierTicketingAttemptError("MALFORMED_TICKET_RESPONSE", { mayHaveReachedSupplier: true })
  if (value.operationalOutcome === "processing" && value.tickets.length !== 0) throw new SupplierTicketingAttemptError("MALFORMED_TICKET_RESPONSE", { mayHaveReachedSupplier: true })
  if (value.operationalOutcome === "ticketed" && value.tickets.length < 1) throw new SupplierTicketingAttemptError("TICKET_EVIDENCE_REQUIRED", { mayHaveReachedSupplier: true })
  const allowedTravelers = new Set(expected.travelerKeys)
  const travelerKeys = new Set(); const ticketNumbers = new Set()
  const tickets = value.tickets.map((item) => {
    if (!exact(item, ["travelerKey", "ticketNumber", "supplierTicketRef", "issuedAt", "artifact"]) || !safeTravelerKey.test(item.travelerKey) || !allowedTravelers.has(item.travelerKey) || !safeReference.test(item.ticketNumber) || (item.supplierTicketRef !== null && !safeReference.test(item.supplierTicketRef)) || !Number.isFinite(new Date(item.issuedAt).valueOf())) throw new SupplierTicketingAttemptError("MALFORMED_TICKET_RESPONSE", { mayHaveReachedSupplier: true })
    if (travelerKeys.has(item.travelerKey) || ticketNumbers.has(item.ticketNumber)) throw new SupplierTicketingAttemptError("MALFORMED_TICKET_RESPONSE", { mayHaveReachedSupplier: true })
    travelerKeys.add(item.travelerKey); ticketNumbers.add(item.ticketNumber)
    return Object.freeze({ travelerKey: item.travelerKey, ticketNumber: item.ticketNumber, supplierTicketRef: item.supplierTicketRef, issuedAt: new Date(item.issuedAt).toISOString(), artifact: validateArtifact(item.artifact) })
  })
  if (value.operationalOutcome === "ticketed" && (tickets.length !== expected.travelerKeys.length || expected.travelerKeys.some((travelerKey) => !travelerKeys.has(travelerKey)))) throw new SupplierTicketingAttemptError("INCOMPLETE_TICKET_EVIDENCE", { mayHaveReachedSupplier: true })
  return Object.freeze({
    outcome: value.operationalOutcome === "ticketed" ? "ISSUED" : "PROCESSING",
    tickets: Object.freeze(tickets),
    responseDigest: createServerDigestV1([value.providerName, value.supplierBookingRef, value.providerStatusRaw, value.operationalOutcome, tickets]),
    safeMetadata: Object.freeze({ contractVersion: FLIGHT_SUPPLIER_TICKETING_VERSION, operationalOutcome: value.operationalOutcome, providerStatusRaw: value.providerStatusRaw, ticketCount: tickets.length, downloadableArtifacts: tickets.filter((ticket) => ticket.artifact.availability === "AVAILABLE").length }),
  })
}

const waitForSupplier = (start, timeoutMs, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new SupplierTicketingAttemptError("REQUEST_ABORTED", { mayHaveReachedSupplier: false })); return }
  let settled = false
  const finish = (callback, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); callback(value) }
  const abort = () => finish(reject, new SupplierTicketingAttemptError("UNKNOWN_TICKETING_OUTCOME", { mayHaveReachedSupplier: true }))
  const timer = setTimeout(() => finish(reject, new SupplierTicketingAttemptError("TIMEOUT_AFTER_SEND", { mayHaveReachedSupplier: true })), timeoutMs)
  signal?.addEventListener("abort", abort, { once: true })
  Promise.resolve().then(start).then((value) => finish(resolve, value), (failure) => finish(reject, failure))
})

const ticketingOperation = (adapter) => {
  if (adapter?.capabilities?.confirm_booking === true) { requireCapability(adapter, "confirm_booking"); return "confirm_booking" }
  if (adapter?.capabilities?.retrieve_ticket === true) { requireCapability(adapter, "retrieve_ticket"); return "retrieve_ticket" }
  throw new SupplierTicketingAttemptError("TICKETING_CAPABILITY_UNAVAILABLE", { mayHaveReachedSupplier: false })
}

export function createFlightSupplierTicketingServiceV1({ store, supplierRegistry, timeoutMs = 10_000 }) {
  if (!store?.prepare || !store?.markRequestSent || !store?.complete || !store?.recordFailure || !supplierRegistry?.getByServerProviderName || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new TypeError("trusted ticketing dependencies are required")
  const active = new Map()

  const fail = async (request, failure) => {
    const structured = failure instanceof SupplierTicketingAttemptError ? failure : new SupplierTicketingAttemptError("INTERNAL_TICKETING_FAILURE", { mayHaveReachedSupplier: true })
    const unknown = structured.mayHaveReachedSupplier === true && structured.code !== "SUPPLIER_TICKETING_REJECTED"
    try { return publicResult(await store.recordFailure({ request, failureCode: structured.code, unknown })) } catch (storeError) { throw storeFailure(storeError) }
  }

  const invoke = (adapter, operation, record, signal) => operation === "confirm_booking"
    ? invokeSupplierOperation(adapter, operation, { supplierBookingRef: record.supplierBookingRef, idempotencyKey: record.idempotencyKey, travelerKeys: record.travelerKeys }, { signal })
    : invokeSupplierOperation(adapter, operation, record.supplierBookingRef, { signal })

  const executeOnce = async (request, options) => {
    let prepared
    try { prepared = await store.prepare(request) } catch (failure) { throw storeFailure(failure) }
    if (prepared.executionState !== "PREPARED") return publicResult(prepared)
    let adapter; let operation
    try { adapter = supplierRegistry.getByServerProviderName(prepared.provider); operation = ticketingOperation(adapter) } catch { return fail(request, new SupplierTicketingAttemptError("TICKETING_CONFIGURATION_UNAVAILABLE", { mayHaveReachedSupplier: false })) }
    if (options.signal?.aborted) return fail(request, new SupplierTicketingAttemptError("REQUEST_ABORTED", { mayHaveReachedSupplier: false }))
    let claimed
    try { claimed = await store.markRequestSent({ request, operation }) } catch (failure) { throw storeFailure(failure) }
    if (!claimed.shouldSend) return publicResult(claimed)
    try {
      const raw = await waitForSupplier(() => invoke(adapter, operation, claimed, options.signal), timeoutMs, options.signal)
      const result = validateTicketResult(raw, claimed)
      return publicResult(await store.complete({ request, ...result }))
    } catch (failure) { return fail(request, failure) }
  }

  const reconcileOnce = async (request, options) => {
    let record
    try { record = await store.prepare(request) } catch (failure) { throw storeFailure(failure) }
    if (!["REQUEST_SENT", "PROCESSING", "UNKNOWN"].includes(record.executionState)) return publicResult(record)
    let adapter
    try { adapter = supplierRegistry.getByServerProviderName(record.provider); requireCapability(adapter, "retrieve_ticket") } catch { return publicResult(record) }
    try {
      const raw = await waitForSupplier(() => invokeSupplierOperation(adapter, "retrieve_ticket", record.supplierBookingRef, { signal: options.signal }), timeoutMs, options.signal)
      const result = validateTicketResult(raw, record)
      return publicResult(await store.complete({ request, ...result }))
    } catch (failure) { return fail(request, failure) }
  }

  const once = (mode, input, options = {}) => {
    const request = trustedRequest(input); const identity = `${mode}:${request.ownerId}:${request.bookingId}:${request.idempotencyKey}`
    if (active.has(identity)) return active.get(identity)
    const promise = (mode === "execute" ? executeOnce(request, options) : reconcileOnce(request, options)).finally(() => { if (active.get(identity) === promise) active.delete(identity) })
    active.set(identity, promise); return promise
  }

  return Object.freeze({ execute: (input, options) => once("execute", input, options), reconcile: (input, options) => once("reconcile", input, options) })
}
