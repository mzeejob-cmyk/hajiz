import { HOTEL_SUPPLIER_CAPABILITIES } from "../contracts/hotelV2.js"
import { HOTEL_FIXTURES, resolveHotelDetail } from "../data/hotelCanonicalFixtures.js"

export function createSyntheticHotelAdapter({ env = process.env } = {}) {
  if (env.NODE_ENV === "production") throw new Error("synthetic hotel adapter is forbidden in production")
  return Object.freeze({
    id: "synthetic-hotels-h1",
    synthetic: true,
    network: false,
    productionAllowed: false,
    capabilities: HOTEL_SUPPLIER_CAPABILITIES,
    async search_hotels() { return HOTEL_FIXTURES },
    async get_hotel_details({ canonicalHotelId }) { return resolveHotelDetail(canonicalHotelId) },
    async get_room_rates({ canonicalHotelId }) { return resolveHotelDetail(canonicalHotelId)?.rooms ?? [] },
    async reprice_rate() { throw new Error("NOT_IMPLEMENTED_H2") },
    async hold_room() { throw new Error("NOT_IMPLEMENTED_H2") },
    async create_booking() { throw new Error("NOT_IMPLEMENTED_H2") },
    async get_booking_status() { throw new Error("NOT_IMPLEMENTED_H2") },
    async cancel_booking() { throw new Error("NOT_IMPLEMENTED_H2") },
    async retrieve_voucher() { throw new Error("NOT_IMPLEMENTED_H2") },
  })
}
