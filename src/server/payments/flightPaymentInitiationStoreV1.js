import { randomBytes, randomUUID } from "node:crypto"

export class FlightPaymentInitiationStoreError extends Error {
  constructor(code) { super(code); this.name = "FlightPaymentInitiationStoreError"; this.code = code }
}

const bookingReference = () => `HJZ-${randomBytes(6).toString("hex").toUpperCase()}`
const paymentReference = () => `PAY-${randomBytes(6).toString("hex").toUpperCase()}`
const idempotencyIdentity = ({ ownerId, idempotencyKey }) => `${ownerId}:${idempotencyKey}`

export function createProcessLocalFlightPaymentInitiationStoreV1({ clock = Date.now } = {}) {
  if (typeof clock !== "function") throw new TypeError("payment initiation store clock is required")
  const byIdempotency = new Map()
  const byBookingIntent = new Map()
  const bookings = new Map()
  const payments = new Map()

  return Object.freeze({
    durability: "process-local-non-production",
    async prepare(record) {
      const identity = idempotencyIdentity(record)
      const existingByKey = byIdempotency.get(identity)
      const existingByIntent = byBookingIntent.get(record.bookingIntentId)
      const existing = existingByKey ?? existingByIntent
      if (existing) {
        if (existing.ownerId !== record.ownerId || existing.idempotencyKey !== record.idempotencyKey || existing.requestDigest !== record.requestDigest || existing.paymentMethod !== record.paymentMethod) {
          throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT")
        }
        if (existing.state === "MATERIALIZED") return Object.freeze({ ...existing.result, state: existing.state, replayed: true })
        return Object.freeze({ ...existing, replayed: true })
      }
      const reservation = {
        ...record,
        bookingId: randomUUID(),
        bookingRef: bookingReference(),
        paymentId: randomUUID(),
        paymentReference: paymentReference(),
        state: "PREPARED",
        createdAt: new Date(clock()).toISOString(),
        result: null,
      }
      byIdempotency.set(identity, reservation)
      byBookingIntent.set(record.bookingIntentId, reservation)
      return Object.freeze({ ...reservation, replayed: false })
    },
    async materialize({ reservation, intent, providerHandoff, bankakConfig, paymentExpiresAt, handoffDigest }) {
      const stored = byIdempotency.get(idempotencyIdentity(reservation))
      if (!stored || stored.bookingIntentId !== reservation.bookingIntentId || stored.requestDigest !== reservation.requestDigest) {
        throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_RESERVATION_NOT_FOUND")
      }
      if (stored.state === "MATERIALIZED") {
        if (stored.handoffDigest !== handoffDigest) throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT")
        return Object.freeze({ ...stored.result, replayed: true })
      }
      if (stored.state !== "PREPARED" || !intent?.customerPrice || intent.ownerId !== stored.ownerId) {
        throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_MATERIALIZATION_FAILED")
      }
      const expiresAt = new Date(paymentExpiresAt).toISOString()
      if (Date.parse(expiresAt) <= clock()) throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_MATERIALIZATION_FAILED")
      const isBankak = stored.paymentMethod === "bankak"
      if (isBankak && (!bankakConfig?.bankAccountDisplayName || !bankakConfig?.maskedAccountNumber || providerHandoff !== null)) {
        throw new FlightPaymentInitiationStoreError("PAYMENT_CONFIGURATION_UNAVAILABLE")
      }
      if (!isBankak && (!providerHandoff?.providerName || !providerHandoff?.providerPaymentId || !providerHandoff?.providerSession)) {
        throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_MATERIALIZATION_FAILED")
      }
      const booking = Object.freeze({
        id: stored.bookingId,
        bookingRef: stored.bookingRef,
        ownerId: stored.ownerId,
        bookingIntentId: stored.bookingIntentId,
        status: "pending_payment",
        paymentMethod: stored.paymentMethod,
        customerPrice: intent.customerPrice,
        travelerSnapshot: intent.travelers,
        contactSnapshot: intent.contact,
      })
      const payment = Object.freeze({
        id: stored.paymentId,
        bookingId: stored.bookingId,
        paymentReference: stored.paymentReference,
        ownerId: stored.ownerId,
        status: "awaiting",
        method: stored.paymentMethod,
        amount: intent.customerPrice.amount,
        currency: intent.customerPrice.currency,
        expiresAt,
        amountSdg: isBankak ? (bankakConfig.amountSdg ?? intent.customerPrice.amount) : null,
        bankAccountDisplayName: isBankak ? bankakConfig.bankAccountDisplayName : null,
        maskedAccountNumber: isBankak ? bankakConfig.maskedAccountNumber : null,
        providerSession: isBankak ? null : providerHandoff.providerSession,
        redirectUrl: isBankak ? null : (providerHandoff.redirectUrl ?? null),
        pspLive: isBankak ? false : providerHandoff.live === true,
      })
      const result = Object.freeze({
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        paymentId: payment.id,
        paymentReference: payment.paymentReference,
        paymentMethod: payment.method,
        bookingStatus: booking.status,
        paymentStatus: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        expiresAt: payment.expiresAt,
        amountSdg: payment.amountSdg,
        bankAccountDisplayName: payment.bankAccountDisplayName,
        maskedAccountNumber: payment.maskedAccountNumber,
        providerSession: payment.providerSession,
        redirectUrl: payment.redirectUrl,
        pspLive: payment.pspLive,
      })
      bookings.set(booking.id, booking)
      payments.set(payment.id, payment)
      stored.state = "MATERIALIZED"
      stored.handoffDigest = handoffDigest
      stored.result = result
      stored.materializedAt = new Date(clock()).toISOString()
      return Object.freeze({ ...result, replayed: false })
    },
    counts() { return Object.freeze({ reservations: byBookingIntent.size, bookings: bookings.size, payments: payments.size }) },
    getBooking(id) { return bookings.get(id) ?? null },
    getPayment(id) { return payments.get(id) ?? null },
  })
}

const row = (data) => Array.isArray(data) ? data[0] : data
const mapped = (value) => Object.freeze({
  bookingId: value.booking_id,
  bookingRef: value.booking_ref,
  paymentId: value.payment_id,
  paymentReference: value.payment_reference,
  state: value.initiation_state,
  bookingStatus: value.booking_status ?? null,
  paymentStatus: value.payment_status ?? null,
  paymentMethod: value.payment_method,
  amount: value.amount === null || value.amount === undefined ? null : String(value.amount),
  currency: value.currency ?? null,
  expiresAt: value.expires_at ?? null,
  amountSdg: value.amount_sdg === null || value.amount_sdg === undefined ? null : String(value.amount_sdg),
  bankAccountDisplayName: value.bank_account_display_name ?? null,
  maskedAccountNumber: value.masked_account_number ?? null,
  providerSession: value.provider_session_token ?? null,
  redirectUrl: value.provider_redirect_url ?? null,
  pspLive: value.psp_live === true,
  replayed: value.replayed === true,
})

export function createSupabaseFlightPaymentInitiationStoreV1({ client }) {
  if (!client || typeof client.rpc !== "function") throw new TypeError("server-only Supabase RPC client is required")
  return Object.freeze({
    durability: "supabase-private-persistence",
    async prepare(record) {
      const { data, error } = await client.rpc("prepare_flight_payment_initiation_v1", {
        p_owner_id: record.ownerId,
        p_booking_intent_id: record.bookingIntentId,
        p_payment_method: record.paymentMethod,
        p_idempotency_key: record.idempotencyKey,
        p_request_digest: record.requestDigest,
      })
      if (error?.code === "23505") throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT")
      const value = row(data)
      if (error || !value) throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_PERSISTENCE_UNAVAILABLE")
      return Object.freeze({ ...record, ...mapped(value) })
    },
    async materialize({ reservation, providerHandoff, bankakConfig, paymentExpiresAt, handoffDigest }) {
      const { data, error } = await client.rpc("materialize_flight_payment_initiation_v1", {
        p_owner_id: reservation.ownerId,
        p_booking_intent_id: reservation.bookingIntentId,
        p_idempotency_key: reservation.idempotencyKey,
        p_request_digest: reservation.requestDigest,
        p_provider_name: providerHandoff?.providerName ?? "manual_transfer",
        p_provider_payment_id: providerHandoff?.providerPaymentId ?? null,
        p_provider_session_token: providerHandoff?.providerSession ?? null,
        p_provider_redirect_url: providerHandoff?.redirectUrl ?? null,
        p_psp_live: providerHandoff?.live === true,
        p_payment_expires_at: paymentExpiresAt,
        p_bank_account_display_name: bankakConfig?.bankAccountDisplayName ?? null,
        p_masked_account_number: bankakConfig?.maskedAccountNumber ?? null,
        p_handoff_digest: handoffDigest,
      })
      if (error?.code === "23505") throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_IDEMPOTENCY_CONFLICT")
      const value = row(data)
      if (error || !value) throw new FlightPaymentInitiationStoreError("PAYMENT_INITIATION_MATERIALIZATION_FAILED")
      return mapped(value)
    },
  })
}
