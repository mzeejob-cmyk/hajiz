import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { MockPspAdapter } from "../src/services/payments/psp/mockPspAdapter.js"
import { createMockFlightSupplier } from "../src/server/suppliers/mockFlightSupplier.js"
import { runStagingMockBookingV1 } from "../src/server/orchestration/stagingBookingOrchestrator.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
const payment = Object.freeze({ paymentId: "11111111-1111-1111-1111-111111111111", paymentReference: "PAY-WAVE2-SYNTHETIC", paymentMethod: "card", amount: "1205", currency: "AED", idempotencyKey: "wave2-e2e-payment-0001", returnUrl: "https://staging.example.test/return" })
const input = Object.freeze({ bookingId: "22222222-2222-2222-2222-222222222222", bookingExecutionKey: "wave2-e2e-booking-0001", supplierOfferRef: "mock-offer-dxb-krt-ek735", trustedTravelerToken: "synthetic-traveler-token", trustedPayment: payment })

function makeAuthority() {
  const booking = { id: input.bookingId, bookingRef: "HJZ-WAVE2-SYNTHETIC", paymentId: payment.paymentId, status: "pending_payment", supplierReference: null }
  const paymentEvents = new Set()
  const transitions = []
  return {
    booking, paymentEvents, transitions,
    async getBookingAuthority() { return { ...booking } },
    async applyPaymentEvent(args) {
      if (paymentEvents.has(args.p_provider_event_id)) return false
      paymentEvents.add(args.p_provider_event_id)
      assert.equal(args.p_verified, true); assert.equal(args.p_amount, "1205"); assert.equal(args.p_currency, "AED")
      if (booking.status === "pending_payment" && args.p_target === "confirmed") booking.status = "payment_confirmed"
      return true
    },
    async applyBookingTransition({ bookingId, target, supplierReference, supplierMetadata }) {
      assert.equal(bookingId, booking.id); assert.equal(supplierMetadata.synthetic, true)
      const allowed = { payment_confirmed: "processing", processing: "confirmed", confirmed: "ticketed" }
      if (allowed[booking.status] !== target) throw new Error("invalid authority transition")
      booking.status = target; booking.supplierReference = supplierReference; transitions.push(target)
      return true
    },
    async getMyBookings() { return [{ booking_ref: booking.bookingRef, status: booking.status, sold_price: 1205, currency: "AED", pay_method: "card" }] },
  }
}

const makeDeps = authority => ({ gateway: authority, psp: new MockPspAdapter({ environment: "staging", enabled: true, clock: () => "2026-08-26T12:00:00.000Z" }), supplier: createMockFlightSupplier() })

await test("trusted mock cycle reaches ticketed through every frozen authority state", async () => {
  const authority = makeAuthority()
  const result = await runStagingMockBookingV1(input, makeDeps(authority))
  assert.equal(result.status, "ticketed")
  assert.deepEqual(authority.transitions, ["processing", "confirmed", "ticketed"])
  assert.equal(authority.paymentEvents.size, 1)
  assert.equal(result.trip.status, "ticketed")
})

await test("retry after ticketed is a no-op with no duplicate payment, booking, or audit transition", async () => {
  const authority = makeAuthority(); const deps = makeDeps(authority)
  const first = await runStagingMockBookingV1(input, deps)
  const snapshot = { events: authority.paymentEvents.size, transitions: [...authority.transitions], supplierReference: authority.booking.supplierReference }
  const duplicate = await runStagingMockBookingV1(input, deps)
  assert.deepEqual(duplicate, first)
  assert.equal(authority.paymentEvents.size, snapshot.events)
  assert.deepEqual(authority.transitions, snapshot.transitions)
  assert.equal(authority.booking.supplierReference, snapshot.supplierReference)
})

await test("payment ownership mismatch fails before PSP or supplier execution", async () => {
  const authority = makeAuthority(); authority.booking.paymentId = "33333333-3333-3333-3333-333333333333"
  await assert.rejects(runStagingMockBookingV1(input, makeDeps(authority)), /does not belong/)
  assert.equal(authority.paymentEvents.size, 0); assert.deepEqual(authority.transitions, [])
})

await test("orchestrator contains no direct database writes, credentials, PII, or real network path", async () => {
  const source = await fs.readFile(new URL("../src/server/orchestration/stagingBookingOrchestrator.js", import.meta.url), "utf8")
  assert.equal(/service_role|SUPABASE|\.from\s*\(|\.(?:insert|update|delete)\s*\(|fetch\s*\(|axios|passport|email|phone/i.test(source), false)
  assert.match(source, /applyPaymentEvent/); assert.match(source, /applyBookingTransition/); assert.match(source, /getMyBookings/)
})

process.stdout.write(`\n${passed} Staging E2E orchestration tests passed\n`)
