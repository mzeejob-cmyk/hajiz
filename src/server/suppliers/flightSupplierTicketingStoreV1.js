import { randomUUID } from "node:crypto"

export class FlightSupplierTicketingStoreError extends Error {
  constructor(code) { super(code); this.name = "FlightSupplierTicketingStoreError"; this.code = code }
}

const freeze = (value) => Object.freeze({ ...value })
const byId = (values = []) => new Map(values.map((value) => [value.id, { ...value }]))
const identity = ({ ownerId, idempotencyKey }) => `${ownerId}:${idempotencyKey}`

export function createFlightSupplierTicketingTestStateV1(seed = {}) {
  return {
    bookings: byId(seed.bookings),
    supplierExecutions: byId(seed.supplierExecutions),
    ticketingByBooking: new Map(),
    ticketingByIdentity: new Map(),
    ticketsByExecution: new Map(),
  }
}

const requireExecution = (state, request) => {
  const execution = state.ticketingByBooking.get(request.bookingId)
  if (!execution || execution.ownerId !== request.ownerId || execution.idempotencyKey !== request.idempotencyKey || execution.requestDigest !== request.requestDigest) throw new FlightSupplierTicketingStoreError("TICKETING_EXECUTION_NOT_FOUND")
  return execution
}

const snapshot = (state, execution, extra = {}) => {
  const booking = state.bookings.get(execution.bookingId)
  const tickets = state.ticketsByExecution.get(execution.executionId) ?? []
  return freeze({ ...execution, bookingRef: booking?.bookingRef, bookingStatus: booking?.status, ticketCount: tickets.length, canDownloadTicket: tickets.length > 0 && tickets.every((ticket) => ticket.artifact?.availability === "AVAILABLE"), ...extra })
}

export function createProcessLocalFlightSupplierTicketingStoreV1({ state, clock = Date.now } = {}) {
  if (!state?.bookings || !state?.supplierExecutions || typeof clock !== "function") throw new TypeError("explicit non-production ticketing state is required")
  return Object.freeze({
    durability: "shared-process-ticketing-test-state-non-production",
    async prepare(request) {
      const booking = state.bookings.get(request.bookingId)
      if (!booking || booking.ownerId !== request.ownerId) throw new FlightSupplierTicketingStoreError("BOOKING_NOT_FOUND")
      const supplier = [...state.supplierExecutions.values()].find((value) => value.bookingId === booking.id)
      const existing = state.ticketingByBooking.get(booking.id) ?? state.ticketingByIdentity.get(identity(request))
      if (existing) {
        if (existing.bookingId !== booking.id || existing.ownerId !== request.ownerId || existing.idempotencyKey !== request.idempotencyKey || existing.requestDigest !== request.requestDigest) throw new FlightSupplierTicketingStoreError("TICKETING_IDEMPOTENCY_CONFLICT")
        return snapshot(state, existing, { replayed: true })
      }
      if (booking.status !== "confirmed") throw new FlightSupplierTicketingStoreError("BOOKING_NOT_CONFIRMED")
      if (!supplier || supplier.ownerId !== booking.ownerId || supplier.executionState !== "ACCEPTED" || supplier.bookingId !== booking.id) throw new FlightSupplierTicketingStoreError("B13_ACCEPTED_EXECUTION_REQUIRED")
      if (!supplier.supplierBookingRef || supplier.supplierBookingRef !== booking.supplierReference || supplier.provider !== booking.supplierProvider) throw new FlightSupplierTicketingStoreError("B13_SUPPLIER_IDENTITY_MISMATCH")
      if (!Array.isArray(supplier.travelerKeys) || supplier.travelerKeys.length < 1 || new Set(supplier.travelerKeys).size !== supplier.travelerKeys.length) throw new FlightSupplierTicketingStoreError("B13_TRAVELER_LINEAGE_INVALID")
      const execution = {
        executionId: randomUUID(), operationId: null, bookingId: booking.id, supplierExecutionId: supplier.id,
        ownerId: booking.ownerId, provider: supplier.provider, supplierBookingRef: supplier.supplierBookingRef,
        travelerKeys: [...supplier.travelerKeys], idempotencyKey: request.idempotencyKey, requestDigest: request.requestDigest,
        ticketingOperation: null, executionState: "PREPARED", attemptCount: 0, responseDigest: null,
        safeMetadata: {}, reconciliationRequired: false, failureCode: null, createdAt: new Date(clock()).toISOString(),
        requestSentAt: null, responseReceivedAt: null, issuedAt: null, unknownOutcomeAt: null, reconciledAt: null,
      }
      state.ticketingByBooking.set(booking.id, execution); state.ticketingByIdentity.set(identity(request), execution)
      return snapshot(state, execution, { replayed: false })
    },
    async markRequestSent({ request, operation }) {
      const execution = requireExecution(state, request)
      if (execution.executionState !== "PREPARED") return snapshot(state, execution, { shouldSend: false, replayed: true })
      if (!["confirm_booking", "retrieve_ticket"].includes(operation)) throw new FlightSupplierTicketingStoreError("TICKETING_OPERATION_INVALID")
      const booking = state.bookings.get(execution.bookingId)
      const supplier = state.supplierExecutions.get(execution.supplierExecutionId)
      if (booking?.status !== "confirmed" || supplier?.executionState !== "ACCEPTED") throw new FlightSupplierTicketingStoreError("TICKETING_AUTHORITY_CHANGED")
      execution.operationId = randomUUID(); execution.ticketingOperation = operation; execution.executionState = "REQUEST_SENT"; execution.attemptCount = 1; execution.requestSentAt = new Date(clock()).toISOString()
      return snapshot(state, execution, { shouldSend: true, replayed: false })
    },
    async complete({ request, outcome, tickets, responseDigest, safeMetadata }) {
      const execution = requireExecution(state, request)
      if (execution.executionState === "ISSUED") {
        if (execution.responseDigest !== responseDigest) throw new FlightSupplierTicketingStoreError("TICKETING_IDEMPOTENCY_CONFLICT")
        return snapshot(state, execution, { replayed: true })
      }
      if (!["REQUEST_SENT", "PROCESSING", "UNKNOWN"].includes(execution.executionState)) throw new FlightSupplierTicketingStoreError("TICKETING_EXECUTION_CONFLICT")
      if (outcome === "ISSUED" && (!Array.isArray(tickets) || tickets.length < 1)) throw new FlightSupplierTicketingStoreError("TICKET_EVIDENCE_REQUIRED")
      if (outcome === "PROCESSING" && tickets.length) throw new FlightSupplierTicketingStoreError("TICKET_EVIDENCE_INVALID")
      execution.executionState = outcome; execution.responseDigest = responseDigest; execution.safeMetadata = { ...safeMetadata }; execution.responseReceivedAt = new Date(clock()).toISOString(); execution.reconciliationRequired = false
      if (outcome === "ISSUED") {
        const booking = state.bookings.get(execution.bookingId)
        if (booking?.status !== "confirmed") throw new FlightSupplierTicketingStoreError("TICKETING_AUTHORITY_CHANGED")
        state.ticketsByExecution.set(execution.executionId, tickets.map((ticket) => freeze({ id: randomUUID(), ...ticket })))
        booking.status = "ticketed"; execution.issuedAt = tickets.map((ticket) => ticket.issuedAt).sort().at(-1); if (execution.unknownOutcomeAt) execution.reconciledAt = new Date(clock()).toISOString()
      }
      return snapshot(state, execution, { replayed: false })
    },
    async recordFailure({ request, failureCode, unknown }) {
      const execution = requireExecution(state, request)
      if (["ISSUED", "REJECTED", "FAILED", "UNKNOWN"].includes(execution.executionState)) return snapshot(state, execution, { replayed: true })
      if (unknown && execution.executionState !== "REQUEST_SENT") throw new FlightSupplierTicketingStoreError("TICKETING_EXECUTION_CONFLICT")
      execution.executionState = unknown ? "UNKNOWN" : (failureCode === "SUPPLIER_TICKETING_REJECTED" ? "REJECTED" : "FAILED")
      execution.failureCode = failureCode; execution.reconciliationRequired = unknown; execution.responseReceivedAt = new Date(clock()).toISOString(); if (unknown) execution.unknownOutcomeAt = new Date(clock()).toISOString()
      return snapshot(state, execution, { replayed: false })
    },
    getBooking: (bookingId) => state.bookings.has(bookingId) ? freeze(state.bookings.get(bookingId)) : null,
    getExecution: (bookingId) => state.ticketingByBooking.has(bookingId) ? snapshot(state, state.ticketingByBooking.get(bookingId)) : null,
    getTickets: (bookingId) => { const execution = state.ticketingByBooking.get(bookingId); return Object.freeze([...(execution ? state.ticketsByExecution.get(execution.executionId) ?? [] : [])]) },
  })
}

const first = (value) => Array.isArray(value) ? value[0] : value
const mapped = (value) => freeze({
  executionId: value.execution_id, operationId: value.operation_id ?? null, bookingId: value.booking_id,
  bookingRef: value.booking_ref, bookingStatus: value.booking_status, supplierExecutionId: value.supplier_execution_id,
  ownerId: value.owner_id, provider: value.provider, supplierBookingRef: value.supplier_booking_ref,
  travelerKeys: value.traveler_keys ?? [], idempotencyKey: value.idempotency_key, requestDigest: value.request_digest,
  ticketingOperation: value.ticketing_operation ?? null, executionState: value.execution_state,
  ticketCount: Number(value.ticket_count ?? 0), canDownloadTicket: value.can_download_ticket === true,
  responseDigest: value.response_digest ?? null, safeMetadata: value.safe_metadata ?? {},
  reconciliationRequired: value.reconciliation_required === true, issuedAt: value.issued_at ?? null,
  shouldSend: value.should_send === true, replayed: value.replayed === true,
})

const rpc = async (client, name, parameters, fallbackCode) => {
  const { data, error } = await client.rpc(name, parameters); const value = first(data)
  if (error?.code === "23505") throw new FlightSupplierTicketingStoreError("TICKETING_IDEMPOTENCY_CONFLICT")
  if (error || !value) throw new FlightSupplierTicketingStoreError(fallbackCode)
  return mapped(value)
}

export function createSupabaseFlightSupplierTicketingStoreV1({ client }) {
  if (!client || typeof client.rpc !== "function") throw new TypeError("server-only Supabase RPC client is required")
  return Object.freeze({
    durability: "supabase-private-ticketing-persistence",
    prepare: (request) => rpc(client, "prepare_flight_supplier_ticketing_v1", { p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest }, "TICKETING_PERSISTENCE_UNAVAILABLE"),
    markRequestSent: ({ request, operation }) => rpc(client, "mark_flight_supplier_ticketing_request_sent_v1", { p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest, p_operation: operation }, "TICKETING_PERSISTENCE_UNAVAILABLE"),
    complete: ({ request, outcome, tickets, responseDigest, safeMetadata }) => rpc(client, "complete_flight_supplier_ticketing_v1", { p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest, p_outcome: outcome, p_tickets: tickets, p_response_digest: responseDigest, p_safe_metadata: safeMetadata }, "TICKETING_PERSISTENCE_UNAVAILABLE"),
    recordFailure: ({ request, failureCode, unknown }) => rpc(client, "record_flight_supplier_ticketing_failure_v1", { p_owner_id: request.ownerId, p_booking_id: request.bookingId, p_idempotency_key: request.idempotencyKey, p_request_digest: request.requestDigest, p_failure_code: failureCode, p_unknown: unknown }, "TICKETING_PERSISTENCE_UNAVAILABLE"),
  })
}
