import assert from "node:assert/strict"
import fs from "node:fs/promises"

const proposalUrl = new URL("../docs/proposals/P2_STORAGE_PROPOSAL.sql", import.meta.url)
const serviceUrl = new URL("../src/server/product/productP2Service.js", import.meta.url)
const sql = await fs.readFile(proposalUrl, "utf8")
const service = await fs.readFile(serviceUrl, "utf8")
let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`) }
const objects = ["p2_saved_travelers", "p2_favorites", "p2_preferences", "p2_partners", "p2_kyc_transition_audit", "p2_commission_entries", "p2_payouts", "p2_catalog", "p2_notification_outbox"]
const functions = ["p2_collection_v1", "get_p2_admin_payments_v1", "get_p2_partner_v1", "p2_catalog_v1", "enqueue_p2_notification_v1", "transition_p2_partner_kyc_v1", "get_p2_ticket_artifact_authority_v1"]

await test("proposal remains review-only outside migrations", () => { assert.match(proposalUrl.pathname, /docs\/proposals/); assert.doesNotMatch(proposalUrl.pathname, /supabase\/migrations/) })
await test("proposal remains rollback-only", () => { assert.match(sql, /begin;/i); assert.equal(sql.trimEnd().endsWith("rollback;"), true) })
await test("relation precondition guards exist", () => { assert.match(sql, /M-01 PRECONDITION/); assert.match(sql, /to_regclass/); assert.match(sql, /non-canonical ownership or signature/) })
await test("all proposed storage objects have signatures and guards", () => { for (const name of objects) { assert.match(sql, new RegExp(`to_regclass\\('app_private\\.${name}'\\)|\\('app_private\\.${name}'`), name); assert.match(sql, new RegExp(`comment on table app_private\\.${name}`), name) } })
await test("column fingerprint rejects incompatible drift", () => { assert.match(sql, /Exact column fingerprint/); assert.match(sql, /pg_catalog\.format_type/); assert.match(sql, /has non-canonical columns/) })
await test("constraint catalog guards reject missing kind or signature", () => { assert.match(sql, /pg_catalog\.pg_constraint/); assert.match(sql, /missing or drifted/); assert.match(sql, /non-canonical signature/) })
await test("every declared named constraint participates in a guard", () => { const declared = [...sql.matchAll(/constraint\s+([a-z0-9_]+)/gi)].map(match => match[1]); for (const name of new Set(declared)) assert.ok(sql.split(name).length >= 3, name) })
await test("index guards reject target definition and signature drift", () => { assert.match(sql, /pg_catalog\.pg_get_indexdef/); assert.match(sql, /indisvalid/); assert.match(sql, /P2 index % is non-canonical/) })
await test("function replacement has a signed precondition", () => { assert.match(sql, /Function precondition/); assert.match(sql, /to_regprocedure/); for (const name of functions) assert.match(sql, new RegExp(`hajiz:p2:function:${name}:v2`), name) })
await test("runtime trust model is service-role RPC only", () => { assert.match(sql, /service_role receives EXECUTE only/); for (const name of functions) assert.match(sql, new RegExp(`grant execute on function public\\.${name}`), name) })
await test("service role and browser roles have no direct table grants", () => { assert.match(sql, /revoke all on table %s from public,anon,authenticated,service_role/); assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?app_private/i) })
await test("all RPCs pin search path and use SECURITY DEFINER", () => { for (const name of functions) assert.match(sql, new RegExp(`function public\\.${name}[\\s\\S]*?security definer set search_path=''`), name) })
await test("RLS is enabled as non-forced defense in depth", () => { assert.match(sql, /RLS is defense in depth/i); assert.match(sql, /enable row level security/); assert.match(sql, /no force row level security/); assert.equal(sql.split("\n").some(line => /alter table.*force row level security/i.test(line) && !/no force row level security/i.test(line)), false) })
await test("all private objects receive guarded deny policies", () => { for (const name of objects) assert.match(sql, new RegExp(`app_private\\.${name}[^\n]*direct_access_denied`), name); assert.match(sql, /using\(false\) with check\(false\)/) })
await test("table and RPC owner identity is guarded", () => { assert.match(sql, /P2 private tables must share one owner/); assert.match(sql, /P2 RPC % and private tables must share one owner/) })
await test("P2 service uses RPC adapter without raw private-table SQL", () => { assert.match(service, /createP2RpcAdapter/); assert.match(service, /client\.rpc/); assert.doesNotMatch(service, /query\("|query\(`/); assert.doesNotMatch(service, /from app_private\./) })
await test("outbox has semantic uniqueness independent of event UUID", () => { assert.match(sql, /unique\(booking_id,event_type,domain_key\)/); assert.match(sql, /on conflict\(booking_id,event_type,domain_key\) do nothing/) })
await test("one-time event domain key ignores regenerated UUID", () => { assert.match(sql, /domain:=p_event_type/); assert.doesNotMatch(sql, /domain:=p_event_id/) })
await test("failed reconciliation multiplicity requires stable source event", () => { assert.match(sql, /p_event_type='failed_reconciliation'/); assert.match(sql, /domain:=p_event_type\|\|':'\|\|p_source_event_id::text/) })
await test("outbox recipient is derived from canonical booking", () => { assert.match(sql, /select p_event_id,b\.id,b\.user_id,p_event_type/); assert.doesNotMatch(service, /recipientId/) })
await test("KYC partner timestamps and transition audit exist", () => { assert.match(sql, /create table app_private\.p2_partners[\s\S]*created_at[\s\S]*updated_at/); assert.match(sql, /create table app_private\.p2_kyc_transition_audit/) })
await test("KYC audit records actor source time and source identity", () => { for (const field of ["previous_state", "new_state", "actor_id", "actor_source", "source_event_id", "occurred_at"]) assert.match(sql, new RegExp(field), field) })
await test("KYC allowed transition matrix is fail closed", () => { assert.match(sql, /NOT_SUBMITTED' and new_state='PENDING/); assert.match(sql, /REJECTED' and new_state='PENDING/); assert.match(sql, /previous_state='PENDING' and new_state in \('VERIFIED','REJECTED'\)/); assert.doesNotMatch(sql, /previous_state='VERIFIED'/) })
await test("client cannot verify its own KYC", () => { assert.match(sql, /p_actor_source='ADMIN_REVIEW'/); assert.match(sql, /role='admin'/); assert.doesNotMatch(sql, /grant execute on function public\.transition_p2_partner_kyc_v1[^\n]*authenticated/) })
await test("KYC transition source event is idempotent", () => { assert.match(sql, /KYC idempotency conflict/); assert.match(sql, /source_event_id uuid not null unique/) })
await test("CMS records author editor publisher and timestamps", () => { for (const field of ["created_at", "created_by", "updated_at", "updated_by", "published_at", "published_by"]) assert.match(sql, new RegExp(`create table app_private\\.p2_catalog[\\s\\S]*${field}`), field) })
await test("CMS uses optimistic version concurrency", () => { assert.match(sql, /version bigint not null default 1/); assert.match(sql, /version=p_expected_version/); assert.match(sql, /version=version\+1/) })
await test("CMS stale update and publish fail closed", () => { assert.match(sql, /catalog stale version or write conflict/); assert.match(sql, /errcode='40001'/) })
await test("CMS remains content-only without supplier availability", () => { const catalog = sql.match(/create table app_private\.p2_catalog[\s\S]*?comment on table app_private\.p2_catalog/)?.[0] ?? ""; assert.doesNotMatch(catalog, /supplier|availability|inventory|booking/i) })
await test("commission and payout producer authority remains absent", () => { assert.doesNotMatch(sql, /function public\.(credit|create|execute|pay)_p2_(commission|payout)/i); assert.match(sql, /No commission, payout, notification-delivery/) })
await test("notification delivery and external providers remain absent", () => { assert.doesNotMatch(sql, /https?:\/\/|net\.http|http_post|pg_net/i); assert.doesNotMatch(sql, /deliver_p2_notification/) })
await test("migration is neither created nor applied", async () => { const migrations = await fs.readdir(new URL("../supabase/migrations/", import.meta.url)); assert.equal(migrations.some(name => /p2.*storage|product.*p2/i.test(name)), false); assert.match(sql, /NOT applied/); assert.doesNotMatch(sql, /apply_migration|supabase db push/i) })

console.log(`\n${passed}/${passed} Product P2 migration remediation tests passed`)
