import { getAccountSessionClient } from "./myTripsDataSource.js"
import { BOOKING_STATUSES, PAYMENT_STATUSES, V1_PAYMENT_METHODS } from "./contracts/paymentContract.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REFERENCE = /^HJZ-(?!DEMO(?:-|$))[A-Z0-9-]{4,40}$/
const MONEY = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,2})?$/
function gate(ok, code = "ADMIN_P2_RESPONSE_INVALID") { if (!ok) throw new Error(code) }
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) }
function row(value) {
  const fields = ["bookingReference", "bookingState", "paymentState", "method", "amount", "currency"]
  gate(plain(value) && Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key)))
  const validAmount = (typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount >= 0) || (typeof value.amount === "string" && MONEY.test(value.amount))
  gate(REFERENCE.test(value.bookingReference) && BOOKING_STATUSES.includes(value.bookingState) && PAYMENT_STATUSES.includes(value.paymentState) && V1_PAYMENT_METHODS.includes(value.method) && validAmount && /^[A-Z]{3}$/.test(value.currency))
  return Object.freeze(Object.fromEntries(fields.map(key => [key, value[key]])))
}

export function createAdminP2DataSource({ getClient = getAccountSessionClient } = {}) {
  return Object.freeze({
    async load(...authorityInput) {
      gate(authorityInput.length === 0, "ADMIN_P2_CLIENT_AUTHORITY_FORBIDDEN")
      const client = getClient()
      const identity = await client.auth.getUser()
      gate(!identity.error && UUID.test(identity.data?.user?.id ?? ""), "ADMIN_P2_AUTH_REQUIRED")
      const result = await client.functions.invoke("product-p2", { body: { operation: "adminReads", body: {} } })
      gate(!result.error, "ADMIN_P2_REQUEST_FAILED")
      gate(Array.isArray(result.data))
      return Object.freeze(result.data.map(row))
    },
  })
}

export const adminP2DataSource = createAdminP2DataSource()
