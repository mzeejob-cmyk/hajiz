export const FLIGHT_SELECTION_RESOLVER_VERSION = "flight-selection-resolver/v1"

export class SelectionResolutionError extends Error {
  constructor(code) { super(code); this.name = "SelectionResolutionError"; this.code = code }
}

export function createProcessLocalFlightSelectionResolverV1({ clock = Date.now } = {}) {
  if (typeof clock !== "function") throw new TypeError("server clock is required")
  const entries = new Map()
  return Object.freeze({
    durability: "process-local-non-production",
    remember(entry) {
      if (!entry || typeof entry.alternativeId !== "string" || !entry.offer?.internalOfferId || !entry.previousCustomerPrice?.validUntil) throw new TypeError("trusted selection entry is required")
      const expiresAt = [entry.offer.validity?.expiresAt, entry.previousCustomerPrice.validUntil].filter(Boolean).sort()[0]
      if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) throw new TypeError("selection expiry is required")
      const existing = entries.get(entry.alternativeId)
      if (existing && existing.offer.internalOfferId !== entry.offer.internalOfferId) entries.set(entry.alternativeId, Object.freeze({ ambiguous: true, expiresAt }))
      else entries.set(entry.alternativeId, Object.freeze({ ...entry, expiresAt }))
    },
    resolve(alternativeId) {
      const entry = entries.get(alternativeId)
      if (!entry) throw new SelectionResolutionError("SELECTION_NOT_FOUND")
      if (entry.ambiguous) throw new SelectionResolutionError("SELECTION_AMBIGUOUS")
      if (Date.parse(entry.expiresAt) <= clock()) { entries.delete(alternativeId); throw new SelectionResolutionError("SELECTION_EXPIRED") }
      return entry
    },
  })
}
