import { defineCapabilities } from "./adapter.js"

const STATUS_MAP = Object.freeze({
  payment_pending: "awaiting",
  payment_approved: "awaiting",
  payment_captured: "confirmed",
  payment_declined: "rejected",
  payment_expired: "expired",
  payment_refunded: "refunded",
  payment_voided: "rejected",
})

const unavailable = () => {
  throw new Error("Checkout.com sandbox is not configured; credentials, account base URL, and reviewed payment identity persistence are required")
}

export function mapCheckoutComEventType(eventType) {
  const normalized = STATUS_MAP[eventType]
  if (!normalized) throw new Error(`unsupported Checkout.com event type: ${eventType}`)
  return normalized
}

// Conformance-only adapter. It deliberately performs no network calls until a
// separate credentialed integration supplies the missing server orchestration.
export class CheckoutComSandboxAdapterSkeleton {
  async createPaymentSession() { return unavailable() }
  async verifyWebhookEvent() { return unavailable() }
  async getPaymentStatus() { return unavailable() }
  async capture() { return unavailable() }
  async voidAuthorization() { return unavailable() }
  async refund() { return unavailable() }

  getMetadata() {
    return Object.freeze({
      name: "checkout_com",
      sandbox: true,
      live: false,
      conformanceOnly: true,
      capabilities: defineCapabilities({
        paymentMethods: ["card"],
        authCapture: false,
        refunds: false,
        voids: false,
        webhooks: false,
        multiCurrency: false,
      }),
    })
  }
}
