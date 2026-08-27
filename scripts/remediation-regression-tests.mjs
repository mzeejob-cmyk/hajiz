import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
const migrationUrl = new URL("../supabase/migrations/20260827171209_payment_event_consumption_and_expiry_v1.sql", import.meta.url)
const sql = await fs.readFile(migrationUrl, "utf8")
const applicability = sql.indexOf("(v.method<>'bankak'")
const eventInsert = sql.indexOf("insert into public.payment_provider_events")
const duplicateGuard = sql.indexOf("if not found then return false", eventInsert)
const paymentUpdate = sql.indexOf("update public.payments set status=p_target")

await test("refused provider event is checked before its ID can be persisted", () => {
  assert.ok(applicability >= 0)
  assert.ok(applicability < eventInsert)
  assert.match(sql.slice(applicability, eventInsert), /then return false; end if;/)
})

await test("a previously refused provider event ID remains available for a later applicable event", () => {
  assert.ok(eventInsert > applicability)
  assert.match(sql, /on conflict\(provider,provider_event_id\) do nothing;/)
})

await test("genuine duplicate applicable provider event remains idempotent", () => {
  assert.ok(eventInsert < duplicateGuard)
  assert.ok(duplicateGuard < paymentUpdate)
})

await test("expired PSP confirmation cannot mutate payment or booking or consume the event ID", () => {
  assert.match(sql, /p_target='confirmed'[^\n]+v\.expires_at is not null/)
  assert.match(sql, /p_target='confirmed'[^\n]+v\.expires_at>now\(\)/)
  assert.ok(applicability < eventInsert)
  assert.ok(eventInsert < paymentUpdate)
})

await test("Bankak awaiting to confirmed is rejected by transition enforcement", () => {
  const triggerBody = sql.slice(sql.indexOf("create or replace function app_private.enforce_payment_transition"), sql.indexOf("create or replace function public.apply_payment_event"))
  assert.match(triggerBody, /old\.status='awaiting' and old\.method<>'bankak' and new\.status='confirmed'/)
  assert.doesNotMatch(triggerBody, /old\.status='awaiting' and new\.status in \([^)]*'confirmed'/)
})

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" })
try {
  const { PaymentStatusBadge } = await vite.ssrLoadModule("/src/features/flights/components/PaymentStatusBadge.jsx")
  const trips = await vite.ssrLoadModule("/src/features/account/data/myTripsContract.js")
  const renderBadge = (domain, status) => renderToStaticMarkup(React.createElement(PaymentStatusBadge, { domain, status }))

  await test("all six canonical payment states render visible badges", () => {
    for (const status of ["awaiting", "under_review", "confirmed", "rejected", "expired", "refunded"]) {
      const markup = renderBadge("payment", status)
      assert.match(markup, new RegExp(`data-domain="payment" data-status="${status}"`))
      assert.match(markup, /<span>[^<]+<\/span>/)
    }
  })

  await test("unknown booking state renders a visible neutral badge", () => {
    const markup = renderBadge("booking", "future-state")
    assert.match(markup, /status-badge--neutral/)
    assert.match(markup, /data-status="unknown"/)
    assert.match(markup, /جاري تحديث الحالة/)
  })

  await test("unknown payment state stays unknown and renders visibly", () => {
    const rows = trips.toMyTripsPresentation([{ booking_ref: "HJZ-SYNTHETIC", status: "future-booking", sold_price: 1, currency: "AED", pay_method: "card", created_at: "2026-08-27T00:00:00Z" }], [{ booking_ref: "HJZ-SYNTHETIC", status: "future-payment" }])
    assert.equal(rows[0].bookingState, "unknown")
    assert.equal(rows[0].paymentState, "unknown")
    assert.match(renderBadge("payment", rows[0].paymentState), /data-status="unknown"/)
  })
} finally {
  await vite.close()
}

process.stdout.write(`\n${passed} remediation regression tests passed\n`)
