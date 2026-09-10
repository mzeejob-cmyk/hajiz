import { createHash } from "node:crypto"
import { PRICED_ROW_KEYS, canonicalJson, hasExactKeys, isFuture, isPayloadDigest, isPricedSelectionId, normalizePricedSelectionRecord } from "./flightSelectionPersistenceContractV1.js"

export class FlightPricedSelectionStoreError extends Error {
  constructor(code) { super(code); this.name = "FlightPricedSelectionStoreError"; this.code = code }
}

const classified = (code) => new FlightPricedSelectionStoreError(code)
const mapError = (error) => {
  if (error?.code === "FSD01") return classified("NOT_FOUND")
  if (error?.code === "FSD02") return classified("EXPIRED")
  if (error?.code === "FSD04") return classified("IDENTITY_DIGEST_CONFLICT")
  if (["FSD10", "FSD11"].includes(error?.code)) return classified("INVALID_INPUT")
  return classified("PERSISTENCE_UNAVAILABLE")
}
const safeNormalize = (record) => { try { return normalizePricedSelectionRecord(record) } catch { throw classified("INVALID_INPUT") } }
const domainRecord = ({ pricedSelectionId: _pricedSelectionId, ...record }) => Object.freeze(record)

export function createProcessLocalFlightPricedSelectionStoreV1({ clock = Date.now } = {}) {
  if (typeof clock !== "function") throw new TypeError("priced selection store clock is required")
  const records = new Map()
  return Object.freeze({
    durability: "process-local-non-production",
    async createOrGet(input) {
      const record = safeNormalize(input)
      const fingerprint = createHash("sha256").update(canonicalJson(record)).digest("hex")
      const existing = records.get(record.pricedSelectionId)
      if (existing && existing.fingerprint !== fingerprint) throw classified("IDENTITY_DIGEST_CONFLICT")
      if (!existing) records.set(record.pricedSelectionId, Object.freeze({ record, fingerprint }))
      return Object.freeze({ pricedSelectionId: record.pricedSelectionId, replayed: Boolean(existing) })
    },
    async resolve(pricedSelectionId) {
      if (!isPricedSelectionId(pricedSelectionId)) throw classified("NOT_FOUND")
      const stored = records.get(pricedSelectionId)
      if (!stored) throw classified("NOT_FOUND")
      if (!isFuture(stored.record.expiresAt, clock)) throw classified("EXPIRED")
      return domainRecord(stored.record)
    },
  })
}

export function createSupabaseFlightPricedSelectionStoreV1({ client, clock = Date.now }) {
  if (!client || typeof client.rpc !== "function") throw new TypeError("server-only Supabase RPC client is required")
  if (typeof clock !== "function") throw new TypeError("priced selection store clock is required")
  return Object.freeze({
    durability: "supabase-private-persistence",
    async createOrGet(input) {
      const record = safeNormalize(input)
      let result
      try { result = await client.rpc("create_or_get_flight_priced_selection_v1", { p_priced_selection_id: record.pricedSelectionId, p_alternative_id: record.alternativeId, p_internal_offer_id: record.internalOfferId, p_provider: record.provider, p_provider_offer_ref: record.providerOfferRef, p_customer_price_snapshot: record.customerPrice, p_itinerary_snapshot: record.itinerary, p_fare_snapshot: record.fare, p_passenger_composition: record.passengerComposition, p_expires_at: record.expiresAt }) } catch { throw classified("PERSISTENCE_UNAVAILABLE") }
      if (result?.error) throw mapError(result.error)
      if (!Array.isArray(result?.data) || result.data.length !== 1) throw classified("PERSISTENCE_UNAVAILABLE")
      const row = result.data[0]
      if (!hasExactKeys(row, ["priced_selection_id", "replayed"]) || !isPricedSelectionId(row.priced_selection_id) || row.priced_selection_id !== record.pricedSelectionId || typeof row.replayed !== "boolean") throw classified("PERSISTENCE_UNAVAILABLE")
      return Object.freeze({ pricedSelectionId: row.priced_selection_id, replayed: row.replayed })
    },
    async resolve(pricedSelectionId) {
      if (!isPricedSelectionId(pricedSelectionId)) throw classified("NOT_FOUND")
      let result
      try { result = await client.rpc("get_flight_priced_selection_v1", { p_priced_selection_id: pricedSelectionId }) } catch { throw classified("PERSISTENCE_UNAVAILABLE") }
      if (result?.error) throw mapError(result.error)
      if (!Array.isArray(result?.data) || result.data.length !== 1 || !hasExactKeys(result.data[0], PRICED_ROW_KEYS)) throw classified("PERSISTENCE_UNAVAILABLE")
      const row = result.data[0]
      if (row.priced_selection_id !== pricedSelectionId) throw classified("PERSISTENCE_UNAVAILABLE")
      if (!isPayloadDigest(row.payload_digest)) throw classified("PERSISTENCE_UNAVAILABLE")
      let record
      try { record = normalizePricedSelectionRecord({ pricedSelectionId: row.priced_selection_id, alternativeId: row.alternative_id, internalOfferId: row.internal_offer_id, provider: row.provider, providerOfferRef: row.provider_offer_ref, customerPrice: row.customer_price_snapshot, itinerary: row.itinerary_snapshot, fare: row.fare_snapshot, passengerComposition: row.passenger_composition, expiresAt: row.expires_at }) } catch { throw classified("PERSISTENCE_UNAVAILABLE") }
      if (!isFuture(record.expiresAt, clock)) throw classified("EXPIRED")
      return domainRecord(record)
    },
  })
}
