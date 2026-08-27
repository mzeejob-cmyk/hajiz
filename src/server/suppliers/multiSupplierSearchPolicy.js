export const DEFAULT_MULTI_SUPPLIER_SEARCH_POLICY = Object.freeze({
  maxConcurrency: 3,
  supplierTimeoutMs: 5_000,
})

const boundedInteger = (value, field, minimum, maximum, fallback) => {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new TypeError(`${field} is invalid`)
  return value
}

export function createMultiSupplierSearchPolicy(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("search policy must be an object")
  const unknown = Object.keys(input).filter((key) => !["maxConcurrency", "supplierTimeoutMs"].includes(key))
  if (unknown.length) throw new TypeError(`unknown search policy fields: ${unknown.join(", ")}`)
  return Object.freeze({
    maxConcurrency: boundedInteger(input.maxConcurrency, "maxConcurrency", 1, 16, DEFAULT_MULTI_SUPPLIER_SEARCH_POLICY.maxConcurrency),
    supplierTimeoutMs: boundedInteger(input.supplierTimeoutMs, "supplierTimeoutMs", 1, 120_000, DEFAULT_MULTI_SUPPLIER_SEARCH_POLICY.supplierTimeoutMs),
  })
}
