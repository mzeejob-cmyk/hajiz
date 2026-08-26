import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { assertCapability, defineCapabilities } from "../src/services/payments/psp/adapter.js"
import {
  FROZEN_PAYMENT_STATUSES, normalizeTrustedProviderEvent, PSP_PAYMENT_METHODS,
  toApplyPaymentEventArgs, validateNormalizedPaymentEvent, validatePaymentSessionRequest,
} from "../src/services/payments/psp/contract.js"
import { MockPspAdapter, MOCK_PSP_VALID_SIGNATURE } from "../src/services/payments/psp/mockPspAdapter.js"
import { PspAdapterRegistry, resolveServerConfiguredAdapter } from "../src/services/payments/psp/registry.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
const trusted = Object.freeze({
  paymentId: "11111111-1111-1111-1111-111111111111",
  paymentReference: "PAY-TEST-0001",
  paymentMethod: "card",
  amount: "1205.00",
  currency: "AED",
  idempotencyKey: "checkout-test-0001",
  returnUrl: "https://staging.example.test/payments/return",
})
const fixedClock = () => "2026-08-25T18:00:00.000Z"
const makeMock = () => new MockPspAdapter({ environment: "test", enabled: true, clock: fixedClock })

await test("unknown provider fails closed", () => {
  assert.throws(() => new PspAdapterRegistry().resolveConfiguredProvider("missing"), /unknown PSP provider/)
})
await test("disabled provider fails closed", () => {
  const registry = new PspAdapterRegistry().register({ name: "mock_psp", adapter: makeMock(), enabled: false })
  assert.throws(() => registry.resolveConfiguredProvider("mock_psp"), /disabled/)
})
await test("server configuration is the only registry selection input", () => {
  const mock = makeMock()
  const registry = new PspAdapterRegistry().register({ name: "mock_psp", adapter: mock, enabled: true })
  assert.equal(resolveServerConfiguredAdapter(registry, { pspProvider: "mock_psp" }), mock)
  assert.throws(() => resolveServerConfiguredAdapter(registry, {}), /not configured/)
})
await test("Bankak and manual transfer names cannot enter the PSP registry", () => {
  for (const name of ["bankak", "manual_transfer"]) assert.throws(() => new PspAdapterRegistry().register({ name, adapter: makeMock(), enabled: true }), /manual rail/)
})
await test("mock construction is explicitly gated to non-production environments", () => {
  assert.throws(() => new MockPspAdapter({ environment: "production", enabled: true }), /explicit test\/local\/staging gate/)
  assert.throws(() => new MockPspAdapter({ environment: "test" }), /explicit test\/local\/staging gate/)
})
await test("session contract requires server-owned amount and currency", () => {
  assert.equal(validatePaymentSessionRequest(trusted).amount, "1205")
  assert.throws(() => validatePaymentSessionRequest({ ...trusted, amount: undefined }), /server-owned/)
  assert.throws(() => validatePaymentSessionRequest({ ...trusted, currency: "aed" }), /uppercase/)
  assert.throws(() => validatePaymentSessionRequest({ ...trusted, clientAmount: "1" }), /unsupported fields/)
})
await test("PSP contract excludes Bankak", () => {
  assert.deepEqual(PSP_PAYMENT_METHODS, ["card", "apple_pay", "google_pay"])
  assert.throws(() => validatePaymentSessionRequest({ ...trusted, paymentMethod: "bankak" }), /not supported by PSP adapters/)
})
await test("idempotent mock sessions preserve provider identity", async () => {
  const mock = makeMock()
  const first = await mock.createPaymentSession(trusted)
  const duplicate = await mock.createPaymentSession({ ...trusted })
  assert.deepEqual(duplicate, first)
  assert.match(first.providerPaymentId, /^mock_pay_/)
})
await test("idempotency key cannot be reused with different economics", async () => {
  const mock = makeMock()
  await mock.createPaymentSession(trusted)
  await assert.rejects(mock.createPaymentSession({ ...trusted, amount: "1206.00" }), /reused with different payment data/)
})
await test("redirect URL alone never confirms a payment", async () => {
  const session = await makeMock().createPaymentSession({ ...trusted, returnUrl: "https://staging.example.test/success" })
  assert.equal(session.normalizedStatus, "awaiting")
  assert.equal("confirmed" in session, false)
})
await test("verified webhook returns strict normalized fields", async () => {
  const mock = makeMock()
  const session = await mock.createPaymentSession(trusted)
  const event = await mock.verifyWebhookEvent({ signature: MOCK_PSP_VALID_SIGNATURE, payload: {
    providerEventId: "evt-1", providerPaymentId: session.providerPaymentId, status: "confirmed",
    amount: trusted.amount, currency: trusted.currency, occurredAt: fixedClock(),
  } })
  assert.deepEqual(Object.keys(event).sort(), ["amount", "currency", "normalizedStatus", "occurredAt", "providerEventId", "providerPaymentId", "rawDigest", "verified"].sort())
  assert.equal(event.verified, true)
})
await test("unverified webhook is rejected before domain handoff", async () => {
  const mock = makeMock()
  const session = await mock.createPaymentSession(trusted)
  const event = await mock.verifyWebhookEvent({ signature: "wrong", payload: {
    providerEventId: "evt-2", providerPaymentId: session.providerPaymentId, status: "confirmed", amount: trusted.amount, currency: trusted.currency,
  } })
  assert.equal(event.verified, false)
  assert.throws(() => normalizeTrustedProviderEvent(event, trusted, session.providerPaymentId), /unverified/)
})
await test("mismatched webhook economics are rejected before domain handoff", async () => {
  const mock = makeMock()
  const session = await mock.createPaymentSession(trusted)
  const event = await mock.verifyWebhookEvent({ signature: MOCK_PSP_VALID_SIGNATURE, payload: {
    providerEventId: "evt-3", providerPaymentId: session.providerPaymentId, status: "confirmed", amount: "1.00", currency: trusted.currency,
  } })
  assert.throws(() => normalizeTrustedProviderEvent(event, trusted, session.providerPaymentId), /economics/)
})
await test("mismatched provider identity is rejected before domain handoff", async () => {
  const mock = makeMock()
  const session = await mock.createPaymentSession(trusted)
  const event = await mock.verifyWebhookEvent({ signature: MOCK_PSP_VALID_SIGNATURE, payload: {
    providerEventId: "evt-4", providerPaymentId: "different", status: "confirmed", amount: trusted.amount, currency: trusted.currency,
  } })
  assert.throws(() => normalizeTrustedProviderEvent(event, trusted, session.providerPaymentId), /identity/)
})
await test("trusted handoff maps only the normalized event into apply_payment_event arguments", async () => {
  const mock = makeMock()
  const session = await mock.createPaymentSession(trusted)
  const event = await mock.capture({ providerPaymentId: session.providerPaymentId, trustedPayment: trusted })
  const args = toApplyPaymentEventArgs("mock_psp", event, trusted, session.providerPaymentId)
  assert.equal(args.p_payment_id, trusted.paymentId)
  assert.equal(args.p_target, "confirmed")
  assert.equal(args.p_verified, true)
  assert.equal(args.p_raw_payload, null)
})
await test("unsupported provider status is rejected rather than invented", async () => {
  const mock = makeMock()
  const session = await mock.createPaymentSession(trusted)
  await assert.rejects(mock.verifyWebhookEvent({ signature: MOCK_PSP_VALID_SIGNATURE, payload: {
    providerEventId: "evt-5", providerPaymentId: session.providerPaymentId, status: "paid", amount: trusted.amount, currency: trusted.currency,
  } }), /frozen HAJIZ payment state/)
})
await test("all normalized statuses are members of the frozen HAJIZ state set", () => {
  assert.deepEqual(FROZEN_PAYMENT_STATUSES, ["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"])
  assert.throws(() => validateNormalizedPaymentEvent({ verified: true, providerEventId: "e", providerPaymentId: "p", normalizedStatus: "authorized", amount: "1", currency: "AED", occurredAt: fixedClock(), rawDigest: "a".repeat(64) }), /frozen/)
})
await test("capture, void, and refund enforce operation state gates", async () => {
  const captured = makeMock()
  const capturedSession = await captured.createPaymentSession(trusted)
  assert.equal((await captured.capture({ providerPaymentId: capturedSession.providerPaymentId, trustedPayment: trusted })).normalizedStatus, "confirmed")
  assert.equal((await captured.refund({ providerPaymentId: capturedSession.providerPaymentId, trustedPayment: trusted })).normalizedStatus, "refunded")
  await assert.rejects(captured.voidAuthorization({ providerPaymentId: capturedSession.providerPaymentId, trustedPayment: trusted }), /only an awaiting/)
  const voided = makeMock()
  const voidedSession = await voided.createPaymentSession({ ...trusted, idempotencyKey: "checkout-test-void" })
  assert.equal((await voided.voidAuthorization({ providerPaymentId: voidedSession.providerPaymentId, trustedPayment: { ...trusted, idempotencyKey: "checkout-test-void" } })).normalizedStatus, "rejected")
})
await test("capability flags fail closed", () => {
  const unavailable = async () => { throw new Error("unavailable") }
  const adapter = {
    createPaymentSession: unavailable, verifyWebhookEvent: unavailable, getPaymentStatus: unavailable,
    capture: unavailable, voidAuthorization: unavailable, refund: unavailable,
    getMetadata: () => ({ name: "limited", capabilities: defineCapabilities({ paymentMethods: ["card"], authCapture: false, refunds: false, voids: false, webhooks: false, multiCurrency: false }) }),
  }
  assert.throws(() => assertCapability(adapter, "refunds", "card"), /does not support refunds/)
  assert.throws(() => assertCapability(adapter, "refunds", "apple_pay"), /does not support apple_pay/)
})
await test("mock adapter performs no network calls", async () => {
  const mock = makeMock()
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error("network was attempted") }
  try {
    const session = await mock.createPaymentSession(trusted)
    await mock.getPaymentStatus({ providerPaymentId: session.providerPaymentId, trustedPayment: trusted })
    assert.equal(mock.getNetworkCallCount(), 0)
  } finally { globalThis.fetch = originalFetch }
})
await test("adapter layer contains no database mutation or browser secret access", async () => {
  const files = ["adapter.js", "contract.js", "registry.js", "mockPspAdapter.js"]
  for (const file of files) {
    const source = await fs.readFile(new URL(`../src/services/payments/psp/${file}`, import.meta.url), "utf8")
    assert.equal(/supabase|service_role|\.from\s*\(|\.rpc\s*\(|\b(?:insert|update|delete)\s+(?:into|public\.|bookings|payments)|bookings|NEXT_PUBLIC_|VITE_/.test(source), false, file)
  }
})

process.stdout.write(`\n${passed} PSP adapter tests passed\n`)
