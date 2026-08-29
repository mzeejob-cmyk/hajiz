export const FLIGHT_TRAVELERS_VERSION = "flight-travelers/v1"
const TYPES = Object.freeze(["ADT", "CHD", "INF"])
const TITLES_BY_TYPE = Object.freeze({ ADT: Object.freeze(["MR", "MS", "MRS"]), CHD: Object.freeze(["CHD"]), INF: Object.freeze(["INF"]) })
const exact = (value, keys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) throw new TypeError(`${label} is invalid`)
  return value
}
const text = (value, label, { min = 1, max = 70, pattern } = {}) => {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid`)
  const normalized = value.trim()
  const hasControlCharacter = [...normalized].some((character) => { const codePoint = character.codePointAt(0); return codePoint <= 31 || codePoint === 127 })
  if (normalized.length < min || normalized.length > max || hasControlCharacter || (pattern && !pattern.test(normalized))) throw new TypeError(`${label} is invalid`)
  return normalized
}
const date = (value, label) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${label} is invalid`)
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError(`${label} is invalid`)
  return value
}

export function validateFlightTravelersV1(input, { expectedComposition, today }) {
  const payload = exact(input, ["contractVersion", "travelers", "contact"], "traveler payload")
  if (payload.contractVersion !== FLIGHT_TRAVELERS_VERSION || !Array.isArray(payload.travelers) || !expectedComposition || !/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new TypeError("traveler payload is invalid")
  const counts = { ADT: 0, CHD: 0, INF: 0 }
  const keys = new Set()
  const travelers = payload.travelers.map((item) => {
    const traveler = exact(item, ["travelerKey", "travelerType", "title", "firstName", "middleName", "lastName", "dateOfBirth", "document"], "traveler")
    if (!TYPES.includes(traveler.travelerType) || !TITLES_BY_TYPE[traveler.travelerType].includes(traveler.title)) throw new TypeError("traveler identity is invalid")
    const travelerKey = text(traveler.travelerKey, "travelerKey", { max: 40, pattern: /^[A-Za-z0-9_-]+$/ })
    if (keys.has(travelerKey)) throw new TypeError("travelerKey is duplicated")
    keys.add(travelerKey); counts[traveler.travelerType] += 1
    const document = exact(traveler.document, ["documentType", "documentNumber", "issuingCountry", "nationality", "expiryDate"], "document")
    if (document.documentType !== "PASSPORT") throw new TypeError("document type is invalid")
    const dateOfBirth = date(traveler.dateOfBirth, "dateOfBirth"); const expiryDate = date(document.expiryDate, "expiryDate")
    if (dateOfBirth >= today || expiryDate <= today) throw new TypeError("traveler dates are invalid")
    return Object.freeze({ travelerKey, travelerType: traveler.travelerType, title: traveler.title, firstName: text(traveler.firstName, "firstName"), middleName: traveler.middleName === "" ? "" : text(traveler.middleName, "middleName"), lastName: text(traveler.lastName, "lastName"), dateOfBirth, document: Object.freeze({ documentType: "PASSPORT", documentNumber: text(document.documentNumber, "documentNumber", { max: 30, pattern: /^[A-Za-z0-9-]+$/ }), issuingCountry: text(document.issuingCountry, "issuingCountry", { min: 2, max: 2, pattern: /^[A-Z]{2}$/ }), nationality: text(document.nationality, "nationality", { min: 2, max: 2, pattern: /^[A-Z]{2}$/ }), expiryDate }) })
  })
  for (const type of TYPES) if (counts[type] !== expectedComposition[type]) throw new TypeError("traveler composition does not match selected flight")
  const contact = exact(payload.contact, ["email", "phoneCountryCode", "phoneNumber"], "contact")
  const normalizedContact = Object.freeze({ email: text(contact.email, "email", { max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }).toLowerCase(), phoneCountryCode: text(contact.phoneCountryCode, "phoneCountryCode", { max: 5, pattern: /^\+[1-9]\d{0,3}$/ }), phoneNumber: text(contact.phoneNumber, "phoneNumber", { min: 6, max: 15, pattern: /^\d+$/ }) })
  return Object.freeze({ contractVersion: FLIGHT_TRAVELERS_VERSION, travelers: Object.freeze(travelers), contact: normalizedContact })
}
