import { assertImplementedProvider } from "./providerIdentity.js"
import { OPERATION_METHODS, SUPPLIER_OPERATIONS, SupplierCapabilityError, assertSupplierOperation } from "./supplierOperations.js"

export const SUPPLIER_CAPABILITIES = SUPPLIER_OPERATIONS

export const OPERATIONAL_OUTCOMES = Object.freeze([
  "available", "repriced", "processing", "confirmed", "ticketed", "cancelled", "unavailable",
])

export const FROZEN_BOOKING_STATES = Object.freeze([
  "pending_payment", "payment_confirmed", "processing", "confirmed", "ticketed", "completed",
])

const requireString = (value, field) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} is required`)
}

export function validateSearchRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new TypeError("search request must be an object")
  requireString(request.origin, "origin")
  requireString(request.destination, "destination")
  requireString(request.departureDate, "departureDate")
  if (!Number.isInteger(request.adults) || request.adults < 1) throw new TypeError("adults must be a positive integer")
  return Object.freeze({ origin: request.origin, destination: request.destination, departureDate: request.departureDate, adults: request.adults })
}

export function validateBookingRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new TypeError("booking request must be an object")
  for (const field of ["supplierOfferRef", "idempotencyKey", "trustedTravelerToken"]) requireString(request[field], field)
  return Object.freeze({ supplierOfferRef: request.supplierOfferRef, idempotencyKey: request.idempotencyKey, trustedTravelerToken: request.trustedTravelerToken })
}

export function assertFlightSupplier(adapter) {
  if (!adapter || typeof adapter !== "object") throw new TypeError("supplier adapter is required")
  assertImplementedProvider(adapter.providerName)
  if (!adapter.capabilities || typeof adapter.capabilities !== "object") throw new TypeError("supplier capabilities are required")
  const unknown = Object.keys(adapter.capabilities).filter((capability) => !SUPPLIER_CAPABILITIES.includes(capability))
  if (unknown.length) throw new TypeError(`unknown supplier capability: ${unknown.join(", ")}`)
  for (const capability of SUPPLIER_CAPABILITIES) {
    if (typeof adapter.capabilities[capability] !== "boolean") throw new TypeError(`capability ${capability} must be explicit`)
    const method = OPERATION_METHODS[capability]
    if (adapter.capabilities[capability] && typeof adapter[method] !== "function") throw new TypeError(`enabled capability ${capability} requires ${method}`)
  }
  if (typeof adapter.health !== "function") throw new TypeError("supplier adapter must implement health")
  return adapter
}

export function requireCapability(adapter, capability) {
  assertSupplierOperation(capability)
  if (adapter?.capabilities?.[capability] !== true) throw new SupplierCapabilityError(adapter?.providerName ?? "unknown", capability)
  return true
}

export async function invokeSupplierOperation(adapter, operation, ...args) {
  assertFlightSupplier(adapter)
  requireCapability(adapter, operation)
  return adapter[OPERATION_METHODS[operation]](...args)
}
