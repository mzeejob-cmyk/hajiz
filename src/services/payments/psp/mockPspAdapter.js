import { createHash } from "node:crypto"
import { assertCapability, defineCapabilities } from "./adapter.js"
import { validateNormalizedPaymentEvent, validatePaymentSessionRequest } from "./contract.js"

const MOCK_SIGNATURE = "hajiz-mock-valid"
const digest = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")
const now = () => new Date().toISOString()

export class MockPspAdapter {
  #sessions = new Map()
  #networkCallCount = 0
  #clock

  constructor({ environment = "test", enabled = false, clock = now } = {}) {
    if (!enabled || !["test", "local", "staging"].includes(environment)) {
      throw new Error("Mock PSP requires an explicit test/local/staging gate")
    }
    this.#clock = clock
  }

  getMetadata() {
    return Object.freeze({
      name: "mock_psp",
      displayName: "HAJIZ deterministic mock (not real money)",
      mock: true,
      network: false,
      capabilities: defineCapabilities({
        paymentMethods: ["card", "apple_pay", "google_pay"],
        authCapture: true,
        refunds: true,
        voids: true,
        webhooks: true,
        multiCurrency: true,
      }),
    })
  }

  getNetworkCallCount() { return this.#networkCallCount }

  async createPaymentSession(input) {
    const request = validatePaymentSessionRequest(input)
    const existing = this.#sessions.get(request.idempotencyKey)
    if (existing) {
      if (existing.requestDigest !== digest(request)) throw new Error("idempotency key was reused with different payment data")
      return existing.response
    }
    const providerPaymentId = `mock_pay_${digest(`${request.paymentId}:${request.idempotencyKey}`).slice(0, 24)}`
    const response = Object.freeze({
      providerPaymentId,
      providerSession: `mock_session_${digest(providerPaymentId).slice(0, 24)}`,
      normalizedStatus: "awaiting",
      expiresAt: null,
    })
    this.#sessions.set(request.idempotencyKey, {
      request,
      requestDigest: digest(request),
      response,
      status: "awaiting",
      operation: 0,
    })
    return response
  }

  async verifyWebhookEvent({ signature, payload }) {
    assertCapability(this, "webhooks")
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("mock webhook payload is required")
    const verified = signature === MOCK_SIGNATURE
    return validateNormalizedPaymentEvent({
      verified,
      providerEventId: String(payload.providerEventId ?? "mock_missing_event"),
      providerPaymentId: String(payload.providerPaymentId ?? "mock_missing_payment"),
      normalizedStatus: payload.status,
      amount: payload.amount,
      currency: payload.currency,
      occurredAt: payload.occurredAt ?? this.#clock(),
      rawDigest: digest(payload),
    })
  }

  async getPaymentStatus({ providerPaymentId, trustedPayment }) {
    const session = this.#findSession(providerPaymentId, trustedPayment)
    return this.#event(session, providerPaymentId, "status")
  }

  async capture({ providerPaymentId, trustedPayment }) {
    assertCapability(this, "authCapture", trustedPayment?.paymentMethod)
    const session = this.#findSession(providerPaymentId, trustedPayment)
    if (session.status !== "awaiting") throw new Error("only an awaiting mock authorization can be captured")
    session.status = "confirmed"
    return this.#event(session, providerPaymentId, "capture")
  }

  async voidAuthorization({ providerPaymentId, trustedPayment }) {
    assertCapability(this, "voids", trustedPayment?.paymentMethod)
    const session = this.#findSession(providerPaymentId, trustedPayment)
    if (session.status !== "awaiting") throw new Error("only an awaiting mock authorization can be voided")
    session.status = "rejected"
    return this.#event(session, providerPaymentId, "void")
  }

  async refund({ providerPaymentId, trustedPayment }) {
    assertCapability(this, "refunds", trustedPayment?.paymentMethod)
    const session = this.#findSession(providerPaymentId, trustedPayment)
    if (session.status !== "confirmed") throw new Error("only a confirmed mock payment can be refunded")
    session.status = "refunded"
    return this.#event(session, providerPaymentId, "refund")
  }

  #findSession(providerPaymentId, trustedPayment) {
    const request = validatePaymentSessionRequest(trustedPayment)
    const session = this.#sessions.get(request.idempotencyKey)
    if (!session || session.response.providerPaymentId !== providerPaymentId || session.requestDigest !== digest(request)) {
      throw new Error("mock payment session does not match trusted payment data")
    }
    return session
  }

  #event(session, providerPaymentId, operation) {
    session.operation += 1
    return validateNormalizedPaymentEvent({
      verified: true,
      providerEventId: `mock_evt_${digest(`${providerPaymentId}:${operation}:${session.operation}`).slice(0, 24)}`,
      providerPaymentId,
      normalizedStatus: session.status,
      amount: session.request.amount,
      currency: session.request.currency,
      occurredAt: this.#clock(),
      rawDigest: digest({ providerPaymentId, operation, sequence: session.operation, status: session.status }),
    })
  }
}

export const MOCK_PSP_VALID_SIGNATURE = MOCK_SIGNATURE
