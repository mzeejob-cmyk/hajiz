import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const migrationName = '20260827180646_multi_supplier_identity_and_operations_v1.sql';
const migrationUrl = new URL(`../supabase/migrations/${migrationName}`, import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const normalized = (value) => value.replace(/\s+/g, ' ').trim();
const guardedBlocks = [...sql.matchAll(/do \$migration\$[\s\S]*?\$migration\$;/g)].map((match) => match[0]);
const withoutGuardedBlocks = sql.replace(/do \$migration\$[\s\S]*?\$migration\$;/g, '');
const executableOutsideGuards = withoutGuardedBlocks.replace(/--.*$/gm, '');

test('offers persist canonical internal and provider-scoped identities', () => {
  assert.match(sql, /add column if not exists internal_offer_key text/);
  assert.match(sql, /add column if not exists supplier_provider text/);
  assert.match(sql, /drop constraint if exists offers_supplier_offer_ref_key/);
  assert.match(normalized(sql), /create unique index offers_provider_offer_ref_unique on public\.offers \(supplier_provider, supplier_offer_ref\) where supplier_provider is not null and supplier_offer_ref is not null/);
  assert.match(sql, /contract_version = 'flight-offer\/v1'/);
});

test('legacy null-provider references retain global uniqueness', () => {
  assert.match(normalized(sql), /create unique index offers_legacy_offer_ref_unique on public\.offers \(supplier_offer_ref\) where supplier_provider is null and supplier_offer_ref is not null/);
});

test('reference uniqueness permits equal refs only across different non-null providers', () => {
  assert.match(sql, /offers_provider_offer_ref_unique/);
  assert.match(sql, /offers_legacy_offer_ref_unique/);
  assert.doesNotMatch(withoutGuardedBlocks, /create unique index[^;]*on public\.offers \(supplier_offer_ref\)(?![^;]*supplier_provider is null)/i);
});

test('all seven added check constraints use a guarded drift-detecting block', () => {
  assert.equal(guardedBlocks.length, 2);
  const constraintGuard = guardedBlocks[0];
  assert.equal((constraintGuard.match(/'hajiz:ms-b1:[^']+:v1'/g) ?? []).length, 7);
  assert.match(constraintGuard, /existing_signature is distinct from item\.signature/);
  assert.match(constraintGuard, /raise exception 'constraint % on % exists with a non-canonical definition'/);
  assert.doesNotMatch(executableOutsideGuards, /\badd\s+constraint\b/i);
});

test('supplier currency validation remains uppercase-sensitive', () => {
  assert.match(sql, /supplier_currency ~ '\^\[A-Z\]\{3\}\$'/);
  assert.doesNotMatch(sql, /supplier_currency ~\* /);
});

test('operation ledger has canonical replay and live-concurrency identities', () => {
  assert.match(sql, /create table if not exists app_private\.supplier_operations/);
  assert.match(sql, /unique \(provider, idempotency_key\)/);
  assert.match(normalized(sql), /create unique index supplier_operations_live_unique on app_private\.supplier_operations \(booking_id, provider, operation\) where status in \('pending', 'unknown'\)/);
  assert.doesNotMatch(normalized(sql), /supplier_operations_live_unique[^;]*'succeeded'/);
});

test('operation request and identity fields are immutable after insert', () => {
  assert.match(sql, /create or replace function app_private\.enforce_supplier_operation_identity_immutable\(\)/);
  for (const field of ['booking_id', 'provider', 'operation', 'idempotency_key', 'request_digest']) {
    assert.match(sql, new RegExp(`new\\.${field} is distinct from old\\.${field}`));
  }
  assert.match(sql, /before update on app_private\.supplier_operations/);
});

test('booking supplier identity permits initial assignment and is then immutable', () => {
  assert.match(sql, /old\.supplier_provider is not null and new\.supplier_provider is distinct from old\.supplier_provider/);
  assert.match(sql, /old\.supplier_contract_version is not null and new\.supplier_contract_version is distinct from old\.supplier_contract_version/);
  assert.match(sql, /before update of supplier_provider, supplier_contract_version on public\.bookings/);
});

test('operation ledger is private and exposes no browser grants', () => {
  assert.match(sql, /alter table app_private\.supplier_operations enable row level security/);
  assert.match(sql, /revoke all on table app_private\.supplier_operations from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update on table app_private\.supplier_operations to service_role/);
  assert.doesNotMatch(sql, /grant .* to (anon|authenticated)/);
});

test('historical migrations remain untouched while later additive migrations are allowed', () => {
  const changes = execFileSync(
    'git',
    ['diff', '--name-status', 'a12f5a2293d35c6a36ef994a26a4f0c4f2d5b3d4..HEAD', '--', 'supabase/migrations'],
    { encoding: 'utf8' },
  ).trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(/\s+/, 2));
  assert.ok(changes.some(([status, path]) => status === 'A' && path === `supabase/migrations/${migrationName}`));
  assert.equal(changes.every(([status]) => status === 'A'), true);
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
