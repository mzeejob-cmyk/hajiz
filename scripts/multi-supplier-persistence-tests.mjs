import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../supabase/migrations/20260827180646_multi_supplier_identity_and_operations_v1.sql',
  import.meta.url,
);
const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('offers persist canonical internal and provider-scoped identities', () => {
  assert.match(sql, /add column if not exists internal_offer_key text/);
  assert.match(sql, /add column if not exists supplier_provider text/);
  assert.match(sql, /drop constraint if exists offers_supplier_offer_ref_key/);
  assert.match(sql, /on public\.offers \(supplier_provider, supplier_offer_ref\)/);
  assert.match(sql, /contract_version = 'flight-offer\/v1'/);
});

test('supplier economics remain distinct and validated', () => {
  assert.match(sql, /supplier_amount numeric\(20, 8\)/);
  assert.match(sql, /supplier_amount is null or supplier_amount > 0/);
  assert.match(sql, /supplier_currency ~ '\^\[a-z\]\{3\}\$'/);
  assert.match(sql, /supplier_reference_payload jsonb/);
});

test('operation ledger has canonical operations and replay identity', () => {
  assert.match(sql, /create table if not exists app_private\.supplier_operations/);
  assert.match(sql, /unique \(provider, idempotency_key\)/);
  for (const operation of ['search_flights', 'reprice', 'create_booking', 'confirm_booking', 'get_booking_status', 'retrieve_ticket', 'cancel', 'change', 'hold']) {
    assert.match(sql, new RegExp(`'${operation}'`));
  }
});

test('operation ledger is private and exposes no browser grants', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table app_private\.supplier_operations from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update on table app_private\.supplier_operations to service_role/);
  assert.doesNotMatch(sql, /grant .* to (anon|authenticated)/);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

console.log(`${tests.length - failures}/${tests.length} multi-supplier persistence tests passed`);
if (failures > 0) process.exitCode = 1;
