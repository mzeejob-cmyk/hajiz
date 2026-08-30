import { randomUUID } from "node:crypto"

export class FlightSupplierBookingExecutionStoreError extends Error {
  constructor(code) { super(code); this.name = "FlightSupplierBookingExecutionStoreError"; this.code = code }
}

const freeze = (value) => Object.freeze({ ...value })
const byId = (values = []) => new Map(values.map((value) => [value.id, { ...value }]))
const identity = ({ ownerId, idempotencyKey }) => `${ownerId}:${idempotencyKey}`

export function createFlightSupplierBookingExecutionTestStateV1(seed = {}) {
  return {
    bookings: byId(seed.bookings),
    payments: byId(seed.payments),
    intents: byId(seed.intents),
    initiations: new Map((seed.initiations ?? []).map((value) => [value.bookingId, { ...value }])),
    offers: byId(seed.offers),
    operationsByBooking: new Map(),
    operationsByIdentity: new Map(),
  }
}

const requireOperation = (state, request) => {
  const operation = state.operationsByBooking.get(request.bookingId)
  if (!operation || operation.ownerId !== request.ownerId || operation.idempotencyKey !== request.idempotencyKey || operation.requestDigest !== request.requestDigest) {
    throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_EXECUTION_NOT_FOUND")
  }
  return operation
}

const snapshot = (state, operation, extra = {}) => {
  const booking = state.bookings.get(operation.bookingId)
  const payment = state.payments.get(operation.paymentId)
  return freeze({
    ...operation,
    bookingRef: booking?.bookingRef,
    bookingStatus: booking?.status,
    paymentStatus: payment?.status,
    ...extra,
  })
}

export function createProcessLocalFlightSupplierBookingExecutionStoreV1({ state, clock = Date.now } = {}) {
  if (!state?.bookings || typeof clock !== "function") throw new TypeError("explicit non-production supplier execution state is required")
  return Object.freeze({
    durability: "shared-process-test-state-non-production",
    async prepare(request) {
      const booking = state.bookings.get(request.bookingId)
      if (!booking || booking.ownerId !== request.ownerId) throw new FlightSupplierBookingExecutionStoreError("BOOKING_NOT_FOUND")
      const existing = state.operationsByBooking.get(request.bookingId) ?? state.operationsByIdentity.get(identity(request))
      if (existing) {
        if (existing.bookingId !== request.bookingId || existing.ownerId !== request.ownerId || existing.idempotencyKey !== request.idempotencyKey || existing.requestDigest !== request.requestDigest) {
          throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_EXECUTION_IDEMPOTENCY_CONFLICT")
        }
        return snapshot(state, existing, { replayed: true })
      }
      const payment = [...state.payments.values()].find((value) => value.bookingId === booking.id)
      const initiation = state.initiations.get(booking.id)
      const intent = initiation ? state.intents.get(initiation.bookingIntentId) : null
      const offer = state.offers.get(booking.offerId)
      if (!payment || payment.ownerId !== booking.ownerId || payment.id !== initiation?.paymentId) throw new FlightSupplierBookingExecutionStoreError("PAYMENT_BOOKING_MISMATCH")
      if (payment.status !== "confirmed") throw new FlightSupplierBookingExecutionStoreError("PAYMENT_NOT_CONFIRMED")
      if (booking.status !== "payment_confirmed") throw new FlightSupplierBookingExecutionStoreError("BOOKING_NOT_PAYMENT_CONFIRMED")
      if (initiation?.state !== "MATERIALIZED" || !intent || intent.ownerId !== booking.ownerId || initiation.bookingIntentId !== intent.id) throw new FlightSupplierBookingExecutionStoreError("BOOKING_LINEAGE_INVALID")
      if (!offer || booking.supplierProvider !== intent.provider || offer.internalOfferId !== intent.internalOfferId || offer.provider !== intent.provider || offer.providerOfferRef !== intent.providerOfferRef || booking.supplierProvider !== offer.provider) throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_IDENTITY_MISMATCH")
      if (booking.supplierReference) throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_BOOKING_ALREADY_EXISTS")
      if (!Array.isArray(intent.travelers) || !intent.travelers.length || !intent.contact || typeof intent.contact !== "object" || Array.isArray(intent.contact)) throw new FlightSupplierBookingExecutionStoreError("BOOKING_LINEAGE_INVALID")
      const operation = {
        executionId: randomUUID(),
        operationId: randomUUID(),
        bookingId: booking.id,
        paymentId: payment.id,
        bookingIntentId: intent.id,
        ownerId: booking.ownerId,
        provider: intent.provider,
        internalOfferId: intent.internalOfferId,
        providerOfferRef: intent.providerOfferRef,
        travelerSnapshot: intent.travelers,
        contactSnapshot: intent.contact,
        idempotencyKey: request.idempotencyKey,
        requestDigest: request.requestDigest,
        executionState: "PREPARED",
        attemptCount: 0,
        supplierBookingRef: null,
        supplierLocator: null,
        responseDigest: null,
        safeMetadata: {},
        reconciliationRequired: false,
        createdAt: new Date(clock()).toISOString(),
        requestSentAt: null,
        responseReceivedAt: null,
        supplierAcceptedAt: null,
        unknownOutcomeAt: null,
        failureCode: null,
      }
      state.operationsByBooking.set(booking.id, operation)
      state.operationsByIdentity.set(identity(request), operation)
      return snapshot(state, operation, { replayed: false })
    },
    async markRequestSent(request) {
      const operation = requireOperation(state, request)
      if (operation.executionState !== "PREPARED") return snapshot(state, operation, { shouldSend: false, replayed: true })
      const booking = state.bookings.get(operation.bookingId)
      const payment = state.payments.get(operation.paymentId)
      if (payment?.status !== "confirmed") throw new FlightSupplierBookingExecutionStoreError("PAYMENT_NOT_CONFIRMED")
      if (booking?.status !== "payment_confirmed") throw new FlightSupplierBookingExecutionStoreError("BOOKING_NOT_PAYMENT_CONFIRMED")
      booking.status = "processing"
      operation.executionState = "REQUEST_SENT"
      operation.attemptCount = 1
      operation.requestSentAt = new Date(clock()).toISOString()
      return snapshot(state, operation, { shouldSend: true, replayed: false })
    },
    async complete({ request, outcome, supplierBookingRef, supplierLocator = null, responseDigest, safeMetadata }) {
      const operation = requireOperation(state, request)
      if (operation.executionState === "ACCEPTED") {
        if (operation.responseDigest !== responseDigest || operation.supplierBookingRef !== supplierBookingRef) throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_EXECUTION_IDEMPOTENCY_CONFLICT")
        return snapshot(state, operation, { replayed: true })
      }
      if (!["REQUEST_SENT", "SUBMITTED", "UNKNOWN"].includes(operation.executionState)) throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_EXECUTION_CONFLICT")
      if (operation.executionState === "UNKNOWN" && operation.supplierBookingRef && operation.supplierBookingRef !== supplierBookingRef) throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_IDENTITY_MISMATCH")
      operation.executionState = outcome
      operation.supplierBookingRef = supplierBookingRef
      operation.supplierLocator = supplierLocator
      operation.responseDigest = responseDigest
      operation.safeMetadata = { ...safeMetadata }
      operation.responseReceivedAt = new Date(clock()).toISOString()
      operation.reconciliationRequired = false
      if (outcome === "ACCEPTED") {
        const booking = state.bookings.get(operation.bookingId)
        if (booking?.status !== "processing") throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_EXECUTION_CONFLICT")
        booking.status = "confirmed"
        booking.supplierReference = supplierBookingRef
        operation.supplierAcceptedAt = new Date(clock()).toISOString()
      }
      return snapshot(state, operation, { replayed: false })
    },
    async recordFailure({ request, failureCode, unknown, supplierBookingRef = null }) {
      const operation = requireOperation(state, request)
      if (["ACCEPTED", "REJECTED", "FAILED", "UNKNOWN"].includes(operation.executionState)) return snapshot(state, operation, { replayed: true })
      operation.executionState = unknown ? "UNKNOWN" : (failureCode === "SUPPLIER_REJECTED" ? "REJECTED" : "FAILED")
      operation.failureCode = failureCode
      operation.reconciliationRequired = unknown
      operation.supplierBookingRef = supplierBookingRef
      if (unknown) operation.unknownOutcomeAt = new Date(clock()).toISOString()
      operation.responseReceivedAt = new Date(clock()).toISOString()
      return snapshot(state, operation, { replayed: false })
    },
    counts() { return freeze({ operations: state.operationsByBooking.size }) },
    getBooking(bookingId) { const value = state.bookings.get(bookingId); return value ? freeze(value) : null },
    getOperation(bookingId) { const value = state.operationsByBooking.get(bookingId); return value ? snapshot(state, value) : null },
  })
}

const first = (value) => Array.isArray(value) ? value[0] : value
const mapped = (value) => freeze({
  executionId: value.execution_id,
  operationId: value.operation_id,
  bookingId: value.booking_id,
  bookingRef: value.booking_ref,
  paymentId: value.payment_id,
  bookingIntentId: value.booking_intent_id,
  ownerId: value.owner_id,
  provider: value.provider,
  internalOfferId: value.internal_offer_id,
  providerOfferRef: value.provider_offer_ref,
  travelerSnapshot: value.traveler_snapshot,
  contactSnapshot: value.contact_snapshot,
  idempotencyKey: value.idempotency_key,
  requestDigest: value.request_digest,
  executionState: value.execution_state,
  bookingStatus: value.booking_status,
  paymentStatus: value.payment_status,
  supplierBookingRef: value.supplier_booking_ref ?? null,
  supplierLocator: value.supplier_locator ?? null,
  responseDigest: value.response_digest ?? null,
  safeMetadata: value.safe_metadata ?? {},
  reconciliationRequired: value.reconciliation_required === true,
  supplierAcceptedAt: value.supplier_accepted_at ?? null,
  shouldSend: value.should_send === true,
  replayed: value.replayed === true,
})

const rpc = async (client, name, parameters, fallbackCode) => {
  const { data, error } = await client.rpc(name, parameters)
  if (error?.code === "23505") throw new FlightSupplierBookingExecutionStoreError("SUPPLIER_EXECUTION_IDEMPOTENCY_CONFLICT")
  const value = first(data)
  if (error || !value) throw new FlightSupplierBookingExecutionStoreError(error?.message?.includes("payment is not confirmed") ? "PAYMENT_NOT_CONFIRMED" : fallbackCode)
  return mapped(value)
}

export function createSupabaseFlightSupplierBookingExecutionStoreV1({ client }) {
  if (!client || typeof client.rpc !== "function") throw new TypeError("server-only Supabase RPC client is required")
  return Object.freeze({
    durability: "supabase-private-persistence",
    prepare: (request) => rpc(client, "prepare_flight_supplier_booking_execution_v1", {
      p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest,
    }, "SUPPLIER_EXECUTION_PERSISTENCE_UNAVAILABLE"),
    markRequestSent: (request) => rpc(client, "mark_flight_supplier_booking_request_sent_v1", {
      p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest,
    }, "SUPPLIER_EXECUTION_PERSISTENCE_UNAVAILABLE"),
    complete: ({ request, outcome, supplierBookingRef, supplierLocator, responseDigest, safeMetadata }) => rpc(client, "complete_flight_supplier_booking_execution_v1", {
      p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest,
      p_outcome: outcome, p_supplier_booking_ref: supplierBookingRef, p_supplier_locator: supplierLocator, p_response_digest: responseDigest, p_safe_metadata: safeMetadata,
    }, "SUPPLIER_EXECUTION_PERSISTENCE_UNAVAILABLE"),
    recordFailure: ({ request, failureCode, unknown, supplierBookingRef }) => rpc(client, "record_flight_supplier_booking_failure_v1", {
      p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest,
      p_failure_code: failureCode, p_unknown: unknown, p_supplier_booking_ref: supplierBookingRef,
    }, "SUPPLIER_EXECUTION_PERSISTENCE_UNAVAILABLE"),
  })
}
