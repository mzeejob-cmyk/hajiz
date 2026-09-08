import { getAccountSessionClient } from "./myTripsDataSource.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AMOUNT = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,2})?$/
const KYC_STATES = new Set(["NOT_SUBMITTED", "PENDING", "VERIFIED", "REJECTED"])
const COMMISSION_STATES = new Set(["PENDING", "EARNED", "REVERSED"])
const PAYOUT_STATES = new Set(["PENDING", "PROCESSING", "PAID", "FAILED", "UNKNOWN"])

function gate(ok, code = "PARTNER_P2_RESPONSE_INVALID") { if (!ok) throw new Error(code) }
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) }
function exact(value, fields) { gate(plain(value) && Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key))) }
function row(value, states) {
  exact(value, ["id", "currency", "amount", "state"])
  gate(UUID.test(value.id) && /^[A-Z]{3}$/.test(value.currency) && typeof value.amount === "string" && AMOUNT.test(value.amount) && states.has(value.state))
  return Object.freeze({ id: value.id, currency: value.currency, amount: value.amount, state: value.state })
}

export function createPartnerP2DataSource({ getClient = getAccountSessionClient } = {}) {
  return Object.freeze({
    async load(...authorityInput) {
      gate(authorityInput.length === 0, "PARTNER_P2_CLIENT_AUTHORITY_FORBIDDEN")
      const client = getClient()
      const identity = await client.auth.getUser()
      gate(!identity.error && UUID.test(identity.data?.user?.id ?? ""), "PARTNER_P2_AUTH_REQUIRED")
      const result = await client.functions.invoke("product-p2", { body: { operation: "partner", body: {} } })
      gate(!result.error, "PARTNER_P2_REQUEST_FAILED")
      exact(result.data, ["kycState", "commissions", "payouts", "payoutExecutionAllowed", "availableCommission", "walletBalance"])
      gate(KYC_STATES.has(result.data.kycState) && Array.isArray(result.data.commissions) && Array.isArray(result.data.payouts))
      gate(result.data.payoutExecutionAllowed === false && result.data.availableCommission === null && result.data.walletBalance === null)
      return Object.freeze({ kycState: result.data.kycState, commissions: Object.freeze(result.data.commissions.map(value => row(value, COMMISSION_STATES))), payouts: Object.freeze(result.data.payouts.map(value => row(value, PAYOUT_STATES))), payoutExecutionAllowed: false, availableCommission: null, walletBalance: null })
    },
  })
}

export const partnerP2DataSource = createPartnerP2DataSource()
