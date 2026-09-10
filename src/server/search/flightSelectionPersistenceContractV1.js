const HCA = /^hca_v2_[a-f0-9]{32}$/
const HPR = /^hpr_v1_[a-f0-9]{40}$/
const PROVIDER = /^[a-z0-9][a-z0-9_-]{0,63}$/
const DIGEST = /^[a-f0-9]{64}$/
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/
const CURRENCIES = new Set(["USD", "AED", "SDG"])

export const SEARCH_ROW_KEYS = Object.freeze(["alternative_id", "internal_offer_id", "provider", "provider_offer_ref", "itinerary_snapshot", "fare_snapshot", "previous_customer_price_snapshot", "passenger_composition", "expires_at", "payload_digest"])
export const PRICED_ROW_KEYS = Object.freeze(["priced_selection_id", "alternative_id", "internal_offer_id", "provider", "provider_offer_ref", "customer_price_snapshot", "itinerary_snapshot", "fare_snapshot", "passenger_composition", "expires_at", "payload_digest"])

export const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const hasExactKeys = (value, keys) => isPlainObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
export const isAlternativeId = (value) => typeof value === "string" && HCA.test(value)
export const isPricedSelectionId = (value) => typeof value === "string" && HPR.test(value)

export const normalizeTimestamp = (value) => {
  if (typeof value !== "string") return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

const jsonBytesWithin = (value, maximum) => {
  if (!isPlainObject(value)) return false
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maximum } catch { return false }
}

export const assertRepresentative = ({ internalOfferId, provider, providerOfferRef }) => {
  if (typeof internalOfferId !== "string" || internalOfferId.length < 1 || internalOfferId.length > 255) throw new TypeError("invalid representative")
  if (typeof provider !== "string" || !PROVIDER.test(provider)) throw new TypeError("invalid representative")
  if (typeof providerOfferRef !== "string" || providerOfferRef.length < 1 || providerOfferRef.length > 512) throw new TypeError("invalid representative")
  return Object.freeze({ internalOfferId, provider, providerOfferRef })
}

export const assertJsonSnapshot = (value, maximum) => {
  if (!jsonBytesWithin(value, maximum)) throw new TypeError("invalid snapshot")
  return value
}

export const assertCustomerPriceSnapshot = (value) => {
  if (!hasExactKeys(value, ["amount", "currency", "validUntil"])) throw new TypeError("invalid customer price")
  if (typeof value.amount !== "string" || value.amount.length > 40 || !DECIMAL.test(value.amount) || Number(value.amount) <= 0) throw new TypeError("invalid customer price")
  if (!CURRENCIES.has(value.currency)) throw new TypeError("invalid customer price")
  const validUntil = normalizeTimestamp(value.validUntil)
  if (!validUntil || !jsonBytesWithin(value, 4096)) throw new TypeError("invalid customer price")
  return Object.freeze({ amount: value.amount, currency: value.currency, validUntil })
}

export const assertPassengerComposition = (value) => {
  if (!hasExactKeys(value, ["ADT", "CHD", "INF"])) throw new TypeError("invalid passenger composition")
  if (!Number.isInteger(value.ADT) || value.ADT < 1 || !Number.isInteger(value.CHD) || value.CHD < 0 || !Number.isInteger(value.INF) || value.INF < 0 || !jsonBytesWithin(value, 1024)) throw new TypeError("invalid passenger composition")
  return Object.freeze({ ADT: value.ADT, CHD: value.CHD, INF: value.INF })
}

export const normalizeSearchSelectionEntry = (entry) => {
  if (!isPlainObject(entry) || !isAlternativeId(entry.alternativeId) || !isPlainObject(entry.offer)) throw new TypeError("trusted selection entry is required")
  const representative = assertRepresentative(entry.offer)
  const itinerary = assertJsonSnapshot(entry.itinerary, 16384)
  const fare = assertJsonSnapshot(entry.fare, 8192)
  const previousCustomerPrice = assertCustomerPriceSnapshot(entry.previousCustomerPrice)
  const passengerComposition = assertPassengerComposition(entry.passengerComposition)
  const offerExpiryInput = entry.offer.validity?.expiresAt
  const offerExpiry = offerExpiryInput === undefined || offerExpiryInput === null ? null : normalizeTimestamp(offerExpiryInput)
  if (offerExpiryInput !== undefined && offerExpiryInput !== null && !offerExpiry) throw new TypeError("selection expiry is invalid")
  const expiries = [offerExpiry, previousCustomerPrice.validUntil].filter(Boolean)
  const expiresAt = expiries.sort()[0]
  if (!expiresAt) throw new TypeError("selection expiry is required")
  return Object.freeze({ alternativeId: entry.alternativeId, offer: Object.freeze({ ...representative }), itinerary, fare, previousCustomerPrice, passengerComposition, expiresAt })
}

export const normalizePricedSelectionRecord = (record) => {
  if (!isPlainObject(record) || !isPricedSelectionId(record.pricedSelectionId) || !isAlternativeId(record.alternativeId)) throw new TypeError("trusted priced selection is required")
  const representative = assertRepresentative(record)
  const customerPrice = assertCustomerPriceSnapshot(record.customerPrice)
  const itinerary = assertJsonSnapshot(record.itinerary, 16384)
  const fare = assertJsonSnapshot(record.fare, 8192)
  const passengerComposition = assertPassengerComposition(record.passengerComposition)
  const expiresAt = normalizeTimestamp(record.expiresAt)
  if (!expiresAt || expiresAt !== customerPrice.validUntil) throw new TypeError("priced selection expiry is invalid")
  return Object.freeze({ pricedSelectionId: record.pricedSelectionId, alternativeId: record.alternativeId, ...representative, customerPrice, itinerary, fare, passengerComposition, expiresAt })
}

export const isPayloadDigest = (value) => typeof value === "string" && DIGEST.test(value)
export const isFuture = (value, clock) => Date.parse(value) > clock()

export const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}
