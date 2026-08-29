import { randomBytes } from "node:crypto"

export class FlightBookingIntentStoreError extends Error {
  constructor(code) { super(code); this.name = "FlightBookingIntentStoreError"; this.code = code }
}

const key = ({ ownerId, idempotencyKey }) => `${ownerId}:${idempotencyKey}`
const publicId = () => `hbi_v1_${randomBytes(16).toString("hex")}`

export function createProcessLocalFlightBookingIntentStoreV1({ clock = Date.now } = {}) {
  if (typeof clock !== "function") throw new TypeError("booking intent store clock is required")
  const byIdempotency = new Map()
  const byPublicId = new Map()
  return Object.freeze({
    durability: "process-local-non-production",
    async createOrGet(record) {
      const identity = key(record)
      const existing = byIdempotency.get(identity)
      if (existing) {
        if (existing.payloadDigest !== record.payloadDigest) throw new FlightBookingIntentStoreError("BOOKING_INTENT_IDEMPOTENCY_CONFLICT")
        return Object.freeze({ bookingIntentId: existing.bookingIntentId, status: existing.status, validUntil: existing.validUntil, replayed: true })
      }
      const stored = Object.freeze({ ...record, bookingIntentId: publicId(), status: "READY_FOR_PAYMENT", createdAt: new Date(clock()).toISOString() })
      byIdempotency.set(identity, stored); byPublicId.set(stored.bookingIntentId, stored)
      return Object.freeze({ bookingIntentId: stored.bookingIntentId, status: stored.status, validUntil: stored.validUntil, replayed: false })
    },
    async resolveForOwner({ ownerId, bookingIntentId }) {
      const stored = byPublicId.get(bookingIntentId)
      if (!stored || stored.ownerId !== ownerId) throw new FlightBookingIntentStoreError("BOOKING_INTENT_NOT_FOUND")
      return stored
    },
    count() { return byPublicId.size },
  })
}

export function createSupabaseFlightBookingIntentStoreV1({ client }) {
  if (!client || typeof client.rpc !== "function") throw new TypeError("server-only Supabase RPC client is required")
  return Object.freeze({
    durability: "supabase-private-persistence",
    async createOrGet(record) {
      const { data, error } = await client.rpc("create_flight_booking_intent_v1", {
        p_owner_id: record.ownerId,
        p_idempotency_key: record.idempotencyKey,
        p_payload_digest: record.payloadDigest,
        p_priced_selection_digest: record.pricedSelectionDigest,
        p_internal_offer_id: record.internalOfferId,
        p_provider: record.provider,
        p_provider_offer_ref: record.providerOfferRef,
        p_itinerary_snapshot: record.itinerary,
        p_fare_snapshot: record.fare,
        p_customer_price_snapshot: record.customerPrice,
        p_passenger_composition: record.passengerComposition,
        p_traveler_snapshot: record.travelers,
        p_contact_snapshot: record.contact,
        p_valid_until: record.validUntil,
      })
      if (error?.code === "23505") throw new FlightBookingIntentStoreError("BOOKING_INTENT_IDEMPOTENCY_CONFLICT")
      if (error) throw new FlightBookingIntentStoreError("BOOKING_INTENT_PERSISTENCE_UNAVAILABLE")
      const row = Array.isArray(data) ? data[0] : data
      if (!row || !/^hbi_v1_[0-9a-f]{32}$/.test(row.booking_intent_id) || row.status !== "READY_FOR_PAYMENT") throw new FlightBookingIntentStoreError("BOOKING_INTENT_PERSISTENCE_UNAVAILABLE")
      return Object.freeze({ bookingIntentId: row.booking_intent_id, status: row.status, validUntil: row.valid_until, replayed: row.replayed === true })
    },
    async resolveForOwner({ ownerId, bookingIntentId }) {
      const { data, error } = await client.rpc("get_flight_booking_intent_v1", { p_owner_id: ownerId, p_booking_intent_id: bookingIntentId })
      const row = Array.isArray(data) ? data[0] : data
      if (error || !row) throw new FlightBookingIntentStoreError("BOOKING_INTENT_NOT_FOUND")
      return Object.freeze(row)
    },
  })
}
