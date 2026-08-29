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
    "20260825173046_payment_authority_staging_v1.sql": "9c902100d31c82af759c9d0f48b814af347ecf2d2f0c09664c6c5e2a64897484",
    "20260825173551_payment_authority_staging_v1_advisor_hardening.sql": "0ea110e35d663fd3eae64d8cee50b993935d2d75c4bf990104ce5b80e51d8c00",
    "20260825173703_payment_authority_staging_v1_checkout_fix.sql": "07fbfa83cb178dafecb0ee23dfad2042270d77c981c106b25c584716ee4bfd0f",
    "20260825210000_payment_authority_security_v2.sql": "7aff24afca7c4c80a8441cd4649f7efe565c59ff2c097d5ceef5bd1d2dc5886c",
    "20260826200000_psp_rejected_transition_v1.sql": "e90df32f4cfc836e2b5c0f5c5793f96c51b91fdfe5846ee1793a05216408d2ce",
    "20260827171209_payment_event_consumption_and_expiry_v1.sql": "806b56e0f7f1320627a414ae1976e23bd5a1c633e2f3e9fcba5e9264bddb1971",
    "20260827180646_multi_supplier_identity_and_operations_v1.sql": "c33a72fb1458a413dac98218507b379a04f34e492eccc4cdea627e2f7871d247",
    "PLAN_ONLY_20260825_payment_authority.sql": "da5f87ad7f83fe378fb96cf82a5842434496f3d1d810fdd229ec7fa7d17e3bcb",
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
