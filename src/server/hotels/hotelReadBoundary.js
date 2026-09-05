import { randomUUID } from "node:crypto"
import { hotelGate, hotelId, hotelDigest } from "./hotelMappingStore.js"

export const HOTEL_H2_CAPABILITIES = Object.freeze({ search_hotels: true, get_hotel_details: true, get_room_rates: true, reprice_rate: true, hold_room: false, create_booking: false, payment: false, retrieve_voucher: false, cancel_booking: false })
// No hotel provider/endpoint has been approved or discovered. A future integration must
// register its concrete sandbox transport with endpoint allowlisting and live evidence.
export const APPROVED_HOTEL_SANDBOX_PROVIDERS = Object.freeze([])

function exact(value, keys) {
  hotelGate(value && typeof value === "object" && !Array.isArray(value), "REQUEST_INVALID")
  hotelGate([Object.prototype, null].includes(Object.getPrototypeOf(value)), "REQUEST_INVALID")
  hotelGate(Object.keys(value).every(k => keys.includes(k)), "CLIENT_AUTHORITY_FORBIDDEN")
}
function stayInput(value) {
  exact(value, ["destination", "checkIn", "checkOut", "adults", "children"])
  hotelGate(typeof value.destination === "string" && /^[A-Z0-9_-]{2,32}$/.test(value.destination), "DESTINATION_INVALID")
  for (const date of [value.checkIn, value.checkOut]) hotelGate(typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date, "DATES_INVALID")
  hotelGate(value.checkOut > value.checkIn && (Date.parse(value.checkOut) - Date.parse(value.checkIn)) / 86400000 <= 30, "DATES_INVALID")
  hotelGate(Number.isInteger(value.adults) && value.adults >= 1 && value.adults <= 8 && Number.isInteger(value.children) && value.children >= 0 && value.children <= 6, "OCCUPANCY_INVALID")
  return structuredClone(value)
}
const nullableText = value => typeof value === "string" && value.length <= 500 ? value : null

export function createHotelReadBoundary({ adapter, mappings, now = Date.now, environment = process.env.NODE_ENV, maxSelections = 1000 }) {
  hotelGate(environment !== "production", "PRODUCTION_FORBIDDEN")
  hotelGate(adapter && hotelId(adapter.provider), "PROVIDER_INVALID")
  hotelGate(adapter.mode === "synthetic" && adapter.network === false && adapter.productionAllowed === false, "HOTEL_SANDBOX_NOT_AUTHORIZED")
  hotelGate(Number.isInteger(maxSelections) && maxSelections > 0, "CAPACITY_INVALID")
  for (const op of ["search", "detail", "rates", "reprice"]) hotelGate(typeof adapter[op] === "function", "ADAPTER_INCOMPLETE")
  for (const op of ["hold_room", "create_booking", "payment", "retrieve_voucher", "cancel_booking"]) hotelGate(adapter.capabilities?.[op] === false, "FORBIDDEN_CAPABILITY")
  const provider = adapter.provider
  const selections = new Map()
  function owner(context) {
    // This context is supplied by the server's verified session resolver, never the body.
    hotelGate(hotelId(context?.userId), "AUTH_REQUIRED")
    return context.userId
  }
  async function call(op, args) {
    try { return structuredClone(await adapter[op](structuredClone(args))) }
    catch { throw new Error("HOTEL_PROVIDER_FAILED") }
  }
  function property(raw, expected) {
    hotelGate(raw && raw.provider === provider && hotelId(raw.propertyId), "SUPPLIER_MISMATCH")
    if (expected) hotelGate(raw.propertyId === expected, "SUPPLIER_MISMATCH")
    const mapped = mappings.resolve(provider, raw.propertyId)
    return { canonicalHotelId: mapped.canonicalHotelId, name: nullableText(raw.name), description: nullableText(raw.description), address: nullableText(raw.address), synthetic: true, environment: "synthetic" }
  }
  function rate(raw, selected) {
    hotelGate(raw && raw.provider === provider && raw.propertyId === selected.propertyId && hotelId(raw.roomId) && hotelId(raw.rateId), "SUPPLIER_MISMATCH")
    const mapping = mappings.resolve(provider, raw.propertyId, raw.roomId)
    hotelGate(mapping.canonicalHotelId === selected.canonicalHotelId, "ROOM_PARENT_MISMATCH")
    hotelGate(raw.checkIn === selected.stay.checkIn && raw.checkOut === selected.stay.checkOut && raw.adults === selected.stay.adults && raw.children === selected.stay.children, "STAY_MISMATCH")
    hotelGate(typeof raw.currency === "string" && /^[A-Z]{3}$/.test(raw.currency), "CURRENCY_INVALID")
    hotelGate(Number.isSafeInteger(raw.marketAmountMinor) && raw.marketAmountMinor >= 0, "PRICE_INVALID")
    hotelGate(typeof raw.available === "boolean", "AVAILABILITY_INVALID")
    hotelGate(typeof raw.expiresAt === "string" && Number.isFinite(Date.parse(raw.expiresAt)), "RATE_EXPIRY_REQUIRED")
    hotelGate(raw.board === null || (typeof raw.board === "string" && /^[a-z0-9_-]{1,64}$/.test(raw.board)), "BOARD_INVALID")
    hotelGate(raw.refundable === null || typeof raw.refundable === "boolean", "REFUNDABILITY_INVALID")
    hotelGate(raw.cancellationCode === null || (typeof raw.cancellationCode === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(raw.cancellationCode)), "CANCELLATION_INVALID")
    hotelGate(raw.taxesIncluded === null || typeof raw.taxesIncluded === "boolean", "TAXES_INVALID")
    hotelGate(raw.feesMinor === null || (Number.isSafeInteger(raw.feesMinor) && raw.feesMinor >= 0), "FEES_INVALID")
    const identity = [provider, raw.propertyId, raw.roomId, raw.rateId, raw.currency, raw.adults, raw.children, raw.checkIn, raw.checkOut, raw.board, raw.cancellationCode, raw.refundable, raw.taxesIncluded]
    return { canonicalHotelId: mapping.canonicalHotelId, canonicalRoomId: mapping.canonicalRoomId, canonicalRateId: `hjz_rate_${hotelDigest(identity)}`, roomName: nullableText(raw.roomName), board: raw.board, cancellation: { policyCode: raw.cancellationCode, refundable: raw.refundable }, currency: raw.currency, finalAmountMinor: raw.marketAmountMinor, taxes: { included: raw.taxesIncluded, feesMinor: raw.feesMinor }, occupancy: { adults: raw.adults, children: raw.children }, available: raw.available, expiresAt: raw.expiresAt, synthetic: true }
  }
  function selected(context, input, withRate = false) {
    const userId = owner(context)
    exact(input, withRate ? ["selectionId", "canonicalHotelId", "canonicalRoomId", "canonicalRateId"] : ["selectionId", "canonicalHotelId"])
    const item = selections.get(input.selectionId)
    hotelGate(item && item.userId === userId && item.canonicalHotelId === input.canonicalHotelId, "SELECTION_NOT_FOUND")
    hotelGate(item.until > now() && item.revision === mappings.revision, "SELECTION_STALE")
    hotelGate(mappings.resolve(provider, item.propertyId).canonicalHotelId === item.canonicalHotelId, "MAPPING_CHANGED")
    return item
  }
  return Object.freeze({
    capabilities: HOTEL_H2_CAPABILITIES,
    async search(context, input) {
      const userId = owner(context), stay = stayInput(input)
      hotelGate(stay.checkIn >= new Date(now()).toISOString().slice(0, 10), "DATES_STALE")
      const raw = await call("search", stay)
      hotelGate(Array.isArray(raw) && raw.length <= 500, "SUPPLIER_SHAPE_INVALID")
      const groups = new Map()
      for (const item of raw) {
        const publicProperty = property(item)
        const existing = groups.get(publicProperty.canonicalHotelId)
        hotelGate(!existing || existing.propertyId === item.propertyId, "PROPERTY_SOURCE_AMBIGUOUS")
        if (!existing) groups.set(publicProperty.canonicalHotelId, { propertyId: item.propertyId, publicProperty })
      }
      for (const [key, item] of selections) if (item.until <= now()) selections.delete(key)
      hotelGate(selections.size + groups.size <= maxSelections, "SELECTION_CAPACITY")
      return [...groups.values()].sort((a, b) => a.publicProperty.canonicalHotelId.localeCompare(b.publicProperty.canonicalHotelId)).map(({ propertyId, publicProperty }) => {
        const selectionId = `hjz_hsel_${randomUUID()}`
        selections.set(selectionId, { userId, propertyId, canonicalHotelId: publicProperty.canonicalHotelId, stay, until: now() + 300000, revision: mappings.revision, rates: new Map() })
        return { ...publicProperty, selectionId }
      })
    },
    async detail(context, input) {
      const item = selected(context, input)
      const result = property(await call("detail", { propertyId: item.propertyId, stay: item.stay }), item.propertyId)
      selected(context, input)
      hotelGate(result.canonicalHotelId === item.canonicalHotelId, "MAPPING_CHANGED")
      return result
    },
    async rates(context, input) {
      const item = selected(context, input)
      const raw = await call("rates", { propertyId: item.propertyId, stay: item.stay })
      selected(context, input)
      hotelGate(Array.isArray(raw) && raw.length <= 500, "SUPPLIER_SHAPE_INVALID")
      const next = new Map()
      for (const r of raw) {
        const publicRate = rate(r, item)
        hotelGate(publicRate.available && Date.parse(publicRate.expiresAt) > now(), "RATE_UNAVAILABLE_OR_STALE")
        const prior = next.get(publicRate.canonicalRateId)
        hotelGate(!prior || JSON.stringify(prior.publicRate) === JSON.stringify(publicRate), "RATE_DUPLICATE_CONFLICT")
        next.set(publicRate.canonicalRateId, { raw: r, publicRate })
      }
      item.rates = next
      return [...next.values()].map(v => structuredClone(v.publicRate))
    },
    async reprice(context, input) {
      const item = selected(context, input, true), previous = item.rates.get(input.canonicalRateId)
      hotelGate(previous && previous.publicRate.canonicalRoomId === input.canonicalRoomId, "RATE_NOT_FOUND")
      hotelGate(Date.parse(previous.publicRate.expiresAt) > now(), "RATE_STALE")
      const raw = await call("reprice", { propertyId: item.propertyId, roomId: previous.raw.roomId, rateId: previous.raw.rateId, stay: item.stay })
      const result = rate(raw, item)
      hotelGate(result.currency === previous.publicRate.currency, "CURRENCY_MISMATCH")
      hotelGate(result.canonicalRateId === input.canonicalRateId, "RATE_IDENTITY_MISMATCH")
      hotelGate(result.available && Date.parse(result.expiresAt) > now(), "RATE_UNAVAILABLE_OR_STALE")
      selected(context, input, true)
      hotelGate(item.rates.get(input.canonicalRateId) === previous && Date.parse(previous.publicRate.expiresAt) > now(), "RATE_STALE")
      return { ...result, previousAmountMinor: previous.publicRate.finalAmountMinor, priceChanged: result.finalAmountMinor !== previous.publicRate.finalAmountMinor, bookingAllowed: false, holdAllowed: false, continueToPayment: "NOT_YET_WIRED" }
    },
  })
}
