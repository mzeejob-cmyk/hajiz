export const FLIGHT_SELECTION_RESOLVER_VERSION = "flight-selection-resolver/v1"

export class SelectionResolutionError extends Error {
  constructor(code) { super(code); this.name = "SelectionResolutionError"; this.code = code }
}

export function createProcessLocalFlightSelectionResolverV1({ clock = Date.now } = {}) {
  if (typeof clock !== "function") throw new TypeError("server clock is required")
  const entries = new Map()
  const prune = () => {
    const now = clock()
    for (const [alternativeId, entry] of entries) if (Date.parse(entry.expiresAt) <= now) entries.delete(alternativeId)
  }
  const normalize = (entry) => {
    if (!entry || typeof entry.alternativeId !== "string" || !entry.offer?.internalOfferId || !entry.offer?.provider || !entry.offer?.providerOfferRef || !entry.previousCustomerPrice?.validUntil) throw new TypeError("trusted selection entry is required")
    const expiresAt = [entry.offer.validity?.expiresAt, entry.previousCustomerPrice.validUntil].filter(Boolean).sort()[0]
    if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) throw new TypeError("selection expiry is required")
    return Object.freeze({ ...entry, expiresAt })
  }
  const sameRepresentative = (left, right) => left.offer.internalOfferId === right.offer.internalOfferId && left.offer.provider === right.offer.provider && left.offer.providerOfferRef === right.offer.providerOfferRef
  const resolver = {
    durability: "process-local-non-production",
    rememberSearch(searchEntries) {
      if (!Array.isArray(searchEntries)) throw new TypeError("trusted search selection entries are required")
      prune()
      const staged = new Map()
      for (const input of searchEntries) {
        const entry = normalize(input)
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
