import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { assertPspAdapter } from "../src/services/payments/psp/adapter.js"
import { CheckoutComSandboxAdapterSkeleton, mapCheckoutComEventType } from "../src/services/payments/psp/checkoutComSandboxAdapter.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) }

await test("Checkout.com documented terminal events map narrowly", () => {
  assert.equal(mapCheckoutComEventType("payment_captured"), "confirmed")
  assert.equal(mapCheckoutComEventType("payment_declined"), "rejected")
  assert.equal(mapCheckoutComEventType("payment_refunded"), "refunded")
  assert.equal(mapCheckoutComEventType("payment_voided"), "rejected")
  assert.throws(() => mapCheckoutComEventType("payment_capture_declined"), /unsupported/)
})

await test("skeleton satisfies the fixed PSP surface but advertises no live capability", () => {
  const adapter = assertPspAdapter(new CheckoutComSandboxAdapterSkeleton())
  const metadata = adapter.getMetadata()
  assert.equal(metadata.live, false)
  assert.equal(metadata.conformanceOnly, true)
  for (const capability of ["authCapture", "refunds", "voids", "webhooks", "multiCurrency"]) assert.equal(metadata.capabilities[capability], false)
})

await test("all operations fail closed without credentials and reviewed identity orchestration", async () => {
  const adapter = new CheckoutComSandboxAdapterSkeleton()
  for (const method of ["createPaymentSession", "verifyWebhookEvent", "getPaymentStatus", "capture", "voidAuthorization", "refund"]) {
    await assert.rejects(adapter[method]({}), /not configured/)
  }
})

await test("skeleton has no secret, browser config, database, or network access", async () => {
  const source = await fs.readFile(new URL("../src/services/payments/psp/checkoutComSandboxAdapter.js", import.meta.url), "utf8")
  assert.equal(/fetch\s*\(|supabase|service_role|VITE_|NEXT_PUBLIC_|sk_(?:sbox|live)|pk_(?:sbox|live)/.test(source), false)
})

await test("rejected migration is narrow and retains replay and audit controls", async () => {
  const sql = await fs.readFile(new URL("../supabase/migrations/20260826200000_psp_rejected_transition_v1.sql", import.meta.url), "utf8")
  assert.match(sql, /v\.method<>'bankak' and v\.status='awaiting' and p_target in \('confirmed','rejected'\)/)
  assert.match(sql, /old\.status='awaiting' and old\.method<>'bankak' and new\.status='rejected'/)
  assert.match(sql, /on conflict\(provider,provider_event_id\) do nothing/)
  assert.match(sql, /if not found then return false/)
  assert.match(sql, /insert into public\.payment_audit/)
  assert.doesNotMatch(sql, /under_review' and p_target='rejected'/)
})

process.stdout.write(`\n${passed} PSP sandbox adapter tests passed\n`)
