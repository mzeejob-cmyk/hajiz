import { SEARCH_ROW_KEYS, assertCustomerPriceSnapshot, assertJsonSnapshot, assertPassengerComposition, assertRepresentative, hasExactKeys, isAlternativeId, isFuture, isPayloadDigest, normalizeSearchSelectionEntry, normalizeTimestamp } from "./flightSelectionPersistenceContractV1.js"

export const FLIGHT_SELECTION_RESOLVER_VERSION = "flight-selection-resolver/v1"

export class SelectionResolutionError extends Error {
  constructor(code) { super(code); this.name = "SelectionResolutionError"; this.code = code }
}

export class FlightSelectionPersistenceError extends Error {
  constructor(code) { super(code); this.name = "FlightSelectionPersistenceError"; this.code = code }
}

const persistenceError = (code) => new FlightSelectionPersistenceError(code)
const mapRpcError = (error) => {
  if (error?.code === "FSD01") return persistenceError("NOT_FOUND")
  if (error?.code === "FSD02") return persistenceError("EXPIRED")
  if (error?.code === "FSD04") return persistenceError("IDENTITY_DIGEST_CONFLICT")
  if (["FSD10", "FSD11"].includes(error?.code)) return persistenceError("INVALID_INPUT")
  return persistenceError("PERSISTENCE_UNAVAILABLE")
}

export function createProcessLocalFlightSelectionResolverV1({ clock = Date.now } = {}) {
  if (typeof clock !== "function") throw new TypeError("server clock is required")
  const entries = new Map()
  const prune = () => {
    const now = clock()
    for (const [alternativeId, entry] of entries) if (Date.parse(entry.expiresAt) <= now) entries.delete(alternativeId)
  }
  const sameRepresentative = (left, right) => left.offer.internalOfferId === right.offer.internalOfferId && left.offer.provider === right.offer.provider && left.offer.providerOfferRef === right.offer.providerOfferRef
  const resolver = {
    durability: "process-local-non-production",
    rememberSearch(searchEntries) {
      if (!Array.isArray(searchEntries)) throw new TypeError("trusted search selection entries are required")
      prune()
      const staged = new Map()
      for (const input of searchEntries) {
        const normalized = normalizeSearchSelectionEntry(input)
        const entry = Object.freeze({ ...normalized, offer: input.offer })
        const sameSearch = staged.get(entry.alternativeId)
        if (sameSearch && !sameRepresentative(sameSearch, entry)) throw new SelectionResolutionError("SELECTION_AMBIGUOUS")
        staged.set(entry.alternativeId, entry)
      }
      for (const [alternativeId, entry] of staged) entries.set(alternativeId, entry)
    },
    remember(entry) { resolver.rememberSearch([entry]) },
    resolve(alternativeId) {
      const entry = entries.get(alternativeId)
      if (!entry) throw new SelectionResolutionError("SELECTION_NOT_FOUND")
      if (Date.parse(entry.expiresAt) <= clock()) { entries.delete(alternativeId); throw new SelectionResolutionError("SELECTION_EXPIRED") }
      return entry
    },
  }
  return Object.freeze(resolver)
}

export function createSupabaseFlightSelectionResolverV1({ client, clock = Date.now }) {
  if (!client || typeof client.rpc !== "function") throw new TypeError("server-only Supabase RPC client is required")
  if (typeof clock !== "function") throw new TypeError("server clock is required")
  const resolver = {
    durability: "supabase-private-persistence",
    async rememberSearch(searchEntries) {
      if (!Array.isArray(searchEntries) || searchEntries.length === 0) throw persistenceError("INVALID_INPUT")
      let entries
      try { entries = searchEntries.map(normalizeSearchSelectionEntry) } catch { throw persistenceError("INVALID_INPUT") }
      const expected = new Set(entries.map((entry) => entry.alternativeId))
      if (expected.size !== entries.length) throw persistenceError("INVALID_INPUT")
      const p_batch = entries.map((entry) => ({ alternativeId: entry.alternativeId, internalOfferId: entry.offer.internalOfferId, provider: entry.offer.provider, providerOfferRef: entry.offer.providerOfferRef, itinerary: entry.itinerary, fare: entry.fare, previousCustomerPrice: entry.previousCustomerPrice, passengerComposition: entry.passengerComposition, expiresAt: entry.expiresAt }))
      let result
      try { result = await client.rpc("remember_flight_search_selections_v1", { p_batch }) } catch { throw persistenceError("PERSISTENCE_UNAVAILABLE") }
      if (result?.error) throw mapRpcError(result.error)
      if (!Array.isArray(result?.data) || result.data.length !== expected.size || result.data.length === 0) throw persistenceError("PERSISTENCE_UNAVAILABLE")
      const returned = new Set()
      for (const row of result.data) {
        if (!hasExactKeys(row, ["alternative_id", "replayed"]) || !isAlternativeId(row.alternative_id) || typeof row.replayed !== "boolean" || !expected.has(row.alternative_id) || returned.has(row.alternative_id)) throw persistenceError("PERSISTENCE_UNAVAILABLE")
        returned.add(row.alternative_id)
      }
      if (returned.size !== expected.size) throw persistenceError("PERSISTENCE_UNAVAILABLE")
    },
    async remember(entry) { return resolver.rememberSearch([entry]) },
    async resolve(alternativeId) {
      if (!isAlternativeId(alternativeId)) throw new SelectionResolutionError("SELECTION_NOT_FOUND")
      let result
      try { result = await client.rpc("get_flight_search_selection_v1", { p_alternative_id: alternativeId }) } catch { throw persistenceError("PERSISTENCE_UNAVAILABLE") }
      if (result?.error) {
        const mapped = mapRpcError(result.error)
        if (mapped.code === "NOT_FOUND") throw new SelectionResolutionError("SELECTION_NOT_FOUND")
        if (mapped.code === "EXPIRED") throw new SelectionResolutionError("SELECTION_EXPIRED")
        throw mapped
      }
      if (!Array.isArray(result?.data) || result.data.length !== 1 || !hasExactKeys(result.data[0], SEARCH_ROW_KEYS)) throw persistenceError("PERSISTENCE_UNAVAILABLE")
      const row = result.data[0]
      if (row.alternative_id !== alternativeId) throw persistenceError("PERSISTENCE_UNAVAILABLE")
      if (!isPayloadDigest(row.payload_digest)) throw persistenceError("PERSISTENCE_UNAVAILABLE")
      try {
        if (!isAlternativeId(row.alternative_id)) throw new TypeError("invalid alternative")
        const offer = assertRepresentative({ internalOfferId: row.internal_offer_id, provider: row.provider, providerOfferRef: row.provider_offer_ref })
        const itinerary = assertJsonSnapshot(row.itinerary_snapshot, 16384)
        const fare = assertJsonSnapshot(row.fare_snapshot, 8192)
        const previousCustomerPrice = assertCustomerPriceSnapshot(row.previous_customer_price_snapshot)
        const passengerComposition = assertPassengerComposition(row.passenger_composition)
        const expiresAt = normalizeTimestamp(row.expires_at)
        if (!expiresAt || expiresAt > previousCustomerPrice.validUntil) throw new TypeError("invalid expiry")
        if (!isFuture(expiresAt, clock)) throw new SelectionResolutionError("SELECTION_EXPIRED")
        return Object.freeze({ alternativeId: row.alternative_id, offer, itinerary, fare, previousCustomerPrice, passengerComposition, expiresAt })
      } catch (error) { if (error instanceof FlightSelectionPersistenceError || error instanceof SelectionResolutionError) throw error; throw persistenceError("PERSISTENCE_UNAVAILABLE") }
    },
  }
  return Object.freeze(resolver)
}
