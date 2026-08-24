const SEARCHABLE_SERVICES = new Set(["flights", "hotels"])

export function buildSearchTarget(service, fields) {
  if (!SEARCHABLE_SERVICES.has(service)) return `/${service}`
  const query = new URLSearchParams(Object.entries(fields).filter(([, value]) => value)).toString()
  return `/${service}${query ? `?${query}` : ""}`
}

export function isSearchableService(service) {
  return SEARCHABLE_SERVICES.has(service)
}
