import { HOTEL_FIXTURES as PRESENTATION_HOTELS, PALM_ROOMS as PRESENTATION_ROOMS } from "./hotelFixtures.js"

const stay = Object.freeze({ checkIn: "2026-09-15", checkOut: "2026-09-18", nights: 3, guests: Object.freeze({ adults: 2, children: 0, rooms: 1 }) })
const hold = Object.freeze({ holdAvailable: false, holdType: "none", holdUntil: null, priceGuaranteedUntil: null, supplierHoldCost: null })

export const PROPERTY_MAPPINGS = Object.freeze([
  { provider: "fixture-a", supplierHotelId: "internal-101", canonicalHotelId: "hjz_htl_palm_dubai", identityKey: "ae|dxb|palm-jumeirah-crescent|25-1124|55-139" },
  { provider: "fixture-a", supplierHotelId: "internal-102", canonicalHotelId: "hjz_htl_marina_sky", identityKey: "ae|dxb|dubai-marina|25-08|55-14" },
  { provider: "fixture-a", supplierHotelId: "internal-103", canonicalHotelId: "hjz_htl_rawda_apartments", identityKey: "ae|dxb|al-barsha|25-11|55-2" },
])

const canonicalRooms = [
  ["hjz_room_palm_deluxe", "hjz_rate_palm_deluxe_breakfast_flex", "deluxe", "double", 2, 0, 38, "garden", "breakfast", "flex-24h", true, 1430, true],
  ["hjz_room_palm_standard", "hjz_rate_palm_standard_room_only_strict", "standard", "double", 2, 0, 30, "city", "room_only", "strict", false, 1180, true],
  ["hjz_room_palm_junior_suite", "hjz_rate_palm_junior_breakfast_partial", "junior_suite", "double", 2, 1, 52, "sea", "breakfast", "partial", true, 1620, false],
]
export const PALM_ROOMS = Object.freeze(PRESENTATION_ROOMS.map((room, index) => { const [canonicalRoomId, canonicalRateId, category, bed, adults, children, sizeSqm, view, board, policyCode, refundable, finalAmount, included] = canonicalRooms[index]; return Object.freeze({ ...room, canonicalRoomId, canonicalRateId, category, bed, occupancy: Object.freeze({ adults, children }), sizeSqm, view, board, cancellation: Object.freeze({ policyCode, label: room.cancellation }), refundable, finalAmount, currency: "AED", taxes: Object.freeze({ included, label: room.tax }), ...hold }) }))

const hotelIds = ["hjz_htl_palm_dubai", "hjz_htl_marina_sky", "hjz_htl_rawda_apartments"]
export const HOTEL_FIXTURES = Object.freeze(PRESENTATION_HOTELS.map((hotel, index) => Object.freeze({ ...hotel, canonicalHotelId: hotelIds[index], mappingState: "mapped", opaqueOfferId: `hjz_offer_fixture_${index + 1}`, displayTotal: Object.freeze({ amount: Number(hotel.price.replace(",", "")), currency: "AED" }), stay, rates: index === 0 ? PALM_ROOMS : Object.freeze([]) })))
export const HOTEL_DETAILS = Object.freeze({ hjz_htl_palm_dubai: Object.freeze({ canonicalHotelId: "hjz_htl_palm_dubai", name: "فندق النخلة دبي", location: "دبي · نخلة جميرا", description: "تفاصيل اصطناعية للعرض واختبار العقد فقط.", amenities: Object.freeze(["واي فاي", "مسبح", "مكتب استقبال"]), stay, rooms: PALM_ROOMS, synthetic: true, expiresAt: "2026-09-15T00:00:00Z" }) })
export const resolveHotel = keyOrId => HOTEL_FIXTURES.find(hotel => hotel.key === keyOrId || hotel.canonicalHotelId === keyOrId)
export const resolveRoom = keyOrId => PALM_ROOMS.find(room => room.key === keyOrId || room.canonicalRateId === keyOrId)
export const resolveHotelDetail = canonicalHotelId => HOTEL_DETAILS[canonicalHotelId] ?? null
export const isHotelDetailExpired = (detail, now = new Date()) => !detail?.expiresAt || new Date(detail.expiresAt) <= now
