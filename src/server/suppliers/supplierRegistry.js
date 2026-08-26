import { assertFlightSupplier } from "./flightSupplierContract.js"

export function createSupplierRegistry({ adapters, enabledProviderNames, defaultProviderName }) {
  if (!Array.isArray(adapters) || !Array.isArray(enabledProviderNames)) throw new TypeError("server supplier configuration is required")
  const byName = new Map(adapters.map((adapter) => {
    assertFlightSupplier(adapter)
    return [adapter.providerName, adapter]
  }))
  const enabled = new Set(enabledProviderNames)
  if (!enabled.has(defaultProviderName) || !byName.has(defaultProviderName)) throw new Error("configured default supplier is unavailable")

  return Object.freeze({
    getConfiguredFlightSupplier() {
      const adapter = byName.get(defaultProviderName)
      if (!adapter || !enabled.has(defaultProviderName)) throw new Error("configured supplier is unavailable")
      return adapter
    },
    getByServerProviderName(providerName) {
      if (!enabled.has(providerName)) throw new Error("supplier is unknown or disabled")
      const adapter = byName.get(providerName)
      if (!adapter) throw new Error("supplier is unknown or disabled")
      return adapter
    },
  })
}

export function selectSupplierForClientRequest(registry, request = {}) {
  if (Object.hasOwn(request, "provider") || Object.hasOwn(request, "supplier") || Object.hasOwn(request, "providerName")) {
    throw new TypeError("clients cannot select a supplier")
  }
  return registry.getConfiguredFlightSupplier()
}
