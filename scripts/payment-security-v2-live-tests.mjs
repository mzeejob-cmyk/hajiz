import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY
const password = process.env.HAJIZ_V2_TEST_PASSWORD
if (!url || !key || !password) throw new Error("Missing staging live-test environment")

const actors = Object.fromEntries(await Promise.all([
  ["customer1", "v2-customer1@hajiz.test"],
  ["customer2", "v2-customer2@hajiz.test"],
  ["finance", "v2-finance@hajiz.test"],
  ["admin", "v2-admin@hajiz.test"],
].map(async ([role, email]) => {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return [role, client]
})))

const results = []
const runId = Date.now().toString(36)
const record = (name, pass, detail = "") => results.push({ name, pass, detail })
const expectOk = async (name, operation) => {
  const { data, error } = await operation()
  record(name, !error, error?.message || "ok")
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}
const expectDenied = async (name, operation) => {
  const { error } = await operation()
  record(name, Boolean(error), error?.message || "unexpectedly allowed")
}

const checkout = (suffix, returnUrl, method = "bankak") => actors.customer1.rpc("create_checkout", {
  p_offer_id: "20000000-0000-4000-8000-000000000001",
  p_traveler_token: "v2-token-customer1",
  p_payment_method: method,
  p_idempotency_key: `v2-live-${runId}-${suffix}`,
  p_return_url: returnUrl,
})

const allowed = await expectOk("return_url localhost allowed", () => checkout("allowed-main", "http://localhost:5173/payment/return"))
const replay = await expectOk("checkout replay idempotent", () => checkout("allowed-main", "http://localhost:5173/payment/return"))
record("checkout replay returns same payment", allowed[0].payment_id === replay[0].payment_id)

for (const [label, value] of [
  ["hostile domain", "https://evil.example/return"],
  ["subdomain trick", "http://localhost.evil.example:5173/return"],
  ["userinfo trick", "http://localhost:5173@evil.example/return"],
  ["encoded redirect", "http://localhost:5173/%2f%2fevil.example"],
  ["http non-local", "http://hajiz.com/return"],
  ["javascript", "javascript:alert(1)"],
  ["data", "data:text/html,evil"],
  ["whitespace", " http://localhost:5173/return"],
  ["open redirect query", "http://localhost:5173/return?next=https://evil.example"],
  ["backslash", "http://localhost:5173/\\evil.example"],
]) await expectDenied(`return_url rejects ${label}`, () => checkout(`reject-${label.replaceAll(" ", "-")}`, value))

await expectOk("customer get_my_bookings", () => actors.customer1.rpc("get_my_bookings"))
await expectOk("customer get_my_payments", () => actors.customer1.rpc("get_my_payments"))
await expectOk("customer update_my_profile", () => actors.customer1.rpc("update_my_profile", { p_display_name: "V2 Test", p_phone: "+249000000" }))
await expectDenied("customer cannot update payment economics", () => actors.customer1.from("payments").update({ amount: 1, status: "confirmed", reviewer_id: "10000000-0000-4000-8000-000000000001" }).eq("id", allowed[0].payment_id).select())
await expectDenied("customer cannot insert provider event", () => actors.customer1.from("payment_provider_events").insert({ payment_id: allowed[0].payment_id }))
await expectDenied("customer cannot call finance RPC", () => actors.customer1.rpc("review_bankak_payment", { p_payment_id: allowed[0].payment_id, p_decision: "confirmed", p_reason: "no" }))
await expectDenied("customer cannot call service receipt RPC", () => actors.customer1.rpc("register_inspected_receipt", { p_payment_id: allowed[0].payment_id, p_object_name: "x", p_byte_size: 1, p_detected_mime: "image/png", p_sha256: "0".repeat(64) }))
await expectDenied("customer cannot call service payment event RPC", () => actors.customer1.rpc("apply_payment_event", { p_payment_id: allowed[0].payment_id, p_target: "confirmed", p_provider: "test", p_provider_event_id: "x", p_provider_status: "ok", p_amount: 125, p_currency: "USD", p_verified: true, p_payload_digest: "x", p_occurred_at: new Date().toISOString() }))
await expectDenied("customer cannot call service booking transition RPC", () => actors.customer1.rpc("apply_booking_transition", { p_booking_id: "00000000-0000-0000-0000-000000000000", p_target: "processing" }))

const otherPayments = await expectOk("other customer sees no payment", () => actors.customer2.rpc("get_my_payments"))
record("other customer isolation", otherPayments.length === 0)

const bytes = (base64) => Uint8Array.from(Buffer.from(base64, "base64"))
const png = bytes("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
const validPath = `10000000-0000-4000-8000-000000000001/${allowed[0].payment_id}/receipt.png`
await expectOk("valid PNG upload exact path", () => actors.customer1.storage.from("receipts").upload(validPath, png, { contentType: "image/png", upsert: false }))
await expectDenied("duplicate overwrite denied", () => actors.customer1.storage.from("receipts").upload(validPath, png, { contentType: "image/png", upsert: true }))
await expectDenied("wrong payment path denied", () => actors.customer1.storage.from("receipts").upload(`10000000-0000-4000-8000-000000000001/00000000-0000-0000-0000-000000000000/x.png`, png, { contentType: "image/png" }))
await expectDenied("other user path denied", () => actors.customer1.storage.from("receipts").upload(`10000000-0000-4000-8000-000000000002/${allowed[0].payment_id}/x.png`, png, { contentType: "image/png" }))
await expectDenied("over 10MB denied", () => actors.customer1.storage.from("receipts").upload(`10000000-0000-4000-8000-000000000001/${allowed[0].payment_id}/large.png`, new Uint8Array(10 * 1024 * 1024 + 1), { contentType: "image/png" }))
const { data: listed, error: listError } = await actors.customer1.storage.from("receipts").list("10000000-0000-4000-8000-000000000001")
record("browser list reveals no objects", !listError && listed.length === 0)
await expectDenied("browser read denied", () => actors.customer1.storage.from("receipts").download(validPath))
const { data: removed, error: removeError } = await actors.customer1.storage.from("receipts").remove([validPath])
record("browser delete affects no objects", !removeError && removed.length === 0)

const invoke = async (objectName) => actors.customer1.functions.invoke("inspect-payment-receipt", { body: { paymentId: allowed[0].payment_id, objectName } })
await expectOk("server detects valid PNG content", () => invoke(validPath))

const wrong = await expectOk("create checkout for wrong-content fixture", () => checkout("wrong-content", "http://127.0.0.1:5173/return"))
const wrongPath = `10000000-0000-4000-8000-000000000001/${wrong[0].payment_id}/renamed.jpg`
await expectOk("renamed wrong content reaches inspection boundary", () => actors.customer1.storage.from("receipts").upload(wrongPath, new TextEncoder().encode("not a jpeg"), { contentType: "image/jpeg" }))
await expectDenied("server rejects renamed .jpg wrong content", () => actors.customer1.functions.invoke("inspect-payment-receipt", { body: { paymentId: wrong[0].payment_id, objectName: wrongPath } }))

const jpegCheckout = await expectOk("create checkout for JPEG fixture", () => checkout("valid-jpeg", "http://localhost:5173/return"))
const jpeg = bytes("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==")
const jpegPath = `10000000-0000-4000-8000-000000000001/${jpegCheckout[0].payment_id}/receipt.jpg`
await expectOk("valid JPEG upload", () => actors.customer1.storage.from("receipts").upload(jpegPath, jpeg, { contentType: "image/jpeg" }))
await expectOk("server detects valid JPEG content", () => actors.customer1.functions.invoke("inspect-payment-receipt", { body: { paymentId: jpegCheckout[0].payment_id, objectName: jpegPath } }))

const pdfCheckout = await expectOk("create checkout for PDF fixture", () => checkout("valid-pdf", "http://localhost:5173/return"))
const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
const pdfPath = `10000000-0000-4000-8000-000000000001/${pdfCheckout[0].payment_id}/receipt.pdf`
await expectOk("valid PDF upload", () => actors.customer1.storage.from("receipts").upload(pdfPath, pdf, { contentType: "application/pdf" }))
await expectOk("server detects valid PDF content", () => actors.customer1.functions.invoke("inspect-payment-receipt", { body: { paymentId: pdfCheckout[0].payment_id, objectName: pdfPath } }))

await expectOk("finance reviews Bankak", () => actors.finance.rpc("review_bankak_payment", { p_payment_id: allowed[0].payment_id, p_decision: "confirmed", p_reason: "v2 finance test" }))
await expectOk("admin reviews Bankak", () => actors.admin.rpc("review_bankak_payment", { p_payment_id: jpegCheckout[0].payment_id, p_decision: "confirmed", p_reason: "v2 admin test" }))
await expectDenied("finance cannot jump booking state", () => actors.finance.rpc("apply_booking_transition", { p_booking_id: "00000000-0000-0000-0000-000000000000", p_target: "ticketed" }))

const paymentRows = await expectOk("customer final payment read", () => actors.customer1.rpc("get_my_payments"))
record("finance confirmation is confirmed payment", paymentRows.find((p) => p.payment_id === allowed[0].payment_id)?.status === "confirmed")
const bookings = await expectOk("customer final booking read", () => actors.customer1.rpc("get_my_bookings"))
record("payment confirmation moves booking only to payment_confirmed", bookings.some((b) => b.booking_ref === allowed[0].booking_ref && b.status === "payment_confirmed"))

console.log(JSON.stringify({ pass: results.every((r) => r.pass), results }, null, 2))
if (results.some((r) => !r.pass)) process.exitCode = 1
