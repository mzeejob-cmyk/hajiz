const norm = value => String(value ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "")
const exactKey = property => [norm(property.countryCode), norm(property.cityCode), norm(property.address), norm(property.latitude), norm(property.longitude)].join("|")

export function mapProperty(property, mappingTable) {
  const candidates = mappingTable.filter(item => item.provider === property.provider && item.supplierHotelId === property.supplierHotelId)
  if (candidates.length === 1) return Object.freeze({ state: "mapped", canonicalHotelId: candidates[0].canonicalHotelId })
  if (candidates.length > 1) return Object.freeze({ state: "ambiguous", canonicalHotelId: null })
  const identityMatches = mappingTable.filter(item => item.identityKey === exactKey(property))
  if (identityMatches.length === 1) return Object.freeze({ state: "mapped", canonicalHotelId: identityMatches[0].canonicalHotelId })
  return Object.freeze({ state: identityMatches.length > 1 ? "ambiguous" : "unmapped", canonicalHotelId: null })
}

export function roomIdentity(room) {
  return [room.category, room.bed, room.occupancy?.adults, room.occupancy?.children, room.sizeSqm ?? "", room.view ?? ""].map(norm).join("|")
}

export function rateIdentity(rate) {
  return [rate.canonicalRoomId, rate.board, rate.cancellation?.policyCode, rate.refundable, rate.occupancy?.adults, rate.occupancy?.children, rate.checkIn, rate.checkOut, rate.taxes?.included].map(norm).join("|")
}

export function dedupeHotelOffers(offers) {
  const properties = new Map()
  for (const offer of offers) {
    if (offer.mappingState !== "mapped") {
      properties.set(`isolated:${offer.opaqueOfferId}`, { ...offer, ambiguityIsolated: true })
      continue
    }
    const current = properties.get(offer.canonicalHotelId)
    if (!current) properties.set(offer.canonicalHotelId, { ...offer, rates: [...offer.rates] })
    else {
      const seen = new Set(current.rates.map(rateIdentity))
      for (const rate of offer.rates) if (!seen.has(rateIdentity(rate))) { current.rates.push(rate); seen.add(rateIdentity(rate)) }
    }
  }
  return [...properties.values()]
}

export function rankPublicOffers(offers) {
  return [...offers].sort((a, b) => a.displayTotal.amount - b.displayTotal.amount)
}

export const propertyIdentityKey = exactKey
