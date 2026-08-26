import { PSP_PAYMENT_METHODS } from "./contract.js"

const CAPABILITY_KEYS = Object.freeze([
  "paymentMethods", "authCapture", "refunds", "voids", "webhooks", "multiCurrency",
])
const METHODS = Object.freeze([
  "createPaymentSession", "verifyWebhookEvent", "getPaymentStatus", "capture", "voidAuthorization", "refund", "getMetadata",
])

export function defineCapabilities(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("capabilities must be an object")
  const unknown = Object.keys(input).filter(key => !CAPABILITY_KEYS.includes(key))
  if (unknown.length) throw new TypeError(`unknown capability: ${unknown.join(", ")}`)
  const methods = input.paymentMethods
  if (!Array.isArray(methods) || !methods.length || methods.some(method => !PSP_PAYMENT_METHODS.includes(method))) {
    throw new TypeError("capabilities.paymentMethods must contain supported PSP methods only")
  }
  for (const key of CAPABILITY_KEYS.slice(1)) if (typeof input[key] !== "boolean") throw new TypeError(`${key} capability must be boolean`)
  return Object.freeze({ ...input, paymentMethods: Object.freeze([...new Set(methods)]) })
}

export function assertPspAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") throw new TypeError("PSP adapter is required")
  for (const method of METHODS) if (typeof adapter[method] !== "function") throw new TypeError(`PSP adapter is missing ${method}`)
  const metadata = adapter.getMetadata()
  if (!metadata || typeof metadata.name !== "string" || !metadata.name || metadata.name === "bankak") throw new TypeError("PSP adapter metadata is invalid")
  defineCapabilities(metadata.capabilities)
  return adapter
}

export function assertCapability(adapter, capability, paymentMethod) {
  const metadata = assertPspAdapter(adapter).getMetadata()
  if (paymentMethod && !metadata.capabilities.paymentMethods.includes(paymentMethod)) throw new Error(`${metadata.name} does not support ${paymentMethod}`)
  if (!metadata.capabilities[capability]) throw new Error(`${metadata.name} does not support ${capability}`)
  return true
}
