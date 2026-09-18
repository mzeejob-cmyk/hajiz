import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 Payments + Bankak regression suite.
 * Guards the node 17:88 grammar, reuse of the frozen B12 and receipt
 * authority, the settled 24-hour Bankak window, amount and FX truth, the
 * customer/finance boundary, the six status treatments and which of them are
 * runtime-wired, RTL/LTR, responsive rules, accessibility and motion safety.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")
const [css, pageSource, statusSource, receiptSource, mainSource, b12ClientSource] = await Promise.all([
  read("../src/features/flights/payments-v2.css"),
  read("../src/features/flights/FlightsPage.jsx"),
  read("../src/features/flights/components/PaymentStatusCard.jsx"),
  read("../src/features/flights/components/BankakReceiptUpload.jsx"),
  read("../src/main.jsx"),
  read("../src/features/flights/api/flightPaymentInitiationClientV1.js"),
])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { PaymentInitiationPanel } = await vite.ssrLoadModule("/src/features/flights/FlightsPage.jsx")
const { PaymentStatusCard } = await vite.ssrLoadModule("/src/features/flights/components/PaymentStatusCard.jsx")
const { BankakReceiptUpload } = await vite.ssrLoadModule("/src/features/flights/components/BankakReceiptUpload.jsx")

const intent = { bookingIntentId: "bi_1", customerPrice: { amount: "1100.00", currency: "AED", validUntil: "2026-09-16T00:00:00.000Z" } }
const bankakResult = {
  contractVersion: "flight-payment-initiation/v1", initiationStatus: "PAYMENT_INITIATED",
  bookingRef: "HJZ-0A1B2C3D4E5F", paymentId: "11111111-2222-3333-4444-555555555555",
  paymentMethod: "bankak", paymentStatus: "awaiting", bookingStatus: "pending_payment",
  amount: "1100.00", currency: "AED", expiresAt: "2026-09-16T09:30:00.000Z",
  nextAction: "COMPLETE_BANKAK_TRANSFER",
  handoff: { type: "BANKAK_MANUAL", amount: "1100000.00", currency: "SDG",
    paymentReference: "PAY-0A1B2C3D4E5F", bankAccountDisplayName: "بنك الخرطوم",
    maskedAccountNumber: "•••• 4417", receiptUploadAvailable: true },
}
const panel = (state, extra = {}) => renderToStaticMarkup(React.createElement(MemoryRouter, null,
  React.createElement(PaymentInitiationPanel, { intent, state, ...extra })))

const bankak = panel({ status: "bankak_handoff", result: bankakResult })
const idle = panel({ status: "idle" })

// ---- Canonical V2 grammar · node 17:88 ------------------------------------

await test("the Bankak handoff uses the node 17:91 composition", () => {
  assert.match(bankak, /payments-v2__bankak/)
  assert.match(bankak, /payments-v2__instructions/)
  assert.match(bankak, /payments-v2__amount/)
  assert.match(bankak, /الدفع عبر بنكك/)
  assert.match(bankak, /حوّل المبلغ، ثم ارفع صورة الإيصال للمراجعة\./)
})

await test("the Bankak card is the inverse surface with the 340px amount block", () => {
  assert.match(css, /\.payments-v2__bankak \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 340px/)
  assert.match(css, /\.payments-v2__bankak \{[\s\S]*?background: var\(--hajiz-v2-color-surface-inverse\)/)
  assert.match(css, /\.payments-v2__bankak \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-lg\)/)
})

await test("all six status treatments exist with their canonical tones", () => {
  const tones = { awaiting: "warning", under_review: "info", confirmed: "success",
    rejected: "error", expired: "error", refunded: "info" }
  for (const [status, tone] of Object.entries(tones)) {
    const html = renderToStaticMarkup(React.createElement(PaymentStatusCard, { status }))
    assert.match(html, new RegExp(`payment-status-v2--${tone}`), status)
    assert.match(html, new RegExp(`data-payment-status="${status}"`), status)
  }
  for (const tone of ["warning", "info", "success", "error"])
    assert.match(css, new RegExp(`\\.payment-status-v2--${tone} \\{`), tone)
})

await test("status cards carry the canonical Figma copy", () => {
  const expected = { awaiting: ["AWAITING", "بانتظار الدفع"], under_review: ["UNDER REVIEW", "قيد المراجعة"],
    confirmed: ["CONFIRMED", "تم تأكيد الدفع"], rejected: ["REJECTED", "تعذّر قبول الدفع"],
    expired: ["EXPIRED", "انتهت المهلة"], refunded: ["REFUNDED", "تم ردّ المبلغ"] }
  for (const [status, [code, title]] of Object.entries(expected)) {
    const html = renderToStaticMarkup(React.createElement(PaymentStatusCard, { status }))
    assert.match(html, new RegExp(code), status)
    assert.match(html, new RegExp(title), status)
  }
})

await test("an unknown status renders nothing rather than inventing a state", () => {
  assert.equal(renderToStaticMarkup(React.createElement(PaymentStatusCard, { status: "settled" })), "")
  assert.equal(renderToStaticMarkup(React.createElement(PaymentStatusCard, {})), "")
})

// ---- Runtime-wired vs presentation-only -----------------------------------

await test("only awaiting is runtime-wired from the B12 response", () => {
  // The B12 contract validates paymentStatus to exactly "awaiting"; no other
  // status can arrive through payment initiation.
  assert.match(b12ClientSource, /data\.paymentStatus !== "awaiting"/)
  assert.match(bankak, /data-payment-status="awaiting"/)
  assert.match(pageSource, /<PaymentStatusCard status=\{state\.result\.paymentStatus\}\/>/)
})

await test("the panel never manufactures a status of its own", () => {
  const block = pageSource.slice(pageSource.indexOf("export function PaymentInitiationPanel"),
    pageSource.indexOf("export function BookingIntentPanel"))
  for (const status of ["under_review", "confirmed", "rejected", "expired", "refunded"])
    assert.equal(block.includes(`"${status}"`), false, `${status} must not be hardcoded into the panel`)
})

await test("the status card holds no authority and no control", () => {
  assert.equal(/<button|<input|<a |onClick|onChange|useState|fetch|dataSource/.test(statusSource), false)
})

// ---- B12 authority reused --------------------------------------------------

await test("the page still drives the existing B12 coordinator and client", () => {
  assert.match(pageSource, /createFlightPaymentInitiationCoordinatorV1/)
  assert.match(pageSource, /useFlightPaymentInitiationClientV1/)
  assert.match(pageSource, /paymentCoordinator\.initiate/)
})

await test("no second payment client, coordinator or transport is introduced", () => {
  for (const [name, source] of [["page", pageSource], ["status", statusSource], ["receipt", receiptSource]])
    assert.equal(/fetch\s*\(|XMLHttpRequest|axios|createClient\(|supabase|["'`]https?:/i.test(source), false, name)
  assert.equal(/Coordinator|IdempotencyKey|idempotency/i.test(statusSource), false)
})

await test("no trusted payment identifier is constructed in the browser", () => {
  const block = pageSource.slice(pageSource.indexOf("export function PaymentInitiationPanel"),
    pageSource.indexOf("export function BookingIntentPanel"))
  assert.equal(/crypto\.randomUUID|Math\.random|`PAY-|`HJZ-|nanoid/.test(block), false)
  assert.match(bankak, /PAY-0A1B2C3D4E5F/)
  assert.match(bankak, /HJZ-0A1B2C3D4E5F/)
})

// ---- Bankak truth -----------------------------------------------------------

await test("the 24-hour window is stated and the 15-minute window is absent", () => {
  assert.match(bankak, /تنتهي صلاحية طلب الدفع بعد 24 ساعة/)
  assert.match(bankak, /الصلاحية 24 ساعة من إنشاء طلب الدفع/)
  for (const source of [pageSource, css, receiptSource])
    assert.equal(/15 دقيقة|15-minute|fifteen minutes|900000|900_000/.test(source), false)
})

await test("expiry is rendered from the server value in a semantic time element", () => {
  assert.match(bankak, /<time[^>]*dateTime="2026-09-16T09:30:00\.000Z"[^>]*>2026-09-16T09:30:00\.000Z<\/time>/i)
  assert.match(pageSource, /dateTime=\{state\.result\.expiresAt\}/)
})

await test("every Bankak value is the server value, verbatim", () => {
  assert.match(bankak, /1100000\.00/)
  assert.match(bankak, /SDG/)
  assert.match(bankak, /بنك الخرطوم/)
  assert.match(bankak, /•••• 4417/)
})

await test("no Figma sample payment value is encoded anywhere", () => {
  for (const source of [css, pageSource, statusSource, receiptSource])
    assert.equal(/1,100,000|HZ-SYNTHETIC|1,100 AED/.test(source), false)
})

// ---- Price and FX authority -------------------------------------------------

await test("the AED equivalent is the trusted amount, not a converted one", () => {
  assert.match(pageSource, /state\.result\.currency !== "SDG" \? state\.result : null/)
  assert.match(bankak, /يعادل/)
  assert.match(bankak, /1100\.00/)
})

await test("no browser FX or fare arithmetic exists in the payment surface", () => {
  const block = pageSource.slice(pageSource.indexOf("export function PaymentInitiationPanel"),
    pageSource.indexOf("export function BookingIntentPanel"))
  assert.equal(/toFixed|parseFloat|parseInt\(|\*\s*rate|\/\s*rate|Number\([^)]*amount/i.test(block), false)
  assert.equal(/rate|fx|exchange/i.test(statusSource), false)
})

await test("no internal economics is exposed", () => {
  const restricted = /supplier_net|net_cost|markup|commission|fx_rate|fxRate|sellingAmount/i
  for (const source of [pageSource, css, statusSource, receiptSource]) assert.equal(restricted.test(source), false)
  assert.equal(restricted.test(bankak), false)
})

// ---- Customer vs finance boundary -------------------------------------------

await test("no customer control calls a finance or admin transition", () => {
  for (const source of [pageSource, statusSource, receiptSource])
    assert.equal(/apply_payment_event|review_bankak_payment/.test(source), false)
  assert.equal(/apply_payment_event|review_bankak_payment/.test(bankak), false)
})

await test("no approve, reject, refund or override control is rendered", () => {
  for (const html of [bankak, idle, panel({ status: "psp_handoff", result: { ...bankakResult, paymentMethod: "card",
    handoff: { type: "PSP_SESSION", sessionToken: "t", redirectUrl: null, live: false } } })]) {
    assert.equal(/اعتماد الدفع|تأكيد الدفع يدويًا|رفض الدفع|ردّ المبلغ للعميل|تعديل مرجع الدفع|تمديد المهلة/.test(html), false)
  }
})

await test("the customer cannot edit the reference, expiry or amount", () => {
  const inputs = [...bankak.matchAll(/<input[^>]*>/g)].map(m => m[0])
  for (const input of inputs) assert.match(input, /type="file"/, `unexpected editable input: ${input}`)
})

// ---- Receipt authority ------------------------------------------------------

await test("the receipt upload still uses the existing data source and bounds", () => {
  assert.match(receiptSource, /bankakReceiptUploadDataSource/)
  assert.match(receiptSource, /BANKAK_RECEIPT_MIME_TYPES/)
  assert.match(receiptSource, /MAX_BANKAK_RECEIPT_BYTES/)
  assert.match(receiptSource, /accept="image\/jpeg,image\/png,application\/pdf"/)
  assert.match(receiptSource, /dataSource\.upload\(\{ paymentId, file \}\)/)
})

await test("an accepted receipt means under review, never confirmed", () => {
  const accepted = renderToStaticMarkup(React.createElement(BankakReceiptUpload,
    { paymentId: "p1", dataSource: { upload: async () => {} } }))
  assert.match(receiptSource, /تم استلام الإيصال وأصبح الدفع قيد المراجعة\./)
  assert.match(receiptSource, /هذا لا يعني تأكيد الحجز أو إصدار التذكرة\./)
  assert.match(receiptSource, /رفع الإيصال لا يؤكد الدفع أو الحجز\./)
  assert.equal(/تم الدفع|تم تأكيد الدفع|تم الحجز/.test(accepted.replace(/لا يعني/g, "«negated»")), false)
})

await test("upload progress exposes a busy state", () => {
  assert.match(receiptSource, /aria-busy=\{state === "uploading" \|\| undefined\}/)
  assert.match(receiptSource, /role="status"/)
  assert.match(receiptSource, /role="alert"/)
})

await test("receipt availability is still gated on the trusted flag", () => {
  assert.match(pageSource, /handoff\.receiptUploadAvailable === true \?/)
  assert.match(pageSource, /رفع الإيصال غير متاح حاليًا/)
  const unavailable = panel({ status: "bankak_handoff", result: { ...bankakResult,
    handoff: { ...bankakResult.handoff, receiptUploadAvailable: false } } })
  assert.match(unavailable, /رفع الإيصال غير متاح حاليًا/)
  assert.equal(/type="file"/.test(unavailable), false)
})

// ---- Product truth -----------------------------------------------------------

await test("payment confirmed never means booking confirmed", () => {
  const confirmed = renderToStaticMarkup(React.createElement(PaymentStatusCard, { status: "confirmed" }))
  assert.match(confirmed, /تم تأكيد الدفع/)
  assert.match(confirmed, /بانتظار تأكيد المورد\/التذكرة/)
  assert.equal(/الحجز مؤكد|تم الحجز|صدرت التذكرة|مقعد مؤكد/.test(confirmed), false)
})

await test("no PNR or ticket claim can come from payment status", () => {
  for (const status of ["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"]) {
    const html = renderToStaticMarkup(React.createElement(PaymentStatusCard, { status }))
    assert.equal(/PNR|رقم الحجز لدى المورد|التذكرة جاهزة|ticket/i.test(html), false, status)
  }
  assert.equal(/PNR/.test(pageSource + statusSource + receiptSource), false)
})

await test("the handoff states never claim a completed payment or booking", () => {
  const claims = bankak.replace(/لم يتم|لا يعني/g, "«negated»")
  assert.equal(/تم الدفع|تم الحجز|صدرت التذكرة/.test(claims), false)
})

// ---- PSP boundary -------------------------------------------------------------

await test("a non-live PSP session is disclosed as sandbox", () => {
  const sandbox = panel({ status: "psp_handoff", result: { ...bankakResult, paymentMethod: "card",
    handoff: { type: "PSP_SESSION", sessionToken: "t", redirectUrl: null, live: false } } })
  assert.match(sandbox, /Sandbox\/Mock/)
  assert.match(sandbox, /payments-v2__sandbox/)
  assert.match(sandbox, /لا يوجد رابط بوابة خارجي متاح/)
})

await test("a trusted redirect is used and no card form is ever rendered", () => {
  const live = panel({ status: "psp_handoff", result: { ...bankakResult, paymentMethod: "card",
    handoff: { type: "PSP_SESSION", sessionToken: "t", redirectUrl: "https://sandbox.example/pay", live: false } } })
  assert.match(live, /href="https:\/\/sandbox\.example\/pay"/)
  assert.equal(/type="tel"|autocomplete="cc-|رقم البطاقة|CVV|Apple Pay|Google Pay/i.test(live), false)
  assert.equal(/apple_pay|google_pay|wallet/i.test(pageSource), false)
})

// ---- Method selection and failure states ---------------------------------------

await test("method selection offers only the two supported methods", () => {
  assert.match(idle, /اختر طريقة الدفع/)
  assert.match(idle, /بنكك/)
  assert.match(idle, /بطاقة/)
  const radios = [...idle.matchAll(/<input[^>]*name="flight-payment-method"[^>]*>/g)]
    .map(m => m[0].match(/value="([^"]+)"/)?.[1])
  assert.deepEqual(radios, ["bankak", "card"])
})

await test("every documented failure state stays truthful and sanitized", () => {
  for (const status of ["reprice_required", "intent_expired", "unavailable", "timeout",
    "configuration_unavailable", "provider_failed", "service_unavailable", "internal_error"]) {
    const html = panel({ status })
    assert.match(html, /role="alert"/, status)
    assert.equal(/stack|Error:|postgres|SQLSTATE|supabase|undefined/i.test(html), false, status)
  }
})

await test("initiating exposes a busy state and blocks the method set", () => {
  const html = panel({ status: "initiating" })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="status"/)
  assert.match(pageSource, /disabled=\{state\?\.status === "initiating"\}/)
})

// ---- RTL / LTR ------------------------------------------------------------------

await test("payments CSS uses logical properties only", () => {
  const physical = css.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(css))
})

await test("reference, account and status codes stay isolated and readable", () => {
  assert.match(bankak, /class="payments-v2__value" dir="ltr">PAY-0A1B2C3D4E5F</)
  assert.match(bankak, /class="payments-v2__value" dir="ltr">•••• 4417</)
  assert.match(css, /\.payments-v2__value \{[\s\S]*?unicode-bidi: isolate/)
  assert.match(css, /\.payment-status-v2__code \{[\s\S]*?unicode-bidi: isolate/)
})

await test("payments render structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
      React.createElement(DirectionProvider, { initialLocale: locale },
        React.createElement(PaymentInitiationPanel, { intent, state: { status: "bankak_handoff", result: bankakResult } }))))
    assert.match(html, /payments-v2__bankak/, locale)
    assert.match(html, /data-payment-status="awaiting"/, locale)
  }
})

// ---- Responsive -------------------------------------------------------------------

await test("responsive steps exist for tablet, mobile and the narrowest viewport", () => {
  assert.match(css, /@media \(max-width: 1024px\)/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 390px\)/)
})

await test("mobile stacks the Bankak card and widens the actions", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.payments-v2__bankak \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(mobile, /\.payments-v2__actions \{ flex-direction: column/)
  assert.match(mobile, /inline-size: 100%/)
})

await test("long references and amounts wrap instead of overflowing", () => {
  for (const selector of ["__value", "__amount-value", "__amount-note", "bankak-receipt-v2__note"]) {
    const block = css.slice(css.indexOf(selector))
    assert.match(block.slice(0, 400), /overflow-wrap: anywhere/, selector)
  }
  assert.match(css, /\.payments-v2__instructions \{[\s\S]*?min-inline-size: 0/)
})

await test("no fixed width can overflow a 390px viewport", () => {
  const fixed = [...css.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(m => Number(m[1])).filter(v => v > 360)
  assert.deepEqual(fixed, [], `fixed widths: ${fixed.join(", ")}`)
})

// ---- Accessibility and motion ------------------------------------------------------

await test("every payment control meets the 48px touch floor", () => {
  for (const selector of [".payments-v2__method", ".payments-v2__redirect", ".bankak-receipt-v2__input"]) {
    const at = css.indexOf(`${selector} {`)
    assert.ok(at > -1, selector)
    assert.match(css.slice(at, css.indexOf("}", at)), /min-block-size: var\(--hajiz-v2-touch-target\)/, selector)
  }
  assert.match(receiptSource, /v2-button v2-button--primary/)
})

await test("focus is visible on every payment control", () => {
  assert.match(css, /\.payments-v2__method input:focus-visible/)
  assert.match(css, /\.bankak-receipt-v2__input:focus-visible/)
  assert.match(css, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
})

await test("the file input and the method set are properly labelled", () => {
  assert.match(receiptSource, /<label className="bankak-receipt-v2__field">إيصال التحويل<input/)
  assert.match(idle, /<legend[^>]*>طرق الدفع المتاحة<\/legend>/)
  assert.match(bankak, /aria-labelledby="b12-bankak-title"/)
})

await test("no payment state is communicated by colour alone", () => {
  for (const status of ["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"]) {
    const html = renderToStaticMarkup(React.createElement(PaymentStatusCard, { status }))
    assert.match(html, /payment-status-v2__code/, status)
    assert.match(html, /payment-status-v2__title/, status)
  }
})

await test("no second motion system is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
})

await test("reduced motion is honoured", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), /transition: none/)
})

await test("amount, expiry, reference, status and error copy never animate", () => {
  for (const selector of ["__amount-value", "__expiry-headline", "__value", "__muted",
    "__amount-note", "__equivalent", "bankak-receipt-v2__note"]) {
    const at = css.indexOf(`${selector}`)
    assert.match(css.slice(at, at + 420), /animation: none/, `${selector} is not pinned static`)
  }
  const at = css.indexOf(".payment-status-v2 {")
  assert.match(css.slice(at, css.indexOf("}", at)), /animation: none/)
  assert.match(receiptSource, /v2-no-motion/)
})

// ---- Ownership and continuity -------------------------------------------------------

await test("payments CSS loads last, after every earlier V2 layer", () => {
  const order = ['./design-system/index.css', './features/home/home-v2.css',
    './features/flights/flight-results-v2.css', './features/flights/checkout-v2.css',
    './features/flights/payments-v2.css']
  const positions = order.map(marker => mainSource.indexOf(marker))
  assert.ok(positions.every(position => position > -1))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

await test("no payment file crosses the frontend ownership boundary", () => {
  for (const [name, source] of [["page", pageSource], ["css", css],
    ["status", statusSource], ["receipt", receiptSource]])
    assert.equal(/src\/server|supabase|src\/legacy|service_role/i.test(source), false, name)
  assert.ok(!pageSource.includes("contracts/navigation.js"))
})

await test("the retired legacy fixture views stay retired", () => {
  for (const view of ["fare", "traveler", "review"])
    assert.equal(new RegExp(`params\\.get\\("view"\\) === "${view}"`).test(pageSource), false, view)
  for (const name of ["FareSelection", "TravelerDetails", "FlightReview", "flightFixtures", "fareOptions"])
    assert.equal(new RegExp(`import \\{[^}]*${name}`).test(pageSource), false, name)
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
