export const KNOWN_SUPPLIER_PROVIDERS = Object.freeze([
  "mock", "travelport", "duffel", "tbo", "amadeus", "pkfare", "mystifly", "airgateway",
])

export const IMPLEMENTED_SUPPLIER_PROVIDERS = Object.freeze(["mock", "travelport"])

export function assertKnownProvider(provider) {
  if (!KNOWN_SUPPLIER_PROVIDERS.includes(provider)) throw new TypeError(`unknown supplier provider: ${provider}`)
  return provider
}

export function assertImplementedProvider(provider) {
  assertKnownProvider(provider)
  if (!IMPLEMENTED_SUPPLIER_PROVIDERS.includes(provider)) throw new Error(`supplier adapter is not implemented: ${provider}`)
  return provider
}
