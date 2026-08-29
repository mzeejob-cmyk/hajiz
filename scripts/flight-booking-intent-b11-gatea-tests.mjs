import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  process.stdout.write(`✓ ${name}\n`)
}

const migration = await fs.readFile(
  new URL("../supabase/migrations/20260829120000_flight_booking_intents_v1.sql", import.meta.url),
  "utf8",
)
const canonicalState = await fs.readFile(
  new URL("../docs/MIGRATION_CANONICAL_STATE.md", import.meta.url),
  "utf8",
)
const bookingIntentDocs = await fs.readFile(
  new URL("../docs/FLIGHT_BOOKING_INTENT_B11.md", import.meta.url),
  "utf8",
)

await test("G1 B11 migration is registered with honest replay and runtime status", () => {
  assert.match(canonicalState, /20260829120000_flight_booking_intents_v1\.sql/)
  assert.match(canonicalState, /CODE-ONLY; NOT YET APPLIED; REPLAY-SAFE \/ DRIFT-DETECTING/)
  assert.match(canonicalState, /Staging first-apply, exact-replay, privilege, and owner\/RLS runtime gate/)
})

await test("G2 table creation is catalog-guarded and rejects unowned drift", () => {
  assert.match(migration, /to_regclass\('app_private\.flight_booking_intents'\)/)
  assert.match(migration, /pg_catalog\.pg_class/)
  assert.match(migration, /existing_owner is distinct from current_owner/)
  assert.match(migration, /existing_signature is distinct from canonical_table/)
  assert.match(migration, /exists with a non-canonical owner, kind, or signature/)
})

await test("G3 table guard verifies every column shape and default class", () => {
  assert.match(migration, /pg_catalog\.pg_attribute/)
  assert.match(migration, /existing_column_count <> 18/)
  for (const token of ["gen_random_uuid", "hbi_v1_", "READY_FOR_PAYMENT", "now()"])
    assert.ok(migration.includes(token), token)
  for (const column of ["owner_id", "provider_offer_ref", "traveler_snapshot", "contact_snapshot", "valid_until"])
    assert.match(migration, new RegExp(`\\('${column}',`))
})

await test("G4 every table constraint has a canonical catalog signature", () => {
  assert.match(migration, /pg_catalog\.pg_constraint/)
  assert.match(migration, /obj_description\(constraint_row\.oid, 'pg_constraint'\)/)
  assert.match(migration, /comment on constraint %I on app_private\.flight_booking_intents/)
  for (const name of [
    "flight_booking_intents_pkey",
    "flight_booking_intents_owner_id_fkey",
    "flight_booking_intents_owner_idempotency_unique",
    "flight_booking_intents_validity_check",
  ]) assert.ok(migration.includes(name), name)
})

await test("G5 index creation is replay-safe and drift-detecting", () => {
  assert.match(migration, /to_regclass\('app_private\.flight_booking_intents_owner_created_idx'\)/)
  assert.match(migration, /pg_catalog\.pg_index/)
  assert.match(migration, /pg_catalog\.pg_get_indexdef/)
  assert.match(migration, /hajiz:b11:flight_booking_intents:owner_created_idx:v1/)
  assert.match(migration, /index app_private\.flight_booking_intents_owner_created_idx has a non-canonical definition/)
})

await test("G6 deny policy creation verifies roles, predicates, and signature", () => {
  assert.match(migration, /pg_catalog\.pg_policy/)
  assert.match(migration, /existing_role_names is distinct from array\['anon', 'authenticated'\]::text\[\]/)
  assert.equal((migration.match(/regexp_replace\(\s*coalesce\(existing_(?:using|check)/g) || []).length, 2)
  assert.match(migration, /hajiz:b11:flight_booking_intents:direct_access_denied:v1/)
  assert.match(migration, /policy flight_booking_intents_direct_access_denied has a non-canonical definition/)
})

await test("G7 exact replay uses guarded objects and replace-safe RPC definitions", () => {
  assert.equal((migration.match(/create or replace function public\./g) || []).length, 2)
  assert.equal((migration.match(/create table app_private\.flight_booking_intents/g) || []).length, 1)
  assert.equal((migration.match(/create index flight_booking_intents_owner_created_idx/g) || []).length, 1)
  assert.equal((migration.match(/create policy flight_booking_intents_direct_access_denied/g) || []).length, 1)
  assert.doesNotMatch(migration, /drop (?:table|index|policy)\b/i)
})

await test("G8 frozen migrations retain their reviewed byte hashes", async () => {
  const frozen = Object.freeze({
    "20260825173046_payment_authority_staging_v1.sql": "6bf5a2ed90e56f4cdfcea179acf15cc7347b3e9af636e1287db398612c9a637a",
    "20260825173551_payment_authority_staging_v1_advisor_hardening.sql": "e0280ce96ff96a73d7a7b4ed3c57ca49eaec78e3f84e8943764fed0e0c5f4b58",
    "20260825173703_payment_authority_staging_v1_checkout_fix.sql": "8d09b174ac133c57febfdd7317b8e91583a8f08117841b599a0d5f806f36a8f7",
    "20260825210000_payment_authority_security_v2.sql": "5e77e43a5c838fdc94b4e1008760c78605518e2fd27df2c1c3867b04ff7b9407",
    "20260826200000_psp_rejected_transition_v1.sql": "c705f5f78318454824787968b074eb07638564d28037ed9ae6a1b14a2d152dd0",
    "20260827171209_payment_event_consumption_and_expiry_v1.sql": "12c67bd358b633b02c3a81310fc716be02df11432b295648a26139de346baaa1",
    "20260827180646_multi_supplier_identity_and_operations_v1.sql": "a2cfd32563fad6cb244d0a0dc40f2e184f0c1f34a7106cb8127705678322b5a6",
    "PLAN_ONLY_20260825_payment_authority.sql": "5f4adaa83c835e1152a1e97fdd9ec6111db12e957049da9f28cec6dda35cba4f",
  })
  for (const [file, expected] of Object.entries(frozen)) {
    const bytes = await fs.readFile(new URL(`../supabase/migrations/${file}`, import.meta.url))
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, file)
  }
})

await test("G9 final RLS model is enabled, explicitly non-forced, and documented", () => {
  assert.match(migration, /alter table app_private\.flight_booking_intents enable row level security;/)
  assert.match(migration, /alter table app_private\.flight_booking_intents no force row level security;/)
  assert.doesNotMatch(migration, /^alter table app_private\.flight_booking_intents force row level security;/m)
  assert.match(migration, /documented table-owner RLS behavior, not BYPASSRLS/)
})

await test("G10 browser and service roles retain no direct table privileges", () => {
  assert.match(migration, /revoke all on table app_private\.flight_booking_intents\s+from public, anon, authenticated, service_role;/)
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete|all)[\s\S]{0,100}app_private\.flight_booking_intents/i)
})

await test("G11 RPC execution remains service-role only", () => {
  assert.equal((migration.match(/grant execute on function public\.(?:create|get)_flight_booking_intent_v1[\s\S]*?to service_role;/g) || []).length, 2)
  assert.doesNotMatch(migration, /grant execute on function public\.(?:create|get)_flight_booking_intent_v1[\s\S]*?to (?:public|anon|authenticated);/)
})

await test("G12 definer RPCs pin search path, qualify relations, and share table ownership", () => {
  assert.equal((migration.match(/security definer/g) || []).length, 2)
  assert.equal((migration.match(/set search_path = ''/g) || []).length, 2)
  assert.equal((migration.match(/app_private\.flight_booking_intents/g) || []).length > 10, true)
  assert.match(migration, /function_owner is distinct from table_owner/)
  assert.match(migration, /must have the same owner/)
})

await test("G13 lookup remains owner-scoped and rejects a missing trusted owner", () => {
  assert.match(migration, /if p_owner_id is null then[\s\S]*trusted booking intent owner is required/)
  assert.match(migration, /where intent\.owner_id = p_owner_id\s+and intent\.booking_intent_id = p_booking_intent_id/)
  assert.doesNotMatch(migration, /auth\.uid\(\)\s*=\s*p_owner_id/)
})

await test("G14 docs state READY_FOR_PAYMENT is not current payability", () => {
  assert.match(bookingIntentDocs, /READY_FOR_PAYMENT` is a persisted B11 intent state, not proof that the intent is still payable/)
  assert.match(bookingIntentDocs, /row may remain `READY_FOR_PAYMENT` after `valid_until` has passed/)
  assert.match(bookingIntentDocs, /compare `valid_until` with trusted server time/)
  assert.match(bookingIntentDocs, /stale price can never initiate payment/)
})

await test("G15 B12 handoff requires exact revalidation and explicit changed-price acceptance", () => {
  const handoff = bookingIntentDocs.slice(bookingIntentDocs.indexOf("## B12 handoff"))
  assert.match(handoff, /revalidate or reprice the exact protected supplier offer/)
  assert.match(handoff, /compare the current authoritative customer price/)
  assert.match(handoff, /REPRICE_REQUIRED/)
  assert.match(handoff, /INTENT_EXPIRED/)
  assert.match(handoff, /explicit customer acceptance through B9\/B10/)
  assert.match(handoff, /never initiate from stale pricing/)
  assert.match(handoff, /silently update a price/)
})

assert.equal(passed, 15)
process.stdout.write(`Flight booking intent B11 Gate A tests: ${passed}/15 passed\n`)
